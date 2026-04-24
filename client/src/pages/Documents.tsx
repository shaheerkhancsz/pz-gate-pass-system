import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/use-permissions";
import { formatDateTime } from "@/lib/utils";
import {
  FolderOpen, Search, Upload, Download, Eye, Trash2,
  FileText, FileImage, File, Loader2, RefreshCw, X,
  HardDrive, Files,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocMeta {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  entityType: string;
  entityId: number;
  description: string | null;
  uploadedBy: number | null;
  uploadedByEmail: string;
  createdAt: string;
}

interface DocFull extends DocMeta {
  fileData: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ENTITY_TYPE_LABELS: Record<string, string> = {
  gate_pass:   "Gate Pass",
  gatePass:    "Gate Pass",
  user:        "User",
  customer:    "Customer",
  driver:      "Driver",
  vendor:      "Vendor",
  company:     "Company",
};

const ENTITY_TYPES = [
  { value: "gate_pass", label: "Gate Pass" },
  { value: "customer",  label: "Customer"  },
  { value: "driver",    label: "Driver"    },
  { value: "vendor",    label: "Vendor"    },
  { value: "user",      label: "User"      },
];

function friendlyMime(mime: string): string {
  if (mime.startsWith("image/"))   return mime.replace("image/", "").toUpperCase() + " Image";
  if (mime.includes("pdf"))        return "PDF Document";
  if (mime.includes("word") || mime.includes("docx")) return "Word Document";
  if (mime.includes("excel") || mime.includes("xlsx") || mime.includes("spreadsheet")) return "Spreadsheet";
  if (mime.includes("text/"))      return "Text File";
  if (mime.includes("zip"))        return "ZIP Archive";
  return mime.split("/").pop()?.toUpperCase() ?? mime;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)           return bytes + " B";
  if (bytes < 1024 * 1024)    return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function FileIcon({ mime, className }: { mime: string; className?: string }) {
  if (mime.startsWith("image/"))  return <FileImage className={className} />;
  if (mime.includes("pdf"))       return <FileText className={className} />;
  return <File className={className} />;
}

function getMimeBadgeClass(mime: string) {
  if (mime.startsWith("image/"))  return "bg-purple-100 text-purple-800";
  if (mime.includes("pdf"))       return "bg-red-100 text-red-800";
  if (mime.includes("word") || mime.includes("doc")) return "bg-blue-100 text-blue-800";
  if (mime.includes("excel") || mime.includes("sheet")) return "bg-green-100 text-green-800";
  return "bg-gray-100 text-gray-700";
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Documents() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { canCreate, canDelete } = usePermissions();
  const qc = useQueryClient();

  // Filters
  const [search,     setSearch]     = useState("");
  const [entityType, setEntityType] = useState("all");

  // Dialogs
  const [previewDoc,     setPreviewDoc]     = useState<DocFull | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteTarget,   setDeleteTarget]   = useState<DocMeta | null>(null);
  const [uploadOpen,     setUploadOpen]     = useState(false);

  // Upload form state
  const [uploadFile,        setUploadFile]        = useState<File | null>(null);
  const [uploadEntityType,  setUploadEntityType]  = useState("gate_pass");
  const [uploadEntityId,    setUploadEntityId]    = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploading,         setUploading]         = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch all documents (metadata only) ──────────────────────────────────

  const params = new URLSearchParams();
  if (search)                params.set("search",     search);
  if (entityType !== "all")  params.set("entityType", entityType);

  const { data: docs = [], isLoading, refetch } = useQuery<DocMeta[]>({
    queryKey: ["/api/documents", search, entityType],
    queryFn: async () => {
      const res = await fetch(`/api/documents?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalSize = docs.reduce((s, d) => s + d.fileSize, 0);

  // ── Preview (fetches full doc with fileData) ────────────────────────────

  const openPreview = async (doc: DocMeta) => {
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load document");
      setPreviewDoc(await res.json());
    } catch (err: any) {
      toast({ title: "Preview failed", description: err.message, variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Download ───────────────────────────────────────────────────────────────

  const downloadDoc = async (doc: DocMeta) => {
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { credentials: "include" });
      const full: DocFull = await res.json();
      const a = document.createElement("a");
      a.href = full.fileData;
      a.download = full.fileName;
      a.click();
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Document deleted" });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  // ── Upload ─────────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!uploadFile) { toast({ title: "Select a file", variant: "destructive" }); return; }
    const entityIdNum = parseInt(uploadEntityId, 10);
    if (!uploadEntityId || isNaN(entityIdNum)) {
      toast({ title: "Enter a valid Entity ID", variant: "destructive" });
      return;
    }
    if (uploadFile.size > 10 * 1024 * 1024) {
      toast({ title: "File must be under 10 MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(uploadFile);
      });
      const res = await fetch("/api/documents", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType:      uploadEntityType,
          entityId:        entityIdNum,
          fileName:        uploadFile.name,
          fileType:        uploadFile.type || "application/octet-stream",
          fileSize:        uploadFile.size,
          fileData,
          description:     uploadDescription || null,
          uploadedBy:      user?.id ?? null,
          uploadedByEmail: user?.email ?? "unknown",
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      qc.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Document uploaded" });
      setUploadOpen(false);
      setUploadFile(null);
      setUploadEntityId("");
      setUploadDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FolderOpen className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
              <p className="text-sm text-muted-foreground">
                All uploaded files across gate passes and entities
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh
            </Button>
            {canCreate("document") && (
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 bg-blue-100 rounded-lg"><Files className="h-5 w-5 text-blue-700" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Documents</p>
                <p className="text-xl font-bold">{docs.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 bg-green-100 rounded-lg"><HardDrive className="h-5 w-5 text-green-700" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Size</p>
                <p className="text-xl font-bold">{formatBytes(totalSize)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 bg-purple-100 rounded-lg"><FileImage className="h-5 w-5 text-purple-700" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Gate Pass Docs</p>
                <p className="text-xl font-bold">
                  {docs.filter(d => d.entityType === "gate_pass" || d.entityType === "gatePass").length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by file name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All entity types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entity Types</SelectItem>
              {ENTITY_TYPES.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Loading documents...</span>
              </div>
            ) : docs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                <FolderOpen className="h-12 w-12 opacity-25" />
                <p className="font-medium">No documents found</p>
                {(search || entityType !== "all") && (
                  <Button variant="link" size="sm" onClick={() => { setSearch(""); setEntityType("all"); }}>
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>File</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Uploaded By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.map(doc => (
                      <TableRow key={doc.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-0">
                            <FileIcon mime={doc.fileType} className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium text-sm truncate max-w-[180px]" title={doc.fileName}>
                              {doc.fileName}
                            </span>
                          </div>
                          {doc.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">
                              {doc.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getMimeBadgeClass(doc.fileType)}`}>
                            {friendlyMime(doc.fileType)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="font-medium">
                              {ENTITY_TYPE_LABELS[doc.entityType] ?? doc.entityType}
                            </span>
                            <span className="text-muted-foreground ml-1">#{doc.entityId}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatBytes(doc.fileSize)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]">
                          {doc.uploadedByEmail}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDateTime(doc.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8"
                              onClick={() => openPreview(doc)}
                              title="Preview"
                              disabled={previewLoading}
                            >
                              {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8"
                              onClick={() => downloadDoc(doc)}
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {canDelete("document") && (
                              <Button
                                variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(doc)}
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Preview Dialog ── */}
      <Dialog open={!!previewDoc} onOpenChange={open => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileIcon mime={previewDoc?.fileType ?? ""} className="h-5 w-5 text-primary" />
              {previewDoc?.fileName}
            </DialogTitle>
          </DialogHeader>
          {previewDoc && (
            <div className="space-y-3">
              {previewDoc.description && (
                <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                  {previewDoc.description}
                </p>
              )}
              <div className="overflow-auto max-h-[60vh] rounded-md border">
                {previewDoc.fileType.startsWith("image/") ? (
                  <div className="flex justify-center p-4">
                    <img src={previewDoc.fileData} alt={previewDoc.fileName} className="max-w-full max-h-[55vh] object-contain" />
                  </div>
                ) : previewDoc.fileType.includes("pdf") ? (
                  <iframe src={previewDoc.fileData} width="100%" height="500px" title={previewDoc.fileName} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                    <File className="h-14 w-14 opacity-30" />
                    <p className="text-sm">This file type cannot be previewed inline.</p>
                    <Button variant="outline" size="sm" onClick={() => downloadDoc(previewDoc)}>
                      <Download className="h-4 w-4 mr-2" />Download File
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Uploaded by: <strong className="text-foreground">{previewDoc.uploadedByEmail}</strong></span>
                <span>Size: <strong className="text-foreground">{formatBytes(previewDoc.fileSize)}</strong></span>
                <span>Date: <strong className="text-foreground">{formatDateTime(previewDoc.createdAt)}</strong></span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Upload Dialog ── */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Upload Document
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Entity Type</Label>
                <Select value={uploadEntityType} onValueChange={setUploadEntityType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Entity ID</Label>
                <Input
                  type="number" placeholder="e.g. 42"
                  value={uploadEntityId}
                  onChange={e => setUploadEntityId(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>File <span className="text-muted-foreground text-xs">(max 10 MB)</span></Label>
              <Input
                type="file" ref={fileInputRef}
                onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
              />
              {uploadFile && (
                <p className="text-xs text-muted-foreground">
                  {uploadFile.name} — {formatBytes(uploadFile.size)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                placeholder="Brief note about this document..."
                value={uploadDescription}
                onChange={e => setUploadDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading || !uploadFile}>
              {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</> : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.fileName}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
