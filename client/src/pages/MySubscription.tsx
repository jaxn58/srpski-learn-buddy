import { useAuth } from "@/_core/hooks/useAuth";
// Sidebar import removed
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Calendar, Check, Clock, CreditCard, TrendingUp, Zap } from "lucide-react";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { TopupOptions } from "@/components/energy/TopupOptions";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { initDodoPayments, openDodoCheckout } from "@/lib/dodo";
import { formatDateEU } from "@/lib/utils";

type SubscriptionPlan = {
  id: "beta" | "intensive" | "balanced" | "standard" | "relaxed";
  name: string;
  months: number;
  price: number; // cents
  unitsPerWeek: number;
  paymentOptions?: {
    prepaidTotal: number;
    installmentsMonthly?: number;
    installmentsTotal?: number;
    installmentsUpliftPercent?: number;
  };
};

function EnergyCard() {
  const { t } = useTranslation();
  const access = useFeatureAccess();
  const energyInfo = useQuery(api.subscriptions.getPublicEnergyInfo);

  if (!access) return null;
  if (access.energy.unlimited) return null;
  // Course-tier (teaser) users don't have Energy
  if (access.features.teaser && !access.features.buddyChat) return null;
  if (!access.features.buddyChat) return null;

  const { quotaMonthly, usedThisPeriod, topUpBalance, available, periodResetAt } = access.energy;
  const quotaRemaining = Math.max(0, quotaMonthly - usedThisPeriod);
  const quotaPercent = quotaMonthly > 0 ? (quotaRemaining / quotaMonthly) * 100 : 0;
  const welcomeEnergyAmount = energyInfo?.welcomeEnergyAmount ?? 0;
  const showWelcomeNote = access.tier === "course_ai_pro" && welcomeEnergyAmount > 0;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          {t("energy.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Monthly Quota */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{t("energy.monthlyQuota")}</span>
            <span className="text-sm tabular-nums">
              {quotaRemaining} / {quotaMonthly} {t("energy.remaining")}
            </span>
          </div>
          <Progress value={quotaPercent} className="h-2" />
          <div className="text-xs text-muted-foreground mt-1">
            {t("energy.used")}: {usedThisPeriod}
            {periodResetAt && (
              <span className="ml-2">
                · {t("energy.resetInfo", { date: formatDateEU(periodResetAt) })}
              </span>
            )}
          </div>
        </div>

        {/* Extra Energy + Total */}
        <div className="flex gap-4">
          <div className="flex-1 rounded-lg bg-muted p-3">
            <div className="text-xs text-muted-foreground">{t("energy.topUpBalance")}</div>
            <div className="text-lg font-bold tabular-nums">{topUpBalance}</div>
            <div className="text-xs text-muted-foreground">{t("energy.topUpNeverExpires")}</div>
          </div>
          <div className="flex-1 rounded-lg bg-primary/5 border border-primary/20 p-3">
            <div className="text-xs text-muted-foreground">{t("energy.totalAvailable")}</div>
            <div className="text-lg font-bold tabular-nums text-primary">{available}</div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{t("energy.extraHint")}</p>

        {showWelcomeNote && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
            {t("energy.welcomeBonusOnce", { amount: welcomeEnergyAmount })}
          </div>
        )}

        {/* Buy extra Energy */}
        <div className="pt-2 border-t">
          <h4 className="text-sm font-semibold mb-1">{t("energy.topUp")}</h4>
          <p className="text-xs text-muted-foreground mb-3">{t("energy.topUpDesc")}</p>
          <TopupOptions />
        </div>
      </CardContent>
    </Card>
  );
}

