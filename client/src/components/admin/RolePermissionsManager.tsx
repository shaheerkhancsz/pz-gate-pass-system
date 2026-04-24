import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck, Pencil, Trash2, Plus, AlertTriangle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Module / Action definitions ──────────────────────────────────────────────
// Each module lists ONLY the actions that are meaningful for it.

const MODULES: { key: string; label: string; actions: { key: string; label: string }[] }[] = [
  {
    key: "gatePass",
    label: "Gate Pass",
    actions: [
      { key: "create",  label: "Create"              },
      { key: "read",    label: "View"                },
      { key: "update",  label: "Edit"                },
      { key: "delete",  label: "Delete"              },
      { key: "approve", label: "Approve (HOD)"       },
      { key: "verify",  label: "Verify (Security)"   },
      { key: "manage",  label: "Force Close / Admin" },
      { key: "print",   label: "Print"               },
    ],
  },
  {
    key: "customer",
    label: "Customer",
    actions: [
      { key: "create", label: "Create" },
      { key: "read",   label: "View"   },
      { key: "update", label: "Edit"   },
      { key: "delete", label: "Delete" },
    ],
  },
  {
    key: "driver",
    label: "Driver",
    actions: [
      { key: "create", label: "Create" },
      { key: "read",   label: "View"   },
      { key: "update", label: "Edit"   },
      { key: "delete", label: "Delete" },
    ],
  },
  {
    key: "vendor",
    label: "Vendor",
    actions: [
      { key: "create", label: "Create" },
      { key: "read",   label: "View"   },
      { key: "update", label: "Edit"   },
      { key: "delete", label: "Delete" },
    ],
  },
  {
    key: "document",
    label: "Document",
    actions: [
      { key: "create", label: "Upload" },
      { key: "read",   label: "View"   },
      { key: "update", label: "Edit"   },
      { key: "delete", label: "Delete" },
    ],
  },
  {
    key: "report",
    label: "Reports",
    actions: [
      { key: "read",            label: "View All Reports"   },
      { key: "export",          label: "Export"             },
      { key: "standard",        label: "Gate Pass Summary"  },
      { key: "custom",          label: "Custom Reports"     },
      { key: "analytics",       label: "Analytics"          },
      { key: "pending",         label: "Pending Approvals"  },
      { key: "returnables",     label: "Returnable Tracker" },
      { key: "gate-traffic",    label: "Gate/Plant Traffic" },
      { key: "company-summary", label: "Company Summary"    },
      { key: "dept-summary",    label: "Dept. Summary"      },
      { key: "user-activity",   label: "User Activity"      },
      { key: "vendor-customer", label: "Vendor/Customer"    },
      { key: "item-movement",   label: "Item Movement"      },
      { key: "documents",       label: "Documents"          },
      { key: "driver-activity", label: "Driver Activity"    },
    ],
  },
  {
    key: "user",
    label: "User Management",
    actions: [
      { key: "create", label: "Create" },
      { key: "read",   label: "View"   },
      { key: "update", label: "Edit"   },
      { key: "delete", label: "Delete" },
    ],
  },
  {
    key: "activityLog",
    label: "Activity Log",
    actions: [
      { key: "read", label: "View" },
    ],
  },
  {
    key: "qrScanner",
    label: "QR Scanner",
    actions: [
      { key: "read", label: "Access" },
    ],
  },
  {
    key: "notification",
    label: "Notifications",
    actions: [
      { key: "read",   label: "View"   },
      { key: "manage", label: "Manage" },
    ],
  },
  {
    key: "companySettings",
    label: "Company Settings",
    actions: [
      { key: "read",   label: "View" },
      { key: "update", label: "Edit" },
    ],
  },
  {
    key: "dashboard",
    label: "Dashboard",
    actions: [
      { key: "read", label: "Access" },
    ],
  },
];

// ─── Form schema ──────────────────────────────────────────────────────────────

