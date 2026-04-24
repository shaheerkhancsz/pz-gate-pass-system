import React, { useState, useEffect } from "react";
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
import { gatePassWithItemsSchema, type Customer, type Driver, type Vendor, type ItemMaster, PHONE_REGEX, PHONE_ERROR, CNIC_REGEX, CNIC_ERROR } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Search } from "lucide-react";
import { CustomerSelection } from "./CustomerSelection";
import { VendorSelection } from "./VendorSelection";
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

// Plant interface (for plant selector)
interface PlantOption {
  id: number;
  name: string;
  companyId: number;
  active: boolean;
}

// Main gate pass type options (Outward / Inward)
const MAIN_TYPES = [
  { value: "outward" as const, label: "Outward", description: "Goods leaving the premises" },
  { value: "inward" as const, label: "Inward", description: "Goods entering the premises" },
];

// Define a consistent item type
type ItemType = {
  name: string;
  sku: string;
  quantity: number;
  unit: string;
};

// Create a valid item schema
const itemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  sku: z.string().min(1, "SKU is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unit: z.string().optional(),
});

// Form schema
const formSchema = gatePassWithItemsSchema.extend({
  date: z.string().min(1, "Date is required"),
  type: z.enum(["outward", "inward", "returnable"]).default("outward"),
  customerName: z.string().min(1, "Name is required"),
  customerPhone: z.string().optional(),
  customerId: z.number().optional().nullable(),
  deliveryAddress: z.string().min(1, "Address is required"),
  driverName: z.string().optional().or(z.literal("")),
  driverMobile: z.string()
    .regex(PHONE_REGEX, PHONE_ERROR)
    .min(11, "Phone number must be 11 or 12 characters long")
    .max(12, "Phone number must be 11 or 12 characters long")
    .optional()
    .or(z.literal("")),
  driverCnic: z.string()
    .regex(CNIC_REGEX, CNIC_ERROR)
    .min(15, "CNIC must be 15 characters long")
    .max(15, "CNIC must be 15 characters long")
    .optional()
    .or(z.literal("")),
  driverId: z.number().optional().nullable(),
  deliveryVanNumber: z.string().optional().or(z.literal("")),
  allowTo: z.string().optional().or(z.literal("")),
  department: z.string().min(1, "Department is required"),
  reason: z.string().optional(),
  notes: z.string().optional(),
  createdBy: z.string(),
  createdById: z.number(),
  status: z.string().default("pending"),
  expectedReturnDate: z.string().optional().nullable(),
  actualReturnDate: z.string().optional().nullable(),
  gateId: z.number().optional().nullable(),
  plantId: z.number().optional().nullable(),
  companyId: z.number().optional().nullable(),
  items: z.array(z.object({
    name: z.string().min(1, "Item name is required"),
    sku: z.string().min(1, "SKU is required"),
    quantity: z.number().min(1, "Quantity must be at least 1"),
    unit: z.string().optional(),
    itemType: z.enum(["material", "asset", "other"]).default("material"),
    reason: z.string().optional(),
  })),
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

  // State for customer, vendor and driver selection
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  // Party type — who the gate pass is for
  const [partyType, setPartyType] = useState<"customer" | "vendor" | "employee">("customer");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");

  // State for company selector (admin only)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(user?.companyId ?? null);

  // State for selected plant
  const [selectedPlantId, setSelectedPlantId] = useState<number | null>(null);

  // Driver section collapsed by default (optional — expand only when needed)
  const [driverExpanded, setDriverExpanded] = useState(false);

  // State for item master popover per row
  const [itemSearchOpen, setItemSearchOpen] = useState<Record<number, boolean>>({});
  const [itemSearch, setItemSearch] = useState<Record<number, string>>({});

  // State for item types (Asset / Material / Other)
  const [itemTypes, setItemTypes] = useState<Record<number, "asset" | "material" | "other">>({});

  // State for main gate pass type (Outward / Inward)
  const [mainType, setMainType] = useState<"outward" | "inward">("outward");

  // State for document upload
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Input mode: 'items' | 'attachment' | 'either' (from department config)
  const [deptInputMode, setDeptInputMode] = useState<"items" | "attachment" | "either">("items");
  // User's choice when deptInputMode === 'either'
  const [inputChoice, setInputChoice] = useState<"items" | "attachment">("items");

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
      allowTo: "",
      department: isAdmin ? "" : user?.department || "",
      reason: "",
      notes: "",
      createdBy: user?.fullName || "",
      createdById: user?.id || 0,
      status: "pending",
      items: [{ name: "", sku: "", quantity: 0, unit: "", itemType: "material" as const, reason: "" }],
      customerId: undefined,
      driverId: undefined,
      expectedReturnDate: undefined,
      actualReturnDate: undefined,
      gateId: undefined,
      plantId: undefined,
      companyId: user?.companyId ?? undefined,
    },
  });

  const { fields, append, remove } = useFieldArray({
    name: "items",
    control: form.control,
  });

  // Fetch companies — admin gets all, non-admin gets their assigned companies only
  const { data: companies = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["companies"],
    queryFn: () => fetch("/api/companies", { credentials: "include" }).then(r => r.json()),
  });

  // If non-admin has multiple assigned companies, allow them to pick one
  const hasMultipleCompanies = !isAdmin && companies.length > 1;

  // Fetch gates for the selected company
  const effectiveCompanyId = selectedCompanyId ?? user?.companyId;

  // Fetch plants for the selected company
  const { data: allPlants = [] } = useQuery<PlantOption[]>({
    queryKey: ["plants", effectiveCompanyId],
    queryFn: () =>
      fetch(`/api/plants?companyId=${effectiveCompanyId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!effectiveCompanyId,
  });
  const plantsForCompany = allPlants.filter(p => p.active !== false);

  const { data: allGates = [] } = useQuery<GateOption[]>({
    queryKey: ["gates", effectiveCompanyId, selectedPlantId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (effectiveCompanyId) params.set("companyId", String(effectiveCompanyId));
      if (selectedPlantId) params.set("plantId", String(selectedPlantId));
      return fetch(`/api/gates?${params}`, { credentials: "include" }).then(r => r.json());
    },
    enabled: !!effectiveCompanyId,
  });
  const gatesForCompany = allGates.filter(g => g.active);

  // Fetch departments from DB (all users — needed for input mode config)
  const { data: dbDepartments = [] } = useQuery<{ id: number; name: string; active: boolean; itemInputMode?: string }[]>({
    queryKey: ["departments", effectiveCompanyId],
    queryFn: () =>
      fetch(`/api/departments?companyId=${effectiveCompanyId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!effectiveCompanyId,
  });

  const activeDepts = dbDepartments.filter(d => d.active !== false);
  const deptOptions = activeDepts.length > 0
    ? activeDepts.map(d => ({ value: d.name, label: d.name }))
    : departmentOptions;

  // Derive input mode from current user's department setting
  const currentDeptName = isAdmin ? form.watch("department") : user?.department;
  const currentDeptRecord = dbDepartments.find(d => d.name === currentDeptName);
  const effectiveInputMode = (currentDeptRecord?.itemInputMode ?? "items") as "items" | "attachment" | "either";
  const showItems = effectiveInputMode === "items" || (effectiveInputMode === "either" && inputChoice === "items");
  const showAttachment = effectiveInputMode === "attachment" || (effectiveInputMode === "either" && inputChoice === "attachment");

  // Reset inputChoice when department changes
  useEffect(() => {
    setInputChoice("items");
    setDeptInputMode(effectiveInputMode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDeptName, effectiveInputMode]);

  // Fetch item master for item lookup popover
  const { data: itemMasterList = [] } = useQuery<ItemMaster[]>({
    queryKey: ["item-master", effectiveCompanyId],
    queryFn: () =>
      fetch(`/api/item-master?companyId=${effectiveCompanyId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!effectiveCompanyId,
  });
  const activeItemMaster = itemMasterList.filter(im => im.active !== false);

  // Fetch employees (users) for employee party type
  const { data: employeeList = [] } = useQuery<any[]>({
    queryKey: ["users"],
    queryFn: () => fetch("/api/users", { credentials: "include" }).then(r => r.json()),
  });
  const filteredEmployees = (Array.isArray(employeeList) ? employeeList : []).filter(
    (e: any) => e.active !== false &&
      (employeeSearch === "" ||
        e.fullName?.toLowerCase().includes(employeeSearch.toLowerCase()) ||
        e.email?.toLowerCase().includes(employeeSearch.toLowerCase()) ||
        e.department?.toLowerCase().includes(employeeSearch.toLowerCase()))
  );

  // Watch type to drive conditional field labels and extra fields
  const passType = form.watch("type");

  // Clear party fields when party type changes
  useEffect(() => {
    setSelectedCustomer(null);
    setSelectedVendor(null);
    setSelectedEmployee(null);
    setEmployeeSearch("");
    form.setValue("customerName", "");
    form.setValue("customerPhone", "");
    form.setValue("customerId", null);
  }, [partyType]);

  // (kept for backward compat — no longer needed but harmless)
  useEffect(() => {
    if (passType !== "inward" && selectedVendor) {
      setSelectedVendor(null);
      form.setValue("customerName", "");
      form.setValue("customerPhone", "");
    }
  }, [passType]);

  // Handle general submission
  const createGatePassMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      try {
        const response = await apiRequest("POST", "/api/gate-passes", {
          ...data,
          companyId: selectedCompanyId ?? user?.companyId,
          plantId: data.plantId ?? selectedPlantId ?? undefined,
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
        companyId: selectedCompanyId ?? user?.companyId,
        plantId: data.plantId ?? selectedPlantId ?? undefined,
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
      // Items required only when in items mode
      if (showItems && (!data.items || data.items.length === 0)) {
        toast({ title: "Items required", description: "Please add at least one item.", variant: "destructive" });
        return;
      }
      // Attachment required when in attachment mode
      if (showAttachment && uploadedFiles.length === 0) {
        toast({ title: "Attachment required", description: "Please upload at least one document.", variant: "destructive" });
        return;
      }

      // Strip items if user chose attachment
      const submitData = { ...data, items: showItems ? data.items : [] };

      // Validate form data
      const validatedData = formSchema.parse(submitData);

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

  // Handle vendor selection
  const handleSelectVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    form.setValue("customerName", vendor.name);
    form.setValue("customerPhone", vendor.phone || "");
    if (vendor.address) {
      form.setValue("deliveryAddress", vendor.address);
    }
  };

  const handleClearVendor = () => {
    setSelectedVendor(null);
    form.setValue("customerName", "");
    form.setValue("customerPhone", "");
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
              items: formData.items.map((item: { name: string; sku: string; quantity: number; unit?: string }) => ({
                name: item.name,
                sku: item.sku,
                quantity: Number(item.quantity),
                unit: item.unit || "",
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
      <CardContent className="p-4 sm:p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* ── Row 1: Pass Type only ── */}
            <div className="flex flex-wrap items-end gap-4 pb-3 border-b">
              <div className="flex-1 min-w-[260px]">
                <p className="text-xs font-semibold text-neutral-gray mb-1.5 uppercase tracking-wide">Gate Pass Type</p>
                <div className="flex flex-wrap gap-2">
                  {MAIN_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => {
                        setMainType(t.value);
                        form.setValue("type", t.value === "inward" ? "inward" : "outward");
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-md border text-sm font-medium transition-all",
                        mainType === t.value
                          ? "border-primary bg-primary text-white"
                          : "border-neutral-medium bg-white text-neutral-dark hover:border-primary/60"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                  {mainType === "outward" && (
                    <>
                      <span className="self-center text-neutral-gray text-xs">→</span>
                      <button
                        type="button"
                        onClick={() => form.setValue("type", "outward")}
                        className={cn(
                          "px-3 py-1.5 rounded-md border text-sm font-medium transition-all",
                          passType === "outward"
                            ? "border-blue-500 bg-blue-500 text-white"
                            : "border-neutral-medium bg-white text-neutral-dark hover:border-blue-400"
                        )}
                      >
                        Non-Returnable
                      </button>
                      <button
                        type="button"
                        onClick={() => form.setValue("type", "returnable")}
                        className={cn(
                          "px-3 py-1.5 rounded-md border text-sm font-medium transition-all",
                          passType === "returnable"
                            ? "border-amber-500 bg-amber-500 text-white"
                            : "border-neutral-medium bg-white text-neutral-dark hover:border-amber-400"
                        )}
                      >
                        Returnable
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── Main Fields Grid ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-3">

              {/* Company — first field, admin/multi-company only */}
              {(isAdmin || hasMultipleCompanies) && companies.length > 1 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Company <span className="text-red-500">*</span></label>
                  <Select
                    value={selectedCompanyId != null ? String(selectedCompanyId) : ""}
                    onValueChange={(v) => setSelectedCompanyId(Number(v))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Date */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-sm font-medium">Issue Date <span className="text-red-500">*</span></FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn("h-9 pl-3 text-left font-normal text-sm", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? formatDate(field.value) : "Select date"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : new Date()}
                          onSelect={(date) => field.onChange(date ? formatDate(date) : "")}
                          disabled={(date) => date > new Date(new Date().setHours(23, 59, 59, 999))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Department */}
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Department <span className="text-red-500">*</span></FormLabel>
                    {isAdmin ? (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {deptOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <FormControl>
                        <Input disabled value={user?.department || ""} className="h-9 bg-neutral-50 text-sm" />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Plant */}
              {plantsForCompany.length > 0 && (
                <FormField
                  control={form.control}
                  name="plantId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Plant</FormLabel>
                      <Select
                        value={field.value != null ? String(field.value) : ""}
                        onValueChange={v => {
                          const plantId = v ? Number(v) : null;
                          field.onChange(plantId);
                          setSelectedPlantId(plantId);
                          // Reset gate when plant changes
                          form.setValue("gateId", null);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select plant" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {plantsForCompany.map(p => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Gate */}
              {gatesForCompany.length > 0 && (
                <FormField
                  control={form.control}
                  name="gateId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Gate</FormLabel>
                      <Select
                        value={field.value != null ? String(field.value) : ""}
                        onValueChange={v => field.onChange(v ? Number(v) : null)}
                      >
                        <FormControl>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select gate" />
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

              {/* Allow To */}
              <FormField
                control={form.control}
                name="allowTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Allow To <span className="text-neutral-gray text-xs font-normal">(Optional)</span></FormLabel>
                    <FormControl>
                      <Input h-9 placeholder="Person carrying the goods" {...field} value={field.value ?? ""} className="h-9 text-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Expected Return Date — returnable only */}
              {passType === "returnable" && (
                <FormField
                  control={form.control}
                  name="expectedReturnDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Expected Return Date <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          min={todayISO}
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                          className="h-9 text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Party Type + Selection block */}
              <div className="sm:col-span-2 lg:col-span-3 space-y-3">
                {/* Party Type pills */}
                <div>
                  <p className="text-xs font-semibold text-neutral-gray mb-1.5 uppercase tracking-wide">Party Type <span className="text-red-500">*</span></p>
                  <div className="flex gap-2">
                    {(["customer", "vendor", "employee"] as const).map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => setPartyType(pt)}
                        className={cn(
                          "px-3 py-1.5 rounded-md border text-sm font-medium capitalize transition-all",
                          partyType === pt
                            ? "border-primary bg-primary text-white"
                            : "border-neutral-medium bg-white text-neutral-dark hover:border-primary/60"
                        )}
                      >
                        {pt.charAt(0).toUpperCase() + pt.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selection widget based on party type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-3">
                  {partyType === "customer" && (
                    <div className="space-y-3">
                      <CustomerSelection
                        selectedCustomer={selectedCustomer}
                        onSelectCustomer={handleSelectCustomer}
                        onClearCustomer={handleClearCustomer}
                      />
                      {!selectedCustomer && (
                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={form.control}
                            name="customerName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium">Customer / Person <span className="text-red-500">*</span></FormLabel>
                                <FormControl>
                                  <Input placeholder="Customer name" {...field} className="h-9 text-sm" />
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
                                <FormLabel className="text-sm font-medium">Phone <span className="text-neutral-gray text-xs font-normal">(Optional)</span></FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="0300-1234567"
                                    {...field}
                                    className="h-9 text-sm"
                                    onChange={(e) => form.setValue("customerPhone", formatPhoneNumber(e.target.value))}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {partyType === "vendor" && (
                    <div className="space-y-3">
                      <VendorSelection
                        selectedVendor={selectedVendor}
                        onSelectVendor={handleSelectVendor}
                        onClearVendor={handleClearVendor}
                      />
                      {!selectedVendor && (
                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={form.control}
                            name="customerName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium">Vendor / Supplier <span className="text-red-500">*</span></FormLabel>
                                <FormControl>
                                  <Input placeholder="Vendor name" {...field} className="h-9 text-sm" />
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
                                <FormLabel className="text-sm font-medium">Phone <span className="text-neutral-gray text-xs font-normal">(Optional)</span></FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="0300-1234567"
                                    {...field}
                                    className="h-9 text-sm"
                                    onChange={(e) => form.setValue("customerPhone", formatPhoneNumber(e.target.value))}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {partyType === "employee" && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Employee <span className="text-red-500">*</span></label>
                      {selectedEmployee ? (
                        <div className="flex items-center gap-2">
                          <div className="rounded-lg border p-2 text-sm flex-1">
                            <div className="font-semibold">{selectedEmployee.fullName}</div>
                            {selectedEmployee.department && <div className="text-xs text-neutral-gray">{selectedEmployee.department}</div>}
                            {selectedEmployee.email && <div className="text-xs text-neutral-gray">{selectedEmployee.email}</div>}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedEmployee(null);
                              form.setValue("customerName", "");
                              form.setValue("customerPhone", "");
                            }}
                          >
                            Change
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            placeholder="Search by name, email or department..."
                            value={employeeSearch}
                            onChange={(e) => setEmployeeSearch(e.target.value)}
                            className="h-9 text-sm"
                          />
                          {employeeSearch && (
                            <div className="border rounded-md max-h-48 overflow-y-auto">
                              {filteredEmployees.length === 0 ? (
                                <p className="text-xs text-neutral-gray text-center py-3">No employees found</p>
                              ) : (
                                filteredEmployees.slice(0, 10).map((emp: any) => (
                                  <div
                                    key={emp.id}
                                    className="px-3 py-2 cursor-pointer hover:bg-muted text-sm border-b last:border-b-0"
                                    onClick={() => {
                                      setSelectedEmployee(emp);
                                      setEmployeeSearch("");
                                      form.setValue("customerName", emp.fullName);
                                      form.setValue("customerPhone", emp.phoneNumber || "");
                                    }}
                                  >
                                    <div className="font-medium">{emp.fullName}</div>
                                    <div className="text-xs text-neutral-gray">{emp.department}{emp.email ? ` · ${emp.email}` : ""}</div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                          <FormField
                            control={form.control}
                            name="customerName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium">Employee Name <span className="text-red-500">*</span></FormLabel>
                                <FormControl>
                                  <Input placeholder="Or type employee name manually" {...field} className="h-9 text-sm" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery Address */}
              <FormField
                control={form.control}
                name="deliveryAddress"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 lg:col-span-3">
                    <FormLabel className="text-sm font-medium">
                      {passType === "inward" ? "Source / Pickup Address" : "Delivery Address"} <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={passType === "inward" ? "Enter source address" : "Enter delivery address"}
                        className="resize-none h-[52px] text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ── Driver Details — collapsible toggle to reduce scroll ── */}
            <div>
              <button
                type="button"
                onClick={() => setDriverExpanded(v => !v)}
                className="flex items-center gap-2 text-xs font-semibold text-neutral-gray uppercase tracking-wide hover:text-primary transition-colors"
              >
                <span className={cn("material-icons text-sm transition-transform", driverExpanded ? "rotate-90" : "")}>
                  chevron_right
                </span>
                Driver Details
                <span className="font-normal normal-case text-neutral-gray">(Optional)</span>
                {(form.watch("driverName") || selectedDriver) && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold normal-case tracking-normal">
                    Filled
                  </span>
                )}
              </button>

              {driverExpanded && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-3 mt-3">
                  {/* Driver lookup or manual fields */}
                  <DriverSelection
                    selectedDriver={selectedDriver}
                    onSelectDriver={(d) => { handleSelectDriver(d); setDriverExpanded(true); }}
                    onClearDriver={handleClearDriver}
                  />

                  {!selectedDriver && (
                    <>
                      <FormField
                        control={form.control}
                        name="driverName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">{passType === "inward" ? "Carrier Name" : "Driver Name"}</FormLabel>
                            <FormControl>
                              <Input placeholder="Driver name" {...field} className="h-9 text-sm" />
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
                            <FormLabel className="text-sm font-medium">Driver Mobile</FormLabel>
                            <FormControl>
                              <Input placeholder="0300-1234567" {...field} onChange={handleMobileChange} className="h-9 text-sm" />
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
                            <FormLabel className="text-sm font-medium">Driver CNIC</FormLabel>
                            <FormControl>
                              <Input placeholder="42201-1234567-8" {...field} onChange={handleCnicChange} className="h-9 text-sm" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  <FormField
                    control={form.control}
                    name="deliveryVanNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Vehicle No.</FormLabel>
                        <FormControl>
                          <Input placeholder="KHI-12345" {...field} className="h-9 text-sm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            {/* ── Item Details / Attachment ── */}
            <div>
              {/* Mode toggle — only shown when department allows either */}
              {effectiveInputMode === "either" && (
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-semibold text-neutral-gray uppercase tracking-wide">Entry Mode</p>
                  <div className="flex gap-1">
                    {(["items", "attachment"] as const).map(choice => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => setInputChoice(choice)}
                        className={cn(
                          "px-3 py-1 rounded-md border text-xs font-medium transition-all",
                          inputChoice === choice
                            ? "border-primary bg-primary text-white"
                            : "border-neutral-medium bg-white text-neutral-dark hover:border-primary/60"
                        )}
                      >
                        {choice === "items" ? "Add Item Details" : "Upload Attachment"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showItems && (
              <>
              <p className="text-xs font-semibold text-neutral-gray mb-2 uppercase tracking-wide">Item Details <span className="text-red-500">*</span></p>
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="w-full min-w-[780px]">
                  <thead>
                    <tr className="bg-neutral-light">
                      <th className="px-2 sm:px-4 py-1 sm:py-2 text-left text-xs sm:text-sm font-medium">Type</th>
                      <th className="px-2 sm:px-4 py-1 sm:py-2 text-left text-xs sm:text-sm font-medium">Item Name</th>
                      <th className="px-2 sm:px-4 py-1 sm:py-2 text-left text-xs sm:text-sm font-medium">Item Code</th>
                      <th className="px-2 sm:px-4 py-1 sm:py-2 text-left text-xs sm:text-sm font-medium w-16 sm:w-20 md:w-24">Quantity</th>
                      <th className="px-2 sm:px-4 py-1 sm:py-2 text-left text-xs sm:text-sm font-medium w-24 sm:w-28">Unit</th>
                      <th className="px-2 sm:px-4 py-1 sm:py-2 text-left text-xs sm:text-sm font-medium">Reason</th>
                      <th className="px-2 sm:px-4 py-1 sm:py-2 text-left text-xs sm:text-sm font-medium w-14 sm:w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const searchVal = itemSearch[index] || "";
                      const filteredIM = activeItemMaster.filter(im =>
                        im.name.toLowerCase().includes(searchVal.toLowerCase()) ||
                        (im.code || "").toLowerCase().includes(searchVal.toLowerCase())
                      );
                      return (
                        <tr key={field.id}>
                          <td className="px-2 sm:px-4 py-1 sm:py-2">
                            <Select
                              value={itemTypes[index] || "material"}
                              onValueChange={(v: "asset" | "material" | "other") => {
                                setItemTypes(prev => ({ ...prev, [index]: v }));
                                form.setValue(`items.${index}.itemType`, v);
                                if (v === "asset") {
                                  form.setValue(`items.${index}.quantity`, 1);
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs min-w-[90px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="material">Material</SelectItem>
                                <SelectItem value="asset">Asset</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-2 sm:px-4 py-1 sm:py-2">
                            <div className="flex gap-1 items-center">
                              {/* Item Master search popover — always visible */}
                              <Popover
                                open={!!itemSearchOpen[index]}
                                onOpenChange={(open) =>
                                  setItemSearchOpen(prev => ({ ...prev, [index]: open }))
                                }
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 flex-shrink-0 text-neutral-gray hover:text-primary"
                                    title="Search item master"
                                  >
                                    <Search size={14} />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 p-2" align="start">
                                  <Input
                                    placeholder="Search items..."
                                    value={searchVal}
                                    onChange={(e) =>
                                      setItemSearch(prev => ({ ...prev, [index]: e.target.value }))
                                    }
                                    className="mb-2 h-8 text-xs"
                                    autoFocus
                                  />
                                  <div className="max-h-48 overflow-y-auto space-y-1">
                                    {activeItemMaster.length === 0 ? (
                                      <p className="text-xs text-neutral-gray text-center py-4">
                                        No items in master list.<br />Type item details manually below.
                                      </p>
                                    ) : filteredIM.length === 0 ? (
                                      <p className="text-xs text-neutral-gray text-center py-2">No items match your search</p>
                                    ) : (
                                      filteredIM.map(im => (
                                        <div
                                          key={im.id}
                                          className="px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-xs"
                                          onClick={() => {
                                            form.setValue(`items.${index}.name`, im.name);
                                            form.setValue(`items.${index}.sku`, im.code || "");
                                            form.setValue(`items.${index}.unit`, im.unit || "");
                                            setItemSearchOpen(prev => ({ ...prev, [index]: false }));
                                            setItemSearch(prev => ({ ...prev, [index]: "" }));
                                          }}
                                        >
                                          <div className="font-medium">{im.name}</div>
                                          {im.code && <div className="text-neutral-gray">{im.code}{im.unit ? ` · ${im.unit}` : ""}</div>}
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                              <Input
                                {...form.register(`items.${index}.name`)}
                                placeholder="Item name"
                                className="w-full px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm"
                              />
                            </div>
                            {form.formState.errors.items?.[index]?.name && (
                              <p className="text-xs text-red-500 mt-1">
                                {form.formState.errors.items[index]?.name?.message}
                              </p>
                            )}
                          </td>
                          <td className="px-2 sm:px-4 py-1 sm:py-2">
                            <Input
                              {...form.register(`items.${index}.sku`)}
                              placeholder="Item code"
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
                              placeholder="Enter qty"
                              min="1"
                              disabled={itemTypes[index] === "asset"}
                              className={cn("w-full px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm", itemTypes[index] === "asset" && "bg-neutral-100")}
                            />
                            {form.formState.errors.items?.[index]?.quantity && (
                              <p className="text-xs text-red-500 mt-1">
                                {form.formState.errors.items[index]?.quantity?.message}
                              </p>
                            )}
                          </td>
                          <td className="px-2 sm:px-4 py-1 sm:py-2">
                            <Input
                              {...form.register(`items.${index}.unit`)}
                              placeholder="e.g. Pcs, KG"
                              className="w-full px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm"
                            />
                          </td>
                          <td className="px-2 sm:px-4 py-1 sm:py-2">
                            <Input
                              {...form.register(`items.${index}.reason`)}
                              placeholder="Reason for this item"
                              className="w-full px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm"
                            />
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-between items-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => append({ name: "", sku: "", quantity: 0, unit: "", itemType: "material" as const, reason: "" })}
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
              </>
              )}
            </div>

            {/* ── Notes ── */}
            <div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm sm:text-base font-medium">Additional Notes <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any extra remarks or comments..."
                        className="resize-none min-h-[80px] text-xs sm:text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ── Attach Documents ── */}
            <div className={cn("border rounded-md p-3", showAttachment && "border-primary/50 bg-primary/5")}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-neutral-gray uppercase tracking-wide">
                  Attach Documents{" "}
                  {showAttachment
                    ? <span className="text-red-500">*</span>
                    : <span className="font-normal normal-case">(Optional)</span>
                  }
                </p>
                <label htmlFor="dropzone-file" className="cursor-pointer">
                  <Button type="button" variant="outline" size="sm" className="text-xs h-7 px-2 flex items-center gap-1" asChild>
                    <span>
                      <span className="material-icons text-sm">attach_file</span>
                      Attach File
                    </span>
                  </Button>
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
              {uploadedFiles.length > 0 ? (
                <div className="space-y-1">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-neutral-lightest rounded px-2 py-1 text-sm">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="material-icons text-neutral-gray text-sm flex-shrink-0">description</span>
                        <span className="truncate text-xs">{file.name}</span>
                        <span className="text-xs text-neutral-gray flex-shrink-0">({file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)}KB` : `${(file.size / 1024 / 1024).toFixed(1)}MB`})</span>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveFile(index)} className="h-5 w-5 text-error flex-shrink-0">
                        <span className="material-icons text-sm">close</span>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-gray">No files attached. PDF, Images or Documents up to 7.5MB.</p>
              )}
            </div>

            {/* Form Buttons */}
            <div className="flex flex-wrap justify-end gap-2 pt-3 border-t">
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
                          unit: item.unit || "",
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
