import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Megaphone, Eye, Trash2, Edit, Plus, Power, PowerOff, Info, AlertTriangle, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";

type BannerDoc = Doc<"systemBanners">;
type BannerVariant = "info" | "warning" | "error" | "success";

const variantIcons = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle,
};

const variantLabels = {
  info: "Info",
  warning: "Warnung",
  error: "Fehler",
  success: "Erfolg",
};

const variantColors = {
  info: "bg-blue-100 text-blue-800 border-blue-200",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
  error: "bg-red-100 text-red-800 border-red-200",
  success: "bg-green-100 text-green-800 border-green-200",
};

export default function AdminBanners() {
  const { user, loading: authLoading } = useAuth();
  const banners = useQuery(api.banners.getAllBanners) as BannerDoc[] | undefined;
  const bannersLoading = banners === undefined;

  const createMutation = useMutation(api.banners.createBanner);
  const updateMutation = useMutation(api.banners.updateBanner);
  const toggleMutation = useMutation(api.banners.toggleBannerStatus);
  const deleteMutation = useMutation(api.banners.deleteBanner);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BannerDoc | null>(null);

  const [formData, setFormData] = useState({
    message: "",
    link: "",
    linkText: "",
    variant: "info" as BannerVariant,
  });

  const resetForm = () => {
    setFormData({
      message: "",
      link: "",
      linkText: "",
      variant: "info",
    });
    setEditingBanner(null);
  };

  const handleEdit = (banner: BannerDoc) => {
    setEditingBanner(banner);
    setFormData({
      message: banner.message,
      link: banner.link || "",
      linkText: banner.linkText || "",
      variant: banner.variant,
    });
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.message.trim()) {
        toast.error("Nachricht darf nicht leer sein");
        return;
      }

      if (formData.message.length > 500) {
        toast.error("Nachricht ist zu lang (max. 500 Zeichen)");
        return;
      }

      if (editingBanner) {
        await updateMutation({
          bannerId: editingBanner._id,
          message: formData.message,
          link: formData.link || undefined,
          linkText: formData.linkText || undefined,
          variant: formData.variant,
        });
        toast.success("Banner erfolgreich aktualisiert");
      } else {
        await createMutation({
          message: formData.message,
          link: formData.link || undefined,
          linkText: formData.linkText || undefined,
          variant: formData.variant,
        });
        toast.success("Banner erfolgreich erstellt");
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Speichern");
    }
  };

  const handleToggle = async (bannerId: Id<"systemBanners">) => {
    try {
      await toggleMutation({ bannerId });
      toast.success("Banner-Status aktualisiert");
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Umschalten");
    }
  };

  const handleDelete = async (bannerId: Id<"systemBanners">) => {
    if (!confirm("Möchten Sie dieses Banner wirklich löschen?")) {
      return;
    }

    try {
      await deleteMutation({ bannerId });
      toast.success("Banner erfolgreich gelöscht");
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Löschen");
    }
  };

  if (authLoading || bannersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>Zugriff verweigert</CardTitle>
            <CardDescription>Sie haben keine Berechtigung für diese Seite.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button>Zum Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const Icon = variantIcons[formData.variant];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 md:ml-64 w-full flex flex-col">
        <main className="container py-8">
          <div className="mb-6">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Zurück zur Admin-Übersicht
              </Button>
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Banner-Verwaltung</h1>
                <p className="text-muted-foreground mt-2">
                  Erstellen und verwalten Sie System-Banner für alle Benutzer
                </p>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Neues Banner
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingBanner ? "Banner bearbeiten" : "Neues Banner erstellen"}
                    </DialogTitle>
                    <DialogDescription>
                      Erstellen Sie ein Banner, das allen Benutzern angezeigt wird
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="message">
                        Nachricht <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id="message"
                        placeholder="Geben Sie die Banner-Nachricht ein..."
                        value={formData.message}
                        onChange={(e) =>
                          setFormData({ ...formData, message: e.target.value })
                        }
                        rows={3}
                        maxLength={500}
                      />
                      <p className="text-xs text-muted-foreground">
                        {formData.message.length}/500 Zeichen
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="variant">Stil</Label>
                      <Select
                        value={formData.variant}
                        onValueChange={(value: BannerVariant) =>
                          setFormData({ ...formData, variant: value })
                        }
                      >
                        <SelectTrigger id="variant">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="info">Info (Blau)</SelectItem>
                          <SelectItem value="warning">Warnung (Gelb)</SelectItem>
                          <SelectItem value="error">Fehler (Rot)</SelectItem>
                          <SelectItem value="success">Erfolg (Grün)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="link">Link (optional)</Label>
                      <Input
                        id="link"
                        type="url"
                        placeholder="https://example.com"
                        value={formData.link}
                        onChange={(e) =>
                          setFormData({ ...formData, link: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="linkText">Link-Text (optional)</Label>
                      <Input
                        id="linkText"
                        placeholder="Mehr erfahren"
                        value={formData.linkText}
                        onChange={(e) =>
                          setFormData({ ...formData, linkText: e.target.value })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Standard: "Mehr erfahren"
                      </p>
                    </div>

                    {/* Preview */}
                    <div className="space-y-2">
                      <Label>Vorschau</Label>
                      <Alert variant={formData.variant} className="relative">
                        <Icon className="h-4 w-4" />
                        <AlertDescription className="flex items-center justify-between gap-4">
                          <div className="flex-1 flex items-center gap-3 flex-wrap">
                            <span>{formData.message || "Ihre Nachricht erscheint hier..."}</span>
                            {formData.link && (
                              <a
                                href="#"
                                onClick={(e) => e.preventDefault()}
                                className="underline underline-offset-4 hover:no-underline font-medium"
                              >
                                {formData.linkText || "Mehr erfahren"}
                              </a>
                            )}
                          </div>
                        </AlertDescription>
                      </Alert>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false);
                        resetForm();
                      }}
                    >
                      Abbrechen
                    </Button>
                    <Button onClick={handleSave}>
                      {editingBanner ? "Aktualisieren" : "Erstellen"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Banner-Liste</CardTitle>
              <CardDescription>
                {banners?.length || 0} Banner insgesamt
                {banners?.some((b) => b.isActive) && (
                  <span className="ml-2 text-green-600">
                    • 1 aktiv
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!banners || banners.length === 0 ? (
                <div className="text-center py-12">
                  <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Noch keine Banner erstellt</p>
                  <Button onClick={handleCreate} className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Erstes Banner erstellen
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Nachricht</TableHead>
                      <TableHead>Stil</TableHead>
                      <TableHead>Link</TableHead>
                      <TableHead>Erstellt</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {banners.map((banner) => (
                      <TableRow key={banner._id}>
                        <TableCell>
                          {banner.isActive ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                              Aktiv
                            </Badge>
                          ) : (
                            <Badge variant="outline">Inaktiv</Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="truncate">{banner.message}</div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={variantColors[banner.variant]}
                          >
                            {variantLabels[banner.variant]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {banner.link ? (
                            <a
                              href={banner.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-sm"
                            >
                              Link
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(banner.createdAt).toLocaleDateString("de-DE")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggle(banner._id)}
                              title={
                                banner.isActive ? "Deaktivieren" : "Aktivieren"
                              }
                            >
                              {banner.isActive ? (
                                <PowerOff className="h-4 w-4" />
                              ) : (
                                <Power className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(banner)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(banner._id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
    </div>
  );
}
