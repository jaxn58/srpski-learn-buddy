import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/_core/hooks/useAuth";
import { StorageQuotaConfigCard } from "@/components/admin/StorageQuotaConfigCard";
import { AnimatedPage, AnimatedItem } from "@/components/AnimatedPage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AdminStorageOverview() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const overview = useQuery(api.storageAdmin.getPlatformStorageOverview);
  const isSuperadmin = user?.role === "superadmin";

  if (!overview) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
        {t("common.loading", "Loading…")}
      </div>
    );
  }

  return (
    <AnimatedPage className="space-y-6">
      <AnimatedItem>
        <div>
          <h1 className="text-2xl font-bold">{t("adminStorage.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("adminStorage.subtitle")}</p>
        </div>
      </AnimatedItem>

      {isSuperadmin && (
        <AnimatedItem>
          <StorageQuotaConfigCard />
        </AnimatedItem>
      )}

      <AnimatedItem>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t("adminStorage.totalUsed")}</CardDescription>
              <CardTitle className="text-2xl">{overview.totalUsedFormatted}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t("adminStorage.documents")}</CardDescription>
              <CardTitle className="text-2xl">{overview.totalDocuments}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t("adminStorage.attachments")}</CardDescription>
              <CardTitle className="text-2xl">{overview.totalChatAttachments}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t("adminStorage.usersWithData")}</CardDescription>
              <CardTitle className="text-2xl">{overview.userCountWithStorage}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </AnimatedItem>

      <AnimatedItem>
        <Card>
          <CardHeader>
            <CardTitle>{t("adminStorage.planUsage")}</CardTitle>
            <CardDescription>
              {t("adminStorage.planIncluded", { gb: overview.includedStorageGb })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={overview.percentOfIncluded} className="h-3" />
            <p className="text-sm text-muted-foreground">{overview.percentOfIncluded}%</p>
          </CardContent>
        </Card>
      </AnimatedItem>

      <AnimatedItem>
        <Card>
          <CardHeader>
            <CardTitle>{t("adminStorage.topUsers")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("adminStorage.user")}</TableHead>
                  <TableHead>{t("adminStorage.used")}</TableHead>
                  <TableHead>{t("adminStorage.documents")}</TableHead>
                  <TableHead>{t("adminStorage.attachments")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.topUsers.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell>
                      <div className="font-medium">{row.name ?? row.email ?? row.userId}</div>
                      {row.email && row.name && (
                        <div className="text-xs text-muted-foreground">{row.email}</div>
                      )}
                    </TableCell>
                    <TableCell>{row.usedFormatted}</TableCell>
                    <TableCell>{row.documentCount}</TableCell>
                    <TableCell>{row.attachmentCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </AnimatedItem>

      <AnimatedItem>
        <Card>
          <CardHeader>
            <CardTitle>{t("adminStorage.r2Title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{overview.r2BreakEvenNote}</p>
          </CardContent>
        </Card>
      </AnimatedItem>
    </AnimatedPage>
  );
}
