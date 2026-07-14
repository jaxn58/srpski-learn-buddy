import { useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Send, FileText, ArrowLeft, Languages, Loader2, Upload } from "lucide-react";
import { AnimatedPage } from "@/components/AnimatedPage";
import { useTranslation } from "react-i18next";

const BASE_CATEGORIES = [
  { value: "culture", label: "Culture" },
  { value: "practical", label: "Practical" },
  { value: "language", label: "Language" },
  { value: "cuisine", label: "Cuisine" },
  { value: "geography", label: "Geography" },
  { value: "immigration", label: "Immigration" },
  { value: "history", label: "History" },
] as const;

type CategoryValue = typeof BASE_CATEGORIES[number]["value"] | "other";

// Local shape of the article fields we read from the Convex query.
// Defined here because the generated return type is degraded through
// TS2589 workarounds in convex/knowledge.ts (large-schema depth limit).
type KnowledgeArticle = {
  _id: Id<"knowledgeArticles">;
  title: string;
  content: string;
  category: CategoryValue;
  customCategory?: string;
  language: string;
  tags?: string[];
  status: "draft" | "published";
  translationOf?: Id<"knowledgeArticles">;
  createdBy?: Id<"users">;
  createdAt: number;
  updatedAt?: number;
  chunkedAt?: number;
};

const LANG_LABELS: Record<string, string> = { en: "English", de: "Deutsch", sr: "Srpski" };

