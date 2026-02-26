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
exports.createTestUsers = createTestUsers;
/**
 * Script to create test users for the application
 */
var db_1 = require("../server/db");
var schema_1 = require("../shared/schema");
var bcrypt = require("bcrypt");
function createTestUsers() {
    return __awaiter(this, void 0, void 0, function () {
        var existingUsers, testUsers, _a, _i, testUsers_1, user, createdUser, error_1;
        var _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    console.log("Creating test users...");
                    return [4 /*yield*/, db_1.db.select().from(schema_1.users)];
                case 1:
                    existingUsers = _g.sent();
                    if (existingUsers.length > 0) {
                        console.log("".concat(existingUsers.length, " users already exist. Skipping test user creation."));
                        return [2 /*return*/];
                    }
                    _b = {
                        fullName: "Admin User",
                        email: "admin@parazelsus.pk"
                    };
                    return [4 /*yield*/, bcrypt.hash("admin123", 10)];
                case 2:
                    _a = [
                        (_b.password = _g.sent(),
                            _b.department = "Administration",
                            _b.roleId = 1,
                            _b.phoneNumber = "03001234567",
                            _b.cnic = "42101-1234567-1",
                            _b.active = true,
                            _b)
                    ];
                    _c = {
                        fullName: "Manager User",
                        email: "manager@parazelsus.pk"
                    };
                    return [4 /*yield*/, bcrypt.hash("manager123", 10)];
                case 3:
                    _a = _a.concat([
                        (_c.password = _g.sent(),
                            _c.department = "Operations",
                            _c.roleId = 2,
                            _c.phoneNumber = "03002345678",
                            _c.cnic = "42101-2345678-2",
                            _c.active = true,
                            _c)
                    ]);
                    _d = {
                        fullName: "Staff User",
                        email: "staff@parazelsus.pk"
                    };
                    return [4 /*yield*/, bcrypt.hash("staff123", 10)];
                case 4:
                    _a = _a.concat([
                        (_d.password = _g.sent(),
                            _d.department = "Warehouse",
                            _d.roleId = 3,
                            _d.phoneNumber = "03003456789",
                            _d.cnic = "42101-3456789-3",
                            _d.active = true,
                            _d)
                    ]);
                    _e = {
                        fullName: "Security User",
                        email: "security@parazelsus.pk"
                    };
                    return [4 /*yield*/, bcrypt.hash("security123", 10)];
                case 5:
                    _a = _a.concat([
                        (_e.password = _g.sent(),
                            _e.department = "Security",
                            _e.roleId = 4,
                            _e.phoneNumber = "03004567890",
                            _e.cnic = "42101-4567890-4",
                            _e.active = true,
                            _e)
                    ]);
                    _f = {
                        fullName: "Viewer User",
                        email: "viewer@parazelsus.pk"
                    };
                    return [4 /*yield*/, bcrypt.hash("viewer123", 10)];
                case 6:
                    testUsers = _a.concat([
                        (_f.password = _g.sent(),
                            _f.department = "Finance",
                            _f.roleId = 5,
                            _f.phoneNumber = "03005678901",
                            _f.cnic = "42101-5678901-5",
                            _f.active = true,
                            _f)
                    ]);
                    _i = 0, testUsers_1 = testUsers;
                    _g.label = 7;
                case 7:
                    if (!(_i < testUsers_1.length)) return [3 /*break*/, 12];
                    user = testUsers_1[_i];
                    _g.label = 8;
                case 8:
                    _g.trys.push([8, 10, , 11]);
                    return [4 /*yield*/, db_1.db.insert(schema_1.users).values(user).returning()];
                case 9:
                    createdUser = (_g.sent())[0];
                    console.log("Created user: ".concat(createdUser.fullName, " (").concat(createdUser.email, ")"));
                    return [3 /*break*/, 11];
                case 10:
                    error_1 = _g.sent();
                    console.error("Error creating user ".concat(user.email, ":"), error_1);
                    return [3 /*break*/, 11];
                case 11:
                    _i++;
                    return [3 /*break*/, 7];
                case 12:
                    console.log("Test users creation completed");
                    return [2 /*return*/];
            }
        });
    });
}
// Execute if this file is run directly
var isMainModule = import.meta.url === "file://".concat(process.argv[1]);
if (isMainModule) {
    createTestUsers()
        .then(function () {
        console.log("Script execution completed.");
        process.exit(0);
    })
        .catch(function (error) {
        console.error("Script execution failed:", error);
        process.exit(1);
    });
}
