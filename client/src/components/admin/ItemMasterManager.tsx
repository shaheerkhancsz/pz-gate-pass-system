import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Package, Plus, Pencil, Loader2 } from "lucide-react";

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

interface ItemMasterRow {
    id: number;
    companyId: number;
    plantId?: number | null;
    code?: string | null;
    name: string;
    type?: string | null;
    unit?: string | null;
    active: boolean;
}

interface ItemForm {
    name: string;
    code: string;
    type: string;
    plantId: string;
    unit: string;
}

const emptyForm: ItemForm = { name: "", code: "", type: "", plantId: "", unit: "" };

export function ItemMasterManager() {
    const { toast } = useToast();
    const qc = useQueryClient();

    const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
    const [selectedPlantId, setSelectedPlantId] = useState<number | null>(null);
    const [search, setSearch] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<ItemMasterRow | null>(null);
    const [form, setForm] = useState<ItemForm>(emptyForm);

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

    const { data: items = [], isLoading } = useQuery<ItemMasterRow[]>({
        queryKey: ["item-master", selectedCompanyId, selectedPlantId],
        queryFn: () => {
            let url = `/api/item-master?companyId=${selectedCompanyId}`;
            if (selectedPlantId) url += `&plantId=${selectedPlantId}`;
            return fetch(url, { credentials: "include" }).then(r => r.json());
        },
        enabled: selectedCompanyId !== null,
    });

    const filtered = items.filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.code ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (item.type ?? "").toLowerCase().includes(search.toLowerCase())
    );

    const invalidate = () => qc.invalidateQueries({ queryKey: ["item-master"] });

    const createMutation = useMutation({
        mutationFn: (data: ItemForm) =>
            fetch("/api/item-master", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    name: data.name,
                    companyId: selectedCompanyId,
                    code: data.code || null,
                    type: data.type || null,
                    plantId: data.plantId || null,
                    unit: data.unit || null,
                }),
            }).then(async r => {
                const json = await r.json();
                if (!r.ok) throw new Error(json.message || "Failed to create item");
                return json;
            }),
        onSuccess: () => { toast({ title: "Item created" }); invalidate(); closeDialog(); },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: ItemForm }) =>
            fetch(`/api/item-master/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    name: data.name,
                    code: data.code || null,
                    type: data.type || null,
                    plantId: data.plantId || null,
                    unit: data.unit || null,
                }),
            }).then(async r => {
                const json = await r.json();
                if (!r.ok) throw new Error(json.message || "Failed to update item");
                return json;
            }),
        onSuccess: () => { toast({ title: "Item updated" }); invalidate(); closeDialog(); },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });

    const toggleMutation = useMutation({
        mutationFn: ({ id, active }: { id: number; active: boolean }) =>
            fetch(`/api/item-master/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ active }),
            }).then(r => r.json()),
        onSuccess: () => { toast({ title: "Item status updated" }); invalidate(); },
        onError: () => toast({ title: "Error", description: "Failed to update status", variant: "destructive" }),
    });

    const openCreate = () => { setEditTarget(null); setForm(emptyForm); setDialogOpen(true); };
    const openEdit = (item: ItemMasterRow) => {
        setEditTarget(item);
        setForm({
            name: item.name,
            code: item.code ?? "",
            type: item.type ?? "",
            plantId: item.plantId ? String(item.plantId) : "",
            unit: item.unit ?? "",
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
    const getPlantName = (plantId?: number | null) => plants.find(p => p.id === plantId)?.name ?? "—";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Package className="h-6 w-6 text-primary" />
                    <div>
                        <h2 className="text-xl font-semibold">Item Master</h2>
                        <p className="text-sm text-muted-foreground">Manage master item catalog per plant and company.</p>
                    </div>
                </div>
                <Button onClick={openCreate} disabled={!selectedCompanyId} className="bg-primary text-white">
                    <Plus className="h-4 w-4 mr-1" /> Add Item
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
                    placeholder="Search by name, code, or type…"
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
                    <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">{items.length === 0 ? "No items yet." : "No results match your search."}</p>
                    <p className="text-sm mt-1">Company: {selectedCompany?.name ?? "—"}</p>
                </div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Code</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Plant</TableHead>
                                <TableHead>Unit</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        {item.code ? <Badge variant="outline">{item.code}</Badge> : <span className="text-muted-foreground text-sm">—</span>}
                                    </TableCell>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell>{item.type || <span className="text-muted-foreground text-sm">—</span>}</TableCell>
                                    <TableCell>{getPlantName(item.plantId)}</TableCell>
                                    <TableCell>{item.unit || <span className="text-muted-foreground text-sm">—</span>}</TableCell>
                                    <TableCell>
                                        <Badge variant={item.active ? "default" : "secondary"}>
                                            {item.active ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleMutation.mutate({ id: item.id, active: !item.active })}
                                                disabled={toggleMutation.isPending}
                                            >
                                                {item.active ? "Deactivate" : "Activate"}
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
                        <DialogTitle>{editTarget ? "Edit Item" : "Add Item"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5 col-span-2">
                                <label className="text-sm font-medium">Item Name *</label>
                                <Input
                                    placeholder="e.g. Raw Material A"
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Code</label>
                                <Input
                                    placeholder="e.g. RM-001"
                                    value={form.code}
                                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Type</label>
                                <Input
                                    placeholder="e.g. Raw Material, Finished Good"
                                    value={form.type}
                                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
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
                                <label className="text-sm font-medium">Unit</label>
                                <Input
                                    placeholder="e.g. kg, pcs, ltr"
                                    value={form.unit}
                                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeDialog} disabled={isSaving}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving} className="bg-primary text-white">
                            {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                            {editTarget ? "Save Changes" : "Create Item"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
