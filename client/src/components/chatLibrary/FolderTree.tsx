import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
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
  type ChatFolder,
  type FolderTreeNode,
  isRootFolder,
} from "@/lib/chatLibraryTree";

export type { ChatFolder };

type FolderTreeProps = {
  folders: ChatFolder[];
  selectedFolderId: Id<"chatFolders"> | "uncategorized";
  sessionCounts: Record<string, number>;
  onSelectFolder: (folderId: Id<"chatFolders"> | "uncategorized") => void;
  onCreateFolder: (name: string, parentId?: Id<"chatFolders">) => Promise<Id<"chatFolders"> | null>;
  onRenameFolder: (folderId: Id<"chatFolders">, name: string) => Promise<void>;
  onDeleteFolder: (folderId: Id<"chatFolders">) => Promise<void>;
  dragOverFolderId: string | null;
  onDragOverFolder: (folderId: string | null) => void;
  onDropOnFolder: (folderId: Id<"chatFolders"> | "uncategorized") => void;
  compact?: boolean;
};

function FolderRow({
  node,
  depth,
  selectedFolderId,
  sessionCounts,
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
}: {
  node: FolderTreeNode;
  depth: number;
  selectedFolderId: Id<"chatFolders"> | "uncategorized";
  sessionCounts: Record<string, number>;
  onSelectFolder: (folderId: Id<"chatFolders"> | "uncategorized") => void;
  onRenameFolder: (folderId: Id<"chatFolders">, name: string) => Promise<void>;
  onDeleteFolder: (folderId: Id<"chatFolders">) => Promise<void>;
  onCreateSubfolder: (parentId: Id<"chatFolders">) => void;
  dragOverFolderId: string | null;
  onDragOverFolder: (folderId: string | null) => void;
  onDropOnFolder: (folderId: Id<"chatFolders"> | "uncategorized") => void;
  renamingFolderId: string | null;
  onSetRenamingFolderId: (id: string | null) => void;
  isMobile: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const idStr = node._id as string;
  const isSelected = selectedFolderId === node._id;
  const count = sessionCounts[idStr] ?? 0;
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
      <div
        className={cn(
          "group flex items-center gap-0.5 rounded-md pr-1 text-[13px] transition-colors cursor-default select-none",
          isMobile ? "py-1.5" : "py-1",
          isSelected
            ? "bg-primary/12 text-primary font-medium"
            : "text-foreground/90 hover:bg-muted/70",
          isDragOver && "ring-2 ring-primary/40 ring-inset bg-primary/5"
        )}
        style={{ paddingLeft: `${6 + depth * 16}px` }}
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
      >
        <button
          type="button"
          className={cn(
            "shrink-0 flex h-5 w-5 items-center justify-center rounded-sm hover:bg-muted/80",
            !hasChildren && "invisible"
          )}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          aria-label={expanded ? t("chatLibrary.tree.collapse") : t("chatLibrary.tree.expand")}
        >
          <ChevronRight
            className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", expanded && "rotate-90")}
          />
        </button>

        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left"
          onClick={() => {
            if (!isRenaming) onSelectFolder(node._id);
          }}
        >
          {isSelected ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
          ) : isMainFolder ? (
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <FolderSymlink className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
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

        {!isRenaming && (
          <>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground pr-0.5">{count}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "shrink-0 focus-visible:opacity-100",
                    isMobile
                      ? "h-8 w-8 opacity-60"
                      : "h-6 w-6 opacity-0 group-hover:opacity-100"
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {isMainFolder && (
                  <DropdownMenuItem onSelect={() => {
                    setExpanded(true);
                    onCreateSubfolder(node._id);
                  }}>
                    <FolderSymlink className="h-4 w-4 mr-2" />
                    {t("chatLibrary.folder.newSubfolder")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onSelect={() => onSetRenamingFolderId(idStr)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  {t("chatLibrary.folder.rename")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => void onDeleteFolder(node._id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("chatLibrary.folder.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {expanded &&
        node.children.map((child) => (
          <FolderRow
            key={child._id as string}
            node={child}
            depth={depth + 1}
            selectedFolderId={selectedFolderId}
            sessionCounts={sessionCounts}
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
          />
        ))}
    </div>
  );
}

export function FolderTree({
  folders,
  selectedFolderId,
  sessionCounts,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  dragOverFolderId,
  onDragOverFolder,
  onDropOnFolder,
  compact = false,
}: FolderTreeProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const tree = useMemo(() => buildFolderTree(folders), [folders]);
  const uncategorizedCount = sessionCounts.uncategorized ?? 0;
  const isUncategorizedSelected = selectedFolderId === "uncategorized";
  const isUncategorizedDragOver = dragOverFolderId === "uncategorized";
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);

  const nextDefaultName = useCallback(
    (parentId?: Id<"chatFolders">) => {
      const prefix = parentId
        ? t("chatLibrary.folder.defaultSubfolderName")
        : t("chatLibrary.folder.defaultFolderName");
      const siblings = parentId
        ? folders.filter((f) => f.parentId === parentId)
        : folders.filter((f) => !f.parentId);
      const existing = new Set(siblings.map((f) => f.name));
      if (!existing.has(prefix)) return prefix;
      for (let i = 2; i <= 100; i += 1) {
        const candidate = `${prefix} ${i}`;
        if (!existing.has(candidate)) return candidate;
      }
      return `${prefix} ${Date.now()}`;
    },
    [folders, t]
  );

  const handleInstantCreate = useCallback(
    async (parentId?: Id<"chatFolders">) => {
      const name = nextDefaultName(parentId);
      const newId = await onCreateFolder(name, parentId);
      if (newId) {
        setRenamingFolderId(newId as string);
      }
    },
    [nextDefaultName, onCreateFolder]
  );

  return (
    <div className={cn("flex flex-col min-h-0", compact ? "h-full" : "")}>
      <div className="px-3 pt-3 pb-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("chatLibrary.tree.locations")}
        </p>
      </div>

      <ScrollArea className={cn("flex-1 px-1", compact ? "max-h-none" : "max-h-[420px]")}>
        <div role="tree" aria-label={t("chatLibrary.foldersHeading")} className="space-y-0.5 pb-2">
          <div
            role="treeitem"
            className={cn(
              "flex items-center gap-2 rounded-md px-2 text-[13px] cursor-default select-none transition-colors",
              isMobile ? "py-2.5" : "py-1.5",
              isUncategorizedSelected
                ? "bg-primary/12 text-primary font-medium"
                : "text-foreground/90 hover:bg-muted/70",
              isUncategorizedDragOver && "ring-2 ring-primary/40 ring-inset"
            )}
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
          >
            <span className="w-5 shrink-0" />
            <Inbox className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">{t("chatLibrary.uncategorized")}</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">{uncategorizedCount}</span>
          </div>

          {tree.length > 0 && (
            <div className="px-3 pt-2 pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("chatLibrary.tree.myFolders")}
              </p>
            </div>
          )}

          {tree.map((node) => (
            <FolderRow
              key={node._id as string}
              node={node}
              depth={0}
              selectedFolderId={selectedFolderId}
              sessionCounts={sessionCounts}
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
            />
          ))}
        </div>
      </ScrollArea>

      <div className="border-t border-border/60 p-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 h-8 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => void handleInstantCreate(undefined)}
        >
          <FolderPlus className="h-3.5 w-3.5" />
          {t("chatLibrary.folder.newMainFolder")}
        </Button>
      </div>
    </div>
  );
}
