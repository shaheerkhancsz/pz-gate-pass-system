import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, LineChart, PieChart, ResponsiveContainer,
  XAxis, YAxis, Tooltip, Bar, Line, Cell, Pie, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  FileText, CalendarDays, Calendar, Clock,
  TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle2, RefreshCw,
  ClipboardList, ShieldCheck, RotateCcw,
} from "lucide-react";
import { getStatusLabel } from "@/components/ui/theme";

interface StatusDistribution    { status: string;     count: number; }
interface DepartmentDistribution { department: string; count: number; }
interface MonthlyTrend  { month: string; count: number; }
interface DailyTrend    { date: string;  count: number; }

interface StatisticsProps {
  totalPasses: number;
  monthlyPasses: number;
  weeklyPasses: number;
  pendingApprovals: number;
  pendingHOD: number;
  pendingSecurity: number;
  sentBack: number;
  statusDistribution: StatusDistribution[];
  departmentDistribution: DepartmentDistribution[];
  monthlyTrend: MonthlyTrend[];
  dailyTrend: DailyTrend[];
}

// Explicit hex colors — CSS variable chart tokens are not defined in index.css
const PIE_COLORS   = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];
const LINE_COLOR   = "#6366f1";
const BAR_COLOR    = "#10b981";
const DEPT_COLOR   = "#3b82f6";

function formatDisplayDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function calcPctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  if (isNaN(current) || isNaN(previous)) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

function TrendBadge({ pct }: { pct: number }) {
  if (pct > 0) return (
    <>
      <TrendingUp className="h-4 w-4 mr-1" />
      <span>{pct}% increase</span>
      <span className="text-muted-foreground ml-1">from previous</span>
    </>
  );
  if (pct < 0) return (
    <>
      <TrendingDown className="h-4 w-4 mr-1" />
      <span>{Math.abs(pct)}% decrease</span>
      <span className="text-muted-foreground ml-1">from previous</span>
    </>
  );
  return <><Minus className="h-4 w-4 mr-1" /><span className="text-muted-foreground">No change</span></>;
}

