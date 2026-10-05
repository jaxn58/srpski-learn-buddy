import { describe, it, expect } from "vitest";
import {
  applyBriefingFieldCorrections,
  briefingStampAllowsCreator,
  hashBriefingText,
  type BriefingCheckStamp,
} from "../../shared/contentStudio/briefingCheck";
import { renderBriefText } from "../../shared/contentStudio/briefTemplate";
import { BRIEFING_CONSISTENCY_PROMPT, BRIEFING_CORRECTION_PROMPT } from "../../shared/contentStudio/briefingConsistencyPrompt";

function stamp(notes: string, ok: boolean): BriefingCheckStamp {
  return {
    notesHash: hashBriefingText(notes),
    ok,
    contradictions: ok ? [] : [{ quoteA: "a", quoteB: "b", reason: "clash" }],
    checkedAt: 1,
    model: "gemini-2.5-pro",
  };
}

describe("briefing stamp gate", () => {
  const notes = "Grammar Target - In Scope: Dative pronouns in boli me\nChunks allowed: Boli me glava";

  it("allows the creator only when the stamp passed for this exact text", () => {
    expect(briefingStampAllowsCreator(notes, stamp(notes, true))).toBe(true);
    expect(briefingStampAllowsCreator(notes, stamp(notes, false))).toBe(false);
    expect(briefingStampAllowsCreator(notes, null)).toBe(false);
    expect(briefingStampAllowsCreator(notes, undefined)).toBe(false);
    expect(briefingStampAllowsCreator(`${notes}\nextra`, stamp(notes, true))).toBe(false);
  });

  it("treats line endings as the same briefing", () => {
    expect(hashBriefingText("Boli me glava\r\n")).toBe(hashBriefingText("Boli me glava\n"));
  });
});

describe("applyBriefingFieldCorrections", () => {
  it("writes the corrected grammar target and leaves the unit type alone", () => {
    const brief = renderBriefText({
      moduleNumber: 3,
      fields: {
        unitType: "standard",
        cefrLevel: "A2.1",
        strand: "DAY",
        setting: "serbia",
        situation: "At the doctor.",
        grammarIn: "Dative pronouns in boli me",
        chunks: "Boli me glava",
      },
    });
    const next = applyBriefingFieldCorrections(brief, {
      grammarIn: "Accusative pronouns in boli me. Dative pronouns in treba mi and hladno mi je.",
      unitType: "review",
    });
    expect(next).toContain("Accusative pronouns in boli me");
    expect(next).toContain("Unit type: standard");
    expect(applyBriefingFieldCorrections(brief, { grammarIn: "Dative pronouns in boli me" })).toBeNull();
  });
});

describe("briefing consistency prompt", () => {
  it("uses Unit 28 as an example of a self-contradiction and does not encode a form list", () => {
    expect(BRIEFING_CONSISTENCY_PROMPT).toContain("boli me");
    expect(BRIEFING_CONSISTENCY_PROMPT).toContain("Boli me glava");
    expect(BRIEFING_CONSISTENCY_PROMPT).toContain("Do not treat this unit as a special case");
    expect(BRIEFING_CONSISTENCY_PROMPT).toContain("do not invent a separate check");
  });

  it("treats a deferred chunk, out of scope, and a one-sentence hint as consistent", () => {
    expect(BRIEFING_CONSISTENCY_PROMPT).toContain("Ja sam iz Nemačke");
    expect(BRIEFING_CONSISTENCY_PROMPT).toContain("Do not report them as a contradiction");
    expect(BRIEFING_CONSISTENCY_PROMPT).toContain("does not teach the case");
    expect(BRIEFING_CONSISTENCY_PROMPT).not.toContain("A chunk or a pitfall teaches a point the briefing lists as out of scope");
  });

  it("treats a broader Can-Do next to a deferred form as consistent", () => {
    expect(BRIEFING_CONSISTENCY_PROMPT).toContain("A Can-Do statement may name a broader skill");
    expect(BRIEFING_CONSISTENCY_PROMPT).toContain("Out of Scope defers nemam");
    expect(BRIEFING_CORRECTION_PROMPT).toContain("leave canDo and grammarOut unchanged");
  });

  it("does not move a deferred chunk into the grammar target", () => {
    expect(BRIEFING_CORRECTION_PROMPT).toContain("Do not delete the chunk");
    expect(BRIEFING_CORRECTION_PROMPT).toContain("Do not move that form into the in-scope grammar target");
  });
});
