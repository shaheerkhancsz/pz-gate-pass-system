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
var db_1 = require("../server/db");
var schema_1 = require("../shared/schema");
var drizzle_orm_1 = require("drizzle-orm");
/**
 * This script assigns activity log permissions to appropriate roles
 * It should be run after setting up basic roles and permissions
 */
function assignActivityLogPermissions() {
    return __awaiter(this, void 0, void 0, function () {
        var adminRole, managerRole, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Starting activity log permissions assignment...");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 8, , 9]);
                    return [4 /*yield*/, db_1.db.select().from(schema_1.roles).where((0, drizzle_orm_1.eq)(schema_1.roles.name, "Admin"))];
                case 2:
                    adminRole = (_a.sent())[0];
                    return [4 /*yield*/, db_1.db.select().from(schema_1.roles).where((0, drizzle_orm_1.eq)(schema_1.roles.name, "Manager"))];
                case 3:
                    managerRole = (_a.sent())[0];
                    if (!adminRole) {
                        throw new Error("Admin role not found. Please run the initial migration script first.");
                    }
                    // 2. Assign activityLog permissions to Admin role (all permissions)
                    console.log("Assigning activity log permissions to Admin role (ID: ".concat(adminRole.id, ")..."));
                    return [4 /*yield*/, db_1.db.insert(schema_1.permissions).values([
                            {
                                roleId: adminRole.id,
                                module: "activityLog",
                                action: "read",
                            }
                        ]).onConflictDoNothing()];
                case 4:
                    _a.sent();
                    if (!managerRole) return [3 /*break*/, 6];
                    console.log("Assigning activity log permissions to Manager role (ID: ".concat(managerRole.id, ")..."));
                    return [4 /*yield*/, db_1.db.insert(schema_1.permissions).values([
                            {
                                roleId: managerRole.id,
                                module: "activityLog",
                                action: "read",
                            }
                        ]).onConflictDoNothing()];
                case 5:
                    _a.sent();
                    return [3 /*break*/, 7];
                case 6:
                    console.log("Manager role not found, skipping manager permissions.");
                    _a.label = 7;
                case 7:
                    console.log("Activity log permissions assigned successfully!");
                    return [3 /*break*/, 9];
                case 8:
                    error_1 = _a.sent();
                    console.error("Error assigning activity log permissions:", error_1);
                    throw error_1;
                case 9: return [2 /*return*/];
            }
        });
    });
}
// Execute the script
assignActivityLogPermissions()
    .then(function () {
    console.log("Script completed successfully.");
    process.exit(0);
})
    .catch(function (error) {
    console.error("Script failed:", error);
    process.exit(1);
});
