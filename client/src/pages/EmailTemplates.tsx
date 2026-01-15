import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Mail, Eye, Trash2, Edit, Plus, CheckCircle, XCircle, ArrowLeft, Code, Eye as EyeIcon, MoreHorizontal, Copy, AlertTriangle, Type } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { formatDateEU } from "@/lib/utils";
import { useState, useMemo, useEffect, useRef } from "react";
// Sidebar import removed
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

type TemplateCategory = "transactional" | "subscription" | "marketing";
type EmailTemplateDoc = Doc<"emailTemplates">;

type ViewMode = "list" | "editor";
type SignatureCategory = "transactional" | "subscription" | "marketing";
type ContentTab = "wysiwyg" | "code" | "emailPreview";

const SIGNATURE_FOOTER_BLOCK = `\n<div style="margin-top:16px;padding-top:12px;border-top:1px solid #eee;">\n  {{EMAIL_SIGNATURE}}\n</div>\n`;

const EMAIL_SNIPPETS = [
  {
    key: "button",
    label: "Button (email-safe)",
    html: `<a href="{{LINK_URL}}" style="display:inline-block;background:#C41E3A;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:4px;font-weight:bold;">{{LINK_TEXT}}</a>`,
  },
  {
    key: "divider",
    label: "Divider",
    html: `<hr style="border:0;border-top:1px solid #eeeeee;margin:20px 0;" />`,
  },
  {
    key: "container",
    label: "600px container table",
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;">
        <tr>
          <td style="padding:20px;">
            <!-- content -->
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
  },
] as const;

function getVariableDescription(variable: string): string {
  // Short, high-signal descriptions (English UI copy to match existing admin UI).
  switch (variable) {
    case "EMAIL_SIGNATURE":
      return "Inserts the category signature (transactional/subscription/marketing) at this position.";
    case "USER_NAME":
      return "Recipient's display name.";
    case "USER_EMAIL":
      return "Recipient's email address.";
    case "ADMIN_EMAIL":
      return "Admin/support email address (used in admin notifications).";
    case "ADMIN_URL":
      return "Link to the admin area.";
    case "SIGNUP_URL":
      return "Link to the sign-up page.";
    case "LOGIN_URL":
      return "Link to the login page.";
    case "CLERK_ID":
      return "Clerk user id (internal identifier from authentication).";
    case "CONFIRM_LINK":
      return "Double opt-in confirmation link (newsletter).";
    case "CONFIRMATION_LINK":
      return "Confirmation link (waitlist confirmation).";
    case "BETA_LAUNCH_NOTE":
      return "Optional note shown when a user did not opt into updates (waitlist).";
    case "FEEDBACK_TYPE":
      return "Feedback category/type selected by the user.";
    case "FEEDBACK_TITLE":
      return "Feedback title/summary.";
    case "FEEDBACK_DESCRIPTION":
      return "Full feedback text/details.";
    case "LINK_URL":
      return "URL for an email button/snippet link.";
    case "LINK_TEXT":
      return "Visible label text for an email button/snippet link.";
    default: {
      if (variable.endsWith("_URL")) return "A URL used in this email flow.";
      if (variable.endsWith("_EMAIL")) return "An email address used in this email flow.";
      return "Variable used by this email flow.";
    }
  }
}

