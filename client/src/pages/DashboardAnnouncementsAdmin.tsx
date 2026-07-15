import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Plus, Edit, Trash2, Gift, X, Copy } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { DASHBOARD_BETA_BANNER_KEY } from "@/lib/dashboardAnnouncementKeys";

type Audience = "all_authenticated" | "beta_testers_only";
type PreviewLocale = "en" | "de";

/** Matches the beta banner on `Dashboard.tsx` (read-only close control in admin preview). */
function DashboardBannerLivePreview({
  title,
  intro,
  body,
  dismissAriaLabel,
  emptyHint,
}: {
  title: string;
  intro: string;
  body: string;
  dismissAriaLabel: string;
  emptyHint: string;
}) {
  const hasAny = title.trim() || intro.trim() || body.trim();
  if (!hasAny) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyHint}
      </div>
    );
  }
  return (
    <div className="border border-yellow-400 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg p-3 md:p-4">
      <div className="flex items-start gap-2 md:gap-3">
        <div className="bg-yellow-400 rounded-full p-1.5 md:p-2 flex-shrink-0">
          <Gift className="h-4 w-4 md:h-5 md:w-5 text-yellow-900" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1 md:mb-2">
            <h3 className="font-bold text-base md:text-lg text-gray-900">{title.trim() || "—"}</h3>
            <button
              type="button"
              tabIndex={-1}
              className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-50 pointer-events-none"
              aria-label={dismissAriaLabel}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {intro.trim() ? (
            <p className="text-xs md:text-sm text-gray-700 mb-1 md:mb-2">{intro}</p>
          ) : null}
          {body.trim() ? (
            <div className="bg-white/80 rounded-md p-1.5 md:p-2 border border-yellow-300">
              <p className="text-xs md:text-sm text-gray-600 whitespace-pre-wrap">{body}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const defaultForm = {
  key: DASHBOARD_BETA_BANNER_KEY,
  titleEn: "",
  introEn: "",
  bodyEn: "",
  titleDe: "",
  introDe: "",
  bodyDe: "",
  isActive: true,
  audience: "beta_testers_only" as Audience,
};

export default function DashboardAnnouncementsAdmin() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const { language: uiLanguage } = useLanguage();

  const rows = useQuery(api.dashboardAnnouncements.listDashboardAnnouncements);
  const createMutation = useMutation(api.dashboardAnnouncements.createDashboardAnnouncement);
  const updateMutation = useMutation(api.dashboardAnnouncements.updateDashboardAnnouncement);
  const deleteMutation = useMutation(api.dashboardAnnouncements.deleteDashboardAnnouncement);
  const translateEnToDeAction = useAction(api.dashboardAnnouncements.translateDashboardAnnouncementEnToDe);

  const [createOpen, setCreateOpen] = useState(false);
  const [isTranslatingDe, setIsTranslatingDe] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<Id<"dashboardAnnouncements"> | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"dashboardAnnouncements"> | null>(null);
  const [previewLocale, setPreviewLocale] = useState<PreviewLocale>("en");

  const resetForm = () => {
    setForm(defaultForm);
    setEditingId(null);
  };

  const openEdit = (doc: Doc<"dashboardAnnouncements">) => {
    setEditingId(doc._id);
    setForm({
      key: doc.key,
      titleEn: doc.titleEn,
      introEn: doc.introEn,
      bodyEn: doc.bodyEn,
      titleDe: doc.titleDe ?? "",
      introDe: doc.introDe ?? "",
      bodyDe: doc.bodyDe ?? "",
      isActive: doc.isActive,
      audience: doc.audience,
    });
    setEditOpen(true);
  };

  useEffect(() => {
    if (createOpen || editOpen) {
      setPreviewLocale(uiLanguage);
    }
  }, [createOpen, editOpen, uiLanguage]);

  const previewData = useMemo(() => {
    if (previewLocale === "en") {
      return {
        title: form.titleEn,
        intro: form.introEn,
        body: form.bodyEn,
        showFallback: false,
      };
    }
    const hasDe =
      form.titleDe.trim() !== "" ||
      form.introDe.trim() !== "" ||
      form.bodyDe.trim() !== "";
    const hasEn =
      form.titleEn.trim() !== "" ||
      form.introEn.trim() !== "" ||
      form.bodyEn.trim() !== "";
    return {
      title: form.titleDe.trim() || form.titleEn,
      intro: form.introDe.trim() || form.introEn,
      body: form.bodyDe.trim() || form.bodyEn,
      showFallback: !hasDe && hasEn,
    };
  }, [previewLocale, form]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Unauthorized</CardTitle>
            <CardDescription>You don&apos;t have permission to access this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleCreate = async () => {
    try {
      await createMutation({
        key: form.key,
        titleEn: form.titleEn,
        introEn: form.introEn,
        bodyEn: form.bodyEn,
        titleDe: form.titleDe.trim() ? form.titleDe : undefined,
        introDe: form.introDe.trim() ? form.introDe : undefined,
        bodyDe: form.bodyDe.trim() ? form.bodyDe : undefined,
        isActive: form.isActive,
        audience: form.audience,
      });
      toast.success(t("admin.dashboardAnnouncements.toast.created"));
      setCreateOpen(false);
      resetForm();
    } catch (e) {
      console.error(e);
      toast.error(t("admin.dashboardAnnouncements.toast.createFailed"));
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    try {
      await updateMutation({
        announcementId: editingId,
        key: form.key,
        titleEn: form.titleEn,
        introEn: form.introEn,
        bodyEn: form.bodyEn,
        titleDe: form.titleDe,
        introDe: form.introDe,
        bodyDe: form.bodyDe,
        isActive: form.isActive,
        audience: form.audience,
      });
      toast.success(t("admin.dashboardAnnouncements.toast.updated"));
      setEditOpen(false);
      resetForm();
    } catch (e) {
      console.error(e);
      toast.error(t("admin.dashboardAnnouncements.toast.updateFailed"));
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation({ announcementId: deletingId });
      toast.success(t("admin.dashboardAnnouncements.toast.deleted"));
      setDeleteOpen(false);
      setDeletingId(null);
    } catch (e) {
      console.error(e);
      toast.error(t("admin.dashboardAnnouncements.toast.deleteFailed"));
    }
  };

  const handleToggleActive = async (doc: Doc<"dashboardAnnouncements">, isActive: boolean) => {
    try {
      await updateMutation({
        announcementId: doc._id,
        isActive,
      });
      toast.success(
        isActive
          ? t("admin.dashboardAnnouncements.toast.toggledOnline")
          : t("admin.dashboardAnnouncements.toast.toggledOffline"),
      );
    } catch (e) {
      console.error(e);
      toast.error(t("admin.dashboardAnnouncements.toast.toggleFailed"));
    }
  };

  const nextCopyKey = (sourceKey: string): string => {
    const existing = new Set((rows ?? []).map((r) => r.key));
    const base = `${sourceKey}_copy`;
    if (!existing.has(base)) return base;
    let n = 2;
    while (existing.has(`${base}_${n}`)) n += 1;
    return `${base}_${n}`;
  };

  const handleCopy = async (doc: Doc<"dashboardAnnouncements">) => {
    try {
      const newKey = nextCopyKey(doc.key);
      const newId = await createMutation({
        key: newKey,
        titleEn: doc.titleEn,
        introEn: doc.introEn,
        bodyEn: doc.bodyEn,
        titleDe: doc.titleDe,
        introDe: doc.introDe,
        bodyDe: doc.bodyDe,
        isActive: false,
        audience: doc.audience,
      });
      toast.success(t("admin.dashboardAnnouncements.toast.copied", { key: newKey }));
      setEditingId(newId);
      setForm({
        key: newKey,
        titleEn: doc.titleEn,
        introEn: doc.introEn,
        bodyEn: doc.bodyEn,
        titleDe: doc.titleDe ?? "",
        introDe: doc.introDe ?? "",
        bodyDe: doc.bodyDe ?? "",
        isActive: false,
        audience: doc.audience,
      });
      setEditOpen(true);
    } catch (e) {
      console.error(e);
      toast.error(t("admin.dashboardAnnouncements.toast.copyFailed"));
    }
  };

  const audienceLabel = (a: Audience) =>
    a === "beta_testers_only"
      ? t("admin.dashboardAnnouncements.audience.beta")
      : t("admin.dashboardAnnouncements.audience.all");

  const handleAiTranslateDe = async () => {
    if (!form.titleEn.trim() || !form.introEn.trim() || !form.bodyEn.trim()) {
      toast.error(t("admin.dashboardAnnouncements.toast.aiTranslateNeedsEnglish"));
      return;
    }
    setIsTranslatingDe(true);
    try {
      const res = await translateEnToDeAction({
        titleEn: form.titleEn,
        introEn: form.introEn,
        bodyEn: form.bodyEn,
      });
      setForm((f) => ({
        ...f,
        titleDe: res.titleDe,
        introDe: res.introDe,
        bodyDe: res.bodyDe,
      }));
      if (Array.isArray(res.warnings) && res.warnings.length) {
        toast.warning(t("admin.dashboardAnnouncements.toast.aiTranslatedDeWithWarnings"), {
          description: res.warnings.join("\n"),
        });
      } else {
        toast.success(t("admin.dashboardAnnouncements.toast.aiTranslatedDe"));
      }
    } catch (error) {
      console.error(error);
      toast.error(t("admin.dashboardAnnouncements.toast.aiTranslateDeFailed"));
    } finally {
      setIsTranslatingDe(false);
    }
  };

  const formFieldsInner = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="da-key">{t("admin.dashboardAnnouncements.form.key")}</Label>
        <Input
          id="da-key"
          value={form.key}
          onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
          placeholder={DASHBOARD_BETA_BANNER_KEY}
        />
        <p className="text-xs text-muted-foreground">{t("admin.dashboardAnnouncements.form.keyHint")}</p>
      </div>
      <div className="space-y-2">
        <Label>{t("admin.dashboardAnnouncements.form.audience")}</Label>
        <Select
          value={form.audience}
          onValueChange={(v) => setForm((f) => ({ ...f, audience: v as Audience }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_authenticated">
              {t("admin.dashboardAnnouncements.audience.all")}
            </SelectItem>
            <SelectItem value="beta_testers_only">
              {t("admin.dashboardAnnouncements.audience.beta")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="da-active"
          checked={form.isActive}
          onCheckedChange={(c) => setForm((f) => ({ ...f, isActive: c }))}
        />
        <Label htmlFor="da-active">{t("admin.dashboardAnnouncements.form.active")}</Label>
      </div>
      <div className="space-y-2">
        <Label htmlFor="da-title-en">{t("admin.dashboardAnnouncements.form.titleEn")}</Label>
        <Input
          id="da-title-en"
          value={form.titleEn}
          onChange={(e) => setForm((f) => ({ ...f, titleEn: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="da-intro-en">{t("admin.dashboardAnnouncements.form.introEn")}</Label>
        <Textarea
          id="da-intro-en"
          rows={2}
          value={form.introEn}
          onChange={(e) => setForm((f) => ({ ...f, introEn: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="da-body-en">{t("admin.dashboardAnnouncements.form.bodyEn")}</Label>
        <Textarea
          id="da-body-en"
          rows={8}
          value={form.bodyEn}
          onChange={(e) => setForm((f) => ({ ...f, bodyEn: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">{t("admin.dashboardAnnouncements.form.bodyHint")}</p>
      </div>
      <div className="flex justify-end pt-1 pb-2 border-t border-border/60">
        <Button
          type="button"
          variant="secondary"
          onClick={handleAiTranslateDe}
          disabled={
            isTranslatingDe ||
            !form.titleEn.trim() ||
            !form.introEn.trim() ||
            !form.bodyEn.trim()
          }
        >
          {isTranslatingDe ? t("common.loading") : t("admin.dashboardAnnouncements.actions.aiTranslateDe")}
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor="da-title-de">{t("admin.dashboardAnnouncements.form.titleDe")}</Label>
        <Input
          id="da-title-de"
          value={form.titleDe}
          onChange={(e) => setForm((f) => ({ ...f, titleDe: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="da-intro-de">{t("admin.dashboardAnnouncements.form.introDe")}</Label>
        <Textarea
          id="da-intro-de"
          rows={2}
          value={form.introDe}
          onChange={(e) => setForm((f) => ({ ...f, introDe: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="da-body-de">{t("admin.dashboardAnnouncements.form.bodyDe")}</Label>
        <Textarea
          id="da-body-de"
          rows={6}
          value={form.bodyDe}
          onChange={(e) => setForm((f) => ({ ...f, bodyDe: e.target.value }))}
        />
      </div>
    </div>
  );

  /** Form first, full width; preview below — no side-by-side columns. */
  const bannerEditorStack = (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-8">
      <div className="w-full min-w-0">{formFieldsInner}</div>
      <div className="w-full min-w-0 border-t border-border pt-6">
        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("admin.dashboardAnnouncements.preview.title")}</p>
            <Tabs
              value={previewLocale}
              onValueChange={(v) => setPreviewLocale(v as PreviewLocale)}
            >
              <TabsList className="grid h-9 w-full max-w-md grid-cols-2">
                <TabsTrigger value="en">{t("admin.dashboardAnnouncements.preview.tabEn")}</TabsTrigger>
                <TabsTrigger value="de">{t("admin.dashboardAnnouncements.preview.tabDe")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {previewData.showFallback ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
              {t("admin.dashboardAnnouncements.preview.fallbackNote")}
            </p>
          ) : null}
          <div className="w-full rounded-md border bg-muted/30 p-3">
            <DashboardBannerLivePreview
              title={previewData.title}
              intro={previewData.intro}
              body={previewData.body}
              dismissAriaLabel={t("dashboard.betaBanner.dismissAria")}
              emptyHint={t("admin.dashboardAnnouncements.preview.empty")}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container max-w-5xl py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">{t("admin.dashboardAnnouncements.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("admin.dashboardAnnouncements.subtitle")}</p>
          <p className="text-muted-foreground mt-2 text-sm max-w-2xl">
            {t("admin.dashboardAnnouncements.workflowHint")}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Button
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("admin.dashboardAnnouncements.create")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.dashboardAnnouncements.title")}</CardTitle>
          <CardDescription>{rows?.length ?? 0} total</CardDescription>
        </CardHeader>
        <CardContent>
          {rows === undefined ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No banners yet. Create one with key {DASHBOARD_BETA_BANNER_KEY} for the beta dashboard message.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.dashboardAnnouncements.table.key")}</TableHead>
                  <TableHead>{t("admin.dashboardAnnouncements.table.audience")}</TableHead>
                  <TableHead>{t("admin.dashboardAnnouncements.table.active")}</TableHead>
                  <TableHead>{t("admin.dashboardAnnouncements.table.updated")}</TableHead>
                  <TableHead className="text-right">{t("admin.dashboardAnnouncements.table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows as Array<Doc<"dashboardAnnouncements">>).map((doc: Doc<"dashboardAnnouncements">) => (
                  <TableRow key={doc._id}>
                    <TableCell className="font-mono text-sm">{doc.key}</TableCell>
                    <TableCell>{audienceLabel(doc.audience)}</TableCell>
                    <TableCell>
                      <Switch
                        checked={doc.isActive}
                        onCheckedChange={(checked) => handleToggleActive(doc, checked)}
                        aria-label={
                          doc.isActive
                            ? t("admin.dashboardAnnouncements.table.activeOnline")
                            : t("admin.dashboardAnnouncements.table.activeOffline")
                        }
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(doc.updatedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(doc)}>
                        <Edit className="h-4 w-4 mr-1" />
                        {t("admin.dashboardAnnouncements.edit")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleCopy(doc)}>
                        <Copy className="h-4 w-4 mr-1" />
                        {t("admin.dashboardAnnouncements.copy")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => {
                          setDeletingId(doc._id);
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {t("admin.dashboardAnnouncements.delete")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="flex h-[min(92vh,900px)] w-[min(80vw,calc(100vw-1rem))] min-w-[min(80vw,calc(100vw-1rem))] !max-w-none flex-col gap-0 overflow-hidden p-0 sm:!max-w-none">
          <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
            <DialogTitle>{t("admin.dashboardAnnouncements.dialog.createTitle")}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-4">
            {bannerEditorStack}
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4 sm:justify-end">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleCreate}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="flex h-[min(92vh,900px)] w-[min(80vw,calc(100vw-1rem))] min-w-[min(80vw,calc(100vw-1rem))] !max-w-none flex-col gap-0 overflow-hidden p-0 sm:!max-w-none">
          <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
            <DialogTitle>{t("admin.dashboardAnnouncements.dialog.editTitle")}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-4">
            {bannerEditorStack}
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4 sm:justify-end">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleUpdate}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.dashboardAnnouncements.dialog.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.dashboardAnnouncements.dialog.deleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingId(null)}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t("admin.dashboardAnnouncements.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
