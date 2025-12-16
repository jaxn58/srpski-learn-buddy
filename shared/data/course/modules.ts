import type { Unit } from "./units";
import { COURSE_UNITS } from "./units";

export interface Module {
  id: string;
  number: number;
  title: string;
  titleEnglish: string;
  titleGerman: string;
  description: string;
  descriptionGerman: string;
  units: number[]; // Array von Unit-Nummern
}

export const COURSE_MODULES: Module[] = [
  {
    id: "foundation",
    number: 1,
    title: "Osnove",
    titleEnglish: "The Arrival",
    titleGerman: "Die Ankunft",
    description: "Master the basics: greetings, numbers, directions, and essential vocabulary",
    descriptionGerman: "Grundlagen beherrschen: Begrüßungen, Zahlen, Wegbeschreibungen und wichtige Vokabeln",
    units: [1, 2, 3, 4, 5, 6]
  },
  {
    id: "daily-life",
    number: 2,
    title: "Svakodnevni život",
    titleEnglish: "Daily Life",
    titleGerman: "Alltag",
    description: "Navigate everyday situations: appointments, restaurants, family, and people",
    descriptionGerman: "Alltagssituationen meistern: Termine, Restaurants, Familie und Menschen",
    units: [7, 8, 9, 10, 11]
  },
  {
    id: "communication-culture",
    number: 3,
    title: "Komunikacija i kultura",
    titleEnglish: "Communication & Culture",
    titleGerman: "Kommunikation & Kultur",
    description: "Explore culture and communication: nationalities, past tense, weather, and travel",
    descriptionGerman: "Kultur und Kommunikation erkunden: Nationalitäten, Vergangenheit, Wetter und Reisen",
    units: [12, 13, 14, 15]
  },
  {
    id: "advanced-communication",
    number: 4,
    title: "Napredna komunikacija",
    titleEnglish: "Advanced Communication",
    titleGerman: "Erweiterte Kommunikation",
    description: "Advanced topics: housing, phone calls, future plans, celebrations, and health",
    descriptionGerman: "Erweiterte Themen: Wohnung, Telefongespräche, Zukunftspläne, Feiern und Gesundheit",
    units: [16, 17, 18, 19, 20]
  },
  {
    id: "mastery",
    number: 5,
    title: "Majstorstvo",
    titleEnglish: "Mastery",
    titleGerman: "Meisterschaft",
    description: "Master advanced grammar: comparisons, descriptions, verb aspects, and social interactions",
    descriptionGerman: "Erweiterte Grammatik meistern: Vergleiche, Beschreibungen, Verb-Aspekte und soziale Interaktionen",
    units: [21, 22, 23, 24, 25, 26, 27]
  }
];

/**
 * Find the module that contains a specific unit
 */
export function getModuleForUnit(unitNumber: number): Module | undefined {
  return COURSE_MODULES.find(module => module.units.includes(unitNumber));
}

/**
 * Get the lesson number within a module for a given unit
 * Returns the position of the unit within its module (1-based)
 */
export function getLessonNumberInModule(unitNumber: number): number {
  const module = getModuleForUnit(unitNumber);
  if (!module) return 0;
  
  const index = module.units.indexOf(unitNumber);
  return index >= 0 ? index + 1 : 0;
}

/**
 * Calculate progress for a module based on completed units
 */
export function getModuleProgress(
  moduleId: string,
  completedUnits: number[]
): { completed: number; total: number; percentage: number } {
  const module = COURSE_MODULES.find(m => m.id === moduleId);
  if (!module) {
    return { completed: 0, total: 0, percentage: 0 };
  }

  const completed = module.units.filter(unitNum => completedUnits.includes(unitNum)).length;
  const total = module.units.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { completed, total, percentage };
}

/**
 * Get all units for a module
 */
export function getUnitsForModule(moduleId: string): Unit[] {
  const module = COURSE_MODULES.find(m => m.id === moduleId);
  if (!module) return [];

  return COURSE_UNITS.filter(unit => module.units.includes(unit.number));
}

/**
 * Get module data formatted for landing page
 */
export interface ModuleForLanding {
  id: string;
  number: number;
  title: string;
  titleEnglish: string;
  titleGerman: string;
  description: string;
  descriptionGerman: string;
  unitCount: number;
  vocabCount: number;
}

/**
 * Get modules data for landing page with vocabulary counts
 */
export function getModulesForLanding(vocabulary: Array<{ unit: number }>): ModuleForLanding[] {
  // Count vocabulary per unit
  const vocabCounts = vocabulary.reduce((acc, word) => {
    acc[word.unit] = (acc[word.unit] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  return COURSE_MODULES.map(module => {
    // Calculate total vocabulary for this module
    const vocabCount = module.units.reduce((sum, unitNum) => {
      return sum + (vocabCounts[unitNum] || 0);
    }, 0);

    return {
      id: module.id,
      number: module.number,
      title: module.title,
      titleEnglish: module.titleEnglish,
      titleGerman: module.titleGerman,
      description: module.description,
      descriptionGerman: module.descriptionGerman,
      unitCount: module.units.length,
      vocabCount: vocabCount
    };
  });
}
