import { useTranslation } from "react-i18next";
import { Archive, FolderInput, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type BulkFolderOption = {
  id: string;
  name: string;
  depth: 0 | 1;
};

type LibraryBulkBarProps = {
  selectedCount: number;
  allSelected: boolean;
  indeterminate: boolean;
  onToggleSelectAll: () => void;
  onClearSelection: () => void;
  folderOptions: BulkFolderOption[];
  currentFolderId: string | "uncategorized";
  onMoveToFolder: (folderId: string | undefined) => void | Promise<void>;
  onDelete: () => void;
  deleteLabel: string;
  deleteIcon?: "trash" | "archive";
  isProcessing?: boolean;
  className?: string;
};

export function LibraryBulkBar({
  selectedCount,
  allSelected,
  indeterminate,
  onToggleSelectAll,
  onClearSelection,
  folderOptions,
  currentFolderId,
  onMoveToFolder,
  onDelete,
  deleteLabel,
  deleteIcon = "trash",
  isProcessing = false,
  className,
}: LibraryBulkBarProps) {
  const { t } = useTranslation();

  if (selectedCount === 0) return null;

  const DeleteIcon = deleteIcon === "archive" ? Archive : Trash2;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b library-accent-bg px-4 py-2 shrink-0",
        className
      )}
      role="toolbar"
      aria-label={t("myLibrary.bulk.toolbarLabel")}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Checkbox
          checked={allSelected ? true : indeterminate ? "indeterminate" : false}
          onCheckedChange={() => onToggleSelectAll()}
          aria-label={allSelected ? t("chatSessions.batch.deselectAll") : t("chatSessions.batch.selectAll")}
        />
        <span className="text-xs font-medium text-serbian-blue tabular-nums">
          {t("myLibrary.bulk.selectedCount", { count: selectedCount })}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs bg-background"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <FolderInput className="h-3.5 w-3.5 mr-1.5" />
              )}
              {t("myLibrary.bulk.moveToFolder")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {currentFolderId !== "uncategorized" && (
              <DropdownMenuItem onSelect={() => void onMoveToFolder(undefined)}>
                {t("chatLibrary.uncategorized")}
              </DropdownMenuItem>
            )}
            {folderOptions.map((folder) =>
              folder.id === currentFolderId ? null : (
                <DropdownMenuItem
                  key={folder.id}
                  onSelect={() => void onMoveToFolder(folder.id)}
                  className={folder.depth === 1 ? "pl-6" : undefined}
                >
                  {folder.depth === 1 ? `— ${folder.name}` : folder.name}
                </DropdownMenuItem>
              )
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="destructive"
          size="sm"
          className="h-8 text-xs"
          disabled={isProcessing}
          onClick={onDelete}
        >
          <DeleteIcon className="h-3.5 w-3.5 mr-1.5" />
          {deleteLabel}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground"
          onClick={onClearSelection}
          aria-label={t("myLibrary.bulk.clearSelection")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
