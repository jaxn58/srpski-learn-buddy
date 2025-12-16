import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Mail, Eye, Trash2, Edit, Plus, CheckCircle, XCircle, ArrowLeft, Code, Eye as EyeIcon } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useState, useMemo, useEffect } from "react";
// Sidebar import removed
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

type TemplateCategory = "transactional" | "subscription" | "marketing";
type EmailTemplateDoc = Doc<"emailTemplates">;

type ViewMode = "list" | "editor";

export default function EmailTemplates() {
  const { user, loading: authLoading } = useAuth();
  const templates = useQuery(api.emailTemplates.getAll) as EmailTemplateDoc[] | undefined;
  const templatesLoading = templates === undefined;
  const runId = "email-design-fix";
  
  const upsertMutation = useMutation(api.emailTemplates.upsert);
  const deleteMutation = useMutation(api.emailTemplates.remove);
  
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplateDoc | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplateDoc | null>(null);
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    htmlContent: "",
    description: "",
    category: "transactional" as TemplateCategory,
    isActive: true,
    variables: [] as string[],
  });

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
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      html = html.replace(regex, previewVariables[key]);
    });
    return html;
  }, [formData.htmlContent, previewVariables]);

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
      htmlContent: "",
      description: "",
      category: "transactional",
      isActive: true,
      variables: [],
    });
    setPreviewVariables({});
    setViewMode("editor");
  };

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
                  <Button onClick={handleSave}>
                    {editingTemplate ? "Update Template" : "Create Template"}
                  </Button>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-hidden">
            <PanelGroup direction="horizontal" className="h-full">
              {/* Left Panel: Form */}
              <Panel defaultSize={50} minSize={30}>
                <div className="h-full overflow-y-auto p-6">
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
                          Use the WYSIWYG editor below or switch to code view to edit HTML directly
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Tabs defaultValue="wysiwyg" className="w-full">
                          <TabsList>
                            <TabsTrigger value="wysiwyg">
                              <EyeIcon className="h-4 w-4 mr-2" />
                              Visual Editor
                            </TabsTrigger>
                            <TabsTrigger value="code">
                              <Code className="h-4 w-4 mr-2" />
                              HTML Code
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
                              value={formData.htmlContent}
                              onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
                              className="w-full h-[400px] font-mono text-sm border rounded-lg p-4 resize-none"
                              placeholder="<html>...</html>"
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                              Edit HTML directly. Use {`{{VARIABLE_NAME}}`} for dynamic content.
                            </p>
                          </TabsContent>
                        </Tabs>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </Panel>

              {/* Resize Handle */}
              <PanelResizeHandle className="w-2 bg-border hover:bg-primary/20 transition-colors" />

              {/* Right Panel: Preview */}
              <Panel defaultSize={50} minSize={30}>
                <div className="h-full overflow-y-auto p-6 bg-gray-50">
                  <div className="max-w-4xl mx-auto">
                    <Card>
                      <CardHeader>
                        <CardTitle>Live Preview</CardTitle>
                        <CardDescription>See how your email will look</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label>Subject</Label>
                          <div className="mt-1 p-2 bg-white border rounded text-sm font-medium">
                            {formData.subject || "(No subject)"}
                          </div>
                        </div>
                        <div>
                          <Label>HTML Preview</Label>
                          <div 
                            className="border rounded-lg p-4 mt-2 bg-white min-h-[500px]"
                            dangerouslySetInnerHTML={{ __html: previewHtml || formData.htmlContent || "<p>Start typing to see preview...</p>" }}
                          />
                        </div>
                        {detectedVariables.length > 0 && (
                          <div>
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
              </Panel>
            </PanelGroup>
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
                <Link href="/admin">
                  <Button variant="outline" size="sm">
                    Back to Admin Panel
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </header>

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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Variables</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates?.map((template) => (
                      <TableRow key={template._id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell>
                          <Badge className={getCategoryColor(template.category)}>
                            {template.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{template.subject}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {template.variables?.slice(0, 3).map((v: string) => (
                              <Badge key={v} variant="outline" className="text-xs">
                                {v}
                              </Badge>
                            ))}
                            {template.variables && template.variables.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{template.variables.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                          {template.updatedAt ? new Date(template.updatedAt).toLocaleDateString('de-DE') : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handlePreview(template)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>{template.name}</DialogTitle>
                                  <DialogDescription>
                                    {template.description || "Email template preview"}
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
                                      <p className="text-sm font-medium mt-1">{template.subject}</p>
                                    </div>
                                    <div>
                                      <Label>HTML Preview</Label>
                                      <div 
                                        className="border rounded-lg p-4 mt-2 bg-white"
                                        dangerouslySetInnerHTML={{ __html: template.htmlContent }}
                                      />
                                    </div>
                                  </TabsContent>
                                  <TabsContent value="source" className="space-y-4">
                                    <div>
                                      <Label>Subject</Label>
                                      <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                                        {template.subject}
                                      </pre>
                                    </div>
                                    <div>
                                      <Label>HTML Content</Label>
                                      <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto max-h-96">
                                        {template.htmlContent}
                                      </pre>
                                    </div>
                                  </TabsContent>
                                  <TabsContent value="variables" className="space-y-4">
                                    <div>
                                      <Label>Available Variables</Label>
                                      <div className="flex flex-wrap gap-2 mt-2">
                                        {template.variables?.map((v: string) => (
                                          <Badge key={v} variant="outline">
                                            {`{{${v}}}`}
                                          </Badge>
                                        ))}
                                        {(!template.variables || template.variables.length === 0) && (
                                          <p className="text-sm text-muted-foreground">No variables defined</p>
                                        )}
                                      </div>
                                    </div>
                                  </TabsContent>
                                </Tabs>
                              </DialogContent>
                            </Dialog>

                            {isSuperadmin && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(template)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(template._id)}
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
        </main>
    </div>
  );
}
