import { useAuth } from "@/_core/hooks/useAuth";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "wouter";
import { ListTodo, ArrowRight } from "lucide-react";
import { formatDateTimeEU } from "@/lib/utils";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type WishlistItemDoc = Doc<"wishlistItems">;

const LIVE_STATUSES = new Set(["on_todo_list", "im_working_on_it", "shipped"]);

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

function preview(text: string, max = 160) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max).trimEnd() + "…";
}

export default function Wishlist() {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  const [sort, setSort] = useState<"newest" | "top">("newest");

  const items = useQuery(api.wishlist.listWishlistItems, {
    sort,
    includeMyNonPublic: true,
    includeDuplicate: false,
    includeRejected: false,
  }) as WishlistItemDoc[] | undefined;

  const isLoading = loading || items === undefined;

  const hasMyNonPublic = useMemo(() => {
    if (!user || !items) return false;
    return items.some((i) => i.createdBy === user._id && (i.status === "submitted" || i.status === "in_review"));
  }, [items, user]);

  if (isLoading) {
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
            <CardDescription>{t("wishlist.loginRequired.desc")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case "pending":
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

  return (
    <div className="container py-8 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <ListTodo className="h-7 w-7 text-primary" />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">{t("wishlist.title")}</h1>
          </div>
          <p className="text-sm md:text-base text-muted-foreground max-w-3xl">
            {t("wishlist.subtitle")}
          </p>
          <div>
            <Link href="/wishlist/new">
              <Button variant="outline">
                {t("wishlist.submitCta")} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          {hasMyNonPublic && (
            <p className="text-xs text-muted-foreground">
              {t("wishlist.noteMyNonPublic")}
            </p>
          )}
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{t("wishlist.suggestions.title")}</CardTitle>
              <CardDescription>{t("wishlist.suggestions.desc")}</CardDescription>
            </div>
            <div className="w-[220px]">
              <Select value={sort} onValueChange={(v) => setSort(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("wishlist.sort.placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t("wishlist.sort.newest")}</SelectItem>
                  <SelectItem value="top">{t("wishlist.sort.top")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("wishlist.table.suggestion")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("wishlist.table.live")}</TableHead>
                    <TableHead className="text-right">{t("wishlist.table.votes")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("wishlist.table.created")}</TableHead>
                    <TableHead className="text-right">{t("wishlist.table.details")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(items || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        {t("wishlist.empty")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    (items || []).map((item) => (
                      <TableRow key={item._id}>
                        <TableCell>
                          <div className="font-medium">{item.title}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {preview(item.description)}
                          </div>
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs">
                              {statusLabel(item.status)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {LIVE_STATUSES.has(String(item.status)) ? (
                            <span
                              className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-[0_0_10px_rgba(16,185,129,0.6)]"
                              aria-label={t("wishlist.liveAria")}
                            >
                              {t("wishlist.live")}
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow-[0_0_10px_rgba(220,38,38,0.55)]"
                              aria-label={t("wishlist.notLiveAria")}
                            >
                              {t("wishlist.notLive")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{item.upvoteCount || 0}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {item.createdAt ? formatDateTimeEU(item.createdAt) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/wishlist/${item._id}`}>
                            <Button variant="outline" size="sm">
                              {t("wishlist.view")}
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

