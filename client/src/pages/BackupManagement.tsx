import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { 
  Download, 
  RefreshCw, 
  Database, 
  HardDrive, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Loader2,
  AlertCircle,
  ArrowLeft
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { formatDateTimeEU } from "@/lib/utils";
import { useState } from "react";
import { useTranslation } from "react-i18next";

type BackupStatus = "completed" | "failed" | "in_progress" | "partial";
type BackupEnvironment = "production" | "development";

interface BackupMetadata extends Doc<"backupMetadata"> {
  storageId: string;
  timestamp: number;
  environment: BackupEnvironment;
  tableCount: number;
  expectedTableCount?: number;
  totalRecords: number;
  size: number;
  status: BackupStatus;
  errorMessage?: string;
  failedTables?: string[];
}

export default function BackupManagement() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const backups = useQuery(api.backupAdmin.listBackups) as BackupMetadata[] | undefined;
  const backupsLoading = backups === undefined;
  
  const triggerBackupMutation = useMutation(api.backupAdmin.triggerBackupNow);
  const getBackupUrlMutation = useMutation(api.backupAdmin.getBackupUrl);
  
  const [triggeringBackup, setTriggeringBackup] = useState(false);
  const [downloadingBackupId, setDownloadingBackupId] = useState<Id<"backupMetadata"> | null>(null);

  // Redirect if not superadmin
  if (!authLoading && (!user || user.role !== "superadmin")) {
    window.location.href = "/";
    return null;
  }

  if (authLoading || backupsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleTriggerBackup = async () => {
    try {
      setTriggeringBackup(true);
      await triggerBackupMutation({});
      toast.success(t("admin.backup.toast.triggered.title"), {
        description: t("admin.backup.toast.triggered.desc"),
      });
    } catch (error: any) {
      console.error("Backup trigger error:", error);
      toast.error(t("admin.backup.toast.triggerFailed.title"), {
        description: error.message || t("admin.contentImport.toast.unknownError"),
      });
    } finally {
      setTriggeringBackup(false);
    }
  };

  const saveBackupFile = (blob: Blob, backupId: Id<"backupMetadata">) => {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `backup-${backupId}.json`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
  };

  const handleDownloadBackup = async (backupId: Id<"backupMetadata">) => {
    try {
      setDownloadingBackupId(backupId);

      const result = await getBackupUrlMutation({ backupId });

      if (result?.url) {
        // Fetch first (Convex Storage URLs are cross-origin and block a direct download attribute).
        if (result.backupFormat === "v2") {
          const manifestResponse = await fetch(result.url);
          if (!manifestResponse.ok) {
            throw new Error("Failed to download backup manifest");
          }
          const manifest: Record<string, unknown> = await manifestResponse.json();
          const tables: Record<string, unknown> = {};
          for (const table of result.tables) {
            const rows: unknown[] = [];
            for (const chunkUrl of table.urls) {
              const tableResponse = await fetch(chunkUrl);
              if (!tableResponse.ok) {
                throw new Error(`Failed to download table ${table.name}`);
              }
              const parsed: unknown = await tableResponse.json();
              if (!Array.isArray(parsed)) {
                throw new Error(`Backup chunk for ${table.name} is not a list`);
              }
              rows.push(...parsed);
            }
            tables[table.name] = rows;
          }
          const combined = { ...manifest, tables };
          saveBackupFile(new Blob([JSON.stringify(combined)], { type: "application/json" }), backupId);
        } else {
          const response = await fetch(result.url);
          if (!response.ok) {
            throw new Error("Failed to download backup");
          }
          saveBackupFile(await response.blob(), backupId);
        }

        toast.success(t("admin.backup.toast.downloadStarted.title"), {
          description: t("admin.backup.toast.downloadStarted.desc"),
        });
      }
    } catch (error: any) {
      console.error("Download error:", error);
      toast.error(t("admin.backup.toast.downloadFailed.title"), {
        description: error.message || t("admin.contentImport.toast.unknownError"),
      });
    } finally {
      setDownloadingBackupId(null);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    return formatDateTimeEU(timestamp);
  };

  const getStatusBadge = (status: BackupStatus) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Completed
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            In Progress
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      case "partial":
        return (
          <Badge variant="outline" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Partial
          </Badge>
        );
    }
  };

  const canDownloadBackup = (status: BackupStatus) =>
    status === "completed" || status === "partial";

  const formatTableCount = (backup: BackupMetadata) =>
    backup.expectedTableCount != null
      ? `${backup.tableCount} / ${backup.expectedTableCount}`
      : String(backup.tableCount);

  const getEnvironmentBadge = (environment: BackupEnvironment) => {
    return (
      <Badge variant={environment === "production" ? "default" : "outline"}>
        {environment === "production" ? "Production" : "Development"}
      </Badge>
    );
  };

  // Calculate statistics
  const totalBackups = backups?.length || 0;
  const completedBackups = backups?.filter(b => b.status === "completed").length || 0;
  const failedBackups = backups?.filter(b => b.status === "failed").length || 0;
  const totalSize = backups?.reduce((sum, b) => sum + (b.size || 0), 0) || 0;
  const latestBackup = backups?.[0];

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Database Backup Management</h1>
          <p className="text-muted-foreground">
            Monitor and manage automated database backups
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              disabled={triggeringBackup}
              className="gap-2"
            >
              {triggeringBackup ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Triggering...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Trigger Backup Now
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Trigger Manual Backup?</AlertDialogTitle>
              <AlertDialogDescription>
                This starts a backup of every database table. User uploads and other Convex Storage files are not included; those are covered by the Convex dashboard backup with file storage. The process can take several minutes. You don't need to stay on this page while the backup runs.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleTriggerBackup}>
                Start Backup
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Backups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <span className="text-2xl font-bold">{totalBackups}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-2xl font-bold">{completedBackups}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-2xl font-bold">{failedBackups}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              <span className="text-2xl font-bold">{formatBytes(totalSize)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Latest Backup Info */}
      {latestBackup && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Latest Backup</CardTitle>
            <CardDescription>
              Most recent database backup information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                {getStatusBadge(latestBackup.status)}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Environment</p>
                {getEnvironmentBadge(latestBackup.environment)}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Created</p>
                <p className="text-sm font-medium">{formatDate(latestBackup.timestamp)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Size</p>
                <p className="text-sm font-medium">{formatBytes(latestBackup.size)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Tables</p>
                <p className="text-sm font-medium">{formatTableCount(latestBackup)} tables</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Records</p>
                <p className="text-sm font-medium">{latestBackup.totalRecords.toLocaleString()} records</p>
              </div>
            </div>
            {latestBackup.failedTables && latestBackup.failedTables.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Missing tables: {latestBackup.failedTables.join(", ")}
              </p>
            )}
            {canDownloadBackup(latestBackup.status) && (
              <Button 
                onClick={() => handleDownloadBackup(latestBackup._id)}
                disabled={downloadingBackupId === latestBackup._id}
                className="gap-2"
              >
                {downloadingBackupId === latestBackup._id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Getting Download Link...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download Latest Backup
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Backup List */}
      <Card>
        <CardHeader>
          <CardTitle>Backup History</CardTitle>
          <CardDescription>
            Complete list of all database backups (last 100)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!backups || backups.length === 0 ? (
            <div className="text-center py-12">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No backups found</p>
              <p className="text-sm text-muted-foreground mb-4">
                Backups run automatically every day at 3:00 UTC
              </p>
              <Button onClick={handleTriggerBackup} disabled={triggeringBackup}>
                {triggeringBackup ? "Triggering..." : "Create First Backup"}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead className="text-right">Tables</TableHead>
                    <TableHead className="text-right">Records</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((backup) => (
                    <TableRow key={backup._id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(backup.timestamp)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(backup.status)}
                      </TableCell>
                      <TableCell>
                        {getEnvironmentBadge(backup.environment)}
                      </TableCell>
                      <TableCell className="text-right whitespace-normal">
                        <div>{formatTableCount(backup)}</div>
                        {backup.failedTables && backup.failedTables.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1" title={backup.failedTables.join(", ")}>
                            Missing: {backup.failedTables.join(", ")}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {backup.totalRecords.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatBytes(backup.size)}
                      </TableCell>
                      <TableCell className="text-right">
                        {canDownloadBackup(backup.status) ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownloadBackup(backup._id)}
                              disabled={downloadingBackupId === backup._id}
                              className="gap-2"
                            >
                              {downloadingBackupId === backup._id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Download className="h-3 w-3" />
                              )}
                            </Button>
                            {backup.status === "partial" && backup.errorMessage ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost">
                                    <AlertCircle className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Missing tables</AlertDialogTitle>
                                    <AlertDialogDescription className="whitespace-pre-wrap">
                                      {backup.errorMessage}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogAction>Close</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : null}
                          </div>
                        ) : backup.status === "failed" && backup.errorMessage ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <AlertCircle className="h-3 w-3 text-red-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Backup Error</AlertDialogTitle>
                                <AlertDialogDescription className="whitespace-pre-wrap">
                                  {backup.errorMessage}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogAction>Close</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="mt-6 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Backup Information
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            <strong>Document export:</strong> This page backs up every database table. The table list follows the schema, so new tables are included automatically. A Partial backup saved the tables it could and names the ones it missed. Older backups that show only a table count, without a second number, used the previous fixed list of 30 tables.
          </p>
          <p>
            <strong>Files and full restore:</strong> User uploads, audio, and other Convex Storage files are not inside this download. In the Convex dashboard, turn on a daily backup that includes file storage, separately for Development and for Production. Daily Convex backups are kept for 7 days, weekly backups for 14 days (Pro plan). That backup does not include code, crons, or environment variables. Restore from the Convex dashboard replaces the deployment data, so take another backup first. This page does not restore data.
          </p>
          <p>
            <strong>Automatic Schedule:</strong> Document backups run daily at 3:00 UTC (4:00 MEZ / 5:00 MESZ)
          </p>
          <p>
            <strong>Retention Policy:</strong> Document backups on this page are kept for 30 days, then automatically deleted
          </p>
          <p>
            <strong>Download Links:</strong> Download URLs are valid for 1 hour after generation
          </p>
          <p>
            <strong>Manual Backups:</strong> You can trigger a document backup manually at any time using the button above
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
