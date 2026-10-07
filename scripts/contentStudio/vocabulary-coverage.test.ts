import { describe, it, expect } from "vitest";
import {
  bookKnownLemma,
  collectSerbianCandidatesFromGrammar,
  collectSerbianCandidatesFromContent,
  cyrillicCoverageKey,
  dictionaryHeadword,
  isDialogueSnippet,
  isStockCafeDialogue,
  upgradeDialogueCompletionQuestions,
  expandLemmaKeys,
  resolveClassifierAnchor,
} from "../../convex/contentStudio/_validatorHelpers";
import {
  appendLatinScriptNote,
  cyrillicReadingExceptionBlock,
  transliterateSerbianCyrillicKey,
  unitTeachesCyrillicReading,
} from "../../convex/contentStudio/_shared";

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

describe("classifier lemma anchor", () => {
  it("expands a phrase so kartica is a known lemma inside SIM kartica", () => {
    const lemmas = expandLemmaKeys(["SIM kartica"]);
    expect(lemmas.has("sim kartica")).toBe(true);
    expect(lemmas.has("kartica")).toBe(true);
  });

  it("anchors kartico only when the classifier named the known lemma kartica", () => {
    const known = expandLemmaKeys(["SIM kartica"]);
    expect(resolveClassifierAnchor("kartico", "kartica", known)).toBe("kartica");
    expect(resolveClassifierAnchor("karticu", "kartica", known)).toBe("kartica");
    expect(resolveClassifierAnchor("karticom", "kartica", known)).toBe("kartica");
    expect(resolveClassifierAnchor("kartico", "kartica", new Set())).toBeNull();
    expect(resolveClassifierAnchor("mlijeko", "mlijeko", known)).toBeNull();
  });

  it("books the lemma on this unit before an earlier unit", () => {
    const unit = expandLemmaKeys(["SIM kartica"]);
    const earlier = expandLemmaKeys(["kartica"]);
    expect(bookKnownLemma("kartica", { unit, earlier, later: new Set() })).toBe("unit");
    expect(bookKnownLemma("kartica", { unit: new Set(), earlier, later: new Set() })).toBe("earlier");
  });

  it("names the dictionary form when the surface is new", () => {
    expect(dictionaryHeadword("kartico", "kartica")).toBe("kartica");
    expect(dictionaryHeadword("kartica", "kartica")).toBeNull();
  });
});

describe("Cyrillic reading units", () => {
  it("transliterates Serbian Cyrillic, including the digraph letters", () => {
    expect(transliterateSerbianCyrillicKey("захтев")).toBe("zahtev");
    expect(transliterateSerbianCyrillicKey("решење")).toBe("rešenje");
    expect(transliterateSerbianCyrillicKey("људски")).toBe("ljudski");
    expect(transliterateSerbianCyrillicKey("њега")).toBe("njega");
    expect(transliterateSerbianCyrillicKey("џез")).toBe("džez");
    expect(transliterateSerbianCyrillicKey("ђак")).toBe("đak");
    expect(transliterateSerbianCyrillicKey("ћерка")).toBe("ćerka");
  });

  it("leaves Latin and mixed tokens alone", () => {
    expect(transliterateSerbianCyrillicKey("zahtev")).toBeNull();
    expect(transliterateSerbianCyrillicKey("заhtev")).toBeNull();
    expect(transliterateSerbianCyrillicKey("ёлка")).toBeNull();
  });

  it("recognises the curriculum units and a briefing that teaches Cyrillic reading", () => {
    expect(unitTeachesCyrillicReading(64)).toBe(true);
    expect(unitTeachesCyrillicReading(68)).toBe(true);
    expect(unitTeachesCyrillicReading(72)).toBe(true);
    expect(unitTeachesCyrillicReading(75)).toBe(true);
    expect(unitTeachesCyrillicReading(63)).toBe(false);
    expect(unitTeachesCyrillicReading(3, "Cyrillic script: reading fluently")).toBe(true);
    expect(unitTeachesCyrillicReading(3, "Can read Cyrillic fluently")).toBe(true);
    expect(unitTeachesCyrillicReading(3, "with Cyrillic documents")).toBe(false);
  });

  it("covers a Cyrillic token when its Latin headword is already known", () => {
    const known = new Set(["zahtev", "uprava"]);
    expect(cyrillicCoverageKey("захтев", known)).toBe("");
    expect(cyrillicCoverageKey("управа", known)).toBe("");
    expect(cyrillicCoverageKey("предлог", known)).toBe("predlog");
    expect(cyrillicCoverageKey("а", known)).toBe("");
    expect(cyrillicCoverageKey("zahtev", known)).toBeNull();
  });

  it("adds the reading exception only for a Cyrillic unit", () => {
    expect(cyrillicReadingExceptionBlock(1)).toBe("");
    expect(cyrillicReadingExceptionBlock(64)).toContain("CYRILLIC READING");
    expect(cyrillicReadingExceptionBlock(64)).toContain("Serbian column stay Latin");
  });

  it("stores the Latin spelling as a note when the headword is Cyrillic", () => {
    expect(appendLatinScriptNote("захтев", undefined)).toBe("Latin: zahtev.");
    expect(appendLatinScriptNote("пореска управа", "Chunk: fixed phrase.")).toBe(
      "Chunk: fixed phrase.\nLatin: poreska uprava.",
    );
    expect(appendLatinScriptNote("захтев", "Latin: zahtev.")).toBe("Latin: zahtev.");
    expect(appendLatinScriptNote("zahtev", "Gender: masculine.")).toBe("Gender: masculine.");
    expect(appendLatinScriptNote("zahtev", undefined)).toBeUndefined();
  });
});

describe("dialogue completion", () => {
  it("keeps a dialogue this unit wrote, including a Cyrillic speaker", () => {
    const pkg = {
      exercises: {
        en: [
          {
            category: "dialogueCompletion",
            questions: [
              { questionId: "u64_ex5_q01", question: "Службеник: Ваш захтев је примљен.\nГрађанин: _____." },
              { questionId: "u64_ex5_q02", question: "Your request arrived." },
            ],
          },
        ],
      },
    };
    upgradeDialogueCompletionQuestions(pkg);
    expect(pkg.exercises.en).toHaveLength(1);
    expect(pkg.exercises.en[0].questions).toHaveLength(1);
    expect(pkg.exercises.en[0].questions[0].questionId).toBe("u64_ex5_q01");
  });

  it("drops the stock café script and a bare sentence instead of rewriting them", () => {
    const pkg = {
      exercises: {
        en: [
          {
            category: "dialogueCompletion",
            questions: [
              { questionId: "u64_ex5_q03", question: "Waiter: Šta ćete popiti?\nCustomer: Ja bih _____." },
              { questionId: "u64_ex5_q04", question: "zahtev" },
            ],
          },
        ],
      },
    };
    upgradeDialogueCompletionQuestions(pkg);
    expect(pkg.exercises.en).toEqual([]);
    expect(isStockCafeDialogue("Waiter: Šta želite?\nCustomer: Ja bih _____.")).toBe(true);
    expect(isDialogueSnippet("Official: Molim vas _____.")).toBe(true);
  });
});
