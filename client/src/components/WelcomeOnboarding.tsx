import { useState, useMemo } from "react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Info, Loader2 } from "lucide-react";
import { AVAILABLE_ICONS } from "@/components/ui/icon-picker";
import { useTranslation } from "react-i18next";

interface WelcomeOnboardingProps {
  userName: string;
  onClose: (disableAutoShow?: boolean) => void;
  language?: string; // User's learning language (defaults to "en")
  initialStep?: number; // Optional: Start at specific step (for preview)
}

// Use centralized icon mapping
const ICON_MAP = AVAILABLE_ICONS;

export function WelcomeOnboarding({ userName, onClose, language = "en", initialStep = 1 }: WelcomeOnboardingProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(initialStep);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Load onboarding steps from database (V2: column-based multilanguage)
  const onboardingSteps = useQuery(api.onboarding.getActiveOnboardingStepsV2, { language });
  const isLoading = onboardingSteps === undefined;
  
  // Get total steps count
  const totalSteps = onboardingSteps?.length || 4;
  
  // Get current step data
  const currentStepData = useMemo(() => {
    if (!onboardingSteps || onboardingSteps.length === 0) return null;
    return onboardingSteps[step - 1]; // step is 1-indexed, array is 0-indexed
  }, [onboardingSteps, step]);

  const nextStep = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      onClose(dontShowAgain);
    }
  };

  const skipTutorial = () => {
    onClose(dontShowAgain);
  };

  // Get icon component from icon name
  const getIconComponent = (iconName: string) => {
    const IconComponent = ICON_MAP[iconName];
    return IconComponent || Info; // Fallback to Info icon
  };

  // Show loading state
  if (isLoading) {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Fallback: If no steps in database, show simple welcome message
  if (!onboardingSteps || onboardingSteps.length === 0) {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-2xl">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-2xl">
              {t("dashboard.welcome", { name: userName })}
            </CardTitle>
            <CardDescription>
              Get started with your Serbian learning journey
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 p-0">
            <p className="text-muted-foreground">
              Start learning Serbian with our interactive platform. Complete units, earn XP, and track your progress!
            </p>
            
            <Button onClick={() => onClose()} className="w-full">
              {t("onboarding.finish")}
            </Button>
          </CardContent>
        </DialogContent>
      </Dialog>
    );
  }

  // Get icon for current step
  const IconComponent = currentStepData ? getIconComponent(currentStepData.icon) : Info;

  // Render dynamic title with userName replacement in first step
  const renderTitle = () => {
    if (!currentStepData) return "";
    
    // Replace {{USER_NAME}} placeholder in title
    let title = currentStepData.title;
    if (step === 1 && userName) {
      title = title.replace(/\{\{USER_NAME\}\}/g, userName);
      // Also handle if the title doesn't have the placeholder but is the first step
      if (!title.includes(userName) && title.toLowerCase().includes("welcome")) {
        title = `${title}, ${userName}!`;
      }
    }
    
    return title;
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) skipTutorial(); }}>
      <DialogContent
        className="max-w-xl max-h-[85vh] overflow-y-auto p-5 sm:p-6"
        style={currentStepData?.backgroundColor ? { backgroundColor: currentStepData.backgroundColor } : undefined}
      >
        <CardHeader className="p-0 pb-3">
          <div className="flex items-center gap-2.5">
            <IconComponent className="h-5 w-5 shrink-0" />
            <CardTitle className="text-lg sm:text-xl leading-tight">
              {renderTitle()}
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            {currentStepData?.description || `Step ${step} of ${totalSteps}`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 p-0">
          {/* Render HTML content from database */}
          {currentStepData && (
            <div 
              className="onboarding-content"
              dangerouslySetInnerHTML={{ __html: currentStepData.content }}
            />
          )}

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row justify-between gap-2 pt-3">
            <Button variant="outline" onClick={skipTutorial} className="w-full sm:w-auto">
              {t("onboarding.skip")}
            </Button>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep(step - 1)} className="w-full sm:w-auto">
                  {t("onboarding.previous")}
                </Button>
              )}
              <Button onClick={nextStep} className="w-full sm:w-auto">
                {step === totalSteps ? t("onboarding.finish") : t("onboarding.next")}
              </Button>
            </div>
          </div>

          {/* Don't show again - BELOW buttons with separator */}
          <div className="flex items-center space-x-2 pt-2 border-t">
            <Checkbox 
              id="dontShowAgain" 
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <Label 
              htmlFor="dontShowAgain" 
              className="text-sm text-muted-foreground cursor-pointer select-none"
            >
              {t("onboarding.dontShowAgain")}
            </Label>
          </div>
        </CardContent>
      </DialogContent>
    </Dialog>
  );
}
