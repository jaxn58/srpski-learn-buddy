import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateEU } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { BookOpen } from "lucide-react";

type CategoryType = "added" | "changed" | "fixed" | "removed";

// Local shapes for Convex query results (return types are lost through
// TS2589 @ts-ignore workarounds in convex/versions.ts).
type ChangelogEntry = {
  _id: string;
  title: string;
  description?: string;
};

type ChangelogVersion = {
  _id: string;
  version: string;
  environment: string;
  releaseDate: number;
  isCurrent?: boolean;
};

type ChangelogGroup = {
  version: ChangelogVersion;
  entries: {
    added: ChangelogEntry[];
    changed: ChangelogEntry[];
    fixed: ChangelogEntry[];
    removed: ChangelogEntry[];
  };
};

const categoryColors: Record<CategoryType, string> = {
  added: "bg-green-100 text-green-800 border-green-300",
  changed: "bg-blue-100 text-blue-800 border-blue-300",
  fixed: "bg-orange-100 text-orange-800 border-orange-300",
  removed: "bg-red-100 text-red-800 border-red-300",
};

const categoryLabels: Record<CategoryType, string> = {
  added: "Added",
  changed: "Changed",
  fixed: "Fixed",
  removed: "Removed",
};

const categoryIcons: Record<CategoryType, string> = {
  added: "✨",
  changed: "🔄",
  fixed: "🐛",
  removed: "🗑️",
};

export default function Changelog() {
  const { language } = useLanguage();
  const changelogHistory = useQuery(api.versions.getChangelogHistory, {
    language: language as "en" | "de",
    limit: 20,
  });

  if (changelogHistory === undefined) {
    return (
      <div className="container mx-auto py-8 space-y-8">
        <div className="space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-6 w-96" />
        </div>
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8 max-w-4xl">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Changelog</h1>
          <p className="text-muted-foreground">
            What's new in Serbian AI Tutor
          </p>
        </div>
      </div>

      {/* Changelog Content */}
      <div className="space-y-8">
        {changelogHistory.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No changelog entries yet. Check back soon for updates!
              </p>
            </CardContent>
          </Card>
        ) : (
          (changelogHistory as ChangelogGroup[]).map(({ version, entries }: ChangelogGroup) => (
            <Card key={version._id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">
                      Version {version.version}
                    </CardTitle>
                    <CardDescription className="text-base mt-1">
                      <span className="capitalize">{version.environment}</span>
                      {" • "}
                      {formatDateEU(version.releaseDate)}
                    </CardDescription>
                  </div>
                  {version.isCurrent && (
                    <Badge className="bg-green-100 text-green-800 border-green-300">
                      Current
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Added */}
                {entries.added.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{categoryIcons.added}</span>
                      <Badge className={categoryColors.added}>
                        {categoryLabels.added}
                      </Badge>
                    </div>
                    <ul className="space-y-2 ml-8">
                      {entries.added.map((entry: ChangelogEntry) => (
                        <li key={entry._id} className="list-disc">
                          <span className="font-medium">{entry.title}</span>
                          {entry.description && (
                            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                              {entry.description}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Changed */}
                {entries.changed.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{categoryIcons.changed}</span>
                      <Badge className={categoryColors.changed}>
                        {categoryLabels.changed}
                      </Badge>
                    </div>
                    <ul className="space-y-2 ml-8">
                      {entries.changed.map((entry: ChangelogEntry) => (
                        <li key={entry._id} className="list-disc">
                          <span className="font-medium">{entry.title}</span>
                          {entry.description && (
                            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                              {entry.description}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Fixed */}
                {entries.fixed.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{categoryIcons.fixed}</span>
                      <Badge className={categoryColors.fixed}>
                        {categoryLabels.fixed}
                      </Badge>
                    </div>
                    <ul className="space-y-2 ml-8">
                      {entries.fixed.map((entry: ChangelogEntry) => (
                        <li key={entry._id} className="list-disc">
                          <span className="font-medium">{entry.title}</span>
                          {entry.description && (
                            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                              {entry.description}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Removed */}
                {entries.removed.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{categoryIcons.removed}</span>
                      <Badge className={categoryColors.removed}>
                        {categoryLabels.removed}
                      </Badge>
                    </div>
                    <ul className="space-y-2 ml-8">
                      {entries.removed.map((entry: ChangelogEntry) => (
                        <li key={entry._id} className="list-disc">
                          <span className="font-medium">{entry.title}</span>
                          {entry.description && (
                            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                              {entry.description}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Empty state for version with no entries */}
                {entries.added.length === 0 &&
                  entries.changed.length === 0 &&
                  entries.fixed.length === 0 &&
                  entries.removed.length === 0 && (
                    <p className="text-muted-foreground text-center py-4">
                      No changelog entries for this version yet.
                    </p>
                  )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
