import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useConvex } from "convex/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Link, useLocation, useSearch } from "wouter";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { AnimatedPage, AnimatedItem } from "@/components/AnimatedPage";
import { SessionList } from "@/components/chatLibrary/SessionList";
import {
  DocumentList,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
} from "@/components/library/DocumentList";
import { LibraryPlacesSidebar } from "@/components/library/LibraryPlacesSidebar";
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
import {
  getChildFolders,
  getFolderPath,
  type LibraryFolder,
} from "@/lib/libraryTree";
import { useFeatureAccess, canUseKnowledgeRack } from "@/hooks/useFeatureAccess";
import { useIsMobile } from "@/hooks/useMobile";
import {
  ArrowLeft,
  ChevronRight,
  FolderSymlink,
  Loader2,
  MessageSquare,
  PanelLeft,
  Upload,
} from "lucide-react";
import JSZip from "jszip";
import { exportChatToPdfBlob } from "@/lib/exportChatPdf";

export type LibrarySection = "chats" | "documents";

export const LIBRARY_UPLOAD_INPUT_ID = "library-knowledge-upload";

type UnifiedLibraryExplorerProps = {
  openUploadOnMount?: boolean;
};

function parseSectionFromSearch(
  searchString: string,
  showKnowledgeBase: boolean
): LibrarySection {
  const params = new URLSearchParams(searchString);
  const section = params.get("section");
  if (section === "documents" && showKnowledgeBase) return "documents";
  return "chats";
}

