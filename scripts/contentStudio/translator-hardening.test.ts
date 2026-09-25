import { describe, it, expect } from "vitest";
import {
  findAppendedForeignParentheticalIssues,
  findUntranslatedLearnerPromptIssues,
  composeTranslatorSystemPrompt,
  stripLeadingGermanArticle,
  checkSectionQuality,
  checkMontenegroNoteCarriedOver,
  type TranslatorAdminContext,
} from "../../convex/contentStudio/_translationCore";
import { collectDraftSkillIds, closeTruncatedJson, mergeSkillsById } from "../../convex/contentStudio/_shared";
import {
  dropAiMissingInfoThatRepeatsVocabularySerbian,
  dropNonActionableVerifierIssues,
  extractMentionedLemmaTokens,
  extractSerbianFromMarkdown,
  mergeRepairVerifierReport,
  parseVerifierIssuesJson,
  type VerifierInputItem,
  type VerifierIssue,
  type VerifierReport,
} from "../../convex/contentStudio/_verifier";
import {
  ALL_TRANSLATOR_PROMPT_KEYS,
  CS_PROMPT_KEYS,
} from "../../convex/contentStudio/prompts";
import {
  CODE_DEFAULT_PROMPT_COGNATES,
  collectCognateCandidatesFromIssues,
  mergePromptCognates,
  parseUntranslatedPromptGuardFailures,
  selectConfirmedCognates,
} from "../../convex/contentStudio/_translatorCognates";

