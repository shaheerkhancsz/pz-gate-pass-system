import { pgTable, text, serial, integer, date, timestamp, boolean, primaryKey, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Custom validation regex patterns
export const PHONE_REGEX = /^03\d{2}-\d{7}$/; // e.g., 0306-2228391
export const CNIC_REGEX = /^\d{5}-\d{7}-\d{1}$/; // e.g., 42101-9948106-8

// Custom error messages
export const PHONE_ERROR = "Phone number must be in format: 0306-2228391";
export const CNIC_ERROR = "CNIC must be in format: 42101-9948106-8";

// Permission types
export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  APPROVE = 'approve',
  VERIFY = 'verify',
  PRINT = 'print',
  EXPORT = 'export',
  IMPORT = 'import',
  MANAGE = 'manage'
}

export enum ModuleType {
  GATE_PASS = 'gatePass',
  CUSTOMER = 'customer',
  DRIVER = 'driver',
  REPORT = 'report',
  USER = 'user',
  ACTIVITY_LOG = 'activityLog',
  DOCUMENT = 'document',
  COMPANY = 'company',
  NOTIFICATION = 'notification',
  ROLE = 'role',
  PERMISSION = 'permission',
  DASHBOARD = 'dashboard'
}

// Roles table
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Permissions table
export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  module: text("module").notNull(),
  action: text("action").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User model with role reference
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  phoneNumber: text("phone_number"),
  department: text("department").notNull(),
  roleId: integer("role_id").references(() => roles.id),
  active: boolean("active").default(true),
  cnic: text("cnic"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPermissionSchema = createInsertSchema(permissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Items model
export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  gatePassId: integer("gate_pass_id").notNull(),
  name: text("name").notNull(),
  sku: text("sku").notNull(),
  quantity: integer("quantity").notNull(),
});

export const insertItemSchema = createInsertSchema(items).omit({
  id: true,
  gatePassId: true,
});

// Gate Pass model
export const gatePasses = pgTable("gate_passes", {
  id: serial("id").primaryKey(),
  gatePassNumber: text("gate_pass_number").notNull().unique(),
  date: date("date").notNull(),
  // Customer information - can be linked to customers table or entered directly
  customerId: integer("customer_id").notNull().default(0),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"), // Customer phone number
  deliveryAddress: text("delivery_address").notNull(),
  // Driver information - can be linked to drivers table or entered directly
  driverId: integer("driver_id").notNull().default(0),
  driverName: text("driver_name").notNull(),
  driverMobile: text("driver_mobile").notNull(),
  driverCnic: text("driver_cnic").notNull(),
  deliveryVanNumber: text("delivery_van_number").notNull(),
  department: text("department").notNull(),
  notes: text("notes"), // Additional notes
  createdBy: text("created_by").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  status: text("status").default("pending").notNull(),
});

export const insertGatePassSchema = createInsertSchema(gatePasses)
  .extend({
    driverMobile: z.string()
      .regex(PHONE_REGEX, PHONE_ERROR)
      .min(12, "Phone number must be 12 characters long")
      .max(12, "Phone number must be 12 characters long"),
    driverCnic: z.string()
      .regex(CNIC_REGEX, CNIC_ERROR)
      .min(15, "CNIC must be 15 characters long")
      .max(15, "CNIC must be 15 characters long"),
  })
  .omit({
    id: true,
    gatePassNumber: true,
    createdAt: true,
  });

// User validation schema for login
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  rememberMe: z.boolean().optional(),
});

// Gate Pass schema with items
export const gatePassWithItemsSchema = insertGatePassSchema.extend({
  items: z.array(insertItemSchema).min(1, "At least one item is required"),
});

// Customer model
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  contactPerson: text("contact_person"),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCustomerSchema = createInsertSchema(customers)
  .extend({
    phone: z.string()
      .regex(PHONE_REGEX, PHONE_ERROR)
      .min(12, "Phone number must be 12 characters long")
      .max(12, "Phone number must be 12 characters long"),
  })
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

// Driver model
export const drivers = pgTable("drivers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  mobile: text("mobile").notNull(),
  cnic: text("cnic").notNull().unique(),
  vehicleNumber: text("vehicle_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDriverSchema = createInsertSchema(drivers)
  .extend({
    mobile: z.string()
      .regex(PHONE_REGEX, PHONE_ERROR)
      .min(12, "Phone number must be 12 characters long")
      .max(12, "Phone number must be 12 characters long"),
    cnic: z.string()
      .regex(CNIC_REGEX, CNIC_ERROR)
      .min(15, "CNIC must be 15 characters long")
      .max(15, "CNIC must be 15 characters long"),
  })
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Item = typeof items.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;
export type GatePass = typeof gatePasses.$inferSelect;
export type InsertGatePass = z.infer<typeof insertGatePassSchema>;
export type GatePassWithItems = z.infer<typeof gatePassWithItemsSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;

// Type for permission checking
// User Activity Logs table
export const userActivityLogs = pgTable("user_activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  userEmail: text("user_email").notNull(),
  actionType: text("action_type").notNull(), // login, logout, create, update, delete, etc.
  entityType: text("entity_type"), // user, gatePass, customer, etc.
  entityId: integer("entity_id"), // ID of the related entity if applicable
  description: text("description"), // Description of the activity
  ipAddress: text("ip_address"), // IP address of the user
  userAgent: text("user_agent"), // Browser/device info
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  additionalData: text("additional_data"), // JSON string for additional info
});

export const insertUserActivityLogSchema = createInsertSchema(userActivityLogs).omit({
  id: true,
  timestamp: true,
});

// Document attachments table
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(), // MIME type
  fileSize: integer("file_size").notNull(), // Size in bytes
  fileData: text("file_data").notNull(), // Base64 encoded file data
  entityType: text("entity_type").notNull(), // Type of entity this document is attached to (gatePass, customer, etc.)
  entityId: integer("entity_id").notNull(), // ID of the related entity
  description: text("description"),
  uploadedBy: integer("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  uploadedByEmail: text("uploaded_by_email").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export type PermissionType = {
  module: keyof typeof ModuleType;
  action: keyof typeof PermissionAction;
};

// Company settings table to store configurations
export const companySettings = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCompanySettingSchema = createInsertSchema(companySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Notifications table for in-app notifications
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(), // 'info', 'warning', 'success', 'error'
  read: boolean("read").default(false),
  entityType: text("entity_type"), // Type of entity this notification is related to (gatePass, etc.)
  entityId: integer("entity_id"), // ID of the related entity if applicable
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type UserActivityLog = typeof userActivityLogs.$inferSelect;
export type InsertUserActivityLog = z.infer<typeof insertUserActivityLogSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type CompanySetting = typeof companySettings.$inferSelect;
export type InsertCompanySetting = z.infer<typeof insertCompanySettingSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
