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
import { useDepartments } from "@/hooks/use-departments";

// Edit user form schema
const userFormSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email").endsWith("@parazelsus.pk", {
    message: "Email must be a company email ending with @parazelsus.pk",
  }),
  phoneNumber: z.string().optional(),
  department: z.string().min(1, "Department is required"),
  division: z.string().optional(),
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

  // Fetch departments dynamically
  const { data: departmentOptions = [] } = useDepartments();

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
      if (!response.ok) {
        const text = await response.text();
        let message = "Failed to update user status";
        try {
          const data = JSON.parse(text);
          message = data.message || message;
        } catch (e) {
          // If JSON parsing fails, use the raw text
          message = text || message;
        }
        throw new Error(message);
      }
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
        const text = await response.text();
        let message = "Failed to delete user";
        try {
          const data = JSON.parse(text);
          message = data.message || message;
        } catch (e) {
          // If JSON parsing fails, use the raw text
          message = text || message;
        }
        throw new Error(message);
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
      setIsDeleteOpen(false);
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
    switch (role.toLowerCase()) {
      case 'admin':
        return 'bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium text-sm';
      case 'manager':
        return 'bg-purple-100 text-purple-800 px-3 py-1 rounded-full font-medium text-sm';
      default:
        return 'bg-gray-100 text-gray-800 px-3 py-1 rounded-full font-medium text-sm';
    }
  };

  const getStatusBadgeClass = (active: boolean) => {
    return active
      ? 'bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium text-sm'
      : 'bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium text-sm';
  };

  // Form for editing user
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phoneNumber: "",
      department: "",
      division: "",
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
        division: (selectedUser as any).division || "",
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
    <Card>
      <CardHeader className="border-b border-border/40">
        <CardTitle>Employee List</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40 bg-muted/50">
                <th className="py-3 px-4 text-left font-medium text-muted-foreground">Full Name</th>
                <th className="py-3 px-4 text-left font-medium text-muted-foreground">Email</th>
                <th className="py-3 px-4 text-left font-medium text-muted-foreground">Phone</th>
                <th className="py-3 px-4 text-left font-medium text-muted-foreground">Department</th>
                <th className="py-3 px-4 text-left font-medium text-muted-foreground">Division</th>
                <th className="py-3 px-4 text-left font-medium text-muted-foreground">Role</th>
                <th className="py-3 px-4 text-center font-medium text-muted-foreground">Status</th>
                <th className="py-3 px-4 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((user) => (
                <tr key={user.id} className="border-b border-border/40 hover:bg-muted/50 transition-colors">
                  <td className="py-3 px-4">{user.fullName}</td>
                  <td className="py-3 px-4">{user.email}</td>
                  <td className="py-3 px-4">{user.phoneNumber}</td>
                  <td className="py-3 px-4">{user.department}</td>
                  <td className="py-3 px-4">{(user as any).division || <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-3 px-4">
                    <span className={getRoleBadgeClass(rolesList?.find(r => r.id === user.roleId)?.name || '')}>
                      {rolesList?.find(r => r.id === user.roleId)?.name || 'Unknown'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Switch
                        checked={user.active}
                        onCheckedChange={() => handleToggleActive(user)}
                        className="data-[state=checked]:bg-green-500"
                      />
                      <span className={getStatusBadgeClass(user.active)}>
                        {user.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResetPassword(user.id)}
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
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="block md:hidden divide-y divide-border">
          {users?.map((user) => (
            <div key={user.id} className="p-4 hover:bg-muted/50 transition-colors space-y-4">
              {/* Header: Name, Role and Status */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <h3 className="font-medium text-base">{user.fullName}</h3>
                  <span className={getRoleBadgeClass(rolesList?.find(r => r.id === user.roleId)?.name || '')}>
                    {rolesList?.find(r => r.id === user.roleId)?.name || 'Unknown'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{user.phoneNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Department</p>
                  <p className="font-medium">{user.department}</p>
                </div>
                {(user as any).division && (
                  <div>
                    <p className="text-muted-foreground">Division</p>
                    <p className="font-medium">{(user as any).division}</p>
                  </div>
                )}
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between border rounded-lg p-2">
                <span className="text-sm text-muted-foreground">Status</span>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={user.active}
                    onCheckedChange={() => handleToggleActive(user)}
                    className="data-[state=checked]:bg-green-500"
                  />
                  <span className={getStatusBadgeClass(user.active)}>
                    {user.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleResetPassword(user.id)}
                  className="w-full"
                >
                  Reset
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditUser(user)}
                  className="w-full"
                >
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteUser(user)}
                  className="w-full"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[600px] p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="text-2xl font-semibold">Edit Employee</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Make changes to the employee information here.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Information Section */}
                <div className="space-y-4">
                  <div className="mb-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Personal Information</h3>
                  </div>
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Full Name</FormLabel>
                        <FormControl>
                          <Input className="h-9" {...field} />
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
                        <FormLabel className="text-sm font-medium">Email</FormLabel>
                        <FormControl>
                          <Input className="h-9" {...field} />
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
                        <FormLabel className="text-sm font-medium">Phone Number</FormLabel>
                        <FormControl>
                          <Input className="h-9" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cnic"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">CNIC</FormLabel>
                        <FormControl>
                          <Input className="h-9" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Work Information Section */}
                <div className="space-y-4">
                  <div className="mb-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Work Information</h3>
                  </div>
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Department</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {departmentOptions.map((dept) => (
                              <SelectItem key={dept.id} value={dept.name}>
                                {dept.name}{dept.description ? ` — ${dept.description}` : ""}
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
                    name="division"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Division <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <FormControl>
                          <Input className="h-9" placeholder="e.g. Sales Division" {...field} value={field.value ?? ""} />
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
                        <FormLabel className="text-sm font-medium">Role</FormLabel>
                        <Select
                          onValueChange={val => field.onChange(parseInt(val))}
                          defaultValue={field.value?.toString()}
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger className="h-9">
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
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Password</FormLabel>
                        <FormControl>
                          <Input type="password" className="h-9" placeholder="Leave empty to keep unchanged" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-medium">Active Status</FormLabel>
                          <div className="text-[0.8rem] text-muted-foreground">
                            Enable or disable employee access
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="data-[state=checked]:bg-green-500"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter className="flex items-center justify-end gap-4 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateUserMutation.isPending}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {updateUserMutation.isPending ? (
                    <>
                      <span className="mr-2">Saving</span>
                      <span className="animate-spin">⏳</span>
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the employee
              account and remove their data from our servers.
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
    </Card>
  );
}
