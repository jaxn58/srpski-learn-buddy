import { Button } from "@/components/ui/button";
import { Loader2, Volume2 } from "lucide-react";
import { MasteryIndicator, MistakesIndicator } from "@/components/vocabulary/VocabularyDictionaryIndicators";

export type VocabularyDictionaryRow = {
  id: string;
  serbian: string;
  translation: string;
  altTranslation?: string;
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
  if (!rows.length) return null;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Column header (keeps rows clean: icons-only/status-only) */}
      <div className="grid grid-cols-[40px_1fr_140px_120px] items-center gap-3 border-b bg-muted/25 px-4 py-2 text-xs font-medium text-muted-foreground">
        <div className="flex items-center justify-center" title="Audio">
          <Volume2 className="h-4 w-4" aria-hidden="true" />
        </div>
        <div title="Word & meaning">Vocabulary</div>
        <div className="text-center" title="Progress toward mastery (3 correct)">
          Mastery
        </div>
        <div className="text-center" title="Incorrect attempts">
          Mistakes
        </div>
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
            className="grid grid-cols-[40px_1fr_140px_120px] items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/3 border-b last:border-b-0"
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
                {row.altTranslation && row.altTranslation.trim() ? (
                  <span>
                    {row.translation} <span className="text-muted-foreground/60">•</span> {row.altTranslation}
                  </span>
                ) : (
                  <span>{row.translation}</span>
                )}
              </div>
              {row.note && row.note.trim() && (
                <div className="mt-1 text-xs text-muted-foreground italic">{row.note}</div>
              )}
            </div>

            <div className="pt-0.5 flex justify-center">
              <MasteryIndicator correctCount={correctCount} mastered={mastered} />
            </div>

            <div className="pt-0.5 flex justify-center">
              <MistakesIndicator count={incorrectCount} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

