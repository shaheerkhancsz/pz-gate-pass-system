import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";
import { GitBranch, Building2, AlertCircle, TrendingUp, Loader2, ArrowUpDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GateRow {
  id: number;
  name: string;
  plantId: number | null;
  companyId: number;
  active: boolean;
}

interface PlantRow {
  id: number;
  name: string;
  companyId: number;
  active: boolean;
}

interface CompanyRow {
  id: number;
  name: string;
  shortName: string | null;
}

interface GatePassRow {
  id: number;
  gateId: number | null;
  type: string;
  status: string;
  department: string;
  date: string;
  createdAt: string;
  companyId: number | null;
}

interface GateTrafficRow {
  gateId: number;
  gateName: string;
  plantId: number | null;
  plantName: string;
  companyName: string;
  total: number;
  outward: number;
  inward: number;
  returnable: number;
  completed: number;
  pending: number;
}

interface PlantTrafficRow {
  plantId: number;
  plantName: string;
  companyName: string;
  gateCount: number;
  total: number;
  outward: number;
  inward: number;
  returnable: number;
}

type SortField = "total" | "outward" | "inward" | "returnable";

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GatePlantTrafficReport() {
  const { isAdmin, user } = useAuth();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("total");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: companies = [] } = useQuery<CompanyRow[]>({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const res = await fetch("/api/companies");
      if (!res.ok) throw new Error("Failed to fetch companies");
      return res.json();
    },
    enabled: isAdmin,
  });

  const { data: gates = [], isLoading: gatesLoading } = useQuery<GateRow[]>({
    queryKey: ["/api/gates"],
    queryFn: async () => {
      const res = await fetch("/api/gates");
      if (!res.ok) throw new Error("Failed to fetch gates");
      return res.json();
    },
  });

  const { data: plants = [], isLoading: plantsLoading } = useQuery<PlantRow[]>({
    queryKey: ["/api/plants"],
    queryFn: async () => {
      const res = await fetch("/api/plants");
      if (!res.ok) throw new Error("Failed to fetch plants");
      return res.json();
    },
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.append("limit", "5000");
    if (dateFrom) params.append("dateFrom", dateFrom);
    if (dateTo) params.append("dateTo", dateTo);
    if (selectedCompanyId !== "all") params.append("companyId", selectedCompanyId);
    return params.toString();
  }, [dateFrom, dateTo, selectedCompanyId]);

  const { data: gatePasses = [], isLoading: passesLoading, refetch } = useQuery<GatePassRow[]>({
    queryKey: ["/api/gate-passes", "traffic", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/gate-passes?${queryString}`);
      if (!res.ok) throw new Error("Failed to fetch gate passes");
      return res.json();
    },
  });

  const isLoading = gatesLoading || plantsLoading || passesLoading;

  // ── Lookup maps ───────────────────────────────────────────────────────────

  const gateMap = useMemo(
    () => new Map(gates.map((g) => [g.id, g])),
    [gates]
  );

  const plantMap = useMemo(
    () => new Map(plants.map((p) => [p.id, p])),
    [plants]
  );

  const companyMap = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies]
  );

  // ── Aggregation ───────────────────────────────────────────────────────────

  const { gateTraffic, plantTraffic, unassignedCount } = useMemo(() => {
    const gateAgg = new Map<number, GateTrafficRow>();
    let unassigned = 0;

    for (const pass of gatePasses) {
      if (!pass.gateId) {
        unassigned++;
        continue;
      }

      const gate = gateMap.get(pass.gateId);
      if (!gate) {
        unassigned++;
        continue;
      }

      const plant = gate.plantId ? plantMap.get(gate.plantId) : null;
      const company = companyMap.get(gate.companyId);
      const companyName = company ? (company.shortName || company.name) : `Company ${gate.companyId}`;
      const plantName = plant ? plant.name : "No Plant";

      if (!gateAgg.has(pass.gateId)) {
        gateAgg.set(pass.gateId, {
          gateId: pass.gateId,
          gateName: gate.name,
          plantId: gate.plantId,
          plantName,
          companyName,
          total: 0,
          outward: 0,
          inward: 0,
          returnable: 0,
          completed: 0,
          pending: 0,
        });
      }

      const row = gateAgg.get(pass.gateId)!;
      row.total++;
      if (pass.type === "outward") row.outward++;
      else if (pass.type === "inward") row.inward++;
      else if (pass.type === "returnable") row.returnable++;
      if (pass.status === "completed") row.completed++;
      else if (["pending", "hod_approved", "sent_back"].includes(pass.status)) row.pending++;
    }

    // Plant aggregation from gate traffic
    const plantAgg = new Map<number, PlantTrafficRow>();

    for (const gRow of gateAgg.values()) {
      if (gRow.plantId === null) continue;
      const plant = plantMap.get(gRow.plantId);
      if (!plant) continue;
      const company = companyMap.get(plant.companyId);
      const companyName = company ? (company.shortName || company.name) : `Company ${plant.companyId}`;

      if (!plantAgg.has(gRow.plantId)) {
        plantAgg.set(gRow.plantId, {
          plantId: gRow.plantId,
          plantName: plant.name,
          companyName,
          gateCount: 0,
          total: 0,
          outward: 0,
          inward: 0,
          returnable: 0,
        });
      }

      const pRow = plantAgg.get(gRow.plantId)!;
      pRow.total += gRow.total;
      pRow.outward += gRow.outward;
      pRow.inward += gRow.inward;
      pRow.returnable += gRow.returnable;
      pRow.gateCount++;
    }

    return {
      gateTraffic: [...gateAgg.values()],
      plantTraffic: [...plantAgg.values()],
      unassignedCount: unassigned,
    };
  }, [gatePasses, gateMap, plantMap, companyMap]);

  // Sorted gate traffic
  const sortedGateTraffic = useMemo(() => {
    return [...gateTraffic].sort((a, b) =>
      sortDir === "desc" ? b[sortField] - a[sortField] : a[sortField] - b[sortField]
    );
  }, [gateTraffic, sortField, sortDir]);

  const sortedPlantTraffic = useMemo(() => {
    return [...plantTraffic].sort((a, b) => b.total - a.total);
  }, [plantTraffic]);

  const mostActiveGate = sortedGateTraffic[0];
  const mostActivePlant = sortedPlantTraffic[0];

  // ── Toggle sort ───────────────────────────────────────────────────────────

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  // ── Export ────────────────────────────────────────────────────────────────

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Gate sheet
    const gateWs = XLSX.utils.json_to_sheet(
      sortedGateTraffic.map((r) => ({
        "Gate Name": r.gateName,
        "Plant": r.plantName,
        "Company": r.companyName,
        "Total": r.total,
        "Outward": r.outward,
        "Inward": r.inward,
        "Returnable": r.returnable,
        "Completed": r.completed,
        "Pending": r.pending,
      }))
    );
    XLSX.utils.book_append_sheet(wb, gateWs, "Gate Traffic");

    // Plant sheet
    const plantWs = XLSX.utils.json_to_sheet(
      sortedPlantTraffic.map((r) => ({
        "Plant Name": r.plantName,
        "Company": r.companyName,
        "Gates Active": r.gateCount,
        "Total": r.total,
        "Outward": r.outward,
        "Inward": r.inward,
        "Returnable": r.returnable,
      }))
    );
    XLSX.utils.book_append_sheet(wb, plantWs, "Plant Traffic");

    XLSX.writeFile(wb, `Gate_Plant_Traffic_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider cursor-pointer select-none hover:text-gray-700"
      onClick={() => toggleSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "text-primary" : "opacity-40"}`} />
      </span>
    </th>
  );

  return (
    <div className="space-y-6">

      {/* ── Filters ── */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs">From Date</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 h-9" />
            </div>
            <div>
              <Label className="text-xs">To Date</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 h-9" />
            </div>
            {isAdmin && (
              <div>
                <Label className="text-xs">Company</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue placeholder="All Companies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.name} {c.shortName ? `(${c.shortName})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-end">
              <Button variant="outline" size="sm" className="h-9 w-full" onClick={() => refetch()}>
                <span className="material-icons text-sm mr-2">refresh</span>
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Active Gates</span>
              <GitBranch className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold">{gateTraffic.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {gates.length} total configured
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Most Active Gate</span>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-xl font-bold truncate">
              {mostActiveGate ? mostActiveGate.gateName : "—"}
            </div>
            {mostActiveGate && (
              <p className="text-xs text-muted-foreground mt-1">
                {mostActiveGate.total} passes
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Active Plants</span>
              <Building2 className="h-5 w-5 text-purple-500" />
            </div>
            <div className="text-3xl font-bold">{plantTraffic.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {plants.length} total configured
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">No Gate Assigned</span>
              <AlertCircle className="h-5 w-5 text-orange-500" />
            </div>
            <div className="text-3xl font-bold">{unassignedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              passes without gate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Gate Traffic Table ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-medium">Gate-wise Traffic</CardTitle>
            <Badge variant="secondary">{sortedGateTraffic.length} gates</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={exportToExcel} disabled={!sortedGateTraffic.length}>
            <span className="material-icons text-sm mr-2">description</span>
            Export Excel
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sortedGateTraffic.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <GitBranch className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No gate traffic data</p>
              <p className="text-sm mt-1">Gate passes with assigned gates will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Gate</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Plant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Company</th>
                    <SortHeader field="total" label="Total" />
                    <SortHeader field="outward" label="Outward" />
                    <SortHeader field="inward" label="Inward" />
                    <SortHeader field="returnable" label="Returnable" />
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Completed</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {sortedGateTraffic.map((row) => {
                    const completionRate = row.total > 0
                      ? Math.round((row.completed / row.total) * 100)
                      : 0;
                    return (
                      <tr key={row.gateId} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium">{row.gateName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{row.plantName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{row.companyName}</td>
                        <td className="px-4 py-3 text-sm font-semibold">{row.total}</td>
                        <td className="px-4 py-3 text-sm text-blue-600">{row.outward}</td>
                        <td className="px-4 py-3 text-sm text-green-600">{row.inward}</td>
                        <td className="px-4 py-3 text-sm text-purple-600">{row.returnable}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="text-green-700">{row.completed}</span>
                          <span className="text-xs text-muted-foreground ml-1">({completionRate}%)</span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {row.pending > 0 ? (
                            <Badge variant="secondary" className="text-xs">{row.pending}</Badge>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {sortedGateTraffic.length > 1 && (
                  <tfoot className="bg-slate-50 border-t font-semibold">
                    <tr>
                      <td className="px-4 py-2 text-sm" colSpan={3}>Total</td>
                      <td className="px-4 py-2 text-sm">{sortedGateTraffic.reduce((s, r) => s + r.total, 0)}</td>
                      <td className="px-4 py-2 text-sm text-blue-600">{sortedGateTraffic.reduce((s, r) => s + r.outward, 0)}</td>
                      <td className="px-4 py-2 text-sm text-green-600">{sortedGateTraffic.reduce((s, r) => s + r.inward, 0)}</td>
                      <td className="px-4 py-2 text-sm text-purple-600">{sortedGateTraffic.reduce((s, r) => s + r.returnable, 0)}</td>
                      <td className="px-4 py-2 text-sm text-green-700">{sortedGateTraffic.reduce((s, r) => s + r.completed, 0)}</td>
                      <td className="px-4 py-2 text-sm">{sortedGateTraffic.reduce((s, r) => s + r.pending, 0)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Plant Traffic Table ── */}
      <Card>
        <CardHeader className="py-4 px-6 border-b">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-medium">Plant-wise Traffic</CardTitle>
            <Badge variant="secondary">{sortedPlantTraffic.length} plants</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sortedPlantTraffic.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No plant traffic data</p>
              <p className="text-sm mt-1">Gates must be assigned to plants to see plant-level traffic.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Plant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Gates</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Outward</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Inward</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Returnable</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {sortedPlantTraffic.map((row) => {
                    const totalAll = sortedPlantTraffic.reduce((s, r) => s + r.total, 0);
                    const share = totalAll > 0 ? ((row.total / totalAll) * 100).toFixed(1) : "0.0";
                    return (
                      <tr key={row.plantId} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium">{row.plantName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{row.companyName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{row.gateCount}</td>
                        <td className="px-4 py-3 text-sm font-semibold">{row.total}</td>
                        <td className="px-4 py-3 text-sm text-blue-600">{row.outward}</td>
                        <td className="px-4 py-3 text-sm text-green-600">{row.inward}</td>
                        <td className="px-4 py-3 text-sm text-purple-600">{row.returnable}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-primary h-1.5 rounded-full"
                                style={{ width: `${share}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{share}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
