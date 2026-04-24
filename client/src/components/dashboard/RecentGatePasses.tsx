import React from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GatePass } from "@shared/schema";
import { formatDate } from "@/lib/utils";
import { getStatusBadgeClass, getStatusLabel } from "@/components/ui/theme";
import { ArrowRight, Eye, Printer } from "lucide-react";

interface RecentGatePassesProps {
  limit?: number;
}

export function RecentGatePasses({ limit = 5 }: RecentGatePassesProps) {
  const [, navigate] = useLocation();
  const { data: gatePasses, isLoading } = useQuery<GatePass[]>({
    queryKey: ["/api/gate-passes"],
  });

  const recentPasses = gatePasses?.slice(0, limit) || [];

  const handlePrint = (id: number) => window.open(`/print-gate-pass/${id}`, "_blank");
  const handleView  = (id: number) => navigate(`/view-gate-pass/${id}`);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="p-6 border-b">
          <CardTitle className="font-medium text-lg">Recent Gate Passes</CardTitle>
        </CardHeader>
        <div className="animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="border-b border-border p-4">
              <div className="h-5 bg-muted rounded-md w-1/4 mb-2" />
              <div className="h-4 bg-muted rounded-md w-3/4" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-6 border-b flex flex-row items-center justify-between">
        <CardTitle className="font-medium">Recent Gate Passes</CardTitle>
        <Link href="/gate-passes">
          <a className="text-primary text-sm flex items-center hover:underline">
            View All <ArrowRight className="h-4 w-4 ml-1" />
          </a>
        </Link>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground tracking-wider">Pass No.</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground tracking-wider">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground tracking-wider">Department</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {recentPasses.length > 0 ? (
              recentPasses.map(pass => (
                <tr key={pass.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium">{pass.gatePassNumber}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{formatDate(pass.date)}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{pass.customerName}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{pass.department}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(pass.status)}`}>
                      {getStatusLabel(pass.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="View"
                        className="h-8 w-8 text-blue-600 hover:text-primary"
                        onClick={() => handleView(pass.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Print"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => handlePrint(pass.id)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground">
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