export function UnifiedLibraryExplorer({
  openUploadOnMount = false,
}: UnifiedLibraryExplorerProps) {
  const { t, i18n } = useTranslation();
  const convex = useConvex();
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const featureAccess = useFeatureAccess();
  const showKnowledgeBase = canUseKnowledgeRack(featureAccess);

  const activeSection = useMemo(
    () => parseSectionFromSearch(searchString, showKnowledgeBase),
    [searchString, showKnowledgeBase]
  );

  const setActiveSection = useCallback(
    (section: LibrarySection) => {
      if (section === "documents" && !showKnowledgeBase) return;
      const params = new URLSearchParams(searchString);
      params.set("section", section);
      params.delete("upload");
      setLocation(`/library?${params.toString()}`);
      setExpandedDrives((prev) => ({ ...prev, [section]: true }));
    },
    [searchString, setLocation, showKnowledgeBase]
  );

  const activateDrive = useCallback(
    (section: LibrarySection) => {
      setActiveSection(section);
      setExpandedDrives((prev) => ({ ...prev, [section]: true }));
      if (section === "chats") {
        setSelectedChatFolderId("uncategorized");
        setSelectedSessionId(null);
      } else {
        setSelectedDocFolderId("uncategorized");
        setSelectedDocumentId(null);
      }
      if (isMobile) setMobileShowContent(true);
    },
    [setActiveSection, isMobile]
  );

  const toggleDrive = useCallback((section: LibrarySection) => {
    setExpandedDrives((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const chatFoldersRaw = useQuery(api.chatLibrary.listFolders);
  const chatSessionCounts = useQuery(api.chatLibrary.getFolderSessionCounts);
  const docFoldersRaw = useQuery(
    api.documents.listDocumentFolders,
    showKnowledgeBase ? {} : "skip"
  );
  const docCounts = useQuery(
    api.documents.getDocumentFolderCounts,
    showKnowledgeBase ? {} : "skip"
  );
  const storageUsage = useQuery(
    api.documents.getUserStorageUsage,
    showKnowledgeBase ? {} : "skip"
  );

  const createChatFolder = useMutation(api.chatLibrary.createFolder);
  const renameChatFolder = useMutation(api.chatLibrary.renameFolder);
  const deleteChatFolder = useMutation(api.chatLibrary.deleteFolder);
  const moveSessionMutation = useMutation(api.chatLibrary.moveSessionToFolder);

  const createDocFolder = useMutation(api.documents.createDocumentFolder);
  const renameDocFolder = useMutation(api.documents.renameDocumentFolder);
  const deleteDocFolder = useMutation(api.documents.deleteDocumentFolder);
  const updateDocumentMeta = useMutation(api.documents.updateDocumentMeta);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const createDocument = useMutation(api.documents.createDocument);

  const [selectedChatFolderId, setSelectedChatFolderId] = useState<
    Id<"chatFolders"> | "uncategorized" | "__archived__"
  >("uncategorized");
  const [selectedDocFolderId, setSelectedDocFolderId] = useState<
    Id<"documentFolders"> | "uncategorized"
  >("uncategorized");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [mobileShowContent, setMobileShowContent] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedDrives, setExpandedDrives] = useState<Record<LibrarySection, boolean>>({
    chats: true,
    documents: false,
  });
  const [dragOverChatFolderId, setDragOverChatFolderId] = useState<string | null>(null);
  const [dragOverDocFolderId, setDragOverDocFolderId] = useState<string | null>(null);
  const [dragSessionId, setDragSessionId] = useState<string | null>(null);
  const [dragDocumentId, setDragDocumentId] = useState<string | null>(null);
  const [exportingFolderId, setExportingFolderId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatFolderList = useMemo(
    () => (chatFoldersRaw ?? []) as LibraryFolder[],
    [chatFoldersRaw]
  );
  const docFolderList = useMemo(
    () => (docFoldersRaw ?? []) as LibraryFolder[],
    [docFoldersRaw]
  );

  const folderList = activeSection === "chats" ? chatFolderList : docFolderList;
  const selectedFolderId =
    activeSection === "chats" ? selectedChatFolderId : selectedDocFolderId;

  const directChatCounts = chatSessionCounts ?? { uncategorized: 0 };
  const directDocCounts = docCounts ?? { uncategorized: 0 };
  useEffect(() => {
    setExpandedDrives((prev) => ({ ...prev, [activeSection]: true }));
  }, [activeSection]);

  const directCounts = activeSection === "chats" ? directChatCounts : directDocCounts;
  const sectionLabel =
    activeSection === "chats"
      ? t("myLibrary.chatArchive.title")
      : t("myLibrary.knowledgeBase.title");

  const childFolders = useMemo(() => {
    if (selectedFolderId === "uncategorized" || selectedFolderId === "__archived__") return [];
    return getChildFolders(selectedFolderId as string, folderList);
  }, [selectedFolderId, folderList]);

  const breadcrumbPath = useMemo(() => {
    if (selectedFolderId === "__archived__") {
      return [{ id: "__archived__", name: t("chatLibrary.archive.folderName") }];
    }
    const segments = getFolderPath(selectedFolderId as string, folderList);
    return segments.map((seg) => ({
      ...seg,
      name:
        seg.id === "uncategorized"
          ? t("chatLibrary.uncategorized")
          : seg.name,
    }));
  }, [selectedFolderId, folderList, t]);

  const handleSelectChatFolder = useCallback(
    (folderId: string | "uncategorized" | "__archived__") => {
      setActiveSection("chats");
      setSelectedChatFolderId(folderId as Id<"chatFolders"> | "uncategorized" | "__archived__");
      setSelectedSessionId(null);
      if (isMobile) setMobileShowContent(true);
    },
    [setActiveSection, isMobile]
  );

  const handleSelectDocFolder = useCallback(
    (folderId: string | "uncategorized") => {
      setActiveSection("documents");
      setSelectedDocFolderId(folderId as Id<"documentFolders"> | "uncategorized");
      setSelectedDocumentId(null);
      if (isMobile) setMobileShowContent(true);
    },
    [setActiveSection, isMobile]
  );

  const handleCreateChatFolder = useCallback(
    async (name: string, parentId?: string): Promise<string | null> => {
      try {
        const newId = await createChatFolder({
          name,
          parentId: parentId as Id<"chatFolders"> | undefined,
        });
        return newId as string;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t("chatLibrary.folder.createFailed");
        if (message.includes("Maximum folder depth")) {
          toast.error(t("chatLibrary.folder.maxDepth"));
        } else {
          toast.error(message);
        }
        return null;
      }
    },
    [createChatFolder, t]
  );

  const handleCreateDocFolder = useCallback(
    async (name: string, parentId?: string): Promise<string | null> => {
      try {
        const newId = await createDocFolder({
          name,
          parentId: parentId as Id<"documentFolders"> | undefined,
        });
        return newId as string;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t("chatLibrary.folder.createFailed");
        toast.error(message);
        return null;
      }
    },
    [createDocFolder, t]
  );

  const handleRenameChatFolder = useCallback(
    async (folderId: string, name: string) => {
      try {
        await renameChatFolder({
          folderId: folderId as Id<"chatFolders">,
          name,
        });
        toast.success(t("chatLibrary.folder.renamed"));
      } catch {
        toast.error(t("chatLibrary.folder.renameFailed"));
      }
    },
    [renameChatFolder, t]
  );

  const handleRenameDocFolder = useCallback(
    async (folderId: string, name: string) => {
      try {
        await renameDocFolder({
          folderId: folderId as Id<"documentFolders">,
          name,
        });
        toast.success(t("chatLibrary.folder.renamed"));
      } catch {
        toast.error(t("chatLibrary.folder.renameFailed"));
      }
    },
    [renameDocFolder, t]
  );

  const handleDeleteChatFolder = useCallback(
    async (folderId: string) => {
      try {
        await deleteChatFolder({ folderId: folderId as Id<"chatFolders"> });
        if (selectedChatFolderId === folderId) {
          setSelectedChatFolderId("uncategorized");
        }
        toast.success(t("chatLibrary.folder.deleted"));
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.includes("FOLDER_NOT_EMPTY") || message.includes("FOLDER_HAS_SUBFOLDERS")) {
          toast.error(t("chatLibrary.folder.deleteBlocked"));
        } else {
          toast.error(t("chatLibrary.folder.deleteFailed"));
        }
      }
    },
    [deleteChatFolder, selectedChatFolderId, t]
  );

  const handleDeleteDocFolder = useCallback(
    async (folderId: string) => {
      try {
        await deleteDocFolder({ folderId: folderId as Id<"documentFolders"> });
        if (selectedDocFolderId === folderId) {
          setSelectedDocFolderId("uncategorized");
        }
        toast.success(t("chatLibrary.folder.deleted"));
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.includes("FOLDER_NOT_EMPTY") || message.includes("FOLDER_HAS_SUBFOLDERS")) {
          toast.error(t("chatLibrary.folder.deleteBlocked"));
        } else {
          toast.error(t("chatLibrary.folder.deleteFailed"));
        }
      }
    },
    [deleteDocFolder, selectedDocFolderId, t]
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

  const handleMoveDocument = useCallback(
    async (documentId: Id<"userDocuments">, folderId?: Id<"documentFolders">) => {
      try {
        await updateDocumentMeta({
          documentId,
          folderId: folderId ?? null,
        });
        toast.success(t("knowledgeBase.move.success"));
      } catch {
        toast.error(t("knowledgeBase.move.failed"));
      }
    },
    [updateDocumentMeta, t]
  );

  const handleDropOnChatFolder = useCallback(
    (targetFolderId: string | "uncategorized") => {
      if (!dragSessionId) return;
      void handleMoveSession(
        dragSessionId as Id<"chatSessions">,
        targetFolderId === "uncategorized"
          ? undefined
          : (targetFolderId as Id<"chatFolders">)
      );
      setDragSessionId(null);
    },
    [dragSessionId, handleMoveSession]
  );

  const handleDropOnDocFolder = useCallback(
    (targetFolderId: string | "uncategorized") => {
      if (!dragDocumentId) return;
      void handleMoveDocument(
        dragDocumentId as Id<"userDocuments">,
        targetFolderId === "uncategorized"
          ? undefined
          : (targetFolderId as Id<"documentFolders">)
      );
      setDragDocumentId(null);
    },
    [dragDocumentId, handleMoveDocument]
  );

  const handleSelectFolder = useCallback(
    (folderId: string | "uncategorized") => {
      if (activeSection === "chats") {
        handleSelectChatFolder(folderId);
      } else {
        handleSelectDocFolder(folderId);
      }
    },
    [activeSection, handleSelectChatFolder, handleSelectDocFolder]
  );

  const exportChatFolderAsZip = useCallback(
    async (folderId: string | "uncategorized") => {
      setExportingFolderId(folderId);
      try {
        const queryFolderId =
          folderId === "uncategorized"
            ? undefined
            : (folderId as Id<"chatFolders">);
        const allSessions: Array<{ _id: Id<"chatSessions">; title: string }> = [];
        let cursor: string | null = null;
        let isDone = false;

        while (!isDone) {
          const page: {
            page: Array<{ _id: Id<"chatSessions">; title: string }>;
            isDone: boolean;
            continueCursor: string | null;
          } = await convex.query(api.chatLibrary.getSessionsByFolder, {
            folderId: queryFolderId,
            paginationOpts: { numItems: 100, cursor },
          }) as {
            page: Array<{ _id: Id<"chatSessions">; title: string }>;
            isDone: boolean;
            continueCursor: string | null;
          };
          allSessions.push(...page.page);
          isDone = page.isDone;
          cursor = page.continueCursor;
        }

        if (!allSessions.length) {
          toast.error(t("chatLibrary.export.folderEmpty"));
          return;
        }

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

        for (const session of allSessions) {
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

        const folderLabel =
          folderId === "uncategorized"
            ? t("chatLibrary.uncategorized")
            : chatFolderList.find((f) => f._id === folderId)?.name ?? "folder";
        const safeFolderName =
          folderLabel.replace(/[^\w\s-]/g, "").trim() || "folder";

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${safeFolderName}-${new Date().toISOString().slice(0, 10)}.zip`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success(t("chatLibrary.export.bulkSuccess"));
      } catch (error) {
        console.error("Folder export failed:", error);
        toast.error(t("chatLibrary.export.bulkFailed"));
      } finally {
        setExportingFolderId(null);
      }
    },
    [chatFolderList, convex, i18n.language, t]
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error(t("knowledgeBase.upload.unsupported"));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t("knowledgeBase.upload.tooLarge"));
      return;
    }

    setIsUploading(true);
    try {
      const uploadUrl = await generateUploadUrl({
        fileBytes: file.size,
        fileType: file.type || "application/octet-stream",
        uploadSource: "knowledge_rack",
      });
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error("Upload failed");
      const { storageId } = await uploadResponse.json();

      const folderId =
        selectedDocFolderId === "uncategorized"
          ? undefined
          : selectedDocFolderId;

      await createDocument({
        storageId,
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSizeBytes: file.size,
        folderId,
      });

      toast.success(t("knowledgeBase.upload.success"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("knowledgeBase.upload.failed"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const percentUsed = storageUsage?.percentUsed ?? null;
  const uploadDisabled = isUploading || (percentUsed !== null && percentUsed >= 100);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const shouldUpload = openUploadOnMount || params.get("upload") === "1";
    if (shouldUpload && showKnowledgeBase && activeSection === "documents" && !uploadDisabled) {
      document.getElementById(LIBRARY_UPLOAD_INPUT_ID)?.click();
      params.delete("upload");
      const next = params.toString();
      setLocation(next ? `/library?${next}` : "/library?section=documents");
    }
  }, [openUploadOnMount, searchString, showKnowledgeBase, activeSection, setLocation, uploadDisabled]);

  const triggerUploadPicker = useCallback(() => {
    if (uploadDisabled) {
      if (percentUsed !== null && percentUsed >= 100) {
        toast.error(t("myLibrary.storage.almostFull"));
      }
      return;
    }
    document.getElementById(LIBRARY_UPLOAD_INPUT_ID)?.click();
  }, [uploadDisabled, percentUsed, t]);

  const storageCompactLabel =
    storageUsage?.quotaBytes != null
      ? `${storageUsage.usedFormatted} / ${storageUsage.quotaFormatted}`
      : null;

  const chatItemCount =
    selectedChatFolderId === "uncategorized"
      ? directChatCounts.uncategorized ?? 0
      : selectedChatFolderId === "__archived__"
        ? directChatCounts.__archived__ ?? 0
        : directChatCounts[selectedChatFolderId as string] ?? 0;

  const docItemCount =
    selectedDocFolderId === "uncategorized"
      ? directDocCounts.uncategorized ?? 0
      : directDocCounts[selectedDocFolderId as string] ?? 0;

  const itemCount =
    (activeSection === "chats" ? chatItemCount : docItemCount) + childFolders.length;

  const showSidebar = !isMobile || !mobileShowContent;
  const showContent = !isMobile || mobileShowContent;

  const subfolderCountKey =
    activeSection === "chats"
      ? "chatLibrary.list.subfolderChatCount"
      : "knowledgeBase.list.subfolderDocCount";

  return (
    <AnimatedPage className="space-y-4">
      <AnimatedItem>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{t("myLibrary.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("myLibrary.explorerSubtitle")}</p>
          </div>
        </div>
      </AnimatedItem>

      <AnimatedItem>
        <input
          id={LIBRARY_UPLOAD_INPUT_ID}
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(",")}
          className="sr-only"
          onChange={handleUpload}
        />

        <div
          className={cn(
            "flex flex-col rounded-xl border bg-card shadow-sm",
            isMobile
              ? "min-h-[60vh] max-h-[calc(100vh-8rem)]"
              : "min-h-[min(70vh,720px)] max-h-[calc(100vh-10rem)]"
          )}
        >
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
                  <BreadcrumbPage className="truncate font-medium">
                    {t("myLibrary.title")}
                  </BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="truncate">{sectionLabel}</BreadcrumbPage>
                </BreadcrumbItem>
                {breadcrumbPath
                  .filter((seg) => seg.id !== "uncategorized")
                  .map((seg, index, arr) => (
                    <span key={seg.id as string} className="contents">
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        {index === arr.length - 1 ? (
                          <BreadcrumbPage className="truncate max-w-[140px] sm:max-w-[240px]">
                            {seg.name}
                          </BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <button
                              type="button"
                              className="truncate max-w-[100px] sm:max-w-[180px]"
                              onClick={() => handleSelectFolder(seg.id as string)}
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
              {activeSection === "chats" && selectedSessionId && (
                <Button variant="default" size="sm" className="h-8 text-xs" asChild>
                  <Link href={`/chat?session=${selectedSessionId}`}>
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                    {t("chatLibrary.sessions.open")}
                  </Link>
                </Button>
              )}
              {activeSection === "documents" && showKnowledgeBase && (
                uploadDisabled || isUploading ? (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 text-xs bg-serbian-blue hover:opacity-90 text-white border-0"
                    disabled={isUploading}
                    onClick={triggerUploadPicker}
                  >
                    {isUploading ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {t("myLibrary.uploadFile")}
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 text-xs bg-serbian-blue hover:opacity-90 text-white border-0"
                    asChild
                  >
                    <label
                      htmlFor={LIBRARY_UPLOAD_INPUT_ID}
                      className="inline-flex items-center cursor-pointer"
                    >
                      {isUploading ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {t("myLibrary.uploadFile")}
                    </label>
                  </Button>
                )
              )}
            </div>
          </div>

          <div className="flex flex-1 min-h-0 overflow-hidden">
            {showSidebar && (
              <aside
                className={cn(
                  "relative z-[1] shrink-0 border-r border-border/60 bg-muted/15 flex flex-col min-h-0 min-w-0 overflow-hidden",
                  isMobile ? "w-full" : sidebarCollapsed ? "hidden" : "w-[280px] lg:w-[304px]"
                )}
              >
                <LibraryPlacesSidebar
                  activeSection={activeSection}
                  expandedDrives={expandedDrives}
                  onToggleDrive={toggleDrive}
                  onActivateDrive={activateDrive}
                  chatFolders={chatFolderList}
                  docFolders={docFolderList}
                  chatCounts={directChatCounts}
                  docCounts={directDocCounts}
                  selectedChatFolderId={selectedChatFolderId}
                  selectedDocFolderId={selectedDocFolderId}
                  onSelectChatFolder={handleSelectChatFolder}
                  onSelectDocFolder={handleSelectDocFolder}
                  onCreateChatFolder={handleCreateChatFolder}
                  onCreateDocFolder={handleCreateDocFolder}
                  onRenameChatFolder={handleRenameChatFolder}
                  onRenameDocFolder={handleRenameDocFolder}
                  onDeleteChatFolder={handleDeleteChatFolder}
                  onDeleteDocFolder={handleDeleteDocFolder}
                  dragOverChatFolderId={dragOverChatFolderId}
                  dragOverDocFolderId={dragOverDocFolderId}
                  onDragOverChatFolder={setDragOverChatFolderId}
                  onDragOverDocFolder={setDragOverDocFolderId}
                  onDropOnChatFolder={handleDropOnChatFolder}
                  onDropOnDocFolder={handleDropOnDocFolder}
                  showKnowledgeBase={showKnowledgeBase}
                  storagePercent={percentUsed}
                  storageCompactLabel={storageCompactLabel}
                  onExportChatFolder={(folderId) => void exportChatFolderAsZip(folderId)}
                  exportingChatFolderId={exportingFolderId}
                />
              </aside>
            )}

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
                        const subCount = directCounts[folder._id] ?? 0;
                        return (
                          <li key={folder._id}>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60 transition-colors"
                              onDoubleClick={() => handleSelectFolder(folder._id)}
                              onClick={() => handleSelectFolder(folder._id)}
                            >
                              <FolderSymlink className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="truncate flex-1 font-medium">{folder.name}</span>
                              <span className="text-[11px] tabular-nums text-muted-foreground">
                                {t(subfolderCountKey, { count: subCount })}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {activeSection === "chats" ? (
                  <SessionList
                    folderId={selectedChatFolderId}
                    folders={chatFolderList}
                    onMoveSession={handleMoveSession}
                    dragSessionId={dragSessionId}
                    onDragStartSession={setDragSessionId}
                    selectedSessionId={selectedSessionId}
                    onSelectSession={setSelectedSessionId}
                  />
                ) : (
                  <DocumentList
                    folderId={selectedDocFolderId}
                    folders={docFolderList}
                    onMoveDocument={handleMoveDocument}
                    dragDocumentId={dragDocumentId}
                    onDragStartDocument={setDragDocumentId}
                    selectedDocumentId={selectedDocumentId}
                    onSelectDocument={setSelectedDocumentId}
                    uploadDisabled={uploadDisabled}
                    uploadInputId={LIBRARY_UPLOAD_INPUT_ID}
                    onUploadClick={triggerUploadPicker}
                    isUploading={isUploading}
                  />
                )}
              </section>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-border/60 bg-muted/10 px-4 py-1.5 shrink-0">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground truncate">
              {activeSection === "chats"
                ? t("chatLibrary.export.snapshotHint")
                : t("knowledgeBase.statusBarHint")}
            </span>
          </div>
        </div>
      </AnimatedItem>
    </AnimatedPage>
  );
}
