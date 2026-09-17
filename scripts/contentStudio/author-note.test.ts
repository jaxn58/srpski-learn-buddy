import { describe, expect, it } from "vitest";
import {
  detectAuthorNoteLang,
  hasWhyThisUnitMattersBlock,
  restoreOriginalAuthorQuote,
  whyThisUnitMattersBlock,
} from "../../shared/contentStudio/authorNote";

describe("author note", () => {
  it("detects German quotes without overwriting them", () => {
    expect(detectAuthorNoteLang("Sprache öffnet Türen, wenn du sie wirklich brauchst.")).toBe("de");
    expect(detectAuthorNoteLang("Language opens doors when you actually need it.")).toBe("en");
  });

  it("builds a Why this unit matters block from the draft description", () => {
    const block = whyThisUnitMattersBlock("Arrive and introduce yourself.");
    expect(hasWhyThisUnitMattersBlock(block)).toBe(true);
    expect(block).toContain("Arrive and introduce yourself.");
  });

  it("restores the original German quote in a translated overview", () => {
    const mdDe = [
      "## 1. Overview",
      "",
      "#### Eine Notiz vom Gründer (Jacksenn)",
      "> \"Sprache öffnet Türen, wenn man sie wirklich braucht.\"",
      "",
      "Lernziele",
    ].join("\n");
    const restored = restoreOriginalAuthorQuote(mdDe, "Sprache öffnet Türen, wenn du sie wirklich brauchst.");
    expect(restored).toContain("> \"Sprache öffnet Türen, wenn du sie wirklich brauchst.\"");
    expect(restored).not.toContain("wenn man sie wirklich braucht");
  });
});
