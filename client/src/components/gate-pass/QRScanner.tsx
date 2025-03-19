import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { GatePass } from "@shared/schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Check, X, Camera, CheckCircle2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

// Define verification result type
interface VerificationResult extends GatePass {
  items: any[];
  isValid: boolean;
  verifiedAt: string;
}

interface QRScannerProps {
  onSuccess?: (gatePass: VerificationResult) => void;
}

export function QRScanner({ onSuccess }: QRScannerProps) {
  const [scanning, setScanning] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<{
    gatePass?: VerificationResult;
    loading: boolean;
    error?: string;
  }>({ loading: false });
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Clean up scanner when component unmounts
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop()
            .then(() => {
              console.log("Scanner stopped during cleanup");
              scannerRef.current = null;
            })
            .catch(err => {
              console.error("Error stopping scanner during cleanup:", err);
              scannerRef.current = null;
            });
        } catch (error) {
          console.error("Error in cleanup:", error);
          scannerRef.current = null;
        }
      }
    };
  }, []);

  // Function to extract gate pass number from URL or direct scan
  const extractGatePassNumber = (text: string): string => {
    console.log("Raw QR Code text:", text);
    
    // Check if the scanned text is a URL with /verify/ pattern
    if (text.includes('/verify/')) {
      const parts = text.split('/verify/');
      if (parts.length > 1) {
        const extractedNumber = parts[1].trim();
        console.log("Extracted gate pass number from URL:", extractedNumber);
        return extractedNumber;
      }
    }
    
    // If no URL pattern found, assume it's a direct gate pass number
    console.log("Using direct gate pass number:", text);
    return text.trim();
  };

  // Function to verify a gate pass number
  const verifyGatePass = async (gatePassNumber: string) => {
    try {
      setVerificationResult({ loading: true });
      console.log("Verifying gate pass:", gatePassNumber);
      
      const response = await fetch(`/api/gate-passes/verify/${gatePassNumber}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error:", response.status, errorText);
        throw new Error(errorText || `Verification failed (${response.status})`);
      }
      
      const data = await response.json();
      console.log("Verification result:", data);
      
      // Set the verification result
      setVerificationResult({ 
        gatePass: data, 
        loading: false 
      });

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess(data);
      }

      // Show a success toast 
      toast({
        title: "Gate Pass Verified Successfully",
        description: `Gate Pass: ${gatePassNumber} is valid`,
        variant: "default",
      });
      
      return data;
    } catch (error: any) {
      console.error("Verification error:", error);
      setVerificationResult({ 
        loading: false, 
        error: error.message || "Failed to verify gate pass" 
      });

      toast({
        title: "Verification Failed",
        description: error.message || "Failed to verify gate pass",
        variant: "destructive",
      });
      
      throw error;
    }
  };

  // Start QR scanner
  const startScanner = async () => {
    // Guard clause: Check if container reference is available
    if (!scannerContainerRef.current) {
      console.error("Scanner container reference not available");
      return;
    }
    setCameraError(null);
    
    // Clear any previous error states
    setVerificationResult({ loading: false });

    try {
      console.log("Initializing QR scanner...");
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      
      setScanning(true);
      setVerificationResult({ loading: false });
      
      toast({
        title: "Scanner Activated",
        description: "Please allow camera access if prompted",
      });

      // Get available cameras first to handle permissions better
      const devices = await Html5Qrcode.getCameras();
      console.log("Available cameras:", devices);
      
      if (devices && devices.length === 0) {
        throw new Error("No camera found on this device");
      }

      // Use the first camera or prefer back camera if on mobile
      const cameraId = devices.length > 1 ? 
        devices.find(device => device.label.toLowerCase().includes('back')) || devices[0] :
        devices[0];

      await scanner.start(
        { facingMode: "environment", deviceId: cameraId?.id },  // Use back camera on mobile
        {
          fps: 10,  // Lower for better performance
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          disableFlip: false,
          videoConstraints: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: { ideal: "environment" }
          }
        },
        async (decodedText) => {
          // When QR code is detected
          console.log("QR Code detected:", decodedText);
          
          // Stop the scanner once we have a result
          try {
            await stopScanner();
          } catch (error) {
            console.error("Error stopping scanner after detection:", error);
          }
          
          try {
            // Extract gate pass number from the QR code text
            const gatePassNumber = extractGatePassNumber(decodedText);
            
            // Verify the gate pass
            await verifyGatePass(gatePassNumber);
          } catch (error) {
            console.error("Error processing QR code:", error);
          }
        },
        (errorMessage) => {
          // This is called for scanning process errors, not verification errors
          // Usually we just ignore these as they happen during normal scanning
          console.log("Scanner process message:", errorMessage);
        }
      ).catch(error => {
        console.error("Error starting scanner:", error);
        setCameraError(`Failed to start camera: ${error.message || "Unknown error"}`);
        setScanning(false);
        
        toast({
          title: "Camera Access Error",
          description: "Please ensure camera permissions are granted.",
          variant: "destructive",
        });
      });
    } catch (error: any) {
      console.error("Scanner initialization error:", error);
      setCameraError(`Scanner error: ${error.message || "Unknown error"}`);
      setScanning(false);
      
      toast({
        title: "Scanner Error",
        description: error.message || "Failed to initialize scanner",
        variant: "destructive",
      });
    }
  };

  // Stop QR scanner
  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        console.log("Scanner stopped successfully");
      } catch (err) {
        console.error("Error stopping scanner:", err);
      } finally {
        setScanning(false);
      }
    } else {
      setScanning(false);
    }
  };

  // Reset scanner to scan another QR code
  const resetScanner = () => {
    setVerificationResult({ loading: false });
    setCameraError(null);
    if (!scanning) {
      startScanner();
    }
  };

  // Direct verification by typing a gate pass number
  const verifyWithInput = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const input = form.elements.namedItem("gatePassNumber") as HTMLInputElement;
    const gatePassNumber = input.value.trim();
    
    if (!gatePassNumber) {
      toast({
        title: "Input Error",
        description: "Please enter a valid gate pass number",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await verifyGatePass(gatePassNumber);
      // Clear the input on success
      input.value = "";
    } catch (error) {
      // Error is already handled in verifyGatePass
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Gate Pass Verification</CardTitle>
          <CardDescription>
            Scan a gate pass QR code or enter the gate pass number to verify
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {/* Direct input form */}
            <form onSubmit={verifyWithInput} className="mb-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  name="gatePassNumber"
                  placeholder="Enter gate pass number (e.g., PZGP-001)"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <Button type="submit" variant="default" size="sm">
                  Verify
                </Button>
              </div>
            </form>
            
            {/* Separator with text */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500">OR SCAN QR CODE</span>
              </div>
            </div>
            
            {/* Scanner display */}
            {!scanning && !verificationResult.gatePass && !verificationResult.error && !verificationResult.loading && (
              <div className="p-8 border rounded-md text-center bg-slate-50 mt-4">
                <div className="flex flex-col items-center text-muted-foreground">
                  <Camera className="h-10 w-10 mb-3 text-primary opacity-70" />
                  <p>Press "Start Scanner" to begin scanning QR codes</p>
                </div>
              </div>
            )}

            {/* Camera feed during scanning */}
            {scanning && (
              <div 
                ref={scannerContainerRef} 
                className="w-full h-[300px] overflow-hidden rounded-md border border-input mt-4 relative"
              >
                <div id="qr-reader" className="w-full h-full absolute inset-0"></div>
                <style>{`
                  #qr-reader {
                    border: none !important;
                    width: 100% !important;
                    height: 100% !important;
                  }
                  #qr-reader video {
                    width: 100% !important;
                    height: 100% !important;
                    object-fit: cover !important;
                  }
                  #qr-reader__scan_region {
                    position: absolute !important;
                    top: 50% !important;
                    left: 50% !important;
                    transform: translate(-50%, -50%) !important;
                  }
                  #qr-reader__dashboard {
                    padding: 0 !important;
                  }
                  #qr-reader__dashboard_section_csr {
                    display: none !important;
                  }
                `}</style>
              </div>
            )}

            {/* Loading state */}
            {verificationResult.loading && (
              <div className="p-8 border rounded-md text-center mt-4">
                <div className="flex flex-col items-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary mb-3" />
                  <p className="text-muted-foreground">Verifying gate pass...</p>
                </div>
              </div>
            )}

            {/* Camera error state */}
            {cameraError && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Camera Error</AlertTitle>
                <AlertDescription>
                  {cameraError}
                  <div className="mt-2">
                    <p className="text-sm">Please ensure:</p>
                    <ul className="text-sm list-disc pl-5 mt-1">
                      <li>Camera permissions are granted in your browser</li>
                      <li>Your device has a working camera</li>
                      <li>No other application is using the camera</li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Error state */}
            {verificationResult.error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Verification Failed</AlertTitle>
                <AlertDescription>
                  {verificationResult.error}
                </AlertDescription>
              </Alert>
            )}

            {/* Verification result display */}
            {verificationResult.gatePass && (
              <div className="border rounded-md p-4 space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-lg">
                    Gate Pass: {verificationResult.gatePass.gatePassNumber}
                  </h3>
                  <Badge variant={verificationResult.gatePass.isValid ? "default" : "destructive"} className={verificationResult.gatePass.isValid ? "bg-green-600 hover:bg-green-700" : ""}>
                    {verificationResult.gatePass.isValid ? (
                      <span className="flex items-center"><Check className="w-3 h-3 mr-1" /> Valid</span>
                    ) : (
                      <span className="flex items-center"><X className="w-3 h-3 mr-1" /> Invalid</span>
                    )}
                  </Badge>
                </div>
                
                {/* Gate pass details matching the exact layout from screenshot */}
                <div className="space-y-4 text-sm mt-3">
                  {/* Customer Information section */}
                  <div className="bg-slate-50 p-3 rounded-md">
                    <h4 className="font-medium text-red-500 mb-2">Customer Information</h4>
                    <div className="grid grid-cols-2 gap-1">
                      <span className="text-gray-600">Name:</span>
                      <span>{verificationResult.gatePass.customerName}</span>
                    </div>
                    {verificationResult.gatePass.customerPhone && (
                      <div className="grid grid-cols-2 gap-1">
                        <span className="text-gray-600">Phone:</span>
                        <span>{verificationResult.gatePass.customerPhone}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-1">
                      <span className="text-gray-600">Delivery Address:</span>
                      <span>{verificationResult.gatePass.deliveryAddress}</span>
                    </div>
                  </div>
                  
                  {/* Two columns layout for Gate Pass Details and Driver Details */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded-md">
                      <h4 className="font-medium text-red-500 mb-2">Gate Pass Details</h4>
                      <div className="grid grid-cols-2 gap-1">
                        <span className="text-gray-600">Date:</span>
                        <span>{formatDate(verificationResult.gatePass.date)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <span className="text-gray-600">Status:</span>
                        <span>{verificationResult.gatePass.status}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <span className="text-gray-600">Department:</span>
                        <span>{verificationResult.gatePass.department}</span>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 p-3 rounded-md">
                      <h4 className="font-medium text-red-500 mb-2">Driver Details</h4>
                      <div className="grid grid-cols-2 gap-1">
                        <span className="text-gray-600">Name:</span>
                        <span>{verificationResult.gatePass.driverName}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <span className="text-gray-600">Contact:</span>
                        <span>{verificationResult.gatePass.driverMobile}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <span className="text-gray-600">Vehicle:</span>
                        <span>{verificationResult.gatePass.deliveryVanNumber}</span>
                      </div>
                    </div>
                  </div>

                  {/* Verification Details */}
                  <div className="bg-slate-50 p-3 rounded-md">
                    <h4 className="font-medium text-red-500 mb-2">Verification Details</h4>
                    <div className="grid grid-cols-2 gap-1">
                      <span className="text-gray-600">Verified At:</span>
                      <span>{new Date(verificationResult.gatePass.verifiedAt).toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <span className="text-gray-600">Created By:</span>
                      <span>{verificationResult.gatePass.createdBy}</span>
                    </div>
                  </div>
                </div>

                {/* Items table */}
                {verificationResult.gatePass.items && verificationResult.gatePass.items.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2 text-primary">Item Details:</h4>
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
                          {verificationResult.gatePass.items.map((item, index) => (
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
                              {verificationResult.gatePass.items.reduce((sum, item) => sum + item.quantity, 0)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
                
                {/* Validation confirmation */}
                {verificationResult.gatePass.isValid && (
                  <div className="border border-green-200 bg-green-50 rounded-md p-3 mt-4 flex items-center">
                    <CheckCircle2 className="h-6 w-6 text-green-600 mr-2" />
                    <div>
                      <p className="font-medium text-green-800">Valid Gate Pass</p>
                      <p className="text-sm text-green-700">This gate pass has been verified as authentic and is currently valid</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          {scanning ? (
            <Button variant="outline" onClick={stopScanner}>
              Stop Scanner
            </Button>
          ) : (
            <Button variant={verificationResult.gatePass ? "outline" : "default"} onClick={verificationResult.gatePass ? resetScanner : startScanner}>
              {verificationResult.gatePass ? "Scan Another" : "Start Scanner"}
            </Button>
          )}
          
          {verificationResult.gatePass && (
            <Button variant="secondary" onClick={() => window.print()}>
              Print Result
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}