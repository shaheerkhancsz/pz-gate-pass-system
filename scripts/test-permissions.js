/**
 * Simple script to test the permission system for different user types
 */
const permissions = [
  // Test viewing different modules
  { module: 'gatePass', action: 'read' },
  { module: 'gate_passes', action: 'view' },
  { module: 'customer', action: 'read' },
  { module: 'customers', action: 'view' },
  { module: 'driver', action: 'read' },
  { module: 'drivers', action: 'view' },
  { module: 'report', action: 'read' },
  { module: 'reports', action: 'view' },
  
  // Test different actions on gate passes
  { module: 'gatePass', action: 'create' },
  { module: 'gatePass', action: 'update' },
  { module: 'gatePass', action: 'delete' },
  { module: 'gatePass', action: 'approve' },
  { module: 'gatePass', action: 'verify' },
  
  // Test different ways to express the same permission
  { module: 'gate_pass', action: 'edit' },
  { module: 'gate-pass', action: 'update' },
];

// Mock users with their permissions
const users = {
  admin: {
    name: 'Admin User',
    role: 'admin',
    permissions: []
  },
  manager: {
    name: 'Manager User',
    role: 'manager',
    permissions: [
      { module: 'gatePass', action: 'create' },
      { module: 'gatePass', action: 'read' },
      { module: 'gatePass', action: 'update' },
      { module: 'gatePass', action: 'delete' },
      { module: 'gatePass', action: 'approve' },
      { module: 'customer', action: 'read' },
      { module: 'customer', action: 'create' },
      { module: 'customer', action: 'update' },
      { module: 'driver', action: 'read' },
      { module: 'driver', action: 'create' },
      { module: 'driver', action: 'update' },
      { module: 'report', action: 'read' },
    ]
  },
  staff: {
    name: 'Staff User',
    role: 'staff',
    permissions: [
      { module: 'gatePass', action: 'create' },
      { module: 'gatePass', action: 'read' },
      { module: 'gatePass', action: 'update' },
      { module: 'customer', action: 'read' },
      { module: 'driver', action: 'read' },
    ]
  },
  security: {
    name: 'Security User',
    role: 'security',
    permissions: [
      { module: 'gatePass', action: 'read' },
      { module: 'gatePass', action: 'verify' },
    ]
  },
  viewer: {
    name: 'Viewer User',
    role: 'viewer',
    permissions: [
      { module: 'gatePass', action: 'read' },
      { module: 'customer', action: 'read' },
      { module: 'driver', action: 'read' },
    ]
  },
  mixed: {
    name: 'Mixed User',
    role: 'custom',
    permissions: [
      { module: 'gate_passes', action: 'view' },
      { module: 'customers', action: 'view' },
      { module: 'gate_pass', action: 'edit' },
    ]
  }
};

// This represents our normalization logic from client/src/lib/auth.ts
function normalizeModuleName(module) {
  const moduleMap = {
    'gatepass': 'gatepass',
    'gatePass': 'gatepass',
    'gate_pass': 'gatepass',
    'gate_passes': 'gatepass',
    'gate-pass': 'gatepass',
    'gate-passes': 'gatepass',
    'customer': 'customer',
    'customers': 'customer',
    'driver': 'driver',
    'drivers': 'driver',
    'report': 'report',
    'reports': 'report',
    'user': 'user',
    'users': 'user',
    'setting': 'setting',
    'settings': 'setting',
    'dashboard': 'dashboard'
  };
  
  return moduleMap[module.toLowerCase()] || module.toLowerCase();
}

function normalizeActionName(action) {
  const actionMap = {
    'read': 'read',
    'view': 'read',
    'update': 'update',
    'edit': 'update',
    'create': 'create',
    'delete': 'delete',
    'approve': 'approve',
    'verify': 'verify'
  };
  
  return actionMap[action.toLowerCase()] || action.toLowerCase();
}

// This represents our hasPermission function from client/src/lib/auth.ts
function hasPermission(user, module, action) {
  // Admin has all permissions
  if (user.role === 'admin') return true;
  
  // Normalize module name to handle inconsistencies (both singular and plural forms)
  const normalizedModule = normalizeModuleName(module);
  
  // Normalize action to handle inconsistencies (view -> read, edit -> update)
  const normalizedAction = normalizeActionName(action);
  
  // If user has permissions array, check that first
  if (user.permissions && Array.isArray(user.permissions)) {
    return user.permissions.some(
      (p) => (normalizeModuleName(p.module) === normalizedModule) && 
             (normalizeActionName(p.action) === normalizedAction)
    );
  }
  
  return false;
}

// Run the test for each user and each permission
function runTest() {
  console.log('Permission Test Results:\n');
  
  for (const [userKey, user] of Object.entries(users)) {
    console.log(`\n\n==== User: ${user.name} (${userKey}) ====`);
    
    for (const permission of permissions) {
      const result = hasPermission(user, permission.module, permission.action);
      console.log(
        `${result ? '✅' : '❌'} ${permission.module}.${permission.action} => ${result ? 'Allowed' : 'Denied'}`
      );
    }
  }
}

// Run the test
runTest();