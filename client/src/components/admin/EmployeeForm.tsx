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
import { departmentOptions, formatCNIC, formatPhoneNumber } from "@/lib/utils";
import { z } from "zod";

// Define Role interface
interface Role {
  id: number;
  name: string;
  description?: string;
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

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      phoneNumber: "",
      department: "",
      roleId: 0,
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
    <Card>
      <CardHeader>
        <CardTitle>Register New Employee</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email ID</FormLabel>
                    <FormControl>
                      <Input placeholder="example@parazelsus.pk" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. 0300-1234567"
                        {...field}
                        value={field.value ?? ""}
                        onChange={handlePhoneChange}
                      />
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
                    <FormLabel>Department</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Department" />
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cnic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNIC</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. 42201-1234567-8"
                        {...field}
                        value={field.value ?? ""}
                        onChange={handleCnicChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="roleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString() || undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles?.map((role: Role) => (
                          <SelectItem key={role.id} value={role.id.toString()}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Create a password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Confirm password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                className="bg-primary hover:bg-primary-dark"
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? (
                  <>
                    <span className="mr-2 animate-spin">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                      </svg>
                    </span>
                    Registering...
                  </>
                ) : (
                  <>Register Employee</>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
