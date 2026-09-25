import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FolderTree, Languages, Loader2, Pencil, Trash2 } from "lucide-react";

type LearningOfferItem = {
  canDoId: string;
  statementEn: string;
  statementDe?: string;
  unitNumber: number;
  unitTitleEn: string;
  unitTitleDe?: string;
  offeredEn: boolean;
  offeredDe: boolean;
};

type ModuleLearningOffer = {
  moduleNumber: number;
  level: string;
  items: LearningOfferItem[];
};

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function humanizeModuleError(message: string, t: TFunction) {
  if (message.includes("MODULE_SLUG_TAKEN"))
    return t("admin.contentStudio.modules.errorSlugTaken", "Slug is already in use. Please choose a unique slug.");
  if (message.includes("MODULE_NUMBER_TAKEN"))
    return t("admin.contentStudio.modules.errorNumberTaken", "Module number is already in use. Please choose a different number.");
  if (message.includes("INVALID_MODULE_NUMBER"))
    return t("admin.contentStudio.modules.errorInvalidNumber", "Module number must be a positive number.");
  if (message.includes("INVALID_SLUG"))
    return t("admin.contentStudio.modules.errorInvalidSlug", "Slug is invalid. Use letters/numbers and hyphens.");
  if (message.includes("MISSING_REQUIRED_FIELDS"))
    return t("admin.contentStudio.modules.errorMissingFields", "Please fill all required fields.");
  if (message.includes("MODULE_HAS_UNITS"))
    return t(
      "admin.contentStudio.modules.errorHasUnits",
      "This module still has units assigned to it. Reassign or remove those units first.",
    );
  if (message.includes("MODULE_NOT_FOUND")) return t("admin.contentStudio.modules.errorNotFound", "Module not found.");
  if (message.includes("Unauthorized"))
    return t("admin.contentStudio.modules.errorUnauthorized", "Unauthorized. Superadmin required.");
  return message;
}

