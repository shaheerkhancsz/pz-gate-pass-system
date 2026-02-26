"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
var db_1 = require("./server/db");
var schema_1 = require("./shared/schema");
var drizzle_orm_1 = require("drizzle-orm");
/**
 * Migration script to set up initial roles and permissions
 * This script should be run after the main schema migration
 */
function migrateRolesAndPermissions() {
    return __awaiter(this, void 0, void 0, function () {
        var roleDefinitions, _i, roleDefinitions_1, roleDef, existingRole, allRoles, roleMap, permissionDefinitions, _a, permissionDefinitions_1, permDef, roleId, existingPermissions, _loop_1, _b, _c, perm, error_1;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 15, , 16]);
                    console.log('Starting roles and permissions migration...');
                    roleDefinitions = [
                        { name: 'Admin', description: 'Full system access' },
                        { name: 'Manager', description: 'Can manage gate passes and view reports' },
                        { name: 'Staff', description: 'Can create and view gate passes' },
                        { name: 'Security', description: 'Can verify gate passes' },
                        { name: 'Viewer', description: 'Read-only access' }
                    ];
                    _i = 0, roleDefinitions_1 = roleDefinitions;
                    _d.label = 1;
                case 1:
                    if (!(_i < roleDefinitions_1.length)) return [3 /*break*/, 6];
                    roleDef = roleDefinitions_1[_i];
                    return [4 /*yield*/, db_1.db.select().from(schema_1.roles).where((0, drizzle_orm_1.eq)(schema_1.roles.name, roleDef.name))];
                case 2:
                    existingRole = _d.sent();
                    if (!(existingRole.length === 0)) return [3 /*break*/, 4];
                    console.log("Creating role: ".concat(roleDef.name));
                    return [4 /*yield*/, db_1.db.insert(schema_1.roles).values({
                            name: roleDef.name,
                            description: roleDef.description
                        })];
                case 3:
                    _d.sent();
                    return [3 /*break*/, 5];
                case 4:
                    console.log("Role ".concat(roleDef.name, " already exists"));
                    _d.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6: return [4 /*yield*/, db_1.db.select().from(schema_1.roles)];
                case 7:
                    allRoles = _d.sent();
                    roleMap = new Map(allRoles.map(function (role) { return [role.name, role.id]; }));
                    permissionDefinitions = [
                        // Admin has all permissions (special case handled in code)
                        // Manager permissions
                        {
                            roleName: 'Manager',
                            permissions: [
                                { module: schema_1.ModuleType.GATE_PASS, action: schema_1.PermissionAction.CREATE },
                                { module: schema_1.ModuleType.GATE_PASS, action: schema_1.PermissionAction.READ },
                                { module: schema_1.ModuleType.GATE_PASS, action: schema_1.PermissionAction.UPDATE },
                                { module: schema_1.ModuleType.GATE_PASS, action: schema_1.PermissionAction.DELETE },
                                { module: schema_1.ModuleType.GATE_PASS, action: schema_1.PermissionAction.APPROVE },
                                { module: schema_1.ModuleType.CUSTOMER, action: schema_1.PermissionAction.CREATE },
                                { module: schema_1.ModuleType.CUSTOMER, action: schema_1.PermissionAction.READ },
                                { module: schema_1.ModuleType.CUSTOMER, action: schema_1.PermissionAction.UPDATE },
                                { module: schema_1.ModuleType.DRIVER, action: schema_1.PermissionAction.CREATE },
                                { module: schema_1.ModuleType.DRIVER, action: schema_1.PermissionAction.READ },
                                { module: schema_1.ModuleType.DRIVER, action: schema_1.PermissionAction.UPDATE },
                                { module: schema_1.ModuleType.REPORT, action: schema_1.PermissionAction.READ }
                            ]
                        },
                        // Staff permissions
                        {
                            roleName: 'Staff',
                            permissions: [
                                { module: schema_1.ModuleType.GATE_PASS, action: schema_1.PermissionAction.CREATE },
                                { module: schema_1.ModuleType.GATE_PASS, action: schema_1.PermissionAction.READ },
                                { module: schema_1.ModuleType.GATE_PASS, action: schema_1.PermissionAction.UPDATE },
                                { module: schema_1.ModuleType.CUSTOMER, action: schema_1.PermissionAction.READ },
                                { module: schema_1.ModuleType.DRIVER, action: schema_1.PermissionAction.READ }
                            ]
                        },
                        // Security permissions
                        {
                            roleName: 'Security',
                            permissions: [
                                { module: schema_1.ModuleType.GATE_PASS, action: schema_1.PermissionAction.READ },
                                { module: schema_1.ModuleType.GATE_PASS, action: schema_1.PermissionAction.VERIFY }
                            ]
                        },
                        // Viewer permissions
                        {
                            roleName: 'Viewer',
                            permissions: [
                                { module: schema_1.ModuleType.GATE_PASS, action: schema_1.PermissionAction.READ },
                                { module: schema_1.ModuleType.CUSTOMER, action: schema_1.PermissionAction.READ },
                                { module: schema_1.ModuleType.DRIVER, action: schema_1.PermissionAction.READ }
                            ]
                        }
                    ];
                    _a = 0, permissionDefinitions_1 = permissionDefinitions;
                    _d.label = 8;
                case 8:
                    if (!(_a < permissionDefinitions_1.length)) return [3 /*break*/, 14];
                    permDef = permissionDefinitions_1[_a];
                    roleId = roleMap.get(permDef.roleName);
                    if (!roleId) {
                        console.error("Role ".concat(permDef.roleName, " not found"));
                        return [3 /*break*/, 13];
                    }
                    return [4 /*yield*/, db_1.db.select().from(schema_1.permissions).where((0, drizzle_orm_1.eq)(schema_1.permissions.roleId, roleId))];
                case 9:
                    existingPermissions = _d.sent();
                    _loop_1 = function (perm) {
                        var permExists;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0:
                                    permExists = existingPermissions.some(function (existingPerm) {
                                        return existingPerm.module === perm.module &&
                                            existingPerm.action === perm.action;
                                    });
                                    if (!!permExists) return [3 /*break*/, 2];
                                    console.log("Creating permission: ".concat(perm.module, ".").concat(perm.action, " for role ").concat(permDef.roleName));
                                    // Make sure module and action are valid
                                    if (!(perm.module in schema_1.ModuleType)) {
                                        console.warn("Warning: Module ".concat(perm.module, " is not defined in ModuleType"));
                                    }
                                    if (!(perm.action in schema_1.PermissionAction)) {
                                        console.warn("Warning: Action ".concat(perm.action, " is not defined in PermissionAction"));
                                    }
                                    return [4 /*yield*/, db_1.db.insert(schema_1.permissions).values({
                                            roleId: roleId,
                                            module: perm.module,
                                            action: perm.action
                                        })];
                                case 1:
                                    _e.sent();
                                    return [3 /*break*/, 3];
                                case 2:
                                    console.log("Permission ".concat(perm.module, ".").concat(perm.action, " already exists for role ").concat(permDef.roleName));
                                    _e.label = 3;
                                case 3: return [2 /*return*/];
                            }
                        });
                    };
                    _b = 0, _c = permDef.permissions;
                    _d.label = 10;
                case 10:
                    if (!(_b < _c.length)) return [3 /*break*/, 13];
                    perm = _c[_b];
                    return [5 /*yield**/, _loop_1(perm)];
                case 11:
                    _d.sent();
                    _d.label = 12;
                case 12:
                    _b++;
                    return [3 /*break*/, 10];
                case 13:
                    _a++;
                    return [3 /*break*/, 8];
                case 14:
                    console.log('Roles and permissions migration completed successfully');
                    return [3 /*break*/, 16];
                case 15:
                    error_1 = _d.sent();
                    console.error('Error during migration:', error_1);
                    throw error_1;
                case 16: return [2 /*return*/];
            }
        });
    });
}
migrateRolesAndPermissions()
    .then(function () {
    console.log('Migration script finished');
    process.exit(0);
})
    .catch(function (error) {
    console.error('Migration failed:', error);
    process.exit(1);
});
