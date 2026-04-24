import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as XLSX from "xlsx";
import {
  Building2,
  FileSpreadsheet,
  TrendingUp,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldOff,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Company {
  id: number;
  name: string;
  shortName: string | null;
  code: string | null;
  active: boolean;
}

interface GatePassRow {
  id: number;
  companyId: number | null;
  type: string;
  status: string;
  createdAt: string;
}

interface CompanyStats {
  company: Company;
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
  sharePercent: number;
}

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
          className="bg-blue-500 h-2 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CompanyWiseSummaryReport() {
  const { isAdmin, user } = useAuth();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Only admins can access this report
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldOff className="h-12 w-12 text-muted-foreground mb-4 opacity-40" />
        <p className="text-lg font-medium text-muted-foreground">Admin Access Required</p>
        <p className="text-sm text-muted-foreground mt-1">
          This report is only available to administrators.
        </p>
      </div>
    );
  }

  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const res = await fetch("/api/companies");
      if (!res.ok) throw new Error("Failed to fetch companies");
      return res.json();
    },
  });

  // Build URL for gate passes — no companyId filter so admin gets all
  const passesUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "10000");
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return `/api/gate-passes?${params.toString()}`;
  }, [dateFrom, dateTo]);

  const { data: gatePasses = [], isLoading: passesLoading } = useQuery<GatePassRow[]>({
    queryKey: ["/api/gate-passes", "company-summary", dateFrom, dateTo],
    queryFn: async () => {
      const res = await fetch(passesUrl);
      if (!res.ok) throw new Error("Failed to fetch gate passes");
      return res.json();
    },
  });

  const isLoading = companiesLoading || passesLoading;

  // Build a map: companyId → company
  const companyMap = useMemo(() => {
    const m = new Map<number, Company>();
    companies.forEach((c) => m.set(c.id, c));
    return m;
  }, [companies]);

  // Aggregate gate passes by company
  const companyStats = useMemo((): CompanyStats[] => {
    const agg = new Map<number, Omit<CompanyStats, "company" | "sharePercent">>();

    // Initialise a row for each active company (so companies with 0 passes still appear)
    companies
      .filter((c) => c.active)
      .forEach((c) => {
        agg.set(c.id, {
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
      });

    gatePasses.forEach((pass) => {
      const cid = pass.companyId ?? 0;
      if (!agg.has(cid)) {
        // Unknown/unassigned company — skip for now
        return;
      }
      const row = agg.get(cid)!;
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

    const grandTotal = gatePasses.length;

    return Array.from(agg.entries())
      .map(([cid, data]) => ({
        company: companyMap.get(cid)!,
        ...data,
        sharePercent: grandTotal > 0 ? Math.round((data.total / grandTotal) * 100) : 0,
      }))
      .filter((r) => r.company != null)
      .sort((a, b) => b.total - a.total);
  }, [companies, gatePasses, companyMap]);

  const grandTotal = useMemo(() => gatePasses.length, [gatePasses]);
  const totalPending = useMemo(
    () => companyStats.reduce((s, r) => s + r.pending + r.hodApproved + r.sentBack, 0),
    [companyStats]
  );
  const totalCompleted = useMemo(
    () => companyStats.reduce((s, r) => s + r.completed, 0),
    [companyStats]
  );
  const mostActive = useMemo(
    () => (companyStats[0]?.total > 0 ? companyStats[0]?.company?.name : "—"),
    [companyStats]
  );

  const exportToExcel = () => {
    if (!companyStats.length) return;

    const rows = companyStats.map((r) => ({
      "Company": r.company.name,
      "Short Name": r.company.shortName ?? "—",
      "Code": r.company.code ?? "—",
      "Total Passes": r.total,
      "Share %": `${r.sharePercent}%`,
      "Outward": r.outward,
      "Inward": r.inward,
      "Returnable": r.returnable,
      "Pending HOD": r.pending,
      "Pending Security": r.hodApproved,
      "Sent Back": r.sentBack,
      "Completed": r.completed,
      "Rejected": r.rejected,
    }));

    // Totals row
    rows.push({
      "Company": "TOTAL",
      "Short Name": "",
      "Code": "",
      "Total Passes": grandTotal,
      "Share %": "100%",
      "Outward": companyStats.reduce((s, r) => s + r.outward, 0),
      "Inward": companyStats.reduce((s, r) => s + r.inward, 0),
      "Returnable": companyStats.reduce((s, r) => s + r.returnable, 0),
      "Pending HOD": companyStats.reduce((s, r) => s + r.pending, 0),
      "Pending Security": companyStats.reduce((s, r) => s + r.hodApproved, 0),
      "Sent Back": companyStats.reduce((s, r) => s + r.sentBack, 0),
      "Completed": totalCompleted,
      "Rejected": companyStats.reduce((s, r) => s + r.rejected, 0),
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Company Summary");
    XLSX.writeFile(wb, `Company_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
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
            {(dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setDateFrom(""); setDateTo(""); }}
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
        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Total Passes</span>
              <ClipboardList className="h-5 w-5 text-blue-500" />
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
              <span className="text-sm text-muted-foreground">Most Active</span>
              <TrendingUp className="h-5 w-5 text-purple-500" />
            </div>
            <div className="text-lg font-bold leading-tight mt-1">{mostActive}</div>
          </CardContent>
        </Card>
      </div>

      {/* Company Breakdown Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Company-wise Breakdown
            {(dateFrom || dateTo) && (
              <Badge variant="outline" className="ml-2 text-xs font-normal">
                {dateFrom || "—"} → {dateTo || "—"}
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            disabled={!companyStats.length}
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
          ) : companyStats.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No data found for the selected period.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Company</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs tracking-wider">Total</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider min-w-[120px]">Share</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs tracking-wider">Outward</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs tracking-wider">Inward</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs tracking-wider">Returnable</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs tracking-wider">Pending</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs tracking-wider">HOD Appr.</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs tracking-wider">Sec. Allow.</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs tracking-wider">Completed</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs tracking-wider">Rejected</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs tracking-wider">Sent Back</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {companyStats.map((row) => (
                    <tr key={row.company.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.company.name}</div>
                        {row.company.shortName && (
                          <div className="text-xs text-muted-foreground">{row.company.shortName}</div>
                        )}
                        {row.company.code && (
                          <Badge variant="outline" className="text-xs mt-0.5">{row.company.code}</Badge>
                        )}
                      </td>
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
                    <td className="px-4 py-3 text-gray-700">Total</td>
                    <td className="px-4 py-3 text-center">{grandTotal}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400">100%</span>
                    </td>
                    <td className="px-4 py-3 text-center">{companyStats.reduce((s, r) => s + r.outward, 0)}</td>
                    <td className="px-4 py-3 text-center">{companyStats.reduce((s, r) => s + r.inward, 0)}</td>
                    <td className="px-4 py-3 text-center">{companyStats.reduce((s, r) => s + r.returnable, 0)}</td>
                    <td className="px-4 py-3 text-center">{companyStats.reduce((s, r) => s + r.pending, 0)}</td>
                    <td className="px-4 py-3 text-center">{companyStats.reduce((s, r) => s + r.hodApproved, 0)}</td>
                    <td className="px-4 py-3 text-center">{companyStats.reduce((s, r) => s + r.securityAllowed, 0)}</td>
                    <td className="px-4 py-3 text-center">{totalCompleted}</td>
                    <td className="px-4 py-3 text-center">{companyStats.reduce((s, r) => s + r.rejected, 0)}</td>
                    <td className="px-4 py-3 text-center">{companyStats.reduce((s, r) => s + r.sentBack, 0)}</td>
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
