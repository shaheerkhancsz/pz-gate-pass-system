import React, { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmployeeForm } from "@/components/admin/EmployeeForm";
import { EmployeeList } from "@/components/admin/EmployeeList";
import { RolePermissionsManager } from "@/components/admin/RolePermissionsManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/use-permissions";

export default function Admin() {
  const [activeTab, setActiveTab] = useState("users");
  const { isAdmin } = usePermissions();

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-medium text-neutral-dark">Admin Panel</h1>
      </div>
      
      <Tabs defaultValue="users" onValueChange={setActiveTab} value={activeTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="users">Employee List</TabsTrigger>
          <TabsTrigger value="register">Register Employee</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="users">
          <EmployeeList />
        </TabsContent>
        
        <TabsContent value="register">
          <EmployeeForm onSuccess={() => setActiveTab("users")} />
        </TabsContent>
        
        {isAdmin && (
          <TabsContent value="roles">
            <RolePermissionsManager />
          </TabsContent>
        )}
      </Tabs>
    </AppLayout>
  );
}
