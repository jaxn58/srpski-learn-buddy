import { useMemo } from "react";
import { useLocation } from "wouter";
import { UnifiedLibraryExplorer } from "@/components/library/UnifiedLibraryExplorer";

export default function MyLibraryHub() {
  const [location] = useLocation();

  const openUploadOnMount = useMemo(() => {
    const params = new URLSearchParams(location.split("?")[1] ?? "");
    return params.get("upload") === "1";
  }, [location]);

  return <UnifiedLibraryExplorer openUploadOnMount={openUploadOnMount} />;
}
