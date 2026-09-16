import { useEffect, useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Doc } from "../../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Languages, Loader2 } from "lucide-react";

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
  if (message.includes("Unauthorized"))
    return t("admin.contentStudio.modules.errorUnauthorized", "Unauthorized. Superadmin required.");
  return message;
}

interface CreateModuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Next free module number to pre-fill (e.g. max existing + 1). */
  suggestedModuleNumber?: number;
  onCreated: (module: Doc<"moduleMetadata">) => void;
}

export function CreateModuleDialog({ open, onOpenChange, suggestedModuleNumber, onCreated }: CreateModuleDialogProps) {
  const { t } = useTranslation();
  const createModuleMutation = useMutation(api.modules.createModule);
  const translateModuleAction = useAction(api.modules.translateModuleEnToDe);

  const [moduleNumber, setModuleNumber] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [titleDe, setTitleDe] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionDe, setDescriptionDe] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [translating, setTranslating] = useState(false);

  // Reset the form every time the dialog is (re-)opened.
  useEffect(() => {
    if (!open) return;
    setModuleNumber(suggestedModuleNumber ? String(suggestedModuleNumber) : "");
    setTitleEn("");
    setTitleDe("");
    setDescriptionEn("");
    setDescriptionDe("");
    setSlug("");
    setSlugTouched(false);
  }, [open, suggestedModuleNumber]);

  useEffect(() => {
    if (slugTouched) return;
    setSlug(slugify(titleEn));
  }, [titleEn, slugTouched]);

  const handleTranslate = async () => {
    if (!titleEn.trim() || !descriptionEn.trim()) {
      toast.error(t("admin.contentStudio.modules.toastCannotTranslate", "Cannot translate"), {
        description: t("admin.contentStudio.modules.toastFillEnglishFirst", "Please fill Title (EN) and Description (EN) first."),
      });
      return;
    }
    try {
      setTranslating(true);
      const res = await translateModuleAction({ titleEn, descriptionEn });
      setTitleDe(res.titleDe);
      setDescriptionDe(res.descriptionDe);
      toast.success(t("admin.contentStudio.modules.toastTranslated", "German translation generated"));
    } catch (error: any) {
      toast.error(t("admin.contentStudio.modules.toastTranslateFailed", "Failed to translate to German"), {
        description: humanizeModuleError(String(error?.message || error), t),
      });
    } finally {
      setTranslating(false);
    }
  };

  const handleCreate = async () => {
    try {
      setCreating(true);
      const parsedModuleNumber = Number(moduleNumber);
      const finalSlug = slug || slugify(titleEn);

      const moduleId = await createModuleMutation({
        moduleNumber: parsedModuleNumber,
        slug: finalSlug,
        titleEn,
        titleDe,
        descriptionEn,
        descriptionDe,
      });

      toast.success(t("admin.contentStudio.modules.toastCreated", "Module created"));
      onCreated({
        _id: moduleId,
        moduleNumber: parsedModuleNumber,
        slug: finalSlug,
        titleEn,
        titleDe,
        descriptionEn,
        descriptionDe,
      } as Doc<"moduleMetadata">);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(t("admin.contentStudio.modules.toastCreateFailed", "Failed to create module"), {
        description: humanizeModuleError(String(error?.message || error), t),
      });
    } finally {
      setCreating(false);
    }
  };

  const canCreate =
    !creating &&
    Number.isInteger(Number(moduleNumber)) &&
    Number(moduleNumber) > 0 &&
    slug.trim().length > 0 &&
    titleEn.trim().length > 0 &&
    titleDe.trim().length > 0 &&
    descriptionEn.trim().length > 0 &&
    descriptionDe.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("admin.contentStudio.modules.createNewTitle", "Create new module")}</DialogTitle>
          <DialogDescription>
            {t(
              "admin.contentStudio.modules.createNewDescription",
              "Modules are created in English first. Use \"Translate to German\" to generate the German title and description, then review before saving. This module will immediately be available for reuse in the Modules tab.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2 py-2">
          <div className="space-y-2">
            <Label>{t("admin.contentStudio.modules.moduleNumber", "Module number")}</Label>
            <Input
              inputMode="numeric"
              pattern="[0-9]*"
              value={moduleNumber}
              onChange={(e) => setModuleNumber(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("admin.contentStudio.modules.slug", "Slug")}</Label>
            <Input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("admin.contentStudio.modules.titleEn", "Title (EN)")}</Label>
            <Input placeholder="Module 6: ..." value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("admin.contentStudio.modules.titleDe", "Title (DE)")}</Label>
            <Input
              placeholder={t("admin.contentStudio.modules.generatedPlaceholder", "Generated via \"Translate to German\"")}
              value={titleDe}
              readOnly
              tabIndex={-1}
              className="bg-muted/50 cursor-not-allowed"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>{t("admin.contentStudio.modules.descriptionEn", "Description (EN)")}</Label>
            <Textarea value={descriptionEn} onChange={(e) => setDescriptionEn(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>{t("admin.contentStudio.modules.descriptionDe", "Description (DE)")}</Label>
            <Textarea
              placeholder={t("admin.contentStudio.modules.generatedPlaceholder", "Generated via \"Translate to German\"")}
              value={descriptionDe}
              readOnly
              tabIndex={-1}
              className="bg-muted/50 cursor-not-allowed"
            />
          </div>
          <div className="md:col-span-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleTranslate()}
              disabled={translating || !titleEn.trim() || !descriptionEn.trim()}
              className="gap-2"
            >
              {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
              {t("admin.contentStudio.modules.translateToGerman", "Translate to German")}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {t(
            "admin.contentStudio.modules.germanAutoHintDialog",
            "German fields are filled automatically. Fill the English fields, then click \"Translate to German\" before creating the module.",
          )}
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            {t("admin.contentStudio.modules.cancel", "Cancel")}
          </Button>
          <Button onClick={() => void handleCreate()} disabled={!canCreate}>
            {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {t("admin.contentStudio.modules.createButton", "Create module")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
