import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { KeyboardShortcutsHelp } from '@/components/ui/keyboard-shortcuts-help';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // If user is not authenticated, redirect to login
  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <div className="h-screen flex bg-neutral-lightest">
      {/* Sidebar - hidden on mobile, shown with overlay when menu button clicked */}
      <div className={`md:relative fixed inset-0 z-40 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 transition-transform duration-300 ease-in-out`}>
        <div className="absolute inset-0 bg-black/50 md:hidden" onClick={toggleMobileMenu}></div>
        <div className="relative h-full z-30 w-64 max-w-[80vw]">
          <Sidebar />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header onMobileMenuToggle={toggleMobileMenu} />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6 bg-neutral-lightest">
          {children}
        </main>
      </div>
      <KeyboardShortcutsHelp />
    </div>
  );
}
