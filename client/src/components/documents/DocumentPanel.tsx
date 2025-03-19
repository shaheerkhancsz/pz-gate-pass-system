import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DocumentUpload } from './DocumentUpload';
import { DocumentList } from './DocumentList';
import { usePermissions } from '@/hooks/use-permissions';

interface DocumentPanelProps {
  entityType: string;
  entityId: number;
  title?: string;
}

export function DocumentPanel({ entityType, entityId, title = 'Documents' }: DocumentPanelProps) {
  const [activeTab, setActiveTab] = useState<string>('view');
  const { canCreate } = usePermissions();
  const canUploadDocuments = canCreate('document');
  
  const handleUploadSuccess = () => {
    // Switch back to view tab after successful upload
    setActiveTab('view');
  };
  
  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <TabsList>
            <TabsTrigger value="view">View</TabsTrigger>
            {canUploadDocuments && (
              <TabsTrigger value="upload">Upload</TabsTrigger>
            )}
          </TabsList>
        </div>
        
        <TabsContent value="view" className="mt-0">
          <DocumentList entityType={entityType} entityId={entityId} />
        </TabsContent>
        
        {canUploadDocuments && (
          <TabsContent value="upload" className="mt-0">
            <DocumentUpload 
              entityType={entityType} 
              entityId={entityId} 
              onSuccess={handleUploadSuccess}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}