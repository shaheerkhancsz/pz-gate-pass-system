import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppLayout } from "@/components/layout/AppLayout";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/use-permissions";
import { CustomerSelection } from "@/components/gate-pass/CustomerSelection";
import { DriverSelection } from "@/components/gate-pass/DriverSelection";
import { ItemsTable } from "@/components/gate-pass/ItemsTable";
import { DocumentUpload } from "@/components/gate-pass/DocumentUpload";
import { WorkflowActions } from "@/components/gate-pass/WorkflowActions";
import { formatCNIC, formatPhoneNumber, formatDateTime } from "@/lib/utils";
import { useDepartments } from "@/hooks/use-departments";
import { getStatusBadgeClass, getStatusLabel } from "@/components/ui/theme";
import { apiRequest } from "@/lib/queryClient";
import { type Driver, type GatePass, type Item, type GatePassWithItems, gatePassWithItemsSchema, PHONE_REGEX, PHONE_ERROR, CNIC_REGEX, CNIC_ERROR } from "@shared/schema";
import { Link } from "wouter";
import { useKeyboardShortcuts, commonShortcuts } from '@/hooks/use-keyboard-shortcuts';

// Form schema
const formSchema = gatePassWithItemsSchema;

type FormValues = GatePassWithItems;

export default function EditGatePass() {
  const { id } = useParams();
  const gatePassId = parseInt(id || "0", 10);
  const [, navigate] = useLocation();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();

  // Phase 2: statuses that lock editing for non-admins
  const LOCKED_STATUSES = ["approved", "security_allowed", "completed", "rejected"];
  const { data: departments = [] } = useDepartments();

  // Component state
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Form setup
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      customerName: "",
      customerPhone: "",
      customerId: 0,
      driverName: "",
      driverMobile: "",
      driverCnic: "",
      driverId: 0,
      deliveryVanNumber: "",
      deliveryAddress: "",
      notes: "",
      department: isAdmin ? "" : user?.department || "",
      status: "pending",
      createdBy: user?.fullName || "",
      createdById: user?.id || 0,
      items: [{ name: "", sku: "", quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Add keyboard shortcuts
  useKeyboardShortcuts([
    {
      ...commonShortcuts.save,
      action: () => form.handleSubmit(onSubmit)(),
    },
    {
      ...commonShortcuts.cancel,
      action: () => navigate('/gate-passes'),
    },
    {
      ...commonShortcuts.print,
      action: () => {
        if (data) {
          window.open(`/print-gate-pass/${data.id}`, '_blank');
        }
      },
    },
    commonShortcuts.help,
  ]);

  // Query to fetch gate pass data
  const { data, isLoading } = useQuery<GatePass & { items: Item[] }>({
    queryKey: ["/api/gate-passes", id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/gate-passes/${id}`);
      const data = await response.json();

      // Set initial form values
      if (data) {
        setSelectedCustomer(data.customer);
        setSelectedDriver(data.driver);
        form.reset({
          ...data,
          department: data.department,
          items: data.items.map((item: Item) => ({
            id: item.id,
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
          })),
        });
      }
      return data;
    },
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Mutation to update gate pass
  const updateGatePassMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      try {
        const response = await apiRequest("PATCH", `/api/gate-passes/${id}`, {
          ...data,
          customerId: data.customerId || undefined,
          driverId: data.driverId || undefined,
          user,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to update gate pass");
        }

        return response.json();
      } catch (error) {
        console.error("Error updating gate pass:", error);
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate queries first
      queryClient.invalidateQueries({ queryKey: ["/api/gate-passes"] });
      queryClient.invalidateQueries({ queryKey: [`/api/gate-passes/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });

      // Show success message
      toast({
        title: "Success",
        description: "Gate pass updated successfully",
      });

      // Reset form and state
      form.reset();
      setSelectedCustomer(null);
      setSelectedDriver(null);
      setUploadedFiles([]);

      // Navigate after everything is done
      setTimeout(() => {
        navigate("/gate-passes");
      }, 0);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update gate pass",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    try {
      // Update gate pass
      const updatedGatePass = await updateGatePassMutation.mutateAsync(data);

      // Handle file uploads after successful update
      if (uploadedFiles.length > 0) {
        setIsUploading(true);
        let uploadErrors = false;
        try {
          for (const file of uploadedFiles) {
            const fileData = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === 'string') {
                  resolve(reader.result);
                } else {
                  reject(new Error('Failed to convert file to base64'));
                }
              };
              reader.onerror = () => reject(new Error('Error reading file'));
              reader.readAsDataURL(file);
            });

            await apiRequest('POST', '/api/documents', {
              entityType: 'gatePass',
              entityId: updatedGatePass.id,
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              fileData,
              description: null,
              uploadedBy: user?.id || null,
              uploadedByEmail: user?.email || 'unknown',
              user,
            });
          }
        } catch (error) {
          console.error('Error uploading documents:', error);
          uploadErrors = true;
          toast({
            title: 'Warning',
            description: 'Gate pass updated but some documents failed to upload',
            variant: 'destructive',
          });
        } finally {
          setIsUploading(false);
          if (!uploadErrors) {
            // Only navigate if there were no upload errors
            navigate("/gate-passes");
          }
        }
      } else {
        // If no files to upload, navigate immediately
        navigate("/gate-passes");
      }
    } catch (error) {
      // Error handling is done in the mutation's onError callback
    }
  };

  // Handle customer selection
  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    form.setValue("customerName", customer.name);
    form.setValue("customerPhone", customer.phone || "");
    form.setValue("customerId", customer.id || 0);
    if (customer.address) {
      form.setValue("deliveryAddress", customer.address);
    }
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    form.setValue("customerName", "");
    form.setValue("customerPhone", "");
    form.setValue("customerId", 0);
  };

  // Handle driver selection
  const handleSelectDriver = (driver: Driver) => {
    setSelectedDriver(driver);
    form.setValue("driverName", driver.name);
    form.setValue("driverMobile", driver.mobile);
    form.setValue("driverCnic", driver.cnic);
    form.setValue("driverId", driver.id || 0);
    if (driver.vehicleNumber) {
      form.setValue("deliveryVanNumber", driver.vehicleNumber);
    }
  };

  const handleClearDriver = () => {
    setSelectedDriver(null);
    form.setValue("driverName", "");
    form.setValue("driverMobile", "");
    form.setValue("driverCnic", "");
    form.setValue("driverId", 0);
    form.setValue("deliveryVanNumber", "");
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

  if (!data) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-lg font-medium text-error mb-4">Gate pass not found</p>
          <Button asChild variant="outline">
            <Link href="/gate-passes">Back to Gate Passes</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Phase 2: Show a locked view for non-admins when status prevents editing
  const isLocked = !isAdmin && LOCKED_STATUSES.includes(data.status);

  if (isLocked) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Gate Pass {data.gatePassNumber}</h1>
            <Button asChild variant="outline">
              <Link href="/gate-passes">Back to Gate Passes</Link>
            </Button>
          </div>
          <div className="mb-4 p-4 rounded-md border border-yellow-300 bg-yellow-50 flex items-start gap-2">
            <span className="material-icons text-yellow-600 mt-0.5">lock</span>
            <div>
              <p className="text-sm font-medium text-yellow-800">
                This gate pass is locked for editing
              </p>
              <p className="text-sm text-yellow-700">
                Current status:{" "}
                <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadgeClass(data.status)}`}>
                  {getStatusLabel(data.status)}
                </span>
                {" "}— editing is disabled once a pass has been approved or beyond.
              </p>
            </div>
          </div>
          {(data as any).remarks && (
            <div className="mb-4 p-3 rounded-md border border-orange-300 bg-orange-50 flex items-start gap-2">
              <span className="material-icons text-orange-500 mt-0.5 text-sm">info</span>
              <div>
                <p className="text-sm font-medium text-orange-800">Remarks:</p>
                <p className="text-sm text-orange-700">{(data as any).remarks}</p>
              </div>
            </div>
          )}
          <WorkflowActions gatePass={data} />
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link href={`/view-gate-pass/${data.id}`}>View Gate Pass Details</Link>
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Edit Gate Pass</h1>
          <Button asChild variant="outline">
            <Link href="/gate-passes">Back to Gate Passes</Link>
          </Button>
        </div>

        {/* Sent Back remarks banner */}
        {data.status === "sent_back" && (data as any).remarks && (
          <div className="mb-4 p-3 rounded-md border border-orange-300 bg-orange-50 flex items-start gap-2">
            <span className="material-icons text-orange-500 mt-0.5 text-sm">info</span>
            <div>
              <p className="text-sm font-medium text-orange-800">Sent Back — please correct and resubmit:</p>
              <p className="text-sm text-orange-700">{(data as any).remarks}</p>
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Customer Details */}
                  <div>
                    <h3 className="text-lg font-medium mb-4 pb-2 border-b border-neutral-medium">
                      Customer Details
                    </h3>
                    <div className="space-y-4">
                      <CustomerSelection
                        selectedCustomer={selectedCustomer}
                        onSelectCustomer={handleSelectCustomer}
                        onClearCustomer={handleClearCustomer}
                      />

                      {!selectedCustomer && (
                        <>
                          <FormField
                            control={form.control}
                            name="customerName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Customer Name</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="customerPhone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Customer Phone</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value ?? ""}
                                    onChange={(e) => field.onChange(e.target.value || null)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}

                      <FormField
                        control={form.control}
                        name="deliveryAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Delivery Address</FormLabel>
                            <FormControl>
                              <Textarea {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Driver Details */}
                  <div>
                    <h3 className="text-lg font-medium mb-4 pb-2 border-b border-neutral-medium">
                      Driver Details
                    </h3>
                    <div className="space-y-4">
                      <DriverSelection
                        selectedDriver={selectedDriver}
                        onSelectDriver={handleSelectDriver}
                        onClearDriver={handleClearDriver}
                      />

                      {!selectedDriver && (
                        <>
                          <FormField
                            control={form.control}
                            name="driverName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Driver Name</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="driverMobile"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Driver Mobile</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value}
                                    onChange={(e) => {
                                      const formatted = formatPhoneNumber(e.target.value);
                                      field.onChange(formatted);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="driverCnic"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Driver CNIC</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value}
                                    onChange={(e) => {
                                      const formatted = formatCNIC(e.target.value);
                                      field.onChange(formatted);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="deliveryVanNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Vehicle Number</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Gate Pass Details */}
                  <div>
                    <h3 className="text-lg font-medium mb-4 pb-2 border-b border-neutral-medium">
                      Gate Pass Details
                    </h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <FormField
                          control={form.control}
                          name="date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} className="h-9" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="department"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Department</FormLabel>
                              {isAdmin ? (
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                >
                                  <FormControl>
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="Select department" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {departments.map((dept) => (
                                      <SelectItem key={dept.id} value={dept.name}>
                                        {dept.name}{dept.description ? ` — ${dept.description}` : ""}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <FormControl>
                                  <Input
                                    {...field}
                                    disabled
                                    value={user?.department || ""}
                                    className="bg-neutral-50"
                                  />
                                </FormControl>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Status</FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={!isAdmin}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select status" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="sent_back">Sent Back</SelectItem>
                                  <SelectItem value="approved">Approved</SelectItem>
                                  <SelectItem value="security_allowed">Security Allowed</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="space-y-1">
                          <FormLabel className="text-sm font-medium">Created By</FormLabel>
                          <div className="px-3 py-1.5 bg-neutral-50 rounded-md border border-neutral-200">
                            <div className="text-sm text-neutral-900">{data.createdBy}</div>
                            <div className="text-xs text-neutral-500">Auto-filled from creator's account</div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <FormLabel className="text-sm font-medium">Created Date & Time</FormLabel>
                          <div className="px-3 py-2 bg-neutral-50 rounded-md border border-neutral-200">
                            <div className="text-sm text-neutral-900">{formatDateTime(data.createdAt)}</div>
                          </div>
                        </div>

                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Notes</FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  value={field.value ?? ""}
                                  onChange={(e) => field.onChange(e.target.value || null)}
                                  className="min-h-[100px] resize-vertical"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="mt-8">
                  <h3 className="text-lg font-medium mb-4 pb-2 border-b border-neutral-medium">
                    Item Details
                  </h3>
                  <ItemsTable
                    fields={fields}
                    form={form}
                    append={append}
                    remove={remove}
                  />
                </div>

                {/* Documents */}
                <div className="mt-8">
                  <h3 className="text-lg font-medium mb-4 pb-2 border-b border-neutral-medium">
                    Documents
                  </h3>
                  <div className="space-y-4">
                    <DocumentUpload
                      uploadedFiles={uploadedFiles}
                      setUploadedFiles={setUploadedFiles}
                      isUploading={isUploading}
                      setIsUploading={setIsUploading}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/gate-passes")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateGatePassMutation.isPending || isUploading}
              >
                {updateGatePassMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AppLayout>
  );
}
