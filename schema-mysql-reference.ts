// Remaining schema tables to convert from PostgreSQL to MySQL
// This file contains the converted table definitions for:
// - gatePasses
// - customers
// - drivers
// - userActivityLogs
// - documents
// - companySettings
// - notifications

// Gate Pass model
export const gatePasses = mysqlTable("gate_passes", {
    id: int("id").primaryKey().autoincrement(),
    gatePassNumber: varchar("gate_pass_number", { length: 50 }).notNull().unique(),
    date: date("date").notNull(),
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
    notes: text("notes"), // Additional notes
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    createdById: int("created_by_id").notNull(),
    createdAt: datetime("created_at").notNull(),
    status: varchar("status", { length: 50 }).default("pending").notNull(),
});

// Customer model
export const customers = mysqlTable("customers", {
    id: int("id").primaryKey().autoincrement(),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    address: text("address"),
    contactPerson: varchar("contact_person", { length: 255 }),
    email: varchar("email", { length: 255 }),
    createdAt: datetime("created_at").notNull(),
    updatedAt: datetime("updated_at").notNull(),
});

// Driver model
export const drivers = mysqlTable("drivers", {
    id: int("id").primaryKey().autoincrement(),
    name: varchar("name", { length: 255 }).notNull(),
    mobile: varchar("mobile", { length: 20 }).notNull(),
    cnic: varchar("cnic", { length: 20 }).notNull().unique(),
    vehicleNumber: varchar("vehicle_number", { length: 50 }),
    createdAt: datetime("created_at").notNull(),
    updatedAt: datetime("updated_at").notNull(),
});

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
    timestamp: datetime("timestamp").notNull(),
    additionalData: text("additional_data"), // JSON string for additional info
});

// Document attachments table
export const documents = mysqlTable("documents", {
    id: int("id").primaryKey().autoincrement(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileType: varchar("file_type", { length: 100 }).notNull(), // MIME type
    fileSize: int("file_size").notNull(), // Size in bytes
    fileData: text("file_data").notNull(), // Base64 encoded file data
    entityType: varchar("entity_type", { length: 100 }).notNull(), // Type of entity this document is attached to (gatePass, customer, etc.)
    entityId: int("entity_id").notNull(), // ID of the related entity
    description: text("description"),
    uploadedBy: int("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    uploadedByEmail: varchar("uploaded_by_email", { length: 255 }).notNull(),
    createdAt: datetime("created_at").notNull(),
});

// Company settings table to store configurations
export const companySettings = mysqlTable("company_settings", {
    id: int("id").primaryKey().autoincrement(),
    key: varchar("key", { length: 255 }).notNull().unique(),
    value: json("value"), // Changed from jsonb to json for MySQL
    createdAt: datetime("created_at").notNull(),
    updatedAt: datetime("updated_at").notNull(),
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
    createdAt: datetime("created_at").notNull(),
});
