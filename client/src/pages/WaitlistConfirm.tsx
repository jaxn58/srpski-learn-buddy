import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, XCircle, Loader2, Home } from "lucide-react";
import { Link } from "wouter";
import { formatDateEU, formatTimeEU } from "@/lib/utils";
import { AppFooter } from "@/components/AppFooter";

export default function WaitlistConfirm() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [email, setEmail] = useState("");
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [confirmedAt, setConfirmedAt] = useState<number | null>(null);

  const confirmWaitlist = useMutation(api.waitlist.confirm);

  useEffect(() => {
    const confirmRegistration = async () => {
      // Get token from URL query parameter
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");

      if (!token) {
        setStatus("error");
        setErrorMessage("No confirmation token found in URL");
        return;
      }

      try {
        const result = await confirmWaitlist({ token });
        setEmail(result.email || "");
        setCreatedAt(result.createdAt ?? null);
        setConfirmedAt(result.confirmedAt ?? null);
        setStatus("success");
      } catch (error: any) {
        console.error("[WaitlistConfirm] Error confirming:", error);
        setStatus("error");
        setErrorMessage(error.message || "Failed to confirm your registration. The link may be invalid or expired.");
      }
    };

    confirmRegistration();
  }, [confirmWaitlist]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-blue-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {status === "loading" && (
                <div className="rounded-full bg-blue-100 p-3">
                  <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
                </div>
              )}
              {status === "success" && (
                <div className="rounded-full bg-green-100 p-3">
                  <Check className="h-12 w-12 text-green-600" />
                </div>
              )}
              {status === "error" && (
                <div className="rounded-full bg-red-100 p-3">
                  <XCircle className="h-12 w-12 text-red-600" />
                </div>
              )}
            </div>

            <CardTitle className="text-2xl">
              {status === "loading" && "Confirming Your Registration..."}
              {status === "success" && "You're on the Waitlist!"}
              {status === "error" && "Confirmation Failed"}
            </CardTitle>

            <CardDescription>
              {status === "loading" && "Please wait while we confirm your email address"}
              {status === "success" && "Your email has been successfully confirmed"}
              {status === "error" && "We couldn't confirm your registration"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {status === "success" && (
              <>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                  <p className="text-sm text-green-800">
                    <strong>Email confirmed:</strong> {email}
                  </p>
                  <p className="text-sm text-green-700">
                    We'll notify you as soon as the Serbian AI Tutor Beta launches!
                  </p>
                  {(createdAt || confirmedAt) && (
                    <div className="pt-2 text-xs text-green-700 space-y-2">
                      {createdAt && (
                        <div>
                          <div>Created</div>
                          <div className="text-sm text-green-800">{formatDateEU(createdAt)}</div>
                          <div className="text-xs text-green-700/80">{formatTimeEU(createdAt)}</div>
                        </div>
                      )}
                      {confirmedAt && (
                        <div>
                          <div>Confirmed</div>
                          <div className="text-sm text-green-800">{formatDateEU(confirmedAt)}</div>
                          <div className="text-xs text-green-700/80">{formatTimeEU(confirmedAt)}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <p><strong>What's Next?</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>You'll receive an email when Beta launches</li>
                    <li>Get early access with special benefits</li>
                    <li>Be part of shaping the product</li>
                  </ul>
                </div>
              </>
            )}

            {status === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  {errorMessage}
                </p>
                <p className="text-sm text-red-700 mt-2">
                  Please try registering again or contact support if the problem persists.
                </p>
              </div>
            )}

            <Link href="/">
              <Button className="w-full bg-primary hover:bg-primary/90">
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