export function ModulesTab() {
  const { t } = useTranslation();
  const dbModules = useQuery(api.modules.getAllModulesConsolidated) as Doc<"moduleMetadata">[] | undefined;
  const unitCounts = useQuery(api.modules.getModuleUnitCounts);
  const learningOffer = useQuery(api.curriculum.getModuleLearningOffer);
  const offerByModule = useMemo(() => {
    const map = new Map<number, ModuleLearningOffer>();
    for (const row of learningOffer ?? []) map.set(row.moduleNumber, row);
    return map;
  }, [learningOffer]);
  const [offerModule, setOfferModule] = useState<number | null>(null);

  const createModuleMutation = useMutation(api.modules.createModule);
  const updateModuleMutation = useMutation(api.modules.updateModuleMetadata);
  const resolvedLevels = useMemo(() => resolveModuleLevelsClient(dbModules ?? []), [dbModules]);
  const deleteModuleMutation = useMutation(api.modules.deleteModuleById);
  const translateModuleAction = useAction(api.modules.translateModuleEnToDe);

  // Create form state
  const [newModuleNumber, setNewModuleNumber] = useState<string>("");
  const [newTitleEn, setNewTitleEn] = useState<string>("");
  const [newTitleDe, setNewTitleDe] = useState<string>("");
  const [newDescriptionEn, setNewDescriptionEn] = useState<string>("");
  const [newDescriptionDe, setNewDescriptionDe] = useState<string>("");
  const [newSlug, setNewSlug] = useState<string>("");
  const [newCefrLevel, setNewCefrLevel] = useState<string>("");
  const [newSlugTouched, setNewSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [translatingCreate, setTranslatingCreate] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<Id<"moduleMetadata"> | null>(null);
  const [editModuleNumber, setEditModuleNumber] = useState<string>("");
  const [editTitleEn, setEditTitleEn] = useState<string>("");
  const [editTitleDe, setEditTitleDe] = useState<string>("");
  const [editDescriptionEn, setEditDescriptionEn] = useState<string>("");
  const [editDescriptionDe, setEditDescriptionDe] = useState<string>("");
  const [editSlug, setEditSlug] = useState<string>("");
  const [editCefrLevel, setEditCefrLevel] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [translatingEdit, setTranslatingEdit] = useState(false);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<Doc<"moduleMetadata"> | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Auto-generate slug from English title until user edits slug manually.
  useEffect(() => {
    if (newSlugTouched) return;
    setNewSlug(slugify(newTitleEn));
  }, [newTitleEn, newSlugTouched]);

  const resetNewModuleForm = useCallback(() => {
    setNewModuleNumber("");
    setNewTitleEn("");
    setNewTitleDe("");
    setNewDescriptionEn("");
    setNewDescriptionDe("");
    setNewSlug("");
    setNewCefrLevel("");
    setNewSlugTouched(false);
  }, []);

  const handleCreateModule = async () => {
    try {
      setCreating(true);
      const moduleNumber = Number(newModuleNumber);
      const slug = newSlug || slugify(newTitleEn);

      await createModuleMutation({
        moduleNumber,
        slug,
        titleEn: newTitleEn,
        titleDe: newTitleDe,
        descriptionEn: newDescriptionEn,
        descriptionDe: newDescriptionDe,
        cefrLevel: (newCefrLevel || undefined) as CefrLevel | undefined,
      });

      toast.success(t("admin.contentStudio.modules.toastCreated", "Module created"));
      resetNewModuleForm();
    } catch (error: any) {
      toast.error(t("admin.contentStudio.modules.toastCreateFailed", "Failed to create module"), {
        description: humanizeModuleError(String(error?.message || error), t),
      });
    } finally {
      setCreating(false);
    }
  };

  const handleTranslateCreate = async () => {
    if (!newTitleEn.trim() || !newDescriptionEn.trim()) {
      toast.error(t("admin.contentStudio.modules.toastCannotTranslate", "Cannot translate"), {
        description: t("admin.contentStudio.modules.toastFillEnglishFirst", "Please fill Title (EN) and Description (EN) first."),
      });
      return;
    }
    try {
      setTranslatingCreate(true);
      const res = await translateModuleAction({
        titleEn: newTitleEn,
        descriptionEn: newDescriptionEn,
      });
      setNewTitleDe(res.titleDe);
      setNewDescriptionDe(res.descriptionDe);
      toast.success(t("admin.contentStudio.modules.toastTranslated", "German translation generated"));
    } catch (error: any) {
      toast.error(t("admin.contentStudio.modules.toastTranslateFailed", "Failed to translate to German"), {
        description: humanizeModuleError(String(error?.message || error), t),
      });
    } finally {
      setTranslatingCreate(false);
    }
  };

  const openEditModule = (m: Doc<"moduleMetadata">) => {
    setEditingModuleId(m._id);
    setEditModuleNumber(String(m.moduleNumber ?? ""));
    setEditSlug(String(m.slug ?? ""));
    setEditTitleEn(String(m.titleEn ?? ""));
    setEditTitleDe(String(m.titleDe ?? ""));
    setEditDescriptionEn(String(m.descriptionEn ?? ""));
    setEditDescriptionDe(String(m.descriptionDe ?? ""));
    setEditCefrLevel(String((m as any).cefrLevel ?? ""));
    setEditDialogOpen(true);
  };

  const handleSaveEditModule = async () => {
    if (!editingModuleId) return;
    try {
      setSaving(true);
      const moduleNumber = Number(editModuleNumber);
      await updateModuleMutation({
        moduleId: editingModuleId,
        moduleNumber,
        slug: editSlug,
        titleEn: editTitleEn,
        titleDe: editTitleDe,
        descriptionEn: editDescriptionEn,
        descriptionDe: editDescriptionDe,
        ...(editCefrLevel ? { cefrLevel: editCefrLevel as CefrLevel } : {}),
      });

      toast.success(t("admin.contentStudio.modules.toastUpdated", "Module updated"));
      setEditDialogOpen(false);
      setEditingModuleId(null);
    } catch (error: any) {
      toast.error(t("admin.contentStudio.modules.toastUpdateFailed", "Failed to update module"), {
        description: humanizeModuleError(String(error?.message || error), t),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTranslateEdit = async () => {
    if (!editTitleEn.trim() || !editDescriptionEn.trim()) {
      toast.error(t("admin.contentStudio.modules.toastCannotTranslate", "Cannot translate"), {
        description: t("admin.contentStudio.modules.toastFillEnglishFirst", "Please fill Title (EN) and Description (EN) first."),
      });
      return;
    }
    try {
      setTranslatingEdit(true);
      const res = await translateModuleAction({
        titleEn: editTitleEn,
        descriptionEn: editDescriptionEn,
      });
      setEditTitleDe(res.titleDe);
      setEditDescriptionDe(res.descriptionDe);
      toast.success(t("admin.contentStudio.modules.toastTranslated", "German translation generated"));
    } catch (error: any) {
      toast.error(t("admin.contentStudio.modules.toastTranslateFailed", "Failed to translate to German"), {
        description: humanizeModuleError(String(error?.message || error), t),
      });
    } finally {
      setTranslatingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteModuleMutation({ id: deleteTarget._id });
      toast.success(t("admin.contentStudio.modules.toastDeleted", "Module deleted"));
      setDeleteTarget(null);
    } catch (error: any) {
      toast.error(t("admin.contentStudio.modules.toastDeleteFailed", "Failed to delete module"), {
        description: humanizeModuleError(String(error?.message || error), t),
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            {t("admin.contentStudio.modules.createTitle", "Create module")}
          </CardTitle>
          <CardDescription>
            {t(
              "admin.contentStudio.modules.createDescription",
              "Modules are created in English first. Use \"Translate to German\" to generate the German title and description, then review before saving.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("admin.contentStudio.modules.moduleNumber", "Module number")}</Label>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="1"
                value={newModuleNumber}
                onChange={(e) => setNewModuleNumber(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.contentStudio.modules.slug", "Slug")}</Label>
              <Input
                placeholder="foundation"
                value={newSlug}
                onChange={(e) => {
                  setNewSlugTouched(true);
                  setNewSlug(e.target.value);
                }}
              />
              <p className="text-xs text-muted-foreground">
                {t(
                  "admin.contentStudio.modules.slugHelp",
                  "Used in URLs and as stable identifier. Auto-generated from Title (EN) until edited.",
                )}
              </p>
            </div>
            <CefrLevelField value={newCefrLevel} onChange={setNewCefrLevel} />

            <div className="space-y-2">
              <Label>{t("admin.contentStudio.modules.titleEn", "Title (EN)")}</Label>
              <Input
                placeholder="Module 1: Foundation"
                value={newTitleEn}
                onChange={(e) => setNewTitleEn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.contentStudio.modules.titleDe", "Title (DE)")}</Label>
              <Input
                placeholder={t("admin.contentStudio.modules.generatedPlaceholder", "Generated via \"Translate to German\"")}
                value={newTitleDe}
                readOnly
                tabIndex={-1}
                className="bg-muted/50 cursor-not-allowed"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>{t("admin.contentStudio.modules.descriptionEn", "Description (EN)")}</Label>
              <Textarea
                placeholder={t("admin.contentStudio.modules.descriptionEnPlaceholder", "Short description shown in the app (English).")}
                value={newDescriptionEn}
                onChange={(e) => setNewDescriptionEn(e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{t("admin.contentStudio.modules.descriptionDe", "Description (DE)")}</Label>
              <Textarea
                placeholder={t("admin.contentStudio.modules.generatedPlaceholder", "Generated via \"Translate to German\"")}
                value={newDescriptionDe}
                readOnly
                tabIndex={-1}
                className="bg-muted/50 cursor-not-allowed"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            {t(
              "admin.contentStudio.modules.germanAutoHint",
              "German fields are filled automatically. Fill the English fields, then click \"Translate to German\".",
            )}
          </p>

          <div className="flex gap-2 mt-6">
            <Button
              variant="secondary"
              onClick={() => void handleTranslateCreate()}
              disabled={translatingCreate || !newTitleEn.trim() || !newDescriptionEn.trim()}
              className="gap-2"
            >
              {translatingCreate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Languages className="h-4 w-4" />
              )}
              {t("admin.contentStudio.modules.translateToGerman", "Translate to German")}
            </Button>
            <Button
              onClick={() => void handleCreateModule()}
              disabled={
                creating ||
                !newModuleNumber.trim() ||
                !newSlug.trim() ||
                !newTitleEn.trim() ||
                !newDescriptionEn.trim() ||
                !newTitleDe.trim() ||
                !newDescriptionDe.trim()
              }
              className="gap-2"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderTree className="h-4 w-4" />}
              {t("admin.contentStudio.modules.createButton", "Create module")}
            </Button>
            <Button variant="outline" onClick={resetNewModuleForm} disabled={creating}>
              {t("admin.contentStudio.modules.reset", "Reset")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.contentStudio.modules.existingTitle", "Existing modules")}</CardTitle>
          <CardDescription>{t("admin.contentStudio.modules.existingDescription", "Sorted by module number (as stored).")}</CardDescription>
        </CardHeader>
        <CardContent>
          {dbModules === undefined ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : dbModules.length === 0 ? (
            <Alert>
              <AlertDescription>{t("admin.contentStudio.modules.noModules", "No modules found in the database yet.")}</AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{t("admin.contentStudio.modules.slug", "Slug")}</TableHead>
                  <TableHead>{t("admin.contentStudio.modules.titleEn", "Title (EN)")}</TableHead>
                  <TableHead>{t("admin.contentStudio.modules.titleDe", "Title (DE)")}</TableHead>
                  <TableHead>{t("admin.contentStudio.modules.colLevel", "Level")}</TableHead>
                  <TableHead className="text-right">{t("admin.contentStudio.modules.colUnits", "Units")}</TableHead>
                  <TableHead className="text-right">{t("admin.contentStudio.modules.colActions", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dbModules.map((m) => {
                  const unitCount = unitCounts?.[String(m._id)] ?? 0;
                  const hasUnits = unitCount > 0;
                  return (
                    <TableRow key={m._id}>
                      <TableCell className="font-medium">{m.moduleNumber ?? "—"}</TableCell>
                      <TableCell>{m.slug ?? "—"}</TableCell>
                      <TableCell>{m.titleEn ?? "—"}</TableCell>
                      <TableCell>{m.titleDe ?? "—"}</TableCell>
                      <TableCell>
                        <ModuleLevelCell
                          level={resolvedLevels.get(m.moduleNumber ?? -1)}
                          explicit={!!(m as any).cefrLevel}
                          offer={typeof m.moduleNumber === "number" ? offerByModule.get(m.moduleNumber) : undefined}
                          onOpen={() => {
                            if (typeof m.moduleNumber === "number") setOfferModule(m.moduleNumber);
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-right">{unitCounts === undefined ? "—" : unitCount}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => openEditModule(m)}>
                            <Pencil className="h-4 w-4" />
                            {t("admin.contentStudio.modules.edit", "Edit")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(m)}
                            disabled={hasUnits}
                            title={
                              hasUnits
                                ? unitCount === 1
                                  ? t(
                                      "admin.contentStudio.modules.cannotDeleteOneUnit",
                                      "This module has 1 unit assigned and cannot be deleted.",
                                    )
                                  : t("admin.contentStudio.modules.cannotDeleteManyUnits", {
                                      defaultValue: "This module has {{n}} units assigned and cannot be deleted.",
                                      n: unitCount,
                                    })
                                : undefined
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                            {t("admin.contentStudio.modules.delete", "Delete")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Module Dialog */}
      <AlertDialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <AlertDialogContent className="sm:max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.contentStudio.modules.editTitle", "Edit module")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.contentStudio.modules.editDescription", "Update module fields. Slug and module number must remain unique.")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-4 md:grid-cols-2 py-2">
            <div className="space-y-2">
              <Label>{t("admin.contentStudio.modules.moduleNumber", "Module number")}</Label>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                value={editModuleNumber}
                onChange={(e) => setEditModuleNumber(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.contentStudio.modules.slug", "Slug")}</Label>
              <Input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} />
            </div>
            <CefrLevelField value={editCefrLevel} onChange={setEditCefrLevel} />
            <div className="space-y-2">
              <Label>{t("admin.contentStudio.modules.titleEn", "Title (EN)")}</Label>
              <Input value={editTitleEn} onChange={(e) => setEditTitleEn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.contentStudio.modules.titleDe", "Title (DE)")}</Label>
              <Input
                value={editTitleDe}
                readOnly
                tabIndex={-1}
                placeholder={t("admin.contentStudio.modules.generatedPlaceholder", "Generated via \"Translate to German\"")}
                className="bg-muted/50 cursor-not-allowed"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{t("admin.contentStudio.modules.descriptionEn", "Description (EN)")}</Label>
              <Textarea value={editDescriptionEn} onChange={(e) => setEditDescriptionEn(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{t("admin.contentStudio.modules.descriptionDe", "Description (DE)")}</Label>
              <Textarea
                value={editDescriptionDe}
                readOnly
                tabIndex={-1}
                placeholder={t("admin.contentStudio.modules.generatedPlaceholder", "Generated via \"Translate to German\"")}
                className="bg-muted/50 cursor-not-allowed"
              />
            </div>
            <div className="md:col-span-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleTranslateEdit()}
                disabled={translatingEdit || !editTitleEn.trim() || !editDescriptionEn.trim()}
                className="gap-2"
              >
                {translatingEdit ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Languages className="h-4 w-4" />
                )}
                {t("admin.contentStudio.modules.translateToGerman", "Translate to German")}
              </Button>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setEditDialogOpen(false);
                setEditingModuleId(null);
              }}
            >
              {t("admin.contentStudio.modules.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Prevent AlertDialogAction default close until mutation succeeds.
                e.preventDefault();
                void handleSaveEditModule();
              }}
              disabled={
                saving ||
                !editModuleNumber.trim() ||
                !editSlug.trim() ||
                !editTitleEn.trim() ||
                !editDescriptionEn.trim() ||
                !editTitleDe.trim() ||
                !editDescriptionDe.trim()
              }
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t("admin.contentStudio.modules.save", "Save")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Module Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.contentStudio.modules.deleteTitle", "Delete module")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.contentStudio.modules.deleteDescriptionPrefix", "This will permanently delete module")}{" "}
              <strong>
                {deleteTarget?.moduleNumber}: {deleteTarget?.titleEn}
              </strong>
              .{" "}
              {t(
                "admin.contentStudio.modules.deleteDescriptionSuffix",
                "This action cannot be undone. Modules that still have units assigned to them cannot be deleted.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("admin.contentStudio.modules.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t("admin.contentStudio.modules.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LearningOfferDialog
        open={offerModule !== null}
        onOpenChange={(open) => {
          if (!open) setOfferModule(null);
        }}
        offer={offerModule === null ? undefined : offerByModule.get(offerModule)}
      />
    </div>
  );
}

type CefrLevel = "A1.1" | "A1.2" | "A2.1" | "A2.2" | "B1";
const CEFR_LEVELS: CefrLevel[] = ["A1.1", "A1.2", "A2.1", "A2.2", "B1"];

/**
 * Same rule as `resolveModuleLevels` in convex/curriculum.ts: explicit level
 * wins, otherwise the level after the previous module (capped at B1), the
 * first module starts at A1.1. Kept in sync by hand; the server is the source
 * of truth for the assistant, this is display only.
 */
function resolveModuleLevelsClient(modules: Array<{ moduleNumber?: number; cefrLevel?: string }>): Map<number, CefrLevel> {
  const sorted = modules
    .filter((m) => typeof m.moduleNumber === "number")
    .sort((a, b) => (a.moduleNumber ?? 0) - (b.moduleNumber ?? 0));
  const out = new Map<number, CefrLevel>();
  let prev: CefrLevel | null = null;
  for (const m of sorted) {
    let level: CefrLevel;
    if (m.cefrLevel && (CEFR_LEVELS as string[]).includes(m.cefrLevel)) level = m.cefrLevel as CefrLevel;
    else if (prev) level = CEFR_LEVELS[Math.min(CEFR_LEVELS.indexOf(prev) + 1, CEFR_LEVELS.length - 1)];
    else level = CEFR_LEVELS[0];
    out.set(m.moduleNumber as number, level);
    prev = level;
  }
  return out;
}

function offerGapCount(items: LearningOfferItem[]): number {
  return items.filter((item) => !item.offeredEn || !item.offeredDe).length;
}

function ModuleLevelCell({
  level, explicit, offer, onOpen,
}: { level?: CefrLevel; explicit: boolean; offer?: ModuleLearningOffer; onOpen: () => void }) {
  const { t } = useTranslation();
  if (!level) return <span className="text-muted-foreground">—</span>;
  const gap = offer && offer.items.length > 0 ? offerGapCount(offer.items) : null;
  return (
    <div className="flex flex-col items-start gap-1 min-w-0">
      <span className="text-sm">
        {level}
        {!explicit && <span className="text-xs text-muted-foreground"> · {t("admin.contentStudio.modules.levelAutoShort", "auto")}</span>}
      </span>
      {gap !== null && (
        <Button variant="outline" size="sm" className="h-auto px-2 py-0.5 text-xs font-normal" onClick={onOpen}>
          {gap > 0
            ? t("admin.contentStudio.modules.offerGap", {
                defaultValue: "{{n}} learning goals are not published for learners",
                n: gap,
              })
            : t("admin.contentStudio.modules.offerReady", "Published for learners in English and German")}
        </Button>
      )}
    </div>
  );
}

function trackLabel(offered: boolean, t: TFunction): string {
  return offered
    ? t("admin.contentStudio.modules.offerTrackYes", "published")
    : t("admin.contentStudio.modules.offerTrackNo", "not published");
}

function LearningOfferDialog({
  open, onOpenChange, offer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer?: ModuleLearningOffer;
}) {
  const { t, i18n } = useTranslation();
  const germanUi = i18n.language.startsWith("de");
  const items = [...(offer?.items ?? [])].sort((a, b) => {
    const aGap = !a.offeredEn || !a.offeredDe ? 0 : 1;
    const bGap = !b.offeredEn || !b.offeredDe ? 0 : 1;
    if (aGap !== bGap) return aGap - bGap;
    return a.unitNumber - b.unitNumber || a.canDoId.localeCompare(b.canDoId);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t("admin.contentStudio.modules.offerTitle", {
              defaultValue: "{{level}}: what learners can study",
              level: offer?.level ?? "",
            })}
          </DialogTitle>
          <DialogDescription>
            {t(
              "admin.contentStudio.modules.offerDescription",
              "Each learning goal is available when the unit that introduces it is published for learners. A briefing alone does not count. Preview is not visible to learners.",
            )}
          </DialogDescription>
        </DialogHeader>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("admin.contentStudio.modules.offerNone", "No learning goals are stored for this level.")}
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {items.map((item) => {
              const statement = germanUi && item.statementDe ? item.statementDe : item.statementEn;
              const title = germanUi && item.unitTitleDe ? item.unitTitleDe : item.unitTitleEn;
              return (
                <li key={item.canDoId} className="space-y-1 px-3 py-2">
                  <p className="text-sm">{statement}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.contentStudio.modules.offerUnit", {
                      defaultValue: "Unit {{n}} · {{title}}. English: {{en}}. German: {{de}}.",
                      n: item.unitNumber,
                      title,
                      en: trackLabel(item.offeredEn, t),
                      de: trackLabel(item.offeredDe, t),
                    })}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Language level of the whole module. The Content Studio derives the
 * difficulty and the grammar progression of new units from it; authors never
 * have to pick a level per unit.
 */
function CefrLevelField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2 md:col-span-2 min-w-0">
      <Label>{t("admin.contentStudio.modules.cefrLevel", "Language level of this module")}</Label>
      <Select value={value || "__auto__"} onValueChange={(v) => onChange(v === "__auto__" ? "" : v)}>
        <SelectTrigger className="h-10 text-sm w-full [&>span]:truncate">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__auto__" className="text-sm">{t("admin.contentStudio.modules.cefrLevelAuto", "Automatic (from the module's position in the course)")}</SelectItem>
          {CEFR_LEVELS.map((l) => (
            <SelectItem key={l} value={l} className="text-sm">{t(`admin.contentStudio.workflow.level.${l}`, l)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {t("admin.contentStudio.modules.cefrLevelHelp", "Sets how difficult the units of this module are and which grammar the AI may introduce. Units build on each other within and across modules.")}
      </p>
    </div>
  );
}

