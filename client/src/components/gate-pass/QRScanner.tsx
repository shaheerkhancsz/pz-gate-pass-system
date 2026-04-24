import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { GatePass } from "@shared/schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/utils";
import { getStatusLabel, getStatusBadgeClass } from "@/components/ui/theme";
import { companyName, companyFullName, companyLogo } from "@/config/company";
import {
  AlertCircle, CheckCircle2, XCircle, Camera, RefreshCw,
  User, Truck, Package, ShieldCheck, FileText, Printer,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface VerificationResult extends GatePass {
  items: any[];
  isValid: boolean;
  verifiedAt: string;
}

interface QRScannerProps {
  onSuccess?: (gatePass: VerificationResult) => void;
  defaultGatePassNumber?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PASS_TYPE_LABELS: Record<string, string> = {
  outward:    "Outward",
  inward:     "Inward",
  returnable: "Returnable",
};

// ── Helper sub-components (screen) ────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm py-0.5">
      <span className="text-muted-foreground min-w-[110px] shrink-0">{label}</span>
      <span className="font-medium break-words">{value}</span>
    </div>
  );
}

function SectionCard({
  icon: Icon, title, children,
}: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm text-primary">{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── Print-only template ───────────────────────────────────────────────────────

function PrintSlip({ result }: { result: VerificationResult }) {
  const hasUnit = result.items?.some(i => i.unit);
  const verifiedAt = new Date(result.verifiedAt).toLocaleString("en-PK", {
    dateStyle: "long", timeStyle: "short",
  });

  return (
    <div
      id="qr-print-slip"
      style={{
        display: "none",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "11pt",
        color: "#111",
        maxWidth: "190mm",
        margin: "0 auto",
        padding: "0",
      }}
    >
      {/* ── Header ── */}
      <div style={{
        background: "#003087",
        color: "#fff",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src={companyLogo.full}
            alt="Logo"
            style={{ height: "36px", background: "#fff", padding: "3px 6px", borderRadius: "3px" }}
          />
          <div>
            <div style={{ fontWeight: "bold", fontSize: "13pt" }}>{companyFullName}</div>
            <div style={{ fontSize: "8pt", opacity: 0.8 }}>Gate Pass Management System</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: "bold", fontSize: "14pt", letterSpacing: "1px" }}>
            VERIFICATION SLIP
          </div>
          <div style={{ fontSize: "8pt", opacity: 0.8 }}>Security Gate Record</div>
        </div>
      </div>

      {/* ── Status banner ── */}
      <div style={{
        background: result.isValid ? "#dcfce7" : "#fee2e2",
        border: `2px solid ${result.isValid ? "#16a34a" : "#dc2626"}`,
        borderTop: "none",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{
            fontSize: "22pt",
            color: result.isValid ? "#16a34a" : "#dc2626",
            lineHeight: 1,
          }}>
            {result.isValid ? "✓" : "✗"}
          </span>
          <div>
            <div style={{
              fontWeight: "bold",
              fontSize: "13pt",
              color: result.isValid ? "#14532d" : "#7f1d1d",
            }}>
              {result.isValid ? "AUTHORISED TO PROCEED" : "NOT AUTHORISED"}
            </div>
            <div style={{ fontSize: "9pt", color: result.isValid ? "#166534" : "#991b1b" }}>
              {result.isValid
                ? "This gate pass has been verified and is currently valid"
                : "This gate pass is not valid for entry/exit at this time"}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "8pt", color: "#6b7280" }}>Gate Pass No.</div>
          <div style={{ fontWeight: "bold", fontSize: "13pt", fontFamily: "monospace" }}>
            {result.gatePassNumber}
          </div>
        </div>
      </div>

      {/* ── Meta row ── */}
      <div style={{
        background: "#f8fafc",
        borderBottom: "1px solid #e2e8f0",
        padding: "6px 16px",
        display: "flex",
        gap: "32px",
        fontSize: "9pt",
      }}>
        {result.passType && (
          <div>
            <span style={{ color: "#6b7280" }}>Type: </span>
            <span style={{ fontWeight: "bold" }}>
              {PASS_TYPE_LABELS[result.passType] ?? result.passType}
            </span>
          </div>
        )}
        <div>
          <span style={{ color: "#6b7280" }}>Date: </span>
          <span style={{ fontWeight: "bold" }}>{formatDate(result.date)}</span>
        </div>
        <div>
          <span style={{ color: "#6b7280" }}>Status: </span>
          <span style={{ fontWeight: "bold" }}>{getStatusLabel(result.status)}</span>
        </div>
        {result.department && (
          <div>
            <span style={{ color: "#6b7280" }}>Department: </span>
            <span style={{ fontWeight: "bold" }}>{result.department}</span>
          </div>
        )}
      </div>

      {/* ── Two-column info ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0", border: "1px solid #e2e8f0", borderTop: "none" }}>
        {/* Customer */}
        <div style={{ padding: "10px 14px", borderRight: "1px solid #e2e8f0" }}>
          <div style={{
            fontWeight: "bold",
            fontSize: "9pt",
            color: "#003087",
            borderBottom: "1px solid #e2e8f0",
            paddingBottom: "4px",
            marginBottom: "6px",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}>
            Customer / Supplier
          </div>
          <PrintInfoRow label="Name"    value={result.customerName} />
          <PrintInfoRow label="Phone"   value={result.customerPhone} />
          <PrintInfoRow label="Address" value={result.deliveryAddress} />
        </div>

        {/* Driver */}
        <div style={{ padding: "10px 14px" }}>
          <div style={{
            fontWeight: "bold",
            fontSize: "9pt",
            color: "#003087",
            borderBottom: "1px solid #e2e8f0",
            paddingBottom: "4px",
            marginBottom: "6px",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}>
            Driver &amp; Vehicle
          </div>
          <PrintInfoRow label="Driver"  value={result.driverName} />
          <PrintInfoRow label="Contact" value={result.driverMobile} />
          <PrintInfoRow label="CNIC"    value={result.driverCnic} />
          <PrintInfoRow label="Vehicle" value={result.deliveryVanNumber} />
        </div>
      </div>

      {/* ── Items table ── */}
      {result.items && result.items.length > 0 && (
        <div style={{ border: "1px solid #e2e8f0", borderTop: "none" }}>
          <div style={{
            background: "#f8fafc",
            fontWeight: "bold",
            fontSize: "9pt",
            color: "#003087",
            padding: "6px 14px",
            borderBottom: "1px solid #e2e8f0",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}>
            Item Details
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th style={thStyle}>Item Name</th>
                <th style={thStyle}>SKU / Code</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Qty</th>
                {hasUnit && <th style={{ ...thStyle, textAlign: "center" }}>Unit</th>}
              </tr>
            </thead>
            <tbody>
              {result.items.map((item, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                  <td style={tdStyle}>{item.name}</td>
                  <td style={tdStyle}>{item.sku || "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{item.quantity}</td>
                  {hasUnit && <td style={{ ...tdStyle, textAlign: "center" }}>{item.unit || "—"}</td>}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#f1f5f9", fontWeight: "bold" }}>
                <td colSpan={hasUnit ? 2 : 1} style={{ ...tdStyle, textAlign: "right" }}>
                  Total:
                </td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  {result.items.reduce((s, i) => s + (i.quantity || 0), 0)}
                </td>
                {hasUnit && <td style={tdStyle} />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Verified by / timestamp ── */}
      <div style={{
        padding: "8px 14px",
        border: "1px solid #e2e8f0",
        borderTop: "none",
        background: "#f8fafc",
        fontSize: "9pt",
        color: "#374151",
      }}>
        <span style={{ color: "#6b7280" }}>Verified at: </span>
        <span style={{ fontWeight: "bold" }}>{verifiedAt}</span>
        {result.createdBy && (
          <>
            <span style={{ marginLeft: "24px", color: "#6b7280" }}>Created by: </span>
            <span style={{ fontWeight: "bold" }}>{result.createdBy}</span>
          </>
        )}
      </div>

      {/* ── Signature boxes ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "16px",
        padding: "16px 14px 12px",
        border: "1px solid #e2e8f0",
        borderTop: "none",
      }}>
        {[
          { label: "Security Guard", sub: "Gate Verification" },
          { label: "Driver Signature", sub: result.driverName || "" },
          { label: "Authorising Officer", sub: "Stamp / Seal" },
        ].map(({ label, sub }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ height: "48px", borderBottom: "1.5px solid #374151", marginBottom: "4px" }} />
            <div style={{ fontWeight: "bold", fontSize: "8.5pt" }}>{label}</div>
            {sub && <div style={{ fontSize: "7.5pt", color: "#6b7280" }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <div style={{
        background: "#003087",
        color: "rgba(255,255,255,0.8)",
        padding: "6px 14px",
        fontSize: "7.5pt",
        display: "flex",
        justifyContent: "space-between",
      }}>
        <span>{companyName} — Gate Pass Management System</span>
        <span>Computer generated document — {new Date().toLocaleDateString("en-PK")}</span>
      </div>
    </div>
  );
}

function PrintInfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", fontSize: "9pt", marginBottom: "3px" }}>
      <span style={{ color: "#6b7280", minWidth: "60px" }}>{label}:</span>
      <span style={{ fontWeight: "500" }}>{value}</span>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "5px 10px",
  textAlign: "left",
  fontWeight: "bold",
  border: "1px solid #e2e8f0",
  color: "#374151",
};

const tdStyle: React.CSSProperties = {
  padding: "5px 10px",
  border: "1px solid #e2e8f0",
  verticalAlign: "top",
};

// ── Print helper ──────────────────────────────────────────────────────────────

function triggerPrint() {
  const el = document.getElementById("qr-print-slip");
  if (!el) return;

  const printWindow = window.open("", "_blank", "width=800,height=700");
  if (!printWindow) {
    // Fallback: show element and use window.print()
    el.style.display = "block";
    window.print();
    el.style.display = "none";
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Gate Pass Verification Slip</title>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #fff; }
          @media print {
            @page { margin: 10mm; size: A4; }
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>${el.outerHTML.replace('style="display: none;', 'style="display: block;')}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };
}

// ── Main component ────────────────────────────────────────────────────────────

export function QRScanner({ onSuccess, defaultGatePassNumber }: QRScannerProps) {
  const [scanning, setScanning]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<VerificationResult | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef   = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-verify from URL param
  useEffect(() => {
    if (defaultGatePassNumber) verifyGatePass(defaultGatePassNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultGatePassNumber]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, []);

  const extractGatePassNumber = (text: string): string => {
    if (text.includes("/verify/")) {
      const parts = text.split("/verify/");
      if (parts.length > 1) return parts[1].trim();
    }
    return text.trim();
  };

  const verifyGatePass = async (gatePassNumber: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/gate-passes/verify/${gatePassNumber}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Verification failed (${res.status})`);
      }
      const data: VerificationResult = await res.json();
      setResult(data);
      if (onSuccess) onSuccess(data);
      toast({
        title: data.isValid ? "Gate Pass Valid" : "Gate Pass Invalid",
        description: `${gatePassNumber} — ${data.isValid ? "Authorised to proceed" : "Not authorised"}`,
        variant: data.isValid ? "default" : "destructive",
      });
    } catch (err: any) {
      setError(err.message || "Failed to verify gate pass");
      toast({ title: "Verification Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const startScanner = async () => {
    if (!containerRef.current) return;
    setCameraError(null);
    setError(null);
    setResult(null);
    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      setScanning(true);
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) throw new Error("No camera found on this device");
      const cameraId = devices.find(d => d.label.toLowerCase().includes("back")) ?? devices[0];
      await scanner.start(
        { facingMode: "environment", deviceId: cameraId?.id },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0, disableFlip: false },
        async (decodedText) => {
          try { await stopScanner(); } catch {}
          await verifyGatePass(extractGatePassNumber(decodedText));
        },
        () => {}
      ).catch((err: any) => {
        setCameraError(`Camera error: ${err.message || "Unknown"}`);
        setScanning(false);
        toast({ title: "Camera Access Error", description: "Please allow camera permissions.", variant: "destructive" });
      });
    } catch (err: any) {
      setCameraError(err.message || "Failed to initialise scanner");
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
    }
    setScanning(false);
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setCameraError(null);
    startScanner();
  };

  const verifyWithInput = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const frm = e.target as HTMLFormElement;
    const input = frm.elements.namedItem("gatePassNumber") as HTMLInputElement;
    const value = input.value.trim();
    if (!value) {
      toast({ title: "Please enter a gate pass number", variant: "destructive" });
      return;
    }
    await verifyGatePass(value);
    input.value = "";
  };

  return (
    <>
      {/* ── Screen UI (hidden during print) ── */}
      <div className="w-full max-w-lg mx-auto print:hidden">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Gate Pass Verification
            </CardTitle>
            <CardDescription>
              Scan a QR code or enter a gate pass number to verify
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Manual input */}
            <form onSubmit={verifyWithInput} className="flex gap-2">
              <input
                type="text"
                name="gatePassNumber"
                placeholder="Enter gate pass number (e.g. OWNR-AG01-IS-2026-0001)"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Verify"}
              </Button>
            </form>

            {/* OR divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or scan QR code</span>
              </div>
            </div>

            {/* Idle state */}
            {!scanning && !result && !loading && !error && !cameraError && (
              <div className="flex flex-col items-center gap-2 py-8 rounded-lg border border-dashed bg-muted/20 text-muted-foreground">
                <Camera className="h-10 w-10 opacity-40" />
                <p className="text-sm">Press <strong>Start Scanner</strong> to activate camera</p>
              </div>
            )}

            {/* Camera feed */}
            {scanning && (
              <div ref={containerRef} className="relative w-full h-[300px] rounded-lg border overflow-hidden bg-black">
                <div id="qr-reader" className="absolute inset-0 w-full h-full" />
                <style>{`
                  #qr-reader { border: none !important; width: 100% !important; height: 100% !important; }
                  #qr-reader video { width: 100% !important; height: 100% !important; object-fit: cover !important; }
                  #qr-reader__scan_region { position: absolute !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; }
                  #qr-reader__dashboard { padding: 0 !important; }
                  #qr-reader__dashboard_section_csr { display: none !important; }
                `}</style>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/70 bg-black/40 px-2 py-1 rounded">
                  Position QR code inside the frame
                </div>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Verifying gate pass...</p>
              </div>
            )}

            {/* Camera error */}
            {cameraError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Camera Error</AlertTitle>
                <AlertDescription>
                  <p>{cameraError}</p>
                  <ul className="mt-1 text-xs list-disc pl-4 space-y-0.5">
                    <li>Allow camera access in browser settings</li>
                    <li>Ensure no other app is using the camera</li>
                    <li>Try refreshing the page</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Verification error */}
            {error && !result && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Verification Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Result on screen */}
            {result && (
              <div className="space-y-3 pt-1">
                <Separator />

                {/* Gate pass number + badges */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Gate Pass</p>
                    <p className="font-bold text-base font-mono">{result.gatePassNumber}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {result.passType && (
                      <Badge variant="outline" className="text-xs">
                        {PASS_TYPE_LABELS[result.passType] ?? result.passType}
                      </Badge>
                    )}
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(result.status)}`}>
                      {getStatusLabel(result.status)}
                    </span>
                  </div>
                </div>

                {/* Valid / Invalid banner */}
                {result.isValid ? (
                  <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                    <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
                    <div>
                      <p className="font-semibold text-green-800 text-sm">Authorised to Proceed</p>
                      <p className="text-xs text-green-700">This gate pass is verified and currently valid</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <XCircle className="h-6 w-6 text-red-600 shrink-0" />
                    <div>
                      <p className="font-semibold text-red-800 text-sm">Not Authorised</p>
                      <p className="text-xs text-red-700">This gate pass is not valid for entry/exit</p>
                    </div>
                  </div>
                )}

                {/* Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SectionCard icon={User} title="Customer / Supplier">
                    <InfoRow label="Name"    value={result.customerName} />
                    <InfoRow label="Phone"   value={result.customerPhone} />
                    <InfoRow label="Address" value={result.deliveryAddress} />
                  </SectionCard>
                  <SectionCard icon={Truck} title="Driver & Vehicle">
                    <InfoRow label="Driver"  value={result.driverName} />
                    <InfoRow label="Contact" value={result.driverMobile} />
                    <InfoRow label="Vehicle" value={result.deliveryVanNumber} />
                  </SectionCard>
                </div>

                <SectionCard icon={FileText} title="Gate Pass Details">
                  <div className="grid grid-cols-2 gap-x-4">
                    <InfoRow label="Date"        value={formatDate(result.date)} />
                    <InfoRow label="Department"  value={result.department} />
                    <InfoRow label="Created By"  value={result.createdBy} />
                    <InfoRow label="Verified At" value={new Date(result.verifiedAt).toLocaleString()} />
                  </div>
                </SectionCard>

                {result.items && result.items.length > 0 && (
                  <SectionCard icon={Package} title={`Items (${result.items.length})`}>
                    <div className="overflow-x-auto -mx-1 mt-1">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b text-xs text-muted-foreground uppercase">
                            <th className="pb-1 pr-3 text-left font-medium">Name</th>
                            <th className="pb-1 pr-3 text-left font-medium">SKU</th>
                            <th className="pb-1 pr-3 text-left font-medium">Qty</th>
                            {result.items[0]?.unit && <th className="pb-1 text-left font-medium">Unit</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {result.items.map((item, i) => (
                            <tr key={i}>
                              <td className="py-1 pr-3 font-medium">{item.name}</td>
                              <td className="py-1 pr-3 text-muted-foreground">{item.sku || "—"}</td>
                              <td className="py-1 pr-3">{item.quantity}</td>
                              {result.items[0]?.unit && <td className="py-1">{item.unit || "—"}</td>}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t">
                            <td colSpan={2} className="pt-1 text-xs text-muted-foreground text-right pr-3">Total:</td>
                            <td className="pt-1 font-semibold">
                              {result.items.reduce((s, i) => s + (i.quantity || 0), 0)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </SectionCard>
                )}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between pt-4">
            {scanning ? (
              <Button variant="outline" onClick={stopScanner}>Stop Scanner</Button>
            ) : (
              <Button
                variant={result ? "outline" : "default"}
                onClick={result || error ? reset : startScanner}
              >
                {result || error ? "Scan Another" : "Start Scanner"}
              </Button>
            )}
            {result && (
              <Button variant="secondary" onClick={triggerPrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print Slip
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      {/* ── Hidden print template (written into new window by triggerPrint) ── */}
      {result && <PrintSlip result={result} />}
    </>
  );
}
