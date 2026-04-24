import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Item } from "@shared/schema";
import { formatDate } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import { companyName as defaultCompanyName, companyLogo } from "@/config/company";

interface PrintableGatePassProps {
  gatePassId: number;
  copyType: "security" | "vendor" | "not_approved";
}

interface EnrichedGatePass {
  id: number;
  gatePassNumber: string;
  date: string;
  type: string;
  status: string;
  companyId?: number;
  companyInfo?: { name: string; logo?: string } | null;
  customerName: string;
  customerPhone?: string;
  deliveryAddress: string;
  driverName: string;
  driverMobile: string;
  driverCnic: string;
  deliveryVanNumber: string;
  department: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  hodApprovedAt?: string;
  hodApproverName?: string | null;
  securityAllowedAt?: string;
  securityApproverName?: string | null;
  expectedReturnDate?: string;
  actualReturnDate?: string;
  gateName?: string | null;
  allowTo?: string | null;
  items: Item[];
}

const TYPE_LABEL: Record<string, string> = {
  outward: "Outward",
  inward: "Inward",
  returnable: "Returnable",
};

const TYPE_COLOR: Record<string, string> = {
  outward: "#4f46e5",
  inward: "#0d9488",
  returnable: "#d97706",
};

export function PrintableGatePass({ gatePassId, copyType }: PrintableGatePassProps) {
  const { data, isLoading, error } = useQuery<EnrichedGatePass>({
    queryKey: [`/api/gate-passes/${gatePassId}`],
  });

  const getCopyTitle = () => {
    switch (copyType) {
      case "security": return "SECURITY COPY";
      case "vendor": return "VENDOR / CUSTOMER / EMPLOYEE COPY";
      case "not_approved": return "NOT APPROVED";
    }
  };

  if (isLoading) return <div className="p-8 text-center">Loading gate pass data...</div>;
  if (error || !data) return <div className="p-8 text-center text-red-600">Error loading gate pass data</div>;

  const qrValue = `${window.location.origin}/verify/${data.gatePassNumber}`;
  const logoSrc =
    data.companyInfo?.logo && (data.companyInfo.logo.startsWith("data:") || data.companyInfo.logo.startsWith("http"))
      ? data.companyInfo.logo
      : companyLogo.full;
  const displayCompanyName = data.companyInfo?.name || defaultCompanyName;
  const totalQty = data.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  const isSecurityCopy = copyType === "security";
  const isNotApproved = copyType === "not_approved";
  const showApprovalChain = copyType === "vendor";
  const showFullDriverDetails = true; // show driver details on all copies

  return (
    <div className="p-3 sm:p-8 max-w-4xl mx-auto print:p-0">
      <div className="border border-gray-400 rounded-lg overflow-hidden print:border-none">

        {/* ── Header ── */}
        <div className="bg-primary text-white p-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src={logoSrc} alt="Logo" className="h-10 bg-white p-1 rounded" />
            <div>
              <h1 className="font-bold text-lg leading-tight">{displayCompanyName}</h1>
              <p className="text-xs opacity-80">Gate Pass System</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold">GATE PASS</h2>
            <p className="text-xs font-semibold tracking-wider">{getCopyTitle()}</p>
          </div>
        </div>

        {isNotApproved && (
          <div className="bg-red-600 text-white text-center py-2 font-bold tracking-widest text-lg">
            ⚠ NOT APPROVED — FOR REFERENCE ONLY ⚠
          </div>
        )}

        <div className="p-4 space-y-4 text-sm">

          {/* ── Pass Meta Row ── */}
          <div className="flex flex-wrap gap-4 justify-between border-b pb-3">
            <div>
              <p className="text-gray-500 text-xs">Gate Pass No.</p>
              <p className="font-bold text-base">{data.gatePassNumber}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Date</p>
              <p className="font-medium">{formatDate(data.date)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Pass Type</p>
              <span
                className="inline-block px-2 py-0.5 rounded-full text-white text-xs font-semibold"
                style={{ backgroundColor: TYPE_COLOR[data.type] ?? "#6b7280" }}
              >
                {TYPE_LABEL[data.type] ?? data.type}
              </span>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Department</p>
              <p className="font-medium">{data.department}</p>
            </div>
            {data.gateName && (
              <div>
                <p className="text-gray-500 text-xs">Gate</p>
                <p className="font-medium">{data.gateName}</p>
              </div>
            )}
            {(data as any).allowTo && (
              <div>
                <p className="text-gray-500 text-xs">Allow To</p>
                <p className="font-medium">{(data as any).allowTo}</p>
              </div>
            )}
            {data.type === "returnable" && data.expectedReturnDate && (
              <div>
                <p className="text-gray-500 text-xs">Expected Return</p>
                <p className="font-medium">{formatDate(data.expectedReturnDate)}</p>
              </div>
            )}
            {data.type === "returnable" && data.actualReturnDate && (
              <div>
                <p className="text-gray-500 text-xs">Actual Return</p>
                <p className="font-medium text-green-700">{formatDate(data.actualReturnDate)}</p>
              </div>
            )}
          </div>

          {/* ── Guard Copy: big QR early, then driver + items ── */}
          {isSecurityCopy && (
            <div className="flex gap-4 items-start border-b pb-4">
              <div className="flex-shrink-0 bg-white shadow rounded-md p-2 flex flex-col items-center">
                <QRCodeSVG value={qrValue} size={130} level="M" bgColor="#FFFFFF" fgColor="#000000" includeMargin={false} />
                <p className="text-xs font-medium text-primary mt-1">Scan to Verify</p>
                <p className="text-xs text-gray-500">{data.gatePassNumber}</p>
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <p className="text-gray-500 text-xs">Driver Name</p>
                  <p className="font-medium">{data.driverName}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Van / Vehicle No.</p>
                  <p className="font-medium">{data.deliveryVanNumber}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">CNIC</p>
                  <p className="font-medium">{data.driverCnic}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Delivery Address</p>
                  <p className="font-medium">{data.deliveryAddress}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Customer + Delivery (non-guard) ── */}
          {!isSecurityCopy && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500 text-xs mb-1">{data.type === "inward" ? "Vendor / Supplier" : "Customer / Person"}</p>
                <p className="font-medium">{data.customerName}</p>
                {data.customerPhone && <p className="text-gray-600 text-xs mt-0.5">{data.customerPhone}</p>}
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">Delivery Address</p>
                <p className="font-medium">{data.deliveryAddress}</p>
              </div>
            </div>
          )}

          {/* ── Items Table ── */}
          <div>
            <p className="text-gray-500 text-xs mb-1">Item Details</p>
            <table className="w-full border border-gray-300 text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-1 text-left">#</th>
                  <th className="border border-gray-300 p-1 text-left">Type</th>
                  <th className="border border-gray-300 p-1 text-left">Item Name</th>
                  {!isSecurityCopy && <th className="border border-gray-300 p-1 text-left">Item Code</th>}
                  <th className="border border-gray-300 p-1 text-left">Qty</th>
                  <th className="border border-gray-300 p-1 text-left">Unit</th>
                  <th className="border border-gray-300 p-1 text-left">Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.items && data.items.length > 0 ? (
                  data.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="border border-gray-300 p-1">{idx + 1}</td>
                      <td className="border border-gray-300 p-1 capitalize">{(item as any).itemType || "material"}</td>
                      <td className="border border-gray-300 p-1">{item.name}</td>
                      {!isSecurityCopy && <td className="border border-gray-300 p-1">{item.sku || "—"}</td>}
                      <td className="border border-gray-300 p-1">{item.quantity}</td>
                      <td className="border border-gray-300 p-1">{item.unit || "—"}</td>
                      <td className="border border-gray-300 p-1 text-gray-600">{(item as any).reason || "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isSecurityCopy ? 6 : 7} className="border border-gray-300 p-1 text-center text-gray-500">
                      No items
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-medium">
                  <td colSpan={isSecurityCopy ? 4 : 5} className="border border-gray-300 p-1 text-right">
                    Total Quantity:
                  </td>
                  <td className="border border-gray-300 p-1">{totalQty}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── Driver + Created By (non-guard) ── */}
          {showFullDriverDetails && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500 text-xs mb-1">Driver Details</p>
                <div className="space-y-0.5">
                  {[
                    ["Name", data.driverName],
                    ["Mobile", data.driverMobile],
                    ["CNIC", data.driverCnic],
                    ["Van / Vehicle No.", data.deliveryVanNumber],
                  ].map(([label, value]) => (
                    <div key={label} className="flex">
                      <p className="w-2/5 text-gray-500">{label}:</p>
                      <p className="w-3/5 font-medium">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">Prepared By</p>
                <div className="space-y-0.5">
                  {[
                    ["Name", data.createdBy],
                    ["Department", data.department],
                    ["Date & Time", formatDate(data.createdAt)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex">
                      <p className="w-2/5 text-gray-500">{label}:</p>
                      <p className="w-3/5 font-medium">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Approval Chain (Record Copy only) ── */}
          {showApprovalChain && (data.hodApproverName || data.securityApproverName) && (
            <div className="border rounded-md p-3 bg-gray-50 space-y-2">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Approval Trail</p>
              <div className="grid grid-cols-2 gap-4">
                {data.hodApproverName && (
                  <div>
                    <p className="text-gray-500 text-xs">HOD Approved By</p>
                    <p className="font-medium">{data.hodApproverName}</p>
                    {data.hodApprovedAt && (
                      <p className="text-xs text-gray-500">{formatDate(data.hodApprovedAt)}</p>
                    )}
                  </div>
                )}
                {data.securityApproverName && (
                  <div>
                    <p className="text-gray-500 text-xs">Security Allowed By</p>
                    <p className="font-medium">{data.securityApproverName}</p>
                    {data.securityAllowedAt && (
                      <p className="text-xs text-gray-500">{formatDate(data.securityAllowedAt)}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Notes (reason is now per-item; retain legacy gate-pass-level reason for old records) ── */}
          {((data as any).reason || data.notes) && (
            <div className="grid grid-cols-2 gap-3">
              {(data as any).reason && (
                <div>
                  <p className="text-gray-500 text-xs mb-0.5">General Reason</p>
                  <p className="border rounded p-2 bg-gray-50 text-sm">{(data as any).reason}</p>
                </div>
              )}
              {data.notes && (
                <div>
                  <p className="text-gray-500 text-xs mb-0.5">Additional Notes</p>
                  <p className="border rounded p-2 bg-gray-50 text-sm">{data.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Signatures ── */}
          <div className="mt-4 pt-3 border-t border-gray-300">
            <div className={`grid gap-4 text-center text-sm ${isSecurityCopy ? "grid-cols-2" : "grid-cols-3"}`}>
              <div>
                <div className="h-14 border-b border-gray-600"></div>
                <p className="mt-1 font-medium">Prepared By</p>
                <p className="text-xs text-gray-500">{data.createdBy}</p>
              </div>
              {!isSecurityCopy && (
                <div>
                  <div className="h-14 border-b border-gray-600"></div>
                  <p className="mt-1 font-medium">HOD Approver</p>
                  <p className="text-xs text-gray-500">{data.hodApproverName ?? "Pending"}</p>
                </div>
              )}
              <div>
                <div className="h-14 border-b border-gray-600"></div>
                <p className="mt-1 font-medium">Security Officer</p>
                <p className="text-xs text-gray-500">{data.securityApproverName ?? "Pending"}</p>
              </div>
            </div>
          </div>

          {/* ── Footer + QR (non-guard, QR already shown for guard above) ── */}
          {!isSecurityCopy && (
            <div className="mt-2 border-t border-gray-300 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs text-gray-500">{displayCompanyName} — Gate Pass System</p>
                  <p className="text-xs text-gray-400">This is a computer generated document.</p>
                  <p className="text-[10px] text-gray-300 mt-2">Developed by Creative Solution Zone</p>
                </div>
                <div className="flex-shrink-0">
                  <div className="bg-white shadow-sm rounded-md p-2 inline-flex flex-col items-center">
                    <QRCodeSVG value={qrValue} size={90} level="M" bgColor="#FFFFFF" fgColor="#000000" includeMargin={false} />
                    <p className="text-xs font-medium text-primary mt-1">Scan to Verify</p>
                    <p className="text-xs text-gray-500">{data.gatePassNumber}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Guard copy footer */}
          {isSecurityCopy && (
            <div className="mt-2 pt-2 border-t border-gray-200 text-center">
              <p className="text-[10px] text-gray-300">Developed by Creative Solution Zone</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
