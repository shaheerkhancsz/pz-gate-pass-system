import React, { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ReportsPanel } from "@/components/reports/ReportsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { CustomReportBuilder } from "@/components/reports/CustomReportBuilder";
import { AnalyticsVisualization } from "@/components/reports/AnalyticsVisualization";
import { PendingApprovalsReport } from "@/components/reports/PendingApprovalsReport";
import { ReturnableTracker } from "@/components/reports/ReturnableTracker";
import { GatePlantTrafficReport } from "@/components/reports/GatePlantTrafficReport";
import { CompanyWiseSummaryReport } from "@/components/reports/CompanyWiseSummaryReport";
import { DepartmentWiseSummaryReport } from "@/components/reports/DepartmentWiseSummaryReport";
import { UserActivityReport } from "@/components/reports/UserActivityReport";
import { VendorCustomerReport } from "@/components/reports/VendorCustomerReport";
import { ItemMovementReport } from "@/components/reports/ItemMovementReport";
import { DocumentReport } from "@/components/reports/DocumentReport";
import { DriverActivityReport } from "@/components/reports/DriverActivityReport";
import { usePermissions } from "@/hooks/use-permissions";

export default function Reports() {
  const { canViewReport } = usePermissions();
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "standard";
  });
  const isMobile = useIsMobile();

  // When help button is clicked
  const handleHelpClick = () => {
    alert("Standard Reports: View pre-configured reports with filter options.\n\nCustom Reports: Build your own reports with custom fields and filters.\n\nAnalytics: Visualize data with interactive charts and graphs.");
  };

  return (
    <AppLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-medium text-neutral-dark">Reports</h1>
        
        {/* Help button outside the tabs */}
        {activeTab === "standard" && (
          <Button variant="outline" size="sm" onClick={handleHelpClick}>
            <span className="material-icons text-sm mr-2">help_outline</span>
            <span className={isMobile ? "hidden" : ""}>Help</span>
          </Button>
        )}
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="mb-4 sm:mb-6 overflow-x-auto pb-1">
          <TabsList className="flex flex-nowrap w-max bg-white rounded-md shadow-sm h-auto gap-1 p-1">
            {canViewReport("standard") && (
              <TabsTrigger value="standard">
                <span className="material-icons text-sm mr-2">description</span>
                <span className={isMobile ? "hidden" : ""}>Standard</span>
              </TabsTrigger>
            )}
            {canViewReport("custom") && (
              <TabsTrigger value="custom">
                <span className="material-icons text-sm mr-2">build</span>
                <span className={isMobile ? "hidden" : ""}>Custom</span>
              </TabsTrigger>
            )}
            {canViewReport("analytics") && (
              <TabsTrigger value="analytics">
                <span className="material-icons text-sm mr-2">insights</span>
                <span className={isMobile ? "hidden" : ""}>Analytics</span>
              </TabsTrigger>
            )}
            {canViewReport("pending") && (
              <TabsTrigger value="pending">
                <span className="material-icons text-sm mr-2">pending_actions</span>
                <span className={isMobile ? "hidden" : ""}>Pending</span>
              </TabsTrigger>
            )}
            {canViewReport("returnables") && (
              <TabsTrigger value="returnables">
                <span className="material-icons text-sm mr-2">swap_horiz</span>
                <span className={isMobile ? "hidden" : ""}>Returnables</span>
              </TabsTrigger>
            )}
            {canViewReport("gate-traffic") && (
              <TabsTrigger value="gate-traffic">
                <span className="material-icons text-sm mr-2">traffic</span>
                <span className={isMobile ? "hidden" : ""}>Gate Traffic</span>
              </TabsTrigger>
            )}
            {canViewReport("company-summary") && (
              <TabsTrigger value="company-summary">
                <span className="material-icons text-sm mr-2">business</span>
                <span className={isMobile ? "hidden" : ""}>Companies</span>
              </TabsTrigger>
            )}
            {canViewReport("dept-summary") && (
              <TabsTrigger value="dept-summary">
                <span className="material-icons text-sm mr-2">apartment</span>
                <span className={isMobile ? "hidden" : ""}>Departments</span>
              </TabsTrigger>
            )}
            {canViewReport("user-activity") && (
              <TabsTrigger value="user-activity">
                <span className="material-icons text-sm mr-2">manage_accounts</span>
                <span className={isMobile ? "hidden" : ""}>User Activity</span>
              </TabsTrigger>
            )}
            {canViewReport("vendor-customer") && (
              <TabsTrigger value="vendor-customer">
                <span className="material-icons text-sm mr-2">contacts</span>
                <span className={isMobile ? "hidden" : ""}>Vendor/Customer</span>
              </TabsTrigger>
            )}
            {canViewReport("item-movement") && (
              <TabsTrigger value="item-movement">
                <span className="material-icons text-sm mr-2">inventory_2</span>
                <span className={isMobile ? "hidden" : ""}>Item Movement</span>
              </TabsTrigger>
            )}
            {canViewReport("documents") && (
              <TabsTrigger value="documents">
                <span className="material-icons text-sm mr-2">folder_open</span>
                <span className={isMobile ? "hidden" : ""}>Documents</span>
              </TabsTrigger>
            )}
            {canViewReport("driver-activity") && (
              <TabsTrigger value="driver-activity">
                <span className="material-icons text-sm mr-2">local_shipping</span>
                <span className={isMobile ? "hidden" : ""}>Drivers</span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {canViewReport("standard") && (
          <TabsContent value="standard" className="m-0">
            <ReportsPanel />
          </TabsContent>
        )}
        {canViewReport("custom") && (
          <TabsContent value="custom" className="m-0">
            <CustomReportBuilder />
          </TabsContent>
        )}
        {canViewReport("analytics") && (
          <TabsContent value="analytics" className="m-0">
            <AnalyticsVisualization />
          </TabsContent>
        )}
        {canViewReport("pending") && (
          <TabsContent value="pending" className="m-0">
            <PendingApprovalsReport />
          </TabsContent>
        )}
        {canViewReport("returnables") && (
          <TabsContent value="returnables" className="m-0">
            <ReturnableTracker />
          </TabsContent>
        )}
        {canViewReport("gate-traffic") && (
          <TabsContent value="gate-traffic" className="m-0">
            <GatePlantTrafficReport />
          </TabsContent>
        )}
        {canViewReport("company-summary") && (
          <TabsContent value="company-summary" className="m-0">
            <CompanyWiseSummaryReport />
          </TabsContent>
        )}
        {canViewReport("dept-summary") && (
          <TabsContent value="dept-summary" className="m-0">
            <DepartmentWiseSummaryReport />
          </TabsContent>
        )}
        {canViewReport("user-activity") && (
          <TabsContent value="user-activity" className="m-0">
            <UserActivityReport />
          </TabsContent>
        )}
        {canViewReport("vendor-customer") && (
          <TabsContent value="vendor-customer" className="m-0">
            <VendorCustomerReport />
          </TabsContent>
        )}
        {canViewReport("item-movement") && (
          <TabsContent value="item-movement" className="m-0">
            <ItemMovementReport />
          </TabsContent>
        )}
        {canViewReport("documents") && (
          <TabsContent value="documents" className="m-0">
            <DocumentReport />
          </TabsContent>
        )}
        {canViewReport("driver-activity") && (
          <TabsContent value="driver-activity" className="m-0">
            <DriverActivityReport />
          </TabsContent>
        )}
      </Tabs>
    </AppLayout>
  );
}
