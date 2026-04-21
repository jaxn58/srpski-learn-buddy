import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

import {
  AlertTriangle,
  Download,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types (mirror the server return type of scanProperNounCandidates)
// ---------------------------------------------------------------------------
type CleanupCandidate = {
  _id: Id<"courseVocabulary">;
  serbian: string;
  unitNumber: number;
  en?: string;
  de?: string;
  noteEn?: string;
  noteDe?: string;
  matchesHeuristic: boolean;
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function downloadBackupJson(
  filename: string,
  entries: CleanupCandidate[]
): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    count: entries.length,
    entries,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Release the object URL on next tick to allow the download to start.
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
// Component
// ---------------------------------------------------------------------------

/**
 * Admin panel for reviewing and cleaning up vocabulary entries that were
 * wrongly inserted into `courseVocabulary` — primarily personal names.
 *
 * Flow:
 *   1. Click "Scan database" → server returns two sections (auto-added vs.
 *      heuristic-only).
 *   2. Admin ticks the rows to remove.
 *   3. "Export JSON backup" downloads the selected rows as a JSON file
 *      (required step — delete is locked until a backup has been exported).
 *   4. Admin types the confirmation string and clicks "Delete selected".
 *
 * Only superadmins can execute the underlying query/mutation (server-side
 * guard). The panel is collapsed by default.
 */
export function VocabularyCleanupPanel() {
  const [scanEnabled, setScanEnabled] = useState(false);
  const scan = useQuery(
    api.contentStudio.scanProperNounCandidates,
    scanEnabled ? {} : "skip"
  ) as ScanReport | undefined;

  const bulkDelete = useMutation(api.contentStudio.bulkDeleteVocabularyByIds);
  const addToAllowlist = useMutation(
    api.contentStudio.addToProperNounAllowlist
  );
  const removeFromAllowlist = useMutation(
    api.contentStudio.removeFromProperNounAllowlist
  );
  const allowlist = useQuery(
    api.contentStudio.getProperNounAllowlist,
    {}
  ) as AllowlistEntry[] | undefined;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [hasExported, setHasExported] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [whitelisting, setWhitelisting] = useState(false);

  const autoAdded = scan?.autoAddedCandidates ?? [];
  const heuristicOnly = scan?.heuristicOnlyCandidates ?? [];

  const filterLower = filter.trim().toLowerCase();
  const filterMatches = (c: CleanupCandidate): boolean => {
    if (!filterLower) return true;
    const hay = `${c.serbian} ${c.en ?? ""} ${c.de ?? ""} u${c.unitNumber}`.toLowerCase();
    return hay.includes(filterLower);
  };

  const visibleAutoAdded = useMemo(
    () => autoAdded.filter(filterMatches),
    // filter dependency handled via filterLower inside filterMatches
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [autoAdded, filterLower]
  );
  const visibleHeuristic = useMemo(
    () => heuristicOnly.filter(filterMatches),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heuristicOnly, filterLower]
  );

  const selectedCount = selectedIds.size;
  const selectedEntries = useMemo<CleanupCandidate[]>(() => {
    const all = [...autoAdded, ...heuristicOnly];
    return all.filter((c) => selectedIds.has(String(c._id)));
  }, [autoAdded, heuristicOnly, selectedIds]);

  const expectedConfirm = `DELETE ${selectedCount} VOCABULARY`;
  const canDelete =
    selectedCount > 0 && hasExported && confirmText === expectedConfirm;

  const toggleOne = (id: Id<"courseVocabulary">): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setHasExported(false);
    setConfirmText("");
  };

  const selectAllIn = (items: CleanupCandidate[]): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const c of items) next.add(String(c._id));
      return next;
    });
    setHasExported(false);
    setConfirmText("");
  };

  const clearAllIn = (items: CleanupCandidate[]): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const c of items) next.delete(String(c._id));
      return next;
    });
    setHasExported(false);
    setConfirmText("");
  };

  const handleScan = (): void => {
    setScanEnabled(true);
    setSelectedIds(new Set());
    setHasExported(false);
    setConfirmText("");
  };

  const handleExport = (): void => {
    if (selectedEntries.length === 0) {
      toast.error("No entries selected to export.");
      return;
    }
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .slice(0, 19);
    downloadBackupJson(
      `vocabulary-cleanup-backup-${stamp}.json`,
      selectedEntries
    );
    setHasExported(true);
    toast.success(
      `Exported backup of ${selectedEntries.length} vocabulary entries.`
    );
  };

  // Whitelists all UNCHECKED, currently visible entries in the heuristic-only
  // section. The admin's mental model is "checked = is a name → delete,
  // unchecked = not a name → whitelist". We never whitelist from the auto-added
  // section because those entries are strong deletion candidates, not
  // "confirmed regular vocabulary". One-click action, fully reversible via
  // the allowlist section below.
  const heuristicUncheckedVisible = useMemo(
    () => visibleHeuristic.filter((c) => !selectedIds.has(String(c._id))),
    [visibleHeuristic, selectedIds]
  );

  const handleWhitelistUnchecked = async (): Promise<void> => {
    if (heuristicUncheckedVisible.length === 0) {
      toast.error("No unchecked heuristic entries to whitelist.");
      return;
    }
    setWhitelisting(true);
    try {
      const ids = heuristicUncheckedVisible.map((c) => c._id);
      const result = await addToAllowlist({
        ids,
        source: "cleanup_panel",
      });
      const parts = [`Marked ${result.added} as "not a name"`];
      if (result.updated > 0) parts.push(`${result.updated} refreshed`);
      if (result.missing > 0) parts.push(`${result.missing} missing`);
      toast.success(parts.join(" · "));
    } catch (e: any) {
      toast.error(e?.message ?? "Whitelisting failed.");
    } finally {
      setWhitelisting(false);
    }
  };

  const handleRemoveFromAllowlist = async (
    id: Id<"vocabularyProperNounAllowlist">
  ): Promise<void> => {
    try {
      const result = await removeFromAllowlist({ ids: [id] });
      if (result.removed > 0) {
        toast.success("Removed from allowlist. Heuristic will flag it again.");
      } else {
        toast.error("Entry not found in allowlist.");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Remove failed.");
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!canDelete) return;
    setDeleting(true);
    try {
      const ids = selectedEntries.map((c) => c._id);
      const result = await bulkDelete({
        ids,
        confirm: expectedConfirm,
      });
      toast.success(
        `Deleted ${result.deletedVocabulary} vocabulary entries and ${result.deletedProgress} progress rows.`
      );
      setSelectedIds(new Set());
      setHasExported(false);
      setConfirmText("");
      // Convex reactivity refreshes the scan automatically since query args
      // didn't change, so the candidate list shrinks on its own.
    } catch (e: any) {
      toast.error(e?.message ?? "Bulk delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Card className="border-amber-300/60 dark:border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/10">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <CardTitle className="text-sm">Vocabulary Cleanup</CardTitle>
          <span className="text-xs text-muted-foreground">
            Remove personal names and other wrong auto-added entries
          </span>
          <div className="ml-auto flex items-center gap-2">
            {scan && (
              <span className="text-[11px] text-muted-foreground">
                Scanned {scan.totalScanned} entries in {scan.unitsScanned} unit(s) ·{" "}
                {formatTimestamp(scan.scannedAt)}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={handleScan}
              disabled={scanEnabled && !scan}
            >
              {scanEnabled && !scan ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Scanning…
                </>
              ) : scan ? (
                <>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Rescan
                </>
              ) : (
                <>
                  <Search className="mr-1.5 h-3.5 w-3.5" />
                  Scan database
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {scanEnabled && (
        <CardContent className="space-y-3">
          {!scan ? (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Scanning course vocabulary…
            </div>
          ) : (
            <>
              {/* Filter input */}
              <div className="relative max-w-xs">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter by word, translation or unit…"
                  className="pl-7 h-8 text-xs"
                />
              </div>

              <Accordion
                type="multiple"
                defaultValue={["autoAdded"]}
                className="space-y-2"
              >
                <CleanupSection
                  id="autoAdded"
                  label="Auto-added entries"
                  description='Entries whose noteEn contains "AutoAdded: new vocabulary used in exercises". High confidence they are wrong.'
                  tone="destructive"
                  items={visibleAutoAdded}
                  totalCount={autoAdded.length}
                  selectedIds={selectedIds}
                  onToggle={toggleOne}
                  onSelectAll={() => selectAllIn(visibleAutoAdded)}
                  onClearAll={() => clearAllIn(visibleAutoAdded)}
                />
                <CleanupSection
                  id="heuristicOnly"
                  label="Heuristic-only matches"
                  description='No AutoAdded marker, but the name heuristic thinks this is a personal name. Tick the rows that ARE names (→ "Delete selected") — leave the rest unticked and click "Mark unchecked as not a name" to whitelist them permanently.'
                  tone="warning"
                  items={visibleHeuristic}
                  totalCount={heuristicOnly.length}
                  selectedIds={selectedIds}
                  onToggle={toggleOne}
                  onSelectAll={() => selectAllIn(visibleHeuristic)}
                  onClearAll={() => clearAllIn(visibleHeuristic)}
                  whitelistAction={{
                    uncheckedCount: heuristicUncheckedVisible.length,
                    onClick: handleWhitelistUnchecked,
                    busy: whitelisting,
                  }}
                />
              </Accordion>

              <AllowlistPanel
                entries={allowlist ?? []}
                onRemove={handleRemoveFromAllowlist}
              />

              {/* Action bar */}
              <div className="border-t pt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium">
                    {selectedCount} entr{selectedCount === 1 ? "y" : "ies"} selected
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-7 text-[11px]"
                    disabled={selectedCount === 0}
                    onClick={handleExport}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Export JSON backup
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={
                      selectedCount === 0
                        ? "Select entries first"
                        : `Type "${expectedConfirm}" to confirm`
                    }
                    className="h-8 text-xs max-w-sm font-mono"
                    disabled={selectedCount === 0 || !hasExported}
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 text-xs"
                    disabled={!canDelete || deleting}
                    onClick={handleDelete}
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Deleting…
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Delete selected ({selectedCount})
                      </>
                    )}
                  </Button>
                </div>

                {selectedCount > 0 && !hasExported && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    Export a JSON backup first — the delete button unlocks once the
                    backup has been downloaded.
                  </p>
                )}
                {selectedCount > 0 && hasExported && !canDelete && (
                  <p className="text-[11px] text-muted-foreground">
                    Backup exported. Type{" "}
                    <span className="font-mono">{expectedConfirm}</span> above to
                    unlock the delete button.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Section (accordion item rendering one candidate list)
// ---------------------------------------------------------------------------
function CleanupSection({
  id,
  label,
  description,
  tone,
  items,
  totalCount,
  selectedIds,
  onToggle,
  onSelectAll,
  onClearAll,
  whitelistAction,
}: {
  id: string;
  label: string;
  description: string;
  tone: "destructive" | "warning";
  items: CleanupCandidate[];
  totalCount: number;
  selectedIds: Set<string>;
  onToggle: (id: Id<"courseVocabulary">) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  whitelistAction?: {
    uncheckedCount: number;
    onClick: () => void | Promise<void>;
    busy: boolean;
  };
}) {
  const selectedInSection = items.filter((c) =>
    selectedIds.has(String(c._id))
  ).length;

  const badge =
    tone === "destructive" ? (
      <Badge variant="destructive" className="text-[10px]">
        {totalCount}
      </Badge>
    ) : (
      <Badge
        variant="outline"
        className="text-[10px] text-amber-700 border-amber-400 dark:text-amber-400 dark:border-amber-500/60"
      >
        {totalCount}
      </Badge>
    );

  return (
    <AccordionItem value={id} className="border rounded-md bg-background">
      <AccordionTrigger className="px-3 py-2 hover:no-underline">
        <div className="flex flex-1 items-center gap-2 pr-2">
          {badge}
          <span className="text-sm font-medium">{label}</span>
          {selectedInSection > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {selectedInSection} selected
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-3 pb-3">
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {description}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              disabled={items.length === 0}
              onClick={onSelectAll}
            >
              Select all visible ({items.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              disabled={selectedInSection === 0}
              onClick={onClearAll}
            >
              Clear visible
            </Button>
            {whitelistAction && (
              <Button
                size="sm"
                variant="outline"
                className="ml-auto h-7 text-[11px] border-emerald-400/70 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                disabled={
                  whitelistAction.uncheckedCount === 0 || whitelistAction.busy
                }
                onClick={() => void whitelistAction.onClick()}
                title='Mark all unchecked visible rows as "not a name" so the heuristic stops flagging them.'
              >
                {whitelistAction.busy ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Whitelisting…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                    Mark unchecked as not a name (
                    {whitelistAction.uncheckedCount})
                  </>
                )}
              </Button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center border rounded bg-muted/20">
              {totalCount === 0
                ? "No candidates found in this section."
                : "No entries match the current filter."}
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto overflow-x-hidden rounded border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                  <tr className="border-b">
                    <th className="px-2 py-1.5 text-left w-[36px]"></th>
                    <th className="px-2 py-1.5 text-left w-[50px]">Unit</th>
                    <th className="px-2 py-1.5 text-left">Serbian</th>
                    <th className="px-2 py-1.5 text-left">EN</th>
                    <th className="px-2 py-1.5 text-left">DE</th>
                    <th className="px-2 py-1.5 text-left">Heuristic</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => {
                    const key = String(c._id);
                    const isSelected = selectedIds.has(key);
                    return (
                      <tr
                        key={key}
                        className={`border-b last:border-0 ${
                          isSelected ? "bg-accent/50" : ""
                        } hover:bg-muted/40 transition-colors`}
                      >
                        <td className="px-2 py-1.5">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => onToggle(c._id)}
                          />
                        </td>
                        <td className="px-2 py-1.5 font-mono text-[11px]">
                          U{c.unitNumber}
                        </td>
                        <td className="px-2 py-1.5 font-medium">{c.serbian}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {c.en ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {c.de ?? "—"}
                        </td>
                        <td className="px-2 py-1.5">
                          {c.matchesHeuristic ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-amber-700 border-amber-400 dark:text-amber-400 dark:border-amber-500/60"
                            >
                              name-like
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// ---------------------------------------------------------------------------
// Allowlist panel (admin-confirmed "not-a-name" entries)
// ---------------------------------------------------------------------------
function AllowlistPanel({
  entries,
  onRemove,
}: {
  entries: AllowlistEntry[];
  onRemove: (id: Id<"vocabularyProperNounAllowlist">) => void | Promise<void>;
}) {
  const [removingId, setRemovingId] =
    useState<Id<"vocabularyProperNounAllowlist"> | null>(null);

  const handleRemove = async (
    id: Id<"vocabularyProperNounAllowlist">
  ): Promise<void> => {
    setRemovingId(id);
    try {
      await onRemove(id);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Accordion type="multiple" className="space-y-2">
      <AccordionItem
        value="allowlist"
        className="border rounded-md bg-background"
      >
        <AccordionTrigger className="px-3 py-2 hover:no-underline">
          <div className="flex flex-1 items-center gap-2 pr-2">
            <Badge
              variant="outline"
              className="text-[10px] text-emerald-700 border-emerald-400 dark:text-emerald-400 dark:border-emerald-500/60"
            >
              {entries.length}
            </Badge>
            <span className="text-sm font-medium">
              Allowlisted words (confirmed not-a-name)
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">
            These Serbian tokens are permanently exempted from the name
            heuristic and the AI classifier's proper-noun filter. Remove an
            entry if it was whitelisted by mistake — the filter will flag it
            again on the next scan or validator run.
          </p>

          {entries.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center border rounded bg-muted/20">
              No allowlisted words yet. Use "Mark unchecked as not a name" in
              the heuristic section above to add entries here.
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto overflow-x-hidden rounded border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                  <tr className="border-b">
                    <th className="px-2 py-1.5 text-left">Serbian (original)</th>
                    <th className="px-2 py-1.5 text-left">Normalized key</th>
                    <th className="px-2 py-1.5 text-left">Confirmed at</th>
                    <th className="px-2 py-1.5 text-left w-[90px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr
                      key={String(e._id)}
                      className="border-b last:border-0 hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-2 py-1.5 font-medium">
                        {e.serbianOriginal}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
                        {e.serbianNormalized}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {formatTimestamp(e.confirmedAt)}
                      </td>
                      <td className="px-2 py-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[11px] text-muted-foreground hover:text-destructive"
                          disabled={removingId === e._id}
                          onClick={() => void handleRemove(e._id)}
                          title="Remove from allowlist"
                        >
                          {removingId === e._id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <X className="mr-1 h-3 w-3" />
                              Remove
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
