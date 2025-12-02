import { useAuth } from "@/_core/hooks/useAuth";
import Sidebar from "@/components/Sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BarChart3, DollarSign, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Redirect } from "wouter";

export default function SubscriptionAnalytics() {
  const { user, loading: authLoading } = useAuth();
  const analytics = useQuery(api.subscriptions.getAnalytics);
  const isLoading = analytics === undefined;

  // Check if user is admin
  if (!authLoading && (!user || (user.role !== "admin" && user.role !== "superadmin"))) {
    return <Redirect to="/dashboard" />;
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Subscription Analytics</h1>
            <Card>
              <CardHeader>
                <CardTitle>No Data Available</CardTitle>
                <CardDescription>No subscription data found.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (cents: number | undefined) => {
    if (cents === undefined || cents === null) return "€0.00";
    return `€${(cents / 100).toFixed(2)}`;
  };

  const formatPercentage = (value: number | undefined) => {
    if (value === undefined || value === null) return "0.00%";
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Subscription Analytics</h1>

          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.activeUsers || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics?.totalUsers || 0} total users
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">MRR</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(analytics?.mrr)}</div>
                <p className="text-xs text-muted-foreground">Monthly Recurring Revenue</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPercentage(analytics?.churnRate)}</div>
                <p className="text-xs text-muted-foreground">
                  {(analytics?.totalUsers || 0) - (analytics?.activeUsers || 0)} cancelled
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Upgrade Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPercentage(analytics?.conversionRate)}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics?.upgradeCount || 0} upgrades
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Metrics */}
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Total Revenue</CardTitle>
                <CardDescription>All-time revenue from subscriptions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-primary">
                  {formatCurrency(analytics?.totalRevenue)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue by Plan</CardTitle>
                <CardDescription>Breakdown of revenue per subscription tier</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Intensive (3 months)</span>
                    <span className="text-sm font-bold">{formatCurrency(analytics?.revenueByPlan?.intensive)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Balanced (6 months)</span>
                    <span className="text-sm font-bold">{formatCurrency(analytics?.revenueByPlan?.balanced)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Standard (9 months)</span>
                    <span className="text-sm font-bold">{formatCurrency(analytics?.revenueByPlan?.standard)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Relaxed (12 months)</span>
                    <span className="text-sm font-bold">{formatCurrency(analytics?.revenueByPlan?.relaxed)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Users by Plan */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Active Users by Plan
              </CardTitle>
              <CardDescription>Distribution of active subscriptions across plans</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Intensive */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">Intensive (€69 / 3 months)</span>
                    <span className="text-sm font-bold">{analytics?.usersByPlan?.intensive || 0} users</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${((analytics?.usersByPlan?.intensive || 0) / (analytics?.activeUsers || 1)) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>

                {/* Balanced */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">Balanced (€79 / 6 months)</span>
                    <span className="text-sm font-bold">{analytics?.usersByPlan?.balanced || 0} users</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{
                        width: `${((analytics?.usersByPlan?.balanced || 0) / (analytics?.activeUsers || 1)) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>

                {/* Standard */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">Standard (€95 / 9 months)</span>
                    <span className="text-sm font-bold">{analytics?.usersByPlan?.standard || 0} users</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-orange-600 h-2 rounded-full"
                      style={{
                        width: `${((analytics?.usersByPlan?.standard || 0) / (analytics?.activeUsers || 1)) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>

                {/* Relaxed */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">Relaxed (€119 / 12 months)</span>
                    <span className="text-sm font-bold">{analytics?.usersByPlan?.relaxed || 0} users</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full"
                      style={{
                        width: `${((analytics?.usersByPlan?.relaxed || 0) / (analytics?.activeUsers || 1)) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

