/**
 * AI Energy Configuration — superadmin card with live economics preview.
 *
 * Splits into:
 *   - Active model box (read-only, sourced from chatAiConfig + MODEL_PRICING)
 *   - Cost & quota inputs (left column)
 *   - Live "what does this mean" preview (right column): $/Energy band,
 *     tier-by-duration margins, top-up margins, real 30-day usage
 *   - Upload technical cap
 *   - Save button with confirmation dialog showing before/after deltas + warnings
 *   - Billing config (welcome-energy + beta discount) at the bottom — unchanged
 *
 * Backend contract: convex/platform.ts → `getEnergyEconomics` (read) and
 * `setEnergyConfig` / `setBillingConfig` (write). $/Energy preview uses the
 * same formulas as the server (convex/ai/modelPricing.ts → `usdPerEnergy`) so
 * client and server agree on what the user sees vs. what gets persisted.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Zap, CreditCard, AlertTriangle, Activity, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
//  Types
// ============================================================================

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

type BillingFields = {
  welcomeEnergyAmount: number;
  betaTesterDiscountPercent: number;
  betaEnergyQuotaMonthly: number;
  teaserDailyLimit: number;
};

type FieldDef = {
  key: keyof EnergyFields;
  label: string;
  hint: string;
  step?: number;
};

// ============================================================================
//  Constants — must mirror convex/ai/modelPricing.ts
// ============================================================================

/** Same defaults as DEFAULT_AVG_TOKENS_PER_ENERGY in the backend. Kept in sync
 *  manually; changing one side without the other will produce different
 *  preview numbers in the UI vs. the persisted economics query. */
const ASSUMED_TOKENS_PER_ENERGY = {
  typical: { input: 833, output: 267 },
  worstCase: { input: 1250, output: 512 },
} as const;

const COST_FIELDS: FieldDef[] = [
  { key: "energyCostCompact",     label: "Compact answer",  hint: "Energy per compact reply",         step: 1 },
  { key: "energyCostDetailed",    label: "Detailed answer", hint: "Energy per detailed reply",        step: 1 },
  { key: "energyRagSurcharge",    label: "RAG surcharge",   hint: "Added when RAG context retrieval is used (unit, knowledge base, documents)", step: 1 },
  { key: "energyVisionSurcharge", label: "Vision surcharge",hint: "Added for image analysis",         step: 1 },
  { key: "energyUploadBase",      label: "Upload base",     hint: "Flat fee per document upload",     step: 1 },
  { key: "energyUploadPerKb",     label: "Upload per KB",   hint: "Per-KB factor (decimals allowed, e.g. 0.02)", step: 0.01 },
];

const QUOTA_FIELDS: FieldDef[] = [
  { key: "energyQuotaFull",  label: "Pro quota (Sprachkurs + AI Pro)",   hint: "Monthly Energy for the Pro tier",        step: 10 },
  { key: "energyQuotaBuddy", label: "Standalone quota (AI Chat Standalone)", hint: "Monthly Energy for Chat Standalone", step: 10 },
  { key: "energyQuotaBasic", label: "AI quota (Sprachkurs + AI)",         hint: "Monthly Energy for the combo tier",     step: 10 },
];

/** Color-code margins: >=85% green, 70-85% amber, <70% red. */
function marginColorClasses(marginPercent: number): string {
  if (marginPercent >= 85) return "border-emerald-200 bg-emerald-50";
  if (marginPercent >= 70) return "border-amber-200 bg-amber-50";
  return "border-red-200 bg-red-50";
}

function marginTextColor(marginPercent: number): string {
  if (marginPercent >= 85) return "text-emerald-700";
  if (marginPercent >= 70) return "text-amber-700";
  return "text-red-700";
}

