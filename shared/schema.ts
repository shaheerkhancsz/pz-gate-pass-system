import { mysqlTable, text, mediumtext, int, date, timestamp, boolean, primaryKey, json, varchar } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Custom validation regex patterns
export const PHONE_REGEX = /^03\d{2}-?\d{7}$/; // e.g., 0306-2228391 or 03062228391
export const CNIC_REGEX = /^\d{5}-\d{7}-\d{1}$/; // e.g., 42101-9948106-8

// Custom error messages
export const PHONE_ERROR = "Phone number must be in format: 0306-2228391 or 03062228391";
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

// Companies table (Multi-company support)
export const companies = mysqlTable("companies", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }),
  tagline: varchar("tagline", { length: 255 }),
  shortName: varchar("short_name", { length: 50 }),  // e.g., AGP, OBS-PK, OBS-INT
  code: varchar("code", { length: 20 }),              // Phase 7: Company code
  logo: mediumtext("logo"),                           // Phase 7: Logo URL or base64 (MEDIUMTEXT = 16 MB)
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  website: varchar("website", { length: 255 }),
  footerText: text("footer_text"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  // Phase 5: SAP ERP Integration config
  sapEnabled: boolean("sap_enabled").default(false).notNull(),
  sapBaseUrl: varchar("sap_base_url", { length: 500 }),
  sapUsername: varchar("sap_username", { length: 100 }),
  sapPassword: varchar("sap_password", { length: 255 }),
  sapClientId: varchar("sap_client_id", { length: 10 }),
  lastSapSyncAt: timestamp("last_sap_sync_at"),
  // Phase 6: Active Directory / LDAP SSO config
  ldapEnabled: boolean("ldap_enabled").default(false).notNull(),
  ldapUrl: varchar("ldap_url", { length: 500 }),           // e.g. ldap://192.168.1.1:389
  ldapBaseDn: varchar("ldap_base_dn", { length: 500 }),    // e.g. DC=agp,DC=com
  ldapBindDn: varchar("ldap_bind_dn", { length: 500 }),    // service account DN
  ldapBindPassword: varchar("ldap_bind_password", { length: 255 }),
  ldapSearchBase: varchar("ldap_search_base", { length: 500 }), // e.g. OU=Users,DC=agp,DC=com
  ldapUsernameAttr: varchar("ldap_username_attr", { length: 100 }),  // sAMAccountName
  ldapEmailAttr: varchar("ldap_email_attr", { length: 100 }),        // mail
  ldapDisplayNameAttr: varchar("ldap_display_name_attr", { length: 100 }), // displayName
  ldapDepartmentAttr: varchar("ldap_department_attr", { length: 100 }),    // department
  ldapPhoneAttr: varchar("ldap_phone_attr", { length: 100 }),              // telephoneNumber
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Departments table — per-company, admin-managed (replaces hardcoded departmentOptions)
export const departments = mysqlTable("departments", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 30 }),          // short code e.g. ADMIN, BD, CD
  description: varchar("description", { length: 255 }),
  active: boolean("active").default(true).notNull(),
  // 'items' = always show items table (default)
  // 'attachment' = always use attachment only
  // 'either' = user chooses items OR attachment per gate pass
  itemInputMode: varchar("item_input_mode", { length: 20 }).default("items").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departments.$inferSelect;

