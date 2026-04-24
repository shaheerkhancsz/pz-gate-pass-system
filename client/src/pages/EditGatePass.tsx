import React, { useState, useEffect } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/use-permissions";
import { CustomerSelection } from "@/components/gate-pass/CustomerSelection";
import { VendorSelection } from "@/components/gate-pass/VendorSelection";
import { DriverSelection } from "@/components/gate-pass/DriverSelection";
import { WorkflowActions } from "@/components/gate-pass/WorkflowActions";
import { formatCNIC, formatPhoneNumber, formatDate, formatDateTime, cn } from "@/lib/utils";
import { useDepartments } from "@/hooks/use-departments";
import { getStatusBadgeClass, getStatusLabel } from "@/components/ui/theme";
import { apiRequest } from "@/lib/queryClient";
import {
  type Driver, type GatePass, type Item, type ItemMaster,
  type Customer, type Vendor,
  gatePassWithItemsSchema,
} from "@shared/schema";
import { Link } from "wouter";
import { useKeyboardShortcuts, commonShortcuts } from "@/hooks/use-keyboard-shortcuts";

interface GateOption {
  id: number;
  name: string;
  plantId?: number | null;
  companyId: number;
  active: boolean;
}

interface PlantOption {
  id: number;
  name: string;
  companyId: number;
  active: boolean;
}

const MAIN_TYPES = [
  { value: "outward" as const, label: "Outward" },
  { value: "inward" as const, label: "Inward" },
];

// Relaxed driver validation — stored values may differ in formatting
const formSchema = gatePassWithItemsSchema.extend({
  date: z.string().min(1, "Date is required"),
  type: z.enum(["outward", "inward", "returnable"]).default("outward"),
  customerName: z.string().min(1, "Name is required"),
  customerPhone: z.string().optional(),
  customerId: z.number().optional().nullable(),
  deliveryAddress: z.string().optional(),
  driverName: z.string().optional().or(z.literal("")),
  driverMobile: z.string().optional().or(z.literal("")),
  driverCnic: z.string().optional().or(z.literal("")),
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
    sku: z.string().min(1, "Item code is required"),
    quantity: z.number().min(1, "Quantity must be at least 1"),
    unit: z.string().optional(),
    itemType: z.enum(["material", "asset", "other"]).default("material"),
    reason: z.string().optional(),
  })),
});

type FormValues = z.infer<typeof formSchema>;

