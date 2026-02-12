import { useAuth } from "@/_core/hooks/useAuth";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Link, useParams } from "wouter";
import { ArrowLeft, ThumbsUp, Shield } from "lucide-react";
import { formatDateTimeEU } from "@/lib/utils";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const LIVE_STATUSES = new Set(["on_todo_list", "im_working_on_it", "shipped"]);

function statusBadgeClass(status: string) {
  switch (status) {
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

export default function WishlistItem() {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  const params = useParams();
  const id = params.id as Id<"wishlistItems">;

  const data = useQuery(api.wishlist.getWishlistItem, { id }) as
    | { item: any; myHasUpvoted: boolean; canUpvote: boolean }
    | null
    | undefined;

  const toggleUpvote = useMutation(api.wishlist.toggleUpvote);
  const updateStatus = useMutation(api.wishlist.updateWishlistStatus);

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const item = data?.item;
  const myHasUpvoted = Boolean(data?.myHasUpvoted);
  const canUpvote = Boolean(data?.canUpvote);
  const isLive = LIVE_STATUSES.has(String(item?.status || ""));

  const [adminStatus, setAdminStatus] = useState<string>("submitted");
  const [adminNote, setAdminNote] = useState<string>("");
  const [duplicateOfId, setDuplicateOfId] = useState<string>("");
  const [adminSaving, setAdminSaving] = useState(false);
  const [voteBusy, setVoteBusy] = useState(false);

  const duplicateTargetId = useMemo(() => {
    const raw = String(item?.duplicateOfWishlistItemId || "").trim();
    return raw || "";
  }, [item?.duplicateOfWishlistItemId]);

  // Initialize admin fields when item loads/changes
  useEffect(() => {
    if (!item) return;
    setAdminStatus(String(item.status || "submitted"));
    setAdminNote(String(item.adminStatusNote || ""));
    setDuplicateOfId(String(item.duplicateOfWishlistItemId || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?._id]);

  if (loading || data === undefined) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{t("wishlist.loginRequired.title")}</CardTitle>
            <CardDescription>{t("wishlistItem.loginRequired.desc")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case "submitted":
        return t("wishlist.status.submitted");
      case "in_review":
        return t("wishlist.status.inReview");
      case "on_todo_list":
        return t("wishlist.status.onTodoList");
      case "im_working_on_it":
        return t("wishlist.status.imWorkingOnIt");
      case "shipped":
        return t("wishlist.status.shipped");
      case "duplicate":
        return t("wishlist.status.duplicate");
      case "rejected":
        return t("wishlist.status.rejected");
      default:
        return status;
    }
  };

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("wishlistItem.notFound.title")}</CardTitle>
            <CardDescription>{t("wishlistItem.notFound.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/wishlist">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("wishlist.backToList")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/wishlist">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("common.back")}
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-2xl">{item.title}</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2">
                <Badge className={statusBadgeClass(item.status)}>{statusLabel(item.status)}</Badge>
                {isLive ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-[0_0_10px_rgba(16,185,129,0.6)]">
                    {t("wishlist.live")}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow-[0_0_10px_rgba(220,38,38,0.55)]">
                    {t("wishlist.notLive")}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {t("wishlistItem.createdAtLabel")} {item.createdAt ? formatDateTimeEU(item.createdAt) : "—"}
                </span>
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{item.upvoteCount || 0}</div>
              <div className="text-xs text-muted-foreground">{t("wishlist.table.votes")}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="whitespace-pre-wrap text-sm">{item.description}</div>

          {(item.status === "duplicate" || item.status === "rejected") && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              {item.adminStatusNote ? (
                <div className="whitespace-pre-wrap">{String(item.adminStatusNote)}</div>
              ) : (
                <div className="text-muted-foreground">{t("wishlistItem.noNote")}</div>
              )}
              {item.status === "duplicate" && duplicateTargetId && (
                <div className="mt-2">
                  <Link href={`/wishlist/${duplicateTargetId}`}>
                    <Button variant="outline" size="sm">
                      {t("wishlistItem.viewCanonical")}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              onClick={async () => {
                try {
                  setVoteBusy(true);
                  const res = await toggleUpvote({ wishlistItemId: item._id });
                  toast.success(res.upvoted ? t("wishlistItem.toast.upvoted") : t("wishlistItem.toast.upvoteRemoved"));
                } catch (e: any) {
                  toast.error(e?.message || t("wishlistItem.toast.upvoteFailed"));
                } finally {
                  setVoteBusy(false);
                }
              }}
              disabled={voteBusy || !canUpvote}
            >
              <ThumbsUp className="mr-2 h-4 w-4" />
              {myHasUpvoted ? t("wishlistItem.upvote.remove") : t("wishlistItem.upvote.add")}
            </Button>
            {!canUpvote && (
              <span className="text-xs text-muted-foreground">
                {t("wishlistItem.upvote.disabledHint")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {t("wishlistItem.admin.title")}
            </CardTitle>
            <CardDescription>{t("wishlistItem.admin.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("wishlistItem.admin.statusLabel")}</Label>
              <Select value={adminStatus} onValueChange={setAdminStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="submitted">{t("wishlist.status.submitted")}</SelectItem>
                  <SelectItem value="in_review">{t("wishlist.status.inReview")}</SelectItem>
                  <SelectItem value="on_todo_list">{t("wishlist.status.onTodoList")}</SelectItem>
                  <SelectItem value="im_working_on_it">{t("wishlist.status.imWorkingOnIt")}</SelectItem>
                  <SelectItem value="shipped">{t("wishlist.status.shipped")}</SelectItem>
                  <SelectItem value="duplicate">{t("wishlist.status.duplicate")}</SelectItem>
                  <SelectItem value="rejected">{t("wishlist.status.rejected")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {adminStatus === "duplicate" && (
              <div className="space-y-2">
                <Label htmlFor="duplicateOf">{t("wishlistItem.admin.duplicateOfLabel")}</Label>
                <Input
                  id="duplicateOf"
                  value={duplicateOfId}
                  onChange={(e) => setDuplicateOfId(e.target.value)}
                  placeholder={t("wishlistItem.admin.duplicateOfPlaceholder")}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="adminNote">{t("wishlistItem.admin.noteLabel")}</Label>
              <Textarea
                id="adminNote"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={4}
                placeholder={t("wishlistItem.admin.notePlaceholder")}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={async () => {
                  try {
                    setAdminSaving(true);
                    await updateStatus({
                      id: item._id,
                      status: adminStatus as any,
                      adminStatusNote: adminNote.trim() ? adminNote.trim() : undefined,
                      duplicateOfWishlistItemId:
                        adminStatus === "duplicate" && duplicateOfId.trim()
                          ? (duplicateOfId.trim() as any)
                          : undefined,
                    });
                    toast.success(t("wishlist.toast.updated"));
                  } catch (e: any) {
                    toast.error(e?.message || t("wishlist.toast.updateFailed"));
                  } finally {
                    setAdminSaving(false);
                  }
                }}
                disabled={adminSaving}
              >
                {adminSaving ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

