import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { MessageSquare, Eye, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { formatDateEU, formatDateTimeEU } from "@/lib/utils";
import { useState } from "react";
// Sidebar import removed


type FeedbackSubmissionDoc = Doc<"feedbackSubmissions">;
type FeedbackStatus = "new" | "reviewed" | "in_progress" | "completed" | "rejected";
type FeedbackType = "bug" | "feature" | "improvement" | "other";

export default function FeedbackManagement() {
  const { user, loading: authLoading } = useAuth();
  const submissions = useQuery(api.feedback.getAllSubmissions) as FeedbackSubmissionDoc[] | undefined;
  const submissionsLoading = submissions === undefined;
  
  const updateStatusMutation = useMutation(api.feedback.updateStatus);
  const deleteFeedbackMutation = useMutation(api.feedback.deleteFeedback);
  
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackSubmissionDoc | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [currentStatus, setCurrentStatus] = useState<FeedbackStatus>('new');

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
        adminNotes: adminNotes || undefined
      });
      toast.success('Feedback updated successfully');
      // Update selectedFeedback with new values to reflect changes in dialog
      setSelectedFeedback({
        ...selectedFeedback,
        status: currentStatus,
        adminNotes: adminNotes
      });
    } catch (error: any) {
      console.error('Update error:', error);
      toast.error(error?.message || 'Failed to update feedback');
    }
  };

  const handleDelete = async (id: Id<"feedbackSubmissions">) => {
    if (!confirm('Are you sure you want to delete this feedback?')) return;
    
    try {
      await deleteFeedbackMutation({ id });
      toast.success('Feedback deleted successfully');
    } catch (error) {
      toast.error('Failed to delete feedback');
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
      case 'in_progress': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
                    <TableCell className="font-medium">{feedback.title}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(feedback.status)}>
                        {feedback.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {feedback.submittedAt ? formatDateEU(feedback.submittedAt) : "N/A"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedFeedback(feedback);
                                setAdminNotes(feedback.adminNotes || '');
                                setCurrentStatus(feedback.status);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
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

                              {user.role === 'superadmin' ? (
                                <>
                                  <div>
                                    <h3 className="font-semibold mb-2">Status</h3>
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
                                        <SelectItem value="in_progress">In Progress</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="rejected">Rejected</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div>
                                    <h3 className="font-semibold mb-2">Admin Notes</h3>
                                    <Textarea
                                      value={adminNotes}
                                      onChange={(e) => setAdminNotes(e.target.value)}
                                      placeholder="Add notes about this feedback..."
                                      rows={4}
                                    />
                                    <Button
                                      className="mt-2"
                                      size="sm"
                                      onClick={handleSaveChanges}
                                    >
                                      Save Changes
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                  <p className="text-sm text-blue-800">👁️ <strong>Read-Only Mode:</strong> You can view feedback but cannot edit status or notes.</p>
                                </div>
                              )}

                              <div className="border-t pt-4">
                                <h3 className="font-semibold mb-3">Comments & History</h3>
                                <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto mb-4">
                                  <p className="text-sm text-muted-foreground text-center py-4">Comments feature coming soon...</p>
                                </div>
                              </div>
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
