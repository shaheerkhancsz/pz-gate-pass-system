import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Truck, Plus, Pencil, Loader2 } from "lucide-react";

interface Company {
    id: number;
    name: string;
    shortName?: string;
    active?: boolean;
}

interface Vendor {
    id: number;
    companyId: number;
    code?: string | null;
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    sapCode?: string | null;
    active: boolean;
}

interface VendorForm {
    name: string;
    code: string;
    phone: string;
    email: string;
    address: string;
    sapCode: string;
}

const emptyForm: VendorForm = { name: "", code: "", phone: "", email: "", address: "", sapCode: "" };

export function VendorsManager() {
    const { toast } = useToast();
    const qc = useQueryClient();

    const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
    const [search, setSearch] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Vendor | null>(null);
    const [form, setForm] = useState<VendorForm>(emptyForm);

    const { data: companies = [] } = useQuery<Company[]>({
        queryKey: ["companies"],
        queryFn: () => fetch("/api/companies", { credentials: "include" }).then(r => r.json()),
    });

    React.useEffect(() => {
        if (companies.length > 0 && selectedCompanyId === null) {
            const active = companies.find(c => c.active !== false) ?? companies[0];
            setSelectedCompanyId(active.id);
        }
    }, [companies, selectedCompanyId]);

    const { data: vendorList = [], isLoading } = useQuery<Vendor[]>({
        queryKey: ["vendors", selectedCompanyId],
        queryFn: () =>
            fetch(`/api/vendors?companyId=${selectedCompanyId}`, { credentials: "include" }).then(r => r.json()),
        enabled: selectedCompanyId !== null,
    });

    const filtered = vendorList.filter(v =>
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        (v.code ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (v.email ?? "").toLowerCase().includes(search.toLowerCase())
    );

    const invalidate = () => qc.invalidateQueries({ queryKey: ["vendors"] });

    const createMutation = useMutation({
        mutationFn: (data: VendorForm) =>
            fetch("/api/vendors", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
            }).then(async r => {
                const json = await r.json();
                if (!r.ok) throw new Error(json.message || "Failed to create vendor");
                return json;
            }),
        onSuccess: () => { toast({ title: "Vendor created" }); invalidate(); closeDialog(); },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: VendorForm }) =>
            fetch(`/api/vendors/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(data),
            }).then(async r => {
                const json = await r.json();
                if (!r.ok) throw new Error(json.message || "Failed to update vendor");
                return json;
            }),
        onSuccess: () => { toast({ title: "Vendor updated" }); invalidate(); closeDialog(); },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });

    const toggleMutation = useMutation({
        mutationFn: ({ id, active }: { id: number; active: boolean }) =>
            fetch(`/api/vendors/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ active }),
            }).then(r => r.json()),
        onSuccess: () => { toast({ title: "Vendor status updated" }); invalidate(); },
        onError: () => toast({ title: "Error", description: "Failed to update status", variant: "destructive" }),
    });

    const openCreate = () => { setEditTarget(null); setForm(emptyForm); setDialogOpen(true); };
    const openEdit = (v: Vendor) => {
        setEditTarget(v);
        setForm({
            name: v.name,
            code: v.code ?? "",
            phone: v.phone ?? "",
            email: v.email ?? "",
            address: v.address ?? "",
            sapCode: v.sapCode ?? "",
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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Truck className="h-6 w-6 text-primary" />
                    <div>
                        <h2 className="text-xl font-semibold">Vendors</h2>
                        <p className="text-sm text-muted-foreground">Manage suppliers and vendors per company.</p>
                    </div>
                </div>
                <Button onClick={openCreate} disabled={!selectedCompanyId} className="bg-primary text-white">
                    <Plus className="h-4 w-4 mr-1" /> Add Vendor
                </Button>
            </div>

            {companies.length > 1 && (
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

            <div>
                <Input
                    placeholder="Search by name, code, or email…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="max-w-sm"
                />
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground border rounded-lg">
                    <Truck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">{vendorList.length === 0 ? "No vendors yet." : "No results match your search."}</p>
                    <p className="text-sm mt-1">Company: {selectedCompany?.name ?? "—"}</p>
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
                            {filtered.map(vendor => (
                                <TableRow key={vendor.id}>
                                    <TableCell>
                                        {vendor.code ? <Badge variant="outline">{vendor.code}</Badge> : <span className="text-muted-foreground text-sm">—</span>}
                                    </TableCell>
                                    <TableCell className="font-medium">{vendor.name}</TableCell>
                                    <TableCell>{vendor.phone || <span className="text-muted-foreground text-sm">—</span>}</TableCell>
                                    <TableCell>{vendor.email || <span className="text-muted-foreground text-sm">—</span>}</TableCell>
                                    <TableCell>{vendor.sapCode || <span className="text-muted-foreground text-sm">—</span>}</TableCell>
                                    <TableCell>
                                        <Badge variant={vendor.active ? "default" : "secondary"}>
                                            {vendor.active ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => openEdit(vendor)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleMutation.mutate({ id: vendor.id, active: !vendor.active })}
                                                disabled={toggleMutation.isPending}
                                            >
                                                {vendor.active ? "Deactivate" : "Activate"}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <Dialog open={dialogOpen} onOpenChange={v => !v && closeDialog()}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editTarget ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5 col-span-2">
                                <label className="text-sm font-medium">Vendor Name *</label>
                                <Input
                                    placeholder="e.g. ABC Supplies Ltd"
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Code</label>
                                <Input
                                    placeholder="e.g. VND-001"
                                    value={form.code}
                                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">SAP Code</label>
                                <Input
                                    placeholder="e.g. 100001"
                                    value={form.sapCode}
                                    onChange={e => setForm(f => ({ ...f, sapCode: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Phone</label>
                                <Input
                                    placeholder="e.g. 021-34567890"
                                    value={form.phone}
                                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Email</label>
                                <Input
                                    type="email"
                                    placeholder="e.g. info@vendor.com"
                                    value={form.email}
                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5 col-span-2">
                                <label className="text-sm font-medium">Address</label>
                                <Textarea
                                    placeholder="Vendor address…"
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
                            {editTarget ? "Save Changes" : "Create Vendor"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
