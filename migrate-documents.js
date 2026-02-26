"use strict";
/**
 * Migration script to create documents table and add document permissions
 */
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
function migrateDocumentsTable() {
    return __awaiter(this, void 0, void 0, function () {
        var adminRole, documentPermissions, managerRole, documentPermissions, staffRole, documentPermissions, securityRole, documentPermissions, viewerRole, documentPermissions, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 17, , 18]);
                    console.log("Creating documents table...");
                    // Create the documents table
                    return [4 /*yield*/, db_1.db.execute("\n      CREATE TABLE IF NOT EXISTS documents (\n        id SERIAL PRIMARY KEY,\n        file_name TEXT NOT NULL,\n        file_type TEXT NOT NULL,\n        file_size INTEGER NOT NULL,\n        file_data TEXT NOT NULL,\n        entity_type TEXT NOT NULL,\n        entity_id INTEGER NOT NULL,\n        description TEXT,\n        uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,\n        uploaded_by_email TEXT NOT NULL,\n        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL\n      );\n    ")];
                case 1:
                    // Create the documents table
                    _a.sent();
                    console.log("Documents table created successfully.");
                    return [4 /*yield*/, db_1.db.select().from(schema_1.roles).where((0, drizzle_orm_1.eq)(schema_1.roles.name, "Admin"))];
                case 2:
                    adminRole = (_a.sent())[0];
                    if (!adminRole) return [3 /*break*/, 4];
                    console.log("Adding document permissions for Admin role...");
                    documentPermissions = [
                        { roleId: adminRole.id, module: "document", action: "create" },
                        { roleId: adminRole.id, module: "document", action: "read" },
                        { roleId: adminRole.id, module: "document", action: "update" },
                        { roleId: adminRole.id, module: "document", action: "delete" },
                    ];
                    // Insert document permissions
                    return [4 /*yield*/, db_1.db.insert(schema_1.permissions).values(documentPermissions)];
                case 3:
                    // Insert document permissions
                    _a.sent();
                    console.log("Document permissions added for Admin role.");
                    _a.label = 4;
                case 4: return [4 /*yield*/, db_1.db.select().from(schema_1.roles).where((0, drizzle_orm_1.eq)(schema_1.roles.name, "Manager"))];
                case 5:
                    managerRole = (_a.sent())[0];
                    if (!managerRole) return [3 /*break*/, 7];
                    console.log("Adding document permissions for Manager role...");
                    documentPermissions = [
                        { roleId: managerRole.id, module: "document", action: "create" },
                        { roleId: managerRole.id, module: "document", action: "read" },
                        { roleId: managerRole.id, module: "document", action: "update" },
                        { roleId: managerRole.id, module: "document", action: "delete" },
                    ];
                    // Insert document permissions
                    return [4 /*yield*/, db_1.db.insert(schema_1.permissions).values(documentPermissions)];
                case 6:
                    // Insert document permissions
                    _a.sent();
                    console.log("Document permissions added for Manager role.");
                    _a.label = 7;
                case 7: return [4 /*yield*/, db_1.db.select().from(schema_1.roles).where((0, drizzle_orm_1.eq)(schema_1.roles.name, "Staff"))];
                case 8:
                    staffRole = (_a.sent())[0];
                    if (!staffRole) return [3 /*break*/, 10];
                    console.log("Adding document read permissions for Staff role...");
                    documentPermissions = [
                        { roleId: staffRole.id, module: "document", action: "read" },
                    ];
                    // Insert document permissions
                    return [4 /*yield*/, db_1.db.insert(schema_1.permissions).values(documentPermissions)];
                case 9:
                    // Insert document permissions
                    _a.sent();
                    console.log("Document permissions added for Staff role.");
                    _a.label = 10;
                case 10: return [4 /*yield*/, db_1.db.select().from(schema_1.roles).where((0, drizzle_orm_1.eq)(schema_1.roles.name, "Security"))];
                case 11:
                    securityRole = (_a.sent())[0];
                    if (!securityRole) return [3 /*break*/, 13];
                    console.log("Adding document read permissions for Security role...");
                    documentPermissions = [
                        { roleId: securityRole.id, module: "document", action: "read" },
                    ];
                    // Insert document permissions
                    return [4 /*yield*/, db_1.db.insert(schema_1.permissions).values(documentPermissions)];
                case 12:
                    // Insert document permissions
                    _a.sent();
                    console.log("Document permissions added for Security role.");
                    _a.label = 13;
                case 13: return [4 /*yield*/, db_1.db.select().from(schema_1.roles).where((0, drizzle_orm_1.eq)(schema_1.roles.name, "Viewer"))];
                case 14:
                    viewerRole = (_a.sent())[0];
                    if (!viewerRole) return [3 /*break*/, 16];
                    console.log("Adding document read permissions for Viewer role...");
                    documentPermissions = [
                        { roleId: viewerRole.id, module: "document", action: "read" },
                    ];
                    // Insert document permissions
                    return [4 /*yield*/, db_1.db.insert(schema_1.permissions).values(documentPermissions)];
                case 15:
                    // Insert document permissions
                    _a.sent();
                    console.log("Document permissions added for Viewer role.");
                    _a.label = 16;
                case 16:
                    console.log("Documents migration completed successfully.");
                    return [3 /*break*/, 18];
                case 17:
                    error_1 = _a.sent();
                    console.error("Error during documents migration:", error_1);
                    throw error_1;
                case 18: return [2 /*return*/];
            }
        });
    });
}
// Run the migration
migrateDocumentsTable()
    .then(function () { return process.exit(0); })
    .catch(function (error) {
    console.error("Migration failed:", error);
    process.exit(1);
});