const roleFormSchema = z.object({
  name:        z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().min(5, "Description must be at least 5 characters"),
});
type RoleFormValues = z.infer<typeof roleFormSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export function RolePermissionsManager() {
  const { toast } = useToast();

  const [editRole,   setEditRole]   = useState<Role | null>(null);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [permissionsByRole, setPermissionsByRole] = useState<Record<number, Permission[]>>({});

  // Separate form instances for create vs edit
  const createForm = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { name: "", description: "" },
  });
  const editForm = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { name: "", description: "" },
  });

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: roles = [], isLoading } = useQuery<Role[]>({
    queryKey: ['/api/roles'],
    queryFn: () => apiRequest('GET', '/api/roles').then(r => r.json()),
  });

  const { data: allPermissions = [] } = useQuery<Permission[]>({
    queryKey: ['/api/permissions'],
    queryFn: () => apiRequest('GET', '/api/permissions').then(r => r.json()),
  });

  useEffect(() => {
    const map: Record<number, Permission[]> = {};
    allPermissions.forEach(p => {
      if (!map[p.roleId]) map[p.roleId] = [];
      map[p.roleId].push(p);
    });
    setPermissionsByRole(map);
  }, [allPermissions]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createRoleMutation = useMutation({
    mutationFn: (data: RoleFormValues) => apiRequest('POST', '/api/roles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
      setCreateOpen(false);
      createForm.reset();
      toast({ title: "Role created", description: "New role has been created successfully." });
    },
    onError: (e: Error) => toast({ title: "Failed to create role", description: e.message, variant: "destructive" }),
  });

  const updateRoleMutation = useMutation({
    mutationFn: (data: { id: number; values: RoleFormValues }) =>
      apiRequest('PATCH', `/api/roles/${data.id}`, data.values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
      setEditRole(null);
      toast({ title: "Role updated", description: "Role details have been saved." });
    },
    onError: (e: Error) => toast({ title: "Failed to update role", description: e.message, variant: "destructive" }),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/permissions'] });
      setDeleteRole(null);
      toast({ title: "Role deleted", description: "The role has been removed." });
    },
    onError: (e: Error) => toast({ title: "Failed to delete role", description: e.message, variant: "destructive" }),
  });

  const permissionMutation = useMutation({
    mutationFn: (data: { roleId: number; module: string; action: string; grant: boolean }) => {
      if (data.grant) {
        return apiRequest('POST', '/api/permissions', {
          roleId: data.roleId,
          module: data.module,
          action: data.action,
        });
      }
      const existing = permissionsByRole[data.roleId]?.find(
        p => p.module === data.module && p.action === data.action
      );
      if (!existing) throw new Error("Permission record not found");
      return apiRequest('DELETE', `/api/permissions/${existing.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/permissions'] });
    },
    onError: (e: Error) => toast({ title: "Failed to update permission", description: e.message, variant: "destructive" }),
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  const hasPerm = (roleId: number, module: string, action: string) =>
    permissionsByRole[roleId]?.some(p => p.module === module && p.action === action) ?? false;

  const isAdminRole = (role: Role) => role.id === 1 || role.name.toLowerCase() === 'admin';

  // ── Handlers ───────────────────────────────────────────────────────────────

  const openEdit = (role: Role) => {
    setEditRole(role);
    editForm.reset({ name: role.name, description: role.description });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Role & Permission Management</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Define what each role can do across all modules.
          </p>
        </div>
        <Button onClick={() => { createForm.reset(); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Role
        </Button>
      </div>

      {/* Role cards */}
      {roles.map((role: Role) => {
        const locked = isAdminRole(role);
        const rolePerms = permissionsByRole[role.id] ?? [];
        const permCount = rolePerms.length;

        return (
          <div key={role.id} className="border rounded-xl shadow-sm bg-white overflow-hidden">

            {/* Card header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
              <div className="flex items-center gap-3">
                <ShieldCheck className={`h-5 w-5 ${locked ? "text-amber-500" : "text-primary"}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{role.name}</h3>
                    {locked && (
                      <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 border-amber-200">
                        System Role
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs text-gray-500">
                      {permCount} permission{permCount !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{role.description}</p>
                </div>
              </div>
              {!locked && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(role)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteRole(role)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete
                  </Button>
                </div>
              )}
            </div>

            {/* Permission grid */}
            <div className="divide-y">
              {MODULES.map(mod => {
                const allGranted = mod.actions.every(a => hasPerm(role.id, mod.key, a.key));
                return (
                  <div key={mod.key} className="flex flex-col sm:flex-row sm:items-start px-3 sm:px-6 py-3 hover:bg-gray-50/50 gap-2 sm:gap-0">
                    {/* Module name + select-all */}
                    <div className="sm:w-44 sm:shrink-0 pt-0.5">
                      <div className="flex items-center gap-2">
                        {!locked && (
                          <Checkbox
                            checked={allGranted}
                            title="Toggle all"
                            onCheckedChange={(checked) => {
                              mod.actions.forEach(a => {
                                const current = hasPerm(role.id, mod.key, a.key);
                                if (!!checked !== current) {
                                  permissionMutation.mutate({
                                    roleId: role.id,
                                    module: mod.key,
                                    action: a.key,
                                    grant: !!checked,
                                  });
                                }
                              });
                            }}
                            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                        )}
                        <span className="text-sm font-medium text-gray-700">{mod.label}</span>
                      </div>
                    </div>

                    {/* Action checkboxes */}
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      {mod.actions.map(action => {
                        const granted = hasPerm(role.id, mod.key, action.key);
                        return (
                          <label
                            key={action.key}
                            className={`flex items-center gap-1.5 text-sm cursor-pointer select-none ${
                              locked ? "opacity-60 cursor-not-allowed" : ""
                            }`}
                          >
                            <Checkbox
                              checked={locked ? true : granted}
                              disabled={locked || permissionMutation.isPending}
                              onCheckedChange={() =>
                                permissionMutation.mutate({
                                  roleId: role.id,
                                  module: mod.key,
                                  action: action.key,
                                  grant: !granted,
                                })
                              }
                              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                            <span className={granted && !locked ? "text-gray-800" : "text-gray-500"}>
                              {action.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ── Create Role Dialog ────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>
              Add a name and description. You can assign permissions immediately after creation.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(d => createRoleMutation.mutate(d))} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role Name</FormLabel>
                    <FormControl><Input placeholder="e.g. HOD Manager" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Input placeholder="e.g. Head of Department, can approve gate passes" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createRoleMutation.isPending}>
                  {createRoleMutation.isPending ? "Creating..." : "Create Role"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Role Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!editRole} onOpenChange={open => !open && setEditRole(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Update the role name or description.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(d =>
                editRole && updateRoleMutation.mutate({ id: editRole.id, values: d })
              )}
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditRole(null)}>Cancel</Button>
                <Button type="submit" disabled={updateRoleMutation.isPending}>
                  {updateRoleMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!deleteRole} onOpenChange={open => !open && setDeleteRole(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Delete Role
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the <strong>{deleteRole?.name}</strong> role?
              All users assigned to this role will lose their permissions. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRole(null)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteRoleMutation.isPending}
              onClick={() => deleteRole && deleteRoleMutation.mutate(deleteRole.id)}
            >
              {deleteRoleMutation.isPending ? "Deleting..." : "Delete Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
