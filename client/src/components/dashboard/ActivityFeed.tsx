import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

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
  icon: string;
  iconColor: string;
  user: string;
  action: string;
  gatePass?: string;
  time: string;
}

// Map action types to icons and colors
const actionIconMap: Record<string, { icon: string; color: string }> = {
  'create': { icon: 'assignment', color: 'bg-primary' },
  'update': { icon: 'edit', color: 'bg-warning' },
  'delete': { icon: 'delete', color: 'bg-error' },
  'approve': { icon: 'check_circle', color: 'bg-success' },
  'reject': { icon: 'cancel', color: 'bg-error' },
  'print': { icon: 'print', color: 'bg-info' },
  'verify': { icon: 'verified', color: 'bg-info' },
  'login': { icon: 'login', color: 'bg-neutral' },
  'logout': { icon: 'logout', color: 'bg-neutral' }
};

// Default fallback icon and color
const defaultIcon = { icon: 'info', color: 'bg-neutral' };

// Format timestamps in a user-friendly way
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  
  // Check if the date is today or yesterday
  const now = new Date();
  const isToday = date.getDate() === now.getDate() &&
                 date.getMonth() === now.getMonth() &&
                 date.getFullYear() === now.getFullYear();
  
  const isYesterday = date.getDate() === now.getDate() - 1 &&
                     date.getMonth() === now.getMonth() &&
                     date.getFullYear() === now.getFullYear();

  if (isToday) {
    return `Today at ${format(date, 'h:mm a')}`;
  } else if (isYesterday) {
    return `Yesterday at ${format(date, 'h:mm a')}`;
  } else if (Date.now() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
    // Less than a week ago
    return formatDistanceToNow(date, { addSuffix: true });
  } else {
    return format(date, 'MMM d, yyyy, h:mm a');
  }
}

// Convert an activity log to a display-friendly format
function mapActivityLogToDisplay(log: UserActivityLog): Activity {
  // Parse additionalData if it exists
  let additionalData: any = null;
  if (log.additionalData) {
    try {
      additionalData = JSON.parse(log.additionalData);
    } catch (e) {
      console.error("Failed to parse additionalData:", e);
    }
  }
  
  // Get the appropriate icon and color based on action type
  const actionKey = log.actionType.toLowerCase();
  const { icon, color } = actionIconMap[actionKey] || defaultIcon;

  // Extract gate pass number from additional data if available
  let gatePass: string | undefined = undefined;
  if (log.entityType === 'gatePass' && additionalData?.gatePassNumber) {
    gatePass = additionalData.gatePassNumber;
  }

  // Format the action string
  let actionStr = log.actionType.toLowerCase();
  if (log.entityType) {
    actionStr += ` ${log.entityType.replace(/([A-Z])/g, ' $1').toLowerCase()}`;
  }

  return {
    id: log.id,
    icon,
    iconColor: color,
    user: log.userEmail.split('@')[0], // Just show the username part
    action: actionStr,
    gatePass,
    time: formatTimestamp(log.timestamp)
  };
}

interface ActivityFeedProps {
  limit?: number;
}

export function ActivityFeed({ limit = 5 }: ActivityFeedProps) {
  // Fetch activity logs from the API
  const { data: activityLogs, isLoading, error } = useQuery({
    queryKey: ['/api/activity-logs'],
    queryFn: async () => {
      const response = await fetch('/api/activity-logs');
      if (!response.ok) {
        throw new Error('Failed to fetch activity logs');
      }
      return response.json() as Promise<UserActivityLog[]>;
    }
  });
  
  // Map and limit activity logs
  const activities = activityLogs 
    ? activityLogs
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit)
        .map(mapActivityLogToDisplay)
    : [];

  return (
    <Card className="h-full">
      <CardHeader className="p-6 border-b border-neutral-medium">
        <CardTitle className="font-medium">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="p-6 overflow-y-auto" style={{ maxHeight: "400px" }}>
        {isLoading ? (
          // Loading state
          <div className="space-y-6">
            {Array(limit).fill(0).map((_, index) => (
              <div key={index} className="flex items-start space-x-4">
                <Skeleton className="h-8 w-8 rounded-full bg-neutral-lightest flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4 bg-neutral-lightest" />
                  <Skeleton className="h-3 w-1/3 bg-neutral-lightest" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          // Error state
          <div className="py-8 text-center">
            <span className="material-icons text-error mb-2">error_outline</span>
            <p className="text-sm text-neutral-gray">Failed to load activity logs</p>
          </div>
        ) : activities.length === 0 ? (
          // Empty state
          <div className="py-8 text-center">
            <span className="material-icons text-neutral-medium mb-2">history</span>
            <p className="text-sm text-neutral-gray">No activity logs available</p>
          </div>
        ) : (
          // Activity list
          <div className="space-y-6">
            {activities.map(activity => (
              <div key={activity.id} className="flex items-start space-x-4">
                <div className={`h-8 w-8 rounded-full ${activity.iconColor} flex items-center justify-center flex-shrink-0`}>
                  <span className="material-icons text-white text-sm">{activity.icon}</span>
                </div>
                <div>
                  <p className="text-sm">
                    <span className="font-medium">{activity.user}</span> {activity.action} {" "}
                    {activity.gatePass && <span className="font-medium text-primary">{activity.gatePass}</span>}
                  </p>
                  <p className="text-xs text-neutral-gray mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
