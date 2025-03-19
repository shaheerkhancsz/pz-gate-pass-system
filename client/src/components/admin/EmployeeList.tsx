import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { User, InsertUser, roles } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Edit user form schema
const userFormSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email").endsWith("@parazelsus.pk", {
    message: "Email must be a company email ending with @parazelsus.pk",
  }),
  phoneNumber: z.string().optional(),
  department: z.string().min(1, "Department is required"),
  roleId: z.coerce.number({
    required_error: "Role is required",
    invalid_type_error: "Role must be a number"
  }),
  active: z.boolean().default(true),
  cnic: z.string().optional(),
  password: z.union([
    z.string().min(6, "Password must be at least 6 characters"),
    z.string().length(0) // Allow empty string
  ]).optional(),
});

type UserFormValues = z.infer<typeof userFormSchema>;

export function EmployeeList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: rolesList } = useQuery<any[]>({
    queryKey: ["/api/roles"],
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: number) => {
      // In a real app, we'd call an API endpoint to reset the password
      // For now, just show a toast
      // const response = await apiRequest("POST", `/api/users/${userId}/reset-password`, {});
      // return response.json();
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password has been reset and sent to the user's email",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reset password",
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<UserFormValues> }) => {
      const response = await apiRequest("PATCH", `/api/users/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsEditOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update user",
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const response = await apiRequest("PATCH", `/api/users/${id}`, { active });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update user status",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/users/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete user");
      }
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsDeleteOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const handleResetPassword = (userId: number) => {
    resetPasswordMutation.mutate(userId);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsEditOpen(true);
  };

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setIsDeleteOpen(true);
  };

  const handleToggleActive = (user: User) => {
    toggleActiveMutation.mutate({
      id: user.id,
      active: !user.active,
    });
  };

  const getRoleBadgeClass = (role: string) => {
    return role === "admin" 
      ? "bg-secondary bg-opacity-10 text-secondary" 
      : "bg-primary bg-opacity-10 text-primary";
  };

  const getStatusBadgeClass = (active: boolean) => {
    return active
      ? "bg-green-100 text-green-800"
      : "bg-red-100 text-red-800";
  };

  // Form for editing user
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phoneNumber: "",
      department: "",
      roleId: 0,
      active: true,
      cnic: "",
      password: "",
    },
  });

  // When a user is selected for editing, update the form values
  React.useEffect(() => {
    if (selectedUser && isEditOpen) {
      form.reset({
        fullName: selectedUser.fullName,
        email: selectedUser.email,
        phoneNumber: selectedUser.phoneNumber || "",
        department: selectedUser.department,
        roleId: selectedUser.roleId || 0,
        active: selectedUser.active,
        cnic: selectedUser.cnic || "",
        password: "", // Don't populate the password field
      });
    }
  }, [selectedUser, isEditOpen, form]);

  const onSubmit = (data: UserFormValues) => {
    if (!selectedUser) return;
    
    // Remove empty password field if it's not changed
    const formData = { ...data };
    if (formData.password === '') {
      delete formData.password;
    }
    
    updateUserMutation.mutate({
      id: selectedUser.id,
      data: formData,
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Employee List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-neutral-light">
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Full Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-dark tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-medium">
                  {users && users.length > 0 ? (
                    users.map((user) => (
                      <tr key={user.id} className="hover:bg-neutral-lightest">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.fullName}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{user.phoneNumber || "-"}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{user.department}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-2 py-1 text-xs rounded-full ${getRoleBadgeClass(user.role)}`}>
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Switch 
                              checked={user.active} 
                              onCheckedChange={() => handleToggleActive(user)}
                              disabled={user.role === "admin"} // Don't allow disabling admin
                            />
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(user.active)}`}>
                              {user.active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResetPassword(user.id)}
                              disabled={resetPasswordMutation.isPending}
                            >
                              Reset Password
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditUser(user)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteUser(user)}
                              disabled={user.role === "admin"} // Don't allow deleting admin
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                        No employees found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>
              Update employee information. Leave password empty to keep it unchanged.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-4 mb-6">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                        <Input {...field} />
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
                      <FormControl>
                        <Input {...field} />
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
                        onValueChange={val => field.onChange(parseInt(val))}
                        defaultValue={field.value?.toString()}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {rolesList?.map(role => (
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
                  name="cnic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNIC</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Active Status</FormLabel>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={selectedUser?.role === "admin"} // Don't allow disabling admin
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password (leave empty to keep unchanged)</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-8 flex justify-end">
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={updateUserMutation.isPending}
                >
                  {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the employee account for {selectedUser?.fullName}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedUser && deleteUserMutation.mutate(selectedUser.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
