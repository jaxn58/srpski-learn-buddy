import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { IconPicker, IconDisplay } from "@/components/ui/icon-picker";
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
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Plus, Edit, Trash2, Eye, ChevronUp, ChevronDown, ToggleLeft, ToggleRight, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useState } from "react";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { WelcomeOnboarding } from "@/components/WelcomeOnboarding";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";

export default function OnboardingAdmin() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  
  // Load onboarding steps (V2: column-based)
  const allSteps = useQuery(api.onboarding.getAllOnboardingStepsV2);
  const stepsLoading = allSteps === undefined;
  
  // Mutations (V2)
  const createStepMutation = useMutation(api.onboarding.createOnboardingStepV2);
  const updateStepMutation = useMutation(api.onboarding.updateOnboardingStepV2);
  const deleteStepMutation = useMutation(api.onboarding.deleteOnboardingStep);
  const toggleStepActiveMutation = useMutation(api.onboarding.toggleStepActive);
  const translateOnboardingEnToDeAction = useAction(api.onboarding.translateOnboardingEnToDe);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewLanguage, setPreviewLanguage] = useState("en");
  const [previewStepNumber, setPreviewStepNumber] = useState<number | null>(null);
  
  // Form state (column-based multilanguage)
  const [formData, setFormData] = useState({
    stepNumber: 1,
    titleEn: "",
    titleDe: "",
    titleEs: "",
    titleFr: "",
    descriptionEn: "",
    descriptionDe: "",
    descriptionEs: "",
    descriptionFr: "",
    contentEn: "",
    contentDe: "",
    contentEs: "",
    contentFr: "",
    icon: "Info",
    isActive: true,
    backgroundColor: "",
  });
  
  const [editingStepId, setEditingStepId] = useState<Id<"onboardingSteps"> | null>(null);

  // Derive staleness for the step currently being edited
  const editingStep = editingStepId ? allSteps?.find((s) => s._id === editingStepId) : null;
  const editingStepHasDe = !!(editingStep?.titleDe || editingStep?.contentDe);
  const editingStepIsDeOutdated =
    editingStepHasDe &&
    editingStep?.enContentUpdatedAt != null &&
    editingStep.enContentUpdatedAt > (editingStep.deContentUpdatedAt ?? 0);
  const [deletingStepId, setDeletingStepId] = useState<Id<"onboardingSteps"> | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [isTranslatingDe, setIsTranslatingDe] = useState(false);

  // Authorization check
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Unauthorized</CardTitle>
            <CardDescription>You don't have permission to access this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      stepNumber: (allSteps?.length || 0) + 1,
      titleEn: "",
      titleDe: "",
      titleEs: "",
      titleFr: "",
      descriptionEn: "",
      descriptionDe: "",
      descriptionEs: "",
      descriptionFr: "",
      contentEn: "",
      contentDe: "",
      contentEs: "",
      contentFr: "",
      icon: "Info",
      isActive: true,
      backgroundColor: "",
    });
    setEditingStepId(null);
    setHasUnsavedChanges(false);
  };

  // Update form data and mark as changed
  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  };

  // Handle dialog close with unsaved changes
  const handleDialogClose = (dialogType: 'create' | 'edit') => {
    if (hasUnsavedChanges) {
      setShowUnsavedWarning(true);
    } else {
      if (dialogType === 'create') {
        setCreateDialogOpen(false);
      } else {
        setEditDialogOpen(false);
      }
      resetForm();
    }
  };

  // Confirm close with unsaved changes
  const confirmCloseDialog = () => {
    setShowUnsavedWarning(false);
    setCreateDialogOpen(false);
    setEditDialogOpen(false);
    resetForm();
  };

  // Handle create
  const handleCreate = async () => {
    try {
      await createStepMutation({
        stepNumber: formData.stepNumber,
        titleEn: formData.titleEn || undefined,
        titleDe: formData.titleDe || undefined,
        titleEs: formData.titleEs || undefined,
        titleFr: formData.titleFr || undefined,
        descriptionEn: formData.descriptionEn || undefined,
        descriptionDe: formData.descriptionDe || undefined,
        descriptionEs: formData.descriptionEs || undefined,
        descriptionFr: formData.descriptionFr || undefined,
        contentEn: formData.contentEn || undefined,
        contentDe: formData.contentDe || undefined,
        contentEs: formData.contentEs || undefined,
        contentFr: formData.contentFr || undefined,
        icon: formData.icon,
        isActive: formData.isActive,
        backgroundColor: formData.backgroundColor || undefined,
      });
      
      toast.success(t("admin.onboarding.toast.created"));
      setCreateDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(t("admin.onboarding.toast.createFailed"));
      console.error(error);
    }
  };

  // Handle edit
  const handleEdit = (step: Doc<"onboardingSteps">) => {
    setFormData({
      stepNumber: step.stepNumber,
      titleEn: step.titleEn || "",
      titleDe: step.titleDe || "",
      titleEs: step.titleEs || "",
      titleFr: step.titleFr || "",
      descriptionEn: step.descriptionEn || "",
      descriptionDe: step.descriptionDe || "",
      descriptionEs: step.descriptionEs || "",
      descriptionFr: step.descriptionFr || "",
      contentEn: step.contentEn || "",
      contentDe: step.contentDe || "",
      contentEs: step.contentEs || "",
      contentFr: step.contentFr || "",
      icon: step.icon,
      isActive: step.isActive,
      backgroundColor: step.backgroundColor || "",
    });
    setEditingStepId(step._id);
    setHasUnsavedChanges(false); // Reset unsaved changes when loading step for edit
    setEditDialogOpen(true);
  };

  // Handle update
  const handleUpdate = async () => {
    if (!editingStepId) return;
    
    try {
      await updateStepMutation({
        stepId: editingStepId,
        stepNumber: formData.stepNumber,
        titleEn: formData.titleEn || undefined,
        titleDe: formData.titleDe || undefined,
        titleEs: formData.titleEs || undefined,
        titleFr: formData.titleFr || undefined,
        descriptionEn: formData.descriptionEn || undefined,
        descriptionDe: formData.descriptionDe || undefined,
        descriptionEs: formData.descriptionEs || undefined,
        descriptionFr: formData.descriptionFr || undefined,
        contentEn: formData.contentEn || undefined,
        contentDe: formData.contentDe || undefined,
        contentEs: formData.contentEs || undefined,
        contentFr: formData.contentFr || undefined,
        icon: formData.icon,
        isActive: formData.isActive,
        backgroundColor: formData.backgroundColor || undefined,
      });
      
      toast.success(t("admin.onboarding.toast.updated"));
      setEditDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(t("admin.onboarding.toast.updateFailed"));
      console.error(error);
    }
  };

  const handleAiTranslateDe = async () => {
    try {
      setIsTranslatingDe(true);
      const res = await translateOnboardingEnToDeAction({
        titleEn: formData.titleEn,
        descriptionEn: formData.descriptionEn,
        contentEn: formData.contentEn,
      });
      updateFormData({
        titleDe: res.titleDe,
        descriptionDe: res.descriptionDe,
        contentDe: res.contentDe,
      });
      if (Array.isArray(res.warnings) && res.warnings.length) {
        toast.warning(t("admin.onboarding.toast.aiTranslatedDeWithWarnings"), {
          description: res.warnings.join("\n"),
        });
      } else {
        toast.success(t("admin.onboarding.toast.aiTranslatedDe"));
      }
    } catch (error) {
      toast.error(t("admin.onboarding.toast.aiTranslateDeFailed"));
      console.error(error);
    } finally {
      setIsTranslatingDe(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deletingStepId) return;
    
    try {
      await deleteStepMutation({ stepId: deletingStepId });
      toast.success(t("admin.onboarding.toast.deleted"));
      setDeleteDialogOpen(false);
      setDeletingStepId(null);
    } catch (error) {
      toast.error(t("admin.onboarding.toast.deleteFailed"));
      console.error(error);
    }
  };

  // Handle toggle active
  const handleToggleActive = async (stepId: Id<"onboardingSteps">) => {
    try {
      await toggleStepActiveMutation({ stepId });
      toast.success(t("admin.onboarding.toast.statusUpdated"));
    } catch (error) {
      toast.error(t("admin.onboarding.toast.statusUpdateFailed"));
      console.error(error);
    }
  };

  // Available icons
  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Onboarding Management</h1>
        <p className="text-muted-foreground">
          Manage onboarding steps shown to new users (Column-based multilanguage)
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Onboarding Steps</CardTitle>
              <CardDescription>
                {allSteps?.length || 0} step(s) total
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  resetForm();
                  setCreateDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Step
              </Button>

              <Select value={previewLanguage} onValueChange={setPreviewLanguage}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => {
                  setPreviewStepNumber(null);
                  setPreviewDialogOpen(true);
                }}
                disabled={!allSteps || allSteps.length === 0}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {stepsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : !allSteps || allSteps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No onboarding steps found.
              <br />
              Click "Create Step" to add one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Title (EN)</TableHead>
                  <TableHead>Languages</TableHead>
                  <TableHead>Icon</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allSteps.map((step) => {
                  const hasDe = !!(step.titleDe || step.contentDe);
                  const isDeOutdated =
                    hasDe &&
                    step.enContentUpdatedAt != null &&
                    step.enContentUpdatedAt > (step.deContentUpdatedAt ?? 0);

                  return (
                    <TableRow key={step._id}>
                      <TableCell className="font-mono text-sm">
                        {step.stepNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{step.titleEn || "(No English title)"}</div>
                          <div className="text-sm text-muted-foreground">
                            {step.descriptionEn || ""}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {step.titleEn && (
                            <span className="text-xs bg-muted px-2 py-1 rounded">EN</span>
                          )}
                          {hasDe && !isDeOutdated && (
                            <span className="text-xs bg-muted px-2 py-1 rounded">DE</span>
                          )}
                          {hasDe && isDeOutdated && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-1 rounded flex items-center gap-1 cursor-default">
                                  <AlertTriangle className="h-3 w-3" />
                                  DE
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[220px] text-xs">
                                DE translation outdated – EN content was updated after the last DE save.
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {step.titleEs && (
                            <span className="text-xs bg-muted px-2 py-1 rounded">ES</span>
                          )}
                          {step.titleFr && (
                            <span className="text-xs bg-muted px-2 py-1 rounded">FR</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <IconDisplay iconName={step.icon} className="h-4 w-4" />
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {step.icon}
                          </code>
                        </div>
                      </TableCell>
                      <TableCell>
                        {step.isActive ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <ToggleRight className="h-4 w-4" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-400">
                            <ToggleLeft className="h-4 w-4" />
                            Inactive
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(step._id)}
                          >
                            {step.isActive ? (
                              <ToggleLeft className="h-4 w-4" />
                            ) : (
                              <ToggleRight className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setPreviewStepNumber(step.stepNumber);
                              setPreviewDialogOpen(true);
                            }}
                            title="Preview this step"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(step)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeletingStepId(step._id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
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

      {/* Create Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onOpenChange={(open) => {
          if (!open) {
            handleDialogClose('create');
          } else {
            setCreateDialogOpen(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => {
          if (hasUnsavedChanges) {
            e.preventDefault();
            setShowUnsavedWarning(true);
          }
        }}>
          <DialogHeader>
            <DialogTitle>Create Onboarding Step</DialogTitle>
            <DialogDescription>
              Add a new step to the onboarding flow (multilanguage)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stepNumber">Step Number</Label>
                <Input
                  id="stepNumber"
                  type="number"
                  value={formData.stepNumber}
                  onChange={(e) => updateFormData({ stepNumber: parseInt(e.target.value) })}
                />
              </div>
              
              <IconPicker
                value={formData.icon}
                onChange={(value) => updateFormData({ icon: value })}
                label="Icon"
              />
            </div>

            <Tabs defaultValue="en" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="en">English</TabsTrigger>
                <TabsTrigger value="de">Deutsch</TabsTrigger>
                <TabsTrigger value="es">Español</TabsTrigger>
                <TabsTrigger value="fr">Français</TabsTrigger>
              </TabsList>
              
              <TabsContent value="en" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="titleEn">Title (English)</Label>
                  <Input
                    id="titleEn"
                    value={formData.titleEn}
                    onChange={(e) => updateFormData({ titleEn: e.target.value })}
                    placeholder="Welcome to Serbian AI Tutor"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descriptionEn">Description (English)</Label>
                  <Input
                    id="descriptionEn"
                    value={formData.descriptionEn}
                    onChange={(e) => updateFormData({ descriptionEn: e.target.value })}
                    placeholder="Step 1 of 4"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contentEn">Content (English)</Label>
                  <RichTextEditor
                    value={formData.contentEn}
                    onChange={(value) => updateFormData({ contentEn: value })}
                    placeholder="Enter English content..."
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="de" className="space-y-4">
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAiTranslateDe}
                    disabled={isTranslatingDe || (!formData.titleEn && !formData.descriptionEn && !formData.contentEn)}
                  >
                    {isTranslatingDe ? t("common.loading") : t("admin.onboarding.actions.aiTranslateDe")}
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="titleDe">Title (Deutsch)</Label>
                  <Input
                    id="titleDe"
                    value={formData.titleDe}
                    onChange={(e) => updateFormData({ titleDe: e.target.value })}
                    placeholder="Willkommen beim serbischen AI Tutor"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descriptionDe">Description (Deutsch)</Label>
                  <Input
                    id="descriptionDe"
                    value={formData.descriptionDe}
                    onChange={(e) => updateFormData({ descriptionDe: e.target.value })}
                    placeholder="Schritt 1 von 4"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contentDe">Content (Deutsch)</Label>
                  <RichTextEditor
                    value={formData.contentDe}
                    onChange={(value) => updateFormData({ contentDe: value })}
                    placeholder="Deutschen Inhalt eingeben..."
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="es" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="titleEs">Title (Español)</Label>
                  <Input
                    id="titleEs"
                    value={formData.titleEs}
                    onChange={(e) => updateFormData({ titleEs: e.target.value })}
                    placeholder="Bienvenido al tutor serbio AI"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descriptionEs">Description (Español)</Label>
                  <Input
                    id="descriptionEs"
                    value={formData.descriptionEs}
                    onChange={(e) => updateFormData({ descriptionEs: e.target.value })}
                    placeholder="Paso 1 de 4"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contentEs">Content (Español)</Label>
                  <RichTextEditor
                    value={formData.contentEs}
                    onChange={(value) => updateFormData({ contentEs: value })}
                    placeholder="Ingrese contenido en español..."
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="fr" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="titleFr">Title (Français)</Label>
                  <Input
                    id="titleFr"
                    value={formData.titleFr}
                    onChange={(e) => updateFormData({ titleFr: e.target.value })}
                    placeholder="Bienvenue au tuteur serbe AI"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descriptionFr">Description (Français)</Label>
                  <Input
                    id="descriptionFr"
                    value={formData.descriptionFr}
                    onChange={(e) => updateFormData({ descriptionFr: e.target.value })}
                    placeholder="Étape 1 sur 4"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contentFr">Content (Français)</Label>
                  <RichTextEditor
                    value={formData.contentFr}
                    onChange={(value) => updateFormData({ contentFr: value })}
                    placeholder="Entrez le contenu en français..."
                  />
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="space-y-2">
              <Label htmlFor="backgroundColor">Background Color (optional)</Label>
              <Input
                id="backgroundColor"
                value={formData.backgroundColor}
                onChange={(e) => updateFormData({ backgroundColor: e.target.value })}
                placeholder="e.g., #f0f9ff"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => updateFormData({ isActive: checked })}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogClose('create')}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>
              Create Step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog - Same structure as Create */}
      <Dialog 
        open={editDialogOpen} 
        onOpenChange={(open) => {
          if (!open) {
            handleDialogClose('edit');
          } else {
            setEditDialogOpen(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => {
          if (hasUnsavedChanges) {
            e.preventDefault();
            setShowUnsavedWarning(true);
          }
        }}>
          <DialogHeader>
            <DialogTitle>Edit Onboarding Step</DialogTitle>
            <DialogDescription>
              Update the onboarding step details (multilanguage)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-stepNumber">Step Number</Label>
                <Input
                  id="edit-stepNumber"
                  type="number"
                  value={formData.stepNumber}
                  onChange={(e) => updateFormData({ stepNumber: parseInt(e.target.value) })}
                />
              </div>
              
              <IconPicker
                value={formData.icon}
                onChange={(value) => updateFormData({ icon: value })}
                label="Icon"
              />
            </div>

            <Tabs defaultValue="en" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="en">English</TabsTrigger>
                <TabsTrigger value="de">Deutsch</TabsTrigger>
                <TabsTrigger value="es">Español</TabsTrigger>
                <TabsTrigger value="fr">Français</TabsTrigger>
              </TabsList>
              
              <TabsContent value="en" className="space-y-4">
                <div className="space-y-2">
                  <Label>Title (English)</Label>
                  <Input
                    value={formData.titleEn}
                    onChange={(e) => updateFormData({ titleEn: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (English)</Label>
                  <Input
                    value={formData.descriptionEn}
                    onChange={(e) => updateFormData({ descriptionEn: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Content (English)</Label>
                  <RichTextEditor
                    value={formData.contentEn}
                    onChange={(value) => updateFormData({ contentEn: value })}
                    placeholder="Enter English content..."
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="de" className="space-y-4">
                {editingStepIsDeOutdated && (
                  <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    DE translation is outdated – EN content was updated after the last DE save.
                  </div>
                )}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAiTranslateDe}
                    disabled={isTranslatingDe || (!formData.titleEn && !formData.descriptionEn && !formData.contentEn)}
                  >
                    {isTranslatingDe ? t("common.loading") : t("admin.onboarding.actions.aiTranslateDe")}
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Title (Deutsch)</Label>
                  <Input
                    value={formData.titleDe}
                    onChange={(e) => updateFormData({ titleDe: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (Deutsch)</Label>
                  <Input
                    value={formData.descriptionDe}
                    onChange={(e) => updateFormData({ descriptionDe: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Content (Deutsch)</Label>
                  <RichTextEditor
                    value={formData.contentDe}
                    onChange={(value) => updateFormData({ contentDe: value })}
                    placeholder="Deutschen Inhalt eingeben..."
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="es" className="space-y-4">
                <div className="space-y-2">
                  <Label>Title (Español)</Label>
                  <Input
                    value={formData.titleEs}
                    onChange={(e) => updateFormData({ titleEs: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (Español)</Label>
                  <Input
                    value={formData.descriptionEs}
                    onChange={(e) => updateFormData({ descriptionEs: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Content (Español)</Label>
                  <RichTextEditor
                    value={formData.contentEs}
                    onChange={(value) => updateFormData({ contentEs: value })}
                    placeholder="Ingrese contenido en español..."
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="fr" className="space-y-4">
                <div className="space-y-2">
                  <Label>Title (Français)</Label>
                  <Input
                    value={formData.titleFr}
                    onChange={(e) => updateFormData({ titleFr: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (Français)</Label>
                  <Input
                    value={formData.descriptionFr}
                    onChange={(e) => updateFormData({ descriptionFr: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Content (Français)</Label>
                  <RichTextEditor
                    value={formData.contentFr}
                    onChange={(value) => updateFormData({ contentFr: value })}
                    placeholder="Entrez le contenu en français..."
                  />
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="space-y-2">
              <Label htmlFor="edit-backgroundColor">Background Color (optional)</Label>
              <Input
                id="edit-backgroundColor"
                value={formData.backgroundColor}
                onChange={(e) => updateFormData({ backgroundColor: e.target.value })}
                placeholder="e.g., #f0f9ff"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => updateFormData({ isActive: checked })}
              />
              <Label htmlFor="edit-isActive">Active</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogClose('edit')}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>
              Update Step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the onboarding step.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Changes Warning Dialog */}
      <AlertDialog open={showUnsavedWarning} onOpenChange={setShowUnsavedWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to close this dialog? All changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Editing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCloseDialog} className="bg-red-600">
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      {previewDialogOpen && (
        <WelcomeOnboarding
          userName="Admin Preview"
          language={previewLanguage}
          onClose={(disableAutoShow) => {
            // In preview mode, we ignore the disableAutoShow flag
            setPreviewDialogOpen(false);
            setPreviewStepNumber(null);
          }}
          initialStep={previewStepNumber ?? 1}
        />
      )}
    </div>
  );
}
