import { describe, it, expect } from "vitest";
import {
  applyMontenegroVariantNotesToVocabulary,
  appendMontenegroNotesToMarkdown,
  extractStructuredMontenegroNote,
  resolveMontenegroVariantNote,
} from "../../convex/contentStudio/_validatorHelpers";

describe("resolveMontenegroVariantNote", () => {
  it("maps an ekavian lemma to the ijekavian form", () => {
    expect(resolveMontenegroVariantNote("razumem")).toBe(
      "Montenegro: razumijem (ijekavian)."
    );
    expect(resolveMontenegroVariantNote("gde")).toBe("Montenegro: gdje (ijekavian).");
  });

  it("maps a phrase by replacing only known tokens", () => {
    expect(resolveMontenegroVariantNote("ne razumem")).toBe(
      "Montenegro: ne razumijem (ijekavian)."
    );
    expect(resolveMontenegroVariantNote("Gde si?")).toBe(
      "Montenegro: gdje si (ijekavian)."
    );
  });

  it("maps an ijekavian lemma back to the Serbia form", () => {
    expect(resolveMontenegroVariantNote("razumijem")).toBe(
      "Variant (Serbia): razumem (ekavian)."
    );
  });

  it("returns null when no lookup token is present", () => {
    expect(resolveMontenegroVariantNote("imam rezervaciju")).toBeNull();
    expect(resolveMontenegroVariantNote("")).toBeNull();
  });
});

describe("applyMontenegroVariantNotesToVocabulary", () => {
  it("appends the phrase form without replacing an existing Chunk note", () => {
    const pkg = {
      vocabulary: {
        en: [
          {
            serbian: "ne razumem",
            en: "I do not understand",
            noteEn: "Chunked: fixed phrase, grammar explained later",
          },
        ],
      },
    };

    const { changed } = applyMontenegroVariantNotesToVocabulary(pkg);

    expect(changed).toBe(1);
    expect(pkg.vocabulary.en[0].noteEn).toBe(
      "Chunked: fixed phrase, grammar explained later\nMontenegro: ne razumijem (ijekavian)."
    );
  });

  it("does not invent a second Montenegro line", () => {
    const pkg = {
      vocabulary: {
        en: [
          {
            serbian: "ne razumem",
            en: "I do not understand",
            noteEn: "Chunked: later; Montenegro: ne razumijem (ijekavian).",
          },
        ],
      },
    };

    const { changed } = applyMontenegroVariantNotesToVocabulary(pkg);
    expect(changed).toBe(0);
    expect(pkg.vocabulary.en[0].noteEn).toBe(
      "Chunked: later; Montenegro: ne razumijem (ijekavian)."
    );
  });

  it("leaves rows without a dialect variant unchanged", () => {
    const pkg = {
      vocabulary: {
        en: [{ serbian: "hvala", en: "thank you", noteEn: "Gender: feminine" }],
      },
    };
    expect(applyMontenegroVariantNotesToVocabulary(pkg)).toEqual({ changed: 0 });
    expect(pkg.vocabulary.en[0].noteEn).toBe("Gender: feminine");
  });
});

describe("appendMontenegroNotesToMarkdown", () => {
  const unit = [
    "## Unit 1: Hello",
    "**Description:** Arrival phrases.",
    "",
    "## 2. Vocabulary",
    "",
    "### Useful phrases",
    "",
    "| Serbian | English | Notes |",
    "| :--- | :--- | :--- |",
    "| ne razumem | I do not understand | Chunked: fixed phrase, grammar explained later |",
    "| imam rezervaciju | I have a reservation | Chunked: fixed phrase, grammar explained in Unit 2 |",
    "",
    "## 3. Grammar",
    "The verb biti.",
  ].join("\n");

  it("appends the dialect line to the matching Notes cell", () => {
    const { markdown, changed } = appendMontenegroNotesToMarkdown(unit, [
      {
        serbian: "ne razumem",
        noteEn:
          "Chunked: fixed phrase, grammar explained later\nMontenegro: ne razumijem (ijekavian).",
      },
      { serbian: "imam rezervaciju", noteEn: "Chunked: fixed phrase, grammar explained in Unit 2" },
    ]);

    expect(changed).toBe(1);
    expect(markdown).toContain(
      "| ne razumem | I do not understand | Chunked: fixed phrase, grammar explained later; Montenegro: ne razumijem (ijekavian). |"
    );
    expect(markdown).toContain(
      "| imam rezervaciju | I have a reservation | Chunked: fixed phrase, grammar explained in Unit 2 |"
    );
    expect(markdown).toContain("## 3. Grammar");
  });

  it("is idempotent when the markdown row already has the note", () => {
    const already = unit.replace(
      "| ne razumem | I do not understand | Chunked: fixed phrase, grammar explained later |",
      "| ne razumem | I do not understand | Chunked: fixed phrase, grammar explained later; Montenegro: ne razumijem (ijekavian). |"
    );
    const { markdown, changed } = appendMontenegroNotesToMarkdown(already, [
      {
        serbian: "ne razumem",
        noteEn: "Montenegro: ne razumijem (ijekavian).",
      },
    ]);
    expect(changed).toBe(0);
    expect(markdown).toBe(already);
  });

  it("fills an empty Notes cell", () => {
    const emptyNotes = [
      "## 2. Vocabulary",
      "| Serbian | English | Notes |",
      "| --- | --- | --- |",
      "| gde | where | |",
    ].join("\n");
    const { markdown, changed } = appendMontenegroNotesToMarkdown(emptyNotes, [
      { serbian: "gde", noteEn: "Montenegro: gdje (ijekavian)." },
    ]);
    expect(changed).toBe(1);
    expect(markdown).toContain("| gde | where | Montenegro: gdje (ijekavian). |");
  });
});

describe("extractStructuredMontenegroNote", () => {
  it("finds the dialect line next to a Chunk note", () => {
    expect(
      extractStructuredMontenegroNote(
        "Chunked: later\nMontenegro: ne razumijem (ijekavian)."
      )
    ).toBe("Montenegro: ne razumijem (ijekavian).");
    expect(
      extractStructuredMontenegroNote("Gender: m; Montenegro: gdje (ijekavian).")
    ).toBe("Montenegro: gdje (ijekavian).");
  });
});