export default function EditGatePass() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();

  const LOCKED_STATUSES = ["hod_approved", "approved", "security_allowed", "completed", "rejected", "force_closed"];
  const { data: departments = [] } = useDepartments();

  // Component state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [selectedPlantId, setSelectedPlantId] = useState<number | null>(null);
  const [driverExpanded, setDriverExpanded] = useState(false);
  const [mainType, setMainType] = useState<"outward" | "inward">("outward");
  const [partyType, setPartyType] = useState<"customer" | "vendor" | "employee">("customer");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [itemSearchOpen, setItemSearchOpen] = useState<Record<number, boolean>>({});
  const [itemSearch, setItemSearch] = useState<Record<number, string>>({});
  const [itemTypes, setItemTypes] = useState<Record<number, "asset" | "material" | "other">>({});
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [inputChoice, setInputChoice] = useState<"items" | "attachment">("items");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      type: "outward",
      customerName: "",
      customerPhone: "",
      customerId: 0,
      driverName: "",
      driverMobile: "",
      driverCnic: "",
      driverId: 0,
      deliveryVanNumber: "",
      allowTo: "",
      deliveryAddress: "",
      reason: "",
      notes: "",
      department: isAdmin ? "" : user?.department || "",
      status: "pending",
      createdBy: user?.fullName || "",
      createdById: user?.id || 0,
      items: [{ name: "", sku: "", quantity: 1, unit: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const passType = form.watch("type");

  // Fetch gate pass data
  const { data, isLoading } = useQuery<GatePass & { items: Item[] }>({
    queryKey: ["/api/gate-passes", id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/gate-passes/${id}`);
      return response.json();
    },
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const effectiveCompanyId = (data as any)?.companyId ?? user?.companyId;

  // Fetch plants for the gate pass's company
  const { data: allPlants = [] } = useQuery<PlantOption[]>({
    queryKey: ["plants", effectiveCompanyId],
    queryFn: () =>
      fetch(`/api/plants?companyId=${effectiveCompanyId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!effectiveCompanyId,
  });
  const plantsForCompany = allPlants.filter(p => p.active !== false);

  // Fetch gates (filtered by plant when one is selected)
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

  // Fetch DB departments (all users — needed for input mode config)
  const { data: dbDepartments = [] } = useQuery<{ id: number; name: string; active: boolean; itemInputMode?: string }[]>({
    queryKey: ["departments", effectiveCompanyId],
    queryFn: () =>
      fetch(`/api/departments?companyId=${effectiveCompanyId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!effectiveCompanyId,
  });
  const deptOptions = dbDepartments.filter(d => d.active !== false);

  // Derive input mode from the gate pass's department
  const currentDeptName = (data as any)?.department ?? user?.department;
  const currentDeptRecord = dbDepartments.find(d => d.name === currentDeptName);
  const effectiveInputMode = (currentDeptRecord?.itemInputMode ?? "items") as "items" | "attachment" | "either";
  const showItems = effectiveInputMode === "items" || (effectiveInputMode === "either" && inputChoice === "items");
  const showAttachment = effectiveInputMode === "attachment" || (effectiveInputMode === "either" && inputChoice === "attachment");

  // Fetch item master
  const { data: itemMasterList = [] } = useQuery<ItemMaster[]>({
    queryKey: ["item-master", effectiveCompanyId],
    queryFn: () =>
      fetch(`/api/item-master?companyId=${effectiveCompanyId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!effectiveCompanyId,
  });
  const activeItemMaster = itemMasterList.filter(im => im.active !== false);

  // Fetch employees for employee party type
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

  // Normalize ISO timestamps to YYYY-MM-DD for <input type="date">
  const toDateStr = (val: any) => (val ? String(val).split("T")[0] : "");

  // Populate form once data arrives
  useEffect(() => {
    if (!data) return;
    setSelectedCustomer((data as any).customer ?? null);
    setSelectedVendor(null);
    setSelectedDriver((data as any).driver ?? null);

    const loadedType: "outward" | "inward" | "returnable" = (data as any).type ?? "outward";
    setMainType(loadedType === "inward" ? "inward" : "outward");

    const loadedPlantId = (data as any).plantId ?? null;
    setSelectedPlantId(loadedPlantId);

    // Auto-expand driver section if driver data exists
    if ((data as any).driverName || (data as any).driverId) {
      setDriverExpanded(true);
    }

    // Restore itemTypes state from loaded items
    const loadedItemTypes: Record<number, "asset" | "material" | "other"> = {};
    (data.items ?? []).forEach((item: Item, i: number) => {
      loadedItemTypes[i] = (((item as any).itemType) as "asset" | "material" | "other") ?? "material";
    });
    setItemTypes(loadedItemTypes);

    form.reset({
      type: loadedType,
      date: toDateStr(data.date),
      companyId: (data as any).companyId ?? undefined,
      gateId: (data as any).gateId ?? null,
      plantId: loadedPlantId,
      customerName: (data as any).customerName ?? "",
      customerPhone: (data as any).customerPhone ?? "",
      customerId: (data as any).customerId ?? undefined,
      deliveryAddress: (data as any).deliveryAddress ?? "",
      allowTo: (data as any).allowTo ?? "",
      driverId: (data as any).driverId ?? undefined,
      driverName: (data as any).driverName ?? "",
      driverMobile: (data as any).driverMobile ?? "",
      driverCnic: (data as any).driverCnic ?? "",
      deliveryVanNumber: (data as any).deliveryVanNumber ?? "",
      department: data.department ?? "",
      reason: (data as any).reason ?? "",
      notes: (data as any).notes ?? "",
      status: data.status ?? "pending",
      createdBy: (data as any).createdBy ?? "",
      createdById: (data as any).createdById ?? 0,
      expectedReturnDate: (data as any).expectedReturnDate ? toDateStr((data as any).expectedReturnDate) : null,
      actualReturnDate: (data as any).actualReturnDate ? toDateStr((data as any).actualReturnDate) : null,
      items: (data.items ?? []).map((item: Item) => ({
        name: item.name ?? "",
        sku: item.sku ?? "",
        quantity: item.quantity ?? 1,
        unit: (item as any).unit ?? "",
        itemType: ((item as any).itemType as "material" | "asset" | "other") ?? "material",
        reason: (item as any).reason ?? "",
      })),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Mutation to update gate pass
  const updateGatePassMutation = useMutation({
    mutationFn: async (formData: FormValues) => {
      const response = await apiRequest("PATCH", `/api/gate-passes/${id}`, {
        ...formData,
        customerId: formData.customerId || undefined,
        driverId: formData.driverId || undefined,
        user,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update gate pass");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gate-passes"] });
      queryClient.invalidateQueries({ queryKey: [`/api/gate-passes/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
      toast({ title: "Success", description: "Gate pass updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update gate pass", variant: "destructive" });
    },
  });

  const onSubmit = async (formData: FormValues) => {
    try {
      const updatedGatePass = await updateGatePassMutation.mutateAsync(formData);

      if (uploadedFiles.length > 0) {
        setIsUploading(true);
        let uploadErrors = false;
        try {
          for (const file of uploadedFiles) {
            const fileData = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === "string") resolve(reader.result);
                else reject(new Error("Failed to convert file to base64"));
              };
              reader.onerror = () => reject(new Error("Error reading file"));
              reader.readAsDataURL(file);
            });
            await apiRequest("POST", "/api/documents", {
              entityType: "gatePass",
              entityId: updatedGatePass.id,
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              fileData,
              description: null,
              uploadedBy: user?.id || null,
              uploadedByEmail: user?.email || "unknown",
            });
          }
        } catch (error) {
          console.error("Error uploading documents:", error);
          uploadErrors = true;
          toast({ title: "Warning", description: "Gate pass saved but some documents failed to upload", variant: "destructive" });
        } finally {
          setIsUploading(false);
        }
        if (!uploadErrors) navigate("/gate-passes");
      } else {
        navigate("/gate-passes");
      }
    } catch {
      // Error handled by mutation's onError
    }
  };

  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    form.setValue("customerName", customer.name);
    form.setValue("customerPhone", customer.phone || "");
    form.setValue("customerId", customer.id || 0);
    if (customer.address) form.setValue("deliveryAddress", customer.address);
  };
  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    form.setValue("customerName", "");
    form.setValue("customerPhone", "");
    form.setValue("customerId", 0);
  };

  const handleSelectVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    form.setValue("customerName", vendor.name);
    form.setValue("customerPhone", vendor.phone || "");
    if (vendor.address) form.setValue("deliveryAddress", vendor.address);
  };
  const handleClearVendor = () => {
    setSelectedVendor(null);
    form.setValue("customerName", "");
    form.setValue("customerPhone", "");
  };

  const handleSelectDriver = (driver: Driver) => {
    setSelectedDriver(driver);
    form.setValue("driverName", driver.name);
    form.setValue("driverMobile", driver.mobile);
    form.setValue("driverCnic", driver.cnic);
    form.setValue("driverId", driver.id || 0);
    if (driver.vehicleNumber) form.setValue("deliveryVanNumber", driver.vehicleNumber);
  };
  const handleClearDriver = () => {
    setSelectedDriver(null);
    form.setValue("driverName", "");
    form.setValue("driverMobile", "");
    form.setValue("driverCnic", "");
    form.setValue("driverId", 0);
    form.setValue("deliveryVanNumber", "");
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    const newFiles = Array.from(files).filter(file => {
      if (file.size > 7.5 * 1024 * 1024) {
        toast({ title: "File too large", description: `${file.name} is larger than 7.5MB`, variant: "destructive" });
        return false;
      }
      return true;
    });
    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  useKeyboardShortcuts([
    { ...commonShortcuts.save, action: () => form.handleSubmit(onSubmit)() },
    { ...commonShortcuts.cancel, action: () => navigate("/gate-passes") },
    {
      ...commonShortcuts.print,
      action: () => { if (data) window.open(`/print-gate-pass/${data.id}`, "_blank"); },
    },
    commonShortcuts.help,
  ]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-lg font-medium text-error mb-4">Gate pass not found</p>
          <Button asChild variant="outline"><Link href="/gate-passes">Back to Gate Passes</Link></Button>
        </div>
      </AppLayout>
    );
  }

  const isLocked = !isAdmin && LOCKED_STATUSES.includes(data.status);

  if (isLocked) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl sm:text-2xl font-bold">Gate Pass {data.gatePassNumber}</h1>
            <Button asChild variant="outline"><Link href="/gate-passes">Back to Gate Passes</Link></Button>
          </div>
          <div className="mb-4 p-4 rounded-md border border-yellow-300 bg-yellow-50 flex items-start gap-2">
            <span className="material-icons text-yellow-600 mt-0.5">lock</span>
            <div>
              <p className="text-sm font-medium text-yellow-800">This gate pass is locked for editing</p>
              <p className="text-sm text-yellow-700">
                Current status:{" "}
                <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadgeClass(data.status)}`}>
                  {getStatusLabel(data.status)}
                </span>
                {" "}— editing is disabled once approved by HOD or beyond.
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
            <Button asChild variant="outline"><Link href={`/view-gate-pass/${data.id}`}>View Gate Pass Details</Link></Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Edit Gate Pass</h1>
            {data.gatePassNumber && (
              <p className="text-sm text-muted-foreground mt-0.5">{data.gatePassNumber}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(data.status)}`}>
              {getStatusLabel(data.status)}
            </span>
            <Button asChild variant="outline" size="sm">
              <Link href="/gate-passes">Back</Link>
            </Button>
          </div>
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

        <Card className="bg-white rounded-lg shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit, (errors) => {
                  console.error("Validation errors:", errors);
                  const firstError = Object.values(errors)[0] as any;
                  const message = firstError?.message || firstError?.root?.message || "Please fix the form errors";
                  toast({ title: "Please fix the form errors", description: message, variant: "destructive" });
                })}
                className="space-y-4"
              >
                {/* ── Row 1: Pass Type + Status (admin) ── */}
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

                  {/* Status — admin only */}
                  {isAdmin && (
                    <div className="min-w-[160px]">
                      <p className="text-xs font-semibold text-neutral-gray mb-1.5 uppercase tracking-wide">Status</p>
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="sent_back">Sent Back</SelectItem>
                              <SelectItem value="hod_approved">HOD Approved</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="security_allowed">Security Allowed</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  )}

                  {/* Created info (read-only) */}
                  <div className="text-xs text-neutral-500 self-end pb-1">
                    <span className="font-medium">Created by:</span> {(data as any).createdBy}
                    {data.createdAt && <span className="ml-2">{formatDateTime(data.createdAt)}</span>}
                  </div>
                </div>

                {/* ── Main Fields Grid ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-3">

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
                              {(deptOptions.length > 0 ? deptOptions : departments).map((dept) => (
                                <SelectItem key={dept.id} value={dept.name}>
                                  {dept.name}
                                </SelectItem>
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
                        <FormLabel className="text-sm font-medium">
                          Allow To <span className="text-neutral-gray text-xs font-normal">(Optional)</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Person carrying the goods"
                            {...field}
                            value={field.value ?? ""}
                            className="h-9 text-sm"
                          />
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

                  {/* Actual Return Date — returnable only */}
                  {passType === "returnable" && (
                    <FormField
                      control={form.control}
                      name="actualReturnDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">
                            Actual Return Date <span className="text-neutral-gray text-xs font-normal">(Optional)</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="date"
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

                  {/* Party Type + Selection */}
                  <div className="sm:col-span-2 lg:col-span-3 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-neutral-gray mb-1.5 uppercase tracking-wide">Party Type <span className="text-red-500">*</span></p>
                      <div className="flex gap-2">
                        {(["customer", "vendor", "employee"] as const).map((pt) => (
                          <button
                            key={pt}
                            type="button"
                            onClick={() => {
                              setPartyType(pt);
                              setSelectedCustomer(null);
                              setSelectedVendor(null);
                              setSelectedEmployee(null);
                              setEmployeeSearch("");
                              form.setValue("customerName", "");
                              form.setValue("customerPhone", "");
                            }}
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
                                        value={field.value ?? ""}
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
                                        value={field.value ?? ""}
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
                          {passType === "inward" ? "Source / Pickup Address" : "Delivery Address"}
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={passType === "inward" ? "Enter source address" : "Enter delivery address"}
                            className="resize-none h-[52px] text-sm"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* ── Driver Details — collapsible ── */}
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
                                <FormLabel className="text-sm font-medium">
                                  {passType === "inward" ? "Carrier Name" : "Driver Name"}
                                </FormLabel>
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
                                  <Input
                                    placeholder="0300-1234567"
                                    {...field}
                                    onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))}
                                    className="h-9 text-sm"
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
                                <FormLabel className="text-sm font-medium">Driver CNIC</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="42201-1234567-8"
                                    {...field}
                                    onChange={(e) => field.onChange(formatCNIC(e.target.value))}
                                    className="h-9 text-sm"
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
                  <p className="text-xs font-semibold text-neutral-gray mb-2 uppercase tracking-wide">
                    Item Details <span className="text-red-500">*</span>
                  </p>
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
                                    if (v === "asset") form.setValue(`items.${index}.quantity`, 1);
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
                                            No items in master list.<br />Type item details manually.
                                          </p>
                                        ) : filteredIM.length === 0 ? (
                                          <p className="text-xs text-neutral-gray text-center py-2">No items match</p>
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
                                              {im.code && (
                                                <div className="text-neutral-gray">{im.code}{im.unit ? ` · ${im.unit}` : ""}</div>
                                              )}
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
                                  {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                                  type="number"
                                  placeholder="Qty"
                                  min="1"
                                  disabled={itemTypes[index] === "asset"}
                                  className={cn(
                                    "w-full px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm",
                                    itemTypes[index] === "asset" && "bg-neutral-100"
                                  )}
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
                      onClick={() => append({ name: "", sku: "", quantity: 1, unit: "", itemType: "material" as const, reason: "" })}
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
                          <span className="text-neutral-dark">Total Qty:</span>{" "}
                          <span className="font-bold">
                            {fields.reduce((sum, _, i) => {
                              const q = form.getValues(`items.${i}.quantity`);
                              return sum + (Number.isNaN(Number(q)) ? 0 : Number(q));
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
                        <FormLabel className="text-sm font-medium">
                          Additional Notes <span className="text-muted-foreground font-normal">(optional)</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Any extra remarks or comments..."
                            className="resize-none min-h-[80px] text-xs sm:text-sm"
                            {...field}
                            value={field.value ?? ""}
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
                      Attach New Documents{" "}
                      {showAttachment
                        ? <span className="text-red-500">*</span>
                        : <span className="font-normal normal-case">(Optional)</span>
                      }
                    </p>
                    <label htmlFor="edit-dropzone-file" className="cursor-pointer">
                      <Button type="button" variant="outline" size="sm" className="text-xs h-7 px-2 flex items-center gap-1" asChild>
                        <span>
                          <span className="material-icons text-sm">attach_file</span>
                          Attach File
                        </span>
                      </Button>
                      <input
                        id="edit-dropzone-file"
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
                    <p className="text-xs text-neutral-gray">No new files attached. PDF, Images or Documents up to 7.5MB.</p>
                  )}
                </div>

                {/* Form Buttons */}
                <div className="flex flex-wrap justify-end gap-2 pt-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/gate-passes")}
                    className="text-xs sm:text-sm h-9 sm:h-10 px-4"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.open(`/print-gate-pass/${data.id}`, "_blank")}
                    className="text-xs sm:text-sm h-9 sm:h-10 px-4"
                  >
                    <span className="material-icons text-sm mr-1">print</span>
                    Print
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateGatePassMutation.isPending || isUploading}
                    className="text-xs sm:text-sm h-9 sm:h-10 px-4 bg-primary hover:bg-primary/90 text-white"
                  >
                    <span className="material-icons text-sm mr-1">save</span>
                    {updateGatePassMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Workflow Actions (below the form card) */}
        <div className="mt-4">
          <WorkflowActions gatePass={data} />
        </div>
      </div>
    </AppLayout>
  );
}
