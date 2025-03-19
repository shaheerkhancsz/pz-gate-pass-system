import { 
  users, gatePasses, items, customers, drivers, roles, permissions, userActivityLogs, documents,
  type User, type InsertUser, 
  type GatePass, type InsertGatePass, 
  type Item, type InsertItem,
  type Customer, type InsertCustomer,
  type Driver, type InsertDriver,
  type Role, type Permission,
  type UserActivityLog, type InsertUserActivityLog,
  type Document, type InsertDocument
} from "@shared/schema";
import { db } from "./db";
import { and, count, desc, eq, gte, ilike, inArray, like, lte, or, sql, isNotNull } from "drizzle-orm";

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
  
  // Utility methods
  generateGatePassNumber(): Promise<string>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private gatePasses: Map<number, GatePass>;
  private items: Map<number, Item>;
  private customers: Map<number, Customer>;
  private drivers: Map<number, Driver>;
  private userActivityLogs: Map<number, UserActivityLog>;
  private documents: Map<number, Document>;
  private currentUserId: number;
  private currentGatePassId: number;
  private currentItemId: number;
  private currentCustomerId: number;
  private currentDriverId: number;
  private currentActivityLogId: number;
  private currentDocumentId: number;
  private lastGatePassNumber: number;

  constructor() {
    this.users = new Map();
    this.gatePasses = new Map();
    this.items = new Map();
    this.customers = new Map();
    this.drivers = new Map();
    this.userActivityLogs = new Map();
    this.documents = new Map();
    this.currentUserId = 1;
    this.currentGatePassId = 1;
    this.currentItemId = 1;
    this.currentCustomerId = 1;
    this.currentDriverId = 1;
    this.currentActivityLogId = 1;
    this.currentDocumentId = 1;
    this.lastGatePassNumber = 0;
    
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
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const createdAt = new Date();
    const updatedAt = new Date();
    
    // Ensure all fields have values to satisfy the type constraints
    const user: User = { 
      ...insertUser, 
      id, 
      createdAt,
      updatedAt,
      roleId: insertUser.roleId || null,
      active: insertUser.active !== undefined ? insertUser.active : true,
      phoneNumber: insertUser.phoneNumber || null,
      cnic: insertUser.cnic || null
    };
    
    this.users.set(id, user);
    return user;
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const existingUser = this.users.get(id);
    
    if (!existingUser) {
      return undefined;
    }
    
    const updatedUser: User = {
      ...existingUser,
      ...userData,
      updatedAt: new Date()
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  // Gate Pass operations
  async getGatePass(id: number): Promise<GatePass | undefined> {
    return this.gatePasses.get(id);
  }

  async getGatePassByNumber(gatePassNumber: string): Promise<GatePass | undefined> {
    // Trim and normalize the gate pass number for comparison
    const normalizedInput = gatePassNumber.trim();
    console.log("Looking for gate pass with normalized number:", normalizedInput);
    
    // For debugging, output all gate pass numbers in storage
    const allGatePasses = Array.from(this.gatePasses.values());
    console.log("All gate passes in storage:", allGatePasses.map(gp => gp.gatePassNumber));
    
    return allGatePasses.find(gatePass => {
      // Exact match
      if (gatePass.gatePassNumber === normalizedInput) {
        console.log("Found exact match for gate pass:", gatePass.gatePassNumber);
        return true;
      }
      
      // Try case-insensitive match
      if (gatePass.gatePassNumber.toLowerCase() === normalizedInput.toLowerCase()) {
        console.log("Found case-insensitive match for gate pass:", gatePass.gatePassNumber);
        return true;
      }
      
      return false;
    });
  }

  async createGatePass(insertGatePass: InsertGatePass): Promise<GatePass> {
    const id = this.currentGatePassId++;
    const gatePassNumber = await this.generateGatePassNumber();
    const createdAt = new Date();
    
    const gatePass: GatePass = {
      ...insertGatePass,
      id,
      gatePassNumber,
      createdAt,
      // Ensure required fields have values
      status: insertGatePass.status || 'pending',
      customerPhone: insertGatePass.customerPhone || null,
      notes: insertGatePass.notes || null,
      customerId: insertGatePass.customerId || null,
      driverId: insertGatePass.driverId || null
    };
    
    this.gatePasses.set(id, gatePass);
    return gatePass;
  }

  async updateGatePass(id: number, gatePassUpdate: Partial<InsertGatePass>): Promise<GatePass | undefined> {
    const existingGatePass = this.gatePasses.get(id);
    
    if (!existingGatePass) {
      return undefined;
    }
    
    const updatedGatePass: GatePass = {
      ...existingGatePass,
      ...gatePassUpdate
    };
    
    this.gatePasses.set(id, updatedGatePass);
    return updatedGatePass;
  }

  async deleteGatePass(id: number): Promise<boolean> {
    // Delete associated items first
    await this.deleteItemsByGatePassId(id);
    
    // Then delete the gate pass
    return this.gatePasses.delete(id);
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
  }>): Promise<GatePass[]> {
    let gatePasses = Array.from(this.gatePasses.values());
    
    // Apply filters if provided
    if (filters) {
      if (filters.customerName) {
        gatePasses = gatePasses.filter(pass => 
          pass.customerName.toLowerCase().includes(filters.customerName!.toLowerCase())
        );
      }
      
      if (filters.department) {
        gatePasses = gatePasses.filter(pass => 
          pass.department === filters.department
        );
      }
      
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        gatePasses = gatePasses.filter(pass => 
          new Date(pass.date) >= fromDate
        );
      }
      
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        gatePasses = gatePasses.filter(pass => 
          new Date(pass.date) <= toDate
        );
      }
      
      if (filters.gatePassNumber) {
        gatePasses = gatePasses.filter(pass => 
          pass.gatePassNumber.includes(filters.gatePassNumber!)
        );
      }
      
      if (filters.createdById) {
        gatePasses = gatePasses.filter(pass => 
          pass.createdById === filters.createdById
        );
      }
      
      if (filters.status) {
        gatePasses = gatePasses.filter(pass => 
          pass.status === filters.status
        );
      }
      
      if (filters.itemName) {
        // This is more complex since we need to check related items
        const matchingGatePassIds = new Set<number>();
        
        // Get all items that match the name
        Array.from(this.items.values())
          .filter(item => item.name.toLowerCase().includes(filters.itemName!.toLowerCase()))
          .forEach(item => matchingGatePassIds.add(item.gatePassId));
        
        gatePasses = gatePasses.filter(pass => 
          matchingGatePassIds.has(pass.id)
        );
      }
    }
    
    // Sort by date (newest first)
    return gatePasses.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  // Item operations
  async getItemsByGatePassId(gatePassId: number): Promise<Item[]> {
    return Array.from(this.items.values()).filter(
      (item) => item.gatePassId === gatePassId
    );
  }

  async createItem(item: InsertItem & { gatePassId: number }): Promise<Item> {
    const id = this.currentItemId++;
    const newItem: Item = { ...item, id };
    this.items.set(id, newItem);
    return newItem;
  }

  async deleteItemsByGatePassId(gatePassId: number): Promise<boolean> {
    const itemsToDelete = Array.from(this.items.values())
      .filter(item => item.gatePassId === gatePassId);
    
    itemsToDelete.forEach(item => {
      this.items.delete(item.id);
    });
    
    return true;
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
    const gatePasses = Array.from(this.gatePasses.values());
    const now = new Date();
    
    // Start of the current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Start of the current week (assuming week starts on Monday)
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Last 6 months for trends
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    // Last 30 days for daily trend
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const monthlyPasses = gatePasses.filter(pass => 
      new Date(pass.createdAt) >= startOfMonth
    ).length;
    
    const weeklyPasses = gatePasses.filter(pass => 
      new Date(pass.createdAt) >= startOfWeek
    ).length;
    
    const pendingApprovals = gatePasses.filter(pass => 
      pass.status === 'pending'
    ).length;
    
    // Generate status distribution
    const statusCounts: Record<string, number> = {};
    gatePasses.forEach(pass => {
      const status = pass.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count
    })).sort((a, b) => b.count - a.count); // Sort by count in descending order
    
    // Generate department distribution
    const departmentCounts: Record<string, number> = {};
    gatePasses.forEach(pass => {
      const department = pass.department || 'unknown';
      departmentCounts[department] = (departmentCounts[department] || 0) + 1;
    });
    
    const departmentDistribution = Object.entries(departmentCounts).map(([department, count]) => ({
      department,
      count
    })).sort((a, b) => b.count - a.count); // Sort by count in descending order
    
    // Generate monthly trend data for the last 6 months
    const monthlyTrendData: Record<string, number> = {};
    
    // Initialize all months with zero counts
    for (let i = 0; i < 6; i++) {
      const month = new Date();
      month.setMonth(month.getMonth() - i);
      const monthKey = `${month.getFullYear()}-${month.getMonth() + 1}`;
      monthlyTrendData[monthKey] = 0;
    }
    
    // Count passes for each month
    gatePasses.forEach(pass => {
      const createdAt = new Date(pass.createdAt);
      if (createdAt >= sixMonthsAgo) {
        const monthKey = `${createdAt.getFullYear()}-${createdAt.getMonth() + 1}`;
        monthlyTrendData[monthKey] = (monthlyTrendData[monthKey] || 0) + 1;
      }
    });
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // Convert to array and sort by date
    const monthlyTrend = Object.entries(monthlyTrendData).map(([monthKey, count]) => {
      const [year, month] = monthKey.split('-').map(n => parseInt(n, 10));
      return {
        month: `${monthNames[month - 1]} ${year}`,
        count,
        // For sorting purposes
        sortKey: `${year}-${month.toString().padStart(2, '0')}`
      };
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({month, count}) => ({month, count}));
    
    // Generate daily trend data for the last 30 days
    const dailyTrendData: Record<string, number> = {};
    
    // Initialize all days with zero counts
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      dailyTrendData[dateKey] = 0;
    }
    
    // Count passes for each day
    gatePasses.forEach(pass => {
      const createdAt = new Date(pass.createdAt);
      if (createdAt >= thirtyDaysAgo) {
        const dateKey = createdAt.toISOString().split('T')[0]; // YYYY-MM-DD
        dailyTrendData[dateKey] = (dailyTrendData[dateKey] || 0) + 1;
      }
    });
    
    // Convert to array and sort by date
    const dailyTrend = Object.entries(dailyTrendData)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    return {
      totalPasses: gatePasses.length,
      monthlyPasses,
      weeklyPasses,
      pendingApprovals,
      statusDistribution,
      departmentDistribution,
      monthlyTrend,
      dailyTrend
    };
  }

  // Customer operations
  async getCustomer(id: number): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async getCustomers(searchTerm?: string): Promise<Customer[]> {
    const customers = Array.from(this.customers.values());
    
    if (!searchTerm) {
      return customers;
    }
    
    const normalizedSearch = searchTerm.toLowerCase();
    return customers.filter(customer => 
      customer.name.toLowerCase().includes(normalizedSearch) ||
      (customer.phone && customer.phone.includes(normalizedSearch)) ||
      (customer.address && customer.address.toLowerCase().includes(normalizedSearch))
    );
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const id = this.currentCustomerId++;
    const now = new Date();
    
    const newCustomer: Customer = {
      ...customer,
      id,
      createdAt: now,
      updatedAt: now,
      phone: customer.phone || null,
      address: customer.address || null
    };
    
    this.customers.set(id, newCustomer);
    return newCustomer;
  }

  async updateCustomer(id: number, customerUpdate: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const existingCustomer = this.customers.get(id);
    
    if (!existingCustomer) {
      return undefined;
    }
    
    const updatedCustomer: Customer = {
      ...existingCustomer,
      ...customerUpdate,
      updatedAt: new Date()
    };
    
    this.customers.set(id, updatedCustomer);
    return updatedCustomer;
  }

  // Driver operations
  async getDriver(id: number): Promise<Driver | undefined> {
    return this.drivers.get(id);
  }

  async getDrivers(searchTerm?: string): Promise<Driver[]> {
    const drivers = Array.from(this.drivers.values());
    
    if (!searchTerm) {
      return drivers;
    }
    
    const normalizedSearch = searchTerm.toLowerCase();
    return drivers.filter(driver => 
      driver.name.toLowerCase().includes(normalizedSearch) ||
      driver.mobile.includes(normalizedSearch) ||
      driver.cnic.includes(normalizedSearch) ||
      (driver.vehicleNumber && driver.vehicleNumber.toLowerCase().includes(normalizedSearch))
    );
  }

  async getDriverByCnic(cnic: string): Promise<Driver | undefined> {
    return Array.from(this.drivers.values()).find(
      driver => driver.cnic === cnic
    );
  }

  async createDriver(driver: InsertDriver): Promise<Driver> {
    const id = this.currentDriverId++;
    const now = new Date();
    
    const newDriver: Driver = {
      ...driver,
      id,
      createdAt: now,
      updatedAt: now,
      vehicleNumber: driver.vehicleNumber || null
    };
    
    this.drivers.set(id, newDriver);
    return newDriver;
  }

  async updateDriver(id: number, driverUpdate: Partial<InsertDriver>): Promise<Driver | undefined> {
    const existingDriver = this.drivers.get(id);
    
    if (!existingDriver) {
      return undefined;
    }
    
    const updatedDriver: Driver = {
      ...existingDriver,
      ...driverUpdate,
      updatedAt: new Date()
    };
    
    this.drivers.set(id, updatedDriver);
    return updatedDriver;
  }

  // User Activity Logging
  async logUserActivity(activityLog: InsertUserActivityLog): Promise<UserActivityLog> {
    const id = this.currentActivityLogId++;
    const timestamp = new Date();
    
    const log: UserActivityLog = {
      ...activityLog,
      id,
      timestamp
    };
    
    this.userActivityLogs.set(id, log);
    return log;
  }
  
  async getUserActivityLogs(filters?: Partial<{
    userId: number;
    userEmail: string;
    actionType: string;
    entityType: string;
    dateFrom: Date;
    dateTo: Date;
  }>): Promise<UserActivityLog[]> {
    let logs = Array.from(this.userActivityLogs.values());
    
    // Apply filters if provided
    if (filters) {
      if (filters.userId) {
        logs = logs.filter(log => log.userId === filters.userId);
      }
      
      if (filters.userEmail) {
        logs = logs.filter(log => 
          log.userEmail.toLowerCase().includes(filters.userEmail!.toLowerCase())
        );
      }
      
      if (filters.actionType) {
        logs = logs.filter(log => log.actionType === filters.actionType);
      }
      
      if (filters.entityType) {
        logs = logs.filter(log => log.entityType === filters.entityType);
      }
      
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        logs = logs.filter(log => log.timestamp >= fromDate);
      }
      
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        logs = logs.filter(log => log.timestamp <= toDate);
      }
    }
    
    // Sort by timestamp (newest first)
    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  // Document operations
  async getDocument(id: number): Promise<Document | undefined> {
    return this.documents.get(id);
  }
  
  async getDocumentsByEntity(entityType: string, entityId: number): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(
      (doc) => doc.entityType === entityType && doc.entityId === entityId
    );
  }
  
  async createDocument(document: InsertDocument): Promise<Document> {
    const id = this.currentDocumentId++;
    const createdAt = new Date();
    
    const newDocument: Document = {
      ...document,
      id,
      createdAt,
    };
    
    this.documents.set(id, newDocument);
    return newDocument;
  }
  
  async updateDocument(id: number, documentData: Partial<InsertDocument>): Promise<Document | undefined> {
    const existingDocument = this.documents.get(id);
    
    if (!existingDocument) {
      return undefined;
    }
    
    const updatedDocument: Document = {
      ...existingDocument,
      ...documentData,
    };
    
    this.documents.set(id, updatedDocument);
    return updatedDocument;
  }
  
  async deleteDocument(id: number): Promise<boolean> {
    return this.documents.delete(id);
  }
  
  // Utility methods
  async generateGatePassNumber(): Promise<string> {
    this.lastGatePassNumber++;
    
    // Format: PZGP-001, PZGP-002, etc.
    return `PZGP-${this.lastGatePassNumber.toString().padStart(3, '0')}`;
  }
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  // User Activity Logging
  async logUserActivity(activityLog: InsertUserActivityLog): Promise<UserActivityLog> {
    const [log] = await db
      .insert(userActivityLogs)
      .values(activityLog)
      .returning();
    
    return log;
  }
  
  async getUserActivityLogs(filters?: Partial<{
    userId: number;
    userEmail: string;
    actionType: string;
    entityType: string;
    dateFrom: Date;
    dateTo: Date;
  }>): Promise<UserActivityLog[]> {
    let query = db.select().from(userActivityLogs);
    
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
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }
  
  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({
        ...userData,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    
    return updatedUser || undefined;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });
    
    return result.length > 0;
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
    
    const [gatePass] = await db
      .insert(gatePasses)
      .values({
        ...insertGatePass,
        gatePassNumber,
        status: insertGatePass.status || 'pending',
      })
      .returning();
    
    return gatePass;
  }

  async updateGatePass(id: number, gatePassUpdate: Partial<InsertGatePass>): Promise<GatePass | undefined> {
    const [updatedGatePass] = await db
      .update(gatePasses)
      .set({
        ...gatePassUpdate,
        updatedAt: new Date(),
      })
      .where(eq(gatePasses.id, id))
      .returning();
    
    return updatedGatePass || undefined;
  }

  async deleteGatePass(id: number): Promise<boolean> {
    // First delete associated items
    await this.deleteItemsByGatePassId(id);
    
    // Then delete the gate pass
    const result = await db
      .delete(gatePasses)
      .where(eq(gatePasses.id, id))
      .returning({ id: gatePasses.id });
    
    return result.length > 0;
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
  }>): Promise<GatePass[]> {
    let query = db.select().from(gatePasses);
    
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
    const [newItem] = await db
      .insert(items)
      .values(item)
      .returning();
    
    return newItem;
  }

  async deleteItemsByGatePassId(gatePassId: number): Promise<boolean> {
    const result = await db
      .delete(items)
      .where(eq(items.gatePassId, gatePassId))
      .returning({ id: items.id });
    
    return result.length > 0;
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
    let query = db.select().from(customers);
    
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
    const [newCustomer] = await db
      .insert(customers)
      .values({
        ...customer,
        email: customer.email || null,
        phone: customer.phone || null,
        address: customer.address || null,
        contactPerson: customer.contactPerson || null
      })
      .returning();
    
    return newCustomer;
  }

  async updateCustomer(id: number, customerUpdate: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [updatedCustomer] = await db
      .update(customers)
      .set({
        ...customerUpdate,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id))
      .returning();
    
    return updatedCustomer || undefined;
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
    let query = db.select().from(drivers);
    
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
    const [newDriver] = await db
      .insert(drivers)
      .values({
        ...driver,
        vehicleNumber: driver.vehicleNumber || null,
        licenseNumber: driver.licenseNumber || null
      })
      .returning();
    
    return newDriver;
  }

  async updateDriver(id: number, driverUpdate: Partial<InsertDriver>): Promise<Driver | undefined> {
    const [updatedDriver] = await db
      .update(drivers)
      .set({
        ...driverUpdate,
        updatedAt: new Date(),
      })
      .where(eq(drivers.id, id))
      .returning();
    
    return updatedDriver || undefined;
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
    const [newDocument] = await db
      .insert(documents)
      .values(document)
      .returning();
    
    return newDocument;
  }
  
  async updateDocument(id: number, documentData: Partial<InsertDocument>): Promise<Document | undefined> {
    const [updatedDocument] = await db
      .update(documents)
      .set(documentData)
      .where(eq(documents.id, id))
      .returning();
    
    return updatedDocument || undefined;
  }
  
  async deleteDocument(id: number): Promise<boolean> {
    const result = await db
      .delete(documents)
      .where(eq(documents.id, id))
      .returning({ id: documents.id });
    
    return result.length > 0;
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
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Calculate the start of the week (Monday)
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);
      
      // Calculate the date 6 months ago for trend data
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      sixMonthsAgo.setDate(1); // Start from the 1st of the month
      sixMonthsAgo.setHours(0, 0, 0, 0);
      
      // Calculate the date 30 days ago for daily trend
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      
      // Total passes count
      const [{ value: totalPasses }] = await db
        .select({ value: count() })
        .from(gatePasses)
        .where(
          and(
            isNotNull(gatePasses.createdAt),
            lte(gatePasses.createdAt, now)
          )
        );
      
      // Monthly passes count
      const [{ value: monthlyPasses }] = await db
        .select({ value: count() })
        .from(gatePasses)
        .where(
          and(
            isNotNull(gatePasses.createdAt),
            gte(gatePasses.createdAt, startOfMonth),
            lte(gatePasses.createdAt, now)
          )
        );
      
      // Weekly passes count
      const [{ value: weeklyPasses }] = await db
        .select({ value: count() })
        .from(gatePasses)
        .where(
          and(
            isNotNull(gatePasses.createdAt),
            gte(gatePasses.createdAt, startOfWeek),
            lte(gatePasses.createdAt, now)
          )
        );
      
      // Pending approvals count
      const [{ value: pendingApprovals }] = await db
        .select({ value: count() })
        .from(gatePasses)
        .where(
          and(
            eq(gatePasses.status, 'pending'),
            isNotNull(gatePasses.createdAt)
          )
        );
      
      // Status distribution with proper status names
      const statusDistribution = await db
        .select({
          status: sql<string>`COALESCE(${gatePasses.status}, 'unknown')`,
          count: sql<number>`CAST(COUNT(*) AS INTEGER)`
        })
        .from(gatePasses)
        .where(isNotNull(gatePasses.createdAt))
        .groupBy(gatePasses.status)
        .orderBy(desc(sql`count(*)`));
      
      // Department distribution with proper department names
      const departmentDistribution = await db
        .select({
          department: sql<string>`COALESCE(${gatePasses.department}, 'unknown')`,
          count: sql<number>`CAST(COUNT(*) AS INTEGER)`
        })
        .from(gatePasses)
        .where(isNotNull(gatePasses.createdAt))
        .groupBy(gatePasses.department)
        .orderBy(desc(sql`count(*)`));
      
      // Monthly trend data with proper month names
      const monthlyRows = await db
        .select({
          year: sql<number>`CAST(EXTRACT(YEAR FROM ${gatePasses.createdAt}) AS INTEGER)`,
          month: sql<number>`CAST(EXTRACT(MONTH FROM ${gatePasses.createdAt}) AS INTEGER)`,
          count: sql<number>`CAST(COUNT(*) AS INTEGER)`
        })
        .from(gatePasses)
        .where(
          and(
            isNotNull(gatePasses.createdAt),
            gte(gatePasses.createdAt, sixMonthsAgo),
            lte(gatePasses.createdAt, now)
          )
        )
        .groupBy(sql`EXTRACT(YEAR FROM ${gatePasses.createdAt}), EXTRACT(MONTH FROM ${gatePasses.createdAt})`)
        .orderBy(
          sql`EXTRACT(YEAR FROM ${gatePasses.createdAt})`,
          sql`EXTRACT(MONTH FROM ${gatePasses.createdAt})`
        );
      
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      
      // Fill in missing months with zero counts
      const monthlyTrend: { month: string; count: number }[] = [];
      let currentDate = new Date(sixMonthsAgo);
      
      while (currentDate <= now) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthData = monthlyRows.find(row => 
          row.year === year && row.month === month + 1
        );
        
        monthlyTrend.push({
          month: `${monthNames[month]} ${year}`,
          count: monthData?.count as number ?? 0
        });
        
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      
      // Daily trend data with proper date formatting
      const dailyRows = await db
        .select({
          date: sql<string>`TO_CHAR(${gatePasses.createdAt}, 'YYYY-MM-DD')`,
          count: sql<number>`CAST(COUNT(*) AS INTEGER)`
        })
        .from(gatePasses)
        .where(
          and(
            isNotNull(gatePasses.createdAt),
            gte(gatePasses.createdAt, thirtyDaysAgo),
            lte(gatePasses.createdAt, now)
          )
        )
        .groupBy(sql`TO_CHAR(${gatePasses.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`TO_CHAR(${gatePasses.createdAt}, 'YYYY-MM-DD')`);
      
      // Fill in missing days with zero counts
      const dailyTrend: { date: string; count: number }[] = [];
      currentDate = new Date(thirtyDaysAgo);
      
      while (currentDate <= now) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayData = dailyRows.find(row => row.date === dateStr);
        
        dailyTrend.push({
          date: dateStr,
          count: dayData?.count as number ?? 0
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return {
        totalPasses,
        monthlyPasses,
        weeklyPasses,
        pendingApprovals,
        statusDistribution,
        departmentDistribution,
        monthlyTrend,
        dailyTrend
      };
    } catch (error) {
      console.error('Error calculating statistics:', error);
      throw error;
    }
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
}

// Use database storage instead of memory storage
export const storage = new DatabaseStorage();
