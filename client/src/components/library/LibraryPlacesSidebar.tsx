import { useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, FolderPlus, HardDrive, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FolderTree } from "@/components/chatLibrary/FolderTree";
import { StoragePieInline } from "@/components/library/StoragePieIndicator";
import { buildAggregatedItemCounts, nextDefaultFolderName, type LibraryFolder } from "@/lib/libraryTree";
import { treeRowPaddingLeft } from "@/components/library/libraryTreeLayout";
import { useIsMobile } from "@/hooks/useMobile";
import type { LibrarySection } from "@/components/library/UnifiedLibraryExplorer";

type DriveSectionProps = {
  driveId: LibrarySection;
  label: string;
  expanded: boolean;
  isActive: boolean;
  totalCount: number;
  storagePercent?: number | null;
  storageLabel?: string | null;
  onToggleExpand: () => void;
  onActivate: () => void;
  expandLabel: string;
  collapseLabel: string;
  onNewRootFolder?: () => void;
  children: React.ReactNode;
};

function DriveSection({
  driveId,
  label,
  expanded,
  isActive,
  totalCount,
  storagePercent,
  storageLabel,
  onToggleExpand,
  onActivate,
  expandLabel,
  collapseLabel,
  onNewRootFolder,
  children,
}: DriveSectionProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  return (
    <div
      role="treeitem"
      aria-expanded={expanded}
      data-drive={driveId}
      className={cn(
        "rounded-lg border border-border/60 bg-background transition-colors duration-200",
        !isActive && "opacity-90"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-0.5 pr-1 text-[13px] transition-colors duration-200 select-none border-b border-border/40",
          isMobile ? "py-1.5" : "py-1",
          isActive ? "library-accent-bg" : "hover:bg-muted/40"
        )}
        style={{ paddingLeft: `${treeRowPaddingLeft(0)}px` }}
      >
        <button
          type="button"
          className="shrink-0 flex h-5 w-5 items-center justify-center rounded-sm hover:bg-muted/80"
          onClick={(e) => {
            e.stopPropagation();
            if (expanded) {
              onToggleExpand();
            } else {
              onActivate();
            }
          }}
          aria-label={expanded ? collapseLabel : expandLabel}
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ease-out",
              expanded && "rotate-90"
            )}
          />
        </button>

        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 py-0.5 pl-0.5 text-left"
          onClick={onActivate}
        >
          <span
            className={cn(
              "w-0.5 self-stretch rounded-full shrink-0 my-0.5",
              isActive ? "library-accent-bar" : "bg-transparent"
            )}
            aria-hidden
          />
          <HardDrive
            className={cn(
              "h-4 w-4 shrink-0",
              isActive ? "text-serbian-blue" : "text-muted-foreground"
            )}
          />
          <span
            className={cn(
              "truncate min-w-0",
              isActive ? "font-semibold text-foreground" : "text-muted-foreground"
            )}
          >
            {label}
          </span>
          {storagePercent !== undefined && storageLabel && (
            <span className="hidden lg:inline-flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground tabular-nums">
              <StoragePieInline percentUsed={storagePercent ?? null} />
              <span className="truncate max-w-[88px]">{storageLabel}</span>
            </span>
          )}
        </button>

        {onNewRootFolder && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "shrink-0 h-7 w-7 text-muted-foreground hover:text-foreground",
                  isMobile && "h-8 w-8"
                )}
                onClick={(e) => e.stopPropagation()}
                aria-label={t("chatLibrary.folder.new")}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onNewRootFolder();
                }}
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                {t("chatLibrary.folder.new")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <span
          className={cn(
            "shrink-0 text-[11px] tabular-nums pr-2",
            isActive ? "text-foreground/70" : "text-muted-foreground"
          )}
        >
          {totalCount}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key={`${driveId}-tree`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={cn("overflow-hidden min-w-0", !isActive && "opacity-60")}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type LibraryPlacesSidebarProps = {
  activeSection: LibrarySection;
  expandedDrives: Record<LibrarySection, boolean>;
  onToggleDrive: (section: LibrarySection) => void;
  onActivateDrive: (section: LibrarySection) => void;
  chatFolders: LibraryFolder[];
  docFolders: LibraryFolder[];
  chatCounts: Record<string, number>;
  docCounts: Record<string, number>;
  selectedChatFolderId: string | "uncategorized";
  selectedDocFolderId: string | "uncategorized";
  onSelectChatFolder: (folderId: string | "uncategorized") => void;
  onSelectDocFolder: (folderId: string | "uncategorized") => void;
  onCreateChatFolder: (name: string, parentId?: string) => Promise<string | null>;
  onCreateDocFolder: (name: string, parentId?: string) => Promise<string | null>;
  onRenameChatFolder: (folderId: string, name: string) => Promise<void>;
  onRenameDocFolder: (folderId: string, name: string) => Promise<void>;
  onDeleteChatFolder: (folderId: string) => Promise<void>;
  onDeleteDocFolder: (folderId: string) => Promise<void>;
  dragOverChatFolderId: string | null;
  dragOverDocFolderId: string | null;
  onDragOverChatFolder: (folderId: string | null) => void;
  onDragOverDocFolder: (folderId: string | null) => void;
  onDropOnChatFolder: (folderId: string | "uncategorized") => void;
  onDropOnDocFolder: (folderId: string | "uncategorized") => void;
  showKnowledgeBase: boolean;
  storagePercent?: number | null;
  storageCompactLabel?: string | null;
  onExportChatFolder?: (folderId: string | "uncategorized") => void;
  exportingChatFolderId?: string | null;
};

export function LibraryPlacesSidebar({
  activeSection,
  expandedDrives,
  onToggleDrive,
  onActivateDrive,
  chatFolders,
  docFolders,
  chatCounts,
  docCounts,
  selectedChatFolderId,
  selectedDocFolderId,
  onSelectChatFolder,
  onSelectDocFolder,
  onCreateChatFolder,
  onCreateDocFolder,
  onRenameChatFolder,
  onRenameDocFolder,
  onDeleteChatFolder,
  onDeleteDocFolder,
  dragOverChatFolderId,
  dragOverDocFolderId,
  onDragOverChatFolder,
  onDragOverDocFolder,
  onDropOnChatFolder,
  onDropOnDocFolder,
  showKnowledgeBase,
  storagePercent,
  storageCompactLabel,
  onExportChatFolder,
  exportingChatFolderId,
}: LibraryPlacesSidebarProps) {
  const { t } = useTranslation();
  const expandLabel = t("chatLibrary.tree.expand");
  const collapseLabel = t("chatLibrary.tree.collapse");
  const [chatForcedRenamingId, setChatForcedRenamingId] = useState<string | null>(null);
  const [docForcedRenamingId, setDocForcedRenamingId] = useState<string | null>(null);

  const handleCreateChatRootFolder = useCallback(async () => {
    onActivateDrive("chats");
    if (!expandedDrives.chats) {
      onToggleDrive("chats");
    }
    const name = nextDefaultFolderName(chatFolders, undefined, {
      main: t("chatLibrary.folder.defaultFolderName"),
      sub: t("chatLibrary.folder.defaultSubfolderName"),
    });
    const newId = await onCreateChatFolder(name);
    if (newId) {
      setChatForcedRenamingId(newId);
    }
  }, [
    chatFolders,
    expandedDrives.chats,
    onActivateDrive,
    onCreateChatFolder,
    onToggleDrive,
    t,
  ]);

  const handleCreateDocRootFolder = useCallback(async () => {
    onActivateDrive("documents");
    if (!expandedDrives.documents) {
      onToggleDrive("documents");
    }
    const name = nextDefaultFolderName(docFolders, undefined, {
      main: t("chatLibrary.folder.defaultFolderName"),
      sub: t("chatLibrary.folder.defaultSubfolderName"),
    });
    const newId = await onCreateDocFolder(name);
    if (newId) {
      setDocForcedRenamingId(newId);
    }
  }, [
    docFolders,
    expandedDrives.documents,
    onActivateDrive,
    onCreateDocFolder,
    onToggleDrive,
    t,
  ]);

  const chatAggregated = useMemo(
    () => buildAggregatedItemCounts(chatFolders, chatCounts),
    [chatFolders, chatCounts]
  );
  const docAggregated = useMemo(
    () => buildAggregatedItemCounts(docFolders, docCounts),
    [docFolders, docCounts]
  );

  const chatTotal = useMemo(() => {
    return Object.values(chatCounts).reduce((sum, n) => sum + n, 0);
  }, [chatCounts]);

  const docTotal = useMemo(() => {
    return Object.values(docCounts).reduce((sum, n) => sum + n, 0);
  }, [docCounts]);

  const chatSectionActive = activeSection === "chats";
  const docSectionActive = activeSection === "documents";

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="px-2 pt-3 pb-2 shrink-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("chatLibrary.tree.locations")}
        </p>
      </div>

      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]]:pr-2">
        <div role="tree" aria-label={t("myLibrary.title")} className="space-y-2 px-2 pb-3 pt-0.5 min-w-0">
          <DriveSection
            driveId="chats"
            label={t("myLibrary.chatArchive.title")}
            expanded={expandedDrives.chats}
            isActive={chatSectionActive}
            totalCount={chatTotal}
            onToggleExpand={() => onToggleDrive("chats")}
            onActivate={() => onActivateDrive("chats")}
            expandLabel={expandLabel}
            collapseLabel={collapseLabel}
            onNewRootFolder={() => void handleCreateChatRootFolder()}
          >
            <FolderTree
              embedded
              compact
              sectionActive={chatSectionActive}
              forcedRenamingFolderId={chatForcedRenamingId}
              folders={chatFolders}
              selectedFolderId={selectedChatFolderId}
              itemCounts={chatAggregated}
              directItemCounts={chatCounts}
              onSelectFolder={onSelectChatFolder}
              onCreateFolder={onCreateChatFolder}
              onRenameFolder={onRenameChatFolder}
              onDeleteFolder={onDeleteChatFolder}
              dragOverFolderId={dragOverChatFolderId}
              onDragOverFolder={onDragOverChatFolder}
              onDropOnFolder={onDropOnChatFolder}
              onExportFolder={onExportChatFolder}
              exportingFolderId={exportingChatFolderId}
              archiveEntry={{
                label: t("chatLibrary.archive.folderName"),
                count: chatCounts.__archived__ ?? 0,
                id: "__archived__",
              }}
            />
          </DriveSection>

          {showKnowledgeBase && (
            <DriveSection
              driveId="documents"
              label={t("myLibrary.knowledgeBase.title")}
              expanded={expandedDrives.documents}
              isActive={docSectionActive}
              totalCount={docTotal}
              storagePercent={storagePercent}
              storageLabel={storageCompactLabel}
              onToggleExpand={() => onToggleDrive("documents")}
              onActivate={() => onActivateDrive("documents")}
              expandLabel={expandLabel}
              collapseLabel={collapseLabel}
              onNewRootFolder={() => void handleCreateDocRootFolder()}
            >
              <FolderTree
                embedded
                compact
                sectionActive={docSectionActive}
                forcedRenamingFolderId={docForcedRenamingId}
                folders={docFolders}
                selectedFolderId={selectedDocFolderId}
                itemCounts={docAggregated}
                directItemCounts={docCounts}
                onSelectFolder={onSelectDocFolder}
                onCreateFolder={onCreateDocFolder}
                onRenameFolder={onRenameDocFolder}
                onDeleteFolder={onDeleteDocFolder}
                dragOverFolderId={dragOverDocFolderId}
                onDragOverFolder={onDragOverDocFolder}
                onDropOnFolder={onDropOnDocFolder}
              />
            </DriveSection>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
