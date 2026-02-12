import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/_core/hooks/useAuth";
import { api } from "../../../convex/_generated/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

function isMissingText(v: unknown): boolean {
  return typeof v !== "string" || v.trim().length === 0;
}

function isMissingTopics(v: unknown): boolean {
  return !Array.isArray(v) || v.length === 0 || v.every((x) => typeof x !== "string" || x.trim().length === 0);
}

export default function TranslationCoverageAdmin() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const dbModules = useQuery(api.modules.getAllModulesConsolidated);
  const unitsEnRaw = useQuery(api.units.getAllUnitsMetadata, { language: "en" });
  const unitsDeRaw = useQuery(api.units.getAllUnitsMetadata, { language: "de" });

  const [onlyMissing, setOnlyMissing] = useState(true);

  const unitsEn = useMemo(() => {
    if (!Array.isArray(unitsEnRaw)) return undefined;
    return (unitsEnRaw as any[]).filter((u) => (u as any)?.language === "en");
  }, [unitsEnRaw]);

  // IMPORTANT: `getAllUnitsMetadata({ language: "de" })` can fallback to EN if there are no DE rows.
  // We therefore only accept rows that are actually language==="de".
  const unitsDe = useMemo(() => {
    if (!Array.isArray(unitsDeRaw)) return undefined;
    return (unitsDeRaw as any[]).filter((u) => (u as any)?.language === "de");
  }, [unitsDeRaw]);

  const moduleRows = useMemo(() => {
    const ms = Array.isArray(dbModules) ? (dbModules as any[]) : [];
    const rows = ms.map((m) => {
      const titleMissing = isMissingText(m?.titleDe);
      const descMissing = isMissingText(m?.descriptionDe);
      return {
        id: String(m?._id ?? ""),
        moduleNumber: m?.moduleNumber ?? null,
        slug: String(m?.slug ?? ""),
        titleMissing,
        descMissing,
        missingAny: titleMissing || descMissing,
      };
    });
    return onlyMissing ? rows.filter((r) => r.missingAny) : rows;
  }, [dbModules, onlyMissing]);

  const unitRows = useMemo(() => {
    const en = unitsEn ?? [];
    const de = unitsDe ?? [];

    const deByNumber = new Map<number, any>();
    for (const u of de as any[]) {
      const n = Number((u as any)?.unitNumber);
      if (!Number.isFinite(n)) continue;
      deByNumber.set(n, u);
    }

    const rows = (en as any[])
      .map((uEn) => {
        const unitNumber = Number(uEn?.unitNumber);
        const uDe = deByNumber.get(unitNumber);
        const hasDeRow = Boolean(uDe);
        const titleMissing = !hasDeRow || isMissingText(uDe?.title);
        const descMissing = !hasDeRow || isMissingText(uDe?.description);
        const topicsMissing = !hasDeRow || isMissingTopics(uDe?.topics);
        const missingAny = !hasDeRow || titleMissing || descMissing || topicsMissing;
        return {
          unitNumber,
          hasDeRow,
          titleMissing,
          descMissing,
          topicsMissing,
          missingAny,
        };
      })
      .filter((r) => Number.isFinite(r.unitNumber))
      .sort((a, b) => a.unitNumber - b.unitNumber);

    return onlyMissing ? rows.filter((r) => r.missingAny) : rows;
  }, [unitsEn, unitsDe, onlyMissing]);

  const modulesLoading = dbModules === undefined;
  const unitsLoading = unitsEnRaw === undefined || unitsDeRaw === undefined;

  const modulesTotal = Array.isArray(dbModules) ? dbModules.length : 0;
  const modulesMissing = useMemo(() => {
    const ms = Array.isArray(dbModules) ? (dbModules as any[]) : [];
    return ms.filter((m) => isMissingText((m as any)?.titleDe) || isMissingText((m as any)?.descriptionDe)).length;
  }, [dbModules]);

  const unitsTotal = Array.isArray(unitsEn) ? unitsEn.length : 0;
  const unitsMissing = useMemo(() => {
    if (!Array.isArray(unitsEn)) return 0;
    const en = unitsEn as any[];
    const de = Array.isArray(unitsDe) ? (unitsDe as any[]) : [];
    const deByNumber = new Map<number, any>(de.map((u) => [Number(u?.unitNumber), u]));
    return en.filter((uEn) => {
      const n = Number(uEn?.unitNumber);
      const uDe = deByNumber.get(n);
      if (!uDe) return true;
      return isMissingText(uDe?.title) || isMissingText(uDe?.description) || isMissingTopics(uDe?.topics);
    }).length;
  }, [unitsEn, unitsDe]);

  if (authLoading || modulesLoading || unitsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.common.accessDenied.title")}</CardTitle>
            <CardDescription>{t("admin.common.accessDenied.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button>{t("admin.common.goToDashboard")}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.translationCoverage.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.translationCoverage.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t("admin.translationCoverage.onlyMissing")}</span>
            <Switch checked={onlyMissing} onCheckedChange={setOnlyMissing} />
          </div>
          <Link href="/admin/content-import">
            <Button variant="outline">{t("admin.translationCoverage.openEditor")}</Button>
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.translationCoverage.modulesCardTitle")}</CardTitle>
            <CardDescription>
              {t("admin.translationCoverage.modulesCardDesc", { missing: modulesMissing, total: modulesTotal })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>{t("admin.translationCoverage.colTitleDe")}</TableHead>
                  <TableHead>{t("admin.translationCoverage.colDescDe")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {moduleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-muted-foreground">
                      {t("admin.translationCoverage.none")}
                    </TableCell>
                  </TableRow>
                ) : (
                  moduleRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.moduleNumber ?? "—"}</TableCell>
                      <TableCell>{r.slug || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={r.titleMissing ? "destructive" : "secondary"}>
                          {r.titleMissing ? t("admin.translationCoverage.missing") : t("admin.translationCoverage.ok")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.descMissing ? "destructive" : "secondary"}>
                          {r.descMissing ? t("admin.translationCoverage.missing") : t("admin.translationCoverage.ok")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.translationCoverage.unitsCardTitle")}</CardTitle>
            <CardDescription>
              {t("admin.translationCoverage.unitsCardDesc", { missing: unitsMissing, total: unitsTotal })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{t("admin.translationCoverage.colDeRow")}</TableHead>
                  <TableHead>{t("admin.translationCoverage.colTitleDe")}</TableHead>
                  <TableHead>{t("admin.translationCoverage.colDescDe")}</TableHead>
                  <TableHead>{t("admin.translationCoverage.colTopicsDe")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unitRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground">
                      {t("admin.translationCoverage.none")}
                    </TableCell>
                  </TableRow>
                ) : (
                  unitRows.map((r) => (
                    <TableRow key={r.unitNumber}>
                      <TableCell className="font-medium">{r.unitNumber}</TableCell>
                      <TableCell>
                        <Badge variant={!r.hasDeRow ? "destructive" : "secondary"}>
                          {!r.hasDeRow ? t("admin.translationCoverage.missing") : t("admin.translationCoverage.ok")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.titleMissing ? "destructive" : "secondary"}>
                          {r.titleMissing ? t("admin.translationCoverage.missing") : t("admin.translationCoverage.ok")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.descMissing ? "destructive" : "secondary"}>
                          {r.descMissing ? t("admin.translationCoverage.missing") : t("admin.translationCoverage.ok")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.topicsMissing ? "destructive" : "secondary"}>
                          {r.topicsMissing ? t("admin.translationCoverage.missing") : t("admin.translationCoverage.ok")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

