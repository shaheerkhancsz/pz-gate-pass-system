import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { StatisticsCards } from "@/components/dashboard/StatisticsCards";
import { RecentGatePasses } from "@/components/dashboard/RecentGatePasses";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/hooks/use-permissions";

interface DashboardWidget {
  id: string;
  name: string;
  description: string;
  active: boolean;
  order: number;
}

type WidgetIcons = Record<string, string>;

// Custom hook to replace useLocalStorage until it's fixed
function useLocalStorageState<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);
      // Parse stored json or if none return initialValue
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // If error also return initialValue
      console.log(error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      // Save state
      setStoredValue(valueToStore);
      // Save to local storage
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      // A more advanced implementation would handle the error case
      console.log(error);
    }
  };

  return [storedValue, setValue];
}

export default function Dashboard() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const currentDate = formatDate(new Date());
  
  // Default widgets configuration
  const defaultWidgets: DashboardWidget[] = [
    { id: 'statistics', name: 'Statistics & Analytics', description: 'Overview of gate pass metrics', active: true, order: 1 },
    { id: 'recent', name: 'Recent Gate Passes', description: 'Latest created gate passes', active: true, order: 2 },
    { id: 'activity', name: 'Activity Feed', description: 'Recent user activities', active: true, order: 3 },
    { id: 'quick-actions', name: 'Quick Actions', description: 'Shortcuts to common tasks', active: true, order: 4 },
  ];
  
  // Widget icons mapping
  const widgetIcons: WidgetIcons = {
    'statistics': 'dashboard',
    'recent': 'list_alt',
    'activity': 'notifications_active',
    'quick-actions': 'speed',
  };
  
  // Load user preferences from localStorage
  const [widgets, setWidgets] = useLocalStorageState<DashboardWidget[]>(
    'dashboard-widgets', 
    defaultWidgets
  );
  
  // Widget customization panel state
  const [customizingWidgets, setCustomizingWidgets] = useState(false);
  
  // Toggle widget active state
  const toggleWidget = (id: string) => {
    setWidgets(
      widgets.map((widget: DashboardWidget) => 
        widget.id === id 
          ? { ...widget, active: !widget.active } 
          : widget
      )
    );
  };
  
  // Change widget order
  const changeWidgetOrder = (id: string, newOrder: number) => {
    setWidgets((prev: DashboardWidget[]) => {
      const updated = prev.map((widget: DashboardWidget) => 
        widget.id === id 
          ? { ...widget, order: newOrder } 
          : widget
      );
      return updated.sort((a: DashboardWidget, b: DashboardWidget) => a.order - b.order);
    });
  };
  
  // Reset to default configuration
  const resetWidgets = () => {
    setWidgets(defaultWidgets);
  };
  
  // Filter active widgets and sort by order
  const activeWidgets = widgets
    .filter((widget: DashboardWidget) => widget.active)
    .sort((a: DashboardWidget, b: DashboardWidget) => a.order - b.order);

  return (
    <AppLayout>
      <div className="animate-fadeIn pb-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-medium text-neutral-dark">Dashboard</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-neutral-gray">Today:</span>
              <span className="text-sm font-medium">{currentDate}</span>
            </div>
            
            {/* Always show customize button for now */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCustomizingWidgets(!customizingWidgets)}
              className="flex items-center"
            >
              <span className="material-icons text-sm mr-1">dashboard_customize</span>
              {customizingWidgets ? 'Done' : 'Customize'}
            </Button>
          </div>
        </div>
        
        {/* Widget Customization Panel */}
        {customizingWidgets && (
          <Card className="mb-6 bg-neutral-lightest">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center justify-between">
                <span>Customize Dashboard</span>
                <Button variant="ghost" size="sm" onClick={resetWidgets}>
                  Reset to Default
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {widgets.map((widget: DashboardWidget) => (
                  <div 
                    key={widget.id}
                    className="flex items-start p-4 border rounded-md bg-white"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary bg-opacity-10 flex items-center justify-center mr-3 flex-shrink-0">
                      <span className="material-icons text-primary">
                        {widgetIcons[widget.id] || 'widgets'}
                      </span>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium">{widget.name}</p>
                        <Switch 
                          checked={widget.active}
                          onCheckedChange={() => toggleWidget(widget.id)}
                        />
                      </div>
                      <p className="text-xs text-neutral-gray mb-2">{widget.description}</p>
                      
                      <div className="flex items-center">
                        <span className="text-xs mr-2">Order:</span>
                        <Select
                          value={widget.order.toString()}
                          onValueChange={(value) => changeWidgetOrder(widget.id, parseInt(value))}
                        >
                          <SelectTrigger className="h-7 w-16">
                            <SelectValue placeholder="Order" />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4].map((num) => (
                              <SelectItem key={num} value={num.toString()}>
                                {num}
                              </SelectItem>
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
        
        {/* Dashboard Widgets - Conditionally rendered based on user preferences */}
        {activeWidgets.map((widget: DashboardWidget) => (
          <div key={widget.id} className="mb-6">
            {widget.id === 'statistics' && <StatisticsCards />}
            
            {widget.id === 'recent' && 
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Gate Passes */}
                <div className="lg:col-span-2">
                  <RecentGatePasses />
                </div>
                
                {/* Activity Feed */}
                <div className="lg:col-span-1">
                  <ActivityFeed />
                </div>
              </div>
            }
            
            {widget.id === 'activity' && !activeWidgets.some(w => w.id === 'recent') && (
              <ActivityFeed />
            )}
            
            {widget.id === 'quick-actions' && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="font-medium mb-4">Quick Actions</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Link href="/create-gate-pass">
                    <a className="block p-4 border border-neutral-medium rounded-lg hover:bg-neutral-lightest transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-primary bg-opacity-10 flex items-center justify-center">
                          <span className="material-icons text-primary">add_circle</span>
                        </div>
                        <div>
                          <p className="font-medium">Create Gate Pass</p>
                          <p className="text-xs text-neutral-gray">Generate a new gate pass</p>
                        </div>
                      </div>
                    </a>
                  </Link>
                  
                  <Link href="/gate-passes">
                    <a className="block p-4 border border-neutral-medium rounded-lg hover:bg-neutral-lightest transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-info bg-opacity-10 flex items-center justify-center">
                          <span className="material-icons text-info">list_alt</span>
                        </div>
                        <div>
                          <p className="font-medium">View Gate Passes</p>
                          <p className="text-xs text-neutral-gray">Browse all gate passes</p>
                        </div>
                      </div>
                    </a>
                  </Link>
                  
                  <Link href="/reports">
                    <a className="block p-4 border border-neutral-medium rounded-lg hover:bg-neutral-lightest transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-warning bg-opacity-10 flex items-center justify-center">
                          <span className="material-icons text-warning">assessment</span>
                        </div>
                        <div>
                          <p className="font-medium">Generate Reports</p>
                          <p className="text-xs text-neutral-gray">Create PDF or Excel reports</p>
                        </div>
                      </div>
                    </a>
                  </Link>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
