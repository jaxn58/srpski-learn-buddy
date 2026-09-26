import { describe, expect, it } from "vitest";
import {
  buildModulePlanCoverage,
  extractCanDoIds,
  extractGrammarSection,
  grammarItemStatus,
  grammarMarkers,
  markerPresent,
} from "../../shared/curriculum/planCoverage";

describe("plan coverage", () => {
  it("reads Can-Do ids and ignores incomplete ids", () => {
    const text = [
      "Can-Do Statements:",
      "- A1.1-SOC-01: Can greet.",
      "- A1.1-ARR: not a real id",
      "- A1.1-GEN-02: Can use biti.",
    ].join("\n");
    expect(Array.from(extractCanDoIds(text)).sort()).toEqual(["A1.1-GEN-02", "A1.1-SOC-01"]);
  });

  it("splits planned grammar forms and matches them as whole words", () => {
    expect(grammarMarkers("`biti` (`sam, si`); `zvati se`; `u/na`")).toEqual([
      "biti",
      "sam",
      "si",
      "zvati se",
      "u",
      "na",
    ]);
    expect(grammarMarkers("none (recap of U001–U005)")).toEqual([]);
    expect(markerPresent("The verb biti: ja sam, ti si.", "sam")).toBe(true);
    expect(markerPresent("nisi", "si")).toBe(false);
    expect(markerPresent("Zovem se Ana.", "zvati se")).toBe(false);
    expect(markerPresent("Use zvati se in introductions.", "zvati se")).toBe(true);
  });

  it("reads the grammar target section", () => {
    const briefing = "Situation: Cafe.\n\nGrammar Target - In Scope: biti, ja sam, ti si.\n\nChunks allowed: zdravo\n";
    expect(extractGrammarSection(briefing)).toBe("biti, ja sam, ti si.");
  });

  it("marks a grammar target covered only when every planned form is in the briefing", () => {
    expect(grammarItemStatus(false, "`biti` (`sam, si`)", "").status).toBe("open");
    expect(grammarItemStatus(true, "`biti` (`sam, si`)", "biti, ja sam").status).toBe("started");
    expect(grammarItemStatus(true, "`biti` (`sam, si`)", "biti, ja sam, ti si").status).toBe("covered");
    expect(grammarItemStatus(true, "none (recap)", "").status).toBe("covered");
    expect(grammarItemStatus(false, "none (recap)", "").status).toBe("open");
  });

  it("counts a Can-Do as covered only when every target unit exists and lists the id", () => {
    const briefing = (n: number) =>
      n === 1 ? "Can-Do Statements:\n- A1.1-SOC-01: Can greet.\n\nGrammar Target - In Scope: biti, sam, si.\n" : "";
    const report = buildModulePlanCoverage({
      moduleNumber: 1,
      units: [
        { unitNumber: 1, unitType: "standard", titleEn: "Arrival", primaryGrammarEn: "`biti` (`sam, si`)" },
        { unitNumber: 6, unitType: "review", titleEn: "Review", primaryGrammarEn: "none (recap)" },
      ],
      canDos: [
        {
          canDoId: "A1.1-SOC-01",
          statementEn: "Can greet.",
          targetUnits: [1],
          targetNote: "U001",
        },
        {
          canDoId: "A1.1-GEN-02",
          statementEn: "Can use biti.",
          targetUnits: [1, 7],
          targetNote: "U001 (1st/2nd sg), U007 (all persons)",
        },
      ],
      unitExists: (n) => n === 1,
      briefing,
    });

    expect(report.canDos.find((c) => c.canDoId === "A1.1-SOC-01")?.status).toBe("covered");
    expect(report.canDos.find((c) => c.canDoId === "A1.1-GEN-02")?.status).toBe("started");
    expect(report.canDoCovered).toBe(1);
    expect(report.canDoStarted).toBe(1);
    expect(report.canDoTotal).toBe(2);
    expect(report.grammar.find((g) => g.unitNumber === 1)?.status).toBe("covered");
    expect(report.grammar.find((g) => g.unitNumber === 6)?.status).toBe("open");
    expect(report.grammarCovered).toBe(1);
    expect(report.grammarTotal).toBe(2);
  });
});
