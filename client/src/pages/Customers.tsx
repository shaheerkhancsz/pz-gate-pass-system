import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatPhoneNumber } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { type Customer } from "@shared/schema";
import { Users, Plus, Pencil, Loader2 } from "lucide-react";

interface Company {
  id: number;
  name: string;
  shortName?: string;
  active?: boolean;
}

interface CustomerForm {
  name: string;
  code: string;
  phone: string;
  email: string;
  address: string;
  sapId: string;
}

const emptyForm: CustomerForm = { name: "", code: "", phone: "", email: "", address: "", sapId: "" };

export default function Customers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuth();

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);

  // Fetch companies (admin sees all; non-admins use their own companyId)
  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: () => fetch("/api/companies", { credentials: "include" }).then(r => r.json()),
    enabled: isAdmin,
  });

  React.useEffect(() => {
    if (isAdmin) {
      if (companies.length > 0 && selectedCompanyId === null) {
        const active = companies.find(c => c.active !== false) ?? companies[0];
        setSelectedCompanyId(active.id);
      }
    } else if (user?.companyId) {
      setSelectedCompanyId(user.companyId);
    }
  }, [companies, isAdmin, user, selectedCompanyId]);

  const effectiveCompanyId = isAdmin ? selectedCompanyId : (user?.companyId ?? null);

  // Fetch customers for the selected company
  const { data: customerList = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["customers", effectiveCompanyId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (effectiveCompanyId) params.set("companyId", String(effectiveCompanyId));
      return fetch(`/api/customers?${params}`, { credentials: "include" }).then(r => r.json());
    },
    enabled: effectiveCompanyId !== null,
  });

  const filtered = customerList.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    ((c as any).code ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["customers"] });

  const createMutation = useMutation({
    mutationFn: (data: CustomerForm) =>
      fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, companyId: effectiveCompanyId }),
      }).then(async r => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.message || "Failed to create customer");
        return json;
      }),
    onSuccess: () => { toast({ title: "Customer created" }); invalidate(); closeDialog(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CustomerForm }) =>
      fetch(`/api/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then(async r => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.message || "Failed to update customer");
        return json;
      }),
    onSuccess: () => { toast({ title: "Customer updated" }); invalidate(); closeDialog(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      fetch(`/api/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ active }),
      }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Customer status updated" }); invalidate(); },
    onError: () => toast({ title: "Error", description: "Failed to update status", variant: "destructive" }),
  });

  const openCreate = () => { setEditTarget(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: Customer) => {
    setEditTarget(c);
    setForm({
      name: c.name,
      code: (c as any).code ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      address: (c as any).address ?? "",
      sapId: c.sapId ?? "",
    });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditTarget(null); setForm(emptyForm); };

  const handleSave = () => {
    if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    if (editTarget) updateMutation.mutate({ id: editTarget.id, data: form });
    else createMutation.mutate(form);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Customers</h2>
              <p className="text-sm text-muted-foreground">Manage customers and buyers per company.</p>
            </div>
          </div>
          <Button onClick={openCreate} disabled={!effectiveCompanyId} className="bg-primary text-white">
            <Plus className="h-4 w-4 mr-1" /> Add Customer
          </Button>
        </div>

        {/* Company selector — admin only, when multiple companies */}
        {isAdmin && companies.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {companies.map(c => (
              <Button
                key={c.id}
                variant={selectedCompanyId === c.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCompanyId(c.id)}
                className={selectedCompanyId === c.id ? "bg-primary text-white" : ""}
              >
                {c.shortName || c.name}
              </Button>
            ))}
          </div>
        )}

        {/* Search */}
        <div>
          <Input
            placeholder="Search by name, code, or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground border rounded-lg">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="font-medium">{customerList.length === 0 ? "No customers yet." : "No results match your search."}</p>
            {isAdmin && selectedCompany && (
              <p className="text-sm mt-1">Company: {selectedCompany.name}</p>
            )}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>SAP Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(customer => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      {(customer as any).code
                        ? <Badge variant="outline">{(customer as any).code}</Badge>
                        : <span className="text-muted-foreground text-sm">—</span>}
                    </TableCell>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.phone || <span className="text-muted-foreground text-sm">—</span>}</TableCell>
                    <TableCell>{customer.email || <span className="text-muted-foreground text-sm">—</span>}</TableCell>
                    <TableCell>{customer.sapId || <span className="text-muted-foreground text-sm">—</span>}</TableCell>
                    <TableCell>
                      <Badge variant={(customer as any).active !== false ? "default" : "secondary"}>
                        {(customer as any).active !== false ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(customer)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleMutation.mutate({ id: customer.id, active: (customer as any).active === false })}
                          disabled={toggleMutation.isPending}
                        >
                          {(customer as any).active !== false ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Add / Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={v => !v && closeDialog()}>
          <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editTarget ? "Edit Customer" : "Add Customer"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-sm font-medium">Customer Name *</label>
                  <Input
                    placeholder="e.g. ABC Corporation Ltd"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Code</label>
                  <Input
                    placeholder="e.g. CUST-001"
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">SAP Code</label>
                  <Input
                    placeholder="e.g. 200001"
                    value={form.sapId}
                    onChange={e => setForm(f => ({ ...f, sapId: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    placeholder="e.g. 0300-1234567"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: formatPhoneNumber(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    placeholder="e.g. info@customer.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-sm font-medium">Address</label>
                  <Textarea
                    placeholder="Customer address…"
                    value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    rows={2}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog} disabled={isSaving}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving} className="bg-primary text-white">
                {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {editTarget ? "Save Changes" : "Create Customer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
}
