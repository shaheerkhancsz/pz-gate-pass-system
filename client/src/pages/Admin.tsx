import React, { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmployeeForm } from "@/components/admin/EmployeeForm";
import { EmployeeList } from "@/components/admin/EmployeeList";
import { RolePermissionsManager } from "@/components/admin/RolePermissionsManager";
import { CompaniesManager } from "@/components/admin/CompaniesManager";
import { SapConfigManager } from "@/components/admin/SapConfigManager";
import { LdapConfigManager } from "@/components/admin/LdapConfigManager";
import { DepartmentsManager } from "@/components/admin/DepartmentsManager";
import { ApprovalSettingsManager } from "@/components/admin/ApprovalSettingsManager";
import { PlantsManager } from "@/components/admin/PlantsManager";
import { GatesManager } from "@/components/admin/GatesManager";
import { VendorsManager } from "@/components/admin/VendorsManager";
import { ItemMasterManager } from "@/components/admin/ItemMasterManager";
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
        <TabsList className="mb-6 overflow-x-auto">
          <TabsTrigger value="users">Employee List</TabsTrigger>
          <TabsTrigger value="register">Register Employee</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="roles">Roles &amp; Permissions</TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="companies">Companies</TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="departments">Departments</TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="plants">Plants</TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="gates">Gates</TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="items">Item Master</TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="sap">SAP Integration</TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="ad">Active Directory</TabsTrigger>
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

        {isAdmin && (
          <TabsContent value="companies">
            <CompaniesManager />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="departments">
            <DepartmentsManager />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="approvals">
            <ApprovalSettingsManager />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="plants">
            <PlantsManager />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="gates">
            <GatesManager />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="vendors">
            <VendorsManager />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="items">
            <ItemMasterManager />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="sap">
            <SapConfigManager />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="ad">
            <LdapConfigManager />
          </TabsContent>
        )}
      </Tabs>
    </AppLayout>
  );
}
