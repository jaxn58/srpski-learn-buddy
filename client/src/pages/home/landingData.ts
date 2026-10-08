export type LandingCounts = {
  moduleCount: number;
  unitCount: number;
  vocabCount: number;
};

export type LandingUnitTitle = {
  number: number;
  titleEn: string;
  titleDe: string;
};

export type LandingModuleCard = {
  id: string;
  number: number;
  title: string;
  description: string;
  unitCount: number;
  vocabCount: number;
  units: LandingUnitTitle[];
};

type AnyUnit = {
  unitNumber?: number;
  moduleId?: string | null | undefined;
  moduleMetadataId?: unknown;
  title?: string | null | undefined;
};
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

/**
 * Same linkage as the in-app units page: the foreign key wins.
 * A set moduleMetadataId that does not resolve is not replaced by the legacy slug.
 */
function resolveModuleSlug(unit: AnyUnit, idToSlug: Map<string, string>): string | null {
  const metadataId = unit.moduleMetadataId;
  if (metadataId != null && String(metadataId).length > 0) {
    return idToSlug.get(String(metadataId)) ?? null;
  }
  const legacy = typeof unit.moduleId === "string" ? unit.moduleId.trim() : "";
  return legacy || null;
}

export function buildLandingModuleCards(args: {
  modules: AnyModule[] | undefined;
  unitsEn: AnyUnit[] | undefined;
  unitsDe?: AnyUnit[] | undefined;
  vocab: AnyVocab[] | undefined;
}): LandingModuleCard[] {
  const modules = Array.isArray(args.modules) ? args.modules : [];
  const unitsEn = Array.isArray(args.unitsEn) ? args.unitsEn : [];
  const unitsDe = Array.isArray(args.unitsDe) ? args.unitsDe : [];
  const vocab = Array.isArray(args.vocab) ? args.vocab : [];

  const vocabCountsByUnit = new Map<number, number>();
  for (const word of vocab) {
    const unitNumber = Number(word?.unitNumber);
    if (!Number.isFinite(unitNumber)) continue;
    vocabCountsByUnit.set(unitNumber, (vocabCountsByUnit.get(unitNumber) || 0) + 1);
  }

  const idToSlug = new Map<string, string>();
  for (const moduleDoc of modules) {
    const id = moduleDoc._id;
    const slug = typeof moduleDoc.slug === "string" ? moduleDoc.slug : "";
    if (id == null || !slug) continue;
    idToSlug.set(String(id), slug);
  }

  const titleDeByNumber = new Map<number, string>();
  for (const unit of unitsDe) {
    const unitNumber = Number(unit.unitNumber);
    if (!Number.isFinite(unitNumber)) continue;
    const title = typeof unit.title === "string" ? unit.title : "";
    if (title) titleDeByNumber.set(unitNumber, title);
  }

  const unitsBySlug = new Map<string, LandingUnitTitle[]>();
  for (const unit of unitsEn) {
    const slug = resolveModuleSlug(unit, idToSlug);
    if (!slug) continue;
    const unitNumber = Number(unit.unitNumber);
    if (!Number.isFinite(unitNumber)) continue;
    const list = unitsBySlug.get(slug) ?? [];
    if (list.some((entry) => entry.number === unitNumber)) continue;
    list.push({
      number: unitNumber,
      titleEn: typeof unit.title === "string" ? unit.title : "",
      titleDe: titleDeByNumber.get(unitNumber) ?? "",
    });
    unitsBySlug.set(slug, list);
  }
  for (const list of unitsBySlug.values()) {
    list.sort((a, b) => a.number - b.number);
  }

  return modules.map((moduleDoc) => {
    const slug = typeof moduleDoc.slug === "string" ? moduleDoc.slug : "";
    const moduleUnits = unitsBySlug.get(slug) ?? [];
    const vocabCount = moduleUnits.reduce(
      (sum, unit) => sum + (vocabCountsByUnit.get(unit.number) || 0),
      0,
    );

    return {
      id: slug || String(moduleDoc._id ?? ""),
      number: Number(moduleDoc.moduleNumber || 0),
      title: typeof moduleDoc.titleEn === "string" ? moduleDoc.titleEn : "",
      description: typeof moduleDoc.descriptionEn === "string" ? moduleDoc.descriptionEn : "",
      unitCount: moduleUnits.length,
      vocabCount,
      units: moduleUnits,
    };
  });
}

