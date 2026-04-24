import {
  users, gatePasses, items, customers, drivers, roles, permissions, userActivityLogs, documents, companies, products,
  plants, gates, vendors, itemMaster, reportTemplates,
  type User, type InsertUser,
  type GatePass, type InsertGatePass,
  type Item, type InsertItem,
  type Customer, type InsertCustomer,
  type Driver, type InsertDriver,
  type Role, type Permission,
  type UserActivityLog, type InsertUserActivityLog,
  type Document, type InsertDocument,
  type Notification, type InsertNotification,
  notifications,
  type Company, type InsertCompany,
  type Product, type InsertProduct,
  type Plant, type InsertPlant,
  type Gate, type InsertGate,
  type Vendor, type InsertVendor,
  type ItemMaster, type InsertItemMaster,
  type ReportTemplate, type InsertReportTemplate,
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
  getCustomers(searchTerm?: string, companyId?: number): Promise<Customer[]>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;

  // Driver operations
  getDriver(id: number): Promise<Driver | undefined>;
  getDrivers(searchTerm?: string, companyId?: number): Promise<Driver[]>;
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
  }>, pagination?: { page: number; limit: number }): Promise<{ logs: UserActivityLog[]; total: number }>;

  // Statistics
  getStatistics(): Promise<{
    totalPasses: number;
    monthlyPasses: number;
    weeklyPasses: number;
    pendingApprovals: number;
    pendingHOD: number;
    pendingSecurity: number;
    sentBack: number;
    typeDistribution: { type: string; count: number }[];
    statusDistribution: { status: string; count: number }[];
    departmentDistribution: { department: string; count: number }[];
    monthlyTrend: { month: string; count: number }[];
    dailyTrend: { date: string; count: number }[];
  }>;

  // Document operations
  getDocument(id: number): Promise<Document | undefined>;
  getDocumentsByEntity(entityType: string, entityId: number): Promise<Document[]>;
  getAllDocuments(filters?: { entityType?: string; search?: string; dateFrom?: Date; dateTo?: Date }): Promise<Omit<Document, 'fileData'>[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: number, documentData: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<boolean>;

  // Company operations
  getCompanies(): Promise<Company[]>;
  getCompany(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: number): Promise<boolean>;

  // Password reset operations (Phase 10)
  setPasswordResetToken(userId: number, token: string, expiry: Date): Promise<void>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  clearPasswordResetToken(userId: number): Promise<void>;

  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotifications(userId: number, limit?: number): Promise<Notification[]>;
  getUnreadNotificationCount(userId: number): Promise<number>;
  markNotificationRead(id: number, userId: number): Promise<boolean>;
  markAllNotificationsRead(userId: number): Promise<boolean>;

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

  // Report Template operations
  getReportTemplates(userId: number, companyId?: number): Promise<ReportTemplate[]>;
  getReportTemplate(id: number): Promise<ReportTemplate | undefined>;
  createReportTemplate(data: InsertReportTemplate): Promise<ReportTemplate>;
  updateReportTemplate(id: number, data: Partial<InsertReportTemplate>): Promise<ReportTemplate | undefined>;
  deleteReportTemplate(id: number): Promise<boolean>;

  // Utility methods
  generateGatePassNumber(companyId?: number | null, type?: string, department?: string): Promise<string>;
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
    pendingHOD: number;
    pendingSecurity: number;
    sentBack: number;
    typeDistribution: { type: string; count: number }[];
    statusDistribution: { status: string; count: number }[];
    departmentDistribution: { department: string; count: number }[];
    monthlyTrend: { month: string; count: number }[];
    dailyTrend: { date: string; count: number }[];
  }> {
    return {
      totalPasses: 0,
      monthlyPasses: 0,
      weeklyPasses: 0,
      pendingApprovals: 0,
      pendingHOD: 0,
      pendingSecurity: 0,
      sentBack: 0,
      typeDistribution: [],
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
      email: "admin@agp.com.pk",
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
      email: "john@agp.com.pk",
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
    const gatePassNumber = await this.generateGatePassNumber(gatePass.companyId, (gatePass as any).type, gatePass.department);
    const [result] = await db
      .insert(gatePasses)
      .values({
        ...gatePass,
        gatePassNumber,
        driverName: gatePass.driverName || "",
        driverMobile: gatePass.driverMobile || "",
        driverCnic: gatePass.driverCnic || "",
        deliveryVanNumber: gatePass.deliveryVanNumber || "",
      });
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
    dateFrom: string;
    dateTo: string;
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
        conditions.push(like(gatePasses.customerName, `%${filters.customerName}%`));
      }

      if (filters.department) {
        conditions.push(eq(gatePasses.department, filters.department));
      }

      if (filters.dateFrom) {
        conditions.push(gte(sql`DATE(${gatePasses.date})`, filters.dateFrom));
      }

      if (filters.dateTo) {
        conditions.push(lte(sql`DATE(${gatePasses.date})`, filters.dateTo));
      }

      if (filters.gatePassNumber) {
        conditions.push(like(gatePasses.gatePassNumber, `%${filters.gatePassNumber}%`));
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

  async getCustomers(searchTerm?: string, companyId?: number): Promise<Customer[]> {
    const conditions: any[] = [];
    if (companyId) conditions.push(eq(customers.companyId, companyId));
    if (searchTerm) {
      conditions.push(
        or(
          ilike(customers.name, `%${searchTerm}%`),
          ilike(customers.phone || '', `%${searchTerm}%`)
        )
      );
    }
    const query = db.select().from(customers);
    if (conditions.length > 0) {
      return (query as any).where(and(...conditions));
    }
    return query;
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

  async getDrivers(searchTerm?: string, companyId?: number): Promise<Driver[]> {
    const conditions: any[] = [];
    if (companyId) conditions.push(eq(drivers.companyId, companyId));
    if (searchTerm) {
      conditions.push(or(
        ilike(drivers.name, `%${searchTerm}%`),
        ilike(drivers.cnic, `%${searchTerm}%`),
        ilike(drivers.mobile, `%${searchTerm}%`)
      ));
    }
    const query = db.select().from(drivers);
    if (conditions.length > 0) return (query as any).where(and(...conditions));
    return query;
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
  }>, pagination?: { page: number; limit: number }): Promise<{ logs: UserActivityLog[]; total: number }> {
    let query: any = db.select().from(userActivityLogs);

    if (filters) {
      const conditions = [];
      if (filters.userId) conditions.push(eq(userActivityLogs.userId, filters.userId));
      if (filters.userEmail) conditions.push(ilike(userActivityLogs.userEmail, `%${filters.userEmail}%`));
      if (filters.actionType) conditions.push(eq(userActivityLogs.actionType, filters.actionType));
      if (filters.entityType) conditions.push(eq(userActivityLogs.entityType, filters.entityType));
      if (filters.dateFrom) conditions.push(gte(userActivityLogs.timestamp, filters.dateFrom));
      if (filters.dateTo) conditions.push(lte(userActivityLogs.timestamp, filters.dateTo));
      if (conditions.length > 0) query = query.where(and(...conditions));
    }

    const allLogs = await query.orderBy(desc(userActivityLogs.timestamp));
    const total = allLogs.length;

    if (pagination) {
      const { page, limit } = pagination;
      const offset = (page - 1) * limit;
      return { logs: allLogs.slice(offset, offset + limit), total };
    }

    return { logs: allLogs, total };
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

  async getAllDocuments(filters?: { entityType?: string; search?: string; dateFrom?: Date; dateTo?: Date }): Promise<Omit<Document, 'fileData'>[]> {
    const conditions: any[] = [];
    if (filters?.entityType) conditions.push(eq(documents.entityType, filters.entityType));
    if (filters?.search) conditions.push(ilike(documents.fileName, `%${filters.search}%`));
    if (filters?.dateFrom) conditions.push(gte(documents.createdAt, filters.dateFrom));
    if (filters?.dateTo) conditions.push(lte(documents.createdAt, filters.dateTo));
    return db.select({
      id: documents.id, fileName: documents.fileName, fileType: documents.fileType,
      fileSize: documents.fileSize, entityType: documents.entityType, entityId: documents.entityId,
      description: documents.description, uploadedBy: documents.uploadedBy,
      uploadedByEmail: documents.uploadedByEmail, createdAt: documents.createdAt,
    }).from(documents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(documents.createdAt));
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
  async generateGatePassNumber(_companyId?: number | null, _type?: string, _department?: string): Promise<string> {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(2);
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const seq = (this.gatePasses.size + 1).toString().padStart(4, '0');
    return `GP-${yy}${mm}-${seq}`;
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

  // Notifications (stubs)
  async createNotification(_n: InsertNotification): Promise<Notification> { throw new Error("Use DatabaseStorage"); }
  async getNotifications(_userId: number, _limit?: number): Promise<Notification[]> { return []; }
  async getUnreadNotificationCount(_userId: number): Promise<number> { return 0; }
  async markNotificationRead(_id: number, _userId: number): Promise<boolean> { return false; }
  async markAllNotificationsRead(_userId: number): Promise<boolean> { return false; }

  // Password reset (stubs)
  async setPasswordResetToken(_userId: number, _token: string, _expiry: Date): Promise<void> {}
  async getUserByResetToken(_token: string): Promise<User | undefined> { return undefined; }
  async clearPasswordResetToken(_userId: number): Promise<void> {}

  // Report Template (stubs)
  async getReportTemplates(_userId: number, _companyId?: number): Promise<ReportTemplate[]> { return []; }
  async getReportTemplate(_id: number): Promise<ReportTemplate | undefined> { return undefined; }
  async createReportTemplate(_data: InsertReportTemplate): Promise<ReportTemplate> { throw new Error("Use DatabaseStorage"); }
  async updateReportTemplate(_id: number, _data: Partial<InsertReportTemplate>): Promise<ReportTemplate | undefined> { return undefined; }
  async deleteReportTemplate(_id: number): Promise<boolean> { return false; }
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
  }>, pagination?: { page: number; limit: number }): Promise<{ logs: UserActivityLog[]; total: number }> {
    const conditions: any[] = [];

    if (filters) {
      if (filters.userId) conditions.push(eq(userActivityLogs.userId, filters.userId));
      if (filters.userEmail) conditions.push(ilike(userActivityLogs.userEmail, `%${filters.userEmail}%`));
      if (filters.actionType) conditions.push(eq(userActivityLogs.actionType, filters.actionType));
      if (filters.entityType) conditions.push(eq(userActivityLogs.entityType, filters.entityType));
      if (filters.dateFrom) conditions.push(gte(userActivityLogs.timestamp, filters.dateFrom));
      if (filters.dateTo) conditions.push(lte(userActivityLogs.timestamp, filters.dateTo));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total
    const [{ cnt }] = await db
      .select({ cnt: sql<number>`count(*)` })
      .from(userActivityLogs)
      .where(whereClause as any);
    const total = Number(cnt);

    // Fetch page
    let logsQuery: any = db
      .select()
      .from(userActivityLogs)
      .where(whereClause as any)
      .orderBy(desc(userActivityLogs.timestamp));

    if (pagination) {
      const { page, limit } = pagination;
      logsQuery = logsQuery.limit(limit).offset((page - 1) * limit);
    }

    const logs = await logsQuery;
    return { logs, total };
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
    const gatePassNumber = await this.generateGatePassNumber(insertGatePass.companyId, (insertGatePass as any).type, insertGatePass.department);

    const [result] = await db
      .insert(gatePasses)
      .values({
        ...insertGatePass,
        gatePassNumber,
        status: insertGatePass.status || 'pending',
        driverName: insertGatePass.driverName || "",
        driverMobile: insertGatePass.driverMobile || "",
        driverCnic: insertGatePass.driverCnic || "",
        deliveryVanNumber: insertGatePass.deliveryVanNumber || "",
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
    dateFrom: string;   // YYYY-MM-DD string — avoids timezone conversion issues
    dateTo: string;     // YYYY-MM-DD string
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
        // MySQL LIKE is already case-insensitive with utf8mb4_unicode_ci
        conditions.push(like(gatePasses.customerName, `%${filters.customerName}%`));
      }

      if (filters.department) {
        conditions.push(eq(gatePasses.department, filters.department));
      }

      if (filters.gatePassNumber) {
        conditions.push(like(gatePasses.gatePassNumber, `%${filters.gatePassNumber}%`));
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

      if (filters.dateFrom) {
        conditions.push(gte(sql`DATE(${gatePasses.date})`, filters.dateFrom));
      }
      if (filters.dateTo) {
        conditions.push(lte(sql`DATE(${gatePasses.date})`, filters.dateTo));
      }

      if (filters.itemName) {
        // Find gate passes that have a matching item name
        const matchingGatePassIds = await db
          .select({ gatePassId: items.gatePassId })
          .from(items)
          .where(like(items.name, `%${filters.itemName}%`));

        const ids = matchingGatePassIds.map(item => item.gatePassId);

        if (ids.length > 0) {
          conditions.push(inArray(gatePasses.id, ids));
        } else {
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

  async getCustomers(searchTerm?: string, companyId?: number): Promise<Customer[]> {
    const conditions: any[] = [];
    if (companyId) conditions.push(eq(customers.companyId, companyId));
    if (searchTerm) {
      conditions.push(
        or(
          ilike(customers.name, `%${searchTerm}%`),
          ilike(customers.phone || '', `%${searchTerm}%`)
        )
      );
    }
    let query: any = db.select().from(customers);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
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

  async getDrivers(searchTerm?: string, companyId?: number): Promise<Driver[]> {
    const conditions: any[] = [];
    if (companyId) conditions.push(eq(drivers.companyId, companyId));
    if (searchTerm) {
      conditions.push(or(
        ilike(drivers.name, `%${searchTerm}%`),
        ilike(drivers.cnic, `%${searchTerm}%`),
        ilike(drivers.mobile, `%${searchTerm}%`)
      ));
    }
    let query: any = db.select().from(drivers);
    if (conditions.length > 0) query = query.where(and(...conditions));
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

  async getAllDocuments(filters?: { entityType?: string; search?: string; dateFrom?: Date; dateTo?: Date }): Promise<Omit<Document, 'fileData'>[]> {
    const conditions: any[] = [];
    if (filters?.entityType) conditions.push(eq(documents.entityType, filters.entityType));
    if (filters?.search) conditions.push(ilike(documents.fileName, `%${filters.search}%`));
    if (filters?.dateFrom) conditions.push(gte(documents.createdAt, filters.dateFrom));
    if (filters?.dateTo) {
      const d = new Date(filters.dateTo); d.setHours(23, 59, 59, 999);
      conditions.push(lte(documents.createdAt, d));
    }
    return db.select({
      id: documents.id, fileName: documents.fileName, fileType: documents.fileType,
      fileSize: documents.fileSize, entityType: documents.entityType, entityId: documents.entityId,
      description: documents.description, uploadedBy: documents.uploadedBy,
      uploadedByEmail: documents.uploadedByEmail, createdAt: documents.createdAt,
    }).from(documents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
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
    pendingHOD: number;
    pendingSecurity: number;
    sentBack: number;
    typeDistribution: { type: string; count: number }[];
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

    // Workflow pending counts
    const [{ count: pendingHOD }] = await db
      .select({ count: count() })
      .from(gatePasses)
      .where(eq(gatePasses.status, 'pending'));

    const [{ count: pendingSecurity }] = await db
      .select({ count: count() })
      .from(gatePasses)
      .where(eq(gatePasses.status, 'hod_approved'));

    const [{ count: sentBackCount }] = await db
      .select({ count: count() })
      .from(gatePasses)
      .where(eq(gatePasses.status, 'sent_back'));

    const pendingApprovals = Number(pendingHOD) + Number(pendingSecurity) + Number(sentBackCount);

    // Get type distribution
    const typeDistribution = await db
      .select({
        type: gatePasses.type,
        count: count()
      })
      .from(gatePasses)
      .groupBy(gatePasses.type)
      .orderBy(desc(count()));

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
      pendingApprovals,
      pendingHOD: Number(pendingHOD),
      pendingSecurity: Number(pendingSecurity),
      sentBack: Number(sentBackCount),
      typeDistribution,
      statusDistribution,
      departmentDistribution,
      monthlyTrend,
      dailyTrend
    };
  }

  // Utility methods
  async generateGatePassNumber(companyId?: number | null, type?: string, department?: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear().toString(); // full 4-digit year e.g. 2026

    // Type prefix: OWNR (non-returnable outward), OWR (returnable), INW (inward)
    let typePrefix: string;
    if (type === "returnable") {
      typePrefix = "OWR";
    } else if (type === "inward") {
      typePrefix = "INW";
    } else {
      typePrefix = "OWNR"; // default: outward non-returnable
    }

    // Company code from DB (e.g. AG01)
    let companyCode = "XX";
    if (companyId) {
      const [company] = await db
        .select({ code: companies.code })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);
      if (company?.code?.trim()) {
        companyCode = company.code.trim().toUpperCase();
      }
    }

    // Department initials: first letter of each word, uppercase
    // e.g. "Information Solutions" → "IS", "Supply Chain" → "SC", "Finance" → "FIN"
    let deptCode = "GN"; // generic default
    if (department?.trim()) {
      const words = department.trim().split(/\s+/);
      if (words.length === 1) {
        deptCode = words[0].slice(0, 3).toUpperCase();
      } else {
        deptCode = words.map(w => w[0]).join("").toUpperCase();
      }
    }

    // Find the highest sequence for this company in the current year
    const latestGatePasses = await db
      .select({ number: gatePasses.gatePassNumber })
      .from(gatePasses)
      .where(companyId ? eq(gatePasses.companyId, companyId) : sql`1=1`)
      .orderBy(desc(gatePasses.createdAt))
      .limit(50); // look at last 50 to find max sequence

    let sequenceNumber = 1;
    for (const row of latestGatePasses) {
      if (!row.number) continue;
      // Match new format: PREFIX-COMPANYCODE-DEPT-YEAR-NNNN
      const m = row.number.match(/-(\d{4})$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n >= sequenceNumber) sequenceNumber = n + 1;
      }
    }

    return `${typePrefix}-${companyCode}-${deptCode}-${year}-${sequenceNumber.toString().padStart(4, '0')}`;
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

  // Notification operations
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [r] = await db.insert(notifications).values(notification);
    const [row] = await db.select().from(notifications).where(eq(notifications.id, (r as any).insertId));
    return row;
  }

  async getNotifications(userId: number, limit = 50): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotificationCount(userId: number): Promise<number> {
    const [row] = await db.select({ cnt: count() }).from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return row?.cnt ?? 0;
  }

  async markNotificationRead(id: number, userId: number): Promise<boolean> {
    await db.update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    return true;
  }

  async markAllNotificationsRead(userId: number): Promise<boolean> {
    await db.update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, userId));
    return true;
  }

  // Password reset operations (Phase 10)
  async setPasswordResetToken(userId: number, token: string, expiry: Date): Promise<void> {
    await db.update(users)
      .set({ passwordResetToken: token, passwordResetExpiry: expiry } as any)
      .where(eq(users.id, userId));
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [row] = await db.select().from(users)
      .where(eq(users.passwordResetToken as any, token))
      .limit(1);
    return row ?? undefined;
  }

  async clearPasswordResetToken(userId: number): Promise<void> {
    await db.update(users)
      .set({ passwordResetToken: null, passwordResetExpiry: null } as any)
      .where(eq(users.id, userId));
  }

  // Report Template operations
  async getReportTemplates(userId: number, companyId?: number): Promise<ReportTemplate[]> {
    if (companyId) {
      // Also include shared templates for the same company
      return db.select().from(reportTemplates)
        .where(or(
          eq(reportTemplates.userId, userId),
          and(eq(reportTemplates.isShared, true), eq(reportTemplates.companyId, companyId))
        ))
        .orderBy(desc(reportTemplates.createdAt));
    }
    return db.select().from(reportTemplates)
      .where(eq(reportTemplates.userId, userId))
      .orderBy(desc(reportTemplates.createdAt));
  }

  async getReportTemplate(id: number): Promise<ReportTemplate | undefined> {
    const [row] = await db.select().from(reportTemplates).where(eq(reportTemplates.id, id));
    return row ?? undefined;
  }

  async createReportTemplate(data: InsertReportTemplate): Promise<ReportTemplate> {
    const [r] = await db.insert(reportTemplates).values(data);
    return this.getReportTemplate((r as any).insertId) as Promise<ReportTemplate>;
  }

  async updateReportTemplate(id: number, data: Partial<InsertReportTemplate>): Promise<ReportTemplate | undefined> {
    await db.update(reportTemplates)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(reportTemplates.id, id));
    return this.getReportTemplate(id);
  }

  async deleteReportTemplate(id: number): Promise<boolean> {
    const [result] = await db.delete(reportTemplates).where(eq(reportTemplates.id, id));
    return (result as any).affectedRows > 0;
  }
}

// Use database storage instead of memory storage
export const storage = new DatabaseStorage();
