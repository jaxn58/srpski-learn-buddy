import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Check, Loader2, Home, MailX } from "lucide-react";
import { Link } from "wouter";
import { AppFooter } from "@/components/AppFooter";

type Status = "confirm" | "processing" | "success" | "error";
type UnsubscribeLocale = "en" | "de";

function readLangParam(params: URLSearchParams): UnsubscribeLocale | null {
  const lang = params.get("lang");
  if (lang === "en" || lang === "de") return lang;
  return null;
}

export default function NewsletterUnsubscribe() {
  const { t, i18n } = useTranslation();
  const [bundleReady, setBundleReady] = useState(false);
  const [status, setStatus] = useState<Status>("confirm");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const { token, langParam } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return { token: params.get("token") || "", langParam: readLangParam(params) };
  }, []);

  const contact = useQuery(
    api.newsletter.getContactByUnsubscribeToken,
    token ? { token } : "skip"
  );

  const unsubscribeByToken = useMutation(api.newsletter.unsubscribeByToken);

  const contactLocale =
    contact?.preferredLocale === "de" || contact?.preferredLocale === "en"
      ? contact.preferredLocale
      : null;
  const lng: UnsubscribeLocale | null =
    langParam ?? contactLocale ?? (contact === undefined && token ? null : "en");

  useEffect(() => {
    if (!lng) {
      setBundleReady(false);
      return;
    }
    let cancelled = false;
    void i18n.loadLanguages(lng).then(() => {
      if (!cancelled) setBundleReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [i18n, lng]);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage(t("newsletter.unsubscribe.missingToken", { lng: lng ?? "en" }));
    }
  }, [token, t, lng]);

  const handleUnsubscribe = async () => {
    if (!token || !lng) return;

    setStatus("processing");
    setErrorMessage("");

    try {
      await unsubscribeByToken({ token });
      setStatus("success");
    } catch (error: unknown) {
      console.error("[NewsletterUnsubscribe] Error unsubscribing:", error);
      setStatus("error");
      setErrorMessage(t("newsletter.unsubscribe.failed", { lng }));
    }
  };

  const tr = (key: string) => t(key, { lng: lng ?? "en" });

  const isInvalidToken = !!token && contact === null;
  const isAlreadyUnsubscribed = !!token && !!contact && contact.subscribed === false;
  const disableUnsubscribe = !token || isInvalidToken || isAlreadyUnsubscribed || !lng;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-blue-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {(!lng || !bundleReady || status === "processing") && (
                <div className="rounded-full bg-blue-100 p-3">
                  <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
                </div>
              )}
              {lng && bundleReady && status === "success" && (
                <div className="rounded-full bg-green-100 p-3">
                  <Check className="h-12 w-12 text-green-600" />
                </div>
              )}
              {lng && bundleReady && status === "confirm" && (
                <div className="rounded-full bg-amber-100 p-3">
                  <MailX className="h-12 w-12 text-amber-700" />
                </div>
              )}
              {lng && bundleReady && status === "error" && (
                <div className="rounded-full bg-red-100 p-3">
                  <AlertTriangle className="h-12 w-12 text-red-600" />
                </div>
              )}
            </div>

            <CardTitle className="text-2xl">
              {(!lng || !bundleReady) && tr("newsletter.unsubscribe.processingTitle")}
              {lng && bundleReady && status === "confirm" && tr("newsletter.unsubscribe.confirmTitle")}
              {lng && bundleReady && status === "processing" && tr("newsletter.unsubscribe.processingTitle")}
              {lng && bundleReady && status === "success" && tr("newsletter.unsubscribe.successTitle")}
              {lng && bundleReady && status === "error" && tr("newsletter.unsubscribe.errorTitle")}
            </CardTitle>

            <CardDescription>
              {(!lng || !bundleReady) && tr("newsletter.unsubscribe.processingDescription")}
              {lng && bundleReady && status === "confirm" && tr("newsletter.unsubscribe.confirmDescription")}
              {lng && bundleReady && status === "processing" && tr("newsletter.unsubscribe.processingDescription")}
              {lng && bundleReady && status === "success" && tr("newsletter.unsubscribe.successDescription")}
              {lng && bundleReady && status === "error" && tr("newsletter.unsubscribe.errorDescription")}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {lng && bundleReady && status === "confirm" && (
              <>
                {isInvalidToken && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">
                      {tr("newsletter.unsubscribe.invalidToken")}
                    </p>
                  </div>
                )}

                {isAlreadyUnsubscribed && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-900">
                      {tr("newsletter.unsubscribe.alreadyUnsubscribed")}
                    </p>
                  </div>
                )}

                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    <strong>{tr("newsletter.unsubscribe.noteLabel")}</strong>{" "}
                    {tr("newsletter.unsubscribe.transactionalNote")}
                  </p>
                </div>

                <Button
                  className="w-full bg-destructive hover:bg-destructive/90"
                  onClick={handleUnsubscribe}
                  disabled={disableUnsubscribe}
                >
                  {isAlreadyUnsubscribed
                    ? tr("newsletter.unsubscribe.alreadyButton")
                    : tr("newsletter.unsubscribe.unsubscribe")}
                </Button>
              </>
            )}

            {lng && bundleReady && status === "success" && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  {tr("newsletter.unsubscribe.successDetail")}
                </p>
              </div>
            )}

            {lng && bundleReady && status === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{errorMessage}</p>
              </div>
            )}

            <Link href="/">
              <Button variant="outline" className="w-full">
                <Home className="mr-2 h-4 w-4" />
                {tr("newsletter.unsubscribe.backHome")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {lng && bundleReady && <AppFooter lng={lng} />}
    </div>
  );
}
