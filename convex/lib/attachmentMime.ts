/** Guess MIME type from file extension (legacy messages without attachmentMimeType). */
export function guessMimeFromFileName(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    case "txt":
      return "text/plain";
    case "md":
      return "text/markdown";
    default:
      return "application/octet-stream";
  }
}

export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}
