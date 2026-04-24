import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Building2, Plus, Pencil, Trash2, Loader2 } from "lucide-react";

interface Company {
    id: number;
    name: string;
    shortName?: string;
}

type ItemInputMode = "items" | "attachment" | "either";

interface Department {
    id: number;
    companyId: number;
    name: string;
    description?: string | null;
    active: boolean;
    itemInputMode?: ItemInputMode;
}

interface DeptForm {
    name: string;
    description: string;
    itemInputMode: ItemInputMode;
}

const INPUT_MODE_LABELS: Record<ItemInputMode, string> = {
    items: "Items only (default)",
    attachment: "Attachment only",
    either: "Either items or attachment (user chooses)",
};

const empty: DeptForm = { name: "", description: "", itemInputMode: "items" };

export function DepartmentsManager() {
    const { toast } = useToast();
    const qc = useQueryClient();

    // Which company is selected
    const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Department | null>(null);
    const [form, setForm] = useState<DeptForm>(empty);

    // ── Queries ─────────────────────────────────────────────────────────────────
    const { data: companies = [] } = useQuery<Company[]>({
        queryKey: ["companies"],
        queryFn: () => fetch("/api/companies", { credentials: "include" }).then(r => r.json()),
    });

    // Auto-select first company when list loads
    React.useEffect(() => {
        if (companies.length > 0 && selectedCompanyId === null) {
            setSelectedCompanyId(companies[0].id);
        }
    }, [companies, selectedCompanyId]);

    const { data: depts = [], isLoading } = useQuery<Department[]>({
        queryKey: ["departments", selectedCompanyId],
        queryFn: () =>
            fetch(`/api/departments?companyId=${selectedCompanyId}`, { credentials: "include" }).then(r => r.json()),
        enabled: selectedCompanyId !== null,
    });

    // ── Mutations ────────────────────────────────────────────────────────────────
    const invalidate = () => qc.invalidateQueries({ queryKey: ["departments"] });

    const createMutation = useMutation({
        mutationFn: (data: DeptForm) =>
            fetch("/api/departments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
            }).then(async r => {
                const json = await r.json();
                if (!r.ok) throw new Error(json.message || "Failed to create department");
                return json;
            }),
        onSuccess: () => {
            toast({ title: "Department created" });
            invalidate();
            closeDialog();
        },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: DeptForm }) =>
            fetch(`/api/departments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(data),
            }).then(async r => {
                const json = await r.json();
                if (!r.ok) throw new Error(json.message || "Failed to update department");
                return json;
            }),
        onSuccess: () => {
            toast({ title: "Department updated" });
            invalidate();
            closeDialog();
        },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) =>
            fetch(`/api/departments/${id}`, { method: "DELETE", credentials: "include" }),
        onSuccess: () => {
            toast({ title: "Department removed" });
            invalidate();
        },
        onError: () => toast({ title: "Error", description: "Failed to remove department", variant: "destructive" }),
    });

    // ── Helpers ──────────────────────────────────────────────────────────────────
    const openCreate = () => {
        setEditTarget(null);
        setForm(empty);
        setDialogOpen(true);
    };

    const openEdit = (dept: Department) => {
        setEditTarget(dept);
        setForm({ name: dept.name, description: dept.description ?? "", itemInputMode: dept.itemInputMode ?? "items" });
        setDialogOpen(true);
    };

    const closeDialog = () => {
        setDialogOpen(false);
        setEditTarget(null);
        setForm(empty);
    };

    const handleSave = () => {
        if (!form.name.trim()) {
            toast({ title: "Name is required", variant: "destructive" });
            return;
        }
        if (editTarget) {
            updateMutation.mutate({ id: editTarget.id, data: form });
        } else {
            createMutation.mutate(form);
        }
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;

    const selectedCompany = companies.find(c => c.id === selectedCompanyId);

    // ── Render ───────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Building2 className="h-6 w-6 text-primary" />
                    <div>
                        <h2 className="text-xl font-semibold">Department Management</h2>
                        <p className="text-sm text-muted-foreground">
                            Manage departments per company. These appear in all department dropdowns across the system.
                        </p>
                    </div>
                </div>
                <Button onClick={openCreate} disabled={!selectedCompanyId} className="bg-primary text-white">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Department
                </Button>
            </div>

            {/* Company selector */}
            {companies.length > 1 && (
                <div className="flex gap-2">
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

            {/* Table */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                        Departments — {selectedCompany?.name ?? "Loading…"}
                    </CardTitle>
                    <CardDescription>
                        {depts.length} active department{depts.length !== 1 ? "s" : ""}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : depts.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                            <p>No departments yet. Click <strong>Add Department</strong> to create one.</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {depts.map(dept => (
                                <div key={dept.id} className="flex items-center justify-between py-3 px-1">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{dept.name}</span>
                                            <Badge variant="secondary" className="text-xs">Active</Badge>
                                            {dept.itemInputMode && dept.itemInputMode !== "items" && (
                                                <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                                                    {dept.itemInputMode === "attachment" ? "Attachment only" : "Items or Attachment"}
                                                </Badge>
                                            )}
                                        </div>
                                        {dept.description && (
                                            <p className="text-sm text-muted-foreground mt-0.5">{dept.description}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openEdit(dept)}
                                        >
                                            <Pencil className="h-3.5 w-3.5 mr-1" />
                                            Edit
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-red-600 border-red-200 hover:bg-red-50"
                                            onClick={() => deleteMutation.mutate(dept.id)}
                                            disabled={deleteMutation.isPending}
                                        >
                                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                                            Remove
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create / Edit dialog */}
            <Dialog open={dialogOpen} onOpenChange={v => !v && closeDialog()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {editTarget ? "Edit Department" : "Add New Department"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Department Name *</label>
                            <Input
                                placeholder="e.g. Procurement"
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Description <span className="text-muted-foreground">(optional)</span></label>
                            <Input
                                placeholder="e.g. Procurement & Supply Chain"
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Gate Pass Input Mode</label>
                            <p className="text-xs text-muted-foreground">Controls whether users in this department enter item details, upload an attachment, or can choose either.</p>
                            <Select
                                value={form.itemInputMode}
                                onValueChange={v => setForm(f => ({ ...f, itemInputMode: v as ItemInputMode }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {(Object.entries(INPUT_MODE_LABELS) as [ItemInputMode, string][]).map(([val, label]) => (
                                        <SelectItem key={val} value={val}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeDialog} disabled={isSaving}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving} className="bg-primary text-white">
                            {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                            {editTarget ? "Save Changes" : "Create Department"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
