import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import fs from "fs";
import path from "path";
import { loginSchema, gatePassWithItemsSchema, insertUserSchema, insertCustomerSchema, insertDriverSchema, insertDocumentSchema, insertReportTemplateSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { db } from "./db";
import { roles, permissions, users, gatePasses, gatePassApprovals, approvalSettings, departments, items, documents } from "@shared/schema";
import { eq, and, gte, lte, ilike, asc, desc } from "drizzle-orm";
import * as notificationService from "./services/notification";
import * as sapService from "./services/sap";
import * as ldapService from "./services/ldap";
import bcrypt from 'bcrypt';
import { ModuleType, PermissionAction } from "@shared/schema";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a unique 14-char alphanumeric SAP reference code (e.g. SAP-AB3K7M2PQL4X) */
function generateSapReferenceCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rand = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `SAP-${rand}`;
}

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
        companyId: user.companyId,
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

  // GET /api/auth/permissions — returns the current user's role permissions
  app.get("/api/auth/permissions", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
      const user = await storage.getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const rolePermissions = user.roleId
        ? await db.select().from(permissions).where(eq(permissions.roleId, user.roleId))
        : [];
      return res.json(rolePermissions);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // =============================================
  // Phase 10: Forgot Password / Self-Service Reset
  // =============================================

  // POST /api/auth/forgot-password
  // Generates a 1-hour token, emails a reset link.
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body as { email?: string };
      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email.toLowerCase().trim());
      // Always return 200 to prevent email enumeration attacks
      if (!user) return res.json({ message: "If that email exists you will receive a reset link shortly." });

      // Generate a secure random token
      const crypto = await import("crypto");
      const token = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      await storage.setPasswordResetToken(user.id, token, expiry);

      // Send reset email
      const resetUrl = `${req.protocol}://${req.get("host")}/reset-password/${token}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #1e40af; margin-top: 0;">Password Reset Request</h2>
          <p>You requested a password reset for your Gate Pass System account.</p>
          <p>Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
          <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#1e40af;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;margin:16px 0;">
            Reset Password
          </a>
          <p style="font-size:12px;color:#6b7280;margin-top:24px;">
            If you did not request this, ignore this email. Your password will not change.
          </p>
        </div>`;

      await notificationService.sendEmail(email, "Gate Pass System — Password Reset", html).catch(() => {});

      return res.json({ message: "If that email exists you will receive a reset link shortly." });
    } catch (error) {
      console.error("Forgot password error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/auth/reset-password/:token — validate token (used by frontend before showing form)
  app.get("/api/auth/reset-password/:token", async (req: Request, res: Response) => {
    try {
      const user = await storage.getUserByResetToken(req.params.token);
      if (!user || !(user as any).passwordResetExpiry) {
        return res.status(400).json({ valid: false, message: "Invalid or expired reset link." });
      }
      const expiry = new Date((user as any).passwordResetExpiry);
      if (expiry < new Date()) {
        return res.status(400).json({ valid: false, message: "This reset link has expired." });
      }
      return res.json({ valid: true });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/auth/reset-password/:token — set new password
  app.post("/api/auth/reset-password/:token", async (req: Request, res: Response) => {
    try {
      const { password } = req.body as { password?: string };
      if (!password || password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters." });
      }

      const user = await storage.getUserByResetToken(req.params.token);
      if (!user || !(user as any).passwordResetExpiry) {
        return res.status(400).json({ message: "Invalid or expired reset link." });
      }
      const expiry = new Date((user as any).passwordResetExpiry);
      if (expiry < new Date()) {
        return res.status(400).json({ message: "This reset link has expired. Please request a new one." });
      }

      const hashed = await bcrypt.hash(password, 10);
      await storage.updateUser(user.id, { password: hashed });
      await storage.clearPasswordResetToken(user.id);

      return res.json({ message: "Password updated successfully. You can now log in." });
    } catch (error) {
      console.error("Reset password error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // =============================================
  // Company routes (Multi-Company Architecture)
  // =============================================
  app.get("/api/companies", async (req: Request, res: Response) => {
    try {
      let allCompanies = await storage.getCompanies();

      // If a non-admin user has company assignments, return only those
      const userId = req.session?.userId;
      const isGroupAdmin = req.session?.userRole === 1;
      if (userId && !isGroupAdmin) {
        const { userCompanies: uCompaniesTable } = await import("@shared/schema");
        const ucRows = await db.select().from(uCompaniesTable).where(eq(uCompaniesTable.userId, userId));
        if (ucRows.length > 0) {
          const assignedIds = new Set(ucRows.map(r => r.companyId));
          allCompanies = allCompanies.filter(c => assignedIds.has(c.id));
        }
      }

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

  // Theme routes — read/write theme.json for primary color
  const THEME_PATH = path.resolve(process.cwd(), "theme.json");

  app.get("/api/theme", (_req: Request, res: Response) => {
    try {
      const theme = JSON.parse(fs.readFileSync(THEME_PATH, "utf-8"));
      return res.json(theme);
    } catch {
      return res.status(500).json({ message: "Could not read theme file" });
    }
  });

  app.patch("/api/theme", (req: Request, res: Response) => {
    try {
      if (!(req as any).session?.userId) return res.status(401).json({ message: "Unauthorized" });
      const current = JSON.parse(fs.readFileSync(THEME_PATH, "utf-8"));
      const updated = { ...current, ...req.body };
      fs.writeFileSync(THEME_PATH, JSON.stringify(updated, null, 2));
      return res.json(updated);
    } catch {
      return res.status(500).json({ message: "Could not update theme file" });
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
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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

  // ── User Assignments (companies / plants / gates) ──────────────────────────

  app.get("/api/users/:id/assignments", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
      const { userCompanies, userPlants, userGates } = await import("@shared/schema");
      const uid = parseInt(req.params.id, 10);
      const [uc, up, ug] = await Promise.all([
        db.select().from(userCompanies).where(eq(userCompanies.userId, uid)),
        db.select().from(userPlants).where(eq(userPlants.userId, uid)),
        db.select().from(userGates).where(eq(userGates.userId, uid)),
      ]);
      return res.json({
        companyIds: uc.map(r => r.companyId),
        plantIds: up.map(r => r.plantId),
        gateIds: ug.map(r => r.gateId),
      });
    } catch (error) {
      console.error("Error fetching user assignments:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/users/:id/assignments", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
      const { userCompanies, userPlants, userGates } = await import("@shared/schema");
      const uid = parseInt(req.params.id, 10);
      const { companyIds = [], plantIds = [], gateIds = [] } = req.body as {
        companyIds?: number[]; plantIds?: number[]; gateIds?: number[];
      };

      // Replace all assignments atomically
      await db.delete(userCompanies).where(eq(userCompanies.userId, uid));
      await db.delete(userPlants).where(eq(userPlants.userId, uid));
      await db.delete(userGates).where(eq(userGates.userId, uid));

      if (companyIds.length > 0) {
        await db.insert(userCompanies).values(companyIds.map(cid => ({ userId: uid, companyId: cid })));
      }
      if (plantIds.length > 0) {
        await db.insert(userPlants).values(plantIds.map(pid => ({ userId: uid, plantId: pid })));
      }
      if (gateIds.length > 0) {
        await db.insert(userGates).values(gateIds.map(gid => ({ userId: uid, gateId: gid })));
      }

      return res.json({ success: true });
    } catch (error) {
      console.error("Error saving user assignments:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── /api/users/me/assignments — for the current logged-in user ──────────────
  app.get("/api/me/assignments", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
      const { userCompanies, userPlants, userGates } = await import("@shared/schema");
      const uid = req.session.userId;
      const [uc, up, ug] = await Promise.all([
        db.select().from(userCompanies).where(eq(userCompanies.userId, uid)),
        db.select().from(userPlants).where(eq(userPlants.userId, uid)),
        db.select().from(userGates).where(eq(userGates.userId, uid)),
      ]);
      return res.json({
        companyIds: uc.map(r => r.companyId),
        plantIds: up.map(r => r.plantId),
        gateIds: ug.map(r => r.gateId),
      });
    } catch (error) {
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

      // Build filters — pass date strings directly to avoid timezone conversion bugs
      const filters: Parameters<typeof storage.getGatePasses>[0] = {
        customerName: (req.query.customerName as string) || undefined,
        department: (req.query.department as string) || undefined,
        dateFrom: (req.query.dateFrom as string) || undefined,
        dateTo: (req.query.dateTo as string) || undefined,
        gatePassNumber: (req.query.gatePassNumber as string) || undefined,
        itemName: (req.query.itemName as string) || undefined,
        status: (req.query.status as string) || undefined,
        type: (req.query.type as string) || undefined,
      };

      // Check if user has security/verify permission — security sees all departments
      const canVerifyAll = userPermissions.some(
        (p) => p.module === "gatePass" && p.action === "verify"
      );

      // If user is not admin or group admin:
      // 1. Security (gatePass:verify) can see all departments but only their company
      // 2. Others can only see gate passes from their own department and company
      if (!canViewAll && !isGroupAdmin) {
        if (!canVerifyAll) {
          filters.department = user.department;
        }
        if (user.companyId) {
          filters.companyId = user.companyId;
        }
      } else if (req.query.companyId) {
        // Admin/group-admin can filter by company from query param
        filters.companyId = parseInt(req.query.companyId as string, 10);
      }

      const gatePasses = await storage.getGatePasses(filters);
      return res.json(gatePasses);
    } catch (error) {
      console.error("Error getting gate passes:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Verification endpoint (must come before the /:id route to avoid conflicts)
  // Public endpoint — no authentication required (used by QR code scans at gate)
  app.get("/api/gate-passes/verify/:gatePassNumber", async (req: Request, res: Response) => {
    try {
      const { gatePassNumber } = req.params;

      const gatePass = await storage.getGatePassByNumber(gatePassNumber);

      if (!gatePass) {
        return res.status(404).json({
          isValid: false,
          message: "Gate pass not found",
          verifiedAt: new Date().toISOString()
        });
      }

      // Get items for this gate pass
      const items = await storage.getItemsByGatePassId(gatePass.id);

      // A pass is only valid when security has allowed it or it is completed
      const validStatuses = ["security_allowed", "completed"];
      const isValid = validStatuses.includes(gatePass.status);

      const verificationResult = {
        ...gatePass,
        items,
        isValid,
        verifiedAt: new Date().toISOString()
      };

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

      // Enrich with gate name, company info, and approver names for print view
      const [gateName, companyInfo, hodApprover, securityApprover] = await Promise.all([
        (gatePass as any).gateId ? storage.getGate((gatePass as any).gateId).then(g => g?.name ?? null) : Promise.resolve(null),
        (gatePass as any).companyId ? storage.getCompany((gatePass as any).companyId).then(c => c ? { name: c.name, logo: c.logo } : null) : Promise.resolve(null),
        (gatePass as any).hodApprovedBy ? storage.getUser((gatePass as any).hodApprovedBy).then(u => u?.fullName ?? null) : Promise.resolve(null),
        (gatePass as any).securityAllowedBy ? storage.getUser((gatePass as any).securityAllowedBy).then(u => u?.fullName ?? null) : Promise.resolve(null),
      ]);

      return res.json({
        ...gatePass,
        items,
        gateName,
        companyInfo,
        hodApproverName: hodApprover,
        securityApproverName: securityApprover,
      });
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

      // Normalize date fields: Zod coerces strings → JS Date objects.
      // MySQL DATE columns need plain "YYYY-MM-DD" strings.
      // String(Date) gives locale junk like "Thu Apr 16 2026 00:00:00 GMT+0000"
      // so we must use toISOString() for Date objects.
      const toDateOnly = (v: any): string | null => {
        if (!v) return null;
        if (v instanceof Date) return v.toISOString().split("T")[0];
        return String(v).split("T")[0];
      };
      if (gatePassData.date) (gatePassData as any).date = toDateOnly(gatePassData.date);
      if ((gatePassData as any).expectedReturnDate !== undefined)
        (gatePassData as any).expectedReturnDate = (gatePassData as any).expectedReturnDate
          ? toDateOnly((gatePassData as any).expectedReturnDate)
          : null;
      if ((gatePassData as any).actualReturnDate !== undefined)
        (gatePassData as any).actualReturnDate = (gatePassData as any).actualReturnDate
          ? toDateOnly((gatePassData as any).actualReturnDate)
          : null;

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

  // Helper to get IP address string (used across workflow endpoints)
  function getIpAddresses(req: Request): string {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    const forwardedIp = req.headers['x-forwarded-for']
      ? (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for']
        : req.headers['x-forwarded-for'][0])
      : null;
    return forwardedIp ? `${clientIp} (Local), ${forwardedIp} (ISP)` : clientIp;
  }

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
      }).catch((err: any) => console.warn("[Notification]", err?.message || err));

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
        notificationService.notifyInitiatorOfHodDecision(gatePass, "approved", actorName).catch((err: any) => console.warn("[Notification]", err?.message || err));
        notificationService.notifySecurityOfApprovedPass(gatePass).catch((err: any) => console.warn("[Notification]", err?.message || err));
      }

      await storage.logUserActivity({
        userId, userEmail: actor?.email || "unknown",
        actionType: "approve", entityType: "gate_pass", entityId: id,
        description: newStatus === "approved"
          ? `Approved gate pass #${gatePass.gatePassNumber} (status → approved)`
          : `Partial approval recorded for gate pass #${gatePass.gatePassNumber} (waiting for all approvers)`,
        ipAddress: getIpAddresses(req), userAgent: req.headers["user-agent"] || "unknown",
        additionalData: JSON.stringify({ mode, newStatus, timestamp: new Date().toISOString() })
      }).catch((err: any) => console.warn("[Notification]", err?.message || err));

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
      }).catch((err: any) => console.warn("[Notification]", err?.message || err));

      // Phase 4: Notify initiator of rejection (non-blocking)
      const actorName = actor?.fullName || actor?.email || "HOD";
      notificationService.notifyInitiatorOfHodDecision(gatePass, "rejected", actorName, remarks).catch((err: any) => console.warn("[Notification]", err?.message || err));

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
      }).catch((err: any) => console.warn("[Notification]", err?.message || err));

      // Phase 4: Notify initiator of send-back with remarks (non-blocking)
      const actorName = actor?.fullName || actor?.email || "HOD";
      notificationService.notifyInitiatorOfHodDecision(gatePass, "sent_back", actorName, remarks).catch((err: any) => console.warn("[Notification]", err?.message || err));

      const items = await storage.getItemsByGatePassId(id);
      return res.json({ ...updated, items });
    } catch (error) {
      console.error("Error sending back gate pass:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Security Allow: approved → security_allowed (outward passes auto-complete immediately)
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

      // Outward passes auto-complete on security clearance; returnable/inward stay as security_allowed
      const isOutward = (gatePass as any).type === "outward";
      const newStatus = isOutward ? "completed" : "security_allowed";
      const sapCode = isOutward ? generateSapReferenceCode() : undefined;

      const updated = await storage.updateGatePass(id, {
        status: newStatus,
        securityAllowedBy: userId || null,
        securityAllowedAt: new Date(),
        ...(sapCode ? { sapReferenceCode: sapCode } : {}),
      } as any);

      await storage.logUserActivity({
        userId, userEmail: actor?.email || "unknown",
        actionType: "security_allow", entityType: "gate_pass", entityId: id,
        description: isOutward
          ? `Security allowed & auto-completed outward gate pass #${gatePass.gatePassNumber} — SAP Ref: ${sapCode}`
          : `Security allowed gate pass #${gatePass.gatePassNumber}`,
        ipAddress: getIpAddresses(req), userAgent: req.headers["user-agent"] || "unknown",
        additionalData: JSON.stringify({ timestamp: new Date().toISOString(), gatePassNumber: gatePass.gatePassNumber, sapReferenceCode: sapCode })
      }).catch((err: any) => console.warn("[Activity]", err?.message || err));

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
      }).catch((err: any) => console.warn("[Notification]", err?.message || err));

      // Notify initiator of security send-back with remarks (non-blocking)
      const actorName = actor?.fullName || actor?.email || "Security";
      notificationService.notifyInitiatorOfHodDecision(gatePass, "sent_back", actorName, remarks).catch((err: any) => console.warn("[Notification]", err?.message || err));

      const items = await storage.getItemsByGatePassId(id);
      return res.json({ ...updated, items });
    } catch (error) {
      console.error("Error security sending back gate pass:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Complete: security_allowed → completed (generates SAP reference code)
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

      // Generate unique SAP reference code
      const sapCode = generateSapReferenceCode();

      const updated = await storage.updateGatePass(id, { status: "completed", sapReferenceCode: sapCode } as any);

      await storage.logUserActivity({
        userId, userEmail: actor?.email || "unknown",
        actionType: "complete", entityType: "gate_pass", entityId: id,
        description: `Completed gate pass #${gatePass.gatePassNumber} — SAP Ref: ${sapCode}`,
        ipAddress: getIpAddresses(req), userAgent: req.headers["user-agent"] || "unknown",
        additionalData: JSON.stringify({ timestamp: new Date().toISOString(), gatePassNumber: gatePass.gatePassNumber, sapReferenceCode: sapCode })
      }).catch((err: any) => console.warn("[Activity]", err?.message || err));

      const items = await storage.getItemsByGatePassId(id);
      return res.json({ ...updated, items });
    } catch (error) {
      console.error("Error completing gate pass:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Receive Items: Security guard records partial/full return for returnable passes
  app.post("/api/gate-passes/:id/receive-items", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });

      const id = parseInt(req.params.id, 10);
      const gatePass = await storage.getGatePass(id);
      if (!gatePass) return res.status(404).json({ message: "Gate pass not found" });
      if ((gatePass as any).type !== "returnable") {
        return res.status(400).json({ message: "Only returnable gate passes support item receiving" });
      }
      if (!["security_allowed"].includes(gatePass.status)) {
        return res.status(400).json({ message: "Items can only be received on security-allowed passes" });
      }

      const { itemReturns } = req.body as { itemReturns: Array<{ itemId: number; receivedQuantity: number }> };
      if (!Array.isArray(itemReturns) || itemReturns.length === 0) {
        return res.status(400).json({ message: "itemReturns array is required" });
      }

      const allItems = await storage.getItemsByGatePassId(id);

      // Update received quantity for each item
      for (const ret of itemReturns) {
        const item = allItems.find(i => i.id === ret.itemId);
        if (!item) continue;
        const newReceived = ((item as any).receivedQuantity ?? 0) + ret.receivedQuantity;
        const capped = Math.min(newReceived, item.quantity);
        await db.update(items).set({ receivedQuantity: capped } as any).where(eq(items.id, ret.itemId));
      }

      // Re-fetch items to check if all are fully returned
      const updatedItems = await storage.getItemsByGatePassId(id);
      const allReturned = updatedItems.every(i => ((i as any).receivedQuantity ?? 0) >= i.quantity);

      let updatedPass = gatePass;
      let sapCode: string | undefined;
      if (allReturned) {
        sapCode = generateSapReferenceCode();
        updatedPass = await storage.updateGatePass(id, {
          status: "completed",
          actualReturnDate: new Date(),
          sapReferenceCode: sapCode,
        } as any) ?? gatePass;
      }

      await storage.logUserActivity({
        userId: req.session.userId,
        userEmail: "unknown",
        actionType: "receive_items",
        entityType: "gate_pass",
        entityId: id,
        description: allReturned
          ? `All items received — gate pass #${(gatePass as any).gatePassNumber} auto-completed. SAP Ref: ${sapCode}`
          : `Partial items received for gate pass #${(gatePass as any).gatePassNumber}`,
        ipAddress: getIpAddresses(req),
        userAgent: req.headers["user-agent"] || "unknown",
        additionalData: JSON.stringify({ itemReturns, allReturned, sapReferenceCode: sapCode }),
      }).catch(() => {});

      return res.json({ ...updatedPass, items: updatedItems, allReturned });
    } catch (error) {
      console.error("Error receiving items:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Resubmit: sent_back | rejected → pending (initiator edits and resubmits)
  app.post("/api/gate-passes/:id/resubmit", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const gatePass = await storage.getGatePass(id);
      if (!gatePass) return res.status(404).json({ message: "Gate pass not found" });
      if (!["sent_back", "rejected"].includes(gatePass.status)) {
        return res.status(400).json({ message: `Cannot resubmit a pass with status: ${gatePass.status}` });
      }

      const { userId } = req.body;
      const actor = await storage.getUser(userId);

      // Clear all previous approval votes so approvers can re-approve from scratch
      await db.delete(gatePassApprovals).where(eq(gatePassApprovals.gatePassId, id));

      // Clear remarks when resubmitting so it starts fresh
      const updated = await storage.updateGatePass(id, {
        status: "pending",
        remarks: null,
        securityRemarks: null,
        approvedBy: null,
        approvedAt: null,
        hodApprovedBy: null,
        hodApprovedAt: null,
      } as any);

      await storage.logUserActivity({
        userId, userEmail: actor?.email || "unknown",
        actionType: "resubmit", entityType: "gate_pass", entityId: id,
        description: `Resubmitted gate pass #${gatePass.gatePassNumber} for approval`,
        ipAddress: getIpAddresses(req), userAgent: req.headers["user-agent"] || "unknown",
        additionalData: JSON.stringify({ timestamp: new Date().toISOString(), gatePassNumber: gatePass.gatePassNumber })
      }).catch((err: any) => console.warn("[Notification]", err?.message || err));

      // Phase 4: Notify HOD that pass has been resubmitted (non-blocking)
      notificationService.notifyHodOfResubmission(gatePass).catch((err: any) => console.warn("[Notification]", err?.message || err));

      const items = await storage.getItemsByGatePassId(id);
      return res.json({ ...updated, items });
    } catch (error) {
      console.error("Error resubmitting gate pass:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Security: update Allow To field on an approved gate pass
  app.patch("/api/gate-passes/:id/allow-to", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const gatePass = await storage.getGatePass(id);
      if (!gatePass) return res.status(404).json({ message: "Gate pass not found" });

      const { allowTo, userId } = req.body;
      if (typeof allowTo !== "string") return res.status(400).json({ message: "allowTo is required" });

      const updated = await storage.updateGatePass(id, { allowTo } as any);

      await storage.logUserActivity({
        userId, userEmail: (await storage.getUser(userId))?.email || "unknown",
        actionType: "update", entityType: "gate_pass", entityId: id,
        description: `Security updated Allow To on gate pass #${gatePass.gatePassNumber}`,
        ipAddress: getIpAddresses(req), userAgent: req.headers["user-agent"] || "unknown",
        additionalData: JSON.stringify({ allowTo, timestamp: new Date().toISOString() })
      }).catch(() => {});

      return res.json(updated);
    } catch (error) {
      console.error("Error updating allowTo:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/gate-passes/:id", async (req: Request, res: Response) => {
    try {
      // Auth check
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const id = parseInt(req.params.id, 10);
      const gatePass = await storage.getGatePass(id);

      if (!gatePass) {
        return res.status(404).json({ message: "Gate pass not found" });
      }

      // Determine admin status from session — not from request body (security fix)
      const sessionUser = await storage.getUser(req.session.userId);
      const isAdmin = sessionUser?.roleId === 1;

      // Lock editing once pass has moved beyond pending/sent_back
      const lockedStatuses = ["hod_approved", "approved", "security_allowed", "completed", "rejected", "force_closed"];
      if (!isAdmin && lockedStatuses.includes(gatePass.status)) {
        return res.status(403).json({
          message: `Gate pass cannot be edited — current status is "${gatePass.status}". Use the workflow actions instead.`
        });
      }

      // Strip non-column fields before passing to Drizzle's .set()
      // Passing objects like `user` or arrays like `items` directly causes a MySQL error
      const { user: _u, items: itemsData, updatedById, updatedByEmail, ...gatePassData } = req.body;

      // Normalize date fields: Zod coerces "YYYY-MM-DD" → JS Date → JSON gives
      // "YYYY-MM-DDT00:00:00.000Z", which MySQL DATE columns reject.
      // Strip everything after "T" to get plain "YYYY-MM-DD" strings.
      const toDateOnly = (v: any) =>
        v ? String(v).split("T")[0] : null;
      if (gatePassData.date) gatePassData.date = toDateOnly(gatePassData.date);
      if (gatePassData.expectedReturnDate !== undefined)
        gatePassData.expectedReturnDate = gatePassData.expectedReturnDate
          ? toDateOnly(gatePassData.expectedReturnDate)
          : null;
      if (gatePassData.actualReturnDate !== undefined)
        gatePassData.actualReturnDate = gatePassData.actualReturnDate
          ? toDateOnly(gatePassData.actualReturnDate)
          : null;

      // Update the gate pass
      const updatedGatePass = await storage.updateGatePass(id, gatePassData);

      // If items are included, replace them
      let items: any[] = [];
      if (itemsData) {
        await storage.deleteItemsByGatePassId(id);
        for (const itemData of itemsData) {
          const item = await storage.createItem({ ...itemData, gatePassId: id });
          items.push(item);
        }
      } else {
        items = await storage.getItemsByGatePassId(id);
      }

      // Log gate pass update activity
      try {
        const actorId = updatedById || req.session.userId;
        const actorUser = await storage.getUser(actorId);

        const clientIp = req.ip || req.socket.remoteAddress || "unknown";
        const forwardedIp = req.headers['x-forwarded-for']
          ? (typeof req.headers['x-forwarded-for'] === 'string'
              ? req.headers['x-forwarded-for']
              : req.headers['x-forwarded-for'][0])
          : null;
        const ipAddresses = forwardedIp ? `${clientIp} (Local), ${forwardedIp} (ISP)` : clientIp;

        await storage.logUserActivity({
          userId: actorId,
          userEmail: actorUser?.email || updatedByEmail || "unknown user",
          actionType: "update",
          entityType: "gate_pass",
          entityId: gatePass.id,
          description: `Updated gate pass #${gatePass.gatePassNumber}`,
          ipAddress: ipAddresses,
          userAgent: req.headers["user-agent"] || "unknown",
          additionalData: JSON.stringify({
            timestamp: new Date().toISOString(),
            itemsUpdated: !!itemsData,
            newStatus: req.body.status || gatePass.status,
          }),
        });
      } catch (error: any) {
        console.warn("Failed to log user activity:", error.message);
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
      const companyId = req.query.companyId ? parseInt(req.query.companyId as string, 10) : undefined;
      const customers = await storage.getCustomers(searchTerm, companyId);
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
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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
      const companyId = req.query.companyId ? parseInt(req.query.companyId as string, 10) : undefined;
      const drivers = await storage.getDrivers(searchTerm, companyId);
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
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
      const statistics = await storage.getStatistics();
      return res.json(statistics);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Item Movement Report — joins items with gate passes
  app.get("/api/reports/item-movement", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
      const user = await storage.getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const {
        dateFrom, dateTo, type, department, status, itemName,
        companyId: companyIdParam,
      } = req.query;

      const isAdmin = user.roleId === 1;
      const isGroupAdmin = user.roleId === 2;

      // Build where conditions for gate passes
      const conditions: any[] = [];

      // Company scoping
      if (!isAdmin && !isGroupAdmin) {
        if (user.companyId) conditions.push(eq(gatePasses.companyId, user.companyId));
      } else if (companyIdParam) {
        conditions.push(eq(gatePasses.companyId, Number(companyIdParam)));
      }

      if (dateFrom) conditions.push(gte(gatePasses.date, new Date(dateFrom as string)));
      if (dateTo)   conditions.push(lte(gatePasses.date, new Date(dateTo as string)));
      if (type)     conditions.push(eq(gatePasses.type, type as string));
      if (department) conditions.push(eq(gatePasses.department, department as string));
      if (status)   conditions.push(eq(gatePasses.status, status as string));
      if (itemName) conditions.push(ilike(items.name, `%${itemName}%`));

      const rows = await db
        .select({
          itemId:         items.id,
          itemName:       items.name,
          sku:            items.sku,
          quantity:       items.quantity,
          gatePassId:     gatePasses.id,
          gatePassNumber: gatePasses.gatePassNumber,
          date:           gatePasses.date,
          type:           gatePasses.type,
          status:         gatePasses.status,
          department:     gatePasses.department,
          customerName:   gatePasses.customerName,
          companyId:      gatePasses.companyId,
        })
        .from(items)
        .innerJoin(gatePasses, eq(items.gatePassId, gatePasses.id))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(gatePasses.date))
        .limit(5000);

      return res.json(rows);
    } catch (error) {
      console.error("Error fetching item movement report:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // User Activity Logs
  app.get("/api/activity-logs", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });

      const { userId, userEmail, actionType, entityType, dateFrom, dateTo, page, limit } = req.query;

      const filters: any = {};
      if (userId && !isNaN(Number(userId))) filters.userId = Number(userId);
      if (userEmail && typeof userEmail === 'string') filters.userEmail = userEmail;
      if (actionType && typeof actionType === 'string') filters.actionType = actionType;
      if (entityType && typeof entityType === 'string') filters.entityType = entityType;
      if (dateFrom && typeof dateFrom === 'string') filters.dateFrom = new Date(dateFrom);
      if (dateTo && typeof dateTo === 'string') {
        const d = new Date(dateTo);
        d.setHours(23, 59, 59, 999);
        filters.dateTo = d;
      }

      const pageNum = page ? Math.max(1, Number(page)) : 1;
      const limitNum = limit ? Math.min(5000, Math.max(1, Number(limit))) : 50;

      const result = await storage.getUserActivityLogs(filters, { page: pageNum, limit: limitNum });
      return res.json(result);
    } catch (error) {
      console.error("Error getting activity logs:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Document Report — bulk metadata listing (no fileData), left-joins gatePasses for context
  app.get("/api/reports/documents", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
      const user = await storage.getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const isAdmin     = user.roleId === 1;
      const isGroupAdmin = user.roleId === 2;
      const { dateFrom, dateTo, entityType: entityTypeParam, fileType, uploadedByEmail, companyId: companyIdParam } = req.query;

      const conditions: any[] = [];

      // Company scoping via gate pass join — only meaningful for gatePass entity type
      if (!isAdmin && !isGroupAdmin) {
        if (user.companyId) conditions.push(eq(gatePasses.companyId, user.companyId));
      } else if (companyIdParam) {
        conditions.push(eq(gatePasses.companyId, Number(companyIdParam)));
      }

      if (entityTypeParam) conditions.push(eq(documents.entityType, entityTypeParam as string));
      if (fileType)         conditions.push(ilike(documents.fileType, `%${fileType}%`));
      if (uploadedByEmail)  conditions.push(ilike(documents.uploadedByEmail, `%${uploadedByEmail}%`));
      if (dateFrom)         conditions.push(gte(documents.createdAt, new Date(dateFrom as string)));
      if (dateTo) {
        const end = new Date(dateTo as string);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(documents.createdAt, end));
      }

      const rows = await db
        .select({
          id:              documents.id,
          fileName:        documents.fileName,
          fileType:        documents.fileType,
          fileSize:        documents.fileSize,
          entityType:      documents.entityType,
          entityId:        documents.entityId,
          description:     documents.description,
          uploadedByEmail: documents.uploadedByEmail,
          createdAt:       documents.createdAt,
          // Gate pass context (null for non-gatePass entities)
          gatePassNumber:  gatePasses.gatePassNumber,
          gatePassDate:    gatePasses.date,
          gatePassType:    gatePasses.type,
          gatePassStatus:  gatePasses.status,
          department:      gatePasses.department,
          customerName:    gatePasses.customerName,
          companyId:       gatePasses.companyId,
        })
        .from(documents)
        .leftJoin(
          gatePasses,
          and(
            eq(documents.entityId, gatePasses.id),
            eq(documents.entityType, "gatePass")
          )
        )
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(documents.createdAt))
        .limit(5000);

      return res.json(rows);
    } catch (error) {
      console.error("Error fetching document report:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Document routes
  app.get("/api/documents", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
      const { entityType, search, dateFrom, dateTo } = req.query;
      const filters: any = {};
      if (entityType && typeof entityType === 'string') filters.entityType = entityType;
      if (search && typeof search === 'string') filters.search = search;
      if (dateFrom && typeof dateFrom === 'string') filters.dateFrom = new Date(dateFrom);
      if (dateTo && typeof dateTo === 'string') filters.dateTo = new Date(dateTo);
      const docs = await storage.getAllDocuments(filters);
      return res.json(docs);
    } catch (error) {
      console.error("Error getting all documents:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/documents/entity/:type/:id", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
      const documentData = insertDocumentSchema.parse(req.body);

      // Log the user activity
      const sessionUser = req.session.userId ? await storage.getUser(req.session.userId) : null;
      if (sessionUser) {
        try {
          await storage.logUserActivity({
            userId: sessionUser.id,
            userEmail: sessionUser.email,
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
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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
      const sessionUser = req.session.userId ? await storage.getUser(req.session.userId) : null;
      if (sessionUser) {
        try {
          await storage.logUserActivity({
            userId: sessionUser.id,
            userEmail: sessionUser.email,
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
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
      const documentId = parseInt(req.params.id, 10);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: "Invalid document ID" });
      }

      const existingDocument = await storage.getDocument(documentId);
      if (!existingDocument) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Log the user activity
      const sessionUser = req.session.userId ? await storage.getUser(req.session.userId) : null;
      if (sessionUser) {
        try {
          await storage.logUserActivity({
            userId: sessionUser.id,
            userEmail: sessionUser.email,
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
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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
        },
        whatsappEnabled: false,
        whatsappConfig: {
          phoneNumberId: "",
          accessToken: ""
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
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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
        },
        whatsappEnabled: false,
        whatsappConfig: {
          phoneNumberId: "",
          accessToken: ""
        }
      };

      // Save temporary settings
      await notificationService.saveNotificationSettings(settings);

      // Attempt to send a test SMS
      const success = await notificationService.sendSMS(
        phoneNumber, // Send to the same phone number
        "Test SMS from AGP Limited Gate Pass System"
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
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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
  // Phase 12: Batch Gate Pass Operations
  // =============================================

  // POST /api/gate-passes/batch-approve  — body: { ids: number[], userId: number }
  app.post("/api/gate-passes/batch-approve", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
      const { ids } = req.body as { ids?: number[] };
      const userId = req.session.userId;
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids array required" });

      const actor = await storage.getUser(userId);
      const results: { id: number; success: boolean; error?: string }[] = [];

      for (const id of ids) {
        try {
          const gp = await storage.getGatePass(id);
          if (!gp) { results.push({ id, success: false, error: "Not found" }); continue; }
          if (gp.status !== "pending") { results.push({ id, success: false, error: `Status is ${gp.status}` }); continue; }

          await storage.updateGatePass(id, {
            status: "approved",
            approvedBy: userId,
            approvedAt: new Date(),
            hodApprovedBy: userId,
            hodApprovedAt: new Date(),
          } as any);

          notificationService.notifyInitiatorOfHodDecision(gp, "approved", actor?.fullName || "Approver").catch(() => {});
          notificationService.notifySecurityOfApprovedPass(gp).catch(() => {});
          await storage.logUserActivity({
            userId, userEmail: actor?.email || "unknown",
            actionType: "approve", entityType: "gate_pass", entityId: id,
            description: `[Batch] Approved gate pass #${gp.gatePassNumber}`,
            ipAddress: getIpAddresses(req), userAgent: req.headers["user-agent"] || "unknown",
          }).catch(() => {});

          results.push({ id, success: true });
        } catch (e: any) {
          results.push({ id, success: false, error: e.message });
        }
      }

      const succeeded = results.filter(r => r.success).length;
      return res.json({ message: `Approved ${succeeded} of ${ids.length} gate passes`, results });
    } catch (error) {
      console.error("Batch approve error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/gate-passes/batch-reject  — body: { ids: number[], userId: number, remarks: string }
  app.post("/api/gate-passes/batch-reject", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
      const { ids, remarks } = req.body as { ids?: number[]; remarks?: string };
      const userId = req.session.userId;
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids array required" });

      const actor = await storage.getUser(userId);
      const results: { id: number; success: boolean; error?: string }[] = [];

      for (const id of ids) {
        try {
          const gp = await storage.getGatePass(id);
          if (!gp) { results.push({ id, success: false, error: "Not found" }); continue; }
          if (["completed", "rejected"].includes(gp.status)) { results.push({ id, success: false, error: `Status is ${gp.status}` }); continue; }

          await storage.updateGatePass(id, { status: "rejected", remarks: remarks || null } as any);

          notificationService.notifyInitiatorOfHodDecision(gp, "rejected", actor?.fullName || "HOD", remarks).catch(() => {});
          await storage.logUserActivity({
            userId, userEmail: actor?.email || "unknown",
            actionType: "reject", entityType: "gate_pass", entityId: id,
            description: `[Batch] Rejected gate pass #${gp.gatePassNumber}`,
            ipAddress: getIpAddresses(req), userAgent: req.headers["user-agent"] || "unknown",
          }).catch(() => {});

          results.push({ id, success: true });
        } catch (e: any) {
          results.push({ id, success: false, error: e.message });
        }
      }

      const succeeded = results.filter(r => r.success).length;
      return res.json({ message: `Rejected ${succeeded} of ${ids.length} gate passes`, results });
    } catch (error) {
      console.error("Batch reject error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/gate-passes/batch-send-back  — body: { ids: number[], userId: number, remarks: string }
  app.post("/api/gate-passes/batch-send-back", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
      const { ids, remarks } = req.body as { ids?: number[]; remarks?: string };
      const userId = req.session.userId;
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids array required" });
      if (!remarks || !remarks.trim()) return res.status(400).json({ message: "remarks required for send-back" });

      const actor = await storage.getUser(userId);
      const results: { id: number; success: boolean; error?: string }[] = [];

      for (const id of ids) {
        try {
          const gp = await storage.getGatePass(id);
          if (!gp) { results.push({ id, success: false, error: "Not found" }); continue; }
          if (gp.status !== "pending") { results.push({ id, success: false, error: `Status is ${gp.status}` }); continue; }

          await storage.updateGatePass(id, { status: "sent_back", remarks: remarks.trim() } as any);

          notificationService.notifyInitiatorOfHodDecision(gp, "sent_back", actor?.fullName || "HOD", remarks).catch(() => {});
          await storage.logUserActivity({
            userId, userEmail: actor?.email || "unknown",
            actionType: "send_back", entityType: "gate_pass", entityId: id,
            description: `[Batch] Sent back gate pass #${gp.gatePassNumber}: ${remarks}`,
            ipAddress: getIpAddresses(req), userAgent: req.headers["user-agent"] || "unknown",
          }).catch(() => {});

          results.push({ id, success: true });
        } catch (e: any) {
          results.push({ id, success: false, error: e.message });
        }
      }

      const succeeded = results.filter(r => r.success).length;
      return res.json({ message: `Sent back ${succeeded} of ${ids.length} gate passes`, results });
    } catch (error) {
      console.error("Batch send-back error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // =============================================
  // Phase 9: In-App Notification Center
  // =============================================

  // GET /api/notifications — fetch notifications for the logged-in user
  app.get("/api/notifications", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const notifs = await storage.getNotifications(req.session.userId, limit);
      return res.json(notifs);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/notifications/unread-count — fast badge count
  app.get("/api/notifications/unread-count", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
      const count = await storage.getUnreadNotificationCount(req.session.userId);
      return res.json({ count });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // PATCH /api/notifications/:id/read — mark single notification as read
  app.patch("/api/notifications/:id/read", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
      await storage.markNotificationRead(parseInt(req.params.id), req.session.userId);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // PATCH /api/notifications/read-all — mark all notifications as read
  app.patch("/api/notifications/read-all", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
      await storage.markAllNotificationsRead(req.session.userId);
      return res.json({ success: true });
    } catch (error) {
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
        let rows = await storage.getPlants(companyId);

        // If not admin, filter to only the user's assigned plants (if any assignments exist)
        const userId = req.session?.userId;
        if (userId) {
          const { userPlants: uPlantsTable, userCompanies: uCompaniesTable } = await import("@shared/schema");
          const isGroupAdmin = req.session?.userRole === 1;
          if (!isGroupAdmin) {
            const userPlantRows = await db.select().from(uPlantsTable).where(eq(uPlantsTable.userId, userId));
            if (userPlantRows.length > 0) {
              const assignedPlantIds = new Set(userPlantRows.map(r => r.plantId));
              rows = rows.filter(p => assignedPlantIds.has(p.id));
            }
          }
        }

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
        if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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
        if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
        const row = await storage.updatePlant(Number(req.params.id), req.body);
        if (!row) return res.status(404).json({ message: "Plant not found" });
        return res.json(row);
      } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.delete("/api/plants/:id", async (req: Request, res: Response) => {
      try {
        if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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
        let rows = await storage.getGates(companyId, plantId);

        // If not admin, filter to only the user's assigned gates (if any assignments exist)
        const userId = req.session?.userId;
        if (userId) {
          const { userGates: uGatesTable } = await import("@shared/schema");
          const isGroupAdmin = req.session?.userRole === 1;
          if (!isGroupAdmin) {
            const userGateRows = await db.select().from(uGatesTable).where(eq(uGatesTable.userId, userId));
            if (userGateRows.length > 0) {
              const assignedGateIds = new Set(userGateRows.map(r => r.gateId));
              rows = rows.filter(g => assignedGateIds.has(g.id));
            }
          }
        }

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
        if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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
        if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
        const row = await storage.updateGate(Number(req.params.id), req.body);
        if (!row) return res.status(404).json({ message: "Gate not found" });
        return res.json(row);
      } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.delete("/api/gates/:id", async (req: Request, res: Response) => {
      try {
        if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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
        if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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
        if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
        const row = await storage.updateVendor(Number(req.params.id), req.body);
        if (!row) return res.status(404).json({ message: "Vendor not found" });
        return res.json(row);
      } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.delete("/api/vendors/:id", async (req: Request, res: Response) => {
      try {
        if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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
        if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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
        if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
        const row = await storage.updateItemMaster(Number(req.params.id), req.body);
        if (!row) return res.status(404).json({ message: "Item not found" });
        return res.json(row);
      } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    app.delete("/api/item-master/:id", async (req: Request, res: Response) => {
      try {
        if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
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

  // ================================================================
  // Phase 17: Force Close
  // ================================================================

  // POST /api/gate-passes/:id/force-close
  app.post("/api/gate-passes/:id/force-close", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });

      const id = parseInt(req.params.id, 10);
      const { remarks } = req.body;

      if (!remarks || !String(remarks).trim()) {
        return res.status(400).json({ message: "Remarks are required to force close a gate pass" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      // Only admins or users with gatePass:manage permission can force close
      const isAdmin = user.roleId === 1;
      if (!isAdmin) {
        const userPerms = user.roleId
          ? await db.select().from(permissions).where(eq(permissions.roleId, user.roleId))
          : [];
        const canManage = userPerms.some(
          (p) => p.module === "gatePass" && p.action === "manage"
        );
        if (!canManage) return res.status(403).json({ message: "Insufficient permissions" });
      }

      const gatePass = await storage.getGatePass(id);
      if (!gatePass) return res.status(404).json({ message: "Gate pass not found" });

      // Cannot force close already terminal passes
      const terminalStatuses = ["completed", "rejected", "force_closed"];
      if (terminalStatuses.includes(gatePass.status)) {
        return res.status(400).json({
          message: `Cannot force close a gate pass that is already ${gatePass.status}`,
        });
      }

      const now = new Date();
      const sapCode = generateSapReferenceCode();
      const updated = await storage.updateGatePass(id, {
        status: "force_closed",
        forceClosedBy: user.id,
        forceClosedAt: now,
        forceCloseRemarks: String(remarks).trim(),
        sapReferenceCode: sapCode,
      } as any);

      // In-app notification to the creator
      const creator = await storage.getUser(gatePass.createdById);
      if (creator) {
        await storage.createNotification({
          userId: creator.id,
          title: "Gate Pass Force Closed",
          message: `Gate pass ${gatePass.gatePassNumber} has been force closed by ${user.fullName}. Reason: ${remarks}`,
          type: "warning",
          entityType: "gate_pass",
          entityId: gatePass.id,
          read: false,
        });
      }

      // Activity log
      await storage.logUserActivity({
        userId: user.id,
        userEmail: user.email,
        actionType: "force_close",
        entityType: "gate_pass",
        entityId: gatePass.id,
        description: `Force closed gate pass ${gatePass.gatePassNumber}. Reason: ${remarks}`,
        ipAddress: req.ip || "",
        userAgent: req.headers["user-agent"] || "",
      });

      return res.json(updated);
    } catch (error) {
      console.error("Error force closing gate pass:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ================================================================
  // Report Template routes
  // ================================================================

  // GET /api/report-templates — list own + shared company templates
  app.get("/api/report-templates", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      const templates = await storage.getReportTemplates(user.id, user.companyId ?? undefined);
      // Ensure config is always a parsed object (MySQL2 may return JSON columns as strings)
      const normalized = templates.map(t => ({
        ...t,
        config: typeof t.config === "string" ? JSON.parse(t.config as string) : t.config,
      }));
      return res.json(normalized);
    } catch (error) {
      console.error("Error fetching report templates:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/report-templates — create a new template
  app.post("/api/report-templates", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const parsed = insertReportTemplateSchema.safeParse({
        ...req.body,
        userId: user.id,
        companyId: req.body.companyId ?? user.companyId ?? null,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }

      const template = await storage.createReportTemplate(parsed.data);
      return res.status(201).json(template);
    } catch (error) {
      console.error("Error creating report template:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // PATCH /api/report-templates/:id — update (owner only)
  app.patch("/api/report-templates/:id", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
      const id = parseInt(req.params.id, 10);
      const existing = await storage.getReportTemplate(id);
      if (!existing) return res.status(404).json({ message: "Template not found" });
      if (existing.userId !== req.session.userId) return res.status(403).json({ message: "Forbidden" });

      const updated = await storage.updateReportTemplate(id, req.body);
      return res.json(updated);
    } catch (error) {
      console.error("Error updating report template:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // DELETE /api/report-templates/:id — delete (owner only)
  app.delete("/api/report-templates/:id", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
      const id = parseInt(req.params.id, 10);
      const existing = await storage.getReportTemplate(id);
      if (!existing) return res.status(404).json({ message: "Template not found" });
      if (existing.userId !== req.session.userId) return res.status(403).json({ message: "Forbidden" });

      const deleted = await storage.deleteReportTemplate(id);
      return res.json({ success: deleted });
    } catch (error) {
      console.error("Error deleting report template:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}
