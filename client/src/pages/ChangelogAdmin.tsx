import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { formatDateEU } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type CategoryType = "added" | "changed" | "fixed" | "removed";
type EnvironmentType = "beta" | "production" | "staging";
type LanguageType = "en" | "de";

const categoryColors: Record<CategoryType, string> = {
  added: "bg-green-100 text-green-800 border-green-300",
  changed: "bg-blue-100 text-blue-800 border-blue-300",
  fixed: "bg-orange-100 text-orange-800 border-orange-300",
  removed: "bg-red-100 text-red-800 border-red-300",
};

const categoryLabels: Record<CategoryType, string> = {
  added: "Added",
  changed: "Changed",
  fixed: "Fixed",
  removed: "Removed",
};

export default function ChangelogAdmin() {
  const { t } = useTranslation();
  const versions = useQuery(api.versions.getAllVersions, { limit: 50 });
  const [selectedVersionId, setSelectedVersionId] = useState<Id<"appVersions"> | null>(null);
  const [newVersionDialogOpen, setNewVersionDialogOpen] = useState(false);
  const [newEntryDialogOpen, setNewEntryDialogOpen] = useState(false);
  const [editEntryDialogOpen, setEditEntryDialogOpen] = useState(false);
  const [deleteEntryDialogOpen, setDeleteEntryDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<Id<"changelogEntries"> | null>(null);
  const [editingEntry, setEditingEntry] = useState<any>(null);

  // New version form state
  const [newVersion, setNewVersion] = useState("");
  const [newEnvironment, setNewEnvironment] = useState<EnvironmentType>("beta");

  // New entry form state
  const [entryCategory, setEntryCategory] = useState<CategoryType>("added");
  const [entryTitle, setEntryTitle] = useState("");
  const [entryDescription, setEntryDescription] = useState("");
  const [entryLanguage, setEntryLanguage] = useState<LanguageType>("en");

  const createVersionMutation = useMutation(api.versions.createVersion);
  const addChangelogEntryMutation = useMutation(api.versions.addChangelogEntry);
  const updateChangelogEntryMutation = useMutation(api.versions.updateChangelogEntry);
  const deleteChangelogEntryMutation = useMutation(api.versions.deleteChangelogEntry);

  const versionWithChangelog = useQuery(
    api.versions.getVersionWithChangelog,
    selectedVersionId ? { versionId: selectedVersionId } : "skip"
  );

  const handleCreateVersion = async () => {
    try {
      const versionId = await createVersionMutation({
        version: newVersion,
        environment: newEnvironment,
      });
      toast.success(t("admin.changelog.toastVersionCreated", { version: newVersion }));
      setNewVersionDialogOpen(false);
      setNewVersion("");
      setNewEnvironment("beta");
      setSelectedVersionId(versionId);
    } catch (error: any) {
      toast.error(error.message || t("admin.changelog.toastVersionCreateFailed"));
    }
  };

  const handleAddEntry = async () => {
    if (!selectedVersionId) {
      toast.error(t("admin.changelog.toastSelectVersionFirst"));
      return;
    }

    try {
      await addChangelogEntryMutation({
        versionId: selectedVersionId,
        category: entryCategory,
        title: entryTitle,
        description: entryDescription || undefined,
        language: entryLanguage,
      });
      toast.success(t("admin.changelog.toastEntryAdded"));
      setNewEntryDialogOpen(false);
      setEntryTitle("");
      setEntryDescription("");
      setEntryCategory("added");
      setEntryLanguage("en");
    } catch (error: any) {
      toast.error(error.message || t("admin.changelog.toastEntryAddFailed"));
    }
  };

  const handleUpdateEntry = async () => {
    if (!editingEntry) return;

    try {
      await updateChangelogEntryMutation({
        entryId: editingEntry._id,
        title: entryTitle,
        description: entryDescription || undefined,
        category: entryCategory,
      });
      toast.success(t("admin.changelog.toastEntryUpdated"));
      setEditEntryDialogOpen(false);
      setEditingEntry(null);
      setEntryTitle("");
      setEntryDescription("");
      setEntryCategory("added");
    } catch (error: any) {
      toast.error(error.message || t("admin.changelog.toastEntryUpdateFailed"));
    }
  };

  const handleDeleteEntry = async () => {
    if (!entryToDelete) return;

    try {
      await deleteChangelogEntryMutation({ entryId: entryToDelete });
      toast.success(t("admin.changelog.toastEntryDeleted"));
      setDeleteEntryDialogOpen(false);
      setEntryToDelete(null);
    } catch (error: any) {
      toast.error(error.message || t("admin.changelog.toastEntryDeleteFailed"));
    }
  };

  const openEditDialog = (entry: any) => {
    setEditingEntry(entry);
    setEntryTitle(entry.title);
    setEntryDescription(entry.description || "");
    setEntryCategory(entry.category);
    setEditEntryDialogOpen(true);
  };

  const openDeleteDialog = (entryId: Id<"changelogEntries">) => {
    setEntryToDelete(entryId);
    setDeleteEntryDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Changelog Management</h1>
          <p className="text-muted-foreground">Manage app versions and changelog entries</p>
        </div>
        <Dialog open={newVersionDialogOpen} onOpenChange={setNewVersionDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Version
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Version</DialogTitle>
              <DialogDescription>
                Create a new version following semantic versioning (e.g., 1.0.0)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="version">Version Number</Label>
                <Input
                  id="version"
                  placeholder="1.0.0"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Format: MAJOR.MINOR.PATCH (e.g., 1.0.0, 2.1.3)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="environment">Environment</Label>
                <Select value={newEnvironment} onValueChange={(v) => setNewEnvironment(v as EnvironmentType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beta">Beta</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewVersionDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateVersion} disabled={!newVersion.match(/^\d+\.\d+\.\d+$/)}>
                Create Version
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Versions List */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Versions</CardTitle>
            <CardDescription>Select a version to manage its changelog</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {versions?.versions.map((version) => (
                <button
                  key={version._id}
                  onClick={() => setSelectedVersionId(version._id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedVersionId === version._id
                      ? "bg-primary/10 border-primary"
                      : "hover:bg-accent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">v{version.version}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {version.environment}
                      </div>
                    </div>
                    {version.isCurrent && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDateEU(version.releaseDate)}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Changelog Entries */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {selectedVersionId && versionWithChangelog
                    ? `Changelog for v${versionWithChangelog.version.version}`
                    : "Select a Version"}
                </CardTitle>
                <CardDescription>Manage changelog entries for this version</CardDescription>
              </div>
              {selectedVersionId && (
                <Dialog open={newEntryDialogOpen} onOpenChange={setNewEntryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Entry
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Changelog Entry</DialogTitle>
                      <DialogDescription>
                        Add a new entry to the changelog for this version
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Select value={entryCategory} onValueChange={(v) => setEntryCategory(v as CategoryType)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="added">Added</SelectItem>
                            <SelectItem value="changed">Changed</SelectItem>
                            <SelectItem value="fixed">Fixed</SelectItem>
                            <SelectItem value="removed">Removed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="language">Language</Label>
                        <Select value={entryLanguage} onValueChange={(v) => setEntryLanguage(v as LanguageType)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="de">German</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input
                          id="title"
                          placeholder="Brief description"
                          value={entryTitle}
                          onChange={(e) => setEntryTitle(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Description (Optional)</Label>
                        <Textarea
                          id="description"
                          placeholder="Detailed description"
                          value={entryDescription}
                          onChange={(e) => setEntryDescription(e.target.value)}
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setNewEntryDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddEntry} disabled={!entryTitle}>
                        Add Entry
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedVersionId ? (
              <div className="text-center py-12 text-muted-foreground">
                Select a version to view and manage its changelog entries
              </div>
            ) : versionWithChangelog?.entries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No changelog entries yet. Add your first entry above.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versionWithChangelog?.entries.map((entry) => (
                    <TableRow key={entry._id}>
                      <TableCell>
                        <Badge className={categoryColors[entry.category as CategoryType]}>
                          {categoryLabels[entry.category as CategoryType]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.language.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{entry.title}</div>
                          {entry.description && (
                            <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                              {entry.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.creatorName}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(entry)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openDeleteDialog(entry._id)}
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
      </div>

      {/* Edit Entry Dialog */}
      <Dialog open={editEntryDialogOpen} onOpenChange={setEditEntryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Changelog Entry</DialogTitle>
            <DialogDescription>Update the changelog entry details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category</Label>
              <Select value={entryCategory} onValueChange={(v) => setEntryCategory(v as CategoryType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="added">Added</SelectItem>
                  <SelectItem value="changed">Changed</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="removed">Removed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={entryTitle}
                onChange={(e) => setEntryTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Textarea
                id="edit-description"
                value={entryDescription}
                onChange={(e) => setEntryDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateEntry} disabled={!entryTitle}>
              Update Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Entry Confirmation Dialog */}
      <AlertDialog open={deleteEntryDialogOpen} onOpenChange={setDeleteEntryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Changelog Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this changelog entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEntry}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
