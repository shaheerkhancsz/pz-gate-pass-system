import React, { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GatePass, Item } from "@shared/schema";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/use-permissions";
import { DocumentPanel } from "@/components/documents";
import { WorkflowActions } from "@/components/gate-pass/WorkflowActions";
import { getStatusBadgeClass, getStatusLabel } from "@/components/ui/theme";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check } from "lucide-react";

const TYPE_BADGE: Record<string, string> = {
  outward: "bg-indigo-100 text-indigo-700",
  inward: "bg-teal-100 text-teal-700",
  returnable: "bg-amber-100 text-amber-700",
};
const TYPE_LABEL: Record<string, string> = {
  outward: "Outward", inward: "Inward", returnable: "Returnable",
};

export default function ViewGatePass() {
  const { id } = useParams();
  const gatePassId = parseInt(id || "0", 10);
  const { isAdmin, user } = useAuth();
  const { canVerifyGatePass, hasPermission } = usePermissions();
  const isSecurity = canVerifyGatePass() && !isAdmin;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  // Partial return: track received qty input per item
  const [receiveQty, setReceiveQty] = useState<Record<number, number>>({});
  const [editingAllowTo, setEditingAllowTo] = useState(false);
  const [allowToValue, setAllowToValue] = useState("");

  const { data, isLoading, error } = useQuery<GatePass & { items: Item[]; hodApproverName?: string; securityApproverName?: string }>({
    queryKey: [`/api/gate-passes/${gatePassId}`],
    refetchOnMount: "always",
    staleTime: 0,
  });

  // Edit is locked once a pass reaches hod_approved or beyond (except for admins)
  const lockedStatuses = ["hod_approved", "approved", "security_allowed", "completed", "rejected", "force_closed"];
  const canEdit =
    data &&
    (isAdmin || (user && user.id === data.createdById && !lockedStatuses.includes(data.status)));

  const handlePrint = () => {
    window.open(`/print-gate-pass/${gatePassId}`, '_blank');
  };

  const handleCopySapCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied", description: "SAP reference code copied to clipboard." });
    });
  };

  // Receive items mutation (partial/full return for returnable passes)
  const receiveItemsMutation = useMutation({
    mutationFn: async () => {
      const itemReturns = Object.entries(receiveQty)
        .filter(([, qty]) => qty > 0)
        .map(([itemId, receivedQuantity]) => ({ itemId: parseInt(itemId), receivedQuantity }));
      if (itemReturns.length === 0) throw new Error("Enter at least one received quantity");
      const response = await apiRequest("POST", `/api/gate-passes/${gatePassId}/receive-items`, { itemReturns });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to record received items");
      }
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [`/api/gate-passes/${gatePassId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/gate-passes"] });
      setReceiveQty({});
      toast({
        title: result.allReturned ? "Gate Pass Completed" : "Items Recorded",
        description: result.allReturned
          ? "All items returned — gate pass auto-completed."
          : "Partial return recorded. Gate pass remains open.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateAllowToMutation = useMutation({
    mutationFn: async (value: string) => {
      const response = await apiRequest("PATCH", `/api/gate-passes/${gatePassId}/allow-to`, {
        allowTo: value,
        userId: user?.id,
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to update Allow To");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/gate-passes/${gatePassId}`] });
      setEditingAllowTo(false);
      toast({ title: "Updated", description: "Allow To field updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error loading gate pass. Please try again.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Overdue banner for returnable passes */}
      {(data as any).type === "returnable" &&
        (data as any).expectedReturnDate &&
        !(data as any).actualReturnDate &&
        new Date((data as any).expectedReturnDate) < new Date() &&
        !["completed", "rejected"].includes(data.status) && (
          <div className="mb-4 p-3 rounded-md border border-red-300 bg-red-50 flex items-center gap-2">
            <span className="material-icons text-red-500 text-sm">schedule</span>
            <p className="text-sm text-red-700 font-medium">
              Overdue return — expected by {formatDate((data as any).expectedReturnDate)}
            </p>
          </div>
        )}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl sm:text-2xl font-medium text-neutral-dark">
          View Gate Pass <span className="text-primary">{data.gatePassNumber}</span>
          {(data as any).type && (
            <span className={`ml-2 px-2 py-1 text-xs rounded-full ${TYPE_BADGE[(data as any).type] || "bg-gray-100 text-gray-600"}`}>
              {TYPE_LABEL[(data as any).type] || (data as any).type}
            </span>
          )}
          <span className={`ml-2 px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(data.status)}`}>
            {getStatusLabel(data.status)}
          </span>
        </h1>
        <div className="flex space-x-2">
          <Link href="/gate-passes">
            <Button variant="outline">
              <span className="material-icons mr-1">arrow_back</span>
              Back
            </Button>
          </Link>
          {canEdit && (
            <Link href={`/edit-gate-pass/${gatePassId}`}>
              <Button variant="outline">
                <span className="material-icons mr-1">edit</span>
                Edit
              </Button>
            </Link>
          )}
          {(isAdmin || canVerifyGatePass()) && (
            <Button onClick={handlePrint}>
              <span className="material-icons mr-1">print</span>
              Print
            </Button>
          )}
        </div>
      </div>

      {/* Workflow action buttons */}
      <div className="mb-4">
        <WorkflowActions gatePass={data} />
      </div>

      {/* Sent Back / Remarks banner — shown to initiator */}
      {(data.status === "sent_back") && ((data as any).remarks || (data as any).securityRemarks) && (
        <div className="mb-4 p-3 rounded-md border border-orange-300 bg-orange-50 flex items-start gap-2">
          <span className="material-icons text-orange-500 mt-0.5 text-sm">info</span>
          <div className="space-y-1 flex-1">
            <p className="text-sm font-medium text-orange-800">This gate pass was sent back — please review and resubmit.</p>
            {(data as any).securityRemarks && (
              <div>
                <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mt-1">Security Remarks</p>
                <p className="text-sm text-orange-700">{(data as any).securityRemarks}</p>
              </div>
            )}
            {(data as any).remarks && (
              <div>
                <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mt-1">Approver Remarks</p>
                <p className="text-sm text-orange-700">{(data as any).remarks}</p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* General remarks for non-sent_back statuses (e.g. rejected with reason) */}
      {data.status !== "sent_back" && (data as any).remarks && (
        <div className="mb-4 p-3 rounded-md border border-orange-300 bg-orange-50 flex items-start gap-2">
          <span className="material-icons text-orange-500 mt-0.5 text-sm">info</span>
          <div>
            <p className="text-sm font-medium text-orange-800">Remarks:</p>
            <p className="text-sm text-orange-700">{(data as any).remarks}</p>
          </div>
        </div>
      )}

      <Tabs defaultValue="details" className="mb-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="workflow">Workflow History</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <h3 className="text-sm font-medium text-neutral-gray">Gate Pass Details</h3>
                  <div className="mt-2 space-y-2">
                    <div>
                      <span className="text-sm text-neutral-gray">Gate Pass Number:</span>
                      <p className="font-medium">{data.gatePassNumber}</p>
                    </div>
                    <div>
                      <span className="text-sm text-neutral-gray">Date:</span>
                      <p className="font-medium">{formatDate(data.date)}</p>
                    </div>
                    <div>
                      <span className="text-sm text-neutral-gray">Status:</span>
                      <p>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(data.status)}`}>
                          {getStatusLabel(data.status)}
                        </span>
                      </p>
                    </div>
                    {/* SAP Reference Code — shown when gate pass is completed or force-closed */}
                    {(data as any).sapReferenceCode && (
                      <div>
                        <span className="text-sm text-neutral-gray">SAP Reference Code:</span>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="font-mono font-bold text-sm bg-gray-100 px-2 py-1 rounded border">
                            {(data as any).sapReferenceCode}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => handleCopySapCode((data as any).sapReferenceCode)}
                            title="Copy to clipboard"
                          >
                            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Paste this code into SAP for audit tracking</p>
                      </div>
                    )}
                    <div>
                      <span className="text-sm text-neutral-gray">Department:</span>
                      <p className="font-medium">{data.department}</p>
                    </div>
                    <div>
                      <span className="text-sm text-neutral-gray">Allow To:</span>
                      {(isAdmin || canVerifyGatePass()) ? (
                        editingAllowTo ? (
                          <div className="flex gap-2 mt-1">
                            <Input
                              value={allowToValue}
                              onChange={(e) => setAllowToValue(e.target.value)}
                              className="h-8 text-sm flex-1"
                              placeholder="Person carrying the goods"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              className="h-8"
                              onClick={() => updateAllowToMutation.mutate(allowToValue)}
                              disabled={updateAllowToMutation.isPending}
                            >
                              Save
                            </Button>
                            <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingAllowTo(false)}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{(data as any).allowTo || <span className="text-neutral-gray text-sm italic">Not set</span>}</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => { setAllowToValue((data as any).allowTo || ""); setEditingAllowTo(true); }}
                            >
                              <span className="material-icons text-xs">edit</span>
                            </Button>
                          </div>
                        )
                      ) : (
                        <p className="font-medium">{(data as any).allowTo || "—"}</p>
                      )}
                    </div>
                    {(data as any).type && (
                      <div>
                        <span className="text-sm text-neutral-gray">Pass Type:</span>
                        <p>
                          <span className={`px-2 py-1 text-xs rounded-full ${TYPE_BADGE[(data as any).type] || "bg-gray-100 text-gray-600"}`}>
                            {TYPE_LABEL[(data as any).type] || (data as any).type}
                          </span>
                        </p>
                      </div>
                    )}
                    {(data as any).type === "returnable" && (
                      <>
                        {(data as any).expectedReturnDate && (
                          <div>
                            <span className="text-sm text-neutral-gray">Expected Return Date:</span>
                            <p className="font-medium">{formatDate((data as any).expectedReturnDate)}</p>
                          </div>
                        )}
                        {(data as any).actualReturnDate && (
                          <div>
                            <span className="text-sm text-neutral-gray">Actual Return Date:</span>
                            <p className="font-medium text-green-700">{formatDate((data as any).actualReturnDate)}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-neutral-gray">Customer Details</h3>
                  <div className="mt-2 space-y-2">
                    <div>
                      <span className="text-sm text-neutral-gray">Customer Name:</span>
                      <p className="font-medium">{data.customerName}</p>
                    </div>
                    <div>
                      <span className="text-sm text-neutral-gray">Delivery Address:</span>
                      <p className="font-medium">{data.deliveryAddress}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-neutral-gray">Created By</h3>
                  <div className="mt-2 space-y-2">
                    <div>
                      <span className="text-sm text-neutral-gray">Name:</span>
                      <p className="font-medium">{data.createdBy}</p>
                    </div>
                    <div>
                      <span className="text-sm text-neutral-gray">Created Date:</span>
                      <p className="font-medium">{formatDate(data.createdAt)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-neutral-gray mb-2">Items</h3>
                {/* Partial return input — shown for returnable passes at security_allowed stage */}
                {(data as any).type === "returnable" && data.status === "security_allowed" && (isAdmin || canVerifyGatePass()) && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <p className="text-sm font-medium text-amber-800 mb-2">Record Received Items</p>
                    <p className="text-xs text-amber-700 mb-3">Enter the quantity received for each item. Leave blank or 0 to skip.</p>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full border border-neutral-medium">
                    <thead>
                      <tr className="bg-neutral-light">
                        <th className="border border-neutral-medium p-2 text-left">Type</th>
                        <th className="border border-neutral-medium p-2 text-left">Item Name</th>
                        <th className="border border-neutral-medium p-2 text-left">Item Code</th>
                        <th className="border border-neutral-medium p-2 text-left">Qty Sent</th>
                        <th className="border border-neutral-medium p-2 text-left">Reason</th>
                        {(data as any).type === "returnable" && (
                          <>
                            <th className="border border-neutral-medium p-2 text-left">Received</th>
                            <th className="border border-neutral-medium p-2 text-left">Remaining</th>
                          </>
                        )}
                        {(data as any).type === "returnable" && data.status === "security_allowed" && (isAdmin || canVerifyGatePass()) && (
                          <th className="border border-neutral-medium p-2 text-left">Receive Now</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {data.items && data.items.length > 0 ? (
                        data.items.map((item, index) => {
                          const received = (item as any).receivedQuantity ?? 0;
                          const remaining = item.quantity - received;
                          return (
                            <tr key={index}>
                              <td className="border border-neutral-medium p-2 capitalize text-xs">
                                {(item as any).itemType || "material"}
                              </td>
                              <td className="border border-neutral-medium p-2">{item.name}</td>
                              <td className="border border-neutral-medium p-2">{item.sku}</td>
                              <td className="border border-neutral-medium p-2">{item.quantity}</td>
                              <td className="border border-neutral-medium p-2 text-sm text-neutral-600">{(item as any).reason || "—"}</td>
                              {(data as any).type === "returnable" && (
                                <>
                                  <td className="border border-neutral-medium p-2 text-green-700 font-medium">{received}</td>
                                  <td className={`border border-neutral-medium p-2 font-medium ${remaining > 0 ? "text-orange-600" : "text-gray-400"}`}>{remaining}</td>
                                </>
                              )}
                              {(data as any).type === "returnable" && data.status === "security_allowed" && (isAdmin || canVerifyGatePass()) && (
                                <td className="border border-neutral-medium p-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    max={remaining}
                                    placeholder="0"
                                    className="w-20 h-7 text-sm"
                                    value={receiveQty[item.id] ?? ""}
                                    onChange={(e) => setReceiveQty(prev => ({
                                      ...prev,
                                      [item.id]: parseInt(e.target.value) || 0,
                                    }))}
                                  />
                                </td>
                              )}
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="border border-neutral-medium p-2 text-center">
                            No items found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Record return button */}
                {(data as any).type === "returnable" && data.status === "security_allowed" && (isAdmin || canVerifyGatePass()) && (
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      className="bg-teal-600 hover:bg-teal-700 text-white"
                      onClick={() => receiveItemsMutation.mutate()}
                      disabled={receiveItemsMutation.isPending || Object.values(receiveQty).every(q => !q || q <= 0)}
                    >
                      <span className="material-icons text-sm mr-1">assignment_return</span>
                      {receiveItemsMutation.isPending ? "Saving..." : "Record Received Items"}
                    </Button>
                  </div>
                )}
              </div>

              {/* Notes (reason is now per-item; keep legacy gate-pass-level reason for old records) */}
              {((data as any).reason || data.notes) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  {(data as any).reason && (
                    <div>
                      <h3 className="text-sm font-medium text-neutral-gray mb-1">General Reason</h3>
                      <p className="text-sm border rounded p-2 bg-gray-50">{(data as any).reason}</p>
                    </div>
                  )}
                  {data.notes && (
                    <div>
                      <h3 className="text-sm font-medium text-neutral-gray mb-1">Additional Notes</h3>
                      <p className="text-sm border rounded p-2 bg-gray-50">{data.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {(data.driverName || data.driverMobile || data.driverCnic || data.deliveryVanNumber) ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  <div>
                    <h3 className="text-sm font-medium text-neutral-gray mb-2">Driver Details</h3>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm text-neutral-gray">Driver Name:</span>
                        <p className="font-medium">{data.driverName || "—"}</p>
                      </div>
                      <div>
                        <span className="text-sm text-neutral-gray">Mobile Number:</span>
                        <p className="font-medium">{data.driverMobile || "—"}</p>
                      </div>
                      <div>
                        <span className="text-sm text-neutral-gray">CNIC Number:</span>
                        <p className="font-medium">{data.driverCnic || "—"}</p>
                      </div>
                      <div>
                        <span className="text-sm text-neutral-gray">Delivery Van Number:</span>
                        <p className="font-medium">{data.deliveryVanNumber || "—"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflow">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-medium text-neutral-gray mb-4">Complete Approval Chain & Audit Trail</h3>
              <div className="space-y-0">
                {/* Step 1: Created */}
                <WorkflowStep
                  icon="add_circle"
                  iconColor="text-blue-600"
                  bgColor="bg-blue-50"
                  label="Gate Pass Created"
                  actor={data.createdBy}
                  timestamp={data.createdAt}
                  status="done"
                />
                {/* Step 2: HOD Approval */}
                {(data as any).hodApprovedAt ? (
                  <WorkflowStep
                    icon="check_circle"
                    iconColor="text-green-600"
                    bgColor="bg-green-50"
                    label="HOD Approved"
                    actor={(data as any).hodApproverName || `User #${(data as any).hodApprovedBy}`}
                    timestamp={(data as any).hodApprovedAt}
                    status="done"
                  />
                ) : data.status === "sent_back" ? (
                  <WorkflowStep
                    icon="undo"
                    iconColor="text-orange-600"
                    bgColor="bg-orange-50"
                    label="Sent Back for Revision"
                    actor=""
                    remarks={(data as any).remarks}
                    timestamp={(data as any).updatedAt}
                    status="action"
                  />
                ) : data.status === "rejected" ? (
                  <WorkflowStep
                    icon="cancel"
                    iconColor="text-red-600"
                    bgColor="bg-red-50"
                    label="Rejected"
                    actor=""
                    remarks={(data as any).remarks}
                    timestamp={(data as any).updatedAt}
                    status="action"
                  />
                ) : (
                  <WorkflowStep
                    icon="pending"
                    iconColor="text-amber-500"
                    bgColor="bg-amber-50"
                    label="Awaiting HOD Approval"
                    actor=""
                    timestamp={null}
                    status="pending"
                  />
                )}
                {/* Step 3: Security */}
                {(data as any).securityAllowedAt ? (
                  <WorkflowStep
                    icon="verified_user"
                    iconColor="text-purple-600"
                    bgColor="bg-purple-50"
                    label="Security Cleared"
                    actor={(data as any).securityApproverName || `User #${(data as any).securityAllowedBy}`}
                    timestamp={(data as any).securityAllowedAt}
                    status="done"
                  />
                ) : (data as any).hodApprovedAt && !["sent_back", "rejected", "completed", "force_closed"].includes(data.status) ? (
                  <WorkflowStep
                    icon="pending"
                    iconColor="text-amber-500"
                    bgColor="bg-amber-50"
                    label="Awaiting Security Clearance"
                    actor=""
                    timestamp={null}
                    status="pending"
                  />
                ) : null}
                {/* Step 4: Completed / Force Closed */}
                {["completed", "force_closed"].includes(data.status) && (
                  <WorkflowStep
                    icon={data.status === "force_closed" ? "lock" : "task_alt"}
                    iconColor={data.status === "force_closed" ? "text-red-700" : "text-green-700"}
                    bgColor={data.status === "force_closed" ? "bg-red-50" : "bg-green-50"}
                    label={data.status === "force_closed" ? "Force Closed" : "Completed"}
                    actor={data.status === "force_closed" ? "" : ""}
                    remarks={data.status === "force_closed" ? (data as any).forceCloseRemarks : undefined}
                    timestamp={data.status === "force_closed" ? (data as any).forceClosedAt : (data as any).updatedAt}
                    status="done"
                    sapCode={(data as any).sapReferenceCode}
                    onCopySap={handleCopySapCode}
                    copied={copied}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardContent className="p-6">
              <DocumentPanel
                entityType="gatePass"
                entityId={gatePassId}
                title={`Documents for Gate Pass ${data.gatePassNumber}`}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

// ── Workflow History Step Component ────────────────────────────────────────────

interface WorkflowStepProps {
  icon: string;
  iconColor: string;
  bgColor: string;
  label: string;
  actor: string;
  timestamp: string | Date | null;
  status: "done" | "pending" | "action";
  remarks?: string;
  sapCode?: string;
  onCopySap?: (code: string) => void;
  copied?: boolean;
}

function WorkflowStep({ icon, iconColor, bgColor, label, actor, timestamp, status, remarks, sapCode, onCopySap, copied }: WorkflowStepProps) {
  return (
    <div className="flex gap-3 pb-4 relative">
      {/* Vertical connector line */}
      <div className="flex flex-col items-center">
        <div className={`h-9 w-9 rounded-full ${bgColor} flex items-center justify-center flex-shrink-0 z-10`}>
          <span className={`material-icons text-base ${iconColor}`}>{icon}</span>
        </div>
        <div className="w-px flex-1 bg-gray-200 mt-1" />
      </div>
      {/* Content */}
      <div className="flex-1 pb-2 pt-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-800">{label}</span>
          {status === "pending" && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Pending</span>
          )}
        </div>
        {actor && <p className="text-xs text-gray-500 mt-0.5">By: <span className="font-medium text-gray-700">{actor}</span></p>}
        {timestamp && (
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(timestamp).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        )}
        {remarks && (
          <p className="mt-1 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1">
            Remarks: {remarks}
          </p>
        )}
        {sapCode && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-gray-500">SAP Ref:</span>
            <code className="font-mono text-xs font-bold bg-gray-100 px-2 py-0.5 rounded border">{sapCode}</code>
            {onCopySap && (
              <button onClick={() => onCopySap(sapCode)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Copy">
                {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
