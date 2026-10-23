import { describe, expect, it } from "vitest";
import { countPdfPages } from "../shared/chat/pdfPageCount";

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("countPdfPages", () => {
  it("counts page objects and skips the page tree", () => {
    const pdf = "%PDF-1.4\n1 0 obj << /Type /Pages /Count 2 >> endobj\n2 0 obj << /Type /Page >> endobj\n3 0 obj << /Type /Page >> endobj\n";
    expect(countPdfPages(bytes(pdf))).toBe(2);
  });

  it("returns 1 when no page object is present", () => {
    expect(countPdfPages(bytes("%PDF-1.4\n"))).toBe(1);
  });
});
