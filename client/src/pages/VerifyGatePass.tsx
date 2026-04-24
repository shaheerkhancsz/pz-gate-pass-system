import { useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { companyName } from '@/config/company';
import { QRScanner } from '@/components/gate-pass/QRScanner';
import { useParams } from 'wouter';
import { toast } from '@/hooks/use-toast';
import { ShieldCheck } from 'lucide-react';

export default function VerifyGatePass() {
  const params = useParams();

  // Auto-verify when gate pass number is passed in URL (e.g. from mobile QR scan)
  useEffect(() => {
    if (params?.gatePassNumber) {
      // The QRScanner handles its own verification; auto-populate not needed here
      // since the user can type the number in the manual input field
    }
  }, [params]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">QR Scanner</h1>
            <p className="text-sm text-muted-foreground">
              Scan gate pass QR codes or enter a number to verify driver and vehicle details
            </p>
          </div>
        </div>

        {/* Scanner */}
        <QRScanner
          onSuccess={() => {/* result is shown inside QRScanner */}}
          defaultGatePassNumber={params?.gatePassNumber}
        />

        {/* Print-only footer */}
        <div className="hidden print:block border-t pt-4 text-center text-sm">
          <p className="font-bold">{companyName} — Gate Pass Verification</p>
          <p>Verified on: {new Date().toLocaleString()}</p>
        </div>
      </div>
    </AppLayout>
  );
}
