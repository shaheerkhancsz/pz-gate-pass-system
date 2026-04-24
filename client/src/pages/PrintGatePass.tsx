import React from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PrintableGatePass } from "@/components/gate-pass/PrintableGatePass";
import { Button } from "@/components/ui/button";

interface GatePassStatus {
  id: number;
  status: string;
  gatePassNumber: string;
}

export default function PrintGatePass() {
  const { id } = useParams();
  const gatePassId = parseInt(id || "0", 10);

  const { data, isLoading } = useQuery<GatePassStatus>({
    queryKey: [`/api/gate-passes/${gatePassId}`],
  });

  const handlePrint = () => {
    window.print();
  };

  // Gate pass is "approved" if status is approved, security_allowed, or completed
  const isApproved = data && ["approved", "security_allowed", "completed", "force_closed"].includes(data.status);

  return (
    <div className="print-container">
      {/* Print Controls — hidden when printing */}
      <div className="p-6 no-print">
        <div className="mb-4 flex justify-between items-center">
          <Link href="/gate-passes">
            <Button variant="outline">
              <span className="material-icons mr-1">arrow_back</span>
              Back to Gate Passes
            </Button>
          </Link>
          <Button onClick={handlePrint} className="bg-primary">
            <span className="material-icons mr-1">print</span>
            Print {isApproved ? "(2 Copies)" : "(Not Approved)"}
          </Button>
        </div>
        {!isLoading && !isApproved && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-md text-sm text-orange-700">
            This gate pass has not been approved yet. Printing will show a "NOT APPROVED" label.
          </div>
        )}
        {!isLoading && isApproved && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
            Approved gate pass — printing 2 copies: Security Copy + Vendor/Customer/Employee Copy.
          </div>
        )}
      </div>

      {/* Printable Content (also visible on screen as a preview) */}
      {!isLoading && (
        isApproved ? (
          <>
            {/* Copy 1: Security Copy */}
            <PrintableGatePass gatePassId={gatePassId} copyType="security" />

            {/* Screen separator between copies (hidden when printing — real page break handles it) */}
            <div className="no-print mx-auto max-w-4xl px-3 sm:px-8 my-4 flex items-center gap-3">
              <div className="flex-1 border-t border-dashed border-gray-300" />
              <span className="text-xs text-gray-400 uppercase tracking-widest">Page 2 — Vendor / Customer / Employee Copy</span>
              <div className="flex-1 border-t border-dashed border-gray-300" />
            </div>

            {/* Page break for print */}
            <div className="page-break" />

            {/* Copy 2: Vendor/Customer/Employee Copy */}
            <PrintableGatePass gatePassId={gatePassId} copyType="vendor" />
          </>
        ) : (
          <PrintableGatePass gatePassId={gatePassId} copyType="not_approved" />
        )
      )}
    </div>
  );
}
