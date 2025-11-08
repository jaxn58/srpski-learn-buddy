import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, BookOpen, Trophy, MessageSquare, X } from "lucide-react";

interface WelcomeOnboardingProps {
  userName: string;
  onClose: () => void;
}

export function WelcomeOnboarding({ userName, onClose }: WelcomeOnboardingProps) {
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const nextStep = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  const skipTutorial = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full relative">
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-4 right-4"
          onClick={skipTutorial}
        >
          <X className="h-4 w-4" />
        </Button>

        <CardHeader>
          <CardTitle className="text-2xl">
            {step === 1 && `Welcome to Serbian AI Tutor, ${userName}! 🎉`}
            {step === 2 && "How the Course Works 📚"}
            {step === 3 && "Gamification & Rewards 🏆"}
            {step === 4 && "AI Learning Assistant 🤖"}
          </CardTitle>
          <CardDescription>
            Step {step} of {totalSteps}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Your Learning Journey Starts Here</AlertTitle>
                <AlertDescription>
                  Serbian AI Tutor is your companion to the "Step by Step Serbian 1" textbook.
                  This interactive platform helps you master Serbian through structured lessons,
                  exercises, and AI-powered support.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <h3 className="font-semibold">What You'll Learn:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Serbian alphabet and pronunciation</li>
                  <li>Essential grammar (cases, verb conjugations, gender)</li>
                  <li>Practical vocabulary for everyday situations</li>
                  <li>Conversation skills through interactive exercises</li>
                </ul>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Alert>
                <BookOpen className="h-4 w-4" />
                <AlertTitle>27 Units, Flexible Learning</AlertTitle>
                <AlertDescription>
                  The course is divided into 27 units covering different topics.
                  You can choose your learning pace: 3, 6, 9, or 12 months.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="p-3 border rounded-lg">
                  <h4 className="font-semibold text-sm mb-1">📖 Unit Content</h4>
                  <p className="text-sm text-muted-foreground">
                    Each unit includes an overview, detailed grammar explanations, and practice examples.
                  </p>
                </div>

                <div className="p-3 border rounded-lg">
                  <h4 className="font-semibold text-sm mb-1">✍️ Interactive Exercises</h4>
                  <p className="text-sm text-muted-foreground">
                    Complete fill-in-the-blank and translation exercises to reinforce your learning.
                  </p>
                </div>

                <div className="p-3 border rounded-lg">
                  <h4 className="font-semibold text-sm mb-1">📊 Progress Tracking</h4>
                  <p className="text-sm text-muted-foreground">
                    Your progress is automatically saved. Complete units to unlock new ones.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Alert>
                <Trophy className="h-4 w-4" />
                <AlertTitle>Earn XP, Badges & Streaks</AlertTitle>
                <AlertDescription>
                  Stay motivated with our gamification system that rewards your learning efforts.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="p-3 border rounded-lg bg-blue-50">
                  <h4 className="font-semibold text-sm mb-1">⭐ Experience Points (XP)</h4>
                  <p className="text-sm text-muted-foreground">
                    Earn 50 XP for completing a unit + 50 XP bonus for finishing all exercises.
                    Level up as you progress!
                  </p>
                </div>

                <div className="p-3 border rounded-lg bg-purple-50">
                  <h4 className="font-semibold text-sm mb-1">🏅 Achievement Badges</h4>
                  <p className="text-sm text-muted-foreground">
                    Unlock 7 special badges: First Steps, Week Warrior, Grammar Guru, Serbian Star, and more.
                  </p>
                </div>

                <div className="p-3 border rounded-lg bg-green-50">
                  <h4 className="font-semibold text-sm mb-1">🔥 Daily Streaks</h4>
                  <p className="text-sm text-muted-foreground">
                    Study every day to build your streak. Track your current and longest streaks!
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <Alert>
                <MessageSquare className="h-4 w-4" />
                <AlertTitle>Unit Q&A Helper - Your AI Tutor</AlertTitle>
                <AlertDescription>
                  Get instant help with grammar questions, vocabulary, and practice conversations.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="p-3 border rounded-lg">
                  <h4 className="font-semibold text-sm mb-1">💬 Ask Questions</h4>
                  <p className="text-sm text-muted-foreground">
                    Stuck on a grammar rule? Need clarification? Just ask the AI Learn Buddy!
                  </p>
                </div>

                <div className="p-3 border rounded-lg">
                  <h4 className="font-semibold text-sm mb-1">🗣️ Practice Conversations</h4>
                  <p className="text-sm text-muted-foreground">
                    Have short conversations in Serbian to practice what you've learned.
                  </p>
                </div>

                <div className="p-3 border rounded-lg">
                  <h4 className="font-semibold text-sm mb-1">📝 Get Examples</h4>
                  <p className="text-sm text-muted-foreground">
                    Request additional examples and explanations tailored to your level.
                  </p>
                </div>
              </div>

              <Alert className="bg-green-50 border-green-200">
                <Info className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Ready to Start!</AlertTitle>
                <AlertDescription className="text-green-700">
                  Begin with Unit 1: "Na aerodromu" (At the airport). Good luck on your Serbian learning journey!
                </AlertDescription>
              </Alert>
            </div>
          )}

          <div className="flex justify-between pt-4">
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

