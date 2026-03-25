import { useQuery, useMutation, useAction, useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Plus, Send, Eye, Trash2, Users, Mail, UserCheck, UserX, Pencil,
  ArrowLeft, Code, Type, Copy, AlertTriangle, ImagePlus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { toast } from "sonner";
import { formatDateEU } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import {
  getVariableDescription,
  NEWSLETTER_CORE_VARIABLES,
} from "@/lib/emailTemplateVariables";

type CampaignDoc = Doc<"newsletterCampaigns">;
type EmailTemplateDoc = Doc<"emailTemplates">;
type ContentTab = "wysiwyg" | "code" | "emailPreview";

const PRE_SEND = new Set(["draft", "review", "ready"]);

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

function campaignSubjectEn(c: CampaignDoc): string {
  return (c.subjectEn ?? c.subject ?? "").trim();
}

function campaignHtmlEn(c: CampaignDoc): string {
  return (c.htmlBodySnapshotEn ?? c.htmlBodySnapshot ?? "").trim();
}

// ─── Root page ────────────────────────────────────────────────────────────────

export default function Newsletter() {
  const [activeTab, setActiveTab] = useState("campaigns");
  const [editingCampaign, setEditingCampaign] = useState<CampaignDoc | null>(null);
  const emailTemplates = useQuery(api.emailTemplates.getAll);
  const { user } = useAuth();

  if (editingCampaign && emailTemplates) {
    return (
      <CampaignEditorView
        campaignId={editingCampaign._id}
        fallbackCampaign={editingCampaign}
        emailTemplates={emailTemplates}
        isSuperadmin={user?.role === "superadmin"}
        onBack={() => setEditingCampaign(null)}
      />
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Newsletter Management</h1>
        <p className="text-muted-foreground">Manage campaigns and contacts</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-8">
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <CampaignsTab onEdit={setEditingCampaign} />
        </TabsContent>

        <TabsContent value="contacts">
          <ContactsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Campaigns list ────────────────────────────────────────────────────────────

function CampaignsTab({ onEdit }: { onEdit: (c: CampaignDoc) => void }) {
  const { t } = useTranslation();
  const campaigns = useQuery(api.newsletter.getAllCampaigns, {});
  const emailTemplates = useQuery(api.emailTemplates.getAll);
  const createCampaign = useMutation(api.newsletter.createCampaign);
  const sendCampaign = useMutation(api.newsletter.sendCampaign);
  const deleteCampaign = useMutation(api.newsletter.deleteCampaign);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const [newCampaign, setNewCampaign] = useState({
    name: "",
    subject: "",
    templateName: "",
    description: "",
    targetTags: "",
    targetSource: "all" as "waitlist" | "user" | "all",
    testMode: true,
  });

  const handleCreateCampaign = async () => {
    try {
      await createCampaign({
        name: newCampaign.name,
        subject: newCampaign.subject,
        templateName: newCampaign.templateName,
        description: newCampaign.description || undefined,
        targetTags: newCampaign.targetTags
          ? newCampaign.targetTags.split(",").map((x) => x.trim())
          : undefined,
        targetSource: newCampaign.targetSource !== "all" ? newCampaign.targetSource : undefined,
        testMode: newCampaign.testMode,
      });
      toast.success(t("admin.newsletter.toast.campaignCreated"));
      setIsCreateDialogOpen(false);
      setNewCampaign({ name: "", subject: "", templateName: "", description: "", targetTags: "", targetSource: "all", testMode: true });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("admin.newsletter.toast.campaignCreateFailed"));
    }
  };

  const handleSendCampaign = async (campaignId: Id<"newsletterCampaigns">) => {
    if (!confirm("Send this newsletter campaign to all matching subscribed contacts?")) return;
    try {
      const result = await sendCampaign({ campaignId });
      toast.success(t("admin.newsletter.toast.campaignScheduled", { recipients: result.totalRecipients, batches: result.batches }));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("admin.newsletter.toast.campaignSendFailed"));
    }
  };

  const handleDeleteCampaign = async (campaignId: Id<"newsletterCampaigns">) => {
    if (!confirm("Delete this campaign?")) return;
    try {
      await deleteCampaign({ campaignId });
      toast.success(t("admin.newsletter.toast.campaignDeleted"));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("admin.newsletter.toast.campaignDeleteFailed"));
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary", review: "outline", ready: "default",
      scheduled: "outline", sending: "default", sent: "default", cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  const onTemplatePick = (name: string) => {
    const tpl = emailTemplates?.find((x) => x.name === name);
    const subj = tpl ? (tpl.subjectEn ?? tpl.subject ?? "").trim() : "";
    setNewCampaign((prev) => ({ ...prev, templateName: name, subject: subj || prev.subject }));
  };

  const marketingTemplates = useMemo(() => {
    if (!emailTemplates) return [];
    const list = emailTemplates.filter((tpl) => tpl.isActive && tpl.category === "marketing");
    list.sort((a, b) => {
      if (a.name === "newsletter-base") return -1;
      if (b.name === "newsletter-base") return 1;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [emailTemplates]);

  if (!campaigns || !emailTemplates) return <div className="p-8">Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Email Campaigns</h2>
          <p className="text-muted-foreground">Create and manage newsletter campaigns (EN-first, optional DE)</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Campaign</DialogTitle>
              <DialogDescription>
                English subject and content are copied from the selected marketing template. Edit body after creation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Campaign Name</Label>
                <Input id="name" value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  placeholder="Beta Launch Announcement" />
              </div>
              <div>
                <Label htmlFor="subject">Email Subject (English)</Label>
                <Input id="subject" value={newCampaign.subject}
                  onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
                  placeholder="Welcome to Serbian AI Tutor!" />
              </div>
              <div>
                <Label htmlFor="template">Marketing Template (master)</Label>
                <Select value={newCampaign.templateName} onValueChange={(value) => onTemplatePick(value)}>
                  <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                  <SelectContent>
                    {marketingTemplates.map((template) => (
                      <SelectItem key={template._id} value={template.name}>{template.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Internal description (English, optional)</Label>
                <Textarea id="description" value={newCampaign.description}
                  onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                  placeholder="Internal notes about this campaign" />
              </div>
              <div>
                <Label htmlFor="targetTags">Target Tags (comma-separated, optional)</Label>
                <Input id="targetTags" value={newCampaign.targetTags}
                  onChange={(e) => setNewCampaign({ ...newCampaign, targetTags: e.target.value })}
                  placeholder="waitlist, beta-user" />
              </div>
              <div>
                <Label htmlFor="targetSource">Target Source</Label>
                <Select value={newCampaign.targetSource}
                  onValueChange={(value: "waitlist" | "user" | "all") =>
                    setNewCampaign({ ...newCampaign, targetSource: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Contacts</SelectItem>
                    <SelectItem value="waitlist">Waitlist Only</SelectItem>
                    <SelectItem value="user">Users Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="testMode" checked={newCampaign.testMode}
                  onChange={(e) => setNewCampaign({ ...newCampaign, testMode: e.target.checked })}
                  className="rounded" />
                <Label htmlFor="testMode" className="cursor-pointer">Test Mode (send only to whitelist)</Label>
              </div>
              <Button onClick={handleCreateCampaign} className="w-full">Create Campaign</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {campaigns.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No campaigns yet. Create your first campaign!</p>
            </CardContent>
          </Card>
        ) : (
          campaigns.map((campaign) => (
            <Card key={campaign._id}>
              <CardHeader>
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      {campaign.name}
                      {getStatusBadge(campaign.status)}
                      {campaign.testMode && <Badge variant="outline">Test Mode</Badge>}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      EN: {campaignSubjectEn(campaign) || "(no subject)"}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => onEdit(campaign)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      {PRE_SEND.has(campaign.status) ? "Edit" : "View"}
                    </Button>
                    {campaign.status === "ready" && (
                      <Button size="sm" variant="default" onClick={() => handleSendCampaign(campaign._id)}>
                        <Send className="mr-2 h-4 w-4" />
                        Send
                      </Button>
                    )}
                    {PRE_SEND.has(campaign.status) && (
                      <Button size="sm" variant="outline" onClick={() => handleDeleteCampaign(campaign._id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {campaign.status === "sent" && (
                      <Button size="sm" variant="outline"
                        onClick={() => (window.location.href = `/admin/newsletter-analytics?campaign=${campaign._id}`)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Stats
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><p className="text-muted-foreground">Template</p><p className="font-medium">{campaign.templateName}</p></div>
                  <div><p className="text-muted-foreground">Recipients</p><p className="font-medium">{campaign.totalRecipients ?? "-"}</p></div>
                  <div><p className="text-muted-foreground">Sent</p><p className="font-medium">{campaign.sentCount ?? 0}</p></div>
                  <div><p className="text-muted-foreground">Created</p><p className="font-medium">{formatDateEU(campaign.createdAt)}</p></div>
                </div>
                {campaign.description && (
                  <p className="text-sm text-muted-foreground mt-4">{campaign.description}</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Full-page campaign editor (mirrors EmailTemplates editor) ────────────────

type EditorViewProps = {
  campaignId: Id<"newsletterCampaigns">;
  fallbackCampaign: CampaignDoc;
  emailTemplates: EmailTemplateDoc[];
  isSuperadmin: boolean;
  onBack: () => void;
};

function CampaignEditorView({
  campaignId,
  fallbackCampaign,
  emailTemplates,
  isSuperadmin,
  onBack,
}: EditorViewProps) {
  const convex = useConvex();
  const liveCampaign = useQuery(api.newsletter.getCampaignById, { campaignId });
  const campaign = liveCampaign ?? fallbackCampaign;

  const updateCampaign = useMutation(api.newsletter.updateCampaign);
  const translateAction = useAction(api.newsletter.translateNewsletterCampaign);
  const sendTestEmailAction = useAction(api.newsletter.sendCampaignTestEmail);
  const sendCampaignMutation = useMutation(api.newsletter.sendCampaign);
  const generateUploadUrl = useMutation(api.newsletter.generateNewsletterImageUploadUrl);

  const [name, setName] = useState(campaign.name);
  const [status, setStatus] = useState(campaign.status);
  const [subjectEn, setSubjectEn] = useState(campaignSubjectEn(campaign));
  const [subjectDe, setSubjectDe] = useState((campaign.subjectDe ?? "").trim());
  const [descEn, setDescEn] = useState(campaign.description ?? "");
  const [descDe, setDescDe] = useState(campaign.descriptionDe ?? "");
  const [htmlEn, setHtmlEn] = useState(campaignHtmlEn(campaign));
  const [htmlDe, setHtmlDe] = useState((campaign.htmlBodySnapshotDe ?? "").trim());

  const [lang, setLang] = useState<"en" | "de">("en");
  const [contentTab, setContentTab] = useState<ContentTab>("wysiwyg");
  const [variableSearch, setVariableSearch] = useState("");
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);

  const subjectInputRef = useRef<HTMLInputElement>(null);
  const codeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editable = PRE_SEND.has(campaign.status);

  useEffect(() => {
    setName(campaign.name);
    setStatus(campaign.status);
    setSubjectEn(campaignSubjectEn(campaign));
    setSubjectDe((campaign.subjectDe ?? "").trim());
    setDescEn(campaign.description ?? "");
    setDescDe(campaign.descriptionDe ?? "");
    setHtmlEn(campaignHtmlEn(campaign));
    setHtmlDe((campaign.htmlBodySnapshotDe ?? "").trim());
  }, [campaign]);

  const master = emailTemplates.find((t) => t.name === campaign.templateName);
  const variableNames = useMemo(() => {
    const fromMaster = master?.variables ?? [];
    const set = new Set<string>([...NEWSLETTER_CORE_VARIABLES, ...fromMaster]);
    const core = [...NEWSLETTER_CORE_VARIABLES];
    const rest = Array.from(set)
      .filter((v) => !core.includes(v as (typeof NEWSLETTER_CORE_VARIABLES)[number]))
      .sort();
    return [...core, ...rest];
  }, [master]);

  const filteredVars = useMemo(() => {
    const q = variableSearch.trim().toLowerCase();
    if (!q) return variableNames;
    return variableNames.filter((v) => v.toLowerCase().includes(q));
  }, [variableNames, variableSearch]);

  useEffect(() => {
    setPreviewVars((prev) => {
      const next = { ...prev };
      for (const v of variableNames) {
        if (!next[v]) {
          next[v] =
            v === "USER_EMAIL" ? "reader@example.com"
            : v === "USER_NAME" ? "Alex"
            : v === "UNSUBSCRIBE_LINK" ? "https://learn-with.me/newsletter/unsubscribe?token=demo"
            : v === "EMAIL_SIGNATURE" ? "<p>— Serbian AI Tutor</p>"
            : `Sample ${v.replace(/_/g, " ")}`;
        }
      }
      return next;
    });
  }, [variableNames]);

  const activeHtml = lang === "en" ? htmlEn : htmlDe;
  const activeSubject = lang === "en" ? subjectEn : subjectDe;

  const setActiveHtml = useCallback((html: string) => {
    if (lang === "en") setHtmlEn(html);
    else setHtmlDe(html);
  }, [lang]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder: "Write newsletter content…" }),
        Image.configure({ inline: true, allowBase64: false }),
      ],
      content: activeHtml,
      editable,
      editorProps: {
        attributes: {
          class: "outline-none p-4 min-h-[400px] [&_strong]:font-bold [&_em]:italic [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_p]:mb-2 [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-gray-100 [&_pre]:p-4 [&_pre]:rounded [&_pre]:overflow-x-auto",
        },
      },
      onUpdate: ({ editor: ed }) => setActiveHtml(ed.getHTML()),
    },
    [lang, campaignId]
  );

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== activeHtml) {
      editor.commands.setContent(activeHtml || "<p></p>");
    }
  }, [lang, editor]);

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editor, editable]);

  function insertTextAtCursor(el: HTMLTextAreaElement, text: string) {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + text + el.value.slice(end);
    const nextPos = start + text.length;
    return { next, nextPos };
  }

  function insertIntoBody(text: string) {
    if (contentTab === "wysiwyg" && editor) {
      editor.chain().focus().insertContent(text).run();
      return;
    }
    if (contentTab === "code" && codeTextareaRef.current) {
      const el = codeTextareaRef.current;
      const { next, nextPos } = insertTextAtCursor(el, text);
      setActiveHtml(next);
      requestAnimationFrame(() => { el.focus(); el.setSelectionRange(nextPos, nextPos); });
      return;
    }
    setActiveHtml(activeHtml + text);
  }

  function insertIntoSubject(variable: string) {
    const token = `{{${variable}}}`;
    const el = subjectInputRef.current;
    if (!el) {
      if (lang === "en") setSubjectEn((s) => s + token);
      else setSubjectDe((s) => s + token);
      return;
    }
    const { next, nextPos } = insertTextAtCursor(el as unknown as HTMLTextAreaElement, token);
    if (lang === "en") setSubjectEn(next);
    else setSubjectDe(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(nextPos, nextPos); });
  }

  async function copyToClipboard(text: string) {
    try { await navigator.clipboard.writeText(text); toast.success("Copied"); }
    catch { toast.error("Copy failed"); }
  }

  const previewHtml = useMemo(() => {
    let html = lang === "en" ? htmlEn : htmlDe;
    for (const [k, val] of Object.entries(previewVars)) {
      html = html.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), val);
    }
    return html;
  }, [htmlEn, htmlDe, lang, previewVars]);

  const previewSubject = useMemo(() => {
    let s = lang === "en" ? subjectEn : subjectDe;
    for (const [k, val] of Object.entries(previewVars)) {
      s = s.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), val);
    }
    return s;
  }, [subjectEn, subjectDe, lang, previewVars]);

  const detectedVars = useMemo(() => {
    const re = /\{\{(\w+)\}\}/g;
    const found = new Set<string>();
    let m;
    const combined = [subjectEn, htmlEn, subjectDe, htmlDe].join(" ");
    while ((m = re.exec(combined)) !== null) found.add(m[1]);
    return Array.from(found).sort();
  }, [subjectEn, htmlEn, subjectDe, htmlDe]);

  const hasSignaturePlaceholder = activeHtml.includes("{{EMAIL_SIGNATURE}}");

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateCampaign({
        campaignId,
        name,
        subjectEn,
        subjectDe: subjectDe || undefined,
        description: descEn || undefined,
        descriptionDe: descDe || undefined,
        htmlBodySnapshotEn: htmlEn,
        htmlBodySnapshotDe: htmlDe || undefined,
        status: status as "draft" | "review" | "ready",
      });
      toast.success("Campaign saved");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTranslate = async () => {
    if (!isSuperadmin) { toast.error("Superadmin required"); return; }
    setIsTranslating(true);
    try {
      const res = await translateAction({ campaignId });
      if (res.warnings?.length) toast.warning(res.warnings.join(" "));
      else toast.success("German translation saved");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Translation failed");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    try {
      const res = await sendTestEmailAction({ campaignId, locale: lang });
      toast.success(`Test email sent to ${res.sentTo}`, { description: `[TEST] ${lang === "en" ? subjectEn : (subjectDe || subjectEn)}` });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Test send failed");
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSendCampaign = async () => {
    if (!confirm(`Send campaign "${name}" to ALL matching subscribed contacts? This cannot be undone.`)) return;
    setIsSendingCampaign(true);
    try {
      const result = await sendCampaignMutation({ campaignId });
      toast.success(`Campaign scheduled: ${result.totalRecipients} recipients, ${result.batches} batches`);
      onBack();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setIsSendingCampaign(false);
    }
  };

  /** Insert an image into the active editor mode (wysiwyg or code). */
  function insertImageIntoContent(src: string) {
    if (contentTab === "wysiwyg" && editor) {
      editor.chain().focus().setImage({ src }).run();
    } else if (contentTab === "code" && codeTextareaRef.current) {
      const imgTag = `<img src="${src}" alt="" style="max-width:100%;height:auto;" />`;
      const el = codeTextareaRef.current;
      const { next, nextPos } = insertTextAtCursor(el, imgTag);
      setActiveHtml(next);
      requestAnimationFrame(() => { el.focus(); el.setSelectionRange(nextPos, nextPos); });
    } else {
      // Fallback: append to current HTML
      const imgTag = `<img src="${src}" alt="" style="max-width:100%;height:auto;" />`;
      setActiveHtml(activeHtml + imgTag);
    }
  }

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIsUploading(true);
    try {
      const postUrl = await generateUploadUrl({});
      const res = await fetch(postUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const raw = await res.text();
      let storageId = raw.replace(/^"|"$/g, "");
      try { const j = JSON.parse(raw) as { storageId?: string }; if (j?.storageId) storageId = j.storageId; } catch { }
      if (!storageId) { toast.error("Upload did not return storage id"); return; }
      const publicUrl = await convex.query(api.newsletter.getNewsletterImagePublicUrl, { storageId });
      if (!publicUrl) { toast.error("Could not resolve image URL"); return; }
      insertImageIntoContent(publicUrl);
      toast.success("Image inserted");
    } catch { toast.error("Image upload failed"); }
    finally { setIsUploading(false); }
  };


  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Campaigns
              </Button>
              <div className="flex items-center gap-2">
                <Mail className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">
                  {editable ? "Edit Campaign" : "Campaign (read-only)"}
                </h1>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <Button variant="outline" onClick={onBack}>Cancel</Button>
              {isSuperadmin && editable && (
                <Button variant="outline" onClick={handleTranslate} disabled={isTranslating}>
                  {isTranslating ? "Translating…" : "AI translate EN → DE"}
                </Button>
              )}
              {editable && (
                <Button variant="outline" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save Campaign"}
                </Button>
              )}
              {/* Test Send – sends current language version to superadmin email */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    onClick={handleSendTest}
                    disabled={isSendingTest}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isSendingTest ? "Sending test…" : "Send Test Email"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Sends the current {lang.toUpperCase()} version to your admin email address for preview.
                </TooltipContent>
              </Tooltip>
              {/* Real send – only enabled when status is "ready" */}
              {campaign.status === "ready" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      onClick={handleSendCampaign}
                      disabled={isSendingCampaign}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {isSendingCampaign ? "Sending…" : "Send Campaign"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Sends to all matching subscribed contacts. Campaign must be in status "ready".
                  </TooltipContent>
                </Tooltip>
              )}
              {editable && campaign.status !== "ready" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="default" disabled className="opacity-50">
                      <Send className="h-4 w-4 mr-2" />
                      Send Campaign
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Set Workflow Status to "ready" to enable sending.
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </header>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />

      <main className="flex-1 overflow-y-auto">
        <div className="container py-6">
          <div className="max-w-4xl mx-auto space-y-6">

            {/* Campaign Details */}
            <Card>
              <CardHeader>
                <CardTitle>Campaign Details</CardTitle>
                <CardDescription>
                  Template: <strong>{campaign.templateName}</strong>. English is the authoring language.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Language switcher */}
                <div className="flex items-center justify-between gap-3">
                  <Tabs value={lang} onValueChange={(v) => setLang(v as "en" | "de")} className="w-auto">
                    <TabsList>
                      <TabsTrigger value="en">English</TabsTrigger>
                      <TabsTrigger value="de">Deutsch</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Campaign Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!editable} />
                  </div>
                  <div>
                    <Label>Workflow Status</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as typeof status)} disabled={!editable}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">draft</SelectItem>
                        <SelectItem value="review">review</SelectItem>
                        <SelectItem value="ready">ready (can send)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Internal Description ({lang.toUpperCase()})</Label>
                  <Input
                    value={lang === "en" ? descEn : descDe}
                    onChange={(e) => lang === "en" ? setDescEn(e.target.value) : setDescDe(e.target.value)}
                    disabled={!editable}
                    placeholder="Internal notes about this campaign"
                  />
                </div>

                <div>
                  <Label>Email Subject ({lang.toUpperCase()}) *</Label>
                  <Input
                    ref={subjectInputRef}
                    value={activeSubject}
                    onChange={(e) => lang === "en" ? setSubjectEn(e.target.value) : setSubjectDe(e.target.value)}
                    disabled={!editable}
                    placeholder={lang === "en" ? "Subject in English…" : "Subject in German…"}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Use {`{{VARIABLE_NAME}}`} for dynamic content</p>
                </div>
              </CardContent>
            </Card>

            {/* HTML Content */}
            <Card>
              <CardHeader>
                <CardTitle>HTML Content ({lang.toUpperCase()})</CardTitle>
                <CardDescription>
                  Use the editor below to write content. Use "Email Preview" to see a realistic rendering.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!hasSignaturePlaceholder && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-900">Signature placeholder missing</p>
                        <p className="text-sm text-amber-900/80 mt-1">
                          Insert <code>{"{{EMAIL_SIGNATURE}}"}</code> to include the marketing signature.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => insertIntoBody("{{EMAIL_SIGNATURE}}")}>
                            Insert {"{{EMAIL_SIGNATURE}}"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => copyToClipboard("{{EMAIL_SIGNATURE}}")}>
                            <Copy className="h-4 w-4 mr-2" />Copy placeholder
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <Accordion type="multiple" defaultValue={["variables"]} className="w-full">
                    {/* Variable Library */}
                    <AccordionItem value="variables">
                      <AccordionTrigger className="text-sm">
                        Variable Library ({filteredVars.length})
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
                              {filteredVars.map((v) => (
                                <div key={v} className="flex items-center gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="outline"
                                        className="cursor-pointer select-none"
                                        onClick={() => editable && insertIntoBody(`{{${v}}}`)}
                                      >
                                        {`{{${v}}}`}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-sm">
                                      <div className="text-sm font-medium">{`{{${v}}}`}</div>
                                      <div className="text-xs text-muted-foreground mt-1">{getVariableDescription(v)}</div>
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                                        disabled={!editable}
                                        onClick={() => insertIntoSubject(v)}>
                                        <Type className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Insert into subject</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                                        onClick={() => copyToClipboard(`{{${v}}}`)}>
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Copy placeholder</TooltipContent>
                                  </Tooltip>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Click a badge to insert into body. Use the T-button to insert into subject.
                            </p>
                          </CardContent>
                        </Card>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Email-safe snippets */}
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
                                  <Button type="button" size="sm" variant="outline"
                                    onClick={() => copyToClipboard(s.html)}>
                                    <Copy className="h-4 w-4 mr-2" />Copy
                                  </Button>
                                  <Button type="button" size="sm" disabled={!editable}
                                    onClick={() => insertIntoBody(s.html)}>
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

                {/* Editor tabs */}
                <Tabs value={contentTab} onValueChange={(v) => setContentTab(v as ContentTab)} className="w-full">
                  <TabsList>
                    <TabsTrigger value="wysiwyg">
                      <Eye className="h-4 w-4 mr-2" />
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

                  {/* Visual (TipTap) */}
                  <TabsContent value="wysiwyg" className="mt-4">
                    <div className="border rounded-lg overflow-hidden">
                      {editor && (
                        <div className="border-b bg-gray-50 p-2 flex flex-wrap gap-1">
                          <Button type="button" variant={editor.isActive("bold") ? "default" : "ghost"} size="sm"
                            disabled={!editable} onClick={() => editor.chain().focus().toggleBold().run()}>
                            <strong>B</strong>
                          </Button>
                          <Button type="button" variant={editor.isActive("italic") ? "default" : "ghost"} size="sm"
                            disabled={!editable} onClick={() => editor.chain().focus().toggleItalic().run()}>
                            <em>I</em>
                          </Button>
                          <Button type="button" variant={editor.isActive("heading", { level: 1 }) ? "default" : "ghost"} size="sm"
                            disabled={!editable} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
                            H1
                          </Button>
                          <Button type="button" variant={editor.isActive("heading", { level: 2 }) ? "default" : "ghost"} size="sm"
                            disabled={!editable} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                            H2
                          </Button>
                          <Button type="button" variant={editor.isActive("bulletList") ? "default" : "ghost"} size="sm"
                            disabled={!editable} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                            •
                          </Button>
                          <Button type="button" variant={editor.isActive("orderedList") ? "default" : "ghost"} size="sm"
                            disabled={!editable} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                            1.
                          </Button>
                          <Button type="button" variant="ghost" size="sm"
                            disabled={!editable} onClick={() => editor.chain().focus().setParagraph().run()}>
                            P
                          </Button>
                          <Button type="button" variant="ghost" size="sm"
                            disabled={!editable} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
                            {"</>"}
                          </Button>
                          <div className="w-px h-6 bg-border mx-1" />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!editable || isUploading}
                            onClick={() => fileInputRef.current?.click()}
                            title="Upload & insert image"
                          >
                            <ImagePlus className="h-4 w-4 mr-1" />
                            {isUploading ? "Uploading…" : "Image"}
                          </Button>
                        </div>
                      )}
                      <div className="bg-white min-h-[400px]">
                        <EditorContent editor={editor} />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Use {`{{VARIABLE_NAME}}`} for dynamic content. Variables are auto-detected on save.
                    </p>
                  </TabsContent>

                  {/* HTML Code */}
                  <TabsContent value="code" className="mt-4">
                    <textarea
                      ref={codeTextareaRef}
                      value={activeHtml}
                      onChange={(e) => setActiveHtml(e.target.value)}
                      disabled={!editable}
                      className="w-full h-[400px] font-mono text-sm border rounded-lg p-4 resize-none"
                      placeholder="<html>…</html>"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Edit HTML directly. Use {`{{VARIABLE_NAME}}`} for dynamic content.
                    </p>
                  </TabsContent>

                  {/* Email Preview (iframe) */}
                  <TabsContent value="emailPreview" className="mt-4 space-y-4">
                    <div>
                      <Label>Subject (preview)</Label>
                      <div className="mt-1 p-2 bg-white border rounded text-sm font-medium">
                        {previewSubject || "(No subject)"}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Preview variables</Label>
                      <div className="grid gap-2 grid-cols-1 md:grid-cols-2 text-xs">
                        {variableNames.map((vk) => (
                          <div key={vk} className="flex gap-2 items-center">
                            <span className="font-mono w-40 shrink-0 text-muted-foreground">{`{{${vk}}}`}</span>
                            <Input
                              value={previewVars[vk] ?? ""}
                              onChange={(e) => setPreviewVars((p) => ({ ...p, [vk]: e.target.value }))}
                              className="h-7 text-xs"
                            />
                          </div>
                        ))}
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
      ${(previewHtml || "<p>Start typing to see preview…</p>").replace(/`/g, "\\`")}
    </div>
  </body>
</html>`}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Note: Email clients differ. This preview isolates your HTML from app styling and shows a typical 600px email width.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>

                {detectedVars.length > 0 && (
                  <div className="mt-6">
                    <Label>Detected Variables</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {detectedVars.map((v) => (
                        <Badge key={v} variant="outline">{`{{${v}}}`}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Variables are automatically detected from your content and saved with the campaign.
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

// ─── Contacts tab ──────────────────────────────────────────────────────────────

function ContactsTab() {
  const allContacts = useQuery(api.newsletter.getAllContacts, {});
  const stats = useQuery(api.newsletter.getNewsletterStats);
  const updateLocale = useMutation(api.newsletter.updateContactPreferredLocale);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterSubscribed, setFilterSubscribed] = useState<"all" | "subscribed" | "unsubscribed">("all");
  const [filterSource, setFilterSource] = useState<"all" | "waitlist" | "user" | "manual">("all");

  if (!allContacts || !stats) return <div className="p-8">Loading...</div>;

  const filteredContacts = allContacts.filter((contact) => {
    if (searchTerm && !contact.email.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterSubscribed === "subscribed" && !contact.subscribed) return false;
    if (filterSubscribed === "unsubscribed" && contact.subscribed) return false;
    if (filterSource !== "all" && contact.source !== filterSource) return false;
    return true;
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Newsletter Contacts</h2>
        <p className="text-muted-foreground">View and manage your subscriber list</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.totalContacts}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscribed</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.subscribed}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unsubscribed</CardTitle>
            <UserX className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.unsubscribed}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">From Waitlist</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.sources.waitlist}</div></CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Input placeholder="Search by email…" value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} />
            <Select value={filterSubscribed} onValueChange={(value: typeof filterSubscribed) => setFilterSubscribed(value)}>
              <SelectTrigger><SelectValue placeholder="Filter by status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contacts</SelectItem>
                <SelectItem value="subscribed">Subscribed Only</SelectItem>
                <SelectItem value="unsubscribed">Unsubscribed Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSource} onValueChange={(value: typeof filterSource) => setFilterSource(value)}>
              <SelectTrigger><SelectValue placeholder="Filter by source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="waitlist">Waitlist</SelectItem>
                <SelectItem value="user">Users</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contacts ({filteredContacts.length})</CardTitle>
          <CardDescription>
            Preferred locale controls EN vs DE newsletter content when both exist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredContacts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No contacts found</p>
            ) : (
              filteredContacts.map((contact) => (
                <div key={contact._id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{contact.email}</p>
                      {contact.subscribed
                        ? <Badge variant="default" className="bg-green-600">Subscribed</Badge>
                        : <Badge variant="secondary">Unsubscribed</Badge>}
                      <Badge variant="outline">{contact.source}</Badge>
                    </div>
                    {contact.name && <p className="text-sm text-muted-foreground">{contact.name}</p>}
                    {contact.tags.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {contact.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={contact.preferredLocale ?? "en"}
                      onValueChange={async (v) => {
                        try {
                          await updateLocale({ contactId: contact._id, preferredLocale: v as "en" | "de" });
                          toast.success("Locale updated");
                        } catch (e: unknown) {
                          toast.error(e instanceof Error ? e.message : "Update failed");
                        }
                      }}>
                      <SelectTrigger className="w-[140px]"><SelectValue placeholder="Locale" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