export default function EmailTemplates() {
  const { user, loading: authLoading } = useAuth();
  const templates = useQuery(api.emailTemplates.getAll) as EmailTemplateDoc[] | undefined;
  const templatesLoading = templates === undefined;
  const runId = "email-design-fix";
  
  const upsertMutation = useMutation(api.emailTemplates.upsert);
  const deleteMutation = useMutation(api.emailTemplates.remove);
  const upsertSignatureMutation = useMutation(api.emailTemplates.upsertSignature);
  const removeSignatureMutation = useMutation(api.emailTemplates.removeSignature);
  const sendTestEmailAction = useAction(api.email.sendTestEmail);
  
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplateDoc | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplateDoc | null>(null);
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});
  const [signaturesOpen, setSignaturesOpen] = useState(false);
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [testToEmail, setTestToEmail] = useState("");
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [contentTab, setContentTab] = useState<ContentTab>("wysiwyg");
  const [variableSearch, setVariableSearch] = useState("");

  const subjectInputRef = useRef<HTMLInputElement | null>(null);
  const codeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [signatureForm, setSignatureForm] = useState<Record<SignatureCategory, { htmlContent: string; isActive: boolean }>>({
    transactional: { htmlContent: "", isActive: true },
    subscription: { htmlContent: "", isActive: true },
    marketing: { htmlContent: "", isActive: true },
  });
  
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    htmlContent: "",
    description: "",
    category: "transactional" as TemplateCategory,
    isActive: true,
    variables: [] as string[],
  });

  const signatures = useQuery(api.emailTemplates.getAllSignatures) as any[] | undefined;
  const signatureForCategory = useQuery(api.emailTemplates.getSignatureByCategory, {
    category: formData.category as SignatureCategory,
  }) as any | undefined;

  useEffect(() => {
    if (!signatures) return;
    const next: Record<SignatureCategory, { htmlContent: string; isActive: boolean }> = {
      transactional: { htmlContent: "", isActive: true },
      subscription: { htmlContent: "", isActive: true },
      marketing: { htmlContent: "", isActive: true },
    };
    for (const s of signatures) {
      if (s?.category && s.category in next) {
        next[s.category as SignatureCategory] = {
          htmlContent: s.htmlContent || "",
          isActive: s.isActive ?? true,
        };
      }
    }
    setSignatureForm(next);
  }, [signatures]);

  // Tiptap editor instance
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start typing your email HTML content...',
      }),
    ],
    content: formData.htmlContent,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (html !== formData.htmlContent) {
        setFormData(prev => ({ ...prev, htmlContent: html }));
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[400px] p-4',
      },
    },
  });

  // Update editor content when formData changes externally (but not from editor updates)
  useEffect(() => {
    if (editor && formData.htmlContent !== editor.getHTML()) {
      editor.commands.setContent(formData.htmlContent);
    }
  }, [formData.htmlContent, editor]);

  // Cleanup editor on unmount
  useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy();
      }
    };
  }, [editor]);


  // Auto-detect variables from content
  const detectedVariables = useMemo(() => {
    const variableRegex = /\{\{(\w+)\}\}/g;
    const foundVariables = new Set<string>();
    let match;
    
    if (formData.subject) {
      while ((match = variableRegex.exec(formData.subject)) !== null) {
        foundVariables.add(match[1]);
      }
    }
    if (formData.htmlContent) {
      while ((match = variableRegex.exec(formData.htmlContent)) !== null) {
        foundVariables.add(match[1]);
      }
    }
    
    return Array.from(foundVariables);
  }, [formData.subject, formData.htmlContent]);

  const testVariableKeys = useMemo(() => {
    return detectedVariables.filter((v) => v !== "EMAIL_SIGNATURE").sort();
  }, [detectedVariables]);

  // Update preview variables when new variables are detected
  useEffect(() => {
    setPreviewVariables(prev => {
      const newVars: Record<string, string> = { ...prev };
      detectedVariables.forEach(v => {
        if (!newVars[v]) {
          newVars[v] = `Sample ${v.replace(/_/g, ' ')}`;
        }
      });
      return newVars;
    });
  }, [detectedVariables]);

  // Replace variables in HTML content for preview
  const previewHtml = useMemo(() => {
    if (!formData.htmlContent) return "";
    let html = formData.htmlContent;
    // Replace variables with sample data
    Object.keys(previewVariables).forEach(key => {
      if (key === "EMAIL_SIGNATURE") return;
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      html = html.replace(regex, previewVariables[key]);
    });
    const signatureHtml = signatureForCategory?.isActive ? signatureForCategory?.htmlContent : "";
    html = html.replace(/\{\{EMAIL_SIGNATURE\}\}/g, signatureHtml || "");
    return html;
  }, [formData.htmlContent, previewVariables, signatureForCategory]);

  const availableVariables = useMemo(() => {
    const set = new Set<string>();
    (templates || [])
      .filter((t) => t.category === formData.category)
      .forEach((t) => {
      (t.variables || []).forEach((v: string) => set.add(v));
    });
    // Hide internal helper placeholder from "available" list; we handle it separately.
    set.delete("EMAIL_SIGNATURE");
    return Array.from(set).sort();
  }, [templates, formData.category]);

  const filteredAvailableVariables = useMemo(() => {
    const q = variableSearch.trim().toLowerCase();
    if (!q) return availableVariables;
    return availableVariables.filter((v) => v.toLowerCase().includes(q));
  }, [availableVariables, variableSearch]);

  const hasSignaturePlaceholder = (formData.htmlContent || "").includes("{{EMAIL_SIGNATURE}}");

  const variableInfo = useMemo(() => {
    const getExample = (v: string) => {
      // Prefer current preview values if present.
      const fromPreview = previewVariables[v];
      if (fromPreview) return fromPreview;

      // Best-effort fallbacks.
      if (v === "USER_EMAIL") return user?.email || "you@example.com";
      if (v === "USER_NAME") return user?.name || "Friend";
      if (v.endsWith("_URL")) return "https://example.com/path";
      if (v.endsWith("_EMAIL")) return "support@example.com";
      if (v === "CLERK_ID") return "user_test_clerk_id";
      if (v.includes("CONFIRM")) return "https://example.com/confirm?token=<token>";
      return `Sample ${v.replace(/_/g, " ")}`;
    };

    return (v: string) => ({
      description: getVariableDescription(v),
      example: getExample(v),
    });
  }, [previewVariables, user?.email, user?.name]);

  const previewSubject = useMemo(() => {
    if (!formData.subject) return "";
    let subject = formData.subject;
    Object.keys(previewVariables).forEach((key) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      subject = subject.replace(regex, previewVariables[key]);
    });
    return subject;
  }, [formData.subject, previewVariables]);

  if (authLoading || templatesLoading) {
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

  const handleEdit = (template: EmailTemplateDoc) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      htmlContent: template.htmlContent,
      description: template.description || "",
      category: template.category,
      isActive: template.isActive,
      variables: template.variables || [],
    });
    // Initialize preview variables with sample data
    const vars: Record<string, string> = {};
    (template.variables || []).forEach((v: string) => {
      vars[v] = `Sample ${v.replace(/_/g, ' ')}`;
    });
    setPreviewVariables(vars);
    setViewMode("editor");
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setFormData({
      name: "",
      subject: "",
      htmlContent: `<div>\n  <!-- Footer (auto-injected) -->\n  <div style=\"margin-top:16px;padding-top:12px;border-top:1px solid #eee;\">\n    {{EMAIL_SIGNATURE}}\n  </div>\n</div>`,
      description: "",
      category: "transactional",
      isActive: true,
      variables: [],
    });
    setPreviewVariables({});
    setViewMode("editor");
  };

  const buildDefaultTestVariables = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";

    const next: Record<string, string> = {};
    testVariableKeys.forEach((k) => {
      next[k] = previewVariables[k] || `Sample ${k.replace(/_/g, " ")}`;
    });

    // User defaults
    if (user?.email) next.USER_EMAIL = next.USER_EMAIL || user.email;
    if (user?.name) next.USER_NAME = next.USER_NAME || user.name;

    // Common URL defaults (best-effort)
    if (origin) {
      if (next.SIGNUP_URL !== undefined) next.SIGNUP_URL = next.SIGNUP_URL || `${origin}/sign-up`;
      if (next.LOGIN_URL !== undefined) next.LOGIN_URL = next.LOGIN_URL || `${origin}/sign-in`;
      if (next.ADMIN_URL !== undefined) next.ADMIN_URL = next.ADMIN_URL || `${origin}/admin`;
      if (next.CONFIRM_LINK !== undefined) next.CONFIRM_LINK = next.CONFIRM_LINK || `${origin}/newsletter/optin/confirm?token=<test-token>`;
      if (next.CONFIRMATION_LINK !== undefined) next.CONFIRMATION_LINK = next.CONFIRMATION_LINK || `${origin}/waitlist/confirm?token=<test-token>`;
    }

    if (next.CLERK_ID !== undefined) next.CLERK_ID = next.CLERK_ID || "user_test_clerk_id";

    return next;
  };

  const openTestEmailDialog = () => {
    setTestToEmail(user?.email || "");
    setTestVariables(buildDefaultTestVariables());
    setTestEmailOpen(true);
  };

  const handleSendTestEmail = async () => {
    if (!formData.name) {
      toast.error("Please save the template first (Template Name is required).");
      return;
    }
    if (!testToEmail || !testToEmail.includes("@")) {
      toast.error("Please enter a valid recipient email.");
      return;
    }

    setIsSendingTestEmail(true);
    try {
      const vars: Record<string, string | number> = { ...testVariables };
      // Prefer the chosen recipient for USER_EMAIL if present
      vars.USER_EMAIL = testToEmail;

      const result = await sendTestEmailAction({
        templateName: formData.name,
        to: testToEmail,
        variables: vars,
      });

      if (result?.success) {
        toast.success("Test email sent. Check your inbox.");
        setTestEmailOpen(false);
      } else {
        toast.error(result?.error || "Failed to send test email");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send test email");
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleSaveAndSendTestEmail = async () => {
    // Save first, then immediately send using defaults (single-click flow).
    if (!formData.name || !formData.subject || !formData.htmlContent) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!user?.email) {
      toast.error("No admin email found for test send.");
      return;
    }

    setIsSendingTestEmail(true);
    try {
      // Recompute variables like in handleSave
      const variableRegex = /\{\{(\w+)\}\}/g;
      const foundVariables = new Set<string>();
      let match;

      while ((match = variableRegex.exec(formData.subject)) !== null) {
        foundVariables.add(match[1]);
      }
      while ((match = variableRegex.exec(formData.htmlContent)) !== null) {
        foundVariables.add(match[1]);
      }

      const variables = Array.from(foundVariables);

      await upsertMutation({
        name: formData.name,
        subject: formData.subject,
        htmlContent: formData.htmlContent,
        description: formData.description || undefined,
        category: formData.category,
        isActive: formData.isActive,
        variables,
      });

      const defaultVars = buildDefaultTestVariables();
      const to = testToEmail || user.email;

      const vars: Record<string, string | number> = { ...defaultVars };
      vars.USER_EMAIL = to;

      const result = await sendTestEmailAction({
        templateName: formData.name,
        to,
        variables: vars,
      });

      if (result?.success) {
        toast.success("Saved and sent test email. Check your inbox.");
      } else {
        toast.error(result?.error || "Failed to send test email");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to save & send test email");
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  function insertBeforeClosingBody(html: string, snippet: string) {
    const idx = html.toLowerCase().lastIndexOf("</body>");
    if (idx === -1) return html + snippet;
    return html.slice(0, idx) + snippet + html.slice(idx);
  }

  function insertTextAtCursor(el: HTMLInputElement | HTMLTextAreaElement, text: string) {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + text + el.value.slice(end);
    const nextPos = start + text.length;
    return { next, nextPos };
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed (clipboard permission?)");
    }
  }

  function insertVariableIntoSubject(variable: string) {
    const token = `{{${variable}}}`;
    const el = subjectInputRef.current;
    if (!el) {
      setFormData((prev) => ({ ...prev, subject: `${prev.subject}${token}` }));
      return;
    }
    const { next, nextPos } = insertTextAtCursor(el, token);
    setFormData((prev) => ({ ...prev, subject: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(nextPos, nextPos);
    });
  }

  function insertTextIntoHtmlContent(text: string) {
    if (contentTab === "wysiwyg" && editor) {
      editor.chain().focus().insertContent(text).run();
      return;
    }

    if (contentTab === "code") {
      const el = codeTextareaRef.current;
      if (el) {
        const { next, nextPos } = insertTextAtCursor(el, text);
        setFormData((prev) => ({ ...prev, htmlContent: next }));
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(nextPos, nextPos);
        });
        return;
      }
    }

    // Fallback: append
    setFormData((prev) => ({ ...prev, htmlContent: `${prev.htmlContent}${text}` }));
  }

  function insertSignatureFooter() {
    if (hasSignaturePlaceholder) return;
    const next = insertBeforeClosingBody(formData.htmlContent || "", SIGNATURE_FOOTER_BLOCK);
    setFormData((prev) => ({ ...prev, htmlContent: next }));
    toast.success("Inserted signature placeholder");
  }

  const handleSave = async () => {
    if (!formData.name || !formData.subject || !formData.htmlContent) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      // Auto-detect variables from content using regex
      const variableRegex = /\{\{(\w+)\}\}/g;
      const foundVariables = new Set<string>();
      let match;
      
      while ((match = variableRegex.exec(formData.subject)) !== null) {
        foundVariables.add(match[1]);
      }
      while ((match = variableRegex.exec(formData.htmlContent)) !== null) {
        foundVariables.add(match[1]);
      }
      
      const variables = Array.from(foundVariables);

      await upsertMutation({
        name: formData.name,
        subject: formData.subject,
        htmlContent: formData.htmlContent,
        description: formData.description || undefined,
        category: formData.category,
        isActive: formData.isActive,
        variables,
      });

      toast.success(editingTemplate ? "Template updated successfully" : "Template created successfully");
      setViewMode("list");
      setEditingTemplate(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to save template");
    }
  };

  const handleDelete = async (id: Id<"emailTemplates">) => {
    if (!confirm('Are you sure you want to delete this template? This action cannot be undone.')) return;
    
    try {
      await deleteMutation({ id });
      toast.success('Template deleted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete template');
    }
  };

  const handleSaveSignature = async (category: SignatureCategory) => {
    try {
      const data = signatureForm[category];
      await upsertSignatureMutation({
        category,
        htmlContent: data.htmlContent,
        isActive: data.isActive,
      });
      toast.success(`Signature saved: ${category}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to save signature");
    }
  };

  const handleDeleteSignature = async (category: SignatureCategory) => {
    if (!confirm(`Delete signature for "${category}"?`)) return;
    try {
      await removeSignatureMutation({ category });
      toast.success(`Signature deleted: ${category}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete signature");
    }
  };

  const handlePreview = (template: EmailTemplateDoc) => {
    setPreviewTemplate(template);
    // Initialize preview variables with sample data
    const vars: Record<string, string> = {};
    template.variables?.forEach((v: string) => {
      vars[v] = `Sample ${v.replace(/_/g, ' ')}`;
    });
    setPreviewVariables(vars);
  };

  const getCategoryColor = (category: TemplateCategory) => {
    switch (category) {
      case 'transactional': return 'bg-blue-100 text-blue-800';
      case 'subscription': return 'bg-green-100 text-green-800';
      case 'marketing': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isSuperadmin = user.role === 'superadmin';

  // Editor View
  if (viewMode === "editor") {
    return (
      <div className="flex flex-col h-full">
          <header className="border-b bg-card">
            <div className="container py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setViewMode("list");
                      setEditingTemplate(null);
                    }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Templates
                  </Button>
                  <div className="flex items-center gap-2">
                    <Mail className="h-6 w-6 text-primary" />
                    <h1 className="text-xl font-bold">
                      {editingTemplate ? "Edit Template" : "Create New Template"}
                    </h1>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setViewMode("list")}>
                    Cancel
                  </Button>
                  {isSuperadmin && (
                    <Button variant="outline" onClick={openTestEmailDialog}>
                      Send Test Email
                    </Button>
                  )}
                  {isSuperadmin && (
                    <Button
                      variant="outline"
                      onClick={handleSaveAndSendTestEmail}
                      disabled={isSendingTestEmail}
                      title="Saves the template first, then sends a test email with default variables"
                    >
                      Save & Send Test Email
                    </Button>
                  )}
                  <Button onClick={handleSave}>
                    {editingTemplate ? "Update Template" : "Create Template"}
                  </Button>
                </div>
              </div>
            </div>
          </header>

          <Dialog open={testEmailOpen} onOpenChange={setTestEmailOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Send Test Email</DialogTitle>
                <DialogDescription>
                  This sends the <strong>saved</strong> version of the template (as it would be delivered), including signature injection.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Recipient</Label>
                  <Input
                    value={testToEmail}
                    onChange={(e) => setTestToEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tip: If you changed the template, click “Update/Create Template” first to test the latest version.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Variables</Label>
                  {testVariableKeys.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No variables detected in this template.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {testVariableKeys.map((k) => (
                        <div key={k} className="space-y-1">
                          <Label className="text-xs">{`{{${k}}}`}</Label>
                          <Input
                            value={testVariables[k] || ""}
                            onChange={(e) =>
                              setTestVariables((prev) => ({
                                ...prev,
                                [k]: e.target.value,
                              }))
                            }
                            placeholder={`Value for ${k}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setTestEmailOpen(false)} disabled={isSendingTestEmail}>
                    Cancel
                  </Button>
                  <Button onClick={handleSendTestEmail} disabled={isSendingTestEmail}>
                    {isSendingTestEmail ? "Sending..." : "Send"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <main className="flex-1 overflow-y-auto">
            <div className="container py-6">
              <div className="max-w-4xl mx-auto space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Template Details</CardTitle>
                        <CardDescription>Basic information about the email template</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="name">Template Name *</Label>
                            <Input
                              id="name"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              placeholder="e.g., beta-registration"
                              disabled={!!editingTemplate}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Unique identifier (cannot be changed after creation)
                            </p>
                          </div>
                          <div>
                            <Label htmlFor="category">Category *</Label>
                            <Select
                              value={formData.category}
                              onValueChange={(value) => setFormData({ ...formData, category: value as TemplateCategory })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="transactional">Transactional</SelectItem>
                                <SelectItem value="subscription">Subscription</SelectItem>
                                <SelectItem value="marketing">Marketing</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="description">Description</Label>
                          <Input
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="What is this template used for?"
                          />
                        </div>

                        <div>
                          <Label htmlFor="subject">Email Subject *</Label>
                          <Input
                            id="subject"
                            ref={subjectInputRef}
                            value={formData.subject}
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                            placeholder="e.g., Welcome to Serbian AI Tutor!"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Use {`{{VARIABLE_NAME}}`} for dynamic content
                          </p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch
                            id="isActive"
                            checked={formData.isActive}
                            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                          />
                          <Label htmlFor="isActive">Template is active</Label>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>HTML Content *</CardTitle>
                        <CardDescription>
                          Use the editor below to write content. Use "Email Preview" to see a more realistic email rendering.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {!hasSignaturePlaceholder && (
                          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <div className="flex items-start gap-3">
                              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-amber-900">
                                  Signature placeholder is missing
                                </p>
                                <p className="text-sm text-amber-900/80 mt-1">
                                  This template will <strong>not</strong> include the category signature unless you insert{" "}
                                  <code>{"{{EMAIL_SIGNATURE}}"}</code>.
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button size="sm" onClick={insertSignatureFooter}>
                                    Insert signature footer
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copyToClipboard("{{EMAIL_SIGNATURE}}")}
                                  >
                                    <Copy className="h-4 w-4 mr-2" />
                                    Copy placeholder
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mb-4">
                          <Accordion type="multiple" defaultValue={["variables"]} className="w-full">
                            <AccordionItem value="variables">
                              <AccordionTrigger className="text-sm">
                                Variable Library ({filteredAvailableVariables.length})
                              </AccordionTrigger>
                              <AccordionContent>
                                <Card className="mt-3">
                                  <CardContent className="space-y-3 pt-6">
                                    <div className="flex flex-col gap-2">
                                      <Label>Search</Label>
                                      <Input
                                        value={variableSearch}
                                        onChange={(e) => setVariableSearch(e.target.value)}
                                        placeholder="e.g., USER_EMAIL"
                                      />
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge
                                            variant="secondary"
                                            className="cursor-pointer select-none"
                                            onClick={() => insertTextIntoHtmlContent("{{EMAIL_SIGNATURE}}")}
                                          >
                                            {"{{EMAIL_SIGNATURE}}"}
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-sm">
                                          <div className="text-sm font-medium">{"{{EMAIL_SIGNATURE}}"}</div>
                                          <div className="text-xs text-muted-foreground mt-1">
                                            {variableInfo("EMAIL_SIGNATURE").description}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      {filteredAvailableVariables.slice(0, 24).map((v) => {
                                        const info = variableInfo(v);
                                        return (
                                          <div key={v} className="flex items-center gap-1">
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Badge
                                                  variant="outline"
                                                  className="cursor-pointer select-none"
                                                  onClick={() => insertTextIntoHtmlContent(`{{${v}}}`)}
                                                >
                                                  {`{{${v}}}`}
                                                </Badge>
                                              </TooltipTrigger>
                                              <TooltipContent className="max-w-sm">
                                                <div className="text-sm font-medium">{`{{${v}}}`}</div>
                                                <div className="text-xs text-muted-foreground mt-1">{info.description}</div>
                                                <div className="text-xs mt-2">
                                                  <span className="text-muted-foreground">Example:</span>{" "}
                                                  <span className="font-mono">{info.example}</span>
                                                </div>
                                              </TooltipContent>
                                            </Tooltip>

                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-7 w-7"
                                                  onClick={() => insertVariableIntoSubject(v)}
                                                >
                                                  <Type className="h-4 w-4" />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>Insert into subject</TooltipContent>
                                            </Tooltip>

                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-7 w-7"
                                                  onClick={() => copyToClipboard(`{{${v}}}`)}
                                                >
                                                  <Copy className="h-4 w-4" />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>Copy placeholder</TooltipContent>
                                            </Tooltip>
                                          </div>
                                        );
                                      })}
                                      {filteredAvailableVariables.length > 24 && (
                                        <Badge variant="secondary">+{filteredAvailableVariables.length - 24} more</Badge>
                                      )}
                                    </div>

                                    <p className="text-xs text-muted-foreground">
                                      Tip: Variables depend on the email flow. Use the template’s variables (or detected variables) as the source of truth.
                                    </p>
                                  </CardContent>
                                </Card>
                              </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="snippets">
                              <AccordionTrigger className="text-sm">
                                Email-safe snippets ({EMAIL_SNIPPETS.length})
                              </AccordionTrigger>
                              <AccordionContent>
                                <Card className="mt-3">
                                  <CardContent className="space-y-2 pt-6">
                                    {EMAIL_SNIPPETS.map((s) => (
                                      <div key={s.key} className="flex items-center justify-between gap-2">
                                        <div className="text-sm">{s.label}</div>
                                        <div className="flex gap-2">
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => copyToClipboard(s.html)}
                                          >
                                            <Copy className="h-4 w-4 mr-2" />
                                            Copy
                                          </Button>
                                          <Button type="button" size="sm" onClick={() => insertTextIntoHtmlContent(s.html)}>
                                            Insert
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </CardContent>
                                </Card>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </div>

                        <Tabs value={contentTab} onValueChange={(v) => setContentTab(v as ContentTab)} className="w-full">
                          <TabsList>
                            <TabsTrigger value="wysiwyg">
                              <EyeIcon className="h-4 w-4 mr-2" />
                              Visual Editor
                            </TabsTrigger>
                            <TabsTrigger value="code">
                              <Code className="h-4 w-4 mr-2" />
                              HTML Code
                            </TabsTrigger>
                            <TabsTrigger value="emailPreview">
                              <Mail className="h-4 w-4 mr-2" />
                              Email Preview
                            </TabsTrigger>
                          </TabsList>
                          <TabsContent value="wysiwyg" className="mt-4">
                            <div className="border rounded-lg overflow-hidden">
                              {editor && (
                                <div className="border-b bg-gray-50 p-2 flex flex-wrap gap-1">
                                  <Button
                                    type="button"
                                    variant={editor.isActive('bold') ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => editor.chain().focus().toggleBold().run()}
                                  >
                                    <strong>B</strong>
                                  </Button>
                                  <Button
                                    type="button"
                                    variant={editor.isActive('italic') ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => editor.chain().focus().toggleItalic().run()}
                                  >
                                    <em>I</em>
                                  </Button>
                                  <Button
                                    type="button"
                                    variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                                  >
                                    H1
                                  </Button>
                                  <Button
                                    type="button"
                                    variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                                  >
                                    H2
                                  </Button>
                                  <Button
                                    type="button"
                                    variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                                  >
                                    •
                                  </Button>
                                  <Button
                                    type="button"
                                    variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                                  >
                                    1.
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => editor.chain().focus().setParagraph().run()}
                                  >
                                    P
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                                  >
                                    {'</>'}
                                  </Button>
                                </div>
                              )}
                              <div className="bg-white min-h-[400px] [&_.ProseMirror]:outline-none [&_.ProseMirror]:p-4 [&_.ProseMirror]:min-h-[400px] [&_.ProseMirror_strong]:font-bold [&_.ProseMirror_em]:italic [&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ml-6 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ml-6 [&_.ProseMirror_p]:mb-2 [&_.ProseMirror_code]:bg-gray-100 [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:rounded [&_.ProseMirror_pre]:bg-gray-100 [&_.ProseMirror_pre]:p-4 [&_.ProseMirror_pre]:rounded [&_.ProseMirror_pre]:overflow-x-auto">
                                <EditorContent editor={editor} />
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              Use {`{{VARIABLE_NAME}}`} for dynamic content. Variables will be auto-detected.
                            </p>
                          </TabsContent>
                          <TabsContent value="code" className="mt-4">
                            <textarea
                              ref={codeTextareaRef}
                              value={formData.htmlContent}
                              onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
                              className="w-full h-[400px] font-mono text-sm border rounded-lg p-4 resize-none"
                              placeholder="<html>...</html>"
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                              Edit HTML directly. Use {`{{VARIABLE_NAME}}`} for dynamic content.
                            </p>
                          </TabsContent>
                          <TabsContent value="emailPreview" className="mt-4 space-y-4">
                            <div>
                              <Label>Subject (preview)</Label>
                              <div className="mt-1 p-2 bg-white border rounded text-sm font-medium">
                                {previewSubject || formData.subject || "(No subject)"}
                              </div>
                            </div>

                            <div>
                              <Label>Email Preview (isolated)</Label>
                              <div className="mt-2 rounded-lg border bg-gray-50 p-4">
                                <div className="mx-auto w-full max-w-[680px]">
                                  <iframe
                                    title="Email preview"
                                    className="w-full h-[720px] bg-white rounded-lg border"
                                    sandbox="allow-same-origin"
                                    srcDoc={`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0; padding: 0; background: #ffffff; color: #111827; font-family: Arial, sans-serif; }
      .email-canvas { max-width: 600px; margin: 0 auto; padding: 16px; }
      img { max-width: 100%; height: auto; }
      a { color: #2563eb; }
      table { border-collapse: collapse; }
    </style>
  </head>
  <body>
    <div class="email-canvas">
      ${(previewHtml || formData.htmlContent || "<p>Start typing to see preview...</p>").replace(/`/g, "\\`")}
    </div>
  </body>
</html>`}
                                  />
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                Note: Email clients differ. This preview isolates your HTML from the app styling and shows a typical 600px email width.
                              </p>
                            </div>
                          </TabsContent>
                        </Tabs>

                        {detectedVariables.length > 0 && (
                          <div className="mt-6">
                            <Label>Detected Variables</Label>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {detectedVariables.map((v: string) => (
                                <Badge key={v} variant="outline">
                                  {`{{${v}}}`}
                                </Badge>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              Variables are automatically detected from your content. Use the format {`{{VARIABLE_NAME}}`} in your subject or HTML.
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
              </div>
            </div>
          </main>
      </div>
    );
  }

  // List View
  return (
    <div className="flex flex-col h-full">
        <header className="border-b bg-card">
          <div className="container py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">Email Templates</h1>
              </div>
              <div className="flex gap-2">
                {isSuperadmin && (
                  <Button onClick={handleCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                )}
                {isSuperadmin && (
                  <Button variant="outline" onClick={() => setSignaturesOpen(true)}>
                    Signatures
                  </Button>
                )}
                <Link href="/admin">
                  <Button variant="outline" size="sm">
                    Back to Admin Panel
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </header>

        <Dialog open={signaturesOpen} onOpenChange={setSignaturesOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Email Signatures</DialogTitle>
              <DialogDescription>
                One signature per category. Insert <code>{"{{EMAIL_SIGNATURE}}"}</code> in templates to inject it.
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="transactional" className="w-full">
              <TabsList>
                <TabsTrigger value="transactional">Transactional</TabsTrigger>
                <TabsTrigger value="subscription">Subscription</TabsTrigger>
                <TabsTrigger value="marketing">Marketing</TabsTrigger>
              </TabsList>

              {(["transactional", "subscription", "marketing"] as const).map((category) => (
                <TabsContent key={category} value={category} className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`${category}-active`}
                        checked={signatureForm[category].isActive}
                        onCheckedChange={(checked) =>
                          setSignatureForm((prev) => ({
                            ...prev,
                            [category]: { ...prev[category], isActive: checked },
                          }))
                        }
                      />
                      <Label htmlFor={`${category}-active`}>Signature is active</Label>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => handleDeleteSignature(category)}>
                        Delete
                      </Button>
                      <Button onClick={() => handleSaveSignature(category)}>Save</Button>
                    </div>
                  </div>

                  <div>
                    <Label>Signature HTML</Label>
                    <Textarea
                      value={signatureForm[category].htmlContent}
                      onChange={(e) =>
                        setSignatureForm((prev) => ({
                          ...prev,
                          [category]: { ...prev[category], htmlContent: e.target.value },
                        }))
                      }
                      className="mt-2 min-h-[220px] font-mono text-sm"
                      placeholder="<p style=&quot;font-size:12px;color:#666&quot;>...</p>"
                    />
                  </div>

                  <div>
                    <Label>Preview</Label>
                    <div className="mt-2 rounded-lg border bg-gray-50 p-4">
                      <div className="mx-auto w-full max-w-[680px]">
                        <iframe
                          title={`Signature preview ${category}`}
                          className="w-full h-[260px] bg-white rounded-lg border"
                          sandbox="allow-same-origin"
                          srcDoc={`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0; padding: 0; background: #ffffff; color: #111827; font-family: Arial, sans-serif; }
      .email-canvas { max-width: 600px; margin: 0 auto; padding: 16px; }
      a { color: #2563eb; }
    </style>
  </head>
  <body>
    <div class="email-canvas">
      ${signatureForm[category].htmlContent || "<p style='color:#666;font-size:12px'>(empty)</p>"}
    </div>
  </body>
</html>`}
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </DialogContent>
        </Dialog>

        <main className="container py-8" data-email-templates-main>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Email Templates
                {user.role === 'admin' && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold">👁️ Read-Only</span>
                )}
              </CardTitle>
              <CardDescription>
                Manage email templates for automated communications
                {user.role === 'admin' && ' (View only - no edit permissions)'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {templates && templates.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No email templates found</p>
                  {isSuperadmin && (
                    <Button onClick={handleCreate}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Template
                    </Button>
                  )}
                </div>
              ) : (
                <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-[220px]">Meta</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates?.map((template) => (
                      <TableRow key={template._id}>
                        <TableCell className="py-2">
                          <div className="space-y-1">
                            <div className="font-medium">{template.name}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[520px]" title={template.subject}>
                              {template.subject}
                            </div>
                            {template.variables && template.variables.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {template.variables.slice(0, 2).map((v: string) => (
                                  <Badge key={v} variant="outline" className="text-[10px] px-1.5 py-0.5">
                                    {v}
                                  </Badge>
                                ))}
                                {template.variables.length > 2 && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                                    +{template.variables.length - 2}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2 align-top">
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap gap-2">
                              <Badge className={getCategoryColor(template.category)}>
                                {template.category}
                              </Badge>
                              {template.isActive ? (
                                <Badge className="bg-green-100 text-green-800">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Active
                                </Badge>
                              ) : (
                                <Badge className="bg-gray-100 text-gray-800">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Inactive
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Updated: {template.updatedAt ? formatDateEU(template.updatedAt) : "N/A"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Actions">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-[180px]">
                                <DropdownMenuItem onClick={() => handlePreview(template)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Preview
                                </DropdownMenuItem>
                                {isSuperadmin && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleEdit(template)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleDelete(template._id)}
                                      className="text-red-600 focus:text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Global Preview Dialog */}
                <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    {previewTemplate && (
                      <>
                        <DialogHeader>
                          <DialogTitle>{previewTemplate.name}</DialogTitle>
                          <DialogDescription>
                            {previewTemplate.description || "Email template preview"}
                          </DialogDescription>
                        </DialogHeader>
                        <Tabs defaultValue="preview" className="w-full">
                          <TabsList>
                            <TabsTrigger value="preview">Preview</TabsTrigger>
                            <TabsTrigger value="source">Source Code</TabsTrigger>
                            <TabsTrigger value="variables">Variables</TabsTrigger>
                          </TabsList>
                          <TabsContent value="preview" className="space-y-4">
                            <div>
                              <Label>Subject</Label>
                              <p className="text-sm font-medium mt-1">{previewTemplate.subject}</p>
                            </div>
                            <div>
                              <Label>HTML Preview</Label>
                              <div
                                className="border rounded-lg p-4 mt-2 bg-white"
                                dangerouslySetInnerHTML={{ __html: previewTemplate.htmlContent }}
                              />
                            </div>
                          </TabsContent>
                          <TabsContent value="source" className="space-y-4">
                            <div>
                              <Label>Subject</Label>
                              <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                                {previewTemplate.subject}
                              </pre>
                            </div>
                            <div>
                              <Label>HTML Content</Label>
                              <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto max-h-96">
                                {previewTemplate.htmlContent}
                              </pre>
                            </div>
                          </TabsContent>
                          <TabsContent value="variables" className="space-y-4">
                            <div>
                              <Label>Available Variables</Label>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {previewTemplate.variables?.map((v: string) => (
                                  <Badge key={v} variant="outline">
                                    {`{{${v}}}`}
                                  </Badge>
                                ))}
                                {(!previewTemplate.variables || previewTemplate.variables.length === 0) && (
                                  <p className="text-sm text-muted-foreground">No variables defined</p>
                                )}
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </>
                    )}
                  </DialogContent>
                </Dialog>
                </>
              )}
            </CardContent>
          </Card>
        </main>
    </div>
  );
}
