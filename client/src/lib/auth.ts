import { apiRequest } from "./queryClient";
import { LoginInput, User } from "@shared/schema";

// localStorage keys
const TOKEN_KEY = "gatepass_auth_token";
const USER_KEY = "gatepass_user";

// Permission type for user permissions
type Permission = {
  id: number;
  roleId: number;
  module: string;
  action: string;
};

// Type for authenticated user (excludes password)
export type AuthUser = Omit<User, "password" | "createdAt"> & {
  // Include legacy role field for backward compatibility
  role?: string;
  // Include permissions array for new RBAC system
  permissions?: Permission[];
};

// Login function
export async function login(data: LoginInput): Promise<AuthUser> {
  const response = await apiRequest("POST", "/api/auth/login", data);
  const user = await response.json();
  
  // Store user in localStorage if remember me is checked
  if (data.rememberMe) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    // Otherwise, store in sessionStorage which will be cleared when browser closes
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  
  return user;
}

// Logout function
export function logout(): void {
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(USER_KEY);
}

// Get current user from storage
export function getCurrentUser(): AuthUser | null {
  const userFromLocal = localStorage.getItem(USER_KEY);
  const userFromSession = sessionStorage.getItem(USER_KEY);
  
  if (userFromLocal) {
    return JSON.parse(userFromLocal);
  }
  
  if (userFromSession) {
    return JSON.parse(userFromSession);
  }
  
  return null;
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}

// Check if user is admin
export function isAdmin(): boolean {
  const user = getCurrentUser();
  if (!user) return false;
  
  // Primary check: roleId-based (new way)
  if (user.roleId === 1) return true;
  
  // Secondary check: string role (backward compatibility)
  if (user.role === "admin") return true;
  
  return false;
}

// Check user's permissions based on role
export function hasPermission(module: string, action: string): boolean {
  const user = getCurrentUser();
  if (!user) return false;
  
  // Admin has all permissions
  if (isAdmin()) return true;
  
  // Normalize module name to handle inconsistencies (both singular and plural forms)
  const normalizedModule = normalizeModuleName(module);
  
  // Normalize action to handle inconsistencies (view -> read, edit -> update)
  const normalizedAction = normalizeActionName(action);
  
  // If user has permissions array from API, check that first
  if (user.permissions && Array.isArray(user.permissions)) {
    return user.permissions.some(
      (p) => (normalizeModuleName(p.module) === normalizedModule) && 
             (normalizeActionName(p.action) === normalizedAction)
    );
  }
  
  // Legacy role-based fallback - ensure backward compatibility
  if (user.role === "manager") {
    const managerAllowedActions = ["create", "read", "update", "approve"];
    return managerAllowedActions.includes(normalizedAction);
  }
  
  if (user.role === "staff") {
    const staffAllowedActions = ["create", "read", "update"];
    const staffAllowedModules = ["gatepass", "customer", "driver"];
    return staffAllowedActions.includes(normalizedAction) && 
           staffAllowedModules.includes(normalizedModule);
  }
  
  if (user.role === "security") {
    return (normalizedModule === "gatepass" && 
           (normalizedAction === "read" || normalizedAction === "verify"));
  }
  
  if (user.role === "viewer") {
    return normalizedAction === "read";
  }
  
  return false;
}

// Helper function to normalize module names
function normalizeModuleName(module: string): string {
  const moduleMap: Record<string, string> = {
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

// Helper function to normalize action names
function normalizeActionName(action: string): string {
  const actionMap: Record<string, string> = {
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
