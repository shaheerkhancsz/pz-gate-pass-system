import React from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GatePass } from "@shared/schema";
import { formatDate } from "@/lib/utils";

interface RecentGatePassesProps {
  limit?: number;
}

export function RecentGatePasses({ limit = 5 }: RecentGatePassesProps) {
  const { data: gatePasses, isLoading } = useQuery<GatePass[]>({
    queryKey: ["/api/gate-passes"],
  });

  const recentPasses = gatePasses?.slice(0, limit) || [];

  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-success bg-opacity-10 text-success";
      case "pending":
        return "bg-warning bg-opacity-10 text-warning";
      case "rejected":
        return "bg-error bg-opacity-10 text-error";
      default:
        return "bg-gray-200 text-gray-600";
    }
  };

  const handlePrint = (gatePassId: number) => {
    // Open print preview in new window/tab
    window.open(`/print-gate-pass/${gatePassId}`, '_blank');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="p-6 border-b">
          <CardTitle className="font-medium text-lg">Recent Gate Passes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="animate-pulse">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="border-b border-gray-200 p-4">
                <div className="h-5 bg-gray-200 rounded-md w-1/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded-md w-3/4"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-6 border-b border-neutral-medium flex flex-row items-center justify-between">
        <CardTitle className="font-medium">Recent Gate Passes</CardTitle>
        <Link href="/gate-passes">
          <a className="text-primary text-sm flex items-center">
            View All <span className="material-icons text-sm ml-1">arrow_forward</span>
          </a>
        </Link>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap">
          <thead>
            <tr className="bg-neutral-light">
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Pass No.</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Department</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-medium">
            {recentPasses.length > 0 ? (
              recentPasses.map((pass) => (
                <tr key={pass.id} className="hover:bg-neutral-lightest">
                  <td className="px-6 py-4 text-sm font-medium">{pass.gatePassNumber}</td>
                  <td className="px-6 py-4 text-sm text-neutral-dark">{formatDate(pass.date)}</td>
                  <td className="px-6 py-4 text-sm text-neutral-dark">{pass.customerName}</td>
                  <td className="px-6 py-4 text-sm text-neutral-dark">{pass.department}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusClass(pass.status)}`}>
                      {pass.status.charAt(0).toUpperCase() + pass.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="View"
                        className="text-info hover:text-primary h-auto w-auto p-1"
                      >
                        <span className="material-icons text-sm">visibility</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Print"
                        className="text-neutral-gray hover:text-primary h-auto w-auto p-1"
                        onClick={() => handlePrint(pass.id)}
                      >
                        <span className="material-icons text-sm">print</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  No gate passes found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
