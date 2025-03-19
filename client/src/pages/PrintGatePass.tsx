import React, { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { PrintableGatePass } from "@/components/gate-pass/PrintableGatePass";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PrintGatePass() {
  const { id } = useParams();
  const [copyType, setCopyType] = useState<"record" | "driver" | "guard">("record");
  const gatePassId = parseInt(id || "0", 10);

  // Removed auto-print functionality as requested

  const handlePrint = () => {
    window.print();
  };

  const handleCopyTypeChange = (value: string) => {
    setCopyType(value as "record" | "driver" | "guard");
  };

  return (
    <div className="print-container">
      {/* Print Controls - This entire section will be hidden when printing */}
      <div className="p-6 no-print">
        <div className="mb-6 flex justify-between">
          <Link href="/gate-passes">
            <Button>
              <span className="material-icons mr-1">arrow_back</span>
              Back to Gate Passes
            </Button>
          </Link>
          <Button onClick={handlePrint} className="bg-primary">
            <span className="material-icons mr-1">print</span>
            Print
          </Button>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <h3 className="text-lg font-medium mb-4">Select Copy Type</h3>
            <Tabs value={copyType} onValueChange={handleCopyTypeChange}>
              <TabsList className="mb-4">
                <TabsTrigger value="record">Record Copy</TabsTrigger>
                <TabsTrigger value="driver">Driver Copy</TabsTrigger>
                <TabsTrigger value="guard">Guard Copy</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Printable Content - Only this will be visible when printing */}
      <div className="print-only">
        <PrintableGatePass gatePassId={gatePassId} copyType={copyType} />
      </div>
    </div>
  );
}
