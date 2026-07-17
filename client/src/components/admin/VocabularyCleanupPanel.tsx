import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type CleanupCandidate = {
  _id: Id<"courseVocabulary">;
  serbian: string;
  unitNumber: number;
  en?: string;
  de?: string;
  noteEn?: string;
  noteDe?: string;
  matchesHeuristic: "strong" | "weak" | false;
};

type ScanReport = {
  scannedAt: number;
  totalScanned: number;
  unitsScanned: number;
  autoAddedCandidates: CleanupCandidate[];
  heuristicOnlyCandidates: CleanupCandidate[];
};

type AllowlistEntry = {
  _id: Id<"vocabularyProperNounAllowlist">;
  serbianNormalized: string;
  serbianOriginal: string;
  confirmedAt: number;
  confirmedBy: Id<"users">;
  source: string;
  note?: string;
};

type BlacklistEntry = {
  _id: Id<"vocabularyNameBlacklist">;
  serbianNormalized: string;
  serbianOriginal: string;
  confirmedAt: number;
  confirmedBy: Id<"users">;
  source: string;
  note?: string;
};


// ---------------------------------------------------------------------------
// Intelligent categorization
// ---------------------------------------------------------------------------
type ProblemCategory = "name_strong" | "name_weak" | "no_translation" | "looks_ok";

interface CategorizedEntry extends CleanupCandidate {
  category: ProblemCategory;
  reason: string;
}

function categorizeEntries(
  autoAdded: CleanupCandidate[],
  heuristicOnly: CleanupCandidate[],
): CategorizedEntry[] {
  const all = [...autoAdded, ...heuristicOnly];
  const result: CategorizedEntry[] = [];

  for (const entry of all) {
    const hasTranslation = Boolean(entry.en || entry.de);

    if (entry.matchesHeuristic === "strong" && !hasTranslation) {
      result.push({ ...entry, category: "name_strong", reason: "Capitalized mid-sentence AND has no translation — likely a personal name" });
    } else if (!hasTranslation && entry.matchesHeuristic === "weak") {
      result.push({ ...entry, category: "name_weak", reason: "Only seen capitalized AND has no translation — likely a personal name" });
    } else if (!hasTranslation) {
      result.push({ ...entry, category: "no_translation", reason: "Missing both EN and DE translations" });
    } else {
      result.push({ ...entry, category: "looks_ok", reason: "Has a valid translation — confirmed vocabulary" });
    }
  }

  return result;
}

function shouldPreSelect(cat: ProblemCategory): boolean {
  return cat === "name_strong";
}

const CATEGORY_CONFIG: Record<ProblemCategory, { label: string; description: string; badgeClass: string; order: number }> = {
  name_strong: {
    label: "Likely personal names",
    description:
      "These words were found capitalized in the MIDDLE of a sentence AND have no translation — " +
      "a strong indicator they are personal names (e.g. 'Ana', 'Marko'). All entries here are PRE-TICKED for removal. " +
      "Untick if a word is NOT actually a name.",
    badgeClass: "text-red-700 border-red-400 dark:text-red-400",
    order: 1,
  },
  no_translation: {
    label: "Missing translations",
    description:
      "These entries have neither an English nor a German translation. Without translations, they are useless to learners. " +
      "If you know the translation, keep it and add it later. If it looks like a mistake, tick it for removal.",
    badgeClass: "text-amber-700 border-amber-400 dark:text-amber-400",
    order: 2,
  },
  name_weak: {
    label: "Possibly names (needs your decision)",
    description:
      "These words were ONLY seen at the beginning of sentences, never in lowercase. This COULD mean they are names " +
      "or regular words that just happen to appear sentence-initially. " +
      "Tick entries that ARE names (they will be removed and blacklisted). Leave real vocabulary unticked.",
    badgeClass: "text-amber-700 border-amber-400 dark:text-amber-400",
    order: 3,
  },
  looks_ok: {
    label: "Looks correct",
    description:
      "These entries have a valid translation and are most likely valid vocabulary. " +
      "You can confirm them all with one click to stop future flagging.",
    badgeClass: "text-emerald-700 border-emerald-400 dark:text-emerald-400",
    order: 4,
  },
};

