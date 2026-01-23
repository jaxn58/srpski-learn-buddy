import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton
      richColors
      duration={8000}
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
