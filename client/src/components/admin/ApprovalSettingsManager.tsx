import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Users, Settings2 } from "lucide-react";

interface Company {
    id: number;
    name: string;
    shortName?: string;
}

interface Department {
    id: number;
    companyId: number;
    name: string;
}

interface UserOption {
    id: number;
    fullName: string;
    email: string;
    department: string;
}

interface ApprovalSettingRow {
    id: number;
    companyId: number;
    department: string;
    userId: number;
    mode: string;
    userFullName: string | null;
    userEmail: string | null;
}

export function ApprovalSettingsManager() {
    const { toast } = useToast();
    const qc = useQueryClient();

    const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
    const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
    const [addingUserId, setAddingUserId] = useState<string>("");

    // Fetch companies
    const { data: companies = [] } = useQuery<Company[]>({
        queryKey: ["companies"],
        queryFn: () => fetch("/api/companies", { credentials: "include" }).then((r) => r.json()),
    });

    // Fetch departments for selected company
    const { data: departments = [] } = useQuery<Department[]>({
        queryKey: ["departments", selectedCompanyId],
        queryFn: () =>
            fetch(`/api/departments?companyId=${selectedCompanyId}`, { credentials: "include" }).then(
                (r) => r.json()
            ),
        enabled: !!selectedCompanyId,
    });

    // Fetch all users for the selected company (to pick from)
    const { data: users = [] } = useQuery<UserOption[]>({
        queryKey: ["users-list"],
        queryFn: () => fetch("/api/users", { credentials: "include" }).then((r) => r.json()),
    });

    // Fetch approval settings for selected company + dept
    const { data: settings = [], isLoading: settingsLoading } = useQuery<ApprovalSettingRow[]>({
        queryKey: ["approval-settings", selectedCompanyId, selectedDepartment],
        queryFn: () => {
            const params = new URLSearchParams();
            if (selectedCompanyId) params.set("companyId", String(selectedCompanyId));
            if (selectedDepartment) params.set("department", selectedDepartment);
            return fetch(`/api/approval-settings?${params}`, { credentials: "include" }).then((r) =>
                r.json()
            );
        },
        enabled: !!(selectedCompanyId && selectedDepartment),
    });

    const currentMode = settings.length > 0 ? settings[0].mode : "any";

    // Auto-select first company
    React.useEffect(() => {
        if (companies.length > 0 && !selectedCompanyId) {
            setSelectedCompanyId(companies[0].id);
        }
    }, [companies, selectedCompanyId]);

    // Invalidate helper
    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ["approval-settings", selectedCompanyId, selectedDepartment] });
    };

    // Add approver
    const addMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/approval-settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    companyId: selectedCompanyId,
                    department: selectedDepartment,
                    userId: Number(addingUserId),
                    mode: currentMode,
                }),
            });
            if (!res.ok) {
                const e = await res.json();
                throw new Error(e.message || "Failed to add approver");
            }
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Approver added" });
            setAddingUserId("");
            invalidate();
        },
        onError: (e: Error) =>
            toast({ title: "Error", description: e.message, variant: "destructive" }),
    });

    // Remove approver
    const removeMutation = useMutation({
        mutationFn: async (id: number) => {
            await fetch(`/api/approval-settings/${id}`, {
                method: "DELETE",
                credentials: "include",
            });
        },
        onSuccess: () => {
            toast({ title: "Approver removed" });
            invalidate();
        },
        onError: () =>
            toast({ title: "Error removing approver", variant: "destructive" } as any),
    });

    // Change mode
    const modeMutation = useMutation({
        mutationFn: async (mode: "any" | "all") => {
            const res = await fetch("/api/approval-settings/mode", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    companyId: selectedCompanyId,
                    department: selectedDepartment,
                    mode,
                }),
            });
            if (!res.ok) throw new Error("Failed to update mode");
        },
        onSuccess: () => {
            toast({ title: "Approval mode updated" });
            invalidate();
        },
    });

    const existingUserIds = new Set(settings.map((s) => s.userId));
    const availableUsers = users.filter((u) => !existingUserIds.has(u.id));

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <div>
                    <h2 className="text-lg font-semibold">Approval Settings</h2>
                    <p className="text-sm text-muted-foreground">
                        Assign approvers per department — choose ANY (first to approve wins) or ALL (everyone must approve).
                    </p>
                </div>
            </div>

            {/* Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label>Company</Label>
                    <Select
                        value={selectedCompanyId ? String(selectedCompanyId) : ""}
                        onValueChange={(v) => {
                            setSelectedCompanyId(Number(v));
                            setSelectedDepartment(null);
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select company" />
                        </SelectTrigger>
                        <SelectContent>
                            {companies.map((c) => (
                                <SelectItem key={c.id} value={String(c.id)}>
                                    {c.shortName ? `${c.shortName} — ${c.name}` : c.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <Label>Department</Label>
                    <Select
                        value={selectedDepartment ?? ""}
                        onValueChange={(v) => setSelectedDepartment(v)}
                        disabled={!selectedCompanyId}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                            {departments.map((d) => (
                                <SelectItem key={d.id} value={d.name}>
                                    {d.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Settings card — only show after dept is selected */}
            {selectedCompanyId && selectedDepartment && (
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base">
                                    Approvers for <span className="text-primary">{selectedDepartment}</span>
                                </CardTitle>
                                <CardDescription>
                                    {settings.length === 0
                                        ? "No approvers assigned — any user with Approve permission can approve."
                                        : `${settings.length} approver(s) assigned`}
                                </CardDescription>
                            </div>

                            {/* Mode Toggle — only meaningful with 2+ approvers */}
                            {settings.length >= 1 && (
                                <div className="flex items-center gap-2">
                                    <Label className="text-sm">
                                        {currentMode === "all" ? "ALL must approve" : "ANY can approve"}
                                    </Label>
                                    <Switch
                                        checked={currentMode === "all"}
                                        onCheckedChange={(checked) =>
                                            modeMutation.mutate(checked ? "all" : "any")
                                        }
                                    />
                                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                                </div>
                            )}
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {/* Approver list */}
                        {settingsLoading ? (
                            <p className="text-sm text-muted-foreground">Loading…</p>
                        ) : settings.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">No approvers configured for this department.</p>
                        ) : (
                            <div className="space-y-2">
                                {settings.map((s) => (
                                    <div
                                        key={s.id}
                                        className="flex items-center justify-between rounded-md border px-3 py-2"
                                    >
                                        <div>
                                            <p className="text-sm font-medium">{s.userFullName || s.userEmail}</p>
                                            <p className="text-xs text-muted-foreground">{s.userEmail}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs">
                                                {s.mode === "all" ? "Required" : "Any"}
                                            </Badge>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                                onClick={() => removeMutation.mutate(s.id)}
                                                disabled={removeMutation.isPending}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add approver */}
                        <div className="flex items-center gap-2 pt-2 border-t">
                            <Select value={addingUserId} onValueChange={setAddingUserId}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Select user to add as approver…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableUsers.map((u) => (
                                        <SelectItem key={u.id} value={String(u.id)}>
                                            {u.fullName} ({u.email})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                onClick={() => addMutation.mutate()}
                                disabled={!addingUserId || addMutation.isPending}
                                size="sm"
                                className="shrink-0"
                            >
                                <Plus className="h-4 w-4 mr-1" />
                                Add
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
