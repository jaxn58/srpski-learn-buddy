import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Sidebar } from "@/components/Sidebar";
import { MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Feedback() {
  const { user, loading } = useAuth();
  const [feedback, setFeedback] = useState({ type: "other" as const, title: "", description: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const feedbackMutation = trpc.feedback.submit.useMutation();
  const { data: mySubmissions = [] } = trpc.feedback.getMySubmissions.useQuery();

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Please log in</CardTitle>
              <CardDescription>You need to be logged in to send feedback</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!feedback.type || !feedback.title || !feedback.description) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);

    try {
      await feedbackMutation.mutateAsync({
        type: feedback.type,
        title: feedback.title,
        description: feedback.description,
      });

      toast.success("🎉 Thank you for your feedback!", {
        description: "Your feedback helps us improve Serbian AI Tutor.",
        duration: 5000,
      });

      setFeedback({ type: "other", title: "", description: "" });
      setIsSubmitting(false);
    } catch (error) {
      toast.error("Failed to send feedback. Please try again.");
      setIsSubmitting(false);
    }
  };

  const typeLabels: Record<string, string> = {
    bug: '🐛 Bug Report',
    feature: '✨ Feature Request',
    improvement: '💡 Improvement',
    other: '📝 Other'
  };

  const statusColors: Record<string, string> = {
    new: 'bg-yellow-100 text-yellow-800',
    reviewed: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800'
  };

  const statusLabels: Record<string, string> = {
    new: 'New',
    reviewed: 'Reviewed',
    in_progress: 'In Progress',
    completed: 'Completed',
    rejected: 'Rejected'
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1">
        <main className="container py-12">
          <div className="max-w-2xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <div className="flex items-center justify-center gap-3 mb-4">
                <MessageSquare className="h-8 w-8 text-primary" />
                <h1 className="text-4xl font-bold">Send us your Feedback</h1>
              </div>
              <p className="text-xl text-muted-foreground">
                Help us make our software better! Your feedback is invaluable in improving Serbian AI Tutor.
              </p>
            </div>

            <Card className="border-2 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10">
                <CardTitle>Share Your Thoughts</CardTitle>
                <CardDescription>
                  Tell us what you think about the course, features you would like to see, or any issues you have encountered.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="type">Feedback Type</Label>
                    <select
                      id="type"
                      value={feedback.type}
                      onChange={(e) => setFeedback({ ...feedback, type: e.target.value as any })}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                    >
                      <option value="bug">Bug Report</option>
                      <option value="feature">Feature Request</option>
                      <option value="improvement">Improvement Suggestion</option>
                      <option value="other">Other Feedback</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      placeholder="Brief title of your feedback"
                      value={feedback.title}
                      onChange={(e) => setFeedback({ ...feedback, title: e.target.value })}
                      disabled={isSubmitting}
                      maxLength={200}
                    />
                    <p className="text-xs text-muted-foreground">{feedback.title.length}/200</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Share your thoughts, suggestions, or report any issues..."
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
                    {isSubmitting ? "Sending..." : "Send Feedback"}
                  </Button>

                  <p className="text-sm text-center text-muted-foreground">
                    We read and value every piece of feedback. Thank you for helping us improve!
                  </p>
                </form>
              </CardContent>
            </Card>

            <div className="mt-12 grid md:grid-cols-3 gap-6">
              <Card className="border-0 bg-gradient-to-br from-primary/5 to-secondary/5">
                <CardHeader>
                  <div className="text-3xl mb-2">💡</div>
                  <CardTitle className="text-lg">Suggestions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Have an idea for a new feature? We would love to hear it!
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 bg-gradient-to-br from-primary/5 to-secondary/5">
                <CardHeader>
                  <div className="text-3xl mb-2">🐛</div>
                  <CardTitle className="text-lg">Bug Reports</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Found a bug? Let us know so we can fix it quickly.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 bg-gradient-to-br from-primary/5 to-secondary/5">
                <CardHeader>
                  <div className="text-3xl mb-2">⭐</div>
                  <CardTitle className="text-lg">General Feedback</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Share your overall experience and how we can improve.
                  </p>
                </CardContent>
              </Card>
            </div>

            {mySubmissions.length > 0 && (
              <div className="mt-16">
                <h2 className="text-2xl font-bold mb-6">Your Feedback History</h2>
                <div className="space-y-4">
                  {mySubmissions.map((submission) => (
                    <Card key={submission.id} className="border-l-4 border-l-primary">
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
                        <p className="text-xs text-muted-foreground">
                          Submitted: {submission.submittedAt ? new Date(submission.submittedAt).toLocaleDateString('de-DE', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'Unknown'}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

