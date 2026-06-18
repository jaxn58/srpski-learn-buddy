export type LibraryFolder = {
  _id: string;
  name: string;
  parentId?: string;
};

export type FolderTreeNode = LibraryFolder & { children: FolderTreeNode[] };

export function buildFolderTree(folders: LibraryFolder[]): FolderTreeNode[] {
  const byId = new Map<string, FolderTreeNode>();
  for (const folder of folders) {
    byId.set(folder._id, { ...folder, children: [] });
  }
  const roots: FolderTreeNode[] = [];
  for (const folder of folders) {
    const node = byId.get(folder._id)!;
    if (folder.parentId) {
      const parent = byId.get(folder.parentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (nodes: FolderTreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const node of nodes) sortNodes(node.children);
  };
  sortNodes(roots);
  return roots;
}

export function isRootFolder(folder: LibraryFolder): boolean {
  return folder.parentId === undefined;
}

export function isSubfolder(folder: LibraryFolder): boolean {
  return folder.parentId !== undefined;
}

export function getChildFolders(parentId: string, folders: LibraryFolder[]): LibraryFolder[] {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getFolderMoveOptions(
  folders: LibraryFolder[]
): Array<{ id: string; name: string; depth: 0 | 1 }> {
  const roots = folders.filter(isRootFolder).sort((a, b) => a.name.localeCompare(b.name));
  const options: Array<{ id: string; name: string; depth: 0 | 1 }> = [];

  for (const root of roots) {
    options.push({ id: root._id, name: root.name, depth: 0 });
    for (const sub of getChildFolders(root._id, folders)) {
      options.push({ id: sub._id, name: sub.name, depth: 1 });
    }
  }

  return options;
}

/** Item counts including items stored in subfolders (for parent folder badges). */
export function buildAggregatedItemCounts(
  folders: LibraryFolder[],
  directCounts: Record<string, number>
): Record<string, number> {
  const tree = buildFolderTree(folders);
  const aggregated: Record<string, number> = { ...directCounts };

  const sumSubtree = (node: FolderTreeNode): number => {
    let total = directCounts[node._id] ?? 0;
    for (const child of node.children) {
      total += sumSubtree(child);
    }
    aggregated[node._id] = total;
    return total;
  };

  for (const root of tree) {
    sumSubtree(root);
  }

  return aggregated;
}

/** @deprecated Use buildAggregatedItemCounts */
export const buildAggregatedSessionCounts = buildAggregatedItemCounts;

export function getFolderPath(
  folderId: string | "uncategorized",
  folders: LibraryFolder[]
): Array<{ id: string | "uncategorized"; name: string }> {
  if (folderId === "uncategorized") {
    return [{ id: "uncategorized", name: "" }];
  }
  const path: LibraryFolder[] = [];
  let current = folders.find((f) => f._id === folderId);
  while (current) {
    path.unshift(current);
    current = current.parentId
      ? folders.find((f) => f._id === current!.parentId)
      : undefined;
  }
  return path.map((f) => ({ id: f._id, name: f.name }));
}

/** Whether a folder may be deleted (no direct items, no subfolders). */
export function canDeleteFolder(
  folderId: string,
  folders: LibraryFolder[],
  directCounts: Record<string, number>
): boolean {
  if ((directCounts[folderId] ?? 0) > 0) return false;
  return !folders.some((folder) => folder.parentId === folderId);
}

/** Default name for a new folder, avoiding duplicates among siblings. */
export function nextDefaultFolderName(
  folders: LibraryFolder[],
  parentId: string | undefined,
  labels: { main: string; sub: string }
): string {
  const prefix = parentId ? labels.sub : labels.main;
  const siblings = parentId
    ? folders.filter((f) => f.parentId === parentId)
    : folders.filter((f) => !f.parentId);
  const existing = new Set(siblings.map((f) => f.name));
  if (!existing.has(prefix)) return prefix;
  for (let i = 2; i <= 100; i += 1) {
    const candidate = `${prefix} ${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${prefix} ${Date.now()}`;
}
