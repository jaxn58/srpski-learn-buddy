/**
 * AI Energy Admin Page
 *
 * Dedicated superadmin surface for the AI Energy system:
 *  - Cost table per action type (compact/detailed/RAG/Vision/Upload)
 *  - Monthly tier quotas (full / buddy / basic — i.e. Sprachkurs + AI Pro /
 *    AI Chat Standalone / Sprachkurs + AI)
 *  - Upload technical cap
 *  - Welcome-Energy + Beta-Tester discount (billing config)
 *
 * Previously this Card was embedded on the User Management page (`/admin`),
 * which made it hard to find. Moved to its own route under "Content & System".
 */
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Zap } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { EnergyConfigCard } from "@/components/admin/EnergyConfigCard";

export default function AdminEnergyConfig() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || user.role !== "superadmin") {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <Card>
          <CardHeader>
            <p className="font-bold">{t("adminEnergy.accessDenied", "Access Denied")}</p>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t("adminEnergy.accessDeniedHint", "AI Energy configuration is restricted to superadmins.")}
            </p>
            <Link href="/dashboard">
              <Button>{t("adminEnergy.goToDashboard", "Go to Dashboard")}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
          <Zap className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {t("adminEnergy.title", "AI Energy Configuration")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "adminEnergy.subtitle",
              "Per-action Energy cost, monthly tier quotas, upload cap and billing extras. Changes take effect immediately."
            )}
          </p>
        </div>
      </div>

      <EnergyConfigCard />
    </div>
  );
}
