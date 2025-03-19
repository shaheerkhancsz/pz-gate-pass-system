/**
 * Migration script to create documents table and add document permissions
 */

import { db } from "./server/db";
import { documents, permissions, roles } from "./shared/schema";
import { eq } from "drizzle-orm";

async function migrateDocumentsTable() {
  try {
    console.log("Creating documents table...");
    
    // Create the documents table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_data TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        description TEXT,
        uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        uploaded_by_email TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    
    console.log("Documents table created successfully.");
    
    // Add document permissions for admin role
    const [adminRole] = await db.select().from(roles).where(eq(roles.name, "Admin"));
    
    if (adminRole) {
      console.log("Adding document permissions for Admin role...");
      
      // Create permissions for document module
      const documentPermissions = [
        { roleId: adminRole.id, module: "document", action: "create" },
        { roleId: adminRole.id, module: "document", action: "read" },
        { roleId: adminRole.id, module: "document", action: "update" },
        { roleId: adminRole.id, module: "document", action: "delete" },
      ];
      
      // Insert document permissions
      await db.insert(permissions).values(documentPermissions);
      
      console.log("Document permissions added for Admin role.");
    }
    
    // Add document permissions for manager role
    const [managerRole] = await db.select().from(roles).where(eq(roles.name, "Manager"));
    
    if (managerRole) {
      console.log("Adding document permissions for Manager role...");
      
      // Create permissions for document module
      const documentPermissions = [
        { roleId: managerRole.id, module: "document", action: "create" },
        { roleId: managerRole.id, module: "document", action: "read" },
        { roleId: managerRole.id, module: "document", action: "update" },
        { roleId: managerRole.id, module: "document", action: "delete" },
      ];
      
      // Insert document permissions
      await db.insert(permissions).values(documentPermissions);
      
      console.log("Document permissions added for Manager role.");
    }
    
    // Add read-only permissions for Staff role
    const [staffRole] = await db.select().from(roles).where(eq(roles.name, "Staff"));
    
    if (staffRole) {
      console.log("Adding document read permissions for Staff role...");
      
      // Create permissions for document module
      const documentPermissions = [
        { roleId: staffRole.id, module: "document", action: "read" },
      ];
      
      // Insert document permissions
      await db.insert(permissions).values(documentPermissions);
      
      console.log("Document permissions added for Staff role.");
    }
    
    // Add read-only permissions for Security role
    const [securityRole] = await db.select().from(roles).where(eq(roles.name, "Security"));
    
    if (securityRole) {
      console.log("Adding document read permissions for Security role...");
      
      // Create permissions for document module
      const documentPermissions = [
        { roleId: securityRole.id, module: "document", action: "read" },
      ];
      
      // Insert document permissions
      await db.insert(permissions).values(documentPermissions);
      
      console.log("Document permissions added for Security role.");
    }
    
    // Add read-only permissions for Viewer role
    const [viewerRole] = await db.select().from(roles).where(eq(roles.name, "Viewer"));
    
    if (viewerRole) {
      console.log("Adding document read permissions for Viewer role...");
      
      // Create permissions for document module
      const documentPermissions = [
        { roleId: viewerRole.id, module: "document", action: "read" },
      ];
      
      // Insert document permissions
      await db.insert(permissions).values(documentPermissions);
      
      console.log("Document permissions added for Viewer role.");
    }
    
    console.log("Documents migration completed successfully.");
  } catch (error) {
    console.error("Error during documents migration:", error);
    throw error;
  }
}

// Run the migration
migrateDocumentsTable()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });