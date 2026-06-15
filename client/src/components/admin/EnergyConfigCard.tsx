import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Zap, CreditCard } from "lucide-react";

type EnergyFields = {
  energyCostCompact: number;
  energyCostDetailed: number;
  energyRagSurcharge: number;
  energyVisionSurcharge: number;
  energyUploadBase: number;
  energyUploadPerKb: number;
  energyQuotaFull: number;
  energyQuotaBuddy: number;
  energyQuotaBasic: number;
  uploadMaxFileBytes: number;
};

type FieldDef = {
  key: keyof EnergyFields;
  label: string;
  hint: string;
  step?: number;
};

const COST_FIELDS: FieldDef[] = [
  { key: "energyCostCompact", label: "Compact answer", hint: "Energy per compact reply", step: 1 },
  { key: "energyCostDetailed", label: "Detailed answer", hint: "Energy per detailed reply", step: 1 },
  { key: "energyRagSurcharge", label: "RAG surcharge", hint: "Added when knowledge base is used", step: 1 },
  { key: "energyVisionSurcharge", label: "Vision surcharge", hint: "Added for image analysis", step: 1 },
  { key: "energyUploadBase", label: "Upload base", hint: "Flat fee per document upload", step: 1 },
  { key: "energyUploadPerKb", label: "Upload per KB", hint: "Per-KB factor (decimals allowed, e.g. 0.02)", step: 0.01 },
];

const QUOTA_FIELDS: FieldDef[] = [
  { key: "energyQuotaFull", label: "Full quota", hint: "Inclusive monthly Energy for the Full plan", step: 10 },
  { key: "energyQuotaBuddy", label: "Buddy quota", hint: "Inclusive monthly Energy for the Buddy plan", step: 10 },
  { key: "energyQuotaBasic", label: "Basic quota", hint: "Inclusive monthly Energy for the Basic plan", step: 10 },
];

type BillingFields = {
  welcomeEnergyAmount: number;
  betaTesterDiscountPercent: number;
};

/**
 * Superadmin control for the AI-Energy configuration: per-action cost table,
 * monthly tier quotas, and the technical upload cap. Also handles billing
 * config (Welcome-Energy and Beta-Tester discount). Reads/writes the
 * platform-config singleton.
 */
