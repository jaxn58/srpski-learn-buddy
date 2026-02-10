import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Mail, Check } from "lucide-react";
import { toast } from "sonner";
import { formatDateEU, formatTimeEU } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WaitlistModal({ isOpen, onClose }: WaitlistModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [wantsWaitlistUpdates, setWantsWaitlistUpdates] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdAt, setCreatedAt] = useState<number | null>(null);

  const joinWaitlist = useMutation(api.waitlist.join);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error(t("waitlist.toast.invalidEmail"));
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await joinWaitlist({
        email,
        name: name.trim() || undefined,
        wantsWaitlistUpdates,
      });

      setIsSuccess(true);
      setCreatedAt(result?.createdAt ?? null);
      toast.success(t("waitlist.toast.checkEmail"));
    } catch (error: any) {
      console.error("[WaitlistModal] Error joining waitlist:", error);
      toast.error(error.message || t("waitlist.toast.failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName("");
    setEmail("");
    setWantsWaitlistUpdates(false);
    setIsSuccess(false);
    setCreatedAt(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            {t("waitlist.title")}
          </DialogTitle>
          <DialogDescription className="text-center">
            {t("waitlist.desc")}
          </DialogDescription>
        </DialogHeader>

        {!isSuccess ? (
          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("waitlist.name.label")}</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder={t("waitlist.name.placeholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  {t("waitlist.email.label")} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("waitlist.email.placeholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="waitlistUpdates"
                  checked={wantsWaitlistUpdates}
                  onCheckedChange={(checked) => setWantsWaitlistUpdates(checked === true)}
                  disabled={isSubmitting}
                />
                <div className="space-y-1">
                  <Label htmlFor="waitlistUpdates" className="cursor-pointer leading-snug">
                    {t("waitlist.updates.label")}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t("waitlist.updates.hint")}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !email}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("waitlist.joining")}
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    {t("waitlist.join")}
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="py-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-green-100 p-3">
                <Check className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-semibold">{t("waitlist.success.title")}</h3>
              <p className="text-muted-foreground">
                {t("waitlist.success.sentTo")} <strong>{email}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                {t("waitlist.success.instruction")}
              </p>
              {createdAt && (
                <div className="pt-2 text-xs text-muted-foreground">
                  <div>{t("waitlist.success.created")}</div>
                  <div className="text-sm text-foreground">{formatDateEU(createdAt)}</div>
                  <div className="text-xs text-muted-foreground/80">{formatTimeEU(createdAt)}</div>
                </div>
              )}
            </div>

            <Button
              onClick={handleClose}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {t("waitlist.success.gotIt")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
