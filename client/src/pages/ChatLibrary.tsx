import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, usePaginatedQuery, useConvex } from "convex/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Link } from "wouter";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { AnimatedPage, AnimatedItem } from "@/components/AnimatedPage";
import { FolderTree } from "@/components/chatLibrary/FolderTree";
import { SessionList } from "@/components/chatLibrary/SessionList";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { getFolderPath, buildAggregatedSessionCounts, getChildFolders } from "@/lib/chatLibraryTree";
import { useIsMobile } from "@/hooks/useMobile";
import {
  ArrowLeft,
  ChevronRight,
  FileDown,
  FolderSymlink,
  MessageSquare,
  PanelLeft,
} from "lucide-react";
import JSZip from "jszip";
import { exportChatToPdfBlob } from "@/lib/exportChatPdf";

export default function ChatLibrary() {
  const { t, i18n } = useTranslation();
  const convex = useConvex();
  const isMobile = useIsMobile();
  const folders = useQuery(api.chatLibrary.listFolders);
  const sessionCounts = useQuery(api.chatLibrary.getFolderSessionCounts);
  const createFolderMutation = useMutation(api.chatLibrary.createFolder);
  const renameFolderMutation = useMutation(api.chatLibrary.renameFolder);
  const deleteFolderMutation = useMutation(api.chatLibrary.deleteFolder);
  const moveSessionMutation = useMutation(api.chatLibrary.moveSessionToFolder);

  const [selectedFolderId, setSelectedFolderId] = useState<
    Id<"chatFolders"> | "uncategorized"
  >("uncategorized");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [mobileShowContent, setMobileShowContent] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragSessionId, setDragSessionId] = useState<string | null>(null);
  const [bulkExporting, setBulkExporting] = useState(false);

  const queryFolderId = selectedFolderId === "uncategorized" ? undefined : selectedFolderId;
  const { results: folderSessions } = usePaginatedQuery(
    api.chatLibrary.getSessionsByFolder,
    { folderId: queryFolderId },
    { initialNumItems: 100 }
  );

  const folderList = useMemo(() => folders ?? [], [folders]);
  const directCounts = sessionCounts ?? { uncategorized: 0 };
  const counts = useMemo(
    () => buildAggregatedSessionCounts(folderList, directCounts),
    [folderList, directCounts]
  );

  const childFolders = useMemo(() => {
    if (selectedFolderId === "uncategorized") return [];
    return getChildFolders(selectedFolderId, folderList);
  }, [selectedFolderId, folderList]);

  const breadcrumbPath = useMemo(() => {
    const segments = getFolderPath(selectedFolderId, folderList);
    return segments.map((seg) => ({
      ...seg,
      name:
        seg.id === "uncategorized"
          ? t("chatLibrary.uncategorized")
          : seg.name,
    }));
  }, [selectedFolderId, folderList, t]);

  const handleSelectFolder = useCallback(
    (folderId: Id<"chatFolders"> | "uncategorized") => {
      setSelectedFolderId(folderId);
      setSelectedSessionId(null);
      if (isMobile) setMobileShowContent(true);
    },
    [isMobile]
  );

  const handleCreateFolder = useCallback(
    async (name: string, parentId?: Id<"chatFolders">): Promise<Id<"chatFolders"> | null> => {
      try {
        const newId = await createFolderMutation({ name, parentId });
        return newId;
      } catch (error) {
        const message = error instanceof Error ? error.message : t("chatLibrary.folder.createFailed");
        if (message.includes("Maximum folder depth")) {
          toast.error(t("chatLibrary.folder.maxDepth"));
        } else {
          toast.error(message);
        }
        return null;
      }
    },
    [createFolderMutation, t]
  );

  const handleRenameFolder = useCallback(
    async (folderId: Id<"chatFolders">, name: string) => {
      try {
        await renameFolderMutation({ folderId, name });
        toast.success(t("chatLibrary.folder.renamed"));
      } catch {
        toast.error(t("chatLibrary.folder.renameFailed"));
      }
    },
    [renameFolderMutation, t]
  );

  const handleDeleteFolder = useCallback(
    async (folderId: Id<"chatFolders">) => {
      try {
        await deleteFolderMutation({ folderId });
        if (selectedFolderId === folderId) {
          setSelectedFolderId("uncategorized");
        }
        toast.success(t("chatLibrary.folder.deleted"));
      } catch {
        toast.error(t("chatLibrary.folder.deleteFailed"));
      }
    },
    [deleteFolderMutation, selectedFolderId, t]
  );

  const handleMoveSession = useCallback(
    async (sessionId: Id<"chatSessions">, folderId?: Id<"chatFolders">) => {
      try {
        await moveSessionMutation({ sessionId, folderId });
        toast.success(t("chatLibrary.sessions.moved"));
      } catch {
        toast.error(t("chatLibrary.sessions.moveFailed"));
      }
    },
    [moveSessionMutation, t]
  );

  const handleDropOnFolder = useCallback(
    (targetFolderId: Id<"chatFolders"> | "uncategorized") => {
      if (!dragSessionId) return;
      void handleMoveSession(
        dragSessionId as Id<"chatSessions">,
        targetFolderId === "uncategorized" ? undefined : targetFolderId
      );
      setDragSessionId(null);
    },
    [dragSessionId, handleMoveSession]
  );

  const handleBulkExport = async () => {
    if (!folderSessions.length) return;
    setBulkExporting(true);
    try {
      const zip = new JSZip();
      const locale = i18n.language?.startsWith("de") ? "de-DE" : "en-US";
      const labels = {
        exportedOn: t("chatLibrary.export.exportedOn"),
        userLabel: t("chatLibrary.export.userLabel"),
        assistantLabel: t("chatLibrary.export.assistantLabel"),
        attachmentNote: t("chatLibrary.export.attachmentNote"),
        noMessages: t("chatLibrary.export.noMessages"),
        footerNotice: t("chatLibrary.export.footerNotice"),
        personalUseOnly: t("chatLibrary.export.personalUseOnly"),
      };

      for (const session of folderSessions) {
        const messages = await convex.query(api.chat.getMessages, { sessionId: session._id });
        const blob = await exportChatToPdfBlob({
          sessionTitle: session.title,
          messages,
          labels,
          locale,
        });
        const safeName = session.title.replace(/[^\w\s-]/g, "").trim() || "chat";
        zip.file(`${safeName}-${session._id}.pdf`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `chat-library-${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(t("chatLibrary.export.bulkSuccess"));
    } catch (error) {
      console.error("Bulk export failed:", error);
      toast.error(t("chatLibrary.export.bulkFailed"));
    } finally {
      setBulkExporting(false);
    }
  };

  const chatItemCount =
    selectedFolderId === "uncategorized"
      ? directCounts.uncategorized ?? 0
      : directCounts[selectedFolderId as string] ?? 0;

  const itemCount = chatItemCount + childFolders.length;

  const showSidebar = !isMobile || !mobileShowContent;
  const showContent = !isMobile || mobileShowContent;

  return (
    <AnimatedPage className="space-y-4">
      <AnimatedItem>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{t("chatLibrary.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("chatLibrary.subtitleShort")}</p>
          </div>
        </div>
      </AnimatedItem>

      <AnimatedItem>
        <div
          className={cn(
            "flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm",
            isMobile
              ? "min-h-[60vh] max-h-[calc(100vh-8rem)]"
              : "min-h-[min(70vh,720px)] max-h-[calc(100vh-10rem)]"
          )}
        >
          {/* Toolbar – Finder-style */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-muted/20 px-3 py-2 shrink-0">
            {isMobile && mobileShowContent && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setMobileShowContent(false)}
              >
                <ArrowLeft className="h-4 w-4" />
                {t("chatLibrary.tree.backToFolders")}
              </Button>
            )}
            {!isMobile && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setSidebarCollapsed((v) => !v)}
                aria-label={t("chatLibrary.tree.toggleSidebar")}
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            )}

            <Breadcrumb className="min-w-0 flex-1">
              <BreadcrumbList className="flex-nowrap overflow-hidden text-xs sm:text-sm">
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <button
                      type="button"
                      className="truncate max-w-[120px] sm:max-w-none"
                      onClick={() => handleSelectFolder("uncategorized")}
                    >
                      {t("chatLibrary.title")}
                    </button>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {breadcrumbPath.map((seg, index) => (
                  <span key={seg.id as string} className="contents">
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {index === breadcrumbPath.length - 1 ? (
                        <BreadcrumbPage className="truncate max-w-[140px] sm:max-w-[240px]">
                          {seg.name}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <button
                            type="button"
                            className="truncate max-w-[100px] sm:max-w-[180px]"
                            onClick={() =>
                              handleSelectFolder(seg.id as Id<"chatFolders"> | "uncategorized")
                            }
                          >
                            {seg.name}
                          </button>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </span>
                ))}
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              {selectedSessionId && (
                <Button variant="default" size="sm" className="h-8 text-xs" asChild>
                  <Link href={`/chat?session=${selectedSessionId}`}>
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                    {t("chatLibrary.sessions.open")}
                  </Link>
                </Button>
              )}
              {folderSessions.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={bulkExporting}
                  onClick={() => void handleBulkExport()}
                >
                  <FileDown className="h-3.5 w-3.5 mr-1.5" />
                  {bulkExporting ? t("chatLibrary.export.bulkProgress") : t("chatLibrary.export.bulkAction")}
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-1 min-h-0">
            {/* Sidebar tree */}
            {showSidebar && (
              <aside
                className={cn(
                  "shrink-0 border-r border-border/60 bg-muted/15 flex flex-col min-h-0",
                  isMobile ? "w-full" : sidebarCollapsed ? "hidden" : "w-[240px] lg:w-[260px]"
                )}
              >
                <FolderTree
                  folders={folderList}
                  selectedFolderId={selectedFolderId}
                  sessionCounts={counts}
                  onSelectFolder={handleSelectFolder}
                  onCreateFolder={handleCreateFolder}
                  onRenameFolder={handleRenameFolder}
                  onDeleteFolder={handleDeleteFolder}
                  dragOverFolderId={dragOverFolderId}
                  onDragOverFolder={setDragOverFolderId}
                  onDropOnFolder={handleDropOnFolder}
                  compact
                />
              </aside>
            )}

            {/* Content list */}
            {showContent && (
              <section className="flex flex-1 flex-col min-w-0 min-h-0">
                <div className="flex items-center justify-between border-b border-border/40 px-4 py-2 shrink-0 bg-background/80">
                  <p className="text-xs text-muted-foreground">
                    {t("chatLibrary.list.itemCount", { count: itemCount })}
                  </p>
                  <p className="hidden sm:block text-[11px] text-muted-foreground">
                    {t("chatLibrary.list.doubleClickHint")}
                  </p>
                </div>
                {childFolders.length > 0 && (
                  <div className="border-b border-border/40 bg-muted/10 px-4 py-2 shrink-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      {t("chatLibrary.list.subfoldersHeading")}
                    </p>
                    <ul className="space-y-1">
                      {childFolders.map((folder) => {
                        const subCount = directCounts[folder._id as string] ?? 0;
                        return (
                          <li key={folder._id as string}>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60 transition-colors"
                              onDoubleClick={() => handleSelectFolder(folder._id)}
                              onClick={() => handleSelectFolder(folder._id)}
                            >
                              <FolderSymlink className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="truncate flex-1 font-medium">{folder.name}</span>
                              <span className="text-[11px] tabular-nums text-muted-foreground">
                                {t("chatLibrary.list.subfolderChatCount", { count: subCount })}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                <SessionList
                  folderId={selectedFolderId}
                  folders={folderList}
                  onMoveSession={handleMoveSession}
                  dragSessionId={dragSessionId}
                  onDragStartSession={setDragSessionId}
                  selectedSessionId={selectedSessionId}
                  onSelectSession={setSelectedSessionId}
                />
              </section>
            )}

            {/* Mobile: prompt to pick folder when sidebar visible and no drill-down yet */}
            {isMobile && showSidebar && !mobileShowContent && (
              <div className="hidden" aria-hidden />
            )}
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-2 border-t border-border/60 bg-muted/10 px-4 py-1.5 shrink-0">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground truncate">
              {t("chatLibrary.export.snapshotHint")}
            </span>
          </div>
        </div>
      </AnimatedItem>
    </AnimatedPage>
  );
}
