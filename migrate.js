"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
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
Object.defineProperty(exports, "__esModule", { value: true });
var db_1 = require("./server/db");
var schema_1 = require("./shared/schema");
var drizzle_orm_1 = require("drizzle-orm");
function migrate() {
    return __awaiter(this, void 0, void 0, function () {
        var adminRoleExists, adminRole, modules, actions, _i, modules_1, module_1, _a, actions_1, action, managerRole, managerPermissions, _b, managerPermissions_1, perm, staffRole, staffPermissions, _c, staffPermissions_1, perm, error_1;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 26, 27, 28]);
                    console.log('Starting migration...');
                    // Create roles and permissions tables
                    return [4 /*yield*/, db_1.db.execute((0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      CREATE TABLE IF NOT EXISTS roles (\n        id SERIAL PRIMARY KEY,\n        name TEXT NOT NULL UNIQUE,\n        description TEXT,\n        is_default BOOLEAN DEFAULT false,\n        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,\n        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL\n      );\n    "], ["\n      CREATE TABLE IF NOT EXISTS roles (\n        id SERIAL PRIMARY KEY,\n        name TEXT NOT NULL UNIQUE,\n        description TEXT,\n        is_default BOOLEAN DEFAULT false,\n        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,\n        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL\n      );\n    "]))))];
                case 1:
                    // Create roles and permissions tables
                    _d.sent();
                    console.log('Roles table created.');
                    return [4 /*yield*/, db_1.db.execute((0, drizzle_orm_1.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      CREATE TABLE IF NOT EXISTS permissions (\n        id SERIAL PRIMARY KEY,\n        role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,\n        module TEXT NOT NULL,\n        action TEXT NOT NULL,\n        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,\n        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL\n      );\n    "], ["\n      CREATE TABLE IF NOT EXISTS permissions (\n        id SERIAL PRIMARY KEY,\n        role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,\n        module TEXT NOT NULL,\n        action TEXT NOT NULL,\n        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,\n        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL\n      );\n    "]))))];
                case 2:
                    _d.sent();
                    console.log('Permissions table created.');
                    // Add new columns to users table
                    return [4 /*yield*/, db_1.db.execute((0, drizzle_orm_1.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      ALTER TABLE users \n      ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id),\n      ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true,\n      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL;\n    "], ["\n      ALTER TABLE users \n      ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id),\n      ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true,\n      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL;\n    "]))))];
                case 3:
                    // Add new columns to users table
                    _d.sent();
                    console.log('User table updated.');
                    return [4 /*yield*/, db_1.db.select().from(schema_1.roles).where((0, drizzle_orm_1.sql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["name = 'Admin'"], ["name = 'Admin'"]))))];
                case 4:
                    adminRoleExists = _d.sent();
                    if (!(adminRoleExists.length === 0)) return [3 /*break*/, 24];
                    return [4 /*yield*/, db_1.db.insert(schema_1.roles).values({
                            name: 'Admin',
                            description: 'Full system access',
                            isDefault: false,
                        }).returning()];
                case 5:
                    adminRole = (_d.sent())[0];
                    console.log('Admin role created.');
                    modules = Object.values(schema_1.ModuleType);
                    actions = Object.values(schema_1.PermissionAction);
                    _i = 0, modules_1 = modules;
                    _d.label = 6;
                case 6:
                    if (!(_i < modules_1.length)) return [3 /*break*/, 11];
                    module_1 = modules_1[_i];
                    _a = 0, actions_1 = actions;
                    _d.label = 7;
                case 7:
                    if (!(_a < actions_1.length)) return [3 /*break*/, 10];
                    action = actions_1[_a];
                    return [4 /*yield*/, db_1.db.insert(schema_1.permissions).values({
                            roleId: adminRole.id,
                            module: module_1,
                            action: action,
                        })];
                case 8:
                    _d.sent();
                    _d.label = 9;
                case 9:
                    _a++;
                    return [3 /*break*/, 7];
                case 10:
                    _i++;
                    return [3 /*break*/, 6];
                case 11:
                    console.log('Admin permissions created.');
                    return [4 /*yield*/, db_1.db.insert(schema_1.roles).values({
                            name: 'Manager',
                            description: 'Can manage most features but with limited admin access',
                            isDefault: false,
                        }).returning()];
                case 12:
                    managerRole = (_d.sent())[0];
                    console.log('Manager role created.');
                    managerPermissions = [
                        // Dashboard - full access
                        { module: schema_1.ModuleType.DASHBOARD, action: schema_1.PermissionAction.VIEW },
                        // Gate Passes - full access
                        { module: schema_1.ModuleType.GATE_PASSES, action: schema_1.PermissionAction.VIEW },
                        { module: schema_1.ModuleType.GATE_PASSES, action: schema_1.PermissionAction.CREATE },
                        { module: schema_1.ModuleType.GATE_PASSES, action: schema_1.PermissionAction.EDIT },
                        { module: schema_1.ModuleType.GATE_PASSES, action: schema_1.PermissionAction.DELETE },
                        // Customers - full access
                        { module: schema_1.ModuleType.CUSTOMERS, action: schema_1.PermissionAction.VIEW },
                        { module: schema_1.ModuleType.CUSTOMERS, action: schema_1.PermissionAction.CREATE },
                        { module: schema_1.ModuleType.CUSTOMERS, action: schema_1.PermissionAction.EDIT },
                        { module: schema_1.ModuleType.CUSTOMERS, action: schema_1.PermissionAction.DELETE },
                        // Drivers - full access
                        { module: schema_1.ModuleType.DRIVERS, action: schema_1.PermissionAction.VIEW },
                        { module: schema_1.ModuleType.DRIVERS, action: schema_1.PermissionAction.CREATE },
                        { module: schema_1.ModuleType.DRIVERS, action: schema_1.PermissionAction.EDIT },
                        { module: schema_1.ModuleType.DRIVERS, action: schema_1.PermissionAction.DELETE },
                        // Reports - view only
                        { module: schema_1.ModuleType.REPORTS, action: schema_1.PermissionAction.VIEW },
                        // Users - no access
                        // Settings - no access
                    ];
                    _b = 0, managerPermissions_1 = managerPermissions;
                    _d.label = 13;
                case 13:
                    if (!(_b < managerPermissions_1.length)) return [3 /*break*/, 16];
                    perm = managerPermissions_1[_b];
                    return [4 /*yield*/, db_1.db.insert(schema_1.permissions).values({
                            roleId: managerRole.id,
                            module: perm.module,
                            action: perm.action,
                        })];
                case 14:
                    _d.sent();
                    _d.label = 15;
                case 15:
                    _b++;
                    return [3 /*break*/, 13];
                case 16:
                    console.log('Manager permissions created.');
                    return [4 /*yield*/, db_1.db.insert(schema_1.roles).values({
                            name: 'Staff',
                            description: 'Basic user with limited access',
                            isDefault: true,
                        }).returning()];
                case 17:
                    staffRole = (_d.sent())[0];
                    console.log('Staff role created.');
                    staffPermissions = [
                        // Dashboard - view only
                        { module: schema_1.ModuleType.DASHBOARD, action: schema_1.PermissionAction.VIEW },
                        // Gate Passes - create and view only
                        { module: schema_1.ModuleType.GATE_PASSES, action: schema_1.PermissionAction.VIEW },
                        { module: schema_1.ModuleType.GATE_PASSES, action: schema_1.PermissionAction.CREATE },
                        // Customers - view only
                        { module: schema_1.ModuleType.CUSTOMERS, action: schema_1.PermissionAction.VIEW },
                        // Drivers - view only
                        { module: schema_1.ModuleType.DRIVERS, action: schema_1.PermissionAction.VIEW },
                        // No access to other modules
                    ];
                    _c = 0, staffPermissions_1 = staffPermissions;
                    _d.label = 18;
                case 18:
                    if (!(_c < staffPermissions_1.length)) return [3 /*break*/, 21];
                    perm = staffPermissions_1[_c];
                    return [4 /*yield*/, db_1.db.insert(schema_1.permissions).values({
                            roleId: staffRole.id,
                            module: perm.module,
                            action: perm.action,
                        })];
                case 19:
                    _d.sent();
                    _d.label = 20;
                case 20:
                    _c++;
                    return [3 /*break*/, 18];
                case 21:
                    console.log('Staff permissions created.');
                    // Update existing users to have admin role
                    return [4 /*yield*/, db_1.db.execute((0, drizzle_orm_1.sql)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n        UPDATE users SET role_id = ", " WHERE role = 'admin'\n      "], ["\n        UPDATE users SET role_id = ", " WHERE role = 'admin'\n      "])), adminRole.id))];
                case 22:
                    // Update existing users to have admin role
                    _d.sent();
                    // Update existing users to have staff role
                    return [4 /*yield*/, db_1.db.execute((0, drizzle_orm_1.sql)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n        UPDATE users SET role_id = ", " WHERE role = 'user'\n      "], ["\n        UPDATE users SET role_id = ", " WHERE role = 'user'\n      "])), staffRole.id))];
                case 23:
                    // Update existing users to have staff role
                    _d.sent();
                    console.log('Existing users updated with role IDs.');
                    return [3 /*break*/, 25];
                case 24:
                    console.log('Admin role already exists, skipping role creation.');
                    _d.label = 25;
                case 25:
                    console.log('Migration completed successfully!');
                    return [3 /*break*/, 28];
                case 26:
                    error_1 = _d.sent();
                    console.error('Migration failed:', error_1);
                    return [3 /*break*/, 28];
                case 27:
                    process.exit(0);
                    return [7 /*endfinally*/];
                case 28: return [2 /*return*/];
            }
        });
    });
}
migrate();
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
