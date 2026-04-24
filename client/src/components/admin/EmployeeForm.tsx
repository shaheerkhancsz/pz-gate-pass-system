import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { formatCNIC, formatPhoneNumber } from "@/lib/utils";
import { useDepartments } from "@/hooks/use-departments";
import { z } from "zod";

interface Role {
  id: number;
  name: string;
  description?: string;
}

interface Company {
  id: number;
  name: string;
  shortName?: string;
  active?: boolean;
}

const formSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email address"),
  roleId: z.coerce.number({
    required_error: "Role is required",
    invalid_type_error: "Role must be a number"
  }),
  companyId: z.coerce.number({
    required_error: "Company is required",
    invalid_type_error: "Company must be a number"
  }),
  department: z.string().min(1, "Department is required"),
  divisionCategory: z.string().optional().default(""),
  division: z.string().optional().default(""),
  sapEmployeeCode: z.string().min(1, "Employee code is required"),
  phoneNumber: z.string().optional().default(""),
  cnic: z.string().optional().default(""),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof formSchema>;

interface EmployeeFormProps {
  onSuccess?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function EmployeeForm({ onSuccess, onDirtyChange }: EmployeeFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: roles } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/roles");
      return response.json();
    }
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/companies");
      return response.json();
    }
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      roleId: 0,
      companyId: undefined,
      department: "",
      divisionCategory: "",
      division: "",
      sapEmployeeCode: "",
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      phoneNumber: "",
      cnic: "",
    },
  });

  const selectedCompanyId = form.watch("companyId");

  // Fetch departments filtered by selected company
  const { data: departments = [] } = useDepartments(
    selectedCompanyId && selectedCompanyId > 0 ? selectedCompanyId : null
  );

  // Reset department when company changes
  useEffect(() => {
    form.setValue("department", "");
  }, [selectedCompanyId]);

  // Unsaved changes prompt (browser refresh / tab close)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (form.formState.isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [form.formState.isDirty]);

  // Notify parent when dirty state changes (for tab-switch guard)
  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty]);

  const createUserMutation = useMutation({
    mutationFn: async (data: Omit<FormData, "confirmPassword">) => {
      const { confirmPassword, ...userData } = data as any;
      const response = await apiRequest("POST", "/api/users", userData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Employee has been successfully registered",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      form.reset();
      onDirtyChange?.(false);
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to register employee",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    const { confirmPassword, ...userData } = data;
    createUserMutation.mutate(userData);
  };

  const handleCnicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setValue("cnic", formatCNIC(e.target.value));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setValue("phoneNumber", formatPhoneNumber(e.target.value));
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="space-y-1 border-b pb-4">
        <CardTitle className="text-2xl font-semibold">Register Employee</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">

              {/* 1. Role */}
              <FormField
                control={form.control}
                name="roleId"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel className="font-semibold">Role <span className="text-red-500">*</span></FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 px-3 rounded-md border">
                          <SelectValue placeholder="Select Role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles?.map((role) => (
                          <SelectItem key={role.id} value={role.id.toString()}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-sm text-red-500" />
                  </FormItem>
                )}
              />

              {/* 2. Company */}
              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel className="font-semibold">Company <span className="text-red-500">*</span></FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 px-3 rounded-md border">
                          <SelectValue placeholder="Select Company" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companies?.filter(c => c.active !== false).map((company) => (
                          <SelectItem key={company.id} value={company.id.toString()}>
                            {company.name}{company.shortName ? ` (${company.shortName})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-sm text-red-500" />
                  </FormItem>
                )}
              />

              {/* 3. Department (filtered by company) */}
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel className="font-semibold">Department <span className="text-red-500">*</span></FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!selectedCompanyId || selectedCompanyId <= 0}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 px-3 rounded-md border">
                          <SelectValue placeholder={selectedCompanyId && selectedCompanyId > 0 ? "Select Department" : "Select company first"} />
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
                    <FormMessage className="text-sm text-red-500" />
                  </FormItem>
                )}
              />

              {/* 4. Division Category (optional) */}
              <FormField
                control={form.control}
                name="divisionCategory"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel className="font-semibold">Division Category <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Div A"
                        {...field}
                        value={field.value ?? ""}
                        className="h-10 px-3 rounded-md border"
                      />
                    </FormControl>
                    <FormMessage className="text-sm text-red-500" />
                  </FormItem>
                )}
              />

              {/* 5. Division (optional) */}
              <FormField
                control={form.control}
                name="division"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel className="font-semibold">Division <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Gynae-A"
                        {...field}
                        value={field.value ?? ""}
                        className="h-10 px-3 rounded-md border"
                      />
                    </FormControl>
                    <FormMessage className="text-sm text-red-500" />
                  </FormItem>
                )}
              />

              {/* 6. Employee Code */}
              <FormField
                control={form.control}
                name="sapEmployeeCode"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel className="font-semibold">Employee Code <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. EMP-0001"
                        {...field}
                        value={field.value ?? ""}
                        className="h-10 px-3 rounded-md border"
                      />
                    </FormControl>
                    <FormMessage className="text-sm text-red-500" />
                  </FormItem>
                )}
              />

              {/* 7. Full Name */}
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel className="font-semibold">Full Name <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter full name"
                        {...field}
                        className="h-10 px-3 rounded-md border"
                      />
                    </FormControl>
                    <FormMessage className="text-sm text-red-500" />
                  </FormItem>
                )}
              />

              {/* 8. Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel className="font-semibold">Email <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input
                        placeholder="example@agp.com.pk"
                        {...field}
                        className="h-10 px-3 rounded-md border"
                      />
                    </FormControl>
                    <FormMessage className="text-sm text-red-500" />
                  </FormItem>
                )}
              />

              {/* Phone (optional) */}
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel className="font-semibold">Phone Number <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. 0300-1234567"
                        {...field}
                        value={field.value ?? ""}
                        onChange={handlePhoneChange}
                        className="h-10 px-3 rounded-md border"
                      />
                    </FormControl>
                    <FormMessage className="text-sm text-red-500" />
                  </FormItem>
                )}
              />

              {/* CNIC (optional) */}
              <FormField
                control={form.control}
                name="cnic"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel className="font-semibold">CNIC <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. 42201-1234567-9"
                        {...field}
                        value={field.value ?? ""}
                        onChange={handleCnicChange}
                        className="h-10 px-3 rounded-md border"
                      />
                    </FormControl>
                    <FormMessage className="text-sm text-red-500" />
                  </FormItem>
                )}
              />

              {/* Password */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel className="font-semibold">Password <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter password"
                        {...field}
                        className="h-10 px-3 rounded-md border"
                      />
                    </FormControl>
                    <FormMessage className="text-sm text-red-500" />
                  </FormItem>
                )}
              />

              {/* Confirm Password */}
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel className="font-semibold">Confirm Password <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Confirm password"
                        {...field}
                        className="h-10 px-3 rounded-md border"
                      />
                    </FormControl>
                    <FormMessage className="text-sm text-red-500" />
                  </FormItem>
                )}
              />

            </div>

            <div className="flex justify-end space-x-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset()}
                className="px-6"
              >
                Reset
              </Button>
              <Button
                type="submit"
                disabled={createUserMutation.isPending}
                className="px-6 bg-primary text-white hover:bg-primary/90"
              >
                {createUserMutation.isPending ? "Registering..." : "Register Employee"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
