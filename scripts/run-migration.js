// This script executes the migrate-roles.ts script to set up initial roles and permissions
import { exec } from 'child_process';

console.log('📑 Running role permissions migration script...');

// Run the migrate-roles.ts file with tsx
exec('npx tsx migrate-roles.ts', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Error executing migration script:', error);
    return;
  }
  
  if (stderr) {
    console.error('⚠️ Migration warnings/errors:', stderr);
  }
  
  console.log('✅ Migration script output:');
  console.log(stdout);
  console.log('✅ Roles and permissions migration completed!');
});