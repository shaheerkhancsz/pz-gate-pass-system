import { useState, useEffect } from 'react';
import { Separator } from '@/components/ui/separator';
import { AppLayout } from '@/components/layout/AppLayout';
import { companyName } from '@/config/company';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import { QRScanner } from '@/components/gate-pass/QRScanner';
import { useParams } from 'wouter';
import { toast } from '@/hooks/use-toast';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function VerifyGatePass() {
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verificationLoading, setVerificationLoading] = useState<boolean>(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const params = useParams();
  
  // Function to verify a gate pass number 
  const verifyGatePass = async (gatePassNumber: string) => {
    setVerificationLoading(true);
    setVerificationError(null);
    
    try {
      console.log(`Verifying gate pass from URL params: ${gatePassNumber}`);
      
      const response = await fetch(`/api/gate-passes/verify/${gatePassNumber}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Verification failed (${response.status})`);
      }
      
      const data = await response.json();
      console.log("Verification result:", data);
      
      setVerificationResult(data);
      
      toast({
        title: "Gate Pass Verified",
        description: `Gate Pass ${gatePassNumber} is valid.`,
        variant: "default",
      });
    } catch (error: any) {
      console.error("Verification error:", error);
      setVerificationError(error.message || "Failed to verify gate pass");
      
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to verify the gate pass",
        variant: "destructive",
      });
    } finally {
      setVerificationLoading(false);
    }
  };
  
  // Check for direct verification from URL (e.g., from mobile scan)
  useEffect(() => {
    // If we have a gatePassNumber in the URL, auto-verify it
    if (params && params.gatePassNumber) {
      console.log("Auto-verifying from URL parameter:", params.gatePassNumber);
      verifyGatePass(params.gatePassNumber);
    }
  }, [params]);

  return (
    <AppLayout>
      <div className="flex flex-col space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Verify Gate Pass</h1>
          <p className="text-muted-foreground">
            Scan QR codes to verify gate passes and check driver/vehicle information.
          </p>
        </div>
        
        <Separator />

        <div className="py-4">
          <QRScanner onSuccess={setVerificationResult} />
        </div>
        
        {verificationResult && (
          <Card className="mt-6">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl">Gate Pass: {verificationResult.gatePassNumber}</CardTitle>
                <Badge variant={verificationResult.isValid ? "default" : "destructive"} className={verificationResult.isValid ? "bg-green-600 hover:bg-green-700" : ""}>
                  {verificationResult.isValid ? "Valid" : "Invalid"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {/* Gate pass details matching the exact layout from screenshot */}
              <div className="space-y-4 text-sm mt-3">
                {/* Customer Information section */}
                <div className="bg-slate-50 p-3 rounded-md">
                  <h4 className="font-medium text-red-500 mb-2">Customer Information</h4>
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-gray-600">Name:</span>
                    <span>{verificationResult.customerName}</span>
                  </div>
                  {verificationResult.customerPhone && (
                    <div className="grid grid-cols-2 gap-1">
                      <span className="text-gray-600">Phone:</span>
                      <span>{verificationResult.customerPhone}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-gray-600">Delivery Address:</span>
                    <span>{verificationResult.deliveryAddress}</span>
                  </div>
                </div>
                
                {/* Two columns layout for Gate Pass Details and Driver Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-md">
                    <h4 className="font-medium text-red-500 mb-2">Gate Pass Details</h4>
                    <div className="grid grid-cols-2 gap-1">
                      <span className="text-gray-600">Date:</span>
                      <span>{formatDate(verificationResult.date)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <span className="text-gray-600">Status:</span>
                      <span>{verificationResult.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <span className="text-gray-600">Department:</span>
                      <span>{verificationResult.department}</span>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-3 rounded-md">
                    <h4 className="font-medium text-red-500 mb-2">Driver Details</h4>
                    <div className="grid grid-cols-2 gap-1">
                      <span className="text-gray-600">Name:</span>
                      <span>{verificationResult.driverName}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <span className="text-gray-600">Contact:</span>
                      <span>{verificationResult.driverMobile}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <span className="text-gray-600">Vehicle:</span>
                      <span>{verificationResult.deliveryVanNumber}</span>
                    </div>
                  </div>
                </div>

                {/* Verification Details */}
                <div className="bg-slate-50 p-3 rounded-md">
                  <h4 className="font-medium text-red-500 mb-2">Verification Details</h4>
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-gray-600">Verified At:</span>
                    <span>{new Date(verificationResult.verifiedAt).toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-gray-600">Created By:</span>
                    <span>{verificationResult.createdBy}</span>
                  </div>
                </div>
              </div>
              
              {/* Items table */}
              {verificationResult.items && verificationResult.items.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2 text-red-500">Item Details:</h4>
                  <div className="border rounded-md overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {verificationResult.items.map((item: any, index: number) => (
                          <tr key={index}>
                            <td className="px-3 py-2 text-sm text-gray-900">{item.name}</td>
                            <td className="px-3 py-2 text-sm text-gray-900">{item.sku}</td>
                            <td className="px-3 py-2 text-sm text-gray-900">{item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={2} className="px-3 py-2 text-right text-xs font-medium text-gray-500">Total Items:</td>
                          <td className="px-3 py-2 text-sm font-medium text-gray-900">
                            {verificationResult.items.reduce((sum: number, item: any) => sum + item.quantity, 0)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
              
              {/* Validation confirmation */}
              {verificationResult.isValid && (
                <div className="border border-green-200 bg-green-50 rounded-md p-3 mt-4 flex items-center">
                  <div className="flex items-center text-green-600 mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-green-800">Valid Gate Pass</p>
                    <p className="text-sm text-green-700">This gate pass has been verified as authentic and is currently valid</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* Print-only section */}
        <div className="hidden print:block p-4 border-t mt-4">
          <div className="text-center">
            <p className="font-bold">{companyName} - Gate Pass Verification</p>
            <p className="text-sm">Verified on: {new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}