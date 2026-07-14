import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { openDodoCheckout } from "@/lib/dodo";
import { useAuth } from "@/_core/hooks/useAuth";

interface TopupOptionsProps {
  /** Compact layout for embedding inside dialogs / chat panels. */
  compact?: boolean;
}

export function TopupOptions({ compact = false }: TopupOptionsProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const topupPacks = useQuery(api.subscriptions.getTopupPacks);
  const billingConfig = useQuery(api.subscriptions.getBillingProviderConfig);
  const betaScope = useQuery(api.platform.getPublicBetaScope);
  const createTopupSession = useAction(api.subscriptions.createTopupCheckoutSession);

  const [buyingPack, setBuyingPack] = useState<string | null>(null);

  const dodoConfigured = billingConfig?.dodo?.configured === true;
  const isPrivileged = user?.role === "admin" || user?.role === "superadmin";
  const betaPhaseActive = betaScope?.betaPhaseActive ?? true;
  const isPricingLockedForBeta = betaPhaseActive && !isPrivileged;

  const formatCurrency = (cents: number) => `€${(cents / 100).toFixed(2)}`;

  const handleBuy = async (packId: "starter" | "plus" | "pro") => {
    if (isPricingLockedForBeta) {
      toast.info(t("billing.paidPlansAfterBeta"));
      return;
    }

    if (!dodoConfigured) {
      toast.error("Payment provider not configured.");
      return;
    }
    setBuyingPack(packId);
    try {
      const result = await createTopupSession({
        pack: packId,
        returnUrl: `${window.location.origin}/dashboard?topup=return`,
      });
      await openDodoCheckout({ checkoutUrl: result.checkoutUrl });
    } catch (error: any) {
      toast.error(error?.message || String(error));
    } finally {
      setBuyingPack(null);
    }
  };

  if (!topupPacks) return null;

  return (
    <div className={compact ? "grid gap-2" : "grid gap-3 sm:grid-cols-3"}>
      {(topupPacks as Array<{ id: "starter" | "plus" | "pro"; name: string; energyAmount: number; bonusAmount: number; priceCents: number }>).map((pack: { id: "starter" | "plus" | "pro"; name: string; energyAmount: number; bonusAmount: number; priceCents: number }) => {
        const total = pack.energyAmount + pack.bonusAmount;
        return (
          <Card
            key={pack.id}
            className={compact ? "border" : "border-2 hover:border-primary transition-colors"}
          >
            <CardContent className={compact ? "p-3 flex items-center justify-between gap-3" : "p-4 space-y-2"}>
              {compact ? (
                <>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
                      {t("energy.totalEnergy", { amount: total })}
                    </div>
                    {pack.bonusAmount > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {pack.energyAmount} {t("energy.bonus", { amount: pack.bonusAmount })}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleBuy(pack.id)}
                    disabled={buyingPack !== null || !dodoConfigured || isPricingLockedForBeta}
                  >
                    {buyingPack === pack.id
                      ? "..."
                      : isPricingLockedForBeta
                        ? t("home.pricing.availableAfterLaunch")
                        : formatCurrency(pack.priceCents)}
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    <span className="font-semibold">{pack.name}</span>
                  </div>
                  <div className="text-2xl font-bold text-primary tabular-nums">
                    {t("energy.totalEnergy", { amount: total })}
                  </div>
                  {pack.bonusAmount > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {pack.energyAmount} {t("energy.bonus", { amount: pack.bonusAmount })}
                    </div>
                  )}
                  <Button
                    className="w-full mt-2"
                    onClick={() => handleBuy(pack.id)}
                    disabled={buyingPack !== null || !dodoConfigured || isPricingLockedForBeta}
                  >
                    {buyingPack === pack.id
                      ? "..."
                      : isPricingLockedForBeta
                        ? t("home.pricing.availableAfterLaunch")
                        : `${t("energy.buyPack")} – ${formatCurrency(pack.priceCents)}`}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
