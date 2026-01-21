import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Check, Loader2, Home, MailX } from "lucide-react";
import { Link } from "wouter";
import { AppFooter } from "@/components/AppFooter";

type Status = "confirm" | "processing" | "success" | "error";

export default function NewsletterUnsubscribe() {
  const [status, setStatus] = useState<Status>("confirm");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const token = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("token") || "";
  }, []);

  // Public query: used only to show "invalid" vs "already unsubscribed" without taking action.
  const contact = useQuery(
    api.newsletter.getContactByUnsubscribeToken,
    token ? { token } : "skip"
  );

  const unsubscribeByToken = useMutation(api.newsletter.unsubscribeByToken);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("No unsubscribe token found in URL.");
    }
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;

    setStatus("processing");
    setErrorMessage("");

    try {
      await unsubscribeByToken({ token });
      setStatus("success");
    } catch (error: any) {
      console.error("[NewsletterUnsubscribe] Error unsubscribing:", error);
      setStatus("error");
      setErrorMessage(
        error?.message || "Failed to unsubscribe. The link may be invalid or expired."
      );
    }
  };

  const isInvalidToken = !!token && contact === null;
  const isAlreadyUnsubscribed = !!token && !!contact && contact.subscribed === false;
  const disableUnsubscribe = !token || isInvalidToken || isAlreadyUnsubscribed;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-blue-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {status === "processing" && (
                <div className="rounded-full bg-blue-100 p-3">
                  <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
                </div>
              )}
              {status === "success" && (
                <div className="rounded-full bg-green-100 p-3">
                  <Check className="h-12 w-12 text-green-600" />
                </div>
              )}
              {status === "confirm" && (
                <div className="rounded-full bg-amber-100 p-3">
                  <MailX className="h-12 w-12 text-amber-700" />
                </div>
              )}
              {status === "error" && (
                <div className="rounded-full bg-red-100 p-3">
                  <AlertTriangle className="h-12 w-12 text-red-600" />
                </div>
              )}
            </div>

            <CardTitle className="text-2xl">
              {status === "confirm" && "Confirm Unsubscribe"}
              {status === "processing" && "Unsubscribing..."}
              {status === "success" && "You're Unsubscribed"}
              {status === "error" && "Unsubscribe Failed"}
            </CardTitle>

            <CardDescription>
              {status === "confirm" && "Click below to stop receiving marketing emails."}
              {status === "processing" && "Please wait while we process your request."}
              {status === "success" && "You will no longer receive marketing emails from Serbian AI Tutor."}
              {status === "error" && "We couldn't process your request."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {status === "confirm" && (
              <>
                {isInvalidToken && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">
                      This unsubscribe link is invalid or has expired.
                    </p>
                  </div>
                )}

                {isAlreadyUnsubscribed && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-900">
                      You're already unsubscribed.
                    </p>
                  </div>
                )}

                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    <strong>Note:</strong> Transactional emails (e.g. account/security messages) may still be sent.
                  </p>
                </div>

                <Button
                  className="w-full bg-destructive hover:bg-destructive/90"
                  onClick={handleUnsubscribe}
                  disabled={disableUnsubscribe}
                >
                  {isAlreadyUnsubscribed ? "Already unsubscribed" : "Unsubscribe"}
                </Button>
              </>
            )}

            {status === "success" && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  Your request has been processed successfully.
                </p>
              </div>
            )}

            {status === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{errorMessage}</p>
              </div>
            )}

            <Link href="/">
              <Button variant="outline" className="w-full">
                <Home className="mr-2 h-4 w-4" />
                Back to Homepage
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <AppFooter />
    </div>
  );
}

