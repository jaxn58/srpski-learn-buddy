import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
// Sidebar import removed
import { MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { formatDateTimeEU } from "@/lib/utils";

type FeedbackSubmissionDoc = Doc<"feedbackSubmissions">;

export default function Feedback() {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState({ type: "other" as const, title: "", description: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitFeedbackMutation = useMutation(api.feedback.submit);
  const mySubmissions = (useQuery(api.feedback.getMySubmissions) ?? []) as FeedbackSubmissionDoc[];

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

    if (!feedback.type || !feedback.title || !feedback.description) {
      toast.error(t('feedback.error.fillFields'));
      return;
    }

    setIsSubmitting(true);

    try {
      await submitFeedbackMutation({
        type: feedback.type,
        title: feedback.title,
        description: feedback.description,
      });

      toast.success(t('feedback.success.title'), {
        description: t('feedback.success.desc'),
        duration: 5000,
      });

      setFeedback({ type: "other", title: "", description: "" });
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
    in_progress: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800'
  };

  const statusLabels: Record<string, string> = {
    new: t('feedback.status.new'),
    reviewed: t('feedback.status.reviewed'),
    in_progress: t('feedback.status.inProgress'),
    completed: t('feedback.status.completed'),
    rejected: t('feedback.status.rejected')
  };

  return (
    <div className="container py-12">
      <div className="max-w-2xl mx-auto">
        <div className="text-center space-y-4 mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <MessageSquare className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">{t('feedback.title')}</h1>
          </div>
          <p className="text-xl text-muted-foreground">
            {t('feedback.subtitle')}
          </p>
        </div>

        <Card className="border-2 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10">
            <CardTitle>{t('feedback.shareThoughts')}</CardTitle>
            <CardDescription>
              {t('feedback.shareThoughtsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="type">{t('feedback.type')}</Label>
                <select
                  id="type"
                  value={feedback.type}
                  onChange={(e) => setFeedback({ ...feedback, type: e.target.value as any })}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                >
                  <option value="bug">{t('feedback.type.bug')}</option>
                  <option value="feature">{t('feedback.type.feature')}</option>
                  <option value="improvement">{t('feedback.type.improvement')}</option>
                  <option value="other">{t('feedback.type.other')}</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">{t('feedback.title.label')}</Label>
                <Input
                  id="title"
                  placeholder={t('feedback.title.placeholder')}
                  value={feedback.title}
                  onChange={(e) => setFeedback({ ...feedback, title: e.target.value })}
                  disabled={isSubmitting}
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground">{feedback.title.length}/200</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('feedback.description')}</Label>
                <Textarea
                  id="description"
                  placeholder={t('feedback.description.placeholder')}
                  value={feedback.description}
                  onChange={(e) => setFeedback({ ...feedback, description: e.target.value })}
                  disabled={isSubmitting}
                  rows={8}
                  className="resize-none"
                  maxLength={5000}
                />
                <p className="text-xs text-muted-foreground">{feedback.description.length}/5000</p>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full bg-primary hover:bg-primary/90 text-lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? t('feedback.sending') : t('feedback.send')}
              </Button>

              <p className="text-sm text-center text-muted-foreground">
                {t('feedback.thankYou')}
              </p>
            </form>
          </CardContent>
        </Card>

        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <Card className="border-0 bg-gradient-to-br from-primary/5 to-secondary/5">
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

          <Card className="border-0 bg-gradient-to-br from-primary/5 to-secondary/5">
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

          <Card className="border-0 bg-gradient-to-br from-primary/5 to-secondary/5">
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

        {mySubmissions.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-bold mb-6">{t('feedback.history.title')}</h2>
            <div className="space-y-4">
              {mySubmissions.map((submission: FeedbackSubmissionDoc) => (
                <Card key={submission._id} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{submission.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {typeLabels[submission.type as keyof typeof typeLabels]}
                        </CardDescription>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[submission.status as keyof typeof statusColors]}`}>
                        {statusLabels[submission.status as keyof typeof statusLabels]}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">{submission.description}</p>
                    {submission.adminNotes && (
                      <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-1">
                          {t('feedback.adminNote') || 'Admin Note'}:
                        </p>
                        <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                          {submission.adminNotes}
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t("feedback.submitted")}: {submission.submittedAt ? formatDateTimeEU(submission.submittedAt) : "Unknown"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
