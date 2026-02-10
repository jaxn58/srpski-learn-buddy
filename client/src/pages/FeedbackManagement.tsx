import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { MessageSquare, Eye, Trash2, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { formatDateEU, formatDateTimeEU } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
// Sidebar import removed


type FeedbackSubmissionDoc = Doc<"feedbackSubmissions">;
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
  
  const updateStatusMutation = useMutation(api.feedback.updateStatus);
  const deleteFeedbackMutation = useMutation(api.feedback.deleteFeedback);
  const regenerateAiAction = useAction(api.feedback.regenerateAiForFeedback);
  const sendAiReplyAction = useAction(api.feedback.sendAiReplyToUser);
  
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackSubmissionDoc | null>(null);
  const [dialogOpenId, setDialogOpenId] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<FeedbackStatus>('new');
  const [aiReplyText, setAiReplyText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSendBusy, setAiSendBusy] = useState(false);

  // Keep dialog data fresh when Convex query updates
  useEffect(() => {
    if (!selectedFeedback || !submissions) return;
    const updated = submissions.find((s: any) => s._id === selectedFeedback._id);
    if (updated) {
      setSelectedFeedback(updated);
      // Only overwrite aiReplyText if the admin hasn't started editing yet
      if (!aiReplyText.trim()) {
        const hasBeenSent = Boolean((updated as any).aiSentAt);
        const contentToShow = hasBeenSent 
          ? String((updated as any).aiSentContent ?? "") 
          : String((updated as any).aiDraftReply ?? "");
        setAiReplyText(contentToShow);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissions]);

  if (authLoading || submissionsLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to access this page.</CardDescription>
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
      await updateStatusMutation({
        id: selectedFeedback._id,
        status: currentStatus,
      });
      toast.success(t("admin.feedback.toast.updated"));
      // Update selectedFeedback with new values to reflect changes in dialog
      setSelectedFeedback({
        ...selectedFeedback,
        status: currentStatus,
      });
    } catch (error: any) {
      console.error('Update error:', error);
      toast.error(error?.message || t("admin.feedback.toast.updateFailed"));
    }
  };

  const handleDelete = async (id: Id<"feedbackSubmissions">) => {
    if (!confirm('Are you sure you want to delete this feedback?')) return;
    
    try {
      await deleteFeedbackMutation({ id });
      toast.success(t("admin.feedback.toast.deleted"));
    } catch (error) {
      toast.error(t("admin.feedback.toast.deleteFailed"));
    }
  };

  const getTypeIcon = (type: FeedbackType | string) => {
    switch (type) {
      case 'bug': return '🐛';
      case 'feature': return '✨';
      case 'improvement': return '🚀';
      default: return '💬';
    }
  };

  const getStatusColor = (status: FeedbackStatus | string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'reviewed': return 'bg-yellow-100 text-yellow-800';
      case 'answered': return 'bg-emerald-100 text-emerald-800';
      case 'in_progress': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDisplayStatus = (feedback: FeedbackSubmissionDoc): FeedbackStatus => {
    const status = feedback.status as FeedbackStatus;
    const hasReply = Boolean((feedback as any).aiSentAt);
    if (hasReply && (status === "new" || status === "reviewed")) {
      return "answered";
    }
    return status;
  };

  const getAdminNotesPreview = (notes: string) => {
    const normalized = String(notes).replace(/\s+/g, " ").trim();
    if (!normalized) return "";
    const MAX = 120;
    if (normalized.length <= MAX) return normalized;
    return normalized.slice(0, MAX).trimEnd() + "…";
  };

  const isDialogDirty = (feedback: FeedbackSubmissionDoc | null) => {
    if (!feedback) return false;
    const initialStatus = feedback.status as FeedbackStatus;
    const initialDraft = String((feedback as any).aiDraftReply ?? "");
    return (
      currentStatus !== initialStatus ||
      aiReplyText !== initialDraft
    );
  };

  return (
    <div className="flex flex-col h-full">
      <header className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Feedback Management</h1>
            </div>
            <Link href="/admin">
              <Button variant="outline" size="sm">
                Back to Admin Panel
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            User Feedback & Feature Requests
            {user.role === 'admin' && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold">👁️ Read-Only</span>
            )}
          </CardTitle>
          <CardDescription>
            Review and manage feedback submissions from users
            {user.role === 'admin' && ' (View only - no edit permissions)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No feedback submissions yet
                  </TableCell>
                </TableRow>
              ) : (
                submissions?.map((feedback: FeedbackSubmissionDoc) => (
                  <TableRow key={feedback._id}>
                    <TableCell>
                      <span className="text-lg">{getTypeIcon(feedback.type)}</span>
                    </TableCell>
                                    <TableCell>
                                      <div className="font-medium">{feedback.title}</div>
                                      {(feedback as any).aiInternalNote && getAdminNotesPreview((feedback as any).aiInternalNote) && (
                                        <div
                                          className="mt-1 text-xs text-muted-foreground"
                                          title={(feedback as any).aiInternalNote}
                                        >
                                          {getAdminNotesPreview((feedback as any).aiInternalNote)}
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        {(() => {
                                          const displayStatus = getDisplayStatus(feedback);
                                          return (
                                            <Badge className={getStatusColor(displayStatus)}>
                                              {displayStatus.replace('_', ' ')}
                                            </Badge>
                                          );
                                        })()}
                                        {(feedback as any).aiSentAt && (
                                          <span title="Reply sent to user">
                                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                    <TableCell>
                      {feedback.submittedAt ? formatDateTimeEU(feedback.submittedAt) : "N/A"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog
                          open={dialogOpenId === String(feedback._id)}
                          onOpenChange={(open) => {
                            if (open) {
                              const hasBeenSent = Boolean((feedback as any).aiSentAt);
                              setSelectedFeedback(feedback);
                              setDialogOpenId(String(feedback._id));
                              setCurrentStatus(getDisplayStatus(feedback));
                              setAiReplyText(hasBeenSent ? (feedback as any).aiSentContent || '' : (feedback as any).aiDraftReply || '');
                              return;
                            }

                            const active =
                              selectedFeedback && String(selectedFeedback._id) === String(feedback._id)
                                ? selectedFeedback
                                : null;

                            if (active && isDialogDirty(active)) {
                              const ok = confirm(
                                "You have unsaved changes. Do you want to close and discard them?"
                              );
                              if (!ok) return;
                            }

                            setDialogOpenId(null);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const hasBeenSent = Boolean((feedback as any).aiSentAt);
                                setSelectedFeedback(feedback);
                                setDialogOpenId(String(feedback._id));
                                setCurrentStatus(getDisplayStatus(feedback));
                                setAiReplyText(hasBeenSent ? (feedback as any).aiSentContent || '' : (feedback as any).aiDraftReply || '');
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent
                            className="!w-[95vw] !max-w-[1100px] sm:!max-w-[1100px] max-h-[85vh] overflow-y-auto"
                            onInteractOutside={(e) => {
                              if (selectedFeedback && String(selectedFeedback._id) === String(feedback._id) && isDialogDirty(selectedFeedback)) {
                                e.preventDefault();
                              }
                            }}
                            onEscapeKeyDown={(e) => {
                              if (selectedFeedback && String(selectedFeedback._id) === String(feedback._id) && isDialogDirty(selectedFeedback)) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <DialogHeader>
                              <DialogTitle>
                                {getTypeIcon(feedback.type)} {feedback.title}
                              </DialogTitle>
                              <DialogDescription>
                                Submitted on {feedback.submittedAt ? formatDateTimeEU(feedback.submittedAt) : "N/A"}
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="space-y-4">
                              <div>
                                <h3 className="font-semibold mb-2">Description</h3>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                  {feedback.description}
                                </p>
                              </div>

                              {user.role === 'superadmin' || user.role === 'admin' ? (
                                <>
                                  <div>
                                    <h3 className="font-semibold mb-2">Status</h3>
                                    <div className="flex gap-2">
                                      <Select
                                        value={currentStatus}
                                        onValueChange={(value: FeedbackStatus) => setCurrentStatus(value)}
                                      >
                                        <SelectTrigger>
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
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleSaveChanges}
                                        disabled={currentStatus === (selectedFeedback?.status as FeedbackStatus)}
                                      >
                                        Save Status
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="border-t pt-4">
                                    <h3 className="font-semibold mb-2">AI Assistant</h3>
                                    <div className="space-y-3">
                                      <div className="text-sm text-muted-foreground">
                                        <div>
                                          <span className="font-semibold text-foreground">AI Status:</span>{" "}
                                          {(selectedFeedback as any)?.aiStatus || "—"}
                                        </div>
                                        {(selectedFeedback as any)?.aiGeneratedAt && (
                                          <div>
                                            <span className="font-semibold text-foreground">Generated:</span>{" "}
                                            {formatDateTimeEU((selectedFeedback as any).aiGeneratedAt)}
                                          </div>
                                        )}
                                        {(selectedFeedback as any)?.aiError && (
                                          <div className="text-red-700">
                                            <span className="font-semibold">AI Error:</span>{" "}
                                            {String((selectedFeedback as any).aiError)}
                                          </div>
                                        )}
                                      </div>

                                      <div>
                                        <h4 className="font-semibold mb-2">Internal Note (Admin only)</h4>
                                        <div className="bg-gray-50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                                          {(selectedFeedback as any)?.aiInternalNote || "—"}
                                        </div>
                                      </div>

                                      <div>
                                        <h4 className="font-semibold mb-2">
                                          {(selectedFeedback as any)?.aiSentAt ? "Sent Reply" : "Draft Reply (editable)"}
                                        </h4>
                                        <Textarea
                                          value={aiReplyText}
                                          onChange={(e) => setAiReplyText(e.target.value)}
                                          placeholder="AI draft reply will appear here..."
                                          rows={6}
                                        />
                                        <div className="flex gap-2 mt-2">
                                          {!(selectedFeedback as any)?.aiSentAt && (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              disabled={aiBusy}
                                              onClick={async () => {
                                                if (!selectedFeedback) return;
                                                try {
                                                  setAiBusy(true);
                                                  await regenerateAiAction({ feedbackId: selectedFeedback._id });
                                                  toast.success(t("admin.feedback.toast.aiRegenerated"));
                                                } catch (e: any) {
                                                  toast.error(e?.message || t("admin.feedback.toast.aiRegenerateFailed"));
                                                } finally {
                                                  setAiBusy(false);
                                                }
                                              }}
                                            >
                                              {aiBusy ? "Regenerating..." : "Regenerate AI"}
                                            </Button>
                                          )}

                                          <Button
                                            size="sm"
                                            disabled={aiSendBusy || !aiReplyText.trim()}
                                            onClick={async () => {
                                              if (!selectedFeedback) return;
                                              try {
                                                setAiSendBusy(true);
                                                const res: any = await sendAiReplyAction({
                                                  feedbackId: selectedFeedback._id,
                                                  replyText: aiReplyText.trim(),
                                                });
                                                if (res?.emailSent === false) {
                                                  toast.success(t("admin.feedback.toast.replyPostedTool.title"), {
                                                    description: t("admin.feedback.toast.replyPostedTool.desc", {
                                                      error: String(res?.emailError || "unknown"),
                                                    }),
                                                  });
                                                } else {
                                                  toast.success(t("admin.feedback.toast.replySent"));
                                                }
                                                // Close dialog after successful send
                                                setDialogOpenId(null);
                                              } catch (e: any) {
                                                toast.error(e?.message || t("admin.feedback.toast.replySendFailed"));
                                              } finally {
                                                setAiSendBusy(false);
                                              }
                                            }}
                                          >
                                            {aiSendBusy ? "Sending..." : (selectedFeedback as any)?.aiSentAt ? "Resend/Update Reply" : "Send to user"}
                                          </Button>
                                        </div>

                                        {(selectedFeedback as any)?.aiSentAt && (
                                          <p className="text-xs text-muted-foreground mt-2">
                                            Sent at {formatDateTimeEU((selectedFeedback as any).aiSentAt)}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                  <p className="text-sm text-blue-800">👁️ <strong>Read-Only Mode:</strong> You can view feedback but cannot edit status or notes.</p>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>

                        {user.role === 'superadmin' && (
                          <Button
                            variant="outline"
                            size="sm"
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
