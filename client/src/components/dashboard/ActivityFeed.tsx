import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FilePlus, Pencil, Trash2, CheckCircle2, XCircle,
  Printer, ShieldCheck, LogIn, LogOut, Info, AlertCircle, History,
} from "lucide-react";

interface UserActivityLog {
  id: number;
  userId: number | null;
  userEmail: string;
  actionType: string;
  entityType: string | null;
  entityId: number | null;
  description: string | null;
  timestamp: string;
  additionalData: string | null;
}

interface Activity {
  id: number;
  IconComponent: React.ElementType;
  iconBg: string;
  user: string;
  action: string;
  gatePass?: string;
  time: string;
}

// Maps action type → { Lucide component, tailwind bg class }
const ACTION_ICON_MAP: Record<string, { Icon: React.ElementType; bg: string }> = {
  create:  { Icon: FilePlus,    bg: "bg-primary"     },
  update:  { Icon: Pencil,      bg: "bg-amber-500"   },
  delete:  { Icon: Trash2,      bg: "bg-red-500"     },
  approve: { Icon: CheckCircle2,bg: "bg-emerald-500" },
  reject:  { Icon: XCircle,     bg: "bg-red-500"     },
  print:   { Icon: Printer,     bg: "bg-blue-500"    },
  verify:  { Icon: ShieldCheck, bg: "bg-blue-500"    },
  login:   { Icon: LogIn,       bg: "bg-gray-400"    },
  logout:  { Icon: LogOut,      bg: "bg-gray-400"    },
};
const DEFAULT_ICON = { Icon: Info, bg: "bg-gray-400" };

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();

  const sameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (sameDay(date, now))       return `Today at ${format(date, "h:mm a")}`;
  if (sameDay(date, yesterday)) return `Yesterday at ${format(date, "h:mm a")}`;
  if (Date.now() - date.getTime() < 7 * 24 * 60 * 60 * 1000)
    return formatDistanceToNow(date, { addSuffix: true });
  return format(date, "MMM d, yyyy, h:mm a");
}

function mapLog(log: UserActivityLog): Activity {
  let additionalData: any = null;
  if (log.additionalData) {
    try { additionalData = JSON.parse(log.additionalData); } catch { /* ignore */ }
  }

  const key = log.actionType.toLowerCase();
  const { Icon, bg } = ACTION_ICON_MAP[key] ?? DEFAULT_ICON;

  let gatePass: string | undefined;
  if (log.entityType === "gatePass" && additionalData?.gatePassNumber) {
    gatePass = additionalData.gatePassNumber;
  }

  const actionStr = log.entityType
    ? `${key} ${log.entityType.replace(/([A-Z])/g, " $1").toLowerCase()}`
    : key;

  return {
    id: log.id,
    IconComponent: Icon,
    iconBg: bg,
    user: log.userEmail.split("@")[0],
    action: actionStr,
    gatePass,
    time: formatTimestamp(log.timestamp),
  };
}

interface ActivityFeedProps {
  limit?: number;
}

export function ActivityFeed({ limit = 5 }: ActivityFeedProps) {
  const { data: activityLogs, isLoading, error } = useQuery({
    queryKey: ["/api/activity-logs"],
    queryFn: async () => {
      const res = await fetch("/api/activity-logs?limit=20", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch activity logs");
      const result = await res.json();
      return (result.logs ?? result) as UserActivityLog[];
    },
  });

  const activities = activityLogs
    ? activityLogs.slice(0, limit).map(mapLog)
    : [];

  return (
    <Card className="h-full">
      <CardHeader className="p-6 border-b">
        <CardTitle className="font-medium">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="p-6 overflow-y-auto" style={{ maxHeight: "400px" }}>
        {isLoading ? (
          <div className="space-y-6">
            {Array(limit).fill(0).map((_, i) => (
              <div key={i} className="flex items-start space-x-4">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Failed to load activity</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="py-8 text-center">
            <History className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No activity yet</p>
          </div>
        ) : (
          <div className="space-y-5">
            {activities.map(activity => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className={`h-8 w-8 rounded-full ${activity.iconBg} flex items-center justify-center shrink-0`}>
                  <activity.IconComponent className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm">
                    <span className="font-medium">{activity.user}</span>{" "}
                    {activity.action}{" "}
                    {activity.gatePass && (
                      <span className="font-medium text-primary">{activity.gatePass}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
