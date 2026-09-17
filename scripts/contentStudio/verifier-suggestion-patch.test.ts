import { describe, it, expect } from "vitest";
import {
  isActionableGermanSuggestion,
  applySuggestionToGermanText,
  applyDeterministicVerifierSuggestions,
  formatRetryFeedback,
  type VerifierIssue,
} from "../../convex/contentStudio/_verifier";

describe("isActionableGermanSuggestion", () => {
  it("accepts concrete German rewrites", () => {
    expect(isActionableGermanSuggestion("eine Milch")).toBe(true);
    expect(isActionableGermanSuggestion("Wochenmarkt")).toBe(true);
  });

  it("rejects instructional English advice", () => {
    expect(isActionableGermanSuggestion('Remove the parenthetical help; keep only: "Ja _____"')).toBe(
      false
    );
    expect(isActionableGermanSuggestion('Translate the English prompt "Monday" into German')).toBe(
      false
    );
    expect(isActionableGermanSuggestion("German for: milk")).toBe(false);
  });
});

describe("applySuggestionToGermanText", () => {
  it("fixes ein Milch via article gender variants", () => {
    const out = applySuggestionToGermanText(
      "_____ (ein Milch)",
      'The translation for "one milk" is grammatically incorrect. "Milch" is feminine.',
      "eine Milch"
    );
    expect(out).toBe("_____ (eine Milch)");
  });

  it("replaces quoted wrong German ein Bier with eine Milch", () => {
    const out = applySuggestionToGermanText(
      "Beispiel: jedno mleko (ein Bier)",
      'The Serbian source "jedno mleko" was translated as "ein Bier". This is a clear mistranslation.',
      "eine Milch"
    );
    expect(out).toBe("Beispiel: jedno mleko (eine Milch)");
  });

  it("does not turn Milch into eine Milch inside ein Milch via bare noun quote", () => {
    const out = applySuggestionToGermanText(
      "ein Milch",
      'Grammatically incorrect. "Milch" is feminine.',
      "eine Milch"
    );
    // articleGenderVariants still fixes ein Milch → eine Milch
    expect(out).toBe("eine Milch");
  });
});

describe("applyDeterministicVerifierSuggestions", () => {
  it("patches test and section criticals from the U003 screenshot case", () => {
    const issues: VerifierIssue[] = [
      {
        itemKey: "test:u3_ex1_q05",
        itemLabel: "test u3_ex1_q05",
        itemKind: "test",
        severity: "critical",
        code: "grammatical",
        issue:
          'The translation for "one milk" is grammatically incorrect. "Milch" is a feminine noun ("die Milch"), so the correct indefinite article is "eine Milch".',
        suggestion: "eine Milch",
      },
      {
        itemKey: "section:grammar",
        itemLabel: "section: grammar",
        itemKind: "section",
        severity: "critical",
        code: "semantic_mismatch",
        issue:
          'The Serbian source "jedno mleko" was translated as "ein Bier". This is a clear mistranslation.',
        suggestion: "eine Milch",
      },
      {
        itemKey: "vocab:abc",
        itemLabel: "vocabulary: 'pijaca'",
        itemKind: "vocabulary",
        severity: "warning",
        code: "semantic_mismatch",
        issue: "pijaca is an open-air market; Markt is generic.",
        suggestion: "Wochenmarkt",
      },
    ];

    const result = applyDeterministicVerifierSuggestions({
      issues,
      state: {
        testsDe: [{ questionId: "u3_ex1_q05", question: "_____ (ein Milch)" }],
        contentDe: [
          {
            contentType: "grammar",
            content: "### Gender\n\n- jedno mleko (ein Bier)\n- jedan sok (ein Saft)\n",
          },
        ],
        vocabularyDe: [{ courseVocabularyId: "abc", de: "Markt" }],
      },
    });

    expect(result.patchedKeys.sort()).toEqual(["section:grammar", "test:u3_ex1_q05", "vocab:abc"].sort());
    expect(result.state.testsDe[0].question).toBe("_____ (eine Milch)");
    expect(result.state.contentDe[0].content).toContain("jedno mleko (eine Milch)");
    expect(result.state.contentDe[0].content).not.toContain("ein Bier");
    expect(result.state.vocabularyDe[0].de).toBe("Wochenmarkt");
    expect(result.remainingIssues).toHaveLength(0);
  });
});

describe("formatRetryFeedback", () => {
  it("marks actionable suggestions as MUST use verbatim", () => {
    const fb = formatRetryFeedback([
      {
        itemKey: "test:u3_ex1_q05",
        itemLabel: "test u3_ex1_q05",
        itemKind: "test",
        severity: "critical",
        code: "grammatical",
        issue: "Wrong article",
        suggestion: "eine Milch",
      },
    ]);
    expect(fb.test).toContain("MUST use Suggested German verbatim: «eine Milch»");
  });
});
