import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { formatDateTime } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/use-permissions';
import { apiRequest } from '@/lib/queryClient';
import { Pencil, Trash2, Download, FileText, File } from 'lucide-react';

interface Document {
  id: number;
  entityType: string;
  entityId: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileData: string;
  description: string | null;
  uploadedBy: number | null;
  uploadedByEmail: string;
  createdAt: string;
}

interface DocumentListProps {
  entityType: string;
  entityId: number;
}

export function DocumentList({ entityType, entityId }: DocumentListProps) {
  const [activeDocument, setActiveDocument] = useState<Document | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { canDelete } = usePermissions();
  const queryClient = useQueryClient();

  // Get all documents for this entity
  const { data: documents = [], isLoading } = useQuery({
    queryKey: [`/api/documents/entity/${entityType}/${entityId}`],
    queryFn: async () => {
      if (!entityId) return [];
      const response = await fetch(`/api/documents/entity/${entityType}/${entityId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
    enabled: !!entityId
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: number) => {
      return apiRequest('DELETE', `/api/documents/${documentId}`, { user }); // For activity logging
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/documents/entity/${entityType}/${entityId}`] });
      toast({
        title: 'Success',
        description: 'Document deleted successfully',
      });
      setDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete document',
        variant: 'destructive',
      });
    }
  });

  const handleDownload = (doc: Document) => {
    try {
      // Create an anchor element
      const link = window.document.createElement('a');
      link.href = doc.fileData;
      link.download = doc.fileName;

      // Append to the document and trigger click
      window.document.body.appendChild(link);
      link.click();

      // Clean up
      window.document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: 'Error',
        description: 'Failed to download document',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = (document: Document) => {
    setActiveDocument(document);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (activeDocument) {
      deleteMutation.mutate(activeDocument.id);
    }
  };

  const handlePreview = (document: Document) => {
    setActiveDocument(document);
    setPreviewDialogOpen(true);
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return null; // Will display the image directly
    } else if (fileType.includes('pdf')) {
      return <FileText className="h-5 w-5" />;
    } else {
      return <File className="h-5 w-5" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
      return bytes + ' B';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(2) + ' KB';
    } else {
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
  };

  if (isLoading) {
    return <div className="py-4 text-center">Loading documents...</div>;
  }

  if (documents.length === 0) {
    return <div className="py-4 text-center text-muted-foreground">No documents found</div>;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Documents</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Uploaded By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((document: Document) => (
              <TableRow key={document.id}>
                <TableCell className="font-medium">{document.fileName}</TableCell>
                <TableCell>{document.fileType}</TableCell>
                <TableCell>{formatFileSize(document.fileSize)}</TableCell>
                <TableCell>{document.uploadedByEmail}</TableCell>
                <TableCell>{formatDateTime(document.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePreview(document)}
                      title="Preview"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDownload(document)}
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {canDelete('document') && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDelete(document)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Preview Dialog */}
        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {activeDocument?.fileName}
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-auto max-h-[70vh]">
              {activeDocument && (
                <div className="space-y-4">
                  {activeDocument.description && (
                    <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                      {activeDocument.description}
                    </div>
                  )}

                  {activeDocument.fileType.startsWith('image/') ? (
                    <div className="flex justify-center">
                      <img
                        src={activeDocument.fileData}
                        alt={activeDocument.fileName}
                        className="max-w-full max-h-[60vh] object-contain"
                      />
                    </div>
                  ) : activeDocument.fileType.includes('pdf') ? (
                    <div className="flex justify-center border rounded">
                      <iframe
                        src={activeDocument.fileData}
                        width="100%"
                        height="500px"
                        title={activeDocument.fileName}
                      />
                    </div>
                  ) : (
                    <div className="flex justify-center items-center p-8 border rounded bg-muted">
                      <div className="text-center">
                        <File className="h-16 w-16 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          This file type cannot be previewed. Please download the file.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() => activeDocument && handleDownload(activeDocument)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="text-sm text-muted-foreground">
                    <p>Uploaded by: {activeDocument.uploadedByEmail}</p>
                    <p>Date: {formatDateTime(activeDocument.createdAt)}</p>
                    <p>Size: {formatFileSize(activeDocument.fileSize)}</p>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the document "{activeDocument?.fileName}".
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}