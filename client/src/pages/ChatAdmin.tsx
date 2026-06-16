/**
 * Chat Admin Page
 * Admin interface for managing Chat AI model configuration
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTimeEU } from "@/lib/utils";
import {
  MessageSquare,
  Cpu,
  HelpCircle,
  Loader2,
  Save,
  Undo2,
  ThumbsUp,
  ThumbsDown,
  Download,
  TrendingUp,
  BarChart3,
  Users,
  Filter,
  DollarSign,
  Activity,
  ShieldAlert,
} from "lucide-react";

const PROVIDER_OPTIONS = [
  { value: "google", label: "Google (Gemini)" },
  { value: "openai", label: "OpenAI" },
];

const MODEL_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  google: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  ],
  openai: [
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
  ],
};

export default function ChatAdmin() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();

  const aiConfig = useQuery(api.admin.getChatAiConfig);
  const updateAiConfigMutation = useMutation(api.admin.updateChatAiConfig);

  const feedbackStats = useQuery(api.admin.getChatFeedbackStats);
  const [feedbackFilter, setFeedbackFilter] = useState<"up" | "down" | undefined>(undefined);
  const feedbackDetails = useQuery(api.admin.getChatFeedbackDetails, {
    limit: 50,
    ratingFilter: feedbackFilter,
  });

  // Usage stats -- coarse 5-minute window to avoid excessive re-renders
  const FIVE_MIN = 5 * 60 * 1000;
  const [usageNowMs] = useState(() => Math.floor(Date.now() / FIVE_MIN) * FIVE_MIN);
  const usageStats = useQuery(api.admin.getChatUsageStats, { nowMs: usageNowMs });

  const [primaryProvider, setPrimaryProvider] = useState("google");
  const [primaryModel, setPrimaryModel] = useState("gemini-2.5-flash");
  const [fallbackProvider, setFallbackProvider] = useState("openai");
  const [fallbackModel, setFallbackModel] = useState("gpt-4o-mini");
  const [maxTokens, setMaxTokens] = useState(2048);
  const [temperature, setTemperature] = useState("");
  const [dailyBudgetCents, setDailyBudgetCents] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (aiConfig) {
      setPrimaryProvider(aiConfig.primaryProvider);
      setPrimaryModel(aiConfig.primaryModel);
      setFallbackProvider(aiConfig.fallbackProvider ?? "openai");
      setFallbackModel(aiConfig.fallbackModel ?? "gpt-4o-mini");
      setMaxTokens(aiConfig.maxTokens);
      setTemperature(aiConfig.temperature != null ? String(aiConfig.temperature) : "");
      setDailyBudgetCents(aiConfig.dailyBudgetCents != null ? String(aiConfig.dailyBudgetCents) : "");
    }
  }, [aiConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const tempVal = temperature.trim() ? parseFloat(temperature) : undefined;
      const budgetVal = dailyBudgetCents.trim() ? parseInt(dailyBudgetCents) : undefined;
      await updateAiConfigMutation({
        primaryProvider,
        primaryModel,
        fallbackProvider: fallbackProvider || undefined,
        fallbackModel: fallbackModel || undefined,
        maxTokens,
        temperature: tempVal,
        dailyBudgetCents: budgetVal,
      });
      toast.success("AI Model configuration saved.");
    } catch (error) {
      console.error("Error saving AI config:", error);
      toast.error("Failed to save AI model configuration.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <Card>
          <CardHeader>
            <p className="font-bold">Access Denied</p>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSuperadmin = user.role === "superadmin";
  const primaryModels = MODEL_OPTIONS[primaryProvider] ?? [];
  const fallbackModels = MODEL_OPTIONS[fallbackProvider] ?? [];

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-lg">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">Chat Administration</h1>
            <p className="text-xs text-muted-foreground mt-1">AI model, provider & failover settings for Learn Buddy</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/admin">
            <Button variant="outline" size="sm">
              <Undo2 className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* AI Model Configuration */}
          <Card className="border-2 shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Cpu className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-bold">AI Model Configuration</p>
                    <p className="text-xs text-muted-foreground">Which AI model powers the Learn Buddy chat</p>
                  </div>
                </div>
                {aiConfig ? (
                  <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-bold uppercase">
                    Custom Config Active
                  </span>
                ) : (
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold uppercase">
                    Using Defaults
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Primary Provider & Model */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t('admin.chat.primaryProvider')}
                  </Label>
                  <Select value={primaryProvider} onValueChange={(v) => {
                    setPrimaryProvider(v);
                    setPrimaryModel(MODEL_OPTIONS[v]?.[0]?.value ?? "");
                  }} disabled={!isSuperadmin}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROVIDER_OPTIONS.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">The AI provider used for chat responses.</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Primary Model
                  </Label>
                  <Select value={primaryModel} onValueChange={setPrimaryModel} disabled={!isSuperadmin}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {primaryModels.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">The specific model from this provider.</p>
                </div>
              </div>

              {/* Failover */}
              <div className="border-t pt-6">
                <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-lg mb-4">
                  <p className="text-[11px] text-amber-800 flex items-center gap-2 leading-relaxed">
                    <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      <strong>Failover:</strong> If the primary provider fails or is unavailable, the system automatically
                      switches to the fallback. Requires the corresponding API key in Convex environment variables.
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Fallback Provider
                    </Label>
                    <Select value={fallbackProvider} onValueChange={(v) => {
                      setFallbackProvider(v);
                      setFallbackModel(MODEL_OPTIONS[v]?.[0]?.value ?? "");
                    }} disabled={!isSuperadmin}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PROVIDER_OPTIONS.filter(p => p.value !== primaryProvider).map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Fallback Model
                    </Label>
                    <Select value={fallbackModel} onValueChange={setFallbackModel} disabled={!isSuperadmin}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {fallbackModels.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Advanced Settings */}
              <div className="border-t pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Max Tokens
                    </Label>
                    <Input
                      type="number"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value) || 2048)}
                      min={256}
                      max={8192}
                      disabled={!isSuperadmin}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Maximum length of a single AI response. 2048 ≈ ~1500 words. Higher = longer answers, more cost.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Temperature (optional)
                    </Label>
                    <Input
                      type="number"
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                      placeholder="Default (model-specific)"
                      min={0}
                      max={2}
                      step={0.1}
                      disabled={!isSuperadmin}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      0 = deterministic, 1 = creative. For a language tutor, 0.5–0.7 is recommended. Empty = model default.
                    </p>
                  </div>
                </div>

                {/* Daily Budget */}
                <div className="border-t pt-6">
                  <div className="bg-red-50/50 border border-red-100 p-3 rounded-lg mb-4">
                    <p className="text-[11px] text-red-800 flex items-center gap-2 leading-relaxed">
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        <strong>Global Daily Budget:</strong> When estimated cost exceeds this cap, all chat requests are blocked for the rest of the day. 0 or empty = no cap. Amount in cents (100 = $1.00).
                      </span>
                    </p>
                  </div>
                  <div className="space-y-2 max-w-xs">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Daily Budget (cents)
                    </Label>
                    <Input
                      type="number"
                      value={dailyBudgetCents}
                      onChange={(e) => setDailyBudgetCents(e.target.value)}
                      placeholder="e.g. 100 (= $1.00)"
                      min={0}
                      step={10}
                      disabled={!isSuperadmin}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Cost is estimated from character length (~4 chars = 1 token, Gemini Flash pricing).
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            {isSuperadmin && (
              <CardFooter className="flex justify-end p-4 border-t bg-muted/5">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Configuration
                </Button>
              </CardFooter>
            )}
          </Card>

          {/* ====== USAGE & COST ANALYTICS ====== */}
          <div className="pt-4">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Usage &amp; Cost Analytics
            </h2>

            {usageStats ? (
              <>
                {/* Stats cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  <StatsCard
                    label="Messages Today"
                    value={usageStats.today.requests}
                    icon={<MessageSquare className="h-4 w-4" />}
                  />
                  <StatsCard
                    label="Est. Cost Today"
                    value={`$${(usageStats.today.costCents / 100).toFixed(4)}`}
                    icon={<DollarSign className="h-4 w-4" />}
                  />
                  <StatsCard
                    label="Active Users Today"
                    value={usageStats.today.activeUsers}
                    icon={<Users className="h-4 w-4" />}
                  />
                  <StatsCard
                    label="Messages (7d)"
                    value={usageStats.week.requests}
                    icon={<BarChart3 className="h-4 w-4" />}
                  />
                  <StatsCard
                    label="Est. Cost (7d)"
                    value={`$${(usageStats.week.costCents / 100).toFixed(3)}`}
                    icon={<DollarSign className="h-4 w-4" />}
                  />
                  <StatsCard
                    label="Est. Monthly (extrapolated)"
                    value={`$${(usageStats.estimatedMonthlyCostCents / 100).toFixed(2)}`}
                    icon={<TrendingUp className="h-4 w-4" />}
                    accent={
                      usageStats.dailyBudgetCents > 0
                        ? usageStats.today.costCents >= usageStats.dailyBudgetCents
                          ? "red"
                          : usageStats.today.costCents >= usageStats.dailyBudgetCents * 0.8
                            ? "amber"
                            : "green"
                        : undefined
                    }
                  />
                </div>

                {/* Daily budget progress */}
                {usageStats.dailyBudgetCents > 0 && (
                  <Card className="border mb-4">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          Daily Budget
                        </span>
                        <span className="text-xs font-semibold">
                          ${(usageStats.today.costCents / 100).toFixed(4)} / ${(usageStats.dailyBudgetCents / 100).toFixed(2)}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            usageStats.today.costCents >= usageStats.dailyBudgetCents
                              ? "bg-destructive"
                              : usageStats.today.costCents >= usageStats.dailyBudgetCents * 0.8
                                ? "bg-amber-500"
                                : "bg-green-500"
                          )}
                          style={{ width: `${Math.min(100, (usageStats.today.costCents / usageStats.dailyBudgetCents) * 100)}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Daily trend bar chart */}
                <Card className="border mb-4">
                  <CardHeader className="pb-2 border-b bg-muted/10">
                    <p className="text-sm font-bold flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      Messages per Day (last 30 days)
                    </p>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="flex items-end gap-0.5 h-20">
                      {usageStats.dailyTrend.map((day) => {
                        const maxVal = Math.max(1, ...usageStats.dailyTrend.map((d) => d.requests));
                        const heightPct = (day.requests / maxVal) * 100;
                        const label = new Date(day.dateMs).toLocaleDateString("en-GB", { month: "short", day: "numeric" });
                        return (
                          <div
                            key={day.dateMs}
                            className="flex-1 flex flex-col items-center justify-end h-full group relative"
                            title={`${label}: ${day.requests} msg`}
                          >
                            <div
                              className="w-full rounded-t-sm bg-primary/40 group-hover:bg-primary/70 transition-colors"
                              style={{ height: `${heightPct}%`, minHeight: day.requests > 0 ? "2px" : "0" }}
                            />
                            {/* Tooltip */}
                            <span className="absolute bottom-full mb-1 hidden group-hover:block text-[9px] bg-popover border px-1 py-0.5 rounded shadow whitespace-nowrap z-10">
                              {label}: {day.requests}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center mt-1">Hover over bars for details</p>
                  </CardContent>
                </Card>

                {/* Top users table */}
                {usageStats.topUsers.length > 0 && (
                  <Card className="border">
                    <CardHeader className="pb-2 border-b bg-muted/10">
                      <p className="text-sm font-bold flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        Top Users by Message Count
                      </p>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>User</TableHead>
                            <TableHead className="text-right">Today</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Est. Cost</TableHead>
                            <TableHead className="text-right">Last Active</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {usageStats.topUsers.map((u) => (
                            <TableRow key={u.userId}>
                              <TableCell className="text-xs font-medium truncate max-w-[140px]">{u.name}</TableCell>
                              <TableCell className="text-xs text-right">{u.todayCount}</TableCell>
                              <TableCell className="text-xs text-right">{u.totalCount}</TableCell>
                              <TableCell className="text-xs text-right">${(u.estimatedCostCents / 100).toFixed(3)}</TableCell>
                              <TableCell className="text-xs text-right text-muted-foreground">
                                {u.lastActive > 0 ? formatDateTimeEU(u.lastActive) : "–"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {/* ====== FEEDBACK ANALYTICS ====== */}
          <div className="pt-4">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Feedback Analytics
            </h2>

            {/* Stats Cards */}
            {feedbackStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <StatsCard
                  label="Total Feedback"
                  value={feedbackStats.total}
                  icon={<BarChart3 className="h-4 w-4" />}
                />
                <StatsCard
                  label="Satisfaction Rate"
                  value={feedbackStats.satisfactionRate != null ? `${feedbackStats.satisfactionRate}%` : "–"}
                  icon={<TrendingUp className="h-4 w-4" />}
                  accent={
                    feedbackStats.satisfactionRate != null
                      ? feedbackStats.satisfactionRate >= 70 ? "green" : feedbackStats.satisfactionRate >= 40 ? "amber" : "red"
                      : undefined
                  }
                />
                <StatsCard
                  label="Last 7 Days"
                  value={feedbackStats.last7Days.total > 0
                    ? `${feedbackStats.last7Days.rate}% (${feedbackStats.last7Days.total})`
                    : "–"}
                  icon={<ThumbsUp className="h-4 w-4" />}
                />
                <StatsCard
                  label="Unique Users"
                  value={feedbackStats.uniqueUsers}
                  icon={<Users className="h-4 w-4" />}
                />
              </div>
            )}

            {feedbackStats && feedbackStats.total > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                <Card className="border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Thumbs Up</span>
                      <ThumbsUp className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-2xl font-bold text-green-600">{feedbackStats.totalUp}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${feedbackStats.total > 0 ? (feedbackStats.totalUp / feedbackStats.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Thumbs Down</span>
                      <ThumbsDown className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-2xl font-bold text-red-500">{feedbackStats.totalDown}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500 rounded-full transition-all"
                          style={{ width: `${feedbackStats.total > 0 ? (feedbackStats.totalDown / feedbackStats.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Feedback Detail Table */}
            <Card className="border-2 shadow-sm">
              <CardHeader className="pb-3 border-b bg-muted/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-bold">Recent Feedback</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={feedbackFilter ?? "all"}
                      onValueChange={(v) => setFeedbackFilter(v === "all" ? undefined : v as "up" | "down")}
                    >
                      <SelectTrigger className="h-8 w-[130px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Ratings</SelectItem>
                        <SelectItem value="up">Thumbs Up</SelectItem>
                        <SelectItem value="down">Thumbs Down</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => exportFeedbackCsv(feedbackDetails ?? [])}
                      disabled={!feedbackDetails || feedbackDetails.length === 0}
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Export CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!feedbackDetails || feedbackDetails.length === 0 ? (
                  <div className="text-center py-16">
                    <ThumbsUp className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">No feedback data yet.</p>
                    <p className="text-muted-foreground/60 text-xs mt-1">Feedback will appear here as users rate chat responses.</p>
                  </div>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-12">Rating</TableHead>
                          <TableHead className="w-36">Date</TableHead>
                          <TableHead className="w-28">User</TableHead>
                          <TableHead>AI Response (preview)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {feedbackDetails.map((fb) => (
                          <TableRow key={fb._id}>
                            <TableCell>
                              {fb.rating === "up" ? (
                                <ThumbsUp className="h-4 w-4 text-green-600" />
                              ) : (
                                <ThumbsDown className="h-4 w-4 text-red-500" />
                              )}
                            </TableCell>
                            <TableCell className="text-xs">{formatDateTimeEU(fb.createdAt)}</TableCell>
                            <TableCell className="text-xs font-medium truncate max-w-[120px]">{fb.userName}</TableCell>
                            <TableCell className="text-xs text-muted-foreground truncate max-w-[300px]">
                              {fb.messageContent}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}

function StatsCard({ label, value, icon, accent }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: "green" | "amber" | "red";
}) {
  return (
    <Card className="border">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
          <span className="text-muted-foreground/50">{icon}</span>
        </div>
        <span className={cn(
          "text-xl font-bold",
          accent === "green" && "text-green-600",
          accent === "amber" && "text-amber-600",
          accent === "red" && "text-red-500",
        )}>
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

function exportFeedbackCsv(data: Array<{
  _id: string;
  rating: string;
  createdAt: number;
  messageContent: string;
  userName: string;
  sessionId: string;
}>) {
  const header = "Date,User,Rating,Session ID,AI Response Preview\n";
  const rows = data.map((fb) => {
    const date = new Date(fb.createdAt).toISOString();
    const content = fb.messageContent.replace(/"/g, '""').replace(/\n/g, ' ');
    return `"${date}","${fb.userName}","${fb.rating}","${fb.sessionId}","${content}"`;
  }).join("\n");

  const csv = header + rows;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `chat-feedback-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex items-center p-6 pt-0", className)}>{children}</div>;
}