function formatUsd(value: number): string {
  if (value < 0.01) return `$${value.toFixed(5)}`;
  if (value < 1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(2)}`;
}

function formatEur(cents: number): string {
  return `\u20AC${(cents / 100).toFixed(2)}`;
}

// ============================================================================
//  Live preview math — mirrors convex/ai/modelPricing.ts:usdPerEnergy()
// ============================================================================

function clientUsdPerEnergy(
  pricing: { inputUsdPer1M: number; outputUsdPer1M: number },
  tokens: { input: number; output: number }
): number {
  return (
    (tokens.input * pricing.inputUsdPer1M +
      tokens.output * pricing.outputUsdPer1M) /
    1_000_000
  );
}

// ============================================================================
//  Component
// ============================================================================

export function EnergyConfigCard() {
  const config = useQuery(api.platform.getPlatformConfig);
  // We re-fetch economics with a stable nowMs per render-batch so it doesn't
  // flicker on every keystroke. The 30-day window is coarse anyway.
  const [nowMs] = useState(() => Date.now());
  const economics = useQuery(api.platform.getEnergyEconomics, { nowMs });

  const setEnergyConfig = useMutation(api.platform.setEnergyConfig);
  const setBillingConfig = useMutation(api.platform.setBillingConfig);

  const [draft, setDraft] = useState<EnergyFields | null>(null);
  const [billingDraft, setBillingDraft] = useState<BillingFields | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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
        betaEnergyQuotaMonthly: config.betaEnergyQuotaMonthly,
        teaserDailyLimit: config.teaserDailyLimit,
      });
    }
  }, [config]);

  // ---- Dirty tracking ----
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
    billingDraft.betaTesterDiscountPercent !== config.betaTesterDiscountPercent ||
    billingDraft.betaEnergyQuotaMonthly !== config.betaEnergyQuotaMonthly ||
    billingDraft.teaserDailyLimit !== config.teaserDailyLimit
  );

  // ---- Live preview values (re-computed on every draft change) ----
  const livePreview = useMemo(() => {
    if (!draft || !economics) return null;
    const pricing = {
      inputUsdPer1M: economics.activeModel.inputUsdPer1M,
      outputUsdPer1M: economics.activeModel.outputUsdPer1M,
    };
    const usdTypical = clientUsdPerEnergy(pricing, ASSUMED_TOKENS_PER_ENERGY.typical);
    const usdWorstCase = clientUsdPerEnergy(pricing, ASSUMED_TOKENS_PER_ENERGY.worstCase);

    const compactCost = Math.max(1, draft.energyCostCompact);
    const typicalCost = Math.max(1, draft.energyCostDetailed + draft.energyRagSurcharge);

    // Build per-tier (draft) economics from the server's plan list, recomputed
    // against the draft quotas.
    const tierRows = economics.tierEconomics.map((row) => {
      const quotaPerMonth =
        row.tier === "course_ai_pro" ? draft.energyQuotaFull :
        row.tier === "standalone"   ? draft.energyQuotaBuddy :
        row.tier === "course_ai"    ? draft.energyQuotaBasic :
        row.quotaPerMonth;

      const worstCaseMonthlyAiCostUsd = quotaPerMonth * usdWorstCase;
      const monthlyPriceUsd = row.monthlyPriceCents / 100;
      const marginPercent = monthlyPriceUsd > 0
        ? Math.round(((monthlyPriceUsd - worstCaseMonthlyAiCostUsd) / monthlyPriceUsd) * 1000) / 10
        : 0;
      return {
        ...row,
        quotaPerMonth,
        estChatsAtCompactPerMonth: Math.floor(quotaPerMonth / compactCost),
        estChatsAtTypicalPerMonth: Math.floor(quotaPerMonth / typicalCost),
        worstCaseMonthlyAiCostUsd,
        marginPercent,
      };
    });

    // Top-up margins don't depend on quotas — only on cost-per-Energy.
    const topupRows = economics.topupEconomics.map((row) => {
      const worstCaseAiCostUsd = row.energyTotal * usdWorstCase;
      const priceUsd = row.priceCents / 100;
      const marginPercent = priceUsd > 0
        ? Math.round(((priceUsd - worstCaseAiCostUsd) / priceUsd) * 1000) / 10
        : 0;
      return { ...row, worstCaseAiCostUsd, marginPercent };
    });

    // Soft warnings shown in the confirm dialog (not blocking — see backend
    // setEnergyConfig for the hard rules).
    const warnings: string[] = [];
    if (draft.energyCostDetailed === draft.energyCostCompact) {
      warnings.push(
        "Detailed and compact have the same cost — detailed answers consume more tokens, this likely undercharges them."
      );
    }
    if (draft.energyRagSurcharge >= draft.energyCostCompact + draft.energyCostDetailed) {
      warnings.push(
        "RAG surcharge dominates the base cost — RAG is meant as an extra, not the main cost driver."
      );
    }
    tierRows.forEach((row) => {
      if (row.marginPercent < 60) {
        warnings.push(
          `${row.tierDisplayName} (${row.durationMonths}M): margin only ${row.marginPercent}% — worst-case AI cost (${formatUsd(row.worstCaseMonthlyAiCostUsd)}) is large vs. monthly price (${formatEur(row.monthlyPriceCents)}).`
        );
      }
    });

    return {
      usdTypical,
      usdWorstCase,
      compactCost,
      typicalCost,
      tierRows,
      topupRows,
      warnings,
    };
  }, [draft, economics]);

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

  const handleSaveClick = () => {
    if (!dirty) return;
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await setEnergyConfig(draft);
      toast.success("Energy configuration saved");
      setConfirmOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save energy configuration");
    } finally {
      setSaving(false);
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

  // ============================================================================
  //  Render
  // ============================================================================

  return (
    <>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-muted-foreground" />
            AI Energy configuration
          </CardTitle>
          <CardDescription>
            Adjust Energy costs and tier quotas with live economics preview. Save opens a confirm
            dialog with before/after deltas + margin warnings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* ===== Pricing freshness banner ===== */}
          {economics && economics.pricingFreshness.status !== "fresh" && (
            <div
              className={cn(
                "rounded-lg border p-3 text-sm",
                economics.pricingFreshness.status === "alert"
                  ? "border-red-300 bg-red-50 text-red-900"
                  : "border-amber-300 bg-amber-50 text-amber-900"
              )}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">
                    {economics.pricingFreshness.status === "alert"
                      ? "Model pricing table is outdated"
                      : "Model pricing table may be outdated"}
                  </p>
                  <p className="text-xs mt-1 opacity-90">
                    Last verified <span className="font-mono">{economics.pricingFreshness.lastVerifiedAt}</span> ({economics.pricingFreshness.ageDays} days ago).
                    {economics.pricingFreshness.status === "alert"
                      ? ` Threshold is ${economics.pricingFreshness.alertDays} days — please verify prices and request a code update.`
                      : ` Threshold is ${economics.pricingFreshness.warnDays} days — a quick re-check is recommended.`}
                  </p>
                  <p className="text-xs mt-2">
                    Verify against the official docs:{" "}
                    <a
                      href={economics.pricingFreshness.sourceUrlForActiveProvider}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-mono"
                    >
                      {economics.pricingFreshness.sourceUrlForActiveProvider}
                    </a>
                  </p>
                  <p className="text-xs mt-1 opacity-75">
                    If prices changed, the constants in <span className="font-mono">convex/ai/modelPricing.ts</span> need a code update.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ===== Ledger storage health banner ===== */}
          {economics &&
            (economics.ledgerHealth.capReached || economics.ledgerHealth.nearCap) && (
              <div
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  economics.ledgerHealth.capReached
                    ? "border-red-300 bg-red-50 text-red-900"
                    : "border-amber-300 bg-amber-50 text-amber-900"
                )}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">
                      {economics.ledgerHealth.capReached
                        ? "Energy ledger scan cap reached — usage numbers may be incomplete"
                        : "Energy ledger scan cap nearing limit"}
                    </p>
                    <p className="text-xs mt-1 opacity-90">
                      Scanned {economics.ledgerHealth.rowsScanned.toLocaleString()} of{" "}
                      {economics.ledgerHealth.scanCap.toLocaleString()} rows.
                      {economics.ledgerHealth.capReached
                        ? " Older entries are being skipped — add a by_createdAt index and switch to a ranged query before next month's reporting."
                        : " Past 80% of the safety cap. Plan an index migration soon."}
                    </p>
                  </div>
                </div>
              </div>
            )}

          {/* ===== Active model + USD per Energy band ===== */}
          {economics && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-medium">Active LLM</h4>
                </div>
                <p className="text-sm font-mono">{economics.activeModel.displayName}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Input ${economics.activeModel.inputUsdPer1M.toFixed(2)} / Output ${economics.activeModel.outputUsdPer1M.toFixed(2)} per 1M tokens
                </p>
                {!economics.activeModel.pricingVerified && (
                  <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Pricing for "{economics.activeModel.modelName}" not in pricing table — using fallback.
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Source: <span className="font-mono">chatAiConfig</span> &middot;
                  <a href="/admin/chat" className="ml-1 underline">change model</a>
                </p>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-medium">Cost per Energy unit</h4>
                </div>
                {livePreview && (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Typical mix</p>
                        <p className="font-mono">{formatUsd(livePreview.usdTypical)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Worst case</p>
                        <p className="font-mono">{formatUsd(livePreview.usdWorstCase)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Typical: balanced answer + RAG (~833 in / 267 out tokens).
                      Worst case: detailed + full context (~1250 in / 512 out).
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ===== Cost table ===== */}
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
            {draft && livePreview && (
              <div className="mt-3 text-xs text-muted-foreground border-l-2 border-amber-300 bg-amber-50/50 pl-3 py-1.5">
                Typical balanced + RAG message currently costs{" "}
                <span className="font-mono font-semibold">{livePreview.typicalCost} Energy</span>{" "}
                ({formatUsd(livePreview.typicalCost * livePreview.usdWorstCase)} worst case).
              </div>
            )}
          </div>

          {/* ===== Monthly quotas + tier economics live preview ===== */}
          <div className="grid gap-6 lg:grid-cols-2 border-t pt-4">
            <div>
              <h4 className="text-sm font-medium mb-3">Monthly tier quotas</h4>
              <div className="space-y-3">
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

            <div>
              <h4 className="text-sm font-medium mb-3">Live tier economics</h4>
              {livePreview && (
                <div className="space-y-2">
                  {livePreview.tierRows.map((row) => (
                    <div
                      key={row.planId}
                      className={cn(
                        "rounded-md border p-3 text-xs",
                        marginColorClasses(row.marginPercent)
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">
                          {row.tierDisplayName} &middot; {row.durationMonths}M
                        </span>
                        <span className={cn("font-mono font-semibold", marginTextColor(row.marginPercent))}>
                          {row.marginPercent.toFixed(1)}% margin
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span>Quota: <span className="text-foreground font-mono">{row.quotaPerMonth}</span> Energy/Mo</span>
                        <span>Price/Mo: <span className="text-foreground font-mono">{formatEur(row.monthlyPriceCents)}</span></span>
                        <span>~{row.estChatsAtTypicalPerMonth} typical chats</span>
                        <span>Worst AI cost: <span className="text-foreground font-mono">{formatUsd(row.worstCaseMonthlyAiCostUsd)}</span>/Mo</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ===== Top-up packs economics ===== */}
          {livePreview && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Energy Top-up margins</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                {livePreview.topupRows.map((row) => (
                  <div
                    key={row.packId}
                    className={cn(
                      "rounded-md border p-3 text-xs",
                      marginColorClasses(row.marginPercent)
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{row.name}</span>
                      <span className={cn("font-mono font-semibold", marginTextColor(row.marginPercent))}>
                        {row.marginPercent.toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {row.energyTotal} Energy for {formatEur(row.priceCents)} &middot; AI cost max {formatUsd(row.worstCaseAiCostUsd)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== Real usage (30 days) ===== */}
          {economics && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Real usage (last 30 days)</h4>
              {economics.realUsage30d.isSparse ? (
                <p className="text-xs text-muted-foreground italic">
                  Only {economics.realUsage30d.totalUsageEntries} usage entries in the last 30 days —
                  too sparse for a representative action-mix breakdown. Numbers below for reference only.
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-2">
                <RealUsageStat
                  label="Active users"
                  value={String(economics.realUsage30d.activeUserCount)}
                />
                <RealUsageStat
                  label="Total Energy used"
                  value={String(economics.realUsage30d.totalEnergyConsumed)}
                />
                <RealUsageStat
                  label="Avg. Energy / user"
                  value={
                    economics.realUsage30d.activeUserCount > 0
                      ? String(Math.round(economics.realUsage30d.totalEnergyConsumed / economics.realUsage30d.activeUserCount))
                      : "—"
                  }
                />
                <RealUsageStat
                  label="RAG share (chat actions)"
                  value={`${Math.round(economics.realUsage30d.ragUsageShareOfChatActions * 100)}%`}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-5 mt-3 text-[11px] text-muted-foreground">
                <RealUsageStat small label="Compact"  value={String(economics.realUsage30d.byActionType.compact)} />
                <RealUsageStat small label="Balanced" value={String(economics.realUsage30d.byActionType.balanced)} />
                <RealUsageStat small label="Detailed" value={String(economics.realUsage30d.byActionType.detailed)} />
                <RealUsageStat small label="Photo"    value={String(economics.realUsage30d.byActionType.photo_scan)} />
                <RealUsageStat small label="Document" value={String(economics.realUsage30d.byActionType.document_analysis)} />
              </div>
            </div>
          )}

          {/* ===== Upload technical cap ===== */}
          <div className="border-t pt-4">
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

          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveClick} disabled={!dirty || draft === null}>
              Review &amp; save energy configuration
            </Button>
          </div>

          {/* ===== Billing config (Phase 4) - unchanged ===== */}
          <div className="mt-2 border-t pt-6">
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
                <Label htmlFor="bc-welcome" className="text-sm">Welcome Energy (Pro tier)</Label>
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
                  Energy added once to the top-up balance on first Pro purchase. 0 = disabled.
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
              <div>
                <Label htmlFor="bc-beta-energy" className="text-sm">Beta monthly Energy quota</Label>
                <Input
                  id="bc-beta-energy"
                  type="number"
                  min={0}
                  step={10}
                  value={billingDraft ? String(billingDraft.betaEnergyQuotaMonthly) : ""}
                  onChange={(e) => handleBillingField("betaEnergyQuotaMonthly", e.target.value)}
                  disabled={billingDraft === null}
                  className="mt-1 w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Monthly AI Energy for beta testers while the beta phase is active.
                  Configured in platformConfig.betaEnergyQuotaMonthly (default 120).
                </p>
              </div>
              <div>
                <Label htmlFor="bc-teaser" className="text-sm">Course teaser questions / day</Label>
                <Input
                  id="bc-teaser"
                  type="number"
                  min={0}
                  step={1}
                  value={billingDraft ? String(billingDraft.teaserDailyLimit) : ""}
                  onChange={(e) => handleBillingField("teaserDailyLimit", e.target.value)}
                  disabled={billingDraft === null}
                  className="mt-1 w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  AI Buddy preview questions per day for course-tier (teaser-only) users. 0 = disabled.
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

      {/* ===== Confirm dialog with delta preview + warnings ===== */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !saving && setConfirmOpen(o)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm energy configuration changes</DialogTitle>
            <DialogDescription>
              Review the impact of your changes before saving. Hard validation errors will be reported
              by the server if any rules are violated.
            </DialogDescription>
          </DialogHeader>

          {draft && config && livePreview && (
            <div className="space-y-4 text-sm">
              {/* Soft warnings */}
              {livePreview.warnings.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="font-medium text-amber-900">
                      {livePreview.warnings.length} warning(s)
                    </span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-amber-900">
                    {livePreview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {/* Changed fields delta */}
              <div>
                <h4 className="font-medium mb-2">Changed fields</h4>
                <div className="rounded-md border bg-muted/30 divide-y text-xs">
                  <DeltaRow label="Compact cost"        before={config.energyCostCompact}     after={draft.energyCostCompact} />
                  <DeltaRow label="Detailed cost"       before={config.energyCostDetailed}    after={draft.energyCostDetailed} />
                  <DeltaRow label="RAG surcharge"       before={config.energyRagSurcharge}    after={draft.energyRagSurcharge} />
                  <DeltaRow label="Vision surcharge"    before={config.energyVisionSurcharge} after={draft.energyVisionSurcharge} />
                  <DeltaRow label="Upload base"         before={config.energyUploadBase}      after={draft.energyUploadBase} />
                  <DeltaRow label="Upload per KB"       before={config.energyUploadPerKb}     after={draft.energyUploadPerKb} />
                  <DeltaRow label="Pro quota"           before={config.energyQuotaFull}       after={draft.energyQuotaFull} />
                  <DeltaRow label="Standalone quota"    before={config.energyQuotaBuddy}      after={draft.energyQuotaBuddy} />
                  <DeltaRow label="AI quota"            before={config.energyQuotaBasic}      after={draft.energyQuotaBasic} />
                  <DeltaRow label="Upload max bytes"    before={config.uploadMaxFileBytes}    after={draft.uploadMaxFileBytes} />
                </div>
              </div>

              {/* Resulting tier economics summary */}
              <div>
                <h4 className="font-medium mb-2">Resulting margins</h4>
                <div className="rounded-md border divide-y text-xs">
                  {livePreview.tierRows.map((row) => (
                    <div key={row.planId} className="flex items-center justify-between px-3 py-1.5">
                      <span className="text-muted-foreground">
                        {row.tierDisplayName} &middot; {row.durationMonths}M
                      </span>
                      <span className={cn("font-mono font-semibold", marginTextColor(row.marginPercent))}>
                        {row.marginPercent.toFixed(1)}% &middot; max ${row.worstCaseMonthlyAiCostUsd.toFixed(2)}/Mo
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSave} disabled={saving}>
              {saving ? "Saving..." : "Save configuration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================
//  Tiny presentational helpers
// ============================================================================

function DeltaRow({ label, before, after }: { label: string; before: number; after: number }) {
  if (before === after) {
    return (
      <div className="flex items-center justify-between px-3 py-1.5 text-muted-foreground/60">
        <span>{label}</span>
        <span className="font-mono">{before} (unchanged)</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <span className="font-medium">{label}</span>
      <span className="font-mono">
        <span className="text-muted-foreground line-through">{before}</span>
        {" → "}
        <span className="text-foreground font-semibold">{after}</span>
      </span>
    </div>
  );
}

function RealUsageStat({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className={small ? "" : "rounded-md border bg-muted/30 p-2"}>
      <p className={cn("text-muted-foreground", small ? "text-[10px]" : "text-[11px]")}>{label}</p>
      <p className={cn("font-mono", small ? "text-xs" : "text-sm font-semibold")}>{value}</p>
    </div>
  );
}
