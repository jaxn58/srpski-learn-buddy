import { useState } from "react";
import { Label } from "./label";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { 
  Info, 
  BookOpen, 
  Trophy, 
  Brain, 
  Sparkles, 
  Rocket, 
  Star, 
  Award, 
  Target, 
  Zap, 
  Heart,
  LucideIcon,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";

export const AVAILABLE_ICONS: Record<string, LucideIcon> = {
  Info,
  BookOpen,
  Trophy,
  Brain,
  Sparkles,
  Rocket,
  Star,
  Award,
  Target,
  Zap,
  Heart,
};

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  label?: string;
}

export function IconPicker({ value, onChange, label }: IconPickerProps) {
  const [open, setOpen] = useState(false);

  const CurrentIcon = AVAILABLE_ICONS[value] || Info;

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2"
          >
            <CurrentIcon className="h-4 w-4" />
            <span>{value || "Select Icon"}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-3" align="start">
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(AVAILABLE_ICONS).map(([name, Icon]) => (
              <Button
                key={name}
                type="button"
                variant={value === name ? "default" : "outline"}
                className={cn(
                  "h-16 w-full flex flex-col gap-1 relative",
                  value === name && "ring-2 ring-ring"
                )}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
              >
                {value === name && (
                  <Check className="h-3 w-3 absolute top-1 right-1" />
                )}
                <Icon className="h-6 w-6" />
                <span className="text-xs">{name}</span>
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface IconDisplayProps {
  iconName: string;
  className?: string;
}

export function IconDisplay({ iconName, className }: IconDisplayProps) {
  const Icon = AVAILABLE_ICONS[iconName] || Info;
  return <Icon className={className} />;
}
