import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import {
  Bug,
  Eye,
  MessageCircle,
  MessageSquare,
  Rocket,
  Sparkles,
  Trash2,
  User,
  Building2,
  Lock,
  Undo2,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { cn, formatDateTimeEU } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

/** Set to true to show AI draft/regenerate in the detail dialog again. */
const FEEDBACK_AI_ASSISTANT_UI_ENABLED = false;

type FeedbackSubmissionDoc = Doc<"feedbackSubmissions"> & {
  userName?: string;
  userEmail?: string;
};
type FeedbackStatus = "new" | "reviewed" | "answered" | "in_progress" | "completed" | "rejected";
type FeedbackType = "bug" | "feature" | "improvement" | "other";

export default function FeedbackManagement() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const adminSubmissions = useQuery(api.feedback.getAllSubmissions) as FeedbackSubmissionDoc[] | undefined;
  const superadminSubmissions = useQuery(
    api.feedback.getAllSubmissionsForSuperadmin,
    user?.role === "superadmin" ? undefined : "skip"
  ) as FeedbackSubmissionDoc[] | undefined;

  const submissions =
    user?.role === "superadmin" ? superadminSubmissions : adminSubmissions;
  const submissionsLoading = submissions === undefined;
  const submissionRows = useMemo(
    () =>
      (submissions ?? []).filter(
        (row): row is FeedbackSubmissionDoc =>
          row != null && typeof row === "object" && "_id" in row
      ),
    [submissions]
  );

  const updateStatusMutation = useMutation(api.feedback.updateStatus);
  const deleteFeedbackMutation = useMutation(api.feedback.deleteFeedback);
  const sendAiReplyAction = useAction(api.feedback.sendAiReplyToUser);
  const regenerateAiAction = useAction(api.feedback.regenerateAiForFeedback);
  const addAdminInternalNoteMutation = useMutation(api.feedback.addAdminInternalNote);


  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackSubmissionDoc | null>(null);
  const [dialogOpenId, setDialogOpenId] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<FeedbackStatus>("new");
  const [aiReplyText, setAiReplyText] = useState("");
  const [aiSendBusy, setAiSendBusy] = useState(false);
  const [aiRegenerateBusy, setAiRegenerateBusy] = useState(false);
  const [internalNoteText, setInternalNoteText] = useState("");
  const [internalNoteBusy, setInternalNoteBusy] = useState(false);


  const threadQuery = useQuery(
    api.feedback.getThread,
    dialogOpenId && selectedFeedback
      ? { feedbackId: selectedFeedback._id }
      : "skip"
  );

  useEffect(() => {
    if (!selectedFeedback || submissions === undefined) return;
    const updated = submissionRows.find((s) => s._id === selectedFeedback._id);
    if (updated) {
      setSelectedFeedback(updated);
      // Only pre-fill with AI draft when AI assistant is enabled and field is empty.
      // Sent replies are visible in the conversation thread — never pre-fill from aiSentContent.
      if (!aiReplyText.trim() && FEEDBACK_AI_ASSISTANT_UI_ENABLED) {
        const fromAiDraft = String((updated as { aiDraftReply?: string }).aiDraftReply ?? "");
        setAiReplyText(fromAiDraft);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionRows, selectedFeedback?._id]);

  if (authLoading || submissionsLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don&apos;t have permission to access this page.</CardDescription>
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

  const handleSaveChanges = async () => {
    if (!selectedFeedback) return;
    try {
      await updateStatusMutation({ id: selectedFeedback._id, status: currentStatus });
      toast.success(t("admin.feedback.toast.updated"));
      setSelectedFeedback({ ...selectedFeedback, status: currentStatus });
    } catch (error: unknown) {
      console.error("Update error:", error);
      toast.error(error instanceof Error ? error.message : t("admin.feedback.toast.updateFailed"));
    }
  };

  const handleDelete = async (id: Id<"feedbackSubmissions">) => {
    if (!confirm("Are you sure you want to delete this feedback?")) return;
    try {
      await deleteFeedbackMutation({ id });
      toast.success(t("admin.feedback.toast.deleted"));
    } catch {
      toast.error(t("admin.feedback.toast.deleteFailed"));
    }
  };

  const TypeGlyph = ({ type }: { type: FeedbackType | string }) => {
    const cls = "h-5 w-5 shrink-0 text-muted-foreground";
    switch (type) {
      case "bug":        return <Bug className={cls} aria-hidden />;
      case "feature":    return <Sparkles className={cls} aria-hidden />;
      case "improvement":return <Rocket className={cls} aria-hidden />;
      default:           return <MessageCircle className={cls} aria-hidden />;
    }
  };

  const getStatusBadgeClass = (status: FeedbackStatus | string) => {
    switch (status) {
      case "new":         return "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100";
      case "reviewed":    return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100";
      case "answered":    return "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100";
      case "in_progress": return "border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-100";
      case "completed":   return "border-green-200 bg-green-50 text-green-950 dark:border-green-800 dark:bg-green-950/30 dark:text-green-100";
      case "rejected":    return "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100";
      default:            return "border-border bg-muted text-foreground";
    }
  };

  const getDescriptionPreview = (text: string) => {
    const normalized = String(text).replace(/\s+/g, " ").trim();
    if (!normalized) return "";
    if (normalized.length <= 140) return normalized;
    return normalized.slice(0, 140).trimEnd() + "…";
  };

  const getConversationActivityHint = (f: FeedbackSubmissionDoc) => {
    if (f.status === "completed" || f.status === "rejected") return t("admin.feedback.overview.closed");
    const last = f.lastThreadActivityBy;
    if (last === "user")  return t("admin.feedback.overview.needsReply");
    if (last === "admin") return t("admin.feedback.overview.awaitingUser");
    const hasReply = Boolean((f as { aiSentAt?: number }).aiSentAt);
    if (!hasReply && (f.status === "new" || f.status === "reviewed")) return t("admin.feedback.overview.needsReview");
    if (hasReply) return t("admin.feedback.overview.replySent");
    return null;
  };

  const isDialogDirty = (feedback: FeedbackSubmissionDoc | null) => {
    if (!feedback) return false;
    const baselineReply = FEEDBACK_AI_ASSISTANT_UI_ENABLED
      ? String((feedback as { aiDraftReply?: string }).aiDraftReply ?? "")
      : "";
    return (
      currentStatus !== (feedback.status as FeedbackStatus) ||
      aiReplyText !== baselineReply ||
      internalNoteText.trim().length > 0
    );
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header — consistent with other admin pages */}
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-lg">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">{t("admin.feedback.pageTitle")}</h1>
            <p className="text-xs text-muted-foreground mt-1">{t("admin.feedback.pageSubtitle")}</p>
          </div>
        </div>
        <Link href="/admin">
          <Button variant="outline" size="sm">
            <Undo2 className="h-4 w-4 mr-2" />
            {t("admin.feedback.backToAdmin")}
          </Button>
        </Link>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <Card className="overflow-hidden rounded-2xl border shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg font-semibold">
              {t("admin.feedback.cardTitle")}
              {user.role === "admin" && (
                <Badge
                  variant="outline"
                  className="rounded-full border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100"
                >
                  <Eye className="mr-1 h-3 w-3" aria-hidden />
                  {t("admin.feedback.readOnlyBadge")}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {t("admin.feedback.cardDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b hover:bg-transparent">
                  <TableHead className="w-12 pl-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("admin.feedback.col.type")}
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("admin.feedback.col.feedback")}
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("admin.feedback.col.status")}
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("admin.feedback.col.submitted")}
                  </TableHead>
                  <TableHead className="pr-6 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("admin.feedback.col.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissionRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                      {t("admin.feedback.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  submissionRows.map((feedback: FeedbackSubmissionDoc) => (
                    <TableRow key={feedback._id} className="align-top">
                      <TableCell className="pl-6 align-middle">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-xl border bg-card"
                          title={String(feedback.type)}
                        >
                          <TypeGlyph type={feedback.type} />
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[280px] md:max-w-md">
                        <div className="font-medium leading-snug">{feedback.title}</div>
                        {getDescriptionPreview(feedback.description) && (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {getDescriptionPreview(feedback.description)}
                          </p>
                        )}
                        <p className="mt-1.5 text-xs text-muted-foreground/70">
                          <span className="font-medium text-muted-foreground">{t("admin.feedback.from")}:</span>{" "}
                          {feedback.userName || "—"}
                          {feedback.userEmail ? ` · ${feedback.userEmail}` : ""}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              "w-fit rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
                              getStatusBadgeClass(feedback.status)
                            )}
                          >
                            {(feedback.status as string).replace("_", " ")}
                          </Badge>
                          {getConversationActivityHint(feedback) && (
                            <span className="text-[11px] leading-snug text-muted-foreground">
                              {getConversationActivityHint(feedback)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {feedback.submittedAt ? formatDateTimeEU(feedback.submittedAt) : "—"}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <div className="flex justify-end gap-2">
                          <Dialog
                            open={dialogOpenId === String(feedback._id)}
                            onOpenChange={(open) => {
                              if (open) {
                                setSelectedFeedback(feedback);
                                setDialogOpenId(String(feedback._id));
                                setCurrentStatus(feedback.status as FeedbackStatus);
                                setAiReplyText(
                                  FEEDBACK_AI_ASSISTANT_UI_ENABLED
                                    ? String((feedback as { aiDraftReply?: string }).aiDraftReply ?? "")
                                    : ""
                                );
                                setInternalNoteText("");
                                return;
                              }
                              const active =
                                selectedFeedback &&
                                String(selectedFeedback._id) === String(feedback._id)
                                  ? selectedFeedback
                                  : null;
                              if (active && isDialogDirty(active)) {
                                const ok = confirm(
                                  "You have unsaved changes. Do you want to close and discard them?"
                                );
                                if (!ok) return;
                              }
                              setInternalNoteText("");
                              setDialogOpenId(null);
                              setSelectedFeedback(null);
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-full"
                                onClick={() => {
                                  setSelectedFeedback(feedback);
                                  setDialogOpenId(String(feedback._id));
                                  setCurrentStatus(feedback.status as FeedbackStatus);
                                  setAiReplyText(
                                    FEEDBACK_AI_ASSISTANT_UI_ENABLED
                                      ? String((feedback as { aiDraftReply?: string }).aiDraftReply ?? "")
                                      : ""
                                  );
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent
                              className="max-h-[min(92vh,900px)] w-[calc(100vw-1.5rem)] max-w-2xl gap-0 overflow-hidden rounded-3xl border-0 p-0 shadow-lg sm:max-w-2xl"
                              onInteractOutside={(e) => {
                                if (
                                  selectedFeedback &&
                                  String(selectedFeedback._id) === String(feedback._id) &&
                                  isDialogDirty(selectedFeedback)
                                ) {
                                  e.preventDefault();
                                }
                              }}
                              onEscapeKeyDown={(e) => {
                                if (
                                  selectedFeedback &&
                                  String(selectedFeedback._id) === String(feedback._id) &&
                                  isDialogDirty(selectedFeedback)
                                ) {
                                  e.preventDefault();
                                }
                              }}
                            >
                              <div className="max-h-[min(92vh,900px)] overflow-y-auto">
                                {/* Dialog header */}
                                <div className="border-b bg-muted/50 px-5 py-4 md:px-6">
                                  <DialogHeader className="space-y-0 text-left">
                                    <div className="flex gap-3">
                                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border bg-card shadow-sm">
                                        <TypeGlyph type={feedback.type} />
                                      </div>
                                      <div className="min-w-0 flex-1 space-y-2">
                                        <DialogTitle className="text-left text-lg font-semibold leading-snug md:text-xl">
                                          {feedback.title}
                                        </DialogTitle>
                                        <DialogDescription className="text-left text-sm space-y-0.5">
                                          <span className="block">
                                            {t("admin.feedback.dialog.submitted", {
                                              date: feedback.submittedAt ? formatDateTimeEU(feedback.submittedAt) : "—",
                                            })}
                                          </span>
                                          <span className="block">
                                            <span className="font-medium text-foreground/70">{t("admin.feedback.from")}:</span>{" "}
                                            {feedback.userName || "—"}
                                            {feedback.userEmail ? (
                                              <> · <span className="font-mono">{feedback.userEmail}</span></>
                                            ) : null}
                                          </span>
                                        </DialogDescription>
                                        <div className="flex flex-wrap items-center gap-2 pt-1">
                                          <Badge
                                            variant="outline"
                                            className={cn(
                                              "rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
                                              getStatusBadgeClass(feedback.status)
                                            )}
                                          >
                                            {(feedback.status as string).replace("_", " ")}
                                          </Badge>
                                          {getConversationActivityHint(feedback) && (
                                            <span className="text-xs text-muted-foreground">
                                              {getConversationActivityHint(feedback)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </DialogHeader>
                                </div>

                                <div className="space-y-6 px-5 py-5 md:px-6">
                                  {/* Conversation history */}
                                  <section aria-labelledby="fb-conv-heading">
                                    <h3
                                      id="fb-conv-heading"
                                      className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                                    >
                                      {t("admin.feedback.section.conversation")}
                                    </h3>
                                    {threadQuery === undefined && (
                                      <div className="flex justify-center py-10">
                                        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                      </div>
                                    )}
                                    {threadQuery && (
                                      <ol className="relative space-y-0 border-l-2 border-border pl-5">
                                        {(threadQuery.messages as Array<{ _id: string; authorKind: string; isInternal?: boolean; authorDisplayName?: string; isSynthetic?: boolean; body: string; createdAt: number }>).map((m: { _id: string; authorKind: string; isInternal?: boolean; authorDisplayName?: string; isSynthetic?: boolean; body: string; createdAt: number }) => {
                                          const isLearner = !m.isInternal && m.authorKind === "user";
                                          const isTeam   = !m.isInternal && m.authorKind === "admin";
                                          return (
                                            <li key={m._id} className="relative pb-6 last:pb-0">
                                              <span
                                                className={cn(
                                                  "absolute -left-[21px] top-2 flex h-2.5 w-2.5 rounded-full ring-4 ring-background",
                                                  m.isInternal
                                                    ? "bg-amber-500"
                                                    : isLearner
                                                      ? "bg-primary"
                                                      : "bg-blue-500"
                                                )}
                                                aria-hidden
                                              />
                                              <div
                                                className={cn(
                                                  "rounded-2xl border px-4 py-3 text-sm shadow-sm",
                                                  m.isInternal &&
                                                    "border-amber-200/80 bg-amber-50/90 dark:border-amber-800 dark:bg-amber-950/25",
                                                  isLearner && "border-border bg-card",
                                                  isTeam &&
                                                    "border-blue-200/80 bg-blue-50/90 dark:border-blue-800 dark:bg-blue-950/20"
                                                )}
                                              >
                                                <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                                                  {m.isInternal ? (
                                                    <span className="inline-flex items-center gap-1 font-semibold text-amber-900 dark:text-amber-100">
                                                      <Lock className="h-3 w-3" aria-hidden />
                                                      {t("admin.feedback.thread.internalBadge")}
                                                    </span>
                                                  ) : (
                                                    <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                                                      {isLearner ? (
                                                        <User className="h-3 w-3" aria-hidden />
                                                      ) : (
                                                        <Building2 className="h-3 w-3" aria-hidden />
                                                      )}
                                                      {m.authorDisplayName}
                                                      {m.isSynthetic && !m.isInternal && m.authorKind === "admin"
                                                        ? ` · ${t("admin.feedback.thread.legacy")}`
                                                        : ""}
                                                    </span>
                                                  )}
                                                  <span className="text-muted-foreground">
                                                    {formatDateTimeEU(m.createdAt)}
                                                  </span>
                                                </div>
                                                <p className="whitespace-pre-wrap leading-relaxed">
                                                  {m.body}
                                                </p>
                                              </div>
                                            </li>
                                          );
                                        })}
                                      </ol>
                                    )}
                                  </section>

                                  {user.role === "superadmin" || user.role === "admin" ? (
                                    <>
                                      <Separator />

                                      {/* Workflow status */}
                                      <section
                                        className="rounded-2xl border bg-card p-4 shadow-sm"
                                        aria-labelledby="fb-workflow-heading"
                                      >
                                        <h3
                                          id="fb-workflow-heading"
                                          className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                                        >
                                          {t("admin.feedback.section.workflow")}
                                        </h3>
                                        <p className="mb-3 text-xs text-muted-foreground">
                                          {t("admin.feedback.section.workflowHelp")}
                                        </p>
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                          <div className="min-w-0 flex-1 space-y-2">
                                            <Label htmlFor={`status-${feedback._id}`}>
                                              {t("admin.feedback.field.workflowStatus")}
                                            </Label>
                                            <Select
                                              value={currentStatus}
                                              onValueChange={(value: FeedbackStatus) =>
                                                setCurrentStatus(value)
                                              }
                                            >
                                              <SelectTrigger
                                                id={`status-${feedback._id}`}
                                                className="rounded-xl"
                                              >
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="new">New</SelectItem>
                                                <SelectItem value="reviewed">Reviewed</SelectItem>
                                                <SelectItem value="answered">Answered</SelectItem>
                                                <SelectItem value="in_progress">In Progress</SelectItem>
                                                <SelectItem value="completed">Completed</SelectItem>
                                                <SelectItem value="rejected">Rejected</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <Button
                                            type="button"
                                            variant="secondary"
                                            className="rounded-full sm:shrink-0"
                                            onClick={handleSaveChanges}
                                            disabled={
                                              currentStatus ===
                                              (selectedFeedback?.status as FeedbackStatus)
                                            }
                                          >
                                            {t("admin.feedback.action.saveStatus")}
                                          </Button>
                                        </div>
                                      </section>

                                      {/* Reply to user */}
                                      <section
                                        className="rounded-2xl border bg-card p-4 shadow-sm"
                                        aria-labelledby="fb-reply-heading"
                                      >
                                        <h3
                                          id="fb-reply-heading"
                                          className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                                        >
                                          {t("admin.feedback.section.replyToLearner")}
                                        </h3>
                                        <p className="mb-3 text-xs text-muted-foreground">
                                          {t("admin.feedback.section.replyHelp")}
                                        </p>

                                        {FEEDBACK_AI_ASSISTANT_UI_ENABLED && (
                                          <div className="mb-4 space-y-3 rounded-xl border bg-muted/40 p-3 text-sm">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                {t("admin.feedback.ai.sectionTitle")}
                                              </p>
                                              {user.role === "superadmin" &&
                                                !selectedFeedback?.aiSentAt && (
                                                  <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="rounded-full text-xs"
                                                    disabled={aiRegenerateBusy}
                                                    onClick={async () => {
                                                      if (!selectedFeedback) return;
                                                      try {
                                                        setAiRegenerateBusy(true);
                                                        await regenerateAiAction({
                                                          feedbackId: selectedFeedback._id,
                                                        });
                                                        toast.success(t("admin.feedback.toast.aiRegenerated"));
                                                      } catch (e: unknown) {
                                                        toast.error(
                                                          e instanceof Error
                                                            ? e.message
                                                            : t("admin.feedback.toast.aiRegenerateFailed")
                                                        );
                                                      } finally {
                                                        setAiRegenerateBusy(false);
                                                      }
                                                    }}
                                                  >
                                                    {aiRegenerateBusy
                                                      ? t("admin.feedback.ai.regenerating")
                                                      : t("admin.feedback.ai.regenerate")}
                                                  </Button>
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              <div>
                                                <span className="font-medium text-foreground">
                                                  {t("admin.feedback.ai.statusLabel")}
                                                </span>{" "}
                                                {selectedFeedback?.aiStatus || "—"}
                                              </div>
                                              {selectedFeedback?.aiGeneratedAt != null && (
                                                <div>
                                                  <span className="font-medium text-foreground">
                                                    {t("admin.feedback.ai.generatedLabel")}
                                                  </span>{" "}
                                                  {formatDateTimeEU(selectedFeedback.aiGeneratedAt)}
                                                </div>
                                              )}
                                            </div>
                                            <div>
                                              <Label className="text-xs">{t("admin.feedback.ai.internalAnalysis")}</Label>
                                              <div className="mt-1 rounded-lg bg-background p-2 text-xs whitespace-pre-wrap">
                                                {selectedFeedback?.aiInternalNote || "—"}
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        <Label
                                          htmlFor={`reply-${feedback._id}`}
                                          className="sr-only"
                                        >
                                          Reply to user
                                        </Label>
                                        <Textarea
                                          id={`reply-${feedback._id}`}
                                          value={aiReplyText}
                                          onChange={(e) => setAiReplyText(e.target.value)}
                                          placeholder={t("admin.feedback.replyComposer.placeholder")}
                                          rows={5}
                                          className="rounded-xl border-2 bg-background"
                                        />
                                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                          <Button
                                            type="button"
                                            className="rounded-full"
                                            disabled={aiSendBusy || !aiReplyText.trim()}
                                            onClick={async () => {
                                              if (!selectedFeedback) return;
                                              try {
                                                setAiSendBusy(true);
                                                const res: unknown = await sendAiReplyAction({
                                                  feedbackId: selectedFeedback._id,
                                                  replyText: aiReplyText.trim(),
                                                });
                                                const r = res as {
                                                  emailSent?: boolean;
                                                  emailError?: string;
                                                };
                                                if (r?.emailSent === false) {
                                                  toast.success(t("admin.feedback.toast.replyPostedTool.title"), {
                                                    description: t("admin.feedback.toast.replyPostedTool.desc", { error: String(r?.emailError || "unknown") }),
                                                  });
                                                } else {
                                                  toast.success(t("admin.feedback.toast.replySent"));
                                                }
                                                setAiReplyText("");
                                              } catch (e: unknown) {
                                                toast.error(
                                                  e instanceof Error
                                                    ? e.message
                                                    : t("admin.feedback.toast.replySendFailed")
                                                );
                                              } finally {
                                                setAiSendBusy(false);
                                              }
                                            }}
                                          >
                                            {aiSendBusy
                                              ? t("admin.feedback.action.sending")
                                              : selectedFeedback?.aiSentAt
                                                ? t("admin.feedback.action.resendReply")
                                                : t("admin.feedback.action.sendToUser")}
                                          </Button>
                                        </div>
                                        {selectedFeedback?.aiSentAt != null && (
                                          <p className="mt-2 text-xs text-muted-foreground">
                                            {t("admin.feedback.lastSentAt", {
                                              date: formatDateTimeEU(selectedFeedback.aiSentAt),
                                            })}
                                          </p>
                                        )}
                                      </section>

                                      {/* Internal note */}
                                      <section
                                        className="rounded-2xl border border-dashed border-muted-foreground/25 bg-muted/20 p-4"
                                        aria-labelledby="fb-internal-heading"
                                      >
                                        <h3
                                          id="fb-internal-heading"
                                          className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                                        >
                                          <Lock className="h-3.5 w-3.5" aria-hidden />
                                          {t("admin.feedback.section.internal")}
                                        </h3>
                                        <p className="mb-3 text-xs text-muted-foreground">
                                          {t("admin.feedback.section.internalHelp")}
                                        </p>
                                        <Label htmlFor="internal-note" className="sr-only">
                                          {t("admin.feedback.thread.internalLabel")}
                                        </Label>
                                        <Textarea
                                          id="internal-note"
                                          rows={3}
                                          value={internalNoteText}
                                          onChange={(e) => setInternalNoteText(e.target.value)}
                                          placeholder={t("admin.feedback.thread.internalPlaceholder")}
                                          disabled={internalNoteBusy}
                                          className="rounded-xl bg-background"
                                        />
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="secondary"
                                          className="mt-2 rounded-full"
                                          disabled={internalNoteBusy || !internalNoteText.trim()}
                                          onClick={async () => {
                                            if (!selectedFeedback) return;
                                            setInternalNoteBusy(true);
                                            try {
                                              await addAdminInternalNoteMutation({
                                                feedbackId: selectedFeedback._id,
                                                body: internalNoteText.trim(),
                                              });
                                              setInternalNoteText("");
                                              toast.success(t("admin.feedback.toast.internalNoteSaved"));
                                            } catch (e: unknown) {
                                              toast.error(
                                                e instanceof Error
                                                  ? e.message
                                                  : t("admin.feedback.toast.internalNoteFailed")
                                              );
                                            } finally {
                                              setInternalNoteBusy(false);
                                            }
                                          }}
                                        >
                                          {internalNoteBusy ? t("admin.feedback.thread.saving") : t("admin.feedback.thread.saveInternal")}
                                        </Button>
                                      </section>
                                    </>
                                  ) : (
                                    <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                                      <p className="text-sm text-blue-900 dark:text-blue-100">
                                        <span className="font-semibold">{t("admin.feedback.readOnlyMode.title")}</span>{" "}
                                        {t("admin.feedback.readOnlyMode.body")}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          {user.role === "superadmin" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full"
                              onClick={() => handleDelete(feedback._id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
