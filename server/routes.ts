import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { loginSchema, gatePassWithItemsSchema, insertUserSchema, insertCustomerSchema, insertDriverSchema, insertDocumentSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { db } from "./db";
import { roles, permissions, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import * as notificationService from "./services/notification";
import bcrypt from 'bcrypt';

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Auth routes
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Direct password comparison instead of bcrypt
      const passwordMatch = password === user.password;
      if (!passwordMatch) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Set session data
      if (!req.session) {
        return res.status(500).json({ message: "Session not initialized" });
      }
      
      req.session.userId = user.id;
      req.session.userEmail = user.email;
      req.session.userRole = user.roleId;

      return res.json({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        department: user.department,
        roleId: user.roleId
      });

    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Role and Permission routes
  app.get("/api/roles", async (req: Request, res: Response) => {
    try {
      const allRoles = await db.select().from(roles);
      return res.json(allRoles);
    } catch (error) {
      console.error("Error getting roles:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get("/api/permissions", async (req: Request, res: Response) => {
    try {
      const allPermissions = await db.select().from(permissions);
      return res.json(allPermissions);
    } catch (error) {
      console.error("Error getting permissions:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get("/api/roles/:id/permissions", async (req: Request, res: Response) => {
    try {
      const roleId = parseInt(req.params.id, 10);
      if (isNaN(roleId)) {
        return res.status(400).json({ message: "Invalid role ID" });
      }
      
      const [role] = await db.select().from(roles).where(eq(roles.id, roleId));
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      
      const rolePermissions = await db
        .select()
        .from(permissions)
        .where(eq(permissions.roleId, roleId));
      
      return res.json(rolePermissions);
    } catch (error) {
      console.error("Error getting role permissions:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Role management endpoints
  app.post("/api/roles", async (req: Request, res: Response) => {
    try {
      const { name, description } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: "Valid role name is required" });
      }
      
      // Check if role with this name already exists
      const existingRole = await db
        .select()
        .from(roles)
        .where(eq(roles.name, name));
      
      if (existingRole.length > 0) {
        return res.status(400).json({ message: "Role with this name already exists" });
      }
      
      const [newRole] = await db
        .insert(roles)
        .values({
          name,
          description: description || null
        })
        .returning();
      
      return res.status(201).json(newRole);
    } catch (error) {
      console.error("Error creating role:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.patch("/api/roles/:id", async (req: Request, res: Response) => {
    try {
      const roleId = parseInt(req.params.id, 10);
      if (isNaN(roleId)) {
        return res.status(400).json({ message: "Invalid role ID" });
      }
      
      const { name, description } = req.body;
      
      // Check if role exists
      const [existingRole] = await db
        .select()
        .from(roles)
        .where(eq(roles.id, roleId));
      
      if (!existingRole) {
        return res.status(404).json({ message: "Role not found" });
      }
      
      // Don't allow changing the Admin role name for safety
      if (existingRole.name === 'Admin' && name && name !== 'Admin') {
        return res.status(403).json({ message: "The Admin role name cannot be changed" });
      }
      
      // If changing name, check that new name doesn't exist
      if (name && name !== existingRole.name) {
        const nameCheck = await db
          .select()
          .from(roles)
          .where(eq(roles.name, name));
        
        if (nameCheck.length > 0) {
          return res.status(400).json({ message: "Role with this name already exists" });
        }
      }
      
      const [updatedRole] = await db
        .update(roles)
        .set({
          name: name || existingRole.name,
          description: description !== undefined ? description : existingRole.description
        })
        .where(eq(roles.id, roleId))
        .returning();
      
      return res.json(updatedRole);
    } catch (error) {
      console.error("Error updating role:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.delete("/api/roles/:id", async (req: Request, res: Response) => {
    try {
      const roleId = parseInt(req.params.id, 10);
      if (isNaN(roleId)) {
        return res.status(400).json({ message: "Invalid role ID" });
      }
      
      // Check if role exists
      const [existingRole] = await db
        .select()
        .from(roles)
        .where(eq(roles.id, roleId));
      
      if (!existingRole) {
        return res.status(404).json({ message: "Role not found" });
      }
      
      // Don't allow deleting the Admin or default roles for safety
      if (existingRole.name === 'Admin' || 
          existingRole.name === 'Manager' || 
          existingRole.name === 'Staff') {
        return res.status(403).json({ message: "Default roles cannot be deleted" });
      }
      
      // Check if any users have this role
      const usersWithRole = await db
        .select()
        .from(users)
        .where(eq(users.roleId, roleId));
      
      if (usersWithRole.length > 0) {
        return res.status(400).json({ 
          message: "Cannot delete role that is assigned to users",
          count: usersWithRole.length
        });
      }
      
      // Delete permissions for this role
      await db
        .delete(permissions)
        .where(eq(permissions.roleId, roleId));
      
      // Delete the role
      await db
        .delete(roles)
        .where(eq(roles.id, roleId));
      
      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting role:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Permission management endpoints
  app.post("/api/permissions", async (req: Request, res: Response) => {
    try {
      const { roleId, module, action } = req.body;
      
      if (!roleId || isNaN(parseInt(roleId, 10))) {
        return res.status(400).json({ message: "Valid role ID is required" });
      }
      
      if (!module || !action) {
        return res.status(400).json({ message: "Module and action are required" });
      }
      
      // Check if role exists
      const [existingRole] = await db
        .select()
        .from(roles)
        .where(eq(roles.id, parseInt(roleId, 10)));
      
      if (!existingRole) {
        return res.status(404).json({ message: "Role not found" });
      }
      
      // Check if permission already exists
      const existingPermissions = await db
        .select()
        .from(permissions)
        .where(
          and(
            eq(permissions.roleId, parseInt(roleId, 10)),
            eq(permissions.module, module),
            eq(permissions.action, action)
          )
        );
      
      if (existingPermissions.length > 0) {
        return res.status(400).json({ message: "Permission already exists for this role" });
      }
      
      const [newPermission] = await db
        .insert(permissions)
        .values({
          roleId: parseInt(roleId, 10),
          module,
          action
        })
        .returning();
      
      return res.status(201).json(newPermission);
    } catch (error) {
      console.error("Error creating permission:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.delete("/api/permissions/:id", async (req: Request, res: Response) => {
    try {
      const permissionId = parseInt(req.params.id, 10);
      if (isNaN(permissionId)) {
        return res.status(400).json({ message: "Invalid permission ID" });
      }
      
      // Check if permission exists
      const [existingPermission] = await db
        .select()
        .from(permissions)
        .where(eq(permissions.id, permissionId));
      
      if (!existingPermission) {
        return res.status(404).json({ message: "Permission not found" });
      }
      
      // Delete the permission
      await db
        .delete(permissions)
        .where(eq(permissions.id, permissionId));
      
      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting permission:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // User routes
  app.get("/api/users", async (req: Request, res: Response) => {
    try {
      const users = await storage.getUsers();
      
      // For each user, look up their role
      const usersWithRoles = await Promise.all(users.map(async user => {
        let roleName = "user"; // Default role name
        
        if (user.roleId) {
          const [userRole] = await db.select().from(roles).where(eq(roles.id, user.roleId));
          if (userRole) {
            roleName = userRole.name;
          }
        }
        
        return {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          department: user.department,
          role: roleName.toLowerCase(), // For backward compatibility
          roleId: user.roleId,
          active: user.active,
          cnic: user.cnic,
        };
      }));
      
      return res.json(usersWithRoles);
    } catch (error) {
      console.error("Error getting users:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/users", async (req: Request, res: Response) => {
    try {
      // If role is specified, convert it to roleId
      let userData = insertUserSchema.parse(req.body);
      
      // Check if user with this email already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }
      
      // If a role string is provided in the request, look up the roleId
      if (req.body.role && !req.body.roleId) {
        const roleName = req.body.role.charAt(0).toUpperCase() + req.body.role.slice(1).toLowerCase();
        const [role] = await db.select().from(roles).where(eq(roles.name, roleName));
        
        if (role) {
          userData = { ...userData, roleId: role.id };
        } else {
          // Default to staff role if specified role not found
          const [staffRole] = await db.select().from(roles).where(eq(roles.name, 'Staff'));
          if (staffRole) {
            userData = { ...userData, roleId: staffRole.id };
          }
        }
      }
      
      // Hash the password before storing it
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
      userData = { ...userData, password: hashedPassword };
      
      const user = await storage.createUser(userData);
      
      // Get the role name for the response
      let roleName = "user";
      if (user.roleId) {
        const [userRole] = await db.select().from(roles).where(eq(roles.id, user.roleId));
        if (userRole) {
          roleName = userRole.name;
        }
      }
      
      return res.status(201).json({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        department: user.department,
        role: roleName.toLowerCase(),
        roleId: user.roleId,
        active: user.active,
        cnic: user.cnic,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error creating user:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update User API
  app.patch("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const userData = req.body;
      
      // Find the current user first
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Handle password change separately if needed
      if (userData.password) {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
        userData.password = hashedPassword;
      }
      
      // Update user
      const updatedUser = await storage.updateUser(userId, userData);
      if (!updatedUser) {
        return res.status(404).json({ message: "Failed to update user" });
      }
      
      // Get the role name for the response
      let roleName = "user";
      if (updatedUser.roleId) {
        const [userRole] = await db.select().from(roles).where(eq(roles.id, updatedUser.roleId));
        if (userRole) {
          roleName = userRole.name;
        }
      }
      
      // Return user without password
      return res.status(200).json({
        id: updatedUser.id,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        phoneNumber: updatedUser.phoneNumber,
        department: updatedUser.department,
        role: roleName.toLowerCase(),
        roleId: updatedUser.roleId,
        active: updatedUser.active,
        cnic: updatedUser.cnic,
      });
    } catch (error) {
      console.error("Error updating user:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Delete User API
  app.delete("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id, 10);
      
      // Find the current user first
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't allow deleting the admin user
      if (existingUser.roleId === 1) {
        return res.status(403).json({ message: "Cannot delete admin user" });
      }
      
      // Delete user
      const success = await storage.deleteUser(userId);
      if (!success) {
        return res.status(404).json({ message: "Failed to delete user" });
      }
      
      return res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Gate pass routes
  app.get("/api/gate-passes", async (req: Request, res: Response) => {
    try {
      const filters = {
        customerName: req.query.customerName as string || undefined,
        department: req.query.department as string || undefined,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
        gatePassNumber: req.query.gatePassNumber as string || undefined,
        itemName: req.query.itemName as string || undefined,
        createdById: req.query.createdById ? parseInt(req.query.createdById as string, 10) : undefined,
        status: req.query.status as string || undefined,
      };
      
      const gatePasses = await storage.getGatePasses(filters);
      return res.json(gatePasses);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Verification endpoint (must come before the /:id route to avoid conflicts)
  app.get("/api/gate-passes/verify/:gatePassNumber", async (req: Request, res: Response) => {
    try {
      const { gatePassNumber } = req.params;
      console.log("Verifying gate pass number:", gatePassNumber);
      
      const gatePass = await storage.getGatePassByNumber(gatePassNumber);
      console.log("Gate pass found:", gatePass ? "Yes" : "No");
      
      if (!gatePass) {
        console.log("Gate pass not found for verification");
        return res.status(404).json({ 
          isValid: false,
          message: "Gate pass not found",
          verifiedAt: new Date().toISOString()
        });
      }
      
      // Get items for this gate pass
      const items = await storage.getItemsByGatePassId(gatePass.id);
      console.log("Items retrieved:", items.length);
      
      // Create the response object with all needed data
      const verificationResult = { 
        ...gatePass, 
        items,
        isValid: true,
        verifiedAt: new Date().toISOString()
      };
      
      console.log("Sending verification response for gate pass:", gatePassNumber);
      return res.status(200).json(verificationResult);
    } catch (error) {
      console.error("Error verifying gate pass:", error);
      return res.status(500).json({ 
        isValid: false,
        message: "Internal server error",
        verifiedAt: new Date().toISOString()
      });
    }
  });

  app.get("/api/gate-passes/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // If it's not a number, return 404
      if (isNaN(id)) {
        return res.status(404).json({ message: "Gate pass not found" });
      }
      
      const gatePass = await storage.getGatePass(id);
      
      if (!gatePass) {
        return res.status(404).json({ message: "Gate pass not found" });
      }
      
      const items = await storage.getItemsByGatePassId(id);
      return res.json({ ...gatePass, items });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/gate-passes", async (req: Request, res: Response) => {
    try {
      const { items: itemsData, ...gatePassData } = gatePassWithItemsSchema.parse(req.body);
      
      // Get user information from session or request body
      const userId = gatePassData.createdById;
      
      // Fetch the user from database to get the actual user information
      const userData = await storage.getUser(userId);
      if (!userData) {
        console.warn(`User with ID ${userId} not found for activity logging`);
      }
      
      // Create the gate pass first
      const gatePass = await storage.createGatePass(gatePassData);
      
      // Then create the items associated with this gate pass
      const items = [];
      for (const itemData of itemsData) {
        const item = await storage.createItem({
          ...itemData,
          gatePassId: gatePass.id
        });
        items.push(item);
      }
      
      // Get IP addresses - both local and from proxies if available
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      const forwardedIp = req.headers['x-forwarded-for'] ? 
                          (typeof req.headers['x-forwarded-for'] === 'string' ? 
                           req.headers['x-forwarded-for'] : 
                           req.headers['x-forwarded-for'][0]) : 
                          null;
      
      // Combine both IPs for comprehensive tracking
      const ipAddresses = forwardedIp ? 
                          `${clientIp} (Local), ${forwardedIp} (ISP)` : 
                          clientIp;
      
      // Log gate pass creation activity with proper user information
      try {
        await storage.logUserActivity({
          userId: userId,
          userEmail: userData ? userData.email : "unknown user",
          actionType: "create",
          entityType: "gate_pass",
          entityId: gatePass.id,
          description: `Created gate pass #${gatePass.gatePassNumber}`,
          ipAddress: ipAddresses,
          userAgent: req.headers["user-agent"] || "unknown",
          additionalData: JSON.stringify({
            timestamp: new Date().toISOString(),
            customerName: gatePass.customerName,
            itemCount: items.length,
            department: gatePass.department
          })
        });
      } catch (error: any) {
        console.warn("Failed to log user activity:", error.message);
        // Continue with response even if activity logging fails
      }
      
      return res.status(201).json({ ...gatePass, items });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error creating gate pass:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/gate-passes/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const gatePass = await storage.getGatePass(id);
      
      if (!gatePass) {
        return res.status(404).json({ message: "Gate pass not found" });
      }
      
      // Update the gate pass
      const updatedGatePass = await storage.updateGatePass(id, req.body);
      
      // If items are included, update them too
      let items = [];
      if (req.body.items) {
        // First, delete existing items
        await storage.deleteItemsByGatePassId(id);
        
        // Then create new ones
        for (const itemData of req.body.items) {
          const item = await storage.createItem({
            ...itemData,
            gatePassId: id
          });
          items.push(item);
        }
      } else {
        // If no items were included, fetch the existing ones
        items = await storage.getItemsByGatePassId(id);
      }
      
      // Log gate pass update activity
      try {
        const userId = req.body.updatedById || gatePass.createdById;
        
        // Fetch user information from database
        const userData = await storage.getUser(userId);
        if (!userData) {
          console.warn(`User with ID ${userId} not found for activity logging`);
        }
        
        // Get IP addresses - both local and from proxies if available
        const clientIp = req.ip || req.socket.remoteAddress || "unknown";
        const forwardedIp = req.headers['x-forwarded-for'] ? 
                            (typeof req.headers['x-forwarded-for'] === 'string' ? 
                            req.headers['x-forwarded-for'] : 
                            req.headers['x-forwarded-for'][0]) : 
                            null;
        
        // Combine both IPs for comprehensive tracking
        const ipAddresses = forwardedIp ? 
                            `${clientIp} (Local), ${forwardedIp} (ISP)` : 
                            clientIp;
        
        await storage.logUserActivity({
          userId: userId,
          userEmail: userData ? userData.email : (req.body.updatedByEmail || "unknown user"),
          actionType: "update",
          entityType: "gate_pass",
          entityId: gatePass.id,
          description: `Updated gate pass #${gatePass.gatePassNumber}`,
          ipAddress: ipAddresses,
          userAgent: req.headers["user-agent"] || "unknown",
          additionalData: JSON.stringify({
            timestamp: new Date().toISOString(),
            changes: Object.keys(req.body)
              .filter(key => key !== 'items' && key !== 'updatedById' && key !== 'updatedByEmail')
              .join(', '),
            itemsUpdated: req.body.items ? true : false,
            newStatus: req.body.status || gatePass.status
          })
        });
      } catch (error: any) {
        console.warn("Failed to log user activity:", error.message);
        // Continue with response even if activity logging fails
      }
      
      res.setHeader('Content-Type', 'application/json');
      return res.json({ ...updatedGatePass, items });
    } catch (error) {
      if (error instanceof ZodError) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error updating gate pass:", error);
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/gate-passes/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const gatePass = await storage.getGatePass(id);
      
      if (!gatePass) {
        return res.status(404).json({ message: "Gate pass not found" });
      }
      
      // Store gate pass info before deletion for logging
      const gatePassNumber = gatePass.gatePassNumber;
      const customerName = gatePass.customerName;
      const createdById = gatePass.createdById;
      
      await storage.deleteGatePass(id);
      
      // Log gate pass deletion activity
      try {
        // Get user ID from the request if possible, otherwise use the creator's info
        const userId = req.body?.userId || req.query?.userId || createdById;
        
        // Fetch user information from database
        const userData = await storage.getUser(userId);
        if (!userData) {
          console.warn(`User with ID ${userId} not found for activity logging`);
        }
        
        // Get IP addresses - both local and from proxies if available
        const clientIp = req.ip || req.socket.remoteAddress || "unknown";
        const forwardedIp = req.headers['x-forwarded-for'] ? 
                            (typeof req.headers['x-forwarded-for'] === 'string' ? 
                            req.headers['x-forwarded-for'] : 
                            req.headers['x-forwarded-for'][0]) : 
                            null;
        
        // Combine both IPs for comprehensive tracking
        const ipAddresses = forwardedIp ? 
                            `${clientIp} (Local), ${forwardedIp} (ISP)` : 
                            clientIp;
        
        await storage.logUserActivity({
          userId: userId,
          userEmail: userData ? userData.email : (req.body?.userEmail || req.query?.userEmail || "unknown user"),
          actionType: "delete",
          entityType: "gate_pass",
          entityId: id,
          description: `Deleted gate pass #${gatePassNumber}`,
          ipAddress: ipAddresses,
          userAgent: req.headers["user-agent"] || "unknown",
          additionalData: JSON.stringify({
            timestamp: new Date().toISOString(),
            gatePassNumber: gatePassNumber,
            customerName: customerName
          })
        });
      } catch (error: any) {
        console.warn("Failed to log user activity:", error.message);
        // Continue with response even if activity logging fails
      }
      
      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting gate pass:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Customer routes
  app.get("/api/customers", async (req: Request, res: Response) => {
    try {
      const searchTerm = req.query.search as string || undefined;
      const customers = await storage.getCustomers(searchTerm);
      return res.json(customers);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/customers/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // If it's not a number, return 404
      if (isNaN(id)) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      const customer = await storage.getCustomer(id);
      
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      return res.json(customer);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/customers", async (req: Request, res: Response) => {
    try {
      const customerData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(customerData);
      
      // Log customer creation activity
      try {
        // Get user ID from request if available
        const userId = req.body.createdById || req.query?.userId;
        
        // Fetch user information from database if userId is available
        let userData = null;
        if (userId) {
          userData = await storage.getUser(userId);
          if (!userData) {
            console.warn(`User with ID ${userId} not found for activity logging`);
          }
        }
        
        // Get IP addresses - both local and from proxies if available
        const clientIp = req.ip || req.socket.remoteAddress || "unknown";
        const forwardedIp = req.headers['x-forwarded-for'] ? 
                            (typeof req.headers['x-forwarded-for'] === 'string' ? 
                            req.headers['x-forwarded-for'] : 
                            req.headers['x-forwarded-for'][0]) : 
                            null;
        
        // Combine both IPs for comprehensive tracking
        const ipAddresses = forwardedIp ? 
                            `${clientIp} (Local), ${forwardedIp} (ISP)` : 
                            clientIp;
        
        await storage.logUserActivity({
          userId: userId || 0,
          userEmail: userData ? userData.email : (req.body.createdByEmail || req.query?.userEmail || "unknown user"),
          actionType: "create",
          entityType: "customer",
          entityId: customer.id,
          description: `Created customer record for ${customer.name}`,
          ipAddress: ipAddresses,
          userAgent: req.headers["user-agent"] || "unknown",
          additionalData: JSON.stringify({
            timestamp: new Date().toISOString(),
            customerName: customer.name,
            customerPhone: customer.phone
          })
        });
      } catch (error: any) {
        console.warn("Failed to log user activity:", error.message);
        // Continue with response even if activity logging fails
      }
      
      return res.status(201).json(customer);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/customers/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const customer = await storage.getCustomer(id);
      
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      const updatedCustomer = await storage.updateCustomer(id, req.body);
      return res.json(updatedCustomer);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Driver routes
  app.get("/api/drivers", async (req: Request, res: Response) => {
    try {
      const searchTerm = req.query.search as string || undefined;
      const drivers = await storage.getDrivers(searchTerm);
      return res.json(drivers);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/drivers/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // If it's not a number, return 404
      if (isNaN(id)) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      const driver = await storage.getDriver(id);
      
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      return res.json(driver);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/drivers/cnic/:cnic", async (req: Request, res: Response) => {
    try {
      const { cnic } = req.params;
      const driver = await storage.getDriverByCnic(cnic);
      
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      return res.json(driver);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/drivers", async (req: Request, res: Response) => {
    try {
      const driverData = insertDriverSchema.parse(req.body);
      
      // Check if driver with this CNIC already exists
      const existingDriver = await storage.getDriverByCnic(driverData.cnic);
      if (existingDriver) {
        return res.status(400).json({ message: "Driver with this CNIC already exists" });
      }
      
      const driver = await storage.createDriver(driverData);
      
      // Log driver creation activity
      try {
        // Get user ID from request if available
        const userId = req.body.createdById || req.query?.userId;
        
        // Fetch user information from database if userId is available
        let userData = null;
        if (userId) {
          userData = await storage.getUser(userId);
          if (!userData) {
            console.warn(`User with ID ${userId} not found for activity logging`);
          }
        }
        
        // Get IP addresses - both local and from proxies if available
        const clientIp = req.ip || req.socket.remoteAddress || "unknown";
        const forwardedIp = req.headers['x-forwarded-for'] ? 
                            (typeof req.headers['x-forwarded-for'] === 'string' ? 
                            req.headers['x-forwarded-for'] : 
                            req.headers['x-forwarded-for'][0]) : 
                            null;
        
        // Combine both IPs for comprehensive tracking
        const ipAddresses = forwardedIp ? 
                            `${clientIp} (Local), ${forwardedIp} (ISP)` : 
                            clientIp;
        
        await storage.logUserActivity({
          userId: userId || 0,
          userEmail: userData ? userData.email : (req.body.createdByEmail || req.query?.userEmail || "unknown user"),
          actionType: "create",
          entityType: "driver",
          entityId: driver.id,
          description: `Created driver record for ${driver.name}`,
          ipAddress: ipAddresses,
          userAgent: req.headers["user-agent"] || "unknown",
          additionalData: JSON.stringify({
            timestamp: new Date().toISOString(),
            driverName: driver.name,
            driverCNIC: driver.cnic,
            driverMobile: driver.mobile
          })
        });
      } catch (error: any) {
        console.warn("Failed to log user activity:", error.message);
        // Continue with response even if activity logging fails
      }
      
      return res.status(201).json(driver);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error creating driver:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/drivers/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const driver = await storage.getDriver(id);
      
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      // If changing CNIC, check that the new CNIC is not already used
      if (req.body.cnic && req.body.cnic !== driver.cnic) {
        const existingDriver = await storage.getDriverByCnic(req.body.cnic);
        if (existingDriver && existingDriver.id !== id) {
          return res.status(400).json({ message: "Another driver with this CNIC already exists" });
        }
      }
      
      const updatedDriver = await storage.updateDriver(id, req.body);
      return res.json(updatedDriver);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Statistics routes
  app.get("/api/statistics", async (req: Request, res: Response) => {
    try {
      const statistics = await storage.getStatistics();
      return res.json(statistics);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // User Activity Logs
  app.get("/api/activity-logs", async (req: Request, res: Response) => {
    try {
      // Get filter parameters from request query
      const {
        userId,
        userEmail,
        actionType,
        entityType,
        dateFrom,
        dateTo
      } = req.query;
      
      // Build filters object
      const filters: any = {};
      
      if (userId && !isNaN(Number(userId))) {
        filters.userId = Number(userId);
      }
      
      if (userEmail && typeof userEmail === 'string') {
        filters.userEmail = userEmail;
      }
      
      if (actionType && typeof actionType === 'string') {
        filters.actionType = actionType;
      }
      
      if (entityType && typeof entityType === 'string') {
        filters.entityType = entityType;
      }
      
      if (dateFrom && typeof dateFrom === 'string') {
        filters.dateFrom = new Date(dateFrom);
      }
      
      if (dateTo && typeof dateTo === 'string') {
        filters.dateTo = new Date(dateTo);
      }
      
      // Get logs with filters
      const logs = await storage.getUserActivityLogs(filters);
      
      return res.json(logs);
    } catch (error) {
      console.error("Error getting activity logs:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Document routes
  app.get("/api/documents/entity/:type/:id", async (req: Request, res: Response) => {
    try {
      const entityType = req.params.type;
      const entityId = parseInt(req.params.id, 10);
      
      if (isNaN(entityId)) {
        return res.status(400).json({ message: "Invalid entity ID" });
      }
      
      const documents = await storage.getDocumentsByEntity(entityType, entityId);
      return res.json(documents);
    } catch (error) {
      console.error("Error getting documents for entity:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get("/api/documents/:id", async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id, 10);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: "Invalid document ID" });
      }
      
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      return res.json(document);
    } catch (error) {
      console.error("Error getting document:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/documents", async (req: Request, res: Response) => {
    try {
      const documentData = insertDocumentSchema.parse(req.body);
      
      // Log the user activity
      const user = req.body.user;
      if (user && user.id) {
        try {
          await storage.logUserActivity({
            userId: user.id,
            userEmail: user.email,
            actionType: "create",
            entityType: "document",
            entityId: null,
            description: `Document uploaded for ${documentData.entityType} ID ${documentData.entityId}`,
            ipAddress: req.ip || req.socket.remoteAddress || "unknown",
            userAgent: req.headers["user-agent"] || "unknown",
            additionalData: JSON.stringify({
              fileName: documentData.fileName,
              fileType: documentData.fileType,
              entityType: documentData.entityType,
              entityId: documentData.entityId
            })
          });
        } catch (error: any) {
          console.warn("Failed to log user activity:", error.message);
          // Continue with document creation even if activity logging fails
        }
      }
      
      const document = await storage.createDocument(documentData);
      return res.status(201).json(document);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error creating document:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.patch("/api/documents/:id", async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id, 10);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: "Invalid document ID" });
      }
      
      const existingDocument = await storage.getDocument(documentId);
      if (!existingDocument) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Only allow updating certain fields like description
      const fieldsToUpdate = ['description'];
      const updateData: Partial<typeof existingDocument> = {};
      
      fieldsToUpdate.forEach(field => {
        if (req.body[field] !== undefined) {
          (updateData as any)[field] = req.body[field];
        }
      });
      
      // Log the user activity
      const user = req.body.user;
      if (user && user.id) {
        try {
          await storage.logUserActivity({
            userId: user.id,
            userEmail: user.email,
            actionType: "update",
            entityType: "document",
            entityId: documentId,
            description: `Document ID ${documentId} updated`,
            ipAddress: req.ip || req.socket.remoteAddress || "unknown",
            userAgent: req.headers["user-agent"] || "unknown",
            additionalData: JSON.stringify({
              fileName: existingDocument.fileName,
              documentId: documentId,
              updatedFields: Object.keys(updateData)
            })
          });
        } catch (error: any) {
          console.warn("Failed to log user activity:", error.message);
          // Continue with document update even if activity logging fails
        }
      }
      
      const updatedDocument = await storage.updateDocument(documentId, updateData);
      return res.json(updatedDocument);
    } catch (error) {
      console.error("Error updating document:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.delete("/api/documents/:id", async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id, 10);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: "Invalid document ID" });
      }
      
      const existingDocument = await storage.getDocument(documentId);
      if (!existingDocument) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Log the user activity
      const user = req.body.user;
      if (user && user.id) {
        try {
          await storage.logUserActivity({
            userId: user.id,
            userEmail: user.email,
            actionType: "delete",
            entityType: "document",
            entityId: documentId,
            description: `Document ID ${documentId} deleted`,
            ipAddress: req.ip || req.socket.remoteAddress || "unknown",
            userAgent: req.headers["user-agent"] || "unknown",
            additionalData: JSON.stringify({
              fileName: existingDocument.fileName,
              fileType: existingDocument.fileType,
              entityType: existingDocument.entityType,
              entityId: existingDocument.entityId
            })
          });
        } catch (error: any) {
          console.warn("Failed to log user activity:", error.message);
          // Continue with document deletion even if activity logging fails
        }
      }
      
      const success = await storage.deleteDocument(documentId);
      if (success) {
        return res.status(204).send();
      } else {
        return res.status(500).json({ message: "Failed to delete document" });
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Notification settings endpoints
  app.get("/api/settings/notifications", async (req: Request, res: Response) => {
    try {
      const settings = await notificationService.getNotificationSettings();
      
      // Transform settings to the format expected by the frontend
      const response = {
        email: {
          enabled: settings.emailEnabled,
          host: settings.emailConfig.host,
          port: settings.emailConfig.port,
          secure: settings.emailConfig.secure,
          user: settings.emailConfig.auth.user,
          password: settings.emailConfig.auth.pass
        },
        sms: {
          enabled: settings.smsEnabled,
          accountSid: settings.smsConfig.accountSid,
          authToken: settings.smsConfig.authToken,
          phoneNumber: settings.smsConfig.phoneNumber
        }
      };
      
      return res.json(response);
    } catch (error) {
      console.error("Error getting notification settings:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/settings/notifications", async (req: Request, res: Response) => {
    try {
      const { email, sms } = req.body;
      
      // Transform data to the format expected by the notification service
      const settings = {
        emailEnabled: email.enabled,
        emailConfig: {
          host: email.host,
          port: email.port,
          secure: email.secure,
          auth: {
            user: email.user,
            pass: email.password
          }
        },
        smsEnabled: sms.enabled,
        smsConfig: {
          accountSid: sms.accountSid,
          authToken: sms.authToken,
          phoneNumber: sms.phoneNumber
        }
      };
      
      const success = await notificationService.saveNotificationSettings(settings);
      
      if (success) {
        return res.json({ message: "Notification settings saved successfully" });
      } else {
        return res.status(500).json({ message: "Failed to save notification settings" });
      }
    } catch (error) {
      console.error("Error saving notification settings:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/settings/test-email", async (req: Request, res: Response) => {
    try {
      const { enabled, host, port, secure, user, password } = req.body;
      
      if (!enabled) {
        return res.status(400).json({ message: "Email notifications are disabled" });
      }
      
      // Create temporary settings
      const settings = {
        emailEnabled: enabled,
        emailConfig: {
          host,
          port,
          secure,
          auth: {
            user,
            pass: password
          }
        },
        smsEnabled: false,
        smsConfig: {
          accountSid: '',
          authToken: '',
          phoneNumber: ''
        }
      };
      
      // Save temporary settings
      await notificationService.saveNotificationSettings(settings);
      
      // Attempt to send a test email
      const success = await notificationService.sendEmail(
        user, // Send to the same email
        "Test Email from Parazelsus Gate Pass System",
        "<h1>Test Email</h1><p>This is a test email from the Parazelsus Gate Pass System.</p>"
      );
      
      if (success) {
        return res.json({ message: "Test email sent successfully" });
      } else {
        return res.status(500).json({ message: "Failed to send test email" });
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      return res.status(500).json({ message: "Failed to send test email" });
    }
  });

  app.post("/api/settings/test-sms", async (req: Request, res: Response) => {
    try {
      const { enabled, accountSid, authToken, phoneNumber } = req.body;
      
      if (!enabled) {
        return res.status(400).json({ message: "SMS notifications are disabled" });
      }
      
      // Check if Twilio credentials are provided
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
        // If environment variables are not set, use the provided values
        process.env.TWILIO_ACCOUNT_SID = accountSid;
        process.env.TWILIO_AUTH_TOKEN = authToken;
        process.env.TWILIO_PHONE_NUMBER = phoneNumber;
      }
      
      // Create temporary settings
      const settings = {
        emailEnabled: false,
        emailConfig: {
          host: '',
          port: 587,
          secure: false,
          auth: {
            user: '',
            pass: ''
          }
        },
        smsEnabled: enabled,
        smsConfig: {
          accountSid,
          authToken,
          phoneNumber
        }
      };
      
      // Save temporary settings
      await notificationService.saveNotificationSettings(settings);
      
      // Attempt to send a test SMS
      const success = await notificationService.sendSMS(
        phoneNumber, // Send to the same phone number
        "Test SMS from Parazelsus Gate Pass System"
      );
      
      if (success) {
        return res.json({ message: "Test SMS sent successfully" });
      } else {
        return res.status(500).json({ message: "Failed to send test SMS" });
      }
    } catch (error) {
      console.error("Error sending test SMS:", error);
      return res.status(500).json({ message: "Failed to send test SMS" });
    }
  });
  
  return httpServer;
}