// Roles table
export const roles = mysqlTable("roles", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

// Permissions table
export const permissions = mysqlTable("permissions", {
  id: int("id").primaryKey().autoincrement(),
  roleId: int("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  module: varchar("module", { length: 100 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

// User model with role and company reference
export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  passwordResetToken: varchar("password_reset_token", { length: 255 }),   // Phase 10
  passwordResetExpiry: timestamp("password_reset_expiry"),                 // Phase 10
  phoneNumber: varchar("phone_number", { length: 20 }),
  department: varchar("department", { length: 100 }).notNull(),
  division: varchar("division", { length: 100 }),          // Phase 7: Division (sub-unit of dept)
  divisionCategory: varchar("division_category", { length: 100 }), // Division category (e.g. "Div A")
  sapEmployeeCode: varchar("sap_employee_code", { length: 50 }), // Phase 7: SAP employee ID
  roleId: int("role_id").references(() => roles.id),
  companyId: int("company_id").references(() => companies.id, { onDelete: "set null" }), // Multi-company
  active: boolean("active").default(true),
  cnic: varchar("cnic", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
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
export const items = mysqlTable("items", {
  id: int("id").primaryKey().autoincrement(),
  gatePassId: int("gate_pass_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 100 }).notNull(),
  quantity: int("quantity").notNull(),
  unit: varchar("unit", { length: 50 }),
  itemType: varchar("item_type", { length: 20 }).default("material"),
  reason: text("reason"),
  // Phase 18: Partial return tracking (for returnable gate passes)
  receivedQuantity: int("received_quantity").default(0),
});

export const insertItemSchema = createInsertSchema(items).omit({
  id: true,
  gatePassId: true,
});

// Gate Pass model
export const gatePasses = mysqlTable("gate_passes", {
  id: int("id").primaryKey().autoincrement(),
  gatePassNumber: varchar("gate_pass_number", { length: 50 }).notNull().unique(),
  date: date("date").notNull(),
  companyId: int("company_id").references(() => companies.id, { onDelete: "set null" }), // Multi-company
  // Customer information - can be linked to customers table or entered directly
  customerId: int("customer_id").notNull().default(0),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 20 }), // Customer phone number
  deliveryAddress: text("delivery_address").notNull(),
  // Driver information - can be linked to drivers table or entered directly
  driverId: int("driver_id").notNull().default(0),
  driverName: varchar("driver_name", { length: 255 }).notNull(),
  driverMobile: varchar("driver_mobile", { length: 20 }).notNull(),
  driverCnic: varchar("driver_cnic", { length: 20 }).notNull(),
  deliveryVanNumber: varchar("delivery_van_number", { length: 50 }).notNull(),
  department: varchar("department", { length: 100 }).notNull(),
  reason: text("reason"),                   // Reason for the gate pass (purpose/justification)
  notes: text("notes"), // Additional notes
  allowTo: varchar("allow_to", { length: 255 }),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdById: int("created_by_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  // Status values: pending | approved | security_allowed | completed | rejected | sent_back
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  // Phase 2: Approval workflow fields
  remarks: text("remarks"),                    // Approver send-back / reject notes
  securityRemarks: text("security_remarks"),   // Security send-back notes
  // approvedBy/At: set when the gate pass reaches 'approved' status
  approvedBy: int("approved_by").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  // kept for backward compat — will be synced from approvedBy/At
  hodApprovedBy: int("hod_approved_by").references(() => users.id, { onDelete: "set null" }),
  hodApprovedAt: timestamp("hod_approved_at"),
  securityAllowedBy: int("security_allowed_by").references(() => users.id, { onDelete: "set null" }),
  securityAllowedAt: timestamp("security_allowed_at"),
  // Phase 3: Gate pass types
  type: varchar("type", { length: 20 }).default("outward").notNull(),               // outward | inward | returnable
  expectedReturnDate: date("expected_return_date"),                                  // Returnable passes only
  actualReturnDate: date("actual_return_date"),                                      // Set when goods are returned
  gateId: int("gate_id"),                                                            // Phase 7: Selected gate (FK in migration 012, not Drizzle)
  plantId: int("plant_id"),                                                           // Selected plant
  // Phase 17: Force Close
  forceClosedBy: int("force_closed_by").references(() => users.id, { onDelete: "set null" }),
  forceClosedAt: timestamp("force_closed_at"),
  forceCloseRemarks: text("force_close_remarks"),
  // Phase 18: SAP Reference Code — generated when gate pass is completed/force-closed
  sapReferenceCode: varchar("sap_reference_code", { length: 30 }).unique(),
});

export const insertGatePassSchema = createInsertSchema(gatePasses, {
  date: z.coerce.date(),
  expectedReturnDate: z.coerce.date().optional().nullable(),
  actualReturnDate: z.coerce.date().optional().nullable(),
})
  .extend({
    driverName: z.string().optional().or(z.literal("")),
    driverMobile: z.string()
      .regex(PHONE_REGEX, PHONE_ERROR)
      .min(11, "Phone number must be 11 or 12 characters long")
      .max(12, "Phone number must be 11 or 12 characters long")
      .optional()
      .or(z.literal("")),
    driverCnic: z.string()
      .regex(CNIC_REGEX, CNIC_ERROR)
      .min(15, "CNIC must be 15 characters long")
      .max(15, "CNIC must be 15 characters long")
      .optional()
      .or(z.literal("")),
    deliveryVanNumber: z.string().optional().or(z.literal("")),
    allowTo: z.string().optional().or(z.literal("")),
    // Nullable FK overrides: DB columns are .notNull().default(0) but client may send null
    driverId: z.number().optional().nullable().transform(v => v ?? 0),
    customerId: z.number().optional().nullable().transform(v => v ?? 0),
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

// Gate Pass schema with items (min 0 — attachment-mode departments may submit without items)
export const gatePassWithItemsSchema = insertGatePassSchema.extend({
  items: z.array(insertItemSchema),
});

// Customer model
export const customers = mysqlTable("customers", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("company_id").references(() => companies.id, { onDelete: "set null" }), // Multi-company
  code: varchar("code", { length: 50 }),                // Customer code (e.g. CUST-001)
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  contactPerson: varchar("contact_person", { length: 255 }),
  email: varchar("email", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  // Phase 5: SAP sync tracking
  sapId: varchar("sap_id", { length: 100 }),            // SAP Business Partner number
  syncedFromSap: boolean("synced_from_sap").default(false).notNull(),
  active: boolean("active").default(true).notNull(),    // Active/Inactive status
});

export const insertCustomerSchema = createInsertSchema(customers)
  .extend({
    phone: z.string()
      .regex(PHONE_REGEX, PHONE_ERROR)
      .min(11, "Phone number must be 11 or 12 characters long")
      .max(12, "Phone number must be 11 or 12 characters long")
      .optional()
      .or(z.literal(""))
      .nullable(),
  })
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

// Driver model
export const drivers = mysqlTable("drivers", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("company_id").references(() => companies.id, { onDelete: "set null" }), // Multi-company
  code: varchar("code", { length: 50 }),                 // Driver code (e.g. DRV-001)
  name: varchar("name", { length: 255 }).notNull(),
  mobile: varchar("mobile", { length: 20 }).notNull(),
  cnic: varchar("cnic", { length: 20 }).notNull().unique(),
  vehicleNumber: varchar("vehicle_number", { length: 50 }),
  email: varchar("email", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  // Phase 5: SAP sync tracking
  sapId: varchar("sap_id", { length: 100 }),             // SAP vendor/driver ID
  syncedFromSap: boolean("synced_from_sap").default(false).notNull(),
  active: boolean("active").default(true).notNull(),     // Active/Inactive status
});

export const insertDriverSchema = createInsertSchema(drivers)
  .extend({
    mobile: z.string()
      .regex(PHONE_REGEX, PHONE_ERROR)
      .min(11, "Phone number must be 11 or 12 characters long")
      .max(12, "Phone number must be 11 or 12 characters long"),
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

// Products / Materials table (Phase 5: SAP-sourced catalog)
export const products = mysqlTable("products", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("company_id").references(() => companies.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 100 }),
  description: text("description"),
  unit: varchar("unit", { length: 50 }),
  sapMaterialCode: varchar("sap_material_code", { length: 100 }),
  syncedFromSap: boolean("synced_from_sap").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Phase 2 (Revised): Per-approver approval tracking (for ALL mode)
export const gatePassApprovals = mysqlTable("gate_pass_approvals", {
  id: int("id").primaryKey().autoincrement(),
  gatePassId: int("gate_pass_id").notNull().references(() => gatePasses.id, { onDelete: "cascade" }),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  approvedAt: timestamp("approved_at").defaultNow().notNull(),
});

export const insertGatePassApprovalSchema = createInsertSchema(gatePassApprovals).omit({ id: true, approvedAt: true });
export type GatePassApproval = typeof gatePassApprovals.$inferSelect;
export type InsertGatePassApproval = z.infer<typeof insertGatePassApprovalSchema>;

// Phase 2 (Revised): Approval settings — who can approve per department per company
export const approvalSettings = mysqlTable("approval_settings", {
  id: int("id").primaryKey().autoincrement(),
  companyId: int("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  department: varchar("department", { length: 100 }).notNull(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mode: varchar("mode", { length: 10 }).default("any").notNull(), // 'any' | 'all'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertApprovalSettingSchema = createInsertSchema(approvalSettings).omit({ id: true, createdAt: true });
export type ApprovalSetting = typeof approvalSettings.$inferSelect;
export type InsertApprovalSetting = z.infer<typeof insertApprovalSettingSchema>;

// Types
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
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
export type PermissionType = {
  module: keyof typeof ModuleType;
  action: keyof typeof PermissionAction;
};

// User Activity Logs table
export const userActivityLogs = mysqlTable("user_activity_logs", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").references(() => users.id, { onDelete: "set null" }),
  userEmail: varchar("user_email", { length: 255 }).notNull(),
  actionType: varchar("action_type", { length: 100 }).notNull(), // login, logout, create, update, delete, etc.
  entityType: varchar("entity_type", { length: 100 }), // user, gatePass, customer, etc.
  entityId: int("entity_id"), // ID of the related entity if applicable
  description: text("description"), // Description of the activity
  ipAddress: varchar("ip_address", { length: 50 }), // IP address of the user
  userAgent: text("user_agent"), // Browser/device info
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  additionalData: text("additional_data"), // JSON string for additional info
});

export const insertUserActivityLogSchema = createInsertSchema(userActivityLogs).omit({
  id: true,
  timestamp: true,
});

// Document attachments table
export const documents = mysqlTable("documents", {
  id: int("id").primaryKey().autoincrement(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileType: varchar("file_type", { length: 100 }).notNull(), // MIME type
  fileSize: int("file_size").notNull(), // Size in bytes
  fileData: mediumtext("file_data").notNull(), // Base64 encoded file data (MEDIUMTEXT = 16 MB)
  entityType: varchar("entity_type", { length: 100 }).notNull(), // Type of entity this document is attached to (gatePass, customer, etc.)
  entityId: int("entity_id").notNull(), // ID of the related entity
  description: text("description"),
  uploadedBy: int("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  uploadedByEmail: varchar("uploaded_by_email", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDocumentSchema = createInsertSchema(documents, {
  // Override fileData: drizzle-zod maps MEDIUMTEXT → z.string().max(16MB) which is fine,
  // but we explicitly set z.string() to avoid any generated limit surprises.
  fileData: z.string().min(1),
}).omit({
  id: true,
  createdAt: true,
});


// Company settings table to store configurations
export const companySettings = mysqlTable("company_settings", {
  id: int("id").primaryKey().autoincrement(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: json("value"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const insertCompanySettingSchema = createInsertSchema(companySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Notifications table for in-app notifications
export const notifications = mysqlTable("notifications", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'info', 'warning', 'success', 'error'
  read: boolean("read").default(false),
  entityType: varchar("entity_type", { length: 100 }), // Type of entity this notification is related to (gatePass, etc.)
  entityId: int("entity_id"), // ID of the related entity if applicable
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type UserActivityLog = typeof userActivityLogs.$inferSelect;
export type InsertUserActivityLog = z.infer<typeof insertUserActivityLogSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type CompanySetting = typeof companySettings.$inferSelect;
export type InsertCompanySetting = z.infer<typeof insertCompanySettingSchema>;

// ================================================================
// Phase 7: Plants, Gates, Vendors, Item Master
// ================================================================

export const plants = mysqlTable("plants", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  companyId: int("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  description: varchar("description", { length: 255 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export const insertPlantSchema = createInsertSchema(plants).omit({ id: true, createdAt: true, updatedAt: true });
export type Plant = typeof plants.$inferSelect;
export type InsertPlant = z.infer<typeof insertPlantSchema>;

export const gates = mysqlTable("gates", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  plantId: int("plant_id").references(() => plants.id, { onDelete: "set null" }),
  companyId: int("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  description: varchar("description", { length: 255 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export const insertGateSchema = createInsertSchema(gates).omit({ id: true, createdAt: true, updatedAt: true });
export type Gate = typeof gates.$inferSelect;
export type InsertGate = z.infer<typeof insertGateSchema>;

export const vendors = mysqlTable("vendors", {
  id: int("id").primaryKey().autoincrement(),
  code: varchar("code", { length: 50 }),
  name: varchar("name", { length: 255 }).notNull(),
  companyId: int("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 255 }),
  address: text("address"),
  sapCode: varchar("sap_code", { length: 50 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true, createdAt: true, updatedAt: true });
export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;

export const itemMaster = mysqlTable("item_master", {
  id: int("id").primaryKey().autoincrement(),
  code: varchar("code", { length: 50 }),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }),
  plantId: int("plant_id").references(() => plants.id, { onDelete: "set null" }),
  companyId: int("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  unit: varchar("unit", { length: 50 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export const insertItemMasterSchema = createInsertSchema(itemMaster).omit({ id: true, createdAt: true, updatedAt: true });
export type ItemMaster = typeof itemMaster.$inferSelect;
export type InsertItemMaster = z.infer<typeof insertItemMasterSchema>;

// ================================================================
// User Assignment Junction Tables (multi-company / plant / gate)
// ================================================================

export const userCompanies = mysqlTable("user_companies", {
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: int("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
});

export const userPlants = mysqlTable("user_plants", {
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  plantId: int("plant_id").notNull().references(() => plants.id, { onDelete: "cascade" }),
});

export const userGates = mysqlTable("user_gates", {
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gateId: int("gate_id").notNull().references(() => gates.id, { onDelete: "cascade" }),
});

// ================================================================
// Report Templates — persisted Custom Report Builder configs
// ================================================================

export const reportTemplates = mysqlTable("report_templates", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  config: json("config").notNull(),          // stores full form values (filters, columns, groupBy, sortBy, sortOrder)
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: int("company_id").references(() => companies.id, { onDelete: "cascade" }),
  isShared: boolean("is_shared").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const insertReportTemplateSchema = createInsertSchema(reportTemplates).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type ReportTemplate = typeof reportTemplates.$inferSelect;
export type InsertReportTemplate = z.infer<typeof insertReportTemplateSchema>;
