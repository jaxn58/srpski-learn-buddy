import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { AnimatedPage, AnimatedItem } from "@/components/AnimatedPage";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useFeatureAccess, canUseKnowledgeRack } from "@/hooks/useFeatureAccess";
import { HardDrive, MessageSquare, Upload, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatRelativeTime(timestamp: number | null | undefined, _locale: string): string {
  if (!timestamp) return "—";
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function storageBarClass(percent: number | null | undefined): string {
  if (percent === null || percent === undefined) return "";
  if (percent >= 80) return "[&>div]:bg-destructive";
  if (percent >= 60) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-primary";
}

export default function MyLibraryHub() {
  const { t, i18n } = useTranslation();
  const featureAccess = useFeatureAccess();
  const showKnowledgeBase = canUseKnowledgeRack(featureAccess);
  const stats = useQuery(api.documents.getLibraryHubStats);

  const chatCount = stats?.chatSessionCount ?? 0;
  const folderCount = stats?.chatFolderCount ?? 0;
  const docCount = stats?.documentCount ?? 0;
  const storage = stats?.storage;
  const percentUsed = storage?.percentUsed ?? null;

  return (
    <AnimatedPage className="space-y-6">
      <AnimatedItem>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("myLibrary.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("myLibrary.subtitle")}</p>
        </div>
      </AnimatedItem>

      <AnimatedItem>
        <div
          className={cn(
            "grid gap-4",
            showKnowledgeBase ? "md:grid-cols-2" : "md:grid-cols-1 max-w-xl"
          )}
        >
          <Card className="rounded-xl border shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{t("myLibrary.chatArchive.title")}</CardTitle>
                  <CardDescription>{t("myLibrary.chatArchive.description")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>{t("myLibrary.chatArchive.stats", { chats: chatCount, folders: folderCount })}</p>
                <p>
                  {t("myLibrary.lastActivity")}:{" "}
                  {formatRelativeTime(stats?.chatLastActivityAt, i18n.language)}
                </p>
              </div>
              <Button asChild className="w-full gap-2">
                <Link href="/library/chats">
                  {t("myLibrary.open")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {showKnowledgeBase && (
            <Card className="rounded-xl border shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <HardDrive className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{t("myLibrary.knowledgeBase.title")}</CardTitle>
                    <CardDescription>{t("myLibrary.knowledgeBase.description")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{t("myLibrary.knowledgeBase.documentCount", { count: docCount })}</p>
                  <p>
                    {t("myLibrary.lastActivity")}:{" "}
                    {formatRelativeTime(stats?.documentLastUploadAt, i18n.language)}
                  </p>
                </div>
                {storage && storage.quotaBytes !== null && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {formatBytes(storage.usedBytes)}
                        {storage.quotaBytes !== null
                          ? ` / ${formatBytes(storage.quotaBytes)}`
                          : ""}
                      </span>
                      <span>
                        {percentUsed !== null ? `${percentUsed}%` : ""}
                      </span>
                    </div>
                    <Progress
                      value={percentUsed ?? 0}
                      className={cn("h-2", storageBarClass(percentUsed))}
                    />
                    {percentUsed !== null && percentUsed >= 80 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {t("myLibrary.storage.almostFull")}
                      </p>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button asChild variant="default" className="flex-1 gap-2">
                    <Link href="/library/documents">
                      {t("myLibrary.open")}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="gap-2">
                    <Link href="/library/documents?upload=1">
                      <Upload className="h-4 w-4" />
                      {t("myLibrary.upload")}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </AnimatedItem>
    </AnimatedPage>
  );
}
