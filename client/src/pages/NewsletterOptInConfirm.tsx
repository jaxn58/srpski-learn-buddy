import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, XCircle, Loader2, Home, MailCheck } from "lucide-react";
import { Link } from "wouter";

type Status = "confirm" | "processing" | "success" | "error";

export default function NewsletterOptInConfirm() {
  const [status, setStatus] = useState<Status>("confirm");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  const token = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("token") || "";
  }, []);

  const confirmDoubleOptIn = useMutation(api.newsletter.confirmDoubleOptIn);

  const handleConfirm = async () => {
    if (!token) {
      setStatus("error");
      setErrorMessage("No confirmation token found in URL.");
      return;
    }

    setStatus("processing");
    setErrorMessage("");

    try {
      const result = await confirmDoubleOptIn({ token });
      setEmail(result.email || "");
      setStatus("success");
    } catch (error: any) {
      console.error("[NewsletterOptInConfirm] Error confirming:", error);
      setStatus("error");
      setErrorMessage(
        error?.message || "Failed to confirm your subscription. The link may be invalid or expired."
      );
    }
  };

  const disableConfirm = status === "processing" || !token;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-blue-50 flex items-center justify-center p-4">
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
              <div className="rounded-full bg-emerald-100 p-3">
                <MailCheck className="h-12 w-12 text-emerald-700" />
              </div>
            )}
            {status === "error" && (
              <div className="rounded-full bg-red-100 p-3">
                <XCircle className="h-12 w-12 text-red-600" />
              </div>
            )}
          </div>

          <CardTitle className="text-2xl">
            {status === "confirm" && "Confirm subscription"}
            {status === "processing" && "Confirming..."}
            {status === "success" && "You're subscribed"}
            {status === "error" && "Confirmation failed"}
          </CardTitle>

          <CardDescription>
            {status === "confirm" && "Click below to confirm your email updates subscription."}
            {status === "processing" && "Please wait while we process your request."}
            {status === "success" && "Your email updates subscription has been confirmed."}
            {status === "error" && "We couldn't confirm your subscription."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {status === "confirm" && (
            <>
              {!token && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">No confirmation token found in URL.</p>
                </div>
              )}

              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong>Note:</strong> We don't auto-confirm on page load to avoid accidental
                  confirmation by email scanners.
                </p>
              </div>

              <Button className="w-full bg-primary hover:bg-primary/90" onClick={handleConfirm} disabled={disableConfirm}>
                Confirm subscription
              </Button>
            </>
          )}

          {status === "success" && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
              {email ? (
                <p className="text-sm text-green-800">
                  <strong>Confirmed email:</strong> {email}
                </p>
              ) : null}
              <p className="text-sm text-green-700">Thanks! You'll start receiving updates.</p>
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
  );
}

