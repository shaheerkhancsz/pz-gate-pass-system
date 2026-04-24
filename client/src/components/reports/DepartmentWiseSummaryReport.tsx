import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as XLSX from "xlsx";
import {
  Layers,
  FileSpreadsheet,
  TrendingUp,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Company {
  id: number;
  name: string;
  shortName: string | null;
  active: boolean;
}

interface GatePassRow {
  id: number;
  companyId: number | null;
  department: string;
  type: string;
  status: string;
  createdAt: string;
}

interface DeptStats {
  department: string;
  total: number;
  outward: number;
  inward: number;
  returnable: number;
  pending: number;
  hodApproved: number;
  securityAllowed: number;
  completed: number;
  rejected: number;
  sentBack: number;
}

type SortKey = "department" | "total" | "outward" | "inward" | "returnable" | "pending" | "completed" | "rejected";
type SortDir = "asc" | "desc";

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-[60px]">
        <div
          className="bg-indigo-500 h-2 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  current,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th
      className="px-4 py-3 text-center font-medium text-gray-500 text-xs tracking-wider cursor-pointer select-none hover:text-gray-800"
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1 justify-center">
        {label}
        {active ? (
          dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </th>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DepartmentWiseSummaryReport() {
  const { isAdmin, user } = useAuth();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const res = await fetch("/api/companies");
      if (!res.ok) throw new Error("Failed to fetch companies");
      return res.json();
    },
    enabled: isAdmin,
  });

  const activeCompanies = useMemo(() => companies.filter((c) => c.active), [companies]);

  // Build URL — for admin, pass optional companyId filter; for non-admin, server auto-filters
  const passesUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "10000");
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (isAdmin && selectedCompanyId !== "all") params.set("companyId", selectedCompanyId);
    return `/api/gate-passes?${params.toString()}`;
  }, [dateFrom, dateTo, isAdmin, selectedCompanyId]);

  const { data: gatePasses = [], isLoading } = useQuery<GatePassRow[]>({
    queryKey: ["/api/gate-passes", "dept-summary", dateFrom, dateTo, selectedCompanyId],
    queryFn: async () => {
      const res = await fetch(passesUrl);
      if (!res.ok) throw new Error("Failed to fetch gate passes");
      return res.json();
    },
  });

  // Aggregate by department
  const allDeptStats = useMemo((): DeptStats[] => {
    const agg = new Map<string, DeptStats>();

    gatePasses.forEach((pass) => {
      const dept = pass.department?.trim() || "—";
      if (!agg.has(dept)) {
        agg.set(dept, {
          department: dept,
          total: 0,
          outward: 0,
          inward: 0,
          returnable: 0,
          pending: 0,
          hodApproved: 0,
          securityAllowed: 0,
          completed: 0,
          rejected: 0,
          sentBack: 0,
        });
      }
      const row = agg.get(dept)!;
      row.total += 1;
      if (pass.type === "outward") row.outward += 1;
      else if (pass.type === "inward") row.inward += 1;
      else if (pass.type === "returnable") row.returnable += 1;

      if (pass.status === "pending") row.pending += 1;
      else if (pass.status === "hod_approved") row.hodApproved += 1;
      else if (pass.status === "security_allowed") row.securityAllowed += 1;
      else if (pass.status === "completed") row.completed += 1;
      else if (pass.status === "rejected") row.rejected += 1;
      else if (pass.status === "sent_back") row.sentBack += 1;
    });

    return Array.from(agg.values());
  }, [gatePasses]);

  const grandTotal = gatePasses.length;

  // Search filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? allDeptStats.filter((r) => r.department.toLowerCase().includes(q)) : allDeptStats;
  }, [allDeptStats, search]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "department") {
        cmp = a.department.localeCompare(b.department);
      } else {
        cmp = (a[sortKey] as number) - (b[sortKey] as number);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // KPIs
  const totalPending = useMemo(
    () => allDeptStats.reduce((s, r) => s + r.pending + r.hodApproved + r.sentBack, 0),
    [allDeptStats]
  );
  const totalCompleted = useMemo(
    () => allDeptStats.reduce((s, r) => s + r.completed, 0),
    [allDeptStats]
  );
  const mostActive = useMemo(
    () =>
      [...allDeptStats].sort((a, b) => b.total - a.total)[0]?.department ?? "—",
    [allDeptStats]
  );

  const exportToExcel = () => {
    if (!sorted.length) return;

    const rows = sorted.map((r) => ({
      "Department": r.department,
      "Total Passes": r.total,
      "Share %": grandTotal > 0 ? `${Math.round((r.total / grandTotal) * 100)}%` : "0%",
      "Outward": r.outward,
      "Inward": r.inward,
      "Returnable": r.returnable,
      "Pending HOD": r.pending,
      "HOD Approved (Pending Security)": r.hodApproved,
      "Security Allowed": r.securityAllowed,
      "Completed": r.completed,
      "Rejected": r.rejected,
      "Sent Back": r.sentBack,
    }));

    rows.push({
      "Department": "TOTAL",
      "Total Passes": grandTotal,
      "Share %": "100%",
      "Outward": allDeptStats.reduce((s, r) => s + r.outward, 0),
      "Inward": allDeptStats.reduce((s, r) => s + r.inward, 0),
      "Returnable": allDeptStats.reduce((s, r) => s + r.returnable, 0),
      "Pending HOD": allDeptStats.reduce((s, r) => s + r.pending, 0),
      "HOD Approved (Pending Security)": allDeptStats.reduce((s, r) => s + r.hodApproved, 0),
      "Security Allowed": allDeptStats.reduce((s, r) => s + r.securityAllowed, 0),
      "Completed": totalCompleted,
      "Rejected": allDeptStats.reduce((s, r) => s + r.rejected, 0),
      "Sent Back": allDeptStats.reduce((s, r) => s + r.sentBack, 0),
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Department Summary");
    XLSX.writeFile(wb, `Department_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            {isAdmin && (
              <div>
                <Label className="text-xs">Company</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger className="mt-1 h-9 w-48">
                    <SelectValue placeholder="All Companies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {activeCompanies.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.shortName ?? c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">From Date</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 h-9 w-40"
              />
            </div>
            <div>
              <Label className="text-xs">To Date</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 h-9 w-40"
              />
            </div>
            <div>
              <Label className="text-xs">Search Department</Label>
              <Input
                placeholder="Filter departments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1 h-9 w-48"
              />
            </div>
            {(dateFrom || dateTo || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setDateFrom(""); setDateTo(""); setSearch(""); }}
                className="self-end"
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-indigo-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Total Passes</span>
              <ClipboardList className="h-5 w-5 text-indigo-500" />
            </div>
            <div className="text-3xl font-bold">{grandTotal}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Pending Approvals</span>
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="text-3xl font-bold">{totalPending}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Completed</span>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-3xl font-bold">{totalCompleted}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Most Active Dept</span>
              <TrendingUp className="h-5 w-5 text-purple-500" />
            </div>
            <div className="text-sm font-bold leading-tight mt-1 truncate" title={mostActive}>
              {mostActive}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Department-wise Breakdown
            {sorted.length !== allDeptStats.length && (
              <Badge variant="outline" className="ml-2 text-xs font-normal">
                {sorted.length} of {allDeptStats.length} departments
              </Badge>
            )}
            {allDeptStats.length > 0 && sorted.length === allDeptStats.length && (
              <Badge variant="outline" className="ml-2 text-xs font-normal">
                {allDeptStats.length} departments
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            disabled={!sorted.length}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center p-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No data found for the selected filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th
                      className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider cursor-pointer select-none hover:text-gray-800"
                      onClick={() => handleSort("department")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Department
                        {sortKey === "department" ? (
                          sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </span>
                    </th>
                    <SortHeader label="Total" sortKey="total" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider min-w-[120px]">Share</th>
                    <SortHeader label="Outward" sortKey="outward" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader label="Inward" sortKey="inward" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader label="Returnable" sortKey="returnable" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader label="Pending" sortKey="pending" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs tracking-wider">HOD Appr.</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs tracking-wider">Sec. Allow.</th>
                    <SortHeader label="Completed" sortKey="completed" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader label="Rejected" sortKey="rejected" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs tracking-wider">Sent Back</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {sorted.map((row) => (
                    <tr key={row.department} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{row.department}</td>
                      <td className="px-4 py-3 text-center font-semibold">{row.total}</td>
                      <td className="px-4 py-3">
                        <MiniBar value={row.total} max={grandTotal} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.outward > 0
                          ? <StatusPill label={String(row.outward)} color="bg-blue-50 text-blue-700" />
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.inward > 0
                          ? <StatusPill label={String(row.inward)} color="bg-indigo-50 text-indigo-700" />
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.returnable > 0
                          ? <StatusPill label={String(row.returnable)} color="bg-purple-50 text-purple-700" />
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.pending > 0
                          ? <StatusPill label={String(row.pending)} color="bg-yellow-50 text-yellow-700" />
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.hodApproved > 0
                          ? <StatusPill label={String(row.hodApproved)} color="bg-orange-50 text-orange-700" />
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.securityAllowed > 0
                          ? <StatusPill label={String(row.securityAllowed)} color="bg-teal-50 text-teal-700" />
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.completed > 0
                          ? <StatusPill label={String(row.completed)} color="bg-green-50 text-green-700" />
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.rejected > 0
                          ? <StatusPill label={String(row.rejected)} color="bg-red-50 text-red-700" />
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.sentBack > 0
                          ? <StatusPill label={String(row.sentBack)} color="bg-slate-100 text-slate-600" />
                          : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Totals footer */}
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 font-semibold text-sm">
                    <td className="px-4 py-3 text-gray-700">
                      Total
                      {search && (
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          (filtered)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {sorted.reduce((s, r) => s + r.total, 0)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400">
                        {grandTotal > 0
                          ? `${Math.round((sorted.reduce((s, r) => s + r.total, 0) / grandTotal) * 100)}%`
                          : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{sorted.reduce((s, r) => s + r.outward, 0)}</td>
                    <td className="px-4 py-3 text-center">{sorted.reduce((s, r) => s + r.inward, 0)}</td>
                    <td className="px-4 py-3 text-center">{sorted.reduce((s, r) => s + r.returnable, 0)}</td>
                    <td className="px-4 py-3 text-center">{sorted.reduce((s, r) => s + r.pending, 0)}</td>
                    <td className="px-4 py-3 text-center">{sorted.reduce((s, r) => s + r.hodApproved, 0)}</td>
                    <td className="px-4 py-3 text-center">{sorted.reduce((s, r) => s + r.securityAllowed, 0)}</td>
                    <td className="px-4 py-3 text-center">{sorted.reduce((s, r) => s + r.completed, 0)}</td>
                    <td className="px-4 py-3 text-center">{sorted.reduce((s, r) => s + r.rejected, 0)}</td>
                    <td className="px-4 py-3 text-center">{sorted.reduce((s, r) => s + r.sentBack, 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
