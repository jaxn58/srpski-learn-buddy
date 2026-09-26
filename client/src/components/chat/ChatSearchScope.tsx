import { BookOpen, FileText, Search, X, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ChatSearchScope = "both" | "documents" | "knowledge";

const SCOPES: ChatSearchScope[] = ["both", "documents", "knowledge"];

const SCOPE_ICONS: Record<ChatSearchScope, LucideIcon> = {
  both: Search,
  documents: FileText,
  knowledge: BookOpen,
};

interface ChatSearchScopeButtonProps {
  value: ChatSearchScope;
  onChange: (scope: ChatSearchScope) => void;
  disabled?: boolean;
}

export function ChatSearchScopeButton({
  value,
  onChange,
  disabled,
}: ChatSearchScopeButtonProps) {
  const { t } = useTranslation();
  const narrowed = value !== "both";
  const scopeLabel = t(`chat.searchScope.${value}`);
  const ScopeIcon = SCOPE_ICONS[value];

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={disabled}
              aria-label={t("chat.searchScope.label")}
              className={cn(
                "rounded-full h-10 w-10 shrink-0",
                narrowed && "bg-muted",
              )}
            >
              <ScopeIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" collisionPadding={12} className="px-2.5 py-1.5">
          <span className="text-[11px] leading-snug">
            {t("chat.searchScope.tooltip", { scope: scopeLabel })}
          </span>
        </TooltipContent>
      </Tooltip>
      <PopoverContent side="top" align="end" collisionPadding={12} className="w-72 p-3">
        <p className="text-xs font-semibold mb-2">{t("chat.searchScope.label")}</p>
        <RadioGroup
          value={value}
          onValueChange={(next) => onChange(next as ChatSearchScope)}
          className="gap-1"
          aria-label={t("chat.searchScope.label")}
        >
          {SCOPES.map((scope) => {
            const OptionIcon = SCOPE_ICONS[scope];
            return (
            <label
              key={scope}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-muted"
            >
              <RadioGroupItem value={scope} className="mt-0.5" />
              <OptionIcon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-tight">
                  {t(`chat.searchScope.${scope}`)}
                </span>
                <span className="block text-[11px] text-muted-foreground leading-snug">
                  {t(`chat.searchScope.${scope}Hint`)}
                </span>
              </span>
            </label>
            );
          })}
        </RadioGroup>
        <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
          {t("chat.searchScope.attachmentNote")}
        </p>
      </PopoverContent>
    </Popover>
  );
}

interface ChatSearchScopeChipProps {
  value: ChatSearchScope;
  onReset: () => void;
  disabled?: boolean;
}

export function ChatSearchScopeChip({
  value,
  onReset,
  disabled,
}: ChatSearchScopeChipProps) {
  const { t } = useTranslation();
  if (value === "both") return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
      {t("chat.searchScope.chip", { scope: t(`chat.searchScope.${value}`) })}
      <button
        type="button"
        onClick={onReset}
        disabled={disabled}
        aria-label={t("chat.searchScope.reset")}
        className="rounded-full p-0.5 hover:text-foreground disabled:opacity-50"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function ChatSearchScopeCaption({
  scope,
}: {
  scope: ChatSearchScope | undefined;
}) {
  const { t } = useTranslation();
  if (scope !== "documents" && scope !== "knowledge") return null;

  return (
    <p className="text-[11px] text-muted-foreground mt-1 px-2">
      {scope === "documents"
        ? t("chat.searchScope.fromDocuments")
        : t("chat.searchScope.fromKnowledge")}
    </p>
  );
}