export function EnergyConfigCard() {
  const config = useQuery(api.platform.getPlatformConfig);
  const setEnergyConfig = useMutation(api.platform.setEnergyConfig);
  const setBillingConfig = useMutation(api.platform.setBillingConfig);

  const [draft, setDraft] = useState<EnergyFields | null>(null);
  const [billingDraft, setBillingDraft] = useState<BillingFields | null>(null);

  useEffect(() => {
    if (config) {
      setDraft({
        energyCostCompact: config.energyCostCompact,
        energyCostDetailed: config.energyCostDetailed,
        energyRagSurcharge: config.energyRagSurcharge,
        energyVisionSurcharge: config.energyVisionSurcharge,
        energyUploadBase: config.energyUploadBase,
        energyUploadPerKb: config.energyUploadPerKb,
        energyQuotaFull: config.energyQuotaFull,
        energyQuotaBuddy: config.energyQuotaBuddy,
        energyQuotaBasic: config.energyQuotaBasic,
        uploadMaxFileBytes: config.uploadMaxFileBytes,
      });
      setBillingDraft({
        welcomeEnergyAmount: config.welcomeEnergyAmount,
        betaTesterDiscountPercent: config.betaTesterDiscountPercent,
      });
    }
  }, [config]);

  const dirty = draft !== null && config !== undefined && (
    draft.energyCostCompact !== config.energyCostCompact ||
    draft.energyCostDetailed !== config.energyCostDetailed ||
    draft.energyRagSurcharge !== config.energyRagSurcharge ||
    draft.energyVisionSurcharge !== config.energyVisionSurcharge ||
    draft.energyUploadBase !== config.energyUploadBase ||
    draft.energyUploadPerKb !== config.energyUploadPerKb ||
    draft.energyQuotaFull !== config.energyQuotaFull ||
    draft.energyQuotaBuddy !== config.energyQuotaBuddy ||
    draft.energyQuotaBasic !== config.energyQuotaBasic ||
    draft.uploadMaxFileBytes !== config.uploadMaxFileBytes
  );

  const billingDirty = billingDraft !== null && config !== undefined && (
    billingDraft.welcomeEnergyAmount !== config.welcomeEnergyAmount ||
    billingDraft.betaTesterDiscountPercent !== config.betaTesterDiscountPercent
  );

  const handleField = (key: keyof EnergyFields, raw: string) => {
    if (!draft) return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    setDraft({ ...draft, [key]: n });
  };

  const handleBillingField = (key: keyof BillingFields, raw: string) => {
    if (!billingDraft) return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    setBillingDraft({ ...billingDraft, [key]: n });
  };

  const handleSave = async () => {
    if (!draft) return;
    try {
      await setEnergyConfig(draft);
      toast.success("Energy configuration saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save energy configuration");
    }
  };

  const handleBillingSave = async () => {
    if (!billingDraft) return;
    try {
      await setBillingConfig(billingDraft);
      toast.success("Billing configuration saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save billing configuration");
    }
  };

  const uploadMaxMb = draft ? Math.round((draft.uploadMaxFileBytes / (1024 * 1024)) * 10) / 10 : 0;

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4 text-muted-foreground" />
          AI Energy configuration
        </CardTitle>
        <CardDescription>
          Per-action Energy cost, monthly tier quotas and upload cap.
          Changes take effect immediately. Empty values fall back to the concept defaults.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Cost table */}
        <div>
          <h4 className="text-sm font-medium mb-3">Cost table</h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COST_FIELDS.map((f) => (
              <div key={f.key}>
                <Label htmlFor={`ec-${f.key}`} className="text-sm">{f.label}</Label>
                <Input
                  id={`ec-${f.key}`}
                  type="number"
                  min={0}
                  step={f.step ?? 1}
                  value={draft ? String(draft[f.key]) : ""}
                  onChange={(e) => handleField(f.key, e.target.value)}
                  disabled={draft === null}
                  className="mt-1 w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">{f.hint}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly quotas */}
        <div className="mt-6 border-t pt-4">
          <h4 className="text-sm font-medium mb-3">Monthly tier quotas</h4>
          <div className="grid gap-4 sm:grid-cols-3">
            {QUOTA_FIELDS.map((f) => (
              <div key={f.key}>
                <Label htmlFor={`ec-${f.key}`} className="text-sm">{f.label}</Label>
                <Input
                  id={`ec-${f.key}`}
                  type="number"
                  min={0}
                  step={f.step ?? 1}
                  value={draft ? String(draft[f.key]) : ""}
                  onChange={(e) => handleField(f.key, e.target.value)}
                  disabled={draft === null}
                  className="mt-1 w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">{f.hint}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Upload technical cap */}
        <div className="mt-6 border-t pt-4">
          <h4 className="text-sm font-medium mb-3">Upload limit</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ec-uploadMaxFileBytes" className="text-sm">
                Max upload size (bytes)
              </Label>
              <Input
                id="ec-uploadMaxFileBytes"
                type="number"
                min={0}
                step={1024 * 1024}
                value={draft ? String(draft.uploadMaxFileBytes) : ""}
                onChange={(e) => handleField("uploadMaxFileBytes", e.target.value)}
                disabled={draft === null}
                className="mt-1 w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Technical cap independent of Energy. Currently: {uploadMaxMb} MB.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={!dirty || draft === null}>
            Save energy configuration
          </Button>
        </div>

        {/* Billing config (Phase 4) */}
        <div className="mt-8 border-t pt-6">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium">Billing configuration</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Welcome-Energy granted on first Full-tier purchase. Beta-Tester discount applied at checkout after beta ends.
            Set to 0 to disable.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="bc-welcome" className="text-sm">Welcome Energy (Full tier)</Label>
              <Input
                id="bc-welcome"
                type="number"
                min={0}
                step={100}
                value={billingDraft ? String(billingDraft.welcomeEnergyAmount) : ""}
                onChange={(e) => handleBillingField("welcomeEnergyAmount", e.target.value)}
                disabled={billingDraft === null}
                className="mt-1 w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Energy added once to the top-up balance on first Full purchase. 0 = disabled.
              </p>
            </div>
            <div>
              <Label htmlFor="bc-discount" className="text-sm">Beta-Tester discount (%)</Label>
              <Input
                id="bc-discount"
                type="number"
                min={0}
                max={100}
                step={5}
                value={billingDraft ? String(billingDraft.betaTesterDiscountPercent) : ""}
                onChange={(e) => handleBillingField("betaTesterDiscountPercent", e.target.value)}
                disabled={billingDraft === null}
                className="mt-1 w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Discount percent for beta testers at checkout (0–100). Applied once per user after beta ends.
              </p>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleBillingSave} disabled={!billingDirty || billingDraft === null}>
              Save billing configuration
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
