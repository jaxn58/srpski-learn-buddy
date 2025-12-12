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
import { useAuth } from "@/_core/hooks/useAuth";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Sidebar } from "@/components/Sidebar";
import { Sparkles, History, Eye, RotateCcw, Trash2 } from "lucide-react";
import { Link } from "wouter";

export default function PromptAdmin() {
  const { user, loading: authLoading } = useAuth();
  const currentPrompt = useQuery(api.admin.getChatPrompt, { name: "default" });
  const promptHistory = useQuery(api.admin.getChatPromptHistory, { name: "default", limit: 50 });
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
    if (currentPrompt) {
      setSystemPrompt(currentPrompt.content || "");
    }
  }, [currentPrompt]);

  const handleSave = async () => {
    if (!systemPrompt.trim()) {
      toast.error("System prompt cannot be empty");
      return;
    }

    setIsLoading(true);
    try {
      await updatePromptMutation({
        name: "default",
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 md:ml-64 w-full flex flex-col">
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
                      Configure the AI system prompt for chat interactions
                      {user.role === 'admin' && ' (View only - no edit permissions)'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="system-prompt">
                          System Prompt for AI Chat *
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
                          This prompt defines the AI's behavior and personality in chat interactions.
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
                      <li>System prompts define the AI's behavior and personality</li>
                      <li>Be specific about the AI's role and capabilities</li>
                      <li>Test prompts thoroughly before deploying to production</li>
                      <li>Add a description when saving to track changes over time</li>
                      <li>Changes take effect immediately for new chat sessions</li>
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
                      View and restore previous versions of the system prompt
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
                                {new Date(version.updatedAt).toLocaleString('de-DE', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
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
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewVersion} onOpenChange={() => setPreviewVersion(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version Preview</DialogTitle>
            <DialogDescription>
              {previewVersion && (
                <>
                  Saved on {new Date(previewVersion.updatedAt).toLocaleString('de-DE')} by {previewVersion.updatedByName}
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


