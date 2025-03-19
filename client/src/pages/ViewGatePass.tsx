import React from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GatePass, Item } from "@shared/schema";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { DocumentPanel } from "@/components/documents";

export default function ViewGatePass() {
  const { id } = useParams();
  const gatePassId = parseInt(id || "0", 10);
  const { isAdmin, user } = useAuth();

  const { data, isLoading, error } = useQuery<GatePass & { items: Item[] }>({
    queryKey: [`/api/gate-passes/${gatePassId}`],
  });

  const canEdit = isAdmin || (user && data && user.id === data.createdById);

  const handlePrint = () => {
    window.open(`/print-gate-pass/${gatePassId}`, '_blank');
  };

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-medium text-neutral-dark">
          View Gate Pass <span className="text-primary">{data.gatePassNumber}</span>
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
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          data.status === "completed" 
                            ? "bg-success bg-opacity-10 text-success" 
                            : data.status === "pending" 
                              ? "bg-warning bg-opacity-10 text-warning" 
                              : "bg-error bg-opacity-10 text-error"
                        }`}>
                          {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
                        </span>
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-neutral-gray">Department:</span>
                      <p className="font-medium">{data.department}</p>
                    </div>
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
