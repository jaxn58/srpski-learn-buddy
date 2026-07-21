import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Doc } from "../../../../../convex/_generated/dataModel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PlusCircle } from "lucide-react";
import { CreateModuleDialog } from "./CreateModuleDialog";

const CREATE_NEW_VALUE = "__create_new_module__";

interface ModuleSelectProps {
  /** Module number as string, matching the surrounding form's local state. */
  value: string;
  onChange: (value: string) => void;
  hasError?: boolean;
  disabled?: boolean;
}

/**
 * Module picker backed by the real moduleMetadata table (Modulverwaltung),
 * instead of a free-text number field. Prevents drafts from ending up with a
 * moduleNumber that has no corresponding module (see: orphaned "Module 101"
 * that was never actually created).
 */
export function ModuleSelect({ value, onChange, hasError, disabled }: ModuleSelectProps) {
  const modules = useQuery(api.modules.getAllModulesConsolidated) as Doc<"moduleMetadata">[] | undefined;
  const [dialogOpen, setDialogOpen] = useState(false);

  const loading = modules === undefined;
  const matchedModule = (modules ?? []).find((m) => String(m.moduleNumber) === value);
  const isOrphaned = value.trim().length > 0 && !loading && !matchedModule;

  const suggestedModuleNumber =
    modules && modules.length > 0 ? Math.max(...modules.map((m) => m.moduleNumber ?? 0)) + 1 : 1;

  const handleValueChange = (next: string) => {
    if (next === CREATE_NEW_VALUE) {
      setDialogOpen(true);
      return;
    }
    onChange(next);
  };

  const handleCreated = (module: Doc<"moduleMetadata">) => {
    onChange(String(module.moduleNumber));
  };

  return (
    <div className="space-y-1.5">
      <Select value={value} onValueChange={handleValueChange} disabled={disabled || loading}>
        <SelectTrigger
          aria-invalid={hasError || isOrphaned || undefined}
          className={cn((hasError || isOrphaned) && "border-destructive focus-visible:ring-destructive")}
        >
          <SelectValue placeholder={loading ? "Loading modules..." : "Select module..."} />
        </SelectTrigger>
        <SelectContent>
          {isOrphaned && (
            <SelectItem value={value}>Module {value} (not linked to a real module)</SelectItem>
          )}
          {(modules ?? []).map((m) => (
            <SelectItem key={String(m._id)} value={String(m.moduleNumber)}>
              Module {m.moduleNumber}: {m.titleEn || "Untitled"}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={CREATE_NEW_VALUE}>
            <span className="flex items-center gap-1.5">
              <PlusCircle className="h-3.5 w-3.5" />
              Create new module...
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      {isOrphaned && (
        <p className="text-xs text-destructive">
          This module number does not exist in the Modulverwaltung. Select an existing module or create a new one.
        </p>
      )}

      <CreateModuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        suggestedModuleNumber={suggestedModuleNumber}
        onCreated={handleCreated}
      />
    </div>
  );
}
