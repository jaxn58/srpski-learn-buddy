import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Paperclip, FileText, Image, Trash2, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md", ".jpg", ".jpeg", ".png", ".webp"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export default function ChatDocumentUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const documents = useQuery(api.documents.getUserDocuments);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const createDocument = useMutation(api.documents.createDocument);
  const deleteDocument = useMutation(api.documents.deleteDocument);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error("Supported formats: PDF, TXT, Markdown, JPEG, PNG, WebP");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("File size must be under 10MB");
      return;
    }

    setIsUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!uploadResponse.ok) throw new Error("Upload failed");

      const { storageId } = await uploadResponse.json();

      await createDocument({
        storageId,
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
      });

      toast.success("Document uploaded — processing started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (docId: (typeof documents extends Array<infer T> ? T : never)["_id"]) => {
    try {
      await deleteDocument({ documentId: docId as any });
      toast.success("Document deleted");
    } catch {
      toast.error("Failed to delete document");
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "processing":
        return <Loader2 className="h-3 w-3 animate-spin text-amber-500" />;
      case "ready":
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case "error":
        return <AlertCircle className="h-3 w-3 text-destructive" />;
      default:
        return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
    }
  };

  const docCount = documents?.length ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          disabled={isUploading}
          title="Upload documents for the AI Buddy"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
          {docCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full text-[10px] h-4 w-4 flex items-center justify-center">
              {docCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" side="top" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Your Documents</h4>
            <Badge variant="outline" className="text-xs">{docCount}/5</Badge>
          </div>

          {documents && documents.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {documents.map((doc) => (
                <div
                  key={doc._id}
                  className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {statusIcon(doc.status)}
                    {IMAGE_EXTENSIONS.some((ext) => doc.fileName.toLowerCase().endsWith(ext))
                      ? <Image className="h-3 w-3 shrink-0 text-muted-foreground" />
                      : <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                    }
                    <span className="truncate">{doc.fileName}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => handleDelete(doc._id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">
              Upload documents or photos so the AI Buddy can reference them
            </p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || docCount >= 5}
          >
            <Paperclip className="h-3 w-3" />
            {docCount >= 5 ? "Document limit reached" : "Upload Document"}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center leading-tight">
            PDF, TXT, Markdown, JPEG, PNG, WebP — max 10 MB
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
