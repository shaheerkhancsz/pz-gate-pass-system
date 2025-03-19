import React, { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ReportsPanel } from "@/components/reports/ReportsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { CustomReportBuilder } from "@/components/reports/CustomReportBuilder";
import { AnalyticsVisualization } from "@/components/reports/AnalyticsVisualization";

export default function Reports() {
  const [activeTab, setActiveTab] = useState("standard");
  const isMobile = useIsMobile();
  
  // Check if reports can be modified (based on permissions)
  const { data: userPermissions } = useQuery({
    queryKey: ['/api/auth/permissions'],
    queryFn: async () => {
      const res = await fetch('/api/auth/permissions');
      if (!res.ok) throw new Error('Failed to fetch permissions');
      return res.json();
    }
  });
  
  // Check if user has report creation permission
  const canCreateReports = userPermissions?.some((p: any) => 
    p.module === 'report' && p.action === 'create'
  ) || false;

  // When help button is clicked
  const handleHelpClick = () => {
    alert("Standard Reports: View pre-configured reports with filter options.\n\nCustom Reports: Build your own reports with custom fields and filters.\n\nAnalytics: Visualize data with interactive charts and graphs.");
  };

  return (
    <AppLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-medium text-neutral-dark">Reports</h1>
        
        {/* Help button outside the tabs */}
        {activeTab === "standard" && (
          <Button variant="outline" size="sm" onClick={handleHelpClick}>
            <span className="material-icons text-sm mr-2">help_outline</span>
            <span className={isMobile ? "hidden" : ""}>Help</span>
          </Button>
        )}
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="mb-6">
          <TabsList className="grid grid-cols-3 w-full md:w-auto bg-white rounded-md shadow-sm">
            <TabsTrigger value="standard">
              <span className="material-icons text-sm mr-2">description</span>
              <span className={isMobile ? "hidden" : ""}>Standard</span>
            </TabsTrigger>
            <TabsTrigger value="custom" disabled={!canCreateReports}>
              <span className="material-icons text-sm mr-2">build</span>
              <span className={isMobile ? "hidden" : ""}>Custom</span>
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <span className="material-icons text-sm mr-2">insights</span>
              <span className={isMobile ? "hidden" : ""}>Analytics</span>
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="standard" className="m-0">
          <ReportsPanel />
        </TabsContent>
        
        <TabsContent value="custom" className="m-0">
          <CustomReportBuilder />
        </TabsContent>
        
        <TabsContent value="analytics" className="m-0">
          <AnalyticsVisualization />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
