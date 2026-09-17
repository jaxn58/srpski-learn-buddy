import { describe, it, expect } from "vitest";
import {
  collectLeadingCliticIssues,
  fillBlankWithAnswer,
  findLeadingClitics,
  serbianCellsOfTables,
  serbianOfExampleLine,
} from "./clitics";

describe("findLeadingClitics", () => {
  it("flags an enclitic in first position", () => {
    expect(findLeadingClitics("Sam dobro, hvala.")).toEqual([{ sentence: "Sam dobro,", clitic: "sam" }]);
    expect(findLeadingClitics("**Se** zovem Ana.")).toHaveLength(1);
    expect(findLeadingClitics("Li imate sobu?")).toHaveLength(1);
  });

  it("accepts correct second position and negated forms", () => {
    expect(findLeadingClitics("Dobro sam, hvala.")).toEqual([]);
    expect(findLeadingClitics("Ja sam Ana.")).toEqual([]);
    expect(findLeadingClitics("Zovem se Marko.")).toEqual([]);
    expect(findLeadingClitics("Nisam iz Srbije.")).toEqual([]);
    expect(findLeadingClitics("Imate li sobu?")).toEqual([]);
  });

  it("leaves ambiguous openers alone (je li, mi, ti, te)", () => {
    expect(findLeadingClitics("Je li ovo tvoj pasoš?")).toEqual([]);
    expect(findLeadingClitics("Mi smo iz Nemačke.")).toEqual([]);
    expect(findLeadingClitics("Ti si Marko.")).toEqual([]);
    expect(findLeadingClitics("Te knjige su nove.")).toEqual([]);
  });

  it("checks every sentence of a passage, not only the first", () => {
    const hits = findLeadingClitics("Ja sam Ana. Sam iz Beograda. Drago mi je.");
    expect(hits.map((h) => h.sentence)).toEqual(["Sam iz Beograda."]);
  });

  it("ignores a lone clitic without a following word (table header noise)", () => {
    expect(findLeadingClitics("sam")).toEqual([]);
  });

  it("treats a comma as a clause boundary (Lector finding 2026-09-16)", () => {
    expect(findLeadingClitics("Da, sam gospodin Petrović.")).toEqual([
      { sentence: "sam gospodin Petrović.", clitic: "sam" },
    ]);
    expect(findLeadingClitics("Zovem se Ana, se zovem Ana.")).toHaveLength(1);
    expect(findLeadingClitics("Marko, si li ti?")).toHaveLength(1);
  });

  it("accepts correct clauses after a comma", () => {
    expect(findLeadingClitics("Da, ja sam gospodin Petrović.")).toEqual([]);
    expect(findLeadingClitics("Dobar dan, ja sam Marko.")).toEqual([]);
    expect(findLeadingClitics("Ja sam Ana, a ti si Marko.")).toEqual([]);
    expect(findLeadingClitics("Dobro sam, hvala.")).toEqual([]);
    expect(findLeadingClitics("Da, je li ovo pasoš?")).toEqual([]);
    expect(findLeadingClitics("Kafa 200, čaj 150 dinara.")).toEqual([]);
  });
});

describe("fillBlankWithAnswer", () => {
  it("puts the answer into the blank and strips option letters", () => {
    expect(fillBlankWithAnswer("Ja _____ Ana.", "sam")).toBe("Ja sam Ana.");
    expect(fillBlankWithAnswer("A: Dobar dan! B: _____", "B) Dobar dan!")).toBe("A: Dobar dan! B: Dobar dan!");
  });

  it("leaves stems without a blank untouched", () => {
    expect(fillBlankWithAnswer("Ja sam Ana.", "sam")).toBe("Ja sam Ana.");
  });
});

describe("helpers", () => {
  it("extracts the Serbian part of a grammar example bullet", () => {
    expect(serbianOfExampleLine("*   **Sam** dobro. (I am well.)")).toBe("**Sam** dobro.");
    expect(serbianOfExampleLine("1.  Ja **sam** Ana. (I am Ana.)")).toBe("Ja **sam** Ana.");
    expect(serbianOfExampleLine("#### Examples")).toBeNull();
  });

  it("extracts the Serbian column of dialogue and phrase tables", () => {
    const md = [
      "| Role | Serbian | English |",
      "| :--- | :--- | :--- |",
      "| **Official** | Dobar dan. Vaš pasoš, molim. | Good day. Your passport, please. |",
      "| **Alex** | Se zovem Alex. | My name is Alex. |",
      "",
      "| Serbian | English |",
      "| :--- | :--- |",
      "| Izvolite. | Here you are. |",
    ].join("\n");
    expect(serbianCellsOfTables(md)).toEqual(["Dobar dan. Vaš pasoš, molim.", "Se zovem Alex.", "Izvolite."]);
  });
});

