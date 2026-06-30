export const TREE_ROW_GUTTER = 8; // px-2
export const TREE_DEPTH_STEP = 16; // Einrückung pro Ebene
export const TREE_CHEVRON_SIZE = 20; // w-5
export const TREE_ICON_SIZE = 16; // h-4 w-4
export const TREE_ROW_GAP = 2; // gap-0.5

export function treeRowPaddingLeft(depth: number): number {
  return TREE_ROW_GUTTER + depth * TREE_DEPTH_STEP;
}
