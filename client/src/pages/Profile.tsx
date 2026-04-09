import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { UserCircle } from "lucide-react";
import { MySubscriptionContent } from "./MySubscription";
import { GamificationModal } from "@/components/GamificationModal";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  type SessionPreference,
  getSessionPreference,
  setSessionPreference,
} from "@/lib/sessionPreference";

const AVATAR_MAX_INPUT_BYTES = 2 * 1024 * 1024; // 2 MB
const AVATAR_TARGET_SIZE = 256; // px (square)


function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function processAvatarImage(file: File): Promise<Blob> {
  // Crop to square + downscale to target size to save storage.
  // Use WebP if supported; fallback to JPEG.
  const bitmap = await createImageBitmap(file);

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_TARGET_SIZE;
  canvas.height = AVATAR_TARGET_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Image processing failed (no canvas context).");
  }

  // "Cover" crop: scale to fill and crop the overflow.
  const scale = Math.max(AVATAR_TARGET_SIZE / bitmap.width, AVATAR_TARGET_SIZE / bitmap.height);
  const drawW = bitmap.width * scale;
  const drawH = bitmap.height * scale;
  const dx = (AVATAR_TARGET_SIZE - drawW) / 2;
  const dy = (AVATAR_TARGET_SIZE - drawH) / 2;

  ctx.clearRect(0, 0, AVATAR_TARGET_SIZE, AVATAR_TARGET_SIZE);
  ctx.drawImage(bitmap, dx, dy, drawW, drawH);

  // Try WebP first (smaller), fallback to JPEG.
  const webp = await canvasToBlob(canvas, "image/webp", 0.82);
  if (webp) return webp;

  const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.85);
  if (jpeg) return jpeg;

  throw new Error("Image processing failed (encoding).");
}

