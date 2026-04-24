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
  Activity,
  FileSpreadsheet,
  Users,
  LogIn,
  TrendingUp,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActivityLog {
  id: number;
  userId: number | null;
  userEmail: string;
  actionType: string;
  entityType: string | null;
  entityId: number | null;
  description: string | null;
  ipAddress: string | null;
  timestamp: string;
}

interface UserSummary {
  userEmail: string;
  total: number;
  logins: number;
  logouts: number;
  creates: number;
  updates: number;
  deletes: number;
  approvals: number;
  other: number;
  lastActive: string;
}

type SortKey = keyof Omit<UserSummary, "lastActive">;
type SortDir = "asc" | "desc";

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTION_TYPES = [
  "login", "logout", "create", "update", "delete",
  "approve", "reject", "verify", "print", "export", "view",
];

const ENTITY_TYPES = [
  "gatePass", "user", "customer", "driver", "document",
  "company", "role", "permission", "department",
];

const ACTION_COLORS: Record<string, string> = {
  login:   "bg-green-50 text-green-700",
  logout:  "bg-slate-100 text-slate-600",
  create:  "bg-blue-50 text-blue-700",
  update:  "bg-yellow-50 text-yellow-700",
  delete:  "bg-red-50 text-red-700",
  approve: "bg-teal-50 text-teal-700",
  reject:  "bg-orange-50 text-orange-700",
  verify:  "bg-purple-50 text-purple-700",
  print:   "bg-indigo-50 text-indigo-700",
  export:  "bg-cyan-50 text-cyan-700",
  view:    "bg-gray-50 text-gray-600",
};

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_COLORS[action] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${cls}`}>
      {action}
    </span>
  );
}

function formatTs(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("en-PK", {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function SortTh({
  label, sortKey, current, dir, onSort, align = "center",
}: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir;
  onSort: (k: SortKey) => void; align?: "left" | "center";
}) {
  const active = current === sortKey;
  return (
    <th
      className={`px-4 py-3 font-medium text-gray-500 text-xs tracking-wider cursor-pointer select-none hover:text-gray-800 text-${align}`}
      onClick={() => onSort(sortKey)}
    >
      <span className={`inline-flex items-center gap-1 justify-${align === "left" ? "start" : "center"}`}>
        {label}
        {active
          ? dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
          : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </span>
    </th>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UserActivityReport() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showRawLog, setShowRawLog] = useState(false);
  const [rawSearch, setRawSearch] = useState("");

  // Build query URL
  const logsUrl = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "2000");
    if (emailFilter.trim()) p.set("userEmail", emailFilter.trim());
    if (actionFilter !== "all") p.set("actionType", actionFilter);
    if (entityFilter !== "all") p.set("entityType", entityFilter);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo)   p.set("dateTo", dateTo);
    return `/api/activity-logs?${p.toString()}`;
  }, [emailFilter, actionFilter, entityFilter, dateFrom, dateTo]);

  const { data: logs = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs", emailFilter, actionFilter, entityFilter, dateFrom, dateTo],
    queryFn: async () => {
      const res = await fetch(logsUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch activity logs");
      const result = await res.json();
      return result.logs ?? result;
    },
  });

  // ── Per-user aggregation ──────────────────────────────────────────────────
  const userSummaries = useMemo((): UserSummary[] => {
    const agg = new Map<string, UserSummary>();

    logs.forEach((log) => {
      const email = log.userEmail;
      if (!agg.has(email)) {
        agg.set(email, {
          userEmail: email,
          total: 0,
          logins: 0,
          logouts: 0,
          creates: 0,
          updates: 0,
          deletes: 0,
          approvals: 0,
          other: 0,
          lastActive: log.timestamp,
        });
      }
      const row = agg.get(email)!;
      row.total += 1;
      const a = log.actionType?.toLowerCase();
      if (a === "login")                              row.logins   += 1;
      else if (a === "logout")                        row.logouts  += 1;
      else if (a === "create")                        row.creates  += 1;
      else if (a === "update")                        row.updates  += 1;
      else if (a === "delete")                        row.deletes  += 1;
      else if (a === "approve" || a === "reject" || a === "verify") row.approvals += 1;
      else                                            row.other    += 1;

      // Track latest timestamp
      if (new Date(log.timestamp) > new Date(row.lastActive)) {
        row.lastActive = log.timestamp;
      }
    });

    return Array.from(agg.values());
  }, [logs]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sortedSummaries = useMemo(() => {
    return [...userSummaries].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "userEmail") cmp = a.userEmail.localeCompare(b.userEmail);
      else cmp = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [userSummaries, sortKey, sortDir]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalEvents   = logs.length;
  const uniqueUsers   = userSummaries.length;
  const mostActive    = useMemo(
    () => [...userSummaries].sort((a, b) => b.total - a.total)[0]?.userEmail ?? "—",
    [userSummaries]
  );
  const mostCommonAction = useMemo(() => {
    const counts = new Map<string, number>();
    logs.forEach((l) => counts.set(l.actionType, (counts.get(l.actionType) ?? 0) + 1));
    let best = "—"; let bestN = 0;
    counts.forEach((n, k) => { if (n > bestN) { bestN = n; best = k; } });
    return best;
  }, [logs]);

  // ── Raw log filter ─────────────────────────────────────────────────────────
  const filteredRaw = useMemo(() => {
    const q = rawSearch.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.userEmail.toLowerCase().includes(q) ||
        (l.description ?? "").toLowerCase().includes(q) ||
        (l.actionType ?? "").toLowerCase().includes(q) ||
        (l.entityType ?? "").toLowerCase().includes(q)
    );
  }, [logs, rawSearch]);

  // ── Export ────────────────────────────────────────────────────────────────
  const exportSummary = () => {
    if (!sortedSummaries.length) return;
    const ws = XLSX.utils.json_to_sheet(
      sortedSummaries.map((r) => ({
        "User Email":  r.userEmail,
        "Total Events": r.total,
        "Logins":      r.logins,
        "Logouts":     r.logouts,
        "Creates":     r.creates,
        "Updates":     r.updates,
        "Deletes":     r.deletes,
        "Approvals":   r.approvals,
        "Other":       r.other,
        "Last Active": formatTs(r.lastActive),
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "User Summary");
    XLSX.writeFile(wb, `User_Activity_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportRawLog = () => {
    if (!filteredRaw.length) return;
    const ws = XLSX.utils.json_to_sheet(
      filteredRaw.map((l) => ({
        "Timestamp":   formatTs(l.timestamp),
        "User Email":  l.userEmail,
        "Action":      l.actionType,
        "Entity Type": l.entityType ?? "—",
        "Entity ID":   l.entityId ?? "—",
        "Description": l.description ?? "—",
        "IP Address":  l.ipAddress ?? "—",
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Activity Log");
    XLSX.writeFile(wb, `Activity_Log_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Phase 16: Full compliance audit trail — exports Summary + Full Log in one file
  const exportAuditTrail = () => {
    if (!sortedSummaries.length && !filteredRaw.length) return;
    const wb = XLSX.utils.book_new();

    // Sheet 1: Per-user summary
    if (sortedSummaries.length) {
      const ws1 = XLSX.utils.json_to_sheet(
        sortedSummaries.map((r) => ({
          "User Email":   r.userEmail,
          "Total Events": r.total,
          "Logins":       r.logins,
          "Logouts":      r.logouts,
          "Creates":      r.creates,
          "Updates":      r.updates,
          "Deletes":      r.deletes,
          "Approvals":    r.approvals,
          "Other":        r.other,
          "Last Active":  formatTs(r.lastActive),
        }))
      );
      XLSX.utils.book_append_sheet(wb, ws1, "User Summary");
    }

    // Sheet 2: Full event log
    if (filteredRaw.length) {
      const ws2 = XLSX.utils.json_to_sheet(
        filteredRaw.map((l) => ({
          "Timestamp":    formatTs(l.timestamp),
          "User Email":   l.userEmail,
          "Action":       l.actionType,
          "Entity Type":  l.entityType ?? "—",
          "Entity ID":    l.entityId ?? "—",
          "Description":  l.description ?? "—",
          "IP Address":   l.ipAddress ?? "—",
          "User Agent":   (l as any).userAgent ?? "—",
        }))
      );
      XLSX.utils.book_append_sheet(wb, ws2, "Full Audit Log");
    }

    const dateRange = (dateFrom || dateTo) ? `_${dateFrom || "start"}_to_${dateTo || "end"}` : "";
    XLSX.writeFile(wb, `Audit_Trail${dateRange}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const hasFilters = emailFilter || actionFilter !== "all" || entityFilter !== "all" || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      {/* ── Filters ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label className="text-xs">From Date</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 h-9 w-40" />
            </div>
            <div>
              <Label className="text-xs">To Date</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 h-9 w-40" />
            </div>
            <div>
              <Label className="text-xs">User Email</Label>
              <Input
                placeholder="Search email..."
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
                className="mt-1 h-9 w-44"
              />
            </div>
            <div>
              <Label className="text-xs">Action Type</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="mt-1 h-9 w-36">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {ACTION_TYPES.map((a) => (
                    <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Entity Type</Label>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="mt-1 h-9 w-36">
                  <SelectValue placeholder="All Entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  {ENTITY_TYPES.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {hasFilters && (
              <Button
                variant="ghost" size="sm"
                onClick={() => { setDateFrom(""); setDateTo(""); setEmailFilter(""); setActionFilter("all"); setEntityFilter("all"); }}
                className="self-end"
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Total Events</span>
              <Activity className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold">{totalEvents}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Unique Users</span>
              <Users className="h-5 w-5 text-purple-500" />
            </div>
            <div className="text-3xl font-bold">{uniqueUsers}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Most Active User</span>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-sm font-bold leading-tight mt-1 truncate" title={mostActive}>
              {mostActive === "—" ? "—" : mostActive.split("@")[0]}
            </div>
            {mostActive !== "—" && (
              <div className="text-xs text-muted-foreground truncate">{mostActive}</div>
            )}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Top Action</span>
              <LogIn className="h-5 w-5 text-orange-500" />
            </div>
            <div className="mt-1">
              {mostCommonAction !== "—"
                ? <ActionBadge action={mostCommonAction} />
                : <span className="text-2xl font-bold">—</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Per-user Summary Table ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Per-user Summary
            <Badge variant="outline" className="ml-1 text-xs font-normal">
              {sortedSummaries.length} user{sortedSummaries.length !== 1 ? "s" : ""}
            </Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportSummary} disabled={!sortedSummaries.length}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportAuditTrail}
              disabled={!sortedSummaries.length && !filteredRaw.length}
              title="Export full audit trail (Summary + Log) for compliance"
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              Export Audit Trail
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center p-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sortedSummaries.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No activity found for the selected filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <SortTh label="User Email" sortKey="userEmail" current={sortKey} dir={sortDir} onSort={handleSort} align="left" />
                    <SortTh label="Total"    sortKey="total"     current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Logins"   sortKey="logins"    current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Logouts"  sortKey="logouts"   current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Creates"  sortKey="creates"   current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Updates"  sortKey="updates"   current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Deletes"  sortKey="deletes"   current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Approvals" sortKey="approvals" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Other"    sortKey="other"     current={sortKey} dir={sortDir} onSort={handleSort} />
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {sortedSummaries.map((row) => (
                    <tr key={row.userEmail} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{row.userEmail}</td>
                      <td className="px-4 py-3 text-center font-semibold">{row.total}</td>
                      <td className="px-4 py-3 text-center">
                        {row.logins > 0
                          ? <span className="text-green-700 font-medium">{row.logins}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.logouts > 0
                          ? <span className="text-slate-500">{row.logouts}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.creates > 0
                          ? <span className="text-blue-700 font-medium">{row.creates}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.updates > 0
                          ? <span className="text-yellow-700 font-medium">{row.updates}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.deletes > 0
                          ? <span className="text-red-600 font-medium">{row.deletes}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.approvals > 0
                          ? <span className="text-teal-700 font-medium">{row.approvals}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.other > 0
                          ? <span className="text-gray-600">{row.other}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatTs(row.lastActive)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 font-semibold text-sm">
                    <td className="px-4 py-3 text-gray-700">Total</td>
                    <td className="px-4 py-3 text-center">{totalEvents}</td>
                    <td className="px-4 py-3 text-center">{userSummaries.reduce((s, r) => s + r.logins, 0)}</td>
                    <td className="px-4 py-3 text-center">{userSummaries.reduce((s, r) => s + r.logouts, 0)}</td>
                    <td className="px-4 py-3 text-center">{userSummaries.reduce((s, r) => s + r.creates, 0)}</td>
                    <td className="px-4 py-3 text-center">{userSummaries.reduce((s, r) => s + r.updates, 0)}</td>
                    <td className="px-4 py-3 text-center">{userSummaries.reduce((s, r) => s + r.deletes, 0)}</td>
                    <td className="px-4 py-3 text-center">{userSummaries.reduce((s, r) => s + r.approvals, 0)}</td>
                    <td className="px-4 py-3 text-center">{userSummaries.reduce((s, r) => s + r.other, 0)}</td>
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Raw Activity Log (collapsible) ── */}
      <Card>
        <CardHeader
          className="flex flex-row items-center justify-between py-4 px-6 border-b cursor-pointer"
          onClick={() => setShowRawLog((v) => !v)}
        >
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Raw Activity Log
            <Badge variant="outline" className="ml-1 text-xs font-normal">
              {filteredRaw.length} event{filteredRaw.length !== 1 ? "s" : ""}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {showRawLog && (
              <Button
                variant="outline" size="sm"
                onClick={(e) => { e.stopPropagation(); exportRawLog(); }}
                disabled={!filteredRaw.length}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
            {showRawLog
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CardHeader>

        {showRawLog && (
          <CardContent className="p-0">
            {/* Search inside raw log */}
            <div className="px-4 py-3 border-b bg-slate-50">
              <Input
                placeholder="Search log entries..."
                value={rawSearch}
                onChange={(e) => setRawSearch(e.target.value)}
                className="h-8 w-64"
              />
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center p-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRaw.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">No entries found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Timestamp</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">User</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Action</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Entity</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Description</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {filteredRaw.slice(0, 500).map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatTs(log.timestamp)}</td>
                        <td className="px-4 py-2.5 text-xs font-medium">{log.userEmail}</td>
                        <td className="px-4 py-2.5"><ActionBadge action={log.actionType} /></td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {log.entityType
                            ? <>{log.entityType}{log.entityId ? <span className="text-gray-400"> #{log.entityId}</span> : null}</>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600 max-w-xs truncate" title={log.description ?? ""}>
                          {log.description || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-400">{log.ipAddress || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredRaw.length > 500 && (
                  <div className="px-4 py-3 text-xs text-muted-foreground border-t bg-slate-50">
                    Showing first 500 of {filteredRaw.length} entries. Use filters or export to see all.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
