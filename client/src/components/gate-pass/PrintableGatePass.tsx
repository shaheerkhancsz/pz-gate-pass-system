import React, { useRef, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GatePass, Item } from "@shared/schema";
import { formatDate } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";

interface PrintableGatePassProps {
  gatePassId: number;
  copyType: "record" | "driver" | "guard";
}

export function PrintableGatePass({ gatePassId, copyType }: PrintableGatePassProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [qrValue, setQrValue] = useState("");

  // Fetch gate pass data
  const { data, isLoading, error } = useQuery<GatePass & { items: Item[] }>({
    queryKey: [`/api/gate-passes/${gatePassId}`],
  });

  useEffect(() => {
    if (data) {
      const baseUrl = window.location.origin;
      const verificationUrl = `${baseUrl}/verify/${data.gatePassNumber}`;
      setQrValue(verificationUrl);
    }
  }, [data]);

  const getCopyTitle = () => {
    switch (copyType) {
      case "record": return "RECORD COPY";
      case "driver": return "DRIVER COPY";
      case "guard": return "GUARD COPY";
      default: return "GATE PASS";
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading gate pass data...</div>;
  }

  if (error || !data) {
    return <div className="p-8 text-center text-error">Error loading gate pass data</div>;
  }

  return (
    <div ref={printRef} className="p-8 max-w-4xl mx-auto print:p-0">
      <div className="border border-neutral-dark rounded-lg overflow-hidden print:border-none">
        {/* Header */}
        <div className="bg-primary text-white p-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img 
              src="/assets/PZ-logo.png" 
              alt="Logo" 
              className="h-10 bg-white p-1"
            />
            <div>
              <h1 className="font-bold text-lg">Parazelsus Pakistan</h1>
              <p className="text-xs opacity-80">Gate Pass System</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold">GATE PASS</h2>
            <p className="text-xs">{getCopyTitle()}</p>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Basic Info */}
          <div className="flex justify-between text-sm">
            <div>
              <p className="text-neutral-gray">Gate Pass Number:</p>
              <p className="font-medium">{data.gatePassNumber}</p>
            </div>
            <div>
              <p className="text-neutral-gray">Date:</p>
              <p className="font-medium">{formatDate(data.date)}</p>
            </div>
            <div>
              <p className="text-neutral-gray">Department:</p>
              <p className="font-medium">{data.department}</p>
            </div>
          </div>
          
          {/* Customer and Delivery Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-neutral-gray">Customer / Person:</p>
              <p className="font-medium">{data.customerName}</p>
              {data.customerPhone && (
                <div className="mt-1">
                  <p className="text-neutral-gray">Phone:</p>
                  <p className="font-medium">{data.customerPhone}</p>
                </div>
              )}
            </div>
            <div>
              <p className="text-neutral-gray">Delivery Address:</p>
              <p className="font-medium">{data.deliveryAddress}</p>
            </div>
          </div>
          
          {/* Items Table */}
          <div>
            <p className="text-sm text-neutral-gray mb-1">Item Details:</p>
            <table className="w-full border border-neutral-medium text-sm">
              <thead>
                <tr className="bg-neutral-light">
                  <th className="border border-neutral-medium p-1 text-left">Item Name</th>
                  <th className="border border-neutral-medium p-1 text-left">SKU Number</th>
                  <th className="border border-neutral-medium p-1 text-left">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {data.items && data.items.length > 0 ? (
                  data.items.map((item, index) => (
                    <tr key={index}>
                      <td className="border border-neutral-medium p-1">{item.name}</td>
                      <td className="border border-neutral-medium p-1">{item.sku}</td>
                      <td className="border border-neutral-medium p-1">{item.quantity}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="border border-neutral-medium p-1 text-center">
                      No items found
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-neutral-light font-medium">
                  <td colSpan={2} className="border border-neutral-medium p-1 text-right">
                    Total Items: {data.items?.length || 0}
                  </td>
                  <td className="border border-neutral-medium p-1">
                    {data.items?.reduce((sum, item) => sum + item.quantity, 0) || 0}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          {/* Driver and Creator Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-neutral-gray mb-1">Driver Details:</p>
              <div className="space-y-0.5">
                <div className="flex">
                  <p className="w-1/3 text-neutral-gray">Name:</p>
                  <p className="w-2/3 font-medium">{data.driverName}</p>
                </div>
                <div className="flex">
                  <p className="w-1/3 text-neutral-gray">Mobile:</p>
                  <p className="w-2/3 font-medium">{data.driverMobile}</p>
                </div>
                <div className="flex">
                  <p className="w-1/3 text-neutral-gray">CNIC:</p>
                  <p className="w-2/3 font-medium">{data.driverCnic}</p>
                </div>
                <div className="flex">
                  <p className="w-1/3 text-neutral-gray">Van Number:</p>
                  <p className="w-2/3 font-medium">{data.deliveryVanNumber}</p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-neutral-gray mb-1">Created By:</p>
              <div className="space-y-0.5">
                <div className="flex">
                  <p className="w-1/3 text-neutral-gray">Name:</p>
                  <p className="w-2/3 font-medium">{data.createdBy}</p>
                </div>
                <div className="flex">
                  <p className="w-1/3 text-neutral-gray">Department:</p>
                  <p className="w-2/3 font-medium">{data.department}</p>
                </div>
                <div className="flex">
                  <p className="w-1/3 text-neutral-gray">Date & Time:</p>
                  <p className="w-2/3 font-medium">{formatDate(data.createdAt)}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Signatures */}
          <div className="mt-4 pt-2 border-t border-neutral-medium">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <div className="h-16 border-b border-neutral-dark"></div>
                <p className="mt-1 font-medium">Creator's Signature</p>
                <p className="text-xs text-neutral-gray">{data.createdBy}</p>
              </div>
              <div>
                <div className="h-16 border-b border-neutral-dark"></div>
                <p className="mt-1 font-medium">Driver's Signature</p>
                <p className="text-xs text-neutral-gray">{data.driverName}</p>
              </div>
              <div>
                <div className="h-16 border-b border-neutral-dark"></div>
                <p className="mt-1 font-medium">HO Representative</p>
                <p className="text-xs text-neutral-gray">Authorization</p>
              </div>
            </div>
          </div>
          
          {/* Footer with QR */}
          <div className="mt-2 border-t border-neutral-medium pt-2 text-center">
            <div className="flex items-center justify-between">
              <div className="flex-1 text-left">
                <p className="text-sm text-neutral-gray">Parazelsus Pakistan - Gate Pass System</p>
                <p className="text-xs text-neutral-gray">This is a computer generated document.</p>
              </div>
              <div className="flex-shrink-0">
                <div className="bg-white shadow-sm rounded-md p-2 inline-flex flex-col items-center">
                  <QRCodeSVG 
                    value={qrValue}
                    size={100}
                    level="M"
                    bgColor={"#FFFFFF"}
                    fgColor={"#000000"}
                    includeMargin={false}
                  />
                  <div className="mt-1 text-center">
                    <p className="text-xs font-medium text-primary">Scan with QR Scanner</p>
                    <p className="text-xs text-neutral-gray">Gate Pass #{data.gatePassNumber}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
