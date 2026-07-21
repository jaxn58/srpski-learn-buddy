import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { FolderTree, Languages, Loader2, Pencil, Trash2 } from "lucide-react";

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function humanizeModuleError(message: string) {
  if (message.includes("MODULE_SLUG_TAKEN")) return "Slug is already in use. Please choose a unique slug.";
  if (message.includes("MODULE_NUMBER_TAKEN")) return "Module number is already in use. Please choose a different number.";
  if (message.includes("INVALID_MODULE_NUMBER")) return "Module number must be a positive number.";
  if (message.includes("INVALID_SLUG")) return "Slug is invalid. Use letters/numbers and hyphens.";
  if (message.includes("MISSING_REQUIRED_FIELDS")) return "Please fill all required fields.";
  if (message.includes("MODULE_HAS_UNITS")) return "This module still has units assigned to it. Reassign or remove those units first.";
  if (message.includes("MODULE_NOT_FOUND")) return "Module not found.";
  if (message.includes("Unauthorized")) return "Unauthorized. Superadmin required.";
  return message;
}

export function ModulesTab() {
  const dbModules = useQuery(api.modules.getAllModulesConsolidated) as Doc<"moduleMetadata">[] | undefined;
  const unitCounts = useQuery(api.modules.getModuleUnitCounts);

  const createModuleMutation = useMutation(api.modules.createModule);
  const updateModuleMutation = useMutation(api.modules.updateModuleMetadata);
  const deleteModuleMutation = useMutation(api.modules.deleteModuleById);
  const translateModuleAction = useAction(api.modules.translateModuleEnToDe);

  // Create form state
  const [newModuleNumber, setNewModuleNumber] = useState<string>("");
  const [newTitleEn, setNewTitleEn] = useState<string>("");
  const [newTitleDe, setNewTitleDe] = useState<string>("");
  const [newDescriptionEn, setNewDescriptionEn] = useState<string>("");
  const [newDescriptionDe, setNewDescriptionDe] = useState<string>("");
  const [newSlug, setNewSlug] = useState<string>("");
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
      });

      toast.success("Module created");
      resetNewModuleForm();
    } catch (error: any) {
      toast.error("Failed to create module", {
        description: humanizeModuleError(String(error?.message || error)),
      });
    } finally {
      setCreating(false);
    }
  };

  const handleTranslateCreate = async () => {
    if (!newTitleEn.trim() || !newDescriptionEn.trim()) {
      toast.error("Cannot translate", {
        description: "Please fill Title (EN) and Description (EN) first.",
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
      toast.success("German translation generated");
    } catch (error: any) {
      toast.error("Failed to translate to German", {
        description: humanizeModuleError(String(error?.message || error)),
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
      });

      toast.success("Module updated");
      setEditDialogOpen(false);
      setEditingModuleId(null);
    } catch (error: any) {
      toast.error("Failed to update module", {
        description: humanizeModuleError(String(error?.message || error)),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTranslateEdit = async () => {
    if (!editTitleEn.trim() || !editDescriptionEn.trim()) {
      toast.error("Cannot translate", {
        description: "Please fill Title (EN) and Description (EN) first.",
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
      toast.success("German translation generated");
    } catch (error: any) {
      toast.error("Failed to translate to German", {
        description: humanizeModuleError(String(error?.message || error)),
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
      toast.success("Module deleted");
      setDeleteTarget(null);
    } catch (error: any) {
      toast.error("Failed to delete module", {
        description: humanizeModuleError(String(error?.message || error)),
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
            Create Module
          </CardTitle>
          <CardDescription>
            Modules are created in English first. Use "Translate to German" to generate the German title and
            description, then review before saving.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Module number</Label>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="1"
                value={newModuleNumber}
                onChange={(e) => setNewModuleNumber(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                placeholder="foundation"
                value={newSlug}
                onChange={(e) => {
                  setNewSlugTouched(true);
                  setNewSlug(e.target.value);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Used in URLs and as stable identifier. Auto-generated from Title (EN) until edited.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Title (EN)</Label>
              <Input
                placeholder="Module 1: Foundation"
                value={newTitleEn}
                onChange={(e) => setNewTitleEn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Title (DE)</Label>
              <Input
                placeholder="Generated via Translate to German"
                value={newTitleDe}
                readOnly
                tabIndex={-1}
                className="bg-muted/50 cursor-not-allowed"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Description (EN)</Label>
              <Textarea
                placeholder="Short description shown in the app (English)."
                value={newDescriptionEn}
                onChange={(e) => setNewDescriptionEn(e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description (DE)</Label>
              <Textarea
                placeholder="Generated via Translate to German"
                value={newDescriptionDe}
                readOnly
                tabIndex={-1}
                className="bg-muted/50 cursor-not-allowed"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            German fields are filled automatically. Fill the English fields, then click "Translate to German".
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
              Translate to German
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
              Create Module
            </Button>
            <Button variant="outline" onClick={resetNewModuleForm} disabled={creating}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Modules</CardTitle>
          <CardDescription>Sorted by moduleNumber (as stored).</CardDescription>
        </CardHeader>
        <CardContent>
          {dbModules === undefined ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : dbModules.length === 0 ? (
            <Alert>
              <AlertDescription>No modules found in the database yet.</AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Title (EN)</TableHead>
                  <TableHead>Title (DE)</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                      <TableCell className="text-right">{unitCounts === undefined ? "—" : unitCount}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => openEditModule(m)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(m)}
                            disabled={hasUnits}
                            title={
                              hasUnits
                                ? `This module has ${unitCount} unit${unitCount === 1 ? "" : "s"} assigned and cannot be deleted.`
                                : undefined
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Module</AlertDialogTitle>
            <AlertDialogDescription>
              Update module fields. Slug and module number must remain unique.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-4 md:grid-cols-2 py-2">
            <div className="space-y-2">
              <Label>Module number</Label>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                value={editModuleNumber}
                onChange={(e) => setEditModuleNumber(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Title (EN)</Label>
              <Input value={editTitleEn} onChange={(e) => setEditTitleEn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Title (DE)</Label>
              <Input
                value={editTitleDe}
                readOnly
                tabIndex={-1}
                placeholder="Generated via Translate to German"
                className="bg-muted/50 cursor-not-allowed"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description (EN)</Label>
              <Textarea value={editDescriptionEn} onChange={(e) => setEditDescriptionEn(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description (DE)</Label>
              <Textarea
                value={editDescriptionDe}
                readOnly
                tabIndex={-1}
                placeholder="Generated via Translate to German"
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
                Translate to German
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
              Cancel
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
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Module Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Module</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete module{" "}
              <strong>
                {deleteTarget?.moduleNumber}: {deleteTarget?.titleEn}
              </strong>
              . This action cannot be undone. Modules that still have units assigned to them cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
