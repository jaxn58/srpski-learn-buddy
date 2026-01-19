import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const updatePublicProfile = useMutation(api.users.updatePublicProfile);
  const generateAvatarUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const setPublicAvatarFromUpload = useMutation(api.users.setPublicAvatarFromUpload);
  const myAvatar = useQuery(api.users.getMyPublicAvatarUrl);
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!user) return;
    setNickname(user.publicNickname ?? "");
    setAvatarUrlInput(user.publicAvatarUrl ?? "");
    setPublicEnabled(user.leaderboardPublicEnabled ?? false);

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
      toast.info("Public Top 10 display was disabled because nickname or avatar is missing.");
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
            <CardTitle>Login required</CardTitle>
            <CardDescription>Please sign in to manage your profile.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePublicProfile({
        publicNickname: nickname,
        publicAvatarUrl: avatarUrlInput,
        leaderboardPublicEnabled: publicEnabled,
      });
      toast.success("Profile updated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
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
      toast.error("Please select an image file.");
      return;
    }
    // 2 MB input limit to keep uploads snappy and save storage.
    if (file.size > AVATAR_MAX_INPUT_BYTES) {
      toast.error("Please choose an image under 2 MB.");
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
      toast.success("Avatar updated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload avatar";
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
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your public Leaderboard identity.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>
            Keep it simple: nickname + avatar, plus a couple of switches.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <button
              type="button"
              onClick={handleAvatarClick}
              className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Upload avatar"
              disabled={saving}
            >
              <Avatar className="h-14 w-14 border">
              <AvatarImage src={avatarPreviewUrl || undefined} alt={nickname || "Avatar"} />
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
              <div className="text-sm font-medium">{nickname || "Your nickname"}</div>
              <div className="text-xs text-muted-foreground">
                Click the avatar to upload. {publicEnabled ? "Public display is enabled." : "Public display is disabled."}
              </div>
              <div className="text-xs text-muted-foreground">
                Image requirements: JPG/PNG/WebP, max 2 MB. We automatically crop + resize to 256×256 and compress (WebP/JPEG) to save storage.
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. SerbianExplorer"
                maxLength={32}
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">{nickname.length}/32</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-sm font-medium">Public Top 10 display</Label>
                <Switch
                  checked={publicEnabled}
                  onCheckedChange={(checked) => {
                    if (checked && !canEnablePublic) {
                      toast.error("Set a nickname and upload an avatar before enabling public display.");
                      return;
                    }
                    setPublicEnabled(checked);
                  }}
                  // Allow switching OFF anytime; prevent switching ON until requirements are met.
                  disabled={saving || (!publicEnabled && !canEnablePublic)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Default is off. When enabled, nickname + avatar are required.
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-sm font-medium">Show onboarding on login</Label>
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
                Turn it off and back on anytime.
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-sm font-medium">Email updates (double opt-in)</Label>
                <Switch
                  checked={communityChecked}
                  onCheckedChange={async (checked) => {
                    if (!user) return;
                    try {
                      setSaving(true);
                      if (checked) {
                        await requestCommunityOptIn({ requested: true });
                        toast.success("Check your email to confirm the subscription.");
                      } else {
                        await unsubscribeCommunity({});
                        toast.success("You will no longer receive these emails.");
                      }
                    } catch (err) {
                      const message =
                        err instanceof Error ? err.message : "Failed to update email preference";
                      toast.error(message);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving || communityStatus === undefined}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Send me product updates, community news, and learning tips.
                {communityStatus?.pending ? " (Pending email confirmation)" : ""}
              </p>
            </div>

            <Accordion type="single" collapsible>
              <AccordionItem value="advanced">
                <AccordionTrigger>Advanced</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="avatarUrl">Avatar URL (https://)</Label>
                    <Input
                      id="avatarUrl"
                      value={avatarUrlInput}
                      onChange={(e) => setAvatarUrlInput(e.target.value)}
                      placeholder="https://..."
                      disabled={saving}
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional: use a public image URL. Upload is recommended.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Separator />

            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
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
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Gamification System</span>
            <GamificationModal />
          </CardTitle>
          <CardDescription>
            Learn how XP, levels, and rewards work
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Subscription</CardTitle>
          <CardDescription>View your current plan, remaining time, and upgrade options.</CardDescription>
        </CardHeader>
        <CardContent>
          <MySubscriptionContent embedded />
        </CardContent>
      </Card>
    </div>
  );
}

