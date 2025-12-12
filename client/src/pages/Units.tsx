import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { COURSE_MODULES, COURSE_UNITS, getModuleProgress, getUnitsForModule } from "@shared/data";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Lock, BookOpen, Star, ChevronDown } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Sidebar } from "@/components/Sidebar";

export default function Units() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const progress = useQuery(api.progress.getUserProgress);
  const masteredUnits = useQuery(api.progress.getMasteredUnits, user ? undefined : "skip");

  const isBetaTester = Boolean(user?.isBetaTester);
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const completedUnits = progress?.completedUnits || [];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 md:ml-64 w-full">
        <div className="container py-10 space-y-8">
          <header className="space-y-2 text-center">
            <p className="text-sm font-medium text-primary uppercase tracking-wider">
              {t("units.subtitle")}
            </p>
            <h1 className="text-4xl md:text-5xl font-bold">
              {t("units.title")}
            </h1>
          </header>

          <div className="space-y-6">
            {COURSE_MODULES.map((module) => {
              const moduleUnits = getUnitsForModule(module.id);
              const moduleProgress = getModuleProgress(module.id, completedUnits);
              
              // Check if module is locked (beta testers only have access to Module 1)
              const isModuleLocked = !isAdmin && isBetaTester && module.number > 1;
              
              // Get module title and description based on language
              const moduleTitle = i18n.language === "de" ? module.titleGerman : module.titleEnglish;
              const moduleDescription = i18n.language === "de" ? module.descriptionGerman : module.description;

              return (
                <Card key={module.id} className={isModuleLocked ? "opacity-60 border-dashed" : ""}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge variant="outline" className="text-lg px-3 py-1">
                            {t("units.module", { number: module.number })}
                          </Badge>
                          {isModuleLocked && (
                            <Badge variant="outline" className="gap-1 text-gray-600">
                              <Lock className="h-3 w-3" />
                              {t("units.locked")}
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-2xl mb-2">{moduleTitle}</CardTitle>
                        <CardDescription className="text-base">
                          {moduleDescription}
                        </CardDescription>
                      </div>
                    </div>
                    
                    {/* Module Progress */}
                    {!isModuleLocked && (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t("units.moduleProgress", { 
                              completed: moduleProgress.completed, 
                              total: moduleProgress.total 
                            })}
                          </span>
                          <span className="font-semibold text-primary">
                            {moduleProgress.percentage}%
                          </span>
                        </div>
                        <Progress value={moduleProgress.percentage} />
                      </div>
                    )}
                  </CardHeader>
                  
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value={`module-${module.id}`} className="border-none">
                        <AccordionTrigger className="hover:no-underline">
                          <span className="text-sm font-medium text-muted-foreground">
                            {t("units.lessons", { count: moduleUnits.length })}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                            {moduleUnits.map((unit) => {
                              const locked = !isAdmin && isBetaTester && unit.number > 6;
                              const isCurrent = progress?.currentUnit === unit.number;
                              const isCompleted = completedUnits.includes(unit.number);
                              const isMastered = masteredUnits?.includes(unit.number);
                              const topics =
                                (i18n.language === "de" ? unit.topicsGerman : unit.topics) || [];
                              const title =
                                i18n.language === "de" ? unit.titleGerman : unit.titleEnglish;

                              const CardWrapper = locked ? "div" : Link;
                              const cardProps = locked
                                ? {}
                                : ({ href: `/unit/${unit.number}` } as any);

                              return (
                                <CardWrapper key={unit.number} {...cardProps}>
                                  <Card
                                    className={`h-full transition-all ${
                                      locked
                                        ? "opacity-60 cursor-not-allowed border-dashed"
                                        : "hover:shadow-lg hover:border-primary/30 cursor-pointer"
                                    }`}
                                  >
                                    <CardHeader className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <Badge variant={isCurrent ? "default" : "outline"}>
                                          {t("units.lesson", { number: unit.number })}
                                        </Badge>
                                        {isCompleted && !locked && (
                                          <Badge className="bg-[color:var(--brand-blue)] text-[color:var(--brand-blue-foreground)] border-[color:var(--brand-blue)] shadow-sm">
                                            {t("dashboard.completedBadge")}
                                          </Badge>
                                        )}
                                        {isMastered && !locked && (
                                          <Badge className="bg-amber-500 text-white border-amber-500 hover:bg-amber-500/90 shadow-sm">
                                            <Star className="mr-1 h-3 w-3 text-white" fill="currentColor" strokeWidth={0} />
                                            {t("dashboard.masteredBadge", "Mastered")}
                                          </Badge>
                                        )}
                                        {isCurrent && !isCompleted && !locked && (
                                          <Badge variant="default">{t("dashboard.currentLessonBadge")}</Badge>
                                        )}
                                        {locked && (
                                          <Badge variant="outline" className="gap-1 text-gray-600">
                                            <Lock className="h-3 w-3" />
                                            {t("units.locked")}
                                          </Badge>
                                        )}
                                      </div>
                                      <CardTitle className="text-lg">{title}</CardTitle>
                                      <CardDescription className="text-sm text-muted-foreground">
                                        {unit.title}
                                      </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                      <ul className="space-y-1 text-sm text-muted-foreground">
                                        {topics.slice(0, 3).map((topic, idx) => (
                                          <li key={idx} className="flex items-start gap-2">
                                            <span className="text-primary mt-1">•</span>
                                            <span>{topic}</span>
                                          </li>
                                        ))}
                                      </ul>
                                      {locked && (
                                        <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-2">
                                          <BookOpen className="h-4 w-4 text-gray-500" />
                                          <span>{t("units.unlockBeta")}</span>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                </CardWrapper>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