export default function Profile() {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  const { setLanguage } = useLanguage();
  const updatePublicProfile = useMutation(api.users.updatePublicProfile);
  const updateLearningLanguage = useMutation(api.users.updateLearningLanguage);
  const generateAvatarUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const setPublicAvatarFromUpload = useMutation(api.users.setPublicAvatarFromUpload);
  const myAvatar = useQuery(api.users.getMyPublicAvatarUrl, user ? {} : "skip");
  const communityStatus = useQuery(api.newsletter.getMyCommunityUpdatesStatus, user ? {} : "skip");

  const requestCommunityOptIn = useMutation(api.newsletter.requestCommunityUpdatesDoubleOptIn);
  const unsubscribeCommunity = useMutation(api.newsletter.unsubscribeMyCommunityUpdates);

  const [nickname, setNickname] = useState("");
  // `avatarPreviewUrl` is for display only (may be a signed, expiring URL)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  // `avatarUrlInput` is a manual override (Advanced) that can be persisted
  const [avatarUrlInput, setAvatarUrlInput] = useState("");
  const [publicEnabled, setPublicEnabled] = useState(false);
  const [onboardingEnabled, setOnboardingEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [languageSaving, setLanguageSaving] = useState(false);
  const [uiLanguage, setUiLanguage] = useState<"en" | "de">("en");
  const [sessionPref, setSessionPref] = useState<SessionPreference>(getSessionPreference);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!user) return;
    setNickname(user.publicNickname ?? "");
    setAvatarUrlInput(user.publicAvatarUrl ?? "");
    setPublicEnabled(user.leaderboardPublicEnabled ?? false);
    setUiLanguage(user.learningLanguage === "de" ? "de" : "en");

    // Onboarding toggle is currently controlled via localStorage in Dashboard.tsx.
    // If the key exists, onboarding is disabled.
    const disabled = localStorage.getItem(`onboarding_disabled_${user._id}`) === "true";
    setOnboardingEnabled(!disabled);
  }, [user]);

  useEffect(() => {
    if (myAvatar === undefined) return;
    const url = myAvatar?.url ?? "";
    setAvatarPreviewUrl(url);
  }, [myAvatar]);

  const canEnablePublic = useMemo(() => {
    const nickOk = nickname.trim().replace(/\s+/g, " ").length >= 2;
    // IMPORTANT: Do not depend on myAvatar loading state (query can be undefined briefly).
    // Use stable persisted fields from the DB user. This avoids a race-condition where
    // the toggle gets auto-disabled on first render even though an avatar exists.
    const hasPersistedAvatar =
      Boolean(user?.publicAvatarStorageId) || Boolean((user?.publicAvatarUrl ?? "").trim().length > 0);
    // Also accept an already-resolved preview URL to keep UX smooth after upload.
    const hasAvatar = hasPersistedAvatar || Boolean((avatarPreviewUrl ?? "").trim().length > 0);
    return nickOk && hasAvatar;
  }, [nickname, user?.publicAvatarStorageId, user?.publicAvatarUrl, avatarPreviewUrl]);

  const communityChecked = useMemo(() => {
    if (!communityStatus) return false;
    return communityStatus.subscribed === true || communityStatus.pending === true;
  }, [communityStatus]);

  // Keep state consistent: if user removes nickname/avatar, auto-disable public display.
  useEffect(() => {
    if (publicEnabled && !canEnablePublic) {
      setPublicEnabled(false);
      toast.info(t("profile.public.toastAutoDisabled"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicEnabled, canEnablePublic]);

  const previewInitial = useMemo(() => {
    const n = (nickname || user?.name || user?.email || "?").trim();
    return n.charAt(0).toUpperCase();
  }, [nickname, user?.name, user?.email]);

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
            <CardTitle>{t("profile.loginRequired.title")}</CardTitle>
            <CardDescription>{t("profile.loginRequired.desc")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleChangeLanguage = async (next: "en" | "de") => {
    if (!user) return;
    if (next === uiLanguage) return;

    setLanguageSaving(true);
    try {
      await updateLearningLanguage({ learningLanguage: next });
      setUiLanguage(next);
      setLanguage(next);
      toast.success(t("profile.language.toastUpdated"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("profile.language.toastFailed");
      toast.error(message);
    } finally {
      setLanguageSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePublicProfile({
        publicNickname: nickname,
        publicAvatarUrl: avatarUrlInput,
        leaderboardPublicEnabled: publicEnabled,
      });
      toast.success(t("profile.toastSaved"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("profile.toastSaveFailed");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarFileSelected = async (file: File | null) => {
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("profile.avatar.toastSelectImage"));
      return;
    }
    // 2 MB input limit to keep uploads snappy and save storage.
    if (file.size > AVATAR_MAX_INPUT_BYTES) {
      toast.error(t("profile.avatar.toastUnder2mb"));
      return;
    }

    setSaving(true);
    try {
      const uploadUrl = await generateAvatarUploadUrl({});

      // Downscale/crop + compress before upload to save storage space.
      const blob = await processAvatarImage(file);

      const uploadResp = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": blob.type || "application/octet-stream" },
        body: blob,
      });

      if (!uploadResp.ok) {
        const text = await uploadResp.text().catch(() => uploadResp.statusText);
        throw new Error(`Upload failed: ${uploadResp.status} ${text}`);
      }

      const json = (await uploadResp.json()) as { storageId?: string };
      const storageId = json.storageId;
      if (!storageId) {
        throw new Error("Upload failed: missing storageId.");
      }

      const res = await setPublicAvatarFromUpload({ storageId });
      // Only update preview; do not put a signed URL into the manual override input.
      setAvatarPreviewUrl(res.url);
      setAvatarUrlInput("");
      toast.success(t("profile.avatar.toastUpdated"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("profile.avatar.toastUploadFailed");
      toast.error(message);
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <UserCircle className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t("profile.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("profile.subtitle")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.settings.title")}</CardTitle>
          <CardDescription>
            {t("profile.settings.desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <button
              type="button"
              onClick={handleAvatarClick}
              className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("profile.avatar.ariaUpload")}
              disabled={saving}
            >
              <Avatar className="h-14 w-14 border">
              <AvatarImage src={avatarPreviewUrl || undefined} alt={nickname || t("profile.avatar.alt")} />
              <AvatarFallback className="text-base font-semibold">
                {previewInitial}
              </AvatarFallback>
              </Avatar>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="absolute w-0 h-0 opacity-0 pointer-events-none"
              tabIndex={-1}
              onChange={(e) => handleAvatarFileSelected(e.target.files?.[0] ?? null)}
              disabled={saving}
            />
            <div className="flex-1 min-w-[220px] space-y-1">
              <div className="text-sm font-medium">{nickname || t("profile.nickname.fallback")}</div>
              <div className="text-xs text-muted-foreground">
                {t("profile.avatar.hintClick")}{" "}
                {publicEnabled ? t("profile.public.enabled") : t("profile.public.disabled")}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("profile.avatar.requirements")}
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="nickname">{t("profile.nickname.label")}</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={t("profile.nickname.placeholder")}
                maxLength={32}
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">{nickname.length}/32</p>
            </div>

            {user?.role === "superadmin" ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("profile.language.label")}</Label>
                <Select
                  value={uiLanguage}
                  onValueChange={(v) => void handleChangeLanguage(v as "en" | "de")}
                  disabled={saving || languageSaving}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("profile.language.placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("profile.language.hint")}</p>
              </div>
            ) : null}

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-sm font-medium">{t("profile.public.label")}</Label>
                <Switch
                  checked={publicEnabled}
                  onCheckedChange={(checked) => {
                    if (checked && !canEnablePublic) {
                      toast.error(t("profile.public.toastMissingRequirements"));
                      return;
                    }
                    setPublicEnabled(checked);
                  }}
                  // Allow switching OFF anytime; prevent switching ON until requirements are met.
                  disabled={saving || (!publicEnabled && !canEnablePublic)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("profile.public.hint")}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-sm font-medium">{t("profile.onboarding.label")}</Label>
                <Switch
                  checked={onboardingEnabled}
                  onCheckedChange={(checked) => {
                    setOnboardingEnabled(checked);
                    if (!user) return;
                    const key = `onboarding_disabled_${user._id}`;
                    if (checked) localStorage.removeItem(key);
                    else localStorage.setItem(key, "true");
                  }}
                  disabled={saving}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("profile.onboarding.hint")}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("session.preference.label")}</Label>
              <RadioGroup
                value={sessionPref}
                onValueChange={(value) => {
                  const pref = value as SessionPreference;
                  setSessionPref(pref);
                  setSessionPreference(pref);
                  toast.success(t("session.preference.toastSaved"));
                }}
                className="space-y-2"
              >
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="permanent" id="profile-sp-permanent" className="mt-0.5" />
                  <Label htmlFor="profile-sp-permanent" className="font-normal leading-snug cursor-pointer">
                    {t("session.preference.permanent")}
                  </Label>
                </div>
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="week" id="profile-sp-week" className="mt-0.5" />
                  <Label htmlFor="profile-sp-week" className="font-normal leading-snug cursor-pointer">
                    {t("session.preference.week")}
                  </Label>
                </div>
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="browser-close" id="profile-sp-browser-close" className="mt-0.5" />
                  <Label htmlFor="profile-sp-browser-close" className="font-normal leading-snug cursor-pointer">
                    {t("session.preference.browserClose")}
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                {t("session.preference.hint")}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-sm font-medium">{t("profile.emails.label")}</Label>
                <Switch
                  checked={communityChecked}
                  onCheckedChange={async (checked) => {
                    if (!user) return;
                    try {
                      setSaving(true);
                      if (checked) {
                        await requestCommunityOptIn({ requested: true });
                        toast.success(t("profile.emails.toastConfirm"));
                      } else {
                        await unsubscribeCommunity({});
                        toast.success(t("profile.emails.toastUnsubscribed"));
                      }
                    } catch (err) {
                      const message =
                        err instanceof Error ? err.message : t("profile.emails.toastFailed");
                      toast.error(message);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving || communityStatus === undefined}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("profile.emails.hint")}
                {communityStatus?.pending ? ` (${t("profile.emails.pending")})` : ""}
              </p>
            </div>

            <Accordion type="single" collapsible>
              <AccordionItem value="advanced">
                <AccordionTrigger>{t("profile.advanced.title")}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="avatarUrl">{t("profile.advanced.avatarUrl.label")}</Label>
                    <Input
                      id="avatarUrl"
                      value={avatarUrlInput}
                      onChange={(e) => setAvatarUrlInput(e.target.value)}
                      placeholder="https://..."
                      disabled={saving}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("profile.advanced.avatarUrl.hint")}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Separator />

            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? t("common.saving") : t("common.save")}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setNickname(user.publicNickname ?? "");
                  setAvatarUrlInput(user.publicAvatarUrl ?? "");
                  setPublicEnabled(user.leaderboardPublicEnabled ?? false);
                  const disabled = localStorage.getItem(`onboarding_disabled_${user._id}`) === "true";
                  setOnboardingEnabled(!disabled);
                }}
                disabled={saving}
              >
                {t("common.reset")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.wishlist.title")}</CardTitle>
          <CardDescription>
            {t("profile.wishlist.desc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Link href="/wishlist">
              <Button variant="outline">{t("profile.wishlist.open")}</Button>
            </Link>
            <Link href="/wishlist/new">
              <Button>{t("profile.wishlist.submit")}</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t("profile.gamification.title")}</span>
            <GamificationModal />
          </CardTitle>
          <CardDescription>
            {t("profile.gamification.desc")}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.subscription.title")}</CardTitle>
          <CardDescription>{t("profile.subscription.desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <MySubscriptionContent embedded />
        </CardContent>
      </Card>
    </div>
  );
}

