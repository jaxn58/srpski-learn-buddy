import { useAuth } from "@/_core/hooks/useAuth";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ListTodo } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";

type WishlistFormState = {
  title: string;
  description: string;
};

const TITLE_MIN = 10;
const DESCRIPTION_MIN = 50;

function formatRemainingTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatNextAllowedAt(ts: number) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(ts)
    );
  } catch {
    // Fallback for environments without full Intl support.
    return new Date(ts).toLocaleString();
  }
}

export default function WishlistNew() {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const createWishlistItem = useMutation(api.wishlist.createWishlistItem);
  const cooldown = useQuery(api.wishlist.getMySubmitCooldown);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const [form, setForm] = useState<WishlistFormState>({ title: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Live countdown while blocked.
  useEffect(() => {
    if (!cooldown?.isBlocked || !cooldown?.nextAllowedAt) return;
    const id = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [cooldown?.isBlocked, cooldown?.nextAllowedAt]);

  const titleLen = form.title.trim().length;
  const descriptionLen = form.description.trim().length;
  const titleMissing = submitAttempted && titleLen === 0;
  const titleTooShort = submitAttempted && titleLen > 0 && titleLen < TITLE_MIN;
  const descriptionMissing = submitAttempted && descriptionLen === 0;
  const descriptionTooShort = submitAttempted && descriptionLen > 0 && descriptionLen < DESCRIPTION_MIN;
  const titleError = titleMissing || titleTooShort;
  const descriptionError = descriptionMissing || descriptionTooShort;
  const requiredMark = useMemo(() => <span className="text-destructive">*</span>, []);

  if (loading) {
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
            <CardTitle>{t("wishlistNew.loginRequired.title")}</CardTitle>
            <CardDescription>{t("wishlistNew.loginRequired.desc")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // While the cooldown query is loading, avoid rendering the form to prevent
  // the user from typing and then being blocked on submit.
  if (cooldown === undefined) {
    return (
      <div className="container py-8 md:py-10">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <ListTodo className="h-7 w-7 text-primary" />
              <div>
                <h1 className="text-3xl md:text-4xl font-bold">{t("wishlistNew.title")}</h1>
                <p className="text-sm text-muted-foreground">{t("wishlistNew.checking")}</p>
              </div>
            </div>
            <Link href="/wishlist">
              <Button variant="outline">{t("wishlistNew.backToWishlist")}</Button>
            </Link>
          </div>

          <Card className="shadow-sm">
            <CardContent className="py-10">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const remainingMs = cooldown?.nextAllowedAt ? Math.max(0, cooldown.nextAllowedAt - nowTs) : 0;
  const remainingLabel = formatRemainingTime(remainingMs);
  const nextAllowedAtLabel = cooldown?.nextAllowedAt ? formatNextAllowedAt(cooldown.nextAllowedAt) : null;

  if (cooldown?.isBlocked) {
    return (
      <div className="container py-8 md:py-10">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <ListTodo className="h-7 w-7 text-primary" />
              <div>
                <h1 className="text-3xl md:text-4xl font-bold">{t("wishlistNew.title")}</h1>
                <p className="text-sm text-muted-foreground">{t("wishlistNew.cooldown.subtitle")}</p>
              </div>
            </div>
            <Link href="/wishlist">
              <Button variant="outline">{t("wishlistNew.backToWishlist")}</Button>
            </Link>
          </div>

          <Card className="shadow-sm border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle>{t("wishlistNew.cooldown.cardTitle")}</CardTitle>
              <CardDescription>
                {t("wishlistNew.cooldown.cardDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm">
                  {t("wishlistNew.cooldown.canSubmitAgainInPrefix")}{" "}
                  <span className="font-semibold">{remainingLabel}</span>.
                </p>
                {nextAllowedAtLabel && (
                  <p className="text-xs text-muted-foreground">
                    {t("wishlistNew.cooldown.nextAllowedAtPrefix")}{" "}
                    <span className="font-medium text-foreground">{nextAllowedAtLabel}</span>
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t("wishlistNew.cooldown.tip")}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getUserFriendlySubmitError = (err: unknown): { title: string; description?: string } => {
    const raw =
      err && typeof err === "object" && "message" in err && typeof (err as any).message === "string"
        ? String((err as any).message)
        : "";

    if (raw.includes("Rate limit:")) {
      return {
        title: t("wishlistNew.error.rateLimit.title"),
        description: t("wishlistNew.error.rateLimit.desc"),
      };
    }

    if (raw.includes("A similar wishlist item already exists")) {
      return {
        title: t("wishlistNew.error.similar.title"),
        description: t("wishlistNew.error.similar.desc"),
      };
    }

    if (raw.includes("Title is too short")) {
      return {
        title: t("wishlistNew.error.titleTooShort.title"),
        description: t("wishlistNew.error.titleTooShort.desc", { min: TITLE_MIN }),
      };
    }

    if (raw.includes("Description is too short")) {
      return {
        title: t("wishlistNew.error.descTooShort.title"),
        description: t("wishlistNew.error.descTooShort.desc", { min: DESCRIPTION_MIN }),
      };
    }

    return {
      title: t("wishlistNew.error.generic.title"),
      description: t("wishlistNew.error.generic.desc"),
    };
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);

    const title = form.title.trim();
    const description = form.description.trim();
    const missingTitle = title.length === 0;
    const missingDescription = description.length === 0;
    const shortTitle = title.length > 0 && title.length < TITLE_MIN;
    const shortDescription = description.length > 0 && description.length < DESCRIPTION_MIN;

    if (missingTitle || missingDescription || shortTitle || shortDescription) {
      toast.error(t("wishlistNew.toast.fixFields"));
      const focusId = missingTitle || shortTitle ? "wishlist-title" : "wishlist-description";
      const el = document.getElementById(focusId) as HTMLElement | null;
      el?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      (el as any)?.focus?.();
      return;
    }

    setSubmitting(true);
    try {
      await createWishlistItem({ title, description });
      toast.success(t("wishlistNew.toast.submitted.title"), {
        description: t("wishlistNew.toast.submitted.desc"),
        duration: 6000,
      });
      setForm({ title: "", description: "" });
      setSubmitAttempted(false);
      setLocation("/wishlist");
    } catch (e: any) {
      const msg = getUserFriendlySubmitError(e);
      toast.error(msg.title, { description: msg.description, duration: 8000 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-8 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <ListTodo className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">{t("wishlistNew.title")}</h1>
              <p className="text-sm text-muted-foreground">
                {t("wishlistNew.subtitle")}
              </p>
            </div>
          </div>
          <Link href="/wishlist">
            <Button variant="outline">{t("wishlistNew.backToWishlist")}</Button>
          </Link>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("wishlistNew.form.cardTitle")}</CardTitle>
            <CardDescription>
              {t("wishlistNew.form.cardDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-5">
              <p className="text-xs text-muted-foreground">
                <span className="text-destructive">*</span> {t("wishlistNew.form.requiredHint")}
              </p>

              <div className="space-y-2">
                <Label htmlFor="wishlist-title">
                  {t("wishlistNew.form.titleLabel")} {requiredMark}{" "}
                  <span className="text-xs text-muted-foreground">{t("wishlistNew.form.minHint", { min: TITLE_MIN })}</span>
                </Label>
                <Input
                  id="wishlist-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  disabled={submitting}
                  maxLength={200}
                  minLength={TITLE_MIN}
                  required
                  aria-invalid={titleError}
                  aria-describedby={titleError ? "wishlist-title-error" : undefined}
                  placeholder={t("wishlistNew.form.titlePlaceholder")}
                />
                {titleError && (
                  <p id="wishlist-title-error" className="text-xs text-destructive">
                    {titleMissing
                      ? t("wishlistNew.form.requiredField")
                      : t("wishlistNew.form.minChars", { min: TITLE_MIN })}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{form.title.length}/200</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wishlist-description">
                  {t("wishlistNew.form.descriptionLabel")} {requiredMark}{" "}
                  <span className="text-xs text-muted-foreground">{t("wishlistNew.form.minHint", { min: DESCRIPTION_MIN })}</span>
                </Label>
                <Textarea
                  id="wishlist-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  disabled={submitting}
                  rows={6}
                  className="resize-none"
                  maxLength={5000}
                  minLength={DESCRIPTION_MIN}
                  required
                  aria-invalid={descriptionError}
                  aria-describedby={descriptionError ? "wishlist-description-error" : undefined}
                  placeholder={t("wishlistNew.form.descriptionPlaceholder")}
                />
                {descriptionError && (
                  <p id="wishlist-description-error" className="text-xs text-destructive">
                    {descriptionMissing
                      ? t("wishlistNew.form.requiredField")
                      : t("wishlistNew.form.minChars", { min: DESCRIPTION_MIN })}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{form.description.length}/5000</p>
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting ? t("wishlistNew.form.submitting") : t("wishlistNew.form.submit")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

