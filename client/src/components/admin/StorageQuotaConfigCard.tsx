import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { HardDrive } from "lucide-react";
import { toast } from "sonner";

const MB = 1024 * 1024;

type StorageQuotaDraft = {
  standaloneMb: number;
  courseAiProMb: number;
  betaMb: number;
};

function bytesToMb(bytes: number): number {
  return Math.round(bytes / MB);
}

function mbToBytes(mb: number): number {
  return Math.round(mb * MB);
}

export function StorageQuotaConfigCard() {
  const { t } = useTranslation();
  const config = useQuery(api.platform.getPlatformConfig);
  const setStorageQuotaConfig = useMutation(api.platform.setStorageQuotaConfig);

  const [draft, setDraft] = useState<StorageQuotaDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!config) return;
    setDraft({
      standaloneMb: bytesToMb(config.storageQuotaStandaloneBytes),
      courseAiProMb: bytesToMb(config.storageQuotaCourseAiProBytes),
      betaMb: bytesToMb(config.storageQuotaBetaBytes),
    });
  }, [config]);

  const dirty =
    draft !== null &&
    config !== undefined &&
    (mbToBytes(draft.standaloneMb) !== config.storageQuotaStandaloneBytes ||
      mbToBytes(draft.courseAiProMb) !== config.storageQuotaCourseAiProBytes ||
      mbToBytes(draft.betaMb) !== config.storageQuotaBetaBytes);

  const handleField = (key: keyof StorageQuotaDraft, raw: string) => {
    if (!draft) return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return;
    setDraft({ ...draft, [key]: Math.round(n) });
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await setStorageQuotaConfig({
        storageQuotaStandaloneBytes: mbToBytes(draft.standaloneMb),
        storageQuotaCourseAiProBytes: mbToBytes(draft.courseAiProMb),
        storageQuotaBetaBytes: mbToBytes(draft.betaMb),
      });
      toast.success(t("adminStorage.quotaConfig.saved"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("adminStorage.quotaConfig.saveFailed")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HardDrive className="h-4 w-4 text-muted-foreground" />
          {t("adminStorage.quotaConfig.title")}
        </CardTitle>
        <CardDescription>{t("adminStorage.quotaConfig.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="sq-standalone" className="text-sm">
              {t("adminStorage.quotaConfig.standalone")}
            </Label>
            <Input
              id="sq-standalone"
              type="number"
              min={1}
              step={1}
              value={draft ? String(draft.standaloneMb) : ""}
              onChange={(e) => handleField("standaloneMb", e.target.value)}
              disabled={draft === null}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("adminStorage.quotaConfig.standaloneHint")}
            </p>
          </div>
          <div>
            <Label htmlFor="sq-pro" className="text-sm">
              {t("adminStorage.quotaConfig.courseAiPro")}
            </Label>
            <Input
              id="sq-pro"
              type="number"
              min={1}
              step={1}
              value={draft ? String(draft.courseAiProMb) : ""}
              onChange={(e) => handleField("courseAiProMb", e.target.value)}
              disabled={draft === null}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("adminStorage.quotaConfig.courseAiProHint")}
            </p>
          </div>
          <div>
            <Label htmlFor="sq-beta" className="text-sm">
              {t("adminStorage.quotaConfig.beta")}
            </Label>
            <Input
              id="sq-beta"
              type="number"
              min={1}
              step={1}
              value={draft ? String(draft.betaMb) : ""}
              onChange={(e) => handleField("betaMb", e.target.value)}
              disabled={draft === null}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("adminStorage.quotaConfig.betaHint")}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground border-l-2 border-muted pl-3">
          {t("adminStorage.quotaConfig.unitNote")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("adminStorage.quotaConfig.noDocumentsNote")}
        </p>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!dirty || draft === null || saving}>
            {saving ? t("adminStorage.quotaConfig.saving") : t("adminStorage.quotaConfig.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
