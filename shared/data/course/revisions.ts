export interface RevisionStep {
  step: number;
  page: number;
  units: number[];
}

export const REVISION_STEPS: RevisionStep[] = [
  { step: 1, page: 62, units: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { step: 2, page: 82, units: [11, 12, 13] },
  { step: 3, page: 106, units: [14, 15] },
  { step: 4, page: 134, units: [16, 17, 18, 19, 20] },
  { step: 5, page: 159, units: [21, 22] },
  { step: 6, page: 176, units: [23, 24, 25, 26] },
  { step: 7, page: 193, units: [27] }
];



