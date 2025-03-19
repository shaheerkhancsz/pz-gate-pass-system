import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getCurrentUser, login, logout, isAdmin, hasPermission, AuthUser } from "@/lib/auth";
import { LoginInput } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  hasPermission: (module: string, action: string) => boolean;
  login: (data: LoginInput) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is logged in on mount
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  }, []);

  const handleLogin = async (data: LoginInput) => {
    try {
      setLoading(true);
      const user = await login(data);
      setUser(user);
      toast({
        title: "Login successful",
        description: `Welcome, ${user.fullName}!`,
      });
    } catch (error) {
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "Invalid credentials",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    toast({
      title: "Logged out",
      description: "You have been logged out successfully",
    });
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isAdmin: isAdmin(),
    hasPermission: (module: string, action: string) => hasPermission(module, action),
    login: handleLogin,
    logout: handleLogout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
