/**
 * Script to create test users for the application
 */
import { db } from "../server/db";
import { users, type InsertUser } from "../shared/schema";
import * as bcrypt from "bcrypt";

async function createTestUsers() {
  console.log("Creating test users...");

  // Check if users already exist
  const existingUsers = await db.select().from(users);
  if (existingUsers.length > 0) {
    console.log(`${existingUsers.length} users already exist. Skipping test user creation.`);
    return;
  }

  // Prepare test users data
  const testUsers: InsertUser[] = [
    {
      fullName: "Admin User",
      email: "admin@parazelsus.pk",
      password: await bcrypt.hash("admin123", 10),
      department: "Administration",
      roleId: 1, // Admin role
      phoneNumber: "03001234567",
      cnic: "42101-1234567-1",
      active: true
    },
    {
      fullName: "Manager User",
      email: "manager@parazelsus.pk",
      password: await bcrypt.hash("manager123", 10),
      department: "Operations",
      roleId: 2, // Manager role
      phoneNumber: "03002345678",
      cnic: "42101-2345678-2",
      active: true
    },
    {
      fullName: "Staff User",
      email: "staff@parazelsus.pk",
      password: await bcrypt.hash("staff123", 10),
      department: "Warehouse",
      roleId: 3, // Staff role
      phoneNumber: "03003456789",
      cnic: "42101-3456789-3",
      active: true
    },
    {
      fullName: "Security User",
      email: "security@parazelsus.pk",
      password: await bcrypt.hash("security123", 10),
      department: "Security",
      roleId: 4, // Security role
      phoneNumber: "03004567890",
      cnic: "42101-4567890-4",
      active: true
    },
    {
      fullName: "Viewer User",
      email: "viewer@parazelsus.pk",
      password: await bcrypt.hash("viewer123", 10),
      department: "Finance",
      roleId: 5, // Viewer role
      phoneNumber: "03005678901",
      cnic: "42101-5678901-5",
      active: true
    }
  ];

  // Insert test users
  for (const user of testUsers) {
    try {
      const [createdUser] = await db.insert(users).values(user).returning();
      console.log(`Created user: ${createdUser.fullName} (${createdUser.email})`);
    } catch (error) {
      console.error(`Error creating user ${user.email}:`, error);
    }
  }

  console.log("Test users creation completed");
}

// Execute if this file is run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  createTestUsers()
    .then(() => {
      console.log("Script execution completed.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Script execution failed:", error);
      process.exit(1);
    });
}

export { createTestUsers };