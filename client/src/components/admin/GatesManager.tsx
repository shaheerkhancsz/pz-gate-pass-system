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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { DoorOpen, Plus, Pencil, Loader2 } from "lucide-react";

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
    active: boolean;
}

interface Gate {
    id: number;
    companyId: number;
    plantId?: number | null;
    name: string;
    description?: string | null;
    active: boolean;
}

interface GateForm {
    name: string;
    plantId: string;
    description: string;
}

const emptyForm: GateForm = { name: "", plantId: "", description: "" };

export function GatesManager() {
    const { toast } = useToast();
    const qc = useQueryClient();

    const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
    const [selectedPlantId, setSelectedPlantId] = useState<number | null>(null);
    const [search, setSearch] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Gate | null>(null);
    const [form, setForm] = useState<GateForm>(emptyForm);

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

    const { data: plants = [] } = useQuery<Plant[]>({
        queryKey: ["plants", selectedCompanyId],
        queryFn: () =>
            fetch(`/api/plants?companyId=${selectedCompanyId}`, { credentials: "include" }).then(r => r.json()),
        enabled: selectedCompanyId !== null,
    });

    const activePlants = plants.filter(p => p.active);

    const { data: gates = [], isLoading } = useQuery<Gate[]>({
        queryKey: ["gates", selectedCompanyId, selectedPlantId],
        queryFn: () => {
            let url = `/api/gates?companyId=${selectedCompanyId}`;
            if (selectedPlantId) url += `&plantId=${selectedPlantId}`;
            return fetch(url, { credentials: "include" }).then(r => r.json());
        },
        enabled: selectedCompanyId !== null,
    });

    const filtered = gates.filter(g =>
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        (g.description ?? "").toLowerCase().includes(search.toLowerCase())
    );

    const invalidate = () => qc.invalidateQueries({ queryKey: ["gates"] });

    const createMutation = useMutation({
        mutationFn: (data: GateForm) =>
            fetch("/api/gates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    name: data.name,
                    companyId: selectedCompanyId,
                    plantId: data.plantId || null,
                    description: data.description || null,
                }),
            }).then(async r => {
                const json = await r.json();
                if (!r.ok) throw new Error(json.message || "Failed to create gate");
                return json;
            }),
        onSuccess: () => { toast({ title: "Gate created" }); invalidate(); closeDialog(); },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<GateForm> }) =>
            fetch(`/api/gates/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    name: data.name,
                    plantId: data.plantId || null,
                    description: data.description || null,
                }),
            }).then(async r => {
                const json = await r.json();
                if (!r.ok) throw new Error(json.message || "Failed to update gate");
                return json;
            }),
        onSuccess: () => { toast({ title: "Gate updated" }); invalidate(); closeDialog(); },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });

    const toggleMutation = useMutation({
        mutationFn: ({ id, active }: { id: number; active: boolean }) =>
            fetch(`/api/gates/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ active }),
            }).then(r => r.json()),
        onSuccess: () => { toast({ title: "Gate status updated" }); invalidate(); },
        onError: () => toast({ title: "Error", description: "Failed to update status", variant: "destructive" }),
    });

    const openCreate = () => { setEditTarget(null); setForm(emptyForm); setDialogOpen(true); };
    const openEdit = (g: Gate) => {
        setEditTarget(g);
        setForm({ name: g.name, plantId: g.plantId ? String(g.plantId) : "", description: g.description ?? "" });
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

    const getPlantName = (plantId?: number | null) => {
        if (!plantId) return "—";
        return plants.find(p => p.id === plantId)?.name ?? "—";
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <DoorOpen className="h-6 w-6 text-primary" />
                    <div>
                        <h2 className="text-xl font-semibold">Gates</h2>
                        <p className="text-sm text-muted-foreground">Manage entry/exit gates per plant and company.</p>
                    </div>
                </div>
                <Button onClick={openCreate} disabled={!selectedCompanyId} className="bg-primary text-white">
                    <Plus className="h-4 w-4 mr-1" /> Add Gate
                </Button>
            </div>

            {companies.length > 1 && (
                <div className="flex flex-wrap gap-2">
                    {companies.map(c => (
                        <Button
                            key={c.id}
                            variant={selectedCompanyId === c.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => { setSelectedCompanyId(c.id); setSelectedPlantId(null); }}
                            className={selectedCompanyId === c.id ? "bg-primary text-white" : ""}
                        >
                            {c.shortName || c.name}
                        </Button>
                    ))}
                </div>
            )}

            {activePlants.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant={selectedPlantId === null ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setSelectedPlantId(null)}
                    >
                        All Plants
                    </Button>
                    {activePlants.map(p => (
                        <Button
                            key={p.id}
                            variant={selectedPlantId === p.id ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setSelectedPlantId(p.id)}
                        >
                            {p.name}
                        </Button>
                    ))}
                </div>
            )}

            <div>
                <Input
                    placeholder="Search gates…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="max-w-xs"
                />
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Gates — {selectedCompany?.name ?? "Loading…"}</CardTitle>
                    <CardDescription>{gates.length} gate{gates.length !== 1 ? "s" : ""} total</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            <DoorOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
                            <p>{gates.length === 0 ? "No gates yet." : "No results match your search."}</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {filtered.map(gate => (
                                <div key={gate.id} className="flex items-center justify-between py-3 px-1">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{gate.name}</span>
                                            <Badge variant="outline" className="text-xs">{getPlantName(gate.plantId)}</Badge>
                                            <Badge variant={gate.active ? "secondary" : "outline"} className="text-xs">
                                                {gate.active ? "Active" : "Inactive"}
                                            </Badge>
                                        </div>
                                        {gate.description && (
                                            <p className="text-sm text-muted-foreground mt-0.5">{gate.description}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => openEdit(gate)}>
                                            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => toggleMutation.mutate({ id: gate.id, active: !gate.active })}
                                            disabled={toggleMutation.isPending}
                                        >
                                            {gate.active ? "Deactivate" : "Activate"}
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
                        <DialogTitle>{editTarget ? "Edit Gate" : "Add New Gate"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Gate Name *</label>
                            <Input
                                placeholder="e.g. Main Gate"
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            />
                        </div>
                        {activePlants.length > 0 && (
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Plant <span className="text-muted-foreground">(optional)</span></label>
                                <Select
                                    value={form.plantId}
                                    onValueChange={v => setForm(f => ({ ...f, plantId: v === "__none__" ? "" : v }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select plant" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">— No plant —</SelectItem>
                                        {activePlants.map(p => (
                                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Description <span className="text-muted-foreground">(optional)</span></label>
                            <Input
                                placeholder="e.g. Main entry gate"
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeDialog} disabled={isSaving}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving} className="bg-primary text-white">
                            {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                            {editTarget ? "Save Changes" : "Create Gate"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
