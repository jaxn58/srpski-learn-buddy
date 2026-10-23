import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENERGY_COSTS,
  DEFAULT_ENERGY_USD_PER_UNIT,
  DEFAULT_TIER_QUOTAS,
  DEFAULT_UPLOAD_MAX_FILE_BYTES,
  estimateEnergyCost,
  previewEnergyBandForChat,
  resolveChatEnergyCharge,
  type EnergyConfig,
  type EnergyEstimateInput,
} from "../convex/energy";

/**
 * Characterization of the 2026-10-23 Dev measurement.
 * Prints the gap between the chat preview and the charge.
 * Does not require the two numbers to match.
 */
const MODEL = "gemini-2.5-flash";

const config: EnergyConfig = {
  costs: { ...DEFAULT_ENERGY_COSTS },
  quotas: {
    full: DEFAULT_TIER_QUOTAS.full,
    buddy: DEFAULT_TIER_QUOTAS.buddy,
    basic: DEFAULT_TIER_QUOTAS.basic,
  },
  uploadMaxFileBytes: DEFAULT_UPLOAD_MAX_FILE_BYTES,
  usdPerEnergyUnit: DEFAULT_ENERGY_USD_PER_UNIT,
};

type Case = {
  name: string;
  previewInput: EnergyEstimateInput;
  chargeInput: EnergyEstimateInput;
  inputTokens: number;
  outputTokens: number;
  hasMeasuredUsage: boolean;
  previewMin: number;
  previewMax: number;
  previewMid: number;
  charge: number;
};

const measured: Case[] = [
  {
    name: "image 513346 bytes, usage present",
    previewInput: {
      responseMode: "compact",
      ragUsed: true,
      hasImageAttachment: true,
      attachmentBytes: 513346,
    },
    chargeInput: {
      responseMode: "compact",
      ragUsed: true,
      hasImageAttachment: true,
      attachmentBytes: 513346,
    },
    inputTokens: 4004,
    outputTokens: 39,
    hasMeasuredUsage: true,
    previewMin: 4,
    previewMax: 5,
    previewMid: 5,
    charge: 1,
  },
  {
    name: "pdf 1220928 bytes, usage present",
    previewInput: {
      responseMode: "compact",
      ragUsed: true,
      hasFileAttachment: true,
      attachmentBytes: 1220928,
    },
    chargeInput: {
      responseMode: "compact",
      ragUsed: true,
      hasFileAttachment: true,
      attachmentBytes: 1220928,
    },
    inputTokens: 106962,
    outputTokens: 55,
    hasMeasuredUsage: true,
    previewMin: 30,
    previewMax: 31,
    previewMid: 31,
    charge: 20,
  },
  {
    name: "text 20480 bytes, inlined at charge time",
    previewInput: {
      responseMode: "compact",
      ragUsed: true,
      hasFileAttachment: true,
      attachmentBytes: 20480,
    },
    chargeInput: {
      responseMode: "compact",
      ragUsed: true,
      hasFileAttachment: false,
      attachmentBytes: 20480,
    },
    inputTokens: 6104,
    outputTokens: 55,
    hasMeasuredUsage: true,
    previewMin: 7,
    previewMax: 8,
    previewMid: 8,
    charge: 2,
  },
  {
    name: "plain message, usage present",
    previewInput: { responseMode: "compact", ragUsed: true },
    chargeInput: { responseMode: "compact", ragUsed: true },
    inputTokens: 3824,
    outputTokens: 45,
    hasMeasuredUsage: true,
    previewMin: 1,
    previewMax: 2,
    previewMid: 2,
    charge: 1,
  },
];

function report(row: {
  name: string;
  previewMin: number;
  previewMax: number;
  previewMid: number;
  charge: number;
}) {
  const gap = row.previewMid - row.charge;
  console.log(
    `${row.name}: preview ${row.previewMin}-${row.previewMax} (mid ${row.previewMid}), charge ${row.charge}, gap ${gap}`
  );
}

describe("energy preview vs charge", () => {
  it("prints the measured gap and keeps today's split", () => {
    for (const row of measured) {
      const preview = previewEnergyBandForChat(config, row.previewInput, MODEL);
      const charge = resolveChatEnergyCharge(
        config,
        row.chargeInput,
        { inputTokens: row.inputTokens, outputTokens: row.outputTokens },
        row.hasMeasuredUsage,
        MODEL
      );
      report({
        name: row.name,
        previewMin: preview.costMin,
        previewMax: preview.costMax,
        previewMid: preview.costMid,
        charge,
      });
      expect(preview.costMin).toBe(row.previewMin);
      expect(preview.costMax).toBe(row.previewMax);
      expect(preview.costMid).toBe(row.previewMid);
      expect(charge).toBe(row.charge);
      expect(preview.costMid).toBeGreaterThan(charge);
    }
  });

  it("uses the flat upload estimate only when a non-image file has no usage", () => {
    const input: EnergyEstimateInput = {
      responseMode: "compact",
      ragUsed: true,
      hasFileAttachment: true,
      attachmentBytes: 1220928,
    };
    const flat = estimateEnergyCost(config, input);
    const charge = resolveChatEnergyCharge(
      config,
      input,
      { inputTokens: 0, outputTokens: 0 },
      false,
      MODEL
    );
    const preview = previewEnergyBandForChat(config, input, MODEL);
    console.log(
      `pdf without usage: preview mid ${preview.costMid}, flat charge ${charge}`
    );
    expect(charge).toBe(flat.cost);
    expect(charge).toBe(31);
    expect(preview.costMid).toBe(31);
  });
});
