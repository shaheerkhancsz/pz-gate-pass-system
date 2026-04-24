import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import * as XLSX from "xlsx";
import { AlertCircle, Clock, RotateCcw, Eye, Pencil, Loader2, Timer, TrendingUp, CheckCircle2 } from "lucide-react";

interface GatePassRow {
  id: number;
  gatePassNumber: string;
  date: string;
  type: string;
  department: string;
  createdBy: string;
  createdAt: string;
  hodApprovedAt?: string;
  securityAllowedAt?: string;
  updatedAt: string;
  status: string;
  customerName: string;
  remarks?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getAgeDays(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function getAgeLabel(days: number): { label: string; className: string } {
  if (days === 0) return { label: "Today", className: "text-green-600" };
  if (days === 1) return { label: "1 day", className: "text-yellow-600" };
  if (days <= 3) return { label: `${days} days`, className: "text-orange-500 font-medium" };
  return { label: `${days} days`, className: "text-red-600 font-semibold" };
}

function stageLabel(status: string): string {
  switch (status) {
    case "pending": return "Awaiting HOD";
    case "hod_approved": return "Awaiting Security";
    case "sent_back": return "Sent Back";
    default: return status;
  }
}

function stageBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "pending": return "secondary";
    case "hod_approved": return "default";
    case "sent_back": return "destructive";
    default: return "outline";
  }
}

/** Convert milliseconds to a human-readable duration string */
function msToDuration(ms: number): string {
  if (ms < 0) return "-";
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return "< 1 hr";
  if (hours < 24) return `${Math.round(hours)} hr${Math.round(hours) !== 1 ? "s" : ""}`;
  const days = hours / 24;
  if (days < 1.5) return "1 day";
  return `${days.toFixed(1)} days`;
}

function diffMs(from?: string, to?: string): number | null {
  if (!from || !to) return null;
  const diff = new Date(to).getTime() - new Date(from).getTime();
  return diff > 0 ? diff : null;
}

