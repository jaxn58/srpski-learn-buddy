import { useAuth } from "@/_core/hooks/useAuth";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { Calendar, Check, Clock, CreditCard, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function MySubscription() {
  const { user, loading: authLoading } = useAuth();
  const [timeRemaining, setTimeRemaining] = useState({ days: 0, hours: 0, minutes: 0 });

  // Fetch subscription data
  const { data: subscription, isLoading: subLoading, refetch } = trpc.subscription.getCurrent.useQuery(
    undefined,
    { enabled: !!user }
  );
  
  const { data: daysRemaining } = trpc.subscription.getDaysRemaining.useQuery(
    undefined,
    { enabled: !!user && !!subscription }
  );

  const { data: availablePlans } = trpc.subscription.getPlans.useQuery();

  // Calculate upgrade cost
  const calculateUpgradeMutation = trpc.subscription.calculateUpgradeCost.useMutation();

  // Cancel subscription
  const cancelMutation = trpc.subscription.cancel.useMutation({
    onSuccess: () => {
      toast.success("Subscription cancelled successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to cancel subscription: ${error.message}`);
    },
  });

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

  const handleUpgrade = async (newPlan: string) => {
    if (!subscription) return;

    try {
      const result = await calculateUpgradeMutation.mutateAsync({
        currentPlan: subscription.plan,
        newPlan,
      });

      // TODO: Integrate with payment provider (Payoneer/Paddle)
      toast.info(`Upgrade cost: €${result.cost}. Payment integration coming soon!`);
    } catch (error: any) {
      toast.error(`Failed to calculate upgrade cost: ${error.message}`);
    }
  };

  const handleCancel = () => {
    if (!subscription) return;

    const confirmed = window.confirm(
      "Are you sure you want to cancel your subscription? You will lose access to all units after the expiration date."
    );

    if (confirmed) {
      cancelMutation.mutate();
    }
  };

  if (authLoading || subLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading subscription...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">My Subscription</h1>
            <Card>
              <CardHeader>
                <CardTitle>No Active Subscription</CardTitle>
                <CardDescription>
                  You don't have an active subscription yet. Choose a plan to get started!
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => window.location.href = "/"}>
                  View Plans
                </Button>
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
          <h1 className="text-3xl font-bold mb-6">My Subscription</h1>

          {/* Current Plan Card */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl capitalize">{subscription.plan} Plan</CardTitle>
                  <CardDescription>
                    {subscription.status === "active" ? "Active" : "Cancelled"}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-primary">
                    €{subscription.plan === "intensive" ? "69" : 
                       subscription.plan === "balanced" ? "79" : 
                       subscription.plan === "standard" ? "95" : "119"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {planDuration} days
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
                    <span className="font-semibold">Time Remaining</span>
                  </div>
                  <span className="text-2xl font-bold">
                    {timeRemaining.days}d {timeRemaining.hours}h {timeRemaining.minutes}m
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-3" />
                <div className="flex justify-between text-sm text-muted-foreground mt-1">
                  <span>{daysElapsed} days elapsed</span>
                  <span>{daysRemaining} days remaining</span>
                </div>
              </div>

              {/* Expiration Date */}
              <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-semibold">Expires on</div>
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
                  disabled={cancelMutation.isPending}
                  className="w-full"
                >
                  {cancelMutation.isPending ? "Cancelling..." : "Cancel Subscription"}
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
                  Upgrade Your Plan
                </CardTitle>
                <CardDescription>
                  Need more time? Upgrade to a longer plan and pay only the difference!
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
                          <CardDescription>{plan.duration} days</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="text-3xl font-bold text-primary">€{plan.price}</div>
                          <ul className="space-y-2 text-sm">
                            <li className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-600" />
                              <span>All 27 units included</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-600" />
                              <span>AI Learn Buddy access</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-600" />
                              <span>Vocabulary trainer</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-600" />
                              <span>Progress tracking</span>
                            </li>
                          </ul>
                          <Button
                            onClick={() => handleUpgrade(plan.id)}
                            disabled={calculateUpgradeMutation.isPending}
                            className="w-full"
                          >
                            <CreditCard className="h-4 w-4 mr-2" />
                            {calculateUpgradeMutation.isPending ? "Calculating..." : "Upgrade Now"}
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

