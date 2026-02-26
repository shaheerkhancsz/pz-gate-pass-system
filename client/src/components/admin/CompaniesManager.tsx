import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Pencil, Trash2, Loader2 } from "lucide-react";

interface Company {
    id: number;
    name: string;
    shortName: string | null;
    code: string | null;
    logo: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    active: boolean;
    createdAt: string;
}

const defaultForm = { name: "", shortName: "", code: "", logo: "", address: "", phone: "", email: "" };

async function fetchCompanies(): Promise<Company[]> {
    const res = await fetch("/api/companies");
    if (!res.ok) throw new Error("Failed to fetch companies");
    return res.json();
}

export function CompaniesManager() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);
    const [form, setForm] = useState(defaultForm);

    const { data: companies = [], isLoading } = useQuery<Company[]>({
        queryKey: ["companies"],
        queryFn: fetchCompanies,
    });

    const createMutation = useMutation({
        mutationFn: async (data: typeof defaultForm) => {
            const res = await fetch("/api/companies", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error((await res.json()).message);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["companies"] });
            toast({ title: "Company created successfully" });
            closeDialog();
        },
        onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: typeof defaultForm }) => {
            const res = await fetch(`/api/companies/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error((await res.json()).message);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["companies"] });
            toast({ title: "Company updated successfully" });
            closeDialog();
        },
        onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/companies/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete company");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["companies"] });
            toast({ title: "Company deleted successfully" });
        },
        onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });

    const openCreate = () => {
        setEditingCompany(null);
        setForm(defaultForm);
        setIsDialogOpen(true);
    };

    const openEdit = (company: Company) => {
        setEditingCompany(company);
        setForm({
            name: company.name,
            shortName: company.shortName || "",
            code: company.code || "",
            logo: company.logo || "",
            address: company.address || "",
            phone: company.phone || "",
            email: company.email || "",
        });
        setIsDialogOpen(true);
    };

    const closeDialog = () => {
        setIsDialogOpen(false);
        setEditingCompany(null);
        setForm(defaultForm);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingCompany) {
            updateMutation.mutate({ id: editingCompany.id, data: form });
        } else {
            createMutation.mutate(form);
        }
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-semibold">Companies</h2>
                    <Badge variant="secondary">{companies.length} total</Badge>
                </div>
                <Button onClick={openCreate} size="sm">
                    <Plus className="h-4 w-4 mr-1" /> Add Company
                </Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : companies.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border rounded-lg">
                    <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No companies yet</p>
                    <p className="text-sm mt-1">Add AGP Pharma, OBS Pakistan, or OBS International to get started</p>
                    <Button onClick={openCreate} variant="outline" className="mt-4">
                        <Plus className="h-4 w-4 mr-1" /> Add First Company
                    </Button>
                </div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Company Name</TableHead>
                                <TableHead>Short Code</TableHead>
                                <TableHead>Code</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {companies.map((company) => (
                                <TableRow key={company.id}>
                                    <TableCell className="font-medium">{company.name}</TableCell>
                                    <TableCell>
                                        {company.shortName ? (
                                            <Badge variant="outline">{company.shortName}</Badge>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {company.code ? (
                                            <Badge variant="secondary">{company.code}</Badge>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>{company.phone || <span className="text-muted-foreground text-sm">—</span>}</TableCell>
                                    <TableCell>{company.email || <span className="text-muted-foreground text-sm">—</span>}</TableCell>
                                    <TableCell>
                                        <Badge variant={company.active ? "default" : "secondary"}>
                                            {company.active ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => openEdit(company)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => {
                                                    if (confirm(`Delete "${company.name}"?`)) deleteMutation.mutate(company.id);
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingCompany ? "Edit Company" : "Add Company"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Company Name *</Label>
                            <Input
                                id="name"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g., AGP Pharma Private Limited"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="shortName">Short Code</Label>
                            <Input
                                id="shortName"
                                value={form.shortName}
                                onChange={(e) => setForm({ ...form, shortName: e.target.value })}
                                placeholder="e.g., AGP, OBS-PK"
                                maxLength={10}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="code">Company Code</Label>
                            <Input
                                id="code"
                                value={form.code}
                                onChange={(e) => setForm({ ...form, code: e.target.value })}
                                placeholder="e.g., AGP-001"
                                maxLength={20}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="logo">Logo (URL or base64)</Label>
                            <Input
                                id="logo"
                                value={form.logo}
                                onChange={(e) => setForm({ ...form, logo: e.target.value })}
                                placeholder="https://... or data:image/png;base64,..."
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input
                                id="phone"
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                placeholder="e.g., 021-34567890"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                placeholder="e.g., info@agppharma.com"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="address">Address</Label>
                            <Textarea
                                id="address"
                                value={form.address}
                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                                placeholder="Company address..."
                                rows={2}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                                {editingCompany ? "Update" : "Create"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