export default function KnowledgeAdmin() {
  const { t } = useTranslation();
  const [filterStatus, setFilterStatus] = useState<"all" | "draft" | "published">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [editingId, setEditingId] = useState<Id<"knowledgeArticles"> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [translatingId, setTranslatingId] = useState<Id<"knowledgeArticles"> | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCatSelect, setUploadCatSelect] = useState("culture");
  const [uploadCustomInput, setUploadCustomInput] = useState("");
  const [uploadLanguage, setUploadLanguage] = useState("en");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCatSelect, setFormCatSelect] = useState("culture");
  const [formCustomInput, setFormCustomInput] = useState("");
  const [formLanguage, setFormLanguage] = useState("en");
  const [formTags, setFormTags] = useState("");

  const filterCatParsed = filterCategory.startsWith("other:") ? "other" : filterCategory;
  const filterCustomCat = filterCategory.startsWith("other:") ? filterCategory.slice(6) : undefined;

  const rawArticles = useQuery(api.knowledge.listArticles, {
    status: filterStatus === "all" ? undefined : filterStatus,
    category: filterCatParsed === "all" ? undefined : filterCatParsed,
  });
  const customCategories = (useQuery(api.knowledge.listCustomCategories) ?? []) as string[];

  const articles = useMemo<KnowledgeArticle[] | undefined>(() => {
    if (!rawArticles) return undefined;
    const list = rawArticles as KnowledgeArticle[];
    if (!filterCustomCat) return list;
    return list.filter((a: KnowledgeArticle) => a.customCategory === filterCustomCat);
  }, [rawArticles, filterCustomCat]);

  const allCategoryOptions = useMemo(() => {
    const options: { value: string; label: string }[] = BASE_CATEGORIES.map((c) => ({ ...c }));
    for (const cc of customCategories) {
      options.push({ value: `other:${cc}`, label: cc });
    }
    options.push({ value: "other", label: "Other..." });
    return options;
  }, [customCategories]);

  const parseCategorySelect = useCallback((selectValue: string): { category: CategoryValue; customCategory?: string } => {
    if (selectValue.startsWith("other:")) {
      return { category: "other", customCategory: selectValue.slice(6) };
    }
    return { category: selectValue as CategoryValue };
  }, []);

  const toCategorySelectValue = useCallback((category: string, customCategory?: string): string => {
    if (category === "other" && customCategory) return `other:${customCategory}`;
    return category;
  }, []);

  const createArticle = useMutation(api.knowledge.createArticle);
  const updateArticle = useMutation(api.knowledge.updateArticle);
  const publishArticle = useMutation(api.knowledge.publishArticle);
  const unpublishArticle = useMutation(api.knowledge.unpublishArticle);
  const deleteArticle = useMutation(api.knowledge.deleteArticle);
  const translateArticle = useMutation(api.knowledge.translateArticle);
  const generateUploadUrl = useMutation(api.knowledge.generateKnowledgeUploadUrl);
  const scheduleExtraction = useMutation(api.knowledge.scheduleExtraction);

  const ALLOWED_UPLOAD_TYPES = [
    "application/pdf", "text/plain", "text/markdown",
    "image/jpeg", "image/png", "image/webp",
  ];
  const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
      toast.error("Supported: PDF, TXT, MD, JPG, PNG, WebP");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      toast.error("Max. 10 MB per file");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const resp = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!resp.ok) throw new Error("Upload failed");
      const { storageId } = await resp.json();

      const { category: upCat, customCategory: upCC } = parseCategorySelect(uploadCatSelect);
      const resolvedUpCustom = upCat === "other" && !upCC ? uploadCustomInput : upCC;
      await scheduleExtraction({
        storageId,
        fileType: file.type,
        fileName: file.name,
        category: upCat,
        customCategory: resolvedUpCustom || undefined,
        language: uploadLanguage,
      });

      toast.success("Document is being processed — a draft article will appear shortly.");
      setUploadOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [generateUploadUrl, scheduleExtraction, uploadCatSelect, uploadCustomInput, uploadLanguage, parseCategorySelect]);

  const resetForm = () => {
    setFormTitle("");
    setFormContent("");
    setFormCatSelect("culture");
    setFormCustomInput("");
    setFormLanguage("en");
    setFormTags("");
    setEditingId(null);
    setIsCreating(false);
  };

  const handleCreate = async () => {
    if (!formTitle.trim() || !formContent.trim()) {
      toast.error("Title and content are required");
      return;
    }
    try {
      const { category: fCat, customCategory: fCC } = parseCategorySelect(formCatSelect);
      const resolvedCustom = fCat === "other" && !fCC ? formCustomInput : fCC;
      await createArticle({
        title: formTitle,
        content: formContent,
        category: fCat,
        customCategory: resolvedCustom || undefined,
        language: formLanguage,
        tags: formTags ? formTags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
      });
      toast.success("Article created");
      resetForm();
    } catch (e) {
      toast.error("Failed to create article");
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !formTitle.trim() || !formContent.trim()) return;
    try {
      const { category: uCat, customCategory: uCC } = parseCategorySelect(formCatSelect);
      const resolvedCustomU = uCat === "other" && !uCC ? formCustomInput : uCC;
      await updateArticle({
        articleId: editingId,
        title: formTitle,
        content: formContent,
        category: uCat,
        customCategory: resolvedCustomU || undefined,
        language: formLanguage,
        tags: formTags ? formTags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
      });
      toast.success("Article updated");
      resetForm();
    } catch (e) {
      toast.error("Failed to update article");
    }
  };

  const startEdit = (article: NonNullable<typeof articles>[number]) => {
    setEditingId(article._id);
    setFormTitle(article.title);
    setFormContent(article.content);
    const cc = (article as any).customCategory as string | undefined;
    setFormCatSelect(toCategorySelectValue(article.category, cc));
    setFormCustomInput(cc ?? "");
    setFormLanguage(article.language);
    setFormTags(article.tags?.join(", ") ?? "");
    setIsCreating(false);
  };

  const handlePublish = async (id: Id<"knowledgeArticles">) => {
    try {
      await publishArticle({ articleId: id });
      toast.success("Article published & queued for embedding");
    } catch (e) {
      toast.error("Failed to publish");
    }
  };

  const handleDelete = async (id: Id<"knowledgeArticles">) => {
    if (!confirm("Delete this article and all its translations? This cannot be undone.")) return;
    try {
      await deleteArticle({ articleId: id });
      toast.success("Article deleted");
    } catch (e) {
      toast.error("Failed to delete");
    }
  };

  const handleTranslate = async (articleId: Id<"knowledgeArticles">, targetLang: string) => {
    setTranslatingId(articleId);
    try {
      await translateArticle({ articleId, targetLanguage: targetLang });
      toast.success(`Translation to ${LANG_LABELS[targetLang] ?? targetLang} started — check drafts in a moment`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Translation failed");
    } finally {
      setTranslatingId(null);
    }
  };

  const showForm = isCreating || editingId;

  // Group articles: originals (no translationOf) + their translations below
  const groupedArticles = (() => {
    if (!articles) return null;

    const originals = articles.filter((a: KnowledgeArticle) => !a.translationOf);
    const translationMap = new Map<string, KnowledgeArticle[]>();

    for (const a of articles) {
      if (a.translationOf) {
        const key = a.translationOf as string;
        if (!translationMap.has(key)) translationMap.set(key, []);
        translationMap.get(key)!.push(a);
      }
    }

    return originals.map((original: KnowledgeArticle) => ({
      original,
      translations: translationMap.get(original._id as string) ?? [],
    }));
  })();

  return (
    <AnimatedPage className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('admin.knowledge.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('admin.knowledge.subtitle')}
          </p>
        </div>
        {!showForm && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setIsCreating(true)} className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" /> {t('admin.knowledge.newArticle')}
            </Button>
            <Button variant="outline" onClick={() => setUploadOpen(true)} className="gap-2 w-full sm:w-auto">
              <Upload className="h-4 w-4" /> {t('admin.knowledge.uploadDocument')}
            </Button>
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a PDF, image, or text file. The text will be automatically extracted and saved as a draft article.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex gap-3">
              <Select value={uploadCatSelect} onValueChange={setUploadCatSelect}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {allCategoryOptions.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={uploadLanguage} onValueChange={setUploadLanguage}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="sr">Srpski</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {uploadCatSelect === "other" && (
              <Input
                placeholder="New category name"
                value={uploadCustomInput}
                onChange={(e) => setUploadCustomInput(e.target.value)}
              />
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.txt,.md,.jpg,.jpeg,.png,.webp"
              onChange={handleFileUpload}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full gap-2"
            >
              {isUploading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                : <><Upload className="h-4 w-4" /> Choose File &amp; Upload</>}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              PDF, TXT, MD, JPG, PNG, WebP · max 10 MB
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      {!showForm && (
        <div className="flex gap-3">
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {BASE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
              {customCategories.length > 0 && (
                <>
                  <SelectItem value="other">Other (all)</SelectItem>
                  {customCategories.map((cc: string) => (
                    <SelectItem key={`cc-${cc}`} value={`other:${cc}`}>{cc}</SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Editor Form */}
      {showForm && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {editingId ? "Edit Article" : "New Article"}
            </h2>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </div>

          <Input
            placeholder="Article title"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />

          <div className="flex gap-3 flex-wrap">
            <Select value={formCatSelect} onValueChange={setFormCatSelect}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allCategoryOptions.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formCatSelect === "other" && (
              <Input
                placeholder="New category name"
                value={formCustomInput}
                onChange={(e) => setFormCustomInput(e.target.value)}
                className="w-[200px]"
              />
            )}
            <Select value={formLanguage} onValueChange={setFormLanguage}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="sr">Srpski</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Tags (comma-separated)"
              value={formTags}
              onChange={(e) => setFormTags(e.target.value)}
              className="flex-1"
            />
          </div>

          <textarea
            className="w-full min-h-[300px] p-3 rounded-md border bg-background text-sm font-mono resize-y"
            placeholder="Article content (Markdown supported)"
            value={formContent}
            onChange={(e) => setFormContent(e.target.value)}
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button onClick={editingId ? handleUpdate : handleCreate}>
              {editingId ? "Save Changes" : "Create Article"}
            </Button>
          </div>
        </Card>
      )}

      {/* Article List -- grouped by original + translations */}
      {!showForm && (
        <div className="space-y-4">
          {groupedArticles === null ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : groupedArticles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No articles yet. Create one to get started.</p>
            </div>
          ) : (
            groupedArticles.map(({ original, translations }: { original: KnowledgeArticle; translations: KnowledgeArticle[] }) => (
              <Card key={original._id} className="p-4 space-y-2">
                {/* Original article row */}
                <ArticleRow
                  article={original}
                  isTranslation={false}
                  existingTranslationLangs={translations.map((t: KnowledgeArticle) => t.language)}
                  translatingId={translatingId}
                  onPublish={handlePublish}
                  onUnpublish={(id) => unpublishArticle({ articleId: id })}
                  onEdit={startEdit}
                  onDelete={handleDelete}
                  onTranslate={handleTranslate}
                />

                {/* Translation rows */}
                {translations.length > 0 && (
                  <div className="ml-6 border-l-2 border-muted pl-4 space-y-2">
                    {translations.map((t: KnowledgeArticle) => (
                      <ArticleRow
                        key={t._id}
                        article={t}
                        isTranslation={true}
                        existingTranslationLangs={[]}
                        translatingId={translatingId}
                        onPublish={handlePublish}
                        onUnpublish={(id) => unpublishArticle({ articleId: id })}
                        onEdit={startEdit}
                        onDelete={handleDelete}
                        onTranslate={handleTranslate}
                      />
                    ))}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}
    </AnimatedPage>
  );
}

function ArticleRow({
  article,
  isTranslation,
  existingTranslationLangs,
  translatingId,
  onPublish,
  onUnpublish,
  onEdit,
  onDelete,
  onTranslate,
}: {
  article: {
    _id: Id<"knowledgeArticles">;
    title: string;
    content: string;
    status: string;
    category: string;
    language: string;
    tags?: string[];
    translationOf?: Id<"knowledgeArticles">;
  };
  isTranslation: boolean;
  existingTranslationLangs: string[];
  translatingId: Id<"knowledgeArticles"> | null;
  onPublish: (id: Id<"knowledgeArticles">) => void;
  onUnpublish: (id: Id<"knowledgeArticles">) => void;
  onEdit: (article: any) => void;
  onDelete: (id: Id<"knowledgeArticles">) => void;
  onTranslate: (id: Id<"knowledgeArticles">, lang: string) => void;
}) {
  const allLangs = ["en", "de", "sr"];
  const missingLangs = isTranslation
    ? []
    : allLangs.filter((l) => l !== article.language && !existingTranslationLangs.includes(l));

  const isBeingTranslated = translatingId === article._id;
  const isPlaceholder = article.title.startsWith("[Translating...]");

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {isTranslation && (
            <Languages className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          <h3 className={`font-semibold truncate ${isPlaceholder ? "text-muted-foreground italic" : ""}`}>
            {article.title}
          </h3>
          <Badge variant={article.status === "published" ? "default" : "secondary"}>
            {article.status}
          </Badge>
          {!isTranslation && (
            <Badge variant="outline">
              {article.category === "other"
                ? (article as any).customCategory || "Other"
                : article.category}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={
              article.language === "en" ? "bg-blue-50 text-blue-700 border-blue-200"
              : article.language === "sr" ? "bg-red-50 text-red-700 border-red-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
            }
          >
            {LANG_LABELS[article.language] ?? article.language.toUpperCase()}
          </Badge>
        </div>
        {!isPlaceholder && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {article.content.slice(0, 200)}...
          </p>
        )}
        {article.tags && article.tags.length > 0 && (
          <div className="flex gap-1 mt-1">
            {article.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-1 shrink-0 items-center">
        {/* Translate buttons for missing languages */}
        {missingLangs.map((lang) => (
          <Button
            key={lang}
            variant="ghost"
            size="sm"
            className="gap-1 text-xs h-8 px-2"
            onClick={() => onTranslate(article._id, lang)}
            disabled={isBeingTranslated}
            title={`Translate to ${LANG_LABELS[lang] ?? lang}`}
          >
            {isBeingTranslated ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Languages className="h-3 w-3" />
            )}
            → {lang.toUpperCase()}
          </Button>
        ))}

        {article.status === "draft" ? (
          <Button
            variant="ghost" size="icon"
            onClick={() => onPublish(article._id)}
            title="Publish"
            disabled={isPlaceholder}
          >
            <Send className="h-4 w-4 text-green-600" />
          </Button>
        ) : (
          <Button
            variant="ghost" size="icon"
            onClick={() => onUnpublish(article._id)}
            title="Unpublish"
          >
            <Send className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={() => onEdit(article)}>
          <Pencil className="h-4 w-4" />
        </Button>
        {!isTranslation && (
          <Button variant="ghost" size="icon" onClick={() => onDelete(article._id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
}
