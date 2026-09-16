import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Loader2, Trash2, Volume2, MessageSquare, Music } from "lucide-react";

// Local shapes for Convex query results (return types are lost through
// TS2589 @ts-ignore workarounds in convex/audioAdmin.ts).
type AudioUnit = {
  unitNumber: number;
  title: string;
  vocabWithAudio: number;
  vocabTotal: number;
  contentAudioCount: number;
};

type AudioModule = {
  moduleId: string;
  moduleNumber: number;
  titleEn: string;
  totalVocabAudio: number;
  totalContentAudio: number;
  units: AudioUnit[];
};

export function AudioFilesTab() {
  const { t } = useTranslation();
  const modulesData = useQuery(api.audioAdmin.listModulesWithAudioStats);
  const deleteVocabAudio = useMutation(api.audioAdmin.deleteSingleVocabularyAudio);
  const deleteContentAudio = useMutation(api.audioAdmin.deleteSingleContentAudio);
  const deleteAllForUnit = useMutation(api.audioAdmin.deleteAllAudioForUnit);

  const [expandedUnit, setExpandedUnit] = useState<number | null>(null);
  const [deleteAllDialog, setDeleteAllDialog] = useState<{ unitNumber: number; title: string } | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState("");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [deletingAllUnit, setDeletingAllUnit] = useState<number | null>(null);

  const unitAudioData = useQuery(
    api.audioAdmin.listAudioForUnit,
    expandedUnit !== null ? { unitNumber: expandedUnit } : "skip"
  );

  if (!modulesData) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t("admin.contentStudio.audio.loading", "Loading audio data...")}
      </div>
    );
  }

  const totalVocab = (modulesData as AudioModule[]).reduce((s: number, m: AudioModule) => s + m.totalVocabAudio, 0);
  const totalContent = (modulesData as AudioModule[]).reduce((s: number, m: AudioModule) => s + m.totalContentAudio, 0);

  async function handleDeleteVocab(id: Id<"courseVocabulary">, serbian: string) {
    const key = `vocab-${id}`;
    setDeletingIds((prev) => new Set(prev).add(key));
    try {
      await deleteVocabAudio({ vocabularyId: id });
      toast.success(t("admin.contentStudio.audio.deletedFor", { defaultValue: "Deleted audio for \"{{text}}\"", text: serbian }));
    } catch (e: any) {
      toast.error(e.message ?? t("admin.contentStudio.audio.deleteFailed", "Failed to delete audio"));
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleDeleteContent(id: Id<"unitContentAudio">, text: string) {
    const key = `content-${id}`;
    setDeletingIds((prev) => new Set(prev).add(key));
    try {
      await deleteContentAudio({ audioId: id });
      toast.success(
        t("admin.contentStudio.audio.deletedFor", { defaultValue: "Deleted audio for \"{{text}}\"", text: `${text.slice(0, 40)}...` }),
      );
    } catch (e: any) {
      toast.error(e.message ?? t("admin.contentStudio.audio.deleteFailed", "Failed to delete audio"));
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleDeleteAllForUnit() {
    if (!deleteAllDialog) return;
    setDeletingAllUnit(deleteAllDialog.unitNumber);
    try {
      const result = await deleteAllForUnit({ unitNumber: deleteAllDialog.unitNumber });
      toast.success(
        t("admin.contentStudio.audio.deletedAllForUnit", {
          defaultValue: "Unit {{n}}: {{vocab}} vocabulary + {{content}} content audio files deleted",
          n: result.unitNumber,
          vocab: result.vocabDeleted,
          content: result.contentDeleted,
        }),
      );
      setDeleteAllDialog(null);
      setDeleteAllConfirm("");
    } catch (e: any) {
      toast.error(e.message ?? t("admin.contentStudio.audio.deleteAllFailed", "Failed to delete audio for unit"));
    } finally {
      setDeletingAllUnit(null);
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Stats Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.contentStudio.audio.totalFiles", "Total audio files")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVocab + totalContent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5" /> {t("admin.contentStudio.audio.vocabularyAudio", "Vocabulary audio")}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVocab}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> {t("admin.contentStudio.audio.contentAudio", "Content audio")}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalContent}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("admin.contentStudio.audio.phrasesAndDialogues", "Phrases & dialogues")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Module -> Unit Accordion */}
      <Accordion type="multiple" className="space-y-2">
        {(modulesData as AudioModule[]).map((mod: AudioModule) => (
          <AccordionItem key={mod.moduleId} value={mod.moduleId} className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3 w-full">
                <span className="font-semibold">
                  {mod.moduleNumber}. {mod.titleEn}
                </span>
                <div className="flex items-center gap-2 ml-auto mr-4">
                  <Badge variant="secondary" className="text-xs">
                    <Volume2 className="h-3 w-3 mr-1" />
                    {mod.totalVocabAudio}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    {mod.totalContentAudio}
                  </Badge>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {mod.units.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  {t("admin.contentStudio.audio.noUnitsInModule", "No units in this module.")}
                </p>
              ) : (
                <Accordion type="single" collapsible className="space-y-1">
                  {mod.units.map((unit: AudioUnit) => {
                    const unitAudioTotal = unit.vocabWithAudio + unit.contentAudioCount;
                    return (
                      <AccordionItem
                        key={unit.unitNumber}
                        value={String(unit.unitNumber)}
                        className="border rounded-md px-3"
                      >
                        <AccordionTrigger
                          className="hover:no-underline py-3"
                          onClick={() => setExpandedUnit(unit.unitNumber)}
                        >
                          <div className="flex items-center gap-3 w-full">
                            <span className="text-sm font-medium">
                              {t("admin.contentStudio.audio.unitLabel", {
                                defaultValue: "Unit {{n}}: {{title}}",
                                n: unit.unitNumber,
                                title: unit.title,
                              })}
                            </span>
                            <div className="flex items-center gap-2 ml-auto mr-4">
                              <Badge variant="outline" className="text-[11px]">
                                <Volume2 className="h-3 w-3 mr-1" />
                                {unit.vocabWithAudio}/{unit.vocabTotal}
                              </Badge>
                              <Badge variant="outline" className="text-[11px]">
                                <MessageSquare className="h-3 w-3 mr-1" />
                                {unit.contentAudioCount}
                              </Badge>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2">
                          {unitAudioTotal === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">
                              {t("admin.contentStudio.audio.noFilesForUnit", "No audio files for this unit.")}
                            </p>
                          ) : (
                            <UnitAudioDetail
                              unitNumber={unit.unitNumber}
                              unitTitle={unit.title}
                              data={expandedUnit === unit.unitNumber ? unitAudioData : undefined}
                              deletingIds={deletingIds}
                              deletingAllUnit={deletingAllUnit}
                              onDeleteVocab={handleDeleteVocab}
                              onDeleteContent={handleDeleteContent}
                              onDeleteAll={() =>
                                setDeleteAllDialog({ unitNumber: unit.unitNumber, title: unit.title })
                              }
                            />
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Delete All Confirmation Dialog */}
      <Dialog open={!!deleteAllDialog} onOpenChange={(open) => { if (!open) { setDeleteAllDialog(null); setDeleteAllConfirm(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("admin.contentStudio.audio.deleteAllTitle", {
                defaultValue: "Delete all audio for unit {{n}}",
                n: deleteAllDialog?.unitNumber,
              })}
            </DialogTitle>
            <DialogDescription>
              {t(
                "admin.contentStudio.audio.deleteAllDescriptionPrefix",
                "This will permanently delete all vocabulary audio and content audio (phrases/dialogues) for",
              )}{" "}
              <strong>
                {t("admin.contentStudio.audio.unitLabel", {
                  defaultValue: "Unit {{n}}: {{title}}",
                  n: deleteAllDialog?.unitNumber,
                  title: deleteAllDialog?.title,
                })}
              </strong>
              . {t("admin.contentStudio.audio.regeneratedOnPlayback", "Audio files will be regenerated on next playback.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <p className="text-sm mb-2">
                {t("admin.contentStudio.audio.typeToConfirmPrefix", "Type")}{" "}
                <strong>DELETE UNIT {deleteAllDialog?.unitNumber}</strong>{" "}
                {t("admin.contentStudio.audio.typeToConfirmSuffix", "to confirm:")}
              </p>
              <Input
                value={deleteAllConfirm}
                onChange={(e) => setDeleteAllConfirm(e.target.value)}
                placeholder={`DELETE UNIT ${deleteAllDialog?.unitNumber}`}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" onClick={() => { setDeleteAllDialog(null); setDeleteAllConfirm(""); }}>
                    {t("admin.contentStudio.audio.cancel", "Cancel")}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("admin.contentStudio.audio.cancelTooltip", "Abort without deleting anything")}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={
                      deleteAllConfirm !== `DELETE UNIT ${deleteAllDialog?.unitNumber}` ||
                      deletingAllUnit !== null
                    }
                    onClick={handleDeleteAllForUnit}
                  >
                    {deletingAllUnit !== null ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("admin.contentStudio.audio.deleting", "Deleting...")}</>
                    ) : (
                      <><Trash2 className="mr-2 h-4 w-4" /> {t("admin.contentStudio.audio.deleteAll", "Delete all audio")}</>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {t(
                    "admin.contentStudio.audio.deleteAllConfirmTooltip",
                    "Permanently remove all audio files from storage and database for this unit",
                  )}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UnitAudioDetail({
  unitNumber,
  unitTitle,
  data,
  deletingIds,
  deletingAllUnit,
  onDeleteVocab,
  onDeleteContent,
  onDeleteAll,
}: {
  unitNumber: number;
  unitTitle: string;
  data: { vocabAudio: any[]; contentAudio: any[] } | undefined | null;
  deletingIds: Set<string>;
  deletingAllUnit: number | null;
  onDeleteVocab: (id: Id<"courseVocabulary">, serbian: string) => void;
  onDeleteContent: (id: Id<"unitContentAudio">, text: string) => void;
  onDeleteAll: () => void;
}) {
  const { t } = useTranslation();
  if (!data) {
    return (
      <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("admin.contentStudio.audio.loadingEntries", "Loading audio entries...")}
      </div>
    );
  }

  const hasAny = data.vocabAudio.length > 0 || data.contentAudio.length > 0;

  return (
    <div className="space-y-4 pb-2">
      {/* Delete All Button */}
      {hasAny && (
        <div className="flex justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                onClick={onDeleteAll}
                disabled={deletingAllUnit === unitNumber}
              >
                {deletingAllUnit === unitNumber ? (
                  <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> {t("admin.contentStudio.audio.deleting", "Deleting...")}</>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-3.5 w-3.5" />{" "}
                    {t("admin.contentStudio.audio.deleteAllTitle", { defaultValue: "Delete all audio for unit {{n}}", n: unitNumber })}
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t(
                "admin.contentStudio.audio.deleteAllTooltip",
                "Permanently delete all vocabulary and content audio for this unit. Files will be regenerated on next playback.",
              )}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Vocabulary Audio */}
      {data.vocabAudio.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            {t("admin.contentStudio.audio.vocabularyAudioWithCount", {
              defaultValue: "Vocabulary audio ({{n}})",
              n: data.vocabAudio.length,
            })}
          </h4>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium">{t("admin.contentStudio.audio.colSerbian", "Serbian")}</th>
                  <th className="text-left px-3 py-2 font-medium">{t("admin.contentStudio.audio.colEnglish", "English")}</th>
                  <th className="text-right px-3 py-2 font-medium w-24">{t("admin.contentStudio.audio.colAction", "Action")}</th>
                </tr>
              </thead>
              <tbody>
                {data.vocabAudio.map((v: any) => {
                  const isDeleting = deletingIds.has(`vocab-${v._id}`);
                  return (
                    <tr key={v._id} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{v.serbian}</td>
                      <td className="px-3 py-2 text-muted-foreground">{v.en ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={isDeleting}
                              onClick={() => onDeleteVocab(v._id, v.serbian)}
                            >
                              {isDeleting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {t(
                              "admin.contentStudio.audio.deleteWordTooltip",
                              "Delete audio for this word. A new file will be generated on next playback.",
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Content Audio */}
      {data.contentAudio.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {t("admin.contentStudio.audio.contentAudioWithCount", {
              defaultValue: "Content audio ({{n}})",
              n: data.contentAudio.length,
            })}
          </h4>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium">{t("admin.contentStudio.audio.colType", "Type")}</th>
                  <th className="text-left px-3 py-2 font-medium">{t("admin.contentStudio.audio.colSerbianText", "Serbian text")}</th>
                  <th className="text-left px-3 py-2 font-medium">{t("admin.contentStudio.audio.colVoice", "Voice")}</th>
                  <th className="text-right px-3 py-2 font-medium w-24">{t("admin.contentStudio.audio.colAction", "Action")}</th>
                </tr>
              </thead>
              <tbody>
                {data.contentAudio.map((a: any) => {
                  const isDeleting = deletingIds.has(`content-${a._id}`);
                  return (
                    <tr key={a._id} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {a.contentType === "phrases" ? (
                            <Music className="h-2.5 w-2.5 mr-1" />
                          ) : (
                            <MessageSquare className="h-2.5 w-2.5 mr-1" />
                          )}
                          {t(`admin.contentStudio.audio.contentType.${String(a.contentType)}`, String(a.contentType))}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 max-w-xs truncate" title={a.textSr}>
                        {a.textSr}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{a.voiceKey}</td>
                      <td className="px-3 py-2 text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={isDeleting}
                              onClick={() => onDeleteContent(a._id, a.textSr)}
                            >
                              {isDeleting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {t("admin.contentStudio.audio.deleteTtsTooltip", "Delete this TTS audio. It will be regenerated on next playback.")}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!hasAny && (
        <p className="text-sm text-muted-foreground py-2">
          {t("admin.contentStudio.audio.noFilesFound", "No audio files found for this unit.")}
        </p>
      )}
    </div>
  );
}
