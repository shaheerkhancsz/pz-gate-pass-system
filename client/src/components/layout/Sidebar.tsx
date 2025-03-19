import React, { useState } from "react";
import { useLocation, Link } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/use-permissions";
import { companyName } from "@/config/company";

export function Sidebar() {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, isAdmin } = useAuth();
  const { 
    canRead,
    canCreate,
    canViewReports,
    canVerifyGatePass,
    canViewActivityLogs
  } = usePermissions();

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  const isActive = (path: string) => {
    return location === path;
  };

  return (
    <aside 
      className={cn(
        "h-full flex flex-col bg-primary text-white flex-shrink-0 transition-all duration-300 shadow-lg",
        collapsed ? "w-16" : "w-64"
      )}
      data-collapsed={collapsed}
    >
      {/* Header/Logo Section */}
      <div className="flex flex-col border-b border-primary-light shrink-0">
        <div className={cn(
          "flex items-center justify-between p-4",
          collapsed && "justify-center"
        )}>
          <div className={cn(
            "flex items-center",
            collapsed ? "justify-center w-8" : "w-[180px]"
          )}>
            <img 
              src="/assets/PZ-logo.png"
              alt={`${companyName} Logo`} 
              className="w-full h-auto object-contain mix-blend-screen"
            />
          </div>
          {!collapsed && (
            <button 
              onClick={toggleSidebar}
              className="p-1.5 rounded-full hover:bg-primary-light shrink-0 ml-2"
            >
              <span className="material-icons text-xl">
                {collapsed ? "menu_open" : "menu"}
              </span>
            </button>
          )}
        </div>
        
        {!collapsed && (
          <div className="px-4 pb-4">
            <h1 className="font-bold text-xl leading-tight text-white">{companyName}</h1>
            <p className="text-sm text-white/90 mt-0.5">Gate Pass System</p>
          </div>
        )}
      </div>
      
      {/* Navigation Section */}
      <nav className="flex-1 overflow-y-auto py-2">
        <ul className="space-y-0.5 px-2">
          {/* Dashboard - Always visible */}
          <li>
            <Link href="/">
              <div className={cn(
                "flex items-center px-3 py-2 rounded-md hover:bg-primary-dark transition-colors duration-200 cursor-pointer",
                isActive("/") && "bg-primary-dark",
                collapsed && "justify-center px-2"
              )}>
                <span className="material-icons w-6">dashboard</span>
                {!collapsed && <span className="ml-3 truncate">Dashboard</span>}
              </div>
            </Link>
          </li>
          
          {/* Gate Passes - Only visible if user can read gate passes */}
          {canRead('gatePass') && (
            <li>
              <Link href="/gate-passes">
                <div className={cn(
                  "flex items-center px-3 py-2 rounded-md hover:bg-primary-dark transition-colors duration-200 cursor-pointer",
                  isActive("/gate-passes") && "bg-primary-dark",
                  collapsed && "justify-center px-2"
                )}>
                  <span className="material-icons w-6">list_alt</span>
                  {!collapsed && <span className="ml-3 truncate">Gate Passes</span>}
                </div>
              </Link>
            </li>
          )}
          
          {/* Create Gate Pass - Only visible if user can create gate passes */}
          {canCreate('gatePass') && (
            <li>
              <Link href="/create-gate-pass">
                <div className={cn(
                  "flex items-center px-3 py-2 rounded-md hover:bg-primary-dark transition-colors duration-200 cursor-pointer",
                  isActive("/create-gate-pass") && "bg-primary-dark",
                  collapsed && "justify-center px-2"
                )}>
                  <span className="material-icons w-6">add_circle</span>
                  {!collapsed && <span className="ml-3 truncate">Create Gate Pass</span>}
                </div>
              </Link>
            </li>
          )}
          
          {/* Reports - Only visible if user can view reports */}
          {canViewReports() && (
            <li>
              <Link href="/reports">
                <div className={cn(
                  "flex items-center px-3 py-2 rounded-md hover:bg-primary-dark transition-colors duration-200 cursor-pointer",
                  isActive("/reports") && "bg-primary-dark",
                  collapsed && "justify-center px-2"
                )}>
                  <span className="material-icons w-6">assessment</span>
                  {!collapsed && <span className="ml-3 truncate">Reports</span>}
                </div>
              </Link>
            </li>
          )}
          
          {/* QR Scanner - Only visible if user can verify gate passes */}
          {canVerifyGatePass() && (
            <li>
              <Link href="/verify-gate-pass">
                <div className={cn(
                  "flex items-center px-3 py-2 rounded-md hover:bg-primary-dark transition-colors duration-200 cursor-pointer",
                  isActive("/verify-gate-pass") && "bg-primary-dark",
                  collapsed && "justify-center px-2"
                )}>
                  <span className="material-icons w-6">qr_code_scanner</span>
                  {!collapsed && <span className="ml-3 truncate">QR Scanner</span>}
                </div>
              </Link>
            </li>
          )}
          
          {/* Customers - Only visible if user can read customers */}
          {canRead('customer') && (
            <li>
              <Link href="/customers">
                <div className={cn(
                  "flex items-center px-3 py-2 rounded-md hover:bg-primary-dark transition-colors duration-200 cursor-pointer",
                  isActive("/customers") && "bg-primary-dark",
                  collapsed && "justify-center px-2"
                )}>
                  <span className="material-icons w-6">people</span>
                  {!collapsed && <span className="ml-3 truncate">Customers</span>}
                </div>
              </Link>
            </li>
          )}
          
          {/* Drivers - Only visible if user can read drivers */}
          {canRead('driver') && (
            <li>
              <Link href="/drivers">
                <div className={cn(
                  "flex items-center px-3 py-2 rounded-md hover:bg-primary-dark transition-colors duration-200 cursor-pointer",
                  isActive("/drivers") && "bg-primary-dark",
                  collapsed && "justify-center px-2"
                )}>
                  <span className="material-icons w-6">local_shipping</span>
                  {!collapsed && <span className="ml-3 truncate">Drivers</span>}
                </div>
              </Link>
            </li>
          )}
          
          {/* Admin Panel and Company Settings - Only for admins */}
          {isAdmin && (
            <>
              <li>
                <Link href="/admin">
                  <div className={cn(
                    "flex items-center px-3 py-2 rounded-md hover:bg-primary-dark transition-colors duration-200 cursor-pointer",
                    isActive("/admin") && "bg-primary-dark",
                    collapsed && "justify-center px-2"
                  )}>
                    <span className="material-icons w-6">admin_panel_settings</span>
                    {!collapsed && <span className="ml-3 truncate">Admin Panel</span>}
                  </div>
                </Link>
              </li>
              <li>
                <Link href="/company-settings">
                  <div className={cn(
                    "flex items-center px-3 py-2 rounded-md hover:bg-primary-dark transition-colors duration-200 cursor-pointer",
                    isActive("/company-settings") && "bg-primary-dark",
                    collapsed && "justify-center px-2"
                  )}>
                    <span className="material-icons w-6">business</span>
                    {!collapsed && <span className="ml-3 truncate">Company Settings</span>}
                  </div>
                </Link>
              </li>
            </>
          )}
          
          {/* Activity Logs - Check permission instead of admin-only */}
          {canViewActivityLogs() && (
            <li>
              <Link href="/activity-logs">
                <div className={cn(
                  "flex items-center px-3 py-2 rounded-md hover:bg-primary-dark transition-colors duration-200 cursor-pointer",
                  isActive("/activity-logs") && "bg-primary-dark",
                  collapsed && "justify-center px-2"
                )}>
                  <span className="material-icons w-6">history</span>
                  {!collapsed && <span className="ml-3 truncate">Activity Logs</span>}
                </div>
              </Link>
            </li>
          )}
          
          {/* Notification Settings - Admin only */}
          {isAdmin && (
            <li>
              <Link href="/notification-settings">
                <div className={cn(
                  "flex items-center px-3 py-2 rounded-md hover:bg-primary-dark transition-colors duration-200 cursor-pointer",
                  isActive("/notification-settings") && "bg-primary-dark",
                  collapsed && "justify-center px-2"
                )}>
                  <span className="material-icons w-6">notifications</span>
                  {!collapsed && <span className="ml-3 truncate">Notification Settings</span>}
                </div>
              </Link>
            </li>
          )}
        </ul>
      </nav>
      
      {/* User Profile & Logout Section */}
      <div className={cn(
        "shrink-0 border-t border-primary-light bg-primary",
        collapsed ? "p-2" : "p-3"
      )}>
        {user && (
          <div className={cn(
            "flex items-center gap-3 mb-2",
            collapsed && "flex-col gap-2"
          )}>
            <img 
              src="https://via.placeholder.com/40x40" 
              alt="User Avatar" 
              className="h-8 w-8 rounded-full bg-white shrink-0"
            />
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{user.fullName}</p>
                <p className="text-xs opacity-80 truncate">{user.department}</p>
              </div>
            )}
          </div>
        )}
        <button 
          onClick={logout}
          className={cn(
            "flex items-center text-sm w-full rounded-md hover:bg-primary-dark transition-colors",
            collapsed ? "justify-center p-2" : "justify-start px-3 py-2"
          )}
        >
          <span className="material-icons text-sm">{collapsed ? "logout" : "logout"}</span>
          {!collapsed && <span className="ml-2">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
