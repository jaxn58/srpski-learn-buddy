import { readFileSync, writeFileSync } from "fs";

const FILE = "d:\\DEVELOPMENT\\Cursor\\srpski-tutor-en\\client\\src\\pages\\ContentStudioAdmin.tsx";
const content = readFileSync(FILE, "utf-8");
const lines = content.split("\n");

function range(start, end) {
  return lines.slice(start - 1, end).join("\n");
}

const NEW_IMPORTS = `import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { CheckCircle, Sparkles, Loader2, Settings, Plus, LayoutList } from "lucide-react";
import { UnitManagerTab } from "@/components/admin/UnitManagerTab";
import { SettingsSheet } from "@/components/admin/contentStudio/SettingsSheet";
import { MetricsCard } from "@/components/admin/contentStudio/MetricsCard";
import { DraftList } from "@/components/admin/contentStudio/DraftList";
import { ArtifactsPanel } from "@/components/admin/contentStudio/ArtifactsPanel";
import { QAFindingsPanel } from "@/components/admin/contentStudio/QAFindingsPanel";
import { PublishPanel } from "@/components/admin/contentStudio/PublishPanel";
import { DraftStatusBadge } from "@/components/admin/contentStudio/StatusBadge";
import type { Mode, Provider, StageKey, SectionId, NextStepKey, StepId, SettingsTab, StudioView } from "@/components/admin/contentStudio/types";
import { CONTENT_STUDIO_DIALOG_WIDTH, SECTION_OPTIONS, isKnownModel, stageOrderedModels } from "@/components/admin/contentStudio/constants";
import { buildSideBySideDiffRows } from "@/components/admin/contentStudio/utils/diffAlgorithm";`;

const STATUS_BADGE_REPLACEMENT = `  const statusBadge = useMemo(() => {
    return <DraftStatusBadge status={selected?.draft?.status} />;
  }, [selected?.draft?.status]);`;

const METRICS_CARD_REPLACEMENT = `        <MetricsCard studioMetrics={studioMetrics} />`;

const DRAFT_LIST_REPLACEMENT = `        <DraftList
          drafts={drafts}
          filteredDrafts={filteredDrafts}
          selectedDraftId={selectedDraftId}
          onSelectDraft={handleSelectDraft}
          draftsSearch={draftsSearch}
          setDraftsSearch={setDraftsSearch}
          draftsStatusFilter={draftsStatusFilter}
          setDraftsStatusFilter={setDraftsStatusFilter}
          batchSelectedDraftIds={batchSelectedDraftIds}
          toggleBatchSelectDraft={toggleBatchSelectDraft}
          selectAllFilteredDrafts={selectAllFilteredDrafts}
          clearBatchSelection={clearBatchSelection}
          batchRunning={batchRunning}
          batchProgress={batchProgress}
          batchResults={batchResults}
          isBusy={isBusy}
          onRunBatch={runBatch}
        />`;

const ARTIFACTS_PANEL_REPLACEMENT = `              <ArtifactsPanel
                selected={selected}
                selectedDraftId={selectedDraftId}
                isBusy={isBusy}
                runningPublish={runningPublish}
                markdownText={markdownText}
                setMarkdownText={setMarkdownText}
                markdownDirty={markdownDirty}
                restoreMarkdownText={restoreMarkdownText}
                setRestoreMarkdownText={setRestoreMarkdownText}
                setRestoreMarkdownUpdatedAt={setRestoreMarkdownUpdatedAt}
                restoreMarkdownUpdatedAt={restoreMarkdownUpdatedAt}
                markdownLocalStorageKey={markdownLocalStorageKey}
                unitPackageJson={unitPackageJson}
                setUnitPackageJson={setUnitPackageJson}
                preview={preview}
                draftSnapshots={draftSnapshots}
                diffLeftSnapshotId={diffLeftSnapshotId}
                setDiffLeftSnapshotId={setDiffLeftSnapshotId}
                diffRightSnapshotId={diffRightSnapshotId}
                setDiffRightSnapshotId={setDiffRightSnapshotId}
                diffRows={diffRows}
                onSaveMarkdown={handleSaveMarkdown}
                onSaveAndPublishToPreview={handleSaveAndPublishToPreview}
                onCopyMarkdown={handleCopyMarkdown}
                onDownloadMarkdown={handleDownloadMarkdown}
                onLoadMarkdownFromSnapshot={handleLoadMarkdownFromSnapshot}
                onLoadFromSnapshot={handleLoadFromSnapshot}
                onSaveJson={handleSaveJson}
                t={t}
              />`;

const QA_FINDINGS_REPLACEMENT = `              <QAFindingsPanel
                findings={findings}
                errorFindings={errorFindings}
                warningFindings={warningFindings}
                latestReport={latestReport}
                selected={selected}
                isBusy={isBusy}
                runningRevise={runningRevise}
                fixHumanNotes={fixHumanNotes}
                setFixHumanNotes={setFixHumanNotes}
                onRunRevise={handleRunRevise}
                onDismissFinding={dismissFinding}
              />`;

