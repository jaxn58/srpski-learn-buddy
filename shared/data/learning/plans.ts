// Learning plan configurations for different durations
// All plans cover the same 27 units, but distributed over different time periods

export interface LearningPlan {
  duration: number; // in weeks
  weeksPerUnit: number;
  description: {
    de: string;
    en: string;
  };
}

export const LEARNING_PLANS: Record<number, LearningPlan> = {
  12: {
    duration: 12,
    weeksPerUnit: 0.44, // ~2.25 units per week
    description: {
      de: "Intensiv - 3 Monate (ca. 2-3 Lektionen pro Woche)",
      en: "Intensive - 3 Months (approx. 2-3 lessons per week)"
    }
  },
  24: {
    duration: 24,
    weeksPerUnit: 0.89, // ~1.13 units per week
    description: {
      de: "Standard - 6 Monate (ca. 1 Lektion pro Woche)",
      en: "Standard - 6 Months (approx. 1 lesson per week)"
    }
  },
  36: {
    duration: 36,
    weeksPerUnit: 1.33, // ~0.75 units per week
    description: {
      de: "Entspannt - 9 Monate (ca. 3 Lektionen pro Monat)",
      en: "Relaxed - 9 Months (approx. 3 lessons per month)"
    }
  },
  48: {
    duration: 48,
    weeksPerUnit: 1.78, // ~0.56 units per week
    description: {
      de: "Gemütlich - 12 Monate (ca. 2 Lektionen pro Monat)",
      en: "Leisurely - 12 Months (approx. 2 lessons per month)"
    }
  }
};

