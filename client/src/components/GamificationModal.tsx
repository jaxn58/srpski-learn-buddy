import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info, CheckCircle, CheckCircle2, Award, Unlock, Lightbulb, Target, TrendingUp, BarChart3, Check, Calendar, RotateCcw, Star, Activity } from "lucide-react";

interface GamificationModalProps {
  trigger?: React.ReactNode;
}

export function GamificationModal({ trigger }: GamificationModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Info className="h-4 w-4" />
            How does XP work?
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            Gamification System - XP & Rewards
          </DialogTitle>
          <DialogDescription>
            Learn how our Progressive XP System rewards your learning progress
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Progressive XP System */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Progressive XP System
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Based on Spaced Repetition: The more you practice, the more XP you earn!
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-green-700">First Time Correct</div>
                  <div className="text-sm text-muted-foreground">+5 XP - Great start!</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-blue-700">Second Time Correct</div>
                  <div className="text-sm text-muted-foreground">+10 XP - You're learning!</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-300">
                <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                  <Award className="h-5 w-5 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-yellow-700">Third Time Correct (Mastered!)</div>
                  <div className="text-sm text-muted-foreground">+20 XP - Word mastered!</div>
                </div>
              </div>
            </div>
            <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="font-semibold text-purple-700 mb-2">Total per Word/Exercise: 35 XP</div>
              <div className="text-sm text-muted-foreground">
                Master a word or exercise completely to earn all 35 XP! (5 + 10 + 20)
              </div>
            </div>
          </div>

          {/* How to Unlock the Next Unit - NEW */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-lg border-2 border-amber-200">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Unlock className="h-5 w-5 text-amber-600" />
              How to Unlock the Next Unit
            </h3>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground mb-3">
                To unlock the next unit, you need to complete your current unit:
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span><strong>Answer all vocabulary words correctly at least once</strong> (1/3 for Mastery)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span><strong>Complete all unit exercises</strong></span>
                </div>
              </div>
              <div className="mt-3 p-3 bg-white rounded border border-amber-300">
                <p className="text-xs text-muted-foreground">
                  <strong>Note:</strong> You don't need to master everything (3x correct) to unlock the next unit - just answer everything once!
                </p>
              </div>
            </div>
          </div>

          {/* Why Progressive XP? */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-purple-600" />
              Why Progressive XP?
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span><strong>Immediate Feedback:</strong> See your progress instantly after each correct answer</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span><strong>Spaced Repetition Bonus:</strong> Harder repetitions = More XP</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span><strong>Motivating:</strong> Watch your XP grow as you learn</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span><strong>Fair:</strong> Rewards long-term learning, not just quick answers</span>
              </li>
            </ul>
          </div>

          {/* Example */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-4 rounded-lg border-2 border-blue-200">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Example: Unit 1 (23 Words)
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>23 words × 3 repetitions</span>
                <span className="font-semibold">69 practice sessions</span>
              </div>
              <div className="flex justify-between">
                <span>1st time (23 × 5 XP)</span>
                <span className="font-semibold">+115 XP</span>
              </div>
              <div className="flex justify-between">
                <span>2nd time (23 × 10 XP)</span>
                <span className="font-semibold">+230 XP</span>
              </div>
              <div className="flex justify-between">
                <span>3rd time - Mastered! (23 × 20 XP)</span>
                <span className="font-semibold">+460 XP</span>
              </div>
              <div className="border-t-2 border-blue-300 pt-2 flex justify-between text-lg font-bold text-blue-700">
                <span>Total Possible XP:</span>
                <span>805 XP! 🎉</span>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Target className="h-5 w-5 text-green-600" />
              Pro Tips
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <span>Practice daily for best results - consistency is key!</span>
              </li>
              <li className="flex items-start gap-2">
                <RotateCcw className="h-4 w-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <span>Review words multiple times to earn maximum XP</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <span>Master all words in a unit to unlock full XP potential</span>
              </li>
              <li className="flex items-start gap-2">
                <Activity className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Watch your XP grow - every correct answer counts!</span>
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
