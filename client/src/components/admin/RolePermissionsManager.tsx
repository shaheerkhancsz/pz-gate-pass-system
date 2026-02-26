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

// Types for module actions
interface ModuleActions {
  [key: string]: string[] | {
    [key: string]: string;
  };
}

// Module types for permissions
const moduleTypes = [
  'gatePass',
  'customer',
  'driver',
  'user',
  'report',
  'activityLog',
  'document',
  'qrScanner',
  'notification',
  'companySettings'
];

// Base permission actions (CRUD)
const baseActions = ['create', 'read', 'update', 'delete'];

// Special actions for specific modules
const moduleSpecificActions: ModuleActions = {
  gatePass: {
    create: 'Create new gate passes',
    read: 'View gate passes',
    update: 'Edit existing gate passes',
    delete: 'Delete gate passes',
    approve: 'Approve gate passes (Manager level)',
    verify: 'Security verification at checkpoint'
  },
  customer: baseActions,
  driver: baseActions,
  user: baseActions,
  report: ['read', 'export'],
  activityLog: ['read'],
  document: {
    create: 'Upload new documents',
    read: 'View documents',
    update: 'Edit document details',
    delete: 'Delete documents'
  },
  qrScanner: ['read', 'scan'],
  notification: ['read', 'manage'],
  companySettings: ['read', 'update']
};

// Get actions for a specific module
const getActionsForModule = (module: string): string[] => {
  const actions = moduleSpecificActions[module];
  if (typeof actions === 'object' && !Array.isArray(actions)) {
    return [...baseActions, ...Object.keys(actions).filter(key => !baseActions.includes(key))];
  }
  return actions || baseActions;
};

// Get description for special actions
const getActionDescription = (module: string, action: string): string | undefined => {
  const actions = moduleSpecificActions[module];
  if (typeof actions === 'object' && !Array.isArray(actions)) {
    return actions[action];
  }
  return undefined;
};

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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-semibold">Role & Permission Management</h2>
          <p className="text-muted-foreground mt-1">Manage user roles and their permissions</p>
        </div>
        <Button
          onClick={() => {
            form.reset({ name: "", description: "" });
            setIsCreateDialogOpen(true);
          }}
          className="bg-primary text-white hover:bg-primary/90"
        >
          Add New Role
        </Button>
      </div>

      <div className="grid gap-6">
        {roles.map((role: Role) => (
          <div key={role.id} className="border rounded-lg shadow-sm bg-card">
            <div className="p-6 flex justify-between items-start border-b">
              <div>
                <h3 className="text-lg font-semibold">{role.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEditRole(role)}
                className="ml-4"
              >
                Edit Role
              </Button>
            </div>
            
            <div className="p-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[200px] font-semibold">Module</TableHead>
                      {baseActions.map(action => (
                        <TableHead key={action} className="text-center font-semibold">
                          {action.charAt(0).toUpperCase() + action.slice(1)}
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-semibold">Special Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {moduleTypes.map(module => (
                      <TableRow key={module} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          {formatModuleName(module)}
                        </TableCell>
                        {baseActions.map(action => (
                          <TableCell key={action} className="text-center">
                            <Checkbox
                              checked={hasPermission(role.id, module, action)}
                              disabled={role.name === 'Admin'}
                              onCheckedChange={() => 
                                handlePermissionToggle(
                                  role.id, 
                                  module, 
                                  action,
                                  hasPermission(role.id, module, action)
                                )
                              }
                              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                          </TableCell>
                        ))}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            {getActionsForModule(module)
                              .filter(action => !baseActions.includes(action))
                              .map(action => (
                                <div key={action} className="flex flex-col items-center group relative">
                                  <Checkbox
                                    checked={hasPermission(role.id, module, action)}
                                    disabled={role.name === 'Admin'}
                                    onCheckedChange={() => 
                                      handlePermissionToggle(
                                        role.id, 
                                        module, 
                                        action,
                                        hasPermission(role.id, module, action)
                                      )
                                    }
                                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                  />
                                  <span className="text-xs text-muted-foreground mt-1">
                                    {action.charAt(0).toUpperCase() + action.slice(1)}
                                  </span>
                                  {getActionDescription(module, action) && (
                                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-popover text-popover-foreground text-xs p-2 rounded shadow-lg whitespace-nowrap">
                                      {getActionDescription(module, action)}
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Role Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Edit Role</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Update the role details below. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitEdit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Role Name</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-9" />
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
                    <FormLabel className="font-medium">Description</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-9" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateRoleMutation.isPending}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {updateRoleMutation.isPending ? (
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

      {/* Create Role Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Create New Role</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add details for the new role. You can assign permissions after creation.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitCreate)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Role Name</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-9" />
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
                    <FormLabel className="font-medium">Description</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-9" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createRoleMutation.isPending}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {createRoleMutation.isPending ? (
                    <>
                      <span className="mr-2">Creating</span>
                      <span className="animate-spin">⏳</span>
                    </>
                  ) : (
                    "Create Role"
                  )}
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