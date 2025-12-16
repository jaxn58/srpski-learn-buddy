import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { COURSE_MODULES, COURSE_UNITS, getUnitsForModule, getModuleProgress } from "@shared/data";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { Lock, BookOpen, Star, ChevronDown } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Sidebar } from "@/components/Sidebar";
import { AnimatedPage, AnimatedItem } from "@/components/AnimatedPage";
import { useEffect, useState, useMemo } from "react";

export default function Units() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [location] = useLocation();
  const progress = useQuery(api.progress.getUserProgress);
  const masteredUnits = useQuery(api.progress.getMasteredUnits, user ? undefined : "skip");

  const isBetaTester = Boolean(user?.isBetaTester);
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const completedUnits = progress?.completedUnits || [];

  // Load modules from database (new consolidated structure)
  const dbModules = useQuery(api.modules.getAllModulesConsolidated);
  
  // Load all units metadata from database
  const dbUnitsEn = useQuery(api.units.getAllUnitsMetadata, { language: "en" });
  const dbUnitsDe = useQuery(api.units.getAllUnitsMetadata, { language: "de" });
  
  // Extract module ID from hash (e.g., #module-foundation -> foundation)
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  const moduleIdFromHash = hash.startsWith("#module-") ? hash.replace("#module-", "") : null;
  
  // State for controlled accordion
  const [openModule, setOpenModule] = useState<string | undefined>(
    moduleIdFromHash ? `module-${moduleIdFromHash}` : undefined
  );

  // Use DB modules if available, fallback to COURSE_MODULES
  const modules = useMemo(() => {
    if (dbModules && dbModules.length > 0) {
      return dbModules.map((dbModule) => ({
        id: dbModule.slug || "",
        number: dbModule.moduleNumber || 0,
        titleEnglish: dbModule.titleEn || "",
        titleGerman: dbModule.titleDe || "",
        description: dbModule.descriptionEn || "",
        descriptionGerman: dbModule.descriptionDe || "",
        moduleMetadataId: dbModule._id,
      }));
    }
    // Fallback to static COURSE_MODULES
    return COURSE_MODULES.map((m) => ({
      id: m.id,
      number: m.number,
      titleEnglish: m.titleEnglish,
      titleGerman: m.titleGerman,
      description: m.description,
      descriptionGerman: m.descriptionGerman,
      moduleMetadataId: undefined,
    }));
  }, [dbModules]);

  // Map units by module slug/moduleId
  const unitsByModule = useMemo(() => {
    const result: Record<string, Array<{
      number: number;
      title: string;
      titleEnglish: string;
      titleGerman: string;
      topics: string[];
      topicsGerman: string[];
    }>> = {};

    // If no database units available, return empty (will use fallback)
    if (!dbUnitsEn || dbUnitsEn.length === 0) {
      return result;
    }

    // Group units by moduleId (old structure) or moduleMetadataId (new structure)
    dbUnitsEn.forEach((unitEn) => {
      const unitDe = dbUnitsDe?.find(u => u.unitNumber === unitEn.unitNumber);
      
      // Try to find the module slug for this unit
      // First check if we have a moduleMetadataId
      let moduleSlug: string | undefined;
      
      if (unitEn.moduleMetadataId && dbModules) {
        const module = dbModules.find(m => m._id === unitEn.moduleMetadataId);
        moduleSlug = module?.slug;
      } else if (unitEn.moduleId) {
        // Fallback to old moduleId structure
        moduleSlug = unitEn.moduleId;
      }

      if (!moduleSlug) {
        // Try to match by unit number ranges (fallback)
        if (unitEn.unitNumber <= 6) moduleSlug = "foundation";
        else if (unitEn.unitNumber <= 11) moduleSlug = "daily-life";
        else if (unitEn.unitNumber <= 15) moduleSlug = "communication-culture";
        else if (unitEn.unitNumber <= 20) moduleSlug = "advanced-communication";
        else moduleSlug = "mastery";
      }

      if (moduleSlug) {
        if (!result[moduleSlug]) {
          result[moduleSlug] = [];
        }
        
        // Check if unit already exists (avoid duplicates)
        const exists = result[moduleSlug].find(u => u.number === unitEn.unitNumber);
        if (!exists) {
          result[moduleSlug].push({
            number: unitEn.unitNumber,
            title: unitEn.title,
            titleEnglish: unitEn.title,
            titleGerman: unitDe?.title || unitEn.title,
            topics: unitEn.topics || [],
            topicsGerman: unitDe?.topics || unitEn.topics || [],
          });
        }
      }
    });

    // Sort units by number within each module
    Object.keys(result).forEach(moduleSlug => {
      result[moduleSlug].sort((a, b) => a.number - b.number);
    });

    return result;
  }, [dbUnitsEn, dbUnitsDe, dbModules]);

  // Calculate module progress based on database units
  const getModuleProgressFromDB = (moduleId: string, completedUnits: number[]) => {
    const moduleUnits = unitsByModule[moduleId] || [];
    const completed = moduleUnits.filter(unit => completedUnits.includes(unit.number)).length;
    const total = moduleUnits.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percentage };
  };

  // Update open module when hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const newHash = window.location.hash;
      const newModuleId = newHash.startsWith("#module-") ? newHash.replace("#module-", "") : null;
      if (newModuleId) {
        setOpenModule(`module-${newModuleId}`);
        // Scroll to the module after a short delay to ensure it's rendered
        setTimeout(() => {
          const element = document.getElementById(`module-card-${newModuleId}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 100);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    // Also check on mount
    handleHashChange();

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 md:ml-64 w-full">
        <AnimatedPage>
        <div className="container py-10 space-y-8">
          <div className="space-y-6">
            {modules.map((module) => {
              // Load units from database, fallback to static data if not available
              let moduleUnits = unitsByModule[module.id] || [];
              const hasDbUnits = moduleUnits.length > 0;
              
              // Fallback to static data if no database units found for this module
              if (!hasDbUnits) {
                const staticUnits = getUnitsForModule(module.id);
                moduleUnits = staticUnits.map(unit => ({
                  number: unit.number,
                  title: unit.title,
                  titleEnglish: unit.titleEnglish,
                  titleGerman: unit.titleGerman,
                  topics: unit.topics,
                  topicsGerman: unit.topicsGerman,
                }));
              }
              
              // Calculate progress - use DB function if units from DB, otherwise static
              const moduleProgress = hasDbUnits
                ? getModuleProgressFromDB(module.id, completedUnits)
                : getModuleProgress(module.id, completedUnits);
              
              // Check if module is locked (beta testers only have access to Module 1)
              const isModuleLocked = !isAdmin && isBetaTester && module.number > 1;
              
              // Get module title and description based on language
              const moduleTitle = i18n.language === "de" ? module.titleGerman : module.titleEnglish;
              const moduleDescription = i18n.language === "de" ? module.descriptionGerman : module.description;

              return (
                <Card 
                  key={module.id} 
                  id={`module-card-${module.id}`}
                  className={isModuleLocked ? "opacity-60 border-dashed" : ""}
                >
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
                    <Accordion 
                      type="single" 
                      collapsible 
                      className="w-full"
                      value={openModule === `module-${module.id}` ? `module-${module.id}` : undefined}
                      onValueChange={(value) => {
                        setOpenModule(value);
                        // Update hash when accordion is opened/closed
                        if (value === `module-${module.id}`) {
                          window.history.replaceState(null, "", `#module-${module.id}`);
                        } else if (openModule === `module-${module.id}`) {
                          window.history.replaceState(null, "", location);
                        }
                      }}
                    >
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
                                        {i18n.language === "de" ? unit.titleGerman : unit.titleEnglish}
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
        </AnimatedPage>
      </div>
    </div>
  );
}
