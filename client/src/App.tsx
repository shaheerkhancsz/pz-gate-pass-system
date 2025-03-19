import React from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";

// Pages
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import CreateGatePass from "@/pages/CreateGatePass";
import GatePassList from "@/pages/GatePassList";
import Reports from "@/pages/Reports";
import Admin from "@/pages/Admin";
import PrintGatePass from "@/pages/PrintGatePass";
import ViewGatePass from "@/pages/ViewGatePass";
import EditGatePass from "@/pages/EditGatePass";
import VerifyGatePass from "@/pages/VerifyGatePass";
import PublicVerifyGatePass from "@/pages/PublicVerifyGatePass";
import CompanySettings from "@/pages/CompanySettings";
import NotificationSettings from "@/pages/NotificationSettings";
import Customers from "@/pages/Customers";
import Drivers from "@/pages/Drivers";
import ActivityLogs from "@/pages/ActivityLogs";
import NotFound from "@/pages/not-found";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";

// Protected Route Component
interface ProtectedRouteProps {
  component: React.ComponentType;
  adminOnly?: boolean;
  requiredPermission?: {
    module: string;
    action: string;
  };
}

function ProtectedRoute({ 
  component: Component, 
  adminOnly = false,
  requiredPermission
}: ProtectedRouteProps) {
  const { isAuthenticated, isAdmin, hasPermission, loading } = useAuth();
  const [, navigate] = useLocation();

  // Fix for React warning: use useEffect for navigation instead of during render
  React.useEffect(() => {
    // Don't redirect while loading authentication state
    if (loading) return;
    
    // If not authenticated, redirect to login
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    
    // Check permission requirements
    const hasAccess = 
      // Admin check
      (adminOnly && isAdmin) || 
      // If not admin-only, check for either being admin or having specific permission
      (!adminOnly && (!requiredPermission || 
                      isAdmin || 
                      hasPermission(requiredPermission.module, requiredPermission.action)));
    
    // If no access, redirect to dashboard
    if (!hasAccess) {
      navigate("/");
    }
  }, [isAuthenticated, isAdmin, hasPermission, loading, navigate, adminOnly, requiredPermission]);

  // If still loading auth state, show loading spinner
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
    </div>;
  }

  // Check permissions for rendering
  const hasAccess = 
    // Must be authenticated
    isAuthenticated && 
    // And either: not admin-only OR user is admin
    (!adminOnly || isAdmin) && 
    // And either: no specific permission required OR user is admin OR user has required permission
    (!requiredPermission || isAdmin || hasPermission(requiredPermission.module, requiredPermission.action));

  // Don't render if no access
  if (!hasAccess) {
    return null;
  }

  // If authenticated and has proper permissions, render the component
  return <Component />;
}

function Router() {
  return (
    <Switch>
      {/* Public routes - no authentication required */}
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password/:token" component={ResetPassword} />
      
      {/* Public verification route specifically for external mobile scanning */}
      <Route path="/verify/:gatePassNumber" component={PublicVerifyGatePass} />
      
      {/* Protected routes - require authentication */}
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/create-gate-pass">
        <ProtectedRoute 
          component={CreateGatePass} 
          requiredPermission={{ module: "gatePass", action: "create" }} 
        />
      </Route>
      <Route path="/gate-passes">
        <ProtectedRoute 
          component={GatePassList} 
          requiredPermission={{ module: "gatePass", action: "read" }} 
        />
      </Route>
      <Route path="/edit-gate-pass/:id">
        <ProtectedRoute 
          component={EditGatePass} 
          requiredPermission={{ module: "gatePass", action: "update" }} 
        />
      </Route>
      <Route path="/view-gate-pass/:id">
        <ProtectedRoute 
          component={ViewGatePass} 
          requiredPermission={{ module: "gatePass", action: "read" }} 
        />
      </Route>
      <Route path="/print-gate-pass/:id">
        <ProtectedRoute 
          component={PrintGatePass} 
          requiredPermission={{ module: "gatePass", action: "read" }} 
        />
      </Route>
      <Route path="/reports">
        <ProtectedRoute 
          component={Reports} 
          requiredPermission={{ module: "report", action: "read" }} 
        />
      </Route>
      <Route path="/admin">
        <ProtectedRoute component={Admin} adminOnly={true} />
      </Route>
      <Route path="/company-settings">
        <ProtectedRoute component={CompanySettings} adminOnly={true} />
      </Route>
      <Route path="/notification-settings">
        <ProtectedRoute component={NotificationSettings} adminOnly={true} />
      </Route>
      <Route path="/verify-gate-pass">
        <ProtectedRoute 
          component={VerifyGatePass} 
          requiredPermission={{ module: "gatePass", action: "verify" }} 
        />
      </Route>
      <Route path="/customers">
        <ProtectedRoute 
          component={Customers} 
          requiredPermission={{ module: "customer", action: "read" }} 
        />
      </Route>
      <Route path="/drivers">
        <ProtectedRoute 
          component={Drivers} 
          requiredPermission={{ module: "driver", action: "read" }} 
        />
      </Route>
      
      <Route path="/activity-logs">
        <ProtectedRoute 
          component={ActivityLogs} 
          requiredPermission={{ module: "activityLog", action: "read" }}
        />
      </Route>
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
