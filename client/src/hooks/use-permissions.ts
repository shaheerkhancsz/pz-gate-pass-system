import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook for working with feature-level permissions based on the user's role
 * and specific permissions
 */
export function usePermissions() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  
  /**
   * Check if the current user has permission for a specific module and action
   * 
   * @param module The module/feature to check (e.g., 'gatePass', 'customer', etc.)
   * @param action The action to check (e.g., 'create', 'read', 'update', 'delete')
   * @returns boolean indicating if the user has permission
   */
  const hasPermission = (module: string, action: string): boolean => {
    if (!isAuthenticated || !user) return false;
    
    // Admin has all permissions
    if (isAdmin) return true;
    
    // Check if user has the specific permission
    if (user.permissions) {
      return user.permissions.some(
        (permission) => 
          permission.module.toLowerCase() === module.toLowerCase() && 
          permission.action.toLowerCase() === action.toLowerCase()
      );
    }
    
    return false;
  };
  
  /**
   * Check if the current user can access a specific feature
   * 
   * @param module The module/feature to check (e.g., 'gatePass', 'customer', etc.)
   * @param action The action to check (e.g., 'create', 'read', 'update', 'delete')
   * @returns boolean indicating if the user has permission
   */
  const can = (module: string, action: string): boolean => {
    return hasPermission(module, action);
  };
  
  /**
   * Check if the current user can perform create operations on a module
   * 
   * @param module The module/feature to check
   * @returns boolean indicating if the user has create permission
   */
  const canCreate = (module: string): boolean => {
    return can(module, 'create');
  };
  
  /**
   * Check if the current user can perform read operations on a module
   * 
   * @param module The module/feature to check
   * @returns boolean indicating if the user has read permission
   */
  const canRead = (module: string): boolean => {
    return can(module, 'read');
  };
  
  /**
   * Check if the current user can perform update operations on a module
   * 
   * @param module The module/feature to check
   * @returns boolean indicating if the user has update permission
   */
  const canUpdate = (module: string): boolean => {
    return can(module, 'update');
  };
  
  /**
   * Check if the current user can perform delete operations on a module
   * 
   * @param module The module/feature to check
   * @returns boolean indicating if the user has delete permission
   */
  const canDelete = (module: string): boolean => {
    return can(module, 'delete');
  };
  
  /**
   * Check if the current user can approve gate passes
   * This is a specific action that may have its own permission
   * 
   * @returns boolean indicating if the user has approval permission
   */
  const canApproveGatePass = (): boolean => {
    return can('gatePass', 'approve');
  };
  
  /**
   * Check if the current user can verify gate passes
   * This is a specific action that may have its own permission
   * 
   * @returns boolean indicating if the user has verification permission
   */
  const canVerifyGatePass = (): boolean => {
    return can('gatePass', 'verify');
  };
  
  /**
   * Check if the current user can view reports
   * 
   * @returns boolean indicating if the user has report viewing permission
   */
  const canViewReports = (): boolean => {
    return can('report', 'read');
  };
  
  /**
   * Check if the current user can access activity logs
   * 
   * @returns boolean indicating if the user has activity logs access permission
   */
  const canViewActivityLogs = (): boolean => {
    return can('activityLog', 'read');
  };

  /**
   * Check if the current user can access QR Scanner
   * 
   * @returns boolean indicating if the user has QR Scanner access permission
   */
  const canUseQRScanner = (): boolean => {
    return can('qrScanner', 'read');
  };

  /**
   * Check if the current user can access Documents
   * 
   * @returns boolean indicating if the user has Documents access permission
   */
  const canAccessDocuments = (): boolean => {
    return can('document', 'read');
  };

  /**
   * Check if the current user can access Notifications
   * 
   * @returns boolean indicating if the user has Notifications access permission
   */
  const canAccessNotifications = (): boolean => {
    return can('notification', 'read');
  };
  
  return {
    can,
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    canApproveGatePass,
    canVerifyGatePass,
    canViewReports,
    canViewActivityLogs,
    canUseQRScanner,
    canAccessDocuments,
    canAccessNotifications,
    hasPermission,
    isAdmin
  };
}