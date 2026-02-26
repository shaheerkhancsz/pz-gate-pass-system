import React, { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateTime, getTodayISO, formatCNIC, formatPhoneNumber, departmentOptions, cn } from "@/lib/utils";
import { gatePassWithItemsSchema, type Customer, type Driver, PHONE_REGEX, PHONE_ERROR, CNIC_REGEX, CNIC_ERROR } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { CustomerSelection } from "./CustomerSelection";
import { DriverSelection } from "./DriverSelection";
import { DocumentPanel } from "@/components/documents";
import { useKeyboardShortcuts, commonShortcuts } from '@/hooks/use-keyboard-shortcuts';

// Gate interface (for gate selector)
interface GateOption {
  id: number;
  name: string;
  plantId?: number | null;
  companyId: number;
  active: boolean;
}

// Gate pass type options
const GATE_PASS_TYPES = [
  { value: "outward",    label: "Outward",    description: "Goods leaving the premises" },
  { value: "inward",     label: "Inward",     description: "Goods entering the premises" },
  { value: "returnable", label: "Returnable", description: "Goods leaving but expected to return" },
] as const;

// Define a consistent item type
type ItemType = {
  name: string;
  sku: string;
  quantity: number;
};

// Create a valid item schema
const itemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  sku: z.string().min(1, "SKU is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
});