describe("findAppendedForeignParentheticalIssues", () => {
  it("flags DE dialogue with appended English reference paren", () => {
    const issues = findAppendedForeignParentheticalIssues([
      {
        questionId: "u3_ex5_q01",
        questionType: "multipleChoice",
        category: "dialogueCompletion",
        questionEn: "A: Excuse me… B: _____",
        questionDe: "A: Excuse me… B: _____ (A: Excuse me… B: _____)",
      },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("appended English parenthetical");
    expect(issues[0]).toContain("u3_ex5_q01");
  });

  it("passes when EN and DE have the same parenthesis count", () => {
    const issues = findAppendedForeignParentheticalIssues([
      {
        questionId: "u3_ex5_q02",
        questionType: "multipleChoice",
        category: "dialogueCompletion",
        questionEn: "A: Odakle ste Vi? B: _____",
        questionDe: "A: Odakle ste Vi? B: _____",
      },
    ]);
    expect(issues).toHaveLength(0);
  });

  it("does not flag translation prompts", () => {
    const issues = findAppendedForeignParentheticalIssues([
      {
        questionId: "u2_ex1_q01",
        questionType: "translation",
        category: "translation",
        questionEn: "Monday",
        questionDe: "Montag",
      },
    ]);
    expect(issues).toHaveLength(0);
  });
});

describe("findUntranslatedLearnerPromptIssues cognates", () => {
  it("allows orange as EN/DE cognate", () => {
    const cognates = mergePromptCognates(CODE_DEFAULT_PROMPT_COGNATES, []);
    const issues = findUntranslatedLearnerPromptIssues(
      [
        {
          questionId: "u5_ex4_q01",
          questionType: "matching",
          questionEn: "_____ = orange",
          questionDe: "_____ = orange",
        },
      ],
      cognates
    );
    expect(issues).toHaveLength(0);
  });

  it("still flags Monday/Monday", () => {
    const cognates = mergePromptCognates(CODE_DEFAULT_PROMPT_COGNATES, []);
    const issues = findUntranslatedLearnerPromptIssues(
      [
        {
          questionId: "u1_q01",
          questionType: "translation",
          questionEn: "Monday",
          questionDe: "Monday",
        },
      ],
      cognates
    );
    expect(issues).toHaveLength(1);
  });

  it("accepts admin-added cognates", () => {
    const cognates = mergePromptCognates(CODE_DEFAULT_PROMPT_COGNATES, ["sandwich"]);
    const issues = findUntranslatedLearnerPromptIssues(
      [
        {
          questionId: "u5_q99",
          questionType: "matching",
          questionEn: "sandwich",
          questionDe: "sandwich",
        },
      ],
      cognates
    );
    expect(issues).toHaveLength(0);
  });
});

describe("parseUntranslatedPromptGuardFailures", () => {
  it("extracts flagged prompt words from guard errors", () => {
    const msg =
      'Test translation quality guard failed (category=vocabularyMatching): questionId=u5_ex4_q01 (matching): learner prompt is still English "orange". Translate it';
    expect(parseUntranslatedPromptGuardFailures(msg)).toEqual(["orange"]);
  });

  it("extracts words from verifier issue wording", () => {
    const msg = 'German question prompt is still English ("_____ = orange").';
    expect(parseUntranslatedPromptGuardFailures(msg)).toEqual(["orange"]);
  });

  it("extracts fill-in source cue cognates like park", () => {
    const msg =
      'Test translation quality guard failed (category=fillInBlank): questionId=u4_ex2_q06: fill-in source cue is still English "(park)". Translate it to German inside the parentheses (e.g. milk→Milch, apples→Äpfel).';
    expect(parseUntranslatedPromptGuardFailures(msg)).toEqual(["park"]);
  });

  it("does not treat full-sentence context glosses as cognates", () => {
    const msg =
      'questionId=u1_ex2_q01: fill-in context gloss is still English "(I am Ana.)". Translate it to German';
    expect(parseUntranslatedPromptGuardFailures(msg)).toEqual([]);
  });
});

describe("closeTruncatedJson / parseVerifierIssuesJson", () => {
  it("closes a truncated issues array mid-string", () => {
    const raw =
      `{"issues":[{"key":"vocab:abc","severity":"warning","code":"semantic_mismatch","issue":"The German 'Es ist nahe' for 'To je blizu' (It is near) is grammatically`;
    const closed = closeTruncatedJson(raw);
    expect(closed).toBeTruthy();
    const parsed = JSON.parse(closed!);
    expect(parsed.issues).toHaveLength(1);
    expect(parsed.issues[0].key).toBe("vocab:abc");
  });

  it("salvages complete issue objects when the last one is truncated", () => {
    const raw =
      `{"issues":[` +
      `{"key":"vocab:one","severity":"warning","code":"semantic_mismatch","issue":"ok one","suggestion":"x"},` +
      `{"key":"vocab:two","severity":"warning","code":"semantic_mismatch","issue":"The German "`;
    const parsed = parseVerifierIssuesJson(raw);
    expect(parsed.issues.some((i: any) => i.key === "vocab:one")).toBe(true);
  });

  it("parses a valid verifier payload", () => {
    const parsed = parseVerifierIssuesJson(
      JSON.stringify({ issues: [{ key: "test:q1", severity: "info", code: "other", issue: "fine" }] })
    );
    expect(parsed.issues).toHaveLength(1);
    expect(parsed.issues[0].key).toBe("test:q1");
  });
});

describe("selectConfirmedCognates", () => {
  it("keeps only requested terms the German check named", () => {
    expect(selectConfirmedCognates(["sad", "park"], ["park", "hotel"])).toEqual(["park"]);
    expect(selectConfirmedCognates(["sad"], [])).toEqual([]);
  });
});

describe("collectCognateCandidatesFromIssues", () => {
  it("collects short EN=DE identity terms and ignores leftover-help issues", () => {
    expect(
      collectCognateCandidatesFromIssues([
        'questionId=u4_ex2_q06: fill-in source cue is still English "(park)".',
        "questionId=u4_ex3_q01: exercise prompt still has parenthetical help (Where is the station?).",
        'questionId=u5_ex4_q01 (matching): learner prompt is still English "hotel".',
      ])
    ).toEqual(["hotel", "park"]);
  });
});

describe("composeTranslatorSystemPrompt", () => {
  it("orders base → rules → skills → memory → retry", () => {
    const admin: TranslatorAdminContext = {
      rulesBlock: "=== SERBIAN LANGUAGE RULES ===\nEkavian only.",
      skillBlock: "TRANSLATOR SKILLS:\n--- SKILL: Dialogue ---\nKeep Serbian.",
      memoryBlock: "TRANSLATOR MEMORY:\n- [rule] Do not append EN",
    };
    const out = composeTranslatorSystemPrompt("BASE PROMPT HERE", admin, "retry: fix q01");
    const iBase = out.indexOf("BASE PROMPT HERE");
    const iRules = out.indexOf("SERBIAN LANGUAGE RULES");
    const iSkill = out.indexOf("TRANSLATOR SKILLS");
    const iMem = out.indexOf("TRANSLATOR MEMORY");
    const iRetry = out.indexOf("retry: fix q01");
    expect(iBase).toBeGreaterThanOrEqual(0);
    expect(iRules).toBeGreaterThan(iBase);
    expect(iSkill).toBeGreaterThan(iRules);
    expect(iMem).toBeGreaterThan(iSkill);
    expect(iRetry).toBeGreaterThan(iMem);
    expect(out).toContain("MUST use that German wording verbatim");
  });

  it("works with empty admin blocks", () => {
    const out = composeTranslatorSystemPrompt("BASE ONLY", {
      rulesBlock: "",
      skillBlock: "",
      memoryBlock: "",
    });
    expect(out).toBe("BASE ONLY");
  });
});

describe("checkSectionQuality — Serbian column identity (EN vs DE)", () => {
  it("passes when the Serbian column of a dialogue table is untouched", () => {
    const mdEn = [
      "### A. Dialogue 1: Arrival",
      "| Role | Serbian | English |",
      "| :--- | :--- | :--- |",
      "| **Alex** | Zdravo! Ja sam Alex. | Hello! I am Alex. |",
    ].join("\n");
    const mdDe = [
      "### A. Dialogue 1: Ankunft",
      "| Role | Serbian | German |",
      "| :--- | :--- | :--- |",
      "| **Alex** | Zdravo! Ja sam Alex. | Hallo! Ich bin Alex. |",
    ].join("\n");
    expect(checkSectionQuality(mdEn, mdDe)).toEqual([]);
  });

  it("flags a Serbian cell that the DE pass altered", () => {
    const mdEn = [
      "| Role | Serbian | English |",
      "| :--- | :--- | :--- |",
      "| **Alex** | Zdravo! Ja sam Alex. | Hello! I am Alex. |",
    ].join("\n");
    const mdDe = [
      "| Role | Serbian | German |",
      "| :--- | :--- | :--- |",
      "| **Alex** | Zdravo! Ja se zovem Alex. | Hallo! Ich bin Alex. |",
    ].join("\n");
    const issues = checkSectionQuality(mdEn, mdDe);
    expect(issues.some((i) => i.includes("Serbian column changed in row 1"))).toBe(true);
  });

  it("flags a Serbian cell in a grammar Pattern table", () => {
    const mdEn = [
      "#### Pattern",
      "| Person | Serbian | English |",
      "| :--- | :--- | :--- |",
      "| ja | **sam** | I am |",
      "| ti | **si** | you are |",
    ].join("\n");
    const mdDe = [
      "#### Muster",
      "| Person | Serbian | German |",
      "| :--- | :--- | :--- |",
      "| ja | **sam** | ich bin |",
      "| ti | **jesi** | du bist |",
    ].join("\n");
    const issues = checkSectionQuality(mdEn, mdDe);
    expect(issues.some((i) => i.includes("Serbian column changed in row 2"))).toBe(true);
    expect(issues.some((i) => i.includes("row 1"))).toBe(false);
  });

  it("does not fire on tables without a literal Serbian header", () => {
    const mdEn = [
      "| English Meaning | Serbian Word |",
      "| :--- | :--- |",
      "| apple | jabuka |",
    ].join("\n");
    const mdDe = [
      "| Deutsche Bedeutung | Serbian Word |",
      "| :--- | :--- |",
      "| Apfel | jabuka |",
    ].join("\n");
    expect(checkSectionQuality(mdEn, mdDe)).toEqual([]);
  });
});

describe("checkMontenegroNoteCarriedOver", () => {
  it("passes when the structured line survives unchanged", () => {
    expect(
      checkMontenegroNoteCarriedOver({
        courseVocabularyId: "v1",
        noteEn: "Chunk: fixed phrase, grammar explained later\nIn Montenegro: ne razumijem.",
        noteDe: "Feste Wendung, Grammatik später erklärt.\nIn Montenegro: ne razumijem.",
      })
    ).toBeNull();
  });

  it("passes when the source note has no Montenegro line", () => {
    expect(
      checkMontenegroNoteCarriedOver({ courseVocabularyId: "v2", noteEn: "Gender: feminine", noteDe: "Geschlecht: weiblich" })
    ).toBeNull();
  });

  it("flags a missing Montenegro line in noteDe", () => {
    const issue = checkMontenegroNoteCarriedOver({
      courseVocabularyId: "v3",
      noteEn: "Gender: neuter\nIn Montenegro: mlijeko.",
      noteDe: "Geschlecht: sächlich.",
    });
    expect(issue).toContain("v3");
    expect(issue).toContain("In Montenegro: mlijeko.");
  });

  it("flags a Montenegro line that was translated instead of copied", () => {
    const issue = checkMontenegroNoteCarriedOver({
      courseVocabularyId: "v4",
      noteEn: "In Montenegro: gdje.",
      noteDe: "In Montenegro: dort.",
    });
    expect(issue).toContain("v4");
  });
});

describe("ALL_TRANSLATOR_PROMPT_KEYS", () => {
  it("registers the five DB-only translator bases", () => {
    expect(ALL_TRANSLATOR_PROMPT_KEYS).toEqual([
      CS_PROMPT_KEYS.translatorMetadata,
      CS_PROMPT_KEYS.translatorSection,
      CS_PROMPT_KEYS.translatorVocab,
      CS_PROMPT_KEYS.translatorTests,
      CS_PROMPT_KEYS.translatorVerifier,
    ]);
  });
});

describe("stripLeadingGermanArticle", () => {
  it("removes a leading definite article from a noun gloss", () => {
    expect(stripLeadingGermanArticle("der Reisepass")).toBe("Reisepass");
    expect(stripLeadingGermanArticle("die Frau")).toBe("Frau");
    expect(stripLeadingGermanArticle("das Kind")).toBe("Kind");
    expect(stripLeadingGermanArticle("Den Pass")).toBe("Pass");
  });

  it("leaves lemmas and phrases without a leading article unchanged", () => {
    expect(stripLeadingGermanArticle("Reisepass")).toBe("Reisepass");
    expect(stripLeadingGermanArticle("zu Fuß gehen")).toBe("zu Fuß gehen");
    expect(stripLeadingGermanArticle("am Flughafen")).toBe("am Flughafen");
    expect(stripLeadingGermanArticle("ein bisschen")).toBe("ein bisschen");
  });

  it("does not empty a field that is only an article", () => {
    expect(stripLeadingGermanArticle("der")).toBe("der");
  });
});

describe("dropAiMissingInfoThatRepeatsVocabularySerbian", () => {
  const vocabMdEn = [
    "## Vocabulary",
    "",
    "| Serbian | English |",
    "| :--- | :--- |",
    "| platiti | to pay |",
    "| burek | burek |",
    "| kifla | croissant |",
    "| kesa | bag |",
    "| vi | you (pl.) |",
    "| oni | they |",
    "| jeste | yes / you are |",
    "| super | super |",
    "| to je sve | that's all |",
    "| to je osamdeset | that's eighty |",
    "| park | park |",
  ].join("\n");

  const vocabMdDe = [
    "## Vokabeln",
    "",
    "| Serbian | German |",
    "| :--- | :--- |",
    "| platiti | bezahlen |",
    "| burek | Burek |",
    "| kifla | Kipferl |",
    "| kesa | Tüte |",
    "| vi | ihr |",
    "| oni | sie |",
    "| jeste | ja |",
    "| super | super |",
    "| to je sve | das ist alles |",
    "| to je osamdeset | das sind achtzig |",
    "| park | Park |",
  ].join("\n");

  const vocabItem: VerifierInputItem = {
    key: "section:vocabulary",
    kind: "section",
    label: "section: vocabulary",
    serbian: "platiti\nburek\nkifla\nkesa\nvi\noni\njeste\nsuper\nto je sve\nto je osamdeset\npark",
    english: vocabMdEn,
    german: vocabMdDe,
  };

  const missingInfoIssue: VerifierIssue = {
    itemKey: "section:vocabulary",
    itemLabel: "section: vocabulary",
    itemKind: "section",
    severity: "critical",
    code: "missing_info",
    issue:
      "The German vocabulary section is missing Serbian entries: platiti, burek, kifla, kesa, vi, oni, jeste, super, to je sve, to je osamdeset. Add them to the German output.",
    suggestion: "Add platiti, burek, kifla, kesa, vi, oni, jeste, super, to je sve, to je osamdeset to the German table.",
  };

  it("extracts the Unit-4 lemma list including multi-word phrases", () => {
    const tokens = extractMentionedLemmaTokens(missingInfoIssue.issue);
    expect(tokens).toEqual(
      expect.arrayContaining([
        "platiti",
        "burek",
        "kifla",
        "kesa",
        "vi",
        "oni",
        "jeste",
        "super",
        "to je sve",
        "to je osamdeset",
      ])
    );
  });

  it("drops the vocabulary-section missing_info false positive when lemmas stay in DE", () => {
    const { kept, dropped } = dropAiMissingInfoThatRepeatsVocabularySerbian(
      [missingInfoIssue],
      [vocabItem]
    );
    expect(dropped).toHaveLength(1);
    expect(kept).toHaveLength(0);
  });

  it("drops a token-less missing_info about Serbian entries when EN/DE row counts match", () => {
    const vague: VerifierIssue = {
      ...missingInfoIssue,
      issue: "The German vocabulary section is missing Serbian entries from the source.",
      suggestion: undefined,
    };
    const { kept, dropped } = dropAiMissingInfoThatRepeatsVocabularySerbian([vague], [vocabItem]);
    expect(dropped).toHaveLength(1);
    expect(kept).toHaveLength(0);
  });

  it("keeps missing_info about leftover English that is not a Serbian-column lemma", () => {
    const leftover: VerifierIssue = {
      ...missingInfoIssue,
      issue: "German still has the English gloss \"to pay\" instead of bezahlen.",
      suggestion: "bezahlen",
    };
    const { kept, dropped } = dropAiMissingInfoThatRepeatsVocabularySerbian(
      [leftover],
      [vocabItem]
    );
    expect(dropped).toHaveLength(0);
    expect(kept).toHaveLength(1);
  });

  it("keeps missing_info when a named lemma is absent from the DE table", () => {
    const deMissingKifla = vocabMdDe
      .split("\n")
      .filter((line) => !line.includes("| kifla |"))
      .join("\n");
    const item: VerifierInputItem = {
      ...vocabItem,
      german: deMissingKifla,
      serbian: vocabItem.serbian.replace("kifla\n", ""),
    };
    const { kept, dropped } = dropAiMissingInfoThatRepeatsVocabularySerbian(
      [missingInfoIssue],
      [item]
    );
    expect(dropped).toHaveLength(0);
    expect(kept).toHaveLength(1);
  });

  it("keeps a real semantic mismatch on the vocabulary section", () => {
    const semantic: VerifierIssue = {
      ...missingInfoIssue,
      code: "semantic_mismatch",
      issue: "German 'Tüte' does not match Serbian 'kifla' (croissant).",
      suggestion: "Kipferl",
    };
    const { kept, dropped } = dropAiMissingInfoThatRepeatsVocabularySerbian(
      [semantic],
      [vocabItem]
    );
    expect(dropped).toHaveLength(0);
    expect(kept).toHaveLength(1);
  });

  it("does not drop missing_info on a non-vocabulary section", () => {
    const grammarItem: VerifierInputItem = {
      key: "section:grammar",
      kind: "section",
      label: "section: grammar",
      serbian: "platiti",
      english: "## Grammar\n\nPay with platiti.",
      german: "## Grammatik\n\nBezahlen.",
    };
    const grammarIssue: VerifierIssue = {
      ...missingInfoIssue,
      itemKey: "section:grammar",
      itemLabel: "section: grammar",
    };
    const { kept, dropped } = dropAiMissingInfoThatRepeatsVocabularySerbian(
      [grammarIssue],
      [grammarItem]
    );
    expect(dropped).toHaveLength(0);
    expect(kept).toHaveLength(1);
  });
});

describe("verifier convergence filters", () => {
  const phrasesEn = [
    "| Serbian | English |",
    "| :--- | :--- |",
    "| Gde je kuhinja? | Where is the kitchen? |",
    "| Koliko je sati? | What time is it? |",
    "| Oblačiš se? | Are you getting dressed? |",
  ].join("\n");
  const phrasesDe = [
    "| Serbian | German |",
    "| :--- | :--- |",
    "| Gde je kuhinja? | Wo ist die Küche? |",
    "| Koliko je sati? | Wie spät ist es? |",
    "| Oblačiš se? | Ziehst du dich an? |",
  ].join("\n");
  const phrasesItem: VerifierInputItem = {
    key: "section:phrases",
    kind: "section",
    label: "section: phrases",
    serbian: "",
    english: phrasesEn,
    german: phrasesDe,
  };

  it("puts diacritic-free Serbian column cells into the verifier anchor", () => {
    const anchor = extractSerbianFromMarkdown(phrasesEn);
    expect(anchor).toContain("Gde je kuhinja?");
    expect(anchor).toContain("Koliko je sati?");
    expect(anchor).toContain("Oblačiš se?");
  });

  it("drops a phrases missing_info that only asks to fill the serbian field", () => {
    const issue: VerifierIssue = {
      itemKey: "section:phrases",
      itemLabel: "section: phrases",
      itemKind: "section",
      severity: "critical",
      code: "missing_info",
      issue:
        "The German table contains Serbian phrases that are missing from the 'serbian' field of the item.",
      suggestion: "Add 'Gde je kuhinja?', 'Koliko je sati?', 'Boles je no trgu.' to the 'serbian' field.",
    };
    const { kept, dropped } = dropNonActionableVerifierIssues([issue], [phrasesItem]);
    expect(dropped).toHaveLength(1);
    expect(kept).toHaveLength(0);
  });

  it("drops missing_info whose quotes already sit in the Serbian column", () => {
    const issue: VerifierIssue = {
      itemKey: "section:phrases",
      itemLabel: "section: phrases",
      itemKind: "section",
      severity: "critical",
      code: "missing_info",
      issue: "German table is missing Serbian phrases.",
      suggestion: "Add 'Gde je kuhinja?' and 'Koliko je sati?'.",
    };
    const { kept, dropped } = dropNonActionableVerifierIssues([issue], [phrasesItem]);
    expect(dropped).toHaveLength(1);
    expect(kept).toHaveLength(0);
  });

  it("keeps a real semantic mismatch on a phrases section", () => {
    const issue: VerifierIssue = {
      itemKey: "section:phrases",
      itemLabel: "section: phrases",
      itemKind: "section",
      severity: "critical",
      code: "semantic_mismatch",
      issue: "German 'Wo ist das Bad?' does not mean Serbian 'Gde je kuhinja?'.",
      suggestion: "Wo ist die Küche?",
    };
    const { kept, dropped } = dropNonActionableVerifierIssues([issue], [phrasesItem]);
    expect(dropped).toHaveLength(0);
    expect(kept).toHaveLength(1);
  });

  it("drops an AI demand to remove a multiple-choice help gloss", () => {
    const item: VerifierInputItem = {
      key: "test:test_u12_ex3_q01_preview_v4",
      kind: "test",
      label: "test test_u12_ex3_q01_preview_v4",
      questionType: "multipleChoice",
      serbian: "Expected Serbian answer: Zdravo.",
      english: "Question (EN): Zdravo. (Hello.)",
      german: "Question (DE): Zdravo. (Hallo.)",
    };
    const issue: VerifierIssue = {
      itemKey: item.key,
      itemLabel: item.label,
      itemKind: "test",
      severity: "critical",
      code: "other",
      issue:
        "Help glosses on multipleChoice items must be removed. Only the Serbian stem/blank should remain.",
      suggestion: "Remove the German question text entirely, as this is a multiple-choice item with a Serbian stem.",
    };
    const { kept, dropped } = dropNonActionableVerifierIssues([issue], [item]);
    expect(dropped).toHaveLength(1);
    expect(kept).toHaveLength(0);
  });

  it("keeps a gloss whose German meaning does not match", () => {
    const item: VerifierInputItem = {
      key: "test:q1",
      kind: "test",
      label: "test q1",
      questionType: "multipleChoice",
      serbian: "Expected Serbian answer: Zdravo.",
      english: "Question (EN): Zdravo.",
      german: "Question (DE): Zdravo.",
    };
    const issue: VerifierIssue = {
      itemKey: item.key,
      itemLabel: item.label,
      itemKind: "test",
      severity: "critical",
      code: "semantic_mismatch",
      issue: "German gloss 'Auf Wiedersehen' does not mean the same as English gloss 'Hello'.",
      suggestion: "Hallo",
    };
    const { kept, dropped } = dropNonActionableVerifierIssues([issue], [item]);
    expect(dropped).toHaveLength(0);
    expect(kept).toHaveLength(1);
  });
});

function reportFrom(issues: VerifierIssue[]): VerifierReport {
  return {
    itemsChecked: 3,
    issues,
    criticals: issues.filter((issue) => issue.severity === "critical"),
    warnings: [],
    infos: [],
    durationMs: 0,
    provider: null,
    model: null,
    inputTokens: null,
    outputTokens: null,
    thinkingTokens: null,
    estimatedCostUsd: null,
    pass: "pass1",
    checkedItemKeys: ["section:phrases", "test:q1", "section:dialogues"],
  };
}

describe("mergeRepairVerifierReport", () => {
  const items: VerifierInputItem[] = [
    {
      key: "section:phrases",
      kind: "section",
      label: "section: phrases",
      serbian: "Gde je kuhinja?",
      english: "Gde je kuhinja?",
      german: "Wo ist die Küche?",
    },
    {
      key: "test:q1",
      kind: "test",
      label: "test q1",
      questionType: "translation",
      serbian: "ponedeljak",
      english: "Question (EN): Monday",
      german: "Question (DE): Montag",
    },
  ];

  it("keeps a previous AI finding on an item the repair did not change and drops a new one", () => {
    const previous: VerifierIssue = {
      itemKey: "test:q1",
      itemLabel: "test q1",
      itemKind: "test",
      severity: "critical",
      code: "semantic_mismatch",
      issue: "German 'Dienstag' does not mean 'ponedeljak'.",
      suggestion: "Montag",
    };
    const invented: VerifierIssue = {
      itemKey: "test:q1",
      itemLabel: "test q1",
      itemKind: "test",
      severity: "critical",
      code: "other",
      issue: "Help glosses on multipleChoice items must be removed.",
      suggestion: "Remove the German question text entirely.",
    };
    const repaired: VerifierIssue = {
      itemKey: "section:phrases",
      itemLabel: "section: phrases",
      itemKind: "section",
      severity: "critical",
      code: "semantic_mismatch",
      issue: "German 'Bad' does not mean 'kuhinja'.",
      suggestion: "Küche",
    };
    const merged = mergeRepairVerifierReport(
      reportFrom([previous]),
      reportFrom([invented, repaired]),
      new Set(["section:phrases"]),
      items
    );
    expect(merged.issues.map((issue) => issue.issue)).toEqual([
      "German 'Bad' does not mean 'kuhinja'.",
      "German 'Dienstag' does not mean 'ponedeljak'.",
    ]);
  });

  it("does not carry a serbian-field false positive forward", () => {
    const stale: VerifierIssue = {
      itemKey: "section:dialogues",
      itemLabel: "section: dialogues",
      itemKind: "section",
      severity: "critical",
      code: "missing_info",
      issue: "Serbian dialogue lines are missing from the 'serbian' field.",
      suggestion: "Add 'Gde je moja soba?' to the 'serbian' field.",
    };
    const merged = mergeRepairVerifierReport(
      reportFrom([stale]),
      reportFrom([]),
      new Set(["section:phrases"]),
      [
        ...items,
        {
          key: "section:dialogues",
          kind: "section",
          label: "section: dialogues",
          serbian: "Gde je moja soba?",
          english: "| Serbian | English |\n| Gde je moja soba? | Where is my room? |",
          german: "| Serbian | German |\n| Gde je moja soba? | Wo ist mein Zimmer? |",
        },
      ]
    );
    expect(merged.criticals).toHaveLength(0);
  });
});

describe("draft skill selection", () => {
  it("unions Creator and Lector checkboxes and drops duplicates", () => {
    expect(
      collectDraftSkillIds({
        specialistSkillIds: ["skillA", "skillB"],
        auditorSkillIds: ["skillB", "skillC"],
      })
    ).toEqual(["skillA", "skillB", "skillC"]);
  });

  it("returns no skills when nothing is checked on the draft", () => {
    expect(collectDraftSkillIds({ specialistSkillIds: [], auditorSkillIds: [] })).toEqual([]);
    expect(collectDraftSkillIds({})).toEqual([]);
  });

  it("drops empty prompts when merging skill docs", () => {
    expect(
      mergeSkillsById([
        { _id: "a", name: "Montenegro", prompt: "Add gdje to Notes." },
        { _id: "a", name: "dup", prompt: "ignored" },
        { _id: "b", name: "empty", prompt: "  " },
      ])
    ).toEqual([{ _id: "a", name: "Montenegro", prompt: "Add gdje to Notes." }]);
  });
});
