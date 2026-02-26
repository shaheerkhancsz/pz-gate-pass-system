import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { loginSchema, gatePassWithItemsSchema, insertUserSchema, insertCustomerSchema, insertDriverSchema, insertDocumentSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { db } from "./db";
import { roles, permissions, users, gatePasses, gatePassApprovals, approvalSettings, departments } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import * as notificationService from "./services/notification";
import * as sapService from "./services/sap";
import * as ldapService from "./services/ldap";
import bcrypt from 'bcrypt';
import { ModuleType, PermissionAction } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Auth routes
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      console.log('Login attempt:', { email });

      const user = await storage.getUserByEmail(email);
      console.log('Found user:', { id: user?.id, email: user?.email, hashedPassword: user?.password });

      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Use bcrypt to compare passwords
      const isPasswordValid = await bcrypt.compare(password, user.password);
      console.log('Password comparison:', {
        attempted: password,
        storedHash: user.password,
        isValid: isPasswordValid
      });

      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Set session data
      if (!req.session) {
        return res.status(500).json({ message: "Session not initialized" });
      }

      req.session.userId = user.id;
      req.session.userEmail = user.email;
      req.session.userRole = user.roleId;

      // Get user's role permissions
      const rolePermissions = user.roleId ? await db
        .select()
        .from(permissions)
        .where(eq(permissions.roleId, user.roleId))
        : [];

      return res.json({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        department: user.department,
        roleId: user.roleId,
        permissions: rolePermissions
      });

    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Temporary endpoint to reset password - REMOVE AFTER USE
  app.post("/api/auth/admin-reset-password", async (req: Request, res: Response) => {
    try {
      const { email, newPassword } = req.body;

      // Get the user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update the user's password
      await storage.updateUser(user.id, {
        password: hashedPassword
      });

      return res.json({ message: "Password reset successful" });
    } catch (error) {
      console.error('Error resetting password:', error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // =============================================
  // Company routes (Multi-Company Architecture)
  // =============================================
  app.get("/api/companies", async (req: Request, res: Response) => {
    try {
      const allCompanies = await storage.getCompanies();
      return res.json(allCompanies);
    } catch (error) {
      console.error("Error getting companies:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/companies/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid company ID" });
      const company = await storage.getCompany(id);
      if (!company) return res.status(404).json({ message: "Company not found" });
      return res.json(company);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/companies", async (req: Request, res: Response) => {
    try {
      const { insertCompanySchema } = await import("@shared/schema");
      const data = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(data);
      return res.status(201).json(company);
    } catch (error) {
      if (error instanceof ZodError)
        return res.status(400).json({ message: fromZodError(error).message });
      console.error("Error creating company:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/companies/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid company ID" });
      const company = await storage.updateCompany(id, req.body);
      if (!company) return res.status(404).json({ message: "Company not found" });
      return res.json(company);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/companies/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid company ID" });
      const success = await storage.deleteCompany(id);
      if (!success) return res.status(404).json({ message: "Company not found" });
      return res.status(204).send();
    } catch (error) {
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

      const roleId = (newRole as any).insertId;
      const [createdRole] = await db.select().from(roles).where(eq(roles.id, roleId));
      return res.status(201).json(createdRole);
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
        .where(eq(roles.id, roleId));

      const [updatedRoleResult] = await db.select().from(roles).where(eq(roles.id, roleId));
      return res.json(updatedRoleResult);
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

      const permId = (newPermission as any).insertId;
      const [createdPermission] = await db.select().from(permissions).where(eq(permissions.id, permId));
      return res.status(201).json(createdPermission);
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
      const userData = insertUserSchema.parse(req.body);

      // Hash the password
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Create user with hashed password
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword
      });

      return res.json({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        department: user.department,
        roleId: user.roleId
      });

    } catch (error) {
      console.error('Error creating user:', error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update User API
  app.patch("/api/users/:id", async (req: Request, res: Response) => {
    try {
      // Set content type header first
      res.setHeader('Content-Type', 'application/json');

      const userId = parseInt(req.params.id, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Get the existing user
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // If password is being updated, hash it
      const updateData = { ...req.body };
      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10);
      }

      // Update the user with proper error handling
      try {
        const updatedUser = await storage.updateUser(userId, updateData);
        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        return res.json({
          id: updatedUser.id,
          email: updatedUser.email,
          fullName: updatedUser.fullName,
          department: updatedUser.department,
          roleId: updatedUser.roleId,
          active: updatedUser.active
        });
      } catch (dbError) {
        console.error('Database error:', dbError);
        return res.status(500).json({ message: "Failed to update user" });
      }

    } catch (error) {
      console.error('Error updating user:', error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete User API
  app.delete("/api/users/:id", async (req: Request, res: Response) => {
    try {
      // Set content type header first
      res.setHeader('Content-Type', 'application/json');

      const userId = parseInt(req.params.id, 10);

      // Find the current user first
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Delete user with proper error handling
      try {
        const success = await storage.deleteUser(userId);
        if (!success) {
          return res.status(500).json({ message: "Failed to delete user" });
        }

        return res.json({ message: "User deleted successfully" });
      } catch (dbError) {
        console.error('Database error:', dbError);
        return res.status(500).json({ message: "Failed to delete user" });
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Gate pass routes
  app.get("/api/gate-passes", async (req: Request, res: Response) => {
    try {
      // Get user from session
      const userId = req.session?.userId;
      const userRole = req.session?.userRole;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get the user's details for department check
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Get user's permissions
      const userPermissions = userRole ? await db
        .select()
        .from(permissions)
        .where(eq(permissions.roleId, userRole)) : [];

      // Check if user has permission to view all gate passes (Admin or Group Admin)
      const canViewAll = userRole === 1; // Admin role

      // Check if user is a Group Admin (can view cross-company data)
      let isGroupAdmin = false;
      if (userRole) {
        const role = await db.select().from(roles).where(eq(roles.id, userRole));
        if (role.length > 0 && role[0].name === 'Group Admin') {
          isGroupAdmin = true;
        }
      }

      // Build filters object with proper type
      const filters: Parameters<typeof storage.getGatePasses>[0] = {
        customerName: req.query.customerName as string || undefined,
        department: req.query.department as string || undefined,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
        gatePassNumber: req.query.gatePassNumber as string || undefined,
        itemName: req.query.itemName as string || undefined,
        status: req.query.status as string || undefined,
        type: req.query.type as string || undefined,
      };

      // If user is not admin or group admin:
      // 1. They can only see gate passes from their department
      // 2. They can only see gate passes from their company
      if (!canViewAll && !isGroupAdmin) {
        filters.department = user.department;
        if (user.companyId) {
          filters.companyId = user.companyId;
        }
      }

      const gatePasses = await storage.getGatePasses(filters);
      return res.json(gatePasses);
    } catch (error) {
      console.error("Error getting gate passes:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Verification endpoint (must come before the /:id route to avoid conflicts)
  app.get("/api/gate-passes/verify/:gatePassNumber", async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get user's role and permissions
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Get user's permissions
      const userPermissions = await db
        .select()
        .from(permissions)
        .where(eq(permissions.roleId, user.roleId || 0));

      // Check if user has permission to verify gate passes
      const canVerify = user.roleId === 1 || // Admin role
        userPermissions.some(p =>
          p.module === 'qrScanner' && p.action === 'read'
        );

      if (!canVerify) {
        return res.status(403).json({ message: "Permission denied" });
      }

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

      // Auto-assign the gate pass to the user's company
      if (userData?.companyId && !gatePassData.companyId) {
        (gatePassData as any).companyId = userData.companyId;
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

      // Phase 4: Notify HOD of new submission (non-blocking)
      notificationService.notifyHodOfNewPass({ ...gatePass, items }).catch(err =>
        console.warn("HOD notification failed:", err?.message)
      );

      return res.status(201).json({ ...gatePass, items });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error creating gate pass:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // =============================================
  // Phase 3: Mark Returnable Pass as Returned
  // =============================================

  // Mark as Returned: sets actualReturnDate on a returnable pass
  app.post("/api/gate-passes/:id/mark-returned", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const gatePass = await storage.getGatePass(id);
      if (!gatePass) return res.status(404).json({ message: "Gate pass not found" });
      if ((gatePass as any).type !== "returnable") {
        return res.status(400).json({ message: "Only returnable gate passes can be marked as returned" });
      }

      const { userId, actualReturnDate } = req.body;
      const returnDate = actualReturnDate || new Date().toISOString().split("T")[0];
      const actor = await storage.getUser(userId);

      const updated = await storage.updateGatePass(id, {
        actualReturnDate: returnDate,
      } as any);

      await storage.logUserActivity({
        userId, userEmail: actor?.email || "unknown",
        actionType: "mark_returned", entityType: "gate_pass", entityId: id,
        description: `Marked returnable gate pass #${gatePass.gatePassNumber} as returned on ${returnDate}`,
        ipAddress: getIpAddresses(req), userAgent: req.headers["user-agent"] || "unknown",
        additionalData: JSON.stringify({ timestamp: new Date().toISOString(), actualReturnDate: returnDate })
      }).catch(() => { });

      const items = await storage.getItemsByGatePassId(id);
      return res.json({ ...updated, items });
    } catch (error) {
      console.error("Error marking gate pass as returned:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // =============================================
  // Phase 2: Approval Workflow Action Endpoints
  // =============================================

  // Helper to get IP address string
  function getIpAddresses(req: Request): string {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    const forwardedIp = req.headers['x-forwarded-for']
      ? (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for']
        : req.headers['x-forwarded-for'][0])
      : null;
    return forwardedIp ? `${clientIp} (Local), ${forwardedIp} (ISP)` : clientIp;
  }

  // Approve: pending → approved (supports ANY mode and ALL mode)
  app.post("/api/gate-passes/:id/approve", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const gatePass = await storage.getGatePass(id);
      if (!gatePass) return res.status(404).json({ message: "Gate pass not found" });
      if (gatePass.status !== "pending") {
        return res.status(400).json({ message: `Cannot approve a pass with status: ${gatePass.status}` });
      }

      const { userId } = req.body;
      const actor = await storage.getUser(userId);

      // Look up approval settings for this department + company
      const settings = await db
        .select()
        .from(approvalSettings)
        .where(
          and(
            eq(approvalSettings.companyId, gatePass.companyId ?? 0),
            eq(approvalSettings.department, gatePass.department)
          )
        );

      const mode = settings.length > 0 ? settings[0].mode : "any";
      const requiredApproverIds = settings.map((s) => s.userId);

      // Record this approver's vote
      await db
        .insert(gatePassApprovals)
        .ignore()
        .values({ gatePassId: id, userId: userId });

      let newStatus: "pending" | "approved" = "pending";

      if (mode === "all" && requiredApproverIds.length > 1) {
        // ALL mode: check if every required approver has now approved
        const given = await db
          .select()
          .from(gatePassApprovals)
          .where(eq(gatePassApprovals.gatePassId, id));
        const givenIds = new Set(given.map((g) => g.userId));
        const allApproved = requiredApproverIds.every((uid) => givenIds.has(uid));
        if (allApproved) newStatus = "approved";
      } else {
        // ANY mode (or no settings configured): first approver wins
        newStatus = "approved";
      }

      let updated: any = gatePass;
      if (newStatus === "approved") {
        updated = await storage.updateGatePass(id, {
          status: "approved",
          approvedBy: userId || null,
          approvedAt: new Date(),
          // also keep legacy columns in sync
          hodApprovedBy: userId || null,
          hodApprovedAt: new Date(),
        } as any) ?? gatePass;

        // Phase 4: Notify initiator + security (non-blocking)
        const actorName = actor?.fullName || actor?.email || "Approver";
        notificationService.notifyInitiatorOfHodDecision(gatePass, "approved", actorName).catch(() => { });
        notificationService.notifySecurityOfApprovedPass(gatePass).catch(() => { });
      }

      await storage.logUserActivity({
        userId, userEmail: actor?.email || "unknown",
        actionType: "approve", entityType: "gate_pass", entityId: id,
        description: newStatus === "approved"
          ? `Approved gate pass #${gatePass.gatePassNumber} (status → approved)`
          : `Partial approval recorded for gate pass #${gatePass.gatePassNumber} (waiting for all approvers)`,
        ipAddress: getIpAddresses(req), userAgent: req.headers["user-agent"] || "unknown",
        additionalData: JSON.stringify({ mode, newStatus, timestamp: new Date().toISOString() })
      }).catch(() => { });

      const items = await storage.getItemsByGatePassId(id);
      return res.json({ ...updated, items, approvalStatus: newStatus });
    } catch (error) {
      console.error("Error approving gate pass:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // HOD Reject: any non-terminal → rejected
  app.post("/api/gate-passes/:id/reject", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const gatePass = await storage.getGatePass(id);
      if (!gatePass) return res.status(404).json({ message: "Gate pass not found" });
      if (["completed", "rejected"].includes(gatePass.status)) {
        return res.status(400).json({ message: `Cannot reject a pass with status: ${gatePass.status}` });
      }

      const { userId, remarks } = req.body;
      const actor = await storage.getUser(userId);

      const updated = await storage.updateGatePass(id, {
        status: "rejected",
        remarks: remarks || null,
      } as any);

      await storage.logUserActivity({
        userId, userEmail: actor?.email || "unknown",
        actionType: "reject", entityType: "gate_pass", entityId: id,
        description: `Rejected gate pass #${gatePass.gatePassNumber}${remarks ? `: ${remarks}` : ""}`,
        ipAddress: getIpAddresses(req), userAgent: req.headers["user-agent"] || "unknown",
        additionalData: JSON.stringify({ timestamp: new Date().toISOString(), remarks })
      }).catch(() => { });

      // Phase 4: Notify initiator of rejection (non-blocking)
      const actorName = actor?.fullName || actor?.email || "HOD";
      notificationService.notifyInitiatorOfHodDecision(gatePass, "rejected", actorName, remarks).catch(() => { });

      const items = await storage.getItemsByGatePassId(id);
      return res.json({ ...updated, items });
    } catch (error) {
      console.error("Error rejecting gate pass:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // HOD Send Back: pending → sent_back (with remarks)
  app.post("/api/gate-passes/:id/send-back", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const gatePass = await storage.getGatePass(id);
      if (!gatePass) return res.status(404).json({ message: "Gate pass not found" });
      if (gatePass.status !== "pending") {
        return res.status(400).json({ message: `Cannot send back a pass with status: ${gatePass.status}` });
      }

      const { userId, remarks } = req.body;
      if (!remarks || !remarks.trim()) {
        return res.status(400).json({ message: "Remarks are required when sending back a gate pass" });
      }
      const actor = await storage.getUser(userId);

      const updated = await storage.updateGatePass(id, {
        status: "sent_back",
        remarks: remarks.trim(),
      } as any);

      await storage.logUserActivity({
        userId, userEmail: actor?.email || "unknown",
        actionType: "send_back", entityType: "gate_pass", entityId: id,
        description: `Sent back gate pass #${gatePass.gatePassNumber}: ${remarks}`,
        ipAddress: getIpAddresses(req), userAgent: req.headers["user-agent"] || "unknown",
        additionalData: JSON.stringify({ timestamp: new Date().toISOString(), remarks })
      }).catch(() => { });

      // Phase 4: Notify initiator of send-back with remarks (non-blocking)
      const actorName = actor?.fullName || actor?.email || "HOD";
      notificationService.notifyInitiatorOfHodDecision(gatePass, "sent_back", actorName, remarks).catch(() => { });

      const items = await storage.getItemsByGatePassId(id);
      return res.json({ ...updated, items });
    } catch (error) {
      console.error("Error sending back gate pass:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Security Allow: approved → security_allowed
  app.post("/api/gate-passes/:id/security-allow", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const gatePass = await storage.getGatePass(id);
      if (!gatePass) return res.status(404).json({ message: "Gate pass not found" });
      if (gatePass.status !== "approved") {
        return res.status(400).json({ message: `Cannot allow a pass with status: ${gatePass.status}` });
      }

      const { userId } = req.body;
      const actor = await storage.getUser(userId);

      const updated = await storage.updateGatePass(id, {
        status: "security_allowed",
        securityAllowedBy: userId || null,
        securityAllowedAt: new Date(),
      } as any);

      await storage.logUserActivity({
        userId, userEmail: actor?.email || "unknown",
        actionType: "security_allow", entityType: "gate_pass", entityId: id,
        description: `Security allowed gate pass #${gatePass.gatePassNumber}`,
        ipAddress: getIpAddresses(req), userAgent: req.headers["user-agent"] || "unknown",
        additionalData: JSON.stringify({ timestamp: new Date().toISOString(), gatePassNumber: gatePass.gatePassNumber })
      }).catch(() => { });

      const items = await storage.getItemsByGatePassId(id);
      return res.json({ ...updated, items });
    } catch (error) {
      console.error("Error allowing gate pass at security:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Security Send Back: approved → sent_back (requires remarks, notifies initiator)
  app.post("/api/gate-passes/:id/security-send-back", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const gatePass = await storage.getGatePass(id);
      if (!gatePass) return res.status(404).json({ message: "Gate pass not found" });
      if (gatePass.status !== "approved") {
        return res.status(400).json({ message: `Cannot send back a pass with status: ${gatePass.status}` });
      }

      const { userId, remarks } = req.body;
      if (!remarks || !remarks.trim()) {
        return res.status(400).json({ message: "Remarks are required when security sends back a gate pass" });
      }
      const actor = await storage.getUser(userId);

      const updated = await storage.updateGatePass(id, {
        status: "sent_back",
        securityRemarks: remarks.trim(),
      } as any);

      await storage.logUserActivity({
        userId, userEmail: actor?.email || "unknown",
        actionType: "security_send_back", entityType: "gate_pass", entityId: id,
        description: `Security sent back gate pass #${gatePass.gatePassNumber}: ${remarks}`,
        ipAddress: getIpAddresses(req), userAgent: req.headers["user-agent"] || "unknown",
        additionalData: JSON.stringify({ timestamp: new Date().toISOString(), remarks })
      }).catch(() => { });

      // Notify initiator of security send-back with remarks (non-blocking)
      const actorName = actor?.fullName || actor?.email || "Security";
      notificationService.notifyInitiatorOfHodDecision(gatePass, "sent_back", actorName, remarks).catch(() => { });

      const items = await storage.getItemsByGatePassId(id);
      return res.json({ ...updated, items });
    } catch (error) {
      console.error("Error security sending back gate pass:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Complete: security_allowed → completed
  app.post("/api/gate-passes/:id/complete", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const gatePass = await storage.getGatePass(id);
      if (!gatePass) return res.status(404).json({ message: "Gate pass not found" });
      if (gatePass.status !== "security_allowed") {
        return res.status(400).json({ message: `Cannot complete a pass with status: ${gatePass.status}` });
      }

      const { userId } = req.body;
      const actor = await storage.getUser(userId);

      const updated = await storage.updateGatePass(id, { status: "completed" } as any);

      await storage.logUserActivity({
        userId, userEmail: actor?.email || "unknown",
        actionType: "complete", entityType: "gate_pass", entityId: id,
        description: `Completed gate pass #${gatePass.gatePassNumber}`,
        ipAddress: getIpAddresses(req), userAgent: req.headers["user-agent"] || "unknown",
        additionalData: JSON.stringify({ timestamp: new Date().toISOString(), gatePassNumber: gatePass.gatePassNumber })
      }).catch(() => { });

      const items = await storage.getItemsByGatePassId(id);
      return res.json({ ...updated, items });
    } catch (error) {
      console.error("Error completing gate pass:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Resubmit: sent_back → pending (initiator edits and resubmits)
  app.post("/api/gate-passes/:id/resubmit", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const gatePass = await storage.getGatePass(id);
      if (!gatePass) return res.status(404).json({ message: "Gate pass not found" });
      if (gatePass.status !== "sent_back") {
        return res.status(400).json({ message: `Cannot resubmit a pass with status: ${gatePass.status}` });
      }

      const { userId } = req.body;
      const actor = await storage.getUser(userId);

      // Clear remarks when resubmitting so it starts fresh
      const updated = await storage.updateGatePass(id, {
        status: "pending",
        remarks: null,
      } as any);

      await storage.logUserActivity({
        userId, userEmail: actor?.email || "unknown",
        actionType: "resubmit", entityType: "gate_pass", entityId: id,
        description: `Resubmitted gate pass #${gatePass.gatePassNumber} for approval`,
        ipAddress: getIpAddresses(req), userAgent: req.headers["user-agent"] || "unknown",
        additionalData: JSON.stringify({ timestamp: new Date().toISOString(), gatePassNumber: gatePass.gatePassNumber })
      }).catch(() => { });

      // Phase 4: Notify HOD that pass has been resubmitted (non-blocking)
      notificationService.notifyHodOfResubmission(gatePass).catch(() => { });

      const items = await storage.getItemsByGatePassId(id);
      return res.json({ ...updated, items });
    } catch (error) {
      console.error("Error resubmitting gate pass:", error);
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

      // Phase 2: Lock editing once pass has moved beyond pending/sent_back
      // Only admins (roleId 1) can bypass this lock
      const isAdmin = req.body.user?.roleId === 1 || req.body.userRoleId === 1;
      const lockedStatuses = ["approved", "security_allowed", "completed", "rejected"];
      if (!isAdmin && lockedStatuses.includes(gatePass.status)) {
        return res.status(403).json({
          message: `Gate pass cannot be edited — current status is "${gatePass.status}". Use the workflow actions instead.`
        });
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
      // Phase 5: Block manual creation when SAP is enabled for the company
      if (req.body.companyId) {
        const sapCfg = await sapService.getSapConfig(Number(req.body.companyId));
        if (sapCfg?.enabled) {
          return res.status(403).json({
            message: "Manual customer creation is disabled — customers are synced from SAP. Use the SAP Sync feature instead."
          });
        }
      }

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
      // Phase 5: Block manual creation when SAP is enabled for the company
      if (req.body.companyId) {
        const sapCfg = await sapService.getSapConfig(Number(req.body.companyId));
        if (sapCfg?.enabled) {
          return res.status(403).json({
            message: "Manual driver creation is disabled — drivers are synced from SAP. Use the SAP Sync feature instead."
          });
        }
      }

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

  // Notification Settings routes
  app.get("/api/settings/notifications", async (req: Request, res: Response) => {
    try {
      const settings = await notificationService.getNotificationSettings();
      return res.json({
        email: {
          enabled: settings.emailEnabled,
          host: settings.emailConfig.host,
          port: settings.emailConfig.port,
          secure: settings.emailConfig.secure,
          user: settings.emailConfig.auth.user,
          password: settings.emailConfig.auth.pass,
        },
        sms: {
          enabled: settings.smsEnabled,
          accountSid: settings.smsConfig.accountSid,
          authToken: settings.smsConfig.authToken,
          phoneNumber: settings.smsConfig.phoneNumber,
        },
        whatsapp: {
          enabled: (settings as any).whatsappEnabled ?? false,
          phoneNumberId: (settings as any).whatsappConfig?.phoneNumberId ?? '',
          accessToken: (settings as any).whatsappConfig?.accessToken ?? '',
        },
      });
    } catch (error) {
      console.error("Error getting notification settings:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/settings/notifications", async (req: Request, res: Response) => {
    try {
      const { email, sms, whatsapp } = req.body;

      if (!email || !sms) {
        return res.status(400).json({
          message: "Invalid settings format. Both email and sms configurations are required."
        });
      }

      // For email settings, if enabled but no SMTP settings, use Ethereal
      const useEthereal = email.enabled && (!email.host || !email.user);

      const settings = {
        emailEnabled: email.enabled,
        emailConfig: {
          host: useEthereal ? '' : (email.host || ''),
          port: Number(email.port) || 587,
          secure: Boolean(email.secure),
          auth: {
            user: useEthereal ? '' : (email.user || ''),
            pass: useEthereal ? '' : (email.password || '')
          }
        },
        smsEnabled: sms.enabled,
        smsConfig: {
          accountSid: sms.accountSid || '',
          authToken: sms.authToken || '',
          phoneNumber: sms.phoneNumber || ''
        },
        whatsappEnabled: Boolean(whatsapp?.enabled),
        whatsappConfig: {
          phoneNumberId: whatsapp?.phoneNumberId || '',
          accessToken: whatsapp?.accessToken || '',
        },
      };

      console.log('Saving notification settings:', {
        emailEnabled: settings.emailEnabled,
        emailHost: settings.emailConfig.host,
        smsEnabled: settings.smsEnabled
      });

      const success = await notificationService.saveNotificationSettings(settings);

      if (!success) {
        return res.status(500).json({
          message: "Failed to save notification settings. Please try again."
        });
      }

      return res.json({
        message: "Settings saved successfully",
        useEthereal: useEthereal
      });
    } catch (error) {
      console.error("Error saving notification settings:", error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Internal server error"
      });
    }
  });

  app.post("/api/settings/test-email", async (req: Request, res: Response) => {
    try {
      const { enabled, host, port, secure, user, password } = req.body;

      if (!enabled) {
        return res.status(400).json({ message: "Email notifications are disabled" });
      }

      // If no SMTP settings provided, use Ethereal for testing
      const useEthereal = !host || !user;

      // Create temporary settings for test
      const testSettings = {
        emailEnabled: true,
        emailConfig: {
          host: host || '', // Will be set by Ethereal if empty
          port: Number(port) || 587,
          secure: Boolean(secure),
          auth: {
            user: user || '', // Will be set by Ethereal if empty
            pass: password || '' // Will be set by Ethereal if empty
          }
        },
        smsEnabled: false,
        smsConfig: {
          accountSid: "",
          authToken: "",
          phoneNumber: ""
        }
      };

      // Save temporary settings
      const saveSuccess = await notificationService.saveNotificationSettings(testSettings);
      if (!saveSuccess) {
        throw new Error("Failed to save test settings");
      }

      // Try to send a test email
      const success = await notificationService.sendEmail(
        user || 'test@ethereal.email', // Use test email if no user provided
        "Test Email from Gate Pass System",
        `
          <h1>Test Email</h1>
          <p>This is a test email from your Gate Pass System.</p>
          <p>If you received this email, your email settings are configured correctly.</p>
          ${useEthereal ? '<p>This is a test email using Ethereal. Check the console for the preview URL.</p>' : ''}
        `
      );

      if (!success) {
        throw new Error("Failed to send test email");
      }

      return res.json({
        message: useEthereal
          ? "Test email sent successfully. Check the console for the preview URL."
          : "Test email sent successfully"
      });
    } catch (error) {
      console.error("Error testing email settings:", error);
      return res.status(500).json({
        message: "Failed to send test email",
        details: error instanceof Error ? error.message : "Unknown error"
      });
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

  app.post("/api/settings/test-whatsapp", async (req: Request, res: Response) => {
    try {
      const { enabled, phoneNumberId, accessToken, testNumber } = req.body;

      if (!enabled) {
        return res.status(400).json({ message: "WhatsApp notifications are disabled" });
      }
      if (!phoneNumberId || !accessToken) {
        return res.status(400).json({ message: "Phone Number ID and Access Token are required" });
      }
      if (!testNumber) {
        return res.status(400).json({ message: "A test recipient number is required" });
      }

      // Temporarily override settings for the test send
      const testSettings = {
        emailEnabled: false,
        emailConfig: { host: '', port: 587, secure: false, auth: { user: '', pass: '' } },
        smsEnabled: false,
        smsConfig: { accountSid: '', authToken: '', phoneNumber: '' },
        whatsappEnabled: true,
        whatsappConfig: { phoneNumberId, accessToken },
      };
      await notificationService.saveNotificationSettings(testSettings as any);

      const success = await notificationService.sendWhatsApp(
        testNumber,
        "✅ Test message from AGP Pharma Gate Pass System. WhatsApp notifications are configured correctly."
      );

      if (!success) {
        return res.status(500).json({ message: "Failed to send WhatsApp test message. Check your Phone Number ID and Access Token." });
      }

      return res.json({ message: "WhatsApp test message sent successfully." });
    } catch (error) {
      console.error("Error testing WhatsApp settings:", error);
      return res.status(500).json({ message: "Failed to send WhatsApp test message" });
    }
  });

  // =============================================
  // Phase 5: Products API (SAP-synced catalog)
  // =============================================

  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      const companyId = req.query.companyId ? parseInt(req.query.companyId as string, 10) : undefined;
      const search = (req.query.search as string) || undefined;
      const productList = await storage.getProducts(companyId, search);
      return res.json(productList);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/products", async (req: Request, res: Response) => {
    try {
      const { insertProductSchema } = await import("@shared/schema");
      const data = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(data);
      return res.status(201).json(product);
    } catch (error) {
      if (error instanceof ZodError) return res.status(400).json({ message: fromZodError(error).message });
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/products/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const product = await storage.updateProduct(id, req.body);
      if (!product) return res.status(404).json({ message: "Product not found" });
      return res.json(product);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/products/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      await storage.deleteProduct(id);
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // =============================================
  // Phase 5: SAP ERP Configuration & Sync
  // =============================================

  // GET SAP config for a company
  app.get("/api/sap/config/:companyId", async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId, 10);
      const config = await sapService.getSapConfig(companyId);
      if (!config) return res.status(404).json({ message: "Company not found" });
      // Never return the password in plaintext
      return res.json({ ...config, password: config.password ? "••••••••" : "" });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Save SAP config for a company
  app.post("/api/sap/config/:companyId", async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId, 10);
      const { enabled, baseUrl, username, password, clientId } = req.body;
      await sapService.saveSapConfig(companyId, { enabled, baseUrl, username, password, clientId });
      return res.json({ message: "SAP configuration saved successfully" });
    } catch (error) {
      console.error("Error saving SAP config:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Test SAP connection
  app.post("/api/sap/test/:companyId", async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId, 10);
      // Allow overriding config from request body for testing before saving
      const override = req.body as Partial<import("./services/sap").SapConfig>;
      const saved = await sapService.getSapConfig(companyId);
      if (!saved) return res.status(404).json({ message: "Company not found" });
      const config = { ...saved, ...override };
      const result = await sapService.testSapConnection(config);
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Trigger sync: customers
  app.post("/api/sap/sync/:companyId/customers", async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId, 10);
      const result = await sapService.syncCustomers(companyId);
      return res.json({ message: `Customers synced: ${result.synced} total (${result.created} new, ${result.updated} updated, ${result.errors} errors)`, ...result });
    } catch (error) {
      console.error("Error syncing customers from SAP:", error);
      return res.status(500).json({ message: error instanceof Error ? error.message : "Internal server error" });
    }
  });

  // Trigger sync: products/materials
  app.post("/api/sap/sync/:companyId/products", async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId, 10);
      const result = await sapService.syncProducts(companyId);
      return res.json({ message: `Products synced: ${result.synced} total (${result.created} new, ${result.updated} updated, ${result.errors} errors)`, ...result });
    } catch (error) {
      console.error("Error syncing products from SAP:", error);
      return res.status(500).json({ message: error instanceof Error ? error.message : "Internal server error" });
    }
  });

  // Trigger sync: employees
  app.post("/api/sap/sync/:companyId/employees", async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId, 10);
      const result = await sapService.syncEmployees(companyId);
      return res.json({ message: `Employees synced: ${result.synced} total (${result.created} new, ${result.updated} updated, ${result.errors} errors)`, ...result });
    } catch (error) {
      console.error("Error syncing employees from SAP:", error);
      return res.status(500).json({ message: error instanceof Error ? error.message : "Internal server error" });
    }
  });

  // Trigger full sync (all entities)
  app.post("/api/sap/sync/:companyId", async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId, 10);
      const result = await sapService.syncAll(companyId);
      return res.json({
        message: "Full SAP sync completed",
        customers: result.customers,
        products: result.products,
        employees: result.employees,
      });
    } catch (error) {
      console.error("Error running full SAP sync:", error);
      return res.status(500).json({ message: error instanceof Error ? error.message : "Internal server error" });
    }
  });

  // Inbound webhook: SAP Sale Order → auto-create draft gate pass
  app.post("/api/sap/webhook/sale-order", async (req: Request, res: Response) => {
    try {
      const { companyId, ...payload } = req.body;
      if (!companyId) return res.status(400).json({ message: "companyId is required" });

      const result = await sapService.processInboundSaleOrder(payload, parseInt(companyId, 10));

      return res.status(201).json({
        message: `Draft gate pass created from SAP Sale Order`,
        gatePassId: result.gatePassId,
        gatePassNumber: result.gatePassNumber,
      });
    } catch (error) {
      console.error("Error processing SAP sale order webhook:", error);
      return res.status(500).json({ message: error instanceof Error ? error.message : "Internal server error" });
    }
  });

  // =============================================
  // Phase 4: Overdue Returnable Pass Alert
  // =============================================

  // POST /api/notifications/overdue-check
  // Triggers an email alert to creators of overdue returnable passes.
  // Can be called manually (from admin panel) or by a cron job.
  app.post("/api/notifications/overdue-check", async (req: Request, res: Response) => {
    try {
      const result = await notificationService.checkAndNotifyOverduePasses();
      return res.json({
        message: `Overdue check complete. Found ${result.overdueCount} overdue pass${result.overdueCount !== 1 ? "es" : ""}. Notified ${result.notified} creator${result.notified !== 1 ? "s" : ""}.`,
        overdueCount: result.overdueCount,
        notified: result.notified,
      });
    } catch (error) {
      console.error("Error running overdue check:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // =============================================
  // Phase 6: Active Directory (LDAP) SSO
  // =============================================

  // POST /api/auth/ad-login
  // Authenticates a user with corporate AD credentials, auto-provisions the
  // local user record on first login, and returns a session (same shape as
  // the regular /api/auth/login response).
  app.post("/api/auth/ad-login", async (req: Request, res: Response) => {
    try {
      const { username, password, companyId } = req.body;
      if (!username || !password || !companyId) {
        return res.status(400).json({ message: "Username, password, and company are required" });
      }

      const ldapConfig = await ldapService.getLdapConfig(Number(companyId));
      if (!ldapConfig || !ldapConfig.enabled) {
        return res.status(400).json({ message: "AD/LDAP login is not enabled for this company" });
      }
      if (!ldapConfig.url || !ldapConfig.searchBase) {
        return res.status(400).json({ message: "LDAP configuration is incomplete. Contact your administrator." });
      }

      // Authenticate against AD
      const ldapUser = await ldapService.authenticateWithLdap(ldapConfig, username, password);

      // Auto-provision: find or create the local user record
      let user = await storage.getUserByEmail(ldapUser.email);
      if (!user) {
        // First login — create a local account (inactive password, company assigned)
        const tempPassword = await bcrypt.hash(crypto.randomUUID(), 10);
        await storage.createUser({
          fullName: ldapUser.fullName,
          email: ldapUser.email,
          password: tempPassword,
          department: ldapUser.department,
          phoneNumber: ldapUser.phoneNumber || null,
          companyId: Number(companyId),
          active: true,
          roleId: null,
        } as any);
        user = await storage.getUserByEmail(ldapUser.email);
      } else {
        // Refresh profile attributes from AD on every login
        await storage.updateUser(user.id, {
          fullName: ldapUser.fullName,
          department: ldapUser.department,
          ...(ldapUser.phoneNumber ? { phoneNumber: ldapUser.phoneNumber } : {}),
        } as any);
        user = await storage.getUserByEmail(ldapUser.email);
      }

      if (!user) {
        return res.status(500).json({ message: "Failed to provision user account" });
      }
      if (!user.active) {
        return res.status(403).json({ message: "Your account has been deactivated. Contact your administrator." });
      }

      // Establish session (same pattern as local login)
      req.session.userId = user.id;
      req.session.userEmail = user.email;
      req.session.userRole = user.roleId;

      const rolePermissions = user.roleId
        ? await db.select().from(permissions).where(eq(permissions.roleId, user.roleId))
        : [];

      return res.json({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        department: user.department,
        roleId: user.roleId,
        companyId: user.companyId,
        permissions: rolePermissions,
      });
    } catch (error) {
      console.error("AD Login error:", error);
      if (error instanceof Error) {
        return res.status(401).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/companies/:id/ldap-config
  // Returns the LDAP config for a company (bind password is masked).
  app.get("/api/companies/:id/ldap-config", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const config = await ldapService.getLdapConfig(id);
      if (!config) return res.status(404).json({ message: "Company not found" });
      return res.json({ ...config, bindPassword: config.bindPassword ? "••••••••" : "" });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/companies/:id/ldap-config
  // Saves LDAP config. Bind password only updated when a new value is provided.
  app.post("/api/companies/:id/ldap-config", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      await ldapService.saveLdapConfig(id, req.body);
      return res.json({ message: "LDAP configuration saved successfully" });
    } catch (error) {
      console.error("Error saving LDAP config:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/companies/:id/ldap-test
  // Tests the LDAP server connection using the stored (or provided) service-account credentials.
  app.post("/api/companies/:id/ldap-test", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      // Allow caller to pass a live config (e.g. before saving)
      const base = await ldapService.getLdapConfig(id);
      const config: ldapService.LdapConfig = {
        ...(base ?? {} as any),
        ...req.body,
        // If a real password was already stored but UI sends masked placeholder, keep the stored one
        bindPassword: req.body.bindPassword && !req.body.bindPassword.includes("•")
          ? req.body.bindPassword
          : base?.bindPassword ?? "",
      };

      await ldapService.testLdapConnection(config);
      return res.json({ success: true, message: "LDAP connection successful — service account bind OK" });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Connection failed";
      return res.json({ success: false, message: msg });
    }
  });

  // =============================================
  // Departments (Dynamic Department Management)
  // =============================================
  const { departments } = await import("@shared/schema");

  // GET /api/departments — list departments (optionally filter by companyId)
  app.get("/api/departments", async (req: Request, res: Response) => {
    try {
      const companyId = req.query.companyId ? Number(req.query.companyId) : null;
      let rows;
      if (companyId) {
        rows = await db
          .select()
          .from(departments)
          .where(and(eq(departments.companyId, companyId), eq(departments.active, true)))
          .orderBy(departments.name);
      } else {
        rows = await db
          .select()
          .from(departments)
          .where(eq(departments.active, true))
          .orderBy(departments.name);
      }
      return res.json(rows);
    } catch (error) {
      console.error("Error fetching departments:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/departments — create a new department (admin only)
  app.post("/api/departments", async (req: Request, res: Response) => {
    try {
      const { name, description, companyId } = req.body;
      if (!name || !companyId) {
        return res.status(400).json({ message: "Name and companyId are required" });
      }
      await db.insert(departments).values({
        name: name.trim(),
        description: description?.trim() || null,
        companyId: Number(companyId),
        active: true,
      });
      // Return the newly created department
      const [created] = await db
        .select()
        .from(departments)
        .where(and(eq(departments.companyId, Number(companyId)), eq(departments.name, name.trim())));
      return res.status(201).json(created);
    } catch (error: any) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "A department with this name already exists for this company" });
      }
      console.error("Error creating department:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // PATCH /api/departments/:id — update name/description
  app.patch("/api/departments/:id", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const { name, description, active } = req.body;
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = description?.trim() || null;
      if (active !== undefined) updates.active = active;
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }
      await db.update(departments).set(updates as any).where(eq(departments.id, id));
      const [updated] = await db.select().from(departments).where(eq(departments.id, id));
      return res.json(updated);
    } catch (error: any) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "A department with this name already exists for this company" });
      }
      console.error("Error updating department:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // DELETE /api/departments/:id — soft-delete (mark inactive)
  app.delete("/api/departments/:id", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      await db.update(departments).set({ active: false } as any).where(eq(departments.id, id));
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting department:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ================================================================
  // Phase 7: Plants, Gates, Vendors, Item Master
  // ================================================================
  {
    const { plants, gates, vendors, itemMaster } = await import("@shared/schema");

    // ── Plants ──────────────────────────────────────────────────────────────────

    app.get("/api/plants", async (req: Request, res: Response) => {
      try {
        const companyId = req.query.companyId ? Number(req.query.companyId) : undefined;
        const rows = await storage.getPlants(companyId);
        return res.json(rows);
      } catch (error) {
        console.error("Error fetching plants:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.get("/api/plants/:id", async (req: Request, res: Response) => {
      try {
        const row = await storage.getPlant(Number(req.params.id));
        if (!row) return res.status(404).json({ message: "Plant not found" });
        return res.json(row);
      } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.post("/api/plants", async (req: Request, res: Response) => {
      try {
        const { name, companyId, description } = req.body;
        if (!name || !companyId) return res.status(400).json({ message: "name and companyId are required" });
        const row = await storage.createPlant({ name: name.trim(), companyId: Number(companyId), description: description?.trim() || null, active: true });
        return res.status(201).json(row);
      } catch (error: any) {
        if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "A plant with this name already exists for this company" });
        console.error("Error creating plant:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.patch("/api/plants/:id", async (req: Request, res: Response) => {
      try {
        const row = await storage.updatePlant(Number(req.params.id), req.body);
        if (!row) return res.status(404).json({ message: "Plant not found" });
        return res.json(row);
      } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.delete("/api/plants/:id", async (req: Request, res: Response) => {
      try {
        await storage.deletePlant(Number(req.params.id));
        return res.json({ success: true });
      } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    // ── Gates ───────────────────────────────────────────────────────────────────

    app.get("/api/gates", async (req: Request, res: Response) => {
      try {
        const companyId = req.query.companyId ? Number(req.query.companyId) : undefined;
        const plantId = req.query.plantId ? Number(req.query.plantId) : undefined;
        const rows = await storage.getGates(companyId, plantId);
        return res.json(rows);
      } catch (error) {
        console.error("Error fetching gates:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.get("/api/gates/:id", async (req: Request, res: Response) => {
      try {
        const row = await storage.getGate(Number(req.params.id));
        if (!row) return res.status(404).json({ message: "Gate not found" });
        return res.json(row);
      } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.post("/api/gates", async (req: Request, res: Response) => {
      try {
        const { name, companyId, plantId, description } = req.body;
        if (!name || !companyId) return res.status(400).json({ message: "name and companyId are required" });
        const row = await storage.createGate({ name: name.trim(), companyId: Number(companyId), plantId: plantId ? Number(plantId) : null, description: description?.trim() || null, active: true });
        return res.status(201).json(row);
      } catch (error: any) {
        console.error("Error creating gate:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.patch("/api/gates/:id", async (req: Request, res: Response) => {
      try {
        const row = await storage.updateGate(Number(req.params.id), req.body);
        if (!row) return res.status(404).json({ message: "Gate not found" });
        return res.json(row);
      } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.delete("/api/gates/:id", async (req: Request, res: Response) => {
      try {
        await storage.deleteGate(Number(req.params.id));
        return res.json({ success: true });
      } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    // ── Vendors ─────────────────────────────────────────────────────────────────

    app.get("/api/vendors", async (req: Request, res: Response) => {
      try {
        const companyId = req.query.companyId ? Number(req.query.companyId) : undefined;
        const rows = await storage.getVendors(companyId);
        return res.json(rows);
      } catch (error) {
        console.error("Error fetching vendors:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.get("/api/vendors/:id", async (req: Request, res: Response) => {
      try {
        const row = await storage.getVendor(Number(req.params.id));
        if (!row) return res.status(404).json({ message: "Vendor not found" });
        return res.json(row);
      } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.post("/api/vendors", async (req: Request, res: Response) => {
      try {
        const { name, companyId, code, phone, email, address, sapCode } = req.body;
        if (!name || !companyId) return res.status(400).json({ message: "name and companyId are required" });
        const row = await storage.createVendor({ name: name.trim(), companyId: Number(companyId), code: code?.trim() || null, phone: phone?.trim() || null, email: email?.trim() || null, address: address?.trim() || null, sapCode: sapCode?.trim() || null, active: true });
        return res.status(201).json(row);
      } catch (error: any) {
        console.error("Error creating vendor:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.patch("/api/vendors/:id", async (req: Request, res: Response) => {
      try {
        const row = await storage.updateVendor(Number(req.params.id), req.body);
        if (!row) return res.status(404).json({ message: "Vendor not found" });
        return res.json(row);
      } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.delete("/api/vendors/:id", async (req: Request, res: Response) => {
      try {
        await storage.deleteVendor(Number(req.params.id));
        return res.json({ success: true });
      } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    // ── Item Master ──────────────────────────────────────────────────────────────

    app.get("/api/item-master", async (req: Request, res: Response) => {
      try {
        const companyId = req.query.companyId ? Number(req.query.companyId) : undefined;
        const plantId = req.query.plantId ? Number(req.query.plantId) : undefined;
        const rows = await storage.getItemMasters(companyId, plantId);
        return res.json(rows);
      } catch (error) {
        console.error("Error fetching item master:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.get("/api/item-master/:id", async (req: Request, res: Response) => {
      try {
        const row = await storage.getItemMaster(Number(req.params.id));
        if (!row) return res.status(404).json({ message: "Item not found" });
        return res.json(row);
      } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.post("/api/item-master", async (req: Request, res: Response) => {
      try {
        const { name, companyId, code, type, plantId, unit } = req.body;
        if (!name || !companyId) return res.status(400).json({ message: "name and companyId are required" });
        const row = await storage.createItemMaster({ name: name.trim(), companyId: Number(companyId), code: code?.trim() || null, type: type?.trim() || null, plantId: plantId ? Number(plantId) : null, unit: unit?.trim() || null, active: true });
        return res.status(201).json(row);
      } catch (error: any) {
        console.error("Error creating item:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.patch("/api/item-master/:id", async (req: Request, res: Response) => {
      try {
        const row = await storage.updateItemMaster(Number(req.params.id), req.body);
        if (!row) return res.status(404).json({ message: "Item not found" });
        return res.json(row);
      } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.delete("/api/item-master/:id", async (req: Request, res: Response) => {
      try {
        await storage.deleteItemMaster(Number(req.params.id));
        return res.json({ success: true });
      } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
      }
    });
  }

  // ============================================================
  // Approval Settings CRUD  (Phase 2 Revised: multi-approver)
  // ============================================================

  // GET /api/approval-settings?companyId=&department=
  app.get("/api/approval-settings", async (req: Request, res: Response) => {
    try {
      const companyId = req.query.companyId ? Number(req.query.companyId) : null;
      const department = req.query.department as string | undefined;

      let query = db
        .select({
          id: approvalSettings.id,
          companyId: approvalSettings.companyId,
          department: approvalSettings.department,
          userId: approvalSettings.userId,
          mode: approvalSettings.mode,
          createdAt: approvalSettings.createdAt,
          userFullName: users.fullName,
          userEmail: users.email,
        })
        .from(approvalSettings)
        .leftJoin(users, eq(approvalSettings.userId, users.id));

      const conditions = [];
      if (companyId) conditions.push(eq(approvalSettings.companyId, companyId));
      if (department) conditions.push(eq(approvalSettings.department, department));

      const rows = conditions.length
        ? await query.where(and(...conditions))
        : await query;

      return res.json(rows);
    } catch (error) {
      console.error("Error fetching approval settings:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/approval-settings — add an approver to a department
  app.post("/api/approval-settings", async (req: Request, res: Response) => {
    try {
      const { companyId, department, userId, mode } = req.body;
      if (!companyId || !department || !userId) {
        return res.status(400).json({ message: "companyId, department, and userId are required" });
      }

      // Update mode for all existing settings in this dept/company to the new mode
      if (mode) {
        await db
          .update(approvalSettings)
          .set({ mode: mode === "all" ? "all" : "any" })
          .where(
            and(
              eq(approvalSettings.companyId, Number(companyId)),
              eq(approvalSettings.department, department)
            )
          );
      }

      await db.insert(approvalSettings).ignore().values({
        companyId: Number(companyId),
        department,
        userId: Number(userId),
        mode: mode === "all" ? "all" : "any",
      });

      // Return fresh list for this company+dept
      const rows = await db
        .select({
          id: approvalSettings.id,
          companyId: approvalSettings.companyId,
          department: approvalSettings.department,
          userId: approvalSettings.userId,
          mode: approvalSettings.mode,
          createdAt: approvalSettings.createdAt,
          userFullName: users.fullName,
          userEmail: users.email,
        })
        .from(approvalSettings)
        .leftJoin(users, eq(approvalSettings.userId, users.id))
        .where(
          and(
            eq(approvalSettings.companyId, Number(companyId)),
            eq(approvalSettings.department, department)
          )
        );

      return res.status(201).json(rows);
    } catch (error: any) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "This user is already an approver for this department" });
      }
      console.error("Error creating approval setting:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // PATCH /api/approval-settings/mode — change mode (any/all) for a dept+company
  app.patch("/api/approval-settings/mode", async (req: Request, res: Response) => {
    try {
      const { companyId, department, mode } = req.body;
      if (!companyId || !department || !mode) {
        return res.status(400).json({ message: "companyId, department, and mode are required" });
      }
      await db
        .update(approvalSettings)
        .set({ mode: mode === "all" ? "all" : "any" })
        .where(
          and(
            eq(approvalSettings.companyId, Number(companyId)),
            eq(approvalSettings.department, department)
          )
        );
      return res.json({ success: true });
    } catch (error) {
      console.error("Error updating approval mode:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // DELETE /api/approval-settings/:id — remove an approver
  app.delete("/api/approval-settings/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      await db.delete(approvalSettings).where(eq(approvalSettings.id, id));
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting approval setting:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/gate-passes/:id/approvals — get per-approver approval records (for ALL mode progress)
  app.get("/api/gate-passes/:id/approvals", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const rows = await db
        .select({
          id: gatePassApprovals.id,
          gatePassId: gatePassApprovals.gatePassId,
          userId: gatePassApprovals.userId,
          approvedAt: gatePassApprovals.approvedAt,
          userFullName: users.fullName,
          userEmail: users.email,
        })
        .from(gatePassApprovals)
        .leftJoin(users, eq(gatePassApprovals.userId, users.id))
        .where(eq(gatePassApprovals.gatePassId, id));
      return res.json(rows);
    } catch (error) {
      console.error("Error fetching gate pass approvals:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}
