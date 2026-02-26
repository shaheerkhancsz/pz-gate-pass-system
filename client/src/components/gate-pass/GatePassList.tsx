import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilterPanel } from "./FilterPanel";
import { GatePass } from "@shared/schema";
import { formatDate } from "@/lib/utils";
import { getStatusBadgeClass, getStatusLabel } from "@/components/ui/theme";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/use-permissions";

interface FilterValues {
  gatePassNumber?: string;
  customerName?: string;
  itemName?: string;
  dateFrom?: string;
  dateTo?: string;
  department?: string;
  status?: string;
  type?: string;
}

const TYPE_BADGE: Record<string, string> = {
  outward: "bg-indigo-100 text-indigo-700",
  inward: "bg-teal-100 text-teal-700",
  returnable: "bg-amber-100 text-amber-700",
};

const TYPE_LABEL: Record<string, string> = {
  outward: "Outward",
  inward: "Inward",
  returnable: "Returnable",
};

export function GatePassList() {
  const [location, setLocation] = useLocation();
  const { isAdmin } = useAuth();
  const { hasPermission } = usePermissions();
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<FilterValues>({});
  const itemsPerPage = 10;

  // We're using the query key array approach instead of building a query string manually

  // Fetch gate passes with filters
  const { data: gatePasses, isLoading } = useQuery<GatePass[]>({
    queryKey: ['/api/gate-passes', filters],
  });

  // Apply pagination
  const paginatedGatePasses = gatePasses
    ? gatePasses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : [];

  // Total number of pages
  const totalPages = gatePasses ? Math.ceil(gatePasses.length / itemsPerPage) : 0;

  // Handle filter change
  const handleFilter = (newFilters: FilterValues) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page on filter change
  };

  // Navigate to edit page
  const handleEdit = (id: number) => {
    setLocation(`/edit-gate-pass/${id}`);
  };

  // Open print preview
  const handlePrint = (id: number) => {
    window.open(`/print-gate-pass/${id}`, '_blank');
  };

  // View details
  const handleView = (id: number) => {
    setLocation(`/view-gate-pass/${id}`);
  };

  return (
    <div>
      <FilterPanel onFilter={handleFilter} />

      <Card className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap">
            <thead>
              <tr className="bg-neutral-light">
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">
                  <div className="flex items-center cursor-pointer">
                    Pass No. <span className="material-icons text-xs ml-1">arrow_downward</span>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">
                  <div className="flex items-center cursor-pointer">
                    Date <span className="material-icons text-xs ml-1">unfold_more</span>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-medium">
              {isLoading ? (
                // Loading skeleton
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                  </tr>
                ))
              ) : paginatedGatePasses.length > 0 ? (
                paginatedGatePasses.map((pass) => {
                  const passType = (pass as any).type || "outward";
                  const expectedReturn = (pass as any).expectedReturnDate;
                  const actualReturn = (pass as any).actualReturnDate;
                  const isOverdue =
                    passType === "returnable" &&
                    expectedReturn &&
                    !actualReturn &&
                    new Date(expectedReturn) < new Date() &&
                    !["completed", "rejected"].includes(pass.status);

                  return (
                    <tr key={pass.id} className={`hover:bg-neutral-lightest ${isOverdue ? "bg-red-50" : ""}`}>
                      <td className="px-6 py-4 text-sm font-medium">
                        {pass.gatePassNumber}
                        {isOverdue && (
                          <span className="ml-1 px-1 py-0.5 text-xs rounded bg-red-100 text-red-700" title="Overdue return">
                            Overdue
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-dark">{formatDate(pass.date)}</td>
                      <td className="px-6 py-4 text-sm text-neutral-dark">{pass.customerName}</td>
                      <td className="px-6 py-4 text-sm text-neutral-dark">{pass.department}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 text-xs rounded-full ${TYPE_BADGE[passType] || "bg-gray-100 text-gray-600"}`}>
                          {TYPE_LABEL[passType] || passType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(pass.status)}`}>
                          {getStatusLabel(pass.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="View"
                            className="text-info hover:text-primary h-auto w-auto p-1"
                            onClick={() => handleView(pass.id)}
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
                          {(isAdmin || hasPermission('gatePass', 'update') || pass.createdById === (useAuth().user?.id || 0)) &&
                            (isAdmin || !["approved", "security_allowed", "completed", "rejected"].includes(pass.status)) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Edit"
                                className="text-neutral-gray hover:text-primary h-auto w-auto p-1"
                                onClick={() => handleEdit(pass.id)}
                              >
                                <span className="material-icons text-sm">edit</span>
                              </Button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-sm text-center">
                    No gate passes found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 flex items-center justify-between border-t border-neutral-medium">
            <div className="text-sm text-neutral-gray">
              Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
              <span className="font-medium">
                {Math.min(currentPage * itemsPerPage, gatePasses?.length || 0)}
              </span>{" "}
              of <span className="font-medium">{gatePasses?.length || 0}</span> results
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                // Logic to show pages around current page
                let pageNum = i + 1;
                if (totalPages > 5) {
                  if (currentPage > 3) {
                    pageNum = currentPage - 2 + i;
                  }
                  if (currentPage > totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  }
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
