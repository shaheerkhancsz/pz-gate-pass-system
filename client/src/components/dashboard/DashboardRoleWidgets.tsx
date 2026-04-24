/**
 * Phase 14: Role-specific dashboard widgets
 * - HOD:      "My Pending Approvals" (pending passes in their department)
 * - Security: "Awaiting Security Clearance" (approved passes)
 * - All:      "My Active Passes" (passes the current user created that are non-terminal)
 * - Overdue returnable alert banner (shown to everyone with relevant passes)
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/use-permissions";
import { getStatusBadgeClass, getStatusLabel } from "@/components/ui/theme";
import { formatDate } from "@/lib/utils";
import { AlertTriangle, Clock, RotateCcw, ShieldCheck, User } from "lucide-react";

interface GatePass {
  id: number;
  gatePassNumber: string;
  customerName: string;
  department: string;
  status: string;
  type: string;
  date: string;
  expectedReturnDate?: string | null;
  actualReturnDate?: string | null;
  createdById: number;
}

const TERMINAL = ["completed", "rejected", "force_closed"];

export function DashboardRoleWidgets() {
  const { user, isAdmin } = useAuth();
  const { hasPermission } = usePermissions();

  const isHod = hasPermission("gatePass", "approve");
  const isSecurity = hasPermission("gatePass", "verify");

  // Fetch all gate passes (server scopes by company already)
  const { data: allPasses = [] } = useQuery<GatePass[]>({
    queryKey: ["/api/gate-passes"],
  });

  // HOD widget: pending passes in HOD's department
  const hodPending = isHod && user?.department
    ? allPasses.filter(p => p.status === "pending" && p.department === user.department)
    : [];

  // Security widget: passes HOD-approved and awaiting security
  // Covers both "approved" (legacy) and "hod_approved" (current) status values
  const HOD_APPROVED = ["approved", "hod_approved"];

  const awaitingSecurity = isSecurity
    ? allPasses.filter(p => HOD_APPROVED.includes(p.status))
    : [];

  // My active passes (non-terminal, created by me)
  const myActive = allPasses.filter(
    p => p.createdById === user?.id && !TERMINAL.includes(p.status)
  );

  // Overdue returnables
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueReturnables = allPasses.filter(p => {
    if (p.type !== "returnable" || TERMINAL.includes(p.status)) return false;
    if (!p.expectedReturnDate) return false;
    if (p.actualReturnDate) return false; // already physically returned
    return new Date(p.expectedReturnDate) < today;
  });

  const hasAnyRoleWidget = hodPending.length > 0 || awaitingSecurity.length > 0 || myActive.length > 0 || overdueReturnables.length > 0;
  if (!hasAnyRoleWidget) return null;

  return (
    <div className="space-y-4 mb-6">
      {/* Overdue Returnables Alert Banner */}
      {overdueReturnables.length > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-5 py-3">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <span className="font-medium text-red-700">
              {overdueReturnables.length} overdue returnable gate pass{overdueReturnables.length !== 1 ? "es" : ""}
            </span>
            <span className="text-red-600 text-sm ml-2">— expected return date has passed.</span>
          </div>
          <Link href="/reports?tab=returnables">
            <a className="text-sm text-red-600 underline hover:text-red-800 flex-shrink-0">View in Reports</a>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* HOD Pending Approvals — visible to users with approve permission */}
        {isHod && hodPending.length > 0 && (
          <RoleWidget
            icon={<Clock className="h-5 w-5 text-amber-600" />}
            iconBg="bg-amber-50"
            title="My Pending Approvals"
            count={hodPending.length}
            countColor="text-amber-600"
            passes={hodPending.slice(0, 5)}
            viewAllHref="/gate-passes"
          />
        )}

        {/* Security Awaiting Clearance — visible to security officers only */}
        {isSecurity && awaitingSecurity.length > 0 && (
          <RoleWidget
            icon={<ShieldCheck className="h-5 w-5 text-blue-600" />}
            iconBg="bg-blue-50"
            title="Awaiting Security Clearance"
            count={awaitingSecurity.length}
            countColor="text-blue-600"
            passes={awaitingSecurity.slice(0, 5)}
            viewAllHref="/gate-passes"
          />
        )}

        {/* My Active Passes — visible to any user who has created passes */}
        {myActive.length > 0 && (
          <RoleWidget
            icon={<User className="h-5 w-5 text-emerald-600" />}
            iconBg="bg-emerald-50"
            title="My Active Passes"
            count={myActive.length}
            countColor="text-emerald-600"
            passes={myActive.slice(0, 5)}
            viewAllHref="/gate-passes"
          />
        )}

        {/* Overdue Returnables — visible to anyone who can see overdue passes */}
        {overdueReturnables.length > 0 && (
          <RoleWidget
            icon={<RotateCcw className="h-5 w-5 text-red-600" />}
            iconBg="bg-red-50"
            title="Overdue Returnables"
            count={overdueReturnables.length}
            countColor="text-red-600"
            passes={overdueReturnables.slice(0, 5)}
            viewAllHref="/reports?tab=returnables"
            subLabel={(p) => p.expectedReturnDate ? `Due: ${formatDate(p.expectedReturnDate)}` : ""}
          />
        )}
      </div>
    </div>
  );
}

interface RoleWidgetProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  count: number;
  countColor: string;
  passes: GatePass[];
  viewAllHref: string;
  subLabel?: (p: GatePass) => string;
}

function RoleWidget({ icon, iconBg, title, count, countColor, passes, viewAllHref, subLabel }: RoleWidgetProps) {
  return (
    <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-full ${iconBg} flex items-center justify-center`}>
            {icon}
          </div>
          <span className="font-medium text-gray-800 text-sm">{title}</span>
        </div>
        <span className={`text-lg font-bold ${countColor}`}>{count}</span>
      </div>
      <div className="divide-y divide-border/50">
        {passes.map(p => (
          <Link key={p.id} href={`/view-gate-pass/${p.id}`}>
            <a className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{p.gatePassNumber}</p>
                <p className="text-xs text-gray-400 truncate">
                  {subLabel ? subLabel(p) : p.customerName}
                </p>
              </div>
              <span className={`ml-2 flex-shrink-0 px-2 py-0.5 rounded-full text-[11px] ${getStatusBadgeClass(p.status)}`}>
                {getStatusLabel(p.status)}
              </span>
            </a>
          </Link>
        ))}
      </div>
      {count > 5 && (
        <Link href={viewAllHref}>
          <a className="block text-center text-xs text-blue-600 hover:text-blue-800 py-2 border-t border-gray-50">
            +{count - 5} more — View all
          </a>
        </Link>
      )}
    </div>
  );
}
