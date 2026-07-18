import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast, useSonner, type ToasterProps } from "sonner";

const TOAST_DURATION = 5000;

/**
 * sonner 2.x pausiert seine Auto-Close-Timer bedingungslos, solange der Tab
 * unsichtbar ist (document.hidden) - eine Opt-out-Prop (frueher
 * `pauseWhenPageIsHidden`) existiert in dieser Version nicht mehr. Dadurch
 * frieren Toasts "ewig" ein, sobald man waehrend eines Vorgangs zum
 * Terminal/anderen Tab wechselt, und muessen manuell geschlossen werden.
 *
 * Dieser Watchdog schliesst offene, nicht-persistente Toasts selbst - aber
 * ausschliesslich solange der Tab im Hintergrund ist. Bei sichtbarem Tab
 * bleibt sonners Hover-/Interaktions-Pause vollstaendig erhalten.
 */
function useHiddenTabAutoDismiss(defaultDuration: number) {
  const { toasts } = useSonner();
  const timers = useRef<Map<string | number, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  useEffect(() => {
    const clearAll = () => {
      timers.current.forEach((handle) => clearTimeout(handle));
      timers.current.clear();
    };

    const sync = () => {
      if (typeof document === "undefined" || !document.hidden) {
        // Tab sichtbar: sonner steuert das Schliessen (inkl. Hover-Pause).
        clearAll();
        return;
      }

      const activeIds = new Set(toasts.map((entry) => entry.id));
      timers.current.forEach((handle, id) => {
        if (!activeIds.has(id)) {
          clearTimeout(handle);
          timers.current.delete(id);
        }
      });

      for (const entry of toasts) {
        if (timers.current.has(entry.id)) continue;
        // Persistente Toasts (Loading/Promise/duration:Infinity) nicht anfassen.
        if (entry.type === "loading" || entry.promise || entry.duration === Infinity) {
          continue;
        }
        const ms =
          typeof entry.duration === "number" ? entry.duration : defaultDuration;
        const handle = setTimeout(() => {
          toast.dismiss(entry.id);
          timers.current.delete(entry.id);
        }, ms);
        timers.current.set(entry.id, handle);
      }
    };

    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      clearAll();
    };
  }, [toasts, defaultDuration]);
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  useHiddenTabAutoDismiss(TOAST_DURATION);

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton
      richColors
      duration={TOAST_DURATION}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:border group-[.toaster]:shadow-2xl group-[.toaster]:ring-1 group-[.toaster]:ring-foreground/10 group-[.toaster]:backdrop-blur-sm group-[.toaster]:animate-in group-[.toaster]:fade-in-0 group-[.toaster]:slide-in-from-top-2 group-[.toaster]:duration-300",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:font-medium",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      style={
        {
          // Slightly tint default toasts so they stand out from plain white pages.
          "--normal-bg": "color-mix(in oklch, var(--brand-blue) 8%, var(--popover))",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "color-mix(in oklch, var(--brand-blue) 25%, var(--border))",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
