import { db } from './server/db';
import { roles, permissions, ModuleType, PermissionAction } from './shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Migration script to set up initial roles and permissions
 * This script should be run after the main schema migration
 */
async function migrateRolesAndPermissions() {
  // Database connection is already established in db.ts

  try {
    console.log('Starting roles and permissions migration...');

    // Define roles
    const roleDefinitions = [
      { name: 'Admin', description: 'Full system access' },
      { name: 'Manager', description: 'Can manage gate passes and view reports' },
      { name: 'Staff', description: 'Can create and view gate passes' },
      { name: 'Security', description: 'Can verify gate passes' },
      { name: 'Viewer', description: 'Read-only access' }
    ];

    // Create roles if they don't exist
    for (const roleDef of roleDefinitions) {
      const existingRole = await db.select().from(roles).where(eq(roles.name, roleDef.name));
      
      if (existingRole.length === 0) {
        console.log(`Creating role: ${roleDef.name}`);
        await db.insert(roles).values({
          name: roleDef.name,
          description: roleDef.description
        });
      } else {
        console.log(`Role ${roleDef.name} already exists`);
      }
    }

    // Fetch all created roles for reference
    const allRoles = await db.select().from(roles);
    const roleMap = new Map(allRoles.map(role => [role.name, role.id]));

    // Define permissions for each role
    const permissionDefinitions = [
      // Admin has all permissions (special case handled in code)
      
      // Manager permissions
      {
        roleName: 'Manager',
        permissions: [
          { module: ModuleType.GATE_PASS, action: PermissionAction.CREATE },
          { module: ModuleType.GATE_PASS, action: PermissionAction.READ },
          { module: ModuleType.GATE_PASS, action: PermissionAction.UPDATE },
          { module: ModuleType.GATE_PASS, action: PermissionAction.DELETE },
          { module: ModuleType.GATE_PASS, action: PermissionAction.APPROVE },
          { module: ModuleType.CUSTOMER, action: PermissionAction.CREATE },
          { module: ModuleType.CUSTOMER, action: PermissionAction.READ },
          { module: ModuleType.CUSTOMER, action: PermissionAction.UPDATE },
          { module: ModuleType.DRIVER, action: PermissionAction.CREATE },
          { module: ModuleType.DRIVER, action: PermissionAction.READ },
          { module: ModuleType.DRIVER, action: PermissionAction.UPDATE },
          { module: ModuleType.REPORT, action: PermissionAction.READ }
        ]
      },
      
      // Staff permissions
      {
        roleName: 'Staff',
        permissions: [
          { module: ModuleType.GATE_PASS, action: PermissionAction.CREATE },
          { module: ModuleType.GATE_PASS, action: PermissionAction.READ },
          { module: ModuleType.GATE_PASS, action: PermissionAction.UPDATE },
          { module: ModuleType.CUSTOMER, action: PermissionAction.READ },
          { module: ModuleType.DRIVER, action: PermissionAction.READ }
        ]
      },
      
      // Security permissions
      {
        roleName: 'Security',
        permissions: [
          { module: ModuleType.GATE_PASS, action: PermissionAction.READ },
          { module: ModuleType.GATE_PASS, action: PermissionAction.VERIFY }
        ]
      },
      
      // Viewer permissions
      {
        roleName: 'Viewer',
        permissions: [
          { module: ModuleType.GATE_PASS, action: PermissionAction.READ },
          { module: ModuleType.CUSTOMER, action: PermissionAction.READ },
          { module: ModuleType.DRIVER, action: PermissionAction.READ }
        ]
      }
    ];

    // Create permissions for each role
    for (const permDef of permissionDefinitions) {
      const roleId = roleMap.get(permDef.roleName);
      
      if (!roleId) {
        console.error(`Role ${permDef.roleName} not found`);
        continue;
      }
      
      // Get existing permissions for this role
      const existingPermissions = await db.select().from(permissions).where(eq(permissions.roleId, roleId));
      
      for (const perm of permDef.permissions) {
        // Check if this permission already exists
        const permExists = existingPermissions.some(
          existingPerm => 
            existingPerm.module === perm.module && 
            existingPerm.action === perm.action
        );
        
        if (!permExists) {
          console.log(`Creating permission: ${perm.module}.${perm.action} for role ${permDef.roleName}`);
          
          // Make sure module and action are valid
          if (!(perm.module in ModuleType)) {
            console.warn(`Warning: Module ${perm.module} is not defined in ModuleType`);
          }
          
          if (!(perm.action in PermissionAction)) {
            console.warn(`Warning: Action ${perm.action} is not defined in PermissionAction`);
          }
          
          await db.insert(permissions).values({
            roleId,
            module: perm.module,
            action: perm.action
          });
        } else {
          console.log(`Permission ${perm.module}.${perm.action} already exists for role ${permDef.roleName}`);
        }
      }
    }

    console.log('Roles and permissions migration completed successfully');
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}

migrateRolesAndPermissions()
  .then(() => {
    console.log('Migration script finished');
    process.exit(0);
  })
  .catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });