import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectValue, SelectTrigger, SelectItem, SelectContent,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/layout/AppLayout";
import { DatePicker } from "@/components/ui/date-picker";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Filter, Download, RefreshCw, Activity,
  ChevronLeft, ChevronRight, X, ShieldAlert, LogIn, LogOut,
  FileText, User, Settings, Truck, Building, Package,
} from "lucide-react";

interface ActivityLog {
  id: number;
  userId: number | null;
  userEmail: string;
  actionType: string;
  entityType: string | null;
  entityId: number | null;
  description: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: string;
  additionalData: string | null;
}

interface LogsResponse {
  logs: ActivityLog[];
  total: number;
}

const ACTION_TYPES = [
  { value: "login_success",  label: "Login Success" },
  { value: "login_failed",   label: "Login Failed" },
  { value: "logout",         label: "Logout" },
  { value: "create",         label: "Create" },
  { value: "update",         label: "Update" },
  { value: "delete",         label: "Delete" },
  { value: "view",           label: "View" },
  { value: "approve",        label: "Approve" },
  { value: "reject",         label: "Reject" },
  { value: "export",         label: "Export" },
  { value: "print",          label: "Print" },
  { value: "password_reset", label: "Password Reset" },
];

const ENTITY_TYPES = [
  { value: "gate_pass",   label: "Gate Pass" },
  { value: "user",        label: "User" },
  { value: "customer",    label: "Customer" },
  { value: "driver",      label: "Driver" },
  { value: "vendor",      label: "Vendor" },
  { value: "company",     label: "Company" },
  { value: "department",  label: "Department" },
  { value: "plant",       label: "Plant" },
  { value: "gate",        label: "Gate" },
  { value: "item_master", label: "Item Master" },
  { value: "auth",        label: "Authentication" },
  { value: "report",      label: "Report" },
];

function getActionStyle(action: string): { bg: string; text: string; icon: React.ElementType } {
  switch (action) {
    case "login_success":  return { bg: "bg-green-100",  text: "text-green-800",  icon: LogIn };
    case "login_failed":   return { bg: "bg-red-100",    text: "text-red-800",    icon: ShieldAlert };
    case "logout":         return { bg: "bg-slate-100",  text: "text-slate-600",  icon: LogOut };
    case "create":         return { bg: "bg-blue-100",   text: "text-blue-800",   icon: FileText };
    case "update":         return { bg: "bg-amber-100",  text: "text-amber-800",  icon: Settings };
    case "delete":         return { bg: "bg-red-100",    text: "text-red-800",    icon: X };
    case "approve":        return { bg: "bg-green-100",  text: "text-green-800",  icon: FileText };
    case "reject":         return { bg: "bg-red-100",    text: "text-red-800",    icon: X };
    case "export":         return { bg: "bg-purple-100", text: "text-purple-800", icon: Download };
    case "print":          return { bg: "bg-indigo-100", text: "text-indigo-800", icon: FileText };
    case "password_reset": return { bg: "bg-orange-100", text: "text-orange-800", icon: User };
    case "view":           return { bg: "bg-slate-100",  text: "text-slate-600",  icon: FileText };
    default:               return { bg: "bg-gray-100",   text: "text-gray-700",   icon: Activity };
  }
}

function getEntityIcon(entityType: string | null): React.ElementType {
  switch (entityType) {
    case "gate_pass":   return FileText;
    case "user":        return User;
    case "driver":      return Truck;
    case "vendor":
    case "customer":    return Building;
    case "company":     return Building;
    case "item_master": return Package;
    default:            return Activity;
  }
}

