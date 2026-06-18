import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import type { LibrarySection } from "@/components/library/UnifiedLibraryExplorer";

type LibrarySectionRedirectProps = {
  section: LibrarySection;
  preserveQuery?: boolean;
};

export default function LibrarySectionRedirect({
  section,
  preserveQuery = true,
}: LibrarySectionRedirectProps) {
  const [, setLocation] = useLocation();
  const searchString = useSearch();

  useEffect(() => {
    const params = preserveQuery
      ? new URLSearchParams(searchString)
      : new URLSearchParams();
    params.set("section", section);
    setLocation(`/library?${params.toString()}`);
  }, [searchString, section, preserveQuery, setLocation]);

  return null;
}
