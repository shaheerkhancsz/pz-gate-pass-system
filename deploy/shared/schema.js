"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertNotificationSchema = exports.notifications = exports.insertCompanySettingSchema = exports.companySettings = exports.insertDocumentSchema = exports.documents = exports.insertUserActivityLogSchema = exports.userActivityLogs = exports.insertDriverSchema = exports.drivers = exports.insertCustomerSchema = exports.customers = exports.gatePassWithItemsSchema = exports.loginSchema = exports.insertGatePassSchema = exports.gatePasses = exports.insertItemSchema = exports.items = exports.insertPermissionSchema = exports.insertRoleSchema = exports.insertUserSchema = exports.users = exports.permissions = exports.roles = exports.ModuleType = exports.PermissionAction = exports.CNIC_ERROR = exports.PHONE_ERROR = exports.CNIC_REGEX = exports.PHONE_REGEX = void 0;
const mysql_core_1 = require("drizzle-orm/mysql-core");
const drizzle_zod_1 = require("drizzle-zod");
const zod_1 = require("zod");
// Custom validation regex patterns
exports.PHONE_REGEX = /^03\d{2}-\d{7}$/; // e.g., 0306-2228391
exports.CNIC_REGEX = /^\d{5}-\d{7}-\d{1}$/; // e.g., 42101-9948106-8
// Custom error messages
exports.PHONE_ERROR = "Phone number must be in format: 0306-2228391";
exports.CNIC_ERROR = "CNIC must be in format: 42101-9948106-8";
// Permission types
var PermissionAction;
(function (PermissionAction) {
    PermissionAction["CREATE"] = "create";
    PermissionAction["READ"] = "read";
    PermissionAction["UPDATE"] = "update";
    PermissionAction["DELETE"] = "delete";
    PermissionAction["APPROVE"] = "approve";
    PermissionAction["VERIFY"] = "verify";
    PermissionAction["PRINT"] = "print";
    PermissionAction["EXPORT"] = "export";
    PermissionAction["IMPORT"] = "import";
    PermissionAction["MANAGE"] = "manage";
})(PermissionAction || (exports.PermissionAction = PermissionAction = {}));
var ModuleType;
(function (ModuleType) {
    ModuleType["GATE_PASS"] = "gatePass";
    ModuleType["CUSTOMER"] = "customer";
    ModuleType["DRIVER"] = "driver";
    ModuleType["REPORT"] = "report";
    ModuleType["USER"] = "user";
    ModuleType["ACTIVITY_LOG"] = "activityLog";
    ModuleType["DOCUMENT"] = "document";
    ModuleType["COMPANY"] = "company";
    ModuleType["NOTIFICATION"] = "notification";
    ModuleType["ROLE"] = "role";
    ModuleType["PERMISSION"] = "permission";
    ModuleType["DASHBOARD"] = "dashboard";
})(ModuleType || (exports.ModuleType = ModuleType = {}));
// Roles table
exports.roles = (0, mysql_core_1.mysqlTable)("roles", {
    id: (0, mysql_core_1.int)("id").primaryKey().autoincrement(),
    name: (0, mysql_core_1.varchar)("name", { length: 255 }).notNull().unique(),
    description: (0, mysql_core_1.text)("description"),
    isDefault: (0, mysql_core_1.boolean)("is_default").default(false),
    createdAt: (0, mysql_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, mysql_core_1.timestamp)("updated_at").defaultNow().onUpdateNow().notNull(),
});
// Permissions table
exports.permissions = (0, mysql_core_1.mysqlTable)("permissions", {
    id: (0, mysql_core_1.int)("id").primaryKey().autoincrement(),
    roleId: (0, mysql_core_1.int)("role_id").notNull().references(() => exports.roles.id, { onDelete: "cascade" }),
    module: (0, mysql_core_1.varchar)("module", { length: 100 }).notNull(),
    action: (0, mysql_core_1.varchar)("action", { length: 100 }).notNull(),
    createdAt: (0, mysql_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, mysql_core_1.timestamp)("updated_at").defaultNow().onUpdateNow().notNull(),
});
// User model with role reference
exports.users = (0, mysql_core_1.mysqlTable)("users", {
    id: (0, mysql_core_1.int)("id").primaryKey().autoincrement(),
    fullName: (0, mysql_core_1.varchar)("full_name", { length: 255 }).notNull(),
    email: (0, mysql_core_1.varchar)("email", { length: 255 }).notNull().unique(),
    password: (0, mysql_core_1.varchar)("password", { length: 255 }).notNull(),
    phoneNumber: (0, mysql_core_1.varchar)("phone_number", { length: 20 }),
    department: (0, mysql_core_1.varchar)("department", { length: 100 }).notNull(),
    roleId: (0, mysql_core_1.int)("role_id").references(() => exports.roles.id),
    active: (0, mysql_core_1.boolean)("active").default(true),
    cnic: (0, mysql_core_1.varchar)("cnic", { length: 20 }),
    createdAt: (0, mysql_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, mysql_core_1.timestamp)("updated_at").defaultNow().onUpdateNow().notNull(),
});
exports.insertUserSchema = (0, drizzle_zod_1.createInsertSchema)(exports.users).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertRoleSchema = (0, drizzle_zod_1.createInsertSchema)(exports.roles).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertPermissionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.permissions).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Items model
exports.items = (0, mysql_core_1.mysqlTable)("items", {
    id: (0, mysql_core_1.int)("id").primaryKey().autoincrement(),
    gatePassId: (0, mysql_core_1.int)("gate_pass_id").notNull(),
    name: (0, mysql_core_1.varchar)("name", { length: 255 }).notNull(),
    sku: (0, mysql_core_1.varchar)("sku", { length: 100 }).notNull(),
    quantity: (0, mysql_core_1.int)("quantity").notNull(),
});
exports.insertItemSchema = (0, drizzle_zod_1.createInsertSchema)(exports.items).omit({
    id: true,
    gatePassId: true,
});
// Gate Pass model
exports.gatePasses = (0, mysql_core_1.mysqlTable)("gate_passes", {
    id: (0, mysql_core_1.int)("id").primaryKey().autoincrement(),
    gatePassNumber: (0, mysql_core_1.varchar)("gate_pass_number", { length: 50 }).notNull().unique(),
    date: (0, mysql_core_1.date)("date").notNull(),
    // Customer information - can be linked to customers table or entered directly
    customerId: (0, mysql_core_1.int)("customer_id").notNull().default(0),
    customerName: (0, mysql_core_1.varchar)("customer_name", { length: 255 }).notNull(),
    customerPhone: (0, mysql_core_1.varchar)("customer_phone", { length: 20 }), // Customer phone number
    deliveryAddress: (0, mysql_core_1.text)("delivery_address").notNull(),
    // Driver information - can be linked to drivers table or entered directly
    driverId: (0, mysql_core_1.int)("driver_id").notNull().default(0),
    driverName: (0, mysql_core_1.varchar)("driver_name", { length: 255 }).notNull(),
    driverMobile: (0, mysql_core_1.varchar)("driver_mobile", { length: 20 }).notNull(),
    driverCnic: (0, mysql_core_1.varchar)("driver_cnic", { length: 20 }).notNull(),
    deliveryVanNumber: (0, mysql_core_1.varchar)("delivery_van_number", { length: 50 }).notNull(),
    department: (0, mysql_core_1.varchar)("department", { length: 100 }).notNull(),
    notes: (0, mysql_core_1.text)("notes"), // Additional notes
    createdBy: (0, mysql_core_1.varchar)("created_by", { length: 255 }).notNull(),
    createdById: (0, mysql_core_1.int)("created_by_id").notNull(),
    createdAt: (0, mysql_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, mysql_core_1.timestamp)("updated_at").defaultNow().onUpdateNow().notNull(),
    status: (0, mysql_core_1.varchar)("status", { length: 50 }).default("pending").notNull(),
});
exports.insertGatePassSchema = (0, drizzle_zod_1.createInsertSchema)(exports.gatePasses, {
    date: zod_1.z.coerce.date()
})
    .extend({
    driverMobile: zod_1.z.string()
        .regex(exports.PHONE_REGEX, exports.PHONE_ERROR)
        .min(12, "Phone number must be 12 characters long")
        .max(12, "Phone number must be 12 characters long"),
    driverCnic: zod_1.z.string()
        .regex(exports.CNIC_REGEX, exports.CNIC_ERROR)
        .min(15, "CNIC must be 15 characters long")
        .max(15, "CNIC must be 15 characters long"),
})
    .omit({
    id: true,
    gatePassNumber: true,
    createdAt: true,
});
// User validation schema for login
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters long"),
    rememberMe: zod_1.z.boolean().optional(),
});
// Gate Pass schema with items
exports.gatePassWithItemsSchema = exports.insertGatePassSchema.extend({
    items: zod_1.z.array(exports.insertItemSchema).min(1, "At least one item is required"),
});
// Customer model
exports.customers = (0, mysql_core_1.mysqlTable)("customers", {
    id: (0, mysql_core_1.int)("id").primaryKey().autoincrement(),
    name: (0, mysql_core_1.varchar)("name", { length: 255 }).notNull(),
    phone: (0, mysql_core_1.varchar)("phone", { length: 20 }),
    address: (0, mysql_core_1.text)("address"),
    contactPerson: (0, mysql_core_1.varchar)("contact_person", { length: 255 }),
    email: (0, mysql_core_1.varchar)("email", { length: 255 }),
    createdAt: (0, mysql_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, mysql_core_1.timestamp)("updated_at").defaultNow().onUpdateNow().notNull(),
});
exports.insertCustomerSchema = (0, drizzle_zod_1.createInsertSchema)(exports.customers)
    .extend({
    phone: zod_1.z.string()
        .regex(exports.PHONE_REGEX, exports.PHONE_ERROR)
        .min(12, "Phone number must be 12 characters long")
        .max(12, "Phone number must be 12 characters long"),
})
    .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Driver model
