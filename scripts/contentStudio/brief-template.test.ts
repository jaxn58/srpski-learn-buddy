import { describe, it, expect } from "vitest";
import {
  BRIEF_FIELDS,
  BRIEF_MAX_CHARS,
  missingRequiredBriefFields,
  parseBriefText,
  renderBriefText,
  type BriefFields,
} from "../../shared/contentStudio/briefTemplate";

const FULL: BriefFields = {
  unitType: "standard",
  cefrLevel: "A1.1",
  strand: "SOC",
  setting: "serbia",
  situation: "Arrival day in Belgrade. The learner lands at the airport and checks into a hotel.",
  canDo: [
    "A1.1-SOC-01: Can greet, say goodbye and use basic politeness formulas.",
    "A1.1-SOC-02: Can say who they are, ask someone's name and say where they come from.",
  ].join("\n"),
  grammarIn: "The verb biti in 1st and 2nd person singular: ja sam, ti si, nisam, nisi.",
  grammarOut: "biti in 3rd person and plural (Unit 7); noun cases; the particle li (Unit 2).",
  chunks: "\"Zovem se ...\", \"Drago mi je\", \"u Beogradu\" (locative preview in Unit 19)",
  recycle: "none (first unit)",
  pitfalls: ["Short verb form first: WRONG \"Sam Ana.\" -> CORRECT \"Ja sam Ana.\"", "Negation: WRONG \"Ne sam\" -> CORRECT \"Nisam\""].join("\n"),
  scenes: ["Passport control: official greets, asks for the passport.", "Hotel reception: name and origin."].join("\n"),
  listening: "dovidjenja, hvala, Nemacka",
  cultural: "Greetings by time of day; handshake when introducing yourself",
  exerciseFocus: "Exercise 2 and 3 test sam/si/nisam/nisi; Exercise 5 uses the scenes.",
};

describe("renderBriefText", () => {
  it("renders module first, selects as labels, lines as bullet lists", () => {
    const text = renderBriefText({ moduleNumber: 1, fields: FULL });
    expect(text.startsWith("Module: 1\nUnit type: standard\nCEFR Level: A1.1\nStrand: SOC – Arrival")).toBe(false);
    expect(text.startsWith("Module: 1\nUnit type: standard\nCEFR Level: A1.1\nStrand: SOC – People & Social\nSetting: Serbia (dinars)")).toBe(true);
    expect(text).toContain("\nCan-Do Statements:\n- A1.1-SOC-01: Can greet");
    expect(text).toContain("\nTypical L1 pitfalls (German/English speakers):\n- Short verb form first");
    expect(text).toContain("\nListening focus: dovidjenja, hvala, Nemacka");
  });

  it("omits empty optional fields", () => {
    const text = renderBriefText({ moduleNumber: 2, fields: { unitType: "review", cefrLevel: "A1.2", strand: "DAY", setting: "serbia", situation: "Recap." } });
    expect(text).not.toContain("Chunks allowed");
    expect(text).not.toContain("Exercise focus");
    expect(text).toContain("Unit type: review");
  });

  it("stays well below the creator limit for a full brief", () => {
    const text = renderBriefText({ moduleNumber: 1, fields: FULL });
    expect(text.length).toBeLessThan(BRIEF_MAX_CHARS);
  });
});

describe("parseBriefText", () => {
  it("round-trips every field produced by the renderer", () => {
    const text = renderBriefText({ moduleNumber: 1, fields: FULL });
    const parsed = parseBriefText(text);
    expect(parsed.recognized).toBe(true);
    expect(parsed.moduleNumber).toBe(1);
    for (const def of BRIEF_FIELDS) {
      expect(parsed.fields[def.id] ?? "").toBe(FULL[def.id] ?? "");
    }
  });

  it("maps select labels and ids back to option ids", () => {
    const parsed = parseBriefText("Module: 3\nUnit type: checkpoint\nCEFR Level: A2.1\nStrand: BIZ – Work & Business\nSetting: Montenegro coast (euros)\nSituation: x");
    expect(parsed.fields.strand).toBe("BIZ");
    expect(parsed.fields.setting).toBe("montenegro_coast");
    expect(parsed.fields.unitType).toBe("checkpoint");
    const parsedIds = parseBriefText("Module: 3\nStrand: BIZ\nSetting: serbia\nSituation: x");
    expect(parsedIds.fields.strand).toBe("BIZ");
    expect(parsedIds.fields.setting).toBe("serbia");
  });

  it("does not recognise legacy free-text briefs", () => {
    const legacy = "Situation: café in Montenegro\n- Prerequisites: greetings (Unit 1)\n- New: ordering drinks";
    const parsed = parseBriefText(legacy);
    expect(parsed.recognized).toBe(false);
  });

  it("tolerates CRLF line endings and extra blank lines", () => {
    const text = renderBriefText({ moduleNumber: 1, fields: FULL }).replace(/\n/g, "\r\n").replace("Situation:", "\r\n\r\nSituation:");
    const parsed = parseBriefText(text);
    expect(parsed.recognized).toBe(true);
    expect(parsed.fields.situation).toBe(FULL.situation);
    expect(parsed.fields.scenes).toBe(FULL.scenes);
  });
});

describe("missingRequiredBriefFields", () => {
  it("lists required fields that are empty", () => {
    const missing = missingRequiredBriefFields({ unitType: "standard", cefrLevel: "A1.1" });
    expect(missing.map((d) => d.id)).toEqual(["strand", "setting", "situation", "canDo", "grammarIn"]);
    expect(missingRequiredBriefFields(FULL)).toEqual([]);
  });
});