// ---------------------------------------------------------------------------
// Wizard step definitions
// ---------------------------------------------------------------------------
type WizardStep = "idle" | "overview" | "auto_remove" | "manual_review" | "finalize";

const WIZARD_STEPS: { key: WizardStep; label: string; shortLabel: string }[] = [
  { key: "overview", label: "Scan Overview", shortLabel: "Overview" },
  { key: "auto_remove", label: "Auto-Detected Issues", shortLabel: "Auto-Remove" },
  { key: "manual_review", label: "Manual Review", shortLabel: "Review" },
  { key: "finalize", label: "Finalize & Execute", shortLabel: "Finalize" },
];

function stepIndex(step: WizardStep): number {
  return WIZARD_STEPS.findIndex((s) => s.key === step);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function downloadBackupJson(filename: string, entries: CategorizedEntry[]): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    count: entries.length,
    entries: entries.map(({ category, reason, ...rest }) => ({ ...rest, category, reason })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function formatTimestamp(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepIndicator({ currentStep, stepStatuses, onNavigate }: {
  currentStep: WizardStep;
  stepStatuses: Map<WizardStep, "pending" | "active" | "done" | "skipped">;
  onNavigate: (step: WizardStep) => void;
}) {
  const currentIdx = stepIndex(currentStep);

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {WIZARD_STEPS.map((step, idx) => {
        const status = stepStatuses.get(step.key) ?? "pending";
        const isCurrent = step.key === currentStep;
        const isClickable = idx <= currentIdx || status === "done";

        return (
          <div key={step.key} className="flex items-center gap-1 shrink-0">
            {idx > 0 && (
              <div className={`w-4 h-px ${idx <= currentIdx ? "bg-primary/50" : "bg-muted-foreground/20"}`} />
            )}
            <button
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : status === "done"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-950/50"
                    : status === "skipped"
                      ? "bg-muted/50 text-muted-foreground line-through"
                      : isClickable
                        ? "bg-muted/50 text-muted-foreground hover:bg-muted"
                        : "text-muted-foreground/40 cursor-default"
              }`}
              onClick={() => isClickable && onNavigate(step.key)}
              disabled={!isClickable}
            >
              {status === "done" && <CheckCircle2 className="h-3 w-3" />}
              <span>{step.shortLabel}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function CategoryTable({ entries, selectedIds, onToggle, onSelectAll, onClearAll }: {
  entries: CategorizedEntry[];
  selectedIds: Set<string>;
  onToggle: (id: Id<"courseVocabulary">) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  const selectedInCat = entries.filter((c) => selectedIds.has(String(c._id))).length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="h-6 text-[10px]"
          onClick={onSelectAll} disabled={selectedInCat === entries.length}>
          Tick all ({entries.length})
        </Button>
        <Button size="sm" variant="outline" className="h-6 text-[10px]"
          onClick={onClearAll} disabled={selectedInCat === 0}>
          Untick all
        </Button>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {selectedInCat} / {entries.length} marked for removal
        </span>
      </div>

      <div className="max-h-56 overflow-y-auto rounded border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/90 backdrop-blur">
            <tr className="border-b">
              <th className="px-2 py-1 w-[30px]"></th>
              <th className="px-2 py-1 text-left w-[40px]">Unit</th>
              <th className="px-2 py-1 text-left">Serbian</th>
              <th className="px-2 py-1 text-left">EN</th>
              <th className="px-2 py-1 text-left">DE</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((c) => {
              const id = String(c._id);
              const isSelected = selectedIds.has(id);
              return (
                <tr key={id} className={`border-b last:border-0 transition-colors ${
                  isSelected ? "bg-red-50/60 dark:bg-red-950/20" : "hover:bg-muted/30"
                }`}>
                  <td className="px-2 py-1">
                    <Checkbox checked={isSelected} onCheckedChange={() => onToggle(c._id)} />
                  </td>
                  <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground">U{c.unitNumber}</td>
                  <td className="px-2 py-1 font-medium">{c.serbian}</td>
                  <td className="px-2 py-1 text-muted-foreground">{c.en ?? "—"}</td>
                  <td className="px-2 py-1 text-muted-foreground">{c.de ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AllowlistSection({
  entries, onRemove,
}: {
  entries: AllowlistEntry[];
  onRemove: (id: Id<"vocabularyProperNounAllowlist">) => void | Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [removingId, setRemovingId] = useState<Id<"vocabularyProperNounAllowlist"> | null>(null);

  const handleRemove = async (id: Id<"vocabularyProperNounAllowlist">): Promise<void> => {
    setRemovingId(id);
    try { await onRemove(id); } finally { setRemovingId(null); }
  };

  return (
    <div className="border rounded-md bg-background overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-400 dark:text-emerald-400">
          {entries.length}
        </Badge>
        <span className="text-xs font-medium">Confirmed vocabulary (allowlist)</span>
        <span className="text-[10px] text-muted-foreground ml-1">— will never be flagged again</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t">
          {entries.length === 0 ? (
            <p className="text-[10px] text-muted-foreground pt-2 italic">No entries yet.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded border mt-2">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/90 backdrop-blur">
                  <tr className="border-b">
                    <th className="px-2 py-1 text-left">Word</th>
                    <th className="px-2 py-1 text-left">Confirmed</th>
                    <th className="px-2 py-1 w-[70px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={String(e._id)} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-2 py-1 font-medium">{e.serbianOriginal}</td>
                      <td className="px-2 py-1 text-muted-foreground text-[10px]">{formatTimestamp(e.confirmedAt)}</td>
                      <td className="px-2 py-1">
                        <Button size="sm" variant="ghost"
                          className="h-5 text-[10px] text-muted-foreground hover:text-destructive px-1"
                          disabled={removingId === e._id}
                          onClick={() => void handleRemove(e._id)}>
                          {removingId === e._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><X className="mr-0.5 h-3 w-3" />Undo</>}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BlacklistSection({
  entries, onRemove,
}: {
  entries: BlacklistEntry[];
  onRemove: (id: Id<"vocabularyNameBlacklist">) => void | Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [removingId, setRemovingId] = useState<Id<"vocabularyNameBlacklist"> | null>(null);

  const handleRemove = async (id: Id<"vocabularyNameBlacklist">): Promise<void> => {
    setRemovingId(id);
    try { await onRemove(id); } finally { setRemovingId(null); }
  };

  return (
    <div className="border rounded-md bg-background overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <Badge variant="outline" className="text-[10px] text-red-700 border-red-400 dark:text-red-400">
          {entries.length}
        </Badge>
        <span className="text-xs font-medium">Confirmed names (blacklist)</span>
        <span className="text-[10px] text-muted-foreground ml-1">— will never be added as vocabulary</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t">
          <p className="text-[10px] text-muted-foreground pt-2 mb-2 italic">
            These words were confirmed as personal names and permanently blocked.
            Remove an entry if it was blacklisted by mistake.
          </p>
          {entries.length === 0 ? (
            <p className="text-[10px] text-muted-foreground italic">No entries yet.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/90 backdrop-blur">
                  <tr className="border-b">
                    <th className="px-2 py-1 text-left">Word</th>
                    <th className="px-2 py-1 text-left">Blocked since</th>
                    <th className="px-2 py-1 w-[70px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={String(e._id)} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-2 py-1 font-medium">{e.serbianOriginal}</td>
                      <td className="px-2 py-1 text-muted-foreground text-[10px]">{formatTimestamp(e.confirmedAt)}</td>
                      <td className="px-2 py-1">
                        <Button size="sm" variant="ghost"
                          className="h-5 text-[10px] text-muted-foreground hover:text-destructive px-1"
                          disabled={removingId === e._id}
                          onClick={() => void handleRemove(e._id)}>
                          {removingId === e._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><X className="mr-0.5 h-3 w-3" />Undo</>}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function VocabularyCleanupPanel() {
  // ── Data queries ──────────────────────────────────────────────────────────
  const [scanEnabled, setScanEnabled] = useState(false);

  const scan = useQuery(
    api.contentStudio.scanProperNounCandidates,
    scanEnabled ? {} : "skip"
  ) as ScanReport | undefined;

  const allowlist = useQuery(api.contentStudio.getProperNounAllowlist, {}) as AllowlistEntry[] | undefined;
  const blacklist = useQuery(api.contentStudio.getNameBlacklist, {}) as BlacklistEntry[] | undefined;

  // ── Mutations ─────────────────────────────────────────────────────────────
  const bulkDelete = useMutation(api.contentStudio.bulkDeleteVocabularyByIds);
  const addToAllowlist = useMutation(api.contentStudio.addToProperNounAllowlist);
  const removeFromAllowlist = useMutation(api.contentStudio.removeFromProperNounAllowlist);
  const removeFromBlacklist = useMutation(api.contentStudio.removeFromNameBlacklist);

  // ── Wizard state ──────────────────────────────────────────────────────────
  const [wizardStep, setWizardStep] = useState<WizardStep>("idle");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hasExported, setHasExported] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [whitelisting, setWhitelisting] = useState(false);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());

  // ── Categorization ────────────────────────────────────────────────────────
  const categorized = useMemo<CategorizedEntry[]>(() => {
    if (!scan) return [];
    return categorizeEntries(scan.autoAddedCandidates, scan.heuristicOnlyCandidates);
  }, [scan]);

  const grouped = useMemo(() => {
    const groups = new Map<ProblemCategory, CategorizedEntry[]>();
    for (const entry of categorized) {
      const list = groups.get(entry.category) ?? [];
      list.push(entry);
      groups.set(entry.category, list);
    }
    return groups;
  }, [categorized]);

  // Auto-preselect on first scan
  useEffect(() => {
    if (categorized.length > 0 && !hasAutoSelected) {
      const preSelected = new Set<string>();
      for (const entry of categorized) {
        if (shouldPreSelect(entry.category)) {
          preSelected.add(String(entry._id));
        }
      }
      setSelectedIds(preSelected);
      setHasAutoSelected(true);
    }
  }, [categorized, hasAutoSelected]);

  // Move to overview once scan completes
  useEffect(() => {
    if (scan && wizardStep === "idle" && scanEnabled) {
      setWizardStep("overview");
    }
  }, [scan, wizardStep, scanEnabled]);

  // ── Derived counts ────────────────────────────────────────────────────────
  const redCategories: ProblemCategory[] = ["name_strong"];
  const amberCategories: ProblemCategory[] = ["name_weak", "no_translation"];

  const redEntries = useMemo(() => redCategories.flatMap((c) => grouped.get(c) ?? []), [grouped]);
  const amberEntries = useMemo(() => amberCategories.flatMap((c) => grouped.get(c) ?? []), [grouped]);
  const okEntries = useMemo(() => grouped.get("looks_ok") ?? [], [grouped]);

  const selectedCount = selectedIds.size;
  const selectedEntries = useMemo(
    () => categorized.filter((c) => selectedIds.has(String(c._id))),
    [categorized, selectedIds]
  );
  const expectedConfirm = `DELETE ${selectedCount} VOCABULARY`;
  const canDelete = selectedCount > 0 && hasExported && confirmText === expectedConfirm;

  // ── Step statuses ─────────────────────────────────────────────────────────
  const stepStatuses = useMemo(() => {
    const map = new Map<WizardStep, "pending" | "active" | "done" | "skipped">();
    for (const s of WIZARD_STEPS) {
      if (s.key === wizardStep) map.set(s.key, "active");
      else if (completedSteps.has(s.key)) map.set(s.key, "done");
      else if (s.key === "auto_remove" && redEntries.length === 0 && scan) map.set(s.key, "skipped");
      else if (s.key === "manual_review" && amberEntries.length === 0 && scan) map.set(s.key, "skipped");
      else map.set(s.key, "pending");
    }
    return map;
  }, [wizardStep, completedSteps, redEntries.length, amberEntries.length, scan]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const toggleOne = useCallback((id: Id<"courseVocabulary">): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setHasExported(false);
    setConfirmText("");
  }, []);

  const selectAllInCategories = useCallback((cats: ProblemCategory[]): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const cat of cats) {
        for (const c of grouped.get(cat) ?? []) next.add(String(c._id));
      }
      return next;
    });
    setHasExported(false);
    setConfirmText("");
  }, [grouped]);

  const clearAllInCategories = useCallback((cats: ProblemCategory[]): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const cat of cats) {
        for (const c of grouped.get(cat) ?? []) next.delete(String(c._id));
      }
      return next;
    });
    setHasExported(false);
    setConfirmText("");
  }, [grouped]);

  const handleScan = (): void => {
    setScanEnabled(true);
    setSelectedIds(new Set());
    setHasExported(false);
    setConfirmText("");
    setHasAutoSelected(false);
    setCompletedSteps(new Set());
    setWizardStep("idle");
  };

  const handleExport = (): void => {
    if (selectedEntries.length === 0) {
      toast.error("No entries selected to export.");
      return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
    downloadBackupJson(`vocabulary-cleanup-backup-${stamp}.json`, selectedEntries);
    setHasExported(true);
    toast.success(`Exported backup of ${selectedEntries.length} entries.`);
  };

  const handleWhitelistOkEntries = async (): Promise<void> => {
    const unselectedOk = okEntries.filter((c) => !selectedIds.has(String(c._id)));
    if (unselectedOk.length === 0) {
      toast.error("No entries to whitelist.");
      return;
    }
    setWhitelisting(true);
    try {
      const ids = unselectedOk.map((c) => c._id);
      const result = await addToAllowlist({ ids, source: "cleanup_panel" });
      const parts = [`Confirmed ${result.added} as real vocabulary`];
      if (result.updated > 0) parts.push(`${result.updated} refreshed`);
      toast.success(parts.join(" · "));
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Whitelisting failed.");
    } finally {
      setWhitelisting(false);
    }
  };

  const handleRemoveFromAllowlist = async (id: Id<"vocabularyProperNounAllowlist">): Promise<void> => {
    try {
      const result = await removeFromAllowlist({ ids: [id] });
      if (result.removed > 0) toast.success("Removed from allowlist.");
      else toast.error("Entry not found.");
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Remove failed.");
    }
  };

  const handleRemoveFromBlacklist = async (id: Id<"vocabularyNameBlacklist">): Promise<void> => {
    try {
      const result = await removeFromBlacklist({ ids: [id] });
      if (result.removed > 0) toast.success("Removed from blacklist. Word can be added as vocabulary again.");
      else toast.error("Entry not found.");
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Remove failed.");
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!canDelete) return;
    setDeleting(true);
    try {
      const ids = selectedEntries.map((c) => c._id);
      const reviewedKeepIds = categorized
        .filter((c) => !selectedIds.has(String(c._id)))
        .map((c) => c._id);
      const result = await bulkDelete({ ids, confirm: expectedConfirm, reviewedKeepIds });
      const parts = [`Removed ${result.deletedVocabulary} entries`];
      if (result.allowlisted > 0) parts.push(`${result.allowlisted} confirmed as real words`);
      toast.success(parts.join(", ") + ".");
      setSelectedIds(new Set());
      setHasExported(false);
      setConfirmText("");
      setHasAutoSelected(false);
      setCompletedSteps((prev) => new Set([...prev, "finalize"]));
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Bulk delete failed.");
    } finally {
      setDeleting(false);
    }
  };


  const goToStep = useCallback((step: WizardStep): void => {
    if (wizardStep !== "idle") {
      setCompletedSteps((prev) => new Set([...prev, wizardStep]));
    }
    setWizardStep(step);
  }, [wizardStep]);

  const goNext = useCallback((): void => {
    const idx = stepIndex(wizardStep);
    if (idx < WIZARD_STEPS.length - 1) {
      goToStep(WIZARD_STEPS[idx + 1].key);
    }
  }, [wizardStep, goToStep]);

  const goBack = useCallback((): void => {
    const idx = stepIndex(wizardStep);
    if (idx > 0) {
      setWizardStep(WIZARD_STEPS[idx - 1].key);
    }
  }, [wizardStep]);

  // Sticky action bar ref
  const actionBarRef = useRef<HTMLDivElement>(null);

  return (
    <Card className="border-amber-300/60 dark:border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/10">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <CardTitle className="text-sm">Vocabulary Cleanup</CardTitle>
          <div className="ml-auto flex items-center gap-2">
            {scan && (
              <span className="text-[11px] text-muted-foreground">
                {scan.totalScanned} entries · {formatTimestamp(scan.scannedAt)}
              </span>
            )}
            <Button size="sm" variant="outline" className="h-7 text-[11px]"
              onClick={handleScan} disabled={scanEnabled && !scan}>
              {scanEnabled && !scan ? (
                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Scanning...</>
              ) : scan ? (
                <><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Rescan</>
              ) : (
                <><Search className="mr-1.5 h-3.5 w-3.5" />Scan database</>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Wizard stepper */}
        {wizardStep !== "idle" && (
          <StepIndicator
            currentStep={wizardStep}
            stepStatuses={stepStatuses}
            onNavigate={goToStep}
          />
        )}

        {/* Loading state */}
        {scanEnabled && !scan && wizardStep === "idle" && (
          <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Scanning course vocabulary...
          </div>
        )}

        {/* ── Step: Overview ─────────────────────────────────────────────── */}
        {wizardStep === "overview" && scan && (
          <div className="space-y-3">
            {categorized.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center border rounded bg-muted/20">
                <Check className="inline h-4 w-4 mr-1 text-emerald-600" />
                No problematic entries found. Vocabulary looks clean.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="border rounded-md p-2 bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40">
                    <div className="text-lg font-bold text-red-700 dark:text-red-400">{redEntries.length}</div>
                    <div className="text-[10px] text-red-600 dark:text-red-400">Auto-Remove</div>
                  </div>
                  <div className="border rounded-md p-2 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40">
                    <div className="text-lg font-bold text-amber-700 dark:text-amber-400">{amberEntries.length}</div>
                    <div className="text-[10px] text-amber-600 dark:text-amber-400">Manual Review</div>
                  </div>
                  <div className="border rounded-md p-2 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40">
                    <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{okEntries.length}</div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400">Looks OK</div>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground leading-relaxed border-l-2 border-blue-400/50 pl-2 bg-blue-50/30 dark:bg-blue-950/10 py-2 pr-2 rounded-r space-y-1.5">
                  <p><strong>Guided cleanup workflow:</strong></p>
                  <p>
                    This wizard walks you through the cleanup step by step.
                    First, review auto-detected issues (function words, names).
                    Then, manually decide on ambiguous entries.
                    Finally, confirm and execute all removals.
                  </p>
                  <p>
                    <strong>Ticked = will be removed</strong> from vocabulary and blacklisted.{" "}
                    <strong>Unticked = stays</strong> as valid vocabulary and gets allowlisted.
                  </p>
                  <p className="text-[10px] italic">
                    Note: Duplicates are handled automatically during unit publishing.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button size="sm" className="h-8 text-xs" onClick={goNext}>
                    Start Review <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step: Auto-Remove (Red) ────────────────────────────────────── */}
        {wizardStep === "auto_remove" && (
          <div className="space-y-3">
            <div className="text-[11px] text-muted-foreground leading-relaxed border-l-2 border-red-400/50 pl-2 bg-red-50/30 dark:bg-red-950/10 py-2 pr-2 rounded-r">
              <strong>Step 2: Auto-Detected Issues</strong> — These entries are almost certainly wrong
              and are already pre-ticked for removal. Review each category and untick any word
              you want to keep.
            </div>

            {redEntries.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center border rounded bg-muted/20">
                <Check className="inline h-4 w-4 mr-1 text-emerald-600" />
                No auto-detected issues. Everything looks clean.
              </div>
            ) : (
              <div className="space-y-3">
                {redCategories.map((cat) => {
                  const entries = grouped.get(cat) ?? [];
                  if (entries.length === 0) return null;
                  const config = CATEGORY_CONFIG[cat];
                  return (
                    <div key={cat} className="border rounded-md bg-background p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${config.badgeClass}`}>
                          {entries.length}
                        </Badge>
                        <span className="text-xs font-medium">{config.label}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{config.description}</p>
                      <CategoryTable
                        entries={entries}
                        selectedIds={selectedIds}
                        onToggle={toggleOne}
                        onSelectAll={() => selectAllInCategories([cat])}
                        onClearAll={() => clearAllInCategories([cat])}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <WizardNav onBack={goBack} onNext={goNext} />
          </div>
        )}

        {/* ── Step: Manual Review (Amber) ─────────────────────────────────── */}
        {wizardStep === "manual_review" && (
          <div className="space-y-3">
            <div className="text-[11px] text-muted-foreground leading-relaxed border-l-2 border-amber-400/50 pl-2 bg-amber-50/30 dark:bg-amber-950/10 py-2 pr-2 rounded-r">
              <strong>Step 3: Manual Review</strong> — These entries need your decision.
              The system cannot determine automatically whether they are valid vocabulary or not.
              Read the description in each section carefully.
            </div>

            {amberEntries.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center border rounded bg-muted/20">
                <Check className="inline h-4 w-4 mr-1 text-emerald-600" />
                No entries need manual review.
              </div>
            ) : (
              <div className="space-y-3">
                {amberCategories.map((cat) => {
                  const entries = grouped.get(cat) ?? [];
                  if (entries.length === 0) return null;
                  const config = CATEGORY_CONFIG[cat];
                  return (
                    <div key={cat} className="border rounded-md bg-background p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${config.badgeClass}`}>
                          {entries.length}
                        </Badge>
                        <span className="text-xs font-medium">{config.label}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{config.description}</p>
                      <CategoryTable
                        entries={entries}
                        selectedIds={selectedIds}
                        onToggle={toggleOne}
                        onSelectAll={() => selectAllInCategories([cat])}
                        onClearAll={() => clearAllInCategories([cat])}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <WizardNav onBack={goBack} onNext={goNext} />
          </div>
        )}


        {/* ── Step: Finalize ──────────────────────────────────────────────── */}
        {wizardStep === "finalize" && (
          <div className="space-y-3">
            <div className="text-[11px] text-muted-foreground leading-relaxed border-l-2 border-emerald-400/50 pl-2 bg-emerald-50/30 dark:bg-emerald-950/10 py-2 pr-2 rounded-r">
              <strong>Step 4: Finalize</strong> — Review your decisions, optionally confirm
              green entries as real vocabulary, then export a backup and execute the removal.
            </div>

            {/* Green entries */}
            {okEntries.length > 0 && (
              <div className="border rounded-md bg-background p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-400 dark:text-emerald-400">
                    {okEntries.length}
                  </Badge>
                  <span className="text-xs font-medium">Entries that look correct</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  {CATEGORY_CONFIG.looks_ok.description}
                </p>
                <CategoryTable
                  entries={okEntries}
                  selectedIds={selectedIds}
                  onToggle={toggleOne}
                  onSelectAll={() => selectAllInCategories(["looks_ok"])}
                  onClearAll={() => clearAllInCategories(["looks_ok"])}
                />
                <Button size="sm" variant="outline"
                  className="h-7 text-[11px] border-emerald-400/70 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/50 dark:text-emerald-400"
                  disabled={whitelisting || okEntries.length === 0}
                  onClick={() => void handleWhitelistOkEntries()}>
                  {whitelisting ? (
                    <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Confirming...</>
                  ) : (
                    <><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Confirm all as real vocabulary ({okEntries.length})</>
                  )}
                </Button>
              </div>
            )}

            {/* Summary */}
            <div className="border rounded-md bg-background p-3 space-y-2">
              <span className="text-xs font-medium">Removal Summary</span>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                {redCategories.map((cat) => {
                  const entries = grouped.get(cat) ?? [];
                  const marked = entries.filter((c) => selectedIds.has(String(c._id))).length;
                  return (
                    <div key={cat} className="border rounded p-1.5">
                      <div className="font-bold text-sm">{marked}</div>
                      <div className="text-muted-foreground">{CATEGORY_CONFIG[cat].label}</div>
                    </div>
                  );
                })}
              </div>
              {amberEntries.length > 0 && (
                <div className="grid grid-cols-2 gap-2 text-center text-[10px]">
                  {amberCategories.map((cat) => {
                    const entries = grouped.get(cat) ?? [];
                    const marked = entries.filter((c) => selectedIds.has(String(c._id))).length;
                    return (
                      <div key={cat} className="border rounded p-1.5">
                        <div className="font-bold text-sm">{marked} / {entries.length}</div>
                        <div className="text-muted-foreground">{CATEGORY_CONFIG[cat].label}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sticky action bar */}
            <div ref={actionBarRef} className="sticky bottom-0 bg-background/95 backdrop-blur border-t pt-3 pb-1 space-y-2 -mx-3 px-3 z-10">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium">
                  {selectedCount} entries will be removed
                </span>
                <Button size="sm" variant="outline" className="ml-auto h-7 text-[11px]"
                  disabled={selectedCount === 0} onClick={handleExport}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  1. Export backup
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={
                    selectedCount === 0 ? "Nothing selected"
                      : !hasExported ? "Export backup first (step 1)"
                      : `2. Type "${expectedConfirm}"`
                  }
                  className="h-8 text-xs max-w-sm font-mono"
                  disabled={selectedCount === 0 || !hasExported}
                />
                <Button size="sm" variant="destructive" className="h-8 text-xs"
                  disabled={!canDelete || deleting} onClick={handleDelete}>
                  {deleting ? (
                    <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Removing...</>
                  ) : (
                    <><Trash2 className="mr-1.5 h-3.5 w-3.5" />3. Remove ({selectedCount})</>
                  )}
                </Button>
              </div>

              {selectedCount > 0 && !hasExported && (
                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                  Safety measure: download a backup before removal is enabled.
                </p>
              )}
              {selectedCount > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  When you confirm: <strong>ticked entries</strong> are removed + blacklisted.{" "}
                  <strong>All unticked entries</strong> are automatically saved as confirmed real vocabulary
                  (allowlisted) — they will never appear in cleanup again.
                </p>
              )}
            </div>

            <div className="flex justify-start pt-1">
              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={goBack}>
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
              </Button>
            </div>
          </div>
        )}

        {/* ── Idle state (no scan yet) ────────────────────────────────────── */}
        {wizardStep === "idle" && !scanEnabled && (
          <div className="text-xs text-muted-foreground py-4 text-center border rounded bg-muted/20">
            Click <strong>Scan database</strong> to analyze vocabulary entries for potential issues.
          </div>
        )}

        {/* ── Always visible: Allowlist & Blacklist ──────────────────────── */}
        <div className="border-t pt-3 space-y-2">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            Persistent Decision Lists
          </p>
          <AllowlistSection entries={allowlist ?? []} onRemove={handleRemoveFromAllowlist} />
          <BlacklistSection entries={blacklist ?? []} onRemove={handleRemoveFromBlacklist} />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Wizard navigation helper
// ---------------------------------------------------------------------------
function WizardNav({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center justify-between pt-1">
      <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={onBack}>
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
      </Button>
      <Button size="sm" className="h-7 text-[11px]" onClick={onNext}>
        Continue <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
