import { cn } from "@/lib/utils";

type BetaLockedPriceProps = {
  label: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses: Record<NonNullable<BetaLockedPriceProps["size"]>, string> = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
};

/** Placeholder price shown during beta — no real amount in the DOM. */
export function BetaLockedPrice({ label, className, size = "md" }: BetaLockedPriceProps) {
  return (
    <div className={cn("text-center", className)}>
      <div
        className={cn(
          "font-bold text-muted-foreground blur-[6px] select-none pointer-events-none",
          sizeClasses[size]
        )}
        aria-hidden="true"
      >
        €00.00
      </div>
      <span className="text-[10px] text-muted-foreground leading-tight block mt-0.5">{label}</span>
    </div>
  );
}
