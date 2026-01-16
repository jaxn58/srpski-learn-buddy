import { useAuth } from "@/_core/hooks/useAuth";
// Sidebar import removed
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Calendar, Check, Clock, CreditCard, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { initPaddleWithToken, openCheckout } from "@/lib/paddle";
import { formatDateEU } from "@/lib/utils";

type SubscriptionPlan = {
  id: "beta" | "intensive" | "balanced" | "standard" | "relaxed";
  name: string;
  months: number;
  price: number; // cents
  unitsPerWeek: number;
};

export function MySubscriptionContent({ embedded = false }: { embedded?: boolean }) {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [timeRemaining, setTimeRemaining] = useState({ days: 0, hours: 0, minutes: 0 });
  const paddleConfig = useQuery(api.subscriptions.getPaddleCheckoutConfig);
  const paddleConfigured = paddleConfig?.clientTokenConfigured === true;
  const [paddleReady, setPaddleReady] = useState(false);

  // Fetch subscription data from Convex
  const subscription = useQuery(api.subscriptions.getCurrent);
  const subLoading = subscription === undefined;

  const betaDiscountStatus = useQuery(api.subscriptions.getBetaDiscountStatus);
  const betaEnded = betaDiscountStatus?.betaEnded === true;
  const betaDiscountEligible = betaDiscountStatus?.eligible === true;
  
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

  const containerClass = embedded ? "w-full" : "p-8 w-full";
  const innerClass = embedded ? "w-full" : "max-w-4xl mx-auto";

  // Calculate upgrade cost mutation
  const calculateUpgradeMutation = useMutation(api.subscriptions.calculateUpgradeCost);
  
  // Cancel subscription mutation
  const cancelMutation = useMutation(api.subscriptions.cancel);
  const [isCancelling, setIsCancelling] = useState(false);

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

  const priceIdMap = useMemo(() => {
    const normal = paddleConfig?.priceIds?.normal;
    return {
      beta: "",
      intensive: normal?.intensive || "",
      balanced: normal?.balanced || "",
      standard: normal?.standard || "",
      relaxed: normal?.relaxed || "",
    };
  }, [paddleConfig]);

  const beta50PriceIdMap = useMemo(() => {
    const beta50 = paddleConfig?.priceIds?.beta50;
    return {
      beta: "",
      intensive: beta50?.intensive || "",
      balanced: beta50?.balanced || "",
      standard: beta50?.standard || "",
      relaxed: beta50?.relaxed || "",
    };
  }, [paddleConfig]);

  const formatCurrency = (cents: number) => {
    const euros = cents / 100;
    return `€${euros.toFixed(2)}`;
  };

  useEffect(() => {
    if (!paddleConfigured) {
      setPaddleReady(false);
      return;
    }

    initPaddleWithToken({
      token: paddleConfig?.clientToken || "",
      environment: paddleConfig?.environment === "production" ? "production" : "sandbox",
    }).then((instance) => {
      if (!instance) {
        toast.error("Paddle could not be initialized.");
        return;
      }

      setPaddleReady(true);
    });
  }, [paddleConfigured, paddleConfig?.clientToken, paddleConfig?.environment]);

  const handlePurchase = async (planId: Exclude<SubscriptionPlan["id"], "beta">, useBetaPrice: boolean) => {
    if (!user) return;

    if (!paddleConfigured) {
      toast.error("Paddle is not configured.");
      return;
    }

    const priceId = (useBetaPrice ? beta50PriceIdMap : priceIdMap)[planId];
    if (!priceId) {
      toast.error("No Paddle Price ID configured for this plan.");
      return;
    }

    try {
      await openCheckout({
        items: [{ priceId, quantity: 1 }],
        customer: user.email ? { email: user.email } : undefined,
        customData: {
          clerkId: user.clerkId,
          planType: planId,
          source: "my_subscription",
          beta50: useBetaPrice,
        },
      });
    } catch (error: any) {
      toast.error(t("subscription.upgradeError", { error: error.message }));
    }
  };

  const handleUpgrade = async (newPlan: string) => {
    if (!subscription || !user) return;

    if (!paddleConfigured) {
      toast.error("Paddle is not configured.");
      return;
    }

    const priceId = priceIdMap[newPlan as keyof typeof priceIdMap];
    if (!priceId) {
      toast.error("No Paddle Price ID configured for this plan.");
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

      await openCheckout({
        items: [{ priceId, quantity: 1 }],
        customer: user.email ? { email: user.email } : undefined,
        customData: {
          clerkId: user.clerkId,
          planType: newPlan,
          previousPlan: subscriptionPlan || subscription.planType,
          upgradeCostCents: result?.cost ?? 0,
        },
      });
    } catch (error: any) {
      toast.error(t("subscription.upgradeError", { error: error.message }));
    } finally {
      setIsCalculating(false);
    }
  };

  const handleCancel = async () => {
    if (!subscription) return;

    const confirmed = window.confirm(t('subscription.cancelConfirm'));

    if (confirmed) {
      setIsCancelling(true);
      try {
        await cancelMutation({});
        toast.success(t('subscription.cancelSuccess'));
      } catch (error: any) {
        toast.error(t('subscription.cancelError', { error: error.message }));
      } finally {
        setIsCancelling(false);
      }
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
                      <p><strong>{t('subscription.units')}:</strong> 1-{(subscription as any).maxAccessibleUnits || 5} (of 27)</p>
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
                    <strong>Special offer:</strong> You can use a one-time 50% discount on your first purchase.
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
                        const displayPrice = isBetaPrice ? Math.round(plan.price / 2) : plan.price;
                        return (
                          <Card key={plan.id} className="border-2 hover:border-primary transition-colors">
                            <CardHeader>
                              <CardTitle className="capitalize">{plan.name}</CardTitle>
                              <CardDescription>{plan.months} months</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="text-3xl font-bold text-primary">
                                {formatCurrency(displayPrice)}
                                {isBetaPrice ? <span className="text-sm text-muted-foreground"> (Beta 50%)</span> : null}
                              </div>
                              <Button
                                onClick={() => handlePurchase(plan.id as any, isBetaPrice)}
                                disabled={!paddleReady}
                                className="w-full"
                              >
                                <CreditCard className="h-4 w-4 mr-2" />
                                Continue with {plan.name}
                              </Button>
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
                    .map((plan) => (
                      <Card key={plan.id} className="border-2 hover:border-primary transition-colors">
                        <CardHeader>
                          <CardTitle className="capitalize">{plan.name}</CardTitle>
                          <CardDescription>{plan.months} months</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="text-3xl font-bold text-primary">{formatCurrency(plan.price)}</div>
                          <Button
                            onClick={() => handlePurchase(plan.id as any, false)}
                            disabled={!paddleReady}
                            className="w-full"
                          >
                            <CreditCard className="h-4 w-4 mr-2" />
                            Continue with {plan.name}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
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
                    <strong>Special offer:</strong> One-time 50% discount available.
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
                        const displayPrice = isBetaPrice ? Math.round(plan.price / 2) : plan.price;
                        return (
                          <Card key={plan.id} className="border-2 hover:border-primary transition-colors">
                            <CardHeader>
                              <CardTitle className="capitalize">{plan.name}</CardTitle>
                              <CardDescription>{plan.months} months</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="text-3xl font-bold text-primary">
                                {formatCurrency(displayPrice)}
                                {isBetaPrice ? <span className="text-sm text-muted-foreground"> (Beta 50%)</span> : null}
                              </div>
                              <Button
                                onClick={() => handlePurchase(plan.id as any, isBetaPrice)}
                                disabled={!paddleReady}
                                className="w-full"
                              >
                                <CreditCard className="h-4 w-4 mr-2" />
                                Continue with {plan.name}
                              </Button>
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
                    <p><strong>{t('subscription.units')}:</strong> 1-{(subscription as any).maxAccessibleUnits || 5} (of 27)</p>
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

  const planDuration = normalizedPlan === "intensive" ? 90 : 
                       normalizedPlan === "balanced" ? 180 : 
                       normalizedPlan === "standard" ? 270 : 365;
  
  const daysElapsed = planDuration - (daysRemaining || 0);
  const progressPercentage = (daysElapsed / planDuration) * 100;

  return (
    <div className={embedded ? "w-full" : "p-8 w-full overflow-y-auto"}>
      <div className={embedded ? "w-full" : "max-w-4xl mx-auto"}>
        {!embedded && <h1 className="text-3xl font-bold mb-6">{t('subscription.title')}</h1>}

        {/* Current Plan Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl capitalize">{normalizedPlan} {t('subscription.plan')}</CardTitle>
                <CardDescription>
                  {subscription.status === "active" ? t('subscription.active') : t('subscription.cancelled')}
                </CardDescription>
              </div>
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
                  {planDuration} {t('subscription.days')}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
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
                <span>{t('subscription.daysRemaining', { count: daysRemaining })}</span>
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

            {/* Cancel Button */}
            {subscription.status === "active" && (
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isCancelling}
                className="w-full"
              >
                {isCancelling ? t('subscription.cancelling') : t('subscription.cancelSubscription')}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Upgrade Options */}
        {subscription.status === "active" && availablePlans && (
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
                  .map((plan: SubscriptionPlan) => (
                    <Card key={plan.id} className="border-2 hover:border-primary transition-colors">
                      <CardHeader>
                        <CardTitle className="capitalize">{plan.name}</CardTitle>
                        <CardDescription>{plan.months} {t('subscription.days')}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-3xl font-bold text-primary">{formatCurrency(plan.price)}</div>
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
                        <Button
                          onClick={() => handleUpgrade(plan.id)}
                          disabled={isCalculating || !paddleReady}
                          className="w-full"
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          {isCalculating ? t('subscription.calculating') : t('subscription.upgradeNow')}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
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