export function StatisticsCards() {
  const { data: statistics, isLoading, error, refetch } = useQuery<StatisticsProps>({
    queryKey: ["/api/statistics"],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    retry: 3,
    staleTime: 0,
  });

  // ── Error state ──────────────────────────────────────────────────────────────
  if (error instanceof Error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card className="col-span-full">
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Error loading statistics: {error.message}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1.5" />Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (isLoading || !statistics) {
    return (
      <div className="space-y-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse flex space-x-4">
                  <div className="flex-1 space-y-4 py-1">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-8 bg-muted rounded" />
                    <div className="h-4 bg-muted rounded w-5/6" />
                  </div>
                  <div className="h-12 w-12 rounded-full bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="h-6 bg-muted rounded w-1/3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ── Prepare chart data ───────────────────────────────────────────────────────
  const statusData = statistics.statusDistribution
    .filter(i => i.status && typeof i.count === "number" && i.count >= 0)
    .map(i => ({ ...i, status: getStatusLabel(i.status) }));

  const departmentData = statistics.departmentDistribution
    .filter(i => i.department && typeof i.count === "number" && i.count >= 0);

  const monthlyTrendData = statistics.monthlyTrend
    .filter(i => i.month && typeof i.count === "number" && i.count >= 0);

  const dailyTrendData = statistics.dailyTrend
    .filter(i => i.date && typeof i.count === "number" && i.count >= 0)
    .map(i => ({ ...i, formattedDate: formatDisplayDate(i.date) }))
    .filter(i => i.formattedDate);

  const monthlyPct = monthlyTrendData.length >= 2
    ? calcPctChange(
        monthlyTrendData[monthlyTrendData.length - 1]?.count || 0,
        monthlyTrendData[monthlyTrendData.length - 2]?.count || 0,
      )
    : 0;

  const weeklyPct = dailyTrendData.length >= 14
    ? calcPctChange(
        dailyTrendData.slice(-7).reduce((s, i) => s + (i.count || 0), 0),
        dailyTrendData.slice(-14, -7).reduce((s, i) => s + (i.count || 0), 0),
      )
    : 0;

  const hasPending = statistics.pendingApprovals > 0;

  return (
    <>
      {/* ── Row 1: 4 summary stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-4">

        {/* Total Gate Passes */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Total Gate Passes</p>
                <h2 className="text-3xl font-semibold mt-1">{statistics.totalPasses}</h2>
              </div>
              <div className="h-12 w-12 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                <FileText className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-muted-foreground text-sm">
              <Minus className="h-4 w-4 mr-1" />
              <span>All time total</span>
            </div>
          </CardContent>
        </Card>

        {/* Passes This Month */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Passes This Month</p>
                <h2 className="text-3xl font-semibold mt-1">{statistics.monthlyPasses}</h2>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                <CalendarDays className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className={`mt-4 flex items-center text-sm ${monthlyPct > 0 ? "text-green-600" : monthlyPct < 0 ? "text-red-500" : "text-muted-foreground"}`}>
              <TrendBadge pct={monthlyPct} />
            </div>
          </CardContent>
        </Card>

        {/* Passes This Week */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Passes This Week</p>
                <h2 className="text-3xl font-semibold mt-1">{statistics.weeklyPasses}</h2>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <Calendar className="h-6 w-6 text-amber-600" />
              </div>
            </div>
            <div className={`mt-4 flex items-center text-sm ${weeklyPct > 0 ? "text-green-600" : weeklyPct < 0 ? "text-red-500" : "text-muted-foreground"}`}>
              <TrendBadge pct={weeklyPct} />
            </div>
          </CardContent>
        </Card>

        {/* Pending Approvals (total) */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Pending Approvals</p>
                <h2 className="text-3xl font-semibold mt-1">{statistics.pendingApprovals}</h2>
              </div>
              <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${hasPending ? "bg-red-500/10" : "bg-green-500/10"}`}>
                <Clock className={`h-6 w-6 ${hasPending ? "text-red-500" : "text-green-600"}`} />
              </div>
            </div>
            <div className={`mt-4 flex items-center text-sm ${hasPending ? "text-amber-600" : "text-green-600"}`}>
              {hasPending ? (
                <><AlertCircle className="h-4 w-4 mr-1" /><span>Needs attention</span></>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-1" /><span>All clear</span></>
              )}
            </div>
          </CardContent>
        </Card>

      </div>

      {/* ── Row 2: Workflow breakdown (3 mini cards) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

        {/* HOD Pending */}
        <Card className="border-l-4 border-l-amber-400">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
              <ClipboardList className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">HOD Pending</p>
              <p className="text-2xl font-semibold text-amber-600">{statistics.pendingHOD}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-muted-foreground">Awaiting HOD</p>
              <p className="text-xs text-muted-foreground">approval</p>
            </div>
          </CardContent>
        </Card>

        {/* Security Awaiting */}
        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Security Awaiting</p>
              <p className="text-2xl font-semibold text-blue-600">{statistics.pendingSecurity}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-muted-foreground">HOD approved,</p>
              <p className="text-xs text-muted-foreground">at gate</p>
            </div>
          </CardContent>
        </Card>

        {/* Sent Back */}
        <Card className="border-l-4 border-l-orange-400">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
              <RotateCcw className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Sent Back</p>
              <p className="text-2xl font-semibold text-orange-600">{statistics.sentBack}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-muted-foreground">Returned to</p>
              <p className="text-xs text-muted-foreground">requester</p>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Monthly Trend */}
        <Card>
          <CardHeader className="border-b py-3 px-6">
            <CardTitle className="text-sm font-medium">Monthly Gate Pass Trend</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={30} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Gate Passes"
                    stroke={LINE_COLOR}
                    strokeWidth={2}
                    activeDot={{ r: 6 }}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Daily Activity */}
        <Card>
          <CardHeader className="border-b py-3 px-6">
            <CardTitle className="text-sm font-medium">Daily Activity (Last 14 Days)</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyTrendData.slice(-14)} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <XAxis dataKey="formattedDate" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={30} />
                  <Tooltip />
                  <Bar dataKey="count" name="Gate Passes" fill={BAR_COLOR} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution Pie */}
        <Card>
          <CardHeader className="border-b py-3 px-6">
            <CardTitle className="text-sm font-medium">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%" cy="50%"
                    outerRadius={75}
                    dataKey="count"
                    nameKey="status"
                    label={({ status, count }) => `${status}: ${count}`}
                    labelLine
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, _, p) => [`${v} passes`, p.payload.status]} />
                  <Legend iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Department Distribution */}
        <Card>
          <CardHeader className="border-b py-3 px-6">
            <CardTitle className="text-sm font-medium">Department Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={departmentData}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
                >
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="department" tick={{ fontSize: 11 }} width={75} />
                  <Tooltip />
                  <Bar dataKey="count" name="Gate Passes" fill={DEPT_COLOR} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

      </div>
    </>
  );
}
