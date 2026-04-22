import { useEffect, useRef, useState } from "react";
import { HardDrive, Upload, Download, RefreshCw, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { downloadFromDrive, listDrive, uploadToDrive, type DriveFile } from "@/lib/google";

const fmtSize = (s?: string) => {
  if (!s) return "—";
  const n = parseInt(s);
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
};

export const DriveWidget = () => {
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    const r = await listDrive();
    if (r.error) setError(r.error);
    else setFiles(r.files ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Max 25 MB per upload through the dashboard");
      e.target.value = "";
      return;
    }
    setUploading(true);
    const r = await uploadToDrive(file);
    setUploading(false);
    e.target.value = "";
    if (r.error) toast.error(r.error);
    else {
      toast.success(`Uploaded ${r.file?.name}`);
      refresh();
    }
  };

  const handleDownload = async (f: DriveFile) => {
    setDownloadingId(f.id);
    try {
      await downloadFromDrive(f.id);
      toast.success(`Downloaded ${f.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-foreground/80" />
          <h3 className="text-sm font-semibold">Drive</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          </Button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
        </div>
      </header>
      <div className="max-h-[360px] flex-1 overflow-auto">
        {error && <div className="p-4 text-xs text-destructive">{error}</div>}
        {!error && files === null && (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}
        {files?.length === 0 && <div className="p-4 text-xs text-muted-foreground">No files in Drive yet.</div>}
        {files && files.length > 0 && (
          <ol className="divide-y divide-border">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-foreground">{f.name}</div>
                  <div className="text-xs text-muted-foreground">{fmtSize(f.size)} · {new Date(f.modifiedTime).toLocaleDateString()}</div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDownload(f)}
                  disabled={downloadingId === f.id}
                  title="Download"
                >
                  {downloadingId === f.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                </Button>
                {f.webViewLink && (
                  <a
                    href={f.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    title="Open in Drive"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};