describe("collectLeadingCliticIssues", () => {
  it("reports issues from grammar examples, dialogues and exercises with paths", () => {
    const pkg = {
      languages: ["en"],
      content: {
        en: {
          grammarMd: "#### Examples\n*   Ja **sam** Ana. (I am Ana.)\n*   **Sam** dobro. (I am well.)\n",
          phrasesMd: "| Serbian | English |\n| :--- | :--- |\n| Dobro sam. | I am well. |",
          dialoguesMd: "| Role | Serbian | English |\n| :--- | :--- | :--- |\n| **Alex** | Se zovem Alex. | My name is Alex. |",
        },
      },
      exercises: {
        en: [
          {
            category: "translation",
            questions: [{ questionId: "q1", question: "I am well.", correctAnswer: "Sam dobro." }],
          },
          {
            category: "dialogueCompletion",
            questions: [
              {
                questionId: "q2",
                question: "A: Dobar dan! B: _____",
                options: ["A) Dobar dan.", "B) Sam Alex.", "C) Hvala."],
                correctAnswer: "A) Dobar dan.",
              },
            ],
          },
        ],
      },
    };
    const issues = collectLeadingCliticIssues(pkg);
    const where = issues.map((i) => i.path.join("."));
    expect(where).toContain("content.en.grammarMd");
    expect(where).toContain("content.en.dialoguesMd");
    expect(where).toContain("exercises.en.category=translation.questionId=q1.correctAnswer");
    expect(where).toContain("exercises.en.category=dialogueCompletion.questionId=q2.options");
    expect(where).not.toContain("content.en.phrasesMd");
    expect(issues).toHaveLength(4);
    expect(issues[0].message).toMatch(/cannot start a sentence/);
  });

  it("checks fill-in stems with the answer inserted (u1_ex5_q04 regression)", () => {
    const pkg = {
      languages: ["en"],
      content: { en: { grammarMd: "", phrasesMd: "", dialoguesMd: "" } },
      exercises: {
        en: [
          {
            category: "dialogueCompletion",
            questions: [
              {
                questionId: "u1_ex5_q04",
                question: "A: Vi ste gospodin Petrović? B: Da, _____ gospodin Petrović.",
                correctAnswer: "sam",
              },
            ],
          },
          {
            category: "fillInBlank",
            questions: [
              { questionId: "ok1", question: "Ja _____ Ana. (I am Ana.)", correctAnswer: "sam" },
              { questionId: "ok2", question: "Da, ja _____ Marko. (Yes, I am Marko.)", correctAnswer: "sam" },
              { questionId: "bad1", question: "Da, _____ Marko. (Yes, I am Marko.)", correctAnswer: "sam" },
            ],
          },
        ],
      },
    };
    const issues = collectLeadingCliticIssues(pkg);
    const where = issues.map((i) => i.path.join("."));
    expect(where).toContain("exercises.en.category=dialogueCompletion.questionId=u1_ex5_q04.question");
    expect(where).toContain("exercises.en.category=fillInBlank.questionId=bad1.question");
    expect(where).not.toContain("exercises.en.category=fillInBlank.questionId=ok1.question");
    expect(where).not.toContain("exercises.en.category=fillInBlank.questionId=ok2.question");
    expect(issues).toHaveLength(2);
    expect(issues[0].message).toContain("sam gospodin Petrović.");
  });

  it("is silent on a correct unit", () => {
    const pkg = {
      languages: ["en"],
      content: {
        en: {
          grammarMd: "*   Ja **sam** Ana. (I am Ana.)\n*   **Dobro sam**, hvala. (I am well, thank you.)",
          phrasesMd: "",
          dialoguesMd: "| Role | Serbian | English |\n| :--- | :--- | :--- |\n| **Alex** | Zovem se Alex. | My name is Alex. |",
        },
      },
      exercises: { en: [{ category: "fillInBlank", questions: [{ questionId: "q1", question: "Ja _____ Ana. (I am Ana.)", correctAnswer: "sam" }] }] },
    };
    expect(collectLeadingCliticIssues(pkg)).toEqual([]);
  });
});
