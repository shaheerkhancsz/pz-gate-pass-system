import {
  users, gatePasses, items, customers, drivers, roles, permissions, userActivityLogs, documents, companies, products,
  plants, gates, vendors, itemMaster,
  type User, type InsertUser,
  type GatePass, type InsertGatePass,
  type Item, type InsertItem,
  type Customer, type InsertCustomer,
  type Driver, type InsertDriver,
  type Role, type Permission,
  type UserActivityLog, type InsertUserActivityLog,
  type Document, type InsertDocument,
  type Notification,
  type Company, type InsertCompany,
  type Product, type InsertProduct,
  type Plant, type InsertPlant,
  type Gate, type InsertGate,
  type Vendor, type InsertVendor,
  type ItemMaster, type InsertItemMaster,
} from "@shared/schema";
import { db } from "./db";
import { and, count, desc, eq, gte, ilike, inArray, like, lte, or, sql, isNotNull } from "drizzle-orm";
import bcrypt from 'bcrypt';

// Define the interface for our storage operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getUsers(): Promise<User[]>;

  // Gate Pass operations
  getGatePass(id: number): Promise<GatePass | undefined>;
  getGatePassByNumber(gatePassNumber: string): Promise<GatePass | undefined>;
  createGatePass(gatePass: InsertGatePass): Promise<GatePass>;
  updateGatePass(id: number, gatePass: Partial<InsertGatePass>): Promise<GatePass | undefined>;
  deleteGatePass(id: number): Promise<boolean>;
  getGatePasses(filters?: Partial<{
    customerName: string;
    department: string;
    dateFrom: Date;
    dateTo: Date;
    gatePassNumber: string;
    itemName: string;
    createdById: number;
    status: string;
    companyId: number;
    type: string;
  }>): Promise<GatePass[]>;

  // Item operations
  getItemsByGatePassId(gatePassId: number): Promise<Item[]>;
  createItem(item: InsertItem & { gatePassId: number }): Promise<Item>;
  deleteItemsByGatePassId(gatePassId: number): Promise<boolean>;

  // Customer operations
  getCustomer(id: number): Promise<Customer | undefined>;
  getCustomers(searchTerm?: string): Promise<Customer[]>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;

  // Driver operations
  getDriver(id: number): Promise<Driver | undefined>;
  getDrivers(searchTerm?: string): Promise<Driver[]>;
  getDriverByCnic(cnic: string): Promise<Driver | undefined>;
  createDriver(driver: InsertDriver): Promise<Driver>;
  updateDriver(id: number, driver: Partial<InsertDriver>): Promise<Driver | undefined>;

  // User Activity Logging
  logUserActivity(activityLog: InsertUserActivityLog): Promise<UserActivityLog>;
  getUserActivityLogs(filters?: Partial<{
    userId: number;
    userEmail: string;
    actionType: string;
    entityType: string;
    dateFrom: Date;
    dateTo: Date;
  }>): Promise<UserActivityLog[]>;

  // Statistics
  getStatistics(): Promise<{
    totalPasses: number;
    monthlyPasses: number;
    weeklyPasses: number;
    pendingApprovals: number;
    statusDistribution: { status: string; count: number }[];
    departmentDistribution: { department: string; count: number }[];
    monthlyTrend: { month: string; count: number }[];
    dailyTrend: { date: string; count: number }[];
  }>;

  // Document operations
  getDocument(id: number): Promise<Document | undefined>;
  getDocumentsByEntity(entityType: string, entityId: number): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: number, documentData: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<boolean>;

  // Company operations
  getCompanies(): Promise<Company[]>;
  getCompany(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: number): Promise<boolean>;

  // Plants
  getPlants(companyId?: number): Promise<Plant[]>;
  getPlant(id: number): Promise<Plant | undefined>;
  createPlant(plant: InsertPlant): Promise<Plant>;
  updatePlant(id: number, plant: Partial<InsertPlant>): Promise<Plant | undefined>;
  deletePlant(id: number): Promise<boolean>;

  // Gates
  getGates(companyId?: number, plantId?: number): Promise<Gate[]>;
  getGate(id: number): Promise<Gate | undefined>;
  createGate(gate: InsertGate): Promise<Gate>;
  updateGate(id: number, gate: Partial<InsertGate>): Promise<Gate | undefined>;
  deleteGate(id: number): Promise<boolean>;

  // Vendors
  getVendors(companyId?: number): Promise<Vendor[]>;
  getVendor(id: number): Promise<Vendor | undefined>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: number, vendor: Partial<InsertVendor>): Promise<Vendor | undefined>;
  deleteVendor(id: number): Promise<boolean>;

  // Item Master
  getItemMasters(companyId?: number, plantId?: number): Promise<ItemMaster[]>;
  getItemMaster(id: number): Promise<ItemMaster | undefined>;
  createItemMaster(item: InsertItemMaster): Promise<ItemMaster>;
  updateItemMaster(id: number, item: Partial<InsertItemMaster>): Promise<ItemMaster | undefined>;
  deleteItemMaster(id: number): Promise<boolean>;

  // Utility methods
  generateGatePassNumber(): Promise<string>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private roles: Map<number, Role>;
  private permissions: Map<number, Permission>;
  private gatePasses: Map<number, GatePass>;
  private items: Map<number, Item>;
  private customers: Map<number, Customer>;
  private drivers: Map<number, Driver>;
  private documents: Map<number, Document>;
  private companySettings: Map<string, any>;
  private activityLogs: UserActivityLog[];
  private notifications: Map<number, Notification>;
  private currentId: number;

  async getStatistics(): Promise<{
    totalPasses: number;
    monthlyPasses: number;
    weeklyPasses: number;
    pendingApprovals: number;
    statusDistribution: { status: string; count: number }[];
    departmentDistribution: { department: string; count: number }[];
    monthlyTrend: { month: string; count: number }[];
    dailyTrend: { date: string; count: number }[];
  }> {
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
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(ilike(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [result] = await db
      .insert(users)
      .values(insertUser);
    const id = result.insertId;
    return this.getUser(id) as Promise<User>;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    await db
      .update(users)
      .set({
        ...userData,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
    return this.getUser(id);
  }

  async deleteUser(id: number): Promise<boolean> {
    const [result] = await db
      .delete(users)
      .where(eq(users.id, id));
    return result.affectedRows > 0;
  }

  // Gate Pass operations
  async getGatePass(id: number): Promise<GatePass | undefined> {
    const [gatePass] = await db.select().from(gatePasses).where(eq(gatePasses.id, id));
    return gatePass;
  }

  async getGatePassByNumber(gatePassNumber: string): Promise<GatePass | undefined> {
    const [gatePass] = await db
      .select()
      .from(gatePasses)
      .where(eq(gatePasses.gatePassNumber, gatePassNumber));
    return gatePass;
  }

  async createGatePass(gatePass: InsertGatePass): Promise<GatePass> {
    const gatePassNumber = await this.generateGatePassNumber();
    const [result] = await db
      .insert(gatePasses)
      .values({ ...gatePass, gatePassNumber });
    const id = result.insertId;
    return this.getGatePass(id) as Promise<GatePass>;
  }

  async updateGatePass(id: number, gatePass: Partial<InsertGatePass>): Promise<GatePass | undefined> {
    await db
      .update(gatePasses)
      .set(gatePass)
      .where(eq(gatePasses.id, id));
    return this.getGatePass(id);
  }

  async deleteGatePass(id: number): Promise<boolean> {
    const [result] = await db
      .delete(gatePasses)
      .where(eq(gatePasses.id, id));
    return result.affectedRows > 0;
  }

  async getGatePasses(filters?: Partial<{
    customerName: string;
    department: string;
    dateFrom: Date;
    dateTo: Date;
    gatePassNumber: string;
    itemName: string;
    createdById: number;
    status: string;
    companyId: number;
    type: string;
  }>): Promise<GatePass[]> {
    let query: any = db.select().from(gatePasses);

    if (filters) {
      const conditions = [];

      if (filters.customerName) {
        conditions.push(ilike(gatePasses.customerName, `%${filters.customerName}%`));
      }

      if (filters.department) {
        conditions.push(eq(gatePasses.department, filters.department));
      }

      if (filters.dateFrom) {
        conditions.push(gte(gatePasses.createdAt, filters.dateFrom));
      }

      if (filters.dateTo) {
        conditions.push(lte(gatePasses.createdAt, filters.dateTo));
      }

      if (filters.gatePassNumber) {
        conditions.push(eq(gatePasses.gatePassNumber, filters.gatePassNumber));
      }

      if (filters.createdById) {
        conditions.push(eq(gatePasses.createdById, filters.createdById));
      }

      if (filters.status) {
        conditions.push(eq(gatePasses.status, filters.status));
      }

      if (filters.companyId) {
        conditions.push(eq(gatePasses.companyId, filters.companyId));
      }

      if (filters.type) {
        conditions.push(eq((gatePasses as any).type, filters.type));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }

    query = query.orderBy(desc(gatePasses.createdAt));

    return query;
  }

  // Item operations
  async getItemsByGatePassId(gatePassId: number): Promise<Item[]> {
    return db
      .select()
      .from(items)
      .where(eq(items.gatePassId, gatePassId));
  }

  async createItem(item: InsertItem & { gatePassId: number }): Promise<Item> {
    const [result] = await db
      .insert(items)
      .values(item);
    return { ...item, id: result.insertId } as Item;
  }

  async deleteItemsByGatePassId(gatePassId: number): Promise<boolean> {
    const [result] = await db
      .delete(items)
      .where(eq(items.gatePassId, gatePassId));
    return (result as any).affectedRows > 0;
  }

  // Customer operations
  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async getCustomers(searchTerm?: string): Promise<Customer[]> {
    if (searchTerm) {
      return db
        .select()
        .from(customers)
        .where(
          or(
            ilike(customers.name, `%${searchTerm}%`),
            ilike(customers.email || '', `%${searchTerm}%`),
            ilike(drivers.mobile, `%${searchTerm}%`)
          )
        );
    }
    return db.select().from(customers);
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [result] = await db
      .insert(customers)
      .values(customer);
    const id = result.insertId;
    return this.getCustomer(id) as Promise<Customer>;
  }

  async updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined> {
    await db
      .update(customers)
      .set(customer)
      .where(eq(customers.id, id));
    return this.getCustomer(id);
  }

  // Driver operations
  async getDriver(id: number): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, id));
    return driver;
  }

  async getDrivers(searchTerm?: string): Promise<Driver[]> {
    if (searchTerm) {
      return db
        .select()
        .from(drivers)
        .where(
          or(
            ilike(drivers.name, `%${searchTerm}%`),
            ilike(drivers.cnic, `%${searchTerm}%`),
            ilike(drivers.mobile, `%${searchTerm}%`)
          )
        );
    }
    return db.select().from(drivers);
  }

  async getDriverByCnic(cnic: string): Promise<Driver | undefined> {
    const [driver] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.cnic, cnic));
    return driver;
  }

  async createDriver(driver: InsertDriver): Promise<Driver> {
    const [result] = await db
      .insert(drivers)
      .values(driver);
    const id = result.insertId;
    return this.getDriver(id) as Promise<Driver>;
  }

  async updateDriver(id: number, driver: Partial<InsertDriver>): Promise<Driver | undefined> {
    await db
      .update(drivers)
      .set(driver)
      .where(eq(drivers.id, id));
    return this.getDriver(id);
  }

  // User Activity Logging
  async logUserActivity(activityLog: InsertUserActivityLog): Promise<UserActivityLog> {
    const [newLog] = await db
      .insert(userActivityLogs)
      .values(activityLog); // Removed .returning()
    // For MemStorage simulation via DB, we can't easily return full object without re-selecting.
    // Given usage, returning input cast as Log might be enough or select it.
    // Since this method is likely unused (DatabaseStorage is used), simplified return is okay.
    return { ...activityLog, id: (newLog as any).insertId, timestamp: new Date() } as UserActivityLog;
  }

  async getUserActivityLogs(filters?: Partial<{
    userId: number;
    userEmail: string;
    actionType: string;
    entityType: string;
    dateFrom: Date;
    dateTo: Date;
  }>): Promise<UserActivityLog[]> {
    let query: any = db.select().from(userActivityLogs);

    if (filters) {
      const conditions = [];

      if (filters.userId) {
        conditions.push(eq(userActivityLogs.userId, filters.userId));
      }

      if (filters.userEmail) {
        conditions.push(ilike(userActivityLogs.userEmail, `%${filters.userEmail}%`));
      }

      if (filters.actionType) {
        conditions.push(eq(userActivityLogs.actionType, filters.actionType));
      }

      if (filters.entityType) {
        conditions.push(eq(userActivityLogs.entityType, filters.entityType));
      }

      if (filters.dateFrom) {
        conditions.push(gte(userActivityLogs.timestamp, filters.dateFrom));
      }

      if (filters.dateTo) {
        conditions.push(lte(userActivityLogs.timestamp, filters.dateTo));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }

    return query;
  }

  // Document operations
  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document;
  }

  async getDocumentsByEntity(entityType: string, entityId: number): Promise<Document[]> {
    return db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.entityType, entityType),
          eq(documents.entityId, entityId)
        )
      );
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [result] = await db
      .insert(documents)
      .values(document);
    const id = result.insertId;
    return this.getDocument(id) as Promise<Document>;
  }

  async updateDocument(id: number, documentData: Partial<InsertDocument>): Promise<Document | undefined> {
    await db.update(documents).set(documentData).where(eq(documents.id, id));
    return this.getDocument(id);
  }

  async deleteDocument(id: number): Promise<boolean> {
    const [result] = await db.delete(documents).where(eq(documents.id, id));
    return (result as any).affectedRows > 0;
  }

  // Utility methods
  async generateGatePassNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');

    const [{ count: countVal }] = await db
      .select({ count: count() })
      .from(gatePasses)
      .where(
        and(
          gte(gatePasses.createdAt, new Date(year, today.getMonth(), 1)),
          lte(gatePasses.createdAt, new Date(year, today.getMonth() + 1, 0))
        )
      );

    const sequence = (countVal + 1).toString().padStart(4, '0');
    return `GP${year}${month}${day}${sequence}`;
  }

  // Company operations (MemStorage delegates to DB)
  async getCompanies(): Promise<Company[]> {
    return db.select().from(companies);
  }

  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [result] = await db.insert(companies).values(company);
    return this.getCompany((result as any).insertId) as Promise<Company>;
  }

  async updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined> {
    await db.update(companies).set({ ...company, updatedAt: new Date() }).where(eq(companies.id, id));
    return this.getCompany(id);
  }

  async deleteCompany(id: number): Promise<boolean> {
    const [result] = await db.delete(companies).where(eq(companies.id, id));
    return (result as any).affectedRows > 0;
  }

  // Plants (stubs — MemStorage delegates to DatabaseStorage in practice)
  async getPlants(): Promise<Plant[]> { return []; }
  async getPlant(_id: number): Promise<Plant | undefined> { return undefined; }
  async createPlant(_plant: InsertPlant): Promise<Plant> { throw new Error("Use DatabaseStorage"); }
  async updatePlant(_id: number, _plant: Partial<InsertPlant>): Promise<Plant | undefined> { return undefined; }
  async deletePlant(_id: number): Promise<boolean> { return false; }

  // Gates (stubs)
  async getGates(): Promise<Gate[]> { return []; }
  async getGate(_id: number): Promise<Gate | undefined> { return undefined; }
  async createGate(_gate: InsertGate): Promise<Gate> { throw new Error("Use DatabaseStorage"); }
  async updateGate(_id: number, _gate: Partial<InsertGate>): Promise<Gate | undefined> { return undefined; }
  async deleteGate(_id: number): Promise<boolean> { return false; }

  // Vendors (stubs)
  async getVendors(): Promise<Vendor[]> { return []; }
  async getVendor(_id: number): Promise<Vendor | undefined> { return undefined; }
  async createVendor(_vendor: InsertVendor): Promise<Vendor> { throw new Error("Use DatabaseStorage"); }
  async updateVendor(_id: number, _vendor: Partial<InsertVendor>): Promise<Vendor | undefined> { return undefined; }
  async deleteVendor(_id: number): Promise<boolean> { return false; }

  // Item Master (stubs)
  async getItemMasters(): Promise<ItemMaster[]> { return []; }
  async getItemMaster(_id: number): Promise<ItemMaster | undefined> { return undefined; }
  async createItemMaster(_item: InsertItemMaster): Promise<ItemMaster> { throw new Error("Use DatabaseStorage"); }
  async updateItemMaster(_id: number, _item: Partial<InsertItemMaster>): Promise<ItemMaster | undefined> { return undefined; }
  async deleteItemMaster(_id: number): Promise<boolean> { return false; }
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  // User Activity Logging
  async logUserActivity(activityLog: InsertUserActivityLog): Promise<UserActivityLog> {
    const [result] = await db
      .insert(userActivityLogs)
      .values(activityLog);
    const id = result.insertId;
    const [log] = await db.select().from(userActivityLogs).where(eq(userActivityLogs.id, id));
    return log as UserActivityLog;
  }

  async getUserActivityLogs(filters?: Partial<{
    userId: number;
    userEmail: string;
    actionType: string;
    entityType: string;
    dateFrom: Date;
    dateTo: Date;
  }>): Promise<UserActivityLog[]> {
    let query: any = db.select().from(userActivityLogs);

    if (filters) {
      const conditions = [];

      if (filters.userId) {
        conditions.push(eq(userActivityLogs.userId, filters.userId));
      }

      if (filters.userEmail) {
        conditions.push(ilike(userActivityLogs.userEmail, `%${filters.userEmail}%`));
      }

      if (filters.actionType) {
        conditions.push(eq(userActivityLogs.actionType, filters.actionType));
      }

      if (filters.entityType) {
        conditions.push(eq(userActivityLogs.entityType, filters.entityType));
      }

      if (filters.dateFrom && filters.dateTo) {
        conditions.push(and(
          gte(userActivityLogs.timestamp, filters.dateFrom),
          lte(userActivityLogs.timestamp, filters.dateTo)
        ));
      } else if (filters.dateFrom) {
        conditions.push(gte(userActivityLogs.timestamp, filters.dateFrom));
      } else if (filters.dateTo) {
        conditions.push(lte(userActivityLogs.timestamp, filters.dateTo));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }

    // Sort by timestamp, newest first
    return query.orderBy(desc(userActivityLogs.timestamp));
  }
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [result] = await db
      .insert(users)
      .values(insertUser);
    const id = result.insertId;
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user as User;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    try {
      await db
        .update(users)
        .set({
          ...userData,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id));

      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user || undefined;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id));

    return (result as any).affectedRows > 0;
  }

  // Gate Pass operations
  async getGatePass(id: number): Promise<GatePass | undefined> {
    const [gatePass] = await db.select().from(gatePasses).where(eq(gatePasses.id, id));
    return gatePass || undefined;
  }

  async getGatePassByNumber(gatePassNumber: string): Promise<GatePass | undefined> {
    console.log("Looking for gate pass with number:", gatePassNumber);
    const normalizedInput = gatePassNumber.trim();

    const [gatePass] = await db
      .select()
      .from(gatePasses)
      .where(eq(gatePasses.gatePassNumber, normalizedInput));

    console.log("Found gate pass:", gatePass);
    return gatePass || undefined;
  }

  async createGatePass(insertGatePass: InsertGatePass): Promise<GatePass> {
    const gatePassNumber = await this.generateGatePassNumber();

    const [result] = await db
      .insert(gatePasses)
      .values({
        ...insertGatePass,
        gatePassNumber,
        status: insertGatePass.status || 'pending',
      });
    const id = result.insertId;
    const [gatePass] = await db.select().from(gatePasses).where(eq(gatePasses.id, id));
    return gatePass as GatePass;
  }

  async updateGatePass(id: number, gatePassUpdate: Partial<InsertGatePass>): Promise<GatePass | undefined> {
    await db
      .update(gatePasses)
      .set({
        ...gatePassUpdate,
        updatedAt: new Date(),
      })
      .where(eq(gatePasses.id, id));

    return this.getGatePass(id);
  }

  async deleteGatePass(id: number): Promise<boolean> {
    // First delete associated items
    await this.deleteItemsByGatePassId(id);

    // Then delete the gate pass
    const result = await db
      .delete(gatePasses)
      .where(eq(gatePasses.id, id));

    return (result as any).affectedRows > 0;
  }

  async getGatePasses(filters?: Partial<{
    customerName: string;
    department: string;
    dateFrom: Date;
    dateTo: Date;
    gatePassNumber: string;
    itemName: string;
    createdById: number;
    status: string;
    companyId: number;
    type: string;
  }>): Promise<GatePass[]> {
    let query: any = db.select().from(gatePasses);

    if (filters) {
      const conditions = [];

      if (filters.customerName) {
        conditions.push(ilike(gatePasses.customerName, `%${filters.customerName}%`));
      }

      if (filters.department) {
        conditions.push(eq(gatePasses.department, filters.department));
      }

      if (filters.gatePassNumber) {
        conditions.push(ilike(gatePasses.gatePassNumber, `%${filters.gatePassNumber}%`));
      }

      if (filters.createdById) {
        conditions.push(eq(gatePasses.createdById, filters.createdById));
      }

      if (filters.status) {
        conditions.push(eq(gatePasses.status, filters.status));
      }

      if (filters.companyId) {
        conditions.push(eq(gatePasses.companyId, filters.companyId));
      }

      if (filters.type) {
        conditions.push(eq((gatePasses as any).type, filters.type));
      }

      if (filters.dateFrom && filters.dateTo) {
        conditions.push(and(
          gte(sql`DATE(${gatePasses.date})`, sql`DATE(${filters.dateFrom.toISOString()})`),
          lte(sql`DATE(${gatePasses.date})`, sql`DATE(${filters.dateTo.toISOString()})`)
        ));
      } else if (filters.dateFrom) {
        conditions.push(gte(sql`DATE(${gatePasses.date})`, sql`DATE(${filters.dateFrom.toISOString()})`));
      } else if (filters.dateTo) {
        conditions.push(lte(sql`DATE(${gatePasses.date})`, sql`DATE(${filters.dateTo.toISOString()})`));
      }

      if (filters.itemName) {
        // Need to find gate passes with matching items
        const matchingGatePassIds = await db
          .select({ gatePassId: items.gatePassId })
          .from(items)
          .where(ilike(items.name, `%${filters.itemName}%`));

        const ids = matchingGatePassIds.map(item => item.gatePassId);

        if (ids.length > 0) {
          conditions.push(inArray(gatePasses.id, ids));
        } else {
          // No items match, return empty result
          return [];
        }
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }

    // Order by creation date, newest first
    return query.orderBy(desc(gatePasses.createdAt));
  }

  // Item operations
  async getItemsByGatePassId(gatePassId: number): Promise<Item[]> {
    return db
      .select()
      .from(items)
      .where(eq(items.gatePassId, gatePassId));
  }

  async createItem(item: InsertItem & { gatePassId: number }): Promise<Item> {
    const [result] = await db
      .insert(items)
      .values(item);
    const id = result.insertId;
    const [newItem] = await db.select().from(items).where(eq(items.id, id));
    return newItem as Item;
  }

  async deleteItemsByGatePassId(gatePassId: number): Promise<boolean> {
    const result = await db
      .delete(items)
      .where(eq(items.gatePassId, gatePassId));

    return (result as any).affectedRows > 0;
  }

  // Customer operations
  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id));

    return customer || undefined;
  }

  async getCustomers(searchTerm?: string): Promise<Customer[]> {
    let query: any = db.select().from(customers);

    if (searchTerm) {
      query = query.where(
        or(
          ilike(customers.name, `%${searchTerm}%`),
          ilike(customers.contactPerson, `%${searchTerm}%`)
        )
      );
    }

    return query.orderBy(customers.name);
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [result] = await db
      .insert(customers)
      .values({
        ...customer,
        email: customer.email || null,
        phone: customer.phone || null,
        address: customer.address || null,
        contactPerson: customer.contactPerson || null
      });
    const id = result.insertId;
    const [newCustomer] = await db.select().from(customers).where(eq(customers.id, id));
    return newCustomer as Customer;
  }

  async updateCustomer(id: number, customerUpdate: Partial<InsertCustomer>): Promise<Customer | undefined> {
    await db
      .update(customers)
      .set({
        ...customerUpdate,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id));

    return this.getCustomer(id);
  }

  // Driver operations
  async getDriver(id: number): Promise<Driver | undefined> {
    const [driver] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.id, id));

    return driver || undefined;
  }

  async getDrivers(searchTerm?: string): Promise<Driver[]> {
    let query: any = db.select().from(drivers);

    if (searchTerm) {
      query = query.where(
        or(
          ilike(drivers.name, `%${searchTerm}%`),
          ilike(drivers.cnic, `%${searchTerm}%`),
          ilike(drivers.mobile, `%${searchTerm}%`)
        )
      );
    }

    return query.orderBy(drivers.name);
  }

  async getDriverByCnic(cnic: string): Promise<Driver | undefined> {
    const [driver] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.cnic, cnic));

    return driver || undefined;
  }

  async createDriver(driver: InsertDriver): Promise<Driver> {
    const [result] = await db
      .insert(drivers)
      .values({
        ...driver,
        vehicleNumber: driver.vehicleNumber || null,
        // licenseNumber removed as it does not exist in schema
      });
    const id = result.insertId;
    const [newDriver] = await db.select().from(drivers).where(eq(drivers.id, id));
    return newDriver as Driver;
  }

  async updateDriver(id: number, driverUpdate: Partial<InsertDriver>): Promise<Driver | undefined> {
    await db
      .update(drivers)
      .set({
        ...driverUpdate,
        updatedAt: new Date(),
      })
      .where(eq(drivers.id, id));

    return this.getDriver(id);
  }

  // Product operations (Phase 5: SAP-synced catalog)
  async getProducts(companyId?: number, searchTerm?: string): Promise<Product[]> {
    const conditions: any[] = [eq(products.active, true)];
    if (companyId) conditions.push(eq(products.companyId, companyId));
    if (searchTerm) {
      conditions.push(or(
        ilike(products.name, `%${searchTerm}%`),
        ilike(products.sku || '', `%${searchTerm}%`)
      ));
    }
    return db.select().from(products).where(and(...conditions)).orderBy(products.name);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [result] = await db.insert(products).values(product);
    const id = (result as any).insertId;
    return this.getProduct(id) as Promise<Product>;
  }

  async updateProduct(id: number, update: Partial<InsertProduct>): Promise<Product | undefined> {
    await db.update(products).set({ ...update, updatedAt: new Date() } as any).where(eq(products.id, id));
    return this.getProduct(id);
  }

  async deleteProduct(id: number): Promise<boolean> {
    await db.update(products).set({ active: false } as any).where(eq(products.id, id));
    return true;
  }

  // Document operations
  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id));

    return document || undefined;
  }

  async getDocumentsByEntity(entityType: string, entityId: number): Promise<Document[]> {
    return db
      .select()
      .from(documents)
      .where(and(
        eq(documents.entityType, entityType),
        eq(documents.entityId, entityId)
      ))
      .orderBy(desc(documents.createdAt));
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [result] = await db
      .insert(documents)
      .values(document);
    const id = result.insertId;
    const [newDoc] = await db.select().from(documents).where(eq(documents.id, id));
    return newDoc as Document;
  }

  async updateDocument(id: number, documentData: Partial<InsertDocument>): Promise<Document | undefined> {
    await db.update(documents).set(documentData).where(eq(documents.id, id));
    return this.getDocument(id);
  }

  async deleteDocument(id: number): Promise<boolean> {
    const [result] = await db
      .delete(documents)
      .where(eq(documents.id, id));

    return (result as any).affectedRows > 0;
  }

  // Statistics
  async getStatistics(): Promise<{
    totalPasses: number;
    monthlyPasses: number;
    weeklyPasses: number;
    pendingApprovals: number;
    statusDistribution: { status: string; count: number }[];
    departmentDistribution: { department: string; count: number }[];
    monthlyTrend: { month: string; count: number }[];
    dailyTrend: { date: string; count: number }[];
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    // Get total passes
    const [{ count: totalPasses }] = await db
      .select({ count: count() })
      .from(gatePasses);

    // Get monthly passes
    const [{ count: monthlyPasses }] = await db
      .select({ count: count() })
      .from(gatePasses)
      .where(gte(gatePasses.createdAt, startOfMonth));

    // Get weekly passes
    const [{ count: weeklyPasses }] = await db
      .select({ count: count() })
      .from(gatePasses)
      .where(gte(gatePasses.createdAt, startOfWeek));

    // Get pending approvals
    const [{ count: pendingApprovals }] = await db
      .select({ count: count() })
      .from(gatePasses)
      .where(eq(gatePasses.status, 'pending'));

    // Get status distribution
    const statusDistribution = await db
      .select({
        status: gatePasses.status,
        count: count()
      })
      .from(gatePasses)
      .groupBy(gatePasses.status)
      .orderBy(desc(count()));

    // Get department distribution
    const departmentDistribution = await db
      .select({
        department: gatePasses.department,
        count: count()
      })
      .from(gatePasses)
      .groupBy(gatePasses.department)
      .orderBy(desc(count()));

    // Get monthly trend for last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyTrend = await db
      .select({
        month: sql<string>`DATE_FORMAT(${gatePasses.createdAt}, '%Y-%m')`,
        count: count()
      })
      .from(gatePasses)
      .where(gte(gatePasses.createdAt, sixMonthsAgo))
      .groupBy(sql`DATE_FORMAT(${gatePasses.createdAt}, '%Y-%m')`)
      .orderBy(sql`DATE_FORMAT(${gatePasses.createdAt}, '%Y-%m')`);

    // Get daily trend for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dailyTrend = await db
      .select({
        date: sql<string>`DATE_FORMAT(${gatePasses.createdAt}, '%Y-%m-%d')`,
        count: count()
      })
      .from(gatePasses)
      .where(gte(gatePasses.createdAt, thirtyDaysAgo))
      .groupBy(sql`DATE_FORMAT(${gatePasses.createdAt}, '%Y-%m-%d')`)
      .orderBy(sql`DATE_FORMAT(${gatePasses.createdAt}, '%Y-%m-%d')`);

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
  async generateGatePassNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear().toString().slice(2);  // Get last two digits of year
    const month = (now.getMonth() + 1).toString().padStart(2, '0');

    // Find the latest gate pass number to increment it
    const latestGatePass = await db
      .select({ number: gatePasses.gatePassNumber })
      .from(gatePasses)
      .orderBy(desc(gatePasses.createdAt))
      .limit(1);

    let sequenceNumber = 1;

    if (latestGatePass.length > 0 && latestGatePass[0].number) {
      const latestNumber = latestGatePass[0].number;
      // Try matching our current format: PZGP-001
      let matches = latestNumber.match(/PZGP-(\d+)/);

      if (matches && matches[1]) {
        sequenceNumber = parseInt(matches[1], 10) + 1;
      } else {
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

  // Company operations
  async getCompanies(): Promise<Company[]> {
    return db.select().from(companies);
  }

  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [result] = await db.insert(companies).values(company);
    const id = (result as any).insertId;
    return this.getCompany(id) as Promise<Company>;
  }

  async updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined> {
    await db.update(companies).set({ ...company, updatedAt: new Date() }).where(eq(companies.id, id));
    return this.getCompany(id);
  }

  async deleteCompany(id: number): Promise<boolean> {
    const [result] = await db.delete(companies).where(eq(companies.id, id));
    return (result as any).affectedRows > 0;
  }

  // Plants
  async getPlants(companyId?: number): Promise<Plant[]> {
    if (companyId) return db.select().from(plants).where(eq(plants.companyId, companyId)).orderBy(plants.name);
    return db.select().from(plants).orderBy(plants.name);
  }
  async getPlant(id: number): Promise<Plant | undefined> {
    const [row] = await db.select().from(plants).where(eq(plants.id, id));
    return row ?? undefined;
  }
  async createPlant(plant: InsertPlant): Promise<Plant> {
    const [r] = await db.insert(plants).values(plant);
    return this.getPlant((r as any).insertId) as Promise<Plant>;
  }
  async updatePlant(id: number, plant: Partial<InsertPlant>): Promise<Plant | undefined> {
    await db.update(plants).set({ ...plant, updatedAt: new Date() } as any).where(eq(plants.id, id));
    return this.getPlant(id);
  }
  async deletePlant(id: number): Promise<boolean> {
    await db.update(plants).set({ active: false } as any).where(eq(plants.id, id));
    return true;
  }

  // Gates
  async getGates(companyId?: number, plantId?: number): Promise<Gate[]> {
    const conditions: any[] = [];
    if (companyId) conditions.push(eq(gates.companyId, companyId));
    if (plantId) conditions.push(eq(gates.plantId, plantId));
    if (conditions.length > 0) return db.select().from(gates).where(and(...conditions)).orderBy(gates.name);
    return db.select().from(gates).orderBy(gates.name);
  }
  async getGate(id: number): Promise<Gate | undefined> {
    const [row] = await db.select().from(gates).where(eq(gates.id, id));
    return row ?? undefined;
  }
  async createGate(gate: InsertGate): Promise<Gate> {
    const [r] = await db.insert(gates).values(gate);
    return this.getGate((r as any).insertId) as Promise<Gate>;
  }
  async updateGate(id: number, gate: Partial<InsertGate>): Promise<Gate | undefined> {
    await db.update(gates).set({ ...gate, updatedAt: new Date() } as any).where(eq(gates.id, id));
    return this.getGate(id);
  }
  async deleteGate(id: number): Promise<boolean> {
    await db.update(gates).set({ active: false } as any).where(eq(gates.id, id));
    return true;
  }

  // Vendors
  async getVendors(companyId?: number): Promise<Vendor[]> {
    if (companyId) return db.select().from(vendors).where(eq(vendors.companyId, companyId)).orderBy(vendors.name);
    return db.select().from(vendors).orderBy(vendors.name);
  }
  async getVendor(id: number): Promise<Vendor | undefined> {
    const [row] = await db.select().from(vendors).where(eq(vendors.id, id));
    return row ?? undefined;
  }
  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    const [r] = await db.insert(vendors).values(vendor);
    return this.getVendor((r as any).insertId) as Promise<Vendor>;
  }
  async updateVendor(id: number, vendor: Partial<InsertVendor>): Promise<Vendor | undefined> {
    await db.update(vendors).set({ ...vendor, updatedAt: new Date() } as any).where(eq(vendors.id, id));
    return this.getVendor(id);
  }
  async deleteVendor(id: number): Promise<boolean> {
    await db.update(vendors).set({ active: false } as any).where(eq(vendors.id, id));
    return true;
  }

  // Item Master
  async getItemMasters(companyId?: number, plantId?: number): Promise<ItemMaster[]> {
    const conditions: any[] = [];
    if (companyId) conditions.push(eq(itemMaster.companyId, companyId));
    if (plantId) conditions.push(eq(itemMaster.plantId, plantId));
    if (conditions.length > 0) return db.select().from(itemMaster).where(and(...conditions)).orderBy(itemMaster.name);
    return db.select().from(itemMaster).orderBy(itemMaster.name);
  }
  async getItemMaster(id: number): Promise<ItemMaster | undefined> {
    const [row] = await db.select().from(itemMaster).where(eq(itemMaster.id, id));
    return row ?? undefined;
  }
  async createItemMaster(item: InsertItemMaster): Promise<ItemMaster> {
    const [r] = await db.insert(itemMaster).values(item);
    return this.getItemMaster((r as any).insertId) as Promise<ItemMaster>;
  }
  async updateItemMaster(id: number, item: Partial<InsertItemMaster>): Promise<ItemMaster | undefined> {
    await db.update(itemMaster).set({ ...item, updatedAt: new Date() } as any).where(eq(itemMaster.id, id));
    return this.getItemMaster(id);
  }
  async deleteItemMaster(id: number): Promise<boolean> {
    await db.update(itemMaster).set({ active: false } as any).where(eq(itemMaster.id, id));
    return true;
  }
}

// Use database storage instead of memory storage
export const storage = new DatabaseStorage();
