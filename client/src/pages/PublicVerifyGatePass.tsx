import { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import { companyName, companyLogo } from '@/config/company';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function PublicVerifyGatePass() {
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
    } catch (error: any) {
      console.error("Verification error:", error);
      setVerificationError(error.message || "Failed to verify gate pass");
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            {companyLogo ? (
              <img src={companyLogo} alt={companyName} className="h-10 mr-2" />
            ) : (
              <span className="text-xl font-bold text-primary">{companyName}</span>
            )}
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Gate Pass Verification</h1>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-grow">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Loading state */}
          {verificationLoading && (
            <div className="text-center py-20">
              <div className="inline-block animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
              <p className="text-gray-500">Verifying gate pass...</p>
            </div>
          )}

          {/* Error state */}
          {verificationError && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Verification Failed</AlertTitle>
              <AlertDescription>
                {verificationError}
              </AlertDescription>
            </Alert>
          )}

          {/* Results display */}
          {verificationResult && (
            <Card>
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
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-medium text-green-800">Valid Gate Pass</p>
                      <p className="text-sm text-green-700">This gate pass has been verified as authentic and is currently valid</p>
                    </div>
                  </div>
                )}

                {/* Print button at the bottom */}
                <div className="mt-6 text-right">
                  <Button variant="outline" onClick={() => window.print()}>
                    Print Verification
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Initial state when no verification was done yet */}
          {!verificationLoading && !verificationResult && !verificationError && (
            <div className="text-center py-20">
              <div className="mb-4 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-medium text-gray-900 mb-2">No Gate Pass Found</h2>
              <p className="text-gray-600">Scan a QR code or enter a gate pass number to verify its authenticity</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} {companyName}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}