export type LandingCounts = {
  moduleCount: number;
  unitCount: number;
  vocabCount: number;
};

export type LandingModuleCard = {
  id: string;
  number: number;
  title: string;
  description: string;
  unitCount: number;
  vocabCount: number;
};

type AnyUnit = { unitNumber?: number; moduleId?: string | null | undefined };
type AnyModule = {
  _id?: unknown;
  slug?: string | null | undefined;
  moduleNumber?: number | null | undefined;
  titleEn?: string | null | undefined;
  descriptionEn?: string | null | undefined;
};
type AnyVocab = { unitNumber?: number | null | undefined };

export function computeLandingCounts(args: {
  modules: AnyModule[] | undefined;
  unitsEn: AnyUnit[] | undefined;
  vocab: AnyVocab[] | undefined;
}): LandingCounts {
  return {
    moduleCount: Array.isArray(args.modules) ? args.modules.length : 0,
    unitCount: Array.isArray(args.unitsEn) ? args.unitsEn.length : 0,
    vocabCount: Array.isArray(args.vocab) ? args.vocab.length : 0,
  };
}

export function buildLandingModuleCards(args: {
  modules: AnyModule[] | undefined;
  unitsEn: AnyUnit[] | undefined;
  vocab: AnyVocab[] | undefined;
}): LandingModuleCard[] {
  const modules = Array.isArray(args.modules) ? args.modules : [];
  const unitsEn = Array.isArray(args.unitsEn) ? args.unitsEn : [];
  const vocab = Array.isArray(args.vocab) ? args.vocab : [];

  const vocabCountsByUnit = new Map<number, number>();
  for (const word of vocab as AnyVocab[]) {
    const unitNumber = Number((word as any)?.unitNumber);
    if (!Number.isFinite(unitNumber)) continue;
    vocabCountsByUnit.set(unitNumber, (vocabCountsByUnit.get(unitNumber) || 0) + 1);
  }

  const unitCountsByModuleSlug = new Map<string, number>();
  for (const u of unitsEn as AnyUnit[]) {
    const moduleId = (u as any)?.moduleId;
    if (!moduleId) continue;
    unitCountsByModuleSlug.set(moduleId, (unitCountsByModuleSlug.get(moduleId) || 0) + 1);
  }

  return modules.map((m) => {
    const slug = String((m as any)?.slug || "");
    const moduleUnits = unitsEn.filter((u) => (u as any)?.moduleId === slug);
    const vocabCount = moduleUnits.reduce((sum, u) => {
      const unitNumber = Number((u as any)?.unitNumber);
      return sum + (vocabCountsByUnit.get(unitNumber) || 0);
    }, 0);

    return {
      id: slug || String((m as any)?._id || ""),
      number: Number((m as any)?.moduleNumber || 0),
      title: String((m as any)?.titleEn || ""),
      description: String((m as any)?.descriptionEn || ""),
      unitCount: unitCountsByModuleSlug.get(slug) || moduleUnits.length || 0,
      vocabCount,
    };
  });
}

