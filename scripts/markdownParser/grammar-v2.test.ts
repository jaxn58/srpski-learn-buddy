import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeGrammarV2, validateSection } from "./sectionUtils";
import { validateMarkdownStructure } from "./parser";

/**
 * Grammar v2 (didactic template) validation.
 *
 * The sample below is the grammar section the Creator produced on Dev for
 * Unit 1 "Arrival in Belgrade" (2026-09-16) with the v2 Creator prompt.
 */
const V2_GRAMMAR = `## 3. Grammar

This section covers your first Serbian verb.

### The Verb 'biti' (to be): Present Tense (I am / you are)

#### Why You Need This
You need the verb 'biti' (to be) to make the most basic sentences, like "I am Alex".

#### The Rule
The Serbian verb 'biti' is irregular. The forms are \`sam\` for "I am" and \`si\` for "you are".
To make a sentence negative, \`ne\` and the verb merge into a single word: \`nisam\`, \`nisi\`.

#### Pattern

| Pronoun | Affirmative | English | Negative | English |
| :--- | :--- | :--- | :--- | :--- |
| ja | **sam** | I am | **nisam** | I am not |
| ti | **si** | you are | **nisi** | you are not |

#### Examples
*   Ja **sam** Ana. (I am Ana.)
*   Ti **si** Marko. (You are Marko.)
*   Ja **nisam** gospođa Petrović. (I am not Mrs. Petrović.)
*   Dobro **sam**, hvala. (I am well, thank you.)

#### Watch Out
*   WRONG: Ja ne sam Marko. → CORRECT: Ja **nisam** Marko. (ne + sam always merge into nisam.)
*   WRONG: Ja sam zovem se Alex. → CORRECT: Ja **se zovem** Alex.

#### Quick Check
1.  Complete the sentence: Ja _____ David.
2.  Choose the correct form: Ti (sam / si) dobro.
3.  Make this sentence negative: Ja sam Marija.

**Answers:** 1. sam 2. si 3. Ja nisam Marija.
`;

const LEGACY_GRAMMAR = `## 3. Grammar

### The Locative Case

The locative case is used after the prepositions u and na to express location.

| Nominative | Locative |
| --- | --- |
| Beograd | u Beogradu |
| pijaca | na pijaci |

More than five hundred characters of explanation follow here so that the legacy
substantiality check passes. Lorem ipsum dolor sit amet, consectetur adipiscing elit,
sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat.
`;

describe("analyzeGrammarV2", () => {
  it("recognises the v2 template and accepts a complete grammar point", () => {
    const res = analyzeGrammarV2(V2_GRAMMAR);
    expect(res.isV2).toBe(true);
    expect(res.points).toBe(1);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
  });

  it("leaves legacy grammar untouched", () => {
    const res = analyzeGrammarV2(LEGACY_GRAMMAR);
    expect(res.isV2).toBe(false);
    expect(res.errors).toEqual([]);
  });

  it("reports a missing block", () => {
    const withoutQuickCheck = V2_GRAMMAR.replace(/#### Quick Check[\s\S]*$/, "");
    const res = analyzeGrammarV2(withoutQuickCheck);
    expect(res.isV2).toBe(true);
    expect(res.errors.join("\n")).toMatch(/missing block\(s\): #### Quick Check/);
  });

  it("requires at least three translated examples", () => {
    const twoExamples = V2_GRAMMAR.replace(
      /#### Examples[\s\S]*?(?=#### Watch Out)/,
      "#### Examples\n*   Ja **sam** Ana. (I am Ana.)\n*   Ti **si** Marko. (You are Marko.)\n\n",
    );
    const res = analyzeGrammarV2(twoExamples);
    expect(res.errors.join("\n")).toMatch(/at least 3 example lines/);
  });

  it("requires a WRONG -> CORRECT pair in Watch Out", () => {
    const softWatchOut = V2_GRAMMAR.replace(
      /#### Watch Out[\s\S]*?(?=#### Quick Check)/,
      "#### Watch Out\n*   Be careful with word order.\n\n",
    );
    const res = analyzeGrammarV2(softWatchOut);
    expect(res.errors.join("\n")).toMatch(/WRONG: \.\.\. -> CORRECT/);
  });

  it("requires an answers line in Quick Check", () => {
    const noAnswers = V2_GRAMMAR.replace(/\*\*Answers:\*\*.*$/m, "");
    const res = analyzeGrammarV2(noAnswers);
    expect(res.errors.join("\n")).toMatch(/Answers/);
  });

  it("warns when blocks are out of order but complete", () => {
    const swapped = V2_GRAMMAR
      .replace("#### Why You Need This", "#### TMP_A")
      .replace("#### The Rule", "#### Why You Need This")
      .replace("#### TMP_A", "#### The Rule");
    const res = analyzeGrammarV2(swapped);
    expect(res.errors).toEqual([]);
    expect(res.warnings.join("\n")).toMatch(/out of order/);
  });

  it("checks every grammar point separately", () => {
    const twoPoints = `${V2_GRAMMAR}\n### Negation with 'ne'\n\n#### Why You Need This\nTo say no.\n\n#### The Rule\nPut ne before the verb.\n`;
    const res = analyzeGrammarV2(twoPoints);
    expect(res.points).toBe(2);
    expect(res.errors.some((e) => e.includes("Negation with 'ne'") && e.includes("#### Pattern"))).toBe(true);
    expect(res.errors.some((e) => e.includes("The Verb 'biti'"))).toBe(false);
  });
});

describe("validateSection('grammar') with v2", () => {
  it("passes for the complete v2 sample", () => {
    const res = validateSection("grammar", V2_GRAMMAR);
    expect(res.valid).toBe(true);
  });

  it("fails for a v2 sample without Pattern table", () => {
    const noTable = V2_GRAMMAR.replace(/#### Pattern[\s\S]*?(?=#### Examples)/, "#### Pattern\nJust prose here.\n\n");
    const res = validateSection("grammar", noTable);
    expect(res.valid).toBe(false);
    expect(res.errors.join("\n")).toMatch(/Pattern' needs a table/);
  });
});

describe("validateMarkdownStructure keeps published units valid", () => {
  const fixtures = ["unit2-morning-coffee.md", "unit3-market-numbers.md"];
  for (const name of fixtures) {
    it(`does not flag legacy grammar in ${name}`, () => {
      const md = readFileSync(join(__dirname, "__fixtures__", name), "utf8");
      const res = validateMarkdownStructure(md);
      const v2Errors = res.errors.filter((e) => e.startsWith("Grammar v2"));
      expect(v2Errors).toEqual([]);
    });
  }
});
