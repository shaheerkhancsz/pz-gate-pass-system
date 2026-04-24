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
  Car,
  FileSpreadsheet,
  TrendingUp,
  Route,
  UserCheck,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  Eye,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Driver {
  id: number;
  companyId: number | null;
  name: string;
  mobile: string;
  cnic: string;
  vehicleNumber: string | null;
  sapId: string | null;
  syncedFromSap: boolean;
  createdAt: string;
}

interface GatePassRow {
  id: number;
  gatePassNumber: string;
  date: string;
  type: string;
  status: string;
  department: string;
  customerName: string;
  driverName: string;
  driverMobile: string;
  driverCnic: string;
  deliveryVanNumber: string;
  companyId: number | null;
}

interface Company {
  id: number;
  name: string;
  shortName: string | null;
  active: boolean;
}

interface DriverActivity {
  cnic: string;
  name: string;
  mobile: string;
  vehicleNumber: string;
  sapId: string | null;
  inRegistry: boolean;        // found in /api/drivers
  totalTrips: number;
  outward: number;
  inward: number;
  returnable: number;
  completed: number;
  rejected: number;
  lastTrip: string | null;
}

type SortKey = "name" | "totalTrips" | "outward" | "inward" | "returnable" | "completed" | "lastTrip";
type SortDir = "asc" | "desc";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending:          "Pending",
  hod_approved:     "HOD Approved",
  security_allowed: "Security Allowed",
  completed:        "Completed",
  rejected:         "Rejected",
  sent_back:        "Sent Back",
};

const STATUS_COLORS: Record<string, string> = {
  pending:          "bg-yellow-50 text-yellow-700",
  hod_approved:     "bg-orange-50 text-orange-700",
  security_allowed: "bg-teal-50 text-teal-700",
  completed:        "bg-green-50 text-green-700",
  rejected:         "bg-red-50 text-red-700",
  sent_back:        "bg-slate-100 text-slate-600",
};

