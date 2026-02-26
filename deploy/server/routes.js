"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const http_1 = require("http");
const storage_1 = require("./storage");
const schema_1 = require("../shared/schema");
const zod_1 = require("zod");
const zod_validation_error_1 = require("zod-validation-error");
const db_1 = require("./db");
const schema_2 = require("../shared/schema");
const drizzle_orm_1 = require("drizzle-orm");
const notificationService = __importStar(require("./services/notification"));
const bcrypt_1 = __importDefault(require("bcrypt"));
async function registerRoutes(app) {
    const httpServer = (0, http_1.createServer)(app);
    // Auth routes
    app.post("/api/auth/login", async (req, res) => {
        try {
            const { email, password } = schema_1.loginSchema.parse(req.body);
            console.log('Login attempt:', { email });
            const user = await storage_1.storage.getUserByEmail(email);
            console.log('Found user:', { id: user?.id, email: user?.email, hashedPassword: user?.password });
            if (!user) {
                return res.status(401).json({ message: "Invalid email or password" });
            }
            // Use bcrypt to compare passwords
            const isPasswordValid = await bcrypt_1.default.compare(password, user.password);
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
            const rolePermissions = user.roleId ? await db_1.db
                .select()
                .from(schema_2.permissions)
                .where((0, drizzle_orm_1.eq)(schema_2.permissions.roleId, user.roleId))
                : [];
            return res.json({
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                department: user.department,
                roleId: user.roleId,
                permissions: rolePermissions
            });
        }
        catch (error) {
            console.error('Login error:', error);
            if (error instanceof Error) {
                return res.status(400).json({ message: error.message });
            }
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    // Temporary endpoint to reset password - REMOVE AFTER USE
    app.post("/api/auth/admin-reset-password", async (req, res) => {
        try {
            const { email, newPassword } = req.body;
            // Get the user
            const user = await storage_1.storage.getUserByEmail(email);
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            // Hash the new password
            const hashedPassword = await bcrypt_1.default.hash(newPassword, 10);
            // Update the user's password
            await storage_1.storage.updateUser(user.id, {
                password: hashedPassword
            });
            return res.json({ message: "Password reset successful" });
        }
        catch (error) {
            console.error('Error resetting password:', error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    // Role and Permission routes
    app.get("/api/roles", async (req, res) => {
        try {
            const allRoles = await db_1.db.select().from(schema_2.roles);
            return res.json(allRoles);
        }
        catch (error) {
            console.error("Error getting roles:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    app.get("/api/permissions", async (req, res) => {
        try {
            const allPermissions = await db_1.db.select().from(schema_2.permissions);
            return res.json(allPermissions);
        }
        catch (error) {
            console.error("Error getting permissions:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    app.get("/api/roles/:id/permissions", async (req, res) => {
        try {
            const roleId = parseInt(req.params.id, 10);
            if (isNaN(roleId)) {
                return res.status(400).json({ message: "Invalid role ID" });
            }
            const [role] = await db_1.db.select().from(schema_2.roles).where((0, drizzle_orm_1.eq)(schema_2.roles.id, roleId));
            if (!role) {
                return res.status(404).json({ message: "Role not found" });
            }
            const rolePermissions = await db_1.db
                .select()
                .from(schema_2.permissions)
                .where((0, drizzle_orm_1.eq)(schema_2.permissions.roleId, roleId));
            return res.json(rolePermissions);
        }
        catch (error) {
            console.error("Error getting role permissions:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    // Role management endpoints
    app.post("/api/roles", async (req, res) => {
        try {
            const { name, description } = req.body;
            if (!name || typeof name !== 'string') {
                return res.status(400).json({ message: "Valid role name is required" });
            }
            // Check if role with this name already exists
            const existingRole = await db_1.db
                .select()
                .from(schema_2.roles)
                .where((0, drizzle_orm_1.eq)(schema_2.roles.name, name));
            if (existingRole.length > 0) {
                return res.status(400).json({ message: "Role with this name already exists" });
            }
            const [newRole] = await db_1.db
                .insert(schema_2.roles)
                .values({
                name,
                description: description || null
            });
            const roleId = newRole.insertId;
            const [createdRole] = await db_1.db.select().from(schema_2.roles).where((0, drizzle_orm_1.eq)(schema_2.roles.id, roleId));
            return res.status(201).json(createdRole);
        }
        catch (error) {
            console.error("Error creating role:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    app.patch("/api/roles/:id", async (req, res) => {
        try {
            const roleId = parseInt(req.params.id, 10);
            if (isNaN(roleId)) {
                return res.status(400).json({ message: "Invalid role ID" });
            }
            const { name, description } = req.body;
            // Check if role exists
            const [existingRole] = await db_1.db
                .select()
                .from(schema_2.roles)
                .where((0, drizzle_orm_1.eq)(schema_2.roles.id, roleId));
            if (!existingRole) {
                return res.status(404).json({ message: "Role not found" });
            }
            // Don't allow changing the Admin role name for safety
            if (existingRole.name === 'Admin' && name && name !== 'Admin') {
                return res.status(403).json({ message: "The Admin role name cannot be changed" });
            }
            // If changing name, check that new name doesn't exist
            if (name && name !== existingRole.name) {
                const nameCheck = await db_1.db
                    .select()
                    .from(schema_2.roles)
                    .where((0, drizzle_orm_1.eq)(schema_2.roles.name, name));
                if (nameCheck.length > 0) {
                    return res.status(400).json({ message: "Role with this name already exists" });
                }
            }
            const [updatedRole] = await db_1.db
                .update(schema_2.roles)
                .set({
                name: name || existingRole.name,
                description: description !== undefined ? description : existingRole.description
            })
                .where((0, drizzle_orm_1.eq)(schema_2.roles.id, roleId));
            const [updatedRoleResult] = await db_1.db.select().from(schema_2.roles).where((0, drizzle_orm_1.eq)(schema_2.roles.id, roleId));
            return res.json(updatedRoleResult);
        }
        catch (error) {
            console.error("Error updating role:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    app.delete("/api/roles/:id", async (req, res) => {
        try {
            const roleId = parseInt(req.params.id, 10);
            if (isNaN(roleId)) {
                return res.status(400).json({ message: "Invalid role ID" });
            }
            // Check if role exists
            const [existingRole] = await db_1.db
                .select()
                .from(schema_2.roles)
                .where((0, drizzle_orm_1.eq)(schema_2.roles.id, roleId));
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
            const usersWithRole = await db_1.db
                .select()
                .from(schema_2.users)
                .where((0, drizzle_orm_1.eq)(schema_2.users.roleId, roleId));
            if (usersWithRole.length > 0) {
                return res.status(400).json({
                    message: "Cannot delete role that is assigned to users",
                    count: usersWithRole.length
                });
            }
            // Delete permissions for this role
            await db_1.db
                .delete(schema_2.permissions)
                .where((0, drizzle_orm_1.eq)(schema_2.permissions.roleId, roleId));
            // Delete the role
            await db_1.db
                .delete(schema_2.roles)
                .where((0, drizzle_orm_1.eq)(schema_2.roles.id, roleId));
            return res.status(204).send();
        }
        catch (error) {
            console.error("Error deleting role:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    // Permission management endpoints
    app.post("/api/permissions", async (req, res) => {
        try {
            const { roleId, module, action } = req.body;
            if (!roleId || isNaN(parseInt(roleId, 10))) {
                return res.status(400).json({ message: "Valid role ID is required" });
            }
            if (!module || !action) {
                return res.status(400).json({ message: "Module and action are required" });
            }
            // Check if role exists
            const [existingRole] = await db_1.db
                .select()
                .from(schema_2.roles)
                .where((0, drizzle_orm_1.eq)(schema_2.roles.id, parseInt(roleId, 10)));
            if (!existingRole) {
                return res.status(404).json({ message: "Role not found" });
            }
            // Check if permission already exists
            const existingPermissions = await db_1.db
                .select()
                .from(schema_2.permissions)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_2.permissions.roleId, parseInt(roleId, 10)), (0, drizzle_orm_1.eq)(schema_2.permissions.module, module), (0, drizzle_orm_1.eq)(schema_2.permissions.action, action)));
            if (existingPermissions.length > 0) {
                return res.status(400).json({ message: "Permission already exists for this role" });
            }
            const [newPermission] = await db_1.db
                .insert(schema_2.permissions)
                .values({
                roleId: parseInt(roleId, 10),
                module,
                action
            });
            const permId = newPermission.insertId;
            const [createdPermission] = await db_1.db.select().from(schema_2.permissions).where((0, drizzle_orm_1.eq)(schema_2.permissions.id, permId));
            return res.status(201).json(createdPermission);
        }
        catch (error) {
            console.error("Error creating permission:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    app.delete("/api/permissions/:id", async (req, res) => {
        try {
            const permissionId = parseInt(req.params.id, 10);
            if (isNaN(permissionId)) {
                return res.status(400).json({ message: "Invalid permission ID" });
            }
            // Check if permission exists
            const [existingPermission] = await db_1.db
                .select()
                .from(schema_2.permissions)
                .where((0, drizzle_orm_1.eq)(schema_2.permissions.id, permissionId));
            if (!existingPermission) {
                return res.status(404).json({ message: "Permission not found" });
            }
            // Delete the permission
            await db_1.db
                .delete(schema_2.permissions)
                .where((0, drizzle_orm_1.eq)(schema_2.permissions.id, permissionId));
            return res.status(204).send();
        }
        catch (error) {
            console.error("Error deleting permission:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    // User routes
    app.get("/api/users", async (req, res) => {
        try {
            const users = await storage_1.storage.getUsers();
            // For each user, look up their role
            const usersWithRoles = await Promise.all(users.map(async (user) => {
                let roleName = "user"; // Default role name
                if (user.roleId) {
                    const [userRole] = await db_1.db.select().from(schema_2.roles).where((0, drizzle_orm_1.eq)(schema_2.roles.id, user.roleId));
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
        }
        catch (error) {
            console.error("Error getting users:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    app.post("/api/users", async (req, res) => {
        try {
            const userData = schema_1.insertUserSchema.parse(req.body);
            // Hash the password
            const hashedPassword = await bcrypt_1.default.hash(userData.password, 10);
            // Create user with hashed password
            const user = await storage_1.storage.createUser({
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
        }
        catch (error) {
            console.error('Error creating user:', error);
            if (error instanceof zod_1.ZodError) {
                return res.status(400).json({ message: (0, zod_validation_error_1.fromZodError)(error).message });
            }
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    // Update User API
    app.patch("/api/users/:id", async (req, res) => {
        try {
            // Set content type header first
            res.setHeader('Content-Type', 'application/json');
            const userId = parseInt(req.params.id, 10);
            if (isNaN(userId)) {
                return res.status(400).json({ message: "Invalid user ID" });
            }
            // Get the existing user
            const existingUser = await storage_1.storage.getUser(userId);
            if (!existingUser) {
                return res.status(404).json({ message: "User not found" });
            }
            // If password is being updated, hash it
            const updateData = { ...req.body };
            if (updateData.password) {
                updateData.password = await bcrypt_1.default.hash(updateData.password, 10);
            }
            // Update the user with proper error handling
            try {
                const updatedUser = await storage_1.storage.updateUser(userId, updateData);
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
            }
            catch (dbError) {
                console.error('Database error:', dbError);
                return res.status(500).json({ message: "Failed to update user" });
            }
        }
        catch (error) {
            console.error('Error updating user:', error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    // Delete User API
    app.delete("/api/users/:id", async (req, res) => {
        try {
            // Set content type header first
            res.setHeader('Content-Type', 'application/json');
            const userId = parseInt(req.params.id, 10);
            // Find the current user first
            const existingUser = await storage_1.storage.getUser(userId);
            if (!existingUser) {
                return res.status(404).json({ message: "User not found" });
            }
            // Delete user with proper error handling
            try {
                const success = await storage_1.storage.deleteUser(userId);
                if (!success) {
                    return res.status(500).json({ message: "Failed to delete user" });
                }
                return res.json({ message: "User deleted successfully" });
            }
            catch (dbError) {
                console.error('Database error:', dbError);
                return res.status(500).json({ message: "Failed to delete user" });
            }
        }
        catch (error) {
            console.error("Error deleting user:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    // Gate pass routes
    app.get("/api/gate-passes", async (req, res) => {
        try {
            // Get user from session
            const userId = req.session?.userId;
            const userRole = req.session?.userRole;
            if (!userId) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            // Get the user's details for department check
            const user = await storage_1.storage.getUser(userId);
            if (!user) {
                return res.status(401).json({ message: "User not found" });
            }
            // Get user's permissions
            const userPermissions = userRole ? await db_1.db
                .select()
                .from(schema_2.permissions)
                .where((0, drizzle_orm_1.eq)(schema_2.permissions.roleId, userRole)) : [];
            // Check if user has permission to view all gate passes
            const canViewAll = userRole === 1; // Only admin role can view all
            // Build filters object with proper type
            const filters = {
                customerName: req.query.customerName || undefined,
                department: req.query.department || undefined,
                dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom) : undefined,
                dateTo: req.query.dateTo ? new Date(req.query.dateTo) : undefined,
                gatePassNumber: req.query.gatePassNumber || undefined,
                itemName: req.query.itemName || undefined,
                status: req.query.status || undefined,
            };
            // If user is not admin:
            // 1. They can only see gate passes from their department
            if (!canViewAll) {
                filters.department = user.department;
            }
            const gatePasses = await storage_1.storage.getGatePasses(filters);
            return res.json(gatePasses);
        }
        catch (error) {
            console.error("Error getting gate passes:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    // Verification endpoint (must come before the /:id route to avoid conflicts)
    app.get("/api/gate-passes/verify/:gatePassNumber", async (req, res) => {
        try {
            // Check if user is authenticated
            if (!req.session?.userId) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            // Get user's role and permissions
            const user = await storage_1.storage.getUser(req.session.userId);
            if (!user) {
                return res.status(401).json({ message: "User not found" });
            }
            // Get user's permissions
            const userPermissions = await db_1.db
                .select()
                .from(schema_2.permissions)
                .where((0, drizzle_orm_1.eq)(schema_2.permissions.roleId, user.roleId || 0));
            // Check if user has permission to verify gate passes
            const canVerify = user.roleId === 1 || // Admin role
                userPermissions.some(p => p.module === 'qrScanner' && p.action === 'read');
            if (!canVerify) {
                return res.status(403).json({ message: "Permission denied" });
            }
            const { gatePassNumber } = req.params;
            console.log("Verifying gate pass number:", gatePassNumber);
            const gatePass = await storage_1.storage.getGatePassByNumber(gatePassNumber);
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
            const items = await storage_1.storage.getItemsByGatePassId(gatePass.id);
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
        }
        catch (error) {
            console.error("Error verifying gate pass:", error);
            return res.status(500).json({
                isValid: false,
                message: "Internal server error",
                verifiedAt: new Date().toISOString()
            });
        }
    });
    app.get("/api/gate-passes/:id", async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            // If it's not a number, return 404
            if (isNaN(id)) {
                return res.status(404).json({ message: "Gate pass not found" });
            }
            const gatePass = await storage_1.storage.getGatePass(id);
            if (!gatePass) {
                return res.status(404).json({ message: "Gate pass not found" });
            }
            const items = await storage_1.storage.getItemsByGatePassId(id);
            return res.json({ ...gatePass, items });
        }
        catch (error) {
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    app.post("/api/gate-passes", async (req, res) => {
        try {
            const { items: itemsData, ...gatePassData } = schema_1.gatePassWithItemsSchema.parse(req.body);
            // Get user information from session or request body
            const userId = gatePassData.createdById;
            // Fetch the user from database to get the actual user information
            const userData = await storage_1.storage.getUser(userId);
            if (!userData) {
                console.warn(`User with ID ${userId} not found for activity logging`);
            }
            // Create the gate pass first
            const gatePass = await storage_1.storage.createGatePass(gatePassData);
            // Then create the items associated with this gate pass
            const items = [];
            for (const itemData of itemsData) {
                const item = await storage_1.storage.createItem({
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
                await storage_1.storage.logUserActivity({
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
            }
            catch (error) {
                console.warn("Failed to log user activity:", error.message);
                // Continue with response even if activity logging fails
            }
            return res.status(201).json({ ...gatePass, items });
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                return res.status(400).json({ message: (0, zod_validation_error_1.fromZodError)(error).message });
            }
            console.error("Error creating gate pass:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    app.patch("/api/gate-passes/:id", async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            const gatePass = await storage_1.storage.getGatePass(id);
            if (!gatePass) {
                return res.status(404).json({ message: "Gate pass not found" });
            }
            // Update the gate pass
            const updatedGatePass = await storage_1.storage.updateGatePass(id, req.body);
            // If items are included, update them too
            let items = [];
            if (req.body.items) {
                // First, delete existing items
                await storage_1.storage.deleteItemsByGatePassId(id);
                // Then create new ones
                for (const itemData of req.body.items) {
                    const item = await storage_1.storage.createItem({
                        ...itemData,
                        gatePassId: id
                    });
                    items.push(item);
                }
            }
            else {
                // If no items were included, fetch the existing ones
                items = await storage_1.storage.getItemsByGatePassId(id);
            }
            // Log gate pass update activity
            try {
                const userId = req.body.updatedById || gatePass.createdById;
                // Fetch user information from database
                const userData = await storage_1.storage.getUser(userId);
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
                await storage_1.storage.logUserActivity({
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
            }
            catch (error) {
                console.warn("Failed to log user activity:", error.message);
                // Continue with response even if activity logging fails
            }
            res.setHeader('Content-Type', 'application/json');
            return res.json({ ...updatedGatePass, items });
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                res.setHeader('Content-Type', 'application/json');
                return res.status(400).json({ message: (0, zod_validation_error_1.fromZodError)(error).message });
            }
            console.error("Error updating gate pass:", error);
            res.setHeader('Content-Type', 'application/json');
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    app.delete("/api/gate-passes/:id", async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            const gatePass = await storage_1.storage.getGatePass(id);
            if (!gatePass) {
                return res.status(404).json({ message: "Gate pass not found" });
            }
            // Store gate pass info before deletion for logging
            const gatePassNumber = gatePass.gatePassNumber;
            const customerName = gatePass.customerName;
            const createdById = gatePass.createdById;
            await storage_1.storage.deleteGatePass(id);
            // Log gate pass deletion activity
            try {
                // Get user ID from the request if possible, otherwise use the creator's info
                const userId = req.body?.userId || req.query?.userId || createdById;
                // Fetch user information from database
                const userData = await storage_1.storage.getUser(userId);
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
                await storage_1.storage.logUserActivity({
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
            }
            catch (error) {
                console.warn("Failed to log user activity:", error.message);
                // Continue with response even if activity logging fails
            }
            return res.status(204).send();
        }
        catch (error) {
            console.error("Error deleting gate pass:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    // Customer routes
    app.get("/api/customers", async (req, res) => {
        try {
            const searchTerm = req.query.search || undefined;
            const customers = await storage_1.storage.getCustomers(searchTerm);
            return res.json(customers);
        }
        catch (error) {
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    app.get("/api/customers/:id", async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            // If it's not a number, return 404
            if (isNaN(id)) {
                return res.status(404).json({ message: "Customer not found" });
            }
            const customer = await storage_1.storage.getCustomer(id);
            if (!customer) {
                return res.status(404).json({ message: "Customer not found" });
            }
            return res.json(customer);
        }
        catch (error) {
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    app.post("/api/customers", async (req, res) => {
        try {
            const customerData = schema_1.insertCustomerSchema.parse(req.body);
            const customer = await storage_1.storage.createCustomer(customerData);
            // Log customer creation activity
            try {
                // Get user ID from request if available
                const userId = req.body.createdById || req.query?.userId;
                // Fetch user information from database if userId is available
                let userData = null;
                if (userId) {
                    userData = await storage_1.storage.getUser(userId);
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
                await storage_1.storage.logUserActivity({
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
            }
            catch (error) {
                console.warn("Failed to log user activity:", error.message);
                // Continue with response even if activity logging fails
            }
            return res.status(201).json(customer);
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                return res.status(400).json({ message: (0, zod_validation_error_1.fromZodError)(error).message });
            }
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    app.patch("/api/customers/:id", async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            const customer = await storage_1.storage.getCustomer(id);
            if (!customer) {
                return res.status(404).json({ message: "Customer not found" });
            }
            const updatedCustomer = await storage_1.storage.updateCustomer(id, req.body);
            return res.json(updatedCustomer);
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                return res.status(400).json({ message: (0, zod_validation_error_1.fromZodError)(error).message });
            }
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    // Driver routes
    app.get("/api/drivers", async (req, res) => {
        try {
            const searchTerm = req.query.search || undefined;
            const drivers = await storage_1.storage.getDrivers(searchTerm);
            return res.json(drivers);
        }
        catch (error) {
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    app.get("/api/drivers/:id", async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            // If it's not a number, return 404
            if (isNaN(id)) {
                return res.status(404).json({ message: "Driver not found" });
            }
            const driver = await storage_1.storage.getDriver(id);
            if (!driver) {
                return res.status(404).json({ message: "Driver not found" });
            }
            return res.json(driver);
        }
        catch (error) {
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    app.get("/api/drivers/cnic/:cnic", async (req, res) => {
        try {
            const { cnic } = req.params;
            const driver = await storage_1.storage.getDriverByCnic(cnic);
            if (!driver) {
                return res.status(404).json({ message: "Driver not found" });
            }
            return res.json(driver);
        }
        catch (error) {
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    app.post("/api/drivers", async (req, res) => {
        try {
            const driverData = schema_1.insertDriverSchema.parse(req.body);
            // Check if driver with this CNIC already exists
            const existingDriver = await storage_1.storage.getDriverByCnic(driverData.cnic);
            if (existingDriver) {
                return res.status(400).json({ message: "Driver with this CNIC already exists" });
            }
            const driver = await storage_1.storage.createDriver(driverData);
            // Log driver creation activity
            try {
                // Get user ID from request if available
                const userId = req.body.createdById || req.query?.userId;
                // Fetch user information from database if userId is available
                let userData = null;
                if (userId) {
                    userData = await storage_1.storage.getUser(userId);
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
                await storage_1.storage.logUserActivity({
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
            }
            catch (error) {
                console.warn("Failed to log user activity:", error.message);
                // Continue with response even if activity logging fails
            }
            return res.status(201).json(driver);
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                return res.status(400).json({ message: (0, zod_validation_error_1.fromZodError)(error).message });
            }
            console.error("Error creating driver:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    app.patch("/api/drivers/:id", async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            const driver = await storage_1.storage.getDriver(id);
            if (!driver) {
                return res.status(404).json({ message: "Driver not found" });
            }
            // If changing CNIC, check that the new CNIC is not already used
            if (req.body.cnic && req.body.cnic !== driver.cnic) {
                const existingDriver = await storage_1.storage.getDriverByCnic(req.body.cnic);
                if (existingDriver && existingDriver.id !== id) {
                    return res.status(400).json({ message: "Another driver with this CNIC already exists" });
                }
            }
            const updatedDriver = await storage_1.storage.updateDriver(id, req.body);
            return res.json(updatedDriver);
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                return res.status(400).json({ message: (0, zod_validation_error_1.fromZodError)(error).message });
            }
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    // Statistics routes
    app.get("/api/statistics", async (req, res) => {
        try {
            const statistics = await storage_1.storage.getStatistics();
            return res.json(statistics);
        }
        catch (error) {
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    // User Activity Logs
    app.get("/api/activity-logs", async (req, res) => {
        try {
            // Get filter parameters from request query
            const { userId, userEmail, actionType, entityType, dateFrom, dateTo } = req.query;
            // Build filters object
            const filters = {};
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
            const logs = await storage_1.storage.getUserActivityLogs(filters);
            return res.json(logs);
        }
        catch (error) {
            console.error("Error getting activity logs:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    // Document routes
    app.get("/api/documents/entity/:type/:id", async (req, res) => {
        try {
            const entityType = req.params.type;
            const entityId = parseInt(req.params.id, 10);
            if (isNaN(entityId)) {
                return res.status(400).json({ message: "Invalid entity ID" });
            }
            const documents = await storage_1.storage.getDocumentsByEntity(entityType, entityId);
            return res.json(documents);
        }
        catch (error) {
            console.error("Error getting documents for entity:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    app.get("/api/documents/:id", async (req, res) => {
        try {
            const documentId = parseInt(req.params.id, 10);
            if (isNaN(documentId)) {
                return res.status(400).json({ message: "Invalid document ID" });
            }
            const document = await storage_1.storage.getDocument(documentId);
            if (!document) {
                return res.status(404).json({ message: "Document not found" });
            }
            return res.json(document);
        }
        catch (error) {
            console.error("Error getting document:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    app.post("/api/documents", async (req, res) => {
        try {
            const documentData = schema_1.insertDocumentSchema.parse(req.body);
            // Log the user activity
            const user = req.body.user;
            if (user && user.id) {
                try {
                    await storage_1.storage.logUserActivity({
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
                }
                catch (error) {
                    console.warn("Failed to log user activity:", error.message);
                    // Continue with document creation even if activity logging fails
                }
            }
            const document = await storage_1.storage.createDocument(documentData);
            return res.status(201).json(document);
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                return res.status(400).json({ message: (0, zod_validation_error_1.fromZodError)(error).message });
            }
            console.error("Error creating document:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    app.patch("/api/documents/:id", async (req, res) => {
        try {
            const documentId = parseInt(req.params.id, 10);
            if (isNaN(documentId)) {
                return res.status(400).json({ message: "Invalid document ID" });
            }
            const existingDocument = await storage_1.storage.getDocument(documentId);
            if (!existingDocument) {
                return res.status(404).json({ message: "Document not found" });
            }
            // Only allow updating certain fields like description
            const fieldsToUpdate = ['description'];
            const updateData = {};
            fieldsToUpdate.forEach(field => {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            });
            // Log the user activity
            const user = req.body.user;
            if (user && user.id) {
                try {
                    await storage_1.storage.logUserActivity({
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
                }
                catch (error) {
                    console.warn("Failed to log user activity:", error.message);
                    // Continue with document update even if activity logging fails
                }
            }
            const updatedDocument = await storage_1.storage.updateDocument(documentId, updateData);
            return res.json(updatedDocument);
        }
        catch (error) {
            console.error("Error updating document:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    app.delete("/api/documents/:id", async (req, res) => {
        try {
            const documentId = parseInt(req.params.id, 10);
            if (isNaN(documentId)) {
                return res.status(400).json({ message: "Invalid document ID" });
            }
            const existingDocument = await storage_1.storage.getDocument(documentId);
            if (!existingDocument) {
                return res.status(404).json({ message: "Document not found" });
            }
            // Log the user activity
            const user = req.body.user;
            if (user && user.id) {
                try {
                    await storage_1.storage.logUserActivity({
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
                }
                catch (error) {
                    console.warn("Failed to log user activity:", error.message);
                    // Continue with document deletion even if activity logging fails
                }
            }
            const success = await storage_1.storage.deleteDocument(documentId);
            if (success) {
                return res.status(204).send();
            }
            else {
                return res.status(500).json({ message: "Failed to delete document" });
            }
        }
        catch (error) {
            console.error("Error deleting document:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    // Notification Settings routes
    app.get("/api/settings/notifications", async (req, res) => {
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
                }
            });
        }
        catch (error) {
            console.error("Error getting notification settings:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
    app.post("/api/settings/notifications", async (req, res) => {
        try {
            const { email, sms } = req.body;
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
                }
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
        }
        catch (error) {
            console.error("Error saving notification settings:", error);
            return res.status(500).json({
                message: error instanceof Error ? error.message : "Internal server error"
            });
        }
    });
    app.post("/api/settings/test-email", async (req, res) => {
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
            const success = await notificationService.sendEmail(user || 'test@ethereal.email', // Use test email if no user provided
            "Test Email from Gate Pass System", `
          <h1>Test Email</h1>
          <p>This is a test email from your Gate Pass System.</p>
          <p>If you received this email, your email settings are configured correctly.</p>
          ${useEthereal ? '<p>This is a test email using Ethereal. Check the console for the preview URL.</p>' : ''}
        `);
            if (!success) {
                throw new Error("Failed to send test email");
            }
            return res.json({
                message: useEthereal
                    ? "Test email sent successfully. Check the console for the preview URL."
                    : "Test email sent successfully"
            });
        }
        catch (error) {
            console.error("Error testing email settings:", error);
            return res.status(500).json({
                message: "Failed to send test email",
                details: error instanceof Error ? error.message : "Unknown error"
            });
        }
    });
    app.post("/api/settings/test-sms", async (req, res) => {
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
            const success = await notificationService.sendSMS(phoneNumber, // Send to the same phone number
            "Test SMS from Parazelsus Gate Pass System");
            if (success) {
                return res.json({ message: "Test SMS sent successfully" });
            }
            else {
                return res.status(500).json({ message: "Failed to send test SMS" });
            }
        }
        catch (error) {
            console.error("Error sending test SMS:", error);
            return res.status(500).json({ message: "Failed to send test SMS" });
        }
    });
    return httpServer;
}
