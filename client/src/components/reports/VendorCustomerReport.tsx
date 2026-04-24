import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as XLSX from "xlsx";
import {
  Users,
  Building2,
  FileSpreadsheet,
  TrendingUp,
  Phone,
  Link2,
  CheckCircle2,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Company {
  id: number;
  name: string;
  shortName: string | null;
  active: boolean;
}

interface Customer {
  id: number;
  companyId: number | null;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  contactPerson: string | null;
  sapId: string | null;
  syncedFromSap: boolean;
  createdAt: string;
}

interface Vendor {
  id: number;
  companyId: number;
  code: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  sapCode: string | null;
  active: boolean;
  createdAt: string;
}

interface GatePassRow {
  id: number;
  customerName: string;
  companyId: number | null;
  type: string;
  status: string;
  date: string;
  createdAt: string;
}

interface CustomerStats extends Customer {
  totalPasses: number;
  outward: number;
  inward: number;
  returnable: number;
  completed: number;
  lastPassDate: string | null;
  companyName?: string;
}

type CustSort = "name" | "totalPasses" | "outward" | "inward" | "returnable" | "completed" | "createdAt";
type VendSort = "name" | "code" | "active" | "createdAt";
type SortDir = "asc" | "desc";

// ── Helpers ───────────────────────────────────────────────────────────────────

function SortTh({
  label, sortKey, current, dir, onSort, align = "center",
}: {
  label: string; sortKey: string; current: string; dir: SortDir;
  onSort: (k: any) => void; align?: "left" | "center";
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

// ── Customers Sub-report ───────────────────────────────────────────────────────

function CustomersReport({ companies }: { companies: Company[] }) {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("all");
  const [sortKey, setSortKey] = useState<CustSort>("totalPasses");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const activeCompanies = useMemo(() => companies.filter((c) => c.active), [companies]);
  const companyMap = useMemo(() => {
    const m = new Map<number, string>();
    companies.forEach((c) => m.set(c.id, c.shortName ?? c.name));
    return m;
  }, [companies]);

  const { data: customers = [], isLoading: custLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const res = await fetch("/api/customers");
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json();
    },
  });

  const passesUrl = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "10000");
    if (isAdmin && selectedCompanyId !== "all") p.set("companyId", selectedCompanyId);
    return `/api/gate-passes?${p.toString()}`;
  }, [isAdmin, selectedCompanyId]);

  const { data: gatePasses = [], isLoading: passesLoading } = useQuery<GatePassRow[]>({
    queryKey: ["/api/gate-passes", "vendor-cust", selectedCompanyId],
    queryFn: async () => {
      const res = await fetch(passesUrl);
      if (!res.ok) throw new Error("Failed to fetch gate passes");
      return res.json();
    },
  });

  const isLoading = custLoading || passesLoading;

  // Aggregate gate passes by customerName (case-insensitive)
  const passAgg = useMemo(() => {
    const m = new Map<string, { total: number; outward: number; inward: number; returnable: number; completed: number; lastDate: string | null }>();
    gatePasses.forEach((p) => {
      const key = p.customerName?.trim().toLowerCase() ?? "";
      if (!m.has(key)) m.set(key, { total: 0, outward: 0, inward: 0, returnable: 0, completed: 0, lastDate: null });
      const row = m.get(key)!;
      row.total += 1;
      if (p.type === "outward")     row.outward += 1;
      if (p.type === "inward")      row.inward += 1;
      if (p.type === "returnable")  row.returnable += 1;
      if (p.status === "completed") row.completed += 1;
      if (!row.lastDate || p.date > row.lastDate) row.lastDate = p.date;
    });
    return m;
  }, [gatePasses]);

  // Merge customers with pass activity
  const merged = useMemo((): CustomerStats[] => {
    return customers
      .filter((c) => {
        if (selectedCompanyId !== "all" && String(c.companyId) !== selectedCompanyId) return false;
        if (!isAdmin && c.companyId !== null) return true; // non-admin sees all from server
        return true;
      })
      .map((c) => {
        const agg = passAgg.get(c.name.trim().toLowerCase()) ?? { total: 0, outward: 0, inward: 0, returnable: 0, completed: 0, lastDate: null };
        return {
          ...c,
          totalPasses: agg.total,
          outward:     agg.outward,
          inward:      agg.inward,
          returnable:  agg.returnable,
          completed:   agg.completed,
          lastPassDate: agg.lastDate,
          companyName: c.companyId ? companyMap.get(c.companyId) : undefined,
        };
      });
  }, [customers, passAgg, selectedCompanyId, isAdmin, companyMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? merged.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.phone ?? "").includes(q) ||
            (c.email ?? "").toLowerCase().includes(q)
        )
      : merged;
  }, [merged, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name" || sortKey === "createdAt") {
        cmp = (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "");
      } else {
        cmp = (a[sortKey] as number) - (b[sortKey] as number);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key: CustSort) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const withSap     = merged.filter((c) => c.sapId).length;
  const withPhone   = merged.filter((c) => c.phone).length;
  const mostFreq    = [...merged].sort((a, b) => b.totalPasses - a.totalPasses)[0]?.name ?? "—";

  const exportExcel = () => {
    if (!sorted.length) return;
    const ws = XLSX.utils.json_to_sheet(
      sorted.map((c) => ({
        "Name":           c.name,
        "Company":        c.companyName ?? "—",
        "Phone":          c.phone ?? "—",
        "Email":          c.email ?? "—",
        "Contact Person": c.contactPerson ?? "—",
        "Address":        c.address ?? "—",
        "SAP ID":         c.sapId ?? "—",
        "SAP Synced":     c.syncedFromSap ? "Yes" : "No",
        "Total Passes":   c.totalPasses,
        "Outward":        c.outward,
        "Inward":         c.inward,
        "Returnable":     c.returnable,
        "Completed":      c.completed,
        "Last Pass":      c.lastPassDate ? formatDate(c.lastPassDate) : "—",
        "Registered":     formatDate(c.createdAt),
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, `Customer_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
                      <SelectItem key={c.id} value={String(c.id)}>{c.shortName ?? c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Search</Label>
              <Input
                placeholder="Name, phone, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1 h-9 w-52"
              />
            </div>
            {search && (
              <Button variant="ghost" size="sm" onClick={() => setSearch("")} className="self-end">Clear</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Total Customers</span>
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold">{merged.length}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">SAP Linked</span>
              <Link2 className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-3xl font-bold">{withSap}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">With Phone</span>
              <Phone className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="text-3xl font-bold">{withPhone}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Most Frequent</span>
              <TrendingUp className="h-5 w-5 text-purple-500" />
            </div>
            <div className="text-sm font-bold leading-tight mt-1 truncate" title={mostFreq}>{mostFreq}</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Customer Directory
            <Badge variant="outline" className="ml-1 text-xs font-normal">
              {sorted.length}{filtered.length !== merged.length ? ` of ${merged.length}` : ""} customers
            </Badge>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={!sorted.length}>
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
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No customers found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <SortTh label="Customer Name" sortKey="name"        current={sortKey} dir={sortDir} onSort={handleSort} align="left" />
                    {isAdmin && <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Company</th>}
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Contact</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">SAP</th>
                    <SortTh label="Passes"     sortKey="totalPasses" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Outward"    sortKey="outward"     current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Inward"     sortKey="inward"      current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Returnable" sortKey="returnable"  current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Completed"  sortKey="completed"   current={sortKey} dir={sortDir} onSort={handleSort} />
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Last Pass</th>
                    <SortTh label="Registered" sortKey="createdAt"   current={sortKey} dir={sortDir} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {sorted.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.name}</div>
                        {c.contactPerson && <div className="text-xs text-muted-foreground">{c.contactPerson}</div>}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {c.companyName ?? <span className="text-gray-300">—</span>}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        {c.phone && <div className="text-xs">{c.phone}</div>}
                        {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                        {!c.phone && !c.email && <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {c.sapId
                          ? <Badge variant="outline" className="text-xs text-green-700 border-green-300">{c.sapId}</Badge>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">
                        {c.totalPasses > 0 ? c.totalPasses : <span className="text-gray-300">0</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.outward > 0 ? <span className="text-blue-700">{c.outward}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.inward > 0 ? <span className="text-indigo-700">{c.inward}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.returnable > 0 ? <span className="text-purple-700">{c.returnable}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.completed > 0 ? <span className="text-green-700">{c.completed}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {c.lastPassDate ? formatDate(c.lastPassDate) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(c.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Vendors Sub-report ─────────────────────────────────────────────────────────

function VendorsReport({ companies }: { companies: Company[] }) {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<VendSort>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const activeCompanies = useMemo(() => companies.filter((c) => c.active), [companies]);
  const companyMap = useMemo(() => {
    const m = new Map<number, string>();
    companies.forEach((c) => m.set(c.id, c.shortName ?? c.name));
    return m;
  }, [companies]);

  const vendorsUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (selectedCompanyId !== "all") p.set("companyId", selectedCompanyId);
    return `/api/vendors?${p.toString()}`;
  }, [selectedCompanyId]);

  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors", selectedCompanyId],
    queryFn: async () => {
      const res = await fetch(vendorsUrl);
      if (!res.ok) throw new Error("Failed to fetch vendors");
      return res.json();
    },
  });

  const filtered = useMemo(() => {
    let list = vendors;
    if (statusFilter === "active")   list = list.filter((v) => v.active);
    if (statusFilter === "inactive") list = list.filter((v) => !v.active);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          (v.code ?? "").toLowerCase().includes(q) ||
          (v.email ?? "").toLowerCase().includes(q) ||
          (v.sapCode ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [vendors, statusFilter, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name")      cmp = a.name.localeCompare(b.name);
      else if (sortKey === "code") cmp = (a.code ?? "").localeCompare(b.code ?? "");
      else if (sortKey === "active") cmp = Number(b.active) - Number(a.active);
      else if (sortKey === "createdAt") cmp = a.createdAt.localeCompare(b.createdAt);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key: VendSort) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const totalActive   = vendors.filter((v) => v.active).length;
  const withSap       = vendors.filter((v) => v.sapCode).length;
  const withEmail     = vendors.filter((v) => v.email).length;

  const exportExcel = () => {
    if (!sorted.length) return;
    const ws = XLSX.utils.json_to_sheet(
      sorted.map((v) => ({
        "Code":      v.code ?? "—",
        "Name":      v.name,
        "Company":   companyMap.get(v.companyId) ?? "—",
        "Phone":     v.phone ?? "—",
        "Email":     v.email ?? "—",
        "Address":   v.address ?? "—",
        "SAP Code":  v.sapCode ?? "—",
        "Status":    v.active ? "Active" : "Inactive",
        "Registered": formatDate(v.createdAt),
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vendors");
    XLSX.writeFile(wb, `Vendor_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
                      <SelectItem key={c.id} value={String(c.id)}>{c.shortName ?? c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-1 h-9 w-36">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Search</Label>
              <Input
                placeholder="Name, code, email, SAP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1 h-9 w-52"
              />
            </div>
            {(search || statusFilter !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); }} className="self-end">
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-indigo-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Total Vendors</span>
              <Building2 className="h-5 w-5 text-indigo-500" />
            </div>
            <div className="text-3xl font-bold">{vendors.length}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Active</span>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-3xl font-bold">{totalActive}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-teal-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">SAP Linked</span>
              <Link2 className="h-5 w-5 text-teal-500" />
            </div>
            <div className="text-3xl font-bold">{withSap}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">With Email</span>
              <Phone className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="text-3xl font-bold">{withEmail}</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Vendor Directory
            <Badge variant="outline" className="ml-1 text-xs font-normal">
              {sorted.length}{filtered.length !== vendors.length ? ` of ${vendors.length}` : ""} vendors
            </Badge>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={!sorted.length}>
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
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No vendors found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <SortTh label="Code"     sortKey="code"      current={sortKey} dir={sortDir} onSort={handleSort} align="left" />
                    <SortTh label="Name"     sortKey="name"      current={sortKey} dir={sortDir} onSort={handleSort} align="left" />
                    {isAdmin && <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Company</th>}
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Contact</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">SAP Code</th>
                    <SortTh label="Status"   sortKey="active"    current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Registered" sortKey="createdAt" current={sortKey} dir={sortDir} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {sorted.map((v) => (
                    <tr key={v.id} className={`hover:bg-slate-50 ${!v.active ? "opacity-60" : ""}`}>
                      <td className="px-4 py-3">
                        {v.code
                          ? <Badge variant="outline" className="text-xs font-mono">{v.code}</Badge>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 font-medium">{v.name}</td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {companyMap.get(v.companyId) ?? "—"}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        {v.phone && <div className="text-xs">{v.phone}</div>}
                        {v.email && <div className="text-xs text-muted-foreground">{v.email}</div>}
                        {!v.phone && !v.email && <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {v.sapCode
                          ? <Badge variant="outline" className="text-xs text-teal-700 border-teal-300">{v.sapCode}</Badge>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {v.active
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">Active</span>
                          : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">Inactive</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(v.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Root Component ─────────────────────────────────────────────────────────────

export function VendorCustomerReport() {
  const { isAdmin } = useAuth();
  const [subTab, setSubTab] = useState("customers");

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const res = await fetch("/api/companies");
      if (!res.ok) throw new Error("Failed to fetch companies");
      return res.json();
    },
    enabled: isAdmin,
  });

  return (
    <Tabs value={subTab} onValueChange={setSubTab} className="w-full">
      <TabsList className="mb-6 bg-white shadow-sm">
        <TabsTrigger value="customers">
          <Users className="h-4 w-4 mr-2" />
          Customers
        </TabsTrigger>
        <TabsTrigger value="vendors">
          <Building2 className="h-4 w-4 mr-2" />
          Vendors
        </TabsTrigger>
      </TabsList>

      <TabsContent value="customers" className="m-0">
        <CustomersReport companies={companies} />
      </TabsContent>

      <TabsContent value="vendors" className="m-0">
        <VendorsReport companies={companies} />
      </TabsContent>
    </Tabs>
  );
}
