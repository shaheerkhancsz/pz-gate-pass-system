import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InsertUser, insertUserSchema } from "@shared/schema";
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

// Define Role interface
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

// Extend the schema with additional validation
const formSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email address").endsWith("@parazelsus.pk", {
    message: "Email must be a company email ending with @parazelsus.pk",
  }),
  roleId: z.coerce.number({
    required_error: "Role is required",
    invalid_type_error: "Role must be a number"
  }),
  companyId: z.coerce.number().optional(),
  phoneNumber: z.string().optional().default(""),
  cnic: z.string().optional().default(""),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof formSchema>;

interface EmployeeFormProps {
  onSuccess?: () => void;
}

export function EmployeeForm({ onSuccess }: EmployeeFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available roles
  const { data: roles } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/roles");
      return response.json();
    }
  });

  // Fetch available companies
  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/companies");
      return response.json();
    }
  });

  // Fetch departments dynamically
  const { data: departments = [] } = useDepartments();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      phoneNumber: "",
      department: "",
      division: "",
      roleId: 0,
      companyId: undefined,
      cnic: "",
    },
  });

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

  // CNIC and phone formatting
  const handleCnicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedCnic = formatCNIC(e.target.value);
    form.setValue("cnic", formattedCnic);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedPhone = formatPhoneNumber(e.target.value);
    form.setValue("phoneNumber", formattedPhone);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="space-y-1 border-b pb-4">
        <CardTitle className="text-2xl font-semibold">Edit Employee</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel className="font-semibold">Full Name</FormLabel>
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

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel className="font-semibold">Email ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="example@parazelsus.pk"
                        {...field}
                        className="h-10 px-3 rounded-md border"
                      />
                    </FormControl>
                    <FormMessage className="text-sm text-red-500" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel className="font-semibold">Phone Number</FormLabel>
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

              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel className="font-semibold">Department</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 px-3 rounded-md border">
                          <SelectValue placeholder="Select Department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem
                            key={dept.id}
                            value={dept.name}
                            className="cursor-pointer hover:bg-gray-100"
                          >
                            {dept.name}{dept.description ? ` — ${dept.description}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-sm text-red-500" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="division"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel className="font-semibold">Division <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Sales Division"
                        {...field}
                        value={field.value ?? ""}
                        className="h-10 px-3 rounded-md border"
                      />
                    </FormControl>
                    <FormMessage className="text-sm text-red-500" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="roleId"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel className="font-semibold">Role</FormLabel>
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
                          <SelectItem
                            key={role.id}
                            value={role.id.toString()}
                            className="cursor-pointer hover:bg-gray-100"
                          >
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-sm text-red-500" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel className="font-semibold">Company</FormLabel>
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
                          <SelectItem
                            key={company.id}
                            value={company.id.toString()}
                            className="cursor-pointer hover:bg-gray-100"
                          >
                            {company.name} {company.shortName ? `(${company.shortName})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-sm text-red-500" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cnic"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel className="font-semibold">CNIC</FormLabel>
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

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel className="font-semibold">Password</FormLabel>
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

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel className="font-semibold">Confirm Password</FormLabel>
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
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createUserMutation.isPending}
                className="px-6 bg-primary text-white hover:bg-primary/90"
              >
                {createUserMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
