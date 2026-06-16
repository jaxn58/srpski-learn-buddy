import { Button } from "@/components/ui/button";
import { Loader2, Volume2, Brain } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useBuddyModal } from "@/contexts/BuddyModalContext";
import { MasteryIndicator, MistakesIndicator } from "@/components/vocabulary/VocabularyDictionaryIndicators";

export type VocabularyDictionaryRow = {
  id: string;
  serbian: string;
  translation: string;
  note?: string | null;
  audioStorageId?: string | null;
  unitNumber?: number;
  mastery: {
    correctCount: number;
    incorrectCount: number;
    mastered: boolean;
  };
};

export function VocabularyDictionaryTable({
  rows,
  onPlayAudio,
  playingAudioId,
  loadingAudioId,
}: {
  rows: VocabularyDictionaryRow[];
  onPlayAudio: (args: {
    vocabularyId: string;
    serbianWord: string;
    unitNumber?: number;
    audioStorageId?: string | null;
  }) => void;
  playingAudioId: string | null;
  loadingAudioId: string | null;
}) {
  const { t } = useTranslation();
  const { openBuddyModal } = useBuddyModal();
  if (!rows.length) return null;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Column header */}
      <div className="grid grid-cols-[40px_1fr_32px] sm:grid-cols-[40px_1fr_140px_120px_32px] items-center gap-3 border-b bg-muted/25 px-4 py-2 text-xs font-medium text-muted-foreground">
        <div className="flex items-center justify-center" title="Audio">
          <Volume2 className="h-4 w-4" aria-hidden="true" />
        </div>
        <div title="Word & meaning">{t("unit.vocabTable.header")}</div>
        <div className="hidden sm:block text-center" title="Progress toward mastery (3 correct)">
          {t("unit.vocabTable.mastery")}
        </div>
        <div className="hidden sm:block text-center" title="Incorrect attempts">
          {t("unit.vocabTable.mistakes")}
        </div>
        <div />
      </div>

      {rows.map((row) => {
        const isPlaying = playingAudioId === row.id;
        const isLoading = loadingAudioId === row.id;
        const correctCount = Math.max(0, Number(row.mastery.correctCount) || 0);
        const incorrectCount = Math.max(0, Number(row.mastery.incorrectCount) || 0);
        const mastered = Boolean(row.mastery.mastered) || correctCount >= 3;

        return (
          <div
            key={row.id}
            className="grid grid-cols-[40px_1fr_32px] sm:grid-cols-[40px_1fr_140px_120px_32px] items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/3 border-b last:border-b-0"
          >
            <Button
              variant="ghost"
              size="icon-sm"
              className="mt-0.5"
              onClick={() =>
                onPlayAudio({
                  vocabularyId: row.id,
                  serbianWord: row.serbian,
                  unitNumber: row.unitNumber,
                  audioStorageId: row.audioStorageId,
                })
              }
              disabled={isLoading}
              aria-label={isLoading ? "Generating audio" : "Play pronunciation"}
              title={isLoading ? "Generating audio..." : "Play pronunciation"}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Volume2 className={`h-4 w-4 ${isPlaying ? "text-primary" : "text-muted-foreground"}`} />
              )}
            </Button>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-foreground">{row.serbian}</span>
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">
                <span>{row.translation}</span>
              </div>
              {row.note && row.note.trim() && (
                <div className="mt-1 text-xs text-muted-foreground italic">{row.note}</div>
              )}
              {/* Compact mastery/mistakes only visible on mobile */}
              <div className="mt-1 flex items-center gap-3 sm:hidden">
                <MasteryIndicator correctCount={correctCount} mastered={mastered} />
                {incorrectCount > 0 && <MistakesIndicator count={incorrectCount} />}
              </div>
            </div>

            <div className="hidden sm:flex pt-0.5 justify-center">
              <MasteryIndicator correctCount={correctCount} mastered={mastered} />
            </div>

            <div className="hidden sm:flex pt-0.5 justify-center">
              <MistakesIndicator count={incorrectCount} />
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              className="mt-0.5"
              aria-label={t("unit.vocabTable.askBuddy", "Ask Learn Buddy")}
              title={t("unit.vocabTable.askBuddy", "Ask Learn Buddy")}
              onClick={() =>
                openBuddyModal(
                  t("buddy.prefill.explainWordCases", { word: row.serbian }),
                  row.unitNumber
                )
              }
            >
              <Brain className="h-4 w-4 text-muted-foreground hover:text-primary" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