// Form schema
const formSchema = gatePassWithItemsSchema.extend({
  date: z.string().min(1, "Date is required"),
  type: z.enum(["outward", "inward", "returnable"]).default("outward"),
  customerName: z.string().min(1, "Name is required"),
  customerPhone: z.string().optional(),
  customerId: z.number().optional().nullable(),
  deliveryAddress: z.string().min(1, "Address is required"),
  driverName: z.string().min(1, "Driver name is required"),
  driverMobile: z.string()
    .regex(PHONE_REGEX, PHONE_ERROR)
    .min(12, "Phone number must be 12 characters long")
    .max(12, "Phone number must be 12 characters long"),
  driverCnic: z.string()
    .regex(CNIC_REGEX, CNIC_ERROR)
    .min(15, "CNIC must be 15 characters long")
    .max(15, "CNIC must be 15 characters long"),
  driverId: z.number().optional().nullable(),
  deliveryVanNumber: z.string().min(1, "Vehicle number is required"),
  department: z.string().min(1, "Department is required"),
  notes: z.string().optional(),
  createdBy: z.string(),
  createdById: z.number(),
  status: z.string().default("pending"),
  expectedReturnDate: z.string().optional().nullable(),
  actualReturnDate: z.string().optional().nullable(),
  gateId: z.number().optional().nullable(),
  items: z.array(z.object({
    name: z.string().min(1, "Item name is required"),
    sku: z.string().min(1, "SKU is required"),
    quantity: z.number().min(1, "Quantity must be at least 1"),
  })).min(1, "At least one item is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface GatePassResponse {
  id: number;
  gatePassNumber: string;
  // Add other fields as needed
}

export function GatePassForm() {
  const { user, isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const todayISO = getTodayISO();
  
  // State for customer and driver selection
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  
  // State for document upload
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // State for tracking created gate pass ID (for document attachment)
  const [createdGatePassId, setCreatedGatePassId] = useState<number | null>(null);
  const [showDocumentUpload, setShowDocumentUpload] = useState<boolean>(false);
  
  // For debugging
  console.log("showDocumentUpload:", showDocumentUpload, "createdGatePassId:", createdGatePassId);

  // Form setup
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: todayISO,
      type: "outward",
      customerName: "",
      customerPhone: "",
      deliveryAddress: "",
      driverName: "",
      driverMobile: "",
      driverCnic: "",
      deliveryVanNumber: "",
      department: isAdmin ? "" : user?.department || "",
      notes: "",
      createdBy: user?.fullName || "",
      createdById: user?.id || 0,
      status: "pending",
      items: [{ name: "", sku: "", quantity: 1 }],
      customerId: undefined,
      driverId: undefined,
      expectedReturnDate: undefined,
      actualReturnDate: undefined,
      gateId: undefined,
    },
  });

  const { fields, append, remove } = useFieldArray({
    name: "items",
    control: form.control,
  });

  // Fetch gates for the current user's company
  const { data: allGates = [] } = useQuery<GateOption[]>({
    queryKey: ["gates", user?.companyId],
    queryFn: () =>
      fetch(`/api/gates?companyId=${user?.companyId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!user?.companyId,
  });
  const gatesForCompany = allGates.filter(g => g.active);

  // Watch type to drive conditional field labels and extra fields
  const passType = form.watch("type");

  // Handle general submission
  const createGatePassMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      try {
        const response = await apiRequest("POST", "/api/gate-passes", {
          ...data,
          customerId: data.customerId ?? undefined,
          driverId: data.driverId ?? undefined,
          user // For activity logging
        });

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Server response was not JSON");
        }

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || "Failed to create gate pass");
        }

        return result;
      } catch (error) {
        console.error("Error creating gate pass:", error);
        throw error;
      }
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gate-passes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
      
      toast({
        title: "Success",
        description: "Gate pass created successfully",
      });

      // Reset form and state
      form.reset();
      setSelectedCustomer(null);
      setSelectedDriver(null);
      setUploadedFiles([]);
      
      // Navigate to gate passes list
      setLocation("/gate-passes");
    },
    onError: (error) => {
      console.error("Error in mutation:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create gate pass",
        variant: "destructive",
      });
    },
  });
  
  // Handle submission and printing
  const printGatePassMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      // First create the gate pass
      const gatePassResponse = await apiRequest("POST", "/api/gate-passes", {
        ...data,
        items: data.items,
        user // For activity logging
      });
      
      const contentType = gatePassResponse.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server response was not JSON");
      }
      
      const gatePass: GatePassResponse = await gatePassResponse.json();

      // If there are files to upload, handle them
      if (uploadedFiles.length > 0) {
        setIsUploading(true);
        
        try {
          // Upload each file
          for (const file of uploadedFiles) {
            // Convert file to base64
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

            // Create document object
            const document = {
              entityType: 'gatePass',
              entityId: gatePass.id,
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              fileData,
              description: null,
              uploadedBy: user?.id || null,
              uploadedByEmail: user?.email || 'unknown',
              user // For activity logging
            };

            // Upload document
            await apiRequest('POST', '/api/documents', document);
          }
        } catch (error: any) {
          console.error('Error uploading documents:', error);
          toast({
            title: 'Warning',
            description: 'Gate pass created but some documents failed to upload',
            variant: 'destructive',
          });
        } finally {
          setIsUploading(false);
        }
      }

      return gatePass;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gate-passes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
      toast({
        title: "Gate Pass Created",
        description: "Opening print view...",
      });
      // Open print page in a new window/tab
      window.open(`/print-gate-pass/${response.id}`, '_blank');
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create gate pass for printing",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      // Validate form data
      const validatedData = formSchema.parse(data);
      
      // Create gate pass
      const gatePass = await createGatePassMutation.mutateAsync(validatedData);

      // Handle file uploads after successful gate pass creation
      if (uploadedFiles.length > 0) {
        setIsUploading(true);
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
              entityId: gatePass.id,
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              fileData,
              description: null,
              uploadedBy: user?.id || null,
              uploadedByEmail: user?.email || 'unknown',
              user
            });
          }
        } catch (error) {
          console.error('Error uploading documents:', error);
          toast({
            title: 'Warning',
            description: 'Gate pass created but some documents failed to upload',
            variant: 'destructive',
          });
        } finally {
          setIsUploading(false);
        }
      }
    } catch (error) {
      console.error('Form submission error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit form',
        variant: 'destructive',
      });
    }
  };

  // CNIC and phone formatting
  const handleCnicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedCnic = formatCNIC(e.target.value);
    form.setValue("driverCnic", formattedCnic);
  };

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedMobile = formatPhoneNumber(e.target.value);
    form.setValue("driverMobile", formattedMobile);
  };
  
  // Handle customer selection
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    
    // Update form values
    form.setValue("customerName", customer.name);
    form.setValue("customerPhone", customer.phone || "");
    form.setValue("customerId", customer.id);
    
    // If customer has an address, update delivery address
    if (customer.address) {
      form.setValue("deliveryAddress", customer.address);
    }
  };
  
  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    
    // Clear customer related fields
    form.setValue("customerName", "");
    form.setValue("customerPhone", "");
    form.setValue("customerId", null);
  };
  
  // Handle driver selection
  const handleSelectDriver = (driver: Driver) => {
    setSelectedDriver(driver);
    
    // Update form values
    form.setValue("driverName", driver.name);
    form.setValue("driverMobile", driver.mobile);
    form.setValue("driverCnic", driver.cnic);
    form.setValue("driverId", driver.id);
    
    // If driver has a vehicle number, update delivery van number
    if (driver.vehicleNumber) {
      form.setValue("deliveryVanNumber", driver.vehicleNumber);
    }
  };
  
  const handleClearDriver = () => {
    setSelectedDriver(null);
    
    // Clear driver related fields
    form.setValue("driverName", "");
    form.setValue("driverMobile", "");
    form.setValue("driverCnic", "");
    form.setValue("deliveryVanNumber", "");
    form.setValue("driverId", null);
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    // Convert FileList to array and validate each file
    const newFiles = Array.from(files).filter(file => {
      // Check file size (7.5MB limit to account for base64 overhead)
      if (file.size > 7.5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} is larger than 7.5MB`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  // Handle file removal
  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (!files) return;

    // Convert FileList to array and validate each file
    const newFiles = Array.from(files).filter(file => {
      // Check file size (7.5MB limit to account for base64 overhead)
      if (file.size > 7.5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} is larger than 7.5MB`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  // Add keyboard shortcuts
  useKeyboardShortcuts([
    {
      ...commonShortcuts.save,
      action: () => form.handleSubmit(onSubmit)(),
    },
    {
      ...commonShortcuts.cancel,
      action: () => setLocation('/gate-passes'),
    },
    {
      ...commonShortcuts.print,
      action: () => {
        form.trigger().then(isValid => {
          if (isValid) {
            const formData = form.getValues();
            const formattedData = {
              ...formData,
              items: formData.items.map((item: { name: string; sku: string; quantity: number }) => ({
                name: item.name,
                sku: item.sku,
                quantity: Number(item.quantity),
              })),
            };
            printGatePassMutation.mutate(formattedData);
          } else {
            toast({
              title: "Validation Error",
              description: "Please fill in all required fields correctly before printing.",
              variant: "destructive",
            });
          }
        });
      },
    },
    commonShortcuts.help,
  ]);

  return (
    <Card className="bg-white rounded-lg shadow-sm">
      <CardContent className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Pass Type Selector */}
            <div>
              <h3 className="text-lg font-medium mb-3 pb-2 border-b border-neutral-medium">Gate Pass Type</h3>
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex flex-wrap gap-3">
                      {GATE_PASS_TYPES.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => field.onChange(t.value)}
                          className={cn(
                            "flex-1 min-w-[140px] px-4 py-3 rounded-lg border-2 text-left transition-all",
                            field.value === t.value
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-neutral-medium bg-white hover:border-primary/50"
                          )}
                        >
                          <div className="font-medium text-sm">{t.label}</div>
                          <div className="text-xs text-neutral-gray mt-0.5">{t.description}</div>
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Basic Information Section */}
            <div>
              <h3 className="text-lg font-medium mb-4 pb-2 border-b border-neutral-medium">Basic Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="space-y-3 sm:space-y-4">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-sm sm:text-base">Issue Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "pl-3 text-left font-normal text-xs sm:text-sm",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? formatDate(field.value) : "Select date"}
                                <CalendarIcon className="ml-auto h-3 sm:h-4 w-3 sm:w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ? new Date(field.value) : new Date()}
                              onSelect={(date) => field.onChange(date ? formatDate(date) : "")}
                              initialFocus
                              className="text-xs sm:text-sm"
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Expected Return Date — only for returnable passes */}
                  {passType === "returnable" && (
                    <FormField
                      control={form.control}
                      name="expectedReturnDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm sm:text-base">
                            Expected Return Date <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              min={todayISO}
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value || null)}
                              className="text-xs sm:text-sm h-8 sm:h-10"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm sm:text-base">Department</FormLabel>
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
                              {departmentOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
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

                  {/* Gate selector — only shown when company has gates configured */}
                  {gatesForCompany.length > 0 && (
                    <FormField
                      control={form.control}
                      name="gateId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm sm:text-base">Gate</FormLabel>
                          <Select
                            value={field.value != null ? String(field.value) : ""}
                            onValueChange={v => field.onChange(v ? Number(v) : null)}
                          >
                            <FormControl>
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Select gate (optional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {gatesForCompany.map(g => (
                                <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <div className="space-y-3 sm:space-y-4">
                  {/* Customer/Supplier Selection — hidden for inward (no customer DB for inward) */}
                  {passType !== "inward" && (
                    <CustomerSelection
                      selectedCustomer={selectedCustomer}
                      onSelectCustomer={handleSelectCustomer}
                      onClearCustomer={handleClearCustomer}
                    />
                  )}

                  {/* Only show manual fields if no customer is selected */}
                  {!selectedCustomer && (
                    <>
                      <FormField
                        control={form.control}
                        name="customerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm sm:text-base">
                              {passType === "inward" ? "Supplier Name" : "Customer / Person Name"}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={passType === "inward" ? "Enter supplier name" : "Enter customer name"}
                                {...field}
                                className="text-xs sm:text-sm h-8 sm:h-10"
                              />
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
                            <FormLabel className="text-sm sm:text-base">
                              {passType === "inward" ? "Supplier Phone" : "Customer Phone Number"}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. 0300-1234567"
                                {...field}
                                className="text-xs sm:text-sm h-8 sm:h-10"
                                onChange={(e) => {
                                  const formattedPhone = formatPhoneNumber(e.target.value);
                                  form.setValue("customerPhone", formattedPhone);
                                }}
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
                        <FormLabel>
                          {passType === "inward" ? "Source / Pickup Address" : "Delivery Address"}
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={passType === "inward" ? "Enter source address" : "Enter delivery address"}
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="createdBy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Created By</FormLabel>
                        <FormControl>
                          <Input
                            value={user?.fullName || ""}
                            readOnly
                            className="bg-neutral-lightest"
                          />
                        </FormControl>
                        <p className="text-xs text-neutral-gray mt-1">Auto-filled from your account</p>
                      </FormItem>
                    )}
                  />

                  <div>
                    <FormLabel>Created Date & Time</FormLabel>
                    <Input
                      value={formatDateTime(new Date())}
                      readOnly
                      className="bg-neutral-lightest"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Item Details Section */}
            <div>
              <h3 className="text-lg font-medium mb-4 pb-2 border-b border-neutral-medium">Item Details</h3>
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="bg-neutral-light">
                      <th className="px-2 sm:px-4 py-1 sm:py-2 text-left text-xs sm:text-sm font-medium">Item Name</th>
                      <th className="px-2 sm:px-4 py-1 sm:py-2 text-left text-xs sm:text-sm font-medium">SKU Number</th>
                      <th className="px-2 sm:px-4 py-1 sm:py-2 text-left text-xs sm:text-sm font-medium w-16 sm:w-20 md:w-24">Quantity</th>
                      <th className="px-2 sm:px-4 py-1 sm:py-2 text-left text-xs sm:text-sm font-medium w-14 sm:w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => (
                      <tr key={field.id}>
                        <td className="px-2 sm:px-4 py-1 sm:py-2">
                          <Input
                            {...form.register(`items.${index}.name`)}
                            placeholder="Item name"
                            className="w-full px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm"
                          />
                          {form.formState.errors.items?.[index]?.name && (
                            <p className="text-xs text-red-500 mt-1">
                              {form.formState.errors.items[index]?.name?.message}
                            </p>
                          )}
                        </td>
                        <td className="px-2 sm:px-4 py-1 sm:py-2">
                          <Input
                            {...form.register(`items.${index}.sku`)}
                            placeholder="SKU number"
                            className="w-full px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm"
                          />
                          {form.formState.errors.items?.[index]?.sku && (
                            <p className="text-xs text-red-500 mt-1">
                              {form.formState.errors.items[index]?.sku?.message}
                            </p>
                          )}
                        </td>
                        <td className="px-2 sm:px-4 py-1 sm:py-2">
                          <Input
                            {...form.register(`items.${index}.quantity`, {
                              valueAsNumber: true,
                            })}
                            type="number"
                            placeholder="Qty"
                            min="1"
                            className="w-full px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm"
                          />
                          {form.formState.errors.items?.[index]?.quantity && (
                            <p className="text-xs text-red-500 mt-1">
                              {form.formState.errors.items[index]?.quantity?.message}
                            </p>
                          )}
                        </td>
                        <td className="px-2 sm:px-4 py-1 sm:py-2">
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                              className="text-error hover:text-error-dark h-auto w-auto p-1"
                            >
                              <span className="material-icons text-xs sm:text-base">delete</span>
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-between items-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => append({ name: "", sku: "", quantity: 1 })}
                  className="flex items-center text-primary hover:text-primary-dark"
                >
                  <span className="material-icons mr-1">add_circle</span> Add Another Item
                </Button>
                
                <div className="text-sm font-medium bg-neutral-light p-3 rounded">
                  <div className="flex space-x-6">
                    <div>
                      <span className="text-neutral-dark">Total Items:</span>{" "}
                      <span className="font-bold">{fields.length}</span>
                    </div>
                    <div>
                      <span className="text-neutral-dark">Total Quantity:</span>{" "}
                      <span className="font-bold">
                        {fields.reduce((sum, _, index) => {
                          const quantity = form.getValues(`items.${index}.quantity`);
                          return sum + (Number.isNaN(Number(quantity)) ? 0 : Number(quantity));
                        }, 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes Section */}
            <div>
              <h3 className="text-lg font-medium mb-3 sm:mb-4 pb-2 border-b border-neutral-medium">Notes</h3>
              <div className="w-full">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm sm:text-base">Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter any additional notes or comments here..."
                          className="resize-none min-h-[100px] sm:min-h-[120px] text-xs sm:text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Driver & Delivery Details Section */}
            <div>
              <h3 className="text-lg font-medium mb-4 pb-2 border-b border-neutral-medium">
                {passType === "inward" ? "Carrier & Vehicle Details" : "Driver & Delivery Details"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="space-y-3 sm:space-y-4">
                  {/* Driver Selection Component */}
                  <DriverSelection
                    selectedDriver={selectedDriver}
                    onSelectDriver={handleSelectDriver}
                    onClearDriver={handleClearDriver}
                  />
                  
                  {/* Only show these fields if no driver is selected */}
                  {!selectedDriver && (
                    <>
                      <FormField
                        control={form.control}
                        name="driverName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm sm:text-base">
                              {passType === "inward" ? "Carrier / Driver Name" : "Driver Name"}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={passType === "inward" ? "Enter carrier name" : "Enter driver name"}
                                {...field}
                                className="text-xs sm:text-sm h-8 sm:h-10"
                              />
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
                            <FormLabel className="text-sm sm:text-base">Driver Mobile Number</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. 0300-1234567"
                                {...field}
                                onChange={handleMobileChange}
                                className="text-xs sm:text-sm h-8 sm:h-10"
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
                            <FormLabel className="text-sm sm:text-base">Driver CNIC Number</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. 42201-1234567-8"
                                {...field}
                                onChange={handleCnicChange}
                                className="text-xs sm:text-sm h-8 sm:h-10"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <FormField
                    control={form.control}
                    name="deliveryVanNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm sm:text-base">Delivery Van Number</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g. KHI-12345" 
                            {...field} 
                            className="text-xs sm:text-sm h-8 sm:h-10"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Document Upload Section - Always show with full functionality */}
            <div>
              <h3 className="text-lg font-medium mb-3 sm:mb-4 pb-2 border-b border-neutral-medium">
                Attach Documents <span className="text-neutral-gray text-sm">(Optional)</span>
              </h3>
              <div className="bg-neutral-lightest p-4 rounded-lg">
                <div className="space-y-4">
                  <div className="flex items-center justify-center w-full">
                    <label 
                      htmlFor="dropzone-file" 
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-neutral-medium border-dashed rounded-lg cursor-pointer bg-white hover:bg-neutral-light"
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <span className="material-icons text-2xl text-neutral-gray mb-2">cloud_upload</span>
                        <p className="mb-2 text-sm text-neutral-dark">
                          <span className="font-medium">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-neutral-gray">PDF, Images, or Documents (max. 7.5MB)</p>
                      </div>
                      <input 
                        id="dropzone-file" 
                        type="file" 
                        className="hidden" 
                        multiple 
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                        onChange={handleFileSelect}
                      />
                    </label>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-neutral-dark mb-2">Uploaded Documents</div>
                    <div className="bg-white rounded border border-neutral-medium p-3">
                      {uploadedFiles.length > 0 ? (
                        <div className="space-y-2">
                          {uploadedFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between py-1">
                              <div className="flex items-center space-x-2">
                                <span className="material-icons text-neutral-gray text-base">description</span>
                                <span className="text-sm text-neutral-dark">{file.name}</span>
                                <span className="text-xs text-neutral-gray">
                                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveFile(index)}
                                className="text-error hover:text-error-dark h-6 w-6"
                              >
                                <span className="material-icons text-base">close</span>
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-neutral-gray text-sm py-2">
                          No documents uploaded yet
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs flex items-center gap-1"
                      onClick={() => {
                        const input = document.getElementById('dropzone-file') as HTMLInputElement;
                        if (input) {
                          input.click();
                        }
                      }}
                    >
                      <span className="material-icons text-base">add</span>
                      Add Document
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Buttons Section */}
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 mt-6 border-t pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/gate-passes")}
                className="text-xs sm:text-sm h-9 sm:h-10 px-4 flex items-center"
              >
                Cancel
              </Button>
              
              <Button
                type="submit"
                className="text-xs sm:text-sm h-9 sm:h-10 px-4 bg-primary hover:bg-primary/90 text-white flex items-center"
                disabled={createGatePassMutation.isPending}
              >
                <span className="material-icons text-sm sm:text-base mr-1">save</span>
                {createGatePassMutation.isPending ? "Saving..." : "Save & Submit"}
              </Button>
              
              <Button
                type="button"
                className="text-xs sm:text-sm h-9 sm:h-10 px-4 bg-primary hover:bg-primary/90 text-white flex items-center"
                onClick={() => {
                  form.trigger().then(isValid => {
                    if (isValid) {
                      const formData = form.getValues();
                      const formattedData = {
                        ...formData,
                        items: formData.items.map(item => ({
                          name: item.name,
                          sku: item.sku,
                          quantity: Number(item.quantity),
                        })),
                      };
                      printGatePassMutation.mutate(formattedData);
                    } else {
                      toast({
                        title: "Validation Error",
                        description: "Please fill in all required fields correctly before printing.",
                        variant: "destructive",
                      });
                    }
                  });
                }}
                disabled={createGatePassMutation.isPending || printGatePassMutation.isPending}
              >
                <span className="material-icons text-sm sm:text-base mr-1">print</span>
                {printGatePassMutation.isPending ? "Printing..." : "Save & Print"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
