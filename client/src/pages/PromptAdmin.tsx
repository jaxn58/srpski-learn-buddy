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
import { formatDateTimeEU } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { 
  Sparkles, 
  History, 
  Eye, 
  RotateCcw, 
  Trash2, 
  Loader2, 
  XCircle, 
  HelpCircle,
  ChevronRight,
  FileText,
  Save,
  Undo2
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

type PromptKey = string;

interface PromptOption {
  key: PromptKey;
  label: string;
  hint: string;
}

interface PromptCategory {
  category: string;
  items: PromptOption[];
}

const PROMPT_CATEGORIES: PromptCategory[] = [
  {
    category: "Content Studio",
    items: [
      {
        key: "cs_unit_creator",
        label: "Unit Creator",
        hint: "System prompt for the AI that generates full unit markdown from scratch.",
      },
      {
        key: "cs_finding_fixer",
        label: "Finding Fixer",
        hint: "System prompt for the AI that fixes validator/lector findings in existing content.",
      },
      {
        key: "cs_lector",
        label: "Lector (Auditor)",
        hint: "Static instructions for the Lector/Auditor. Dynamic context (unit number, vocabulary) is added at runtime.",
      },
      {
        key: "cs_section_overview",
        label: "Section: Overview",
        hint: "Section-specific editing prompt for the Overview section.",
      },
      {
        key: "cs_section_vocabulary",
        label: "Section: Vocabulary",
        hint: "Section-specific editing prompt for the Vocabulary section.",
      },
      {
        key: "cs_section_grammar",
        label: "Section: Grammar",
        hint: "Section-specific editing prompt for the Grammar section.",
      },
      {
        key: "cs_section_phrases",
        label: "Section: Phrases",
        hint: "Section-specific editing prompt for the Phrases section.",
      },
      {
        key: "cs_section_exercises",
        label: "Section: Exercises",
        hint: "Section-specific editing prompt for the Interactive Test/Exercises section.",
      },
      {
        key: "cs_section_cultural",
        label: "Section: Cultural Note",
        hint: "Section-specific editing prompt for the Cultural Note section.",
      },
    ],
  },
  {
    category: "Chat & Support",
    items: [
      {
        key: "default",
        label: "Chat Prompt (AI Learn Buddy)",
        hint: "System prompt for AI chat interactions.",
      },
      {
        key: "feedback_reply_system",
        label: "Feedback Reply",
        hint: "System instructions for generating a support-style reply draft for user feedback.",
      },
      {
        key: "support_knowledge_facts",
        label: "Knowledge: Facts (verified)",
        hint: "Verified product facts. Highest priority for support replies.",
      },
      {
        key: "support_knowledge_tone",
        label: "Knowledge: Tone & Wording",
        hint: "Tone guidelines and canonical naming. No promises, no hype.",
      },
      {
        key: "support_knowledge_future",
        label: "Knowledge: Future Plans (defensive)",
        hint: "Roadmap / plans. Must always be phrased defensively (no ETA, no guarantees).",
      },
    ],
  },
];

const ALL_PROMPT_OPTIONS: PromptOption[] = PROMPT_CATEGORIES.flatMap(c => c.items);

export default function PromptAdmin() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [selectedKey, setSelectedKey] = useState<PromptKey>("default");
  
  const currentPrompt = useQuery(api.admin.getChatPrompt, { name: selectedKey });
  const allPrompts = useQuery(api.admin.getAllChatPrompts);
  const promptHistory = useQuery(api.admin.getChatPromptHistory, { name: selectedKey, limit: 50 });
  
  const updatePromptMutation = useMutation(api.admin.updateChatPrompt);
  const restorePromptMutation = useMutation(api.admin.restoreChatPromptVersion);
  const deletePromptMutation = useMutation(api.admin.deleteChatPromptVersion);
  
  const [systemPrompt, setSystemPrompt] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  const [previewVersion, setPreviewVersion] = useState<any>(null);
  const [restoreVersion, setRestoreVersion] = useState<Id<"chatPromptHistory"> | null>(null);
  const [deleteVersion, setDeleteVersion] = useState<Id<"chatPromptHistory"> | null>(null);

  // Load current prompt when available
  useEffect(() => {
    if (currentPrompt === undefined) return;
    setSystemPrompt(currentPrompt?.content || "");
  }, [currentPrompt]);

  // Reset description when switching prompt types
  useEffect(() => {
    setDescription("");
    setShowHistory(false);
  }, [selectedKey]);

  const handleSave = async () => {
    if (!systemPrompt.trim()) {
      toast.error(t("admin.prompt.toastEmpty"));
      return;
    }

    setIsLoading(true);
    try {
      await updatePromptMutation({
        name: selectedKey,
        content: systemPrompt,
        description: description.trim() || undefined,
      });
      
      toast.success(t("admin.prompt.toastSaved"));
      setDescription("");
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast.error(t("admin.prompt.toastSaveFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreVersion) return;
    setIsLoading(true);
    try {
      await restorePromptMutation({ historyId: restoreVersion });
      toast.success(t("admin.prompt.toastRestored"));
      setRestoreVersion(null);
    } catch (error) {
      console.error("Error restoring version:", error);
      toast.error(t("admin.prompt.toastRestoreFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteVersion) return;
    setIsLoading(true);
    try {
      await deletePromptMutation({ historyId: deleteVersion });
      toast.success(t("admin.prompt.toastDeleted"));
      setDeleteVersion(null);
    } catch (error) {
      console.error("Error deleting version:", error);
      toast.error(t("admin.prompt.toastDeleteFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || allPrompts === undefined) {
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
            <CardTitle>{t("admin.common.accessDenied.title")}</CardTitle>
            <CardDescription>{t("admin.common.accessDenied.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button>{t("admin.common.goToDashboard")}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSuperadmin = user.role === 'superadmin';
  const selectedOption = ALL_PROMPT_OPTIONS.find(o => o.key === selectedKey);

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">Prompt Administration</h1>
            <p className="text-xs text-muted-foreground mt-1">Manage AI instructions and knowledge base</p>
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

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: Prompt List */}
        <aside className="w-80 border-r bg-muted/30 overflow-y-auto p-4 shrink-0">
          <div className="space-y-4">
            {PROMPT_CATEGORIES.map((cat) => (
              <div key={cat.category}>
                <Label className="px-2 mb-2 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {cat.category}
                </Label>
                <div className="space-y-0.5">
                  {cat.items.map((opt) => {
                    const exists = allPrompts?.some(p => p.name === opt.key);
                    const isActive = selectedKey === opt.key;

                    return (
                      <button
                        key={opt.key}
                        onClick={() => setSelectedKey(opt.key)}
                        className={cn(
                          "w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-all group",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                            : "hover:bg-muted text-foreground"
                        )}
                      >
                        <div className={cn(
                          "mt-0.5 shrink-0",
                          isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"
                        )}>
                          {exists ? <FileText className="h-4 w-4" /> : <XCircle className="h-4 w-4 opacity-50" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{opt.label}</div>
                          <div className={cn(
                            "text-[10px] line-clamp-1 mt-0.5",
                            isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                          )}>
                            {opt.hint}
                          </div>
                        </div>
                        {isActive && <ChevronRight className="h-4 w-4 mt-1 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Main Content: Editor */}
        <main className="flex-1 flex flex-col overflow-hidden bg-background">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Editor Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">{selectedOption?.label}</h2>
                  <p className="text-muted-foreground mt-1">{selectedOption?.hint}</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant={showHistory ? "secondary" : "outline"} 
                    size="sm"
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    <History className="h-4 w-4 mr-2" />
                    {showHistory ? "Show Editor" : `History (${promptHistory?.length || 0})`}
                  </Button>
                </div>
              </div>

              {!showHistory ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Editor Card */}
                  <Card className="border-2 shadow-sm">
                    <CardHeader className="pb-3 border-b bg-muted/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prompt Status:</Label>
                            {currentPrompt ? (
                              <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-bold uppercase">Active</span>
                            ) : (
                              <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold uppercase">Not configured</span>
                            )}
                          </div>
                        </div>
                        {user.role === 'admin' && (
                          <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold uppercase">👁️ Read-Only</span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="bg-amber-50/50 border-b border-amber-100 p-3">
                        <p className="text-[11px] text-amber-800 flex items-center gap-2 leading-relaxed">
                          <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            <strong>Best Practice:</strong> System instructions should preferably be written in <strong>English</strong>. 
                            The output language for the user is controlled dynamically by the system.
                          </span>
                        </p>
                      </div>
                      <Textarea
                        id="system-prompt"
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        placeholder="Enter system prompt here..."
                        className="min-h-[500px] border-none focus-visible:ring-0 font-mono text-sm p-6 resize-none leading-relaxed"
                        disabled={!isSuperadmin}
                      />
                    </CardContent>
                    <CardFooter className="flex items-center justify-between p-4 border-t bg-muted/5">
                      <div className="flex-1 max-w-md">
                        <Input
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="What was changed? (Optional)"
                          className="h-9 text-sm"
                          disabled={!isSuperadmin}
                        />
                      </div>
                      <div className="flex gap-3">
                        {isSuperadmin && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (currentPrompt) {
                                  setSystemPrompt(currentPrompt.content || "");
                                  setDescription("");
                                }
                              }}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Reset
                            </Button>
                            <Button size="sm" onClick={handleSave} disabled={isLoading}>
                              {isLoading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4 mr-2" />
                              )}
                              Save
                            </Button>
                          </>
                        )}
                      </div>
                    </CardFooter>
                  </Card>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* History List */}
                  <Card>
                    <CardContent className="p-0">
                      {promptHistory && promptHistory.length === 0 ? (
                        <div className="text-center py-20">
                          <History className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                          <p className="text-muted-foreground">No history available for this prompt yet.</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="w-48">Date & Time</TableHead>
                              <TableHead className="w-40">User</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead className="text-right w-32">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {promptHistory?.map((version: any) => (
                              <TableRow key={version._id} className="group">
                                <TableCell className="text-xs font-medium">
                                  {formatDateTimeEU(version.updatedAt)}
                                </TableCell>
                                <TableCell className="text-xs">{version.updatedByName}</TableCell>
                                <TableCell className="text-xs">
                                  {version.description || <span className="text-muted-foreground italic">No description</span>}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => setPreviewVersion(version)}
                                      title="Preview"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    {isSuperadmin && (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => setRestoreVersion(version._id)}
                                          title="Restore"
                                        >
                                          <RotateCcw className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                          onClick={() => setDeleteVersion(version._id)}
                                          title="Delete"
                                        >
                                          <Trash2 className="h-4 w-4" />
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
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewVersion} onOpenChange={() => setPreviewVersion(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
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
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {previewVersion?.description && (
              <div className="bg-muted/50 p-3 rounded-lg">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Change Description</Label>
                <p className="text-sm mt-1">{previewVersion.description}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prompt Content</Label>
              <Textarea
                value={previewVersion?.content || ""}
                readOnly
                className="min-h-[400px] font-mono text-xs bg-muted/20 leading-relaxed"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewVersion(null)}>Close</Button>
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
            <AlertDialogAction onClick={handleRestore}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteVersion} onOpenChange={() => setDeleteVersion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this version?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The version will be permanently removed from history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex items-center p-6 pt-0", className)}>{children}</div>;
}