export function MySubscriptionContent({ embedded = false }: { embedded?: boolean }) {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [timeRemaining, setTimeRemaining] = useState({ days: 0, hours: 0, minutes: 0 });

  const billingConfig = useQuery(api.subscriptions.getBillingProviderConfig);
  const dodoConfigured = billingConfig?.dodo?.configured === true;
  const isBetaActive = billingConfig?.dodo?.betaMode === true;
  const isTestMode = billingConfig?.dodo?.environment === "test_mode";
  const isPrivileged = user?.role === "admin" || user?.role === "superadmin";
  const ENABLE_PURCHASE_FOR_TESTING = import.meta.env.DEV || isTestMode;
  const DISABLE_PURCHASE_DURING_BETA = isBetaActive && !isPrivileged && !ENABLE_PURCHASE_FOR_TESTING;

  const [dodoReady, setDodoReady] = useState(false);

  const createDodoCheckoutSession = useAction(api.subscriptions.createDodoCheckoutSession);

  // Fetch subscription data from Convex
  const subscription = useQuery(api.subscriptions.getCurrent);
  const subLoading = subscription === undefined;

  const betaDiscountStatus = useQuery(api.subscriptions.getBetaDiscountStatus);
  const betaEnded = betaDiscountStatus?.betaEnded === true;
  const betaDiscountEligible = betaDiscountStatus?.eligible === true;
  // Discount percentage is admin-tunable via platformConfig (single source of truth).
  const betaDiscountPercent = betaDiscountStatus?.discountPercent ?? 0;
  const applyBetaDiscount = (priceCents: number) =>
    Math.round((priceCents * (100 - betaDiscountPercent)) / 100);
  
  const daysRemaining = useQuery(
    api.subscriptions.getDaysRemaining,
    subscription ? {} : "skip"
  );

  const subscriptionPlan =
    subscription && typeof subscription === "object" && "plan" in subscription
      ? (subscription as { plan: string }).plan
      : subscription?.planType;

  const normalizedPlan = subscriptionPlan || subscription?.planType || "beta";

  const subscriptionEndsAt =
    subscription && typeof subscription === "object" && "endsAt" in subscription
      ? (subscription as { endsAt: number | null }).endsAt
      : subscription?.expiresAt ?? null;

  const availablePlans = useQuery(api.subscriptions.getPlans) as SubscriptionPlan[] | undefined;
  const currentPlanListPriceCents =
    availablePlans?.find((p) => p.id === (normalizedPlan as any))?.price ??
    (typeof (subscription as any)?.planPrice === "number" ? (subscription as any).planPrice : 0);
  const [paymentModeByPlan, setPaymentModeByPlan] = useState<Record<string, "prepaid" | "installments">>({});

  const containerClass = embedded ? "w-full" : "p-8 w-full";
  const innerClass = embedded ? "w-full" : "max-w-4xl mx-auto";

  // Calculate upgrade cost mutation
  const calculateUpgradeMutation = useMutation(api.subscriptions.calculateUpgradeCost);
  

  // Calculate time remaining
  useEffect(() => {
    if (!subscriptionEndsAt) return;

    const updateTimer = () => {
      const now = new Date();
      const end = new Date(subscriptionEndsAt);
      const diff = end.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0 });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setTimeRemaining({ days, hours, minutes });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [subscriptionEndsAt]);

  const [isCalculating, setIsCalculating] = useState(false);

  const formatCurrency = (cents: number) => {
    const euros = cents / 100;
    return `€${euros.toFixed(2)}`;
  };

  useEffect(() => {
    if (!dodoConfigured) {
      setDodoReady(false);
      return;
    }

    const env = billingConfig?.dodo?.environment === "live_mode" ? "live" : "test";
    try {
      initDodoPayments({ mode: env });
      setDodoReady(true);
    } catch (error) {
      console.error("[MySubscription] Dodo initialization failed:", error);
      setDodoReady(false);
    }
  }, [dodoConfigured, billingConfig?.dodo?.environment]);

  const checkoutReady = dodoReady;
  const missingUpgradeEnvKeys = (billingConfig as any)?.dodo?.missingUpgradeEnvKeys as string[] | undefined;
  const isDev = import.meta.env.DEV === true;

  const getUpgradeEnvKey = (fromPlanId: string, toPlanId: string) =>
    `DODO_UPG_${String(fromPlanId).trim().toUpperCase()}_${String(toPlanId).trim().toUpperCase()}`;

  type PaymentMode = "prepaid" | "installments";
  const handlePurchase = async (
    planId: Exclude<SubscriptionPlan["id"], "beta">,
    paymentMode: PaymentMode,
    useBetaPrice: boolean
  ) => {
    if (!user) return;

    if (DISABLE_PURCHASE_DURING_BETA) {
      toast.info(t("billing.paidPlansAfterBeta"));
      return;
    }

    if (!dodoConfigured) {
      toast.error(t("billing.dodoNotConfigured"));
      return;
    }

    const effectiveUseBetaPrice = paymentMode === "prepaid" && useBetaPrice;

    try {
      const result = await createDodoCheckoutSession({
        planType: planId as any,
        paymentMode,
        flow: "purchase",
        // NOTE: Dodo will redirect to return_url even if the payment is not successful
        // (e.g. user closes checkout, card declined). Never encode "success" in the URL.
        returnUrl: `${window.location.origin}/dashboard?purchase=return`,
        source: "my_subscription",
        beta50: effectiveUseBetaPrice,
      });

      await openDodoCheckout({ checkoutUrl: result.checkoutUrl });
    } catch (error: any) {
      const msg = error?.message || String(error);
      toast.error(t("subscription.upgradeError", { error: msg }));
    }

  };

  const handleUpgrade = async (newPlan: string) => {
    if (!subscription || !user) return;

    if (DISABLE_PURCHASE_DURING_BETA) {
      toast.info(t("billing.paidPlansAfterBeta"));
      return;
    }

    if (!dodoConfigured) {
      toast.error(t("billing.dodoNotConfigured"));
      return;
    }

    const fromPlan = String(subscriptionPlan || (subscription as any)?.planType || (subscription as any)?.plan || "")
      .trim()
      .toLowerCase();
    const envKey = getUpgradeEnvKey(fromPlan, newPlan);
    const upgradeEnvMissing = Array.isArray(missingUpgradeEnvKeys) && missingUpgradeEnvKeys.includes(envKey);
    if (upgradeEnvMissing) {
      toast.error(isDev ? `Upgrade config missing: ${envKey}` : t("subscription.upgradeUnavailable"));
      return;
    }

    setIsCalculating(true);
    try {
      const result = await calculateUpgradeMutation({
        currentPlan: subscriptionPlan || subscription.planType,
        newPlan,
      });

      if (result?.cost) {
        toast.info(t("subscription.upgradeCost", { cost: formatCurrency(result.cost) }));
      }

      const session = await createDodoCheckoutSession({
        planType: newPlan as any,
        paymentMode: "prepaid",
        flow: "upgrade",
        // Same rationale as purchase return URL.
        returnUrl: `${window.location.origin}/dashboard?upgrade=return`,
        source: "my_subscription_upgrade",
        beta50: false,
      });

      await openDodoCheckout({ checkoutUrl: session.checkoutUrl });
    } catch (error: any) {
      toast.error(t("subscription.upgradeError", { error: error.message }));
    } finally {
      setIsCalculating(false);
    }
  };

  if (authLoading || subLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{t('subscription.loading')}</p>
        </div>
      </div>
    );
  }

  if (!subscription) {
    // Check if user is Beta Tester
    if (user?.isBetaTester) {
      // During beta (or if beta end date isn't configured), show the beta access card only.
      if (!betaEnded) {
      return (
        <div className={containerClass}>
          <div className={innerClass}>
            {!embedded && <h1 className="text-3xl font-bold mb-6">{t('subscription.title')}</h1>}
            <Card className="border-2 border-yellow-500 bg-gradient-to-br from-yellow-50 to-amber-50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="text-4xl">✨</span>
                  <div>
                    <CardTitle className="text-2xl">{t('subscription.betaAccess')}</CardTitle>
                    <CardDescription className="text-base mt-1">
                      {t('subscription.betaAccess.desc')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-4 border">
                    <h3 className="font-semibold mb-2">🎁 {t('subscription.betaBenefits')}</h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span>{t('subscription.betaBenefits.access')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span>{t('subscription.betaBenefits.discount')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span>{t('subscription.betaBenefits.earlyAccess')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span>{t('subscription.betaBenefits.feedback')}</span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-white rounded-lg p-4 border">
                    <h3 className="font-semibold mb-2">📊 {t('subscription.accessDetails')}</h3>
                    <div className="space-y-2 text-sm">
                      <p><strong>{t('subscription.plan')}:</strong> {t('subscription.betaAccess')}</p>
                      <p><strong>{t('subscription.units')}:</strong> 1-{(subscription as any).maxAccessibleUnits || 1}</p>
                      <p><strong>{t('subscription.price')}:</strong> {t('subscription.free')}</p>
                      <p><strong>{t('subscription.duration')}:</strong> {t('subscription.betaPhase')}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm text-blue-900">
                    <strong>{t('subscription.whatsNext')}</strong> {t('subscription.whatsNext.desc')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
      }

      // After beta: allow purchase (with one-time beta discount if eligible).
      return (
        <div className={containerClass}>
          <div className={innerClass}>
            {!embedded && <h1 className="text-3xl font-bold mb-6">{t("subscription.title")}</h1>}
            <Card className="mb-6 border-2 border-yellow-500 bg-gradient-to-br from-yellow-50 to-amber-50">
              <CardHeader>
                <CardTitle className="text-2xl">{t("subscription.betaAccess")}</CardTitle>
                <CardDescription>{t("subscription.betaAccess.desc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <strong>Beta ended.</strong> Thanks for participating.
                </p>
                {betaDiscountEligible ? (
                  <p>
                    <strong>Special offer:</strong> You can use a one-time {betaDiscountPercent}% discount on your first purchase.
                  </p>
                ) : (
                  <p>You can now choose a plan to continue.</p>
                )}
              </CardContent>
            </Card>

            {availablePlans && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("subscription.viewPlans")}</CardTitle>
                  <CardDescription>Choose a plan to unlock all units.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {availablePlans
                      .filter((p) => p.id !== "beta")
                      .map((plan) => {
                        const isBetaPrice = betaDiscountEligible;
                        const selectedPaymentMode = paymentModeByPlan[plan.id] || "prepaid";
                        const displayPrice = isBetaPrice ? applyBetaDiscount(plan.price) : plan.price;
                        const installmentMonthly = plan.paymentOptions?.installmentsMonthly ?? 0;
                        return (
                        <Card key={plan.id} className="border-2 hover:border-primary transition-colors">
                          <CardHeader>
                            <CardTitle className="capitalize">{plan.name}</CardTitle>
                            <CardDescription>{plan.months} {t('subscription.months')}</CardDescription>
                          </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="text-3xl font-bold text-primary">
                                {selectedPaymentMode === "installments"
                                  ? `${formatCurrency(installmentMonthly)}/mo`
                                  : formatCurrency(displayPrice)}
                                {selectedPaymentMode === "prepaid" && isBetaPrice ? (
                                  <span className="text-sm text-muted-foreground"> (Beta {betaDiscountPercent}%)</span>
                                ) : null}
                              </div>
                              <RadioGroup
                                value={selectedPaymentMode}
                                onValueChange={(v) => setPaymentModeByPlan((prev) => ({ ...prev, [plan.id]: v as any }))}
                                className="gap-2"
                              >
                                <div className="flex items-center gap-2">
                                  <RadioGroupItem id={`${plan.id}-pay-once-beta`} value="prepaid" />
                                  <Label htmlFor={`${plan.id}-pay-once-beta`} className="text-sm">
                                    Pay once
                                  </Label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <RadioGroupItem id={`${plan.id}-pay-monthly-beta`} value="installments" />
                                  <Label htmlFor={`${plan.id}-pay-monthly-beta`} className="text-sm">
                                    Pay monthly (+10%)
                                  </Label>
                                </div>
                              </RadioGroup>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="w-full">
                                    <Button
                                      onClick={() =>
                                        handlePurchase(
                                          plan.id as any,
                                          selectedPaymentMode,
                                          // Beta 50% applies only to prepaid (enforced in handler too)
                                          isBetaPrice
                                        )
                                      }
                                      disabled={!checkoutReady || DISABLE_PURCHASE_DURING_BETA}
                                      className="w-full"
                                    >
                                      <CreditCard className="h-4 w-4 mr-2" />
                                      {t("subscription.continuePurchase")}
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                {DISABLE_PURCHASE_DURING_BETA && (
                                  <TooltipContent>
                                    <p>{t("billing.paidPlansAfterBeta")}</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      );
    }
    
    // No subscription and not Beta Tester: allow purchase (prepaid plans).
    return (
      <div className={containerClass}>
        <div className={innerClass}>
          {!embedded && <h1 className="text-3xl font-bold mb-6">{t("subscription.title")}</h1>}

          {availablePlans && (
            <Card>
              <CardHeader>
                <CardTitle>{t("subscription.viewPlans")}</CardTitle>
                <CardDescription>Choose a plan to unlock all units.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {availablePlans
                    .filter((p) => p.id !== "beta")
                    .map((plan) => {
                      const selectedPaymentMode = paymentModeByPlan[plan.id] || "prepaid";
                      const installmentMonthly = plan.paymentOptions?.installmentsMonthly ?? 0;
                      return (
                        <Card key={plan.id} className="border-2 hover:border-primary transition-colors">
                          <CardHeader>
                            <CardTitle className="capitalize">{plan.name}</CardTitle>
                            <CardDescription>{plan.months} {t('subscription.months')}</CardDescription>
                          </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="text-3xl font-bold text-primary">
                                {selectedPaymentMode === "installments"
                                ? `${formatCurrency(installmentMonthly)}/mo`
                                : formatCurrency(plan.price)}
                            </div>
                            <RadioGroup
                              value={selectedPaymentMode}
                              onValueChange={(v) => setPaymentModeByPlan((prev) => ({ ...prev, [plan.id]: v as any }))}
                              className="gap-2"
                            >
                              <div className="flex items-center gap-2">
                                <RadioGroupItem id={`${plan.id}-pay-once`} value="prepaid" />
                                <Label htmlFor={`${plan.id}-pay-once`} className="text-sm">
                                  Pay once
                                </Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <RadioGroupItem id={`${plan.id}-pay-monthly`} value="installments" />
                                <Label htmlFor={`${plan.id}-pay-monthly`} className="text-sm">
                                  Pay monthly (+10%)
                                </Label>
                              </div>
                            </RadioGroup>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="w-full">
                                  <Button
                                    onClick={() => handlePurchase(plan.id as any, selectedPaymentMode, false)}
                                    disabled={!checkoutReady || DISABLE_PURCHASE_DURING_BETA}
                                    className="w-full"
                                  >
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    {t("subscription.continuePurchase")}
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              {DISABLE_PURCHASE_DURING_BETA && (
                                <TooltipContent>
                                  <p>{t("billing.paidPlansAfterBeta")}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Special handling for Beta subscriptions
  if (normalizedPlan === "beta") {
    // Beta plan returned as a virtual subscription for beta testers.
    if (betaEnded && user?.isBetaTester) {
      return (
        <div className={containerClass}>
          <div className={innerClass}>
            {!embedded && <h1 className="text-3xl font-bold mb-6">{t("subscription.title")}</h1>}

            <Card className="mb-6 border-2 border-yellow-500 bg-gradient-to-br from-yellow-50 to-amber-50">
              <CardHeader>
                <CardTitle className="text-2xl">{t("subscription.betaAccess")}</CardTitle>
                <CardDescription>{t("subscription.betaAccess.desc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <strong>Beta ended.</strong> You can now purchase a plan.
                </p>
                {betaDiscountEligible ? (
                  <p>
                    <strong>Special offer:</strong> One-time {betaDiscountPercent}% discount available.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            {availablePlans && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("subscription.viewPlans")}</CardTitle>
                  <CardDescription>Choose a plan to unlock all units.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {availablePlans
                      .filter((p) => p.id !== "beta")
                      .map((plan) => {
                        const isBetaPrice = betaDiscountEligible;
                        const selectedPaymentMode = paymentModeByPlan[plan.id] || "prepaid";
                        const displayPrice = isBetaPrice ? applyBetaDiscount(plan.price) : plan.price;
                        const installmentMonthly = plan.paymentOptions?.installmentsMonthly ?? 0;
                        return (
                        <Card key={plan.id} className="border-2 hover:border-primary transition-colors">
                          <CardHeader>
                            <CardTitle className="capitalize">{plan.name}</CardTitle>
                            <CardDescription>{plan.months} {t('subscription.months')}</CardDescription>
                          </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="text-3xl font-bold text-primary">
                                {selectedPaymentMode === "installments"
                                  ? `${formatCurrency(installmentMonthly)}/mo`
                                  : formatCurrency(displayPrice)}
                                {selectedPaymentMode === "prepaid" && isBetaPrice ? (
                                  <span className="text-sm text-muted-foreground"> (Beta {betaDiscountPercent}%)</span>
                                ) : null}
                              </div>
                              <RadioGroup
                                value={selectedPaymentMode}
                                onValueChange={(v) => setPaymentModeByPlan((prev) => ({ ...prev, [plan.id]: v as any }))}
                                className="gap-2"
                              >
                                <div className="flex items-center gap-2">
                                  <RadioGroupItem id={`${plan.id}-pay-once-beta2`} value="prepaid" />
                                  <Label htmlFor={`${plan.id}-pay-once-beta2`} className="text-sm">
                                    Pay once
                                  </Label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <RadioGroupItem id={`${plan.id}-pay-monthly-beta2`} value="installments" />
                                  <Label htmlFor={`${plan.id}-pay-monthly-beta2`} className="text-sm">
                                    Pay monthly (+10%)
                                  </Label>
                                </div>
                              </RadioGroup>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="w-full">
                                    <Button
                                      onClick={() => handlePurchase(plan.id as any, selectedPaymentMode, isBetaPrice)}
                                      disabled={!checkoutReady || DISABLE_PURCHASE_DURING_BETA}
                                      className="w-full"
                                    >
                                      <CreditCard className="h-4 w-4 mr-2" />
                                      {t("subscription.continuePurchase")}
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                {DISABLE_PURCHASE_DURING_BETA && (
                                  <TooltipContent>
                                    <p>{t("billing.paidPlansAfterBeta")}</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className={containerClass}>
        <div className={innerClass}>
          {!embedded && <h1 className="text-3xl font-bold mb-6">{t('subscription.title')}</h1>}
          <Card className="border-2 border-yellow-500 bg-gradient-to-br from-yellow-50 to-amber-50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="text-4xl">✨</span>
                <div>
                  <CardTitle className="text-2xl">{t('subscription.betaAccess')}</CardTitle>
                  <CardDescription className="text-base mt-1">
                    {t('subscription.betaAccess.desc')}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 border">
                  <h3 className="font-semibold mb-2">🎁 {t('subscription.betaBenefits')}</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>{t('subscription.betaBenefits.access')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>{t('subscription.betaBenefits.discount')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>{t('subscription.betaBenefits.earlyAccess')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>{t('subscription.betaBenefits.feedback')}</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-white rounded-lg p-4 border">
                  <h3 className="font-semibold mb-2">📊 {t('subscription.accessDetails')}</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>{t('subscription.plan')}:</strong> {t('subscription.betaAccess')}</p>
                    <p><strong>{t('subscription.units')}:</strong> 1-{(subscription as any).maxAccessibleUnits || 1}</p>
                    <p><strong>{t('subscription.price')}:</strong> {t('subscription.free')}</p>
                    <p><strong>{t('subscription.duration')}:</strong> {t('subscription.betaPhase')}</p>
                  </div>
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>{t('subscription.whatsNext')}</strong> {t('subscription.whatsNext.desc')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const planDurationMonths =
    typeof (subscription as any)?.planDurationMonths === "number"
      ? (subscription as any).planDurationMonths
      : availablePlans?.find((p) => p.id === normalizedPlan)?.months ?? 0;

  const addMonthsUtc = (timestampMs: number, monthsToAdd: number) => {
    const d = new Date(timestampMs);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const day = d.getUTCDate();
    const hr = d.getUTCHours();
    const min = d.getUTCMinutes();
    const sec = d.getUTCSeconds();
    const ms = d.getUTCMilliseconds();

    const base = new Date(Date.UTC(year, month + monthsToAdd, 1, hr, min, sec, ms));
    const lastDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
    base.setUTCDate(Math.min(day, lastDay));
    return base.getTime();
  };

  const dayMs = 24 * 60 * 60 * 1000;
  const planStartTs =
    subscriptionEndsAt && planDurationMonths > 0 ? addMonthsUtc(subscriptionEndsAt, -planDurationMonths) : null;
  const planDurationDays =
    subscriptionEndsAt && planStartTs
      ? Math.max(1, Math.ceil((subscriptionEndsAt - planStartTs) / dayMs))
      : normalizedPlan === "intensive"
        ? 90
        : normalizedPlan === "balanced"
          ? 180
          : normalizedPlan === "standard"
            ? 270
            : 365;

  const safeDaysRemaining = typeof daysRemaining === "number" ? daysRemaining : 0;
  const daysElapsed = Math.min(planDurationDays, Math.max(0, planDurationDays - safeDaysRemaining));
  const progressPercentage = (daysElapsed / planDurationDays) * 100;

  const isVirtualOverride = !!(subscription as any)?.virtual && normalizedPlan !== "beta";

  return (
    <div className={embedded ? "w-full" : "p-8 w-full overflow-y-auto"}>
      <div className={embedded ? "w-full" : "max-w-4xl mx-auto"}>
        {!embedded && <h1 className="text-3xl font-bold mb-6">{t('subscription.title')}</h1>}

        {/* Current Plan Card */}
        <Card className={`mb-6 ${isVirtualOverride ? "border-2 border-blue-400" : ""}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">{(subscription as any)?.planName || normalizedPlan} {t('subscription.plan')}</CardTitle>
                <CardDescription>
                  {isVirtualOverride
                    ? "Staff Override (Simulation)"
                    : subscription.status === "active"
                      ? t('subscription.active')
                      : subscription.status === "past_due"
                        ? t("subscription.pastDue")
                        : t('subscription.cancelled')}
                </CardDescription>
              </div>
              {!isVirtualOverride && (
                <div className="text-right">
                  <div className="text-3xl font-bold text-primary">
                    {(() => {
                      const cents =
                        typeof (subscription as any)?.planPrice === "number"
                          ? (subscription as any).planPrice
                          : availablePlans?.find((p) => p.id === normalizedPlan)?.price ?? 0;
                      return formatCurrency(cents);
                    })()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {planDurationDays} {t('subscription.days')}
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {isVirtualOverride ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                Feature tier override active. Change it in Admin &gt; your user profile.
              </div>
            ) : (
              <>
                {subscription.status === "past_due" ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                    <strong>{t("subscription.pastDueTitle")}</strong> {t("subscription.pastDueDesc")}
                  </div>
                ) : null}
                {/* Time Remaining */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      <span className="font-semibold">{t('subscription.timeRemaining')}</span>
                    </div>
                    <span className="text-2xl font-bold">
                      {timeRemaining.days}d {timeRemaining.hours}h {timeRemaining.minutes}m
                    </span>
                  </div>
                  <Progress value={progressPercentage} className="h-3" />
                  <div className="flex justify-between text-sm text-muted-foreground mt-1">
                    <span>{t('subscription.daysElapsed', { count: daysElapsed })}</span>
                    <span>{t('subscription.daysRemaining', { count: safeDaysRemaining })}</span>
                  </div>
                </div>

                {/* Expiration Date */}
                <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-semibold">{t('subscription.expiresOn')}</div>
                    <div className="text-sm text-muted-foreground">
                      {subscriptionEndsAt
                        ? formatDateEU(subscriptionEndsAt)
                        : t('subscription.noSubscription')}
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Energy Card */}
        <EnergyCard />

        {/* Upgrade Options */}
        {!isVirtualOverride && subscription.status === "active" && availablePlans && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {t('subscription.upgradeTitle')}
              </CardTitle>
              <CardDescription>
                {t('subscription.upgradeDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {availablePlans
                  .filter((plan: SubscriptionPlan) => {
                    const currentOrder = ["intensive", "balanced", "standard", "relaxed"].indexOf(normalizedPlan);
                    const planOrder = ["intensive", "balanced", "standard", "relaxed"].indexOf(plan.id);
                    return planOrder > currentOrder;
                  })
                  .map((plan: SubscriptionPlan) => {
                    const upgradeCostCents = Math.max(0, plan.price - (currentPlanListPriceCents || 0));
                    return (
                    <Card key={plan.id} className="border-2 hover:border-primary transition-colors">
                      <CardHeader>
                        <CardTitle className="capitalize">{plan.name}</CardTitle>
                        <CardDescription>{plan.months} {t('subscription.months')}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <div className="text-3xl font-bold text-primary">{formatCurrency(upgradeCostCents)}</div>
                          <div className="text-xs text-muted-foreground">
                            {t("subscription.upgradePayDifferenceNote", { total: formatCurrency(plan.price) })}
                          </div>
                        </div>
                        <ul className="space-y-2 text-sm">
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            <span>{t('subscription.allUnits')}</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            <span>{t('subscription.aiAccess')}</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            <span>{t('subscription.vocabTrainer')}</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            <span>{t('subscription.progressTracking')}</span>
                          </li>
                        </ul>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="w-full">
                              <Button
                                onClick={() => handleUpgrade(plan.id)}
                                disabled={isCalculating || !checkoutReady || DISABLE_PURCHASE_DURING_BETA}
                                className="w-full"
                              >
                                <CreditCard className="h-4 w-4 mr-2" />
                                {isCalculating ? t('subscription.calculating') : t('subscription.upgradeNow')}
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {DISABLE_PURCHASE_DURING_BETA && (
                            <TooltipContent>
                              <p>{t("billing.paidPlansAfterBeta")}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </CardContent>
                    </Card>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function MySubscription() {
  return <MySubscriptionContent />;
}