exports.drivers = (0, mysql_core_1.mysqlTable)("drivers", {
    id: (0, mysql_core_1.int)("id").primaryKey().autoincrement(),
    name: (0, mysql_core_1.varchar)("name", { length: 255 }).notNull(),
    mobile: (0, mysql_core_1.varchar)("mobile", { length: 20 }).notNull(),
    cnic: (0, mysql_core_1.varchar)("cnic", { length: 20 }).notNull().unique(),
    vehicleNumber: (0, mysql_core_1.varchar)("vehicle_number", { length: 50 }),
    createdAt: (0, mysql_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, mysql_core_1.timestamp)("updated_at").defaultNow().onUpdateNow().notNull(),
});
exports.insertDriverSchema = (0, drizzle_zod_1.createInsertSchema)(exports.drivers)
    .extend({
    mobile: zod_1.z.string()
        .regex(exports.PHONE_REGEX, exports.PHONE_ERROR)
        .min(12, "Phone number must be 12 characters long")
        .max(12, "Phone number must be 12 characters long"),
    cnic: zod_1.z.string()
        .regex(exports.CNIC_REGEX, exports.CNIC_ERROR)
        .min(15, "CNIC must be 15 characters long")
        .max(15, "CNIC must be 15 characters long"),
})
    .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// User Activity Logs table