function avgMs(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && v > 0);
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PendingApprovalsReport() {
  const [showCycleDetails, setShowCycleDetails] = useState(false);

  // Current pending passes (3 stages)
  const { data: pendingData = [], isLoading: l1 } = useQuery<GatePassRow[]>({
    queryKey: ["/api/gate-passes", "pending"],
    queryFn: async () => {
      const res = await fetch("/api/gate-passes?status=pending&limit=500");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: hodApprovedData = [], isLoading: l2 } = useQuery<GatePassRow[]>({
    queryKey: ["/api/gate-passes", "hod_approved"],
    queryFn: async () => {
      const res = await fetch("/api/gate-passes?status=hod_approved&limit=500");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: sentBackData = [], isLoading: l3 } = useQuery<GatePassRow[]>({
    queryKey: ["/api/gate-passes", "sent_back"],
    queryFn: async () => {
      const res = await fetch("/api/gate-passes?status=sent_back&limit=500");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Completed passes for cycle time analytics (last 100)
  const { data: completedData = [], isLoading: l4 } = useQuery<GatePassRow[]>({
    queryKey: ["/api/gate-passes", "completed-cycle"],
    queryFn: async () => {
      const res = await fetch("/api/gate-passes?status=completed&limit=100&sortBy=createdAt&sortOrder=desc");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const isLoading = l1 || l2 || l3;
  const isCycleLoading = l4;

  const allPending = useMemo(() => {
    return [...pendingData, ...hodApprovedData, ...sentBackData].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [pendingData, hodApprovedData, sentBackData]);

  // Cycle time calculations from completed passes
  const cycleStats = useMemo(() => {
    const withHOD = completedData.filter((p) => p.hodApprovedAt);
    const withSecurity = completedData.filter((p) => p.hodApprovedAt && p.securityAllowedAt);
    const withTotal = completedData.filter((p) => p.securityAllowedAt);

    const hodWaits = withHOD.map((p) => diffMs(p.createdAt, p.hodApprovedAt));
    const secWaits = withSecurity.map((p) => diffMs(p.hodApprovedAt, p.securityAllowedAt));
    const totalCycles = withTotal.map((p) => diffMs(p.createdAt, p.securityAllowedAt));

    return {
      avgHOD: avgMs(hodWaits),
      avgSecurity: avgMs(secWaits),
      avgTotal: avgMs(totalCycles),
      sampleSize: withTotal.length,
      // Slowest 10 for detail table
      slowest: [...completedData]
        .filter((p) => p.securityAllowedAt)
        .map((p) => ({
          ...p,
          hodMs: diffMs(p.createdAt, p.hodApprovedAt),
          secMs: diffMs(p.hodApprovedAt, p.securityAllowedAt),
          totalMs: diffMs(p.createdAt, p.securityAllowedAt),
        }))
        .sort((a, b) => (b.totalMs ?? 0) - (a.totalMs ?? 0))
        .slice(0, 10),
    };
  }, [completedData]);

  // ── Exports ────────────────────────────────────────────────────────────────

  const exportPendingToExcel = () => {
    if (!allPending.length) return;
    const ws = XLSX.utils.json_to_sheet(
      allPending.map((pass) => ({
        "Gate Pass No.": pass.gatePassNumber,
        "Date": formatDate(pass.date),
        "Type": (pass.type || "outward").charAt(0).toUpperCase() + (pass.type || "outward").slice(1),
        "Customer": pass.customerName,
        "Department": pass.department,
        "Stage": stageLabel(pass.status),
        "Requested By": pass.createdBy,
        "Days Waiting": getAgeDays(pass.createdAt),
        "Remarks": pass.remarks || "-",
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pending Approvals");
    XLSX.writeFile(wb, `Pending_Approvals_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportCycleToExcel = () => {
    if (!cycleStats.slowest.length) return;
    const ws = XLSX.utils.json_to_sheet(
      cycleStats.slowest.map((p) => ({
        "Gate Pass No.": p.gatePassNumber,
        "Date": formatDate(p.date),
        "Type": (p.type || "outward").charAt(0).toUpperCase() + (p.type || "outward").slice(1),
        "Department": p.department,
        "HOD Stage": msToDuration(p.hodMs ?? -1),
        "Security Stage": msToDuration(p.secMs ?? -1),
        "Total Cycle Time": msToDuration(p.totalMs ?? -1),
        "Completed By": p.createdBy,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cycle Times");
    XLSX.writeFile(wb, `Approval_Cycle_Times_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── KPI Cards ──────────────────────────────────────────────────────────────

  const pendingKpis = [
    { label: "Awaiting HOD", count: pendingData.length, icon: <Clock className="h-5 w-5 text-yellow-500" />, color: "border-l-yellow-400" },
    { label: "Awaiting Security", count: hodApprovedData.length, icon: <AlertCircle className="h-5 w-5 text-blue-500" />, color: "border-l-blue-400" },
    { label: "Sent Back", count: sentBackData.length, icon: <RotateCcw className="h-5 w-5 text-orange-500" />, color: "border-l-orange-400" },
    { label: "Total Pending", count: allPending.length, icon: <AlertCircle className="h-5 w-5 text-red-500" />, color: "border-l-red-400" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Section 1: Pending Queue KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {pendingKpis.map((card) => (
          <Card key={card.label} className={`border-l-4 ${card.color}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">{card.label}</span>
                {card.icon}
              </div>
              <div className="text-3xl font-bold">{card.count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Section 2: Approval Cycle Time ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-medium">Approval Cycle Time</CardTitle>
            {cycleStats.sampleSize > 0 && (
              <Badge variant="secondary" className="text-xs">
                Based on last {cycleStats.sampleSize} completed
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowCycleDetails(!showCycleDetails)}>
              {showCycleDetails ? "Hide Details" : "Show Details"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCycleToExcel} disabled={!cycleStats.slowest.length}>
              <span className="material-icons text-sm mr-2">description</span>
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4 px-6 pb-6">
          {isCycleLoading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : cycleStats.sampleSize === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No completed gate passes yet — cycle time will appear here once passes complete the workflow.
            </p>
          ) : (
            <>
              {/* Cycle time summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <Card className="bg-yellow-50 border-yellow-200">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Clock className="h-8 w-8 text-yellow-500 shrink-0" />
                    <div>
                      <p className="text-xs text-yellow-700 font-medium uppercase tracking-wide">Avg HOD Stage</p>
                      <p className="text-2xl font-bold text-yellow-800">
                        {cycleStats.avgHOD !== null ? msToDuration(cycleStats.avgHOD) : "—"}
                      </p>
                      <p className="text-xs text-yellow-600 mt-0.5">Creation → HOD approval</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4 flex items-center gap-3">
                    <TrendingUp className="h-8 w-8 text-blue-500 shrink-0" />
                    <div>
                      <p className="text-xs text-blue-700 font-medium uppercase tracking-wide">Avg Security Stage</p>
                      <p className="text-2xl font-bold text-blue-800">
                        {cycleStats.avgSecurity !== null ? msToDuration(cycleStats.avgSecurity) : "—"}
                      </p>
                      <p className="text-xs text-blue-600 mt-0.5">HOD approval → Security</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4 flex items-center gap-3">
                    <CheckCircle2 className="h-8 w-8 text-green-500 shrink-0" />
                    <div>
                      <p className="text-xs text-green-700 font-medium uppercase tracking-wide">Avg Total Cycle</p>
                      <p className="text-2xl font-bold text-green-800">
                        {cycleStats.avgTotal !== null ? msToDuration(cycleStats.avgTotal) : "—"}
                      </p>
                      <p className="text-xs text-green-600 mt-0.5">Creation → Security allowed</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Cycle detail table (slowest passes) */}
              {showCycleDetails && cycleStats.slowest.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">
                    Slowest Completed Gate Passes (Top 10)
                  </p>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full whitespace-nowrap text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b">
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Gate Pass No.</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Department</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 text-yellow-700">HOD Stage</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 text-blue-700">Security Stage</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 text-green-700">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y bg-white">
                        {cycleStats.slowest.map((pass) => (
                          <tr key={pass.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2 font-medium">{pass.gatePassNumber}</td>
                            <td className="px-4 py-2 text-gray-600">{formatDate(pass.date)}</td>
                            <td className="px-4 py-2 capitalize text-gray-600">{pass.type || "outward"}</td>
                            <td className="px-4 py-2 text-gray-600">{pass.department}</td>
                            <td className="px-4 py-2 text-yellow-700 font-medium">{msToDuration(pass.hodMs ?? -1)}</td>
                            <td className="px-4 py-2 text-blue-700 font-medium">{msToDuration(pass.secMs ?? -1)}</td>
                            <td className="px-4 py-2 text-green-700 font-semibold">{msToDuration(pass.totalMs ?? -1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Section 3: Pending Queue Table ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b">
          <CardTitle className="text-base font-medium">Pending Gate Passes</CardTitle>
          <Button variant="outline" size="sm" onClick={exportPendingToExcel} disabled={!allPending.length}>
            <span className="material-icons text-sm mr-2">description</span>
            Export Excel
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : allPending.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No pending gate passes</p>
              <p className="text-sm mt-1">All gate passes have been processed.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Gate Pass No.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Stage</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Requested By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Waiting</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {allPending.map((pass) => {
                    const ageDays = getAgeDays(pass.createdAt);
                    const { label: ageLabel, className: ageClass } = getAgeLabel(ageDays);
                    return (
                      <tr key={pass.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium">{pass.gatePassNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(pass.date)}</td>
                        <td className="px-4 py-3 text-sm capitalize text-gray-600">{pass.type || "outward"}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{pass.department}</td>
                        <td className="px-4 py-3 text-sm">
                          <Badge variant={stageBadgeVariant(pass.status)} className="text-xs">
                            {stageLabel(pass.status)}
                          </Badge>
                          {pass.remarks && pass.status === "sent_back" && (
                            <p className="text-xs text-orange-600 mt-1 max-w-xs truncate" title={pass.remarks}>
                              {pass.remarks}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{pass.createdBy}</td>
                        <td className={`px-4 py-3 text-sm ${ageClass}`}>{ageLabel}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => window.open(`/view-gate-pass/${pass.id}`, "_blank")}
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => window.open(`/edit-gate-pass/${pass.id}`, "_blank")}
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
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
