import React, { useState, useRef } from "react";
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
import { ItemMasterManager } from "@/components/admin/ItemMasterManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/use-permissions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Admin() {
  const [activeTab, setActiveTab] = useState("users");
  const { isAdmin } = usePermissions();
  const isEmployeeFormDirty = useRef(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  const handleTabChange = (newTab: string) => {
    if (activeTab === "register" && isEmployeeFormDirty.current) {
      setPendingTab(newTab);
    } else {
      setActiveTab(newTab);
    }
  };

  const confirmLeave = () => {
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
  };

  const cancelLeave = () => {
    setPendingTab(null);
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-medium text-neutral-dark">Admin Panel</h1>
      </div>

      <AlertDialog open={pendingTab !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in the employee registration form. Do you want to leave without saving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelLeave}>No, Stay</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLeave}>Yes, Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs defaultValue="users" onValueChange={handleTabChange} value={activeTab}>
        <TabsList className="mb-4 sm:mb-6 flex w-full overflow-x-auto whitespace-nowrap pb-1 h-auto flex-nowrap justify-start gap-1">
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
          <EmployeeForm
            onSuccess={() => setActiveTab("users")}
            onDirtyChange={(dirty) => { isEmployeeFormDirty.current = dirty; }}
          />
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
