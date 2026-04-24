import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NotificationBell } from "@/components/layout/NotificationBell";

interface HeaderProps {
  onMobileMenuToggle: () => void;
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement search functionality here
    console.log("Search query:", searchQuery);
  };

  return (
    <header className="bg-white shadow-sm h-16 flex items-center justify-between px-2 sm:px-4 md:px-6 flex-shrink-0">
      <div className="flex items-center">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onMobileMenuToggle}
          className="mr-2 sm:mr-4 md:hidden"
        >
          <span className="material-icons">menu</span>
        </Button>
        
        <form onSubmit={handleSearch} className="relative w-full sm:w-56 md:w-64">
          <span className="material-icons absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-gray text-base">
            search
          </span>
          <Input
            type="text"
            placeholder="Search..."
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-neutral-medium text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </div>
      
      <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-4">
        <NotificationBell />
        
        <Button 
          variant="ghost" 
          size="icon"
          className="hidden sm:flex"
        >
          <span className="material-icons text-sm sm:text-base">help_outline</span>
        </Button>
        
        <div className="h-6 sm:h-8 w-[1px] bg-neutral-medium hidden sm:block"></div>
        
        <div className="flex items-center space-x-2">
          <span className="hidden md:block text-sm">{user?.fullName}</span>
          <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-primary text-white flex items-center justify-center text-xs sm:text-sm">
            {user?.fullName?.charAt(0) || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
}
