import { describe, expect, it } from "vitest";
import {
  extractPageTexts,
  normalizeGuidelineScopeKey,
  parsePageSpec,
  sliceReferenceSource,
} from "../../shared/contentStudio/referenceScope";

describe("reference scope", () => {
  it("keys cache entries by chapter and pages", () => {
    expect(normalizeGuidelineScopeKey(undefined, undefined)).toBe("all");
    expect(normalizeGuidelineScopeKey("  Chapter 2 ", "12-15")).toBe("chapter 2|12-15");
  });

  it("parses page ranges", () => {
    expect(parsePageSpec("12-15")).toEqual([12, 13, 14, 15]);
    expect(parsePageSpec("3, 7, 9")).toEqual([3, 7, 9]);
  });

  it("slices by pages instead of taking the start of the book", () => {
    const pageTexts = ["PAGE ONE INTRO", "PAGE TWO GRAMMAR", "PAGE THREE DIALOGUE", "PAGE FOUR EXTRA"];
    const sliced = sliceReferenceSource({
      text: pageTexts.join("\f"),
      pages: "2-3",
      pageTexts,
    });
    expect(sliced).toContain("PAGE TWO GRAMMAR");
    expect(sliced).toContain("PAGE THREE DIALOGUE");
    expect(sliced).not.toContain("PAGE ONE INTRO");
  });

  it("slices by chapter heading", () => {
    const text = [
      "Preface",
      "Chapter 1 Greetings",
      "hello content",
      "Chapter 2 Travel",
      "airport content",
    ].join("\n");
    const sliced = sliceReferenceSource({ text, chapter: "2" });
    expect(sliced).toContain("Chapter 2 Travel");
    expect(sliced).toContain("airport content");
    expect(sliced).not.toContain("hello content");
  });

  it("splits form-feed PDF text into pages", () => {
    expect(extractPageTexts("A\fB\fC")).toEqual(["A", "B", "C"]);
  });
});
