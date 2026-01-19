import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useState } from "react";

export interface FlipCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
  className?: string;
  flipped?: boolean;
  onFlip?: () => void;
}

export function FlipCard({
  front,
  back,
  className,
  flipped: controlledFlipped,
  onFlip,
}: FlipCardProps) {
  const [internalFlipped, setInternalFlipped] = useState(false);
  const isControlled = controlledFlipped !== undefined;
  const flipped = isControlled ? controlledFlipped : internalFlipped;

  const handleFlip = () => {
    if (!isControlled) {
      setInternalFlipped(!internalFlipped);
    }
    onFlip?.();
  };

  return (
    <div
      className={cn("flip-card-container", className)}
      onClick={handleFlip}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleFlip();
        }
      }}
      aria-label={flipped ? "Show word" : "Show translation"}
    >
      <div className={cn("flip-card-inner", flipped && "flipped")}>
        <div className="flip-card-front">{front}</div>
        <div className="flip-card-back">{back}</div>
      </div>
    </div>
  );
}
