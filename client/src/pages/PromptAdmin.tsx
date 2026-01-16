/**
 * Prompt Admin Page
 * Admin interface for managing AI prompts and templates
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatDateTimeEU } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
// Sidebar import removed
import { Sparkles, History, Eye, RotateCcw, Trash2 } from "lucide-react";
import { Link } from "wouter";

type PromptKey =
  | "default"
  | "feedback_reply_system"
  | "support_knowledge_facts"
  | "support_knowledge_tone"
  | "support_knowledge_future";

const PROMPT_OPTIONS: Array<{ key: PromptKey; label: string; hint: string }> = [
  {
    key: "default",
    label: "Chat Prompt (default)",
    hint: "System prompt for AI chat interactions (AI Learn Buddy).",
  },
  {
    key: "feedback_reply_system",
    label: "Feedback Reply – System Prompt",
    hint: "System instructions for generating a support-style reply draft for user feedback.",
  },
  {
    key: "support_knowledge_facts",
    label: "Support Knowledge – Facts (verified)",
    hint: "Verified product facts. Highest priority for support replies.",
  },
  {
    key: "support_knowledge_tone",
    label: "Support Knowledge – Tone & Wording",
    hint: "Tone guidelines and canonical naming. No promises, no hype.",
  },
  {
    key: "support_knowledge_future",
    label: "Support Knowledge – Future Plans (defensive)",
    hint: "Roadmap / plans. Must always be phrased defensively (no ETA, no guarantees).",
  },
];

export default function PromptAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [promptName, setPromptName] = useState<PromptKey>("default");

  const currentPrompt = useQuery(api.admin.getChatPrompt, { name: promptName });
  const promptHistory = useQuery(api.admin.getChatPromptHistory, { name: promptName, limit: 50 });
  const updatePromptMutation = useMutation(api.admin.updateChatPrompt);
  const restorePromptMutation = useMutation(api.admin.restoreChatPromptVersion);
  const deletePromptMutation = useMutation(api.admin.deleteChatPromptVersion);
  
  const [systemPrompt, setSystemPrompt] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<any>(null);
  const [restoreVersion, setRestoreVersion] = useState<Id<"chatPromptHistory"> | null>(null);
  const [deleteVersion, setDeleteVersion] = useState<Id<"chatPromptHistory"> | null>(null);

  // Load current prompt when available
  useEffect(() => {
    // `currentPrompt` is either: undefined (loading), null (not created yet), or a prompt doc.
    if (currentPrompt === undefined) return;
    setSystemPrompt(currentPrompt?.content || "");
  }, [currentPrompt]);

  // Reset description when switching prompt types (helps keep history descriptions relevant)
  useEffect(() => {
    setDescription("");
  }, [promptName]);

  const handleSave = async () => {
    if (!systemPrompt.trim()) {
      toast.error("System prompt cannot be empty");
      return;
    }

    setIsLoading(true);
    try {
      await updatePromptMutation({
        name: promptName,
        content: systemPrompt,
        description: description.trim() || undefined,
      });
      
      toast.success("Prompt saved successfully");
      setDescription(""); // Clear description after save
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast.error("Failed to save prompt");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreVersion) return;
    
    setIsLoading(true);
    try {
      await restorePromptMutation({ historyId: restoreVersion });
      toast.success("Version restored successfully");
      setRestoreVersion(null);
    } catch (error) {
      console.error("Error restoring version:", error);
      toast.error("Failed to restore version");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteVersion) return;
    
    setIsLoading(true);
    try {
      await deletePromptMutation({ historyId: deleteVersion });
      toast.success("Version deleted successfully");
      setDeleteVersion(null);
    } catch (error) {
      console.error("Error deleting version:", error);
      toast.error("Failed to delete version");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || currentPrompt === undefined || promptHistory === undefined) {
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

  const isSuperadmin = user.role === 'superadmin';

  return (
    <div className="flex flex-col h-full">
        <header className="border-b bg-card">
          <div className="container py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">Prompt Administration</h1>
              </div>
              <div className="flex gap-2">
                <Link href="/admin">
                  <Button variant="outline" size="sm">
                    Back to Admin Panel
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="container py-8">
          <div className="max-w-6xl mx-auto">
            <Tabs defaultValue="editor" className="w-full">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="editor">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Editor
                </TabsTrigger>
                <TabsTrigger value="history">
                  <History className="h-4 w-4 mr-2" />
                  Version History ({promptHistory.length})
                </TabsTrigger>
              </TabsList>

              {/* Editor Tab */}
              <TabsContent value="editor" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      System Prompt
                      {user.role === 'admin' && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold">👁️ Read-Only</span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Configure and version AI prompts (chat + support reply + knowledge blocks)
                      {user.role === 'admin' && ' (View only - no edit permissions)'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <Label>Prompt Type</Label>
                        <Select
                          value={promptName}
                          onValueChange={(value) => setPromptName(value as PromptKey)}
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PROMPT_OPTIONS.map((opt) => (
                              <SelectItem key={opt.key} value={opt.key}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-2">
                          {PROMPT_OPTIONS.find((o) => o.key === promptName)?.hint}
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="system-prompt">
                          Prompt Content *
                        </Label>
                        <Textarea
                          id="system-prompt"
                          value={systemPrompt}
                          onChange={(e) => setSystemPrompt(e.target.value)}
                          placeholder="Enter system prompt..."
                          rows={15}
                          className="font-mono text-sm mt-2"
                          disabled={!isSuperadmin}
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                          This content is stored in Convex and takes effect immediately for new generations that use this prompt.
                        </p>
                      </div>

                      {isSuperadmin && (
                        <div>
                          <Label htmlFor="description">
                            Description of Changes (Optional)
                          </Label>
                          <Input
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g., Made tone more friendly, Added context about Serbian grammar..."
                            className="mt-2"
                          />
                          <p className="text-xs text-muted-foreground mt-2">
                            This helps track what changed in each version.
                          </p>
                        </div>
                      )}
                      
                      {isSuperadmin && (
                        <div className="flex justify-end gap-3 pt-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              if (currentPrompt) {
                                setSystemPrompt(currentPrompt.content || "");
                                setDescription("");
                              }
                            }}
                          >
                            Reset to Current
                          </Button>
                          <Button onClick={handleSave} disabled={isLoading}>
                            {isLoading ? "Saving..." : "Save Prompt"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Usage Tips</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                      <li>Use separate prompt types for chat, feedback replies, and knowledge blocks</li>
                      <li>Keep Product Facts strictly verified (avoid unconfirmed claims)</li>
                      <li>Keep Future Plans defensive (no ETA, no guarantees)</li>
                      <li>Be specific about the AI's role and constraints</li>
                      <li>Add a description when saving to track changes over time</li>
                      <li>Changes take effect immediately for new chat sessions and feedback reply generation</li>
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Version History</CardTitle>
                    <CardDescription>
                      View and restore previous versions for the selected prompt type
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {promptHistory.length === 0 ? (
                      <div className="text-center py-12">
                        <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No version history yet</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date & Time</TableHead>
                            <TableHead>Changed By</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {promptHistory.map((version: any) => (
                            <TableRow key={version._id}>
                              <TableCell className="font-medium">
                                {formatDateTimeEU(version.updatedAt)}
                              </TableCell>
                              <TableCell>{version.updatedByName}</TableCell>
                              <TableCell>
                                {version.description ? (
                                  <span className="text-sm">{version.description}</span>
                                ) : (
                                  <span className="text-sm text-muted-foreground italic">No description</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPreviewVersion(version)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {isSuperadmin && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setRestoreVersion(version._id)}
                                      >
                                        <RotateCcw className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setDeleteVersion(version._id)}
                                      >
                                        <Trash2 className="h-4 w-4 text-red-600" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>

      {/* Preview Dialog */}
      <Dialog open={!!previewVersion} onOpenChange={() => setPreviewVersion(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version Preview</DialogTitle>
            <DialogDescription>
              {previewVersion && (
                <>
                  Saved on {formatDateTimeEU(previewVersion.updatedAt)} by {previewVersion.updatedByName}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {previewVersion?.description && (
              <div>
                <Label>Description</Label>
                <p className="text-sm mt-1">{previewVersion.description}</p>
              </div>
            )}
            <div>
              <Label>Prompt Content</Label>
              <Textarea
                value={previewVersion?.content || ""}
                readOnly
                rows={20}
                className="font-mono text-sm mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewVersion(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={!!restoreVersion} onOpenChange={() => setRestoreVersion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this version?</AlertDialogTitle>
            <AlertDialogDescription>
              This will set this version as the current active prompt. The current version will be saved to history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>
              Restore Version
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteVersion} onOpenChange={() => setDeleteVersion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this version?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This version will be permanently removed from the history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete Version
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
