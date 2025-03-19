import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from "@hookform/resolvers/zod";

// Interfaces for roles and permissions
interface Role {
  id: number;
  name: string;
  description: string;
}

interface Permission {
  id: number;
  roleId: number;
  module: string;
  action: string;
}

// Module types for permissions
const moduleTypes = [
  'gatePass',
  'customer',
  'driver',
  'report',
  'user',
  'activityLog',
  'document',
  'company',
  'notification',
  'role',
  'permission',
  'dashboard'
];

// Permission actions
const permissionActions = [
  'create',
  'read',
  'update',
  'delete',
  'approve',
  'verify',
  'print',
  'export',
  'import',
  'manage'
];

// Form schema for adding/editing a role
const roleFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().min(5, "Description must be at least 5 characters"),
});

// Role Manager Component
export function RolePermissionsManager() {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [permissionsByRole, setPermissionsByRole] = useState<Record<number, Permission[]>>({});

  // Form for creating/editing roles
  const form = useForm<z.infer<typeof roleFormSchema>>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Fetch all roles
  const { data: roles = [], isLoading: rolesLoading } = useQuery({ 
    queryKey: ['/api/roles'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/roles');
      return res.json();
    }
  });

  // Fetch all permissions
  const { data: allPermissions = [] } = useQuery({ 
    queryKey: ['/api/permissions'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/permissions');
      return res.json();
    }
  });

  // Mutation for creating a new role
  const createRoleMutation = useMutation({
    mutationFn: (newRole: z.infer<typeof roleFormSchema>) => {
      return apiRequest('POST', '/api/roles', newRole);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Role created",
        description: "The role has been created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create role",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  });

  // Mutation for updating a role
  const updateRoleMutation = useMutation({
    mutationFn: (data: { id: number, role: z.infer<typeof roleFormSchema> }) => {
      return apiRequest('PATCH', `/api/roles/${data.id}`, data.role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
      setIsEditDialogOpen(false);
      form.reset();
      toast({
        title: "Role updated",
        description: "The role has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update role",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  });

  // Mutation for adding/removing permissions
  const updatePermissionMutation = useMutation({
    mutationFn: (data: { roleId: number, module: string, action: string, grant: boolean }) => {
      if (data.grant) {
        return apiRequest('POST', '/api/permissions', {
          roleId: data.roleId,
          module: data.module,
          action: data.action
        });
      } else {
        // Find the permission ID to delete
        const permissionToDelete = permissionsByRole[data.roleId]?.find(
          p => p.module === data.module && p.action === data.action
        );
        if (!permissionToDelete) {
          throw new Error("Permission not found");
        }
        return apiRequest('DELETE', `/api/permissions/${permissionToDelete.id}`);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/permissions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/roles', variables.roleId, 'permissions'] });
      toast({
        title: "Permissions updated",
        description: "The permissions have been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update permissions",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  });

  // Effect to organize permissions by role ID
  useEffect(() => {
    const permsByRole: Record<number, Permission[]> = {};
    allPermissions.forEach((perm: Permission) => {
      if (!permsByRole[perm.roleId]) {
        permsByRole[perm.roleId] = [];
      }
      permsByRole[perm.roleId].push(perm);
    });
    setPermissionsByRole(permsByRole);
  }, [allPermissions]);

  // Helper to check if a role has a specific permission
  const hasPermission = (roleId: number, module: string, action: string) => {
    return permissionsByRole[roleId]?.some(
      p => p.module === module && p.action === action
    ) || false;
  };

  // Handle permission checkbox toggle
  const handlePermissionToggle = (roleId: number, module: string, action: string, currentValue: boolean) => {
    updatePermissionMutation.mutate({
      roleId,
      module,
      action,
      grant: !currentValue
    });
  };

  // Handle edit role button click
  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    form.reset({
      name: role.name,
      description: role.description,
    });
    setIsEditDialogOpen(true);
  };

  // Handle form submission for edit
  const onSubmitEdit = (data: z.infer<typeof roleFormSchema>) => {
    if (!selectedRole) return;
    updateRoleMutation.mutate({ id: selectedRole.id, role: data });
  };

  // Handle form submission for create
  const onSubmitCreate = (data: z.infer<typeof roleFormSchema>) => {
    createRoleMutation.mutate(data);
  };

  if (rolesLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Role & Permission Management</h2>
        <Button
          onClick={() => {
            form.reset({ name: "", description: "" });
            setIsCreateDialogOpen(true);
          }}
        >
          Add New Role
        </Button>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {roles.map((role: Role) => (
          <AccordionItem key={role.id} value={`role-${role.id}`}>
            <AccordionTrigger className="px-4 hover:no-underline hover:bg-muted/50">
              <div className="flex justify-between items-center w-full pr-4">
                <span className="font-medium">{role.name}</span>
                <span className="text-sm text-muted-foreground truncate max-w-md">{role.description}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pt-2">
              <div className="mb-4 flex justify-end">
                <Button variant="outline" onClick={() => handleEditRole(role)} size="sm">
                  Edit Role
                </Button>
              </div>
              
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Module</TableHead>
                      {permissionActions.map(action => (
                        <TableHead key={action} className="text-center">
                          {action.charAt(0).toUpperCase() + action.slice(1)}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {moduleTypes.map(module => (
                      <TableRow key={module}>
                        <TableCell className="font-medium">
                          {formatModuleName(module)}
                        </TableCell>
                        {permissionActions.map(action => (
                          <TableCell key={action} className="text-center">
                            <Checkbox
                              checked={hasPermission(role.id, module, action)}
                              disabled={role.name === 'Admin'} // Admin has all permissions by default
                              onCheckedChange={() => 
                                handlePermissionToggle(
                                  role.id, 
                                  module, 
                                  action,
                                  hasPermission(role.id, module, action)
                                )
                              }
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Edit Role Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Update the role details below. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitEdit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="submit" disabled={updateRoleMutation.isPending}>
                  {updateRoleMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Create Role Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>
              Add details for the new role. You can assign permissions after creation.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitCreate)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="submit" disabled={createRoleMutation.isPending}>
                  {createRoleMutation.isPending ? "Creating..." : "Create Role"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatModuleName(module: string): string {
  switch (module) {
    case 'gatePass':
      return 'Gate Pass';
    case 'activityLog':
      return 'Activity Log';
    default:
      return module.charAt(0).toUpperCase() + module.slice(1);
  }
}