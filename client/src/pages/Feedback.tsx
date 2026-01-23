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
import { MessageSquare } from "lucide-react";
import { useState } from "react";
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
  const mySubmissions = (useQuery(api.feedback.getMySubmissions) ?? []) as MyFeedbackSubmission[];

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
      toast.error("Please fix the highlighted fields");

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
            <h1 className="text-3xl md:text-4xl font-bold">{t('feedback.title')}</h1>
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

                {mySubmissions.length > 0 && (
                  <div className="pt-4 border-t">
                    <h2 className="text-base font-semibold mb-3">{t('feedback.history.title')}</h2>
                    <div className="space-y-4">
                      {mySubmissions.map((submission: MyFeedbackSubmission) => (
                        <Card key={submission._id} className="border-l-4 border-l-primary">
                          <CardHeader className="py-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-base">{submission.title}</CardTitle>
                                <CardDescription className="mt-0.5 text-xs">
                                  {typeLabels[submission.type as keyof typeof typeLabels]}
                                </CardDescription>
                              </div>
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
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0 pb-3">
                            <p className="text-sm text-muted-foreground mb-2">{submission.description}</p>
                            {submission.replyToUser && (
                              <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-0.5">
                                  {t("feedback.reply", { defaultValue: "Our Reply" })}:
                                </p>
                                <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                                  {submission.replyToUser}
                                </p>
                              </div>
                            )}
                            <p className="text-[11px] text-muted-foreground">
                              {t("feedback.submitted")}:{" "}
                              {submission.submittedAt ? formatDateTimeEU(submission.submittedAt) : "Unknown"}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:col-span-2 lg:self-start lg:sticky lg:top-24">
            <Card className="border bg-muted/20">
              <CardHeader>
                <div className="text-3xl mb-2">💡</div>
                <CardTitle className="text-lg">{t('feedback.suggestions.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('feedback.suggestions.desc')}
                </p>
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
