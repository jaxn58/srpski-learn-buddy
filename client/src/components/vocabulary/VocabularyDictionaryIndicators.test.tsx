import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../../../public/locales/en/translation.json";
import de from "../../../public/locales/de/translation.json";
import { MasteryIndicator } from "./VocabularyDictionaryIndicators";

// The app loads translations over HTTP at runtime. Tests read the same JSON
// files directly so the rendered text is exactly what ships.
const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: { translation: en },
    de: { translation: de },
  },
  interpolation: { escapeValue: false },
});

const TOOLTIP_EN = "Answer correctly 3 times to master this word/question";
const TOOLTIP_DE = "Beantworte 3 Mal richtig, um dieses Wort bzw. diese Frage zu meistern";

function renderIndicator(correctCount: number, language: "en" | "de") {
  void testI18n.changeLanguage(language);
  return render(
    <MasteryIndicator correctCount={correctCount} mastered={correctCount >= 3} />,
  );
}

describe("MasteryIndicator", () => {
  it.each([
    ["en", TOOLTIP_EN],
    ["de", TOOLTIP_DE],
  ] as const)("shows 0/3 in grey without a mark (%s)", async (language, tooltip) => {
    const { container } = renderIndicator(0, language);

    const badge = screen.getByText("0/3");
    expect(badge.className).toContain("text-slate-500");
    expect(container.querySelector("svg")).toBeNull();

    fireEvent.focus(badge);
    expect((await screen.findByRole("tooltip")).textContent).toContain(tooltip);
  });

  it.each([
    ["en", TOOLTIP_EN],
    ["de", TOOLTIP_DE],
  ] as const)("shows 1/3 as in progress (%s)", async (language, tooltip) => {
    const { container } = renderIndicator(1, language);

    const badge = screen.getByText("1/3");
    expect(badge.className).not.toContain("text-slate-500");
    expect(badge.className).not.toContain("text-yellow-900");
    expect(container.querySelector("svg")).toBeNull();

    fireEvent.focus(badge);
    expect((await screen.findByRole("tooltip")).textContent).toContain(tooltip);
  });

  it.each([
    ["en", "Mastered", TOOLTIP_EN],
    ["de", "Gemeistert", TOOLTIP_DE],
  ] as const)("shows mastered with a star at 3 (%s)", async (language, label, tooltip) => {
    const { container } = renderIndicator(3, language);

    const badge = screen.getByText(label);
    expect(badge.className).toContain("text-yellow-900");
    expect(container.querySelector("svg")).not.toBeNull();

    fireEvent.focus(badge);
    expect((await screen.findByRole("tooltip")).textContent).toContain(tooltip);
  });
});