exports.userActivityLogs = (0, mysql_core_1.mysqlTable)("user_activity_logs", {
    id: (0, mysql_core_1.int)("id").primaryKey().autoincrement(),
    userId: (0, mysql_core_1.int)("user_id").references(() => exports.users.id, { onDelete: "set null" }),
    userEmail: (0, mysql_core_1.varchar)("user_email", { length: 255 }).notNull(),
    actionType: (0, mysql_core_1.varchar)("action_type", { length: 100 }).notNull(), // login, logout, create, update, delete, etc.
    entityType: (0, mysql_core_1.varchar)("entity_type", { length: 100 }), // user, gatePass, customer, etc.
    entityId: (0, mysql_core_1.int)("entity_id"), // ID of the related entity if applicable
    description: (0, mysql_core_1.text)("description"), // Description of the activity
    ipAddress: (0, mysql_core_1.varchar)("ip_address", { length: 50 }), // IP address of the user
    userAgent: (0, mysql_core_1.text)("user_agent"), // Browser/device info
    timestamp: (0, mysql_core_1.timestamp)("timestamp").defaultNow().notNull(),
    additionalData: (0, mysql_core_1.text)("additional_data"), // JSON string for additional info
});
exports.insertUserActivityLogSchema = (0, drizzle_zod_1.createInsertSchema)(exports.userActivityLogs).omit({
    id: true,
    timestamp: true,
});
// Document attachments table
exports.documents = (0, mysql_core_1.mysqlTable)("documents", {
    id: (0, mysql_core_1.int)("id").primaryKey().autoincrement(),
    fileName: (0, mysql_core_1.varchar)("file_name", { length: 255 }).notNull(),
    fileType: (0, mysql_core_1.varchar)("file_type", { length: 100 }).notNull(), // MIME type
    fileSize: (0, mysql_core_1.int)("file_size").notNull(), // Size in bytes
    fileData: (0, mysql_core_1.text)("file_data").notNull(), // Base64 encoded file data
    entityType: (0, mysql_core_1.varchar)("entity_type", { length: 100 }).notNull(), // Type of entity this document is attached to (gatePass, customer, etc.)
    entityId: (0, mysql_core_1.int)("entity_id").notNull(), // ID of the related entity
    description: (0, mysql_core_1.text)("description"),
    uploadedBy: (0, mysql_core_1.int)("uploaded_by").references(() => exports.users.id, { onDelete: "set null" }),
    uploadedByEmail: (0, mysql_core_1.varchar)("uploaded_by_email", { length: 255 }).notNull(),
    createdAt: (0, mysql_core_1.timestamp)("created_at").defaultNow().notNull(),
});
exports.insertDocumentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.documents).omit({
    id: true,
    createdAt: true,
});
// Company settings table to store configurations
exports.companySettings = (0, mysql_core_1.mysqlTable)("company_settings", {
    id: (0, mysql_core_1.int)("id").primaryKey().autoincrement(),
    key: (0, mysql_core_1.varchar)("key", { length: 255 }).notNull().unique(),
    value: (0, mysql_core_1.json)("value"),
    createdAt: (0, mysql_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, mysql_core_1.timestamp)("updated_at").defaultNow().onUpdateNow().notNull(),
});
exports.insertCompanySettingSchema = (0, drizzle_zod_1.createInsertSchema)(exports.companySettings).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Notifications table for in-app notifications
exports.notifications = (0, mysql_core_1.mysqlTable)("notifications", {
    id: (0, mysql_core_1.int)("id").primaryKey().autoincrement(),
    userId: (0, mysql_core_1.int)("user_id").references(() => exports.users.id, { onDelete: "cascade" }),
    title: (0, mysql_core_1.varchar)("title", { length: 255 }).notNull(),
    message: (0, mysql_core_1.text)("message").notNull(),
    type: (0, mysql_core_1.varchar)("type", { length: 50 }).notNull(), // 'info', 'warning', 'success', 'error'
    read: (0, mysql_core_1.boolean)("read").default(false),
    entityType: (0, mysql_core_1.varchar)("entity_type", { length: 100 }), // Type of entity this notification is related to (gatePass, etc.)
    entityId: (0, mysql_core_1.int)("entity_id"), // ID of the related entity if applicable
    createdAt: (0, mysql_core_1.timestamp)("created_at").defaultNow().notNull(),
});
exports.insertNotificationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.notifications).omit({
    id: true,
    createdAt: true,
});