const TYPE_COLORS: Record<string, string> = {
  outward:    "bg-blue-50 text-blue-700",
  inward:     "bg-indigo-50 text-indigo-700",
  returnable: "bg-purple-50 text-purple-700",
};

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${color}`}>
      {label}
    </span>
  );
}

function SortTh({ label, sortKey, current, dir, onSort, align = "center" }: {
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

export function DriverActivityReport() {
  const { isAdmin } = useAuth();

  const [dateFrom, setDateFrom]               = useState("");
  const [dateTo, setDateTo]                   = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("all");
  const [typeFilter, setTypeFilter]           = useState("all");
  const [statusFilter, setStatusFilter]       = useState("all");
  const [search, setSearch]                   = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("totalTrips");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [showTripLog, setShowTripLog]         = useState(false);
  const [tripSearch, setTripSearch]           = useState("");

  // ── Data fetching ─────────────────────────────────────────────────────────

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const res = await fetch("/api/companies");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: isAdmin,
  });
  const activeCompanies = useMemo(() => companies.filter((c) => c.active), [companies]);

  const { data: drivers = [], isLoading: driversLoading } = useQuery<Driver[]>({
    queryKey: ["/api/drivers"],
    queryFn: async () => {
      const res = await fetch("/api/drivers");
      if (!res.ok) throw new Error("Failed to fetch drivers");
      return res.json();
    },
  });

  const passesUrl = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "10000");
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo)   p.set("dateTo", dateTo);
    if (typeFilter !== "all")   p.set("type", typeFilter);
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (isAdmin && selectedCompanyId !== "all") p.set("companyId", selectedCompanyId);
    return `/api/gate-passes?${p.toString()}`;
  }, [dateFrom, dateTo, typeFilter, statusFilter, isAdmin, selectedCompanyId]);

  const { data: gatePasses = [], isLoading: passesLoading } = useQuery<GatePassRow[]>({
    queryKey: ["/api/gate-passes", "driver-activity", dateFrom, dateTo, typeFilter, statusFilter, selectedCompanyId],
    queryFn: async () => {
      const res = await fetch(passesUrl);
      if (!res.ok) throw new Error("Failed to fetch gate passes");
      return res.json();
    },
  });

  const isLoading = driversLoading || passesLoading;

  // ── Build driver registry lookup (by CNIC) ────────────────────────────────
  const driverByCnic = useMemo(() => {
    const m = new Map<string, Driver>();
    drivers.forEach((d) => m.set(d.cnic.trim(), d));
    return m;
  }, [drivers]);

  // ── Aggregate gate passes by driverCnic ───────────────────────────────────
  const activityMap = useMemo(() => {
    const m = new Map<string, DriverActivity>();

    gatePasses.forEach((pass) => {
      const cnic = pass.driverCnic?.trim() || "unknown";
      if (!m.has(cnic)) {
        const reg = driverByCnic.get(cnic);
        m.set(cnic, {
          cnic,
          name:          reg?.name ?? pass.driverName ?? "—",
          mobile:        reg?.mobile ?? pass.driverMobile ?? "—",
          vehicleNumber: reg?.vehicleNumber ?? pass.deliveryVanNumber ?? "—",
          sapId:         reg?.sapId ?? null,
          inRegistry:    driverByCnic.has(cnic),
          totalTrips:    0,
          outward:       0,
          inward:        0,
          returnable:    0,
          completed:     0,
          rejected:      0,
          lastTrip:      null,
        });
      }
      const row = m.get(cnic)!;
      row.totalTrips += 1;
      if (pass.type === "outward")    row.outward    += 1;
      if (pass.type === "inward")     row.inward     += 1;
      if (pass.type === "returnable") row.returnable += 1;
      if (pass.status === "completed") row.completed += 1;
      if (pass.status === "rejected")  row.rejected  += 1;
      if (!row.lastTrip || pass.date > row.lastTrip) row.lastTrip = pass.date;
    });

    // Also include drivers from registry with 0 trips (so the registry is complete)
    drivers.forEach((d) => {
      if (!m.has(d.cnic.trim())) {
        m.set(d.cnic.trim(), {
          cnic:          d.cnic,
          name:          d.name,
          mobile:        d.mobile,
          vehicleNumber: d.vehicleNumber ?? "—",
          sapId:         d.sapId ?? null,
          inRegistry:    true,
          totalTrips:    0,
          outward:       0,
          inward:        0,
          returnable:    0,
          completed:     0,
          rejected:      0,
          lastTrip:      null,
        });
      }
    });

    return m;
  }, [gatePasses, driverByCnic, drivers]);

  const allActivity = useMemo(() => Array.from(activityMap.values()), [activityMap]);

  // Client-side search filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? allActivity.filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            d.cnic.toLowerCase().includes(q) ||
            d.vehicleNumber.toLowerCase().includes(q) ||
            d.mobile.includes(q)
        )
      : allActivity;
  }, [allActivity, search]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name" || sortKey === "lastTrip") {
        cmp = (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "");
      } else {
        cmp = (a[sortKey] as number) - (b[sortKey] as number);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalDriversInRegistry = drivers.length;
  const totalTrips             = gatePasses.length;
  const mostActive             = [...allActivity].sort((a, b) => b.totalTrips - a.totalTrips)[0];
  const uniqueVehicles         = new Set(
    gatePasses.map((p) => p.deliveryVanNumber?.trim()).filter(Boolean)
  ).size;
  const adHocDrivers           = allActivity.filter((d) => !d.inRegistry && d.totalTrips > 0).length;

  // ── Trip Log ──────────────────────────────────────────────────────────────
  const filteredTrips = useMemo(() => {
    const q = tripSearch.trim().toLowerCase();
    return q
      ? gatePasses.filter(
          (p) =>
            p.driverName.toLowerCase().includes(q) ||
            p.driverCnic.toLowerCase().includes(q) ||
            p.gatePassNumber.toLowerCase().includes(q) ||
            p.deliveryVanNumber.toLowerCase().includes(q) ||
            p.customerName.toLowerCase().includes(q)
        )
      : gatePasses;
  }, [gatePasses, tripSearch]);

  // ── Exports ───────────────────────────────────────────────────────────────
  const exportActivity = () => {
    if (!sorted.length) return;
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      sorted.map((d) => ({
        "Driver Name":    d.name,
        "CNIC":           d.cnic,
        "Mobile":         d.mobile,
        "Vehicle No.":    d.vehicleNumber,
        "SAP ID":         d.sapId ?? "—",
        "In Registry":    d.inRegistry ? "Yes" : "No (Ad-hoc)",
        "Total Trips":    d.totalTrips,
        "Outward":        d.outward,
        "Inward":         d.inward,
        "Returnable":     d.returnable,
        "Completed":      d.completed,
        "Rejected":       d.rejected,
        "Last Trip":      d.lastTrip ? formatDate(d.lastTrip) : "—",
      }))
    ), "Driver Activity");

    XLSX.writeFile(wb, `Driver_Activity_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportTripLog = () => {
    if (!filteredTrips.length) return;
    const ws = XLSX.utils.json_to_sheet(
      filteredTrips.map((p) => ({
        "Gate Pass No.":  p.gatePassNumber,
        "Date":           formatDate(p.date),
        "Type":           p.type,
        "Status":         STATUS_LABELS[p.status] ?? p.status,
        "Department":     p.department,
        "Customer":       p.customerName,
        "Driver Name":    p.driverName,
        "Driver CNIC":    p.driverCnic,
        "Driver Mobile":  p.driverMobile,
        "Vehicle No.":    p.deliveryVanNumber,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Trip Log");
    XLSX.writeFile(wb, `Driver_Trip_Log_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const hasFilters = dateFrom || dateTo || typeFilter !== "all" || statusFilter !== "all" || selectedCompanyId !== "all";

  return (
    <div className="space-y-6">
      {/* ── Filters ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            {isAdmin && (
              <div>
                <Label className="text-xs">Company</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger className="mt-1 h-9 w-44">
                    <SelectValue placeholder="All Companies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {activeCompanies.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.shortName ?? c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">From Date</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 h-9 w-40" />
            </div>
            <div>
              <Label className="text-xs">To Date</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 h-9 w-40" />
            </div>
            <div>
              <Label className="text-xs">Pass Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="mt-1 h-9 w-36">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="outward">Outward</SelectItem>
                  <SelectItem value="inward">Inward</SelectItem>
                  <SelectItem value="returnable">Returnable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-1 h-9 w-40">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="hod_approved">HOD Approved</SelectItem>
                  <SelectItem value="security_allowed">Security Allowed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="sent_back">Sent Back</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Search Driver</Label>
              <Input
                placeholder="Name, CNIC, vehicle..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1 h-9 w-44"
              />
            </div>
            {(hasFilters || search) && (
              <Button variant="ghost" size="sm"
                onClick={() => { setDateFrom(""); setDateTo(""); setTypeFilter("all"); setStatusFilter("all"); setSelectedCompanyId("all"); setSearch(""); }}
                className="self-end">
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Registered Drivers</span>
              <UserCheck className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold">{totalDriversInRegistry}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-indigo-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Total Trips</span>
              <Route className="h-5 w-5 text-indigo-500" />
            </div>
            <div className="text-3xl font-bold">{totalTrips}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Unique Vehicles</span>
              <Car className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-3xl font-bold">{uniqueVehicles}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Most Active</span>
              <TrendingUp className="h-5 w-5 text-purple-500" />
            </div>
            <div className="text-sm font-bold leading-tight mt-1 truncate" title={mostActive?.name}>
              {mostActive?.name ?? "—"}
            </div>
            {mostActive && mostActive.totalTrips > 0 && (
              <div className="text-xs text-muted-foreground">{mostActive.totalTrips} trips</div>
            )}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Ad-hoc Drivers</span>
              <AlertCircle className="h-5 w-5 text-orange-500" />
            </div>
            <div className="text-3xl font-bold">{adHocDrivers}</div>
            <div className="text-xs text-muted-foreground mt-1">not in registry</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Driver Activity Table ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Car className="h-4 w-4" />
            Driver Activity
            <Badge variant="outline" className="ml-1 text-xs font-normal">
              {sorted.length}{sorted.length !== allActivity.length ? ` of ${allActivity.length}` : ""} driver{sorted.length !== 1 ? "s" : ""}
            </Badge>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportActivity} disabled={!sorted.length}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />Export Excel
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center p-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Car className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No driver activity found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <SortTh label="Driver Name" sortKey="name"       current={sortKey} dir={sortDir} onSort={handleSort} align="left" />
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">CNIC</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Vehicle</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Mobile</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs tracking-wider">Registry</th>
                    <SortTh label="Trips"      sortKey="totalTrips"  current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Outward"    sortKey="outward"     current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Inward"     sortKey="inward"      current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Returnable" sortKey="returnable"  current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Completed"  sortKey="completed"   current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Last Trip"  sortKey="lastTrip"    current={sortKey} dir={sortDir} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {sorted.map((d) => (
                    <tr key={d.cnic} className={`hover:bg-slate-50 ${!d.inRegistry && d.totalTrips > 0 ? "bg-orange-50/30" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{d.name}</div>
                        {d.sapId && (
                          <div className="text-xs text-teal-600 mt-0.5">SAP: {d.sapId}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{d.cnic}</td>
                      <td className="px-4 py-3 text-xs">
                        {d.vehicleNumber && d.vehicleNumber !== "—"
                          ? <Badge variant="outline" className="text-xs font-mono">{d.vehicleNumber}</Badge>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{d.mobile}</td>
                      <td className="px-4 py-3 text-center">
                        {d.inRegistry
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">Registered</span>
                          : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700">Ad-hoc</span>}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-base">
                        {d.totalTrips > 0 ? d.totalTrips : <span className="text-gray-300 font-normal text-sm">0</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {d.outward > 0
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">{d.outward}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {d.inward > 0
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700">{d.inward}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {d.returnable > 0
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">{d.returnable}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {d.completed > 0
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">{d.completed}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {d.lastTrip ? formatDate(d.lastTrip) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 font-semibold text-sm">
                    <td className="px-4 py-3 text-gray-700">Total</td>
                    <td colSpan={4} className="px-4 py-3" />
                    <td className="px-4 py-3 text-center">{allActivity.reduce((s, d) => s + d.totalTrips, 0)}</td>
                    <td className="px-4 py-3 text-center">{allActivity.reduce((s, d) => s + d.outward, 0)}</td>
                    <td className="px-4 py-3 text-center">{allActivity.reduce((s, d) => s + d.inward, 0)}</td>
                    <td className="px-4 py-3 text-center">{allActivity.reduce((s, d) => s + d.returnable, 0)}</td>
                    <td className="px-4 py-3 text-center">{allActivity.reduce((s, d) => s + d.completed, 0)}</td>
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Trip Log (collapsible) ── */}
      <Card>
        <CardHeader
          className="flex flex-row items-center justify-between py-4 px-6 border-b cursor-pointer"
          onClick={() => setShowTripLog((v) => !v)}
        >
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Route className="h-4 w-4" />
            Trip Log
            <Badge variant="outline" className="ml-1 text-xs font-normal">
              {filteredTrips.length} trip{filteredTrips.length !== 1 ? "s" : ""}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {showTripLog && (
              <Button variant="outline" size="sm"
                onClick={(e) => { e.stopPropagation(); exportTripLog(); }}
                disabled={!filteredTrips.length}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />Export
              </Button>
            )}
            {showTripLog
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CardHeader>

        {showTripLog && (
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b bg-slate-50">
              <Input
                placeholder="Search driver, CNIC, gate pass, vehicle, customer..."
                value={tripSearch}
                onChange={(e) => setTripSearch(e.target.value)}
                className="h-8 w-80"
              />
            </div>
            {passesLoading ? (
              <div className="flex justify-center items-center p-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTrips.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">No trips found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Gate Pass No.</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Driver</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">CNIC</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Vehicle</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Department</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Customer</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs tracking-wider">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {filteredTrips.slice(0, 500).map((pass) => (
                      <tr key={pass.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-xs">{pass.gatePassNumber}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(pass.date)}</td>
                        <td className="px-4 py-2.5">
                          <Pill label={pass.type} color={TYPE_COLORS[pass.type] ?? "bg-gray-100 text-gray-600"} />
                        </td>
                        <td className="px-4 py-2.5">
                          <Pill label={STATUS_LABELS[pass.status] ?? pass.status} color={STATUS_COLORS[pass.status] ?? "bg-gray-100 text-gray-600"} />
                        </td>
                        <td className="px-4 py-2.5 text-xs font-medium">{pass.driverName}</td>
                        <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{pass.driverCnic}</td>
                        <td className="px-4 py-2.5 text-xs">
                          {pass.deliveryVanNumber
                            ? <Badge variant="outline" className="text-xs font-mono">{pass.deliveryVanNumber}</Badge>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">{pass.department}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[130px] truncate" title={pass.customerName}>{pass.customerName}</td>
                        <td className="px-4 py-2.5 text-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => window.open(`/view-gate-pass/${pass.id}`, "_blank")}
                            title="View Gate Pass">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredTrips.length > 500 && (
                  <div className="px-4 py-3 text-xs text-muted-foreground border-t bg-slate-50">
                    Showing first 500 of {filteredTrips.length} trips. Use filters or export to see all.
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
