import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilterPanel } from "./FilterPanel";
import { GatePass } from "@shared/schema";
import { formatDate } from "@/lib/utils";
import { getStatusBadgeClass, getStatusLabel } from "@/components/ui/theme";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/use-permissions";
import { apiRequest } from "@/lib/queryClient";
import { CheckSquare, Square, CheckCheck, XCircle, CornerDownLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const { isAdmin, user } = useAuth();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<FilterValues>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchRemarksDialogOpen, setBatchRemarksDialogOpen] = useState(false);
  const [batchRemarks, setBatchRemarks] = useState("");
  const [pendingBatchAction, setPendingBatchAction] = useState<"reject" | "send-back" | null>(null);
  const [forceClosePassId, setForceClosePassId] = useState<number | null>(null);
  const [forceCloseRemarks, setForceCloseRemarks] = useState("");
  const itemsPerPage = 10;

  const canForceClose = isAdmin || hasPermission("gatePass", "manage");
  const terminalStatuses = ["completed", "rejected", "force_closed"];

  const forceCloseMutation = useMutation({
    mutationFn: ({ id, remarks }: { id: number; remarks: string }) =>
      apiRequest("POST", `/api/gate-passes/${id}/force-close`, { remarks }).then(r => r.json()),
    onSuccess: () => {
      setForceClosePassId(null);
      setForceCloseRemarks("");
      queryClient.invalidateQueries({ queryKey: ["/api/gate-passes"] });
      toast({ title: "Gate pass force closed", description: "The gate pass has been permanently closed." });
    },
    onError: (error: Error) => {
      toast({ title: "Force close failed", description: error.message, variant: "destructive" });
    },
  });

  const canApprove = isAdmin || hasPermission("gatePass", "approve");

  const batchApprove = useMutation({
    mutationFn: (ids: number[]) =>
      apiRequest("POST", "/api/gate-passes/batch-approve", { ids, userId: user?.id }).then(r => r.json()),
    onSuccess: () => {
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/gate-passes"] });
    },
  });

  const batchReject = useMutation({
    mutationFn: ({ ids, remarks }: { ids: number[]; remarks: string }) =>
      apiRequest("POST", "/api/gate-passes/batch-reject", { ids, userId: user?.id, remarks }).then(r => r.json()),
    onSuccess: () => {
      setSelectedIds(new Set());
      setBatchRemarksDialogOpen(false);
      setBatchRemarks("");
      setPendingBatchAction(null);
      queryClient.invalidateQueries({ queryKey: ["/api/gate-passes"] });
    },
  });

  const batchSendBack = useMutation({
    mutationFn: ({ ids, remarks }: { ids: number[]; remarks: string }) =>
      apiRequest("POST", "/api/gate-passes/batch-send-back", { ids, userId: user?.id, remarks }).then(r => r.json()),
    onSuccess: () => {
      setSelectedIds(new Set());
      setBatchRemarksDialogOpen(false);
      setBatchRemarks("");
      setPendingBatchAction(null);
      queryClient.invalidateQueries({ queryKey: ["/api/gate-passes"] });
    },
  });

  function openBatchDialog(action: "reject" | "send-back") {
    setPendingBatchAction(action);
    setBatchRemarks("");
    setBatchRemarksDialogOpen(true);
  }

  function confirmBatchAction() {
    const ids = Array.from(selectedIds);
    if (pendingBatchAction === "reject") batchReject.mutate({ ids, remarks: batchRemarks });
    else if (pendingBatchAction === "send-back") batchSendBack.mutate({ ids, remarks: batchRemarks });
  }

  // We're using the query key array approach instead of building a query string manually

  // Fetch gate passes with filters — always refetch on mount so HOD/security
  // see newly created/updated passes without a manual page refresh.
  const { data: gatePasses, isLoading } = useQuery<GatePass[]>({
    queryKey: ['/api/gate-passes', filters],
    refetchOnMount: "always",
    staleTime: 0,
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

  const selectablePasses = paginatedGatePasses.filter(p => p.status === "pending");
  const allSelected = selectablePasses.length > 0 && selectablePasses.every(p => selectedIds.has(p.id));

  function toggleSelectAll() {
    if (allSelected) {
      const newSet = new Set(selectedIds);
      selectablePasses.forEach(p => newSet.delete(p.id));
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      selectablePasses.forEach(p => newSet.add(p.id));
      setSelectedIds(newSet);
    }
  }

  function toggleSelect(id: number) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  }

  return (
    <div className="relative">
      <FilterPanel onFilter={handleFilter} />

      {/* Floating Batch Action Bar */}
      {canApprove && selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 flex flex-wrap items-center justify-center gap-2 bg-gray-900 text-white rounded-2xl px-4 py-3 shadow-2xl">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button
            size="sm"
            className="rounded-full bg-green-600 hover:bg-green-700 text-white border-none h-8"
            onClick={() => batchApprove.mutate(Array.from(selectedIds))}
            disabled={batchApprove.isPending}
          >
            <CheckCheck className="h-3.5 w-3.5 mr-1" />
            Approve
          </Button>
          <Button
            size="sm"
            className="rounded-full bg-yellow-500 hover:bg-yellow-600 text-white border-none h-8"
            onClick={() => openBatchDialog("send-back")}
          >
            <CornerDownLeft className="h-3.5 w-3.5 mr-1" />
            Send Back
          </Button>
          <Button
            size="sm"
            className="rounded-full bg-red-600 hover:bg-red-700 text-white border-none h-8"
            onClick={() => openBatchDialog("reject")}
          >
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Reject
          </Button>
          <button
            className="text-gray-400 hover:text-white text-xs"
            onClick={() => setSelectedIds(new Set())}
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* Batch Remarks Dialog */}
      {batchRemarksDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold text-gray-800 mb-1">
              {pendingBatchAction === "reject" ? "Reject" : "Send Back"} {selectedIds.size} Gate Pass{selectedIds.size !== 1 ? "es" : ""}
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              {pendingBatchAction === "send-back" ? "Remarks are required." : "Optional remarks for all rejections."}
            </p>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Enter remarks..."
              value={batchRemarks}
              onChange={e => setBatchRemarks(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2 mt-4 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setBatchRemarksDialogOpen(false); setPendingBatchAction(null); }}>
                Cancel
              </Button>
              <Button
                size="sm"
                className={pendingBatchAction === "reject" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-yellow-500 hover:bg-yellow-600 text-white"}
                onClick={confirmBatchAction}
                disabled={pendingBatchAction === "send-back" && !batchRemarks.trim()}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Force Close Dialog */}
      {forceClosePassId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold text-gray-800 mb-2">Force Close Gate Pass</h3>
            <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">
              ⚠ This will permanently close this gate pass and cannot be undone. A notification will be sent to the creator.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for force closing (required)
            </label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={3}
              placeholder="e.g. Delivery cancelled, vehicle returned without unloading..."
              value={forceCloseRemarks}
              onChange={e => setForceCloseRemarks(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2 mt-4 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setForceClosePassId(null); setForceCloseRemarks(""); }}
                disabled={forceCloseMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-red-900 hover:bg-red-800 text-white"
                onClick={() => forceCloseMutation.mutate({ id: forceClosePassId, remarks: forceCloseRemarks })}
                disabled={!forceCloseRemarks.trim() || forceCloseMutation.isPending}
              >
                Force Close
              </Button>
            </div>
          </div>
        </div>
      )}

      <Card className={`bg-white rounded-lg shadow-sm overflow-hidden ${canApprove && selectedIds.size > 0 ? "pb-20 sm:pb-0" : ""}`}>
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap">
            <thead>
              <tr className="bg-neutral-light">
                {canApprove && (
                  <th className="px-3 sm:px-4 py-3 w-8 sm:w-10">
                    <button onClick={toggleSelectAll} className="text-gray-500 hover:text-gray-700">
                      {allSelected ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4" />}
                    </button>
                  </th>
                )}
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">
                  <div className="flex items-center cursor-pointer">
                    Pass No. <span className="material-icons text-xs ml-1">arrow_downward</span>
                  </div>
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider hidden sm:table-cell">
                  <div className="flex items-center cursor-pointer">
                    Date <span className="material-icons text-xs ml-1">unfold_more</span>
                  </div>
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Customer</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider hidden md:table-cell">Department</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider hidden sm:table-cell">Type</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Status</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-medium">
              {isLoading ? (
                // Loading skeleton
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    {canApprove && <td className="px-3 sm:px-4 py-3"><div className="h-4 bg-gray-200 rounded w-4"></div></td>}
                    <td className="px-3 sm:px-6 py-3"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                    <td className="px-3 sm:px-6 py-3 hidden sm:table-cell"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="px-3 sm:px-6 py-3"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                    <td className="px-3 sm:px-6 py-3 hidden md:table-cell"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                    <td className="px-3 sm:px-6 py-3 hidden sm:table-cell"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                    <td className="px-3 sm:px-6 py-3"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                    <td className="px-3 sm:px-6 py-3"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
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
                      {canApprove && (
                        <td className="px-3 sm:px-4 py-3 w-8 sm:w-10">
                          {pass.status === "pending" ? (
                            <button onClick={() => toggleSelect(pass.id)} className="text-gray-400 hover:text-blue-600">
                              {selectedIds.has(pass.id)
                                ? <CheckSquare className="h-4 w-4 text-blue-600" />
                                : <Square className="h-4 w-4" />}
                            </button>
                          ) : null}
                        </td>
                      )}
                      <td className="px-3 sm:px-6 py-3 text-sm font-medium">
                        {pass.gatePassNumber}
                        {isOverdue && (
                          <span className="ml-1 px-1 py-0.5 text-xs rounded bg-red-100 text-red-700" title="Overdue return">
                            Overdue
                          </span>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-3 text-sm text-neutral-dark hidden sm:table-cell">{formatDate(pass.date)}</td>
                      <td className="px-3 sm:px-6 py-3 text-sm text-neutral-dark">{pass.customerName}</td>
                      <td className="px-3 sm:px-6 py-3 text-sm text-neutral-dark hidden md:table-cell">{pass.department}</td>
                      <td className="px-3 sm:px-6 py-3 text-sm hidden sm:table-cell">
                        <span className={`px-2 py-1 text-xs rounded-full ${TYPE_BADGE[passType] || "bg-gray-100 text-gray-600"}`}>
                          {TYPE_LABEL[passType] || passType}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 text-sm">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(pass.status)}`}>
                          {getStatusLabel(pass.status)}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 text-sm">
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
                          {canForceClose && !terminalStatuses.includes(pass.status) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Force Close"
                              className="text-red-900 hover:bg-red-50 h-auto w-auto p-1"
                              onClick={() => { setForceClosePassId(pass.id); setForceCloseRemarks(""); }}
                            >
                              <span className="material-icons text-sm">lock</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={canApprove ? 8 : 7} className="px-6 py-4 text-sm text-center">
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
