/**
 * Script to set up the database with roles, permissions, and test users
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import { createTestUsers } from './create-test-users';

const execAsync = promisify(exec);

async function setupDatabase() {
  console.log('📚 Starting database setup process...');

  try {
    // Run roles and permissions migration
    console.log('📑 Running role permissions migration script...');
    await execAsync('npx tsx migrate-roles.ts');
    console.log('✅ Roles and permissions migration completed!');

    // Create test users
    console.log('👤 Creating test users...');
    await createTestUsers();
    console.log('✅ Test users created successfully!');

    console.log('🎉 Database setup completed successfully!');
  } catch (error) {
    console.error('❌ Error during database setup:', error);
    process.exit(1);
  }
}

// Run if this script is executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  setupDatabase()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

export { setupDatabase };