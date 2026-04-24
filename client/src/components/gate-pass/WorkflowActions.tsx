import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/use-permissions";
import { apiRequest } from "@/lib/queryClient";
import { GatePass } from "@shared/schema";
import { getStatusBadgeClass, getStatusLabel } from "@/components/ui/theme";

interface WorkflowActionsProps {
  gatePass: GatePass;
  onActionSuccess?: () => void;
}

type ActionType =
  | "approve"
  | "reject"
  | "send_back"
  | "security_allow"
  | "security_send_back"
  | "complete"
  | "resubmit"
  | "force_close";

interface ApprovalRecord {
  id: number;
  userId: number;
  approvedAt: string;
  userFullName: string | null;
  userEmail: string | null;
}

interface ApprovalSetting {
  id: number;
  userId: number;
  mode: string;
  userFullName: string | null;
  userEmail: string | null;
}

export function WorkflowActions({ gatePass, onActionSuccess }: WorkflowActionsProps) {
  const { user, isAdmin } = useAuth();
  const { canApproveGatePass, canVerifyGatePass, hasPermission } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogAction, setDialogAction] = useState<ActionType | null>(null);
  const [remarks, setRemarks] = useState("");

  const isCreator = user?.id === gatePass.createdById;
  const status = gatePass.status;

  // Fetch per-approver records (for ALL mode progress display)
  const { data: approvalRecords = [] } = useQuery<ApprovalRecord[]>({
    queryKey: ["gate-pass-approvals", gatePass.id],
    queryFn: () =>
      fetch(`/api/gate-passes/${gatePass.id}/approvals`, { credentials: "include" }).then((r) =>
        r.json()
      ),
    enabled: status === "pending",
  });

  // Fetch approval settings for this dept+company (to show mode & required count)
  const { data: approvalSettings = [] } = useQuery<ApprovalSetting[]>({
    queryKey: ["approval-settings", gatePass.companyId, gatePass.department],
    queryFn: () =>
      fetch(
        `/api/approval-settings?companyId=${gatePass.companyId}&department=${encodeURIComponent(gatePass.department)}`,
        { credentials: "include" }
      ).then((r) => r.json()),
    enabled: status === "pending",
  });

  const mode = approvalSettings.length > 0 ? approvalSettings[0].mode : "any";
  const requiredCount = approvalSettings.length;
  const givenCount = approvalRecords.length;
  const currentUserAlreadyApproved = approvalRecords.some((r) => r.userId === user?.id);

  // Determine which actions are available to the current user
  const canApprove =
    (isAdmin || canApproveGatePass()) &&
    status === "pending" &&
    !currentUserAlreadyApproved;

  const canReject =
    (isAdmin || canApproveGatePass()) &&
    !["completed", "rejected"].includes(status);

  const canSendBack =
    (isAdmin || canApproveGatePass()) && status === "pending";

  const canSecurityAllow =
    (isAdmin || canVerifyGatePass()) && status === "approved";

  const canSecuritySendBack =
    (isAdmin || canVerifyGatePass()) && status === "approved";

  const canComplete =
    (isAdmin || canVerifyGatePass()) && status === "security_allowed";

  const canResubmit = (isAdmin || isCreator) && ["sent_back", "rejected"].includes(status);

  // Force Close: admin or gatePass:manage, on any non-terminal status
  const terminalStatuses = ["completed", "rejected", "force_closed"];
  const canForceClose =
    (isAdmin || hasPermission("gatePass", "manage")) &&
    !terminalStatuses.includes(status);

  const hasAnyAction =
    canApprove ||
    canReject ||
    canSendBack ||
    canSecurityAllow ||
    canSecuritySendBack ||
    canComplete ||
    canResubmit ||
    canForceClose;

  const workflowMutation = useMutation({
    mutationFn: async ({ action, remarks }: { action: ActionType; remarks?: string }) => {
      const endpointMap: Record<ActionType, string> = {
        approve: "approve",
        reject: "reject",
        send_back: "send-back",
        security_allow: "security-allow",
        security_send_back: "security-send-back",
        complete: "complete",
        resubmit: "resubmit",
        force_close: "force-close",
      };
      const endpoint = endpointMap[action];
      const response = await apiRequest(
        "POST",
        `/api/gate-passes/${gatePass.id}/${endpoint}`,
        { userId: user?.id, remarks }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Action failed");
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gate-passes"] });
      queryClient.invalidateQueries({ queryKey: [`/api/gate-passes/${gatePass.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
      queryClient.invalidateQueries({ queryKey: ["gate-pass-approvals", gatePass.id] });

      // For ALL mode partial approval — the gate pass stays "pending"
      if (variables.action === "approve" && data.approvalStatus === "pending") {
        toast({
          title: "Approval Recorded",
          description: `Your approval has been recorded. Waiting for other approvers (${givenCount + 1}/${requiredCount}).`,
        });
      } else {
        const labels: Record<ActionType, string> = {
          approve: "Gate pass approved",
          reject: "Gate pass rejected",
          send_back: "Gate pass sent back to initiator",
          security_allow: "Gate pass allowed by security",
          security_send_back: "Gate pass sent back to initiator by security",
          complete: "Gate pass marked as completed",
          resubmit: "Gate pass resubmitted for approval",
          force_close: "Gate pass force closed",
        };
        toast({ title: "Success", description: labels[variables.action] });
      }
      onActionSuccess?.();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAction = (action: ActionType) => {
    if (["reject", "send_back", "security_send_back", "force_close"].includes(action)) {
      setDialogAction(action);
      setRemarks("");
    } else {
      workflowMutation.mutate({ action });
    }
  };

  const handleDialogConfirm = () => {
    if (!dialogAction) return;
    workflowMutation.mutate({ action: dialogAction, remarks });
    setDialogAction(null);
    setRemarks("");
  };

  if (!hasAnyAction) return null;

  return (
    <div className="space-y-3">
      {/* ALL mode progress indicator */}
      {status === "pending" && mode === "all" && requiredCount > 1 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="material-icons text-sm text-blue-500">people</span>
          <span>
            Approvals: <strong>{givenCount}</strong> / <strong>{requiredCount}</strong> required
          </span>
          {givenCount > 0 && (
            <div className="flex gap-1 ml-2">
              {approvalRecords.map((r) => (
                <Badge key={r.id} variant="secondary" className="text-xs">
                  {r.userFullName || r.userEmail}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 [&>button]:w-full [&>button]:sm:w-auto">
        {canApprove && (
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => handleAction("approve")}
            disabled={workflowMutation.isPending}
          >
            <span className="material-icons text-sm mr-1">check_circle</span>
            Approve
          </Button>
        )}

        {canSendBack && (
          <Button
            size="sm"
            variant="outline"
            className="border-orange-500 text-orange-600 hover:bg-orange-50"
            onClick={() => handleAction("send_back")}
            disabled={workflowMutation.isPending}
          >
            <span className="material-icons text-sm mr-1">undo</span>
            Send Back
          </Button>
        )}

        {canReject && (
          <Button
            size="sm"
            variant="outline"
            className="border-red-500 text-red-600 hover:bg-red-50"
            onClick={() => handleAction("reject")}
            disabled={workflowMutation.isPending}
          >
            <span className="material-icons text-sm mr-1">cancel</span>
            Reject
          </Button>
        )}

        {canSecurityAllow && (
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => handleAction("security_allow")}
            disabled={workflowMutation.isPending}
          >
            <span className="material-icons text-sm mr-1">verified_user</span>
            Security Allow
          </Button>
        )}

        {canSecuritySendBack && (
          <Button
            size="sm"
            variant="outline"
            className="border-orange-500 text-orange-600 hover:bg-orange-50"
            onClick={() => handleAction("security_send_back")}
            disabled={workflowMutation.isPending}
          >
            <span className="material-icons text-sm mr-1">undo</span>
            Send Back
          </Button>
        )}

        {canComplete && (
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => handleAction("complete")}
            disabled={workflowMutation.isPending}
          >
            <span className="material-icons text-sm mr-1">task_alt</span>
            Mark Completed
          </Button>
        )}

        {canResubmit && (
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => handleAction("resubmit")}
            disabled={workflowMutation.isPending}
          >
            <span className="material-icons text-sm mr-1">replay</span>
            Resubmit
          </Button>
        )}

      </div>

      {canForceClose && (
        <div className="pt-2 border-t border-dashed border-red-200">
          <Button
            size="sm"
            variant="outline"
            className="border-red-900 text-red-900 hover:bg-red-50 w-full sm:w-auto"
            onClick={() => handleAction("force_close")}
            disabled={workflowMutation.isPending}
          >
            <span className="material-icons text-sm mr-1">lock</span>
            Force Close
          </Button>
          <p className="text-xs text-red-800 mt-1">Admin action — permanently closes this pass</p>
        </div>
      )}

      {/* Remarks dialog for Reject / Send Back / Security Send Back */}
      <Dialog open={!!dialogAction} onOpenChange={(open) => !open && setDialogAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "reject"
                ? "Reject Gate Pass"
                : dialogAction === "security_send_back"
                  ? "Security — Send Back Gate Pass"
                  : dialogAction === "force_close"
                    ? "Force Close Gate Pass"
                    : "Send Back Gate Pass"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {dialogAction === "force_close" && (
              <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">
                ⚠ This will permanently close this gate pass and cannot be undone. A notification will be sent to the creator.
              </p>
            )}
            <Label htmlFor="remarks" className="mb-1 block">
              {dialogAction === "reject"
                ? "Reason for rejection (optional)"
                : dialogAction === "force_close"
                  ? "Reason for force closing (required)"
                  : "Remarks (required — explain what needs to be corrected)"}
            </Label>
            <Textarea
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={
                dialogAction === "reject"
                  ? "e.g. Unauthorized items listed..."
                  : dialogAction === "security_send_back"
                    ? "e.g. Driver CNIC does not match, please correct..."
                    : dialogAction === "force_close"
                      ? "e.g. Delivery cancelled, vehicle returned without unloading..."
                      : "e.g. Incorrect delivery address, please update..."
              }
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAction(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleDialogConfirm}
              disabled={!remarks.trim() && dialogAction !== "reject"}
              className={
                dialogAction === "force_close"
                  ? "bg-red-900 hover:bg-red-800 text-white"
                  : dialogAction === "reject"
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-orange-500 hover:bg-orange-600 text-white"
              }
            >
              {dialogAction === "force_close" ? "Force Close" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
