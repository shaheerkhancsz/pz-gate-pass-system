import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/utils";
import { getStatusBadgeClass, getStatusLabel } from "@/components/ui/theme";
import * as XLSX from "xlsx";
import {
  AlertTriangle, CheckCircle2, Clock, Download,
  Eye, Loader2, RotateCcw,
} from "lucide-react";

interface ReturnablePass {
  id: number;
  gatePassNumber: string;
  date: string;
  department: string;
  customerName: string;
  status: string;
  expectedReturnDate?: string | null;
  actualReturnDate?: string | null;
}

const CLOSED = ["completed", "rejected", "force_closed"];

/** Positive = days remaining, Negative = days overdue */
function daysRelative(expectedReturnDate: string): number {
  const exp = new Date(expectedReturnDate);
  const now = new Date();
  exp.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function daysOut(issueDateStr: string): number {
  return Math.floor((Date.now() - new Date(issueDateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function DaysCell({ pass }: { pass: ReturnablePass }) {
  if (pass.actualReturnDate) {
    return <span className="text-green-600 text-xs font-medium">Returned</span>;
  }
  if (!pass.expectedReturnDate) {
    return <span className="text-gray-400 text-xs italic">No date set</span>;
  }
  const d = daysRelative(pass.expectedReturnDate);
  if (d < 0) return <span className="text-red-600 font-semibold text-xs">{Math.abs(d)}d overdue</span>;
  if (d === 0) return <span className="text-orange-600 font-semibold text-xs">Due today</span>;
  if (d <= 7)  return <span className="text-orange-500 text-xs">Due in {d}d</span>;
  return            <span className="text-emerald-600 text-xs">Due in {d}d</span>;
}

interface PassTableProps {
  passes: ReturnablePass[];
  emptyIcon?: React.ReactNode;
  emptyMessage: string;
  showActualReturn?: boolean;
}

function PassTable({ passes, emptyIcon, emptyMessage, showActualReturn = false }: PassTableProps) {
  if (passes.length === 0) {
    return (
      <div className="text-center py-14 text-muted-foreground">
        {emptyIcon ?? <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30 text-green-500" />}
        <p className="text-sm font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full whitespace-nowrap text-sm">
        <thead>
          <tr className="bg-muted/40 border-b">
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground tracking-wider">Gate Pass No.</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground tracking-wider">Customer</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground tracking-wider">Department</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground tracking-wider">Issue Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground tracking-wider">Expected Return</th>
            {showActualReturn && (
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground tracking-wider">Actual Return</th>
            )}
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground tracking-wider">Days</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground tracking-wider">Workflow Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground tracking-wider">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {passes.map(pass => {
            const isOverdue =
              !pass.actualReturnDate &&
              !!pass.expectedReturnDate &&
              daysRelative(pass.expectedReturnDate) < 0;
            return (
              <tr
                key={pass.id}
                className={`transition-colors ${
                  isOverdue
                    ? "bg-red-50 hover:bg-red-100/60"
                    : "hover:bg-muted/30"
                }`}
              >
                <td className="px-4 py-3 font-medium">{pass.gatePassNumber}</td>
                <td className="px-4 py-3 text-muted-foreground">{pass.customerName}</td>
                <td className="px-4 py-3 text-muted-foreground">{pass.department}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(pass.date)}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {pass.expectedReturnDate
                    ? formatDate(pass.expectedReturnDate)
                    : <span className="text-gray-400 italic">Not set</span>}
                </td>
                {showActualReturn && (
                  <td className="px-4 py-3 text-muted-foreground">
                    {pass.actualReturnDate
                      ? <span className="text-green-600 font-medium">{formatDate(pass.actualReturnDate)}</span>
                      : <span className="text-gray-400 italic">—</span>}
                  </td>
                )}
                <td className="px-4 py-3"><DaysCell pass={pass} /></td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] ${getStatusBadgeClass(pass.status)}`}>
                    {getStatusLabel(pass.status)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="View Gate Pass"
                    onClick={() => window.open(`/view-gate-pass/${pass.id}`, "_blank")}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ReturnableTracker() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("overdue");

  const { data: allReturnables = [], isLoading } = useQuery<ReturnablePass[]>({
    queryKey: ["/api/gate-passes", "type:returnable"],
    queryFn: async () => {
      const res = await fetch("/api/gate-passes?type=returnable", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch returnable gate passes");
      return res.json();
    },
  });

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  /* ── Categorise ── */
  const overdue = useMemo(() =>
    allReturnables.filter(p =>
      !CLOSED.includes(p.status) &&
      !p.actualReturnDate &&
      !!p.expectedReturnDate &&
      new Date(p.expectedReturnDate) < today,
    ), [allReturnables, today]);

  const dueSoon = useMemo(() =>
    allReturnables.filter(p => {
      if (CLOSED.includes(p.status) || p.actualReturnDate) return false;
      if (!p.expectedReturnDate) return false;
      const d = daysRelative(p.expectedReturnDate);
      return d >= 0 && d <= 7;
    }), [allReturnables]);

  const allOpen = useMemo(() =>
    allReturnables.filter(p => !CLOSED.includes(p.status) && !p.actualReturnDate),
    [allReturnables]);

  const returned = useMemo(() =>
    allReturnables.filter(p => !!p.actualReturnDate || p.status === "completed"),
    [allReturnables]);

  /* ── Departments for filter ── */
  const departments = useMemo(() => {
    const s = new Set(allReturnables.map(p => p.department).filter(Boolean));
    return Array.from(s).sort();
  }, [allReturnables]);

  /* ── Filter helpers ── */
  function applyFilters(passes: ReturnablePass[]) {
    const q = search.toLowerCase();
    return passes.filter(p => {
      const matchSearch = !q ||
        p.gatePassNumber.toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q);
      const matchDept = deptFilter === "all" || p.department === deptFilter;
      return matchSearch && matchDept;
    });
  }

  /* ── Sorted subsets ── */
  const sortedOverdue = useMemo(() =>
    [...applyFilters(overdue)].sort((a, b) =>
      new Date(a.expectedReturnDate!).getTime() - new Date(b.expectedReturnDate!).getTime(),
    ), [overdue, search, deptFilter]);

  const filteredDueSoon = useMemo(() =>
    [...applyFilters(dueSoon)].sort((a, b) =>
      new Date(a.expectedReturnDate!).getTime() - new Date(b.expectedReturnDate!).getTime(),
    ), [dueSoon, search, deptFilter]);

  const sortedOpen = useMemo(() =>
    [...applyFilters(allOpen)].sort((a, b) => {
      if (!a.expectedReturnDate && !b.expectedReturnDate) return 0;
      if (!a.expectedReturnDate) return 1;
      if (!b.expectedReturnDate) return -1;
      return new Date(a.expectedReturnDate).getTime() - new Date(b.expectedReturnDate).getTime();
    }), [allOpen, search, deptFilter]);

  const filteredReturned = useMemo(() =>
    [...applyFilters(returned)].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime(),
    ), [returned, search, deptFilter]);

  /* ── Export ── */
  function exportExcel(passes: ReturnablePass[], label: string) {
    const ws = XLSX.utils.json_to_sheet(passes.map(p => ({
      "Gate Pass No.": p.gatePassNumber,
      "Customer": p.customerName,
      "Department": p.department,
      "Issue Date": formatDate(p.date),
      "Days Out": daysOut(p.date),
      "Expected Return": p.expectedReturnDate ? formatDate(p.expectedReturnDate) : "—",
      "Actual Return": p.actualReturnDate ? formatDate(p.actualReturnDate) : "—",
      "Days Status": !p.expectedReturnDate
        ? "No date"
        : p.actualReturnDate
          ? "Returned"
          : daysRelative(p.expectedReturnDate) < 0
            ? `${Math.abs(daysRelative(p.expectedReturnDate))}d overdue`
            : `Due in ${daysRelative(p.expectedReturnDate)}d`,
      "Workflow Status": getStatusLabel(p.status),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, label);
    XLSX.writeFile(wb, `Returnables_${label}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function handleExport() {
    const map: Record<string, [ReturnablePass[], string]> = {
      overdue:   [sortedOverdue,    "Overdue"],
      "due-soon":[filteredDueSoon,  "Due_Soon"],
      open:      [sortedOpen,       "All_Open"],
      returned:  [filteredReturned, "Returned"],
    };
    const [passes, label] = map[activeTab] ?? [sortedOpen, "All_Open"];
    exportExcel(passes, label);
  }

  /* ── KPI cards ── */
  const kpiCards = [
    {
      label: "Overdue",
      count: overdue.length,
      icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
      border: "border-l-red-500",
      text: "text-red-600",
    },
    {
      label: "Due Within 7 Days",
      count: dueSoon.length,
      icon: <Clock className="h-5 w-5 text-orange-500" />,
      border: "border-l-orange-400",
      text: "text-orange-600",
    },
    {
      label: "All Open",
      count: allOpen.length,
      icon: <RotateCcw className="h-5 w-5 text-blue-500" />,
      border: "border-l-blue-400",
      text: "text-blue-600",
    },
    {
      label: "Returned / Closed",
      count: returned.length,
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      border: "border-l-emerald-400",
      text: "text-emerald-600",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map(c => (
          <Card key={c.label} className={`border-l-4 ${c.border}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{c.label}</span>
                {c.icon}
              </div>
              <div className={`text-3xl font-bold ${c.text}`}>{c.count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + Export */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </span>
          <Input
            placeholder="Search gate pass no. or customer…"
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map(d => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleExport} className="shrink-0">
          <Download className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </div>

      {/* Tabbed Table */}
      <Card className="overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="border-b px-4 bg-muted/20">
            <TabsList className="h-auto bg-transparent gap-0 p-0 rounded-none">
              <TabsTrigger
                value="overdue"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:text-red-600 data-[state=active]:bg-transparent px-4 py-3 text-sm font-medium"
              >
                Overdue
                {overdue.length > 0 && (
                  <Badge variant="destructive" className="ml-2 text-[10px] h-4 min-w-4 px-1">
                    {overdue.length}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="due-soon"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 data-[state=active]:bg-transparent px-4 py-3 text-sm font-medium"
              >
                Due Soon
                {dueSoon.length > 0 && (
                  <Badge className="ml-2 text-[10px] h-4 min-w-4 px-1 bg-orange-500 text-white">
                    {dueSoon.length}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="open"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent px-4 py-3 text-sm font-medium"
              >
                All Open
                {allOpen.length > 0 && (
                  <Badge className="ml-2 text-[10px] h-4 min-w-4 px-1 bg-blue-500 text-white">
                    {allOpen.length}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="returned"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 data-[state=active]:bg-transparent px-4 py-3 text-sm font-medium"
              >
                Returned
                {returned.length > 0 && (
                  <Badge className="ml-2 text-[10px] h-4 min-w-4 px-1 bg-emerald-500 text-white">
                    {returned.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overdue" className="m-0">
            <PassTable
              passes={sortedOverdue}
              emptyIcon={<CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30 text-green-500" />}
              emptyMessage="No overdue returnable gate passes — all clear!"
            />
          </TabsContent>

          <TabsContent value="due-soon" className="m-0">
            <PassTable
              passes={filteredDueSoon}
              emptyIcon={<Clock className="h-10 w-10 mx-auto mb-3 opacity-30 text-orange-400" />}
              emptyMessage="No passes due within the next 7 days"
            />
          </TabsContent>

          <TabsContent value="open" className="m-0">
            <PassTable
              passes={sortedOpen}
              emptyIcon={<RotateCcw className="h-10 w-10 mx-auto mb-3 opacity-30 text-blue-400" />}
              emptyMessage="No open returnable gate passes"
            />
          </TabsContent>

          <TabsContent value="returned" className="m-0">
            <PassTable
              passes={filteredReturned}
              showActualReturn
              emptyIcon={<CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30 text-emerald-400" />}
              emptyMessage="No returned gate passes yet"
            />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
