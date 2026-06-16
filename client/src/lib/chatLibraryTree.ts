import type { Doc, Id } from "../../../convex/_generated/dataModel";

export type ChatFolder = Doc<"chatFolders">;

export type FolderTreeNode = ChatFolder & { children: FolderTreeNode[] };

export function buildFolderTree(folders: ChatFolder[]): FolderTreeNode[] {
  const byId = new Map<string, FolderTreeNode>();
  for (const folder of folders) {
    byId.set(folder._id as string, { ...folder, children: [] });
  }
  const roots: FolderTreeNode[] = [];
  for (const folder of folders) {
    const node = byId.get(folder._id as string)!;
    if (folder.parentId) {
      const parent = byId.get(folder.parentId as string);
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

export function isRootFolder(folder: ChatFolder): boolean {
  return folder.parentId === undefined;
}

export function isSubfolder(folder: ChatFolder): boolean {
  return folder.parentId !== undefined;
}

export function getChildFolders(
  parentId: Id<"chatFolders">,
  folders: ChatFolder[]
): ChatFolder[] {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getFolderMoveOptions(
  folders: ChatFolder[]
): Array<{ id: Id<"chatFolders">; name: string; depth: 0 | 1 }> {
  const roots = folders.filter(isRootFolder).sort((a, b) => a.name.localeCompare(b.name));
  const options: Array<{ id: Id<"chatFolders">; name: string; depth: 0 | 1 }> = [];

  for (const root of roots) {
    options.push({ id: root._id, name: root.name, depth: 0 });
    for (const sub of getChildFolders(root._id, folders)) {
      options.push({ id: sub._id, name: sub.name, depth: 1 });
    }
  }

  return options;
}

/** Session counts including chats stored in subfolders (for parent folder badges). */
export function buildAggregatedSessionCounts(
  folders: ChatFolder[],
  directCounts: Record<string, number>
): Record<string, number> {
  const tree = buildFolderTree(folders);
  const aggregated: Record<string, number> = { ...directCounts };

  const sumSubtree = (node: FolderTreeNode): number => {
    let total = directCounts[node._id as string] ?? 0;
    for (const child of node.children) {
      total += sumSubtree(child);
    }
    aggregated[node._id as string] = total;
    return total;
  };

  for (const root of tree) {
    sumSubtree(root);
  }

  return aggregated;
}

export function getFolderPath(
  folderId: Id<"chatFolders"> | "uncategorized",
  folders: ChatFolder[]
): Array<{ id: Id<"chatFolders"> | "uncategorized"; name: string }> {
  if (folderId === "uncategorized") {
    return [{ id: "uncategorized", name: "" }];
  }
  const path: ChatFolder[] = [];
  let current = folders.find((f) => f._id === folderId);
  while (current) {
    path.unshift(current);
    current = current.parentId
      ? folders.find((f) => f._id === current!.parentId)
      : undefined;
  }
  return path.map((f) => ({ id: f._id, name: f.name }));
}
