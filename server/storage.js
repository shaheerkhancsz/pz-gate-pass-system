"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = exports.DatabaseStorage = exports.MemStorage = void 0;
var schema_1 = require("@shared/schema");
var db_1 = require("./db");
var drizzle_orm_1 = require("drizzle-orm");
var MemStorage = /** @class */ (function () {
    function MemStorage() {
        this.users = new Map();
        this.roles = new Map();
        this.permissions = new Map();
        this.gatePasses = new Map();
        this.items = new Map();
        this.customers = new Map();
        this.drivers = new Map();
        this.documents = new Map();
        this.companySettings = new Map();
        this.activityLogs = [];
        this.notifications = new Map();
        this.currentId = 1;
        // Add default admin user
        this.createUser({
            fullName: "Admin User",
            email: "admin@parazelsus.pk",
            password: "adminpass", // In a real app, this would be hashed
            department: "HO",
            roleId: 1, // Admin role
            phoneNumber: "0300-1234567",
            cnic: "42201-1234567-8",
            active: true
        });
        // Add a default user
        this.createUser({
            fullName: "John Doe",
            email: "john@parazelsus.pk",
            password: "password", // In a real app, this would be hashed
            department: "Warehouse",
            roleId: 3, // Staff role
            phoneNumber: "0300-7654321",
            cnic: "42201-7654321-8",
            active: true
        });
    }
    MemStorage.prototype.getStatistics = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Dummy implementation for MemStorage (which seems to mirror DatabaseStorage now)
                return [2 /*return*/, {
                        totalPasses: 0,
                        monthlyPasses: 0,
                        weeklyPasses: 0,
                        pendingApprovals: 0,
                        statusDistribution: [],
                        departmentDistribution: [],
                        monthlyTrend: [],
                        dailyTrend: []
                    }];
            });
        });
    };
    // User operations
    MemStorage.prototype.getUser = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id))];
                    case 1:
                        user = (_a.sent())[0];
                        return [2 /*return*/, user];
                }
            });
        });
    };
    MemStorage.prototype.getUserByEmail = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            var user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.users)
                            .where((0, drizzle_orm_1.ilike)(schema_1.users.email, email))];
                    case 1:
                        user = (_a.sent())[0];
                        return [2 /*return*/, user];
                }
            });
        });
    };
    MemStorage.prototype.createUser = function (insertUser) {
        return __awaiter(this, void 0, void 0, function () {
            var result, id;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.users)
                            .values(insertUser)];
                    case 1:
                        result = (_a.sent())[0];
                        id = result.insertId;
                        return [2 /*return*/, this.getUser(id)];
                }
            });
        });
    };
    MemStorage.prototype.getUsers = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, db_1.db.select().from(schema_1.users)];
            });
        });
    };
    MemStorage.prototype.updateUser = function (id, userData) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.users)
                            .set(__assign(__assign({}, userData), { updatedAt: new Date() }))
                            .where((0, drizzle_orm_1.eq)(schema_1.users.id, id))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, this.getUser(id)];
                }
            });
        });
    };
    MemStorage.prototype.deleteUser = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .delete(schema_1.users)
                            .where((0, drizzle_orm_1.eq)(schema_1.users.id, id))];
                    case 1:
                        result = (_a.sent())[0];
                        return [2 /*return*/, result.affectedRows > 0];
                }
            });
        });
    };
    // Gate Pass operations
    MemStorage.prototype.getGatePass = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var gatePass;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.gatePasses).where((0, drizzle_orm_1.eq)(schema_1.gatePasses.id, id))];
                    case 1:
                        gatePass = (_a.sent())[0];
                        return [2 /*return*/, gatePass];
                }
            });
        });
    };
    MemStorage.prototype.getGatePassByNumber = function (gatePassNumber) {
        return __awaiter(this, void 0, void 0, function () {
            var gatePass;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.gatePasses)
                            .where((0, drizzle_orm_1.eq)(schema_1.gatePasses.gatePassNumber, gatePassNumber))];
                    case 1:
                        gatePass = (_a.sent())[0];
                        return [2 /*return*/, gatePass];
                }
            });
        });
    };
    MemStorage.prototype.createGatePass = function (gatePass) {
        return __awaiter(this, void 0, void 0, function () {
            var gatePassNumber, result, id;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.generateGatePassNumber()];
                    case 1:
                        gatePassNumber = _a.sent();
                        return [4 /*yield*/, db_1.db
                                .insert(schema_1.gatePasses)
                                .values(__assign(__assign({}, gatePass), { gatePassNumber: gatePassNumber }))];
                    case 2:
                        result = (_a.sent())[0];
                        id = result.insertId;
                        return [2 /*return*/, this.getGatePass(id)];
                }
            });
        });
    };
    MemStorage.prototype.updateGatePass = function (id, gatePass) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.gatePasses)
                            .set(gatePass)
                            .where((0, drizzle_orm_1.eq)(schema_1.gatePasses.id, id))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, this.getGatePass(id)];
                }
            });
        });
    };
    MemStorage.prototype.deleteGatePass = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .delete(schema_1.gatePasses)
                            .where((0, drizzle_orm_1.eq)(schema_1.gatePasses.id, id))];
                    case 1:
                        result = (_a.sent())[0];
                        return [2 /*return*/, result.affectedRows > 0];
                }
            });
        });
    };
    MemStorage.prototype.getGatePasses = function (filters) {
        return __awaiter(this, void 0, void 0, function () {
            var query, conditions;
            return __generator(this, function (_a) {
                query = db_1.db.select().from(schema_1.gatePasses);
                if (filters) {
                    conditions = [];
                    if (filters.customerName) {
                        conditions.push((0, drizzle_orm_1.ilike)(schema_1.gatePasses.customerName, "%".concat(filters.customerName, "%")));
                    }
                    if (filters.department) {
                        conditions.push((0, drizzle_orm_1.eq)(schema_1.gatePasses.department, filters.department));
                    }
                    if (filters.dateFrom) {
                        conditions.push((0, drizzle_orm_1.gte)(schema_1.gatePasses.createdAt, filters.dateFrom));
                    }
                    if (filters.dateTo) {
                        conditions.push((0, drizzle_orm_1.lte)(schema_1.gatePasses.createdAt, filters.dateTo));
                    }
                    if (filters.gatePassNumber) {
                        conditions.push((0, drizzle_orm_1.eq)(schema_1.gatePasses.gatePassNumber, filters.gatePassNumber));
                    }
                    if (filters.createdById) {
                        conditions.push((0, drizzle_orm_1.eq)(schema_1.gatePasses.createdById, filters.createdById));
                    }
                    if (filters.status) {
                        conditions.push((0, drizzle_orm_1.eq)(schema_1.gatePasses.status, filters.status));
                    }
                    if (conditions.length > 0) {
                        query = query.where(drizzle_orm_1.and.apply(void 0, conditions));
                    }
                }
                query = query.orderBy((0, drizzle_orm_1.desc)(schema_1.gatePasses.createdAt));
                return [2 /*return*/, query];
            });
        });
    };
    // Item operations
    MemStorage.prototype.getItemsByGatePassId = function (gatePassId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, db_1.db
                        .select()
                        .from(schema_1.items)
                        .where((0, drizzle_orm_1.eq)(schema_1.items.gatePassId, gatePassId))];
            });
        });
    };
    MemStorage.prototype.createItem = function (item) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.items)
                            .values(item)];
                    case 1:
                        result = (_a.sent())[0];
                        return [2 /*return*/, __assign(__assign({}, item), { id: result.insertId })];
                }
            });
        });
    };
    MemStorage.prototype.deleteItemsByGatePassId = function (gatePassId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .delete(schema_1.items)
                            .where((0, drizzle_orm_1.eq)(schema_1.items.gatePassId, gatePassId))];
                    case 1:
                        result = (_a.sent())[0];
                        return [2 /*return*/, result.affectedRows > 0];
                }
            });
        });
    };
    // Customer operations
    MemStorage.prototype.getCustomer = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var customer;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.customers).where((0, drizzle_orm_1.eq)(schema_1.customers.id, id))];
                    case 1:
                        customer = (_a.sent())[0];
                        return [2 /*return*/, customer];
                }
            });
        });
    };
    MemStorage.prototype.getCustomers = function (searchTerm) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (searchTerm) {
                    return [2 /*return*/, db_1.db
                            .select()
                            .from(schema_1.customers)
                            .where((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.customers.name, "%".concat(searchTerm, "%")), (0, drizzle_orm_1.ilike)(schema_1.customers.email || '', "%".concat(searchTerm, "%")), (0, drizzle_orm_1.ilike)(schema_1.customers.phone || '', "%".concat(searchTerm, "%"))))];
                }
                return [2 /*return*/, db_1.db.select().from(schema_1.customers)];
            });
        });
    };
    MemStorage.prototype.createCustomer = function (customer) {
        return __awaiter(this, void 0, void 0, function () {
            var result, id;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.customers)
                            .values(customer)];
                    case 1:
                        result = (_a.sent())[0];
                        id = result.insertId;
                        return [2 /*return*/, this.getCustomer(id)];
                }
            });
        });
    };
    MemStorage.prototype.updateCustomer = function (id, customer) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.customers)
                            .set(customer)
                            .where((0, drizzle_orm_1.eq)(schema_1.customers.id, id))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, this.getCustomer(id)];
                }
            });
        });
    };
    // Driver operations
    MemStorage.prototype.getDriver = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var driver;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.drivers).where((0, drizzle_orm_1.eq)(schema_1.drivers.id, id))];
                    case 1:
                        driver = (_a.sent())[0];
                        return [2 /*return*/, driver];
                }
            });
        });
    };
    MemStorage.prototype.getDrivers = function (searchTerm) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (searchTerm) {
                    return [2 /*return*/, db_1.db
                            .select()
                            .from(schema_1.drivers)
                            .where((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.drivers.name, "%".concat(searchTerm, "%")), (0, drizzle_orm_1.ilike)(schema_1.drivers.cnic, "%".concat(searchTerm, "%")), (0, drizzle_orm_1.ilike)(schema_1.drivers.phone || '', "%".concat(searchTerm, "%"))))];
                }
                return [2 /*return*/, db_1.db.select().from(schema_1.drivers)];
            });
        });
    };
    MemStorage.prototype.getDriverByCnic = function (cnic) {
        return __awaiter(this, void 0, void 0, function () {
            var driver;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.drivers)
                            .where((0, drizzle_orm_1.eq)(schema_1.drivers.cnic, cnic))];
                    case 1:
                        driver = (_a.sent())[0];
                        return [2 /*return*/, driver];
                }
            });
        });
    };
    MemStorage.prototype.createDriver = function (driver) {
        return __awaiter(this, void 0, void 0, function () {
            var result, id;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.drivers)
                            .values(driver)];
                    case 1:
                        result = (_a.sent())[0];
                        id = result.insertId;
                        return [2 /*return*/, this.getDriver(id)];
                }
            });
        });
    };
    MemStorage.prototype.updateDriver = function (id, driver) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.drivers)
                            .set(driver)
                            .where((0, drizzle_orm_1.eq)(schema_1.drivers.id, id))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, this.getDriver(id)];
                }
            });
        });
    };
    // User Activity Logging
    MemStorage.prototype.logUserActivity = function (activityLog) {
        return __awaiter(this, void 0, void 0, function () {
            var newLog;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.userActivityLogs)
                            .values(activityLog)];
                    case 1:
                        newLog = (_a.sent())[0];
                        // For MemStorage simulation via DB, we can't easily return full object without re-selecting.
                        // Given usage, returning input cast as Log might be enough or select it.
                        // Since this method is likely unused (DatabaseStorage is used), simplified return is okay.
                        return [2 /*return*/, __assign(__assign({}, activityLog), { id: newLog.insertId, timestamp: new Date() })];
                }
            });
        });
    };
    MemStorage.prototype.getUserActivityLogs = function (filters) {
        return __awaiter(this, void 0, void 0, function () {
            var query, conditions;
            return __generator(this, function (_a) {
                query = db_1.db.select().from(schema_1.userActivityLogs);
                if (filters) {
                    conditions = [];
                    if (filters.userId) {
                        conditions.push((0, drizzle_orm_1.eq)(schema_1.userActivityLogs.userId, filters.userId));
                    }
                    if (filters.userEmail) {
                        conditions.push((0, drizzle_orm_1.ilike)(schema_1.userActivityLogs.userEmail, "%".concat(filters.userEmail, "%")));
                    }
                    if (filters.actionType) {
                        conditions.push((0, drizzle_orm_1.eq)(schema_1.userActivityLogs.actionType, filters.actionType));
                    }
                    if (filters.entityType) {
                        conditions.push((0, drizzle_orm_1.eq)(schema_1.userActivityLogs.entityType, filters.entityType));
                    }
                    if (filters.dateFrom) {
                        conditions.push((0, drizzle_orm_1.gte)(schema_1.userActivityLogs.timestamp, filters.dateFrom));
                    }
                    if (filters.dateTo) {
                        conditions.push((0, drizzle_orm_1.lte)(schema_1.userActivityLogs.timestamp, filters.dateTo));
                    }
                    if (conditions.length > 0) {
                        query = query.where(drizzle_orm_1.and.apply(void 0, conditions));
                    }
                }
                return [2 /*return*/, query];
            });
        });
    };
    // Document operations
    MemStorage.prototype.getDocument = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var document;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.documents).where((0, drizzle_orm_1.eq)(schema_1.documents.id, id))];
                    case 1:
                        document = (_a.sent())[0];
                        return [2 /*return*/, document];
                }
            });
        });
    };
    MemStorage.prototype.getDocumentsByEntity = function (entityType, entityId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, db_1.db
                        .select()
                        .from(schema_1.documents)
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.documents.entityType, entityType), (0, drizzle_orm_1.eq)(schema_1.documents.entityId, entityId)))];
            });
        });
    };
    MemStorage.prototype.createDocument = function (document) {
        return __awaiter(this, void 0, void 0, function () {
            var result, id;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.documents)
                            .values(document)];
                    case 1:
                        result = (_a.sent())[0];
                        id = result.insertId;
                        return [2 /*return*/, this.getDocument(id)];
                }
            });
        });
    };
    MemStorage.prototype.updateDocument = function (id, documentData) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.update(schema_1.documents).set(documentData).where((0, drizzle_orm_1.eq)(schema_1.documents.id, id))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, this.getDocument(id)];
                }
            });
        });
    };
    MemStorage.prototype.deleteDocument = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.delete(schema_1.documents).where((0, drizzle_orm_1.eq)(schema_1.documents.id, id))];
                    case 1:
                        result = (_a.sent())[0];
                        return [2 /*return*/, result.affectedRows > 0];
                }
            });
        });
    };
    // Utility methods
    MemStorage.prototype.generateGatePassNumber = function () {
        return __awaiter(this, void 0, void 0, function () {
            var today, year, month, day, countVal, sequence;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        today = new Date();
                        year = today.getFullYear();
                        month = (today.getMonth() + 1).toString().padStart(2, '0');
                        day = today.getDate().toString().padStart(2, '0');
                        return [4 /*yield*/, db_1.db
                                .select({ count: (0, drizzle_orm_1.count)() })
                                .from(schema_1.gatePasses)
                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)(schema_1.gatePasses.createdAt, new Date(year, today.getMonth(), 1)), (0, drizzle_orm_1.lte)(schema_1.gatePasses.createdAt, new Date(year, today.getMonth() + 1, 0))))];
                    case 1:
                        countVal = (_a.sent())[0].count;
                        sequence = (countVal + 1).toString().padStart(4, '0');
                        return [2 /*return*/, "GP".concat(year).concat(month).concat(day).concat(sequence)];
                }
            });
        });
    };
    return MemStorage;
}());
exports.MemStorage = MemStorage;
// Database storage implementation
var DatabaseStorage = /** @class */ (function () {
    function DatabaseStorage() {
    }
    // User Activity Logging
    DatabaseStorage.prototype.logUserActivity = function (activityLog) {
        return __awaiter(this, void 0, void 0, function () {
            var result, id, log;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.userActivityLogs)
                            .values(activityLog)];
                    case 1:
                        result = (_a.sent())[0];
                        id = result.insertId;
                        return [4 /*yield*/, db_1.db.select().from(schema_1.userActivityLogs).where((0, drizzle_orm_1.eq)(schema_1.userActivityLogs.id, id))];
                    case 2:
                        log = (_a.sent())[0];
                        return [2 /*return*/, log];
                }
            });
        });
    };
    DatabaseStorage.prototype.getUserActivityLogs = function (filters) {
        return __awaiter(this, void 0, void 0, function () {
            var query, conditions;
            return __generator(this, function (_a) {
                query = db_1.db.select().from(schema_1.userActivityLogs);
                if (filters) {
                    conditions = [];
                    if (filters.userId) {
                        conditions.push((0, drizzle_orm_1.eq)(schema_1.userActivityLogs.userId, filters.userId));
                    }
                    if (filters.userEmail) {
                        conditions.push((0, drizzle_orm_1.ilike)(schema_1.userActivityLogs.userEmail, "%".concat(filters.userEmail, "%")));
                    }
                    if (filters.actionType) {
                        conditions.push((0, drizzle_orm_1.eq)(schema_1.userActivityLogs.actionType, filters.actionType));
                    }
                    if (filters.entityType) {
                        conditions.push((0, drizzle_orm_1.eq)(schema_1.userActivityLogs.entityType, filters.entityType));
                    }
                    if (filters.dateFrom && filters.dateTo) {
                        conditions.push((0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)(schema_1.userActivityLogs.timestamp, filters.dateFrom), (0, drizzle_orm_1.lte)(schema_1.userActivityLogs.timestamp, filters.dateTo)));
                    }
                    else if (filters.dateFrom) {
                        conditions.push((0, drizzle_orm_1.gte)(schema_1.userActivityLogs.timestamp, filters.dateFrom));
                    }
                    else if (filters.dateTo) {
                        conditions.push((0, drizzle_orm_1.lte)(schema_1.userActivityLogs.timestamp, filters.dateTo));
                    }
                    if (conditions.length > 0) {
                        query = query.where(drizzle_orm_1.and.apply(void 0, conditions));
                    }
                }
                // Sort by timestamp, newest first
                return [2 /*return*/, query.orderBy((0, drizzle_orm_1.desc)(schema_1.userActivityLogs.timestamp))];
            });
        });
    };
    // User operations
    DatabaseStorage.prototype.getUser = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id))];
                    case 1:
                        user = (_a.sent())[0];
                        return [2 /*return*/, user || undefined];
                }
            });
        });
    };
    DatabaseStorage.prototype.getUserByEmail = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            var user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email))];
                    case 1:
                        user = (_a.sent())[0];
                        return [2 /*return*/, user || undefined];
                }
            });
        });
    };
    DatabaseStorage.prototype.createUser = function (insertUser) {
        return __awaiter(this, void 0, void 0, function () {
            var result, id, user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.users)
                            .values(insertUser)];
                    case 1:
                        result = (_a.sent())[0];
                        id = result.insertId;
                        return [4 /*yield*/, db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id))];
                    case 2:
                        user = (_a.sent())[0];
                        return [2 /*return*/, user];
                }
            });
        });
    };
    DatabaseStorage.prototype.getUsers = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, db_1.db.select().from(schema_1.users)];
            });
        });
    };
    DatabaseStorage.prototype.updateUser = function (id, userData) {
        return __awaiter(this, void 0, void 0, function () {
            var user, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, db_1.db
                                .update(schema_1.users)
                                .set(__assign(__assign({}, userData), { updatedAt: new Date() }))
                                .where((0, drizzle_orm_1.eq)(schema_1.users.id, id))];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id))];
                    case 2:
                        user = (_a.sent())[0];
                        return [2 /*return*/, user || undefined];
                    case 3:
                        error_1 = _a.sent();
                        console.error('Error updating user:', error_1);
                        throw error_1;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    DatabaseStorage.prototype.deleteUser = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .delete(schema_1.users)
                            .where((0, drizzle_orm_1.eq)(schema_1.users.id, id))];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.affectedRows > 0];
                }
            });
        });
    };
    // Gate Pass operations
    DatabaseStorage.prototype.getGatePass = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var gatePass;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.gatePasses).where((0, drizzle_orm_1.eq)(schema_1.gatePasses.id, id))];
                    case 1:
                        gatePass = (_a.sent())[0];
                        return [2 /*return*/, gatePass || undefined];
                }
            });
        });
    };
    DatabaseStorage.prototype.getGatePassByNumber = function (gatePassNumber) {
        return __awaiter(this, void 0, void 0, function () {
            var normalizedInput, gatePass;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("Looking for gate pass with number:", gatePassNumber);
                        normalizedInput = gatePassNumber.trim();
                        return [4 /*yield*/, db_1.db
                                .select()
                                .from(schema_1.gatePasses)
                                .where((0, drizzle_orm_1.eq)(schema_1.gatePasses.gatePassNumber, normalizedInput))];
                    case 1:
                        gatePass = (_a.sent())[0];
                        console.log("Found gate pass:", gatePass);
                        return [2 /*return*/, gatePass || undefined];
                }
            });
        });
    };
    DatabaseStorage.prototype.createGatePass = function (insertGatePass) {
        return __awaiter(this, void 0, void 0, function () {
            var gatePassNumber, result, id, gatePass;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.generateGatePassNumber()];
                    case 1:
                        gatePassNumber = _a.sent();
                        return [4 /*yield*/, db_1.db
                                .insert(schema_1.gatePasses)
                                .values(__assign(__assign({}, insertGatePass), { gatePassNumber: gatePassNumber, status: insertGatePass.status || 'pending' }))];
                    case 2:
                        result = (_a.sent())[0];
                        id = result.insertId;
                        return [4 /*yield*/, db_1.db.select().from(schema_1.gatePasses).where((0, drizzle_orm_1.eq)(schema_1.gatePasses.id, id))];
                    case 3:
                        gatePass = (_a.sent())[0];
                        return [2 /*return*/, gatePass];
                }
            });
        });
    };
    DatabaseStorage.prototype.updateGatePass = function (id, gatePassUpdate) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.gatePasses)
                            .set(__assign(__assign({}, gatePassUpdate), { updatedAt: new Date() }))
                            .where((0, drizzle_orm_1.eq)(schema_1.gatePasses.id, id))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, this.getGatePass(id)];
                }
            });
        });
    };
    DatabaseStorage.prototype.deleteGatePass = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // First delete associated items
                    return [4 /*yield*/, this.deleteItemsByGatePassId(id)];
                    case 1:
                        // First delete associated items
                        _a.sent();
                        return [4 /*yield*/, db_1.db
                                .delete(schema_1.gatePasses)
                                .where((0, drizzle_orm_1.eq)(schema_1.gatePasses.id, id))];
                    case 2:
                        result = _a.sent();
                        return [2 /*return*/, result.affectedRows > 0];
                }
            });
        });
    };
    DatabaseStorage.prototype.getGatePasses = function (filters) {
        return __awaiter(this, void 0, void 0, function () {
            var query, conditions, matchingGatePassIds, ids;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = db_1.db.select().from(schema_1.gatePasses);
                        if (!filters) return [3 /*break*/, 3];
                        conditions = [];
                        if (filters.customerName) {
                            conditions.push((0, drizzle_orm_1.ilike)(schema_1.gatePasses.customerName, "%".concat(filters.customerName, "%")));
                        }
                        if (filters.department) {
                            conditions.push((0, drizzle_orm_1.eq)(schema_1.gatePasses.department, filters.department));
                        }
                        if (filters.gatePassNumber) {
                            conditions.push((0, drizzle_orm_1.ilike)(schema_1.gatePasses.gatePassNumber, "%".concat(filters.gatePassNumber, "%")));
                        }
                        if (filters.createdById) {
                            conditions.push((0, drizzle_orm_1.eq)(schema_1.gatePasses.createdById, filters.createdById));
                        }
                        if (filters.status) {
                            conditions.push((0, drizzle_orm_1.eq)(schema_1.gatePasses.status, filters.status));
                        }
                        if (filters.dateFrom && filters.dateTo) {
                            conditions.push((0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)((0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["DATE(", ")"], ["DATE(", ")"])), schema_1.gatePasses.date), (0, drizzle_orm_1.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["DATE(", ")"], ["DATE(", ")"])), filters.dateFrom.toISOString())), (0, drizzle_orm_1.lte)((0, drizzle_orm_1.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["DATE(", ")"], ["DATE(", ")"])), schema_1.gatePasses.date), (0, drizzle_orm_1.sql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["DATE(", ")"], ["DATE(", ")"])), filters.dateTo.toISOString()))));
                        }
                        else if (filters.dateFrom) {
                            conditions.push((0, drizzle_orm_1.gte)((0, drizzle_orm_1.sql)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["DATE(", ")"], ["DATE(", ")"])), schema_1.gatePasses.date), (0, drizzle_orm_1.sql)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["DATE(", ")"], ["DATE(", ")"])), filters.dateFrom.toISOString())));
                        }
                        else if (filters.dateTo) {
                            conditions.push((0, drizzle_orm_1.lte)((0, drizzle_orm_1.sql)(templateObject_7 || (templateObject_7 = __makeTemplateObject(["DATE(", ")"], ["DATE(", ")"])), schema_1.gatePasses.date), (0, drizzle_orm_1.sql)(templateObject_8 || (templateObject_8 = __makeTemplateObject(["DATE(", ")"], ["DATE(", ")"])), filters.dateTo.toISOString())));
                        }
                        if (!filters.itemName) return [3 /*break*/, 2];
                        return [4 /*yield*/, db_1.db
                                .select({ gatePassId: schema_1.items.gatePassId })
                                .from(schema_1.items)
                                .where((0, drizzle_orm_1.ilike)(schema_1.items.name, "%".concat(filters.itemName, "%")))];
                    case 1:
                        matchingGatePassIds = _a.sent();
                        ids = matchingGatePassIds.map(function (item) { return item.gatePassId; });
                        if (ids.length > 0) {
                            conditions.push((0, drizzle_orm_1.inArray)(schema_1.gatePasses.id, ids));
                        }
                        else {
                            // No items match, return empty result
                            return [2 /*return*/, []];
                        }
                        _a.label = 2;
                    case 2:
                        if (conditions.length > 0) {
                            query = query.where(drizzle_orm_1.and.apply(void 0, conditions));
                        }
                        _a.label = 3;
                    case 3: 
                    // Order by creation date, newest first
                    return [2 /*return*/, query.orderBy((0, drizzle_orm_1.desc)(schema_1.gatePasses.createdAt))];
                }
            });
        });
    };
    // Item operations
    DatabaseStorage.prototype.getItemsByGatePassId = function (gatePassId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, db_1.db
                        .select()
                        .from(schema_1.items)
                        .where((0, drizzle_orm_1.eq)(schema_1.items.gatePassId, gatePassId))];
            });
        });
    };
    DatabaseStorage.prototype.createItem = function (item) {
        return __awaiter(this, void 0, void 0, function () {
            var result, id, newItem;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.items)
                            .values(item)];
                    case 1:
                        result = (_a.sent())[0];
                        id = result.insertId;
                        return [4 /*yield*/, db_1.db.select().from(schema_1.items).where((0, drizzle_orm_1.eq)(schema_1.items.id, id))];
                    case 2:
                        newItem = (_a.sent())[0];
                        return [2 /*return*/, newItem];
                }
            });
        });
    };
    DatabaseStorage.prototype.deleteItemsByGatePassId = function (gatePassId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .delete(schema_1.items)
                            .where((0, drizzle_orm_1.eq)(schema_1.items.gatePassId, gatePassId))];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.affectedRows > 0];
                }
            });
        });
    };
    // Customer operations
    DatabaseStorage.prototype.getCustomer = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var customer;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.customers)
                            .where((0, drizzle_orm_1.eq)(schema_1.customers.id, id))];
                    case 1:
                        customer = (_a.sent())[0];
                        return [2 /*return*/, customer || undefined];
                }
            });
        });
    };
    DatabaseStorage.prototype.getCustomers = function (searchTerm) {
        return __awaiter(this, void 0, void 0, function () {
            var query;
            return __generator(this, function (_a) {
                query = db_1.db.select().from(schema_1.customers);
                if (searchTerm) {
                    query = query.where((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.customers.name, "%".concat(searchTerm, "%")), (0, drizzle_orm_1.ilike)(schema_1.customers.contactPerson, "%".concat(searchTerm, "%"))));
                }
                return [2 /*return*/, query.orderBy(schema_1.customers.name)];
            });
        });
    };
    DatabaseStorage.prototype.createCustomer = function (customer) {
        return __awaiter(this, void 0, void 0, function () {
            var result, id, newCustomer;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.customers)
                            .values(__assign(__assign({}, customer), { email: customer.email || null, phone: customer.phone || null, address: customer.address || null, contactPerson: customer.contactPerson || null }))];
                    case 1:
                        result = (_a.sent())[0];
                        id = result.insertId;
                        return [4 /*yield*/, db_1.db.select().from(schema_1.customers).where((0, drizzle_orm_1.eq)(schema_1.customers.id, id))];
                    case 2:
                        newCustomer = (_a.sent())[0];
                        return [2 /*return*/, newCustomer];
                }
            });
        });
    };
    DatabaseStorage.prototype.updateCustomer = function (id, customerUpdate) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.customers)
                            .set(__assign(__assign({}, customerUpdate), { updatedAt: new Date() }))
                            .where((0, drizzle_orm_1.eq)(schema_1.customers.id, id))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, this.getCustomer(id)];
                }
            });
        });
    };
    // Driver operations
    DatabaseStorage.prototype.getDriver = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var driver;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.drivers)
                            .where((0, drizzle_orm_1.eq)(schema_1.drivers.id, id))];
                    case 1:
                        driver = (_a.sent())[0];
                        return [2 /*return*/, driver || undefined];
                }
            });
        });
    };
    DatabaseStorage.prototype.getDrivers = function (searchTerm) {
        return __awaiter(this, void 0, void 0, function () {
            var query;
            return __generator(this, function (_a) {
                query = db_1.db.select().from(schema_1.drivers);
                if (searchTerm) {
                    query = query.where((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.drivers.name, "%".concat(searchTerm, "%")), (0, drizzle_orm_1.ilike)(schema_1.drivers.cnic, "%".concat(searchTerm, "%")), (0, drizzle_orm_1.ilike)(schema_1.drivers.mobile, "%".concat(searchTerm, "%"))));
                }
                return [2 /*return*/, query.orderBy(schema_1.drivers.name)];
            });
        });
    };
    DatabaseStorage.prototype.getDriverByCnic = function (cnic) {
        return __awaiter(this, void 0, void 0, function () {
            var driver;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.drivers)
                            .where((0, drizzle_orm_1.eq)(schema_1.drivers.cnic, cnic))];
                    case 1:
                        driver = (_a.sent())[0];
                        return [2 /*return*/, driver || undefined];
                }
            });
        });
    };
    DatabaseStorage.prototype.createDriver = function (driver) {
        return __awaiter(this, void 0, void 0, function () {
            var result, id, newDriver;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.drivers)
                            .values(__assign(__assign({}, driver), { vehicleNumber: driver.vehicleNumber || null }))];
                    case 1:
                        result = (_a.sent())[0];
                        id = result.insertId;
                        return [4 /*yield*/, db_1.db.select().from(schema_1.drivers).where((0, drizzle_orm_1.eq)(schema_1.drivers.id, id))];
                    case 2:
                        newDriver = (_a.sent())[0];
                        return [2 /*return*/, newDriver];
                }
            });
        });
    };
    DatabaseStorage.prototype.updateDriver = function (id, driverUpdate) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.drivers)
                            .set(__assign(__assign({}, driverUpdate), { updatedAt: new Date() }))
                            .where((0, drizzle_orm_1.eq)(schema_1.drivers.id, id))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, this.getDriver(id)];
                }
            });
        });
    };
    // Document operations
    DatabaseStorage.prototype.getDocument = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var document;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.documents)
                            .where((0, drizzle_orm_1.eq)(schema_1.documents.id, id))];
                    case 1:
                        document = (_a.sent())[0];
                        return [2 /*return*/, document || undefined];
                }
            });
        });
    };
    DatabaseStorage.prototype.getDocumentsByEntity = function (entityType, entityId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, db_1.db
                        .select()
                        .from(schema_1.documents)
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.documents.entityType, entityType), (0, drizzle_orm_1.eq)(schema_1.documents.entityId, entityId)))
                        .orderBy((0, drizzle_orm_1.desc)(schema_1.documents.createdAt))];
            });
        });
    };
    DatabaseStorage.prototype.createDocument = function (document) {
        return __awaiter(this, void 0, void 0, function () {
            var result, id, newDoc;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.documents)
                            .values(document)];
                    case 1:
                        result = (_a.sent())[0];
                        id = result.insertId;
                        return [4 /*yield*/, db_1.db.select().from(schema_1.documents).where((0, drizzle_orm_1.eq)(schema_1.documents.id, id))];
                    case 2:
                        newDoc = (_a.sent())[0];
                        return [2 /*return*/, newDoc];
                }
            });
        });
    };
    DatabaseStorage.prototype.updateDocument = function (id, documentData) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.update(schema_1.documents).set(documentData).where((0, drizzle_orm_1.eq)(schema_1.documents.id, id))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, this.getDocument(id)];
                }
            });
        });
    };
    DatabaseStorage.prototype.deleteDocument = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .delete(schema_1.documents)
                            .where((0, drizzle_orm_1.eq)(schema_1.documents.id, id))];
                    case 1:
                        result = (_a.sent())[0];
                        return [2 /*return*/, result.affectedRows > 0];
                }
            });
        });
    };
    // Statistics
    DatabaseStorage.prototype.getStatistics = function () {
        return __awaiter(this, void 0, void 0, function () {
            var now, startOfMonth, startOfWeek, day, diff, totalPasses, monthlyPasses, weeklyPasses, pendingApprovals, statusDistribution, departmentDistribution, sixMonthsAgo, monthlyTrend, thirtyDaysAgo, dailyTrend;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        now = new Date();
                        startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                        startOfWeek = new Date(now);
                        day = startOfWeek.getDay();
                        diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
                        startOfWeek.setDate(diff);
                        startOfWeek.setHours(0, 0, 0, 0);
                        return [4 /*yield*/, db_1.db
                                .select({ count: (0, drizzle_orm_1.count)() })
                                .from(schema_1.gatePasses)];
                    case 1:
                        totalPasses = (_a.sent())[0].count;
                        return [4 /*yield*/, db_1.db
                                .select({ count: (0, drizzle_orm_1.count)() })
                                .from(schema_1.gatePasses)
                                .where((0, drizzle_orm_1.gte)(schema_1.gatePasses.createdAt, startOfMonth))];
                    case 2:
                        monthlyPasses = (_a.sent())[0].count;
                        return [4 /*yield*/, db_1.db
                                .select({ count: (0, drizzle_orm_1.count)() })
                                .from(schema_1.gatePasses)
                                .where((0, drizzle_orm_1.gte)(schema_1.gatePasses.createdAt, startOfWeek))];
                    case 3:
                        weeklyPasses = (_a.sent())[0].count;
                        return [4 /*yield*/, db_1.db
                                .select({ count: (0, drizzle_orm_1.count)() })
                                .from(schema_1.gatePasses)
                                .where((0, drizzle_orm_1.eq)(schema_1.gatePasses.status, 'pending'))];
                    case 4:
                        pendingApprovals = (_a.sent())[0].count;
                        return [4 /*yield*/, db_1.db
                                .select({
                                status: schema_1.gatePasses.status,
                                count: (0, drizzle_orm_1.count)()
                            })
                                .from(schema_1.gatePasses)
                                .groupBy(schema_1.gatePasses.status)
                                .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.count)()))];
                    case 5:
                        statusDistribution = _a.sent();
                        return [4 /*yield*/, db_1.db
                                .select({
                                department: schema_1.gatePasses.department,
                                count: (0, drizzle_orm_1.count)()
                            })
                                .from(schema_1.gatePasses)
                                .groupBy(schema_1.gatePasses.department)
                                .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.count)()))];
                    case 6:
                        departmentDistribution = _a.sent();
                        sixMonthsAgo = new Date();
                        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                        return [4 /*yield*/, db_1.db
                                .select({
                                month: (0, drizzle_orm_1.sql)(templateObject_9 || (templateObject_9 = __makeTemplateObject(["DATE_FORMAT(", ", '%Y-%m')"], ["DATE_FORMAT(", ", '%Y-%m')"])), schema_1.gatePasses.createdAt),
                                count: (0, drizzle_orm_1.count)()
                            })
                                .from(schema_1.gatePasses)
                                .where((0, drizzle_orm_1.gte)(schema_1.gatePasses.createdAt, sixMonthsAgo))
                                .groupBy((0, drizzle_orm_1.sql)(templateObject_10 || (templateObject_10 = __makeTemplateObject(["DATE_FORMAT(", ", '%Y-%m')"], ["DATE_FORMAT(", ", '%Y-%m')"])), schema_1.gatePasses.createdAt))
                                .orderBy((0, drizzle_orm_1.sql)(templateObject_11 || (templateObject_11 = __makeTemplateObject(["DATE_FORMAT(", ", '%Y-%m')"], ["DATE_FORMAT(", ", '%Y-%m')"])), schema_1.gatePasses.createdAt))];
                    case 7:
                        monthlyTrend = _a.sent();
                        thirtyDaysAgo = new Date();
                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                        return [4 /*yield*/, db_1.db
                                .select({
                                date: (0, drizzle_orm_1.sql)(templateObject_12 || (templateObject_12 = __makeTemplateObject(["DATE_FORMAT(", ", '%Y-%m-%d')"], ["DATE_FORMAT(", ", '%Y-%m-%d')"])), schema_1.gatePasses.createdAt),
                                count: (0, drizzle_orm_1.count)()
                            })
                                .from(schema_1.gatePasses)
                                .where((0, drizzle_orm_1.gte)(schema_1.gatePasses.createdAt, thirtyDaysAgo))
                                .groupBy((0, drizzle_orm_1.sql)(templateObject_13 || (templateObject_13 = __makeTemplateObject(["DATE_FORMAT(", ", '%Y-%m-%d')"], ["DATE_FORMAT(", ", '%Y-%m-%d')"])), schema_1.gatePasses.createdAt))
                                .orderBy((0, drizzle_orm_1.sql)(templateObject_14 || (templateObject_14 = __makeTemplateObject(["DATE_FORMAT(", ", '%Y-%m-%d')"], ["DATE_FORMAT(", ", '%Y-%m-%d')"])), schema_1.gatePasses.createdAt))];
                    case 8:
                        dailyTrend = _a.sent();
                        return [2 /*return*/, {
                                totalPasses: Number(totalPasses),
                                monthlyPasses: Number(monthlyPasses),
                                weeklyPasses: Number(weeklyPasses),
                                pendingApprovals: Number(pendingApprovals),
                                statusDistribution: statusDistribution,
                                departmentDistribution: departmentDistribution,
                                monthlyTrend: monthlyTrend,
                                dailyTrend: dailyTrend
                            }];
                }
            });
        });
    };
    // Utility methods
    DatabaseStorage.prototype.generateGatePassNumber = function () {
        return __awaiter(this, void 0, void 0, function () {
            var now, year, month, latestGatePass, sequenceNumber, latestNumber, matches;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        now = new Date();
                        year = now.getFullYear().toString().slice(2);
                        month = (now.getMonth() + 1).toString().padStart(2, '0');
                        return [4 /*yield*/, db_1.db
                                .select({ number: schema_1.gatePasses.gatePassNumber })
                                .from(schema_1.gatePasses)
                                .orderBy((0, drizzle_orm_1.desc)(schema_1.gatePasses.createdAt))
                                .limit(1)];
                    case 1:
                        latestGatePass = _a.sent();
                        sequenceNumber = 1;
                        if (latestGatePass.length > 0 && latestGatePass[0].number) {
                            latestNumber = latestGatePass[0].number;
                            matches = latestNumber.match(/PZGP-(\d+)/);
                            if (matches && matches[1]) {
                                sequenceNumber = parseInt(matches[1], 10) + 1;
                            }
                            else {
                                // Try matching our new desired format: PZ-YYMM-0001
                                matches = latestNumber.match(/PZ-\d{4}-(\d{4})/);
                                if (matches && matches[1]) {
                                    sequenceNumber = parseInt(matches[1], 10) + 1;
                                }
                            }
                        }
                        // Use the new format: PZ-YYMM-0001
                        return [2 /*return*/, "PZ-".concat(year).concat(month, "-").concat(sequenceNumber.toString().padStart(4, '0'))];
                }
            });
        });
    };
    return DatabaseStorage;
}());
exports.DatabaseStorage = DatabaseStorage;
// Use database storage instead of memory storage
exports.storage = new DatabaseStorage();
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14;