const PUBLISH_PANEL_REPLACEMENT = `              <PublishPanel
                selected={selected}
                selectedDraftId={selectedDraftId}
                isBusy={isBusy}
                runningPublish={runningPublish}
                runningTranslateDe={runningTranslateDe}
                runningApprovePreview={runningApprovePreview}
                publishMode={publishMode}
                setPublishMode={setPublishMode}
                publishModuleId={publishModuleId}
                setPublishModuleId={setPublishModuleId}
                modules={modules}
                canPublishLive={canPublishLive}
                approvedMarkdown={approvedMarkdown}
                translateDeOpen={translateDeOpen}
                setTranslateDeOpen={setTranslateDeOpen}
                translateDeConfirmation={translateDeConfirmation}
                setTranslateDeConfirmation={setTranslateDeConfirmation}
                translateDePreview={translateDePreview}
                deleteUnitOpen={deleteUnitOpen}
                setDeleteUnitOpen={setDeleteUnitOpen}
                deleteConfirmation={deleteConfirmation}
                setDeleteConfirmation={setDeleteConfirmation}
                onPublishToPreview={handlePublishToPreview}
                onTakePreviewOffline={handleTakePreviewOffline}
                onApprovePreview={handleApprovePreview}
                onDownloadApprovedMarkdown={handleDownloadApprovedMarkdown}
                onPublish={handlePublish}
                onDeleteUnit={handleDeleteUnit}
                onTranslatePublishedToGerman={handleTranslatePublishedToGerman}
                cfgSpecialistProvider={cfgSpecialistProvider}
              />`;

const parts = [];

// 1. New imports
parts.push(NEW_IMPORTS);
parts.push("");

// 2. Function declaration + body up to section revision comment (lines 315-435)
parts.push(range(315, 435));

// 3. Skip line 436 (type SectionId), keep 437-438 (expandSection, expandInstruction useState)
parts.push(range(437, 438));

// 4. Skip lines 439-446 (SECTION_OPTIONS), keep 447-606
parts.push(range(447, 606));

// 5. Skip line 607 (type NextStepKey), keep 608-645
parts.push(range(608, 645));

// 6. Replace statusBadge useMemo (lines 646-660) with DraftStatusBadge version
parts.push(STATUS_BADGE_REPLACEMENT);
parts.push("");

// 7. Skip lines 661-676 (empty + renderDraftStatusPill), keep 677-721
parts.push(range(677, 721));

// 8. Skip line 722 (type StepId), keep 723-2338
parts.push(range(723, 2338));

// 9. NEW RETURN BLOCK - keep SettingsSheet call, header, dialog, unit manager, 
//    replace metrics/draftlist/artifacts/qa/publish cards
// Lines 2339-2420: return( + SettingsSheet - KEEP
parts.push(range(2339, 2420));

// Lines 2421-2585: Page Header + Create Draft Dialog + Unit Manager - KEEP
parts.push(range(2421, 2585));

// Line 2586-2587: comment + opening of drafts view - modify
parts.push("");
parts.push("      {/* Draft Studio view */}");
parts.push('      {studioView === "drafts" && (');
parts.push('        <div className="grid gap-6">');

// Metrics Card - REPLACE (was lines 2589-2635)
parts.push(METRICS_CARD_REPLACEMENT);
parts.push("");

// Draft List - REPLACE (was lines 2637-2809)
parts.push("        {/* Drafts */}");
parts.push(DRAFT_LIST_REPLACEMENT);
parts.push("");

// Middle pane: Workspace - KEEP structure, replace artifacts
// Lines 2811-2812: comments + div
parts.push("        {/* Middle pane: Workspace */}");
parts.push('        <div className="space-y-6">');

// No draft selected section - KEEP (lines 2813-3028)
parts.push(range(2813, 3028));

// Draft selected: workflow card + artifacts
parts.push(range(3029, 3030)); // ) : ( + <>

// Workflow Card - KEEP (lines 3031-3404)
parts.push(range(3031, 3404));
parts.push("");

// Artifacts Card - REPLACE (was lines 3406-3684)
parts.push(ARTIFACTS_PANEL_REPLACEMENT);

// Close the conditional/fragment (lines 3685-3687)
parts.push(range(3685, 3687));
parts.push("");

// Actions pane - KEEP structure, replace QA + Publish cards
parts.push("        {/* Actions */}");
parts.push('        <div className="space-y-6 self-start">');

// No draft actions (lines 3691-3700) - KEEP
parts.push(range(3691, 3700));
// ) : (
parts.push(range(3701, 3701)); // <>

// QA Findings Card - REPLACE (was lines 3702-3890)
parts.push(QA_FINDINGS_REPLACEMENT);
parts.push("");

// Publish Card - REPLACE (was lines 3892-4116)
parts.push(PUBLISH_PANEL_REPLACEMENT);

// Close the conditional/fragment/divs (lines 4117-4125)
parts.push(range(4117, 4120));
// Close the wrapper div differently (was `</div>}`)
parts.push("        </div>");
parts.push("      )}");
parts.push("    </div>");
parts.push("  );");
parts.push("}");
parts.push("");

const result = parts.join("\n");
writeFileSync(FILE, result, "utf-8");

// Report
const newLines = result.split("\n");
console.log("Original lines:", lines.length);
console.log("New lines:", newLines.length);
console.log("Reduction:", lines.length - newLines.length, "lines removed");
