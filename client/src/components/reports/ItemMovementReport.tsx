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
  Package,
  FileSpreadsheet,
  TrendingUp,
  Hash,
  Layers,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ItemMovementRow {
  itemId: number;
  itemName: string;
  sku: string;
  quantity: number;
  gatePassId: number;
  gatePassNumber: string;
  date: string;
  type: string;
  status: string;
  department: string;
  customerName: string;
  companyId: number | null;
}

interface ItemSummary {
  itemName: string;
  sku: string;
  totalQty: number;
  outwardQty: number;
  inwardQty: number;
  returnableQty: number;
  passCount: number;
  departments: Set<string>;
  lastMoved: string;
}

interface Company {
  id: number;
  name: string;
  shortName: string | null;
  active: boolean;
}

type SortKey = "itemName" | "totalQty" | "outwardQty" | "inwardQty" | "returnableQty" | "passCount" | "lastMoved";
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

export function ItemMovementReport() {
  const { isAdmin, user } = useAuth();

  // Filters
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("all");
  const [typeFilter, setTypeFilter]     = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter]     = useState("");
  const [itemSearch, setItemSearch]     = useState("");

  // Summary sort
  const [sortKey, setSortKey] = useState<SortKey>("totalQty");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Raw log
  const [showLog, setShowLog] = useState(false);
  const [logSearch, setLogSearch] = useState("");

  // Companies (admin only)
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

  // Build API URL
  const apiUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo)   p.set("dateTo", dateTo);
    if (typeFilter !== "all")   p.set("type", typeFilter);
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (deptFilter.trim())      p.set("department", deptFilter.trim());
    if (itemSearch.trim())      p.set("itemName", itemSearch.trim());
    if (isAdmin && selectedCompanyId !== "all") p.set("companyId", selectedCompanyId);
    return `/api/reports/item-movement?${p.toString()}`;
  }, [dateFrom, dateTo, typeFilter, statusFilter, deptFilter, itemSearch, isAdmin, selectedCompanyId]);

  const { data: rows = [], isLoading } = useQuery<ItemMovementRow[]>({
    queryKey: ["/api/reports/item-movement", dateFrom, dateTo, typeFilter, statusFilter, deptFilter, itemSearch, selectedCompanyId],
    queryFn: async () => {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error("Failed to fetch item movement data");
      return res.json();
    },
  });

  // ── Aggregate by item name ────────────────────────────────────────────────
  const summaryMap = useMemo(() => {
    const m = new Map<string, ItemSummary>();
    rows.forEach((row) => {
      const key = row.itemName.trim().toLowerCase();
      if (!m.has(key)) {
        m.set(key, {
          itemName:     row.itemName,
          sku:          row.sku,
          totalQty:     0,
          outwardQty:   0,
          inwardQty:    0,
          returnableQty:0,
          passCount:    0,
          departments:  new Set(),
          lastMoved:    row.date,
        });
      }
      const s = m.get(key)!;
      s.totalQty  += row.quantity;
      if (row.type === "outward")    s.outwardQty    += row.quantity;
      if (row.type === "inward")     s.inwardQty     += row.quantity;
      if (row.type === "returnable") s.returnableQty += row.quantity;
      s.passCount += 1;
      if (row.department) s.departments.add(row.department);
      if (row.date > s.lastMoved) s.lastMoved = row.date;
    });
    return m;
  }, [rows]);

  const summaryList = useMemo(() => Array.from(summaryMap.values()), [summaryMap]);

  // Sort
  const sortedSummary = useMemo(() => {
    return [...summaryList].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "itemName" || sortKey === "lastMoved") {
        cmp = (a[sortKey] as string).localeCompare(b[sortKey] as string);
      } else {
        cmp = (a[sortKey] as number) - (b[sortKey] as number);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [summaryList, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  // KPIs
  const totalLineItems  = rows.length;
  const totalQty        = rows.reduce((s, r) => s + r.quantity, 0);
  const uniqueItems     = summaryList.length;
  const mostMoved       = [...summaryList].sort((a, b) => b.totalQty - a.totalQty)[0]?.itemName ?? "—";

  // Raw log filter
  const filteredLog = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.itemName.toLowerCase().includes(q) ||
        r.gatePassNumber.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        (r.sku ?? "").toLowerCase().includes(q)
    );
  }, [rows, logSearch]);

  // ── Exports ───────────────────────────────────────────────────────────────
  const exportSummary = () => {
    if (!sortedSummary.length) return;
    const ws = XLSX.utils.json_to_sheet(
      sortedSummary.map((s) => ({
        "Item Name":     s.itemName,
        "SKU":           s.sku || "—",
        "Total Qty":     s.totalQty,
        "Outward Qty":   s.outwardQty,
        "Inward Qty":    s.inwardQty,
        "Returnable Qty":s.returnableQty,
        "Gate Passes":   s.passCount,
        "Departments":   [...s.departments].join(", ") || "—",
        "Last Moved":    formatDate(s.lastMoved),
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Item Summary");
    XLSX.writeFile(wb, `Item_Movement_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportLog = () => {
    if (!filteredLog.length) return;
    const ws = XLSX.utils.json_to_sheet(
      filteredLog.map((r) => ({
        "Gate Pass No.": r.gatePassNumber,
        "Date":          formatDate(r.date),
        "Type":          r.type,
        "Status":        STATUS_LABELS[r.status] ?? r.status,
        "Department":    r.department,
        "Customer":      r.customerName,
        "Item Name":     r.itemName,
        "SKU":           r.sku || "—",
        "Quantity":      r.quantity,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movement Log");
    XLSX.writeFile(wb, `Item_Movement_Log_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const hasFilters = dateFrom || dateTo || typeFilter !== "all" || statusFilter !== "all" || deptFilter || itemSearch || selectedCompanyId !== "all";

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
              <Label className="text-xs">Type</Label>
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
              <Label className="text-xs">Department</Label>
              <Input
                placeholder="Filter department..."
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="mt-1 h-9 w-40"
              />
            </div>
            <div>
              <Label className="text-xs">Item Name</Label>
              <Input
                placeholder="Search item..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="mt-1 h-9 w-40"
              />
            </div>
            {hasFilters && (
              <Button
                variant="ghost" size="sm"
                onClick={() => {
                  setDateFrom(""); setDateTo(""); setTypeFilter("all");
                  setStatusFilter("all"); setDeptFilter(""); setItemSearch("");
                  setSelectedCompanyId("all");
                }}
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
              <span className="text-sm text-muted-foreground">Total Line Items</span>
              <Package className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold">{totalLineItems.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">across all passes</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-indigo-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Total Quantity</span>
              <Hash className="h-5 w-5 text-indigo-500" />
            </div>
            <div className="text-3xl font-bold">{totalQty.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">units moved</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Unique Items</span>
              <Layers className="h-5 w-5 text-purple-500" />
            </div>
            <div className="text-3xl font-bold">{uniqueItems}</div>
            <div className="text-xs text-muted-foreground mt-1">distinct item names</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Most Moved</span>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-sm font-bold leading-tight mt-1 truncate" title={mostMoved}>
              {mostMoved}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Item Summary Table ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            Item Summary
            <Badge variant="outline" className="ml-1 text-xs font-normal">
              {uniqueItems} unique item{uniqueItems !== 1 ? "s" : ""}
            </Badge>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportSummary} disabled={!sortedSummary.length}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center p-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sortedSummary.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No item movement data found for the selected filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <SortTh label="Item Name"     sortKey="itemName"     current={sortKey} dir={sortDir} onSort={handleSort} align="left" />
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">SKU</th>
                    <SortTh label="Total Qty"     sortKey="totalQty"     current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Outward"       sortKey="outwardQty"   current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Inward"        sortKey="inwardQty"    current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Returnable"    sortKey="returnableQty" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Gate Passes"   sortKey="passCount"    current={sortKey} dir={sortDir} onSort={handleSort} />
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Departments</th>
                    <SortTh label="Last Moved"    sortKey="lastMoved"    current={sortKey} dir={sortDir} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {sortedSummary.map((s) => (
                    <tr key={s.itemName} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{s.itemName}</td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                        {s.sku || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-lg">{s.totalQty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        {s.outwardQty > 0
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">{s.outwardQty}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.inwardQty > 0
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700">{s.inwardQty}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.returnableQty > 0
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">{s.returnableQty}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{s.passCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {[...s.departments].slice(0, 3).map((d) => (
                            <Badge key={d} variant="outline" className="text-xs font-normal px-1.5 py-0">{d}</Badge>
                          ))}
                          {s.departments.size > 3 && (
                            <span className="text-xs text-muted-foreground">+{s.departments.size - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(s.lastMoved)}</td>
                    </tr>
                  ))}
                </tbody>
                {/* Totals footer */}
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 font-semibold text-sm">
                    <td className="px-4 py-3 text-gray-700">Total</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-center text-lg">{totalQty.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">{rows.filter((r) => r.type === "outward").reduce((s, r) => s + r.quantity, 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">{rows.filter((r) => r.type === "inward").reduce((s, r) => s + r.quantity, 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">{rows.filter((r) => r.type === "returnable").reduce((s, r) => s + r.quantity, 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">{totalLineItems}</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Movement Log (collapsible) ── */}
      <Card>
        <CardHeader
          className="flex flex-row items-center justify-between py-4 px-6 border-b cursor-pointer"
          onClick={() => setShowLog((v) => !v)}
        >
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Movement Log
            <Badge variant="outline" className="ml-1 text-xs font-normal">
              {filteredLog.length} line item{filteredLog.length !== 1 ? "s" : ""}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {showLog && (
              <Button
                variant="outline" size="sm"
                onClick={(e) => { e.stopPropagation(); exportLog(); }}
                disabled={!filteredLog.length}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
            {showLog
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CardHeader>

        {showLog && (
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b bg-slate-50">
              <Input
                placeholder="Search gate pass, item, customer, department..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="h-8 w-72"
              />
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center p-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLog.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">No entries found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Gate Pass No.</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Department</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Customer</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Item Name</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">SKU</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs tracking-wider">Qty</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {filteredLog.slice(0, 500).map((row) => (
                      <tr key={row.itemId} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-xs">{row.gatePassNumber}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(row.date)}</td>
                        <td className="px-4 py-2.5">
                          <Pill label={row.type} color={TYPE_COLORS[row.type] ?? "bg-gray-100 text-gray-600"} />
                        </td>
                        <td className="px-4 py-2.5">
                          <Pill label={STATUS_LABELS[row.status] ?? row.status} color={STATUS_COLORS[row.status] ?? "bg-gray-100 text-gray-600"} />
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">{row.department}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[150px] truncate" title={row.customerName}>{row.customerName}</td>
                        <td className="px-4 py-2.5 text-xs font-medium">{row.itemName}</td>
                        <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{row.sku || "—"}</td>
                        <td className="px-4 py-2.5 text-center font-semibold text-sm">{row.quantity}</td>
                        <td className="px-4 py-2.5 text-center">
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7"
                            onClick={() => window.open(`/view-gate-pass/${row.gatePassId}`, "_blank")}
                            title="View Gate Pass"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredLog.length > 500 && (
                  <div className="px-4 py-3 text-xs text-muted-foreground border-t bg-slate-50">
                    Showing first 500 of {filteredLog.length} entries. Use filters or export to see all.
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
