import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { DocumentList } from "@/components/documents/DocumentList";
import { DocumentPanel } from "@/components/documents/DocumentPanel";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function Documents() {
  return (
    <AppLayout>
      <div className="flex flex-col space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">
            Manage and view all documents related to gate passes.
          </p>
        </div>
        
        <Separator />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Document Upload Section */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Upload Document</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentUpload />
            </CardContent>
          </Card>
          
          {/* Document List Section */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Document List</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentList />
            </CardContent>
          </Card>
        </div>
        
        {/* Document Preview Panel */}
        <DocumentPanel />
      </div>
    </AppLayout>
  );
} 