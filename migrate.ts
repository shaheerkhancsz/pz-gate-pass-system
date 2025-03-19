import { db } from './server/db';
import { 
  roles, 
  permissions, 
  users,
  ModuleType,
  PermissionAction
} from './shared/schema';
import { sql } from 'drizzle-orm';

async function migrate() {
  try {
    console.log('Starting migration...');

    // Create roles and permissions tables
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    console.log('Roles table created.');

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        module TEXT NOT NULL,
        action TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    console.log('Permissions table created.');

    // Add new columns to users table
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id),
      ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL;
    `);

    console.log('User table updated.');
    
    // Create default roles
    const adminRoleExists = await db.select().from(roles).where(sql`name = 'Admin'`);
    
    if (adminRoleExists.length === 0) {
      const [adminRole] = await db.insert(roles).values({
        name: 'Admin',
        description: 'Full system access',
        isDefault: false,
      }).returning();

      console.log('Admin role created.');
      
      // Create all permissions for admin
      const modules = Object.values(ModuleType);
      const actions = Object.values(PermissionAction);
      
      for (const module of modules) {
        for (const action of actions) {
          await db.insert(permissions).values({
            roleId: adminRole.id,
            module,
            action,
          });
        }
      }
      
      console.log('Admin permissions created.');
      
      // Create manager role with limited permissions
      const [managerRole] = await db.insert(roles).values({
        name: 'Manager',
        description: 'Can manage most features but with limited admin access',
        isDefault: false,
      }).returning();
      
      console.log('Manager role created.');
      
      // Add specific permissions for managers
      const managerPermissions = [
        // Dashboard - full access
        { module: ModuleType.DASHBOARD, action: PermissionAction.VIEW },
        
        // Gate Passes - full access
        { module: ModuleType.GATE_PASSES, action: PermissionAction.VIEW },
        { module: ModuleType.GATE_PASSES, action: PermissionAction.CREATE },
        { module: ModuleType.GATE_PASSES, action: PermissionAction.EDIT },
        { module: ModuleType.GATE_PASSES, action: PermissionAction.DELETE },
        
        // Customers - full access
        { module: ModuleType.CUSTOMERS, action: PermissionAction.VIEW },
        { module: ModuleType.CUSTOMERS, action: PermissionAction.CREATE },
        { module: ModuleType.CUSTOMERS, action: PermissionAction.EDIT },
        { module: ModuleType.CUSTOMERS, action: PermissionAction.DELETE },
        
        // Drivers - full access
        { module: ModuleType.DRIVERS, action: PermissionAction.VIEW },
        { module: ModuleType.DRIVERS, action: PermissionAction.CREATE },
        { module: ModuleType.DRIVERS, action: PermissionAction.EDIT },
        { module: ModuleType.DRIVERS, action: PermissionAction.DELETE },
        
        // Reports - view only
        { module: ModuleType.REPORTS, action: PermissionAction.VIEW },
        
        // Users - no access
        
        // Settings - no access
      ];
      
      for (const perm of managerPermissions) {
        await db.insert(permissions).values({
          roleId: managerRole.id,
          module: perm.module,
          action: perm.action,
        });
      }
      
      console.log('Manager permissions created.');
      
      // Create staff role with minimal permissions
      const [staffRole] = await db.insert(roles).values({
        name: 'Staff',
        description: 'Basic user with limited access',
        isDefault: true,
      }).returning();
      
      console.log('Staff role created.');
      
      // Add specific permissions for staff
      const staffPermissions = [
        // Dashboard - view only
        { module: ModuleType.DASHBOARD, action: PermissionAction.VIEW },
        
        // Gate Passes - create and view only
        { module: ModuleType.GATE_PASSES, action: PermissionAction.VIEW },
        { module: ModuleType.GATE_PASSES, action: PermissionAction.CREATE },
        
        // Customers - view only
        { module: ModuleType.CUSTOMERS, action: PermissionAction.VIEW },
        
        // Drivers - view only
        { module: ModuleType.DRIVERS, action: PermissionAction.VIEW },
        
        // No access to other modules
      ];
      
      for (const perm of staffPermissions) {
        await db.insert(permissions).values({
          roleId: staffRole.id,
          module: perm.module,
          action: perm.action,
        });
      }
      
      console.log('Staff permissions created.');
      
      // Update existing users to have admin role
      await db.execute(sql`
        UPDATE users SET role_id = ${adminRole.id} WHERE role = 'admin'
      `);
      
      // Update existing users to have staff role
      await db.execute(sql`
        UPDATE users SET role_id = ${staffRole.id} WHERE role = 'user'
      `);
      
      console.log('Existing users updated with role IDs.');
    } else {
      console.log('Admin role already exists, skipping role creation.');
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migrate();