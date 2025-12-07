import { useAuth } from "@/_core/hooks/useAuth";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Calendar, Check, Clock, CreditCard, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function MySubscription() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [timeRemaining, setTimeRemaining] = useState({ days: 0, hours: 0, minutes: 0 });

  // Fetch subscription data from Convex
  const subscription = useQuery(api.subscriptions.getCurrent);
  const subLoading = subscription === undefined;
  
  const daysRemaining = useQuery(
    api.subscriptions.getDaysRemaining,
    subscription ? {} : "skip"
  );

  const availablePlans = useQuery(api.subscriptions.getPlans);

  // Calculate upgrade cost mutation
  const calculateUpgradeMutation = useMutation(api.subscriptions.calculateUpgradeCost);
  
  // Cancel subscription mutation
  const cancelMutation = useMutation(api.subscriptions.cancel);
  const [isCancelling, setIsCancelling] = useState(false);

  // Calculate time remaining
  useEffect(() => {
    if (!subscription?.endsAt) return;

    const updateTimer = () => {
      const now = new Date();
      const end = new Date(subscription.endsAt);
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
  }, [subscription]);

  const [isCalculating, setIsCalculating] = useState(false);

  const handleUpgrade = async (newPlan: string) => {
    if (!subscription) return;

    setIsCalculating(true);
    try {
      const result = await calculateUpgradeMutation({
        currentPlan: subscription.plan,
        newPlan,
      });

      // TODO: Integrate with payment provider (Payoneer/Paddle)
      toast.info(t('subscription.upgradeCost', { cost: result.cost }));
    } catch (error: any) {
      toast.error(t('subscription.upgradeError', { error: error.message }));
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
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">{t('subscription.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!subscription) {
    // Check if user is Beta Tester
    if (user?.isBetaTester) {
      return (
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex-1 p-8">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-3xl font-bold mb-6">{t('subscription.title')}</h1>
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
                        <p><strong>{t('subscription.units')}:</strong> 1-5 (of 27)</p>
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
        </div>
      );
    }
    
    // No subscription and not Beta Tester
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">{t('subscription.title')}</h1>
            <Card>
              <CardHeader>
                <CardTitle>{t('subscription.noSubscription')}</CardTitle>
                <CardDescription>
                  {t('subscription.noSubscription.desc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => window.location.href = "/"}>
                  {t('subscription.viewPlans')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Special handling for Beta subscriptions
  if (subscription.plan === "beta" || (subscription as any).planType === "beta") {
    return (
      <div className="flex h-screen">
        <Sidebar />
          <div className="flex-1 p-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">{t('subscription.title')}</h1>
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
      </div>
    );
  }

  const planDuration = subscription.plan === "intensive" ? 90 : 
                       subscription.plan === "balanced" ? 180 : 
                       subscription.plan === "standard" ? 270 : 365;
  
  const daysElapsed = planDuration - (daysRemaining || 0);
  const progressPercentage = (daysElapsed / planDuration) * 100;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">{t('subscription.title')}</h1>

          {/* Current Plan Card */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl capitalize">{subscription.plan} {t('subscription.plan')}</CardTitle>
                  <CardDescription>
                    {subscription.status === "active" ? t('subscription.active') : t('subscription.cancelled')}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-primary">
                    €{subscription.plan === "intensive" ? "69" : 
                       subscription.plan === "balanced" ? "79" : 
                       subscription.plan === "standard" ? "95" : "119"}
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
                    {new Date(subscription.endsAt).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
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
                    .filter((plan) => {
                      const currentOrder = ["intensive", "balanced", "standard", "relaxed"].indexOf(subscription.plan);
                      const planOrder = ["intensive", "balanced", "standard", "relaxed"].indexOf(plan.id);
                      return planOrder > currentOrder;
                    })
                    .map((plan) => (
                      <Card key={plan.id} className="border-2 hover:border-primary transition-colors">
                        <CardHeader>
                          <CardTitle className="capitalize">{plan.name}</CardTitle>
                          <CardDescription>{plan.duration} {t('subscription.days')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="text-3xl font-bold text-primary">€{plan.price}</div>
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
                            disabled={isCalculating}
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
    </div>
  );
}

