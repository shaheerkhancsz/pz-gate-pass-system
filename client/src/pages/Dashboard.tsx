import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { StatisticsCards } from "@/components/dashboard/StatisticsCards";
import { RecentGatePasses } from "@/components/dashboard/RecentGatePasses";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { DashboardRoleWidgets } from "@/components/dashboard/DashboardRoleWidgets";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  SlidersHorizontal, LayoutDashboard, List, Bell, Zap, LayoutGrid,
  PlusCircle, BarChart2,
} from "lucide-react";

interface DashboardWidget {
  id: string;
  name: string;
  description: string;
  active: boolean;
  order: number;
}

function useLocalStorageState<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch {
      // ignore storage errors
    }
  };

  return [storedValue, setValue];
}

const WIDGET_ICONS: Record<string, React.ReactNode> = {
  statistics:      <LayoutDashboard className="h-5 w-5 text-primary" />,
  recent:          <List className="h-5 w-5 text-primary" />,
  activity:        <Bell className="h-5 w-5 text-primary" />,
  "quick-actions": <Zap className="h-5 w-5 text-primary" />,
};

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const currentDate = formatDate(new Date());

  const defaultWidgets: DashboardWidget[] = [
    { id: "statistics",    name: "Statistics & Analytics", description: "Overview of gate pass metrics",  active: true, order: 1 },
    { id: "recent",        name: "Recent Gate Passes",     description: "Latest created gate passes",     active: true, order: 2 },
    { id: "activity",      name: "Activity Feed",          description: "Recent user activities",          active: true, order: 3 },
    { id: "quick-actions", name: "Quick Actions",          description: "Shortcuts to common tasks",       active: true, order: 4 },
  ];

  const [widgets, setWidgets] = useLocalStorageState<DashboardWidget[]>("dashboard-widgets", defaultWidgets);
  const [customizingWidgets, setCustomizingWidgets] = useState(false);

  const toggleWidget = (id: string) =>
    setWidgets(widgets.map(w => (w.id === id ? { ...w, active: !w.active } : w)));

  const changeWidgetOrder = (id: string, newOrder: number) =>
    setWidgets((prev: DashboardWidget[]) =>
      prev
        .map(w => (w.id === id ? { ...w, order: newOrder } : w))
        .sort((a, b) => a.order - b.order),
    );

  const resetWidgets = () => setWidgets(defaultWidgets);

  const activeWidgets = widgets
    .filter(w => w.active)
    .sort((a, b) => a.order - b.order);

  // Used to decouple Activity Feed from Recent Gate Passes widget
  const activityWidgetActive = activeWidgets.some(w => w.id === "activity");

  return (
    <AppLayout>
      <div className="animate-fadeIn pb-10">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{currentDate}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCustomizingWidgets(!customizingWidgets)}
          >
            <SlidersHorizontal className="h-4 w-4 mr-1.5" />
            {customizingWidgets ? "Done" : "Customize"}
          </Button>
        </div>

        {/* ── Widget Customization Panel ── */}
        {customizingWidgets && (
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center justify-between">
                <span>Customize Dashboard</span>
                <Button variant="ghost" size="sm" onClick={resetWidgets}>
                  Reset to Default
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {widgets.map(widget => (
                  <div
                    key={widget.id}
                    className="flex items-start p-4 border border-border rounded-md bg-card"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mr-3 shrink-0">
                      {WIDGET_ICONS[widget.id] ?? <LayoutGrid className="h-5 w-5 text-primary" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm">{widget.name}</p>
                        <Switch
                          checked={widget.active}
                          onCheckedChange={() => toggleWidget(widget.id)}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{widget.description}</p>
                      <div className="flex items-center">
                        <span className="text-xs mr-2 text-muted-foreground">Order:</span>
                        <Select
                          value={widget.order.toString()}
                          onValueChange={v => changeWidgetOrder(widget.id, parseInt(v))}
                        >
                          <SelectTrigger className="h-7 w-16">
                            <SelectValue placeholder="Order" />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4].map(n => (
                              <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Role-specific widgets (HOD / Security / My Active / Overdue) ── */}
        <DashboardRoleWidgets />

        {/* ── Main Widgets ── */}
        {activeWidgets.map(widget => (
          <div key={widget.id} className="mb-6">

            {widget.id === "statistics" && isAdmin && <StatisticsCards />}

            {widget.id === "recent" && (
              <div className={activityWidgetActive ? "grid grid-cols-1 lg:grid-cols-3 gap-6" : ""}>
                <div className={activityWidgetActive ? "lg:col-span-2" : ""}>
                  <RecentGatePasses />
                </div>
                {activityWidgetActive && (
                  <div className="lg:col-span-1">
                    <ActivityFeed />
                  </div>
                )}
              </div>
            )}

            {/* Only render standalone when Recent widget is off */}
            {widget.id === "activity" && !activeWidgets.some(w => w.id === "recent") && (
              <ActivityFeed />
            )}

            {widget.id === "quick-actions" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link href="/create-gate-pass">
                      <a className="block p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <PlusCircle className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Create Gate Pass</p>
                            <p className="text-xs text-muted-foreground">Generate a new gate pass</p>
                          </div>
                        </div>
                      </a>
                    </Link>

                    <Link href="/gate-passes">
                      <a className="block p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                            <List className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">View Gate Passes</p>
                            <p className="text-xs text-muted-foreground">Browse all gate passes</p>
                          </div>
                        </div>
                      </a>
                    </Link>

                    <Link href="/reports">
                      <a className="block p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                            <BarChart2 className="h-5 w-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Generate Reports</p>
                            <p className="text-xs text-muted-foreground">Create PDF or Excel reports</p>
                          </div>
                        </div>
                      </a>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        ))}
      </div>
    </AppLayout>
  );
}
