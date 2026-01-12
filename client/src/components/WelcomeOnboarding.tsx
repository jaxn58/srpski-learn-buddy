import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { X } from "lucide-react";
import { AVAILABLE_ICONS } from "@/components/ui/icon-picker";

interface WelcomeOnboardingProps {
  userName: string;
  onClose: (disableAutoShow?: boolean) => void;
  language?: string; // User's learning language (defaults to "en")
  initialStep?: number; // Optional: Start at specific step (for preview)
}

// Use centralized icon mapping
const ICON_MAP = AVAILABLE_ICONS;

export function WelcomeOnboarding({ userName, onClose, language = "en", initialStep = 1 }: WelcomeOnboardingProps) {
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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="max-w-2xl w-full relative">
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fallback: If no steps in database, show simple welcome message
  if (!onboardingSteps || onboardingSteps.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="max-w-2xl w-full relative">
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-4 right-4"
            onClick={() => onClose()}
          >
            <X className="h-4 w-4" />
          </Button>

          <CardHeader>
            <CardTitle className="text-2xl">
              Welcome to Serbian AI Tutor, {userName}!
            </CardTitle>
            <CardDescription>
              Get started with your Serbian learning journey
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Start learning Serbian with our interactive platform. Complete units, earn XP, and track your progress!
            </p>
            
            <Button onClick={() => onClose()} className="w-full">
              Get Started!
            </Button>
          </CardContent>
        </Card>
      </div>
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card 
        className="max-w-2xl w-full relative"
        style={currentStepData?.backgroundColor ? { backgroundColor: currentStepData.backgroundColor } : undefined}
      >
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-4 right-4"
          onClick={skipTutorial}
        >
          <X className="h-4 w-4" />
        </Button>

        <CardHeader>
          <div className="flex items-center gap-3">
            <IconComponent className="h-6 w-6" />
            <CardTitle className="text-2xl">
              {renderTitle()}
            </CardTitle>
          </div>
          <CardDescription>
            {currentStepData?.description || `Step ${step} of ${totalSteps}`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Render HTML content from database */}
          {currentStepData && (
            <div 
              className="onboarding-content"
              dangerouslySetInnerHTML={{ __html: currentStepData.content }}
            />
          )}

          {/* Don't show again checkbox */}
          <div className="flex items-center space-x-2 pt-2 pb-2">
            <Checkbox 
              id="dontShowAgain" 
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <Label 
              htmlFor="dontShowAgain" 
              className="text-sm cursor-pointer select-none"
            >
              Don't show this tutorial automatically at login
            </Label>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={skipTutorial}>
              Skip Tutorial
            </Button>
            <div className="flex gap-2">
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  Previous
                </Button>
              )}
              <Button onClick={nextStep}>
                {step === totalSteps ? "Get Started!" : "Next"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

