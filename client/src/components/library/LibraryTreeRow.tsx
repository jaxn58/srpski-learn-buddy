import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { treeRowPaddingLeft } from "@/components/library/libraryTreeLayout";

type LibraryTreeRowProps = {
  depth?: number;
  className?: string;
  rowClassName?: string;
  isMobile?: boolean;
  chevron?: ReactNode;
  chevronHidden?: boolean;
  icon: ReactNode;
  label: ReactNode;
  count?: ReactNode;
  actions?: ReactNode;
  onClick?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  role?: string;
  "aria-expanded"?: boolean;
};

export function LibraryTreeRow({
  depth = 0,
  className,
  rowClassName,
  isMobile = false,
  chevron,
  chevronHidden = false,
  icon,
  label,
  count,
  actions,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
  role,
  "aria-expanded": ariaExpanded,
}: LibraryTreeRowProps) {
  return (
    <div
      {...(role !== undefined ? { role } : {})}
      {...(ariaExpanded !== undefined ? { "aria-expanded": ariaExpanded } : {})}
      className={cn(
        "group flex items-center gap-0.5 rounded-md pr-1 text-[13px] transition-colors duration-200 ease-out cursor-default select-none",
        isMobile ? "py-1.5" : "py-1",
        rowClassName,
        className
      )}
      style={{ paddingLeft: `${treeRowPaddingLeft(depth)}px` }}
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <span
        className={cn(
          "shrink-0 flex h-5 w-5 items-center justify-center",
          chevronHidden && "invisible"
        )}
      >
        {chevron}
      </span>

      <span className="shrink-0 flex h-4 w-4 items-center justify-center">{icon}</span>

      <div className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left">{label}</div>

      {count !== undefined && count !== null && (
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground pr-0.5">
          {count}
        </span>
      )}

      {actions}
    </div>
  );
}

type LibraryTreeSectionLabelProps = {
  children: ReactNode;
  className?: string;
};

export function LibraryTreeSectionLabel({ children, className }: LibraryTreeSectionLabelProps) {
  return (
    <div className={cn("px-2 pt-2 pb-1", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </p>
    </div>
  );
}
