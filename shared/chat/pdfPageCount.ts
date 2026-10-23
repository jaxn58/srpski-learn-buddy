const PAGE_OBJECT = /\/Type\s*\/Page(?!s)/g;

/**
 * Count PDF page objects. `/Type /Pages` is the page tree and is not counted.
 * Returns 1 when the file has no recognizable page object.
 */
export function countPdfPages(bytes: Uint8Array): number {
  const decoder = new TextDecoder("latin1");
  let count = 0;
  let carry = "";
  const size = 64 * 1024;
  for (let offset = 0; offset < bytes.length; offset += size) {
    const piece = carry + decoder.decode(bytes.subarray(offset, offset + size), { stream: true });
    const keep = Math.min(32, piece.length);
    const window = piece.slice(0, piece.length - keep);
    carry = piece.slice(piece.length - keep);
    PAGE_OBJECT.lastIndex = 0;
    const matches = window.match(PAGE_OBJECT);
    if (matches) count += matches.length;
  }
  PAGE_OBJECT.lastIndex = 0;
  const tail = carry.match(PAGE_OBJECT);
  if (tail) count += tail.length;
  return count > 0 ? count : 1;
}

export async function readAttachmentPreviewFacts(file: Blob & { type: string }): Promise<{
  pageCount?: number;
  textChars?: number;
}> {
  if (file.type === "application/pdf") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return { pageCount: countPdfPages(bytes) };
  }
  if (file.type === "text/plain" || file.type === "text/markdown") {
    const text = await file.text();
    return { textChars: text.length };
  }
  return {};
}
