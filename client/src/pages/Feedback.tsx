import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
// Sidebar import removed
import { ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { formatDateTimeEU } from "@/lib/utils";

type MyFeedbackSubmission = {
  _id: Id<"feedbackSubmissions">;
  _creationTime: number;
  type: "bug" | "feature" | "improvement" | "other";
  title: string;
  description: string;
  status: "new" | "reviewed" | "answered" | "in_progress" | "completed" | "rejected";
  submittedAt?: number;
  reviewedAt?: number;
  replyToUser?: string;
  replySentAt?: number;
};

type FeedbackFormState = {
  type: "bug" | "feature" | "improvement" | "other";
  title: string;
  description: string;
};

const TITLE_MIN = 10;
const DESCRIPTION_MIN = 50;

export default function Feedback() {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState<FeedbackFormState>({
    type: "other",
    title: "",
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const submitFeedbackMutation = useMutation(api.feedback.submit);
  const addUserMessageMutation = useMutation(api.feedback.addUserMessage);
  const mySubmissions = (useQuery(api.feedback.getMySubmissions) ?? []) as MyFeedbackSubmission[];
  const [openThreadId, setOpenThreadId] = useState<Id<"feedbackSubmissions"> | null>(null);
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [followUpSending, setFollowUpSending] = useState(false);
  const threadData = useQuery(
    api.feedback.getThread,
    openThreadId ? { feedbackId: openThreadId } : "skip"
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{t('feedback.loginRequired.title')}</CardTitle>
            <CardDescription>{t('feedback.loginRequired.desc')}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitAttempted(true);

    const titleTrimmed = feedback.title.trim();
    const descriptionTrimmed = feedback.description.trim();
    const titleMissing = titleTrimmed.length === 0;
    const descriptionMissing = descriptionTrimmed.length === 0;
    const titleTooShort = titleTrimmed.length > 0 && titleTrimmed.length < TITLE_MIN;
    const descriptionTooShort =
      descriptionTrimmed.length > 0 && descriptionTrimmed.length < DESCRIPTION_MIN;

    if (titleMissing || descriptionMissing || titleTooShort || descriptionTooShort) {
      toast.error(t("feedback.error.fixFields"));

      const focusId = titleMissing || titleTooShort ? "title" : "description";
      const el = document.getElementById(focusId) as HTMLElement | null;
      el?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      (el as any)?.focus?.();
      return;
    }

    setIsSubmitting(true);

    try {
      await submitFeedbackMutation({
        type: feedback.type,
        title: titleTrimmed,
        description: descriptionTrimmed,
      });

      toast.success(t('feedback.success.title'), {
        description: t('feedback.success.desc'),
        duration: 5000,
      });

      setFeedback({ type: "other", title: "", description: "" });
      setSubmitAttempted(false);
      setIsSubmitting(false);
    } catch (error) {
      toast.error(t('feedback.error.send'));
      setIsSubmitting(false);
    }
  };

  const typeLabels: Record<string, string> = {
    bug: `🐛 ${t('feedback.type.bug')}`,
    feature: `✨ ${t('feedback.type.feature')}`,
    improvement: `💡 ${t('feedback.type.improvement')}`,
    other: `📝 ${t('feedback.type.other')}`
  };

  const statusColors: Record<string, string> = {
    new: 'bg-yellow-100 text-yellow-800',
    reviewed: 'bg-blue-100 text-blue-800',
    answered: 'bg-emerald-100 text-emerald-800',
    in_progress: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800'
  };

  const statusLabels: Record<string, string> = {
    new: t('feedback.status.new'),
    reviewed: t('feedback.status.reviewed'),
    answered: t('feedback.status.answered'),
    in_progress: t('feedback.status.inProgress'),
    completed: t('feedback.status.completed'),
    rejected: t('feedback.status.rejected')
  };

  const getDisplayStatus = (submission: MyFeedbackSubmission) => {
    const status = submission.status;
    const hasReply = Boolean(submission.replySentAt);
    if (hasReply && (status === "new" || status === "reviewed")) {
      return "answered";
    }
    return status;
  };

  const titleLen = feedback.title.trim().length;
  const descriptionLen = feedback.description.trim().length;
  const titleMissingError = submitAttempted && titleLen === 0;
  const titleTooShortError = submitAttempted && titleLen > 0 && titleLen < TITLE_MIN;
  const descriptionMissingError = submitAttempted && descriptionLen === 0;
  const descriptionTooShortError =
    submitAttempted && descriptionLen > 0 && descriptionLen < DESCRIPTION_MIN;
  const titleError = titleMissingError || titleTooShortError;
  const descriptionError = descriptionMissingError || descriptionTooShortError;
  const requiredMark = <span className="text-destructive">*</span>;

  return (
    <div className="container py-8 md:py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-7 w-7 text-primary" />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">{t('feedback.title')}</h1>
          </div>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
            {t('feedback.subtitle')}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-7">
          <Card className="shadow-sm lg:col-span-5">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <p className="text-xs text-muted-foreground">
                  <span className="text-destructive">*</span> Required
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="type">{t('feedback.type')} {requiredMark}</Label>
                    <select
                      id="type"
                      value={feedback.type}
                      onChange={(e) => {
                        const nextType = e.target.value as any;
                        setFeedback({ ...feedback, type: nextType });
                      }}
                      disabled={isSubmitting}
                      required
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                    >
                      <option value="bug">{t('feedback.type.bug')}</option>
                      <option value="feature">{t('feedback.type.feature')}</option>
                      <option value="improvement">{t('feedback.type.improvement')}</option>
                      <option value="other">{t('feedback.type.other')}</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">
                      {t('feedback.title.label')} {requiredMark}{" "}
                      <span className="text-xs text-muted-foreground">(min {TITLE_MIN})</span>
                    </Label>
                    <Input
                      id="title"
                      placeholder={t('feedback.title.placeholder')}
                      value={feedback.title}
                      onChange={(e) => setFeedback({ ...feedback, title: e.target.value })}
                      disabled={isSubmitting}
                      maxLength={200}
                      minLength={TITLE_MIN}
                      required
                      aria-invalid={titleError}
                      aria-describedby={titleError ? "title-error" : undefined}
                    />
                    {titleError && (
                      <p id="title-error" className="text-xs text-destructive">
                        {titleMissingError
                          ? "This field is required."
                          : `Please enter at least ${TITLE_MIN} characters.`}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">{feedback.title.length}/200</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">
                    {t('feedback.description')} {requiredMark}{" "}
                    <span className="text-xs text-muted-foreground">(min {DESCRIPTION_MIN})</span>
                  </Label>
                  <Textarea
                    id="description"
                    placeholder={t('feedback.description.placeholder')}
                    value={feedback.description}
                    onChange={(e) => setFeedback({ ...feedback, description: e.target.value })}
                    disabled={isSubmitting}
                    rows={6}
                    className="resize-none"
                    maxLength={5000}
                    minLength={DESCRIPTION_MIN}
                    required
                    aria-invalid={descriptionError}
                    aria-describedby={descriptionError ? "description-error" : undefined}
                  />
                  {descriptionError && (
                    <p id="description-error" className="text-xs text-destructive">
                      {descriptionMissingError
                        ? "This field is required."
                        : `Please enter at least ${DESCRIPTION_MIN} characters.`}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{feedback.description.length}/5000</p>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t('feedback.sending') : t('feedback.send')}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  {t('feedback.thankYou')}
                </p>
              </form>

                {mySubmissions.length > 0 && (
                  <div className="pt-6 border-t mt-6">
                    <h2 className="text-base font-semibold mb-3">{t('feedback.history.title')}</h2>
                    <div className="space-y-4">
                      {mySubmissions.map((submission: MyFeedbackSubmission) => {
                        const shortRef = String(submission._id).slice(-6).toUpperCase();
                        const isOpen = openThreadId === submission._id;
                        return (
                          <Card key={submission._id} className="border-l-4 border-l-primary">
                            <Collapsible
                              open={isOpen}
                              onOpenChange={(next) => {
                                if (next) {
                                  setOpenThreadId(submission._id);
                                  setFollowUpDraft("");
                                } else if (openThreadId === submission._id) {
                                  setOpenThreadId(null);
                                  setFollowUpDraft("");
                                }
                              }}
                            >
                              <CardHeader className="py-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <CardTitle className="text-base">{submission.title}</CardTitle>
                                    <CardDescription className="mt-0.5 text-xs space-y-0.5">
                                      <span>{typeLabels[submission.type as keyof typeof typeLabels]}</span>
                                      <span className="block text-[10px] opacity-80">
                                        {t("feedback.thread.ref", { ref: shortRef })}
                                      </span>
                                    </CardDescription>
                                  </div>
                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    {(() => {
                                      const displayStatus = getDisplayStatus(submission);
                                      return (
                                        <span
                                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusColors[displayStatus as keyof typeof statusColors]}`}
                                        >
                                          {statusLabels[displayStatus as keyof typeof statusLabels]}
                                        </span>
                                      );
                                    })()}
                                    <CollapsibleTrigger asChild>
                                      <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1">
                                        {isOpen ? (
                                          <>
                                            <ChevronUp className="h-3.5 w-3.5" />
                                            {t("feedback.thread.hide")}
                                          </>
                                        ) : (
                                          <>
                                            <ChevronDown className="h-3.5 w-3.5" />
                                            {t("feedback.thread.show")}
                                          </>
                                        )}
                                      </Button>
                                    </CollapsibleTrigger>
                                  </div>
                                </div>
                              </CardHeader>
                              <CollapsibleContent>
                                {isOpen && (
                                  <CardContent className="pt-0 pb-4 space-y-4">
                                    {threadData === undefined && (
                                      <div className="flex justify-center py-6">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                                      </div>
                                    )}
                                    {threadData && threadData.feedbackId === submission._id && (
                                      <>
                                        <div className="space-y-3 max-h-[min(420px,50vh)] overflow-y-auto pr-1">
                                          {threadData.messages.map((m) => {
                                            const alignRight = m.authorKind === "user";
                                            return (
                                              <div
                                                key={m._id}
                                                className={`flex ${alignRight ? "justify-end" : "justify-start"}`}
                                              >
                                                <div
                                                  className={`max-w-[92%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                                                    alignRight
                                                      ? "bg-muted text-foreground"
                                                      : "bg-blue-50 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800 text-foreground"
                                                  }`}
                                                >
                                                  <p className="text-[10px] font-semibold opacity-80 mb-1">
                                                    {m.authorDisplayName}
                                                    {m.isSynthetic && m.authorKind === "admin"
                                                      ? ` · ${t("feedback.thread.legacy")}`
                                                      : ""}
                                                  </p>
                                                  {m.body}
                                                  <p className="text-[10px] opacity-60 mt-1.5">
                                                    {formatDateTimeEU(m.createdAt)}
                                                  </p>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        <div className="space-y-2 border-t pt-3">
                                          <Label htmlFor={`followup-${submission._id}`}>
                                            {t("feedback.thread.addMessage")}
                                          </Label>
                                          <Textarea
                                            id={`followup-${submission._id}`}
                                            value={followUpDraft}
                                            onChange={(e) => setFollowUpDraft(e.target.value)}
                                            rows={3}
                                            maxLength={5000}
                                            placeholder={t("feedback.thread.addMessagePlaceholder")}
                                            className="resize-none"
                                            disabled={followUpSending}
                                          />
                                          <Button
                                            type="button"
                                            size="sm"
                                            disabled={
                                              followUpSending || followUpDraft.trim().length === 0
                                            }
                                            onClick={async () => {
                                              const text = followUpDraft.trim();
                                              if (!text) return;
                                              setFollowUpSending(true);
                                              try {
                                                await addUserMessageMutation({
                                                  feedbackId: submission._id,
                                                  body: text,
                                                });
                                                setFollowUpDraft("");
                                                toast.success(t("feedback.thread.sent"));
                                              } catch (e: unknown) {
                                                toast.error(
                                                  e instanceof Error
                                                    ? e.message
                                                    : t("feedback.thread.sendFailed")
                                                );
                                              } finally {
                                                setFollowUpSending(false);
                                              }
                                            }}
                                          >
                                            {followUpSending
                                              ? t("feedback.thread.sending")
                                              : t("feedback.thread.send")}
                                          </Button>
                                        </div>
                                      </>
                                    )}
                                    <p className="text-[11px] text-muted-foreground">
                                      {t("feedback.submitted")}:{" "}
                                      {submission.submittedAt
                                        ? formatDateTimeEU(submission.submittedAt)
                                        : "Unknown"}
                                    </p>
                                  </CardContent>
                                )}
                              </CollapsibleContent>
                            </Collapsible>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:col-span-2 lg:self-start lg:sticky lg:top-24">
            <Card className="border bg-muted/20">
              <CardHeader>
                <div className="text-3xl mb-2">💡</div>
                <CardTitle className="text-lg">{t('feedback.suggestions.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t('feedback.suggestions.desc')}
                </p>
                <Link
                  href="/wishlist"
                  className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t("feedback.thread.wishlistLink")}
                </Link>
              </CardContent>
            </Card>

            <Card className="border bg-muted/20">
              <CardHeader>
                <div className="text-3xl mb-2">🐛</div>
                <CardTitle className="text-lg">{t('feedback.bugReports.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('feedback.bugReports.desc')}
                </p>
              </CardContent>
            </Card>

            <Card className="border bg-muted/20">
              <CardHeader>
                <div className="text-3xl mb-2">⭐</div>
                <CardTitle className="text-lg">{t('feedback.general.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('feedback.general.desc')}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
}
