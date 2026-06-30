import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderSymlink,
  Inbox,
  Pencil,
  Trash2,
  MoreHorizontal,
  FileDown,
  Loader2,
  Archive,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/useMobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  buildFolderTree,
  canDeleteFolder,
  isRootFolder,
  nextDefaultFolderName,
  type FolderTreeNode,
  type LibraryFolder,
} from "@/lib/libraryTree";
import { LibraryTreeRow, LibraryTreeSectionLabel } from "@/components/library/LibraryTreeRow";

export type { LibraryFolder as ChatFolder };

type FolderTreeProps = {
  folders: LibraryFolder[];
  selectedFolderId: string | "uncategorized";
  itemCounts: Record<string, number>;
  /** Direct item counts per folder (for delete eligibility). Falls back to itemCounts when omitted. */
  directItemCounts?: Record<string, number>;
  onSelectFolder: (folderId: string | "uncategorized") => void;
  onCreateFolder: (name: string, parentId?: string) => Promise<string | null>;
  onRenameFolder: (folderId: string, name: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  dragOverFolderId: string | null;
  onDragOverFolder: (folderId: string | null) => void;
  onDropOnFolder: (folderId: string | "uncategorized") => void;
  compact?: boolean;
  /** Hide the "Places" section header – used when nested under a drive in the library sidebar. */
  embedded?: boolean;
  /** When false, folder selection styling is hidden (inactive drive in library sidebar). */
  sectionActive?: boolean;
  /** Externally trigger inline-rename for a newly created folder (e.g. from drive context menu). */
  forcedRenamingFolderId?: string | null;
  /** Chat archive only: export all sessions in a folder as ZIP. */
  onExportFolder?: (folderId: string | "uncategorized") => void;
  /** Folder id currently being exported (shows spinner in context menu). */
  exportingFolderId?: string | null;
  /** Virtual "Archive" entry below the folder tree. */
  archiveEntry?: {
    label: string;
    count: number;
    id: string;
  };
};

function FolderRow({
  node,
  depth,
  selectedFolderId,
  itemCounts,
  onSelectFolder,
  onRenameFolder,
  onDeleteFolder,
  onCreateSubfolder,
  dragOverFolderId,
  onDragOverFolder,
  onDropOnFolder,
  renamingFolderId,
  onSetRenamingFolderId,
  isMobile,
  sectionActive,
  folders,
  directItemCounts,
  onExportFolder,
  exportingFolderId,
}: {
  node: FolderTreeNode;
  depth: number;
  selectedFolderId: string | "uncategorized";
  itemCounts: Record<string, number>;
  onSelectFolder: (folderId: string | "uncategorized") => void;
  onRenameFolder: (folderId: string, name: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onCreateSubfolder: (parentId: string) => void;
  dragOverFolderId: string | null;
  onDragOverFolder: (folderId: string | null) => void;
  onDropOnFolder: (folderId: string | "uncategorized") => void;
  renamingFolderId: string | null;
  onSetRenamingFolderId: (id: string | null) => void;
  isMobile: boolean;
  sectionActive: boolean;
  folders: LibraryFolder[];
  directItemCounts: Record<string, number>;
  onExportFolder?: (folderId: string | "uncategorized") => void;
  exportingFolderId?: string | null;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const idStr = node._id;
  const isSelected = sectionActive && selectedFolderId === node._id;
  const count = itemCounts[idStr] ?? 0;
  const deletable = canDeleteFolder(idStr, folders, directItemCounts);
  const directCount = directItemCounts[idStr] ?? 0;
  const canExport = Boolean(onExportFolder) && directCount > 0;
  const isExporting = exportingFolderId === idStr;
  const isDragOver = dragOverFolderId === idStr;
  const hasChildren = node.children.length > 0;
  const isMainFolder = isRootFolder(node);
  const isRenaming = renamingFolderId === idStr;
  const [renameValue, setRenameValue] = useState(node.name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(node.name);
      requestAnimationFrame(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      });
    }
  }, [isRenaming, node.name]);

  const saveRename = async () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== node.name) {
      await onRenameFolder(node._id, trimmed);
    }
    onSetRenamingFolderId(null);
  };

  return (
    <div role="treeitem" aria-expanded={hasChildren ? expanded : undefined}>
      <LibraryTreeRow
        depth={depth}
        isMobile={isMobile}
        rowClassName={cn(
          isSelected
            ? "library-accent-bg text-serbian-blue font-medium"
            : "text-foreground/90 hover:bg-muted/70",
          isDragOver &&
            "ring-2 library-accent-ring ring-inset bg-[color-mix(in_oklch,var(--serbian-blue-from)_5%,transparent)]"
        )}
        chevronHidden={!hasChildren}
        chevron={
          <button
            type="button"
            className="flex h-5 w-5 items-center justify-center rounded-sm hover:bg-muted/80"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            aria-label={expanded ? t("chatLibrary.tree.collapse") : t("chatLibrary.tree.expand")}
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ease-out",
                expanded && "rotate-90"
              )}
            />
          </button>
        }
        icon={
          isSelected ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-serbian-blue" />
          ) : isMainFolder ? (
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <FolderSymlink className="h-4 w-4 shrink-0 text-muted-foreground" />
          )
        }
        label={
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center text-left"
            onClick={() => {
              if (!isRenaming) onSelectFolder(node._id);
            }}
          >
            {isRenaming ? (
              <Input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveRename();
                  if (e.key === "Escape") onSetRenamingFolderId(null);
                }}
                onBlur={() => void saveRename()}
                className="h-7 text-xs flex-1"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate">{node.name}</span>
            )}
          </button>
        }
        count={!isRenaming ? count : undefined}
        actions={
          !isRenaming ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "shrink-0 focus-visible:opacity-100",
                    isMobile ? "h-8 w-8 opacity-60" : "h-6 w-6 opacity-0 group-hover:opacity-100"
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {isMainFolder && (
                  <DropdownMenuItem
                    onSelect={() => {
                      setExpanded(true);
                      onCreateSubfolder(node._id);
                    }}
                  >
                    <FolderSymlink className="h-4 w-4 mr-2" />
                    {t("chatLibrary.folder.newSubfolder")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => onSetRenamingFolderId(idStr)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  {t("chatLibrary.folder.rename")}
                </DropdownMenuItem>
                {onExportFolder && (
                  <DropdownMenuItem
                    disabled={!canExport || isExporting}
                    title={!canExport ? t("chatLibrary.export.folderEmpty") : undefined}
                    onSelect={() => {
                      if (canExport && !isExporting) onExportFolder(node._id);
                    }}
                  >
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4 mr-2" />
                    )}
                    {isExporting
                      ? t("chatLibrary.export.bulkProgress")
                      : t("chatLibrary.export.folderZip")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={!deletable}
                  title={!deletable ? t("chatLibrary.folder.deleteBlocked") : undefined}
                  onSelect={() => {
                    if (deletable) void onDeleteFolder(node._id);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("chatLibrary.folder.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : undefined
        }
        onDragOver={(e) => {
          e.preventDefault();
          onDragOverFolder(idStr);
        }}
        onDragLeave={() => onDragOverFolder(null)}
        onDrop={(e) => {
          e.preventDefault();
          onDragOverFolder(null);
          onDropOnFolder(node._id);
        }}
      />

      <AnimatePresence initial={false}>
        {expanded &&
          node.children.map((child) => (
            <motion.div
              key={child._id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <FolderRow
                node={child}
                depth={depth + 1}
                selectedFolderId={selectedFolderId}
                itemCounts={itemCounts}
                onSelectFolder={onSelectFolder}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
                onCreateSubfolder={onCreateSubfolder}
                dragOverFolderId={dragOverFolderId}
                onDragOverFolder={onDragOverFolder}
                onDropOnFolder={onDropOnFolder}
                renamingFolderId={renamingFolderId}
                onSetRenamingFolderId={onSetRenamingFolderId}
                isMobile={isMobile}
                sectionActive={sectionActive}
                folders={folders}
                directItemCounts={directItemCounts}
                onExportFolder={onExportFolder}
                exportingFolderId={exportingFolderId}
              />
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
}

export function FolderTree({
  folders,
  selectedFolderId,
  itemCounts,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  dragOverFolderId,
  onDragOverFolder,
  onDropOnFolder,
  compact = false,
  embedded = false,
  sectionActive = true,
  forcedRenamingFolderId = null,
  directItemCounts: directItemCountsProp,
  onExportFolder,
  exportingFolderId = null,
  archiveEntry,
}: FolderTreeProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const tree = useMemo(() => buildFolderTree(folders), [folders]);
  const directItemCounts = directItemCountsProp ?? itemCounts;
  const uncategorizedCount = itemCounts.uncategorized ?? 0;
  const canExportUncategorized =
    Boolean(onExportFolder) && (directItemCounts.uncategorized ?? 0) > 0;
  const isExportingUncategorized = exportingFolderId === "uncategorized";
  const isUncategorizedSelected = sectionActive && selectedFolderId === "uncategorized";
  const isUncategorizedDragOver = dragOverFolderId === "uncategorized";
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);

  useEffect(() => {
    if (forcedRenamingFolderId) {
      setRenamingFolderId(forcedRenamingFolderId);
    }
  }, [forcedRenamingFolderId]);

  const nextDefaultName = useCallback(
    (parentId?: string) =>
      nextDefaultFolderName(folders, parentId, {
        main: t("chatLibrary.folder.defaultFolderName"),
        sub: t("chatLibrary.folder.defaultSubfolderName"),
      }),
    [folders, t]
  );

  const handleInstantCreate = useCallback(
    async (parentId?: string) => {
      const name = nextDefaultName(parentId);
      const newId = await onCreateFolder(name, parentId);
      if (newId) {
        setRenamingFolderId(newId);
      }
    },
    [nextDefaultName, onCreateFolder]
  );

  return (
    <div className={cn("flex flex-col min-h-0", compact ? "h-full" : "")}>
      {!embedded && (
        <div className="px-3 pt-3 pb-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("chatLibrary.tree.locations")}
          </p>
        </div>
      )}

      {!embedded && (
        <div className={cn("px-2 pb-2 shrink-0", embedded && "pt-1")}>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "w-full justify-start gap-2 text-xs text-muted-foreground hover:text-foreground",
              isMobile ? "h-10" : "h-8"
            )}
            onClick={() => void handleInstantCreate(undefined)}
          >
            <FolderPlus className="h-3.5 w-3.5" />
            {t("chatLibrary.folder.newMainFolder")}
          </Button>
        </div>
      )}

      <ScrollArea
        className={cn(
          "flex-1",
          embedded ? "px-0" : "px-2",
          compact && !embedded ? "max-h-none" : embedded ? "max-h-none" : "max-h-[420px]"
        )}
      >
        <div role="tree" aria-label={t("chatLibrary.foldersHeading")} className="space-y-0.5 pb-2">
          <LibraryTreeRow
            role="treeitem"
            depth={0}
            isMobile={isMobile}
            chevronHidden
            rowClassName={cn(
              isUncategorizedSelected
                ? "library-accent-bg text-serbian-blue font-medium"
                : "text-foreground/90 hover:bg-muted/70",
              isUncategorizedDragOver && "ring-2 library-accent-ring ring-inset"
            )}
            icon={<Inbox className="h-4 w-4 shrink-0 text-muted-foreground" />}
            label={<span className="truncate">{t("chatLibrary.uncategorized")}</span>}
            count={uncategorizedCount}
            actions={
              onExportFolder ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "shrink-0 focus-visible:opacity-100",
                        isMobile ? "h-8 w-8 opacity-60" : "h-6 w-6 opacity-0 group-hover:opacity-100"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      disabled={!canExportUncategorized || isExportingUncategorized}
                      title={!canExportUncategorized ? t("chatLibrary.export.folderEmpty") : undefined}
                      onSelect={() => {
                        if (canExportUncategorized && !isExportingUncategorized) {
                          onExportFolder("uncategorized");
                        }
                      }}
                    >
                      {isExportingUncategorized ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileDown className="h-4 w-4 mr-2" />
                      )}
                      {isExportingUncategorized
                        ? t("chatLibrary.export.bulkProgress")
                        : t("chatLibrary.export.folderZip")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : undefined
            }
            onClick={() => onSelectFolder("uncategorized")}
            onDragOver={(e) => {
              e.preventDefault();
              onDragOverFolder("uncategorized");
            }}
            onDragLeave={() => onDragOverFolder(null)}
            onDrop={(e) => {
              e.preventDefault();
              onDragOverFolder(null);
              onDropOnFolder("uncategorized");
            }}
          />

          {tree.length > 0 && (
            <LibraryTreeSectionLabel>{t("chatLibrary.tree.myFolders")}</LibraryTreeSectionLabel>
          )}

          {tree.map((node) => (
            <motion.div
              key={node._id}
              layout
              initial={false}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <FolderRow
              node={node}
              depth={0}
              selectedFolderId={selectedFolderId}
              itemCounts={itemCounts}
              onSelectFolder={onSelectFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onCreateSubfolder={(parentId) => void handleInstantCreate(parentId)}
              dragOverFolderId={dragOverFolderId}
              onDragOverFolder={onDragOverFolder}
              onDropOnFolder={onDropOnFolder}
              renamingFolderId={renamingFolderId}
              onSetRenamingFolderId={setRenamingFolderId}
              isMobile={isMobile}
              sectionActive={sectionActive}
              folders={folders}
              directItemCounts={directItemCounts}
              onExportFolder={onExportFolder}
              exportingFolderId={exportingFolderId}
            />
            </motion.div>
          ))}

          {archiveEntry && archiveEntry.count > 0 && (
            <>
              <LibraryTreeSectionLabel>{t("chatLibrary.tree.archive")}</LibraryTreeSectionLabel>
              <LibraryTreeRow
                role="treeitem"
                depth={0}
                isMobile={isMobile}
                chevronHidden
                rowClassName={cn(
                  sectionActive && selectedFolderId === archiveEntry.id
                    ? "library-accent-bg text-serbian-blue font-medium"
                    : "text-foreground/90 hover:bg-muted/70"
                )}
                icon={<Archive className="h-4 w-4 shrink-0 text-muted-foreground" />}
                label={<span className="truncate">{archiveEntry.label}</span>}
                count={archiveEntry.count}
                onClick={() => onSelectFolder(archiveEntry.id)}
              />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
