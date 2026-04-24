import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface Notification {
  id: number;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "error";
  read: boolean;
  entityType: string | null;
  entityId: number | null;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const TYPE_COLORS: Record<string, string> = {
  info:    "bg-blue-100 text-blue-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-yellow-100 text-yellow-800",
  error:   "bg-red-100 text-red-700",
};

const TYPE_DOT: Record<string, string> = {
  info:    "bg-blue-500",
  success: "bg-green-500",
  warning: "bg-yellow-500",
  error:   "bg-red-500",
};

// Play a soft two-tone chime using Web Audio API (no audio file required)
function playNotificationChime() {
  try {
    const ctx = new AudioContext();
    const playTone = (freq: number, startAt: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt);
      gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + duration);
    };
    playTone(880, 0, 0.25);   // high note
    playTone(660, 0.18, 0.3); // lower note
    setTimeout(() => ctx.close(), 1000);
  } catch {
    // Browser may block AudioContext without user interaction — silently ignore
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [ringing, setRinging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevUnreadRef = useRef<number | null>(null);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // Poll unread count every 10s for timely alerts
  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 10_000,
  });

  // Fetch full list only when panel is open
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: open,
    refetchInterval: open ? 15_000 : false,
  });

  const markRead = useMutation({
    mutationFn: (id: number) =>
      apiRequest("PATCH", `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const unread = countData?.count ?? 0;

  // Play chime + ring animation when unread count increases
  useEffect(() => {
    if (prevUnreadRef.current === null) {
      // First load — just record baseline, don't play sound
      prevUnreadRef.current = unread;
      return;
    }
    if (unread > prevUnreadRef.current) {
      playNotificationChime();
      setRinging(true);
      setTimeout(() => setRinging(false), 700);
    }
    prevUnreadRef.current = unread;
  }, [unread]);

  function handleNotifClick(n: Notification) {
    if (!n.read) markRead.mutate(n.id);
    if (n.entityType === "gatePass" && n.entityId) {
      navigate(`/view-gate-pass/${n.entityId}`);
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors focus:outline-none"
        aria-label="Notifications"
      >
        <Bell className={`h-5 w-5 text-gray-600 transition-transform ${ringing ? "animate-bell" : ""}`} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-10 z-50 w-[calc(100vw-1rem)] sm:w-80 md:w-96 max-w-sm sm:max-w-none rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800">Notifications</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={() => markAll.mutate()}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Bell className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${
                    !n.read ? "bg-blue-50/40" : ""
                  }`}
                >
                  {/* Color dot */}
                  <div className="mt-1.5 flex-shrink-0">
                    <span className={`inline-block h-2 w-2 rounded-full ${TYPE_DOT[n.type] || "bg-gray-400"}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium truncate ${!n.read ? "text-gray-900" : "text-gray-600"}`}>
                        {n.title}
                      </p>
                      <span className="flex-shrink-0 text-[11px] text-gray-400">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{n.message}</p>
                    {n.entityType === "gatePass" && n.entityId && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-500">
                        <ExternalLink className="h-3 w-3" /> View gate pass
                      </span>
                    )}
                  </div>

                  {/* Unread indicator */}
                  {!n.read && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markRead.mutate(n.id); }}
                      className="flex-shrink-0 mt-1 text-gray-300 hover:text-blue-500 transition-colors"
                      title="Mark as read"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 text-center">
              <span className="text-xs text-gray-400">
                Showing last {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
