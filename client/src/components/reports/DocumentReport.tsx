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
  FileText,
  FileSpreadsheet,
  FolderOpen,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocRow {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  entityType: string;
  entityId: number;
  description: string | null;
  uploadedByEmail: string;
  createdAt: string;
  // Gate pass context (null for non-gatePass entities)
  gatePassNumber: string | null;
  gatePassDate: string | null;
  gatePassType: string | null;
  gatePassStatus: string | null;
  department: string | null;
  customerName: string | null;
  companyId: number | null;
}

interface GatePassRow {
  id: number;
  gatePassNumber: string;
  companyId: number | null;
}

interface Company {
  id: number;
  name: string;
  shortName: string | null;
  active: boolean;
}

type SortKey = "fileName" | "fileSize" | "entityType" | "uploadedByEmail" | "createdAt";
type SortDir = "asc" | "desc";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTotalBytes(bytes: number): string {
  if (bytes < 1024 * 1024)       return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fileTypePill(mimeType: string) {
  const ext = mimeType.split("/").pop()?.toUpperCase() ?? mimeType.toUpperCase();
  const colorMap: Record<string, string> = {
    PDF:  "bg-red-50 text-red-700",
    JPEG: "bg-yellow-50 text-yellow-700",
    JPG:  "bg-yellow-50 text-yellow-700",
    PNG:  "bg-blue-50 text-blue-700",
    SHEET: "bg-green-50 text-green-700",
    SPREADSHEETML: "bg-green-50 text-green-700",
    MSWORD: "bg-indigo-50 text-indigo-700",
    WORDPROCESSINGML: "bg-indigo-50 text-indigo-700",
    PLAIN: "bg-gray-100 text-gray-600",
  };
  // Find best color
  const color = Object.entries(colorMap).find(([k]) => ext.includes(k))?.[1] ?? "bg-slate-100 text-slate-600";
  // Friendly label
  let label = ext;
  if (mimeType.includes("pdf"))          label = "PDF";
  else if (mimeType.includes("jpeg") || mimeType.includes("jpg")) label = "JPG";
  else if (mimeType.includes("png"))     label = "PNG";
  else if (mimeType.includes("sheet") || mimeType.includes("excel")) label = "Excel";
  else if (mimeType.includes("word"))    label = "Word";
  else if (mimeType.includes("plain"))   label = "TXT";
  else if (mimeType.includes("image"))   label = "Image";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>{label}</span>;
}

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

function SortTh({ label, sortKey, current, dir, onSort, align = "left" }: {
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

export function DocumentReport() {
  const { isAdmin, user } = useAuth();

  // Filters
  const [dateFrom, setDateFrom]               = useState("");
  const [dateTo, setDateTo]                   = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [fileTypeFilter, setFileTypeFilter]   = useState("all");
  const [emailFilter, setEmailFilter]         = useState("");

  // Document list sort
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Collapsible sections
  const [showDocList, setShowDocList]         = useState(true);
  const [showAudit, setShowAudit]             = useState(false);
  const [auditSearch, setAuditSearch]         = useState("");
  const [docSearch, setDocSearch]             = useState("");

  // Companies
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

  // Build documents API URL
  const docUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo)   p.set("dateTo", dateTo);
    if (entityTypeFilter !== "all") p.set("entityType", entityTypeFilter);
    if (fileTypeFilter !== "all")   p.set("fileType", fileTypeFilter);
    if (emailFilter.trim())         p.set("uploadedByEmail", emailFilter.trim());
    if (isAdmin && selectedCompanyId !== "all") p.set("companyId", selectedCompanyId);
    return `/api/reports/documents?${p.toString()}`;
  }, [dateFrom, dateTo, entityTypeFilter, fileTypeFilter, emailFilter, isAdmin, selectedCompanyId]);

  const { data: docs = [], isLoading: docsLoading } = useQuery<DocRow[]>({
    queryKey: ["/api/reports/documents", dateFrom, dateTo, entityTypeFilter, fileTypeFilter, emailFilter, selectedCompanyId],
    queryFn: async () => {
      const res = await fetch(docUrl);
      if (!res.ok) throw new Error("Failed to fetch document report");
      return res.json();
    },
  });

  // Fetch gate passes for completeness audit (only when audit section open)
  const gpUrl = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "5000");
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo)   p.set("dateTo", dateTo);
    if (isAdmin && selectedCompanyId !== "all") p.set("companyId", selectedCompanyId);
    return `/api/gate-passes?${p.toString()}`;
  }, [dateFrom, dateTo, isAdmin, selectedCompanyId]);

  const { data: gatePasses = [], isLoading: gpLoading } = useQuery<GatePassRow[]>({
    queryKey: ["/api/gate-passes", "doc-audit", dateFrom, dateTo, selectedCompanyId],
    queryFn: async () => {
      const res = await fetch(gpUrl);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: showAudit,
  });

  // ── Aggregations ─────────────────────────────────────────────────────────

  const totalDocs    = docs.length;
  const totalSize    = docs.reduce((s, d) => s + (d.fileSize ?? 0), 0);
  const gpDocs       = docs.filter((d) => d.entityType === "gatePass").length;
  const otherDocs    = totalDocs - gpDocs;

  // Entity type breakdown
  const entityBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    docs.forEach((d) => m.set(d.entityType, (m.get(d.entityType) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [docs]);

  // File type breakdown
  const fileTypeBreakdown = useMemo(() => {
    const m = new Map<string, { count: number; size: number }>();
    docs.forEach((d) => {
      const key = d.fileType;
      const cur = m.get(key) ?? { count: 0, size: 0 };
      m.set(key, { count: cur.count + 1, size: cur.size + (d.fileSize ?? 0) });
    });
    return [...m.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [docs]);

  // Completeness audit — gate passes without any documents
  const passesWithDocs = useMemo(() => {
    const s = new Set<number>();
    docs.filter((d) => d.entityType === "gatePass").forEach((d) => s.add(d.entityId));
    return s;
  }, [docs]);

  const missingDocs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return gatePasses
      .filter((gp) => !passesWithDocs.has(gp.id))
      .filter((gp) => !q || gp.gatePassNumber.toLowerCase().includes(q));
  }, [gatePasses, passesWithDocs, auditSearch]);

  // ── Document list filtering + sort ───────────────────────────────────────

  const filteredDocs = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    return q
      ? docs.filter(
          (d) =>
            d.fileName.toLowerCase().includes(q) ||
            (d.gatePassNumber ?? "").toLowerCase().includes(q) ||
            d.uploadedByEmail.toLowerCase().includes(q) ||
            (d.department ?? "").toLowerCase().includes(q)
        )
      : docs;
  }, [docs, docSearch]);

  const sortedDocs = useMemo(() => {
    return [...filteredDocs].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "fileSize") cmp = (a.fileSize ?? 0) - (b.fileSize ?? 0);
      else cmp = (String(a[sortKey] ?? "")).localeCompare(String(b[sortKey] ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredDocs, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  // ── Exports ───────────────────────────────────────────────────────────────

  const exportDocList = () => {
    if (!sortedDocs.length) return;
    const wb = XLSX.utils.book_new();

    // Sheet 1: Document list
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      sortedDocs.map((d) => ({
        "File Name":       d.fileName,
        "File Type":       d.fileType,
        "Size":            formatBytes(d.fileSize ?? 0),
        "Entity Type":     d.entityType,
        "Entity ID":       d.entityId,
        "Gate Pass No.":   d.gatePassNumber ?? "—",
        "Pass Date":       d.gatePassDate ? formatDate(d.gatePassDate) : "—",
        "Pass Type":       d.gatePassType ?? "—",
        "Pass Status":     d.gatePassStatus ? (STATUS_LABELS[d.gatePassStatus] ?? d.gatePassStatus) : "—",
        "Department":      d.department ?? "—",
        "Customer":        d.customerName ?? "—",
        "Description":     d.description ?? "—",
        "Uploaded By":     d.uploadedByEmail,
        "Uploaded At":     formatDate(d.createdAt),
      }))
    ), "Documents");

    // Sheet 2: File type breakdown
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      fileTypeBreakdown.map(([ft, { count, size }]) => ({
        "File Type": ft,
        "Count": count,
        "Total Size": formatBytes(size),
      }))
    ), "By File Type");

    // Sheet 3: Entity type breakdown
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      entityBreakdown.map(([et, count]) => ({ "Entity Type": et, "Count": count }))
    ), "By Entity");

    XLSX.writeFile(wb, `Document_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportAudit = () => {
    if (!missingDocs.length) return;
    const ws = XLSX.utils.json_to_sheet(
      missingDocs.map((gp) => ({
        "Gate Pass No.": gp.gatePassNumber,
        "Status": "No Documents Attached",
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Missing Documents");
    XLSX.writeFile(wb, `Missing_Documents_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const hasFilters = dateFrom || dateTo || entityTypeFilter !== "all" || fileTypeFilter !== "all" || emailFilter || selectedCompanyId !== "all";

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
              <Label className="text-xs">Entity Type</Label>
              <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                <SelectTrigger className="mt-1 h-9 w-40">
                  <SelectValue placeholder="All Entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  <SelectItem value="gatePass">Gate Pass</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="driver">Driver</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">File Type</Label>
              <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
                <SelectTrigger className="mt-1 h-9 w-36">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="sheet">Excel</SelectItem>
                  <SelectItem value="word">Word</SelectItem>
                  <SelectItem value="plain">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Uploaded By</Label>
              <Input
                placeholder="Email..."
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
                className="mt-1 h-9 w-44"
              />
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm"
                onClick={() => { setDateFrom(""); setDateTo(""); setEntityTypeFilter("all"); setFileTypeFilter("all"); setEmailFilter(""); setSelectedCompanyId("all"); }}
                className="self-end">
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
              <span className="text-sm text-muted-foreground">Total Documents</span>
              <FileText className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold">{totalDocs}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-indigo-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Total Storage</span>
              <HardDrive className="h-5 w-5 text-indigo-500" />
            </div>
            <div className="text-3xl font-bold">{formatTotalBytes(totalSize)}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Gate Pass Docs</span>
              <FolderOpen className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-3xl font-bold">{gpDocs}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Other Docs</span>
              <FileText className="h-5 w-5 text-orange-500" />
            </div>
            <div className="text-3xl font-bold">{otherDocs}</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Breakdown Cards (side by side) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* By Entity Type */}
        <Card>
          <CardHeader className="py-3 px-5 border-b">
            <CardTitle className="text-sm font-medium">By Entity Type</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {entityBreakdown.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No data</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Entity</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Count</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entityBreakdown.map(([et, count]) => (
                    <tr key={et} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 capitalize font-medium">{et}</td>
                      <td className="px-4 py-2.5 text-center font-semibold">{count}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${totalDocs ? Math.round((count / totalDocs) * 100) : 0}%` }} />
                          </div>
                          <span className="text-xs text-gray-400 w-8">{totalDocs ? Math.round((count / totalDocs) * 100) : 0}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* By File Type */}
        <Card>
          <CardHeader className="py-3 px-5 border-b">
            <CardTitle className="text-sm font-medium">By File Type</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {fileTypeBreakdown.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No data</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Count</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fileTypeBreakdown.map(([ft, { count, size }]) => (
                    <tr key={ft} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">{fileTypePill(ft)}</td>
                      <td className="px-4 py-2.5 text-center font-semibold">{count}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{formatBytes(size)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Document List (collapsible) ── */}
      <Card>
        <CardHeader
          className="flex flex-row items-center justify-between py-4 px-6 border-b cursor-pointer"
          onClick={() => setShowDocList((v) => !v)}
        >
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Document List
            <Badge variant="outline" className="ml-1 text-xs font-normal">
              {filteredDocs.length}{filteredDocs.length !== docs.length ? ` of ${docs.length}` : ""} docs
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {showDocList && (
              <Button variant="outline" size="sm"
                onClick={(e) => { e.stopPropagation(); exportDocList(); }}
                disabled={!sortedDocs.length}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />Export Excel
              </Button>
            )}
            {showDocList ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CardHeader>

        {showDocList && (
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b bg-slate-50">
              <Input
                placeholder="Search file name, gate pass, department, uploader..."
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                className="h-8 w-80"
              />
            </div>
            {docsLoading ? (
              <div className="flex justify-center items-center p-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : sortedDocs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><FileText className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>No documents found.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <SortTh label="File Name"    sortKey="fileName"       current={sortKey} dir={sortDir} onSort={handleSort} />
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Type</th>
                      <SortTh label="Size"         sortKey="fileSize"       current={sortKey} dir={sortDir} onSort={handleSort} align="center" />
                      <SortTh label="Entity"       sortKey="entityType"     current={sortKey} dir={sortDir} onSort={handleSort} />
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Gate Pass</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Department</th>
                      <SortTh label="Uploaded By"  sortKey="uploadedByEmail" current={sortKey} dir={sortDir} onSort={handleSort} />
                      <SortTh label="Uploaded At"  sortKey="createdAt"      current={sortKey} dir={sortDir} onSort={handleSort} />
                      <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {sortedDocs.slice(0, 500).map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium max-w-[200px] truncate" title={doc.fileName}>{doc.fileName}</td>
                        <td className="px-4 py-2.5">{fileTypePill(doc.fileType)}</td>
                        <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">{formatBytes(doc.fileSize ?? 0)}</td>
                        <td className="px-4 py-2.5 text-xs capitalize text-gray-600">{doc.entityType}</td>
                        <td className="px-4 py-2.5 text-xs font-medium">
                          {doc.gatePassNumber ?? <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {doc.gatePassStatus
                            ? <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[doc.gatePassStatus] ?? "bg-gray-100 text-gray-600"}`}>
                                {STATUS_LABELS[doc.gatePassStatus] ?? doc.gatePassStatus}
                              </span>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">{doc.department ?? <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[160px] truncate" title={doc.uploadedByEmail}>{doc.uploadedByEmail}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(doc.createdAt)}</td>
                        <td className="px-4 py-2.5 text-center">
                          {doc.entityType === "gatePass" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => window.open(`/view-gate-pass/${doc.entityId}`, "_blank")}
                              title="View Gate Pass">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sortedDocs.length > 500 && (
                  <div className="px-4 py-3 text-xs text-muted-foreground border-t bg-slate-50">
                    Showing first 500 of {sortedDocs.length} documents. Use filters or export to see all.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── Completeness Audit (collapsible) ── */}
      <Card>
        <CardHeader
          className="flex flex-row items-center justify-between py-4 px-6 border-b cursor-pointer"
          onClick={() => setShowAudit((v) => !v)}
        >
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            Completeness Audit
            {showAudit && !gpLoading && (
              <Badge variant={missingDocs.length > 0 ? "destructive" : "outline"} className="ml-1 text-xs font-normal">
                {missingDocs.length} gate pass{missingDocs.length !== 1 ? "es" : ""} without documents
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {showAudit && missingDocs.length > 0 && (
              <Button variant="outline" size="sm"
                onClick={(e) => { e.stopPropagation(); exportAudit(); }}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />Export
              </Button>
            )}
            {showAudit ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CardHeader>

        {showAudit && (
          <CardContent className="p-0">
            {gpLoading ? (
              <div className="flex justify-center items-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : missingDocs.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-40 text-green-500" />
                <p className="font-medium">All gate passes have documents attached.</p>
                {!dateFrom && !dateTo && <p className="text-xs mt-1">Set a date range to narrow the audit scope.</p>}
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b bg-slate-50">
                  <Input placeholder="Search gate pass number..." value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)} className="h-8 w-64" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b">
                        <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs tracking-wider">Gate Pass No.</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs tracking-wider">Documents</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y bg-white">
                      {missingDocs.slice(0, 200).map((gp) => (
                        <tr key={gp.id} className="hover:bg-red-50">
                          <td className="px-4 py-2.5 font-medium">{gp.gatePassNumber}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600">
                              <AlertCircle className="h-3 w-3" /> No documents
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => window.open(`/view-gate-pass/${gp.id}`, "_blank")}
                              title="View Gate Pass">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {missingDocs.length > 200 && (
                    <div className="px-4 py-3 text-xs text-muted-foreground border-t bg-slate-50">
                      Showing first 200 of {missingDocs.length}. Export to see full list.
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
