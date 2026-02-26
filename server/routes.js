"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
var http_1 = require("http");
var storage_1 = require("./storage");
var schema_1 = require("@shared/schema");
var zod_1 = require("zod");
var zod_validation_error_1 = require("zod-validation-error");
var db_1 = require("./db");
var schema_2 = require("@shared/schema");
var drizzle_orm_1 = require("drizzle-orm");
var notificationService = require("./services/notification");
var bcrypt_1 = require("bcrypt");
function registerRoutes(app) {
    return __awaiter(this, void 0, void 0, function () {
        var httpServer;
        var _this = this;
        return __generator(this, function (_a) {
            httpServer = (0, http_1.createServer)(app);
            // Auth routes
            app.post("/api/auth/login", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var _a, email, password, user, isPasswordValid, rolePermissions, _b, error_1;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _c.trys.push([0, 6, , 7]);
                            _a = schema_1.loginSchema.parse(req.body), email = _a.email, password = _a.password;
                            console.log('Login attempt:', { email: email });
                            return [4 /*yield*/, storage_1.storage.getUserByEmail(email)];
                        case 1:
                            user = _c.sent();
                            console.log('Found user:', { id: user === null || user === void 0 ? void 0 : user.id, email: user === null || user === void 0 ? void 0 : user.email, hashedPassword: user === null || user === void 0 ? void 0 : user.password });
                            if (!user) {
                                return [2 /*return*/, res.status(401).json({ message: "Invalid email or password" })];
                            }
                            return [4 /*yield*/, bcrypt_1.default.compare(password, user.password)];
                        case 2:
                            isPasswordValid = _c.sent();
                            console.log('Password comparison:', {
                                attempted: password,
                                storedHash: user.password,
                                isValid: isPasswordValid
                            });
                            if (!isPasswordValid) {
                                return [2 /*return*/, res.status(401).json({ message: "Invalid email or password" })];
                            }
                            // Set session data
                            if (!req.session) {
                                return [2 /*return*/, res.status(500).json({ message: "Session not initialized" })];
                            }
                            req.session.userId = user.id;
                            req.session.userEmail = user.email;
                            req.session.userRole = user.roleId;
                            if (!user.roleId) return [3 /*break*/, 4];
                            return [4 /*yield*/, db_1.db
                                    .select()
                                    .from(schema_2.permissions)
                                    .where((0, drizzle_orm_1.eq)(schema_2.permissions.roleId, user.roleId))];
                        case 3:
                            _b = _c.sent();
                            return [3 /*break*/, 5];
                        case 4:
                            _b = [];
                            _c.label = 5;
                        case 5:
                            rolePermissions = _b;
                            return [2 /*return*/, res.json({
                                    id: user.id,
                                    email: user.email,
                                    fullName: user.fullName,
                                    department: user.department,
                                    roleId: user.roleId,
                                    permissions: rolePermissions
                                })];
                        case 6:
                            error_1 = _c.sent();
                            console.error('Login error:', error_1);
                            if (error_1 instanceof Error) {
                                return [2 /*return*/, res.status(400).json({ message: error_1.message })];
                            }
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 7: return [2 /*return*/];
                    }
                });
            }); });
            // Temporary endpoint to reset password - REMOVE AFTER USE
            app.post("/api/auth/admin-reset-password", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var _a, email, newPassword, user, hashedPassword, error_2;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 4, , 5]);
                            _a = req.body, email = _a.email, newPassword = _a.newPassword;
                            return [4 /*yield*/, storage_1.storage.getUserByEmail(email)];
                        case 1:
                            user = _b.sent();
                            if (!user) {
                                return [2 /*return*/, res.status(404).json({ message: "User not found" })];
                            }
                            return [4 /*yield*/, bcrypt_1.default.hash(newPassword, 10)];
                        case 2:
                            hashedPassword = _b.sent();
                            // Update the user's password
                            return [4 /*yield*/, storage_1.storage.updateUser(user.id, {
                                    password: hashedPassword
                                })];
                        case 3:
                            // Update the user's password
                            _b.sent();
                            return [2 /*return*/, res.json({ message: "Password reset successful" })];
                        case 4:
                            error_2 = _b.sent();
                            console.error('Error resetting password:', error_2);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 5: return [2 /*return*/];
                    }
                });
            }); });
            // Role and Permission routes
            app.get("/api/roles", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var allRoles, error_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, db_1.db.select().from(schema_2.roles)];
                        case 1:
                            allRoles = _a.sent();
                            return [2 /*return*/, res.json(allRoles)];
                        case 2:
                            error_3 = _a.sent();
                            console.error("Error getting roles:", error_3);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            app.get("/api/permissions", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var allPermissions, error_4;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, db_1.db.select().from(schema_2.permissions)];
                        case 1:
                            allPermissions = _a.sent();
                            return [2 /*return*/, res.json(allPermissions)];
                        case 2:
                            error_4 = _a.sent();
                            console.error("Error getting permissions:", error_4);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            app.get("/api/roles/:id/permissions", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var roleId, role, rolePermissions, error_5;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            roleId = parseInt(req.params.id, 10);
                            if (isNaN(roleId)) {
                                return [2 /*return*/, res.status(400).json({ message: "Invalid role ID" })];
                            }
                            return [4 /*yield*/, db_1.db.select().from(schema_2.roles).where((0, drizzle_orm_1.eq)(schema_2.roles.id, roleId))];
                        case 1:
                            role = (_a.sent())[0];
                            if (!role) {
                                return [2 /*return*/, res.status(404).json({ message: "Role not found" })];
                            }
                            return [4 /*yield*/, db_1.db
                                    .select()
                                    .from(schema_2.permissions)
                                    .where((0, drizzle_orm_1.eq)(schema_2.permissions.roleId, roleId))];
                        case 2:
                            rolePermissions = _a.sent();
                            return [2 /*return*/, res.json(rolePermissions)];
                        case 3:
                            error_5 = _a.sent();
                            console.error("Error getting role permissions:", error_5);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            // Role management endpoints
            app.post("/api/roles", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var _a, name_1, description, existingRole, newRole, error_6;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 3, , 4]);
                            _a = req.body, name_1 = _a.name, description = _a.description;
                            if (!name_1 || typeof name_1 !== 'string') {
                                return [2 /*return*/, res.status(400).json({ message: "Valid role name is required" })];
                            }
                            return [4 /*yield*/, db_1.db
                                    .select()
                                    .from(schema_2.roles)
                                    .where((0, drizzle_orm_1.eq)(schema_2.roles.name, name_1))];
                        case 1:
                            existingRole = _b.sent();
                            if (existingRole.length > 0) {
                                return [2 /*return*/, res.status(400).json({ message: "Role with this name already exists" })];
                            }
                            return [4 /*yield*/, db_1.db
                                    .insert(schema_2.roles)
                                    .values({
                                    name: name_1,
                                    description: description || null
                                })
                                    .returning()];
                        case 2:
                            newRole = (_b.sent())[0];
                            return [2 /*return*/, res.status(201).json(newRole)];
                        case 3:
                            error_6 = _b.sent();
                            console.error("Error creating role:", error_6);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            app.patch("/api/roles/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var roleId, _a, name_2, description, existingRole, nameCheck, updatedRole, error_7;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 5, , 6]);
                            roleId = parseInt(req.params.id, 10);
                            if (isNaN(roleId)) {
                                return [2 /*return*/, res.status(400).json({ message: "Invalid role ID" })];
                            }
                            _a = req.body, name_2 = _a.name, description = _a.description;
                            return [4 /*yield*/, db_1.db
                                    .select()
                                    .from(schema_2.roles)
                                    .where((0, drizzle_orm_1.eq)(schema_2.roles.id, roleId))];
                        case 1:
                            existingRole = (_b.sent())[0];
                            if (!existingRole) {
                                return [2 /*return*/, res.status(404).json({ message: "Role not found" })];
                            }
                            // Don't allow changing the Admin role name for safety
                            if (existingRole.name === 'Admin' && name_2 && name_2 !== 'Admin') {
                                return [2 /*return*/, res.status(403).json({ message: "The Admin role name cannot be changed" })];
                            }
                            if (!(name_2 && name_2 !== existingRole.name)) return [3 /*break*/, 3];
                            return [4 /*yield*/, db_1.db
                                    .select()
                                    .from(schema_2.roles)
                                    .where((0, drizzle_orm_1.eq)(schema_2.roles.name, name_2))];
                        case 2:
                            nameCheck = _b.sent();
                            if (nameCheck.length > 0) {
                                return [2 /*return*/, res.status(400).json({ message: "Role with this name already exists" })];
                            }
                            _b.label = 3;
                        case 3: return [4 /*yield*/, db_1.db
                                .update(schema_2.roles)
                                .set({
                                name: name_2 || existingRole.name,
                                description: description !== undefined ? description : existingRole.description
                            })
                                .where((0, drizzle_orm_1.eq)(schema_2.roles.id, roleId))
                                .returning()];
                        case 4:
                            updatedRole = (_b.sent())[0];
                            return [2 /*return*/, res.json(updatedRole)];
                        case 5:
                            error_7 = _b.sent();
                            console.error("Error updating role:", error_7);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 6: return [2 /*return*/];
                    }
                });
            }); });
            app.delete("/api/roles/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var roleId, existingRole, usersWithRole, error_8;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 5, , 6]);
                            roleId = parseInt(req.params.id, 10);
                            if (isNaN(roleId)) {
                                return [2 /*return*/, res.status(400).json({ message: "Invalid role ID" })];
                            }
                            return [4 /*yield*/, db_1.db
                                    .select()
                                    .from(schema_2.roles)
                                    .where((0, drizzle_orm_1.eq)(schema_2.roles.id, roleId))];
                        case 1:
                            existingRole = (_a.sent())[0];
                            if (!existingRole) {
                                return [2 /*return*/, res.status(404).json({ message: "Role not found" })];
                            }
                            // Don't allow deleting the Admin or default roles for safety
                            if (existingRole.name === 'Admin' ||
                                existingRole.name === 'Manager' ||
                                existingRole.name === 'Staff') {
                                return [2 /*return*/, res.status(403).json({ message: "Default roles cannot be deleted" })];
                            }
                            return [4 /*yield*/, db_1.db
                                    .select()
                                    .from(schema_2.users)
                                    .where((0, drizzle_orm_1.eq)(schema_2.users.roleId, roleId))];
                        case 2:
                            usersWithRole = _a.sent();
                            if (usersWithRole.length > 0) {
                                return [2 /*return*/, res.status(400).json({
                                        message: "Cannot delete role that is assigned to users",
                                        count: usersWithRole.length
                                    })];
                            }
                            // Delete permissions for this role
                            return [4 /*yield*/, db_1.db
                                    .delete(schema_2.permissions)
                                    .where((0, drizzle_orm_1.eq)(schema_2.permissions.roleId, roleId))];
                        case 3:
                            // Delete permissions for this role
                            _a.sent();
                            // Delete the role
                            return [4 /*yield*/, db_1.db
                                    .delete(schema_2.roles)
                                    .where((0, drizzle_orm_1.eq)(schema_2.roles.id, roleId))];
                        case 4:
                            // Delete the role
                            _a.sent();
                            return [2 /*return*/, res.status(204).send()];
                        case 5:
                            error_8 = _a.sent();
                            console.error("Error deleting role:", error_8);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 6: return [2 /*return*/];
                    }
                });
            }); });
            // Permission management endpoints
            app.post("/api/permissions", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var _a, roleId, module_1, action, existingRole, existingPermissions, newPermission, error_9;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 4, , 5]);
                            _a = req.body, roleId = _a.roleId, module_1 = _a.module, action = _a.action;
                            if (!roleId || isNaN(parseInt(roleId, 10))) {
                                return [2 /*return*/, res.status(400).json({ message: "Valid role ID is required" })];
                            }
                            if (!module_1 || !action) {
                                return [2 /*return*/, res.status(400).json({ message: "Module and action are required" })];
                            }
                            return [4 /*yield*/, db_1.db
                                    .select()
                                    .from(schema_2.roles)
                                    .where((0, drizzle_orm_1.eq)(schema_2.roles.id, parseInt(roleId, 10)))];
                        case 1:
                            existingRole = (_b.sent())[0];
                            if (!existingRole) {
                                return [2 /*return*/, res.status(404).json({ message: "Role not found" })];
                            }
                            return [4 /*yield*/, db_1.db
                                    .select()
                                    .from(schema_2.permissions)
                                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_2.permissions.roleId, parseInt(roleId, 10)), (0, drizzle_orm_1.eq)(schema_2.permissions.module, module_1), (0, drizzle_orm_1.eq)(schema_2.permissions.action, action)))];
                        case 2:
                            existingPermissions = _b.sent();
                            if (existingPermissions.length > 0) {
                                return [2 /*return*/, res.status(400).json({ message: "Permission already exists for this role" })];
                            }
                            return [4 /*yield*/, db_1.db
                                    .insert(schema_2.permissions)
                                    .values({
                                    roleId: parseInt(roleId, 10),
                                    module: module_1,
                                    action: action
                                })
                                    .returning()];
                        case 3:
                            newPermission = (_b.sent())[0];
                            return [2 /*return*/, res.status(201).json(newPermission)];
                        case 4:
                            error_9 = _b.sent();
                            console.error("Error creating permission:", error_9);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 5: return [2 /*return*/];
                    }
                });
            }); });
            app.delete("/api/permissions/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var permissionId, existingPermission, error_10;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            permissionId = parseInt(req.params.id, 10);
                            if (isNaN(permissionId)) {
                                return [2 /*return*/, res.status(400).json({ message: "Invalid permission ID" })];
                            }
                            return [4 /*yield*/, db_1.db
                                    .select()
                                    .from(schema_2.permissions)
                                    .where((0, drizzle_orm_1.eq)(schema_2.permissions.id, permissionId))];
                        case 1:
                            existingPermission = (_a.sent())[0];
                            if (!existingPermission) {
                                return [2 /*return*/, res.status(404).json({ message: "Permission not found" })];
                            }
                            // Delete the permission
                            return [4 /*yield*/, db_1.db
                                    .delete(schema_2.permissions)
                                    .where((0, drizzle_orm_1.eq)(schema_2.permissions.id, permissionId))];
                        case 2:
                            // Delete the permission
                            _a.sent();
                            return [2 /*return*/, res.status(204).send()];
                        case 3:
                            error_10 = _a.sent();
                            console.error("Error deleting permission:", error_10);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            // User routes
            app.get("/api/users", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var users_1, usersWithRoles, error_11;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            return [4 /*yield*/, storage_1.storage.getUsers()];
                        case 1:
                            users_1 = _a.sent();
                            return [4 /*yield*/, Promise.all(users_1.map(function (user) { return __awaiter(_this, void 0, void 0, function () {
                                    var roleName, userRole;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                roleName = "user";
                                                if (!user.roleId) return [3 /*break*/, 2];
                                                return [4 /*yield*/, db_1.db.select().from(schema_2.roles).where((0, drizzle_orm_1.eq)(schema_2.roles.id, user.roleId))];
                                            case 1:
                                                userRole = (_a.sent())[0];
                                                if (userRole) {
                                                    roleName = userRole.name;
                                                }
                                                _a.label = 2;
                                            case 2: return [2 /*return*/, {
                                                    id: user.id,
                                                    fullName: user.fullName,
                                                    email: user.email,
                                                    phoneNumber: user.phoneNumber,
                                                    department: user.department,
                                                    role: roleName.toLowerCase(), // For backward compatibility
                                                    roleId: user.roleId,
                                                    active: user.active,
                                                    cnic: user.cnic,
                                                }];
                                        }
                                    });
                                }); }))];
                        case 2:
                            usersWithRoles = _a.sent();
                            return [2 /*return*/, res.json(usersWithRoles)];
                        case 3:
                            error_11 = _a.sent();
                            console.error("Error getting users:", error_11);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            app.post("/api/users", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var userData, hashedPassword, user, error_12;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            userData = schema_1.insertUserSchema.parse(req.body);
                            return [4 /*yield*/, bcrypt_1.default.hash(userData.password, 10)];
                        case 1:
                            hashedPassword = _a.sent();
                            return [4 /*yield*/, storage_1.storage.createUser(__assign(__assign({}, userData), { password: hashedPassword }))];
                        case 2:
                            user = _a.sent();
                            return [2 /*return*/, res.json({
                                    id: user.id,
                                    email: user.email,
                                    fullName: user.fullName,
                                    department: user.department,
                                    roleId: user.roleId
                                })];
                        case 3:
                            error_12 = _a.sent();
                            console.error('Error creating user:', error_12);
                            if (error_12 instanceof zod_1.ZodError) {
                                return [2 /*return*/, res.status(400).json({ message: (0, zod_validation_error_1.fromZodError)(error_12).message })];
                            }
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            // Update User API
            app.patch("/api/users/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var userId, existingUser, updateData, _a, updatedUser, dbError_1, error_13;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 7, , 8]);
                            // Set content type header first
                            res.setHeader('Content-Type', 'application/json');
                            userId = parseInt(req.params.id, 10);
                            if (isNaN(userId)) {
                                return [2 /*return*/, res.status(400).json({ message: "Invalid user ID" })];
                            }
                            return [4 /*yield*/, storage_1.storage.getUser(userId)];
                        case 1:
                            existingUser = _b.sent();
                            if (!existingUser) {
                                return [2 /*return*/, res.status(404).json({ message: "User not found" })];
                            }
                            updateData = __assign({}, req.body);
                            if (!updateData.password) return [3 /*break*/, 3];
                            _a = updateData;
                            return [4 /*yield*/, bcrypt_1.default.hash(updateData.password, 10)];
                        case 2:
                            _a.password = _b.sent();
                            _b.label = 3;
                        case 3:
                            _b.trys.push([3, 5, , 6]);
                            return [4 /*yield*/, storage_1.storage.updateUser(userId, updateData)];
                        case 4:
                            updatedUser = _b.sent();
                            if (!updatedUser) {
                                return [2 /*return*/, res.status(404).json({ message: "User not found" })];
                            }
                            return [2 /*return*/, res.json({
                                    id: updatedUser.id,
                                    email: updatedUser.email,
                                    fullName: updatedUser.fullName,
                                    department: updatedUser.department,
                                    roleId: updatedUser.roleId,
                                    active: updatedUser.active
                                })];
                        case 5:
                            dbError_1 = _b.sent();
                            console.error('Database error:', dbError_1);
                            return [2 /*return*/, res.status(500).json({ message: "Failed to update user" })];
                        case 6: return [3 /*break*/, 8];
                        case 7:
                            error_13 = _b.sent();
                            console.error('Error updating user:', error_13);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 8: return [2 /*return*/];
                    }
                });
            }); });
            // Delete User API
            app.delete("/api/users/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var userId, existingUser, success, dbError_2, error_14;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 6, , 7]);
                            // Set content type header first
                            res.setHeader('Content-Type', 'application/json');
                            userId = parseInt(req.params.id, 10);
                            return [4 /*yield*/, storage_1.storage.getUser(userId)];
                        case 1:
                            existingUser = _a.sent();
                            if (!existingUser) {
                                return [2 /*return*/, res.status(404).json({ message: "User not found" })];
                            }
                            _a.label = 2;
                        case 2:
                            _a.trys.push([2, 4, , 5]);
                            return [4 /*yield*/, storage_1.storage.deleteUser(userId)];
                        case 3:
                            success = _a.sent();
                            if (!success) {
                                return [2 /*return*/, res.status(500).json({ message: "Failed to delete user" })];
                            }
                            return [2 /*return*/, res.json({ message: "User deleted successfully" })];
                        case 4:
                            dbError_2 = _a.sent();
                            console.error('Database error:', dbError_2);
                            return [2 /*return*/, res.status(500).json({ message: "Failed to delete user" })];
                        case 5: return [3 /*break*/, 7];
                        case 6:
                            error_14 = _a.sent();
                            console.error("Error deleting user:", error_14);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 7: return [2 /*return*/];
                    }
                });
            }); });
            // Gate pass routes
            app.get("/api/gate-passes", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var userId, userRole, user, userPermissions, _a, canViewAll, filters, gatePasses, error_15;
                var _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            _d.trys.push([0, 6, , 7]);
                            userId = (_b = req.session) === null || _b === void 0 ? void 0 : _b.userId;
                            userRole = (_c = req.session) === null || _c === void 0 ? void 0 : _c.userRole;
                            if (!userId) {
                                return [2 /*return*/, res.status(401).json({ message: "Unauthorized" })];
                            }
                            return [4 /*yield*/, storage_1.storage.getUser(userId)];
                        case 1:
                            user = _d.sent();
                            if (!user) {
                                return [2 /*return*/, res.status(401).json({ message: "User not found" })];
                            }
                            if (!userRole) return [3 /*break*/, 3];
                            return [4 /*yield*/, db_1.db
                                    .select()
                                    .from(schema_2.permissions)
                                    .where((0, drizzle_orm_1.eq)(schema_2.permissions.roleId, userRole))];
                        case 2:
                            _a = _d.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            _a = [];
                            _d.label = 4;
                        case 4:
                            userPermissions = _a;
                            canViewAll = userRole === 1;
                            filters = {
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
                            return [4 /*yield*/, storage_1.storage.getGatePasses(filters)];
                        case 5:
                            gatePasses = _d.sent();
                            return [2 /*return*/, res.json(gatePasses)];
                        case 6:
                            error_15 = _d.sent();
                            console.error("Error getting gate passes:", error_15);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 7: return [2 /*return*/];
                    }
                });
            }); });
            // Verification endpoint (must come before the /:id route to avoid conflicts)
            app.get("/api/gate-passes/verify/:gatePassNumber", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var user, userPermissions, canVerify, gatePassNumber, gatePass, items, verificationResult, error_16;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 5, , 6]);
                            // Check if user is authenticated
                            if (!((_a = req.session) === null || _a === void 0 ? void 0 : _a.userId)) {
                                return [2 /*return*/, res.status(401).json({ message: "Unauthorized" })];
                            }
                            return [4 /*yield*/, storage_1.storage.getUser(req.session.userId)];
                        case 1:
                            user = _b.sent();
                            if (!user) {
                                return [2 /*return*/, res.status(401).json({ message: "User not found" })];
                            }
                            return [4 /*yield*/, db_1.db
                                    .select()
                                    .from(schema_2.permissions)
                                    .where((0, drizzle_orm_1.eq)(schema_2.permissions.roleId, user.roleId || 0))];
                        case 2:
                            userPermissions = _b.sent();
                            canVerify = user.roleId === 1 || // Admin role
                                userPermissions.some(function (p) {
                                    return p.module === 'qrScanner' && p.action === 'read';
                                });
                            if (!canVerify) {
                                return [2 /*return*/, res.status(403).json({ message: "Permission denied" })];
                            }
                            gatePassNumber = req.params.gatePassNumber;
                            console.log("Verifying gate pass number:", gatePassNumber);
                            return [4 /*yield*/, storage_1.storage.getGatePassByNumber(gatePassNumber)];
                        case 3:
                            gatePass = _b.sent();
                            console.log("Gate pass found:", gatePass ? "Yes" : "No");
                            if (!gatePass) {
                                console.log("Gate pass not found for verification");
                                return [2 /*return*/, res.status(404).json({
                                        isValid: false,
                                        message: "Gate pass not found",
                                        verifiedAt: new Date().toISOString()
                                    })];
                            }
                            return [4 /*yield*/, storage_1.storage.getItemsByGatePassId(gatePass.id)];
                        case 4:
                            items = _b.sent();
                            console.log("Items retrieved:", items.length);
                            verificationResult = __assign(__assign({}, gatePass), { items: items, isValid: true, verifiedAt: new Date().toISOString() });
                            console.log("Sending verification response for gate pass:", gatePassNumber);
                            return [2 /*return*/, res.status(200).json(verificationResult)];
                        case 5:
                            error_16 = _b.sent();
                            console.error("Error verifying gate pass:", error_16);
                            return [2 /*return*/, res.status(500).json({
                                    isValid: false,
                                    message: "Internal server error",
                                    verifiedAt: new Date().toISOString()
                                })];
                        case 6: return [2 /*return*/];
                    }
                });
            }); });
            app.get("/api/gate-passes/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var id, gatePass, items, error_17;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            id = parseInt(req.params.id, 10);
                            // If it's not a number, return 404
                            if (isNaN(id)) {
                                return [2 /*return*/, res.status(404).json({ message: "Gate pass not found" })];
                            }
                            return [4 /*yield*/, storage_1.storage.getGatePass(id)];
                        case 1:
                            gatePass = _a.sent();
                            if (!gatePass) {
                                return [2 /*return*/, res.status(404).json({ message: "Gate pass not found" })];
                            }
                            return [4 /*yield*/, storage_1.storage.getItemsByGatePassId(id)];
                        case 2:
                            items = _a.sent();
                            return [2 /*return*/, res.json(__assign(__assign({}, gatePass), { items: items }))];
                        case 3:
                            error_17 = _a.sent();
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            app.post("/api/gate-passes", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var _a, itemsData, gatePassData, userId, userData, gatePass, items, _i, itemsData_1, itemData, item, clientIp, forwardedIp, ipAddresses, error_18, error_19;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 11, , 12]);
                            _a = schema_1.gatePassWithItemsSchema.parse(req.body), itemsData = _a.items, gatePassData = __rest(_a, ["items"]);
                            userId = gatePassData.createdById;
                            return [4 /*yield*/, storage_1.storage.getUser(userId)];
                        case 1:
                            userData = _b.sent();
                            if (!userData) {
                                console.warn("User with ID ".concat(userId, " not found for activity logging"));
                            }
                            return [4 /*yield*/, storage_1.storage.createGatePass(gatePassData)];
                        case 2:
                            gatePass = _b.sent();
                            items = [];
                            _i = 0, itemsData_1 = itemsData;
                            _b.label = 3;
                        case 3:
                            if (!(_i < itemsData_1.length)) return [3 /*break*/, 6];
                            itemData = itemsData_1[_i];
                            return [4 /*yield*/, storage_1.storage.createItem(__assign(__assign({}, itemData), { gatePassId: gatePass.id }))];
                        case 4:
                            item = _b.sent();
                            items.push(item);
                            _b.label = 5;
                        case 5:
                            _i++;
                            return [3 /*break*/, 3];
                        case 6:
                            clientIp = req.ip || req.socket.remoteAddress || "unknown";
                            forwardedIp = req.headers['x-forwarded-for'] ?
                                (typeof req.headers['x-forwarded-for'] === 'string' ?
                                    req.headers['x-forwarded-for'] :
                                    req.headers['x-forwarded-for'][0]) :
                                null;
                            ipAddresses = forwardedIp ?
                                "".concat(clientIp, " (Local), ").concat(forwardedIp, " (ISP)") :
                                clientIp;
                            _b.label = 7;
                        case 7:
                            _b.trys.push([7, 9, , 10]);
                            return [4 /*yield*/, storage_1.storage.logUserActivity({
                                    userId: userId,
                                    userEmail: userData ? userData.email : "unknown user",
                                    actionType: "create",
                                    entityType: "gate_pass",
                                    entityId: gatePass.id,
                                    description: "Created gate pass #".concat(gatePass.gatePassNumber),
                                    ipAddress: ipAddresses,
                                    userAgent: req.headers["user-agent"] || "unknown",
                                    additionalData: JSON.stringify({
                                        timestamp: new Date().toISOString(),
                                        customerName: gatePass.customerName,
                                        itemCount: items.length,
                                        department: gatePass.department
                                    })
                                })];
                        case 8:
                            _b.sent();
                            return [3 /*break*/, 10];
                        case 9:
                            error_18 = _b.sent();
                            console.warn("Failed to log user activity:", error_18.message);
                            return [3 /*break*/, 10];
                        case 10: return [2 /*return*/, res.status(201).json(__assign(__assign({}, gatePass), { items: items }))];
                        case 11:
                            error_19 = _b.sent();
                            if (error_19 instanceof zod_1.ZodError) {
                                return [2 /*return*/, res.status(400).json({ message: (0, zod_validation_error_1.fromZodError)(error_19).message })];
                            }
                            console.error("Error creating gate pass:", error_19);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 12: return [2 /*return*/];
                    }
                });
            }); });
            app.patch("/api/gate-passes/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var id, gatePass, updatedGatePass, items, _i, _a, itemData, item, userId, userData, clientIp, forwardedIp, ipAddresses, error_20, error_21;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 15, , 16]);
                            id = parseInt(req.params.id, 10);
                            return [4 /*yield*/, storage_1.storage.getGatePass(id)];
                        case 1:
                            gatePass = _b.sent();
                            if (!gatePass) {
                                return [2 /*return*/, res.status(404).json({ message: "Gate pass not found" })];
                            }
                            return [4 /*yield*/, storage_1.storage.updateGatePass(id, req.body)];
                        case 2:
                            updatedGatePass = _b.sent();
                            items = [];
                            if (!req.body.items) return [3 /*break*/, 8];
                            // First, delete existing items
                            return [4 /*yield*/, storage_1.storage.deleteItemsByGatePassId(id)];
                        case 3:
                            // First, delete existing items
                            _b.sent();
                            _i = 0, _a = req.body.items;
                            _b.label = 4;
                        case 4:
                            if (!(_i < _a.length)) return [3 /*break*/, 7];
                            itemData = _a[_i];
                            return [4 /*yield*/, storage_1.storage.createItem(__assign(__assign({}, itemData), { gatePassId: id }))];
                        case 5:
                            item = _b.sent();
                            items.push(item);
                            _b.label = 6;
                        case 6:
                            _i++;
                            return [3 /*break*/, 4];
                        case 7: return [3 /*break*/, 10];
                        case 8: return [4 /*yield*/, storage_1.storage.getItemsByGatePassId(id)];
                        case 9:
                            // If no items were included, fetch the existing ones
                            items = _b.sent();
                            _b.label = 10;
                        case 10:
                            _b.trys.push([10, 13, , 14]);
                            userId = req.body.updatedById || gatePass.createdById;
                            return [4 /*yield*/, storage_1.storage.getUser(userId)];
                        case 11:
                            userData = _b.sent();
                            if (!userData) {
                                console.warn("User with ID ".concat(userId, " not found for activity logging"));
                            }
                            clientIp = req.ip || req.socket.remoteAddress || "unknown";
                            forwardedIp = req.headers['x-forwarded-for'] ?
                                (typeof req.headers['x-forwarded-for'] === 'string' ?
                                    req.headers['x-forwarded-for'] :
                                    req.headers['x-forwarded-for'][0]) :
                                null;
                            ipAddresses = forwardedIp ?
                                "".concat(clientIp, " (Local), ").concat(forwardedIp, " (ISP)") :
                                clientIp;
                            return [4 /*yield*/, storage_1.storage.logUserActivity({
                                    userId: userId,
                                    userEmail: userData ? userData.email : (req.body.updatedByEmail || "unknown user"),
                                    actionType: "update",
                                    entityType: "gate_pass",
                                    entityId: gatePass.id,
                                    description: "Updated gate pass #".concat(gatePass.gatePassNumber),
                                    ipAddress: ipAddresses,
                                    userAgent: req.headers["user-agent"] || "unknown",
                                    additionalData: JSON.stringify({
                                        timestamp: new Date().toISOString(),
                                        changes: Object.keys(req.body)
                                            .filter(function (key) { return key !== 'items' && key !== 'updatedById' && key !== 'updatedByEmail'; })
                                            .join(', '),
                                        itemsUpdated: req.body.items ? true : false,
                                        newStatus: req.body.status || gatePass.status
                                    })
                                })];
                        case 12:
                            _b.sent();
                            return [3 /*break*/, 14];
                        case 13:
                            error_20 = _b.sent();
                            console.warn("Failed to log user activity:", error_20.message);
                            return [3 /*break*/, 14];
                        case 14:
                            res.setHeader('Content-Type', 'application/json');
                            return [2 /*return*/, res.json(__assign(__assign({}, updatedGatePass), { items: items }))];
                        case 15:
                            error_21 = _b.sent();
                            if (error_21 instanceof zod_1.ZodError) {
                                res.setHeader('Content-Type', 'application/json');
                                return [2 /*return*/, res.status(400).json({ message: (0, zod_validation_error_1.fromZodError)(error_21).message })];
                            }
                            console.error("Error updating gate pass:", error_21);
                            res.setHeader('Content-Type', 'application/json');
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 16: return [2 /*return*/];
                    }
                });
            }); });
            app.delete("/api/gate-passes/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var id, gatePass, gatePassNumber, customerName, createdById, userId, userData, clientIp, forwardedIp, ipAddresses, error_22, error_23;
                var _a, _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            _e.trys.push([0, 8, , 9]);
                            id = parseInt(req.params.id, 10);
                            return [4 /*yield*/, storage_1.storage.getGatePass(id)];
                        case 1:
                            gatePass = _e.sent();
                            if (!gatePass) {
                                return [2 /*return*/, res.status(404).json({ message: "Gate pass not found" })];
                            }
                            gatePassNumber = gatePass.gatePassNumber;
                            customerName = gatePass.customerName;
                            createdById = gatePass.createdById;
                            return [4 /*yield*/, storage_1.storage.deleteGatePass(id)];
                        case 2:
                            _e.sent();
                            _e.label = 3;
                        case 3:
                            _e.trys.push([3, 6, , 7]);
                            userId = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.userId) || ((_b = req.query) === null || _b === void 0 ? void 0 : _b.userId) || createdById;
                            return [4 /*yield*/, storage_1.storage.getUser(userId)];
                        case 4:
                            userData = _e.sent();
                            if (!userData) {
                                console.warn("User with ID ".concat(userId, " not found for activity logging"));
                            }
                            clientIp = req.ip || req.socket.remoteAddress || "unknown";
                            forwardedIp = req.headers['x-forwarded-for'] ?
                                (typeof req.headers['x-forwarded-for'] === 'string' ?
                                    req.headers['x-forwarded-for'] :
                                    req.headers['x-forwarded-for'][0]) :
                                null;
                            ipAddresses = forwardedIp ?
                                "".concat(clientIp, " (Local), ").concat(forwardedIp, " (ISP)") :
                                clientIp;
                            return [4 /*yield*/, storage_1.storage.logUserActivity({
                                    userId: userId,
                                    userEmail: userData ? userData.email : (((_c = req.body) === null || _c === void 0 ? void 0 : _c.userEmail) || ((_d = req.query) === null || _d === void 0 ? void 0 : _d.userEmail) || "unknown user"),
                                    actionType: "delete",
                                    entityType: "gate_pass",
                                    entityId: id,
                                    description: "Deleted gate pass #".concat(gatePassNumber),
                                    ipAddress: ipAddresses,
                                    userAgent: req.headers["user-agent"] || "unknown",
                                    additionalData: JSON.stringify({
                                        timestamp: new Date().toISOString(),
                                        gatePassNumber: gatePassNumber,
                                        customerName: customerName
                                    })
                                })];
                        case 5:
                            _e.sent();
                            return [3 /*break*/, 7];
                        case 6:
                            error_22 = _e.sent();
                            console.warn("Failed to log user activity:", error_22.message);
                            return [3 /*break*/, 7];
                        case 7: return [2 /*return*/, res.status(204).send()];
                        case 8:
                            error_23 = _e.sent();
                            console.error("Error deleting gate pass:", error_23);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 9: return [2 /*return*/];
                    }
                });
            }); });
            // Customer routes
            app.get("/api/customers", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var searchTerm, customers, error_24;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            searchTerm = req.query.search || undefined;
                            return [4 /*yield*/, storage_1.storage.getCustomers(searchTerm)];
                        case 1:
                            customers = _a.sent();
                            return [2 /*return*/, res.json(customers)];
                        case 2:
                            error_24 = _a.sent();
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            app.get("/api/customers/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var id, customer, error_25;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            id = parseInt(req.params.id, 10);
                            // If it's not a number, return 404
                            if (isNaN(id)) {
                                return [2 /*return*/, res.status(404).json({ message: "Customer not found" })];
                            }
                            return [4 /*yield*/, storage_1.storage.getCustomer(id)];
                        case 1:
                            customer = _a.sent();
                            if (!customer) {
                                return [2 /*return*/, res.status(404).json({ message: "Customer not found" })];
                            }
                            return [2 /*return*/, res.json(customer)];
                        case 2:
                            error_25 = _a.sent();
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            app.post("/api/customers", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var customerData, customer, userId, userData, clientIp, forwardedIp, ipAddresses, error_26, error_27;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _c.trys.push([0, 8, , 9]);
                            customerData = schema_1.insertCustomerSchema.parse(req.body);
                            return [4 /*yield*/, storage_1.storage.createCustomer(customerData)];
                        case 1:
                            customer = _c.sent();
                            _c.label = 2;
                        case 2:
                            _c.trys.push([2, 6, , 7]);
                            userId = req.body.createdById || ((_a = req.query) === null || _a === void 0 ? void 0 : _a.userId);
                            userData = null;
                            if (!userId) return [3 /*break*/, 4];
                            return [4 /*yield*/, storage_1.storage.getUser(userId)];
                        case 3:
                            userData = _c.sent();
                            if (!userData) {
                                console.warn("User with ID ".concat(userId, " not found for activity logging"));
                            }
                            _c.label = 4;
                        case 4:
                            clientIp = req.ip || req.socket.remoteAddress || "unknown";
                            forwardedIp = req.headers['x-forwarded-for'] ?
                                (typeof req.headers['x-forwarded-for'] === 'string' ?
                                    req.headers['x-forwarded-for'] :
                                    req.headers['x-forwarded-for'][0]) :
                                null;
                            ipAddresses = forwardedIp ?
                                "".concat(clientIp, " (Local), ").concat(forwardedIp, " (ISP)") :
                                clientIp;
                            return [4 /*yield*/, storage_1.storage.logUserActivity({
                                    userId: userId || 0,
                                    userEmail: userData ? userData.email : (req.body.createdByEmail || ((_b = req.query) === null || _b === void 0 ? void 0 : _b.userEmail) || "unknown user"),
                                    actionType: "create",
                                    entityType: "customer",
                                    entityId: customer.id,
                                    description: "Created customer record for ".concat(customer.name),
                                    ipAddress: ipAddresses,
                                    userAgent: req.headers["user-agent"] || "unknown",
                                    additionalData: JSON.stringify({
                                        timestamp: new Date().toISOString(),
                                        customerName: customer.name,
                                        customerPhone: customer.phone
                                    })
                                })];
                        case 5:
                            _c.sent();
                            return [3 /*break*/, 7];
                        case 6:
                            error_26 = _c.sent();
                            console.warn("Failed to log user activity:", error_26.message);
                            return [3 /*break*/, 7];
                        case 7: return [2 /*return*/, res.status(201).json(customer)];
                        case 8:
                            error_27 = _c.sent();
                            if (error_27 instanceof zod_1.ZodError) {
                                return [2 /*return*/, res.status(400).json({ message: (0, zod_validation_error_1.fromZodError)(error_27).message })];
                            }
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 9: return [2 /*return*/];
                    }
                });
            }); });
            app.patch("/api/customers/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var id, customer, updatedCustomer, error_28;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            id = parseInt(req.params.id, 10);
                            return [4 /*yield*/, storage_1.storage.getCustomer(id)];
                        case 1:
                            customer = _a.sent();
                            if (!customer) {
                                return [2 /*return*/, res.status(404).json({ message: "Customer not found" })];
                            }
                            return [4 /*yield*/, storage_1.storage.updateCustomer(id, req.body)];
                        case 2:
                            updatedCustomer = _a.sent();
                            return [2 /*return*/, res.json(updatedCustomer)];
                        case 3:
                            error_28 = _a.sent();
                            if (error_28 instanceof zod_1.ZodError) {
                                return [2 /*return*/, res.status(400).json({ message: (0, zod_validation_error_1.fromZodError)(error_28).message })];
                            }
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            // Driver routes
            app.get("/api/drivers", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var searchTerm, drivers, error_29;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            searchTerm = req.query.search || undefined;
                            return [4 /*yield*/, storage_1.storage.getDrivers(searchTerm)];
                        case 1:
                            drivers = _a.sent();
                            return [2 /*return*/, res.json(drivers)];
                        case 2:
                            error_29 = _a.sent();
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            app.get("/api/drivers/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var id, driver, error_30;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            id = parseInt(req.params.id, 10);
                            // If it's not a number, return 404
                            if (isNaN(id)) {
                                return [2 /*return*/, res.status(404).json({ message: "Driver not found" })];
                            }
                            return [4 /*yield*/, storage_1.storage.getDriver(id)];
                        case 1:
                            driver = _a.sent();
                            if (!driver) {
                                return [2 /*return*/, res.status(404).json({ message: "Driver not found" })];
                            }
                            return [2 /*return*/, res.json(driver)];
                        case 2:
                            error_30 = _a.sent();
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            app.get("/api/drivers/cnic/:cnic", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var cnic, driver, error_31;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            cnic = req.params.cnic;
                            return [4 /*yield*/, storage_1.storage.getDriverByCnic(cnic)];
                        case 1:
                            driver = _a.sent();
                            if (!driver) {
                                return [2 /*return*/, res.status(404).json({ message: "Driver not found" })];
                            }
                            return [2 /*return*/, res.json(driver)];
                        case 2:
                            error_31 = _a.sent();
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            app.post("/api/drivers", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var driverData, existingDriver, driver, userId, userData, clientIp, forwardedIp, ipAddresses, error_32, error_33;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _c.trys.push([0, 9, , 10]);
                            driverData = schema_1.insertDriverSchema.parse(req.body);
                            return [4 /*yield*/, storage_1.storage.getDriverByCnic(driverData.cnic)];
                        case 1:
                            existingDriver = _c.sent();
                            if (existingDriver) {
                                return [2 /*return*/, res.status(400).json({ message: "Driver with this CNIC already exists" })];
                            }
                            return [4 /*yield*/, storage_1.storage.createDriver(driverData)];
                        case 2:
                            driver = _c.sent();
                            _c.label = 3;
                        case 3:
                            _c.trys.push([3, 7, , 8]);
                            userId = req.body.createdById || ((_a = req.query) === null || _a === void 0 ? void 0 : _a.userId);
                            userData = null;
                            if (!userId) return [3 /*break*/, 5];
                            return [4 /*yield*/, storage_1.storage.getUser(userId)];
                        case 4:
                            userData = _c.sent();
                            if (!userData) {
                                console.warn("User with ID ".concat(userId, " not found for activity logging"));
                            }
                            _c.label = 5;
                        case 5:
                            clientIp = req.ip || req.socket.remoteAddress || "unknown";
                            forwardedIp = req.headers['x-forwarded-for'] ?
                                (typeof req.headers['x-forwarded-for'] === 'string' ?
                                    req.headers['x-forwarded-for'] :
                                    req.headers['x-forwarded-for'][0]) :
                                null;
                            ipAddresses = forwardedIp ?
                                "".concat(clientIp, " (Local), ").concat(forwardedIp, " (ISP)") :
                                clientIp;
                            return [4 /*yield*/, storage_1.storage.logUserActivity({
                                    userId: userId || 0,
                                    userEmail: userData ? userData.email : (req.body.createdByEmail || ((_b = req.query) === null || _b === void 0 ? void 0 : _b.userEmail) || "unknown user"),
                                    actionType: "create",
                                    entityType: "driver",
                                    entityId: driver.id,
                                    description: "Created driver record for ".concat(driver.name),
                                    ipAddress: ipAddresses,
                                    userAgent: req.headers["user-agent"] || "unknown",
                                    additionalData: JSON.stringify({
                                        timestamp: new Date().toISOString(),
                                        driverName: driver.name,
                                        driverCNIC: driver.cnic,
                                        driverMobile: driver.mobile
                                    })
                                })];
                        case 6:
                            _c.sent();
                            return [3 /*break*/, 8];
                        case 7:
                            error_32 = _c.sent();
                            console.warn("Failed to log user activity:", error_32.message);
                            return [3 /*break*/, 8];
                        case 8: return [2 /*return*/, res.status(201).json(driver)];
                        case 9:
                            error_33 = _c.sent();
                            if (error_33 instanceof zod_1.ZodError) {
                                return [2 /*return*/, res.status(400).json({ message: (0, zod_validation_error_1.fromZodError)(error_33).message })];
                            }
                            console.error("Error creating driver:", error_33);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 10: return [2 /*return*/];
                    }
                });
            }); });
            app.patch("/api/drivers/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var id, driver, existingDriver, updatedDriver, error_34;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 5, , 6]);
                            id = parseInt(req.params.id, 10);
                            return [4 /*yield*/, storage_1.storage.getDriver(id)];
                        case 1:
                            driver = _a.sent();
                            if (!driver) {
                                return [2 /*return*/, res.status(404).json({ message: "Driver not found" })];
                            }
                            if (!(req.body.cnic && req.body.cnic !== driver.cnic)) return [3 /*break*/, 3];
                            return [4 /*yield*/, storage_1.storage.getDriverByCnic(req.body.cnic)];
                        case 2:
                            existingDriver = _a.sent();
                            if (existingDriver && existingDriver.id !== id) {
                                return [2 /*return*/, res.status(400).json({ message: "Another driver with this CNIC already exists" })];
                            }
                            _a.label = 3;
                        case 3: return [4 /*yield*/, storage_1.storage.updateDriver(id, req.body)];
                        case 4:
                            updatedDriver = _a.sent();
                            return [2 /*return*/, res.json(updatedDriver)];
                        case 5:
                            error_34 = _a.sent();
                            if (error_34 instanceof zod_1.ZodError) {
                                return [2 /*return*/, res.status(400).json({ message: (0, zod_validation_error_1.fromZodError)(error_34).message })];
                            }
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 6: return [2 /*return*/];
                    }
                });
            }); });
            // Statistics routes
            app.get("/api/statistics", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var statistics, error_35;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, storage_1.storage.getStatistics()];
                        case 1:
                            statistics = _a.sent();
                            return [2 /*return*/, res.json(statistics)];
                        case 2:
                            error_35 = _a.sent();
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // User Activity Logs
            app.get("/api/activity-logs", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var _a, userId, userEmail, actionType, entityType, dateFrom, dateTo, filters, logs, error_36;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            _a = req.query, userId = _a.userId, userEmail = _a.userEmail, actionType = _a.actionType, entityType = _a.entityType, dateFrom = _a.dateFrom, dateTo = _a.dateTo;
                            filters = {};
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
                            return [4 /*yield*/, storage_1.storage.getUserActivityLogs(filters)];
                        case 1:
                            logs = _b.sent();
                            return [2 /*return*/, res.json(logs)];
                        case 2:
                            error_36 = _b.sent();
                            console.error("Error getting activity logs:", error_36);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // Document routes
            app.get("/api/documents/entity/:type/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var entityType, entityId, documents, error_37;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            entityType = req.params.type;
                            entityId = parseInt(req.params.id, 10);
                            if (isNaN(entityId)) {
                                return [2 /*return*/, res.status(400).json({ message: "Invalid entity ID" })];
                            }
                            return [4 /*yield*/, storage_1.storage.getDocumentsByEntity(entityType, entityId)];
                        case 1:
                            documents = _a.sent();
                            return [2 /*return*/, res.json(documents)];
                        case 2:
                            error_37 = _a.sent();
                            console.error("Error getting documents for entity:", error_37);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            app.get("/api/documents/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var documentId, document_1, error_38;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            documentId = parseInt(req.params.id, 10);
                            if (isNaN(documentId)) {
                                return [2 /*return*/, res.status(400).json({ message: "Invalid document ID" })];
                            }
                            return [4 /*yield*/, storage_1.storage.getDocument(documentId)];
                        case 1:
                            document_1 = _a.sent();
                            if (!document_1) {
                                return [2 /*return*/, res.status(404).json({ message: "Document not found" })];
                            }
                            return [2 /*return*/, res.json(document_1)];
                        case 2:
                            error_38 = _a.sent();
                            console.error("Error getting document:", error_38);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            app.post("/api/documents", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var documentData, user, error_39, document_2, error_40;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 6, , 7]);
                            documentData = schema_1.insertDocumentSchema.parse(req.body);
                            user = req.body.user;
                            if (!(user && user.id)) return [3 /*break*/, 4];
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, storage_1.storage.logUserActivity({
                                    userId: user.id,
                                    userEmail: user.email,
                                    actionType: "create",
                                    entityType: "document",
                                    entityId: null,
                                    description: "Document uploaded for ".concat(documentData.entityType, " ID ").concat(documentData.entityId),
                                    ipAddress: req.ip || req.socket.remoteAddress || "unknown",
                                    userAgent: req.headers["user-agent"] || "unknown",
                                    additionalData: JSON.stringify({
                                        fileName: documentData.fileName,
                                        fileType: documentData.fileType,
                                        entityType: documentData.entityType,
                                        entityId: documentData.entityId
                                    })
                                })];
                        case 2:
                            _a.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            error_39 = _a.sent();
                            console.warn("Failed to log user activity:", error_39.message);
                            return [3 /*break*/, 4];
                        case 4: return [4 /*yield*/, storage_1.storage.createDocument(documentData)];
                        case 5:
                            document_2 = _a.sent();
                            return [2 /*return*/, res.status(201).json(document_2)];
                        case 6:
                            error_40 = _a.sent();
                            if (error_40 instanceof zod_1.ZodError) {
                                return [2 /*return*/, res.status(400).json({ message: (0, zod_validation_error_1.fromZodError)(error_40).message })];
                            }
                            console.error("Error creating document:", error_40);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 7: return [2 /*return*/];
                    }
                });
            }); });
            app.patch("/api/documents/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var documentId, existingDocument, fieldsToUpdate, updateData_1, user, error_41, updatedDocument, error_42;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 7, , 8]);
                            documentId = parseInt(req.params.id, 10);
                            if (isNaN(documentId)) {
                                return [2 /*return*/, res.status(400).json({ message: "Invalid document ID" })];
                            }
                            return [4 /*yield*/, storage_1.storage.getDocument(documentId)];
                        case 1:
                            existingDocument = _a.sent();
                            if (!existingDocument) {
                                return [2 /*return*/, res.status(404).json({ message: "Document not found" })];
                            }
                            fieldsToUpdate = ['description'];
                            updateData_1 = {};
                            fieldsToUpdate.forEach(function (field) {
                                if (req.body[field] !== undefined) {
                                    updateData_1[field] = req.body[field];
                                }
                            });
                            user = req.body.user;
                            if (!(user && user.id)) return [3 /*break*/, 5];
                            _a.label = 2;
                        case 2:
                            _a.trys.push([2, 4, , 5]);
                            return [4 /*yield*/, storage_1.storage.logUserActivity({
                                    userId: user.id,
                                    userEmail: user.email,
                                    actionType: "update",
                                    entityType: "document",
                                    entityId: documentId,
                                    description: "Document ID ".concat(documentId, " updated"),
                                    ipAddress: req.ip || req.socket.remoteAddress || "unknown",
                                    userAgent: req.headers["user-agent"] || "unknown",
                                    additionalData: JSON.stringify({
                                        fileName: existingDocument.fileName,
                                        documentId: documentId,
                                        updatedFields: Object.keys(updateData_1)
                                    })
                                })];
                        case 3:
                            _a.sent();
                            return [3 /*break*/, 5];
                        case 4:
                            error_41 = _a.sent();
                            console.warn("Failed to log user activity:", error_41.message);
                            return [3 /*break*/, 5];
                        case 5: return [4 /*yield*/, storage_1.storage.updateDocument(documentId, updateData_1)];
                        case 6:
                            updatedDocument = _a.sent();
                            return [2 /*return*/, res.json(updatedDocument)];
                        case 7:
                            error_42 = _a.sent();
                            console.error("Error updating document:", error_42);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 8: return [2 /*return*/];
                    }
                });
            }); });
            app.delete("/api/documents/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var documentId, existingDocument, user, error_43, success, error_44;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 7, , 8]);
                            documentId = parseInt(req.params.id, 10);
                            if (isNaN(documentId)) {
                                return [2 /*return*/, res.status(400).json({ message: "Invalid document ID" })];
                            }
                            return [4 /*yield*/, storage_1.storage.getDocument(documentId)];
                        case 1:
                            existingDocument = _a.sent();
                            if (!existingDocument) {
                                return [2 /*return*/, res.status(404).json({ message: "Document not found" })];
                            }
                            user = req.body.user;
                            if (!(user && user.id)) return [3 /*break*/, 5];
                            _a.label = 2;
                        case 2:
                            _a.trys.push([2, 4, , 5]);
                            return [4 /*yield*/, storage_1.storage.logUserActivity({
                                    userId: user.id,
                                    userEmail: user.email,
                                    actionType: "delete",
                                    entityType: "document",
                                    entityId: documentId,
                                    description: "Document ID ".concat(documentId, " deleted"),
                                    ipAddress: req.ip || req.socket.remoteAddress || "unknown",
                                    userAgent: req.headers["user-agent"] || "unknown",
                                    additionalData: JSON.stringify({
                                        fileName: existingDocument.fileName,
                                        fileType: existingDocument.fileType,
                                        entityType: existingDocument.entityType,
                                        entityId: existingDocument.entityId
                                    })
                                })];
                        case 3:
                            _a.sent();
                            return [3 /*break*/, 5];
                        case 4:
                            error_43 = _a.sent();
                            console.warn("Failed to log user activity:", error_43.message);
                            return [3 /*break*/, 5];
                        case 5: return [4 /*yield*/, storage_1.storage.deleteDocument(documentId)];
                        case 6:
                            success = _a.sent();
                            if (success) {
                                return [2 /*return*/, res.status(204).send()];
                            }
                            else {
                                return [2 /*return*/, res.status(500).json({ message: "Failed to delete document" })];
                            }
                            return [3 /*break*/, 8];
                        case 7:
                            error_44 = _a.sent();
                            console.error("Error deleting document:", error_44);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 8: return [2 /*return*/];
                    }
                });
            }); });
            // Notification Settings routes
            app.get("/api/settings/notifications", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var settings, error_45;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, notificationService.getNotificationSettings()];
                        case 1:
                            settings = _a.sent();
                            return [2 /*return*/, res.json({
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
                                })];
                        case 2:
                            error_45 = _a.sent();
                            console.error("Error getting notification settings:", error_45);
                            return [2 /*return*/, res.status(500).json({ message: "Internal server error" })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            app.post("/api/settings/notifications", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var _a, email, sms, useEthereal, settings, success, error_46;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            _a = req.body, email = _a.email, sms = _a.sms;
                            if (!email || !sms) {
                                return [2 /*return*/, res.status(400).json({
                                        message: "Invalid settings format. Both email and sms configurations are required."
                                    })];
                            }
                            useEthereal = email.enabled && (!email.host || !email.user);
                            settings = {
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
                            return [4 /*yield*/, notificationService.saveNotificationSettings(settings)];
                        case 1:
                            success = _b.sent();
                            if (!success) {
                                return [2 /*return*/, res.status(500).json({
                                        message: "Failed to save notification settings. Please try again."
                                    })];
                            }
                            return [2 /*return*/, res.json({
                                    message: "Settings saved successfully",
                                    useEthereal: useEthereal
                                })];
                        case 2:
                            error_46 = _b.sent();
                            console.error("Error saving notification settings:", error_46);
                            return [2 /*return*/, res.status(500).json({
                                    message: error_46 instanceof Error ? error_46.message : "Internal server error"
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            app.post("/api/settings/test-email", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var _a, enabled, host, port, secure, user, password, useEthereal, testSettings, saveSuccess, success, error_47;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 3, , 4]);
                            _a = req.body, enabled = _a.enabled, host = _a.host, port = _a.port, secure = _a.secure, user = _a.user, password = _a.password;
                            if (!enabled) {
                                return [2 /*return*/, res.status(400).json({ message: "Email notifications are disabled" })];
                            }
                            useEthereal = !host || !user;
                            testSettings = {
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
                            return [4 /*yield*/, notificationService.saveNotificationSettings(testSettings)];
                        case 1:
                            saveSuccess = _b.sent();
                            if (!saveSuccess) {
                                throw new Error("Failed to save test settings");
                            }
                            return [4 /*yield*/, notificationService.sendEmail(user || 'test@ethereal.email', // Use test email if no user provided
                                "Test Email from Gate Pass System", "\n          <h1>Test Email</h1>\n          <p>This is a test email from your Gate Pass System.</p>\n          <p>If you received this email, your email settings are configured correctly.</p>\n          ".concat(useEthereal ? '<p>This is a test email using Ethereal. Check the console for the preview URL.</p>' : '', "\n        "))];
                        case 2:
                            success = _b.sent();
                            if (!success) {
                                throw new Error("Failed to send test email");
                            }
                            return [2 /*return*/, res.json({
                                    message: useEthereal
                                        ? "Test email sent successfully. Check the console for the preview URL."
                                        : "Test email sent successfully"
                                })];
                        case 3:
                            error_47 = _b.sent();
                            console.error("Error testing email settings:", error_47);
                            return [2 /*return*/, res.status(500).json({
                                    message: "Failed to send test email",
                                    details: error_47 instanceof Error ? error_47.message : "Unknown error"
                                })];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            app.post("/api/settings/test-sms", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var _a, enabled, accountSid, authToken, phoneNumber, settings, success, error_48;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 3, , 4]);
                            _a = req.body, enabled = _a.enabled, accountSid = _a.accountSid, authToken = _a.authToken, phoneNumber = _a.phoneNumber;
                            if (!enabled) {
                                return [2 /*return*/, res.status(400).json({ message: "SMS notifications are disabled" })];
                            }
                            // Check if Twilio credentials are provided
                            if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
                                // If environment variables are not set, use the provided values
                                process.env.TWILIO_ACCOUNT_SID = accountSid;
                                process.env.TWILIO_AUTH_TOKEN = authToken;
                                process.env.TWILIO_PHONE_NUMBER = phoneNumber;
                            }
                            settings = {
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
                                    accountSid: accountSid,
                                    authToken: authToken,
                                    phoneNumber: phoneNumber
                                }
                            };
                            // Save temporary settings
                            return [4 /*yield*/, notificationService.saveNotificationSettings(settings)];
                        case 1:
                            // Save temporary settings
                            _b.sent();
                            return [4 /*yield*/, notificationService.sendSMS(phoneNumber, // Send to the same phone number
                                "Test SMS from Parazelsus Gate Pass System")];
                        case 2:
                            success = _b.sent();
                            if (success) {
                                return [2 /*return*/, res.json({ message: "Test SMS sent successfully" })];
                            }
                            else {
                                return [2 /*return*/, res.status(500).json({ message: "Failed to send test SMS" })];
                            }
                            return [3 /*break*/, 4];
                        case 3:
                            error_48 = _b.sent();
                            console.error("Error sending test SMS:", error_48);
                            return [2 /*return*/, res.status(500).json({ message: "Failed to send test SMS" })];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/, httpServer];
        });
    });
}
