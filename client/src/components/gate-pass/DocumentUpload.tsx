import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DocumentUploadProps {
  uploadedFiles: File[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<File[]>>;
  isUploading: boolean;
  setIsUploading: React.Dispatch<React.SetStateAction<boolean>>;
}

export function DocumentUpload({
  uploadedFiles,
  setUploadedFiles,
  isUploading,
  setIsUploading,
}: DocumentUploadProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setUploadedFiles((prev) => [...prev, ...files]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Input
          type="file"
          multiple
          onChange={handleFileChange}
          className="flex-1"
          disabled={isUploading}
        />
      </div>

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Selected Files:</h4>
          <div className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 border rounded"
              >
                <div className="flex items-center gap-2">
                  <span className="material-icons text-neutral-dark">description</span>
                  <span className="text-sm">{file.name}</span>
                  <span className="text-xs text-neutral-dark">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveFile(index)}
                  disabled={isUploading}
                  className="text-error hover:text-error-dark h-auto w-auto p-1"
                >
                  <span className="material-icons text-base">delete</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isUploading && (
        <div className="flex items-center gap-2 text-sm text-neutral-dark">
          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
          <span>Uploading files...</span>
        </div>
      )}
    </div>
  );
} 