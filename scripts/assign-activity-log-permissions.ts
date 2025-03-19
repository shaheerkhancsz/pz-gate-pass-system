import { db } from "../server/db";
import { roles, permissions } from "../shared/schema";
import { eq } from "drizzle-orm";

/**
 * This script assigns activity log permissions to appropriate roles
 * It should be run after setting up basic roles and permissions
 */
async function assignActivityLogPermissions() {
  console.log("Starting activity log permissions assignment...");
  
  try {
    // 1. Find roles by name
    const adminRole = (await db.select().from(roles).where(eq(roles.name, "Admin")))[0];
    const managerRole = (await db.select().from(roles).where(eq(roles.name, "Manager")))[0];
    
    if (!adminRole) {
      throw new Error("Admin role not found. Please run the initial migration script first.");
    }
    
    // 2. Assign activityLog permissions to Admin role (all permissions)
    console.log(`Assigning activity log permissions to Admin role (ID: ${adminRole.id})...`);
    await db.insert(permissions).values([
      {
        roleId: adminRole.id,
        module: "activityLog",
        action: "read",
      }
    ]).onConflictDoNothing();
    
    // 3. Assign activityLog permissions to Manager role if it exists (read only)
    if (managerRole) {
      console.log(`Assigning activity log permissions to Manager role (ID: ${managerRole.id})...`);
      await db.insert(permissions).values([
        {
          roleId: managerRole.id,
          module: "activityLog",
          action: "read",
        }
      ]).onConflictDoNothing();
    } else {
      console.log("Manager role not found, skipping manager permissions.");
    }
    
    console.log("Activity log permissions assigned successfully!");
  } catch (error) {
    console.error("Error assigning activity log permissions:", error);
    throw error;
  }
}

// Execute the script
assignActivityLogPermissions()
  .then(() => {
    console.log("Script completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });