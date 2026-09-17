import { describe, it, expect } from "vitest";
import { looksLikePersonalNameByContext } from "../../convex/contentStudio/_validatorHelpers";

/**
 * The capitalization heuristic decides whether a Serbian token is a personal
 * name before any AI call. "strong" means: seen capitalized in the middle of a
 * sentence, i.e. almost certainly a name. Everything that can start an
 * utterance must NOT count as mid-sentence.
 */
describe("looksLikePersonalNameByContext", () => {
  it("treats a speaker label as an utterance start (Unit 2 regression, 2026-09-17)", () => {
    // "Još nešto?" after "A:" used to count as mid-sentence, so "još" was
    // dropped as a personal name and the Lector reported it as untaught.
    const samples = ["A: Još nešto? B: Ne, to je sve, hvala."];
    expect(looksLikePersonalNameByContext("još", samples)).toBe("weak");
  });

  it("accepts the other utterance boundaries", () => {
    expect(looksLikePersonalNameByContext("dobar", ["| Dobar dan. |"])).toBe("weak");
    expect(looksLikePersonalNameByContext("izvolite", ['Ona kaže: "Izvolite."'])).toBe("weak");
    expect(looksLikePersonalNameByContext("imate", ["Pitanje - Imate li kafu?"])).toBe("weak");
    expect(looksLikePersonalNameByContext("zdravo", ["Zdravo! Ja sam Ana."])).toBe("weak");
    expect(looksLikePersonalNameByContext("hvala", ["Ne, to je sve. Hvala."])).toBe("weak");
  });

  it("still flags a name used mid-sentence", () => {
    expect(looksLikePersonalNameByContext("marko", ["Ja sam Marko.", "Ti si Marko."])).toBe("strong");
    expect(looksLikePersonalNameByContext("ana", ["Zovem se Ana."])).toBe("strong");
  });

  it("clears a word that also appears lowercase", () => {
    expect(looksLikePersonalNameByContext("dan", ["Dobar dan.", "Lep dan je danas."])).toBe(false);
  });

  it("cannot decide without any occurrence", () => {
    expect(looksLikePersonalNameByContext("kafa", ["Imate li čaj?"])).toBe(false);
    expect(looksLikePersonalNameByContext("", ["Ja sam Ana."])).toBe(false);
  });
});
