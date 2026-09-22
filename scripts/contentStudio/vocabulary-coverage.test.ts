import { describe, it, expect } from "vitest";
import {
  collectSerbianCandidatesFromGrammar,
  collectSerbianCandidatesFromContent,
  resolveKnownInflectedBase,
} from "../../convex/contentStudio/_validatorHelpers";

const PATTERN_TABLE = [
  "#### Pattern",
  "",
  "| Pronoun | Positive Form | English | Negative Form | English |",
  "| :--- | :--- | :--- | :--- | :--- |",
  "| ja | **sam** | I am | **nisam** | I am not |",
  "| ti | **si** | you are (informal) | **nisi** | you are not (informal) |",
  "",
  "| Pronoun | Verb Form | English |",
  "| :--- | :--- | :--- |",
  "| ja | **zovem se** | my name is |",
].join("\n");

const EXAMPLES = [
  "#### Examples",
  "*   Ja **sam** Ana. (I am Ana.)",
  "*   Ti **nisi** David. (You are not David.)",
  "*   **Zovem se** Alex. (My name is Alex.)",
].join("\n");

describe("collectSerbianCandidatesFromGrammar", () => {
  it("harvests the taught forms from a pattern table", () => {
    const words = collectSerbianCandidatesFromGrammar(PATTERN_TABLE);
    expect(words).toContain("sam");
    expect(words).toContain("nisam");
    expect(words).toContain("si");
    expect(words).toContain("nisi");
    expect(words).toContain("zovem");
    expect(words).toContain("se");
  });

  it("ignores pronoun cells and English glosses of the table", () => {
    const words = collectSerbianCandidatesFromGrammar(PATTERN_TABLE);
    for (const english of ["i", "am", "you", "are", "not", "informal", "my", "name", "is", "english", "pronoun", "form"]) {
      expect(words).not.toContain(english);
    }
  });

  it("harvests Serbian from example bullets, not their English gloss", () => {
    const words = collectSerbianCandidatesFromGrammar(EXAMPLES);
    expect(words).toContain("nisi");
    expect(words).toContain("zovem");
    // English words of the gloss in parentheses must not leak in.
    for (const english of ["am", "are", "not", "my", "name", "is"]) {
      expect(words).not.toContain(english);
    }
    // Personal names inside the Serbian sentence do come through here; the
    // proper-noun heuristic of the coverage net filters them later.
    expect(words).toContain("david");
  });

  it("leaves explanatory prose alone", () => {
    const prose = [
      "#### The Rule",
      "In Serbian, like in English, the verb \"to be\" changes for each person.",
      "The pronoun is often omitted in everyday speech.",
    ].join("\n");
    expect(collectSerbianCandidatesFromGrammar(prose)).toEqual([]);
  });

  it("returns nothing for an empty section", () => {
    expect(collectSerbianCandidatesFromGrammar("")).toEqual([]);
    expect(collectSerbianCandidatesFromGrammar("   ")).toEqual([]);
  });
});

describe("collectSerbianCandidatesFromContent", () => {
  it("covers grammar in addition to dialogues and phrases", () => {
    const pkg = {
      content: {
        en: {
          grammarMd: PATTERN_TABLE,
          dialoguesMd: [
            "| Role | Serbian | English |",
            "| :--- | :--- | :--- |",
            "| **Official** | Vaše ime i prezime, molim? | Your first and last name, please? |",
          ].join("\n"),
          phrasesMd: [
            "| Serbian | English |",
            "| :--- | :--- |",
            "| Izvolite. | Here you are. |",
          ].join("\n"),
        },
      },
    };
    const words = collectSerbianCandidatesFromContent(pkg);
    // From the dialogue: the one-letter conjunction must survive tokenisation.
    expect(words).toContain("i");
    expect(words).toContain("prezime");
    // From phrases.
    expect(words).toContain("izvolite");
    // From grammar: the regression that started this check.
    expect(words).toContain("nisi");
  });
});

describe("resolveKnownInflectedBase", () => {
  const known = (keys: string[]) => new Set(keys);

  it("maps masculine genitive sira to earlier-taught sir", () => {
    expect(resolveKnownInflectedBase("sira", known(["sir"]))).toBe("sir");
  });

  it("maps šećera to šećer and kafu to kafa", () => {
    expect(resolveKnownInflectedBase("šećera", known(["šećer"]))).toBe("šećer");
    expect(resolveKnownInflectedBase("kafu", known(["kafa"]))).toBe("kafa");
    expect(resolveKnownInflectedBase("mlijekom", known(["mlijeko"]))).toBe("mlijeko");
  });

  it("maps adjective gender and plural dinars to the taught lemma", () => {
    expect(resolveKnownInflectedBase("dobra", known(["dobar"]))).toBe("dobar");
    expect(resolveKnownInflectedBase("dobro", known(["dobar"]))).toBe("dobar");
    expect(resolveKnownInflectedBase("dinare", known(["dinar"]))).toBe("dinar");
    expect(resolveKnownInflectedBase("dinare", known(["dinara"]))).toBe("dinara");
    expect(resolveKnownInflectedBase("jedna", known(["jedan"]))).toBe("jedan");
  });

  it("covers genitive of a longer noun already in the table", () => {
    expect(resolveKnownInflectedBase("aerodroma", known(["aerodrom"]))).toBe("aerodrom");
    expect(resolveKnownInflectedBase("restorana", known(["restoran"]))).toBe("restoran");
  });

  it("returns the surface when it is already the known lemma", () => {
    expect(resolveKnownInflectedBase("sir", known(["sir"]))).toBe("sir");
  });

  it("does not invent a lemma when the base is not known", () => {
    expect(resolveKnownInflectedBase("sira", known([]))).toBeNull();
    expect(resolveKnownInflectedBase("kafa", known([]))).toBeNull();
  });

  it("does not treat a feminine nominative as an inflection of an unrelated word", () => {
    expect(resolveKnownInflectedBase("kafa", known(["voda"]))).toBeNull();
  });

  it("does not treat stola (table) as an inflection of sto (one hundred)", () => {
    expect(resolveKnownInflectedBase("stola", known(["sto"]))).toBeNull();
  });
});
