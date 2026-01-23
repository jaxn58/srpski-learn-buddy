import { useAuth } from "@/_core/hooks/useAuth";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Eye } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { formatDateTimeEU } from "@/lib/utils";
import { useEffect, useState } from "react";

type ReviewRow = {
  _id: Id<"wishlistItems">;
  title: string;
  description: string;
  status: string;
  createdAt: number;
  upvoteCount: number;
  createdBy: Id<"users">;
  submitterName?: string;
  submitterEmail?: string;
  adminStatusNote?: string;
  duplicateOfWishlistItemId?: Id<"wishlistItems">;
};

function statusLabel(status: string) {
  switch (status) {
    case "pending":
    case "submitted":
      return "Submitted";
    case "in_review":
      return "In review";
    case "on_todo_list":
      return "On to-do list";
    case "im_working_on_it":
      return "I'm working on it";
    case "shipped":
      return "Shipped";
    case "duplicate":
      return "Duplicate";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "pending":
    case "submitted":
      return "bg-blue-100 text-blue-800";
    case "in_review":
      return "bg-yellow-100 text-yellow-800";
    case "on_todo_list":
      return "bg-purple-100 text-purple-800";
    case "im_working_on_it":
      return "bg-emerald-100 text-emerald-800";
    case "shipped":
      return "bg-green-100 text-green-800";
    case "duplicate":
      return "bg-gray-100 text-gray-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default function WishlistManagement() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [showAll, setShowAll] = useState(true);
  const rows = useQuery(api.wishlist.listReviewQueue, isAdmin ? { includeAll: showAll } : "skip") as ReviewRow[] | undefined;

  const updateStatus = useMutation(api.wishlist.updateWishlistStatus);

  const [selected, setSelected] = useState<ReviewRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [status, setStatus] = useState<string>("submitted");
  const [note, setNote] = useState<string>("");
  const [duplicateOf, setDuplicateOf] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selected) return;
    const normalized = String(selected.status || "submitted") === "pending" ? "submitted" : String(selected.status || "submitted");
    setStatus(normalized);
    setNote(String(selected.adminStatusNote || ""));
    setDuplicateOf(String(selected.duplicateOfWishlistItemId || ""));
  }, [selected]);

  if (authLoading || (isAdmin && rows === undefined)) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to access this page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button variant="outline">Go to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Wishlist Management</h1>
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
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Review Queue</CardTitle>
              <CardDescription>
                {showAll ? "All wishlist items." : "Items in submitted or in review."}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="show-all" className="text-sm cursor-pointer">
                Show all items
              </Label>
              <input
                id="show-all"
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Submitter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No items in review.
                    </TableCell>
                  </TableRow>
                ) : (
                  (rows || []).map((r) => (
                    <TableRow key={r._id}>
                      <TableCell>
                        <div className="font-medium">{r.title}</div>
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {r.description}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{r.submitterName || "Unknown"}</div>
                        {r.submitterEmail ? (
                          <div className="text-xs text-muted-foreground">{r.submitterEmail}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.createdAt ? formatDateTimeEU(r.createdAt) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/wishlist/${r._id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>

                          <Dialog
                            open={dialogOpen && selected?._id === r._id}
                            onOpenChange={(open) => {
                              setDialogOpen(open);
                              if (open) setSelected(r);
                              else setSelected(null);
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelected(r);
                                  setDialogOpen(true);
                                }}
                              >
                                Review
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="!w-[95vw] !max-w-[900px] max-h-[85vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>{r.title}</DialogTitle>
                                <DialogDescription>
                                  Submitted by {r.submitterName || "Unknown"} on{" "}
                                  {r.createdAt ? formatDateTimeEU(r.createdAt) : "—"}
                                </DialogDescription>
                              </DialogHeader>

                              <div className="space-y-4">
                                <div className="text-sm whitespace-pre-wrap">{r.description}</div>

                                <div className="space-y-2">
                                  <Label>Status</Label>
                                  <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="submitted">Submitted</SelectItem>
                                      <SelectItem value="in_review">In review</SelectItem>
                                      <SelectItem value="on_todo_list">On to-do list</SelectItem>
                                      <SelectItem value="im_working_on_it">I'm working on it</SelectItem>
                                      <SelectItem value="shipped">Shipped</SelectItem>
                                      <SelectItem value="duplicate">Duplicate</SelectItem>
                                      <SelectItem value="rejected">Rejected</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {status === "duplicate" && (
                                  <div className="space-y-2">
                                    <Label htmlFor="duplicateOf">Duplicate of (wishlist item id)</Label>
                                    <Input
                                      id="duplicateOf"
                                      value={duplicateOf}
                                      onChange={(e) => setDuplicateOf(e.target.value)}
                                      placeholder="e.g. wli_..."
                                    />
                                  </div>
                                )}

                                <div className="space-y-2">
                                  <Label htmlFor="note">Admin note (optional)</Label>
                                  <Textarea
                                    id="note"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    rows={4}
                                    placeholder="Short explanation (English)."
                                  />
                                </div>

                                <div className="flex items-center gap-2">
                                  <Button
                                    onClick={async () => {
                                      if (!selected) return;
                                      try {
                                        setSaving(true);
                                        await updateStatus({
                                          id: selected._id,
                                          status: status as any,
                                          adminStatusNote: note.trim() ? note.trim() : undefined,
                                          duplicateOfWishlistItemId:
                                            status === "duplicate" && duplicateOf.trim()
                                              ? (duplicateOf.trim() as any)
                                              : undefined,
                                        });
                                        toast.success("Wishlist item updated");
                                        setDialogOpen(false);
                                        setSelected(null);
                                      } catch (e: any) {
                                        toast.error(e?.message || "Failed to update wishlist item");
                                      } finally {
                                        setSaving(false);
                                      }
                                    }}
                                    disabled={saving}
                                  >
                                    {saving ? "Saving..." : "Save"}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
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

