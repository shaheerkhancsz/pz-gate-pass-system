import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Building2, Plus, Pencil, Loader2 } from "lucide-react";

interface Company {
    id: number;
    name: string;
    shortName?: string;
    active?: boolean;
}

interface Plant {
    id: number;
    companyId: number;
    name: string;
    description?: string | null;
    active: boolean;
}

interface PlantForm {
    name: string;
    description: string;
}

const emptyForm: PlantForm = { name: "", description: "" };

export function PlantsManager() {
    const { toast } = useToast();
    const qc = useQueryClient();

    const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
    const [search, setSearch] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Plant | null>(null);
    const [form, setForm] = useState<PlantForm>(emptyForm);

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

    const { data: plants = [], isLoading } = useQuery<Plant[]>({
        queryKey: ["plants", selectedCompanyId],
        queryFn: () =>
            fetch(`/api/plants?companyId=${selectedCompanyId}`, { credentials: "include" }).then(r => r.json()),
        enabled: selectedCompanyId !== null,
    });

    const filtered = plants.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description ?? "").toLowerCase().includes(search.toLowerCase())
    );

    const invalidate = () => qc.invalidateQueries({ queryKey: ["plants"] });

    const createMutation = useMutation({
        mutationFn: (data: PlantForm) =>
            fetch("/api/plants", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
            }).then(async r => {
                const json = await r.json();
                if (!r.ok) throw new Error(json.message || "Failed to create plant");
                return json;
            }),
        onSuccess: () => { toast({ title: "Plant created" }); invalidate(); closeDialog(); },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<PlantForm> }) =>
            fetch(`/api/plants/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(data),
            }).then(async r => {
                const json = await r.json();
                if (!r.ok) throw new Error(json.message || "Failed to update plant");
                return json;
            }),
        onSuccess: () => { toast({ title: "Plant updated" }); invalidate(); closeDialog(); },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });

    const toggleMutation = useMutation({
        mutationFn: ({ id, active }: { id: number; active: boolean }) =>
            fetch(`/api/plants/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ active }),
            }).then(r => r.json()),
        onSuccess: () => { toast({ title: "Plant status updated" }); invalidate(); },
        onError: () => toast({ title: "Error", description: "Failed to update status", variant: "destructive" }),
    });

    const openCreate = () => { setEditTarget(null); setForm(emptyForm); setDialogOpen(true); };
    const openEdit = (p: Plant) => { setEditTarget(p); setForm({ name: p.name, description: p.description ?? "" }); setDialogOpen(true); };
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
                    <Building2 className="h-6 w-6 text-primary" />
                    <div>
                        <h2 className="text-xl font-semibold">Plants</h2>
                        <p className="text-sm text-muted-foreground">Manage manufacturing / warehouse plants per company.</p>
                    </div>
                </div>
                <Button onClick={openCreate} disabled={!selectedCompanyId} className="bg-primary text-white">
                    <Plus className="h-4 w-4 mr-1" /> Add Plant
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
                    placeholder="Search plants…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="max-w-xs"
                />
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Plants — {selectedCompany?.name ?? "Loading…"}</CardTitle>
                    <CardDescription>{plants.length} plant{plants.length !== 1 ? "s" : ""} total</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                            <p>{plants.length === 0 ? "No plants yet." : "No results match your search."}</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {filtered.map(plant => (
                                <div key={plant.id} className="flex items-center justify-between py-3 px-1">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{plant.name}</span>
                                            <Badge variant={plant.active ? "secondary" : "outline"} className="text-xs">
                                                {plant.active ? "Active" : "Inactive"}
                                            </Badge>
                                        </div>
                                        {plant.description && (
                                            <p className="text-sm text-muted-foreground mt-0.5">{plant.description}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => openEdit(plant)}>
                                            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => toggleMutation.mutate({ id: plant.id, active: !plant.active })}
                                            disabled={toggleMutation.isPending}
                                        >
                                            {plant.active ? "Deactivate" : "Activate"}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={v => !v && closeDialog()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editTarget ? "Edit Plant" : "Add New Plant"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Plant Name *</label>
                            <Input
                                placeholder="e.g. Plant A"
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Description <span className="text-muted-foreground">(optional)</span></label>
                            <Input
                                placeholder="e.g. Main manufacturing plant"
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeDialog} disabled={isSaving}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving} className="bg-primary text-white">
                            {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                            {editTarget ? "Save Changes" : "Create Plant"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
