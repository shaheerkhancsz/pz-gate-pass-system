"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = exports.DatabaseStorage = exports.MemStorage = void 0;
const schema_1 = require("../shared/schema");
const db_1 = require("./db");
const drizzle_orm_1 = require("drizzle-orm");
class MemStorage {
    users;
    roles;
    permissions;
    gatePasses;
    items;
    customers;
    drivers;
    documents;
    companySettings;
    activityLogs;
    notifications;
    currentId;
    async getStatistics() {
        // Dummy implementation for MemStorage (which seems to mirror DatabaseStorage now)
        return {
            totalPasses: 0,
            monthlyPasses: 0,
            weeklyPasses: 0,
            pendingApprovals: 0,
            statusDistribution: [],
            departmentDistribution: [],
            monthlyTrend: [],
            dailyTrend: []
        };
    }
    constructor() {
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
    // User operations
    async getUser(id) {
        const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
        return user;
    }
    async getUserByEmail(email) {
        const [user] = await db_1.db
            .select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.ilike)(schema_1.users.email, email));
        return user;
    }
    async createUser(insertUser) {
        const [result] = await db_1.db
            .insert(schema_1.users)
            .values(insertUser);
        const id = result.insertId;
        return this.getUser(id);
    }
    async getUsers() {
        return db_1.db.select().from(schema_1.users);
    }
    async updateUser(id, userData) {
        await db_1.db
            .update(schema_1.users)
            .set({
            ...userData,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
        return this.getUser(id);
    }
    async deleteUser(id) {
        const [result] = await db_1.db
            .delete(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
        return result.affectedRows > 0;
    }
    // Gate Pass operations
    async getGatePass(id) {
        const [gatePass] = await db_1.db.select().from(schema_1.gatePasses).where((0, drizzle_orm_1.eq)(schema_1.gatePasses.id, id));
        return gatePass;
    }
    async getGatePassByNumber(gatePassNumber) {
        const [gatePass] = await db_1.db
            .select()
            .from(schema_1.gatePasses)
            .where((0, drizzle_orm_1.eq)(schema_1.gatePasses.gatePassNumber, gatePassNumber));
        return gatePass;
    }
    async createGatePass(gatePass) {
        const gatePassNumber = await this.generateGatePassNumber();
        const [result] = await db_1.db
            .insert(schema_1.gatePasses)
            .values({ ...gatePass, gatePassNumber });
        const id = result.insertId;
        return this.getGatePass(id);
    }
    async updateGatePass(id, gatePass) {
        await db_1.db
            .update(schema_1.gatePasses)
            .set(gatePass)
            .where((0, drizzle_orm_1.eq)(schema_1.gatePasses.id, id));
        return this.getGatePass(id);
    }
    async deleteGatePass(id) {
        const [result] = await db_1.db
            .delete(schema_1.gatePasses)
            .where((0, drizzle_orm_1.eq)(schema_1.gatePasses.id, id));
        return result.affectedRows > 0;
    }
    async getGatePasses(filters) {
        let query = db_1.db.select().from(schema_1.gatePasses);
        if (filters) {
            const conditions = [];
            if (filters.customerName) {
                conditions.push((0, drizzle_orm_1.ilike)(schema_1.gatePasses.customerName, `%${filters.customerName}%`));
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
                query = query.where((0, drizzle_orm_1.and)(...conditions));
            }
        }
        query = query.orderBy((0, drizzle_orm_1.desc)(schema_1.gatePasses.createdAt));
        return query;
    }
    // Item operations
    async getItemsByGatePassId(gatePassId) {
        return db_1.db
            .select()
            .from(schema_1.items)
            .where((0, drizzle_orm_1.eq)(schema_1.items.gatePassId, gatePassId));
    }
    async createItem(item) {
        const [result] = await db_1.db
            .insert(schema_1.items)
            .values(item);
        return { ...item, id: result.insertId };
    }
    async deleteItemsByGatePassId(gatePassId) {
        const [result] = await db_1.db
            .delete(schema_1.items)
            .where((0, drizzle_orm_1.eq)(schema_1.items.gatePassId, gatePassId));
        return result.affectedRows > 0;
    }
    // Customer operations
    async getCustomer(id) {
        const [customer] = await db_1.db.select().from(schema_1.customers).where((0, drizzle_orm_1.eq)(schema_1.customers.id, id));
        return customer;
    }
    async getCustomers(searchTerm) {
        if (searchTerm) {
            return db_1.db
                .select()
                .from(schema_1.customers)
                .where((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.customers.name, `%${searchTerm}%`), (0, drizzle_orm_1.ilike)(schema_1.customers.email || '', `%${searchTerm}%`), (0, drizzle_orm_1.ilike)(schema_1.drivers.mobile, `%${searchTerm}%`)));
        }
        return db_1.db.select().from(schema_1.customers);
    }
    async createCustomer(customer) {
        const [result] = await db_1.db
            .insert(schema_1.customers)
            .values(customer);
        const id = result.insertId;
        return this.getCustomer(id);
    }
    async updateCustomer(id, customer) {
        await db_1.db
            .update(schema_1.customers)
            .set(customer)
            .where((0, drizzle_orm_1.eq)(schema_1.customers.id, id));
        return this.getCustomer(id);
    }
    // Driver operations
    async getDriver(id) {
        const [driver] = await db_1.db.select().from(schema_1.drivers).where((0, drizzle_orm_1.eq)(schema_1.drivers.id, id));
        return driver;
    }
    async getDrivers(searchTerm) {
        if (searchTerm) {
            return db_1.db
                .select()
                .from(schema_1.drivers)
                .where((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.drivers.name, `%${searchTerm}%`), (0, drizzle_orm_1.ilike)(schema_1.drivers.cnic, `%${searchTerm}%`), (0, drizzle_orm_1.ilike)(schema_1.drivers.mobile, `%${searchTerm}%`)));
        }
        return db_1.db.select().from(schema_1.drivers);
    }
    async getDriverByCnic(cnic) {
        const [driver] = await db_1.db
            .select()
            .from(schema_1.drivers)
            .where((0, drizzle_orm_1.eq)(schema_1.drivers.cnic, cnic));
        return driver;
    }
    async createDriver(driver) {
        const [result] = await db_1.db
            .insert(schema_1.drivers)
            .values(driver);
        const id = result.insertId;
        return this.getDriver(id);
    }
    async updateDriver(id, driver) {
        await db_1.db
            .update(schema_1.drivers)
            .set(driver)
            .where((0, drizzle_orm_1.eq)(schema_1.drivers.id, id));
        return this.getDriver(id);
    }
    // User Activity Logging
    async logUserActivity(activityLog) {
        const [newLog] = await db_1.db
            .insert(schema_1.userActivityLogs)
            .values(activityLog); // Removed .returning()
        // For MemStorage simulation via DB, we can't easily return full object without re-selecting.
        // Given usage, returning input cast as Log might be enough or select it.
        // Since this method is likely unused (DatabaseStorage is used), simplified return is okay.
        return { ...activityLog, id: newLog.insertId, timestamp: new Date() };
    }
    async getUserActivityLogs(filters) {
        let query = db_1.db.select().from(schema_1.userActivityLogs);
        if (filters) {
            const conditions = [];
            if (filters.userId) {
                conditions.push((0, drizzle_orm_1.eq)(schema_1.userActivityLogs.userId, filters.userId));
            }
            if (filters.userEmail) {
                conditions.push((0, drizzle_orm_1.ilike)(schema_1.userActivityLogs.userEmail, `%${filters.userEmail}%`));
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
                query = query.where((0, drizzle_orm_1.and)(...conditions));
            }
        }
        return query;
    }
    // Document operations
    async getDocument(id) {
        const [document] = await db_1.db.select().from(schema_1.documents).where((0, drizzle_orm_1.eq)(schema_1.documents.id, id));
        return document;
    }
    async getDocumentsByEntity(entityType, entityId) {
        return db_1.db
            .select()
            .from(schema_1.documents)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.documents.entityType, entityType), (0, drizzle_orm_1.eq)(schema_1.documents.entityId, entityId)));
    }
    async createDocument(document) {
        const [result] = await db_1.db
            .insert(schema_1.documents)
            .values(document);
        const id = result.insertId;
        return this.getDocument(id);
    }
    async updateDocument(id, documentData) {
        await db_1.db.update(schema_1.documents).set(documentData).where((0, drizzle_orm_1.eq)(schema_1.documents.id, id));
        return this.getDocument(id);
    }
    async deleteDocument(id) {
        const [result] = await db_1.db.delete(schema_1.documents).where((0, drizzle_orm_1.eq)(schema_1.documents.id, id));
        return result.affectedRows > 0;
    }
    // Utility methods
    async generateGatePassNumber() {
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        const [{ count: countVal }] = await db_1.db
            .select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.gatePasses)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)(schema_1.gatePasses.createdAt, new Date(year, today.getMonth(), 1)), (0, drizzle_orm_1.lte)(schema_1.gatePasses.createdAt, new Date(year, today.getMonth() + 1, 0))));
        const sequence = (countVal + 1).toString().padStart(4, '0');
        return `GP${year}${month}${day}${sequence}`;
    }
}
exports.MemStorage = MemStorage;
// Database storage implementation
class DatabaseStorage {
    // User Activity Logging
    async logUserActivity(activityLog) {
        const [result] = await db_1.db
            .insert(schema_1.userActivityLogs)
            .values(activityLog);
        const id = result.insertId;
        const [log] = await db_1.db.select().from(schema_1.userActivityLogs).where((0, drizzle_orm_1.eq)(schema_1.userActivityLogs.id, id));
        return log;
    }
    async getUserActivityLogs(filters) {
        let query = db_1.db.select().from(schema_1.userActivityLogs);
        if (filters) {
            const conditions = [];
            if (filters.userId) {
                conditions.push((0, drizzle_orm_1.eq)(schema_1.userActivityLogs.userId, filters.userId));
            }
            if (filters.userEmail) {
                conditions.push((0, drizzle_orm_1.ilike)(schema_1.userActivityLogs.userEmail, `%${filters.userEmail}%`));
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
                query = query.where((0, drizzle_orm_1.and)(...conditions));
            }
        }
        // Sort by timestamp, newest first
        return query.orderBy((0, drizzle_orm_1.desc)(schema_1.userActivityLogs.timestamp));
    }
    // User operations
    async getUser(id) {
        const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
        return user || undefined;
    }
    async getUserByEmail(email) {
        const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
        return user || undefined;
    }
    async createUser(insertUser) {
        const [result] = await db_1.db
            .insert(schema_1.users)
            .values(insertUser);
        const id = result.insertId;
        const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
        return user;
    }
    async getUsers() {
        return db_1.db.select().from(schema_1.users);
    }
    async updateUser(id, userData) {
        try {
            await db_1.db
                .update(schema_1.users)
                .set({
                ...userData,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
            const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
            return user || undefined;
        }
        catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    }
    async deleteUser(id) {
        const result = await db_1.db
            .delete(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
        return result.affectedRows > 0;
    }
    // Gate Pass operations
    async getGatePass(id) {
        const [gatePass] = await db_1.db.select().from(schema_1.gatePasses).where((0, drizzle_orm_1.eq)(schema_1.gatePasses.id, id));
        return gatePass || undefined;
    }
    async getGatePassByNumber(gatePassNumber) {
        console.log("Looking for gate pass with number:", gatePassNumber);
        const normalizedInput = gatePassNumber.trim();
        const [gatePass] = await db_1.db
            .select()
            .from(schema_1.gatePasses)
            .where((0, drizzle_orm_1.eq)(schema_1.gatePasses.gatePassNumber, normalizedInput));
        console.log("Found gate pass:", gatePass);
        return gatePass || undefined;
    }
    async createGatePass(insertGatePass) {
        const gatePassNumber = await this.generateGatePassNumber();
        const [result] = await db_1.db
            .insert(schema_1.gatePasses)
            .values({
            ...insertGatePass,
            gatePassNumber,
            status: insertGatePass.status || 'pending',
        });
        const id = result.insertId;
        const [gatePass] = await db_1.db.select().from(schema_1.gatePasses).where((0, drizzle_orm_1.eq)(schema_1.gatePasses.id, id));
        return gatePass;
    }
    async updateGatePass(id, gatePassUpdate) {
        await db_1.db
            .update(schema_1.gatePasses)
            .set({
            ...gatePassUpdate,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.gatePasses.id, id));
        return this.getGatePass(id);
    }
    async deleteGatePass(id) {
        // First delete associated items
        await this.deleteItemsByGatePassId(id);
        // Then delete the gate pass
        const result = await db_1.db
            .delete(schema_1.gatePasses)
            .where((0, drizzle_orm_1.eq)(schema_1.gatePasses.id, id));
        return result.affectedRows > 0;
    }
    async getGatePasses(filters) {
        let query = db_1.db.select().from(schema_1.gatePasses);
        if (filters) {
            const conditions = [];
            if (filters.customerName) {
                conditions.push((0, drizzle_orm_1.ilike)(schema_1.gatePasses.customerName, `%${filters.customerName}%`));
            }
            if (filters.department) {
                conditions.push((0, drizzle_orm_1.eq)(schema_1.gatePasses.department, filters.department));
            }
            if (filters.gatePassNumber) {
                conditions.push((0, drizzle_orm_1.ilike)(schema_1.gatePasses.gatePassNumber, `%${filters.gatePassNumber}%`));
            }
            if (filters.createdById) {
                conditions.push((0, drizzle_orm_1.eq)(schema_1.gatePasses.createdById, filters.createdById));
            }
            if (filters.status) {
                conditions.push((0, drizzle_orm_1.eq)(schema_1.gatePasses.status, filters.status));
            }
            if (filters.dateFrom && filters.dateTo) {
                conditions.push((0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)((0, drizzle_orm_1.sql) `DATE(${schema_1.gatePasses.date})`, (0, drizzle_orm_1.sql) `DATE(${filters.dateFrom.toISOString()})`), (0, drizzle_orm_1.lte)((0, drizzle_orm_1.sql) `DATE(${schema_1.gatePasses.date})`, (0, drizzle_orm_1.sql) `DATE(${filters.dateTo.toISOString()})`)));
            }
            else if (filters.dateFrom) {
                conditions.push((0, drizzle_orm_1.gte)((0, drizzle_orm_1.sql) `DATE(${schema_1.gatePasses.date})`, (0, drizzle_orm_1.sql) `DATE(${filters.dateFrom.toISOString()})`));
            }
            else if (filters.dateTo) {
                conditions.push((0, drizzle_orm_1.lte)((0, drizzle_orm_1.sql) `DATE(${schema_1.gatePasses.date})`, (0, drizzle_orm_1.sql) `DATE(${filters.dateTo.toISOString()})`));
            }
            if (filters.itemName) {
                // Need to find gate passes with matching items
                const matchingGatePassIds = await db_1.db
                    .select({ gatePassId: schema_1.items.gatePassId })
                    .from(schema_1.items)
                    .where((0, drizzle_orm_1.ilike)(schema_1.items.name, `%${filters.itemName}%`));
                const ids = matchingGatePassIds.map(item => item.gatePassId);
                if (ids.length > 0) {
                    conditions.push((0, drizzle_orm_1.inArray)(schema_1.gatePasses.id, ids));
                }
                else {
                    // No items match, return empty result
                    return [];
                }
            }
            if (conditions.length > 0) {
                query = query.where((0, drizzle_orm_1.and)(...conditions));
            }
        }
        // Order by creation date, newest first
        return query.orderBy((0, drizzle_orm_1.desc)(schema_1.gatePasses.createdAt));
    }
    // Item operations
    async getItemsByGatePassId(gatePassId) {
        return db_1.db
            .select()
            .from(schema_1.items)
            .where((0, drizzle_orm_1.eq)(schema_1.items.gatePassId, gatePassId));
    }
    async createItem(item) {
        const [result] = await db_1.db
            .insert(schema_1.items)
            .values(item);
        const id = result.insertId;
        const [newItem] = await db_1.db.select().from(schema_1.items).where((0, drizzle_orm_1.eq)(schema_1.items.id, id));
        return newItem;
    }
    async deleteItemsByGatePassId(gatePassId) {
        const result = await db_1.db
            .delete(schema_1.items)
            .where((0, drizzle_orm_1.eq)(schema_1.items.gatePassId, gatePassId));
        return result.affectedRows > 0;
    }
    // Customer operations
    async getCustomer(id) {
        const [customer] = await db_1.db
            .select()
            .from(schema_1.customers)
            .where((0, drizzle_orm_1.eq)(schema_1.customers.id, id));
        return customer || undefined;
    }
    async getCustomers(searchTerm) {
        let query = db_1.db.select().from(schema_1.customers);
        if (searchTerm) {
            query = query.where((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.customers.name, `%${searchTerm}%`), (0, drizzle_orm_1.ilike)(schema_1.customers.contactPerson, `%${searchTerm}%`)));
        }
        return query.orderBy(schema_1.customers.name);
    }
    async createCustomer(customer) {
        const [result] = await db_1.db
            .insert(schema_1.customers)
            .values({
            ...customer,
            email: customer.email || null,
            phone: customer.phone || null,
            address: customer.address || null,
            contactPerson: customer.contactPerson || null
        });
        const id = result.insertId;
        const [newCustomer] = await db_1.db.select().from(schema_1.customers).where((0, drizzle_orm_1.eq)(schema_1.customers.id, id));
        return newCustomer;
    }
    async updateCustomer(id, customerUpdate) {
        await db_1.db
            .update(schema_1.customers)
            .set({
            ...customerUpdate,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.customers.id, id));
        return this.getCustomer(id);
    }
    // Driver operations
    async getDriver(id) {
        const [driver] = await db_1.db
            .select()
            .from(schema_1.drivers)
            .where((0, drizzle_orm_1.eq)(schema_1.drivers.id, id));
        return driver || undefined;
    }
    async getDrivers(searchTerm) {
        let query = db_1.db.select().from(schema_1.drivers);
        if (searchTerm) {
            query = query.where((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.drivers.name, `%${searchTerm}%`), (0, drizzle_orm_1.ilike)(schema_1.drivers.cnic, `%${searchTerm}%`), (0, drizzle_orm_1.ilike)(schema_1.drivers.mobile, `%${searchTerm}%`)));
        }
        return query.orderBy(schema_1.drivers.name);
    }
    async getDriverByCnic(cnic) {
        const [driver] = await db_1.db
            .select()
            .from(schema_1.drivers)
            .where((0, drizzle_orm_1.eq)(schema_1.drivers.cnic, cnic));
        return driver || undefined;
    }
    async createDriver(driver) {
        const [result] = await db_1.db
            .insert(schema_1.drivers)
            .values({
            ...driver,
            vehicleNumber: driver.vehicleNumber || null,
            // licenseNumber removed as it does not exist in schema
        });
        const id = result.insertId;
        const [newDriver] = await db_1.db.select().from(schema_1.drivers).where((0, drizzle_orm_1.eq)(schema_1.drivers.id, id));
        return newDriver;
    }
    async updateDriver(id, driverUpdate) {
        await db_1.db
            .update(schema_1.drivers)
            .set({
            ...driverUpdate,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.drivers.id, id));
        return this.getDriver(id);
    }
    // Document operations
    async getDocument(id) {
        const [document] = await db_1.db
            .select()
            .from(schema_1.documents)
            .where((0, drizzle_orm_1.eq)(schema_1.documents.id, id));
        return document || undefined;
    }
    async getDocumentsByEntity(entityType, entityId) {
        return db_1.db
            .select()
            .from(schema_1.documents)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.documents.entityType, entityType), (0, drizzle_orm_1.eq)(schema_1.documents.entityId, entityId)))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.documents.createdAt));
    }
    async createDocument(document) {
        const [result] = await db_1.db
            .insert(schema_1.documents)
            .values(document);
        const id = result.insertId;
        const [newDoc] = await db_1.db.select().from(schema_1.documents).where((0, drizzle_orm_1.eq)(schema_1.documents.id, id));
        return newDoc;
    }
    async updateDocument(id, documentData) {
        await db_1.db.update(schema_1.documents).set(documentData).where((0, drizzle_orm_1.eq)(schema_1.documents.id, id));
        return this.getDocument(id);
    }
    async deleteDocument(id) {
        const [result] = await db_1.db
            .delete(schema_1.documents)
            .where((0, drizzle_orm_1.eq)(schema_1.documents.id, id));
        return result.affectedRows > 0;
    }
    // Statistics
    async getStatistics() {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);
        // Get total passes
        const [{ count: totalPasses }] = await db_1.db
            .select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.gatePasses);
        // Get monthly passes
        const [{ count: monthlyPasses }] = await db_1.db
            .select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.gatePasses)
            .where((0, drizzle_orm_1.gte)(schema_1.gatePasses.createdAt, startOfMonth));
        // Get weekly passes
        const [{ count: weeklyPasses }] = await db_1.db
            .select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.gatePasses)
            .where((0, drizzle_orm_1.gte)(schema_1.gatePasses.createdAt, startOfWeek));
        // Get pending approvals
        const [{ count: pendingApprovals }] = await db_1.db
            .select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.gatePasses)
            .where((0, drizzle_orm_1.eq)(schema_1.gatePasses.status, 'pending'));
        // Get status distribution
        const statusDistribution = await db_1.db
            .select({
            status: schema_1.gatePasses.status,
            count: (0, drizzle_orm_1.count)()
        })
            .from(schema_1.gatePasses)
            .groupBy(schema_1.gatePasses.status)
            .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.count)()));
        // Get department distribution
        const departmentDistribution = await db_1.db
            .select({
            department: schema_1.gatePasses.department,
            count: (0, drizzle_orm_1.count)()
        })
            .from(schema_1.gatePasses)
            .groupBy(schema_1.gatePasses.department)
            .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.count)()));
        // Get monthly trend for last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const monthlyTrend = await db_1.db
            .select({
            month: (0, drizzle_orm_1.sql) `DATE_FORMAT(${schema_1.gatePasses.createdAt}, '%Y-%m')`,
            count: (0, drizzle_orm_1.count)()
        })
            .from(schema_1.gatePasses)
            .where((0, drizzle_orm_1.gte)(schema_1.gatePasses.createdAt, sixMonthsAgo))
            .groupBy((0, drizzle_orm_1.sql) `DATE_FORMAT(${schema_1.gatePasses.createdAt}, '%Y-%m')`)
            .orderBy((0, drizzle_orm_1.sql) `DATE_FORMAT(${schema_1.gatePasses.createdAt}, '%Y-%m')`);
        // Get daily trend for last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dailyTrend = await db_1.db
            .select({
            date: (0, drizzle_orm_1.sql) `DATE_FORMAT(${schema_1.gatePasses.createdAt}, '%Y-%m-%d')`,
            count: (0, drizzle_orm_1.count)()
        })
            .from(schema_1.gatePasses)
            .where((0, drizzle_orm_1.gte)(schema_1.gatePasses.createdAt, thirtyDaysAgo))
            .groupBy((0, drizzle_orm_1.sql) `DATE_FORMAT(${schema_1.gatePasses.createdAt}, '%Y-%m-%d')`)
            .orderBy((0, drizzle_orm_1.sql) `DATE_FORMAT(${schema_1.gatePasses.createdAt}, '%Y-%m-%d')`);
        return {
            totalPasses: Number(totalPasses),
            monthlyPasses: Number(monthlyPasses),
            weeklyPasses: Number(weeklyPasses),
            pendingApprovals: Number(pendingApprovals),
            statusDistribution,
            departmentDistribution,
            monthlyTrend,
            dailyTrend
        };
    }
    // Utility methods
    async generateGatePassNumber() {
        const now = new Date();
        const year = now.getFullYear().toString().slice(2); // Get last two digits of year
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        // Find the latest gate pass number to increment it
        const latestGatePass = await db_1.db
            .select({ number: schema_1.gatePasses.gatePassNumber })
            .from(schema_1.gatePasses)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.gatePasses.createdAt))
            .limit(1);
        let sequenceNumber = 1;
        if (latestGatePass.length > 0 && latestGatePass[0].number) {
            const latestNumber = latestGatePass[0].number;
            // Try matching our current format: PZGP-001
            let matches = latestNumber.match(/PZGP-(\d+)/);
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
        return `PZ-${year}${month}-${sequenceNumber.toString().padStart(4, '0')}`;
    }
}
exports.DatabaseStorage = DatabaseStorage;
// Use database storage instead of memory storage
exports.storage = new DatabaseStorage();
