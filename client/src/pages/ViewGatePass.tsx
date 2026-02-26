import React from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  const { canVerifyGatePass } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<GatePass & { items: Item[] }>({
    queryKey: [`/api/gate-passes/${gatePassId}`],
  });

  // Edit is locked once a pass reaches approved or beyond (except for admins)
  const lockedStatuses = ["approved", "security_allowed", "completed", "rejected"];
  const canEdit =
    data &&
    (isAdmin || (user && user.id === data.createdById && !lockedStatuses.includes(data.status)));

  const handlePrint = () => {
    window.open(`/print-gate-pass/${gatePassId}`, '_blank');
  };

  // Mark as Returned mutation (for returnable passes)
  const markReturnedMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/gate-passes/${gatePassId}/mark-returned`, {
        userId: user?.id,
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to mark as returned");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/gate-passes/${gatePassId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/gate-passes"] });
      toast({ title: "Success", description: "Gate pass marked as returned" });
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
        <h1 className="text-2xl font-medium text-neutral-dark">
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
          <Button onClick={handlePrint}>
            <span className="material-icons mr-1">print</span>
            Print
          </Button>
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
                    <div>
                      <span className="text-sm text-neutral-gray">Department:</span>
                      <p className="font-medium">{data.department}</p>
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
                        {(data as any).actualReturnDate ? (
                          <div>
                            <span className="text-sm text-neutral-gray">Actual Return Date:</span>
                            <p className="font-medium text-green-700">{formatDate((data as any).actualReturnDate)}</p>
                          </div>
                        ) : (
                          (isAdmin || canVerifyGatePass()) && !["rejected"].includes(data.status) && (
                            <div className="pt-1">
                              <Button
                                size="sm"
                                className="bg-teal-600 hover:bg-teal-700 text-white"
                                onClick={() => markReturnedMutation.mutate()}
                                disabled={markReturnedMutation.isPending}
                              >
                                <span className="material-icons text-sm mr-1">assignment_return</span>
                                Mark as Returned
                              </Button>
                            </div>
                          )
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
                <div className="overflow-x-auto">
                  <table className="w-full border border-neutral-medium">
                    <thead>
                      <tr className="bg-neutral-light">
                        <th className="border border-neutral-medium p-2 text-left">Item Name</th>
                        <th className="border border-neutral-medium p-2 text-left">SKU Number</th>
                        <th className="border border-neutral-medium p-2 text-left">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items && data.items.length > 0 ? (
                        data.items.map((item, index) => (
                          <tr key={index}>
                            <td className="border border-neutral-medium p-2">{item.name}</td>
                            <td className="border border-neutral-medium p-2">{item.sku}</td>
                            <td className="border border-neutral-medium p-2">{item.quantity}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="border border-neutral-medium p-2 text-center">
                            No items found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-neutral-gray mb-2">Driver Details</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-neutral-gray">Driver Name:</span>
                      <p className="font-medium">{data.driverName}</p>
                    </div>
                    <div>
                      <span className="text-sm text-neutral-gray">Mobile Number:</span>
                      <p className="font-medium">{data.driverMobile}</p>
                    </div>
                    <div>
                      <span className="text-sm text-neutral-gray">CNIC Number:</span>
                      <p className="font-medium">{data.driverCnic}</p>
                    </div>
                    <div>
                      <span className="text-sm text-neutral-gray">Delivery Van Number:</span>
                      <p className="font-medium">{data.deliveryVanNumber}</p>
                    </div>
                  </div>
                </div>
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