function formatLabel(str: string): string {
  return str.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

const PAGE_SIZES = [25, 50, 100];

export default function ActivityLogs() {
  const { toast } = useToast();

  // Filter state
  const [userEmail,  setUserEmail]  = useState("");
  const [actionType, setActionType] = useState("all");
  const [entityType, setEntityType] = useState("all");
  const [dateFrom,   setDateFrom]   = useState<Date | undefined>();
  const [dateTo,     setDateTo]     = useState<Date | undefined>();
  const [showFilters, setShowFilters] = useState(false);

  // Pagination state
  const [page,  setPage]  = useState(1);
  const [limit, setLimit] = useState(50);

  const buildParams = () => {
    const p = new URLSearchParams();
    if (userEmail)             p.set("userEmail",   userEmail);
    if (actionType !== "all")  p.set("actionType",  actionType);
    if (entityType !== "all")  p.set("entityType",  entityType);
    if (dateFrom)              p.set("dateFrom",    dateFrom.toISOString());
    if (dateTo)                p.set("dateTo",      dateTo.toISOString());
    p.set("page",  String(page));
    p.set("limit", String(limit));
    return p.toString();
  };

  const { data, isLoading, isError, refetch } = useQuery<LogsResponse>({
    queryKey: ["activity-logs", userEmail, actionType, entityType, dateFrom, dateTo, page, limit],
    queryFn: async () => {
      const res = await fetch(`/api/activity-logs?${buildParams()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const logs  = data?.logs  ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const applyFilters = () => { setPage(1); refetch(); };

  const resetFilters = () => {
    setUserEmail(""); setActionType("all"); setEntityType("all");
    setDateFrom(undefined); setDateTo(undefined); setPage(1);
  };

  const hasActiveFilters = userEmail || actionType !== "all" || entityType !== "all" || dateFrom || dateTo;

  const exportCSV = () => {
    if (!logs.length) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }
    const headers = ["ID","User Email","Action","Entity","Entity ID","Description","IP Address","Timestamp"];
    const rows = logs.map(l => [
      l.id, `"${l.userEmail}"`, `"${l.actionType}"`,
      l.entityType ? `"${l.entityType}"` : "",
      l.entityId || "",
      l.description ? `"${l.description.replace(/"/g,'""')}"` : "",
      l.ipAddress || "",
      `"${formatDateTime(l.timestamp)}"`,
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `activity_logs_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Activity Logs</h1>
              <p className="text-sm text-muted-foreground">
                {total > 0 ? `${total.toLocaleString()} events recorded` : "Monitor user activity"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline" size="sm"
              onClick={() => setShowFilters(s => !s)}
              className={hasActiveFilters ? "border-primary text-primary" : ""}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters{hasActiveFilters ? " •" : ""}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={!logs.length}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filter Logs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">User Email</label>
                  <Input
                    placeholder="Search by email..."
                    value={userEmail}
                    onChange={e => setUserEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && applyFilters()}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Action Type</label>
                  <Select value={actionType} onValueChange={setActionType}>
                    <SelectTrigger><SelectValue placeholder="All actions" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      {ACTION_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Entity Type</label>
                  <Select value={entityType} onValueChange={setEntityType}>
                    <SelectTrigger><SelectValue placeholder="All entities" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Entities</SelectItem>
                      {ENTITY_TYPES.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">From Date</label>
                  <DatePicker date={dateFrom} setDate={setDateFrom} className="w-full" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">To Date</label>
                  <DatePicker date={dateTo} setDate={setDateTo} className="w-full" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  <X className="h-4 w-4 mr-1" /> Reset
                </Button>
                <Button size="sm" onClick={applyFilters}>
                  Apply Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Loading activity logs...</span>
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-destructive">
                <ShieldAlert className="h-8 w-8" />
                <p className="font-medium">Failed to load activity logs</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Try Again</Button>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                <Activity className="h-10 w-10 opacity-30" />
                <p className="font-medium">No activity logs found</p>
                {hasActiveFilters && (
                  <Button variant="link" size="sm" onClick={resetFilters}>Clear filters</Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="whitespace-nowrap">Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="whitespace-nowrap">IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map(log => {
                      const style = getActionStyle(log.actionType);
                      const ActionIcon = style.icon;
                      const EntityIcon = getEntityIcon(log.entityType);
                      return (
                        <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="whitespace-nowrap text-sm font-mono text-muted-foreground">
                            {formatDateTime(log.timestamp)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <User className="h-3.5 w-3.5 text-primary" />
                              </div>
                              <span className="text-sm truncate max-w-[180px]" title={log.userEmail}>
                                {log.userEmail}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                              <ActionIcon className="h-3 w-3" />
                              {formatLabel(log.actionType)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {log.entityType ? (
                              <span className="inline-flex items-center gap-1 text-sm">
                                <EntityIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="font-medium">{formatLabel(log.entityType)}</span>
                                {log.entityId && (
                                  <span className="text-muted-foreground text-xs">#{log.entityId}</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[280px]">
                            <span className="line-clamp-2" title={log.description ?? undefined}>
                              {log.description || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                            {log.ipAddress || "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <Select value={String(limit)} onValueChange={v => { setLimit(Number(v)); setPage(1); }}>
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map(s => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <span>
                {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline" size="icon" className="h-8 w-8"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 font-medium text-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline" size="icon" className="h-8 w-8"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
