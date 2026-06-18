import { v } from "convex/values";
import { query, QueryCtx } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import { assertLearnerAccountActive } from "./authz";

type Period = "all" | "30d" | "7d";

const selfEntryValidator = v.object({
  rank: v.number(),
  xp: v.number(),
  nickname: v.string(),
  avatarUrl: v.union(v.string(), v.null()),
  level: v.union(v.number(), v.null()),
  isInTopTen: v.boolean(),
});

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function getPeriodStart(period: Period): number | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : 30;
  const today = startOfTodayMs();
  return today - (days - 1) * 24 * 60 * 60 * 1000;
}

function isLeaderboardOptInWish(user: Doc<"users">): boolean {
  return user.leaderboardPublicEnabled === true;
}

async function resolvePublicAvatarUrl(
  ctx: QueryCtx,
  user: Doc<"users">
): Promise<string | null> {
  if (user.publicAvatarStorageId) {
    const url = await ctx.storage.getUrl(user.publicAvatarStorageId);
    return url ?? null;
  }
  const manual = user.publicAvatarUrl?.trim();
  return manual && manual.length > 0 ? manual : null;
}

function getDisplayForViewer(args: {
  viewerUserId: Id<"users"> | null;
  user: Doc<"users">;
}) {
  const enabled = isLeaderboardOptInWish(args.user);
  const isYou = args.viewerUserId !== null && args.user._id === args.viewerUserId;

  // For privacy: only show nickname/avatar when the user opted in.
  // Exception: the viewer always sees themselves with their profile fields.
  if (enabled || isYou) {
    const nickname = args.user.publicNickname?.trim();
    const avatarUrl = args.user.publicAvatarUrl?.trim();
    return {
      displayName: nickname && nickname.length > 0 ? nickname : "Anonymous",
      avatarUrl: avatarUrl && avatarUrl.length > 0 ? avatarUrl : null,
      isPublic: enabled,
      isYou,
    };
  }

  return { displayName: "Anonymous", avatarUrl: null, isPublic: false, isYou };
}

async function getAllTimeUserXp(ctx: QueryCtx) {
  const users = await ctx.db.query("users").collect();
  return users.map((u) => ({ userId: u._id, xp: u.totalXP ?? 0 }));
}

async function getPeriodUserXp(ctx: QueryCtx, period: Exclude<Period, "all">) {
  const start = getPeriodStart(period);
  if (start === null) return [];

  const activities = await ctx.db
    .query("dailyActivity")
    .withIndex("by_date", (q) => q.gte("activityDate", start))
    .collect();

  const xpByUser = new Map<string, number>();
  for (const a of activities) {
    const prev = xpByUser.get(a.userId) ?? 0;
    xpByUser.set(a.userId, prev + (a.xpEarned ?? 0));
  }

  return Array.from(xpByUser.entries()).map(([userId, xp]) => ({
    userId: userId as Id<"users">,
    xp,
  }));
}

function sortAndRank(items: Array<{ userId: Id<"users">; xp: number }>) {
  const sorted = [...items].sort((a, b) => b.xp - a.xp);
  return sorted.map((item, idx) => ({ ...item, rank: idx + 1 }));
}

function selfNickname(user: Doc<"users">): string {
  const nick = user.publicNickname?.trim();
  if (nick && nick.length > 0) return nick;
  const name = user.name?.trim();
  if (name && name.length > 0) return name;
  const email = user.email?.trim();
  if (email && email.length > 0) return email.split("@")[0] ?? "You";
  return "You";
}

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getPublicLeaderboard = query({
  args: {
    period: v.union(v.literal("all"), v.literal("30d"), v.literal("7d")),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    period: v.union(v.literal("all"), v.literal("30d"), v.literal("7d")),
    entries: v.array(
      v.object({
        rank: v.number(),
        xp: v.number(),
        nickname: v.string(),
        avatarUrl: v.string(),
        level: v.union(v.number(), v.null()),
        isYou: v.optional(v.boolean()),
      })
    ),
    self: v.union(selfEntryValidator, v.null()),
  }),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 10, 1), 50);

    const identity = await ctx.auth.getUserIdentity();
    let viewer: Doc<"users"> | null = null;
    if (identity) {
      viewer = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first();
    }

    const raw =
      args.period === "all"
        ? await getAllTimeUserXp(ctx)
        : await getPeriodUserXp(ctx, args.period);

    const ranked = sortAndRank(raw);

    const out: Array<{
      rank: number;
      xp: number;
      nickname: string;
      avatarUrl: string;
      level: number | null;
      isYou?: boolean;
    }> = [];

    const viewerInTopTenUserIds = new Set<Id<"users">>();

    for (const item of ranked) {
      const user = await ctx.db.get(item.userId);
      if (!user) continue;
      const enabled = isLeaderboardOptInWish(user);
      const nickname = user.publicNickname?.trim() ?? "";
      const avatarUrl =
        (user.publicAvatarStorageId
          ? await ctx.storage.getUrl(user.publicAvatarStorageId)
          : user.publicAvatarUrl?.trim()) ?? "";
      if (!enabled) continue;
      if (nickname.length < 2) continue;
      if (avatarUrl.length === 0) continue;

      const isYou = viewer !== null && user._id === viewer._id;
      if (isYou) viewerInTopTenUserIds.add(user._id);

      out.push({
        rank: out.length + 1,
        xp: item.xp,
        nickname,
        avatarUrl,
        level: typeof user.level === "number" && Number.isFinite(user.level) ? user.level : null,
        ...(isYou ? { isYou: true } : {}),
      });

      if (out.length >= limit) break;
    }

    let self: {
      rank: number;
      xp: number;
      nickname: string;
      avatarUrl: string | null;
      level: number | null;
      isInTopTen: boolean;
    } | null = null;

    if (viewer) {
      const myRanked = ranked.find((r) => r.userId === viewer!._id);
      if (myRanked) {
        const avatarUrl = await resolvePublicAvatarUrl(ctx, viewer);
        self = {
          rank: myRanked.rank,
          xp: myRanked.xp,
          nickname: selfNickname(viewer),
          avatarUrl,
          level:
            typeof viewer.level === "number" && Number.isFinite(viewer.level)
              ? viewer.level
              : null,
          isInTopTen: viewerInTopTenUserIds.has(viewer._id),
        };
      }
    }

    return {
      period: args.period,
      entries: out,
      self,
    };
  },
});

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getLeaderboard = query({
  args: {
    period: v.union(v.literal("all"), v.literal("30d"), v.literal("7d")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const viewer = await ctx.db
      .query("users")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!viewer) {
      throw new Error("User not found");
    }

    assertLearnerAccountActive(viewer);

    const limit = Math.min(Math.max(args.limit ?? 100, 10), 500);

    const raw =
      args.period === "all"
        ? await getAllTimeUserXp(ctx)
        : await getPeriodUserXp(ctx, args.period);

    const ranked = sortAndRank(raw);

    const my = ranked.find((r) => r.userId === viewer._id) ?? null;

    const slice = ranked.slice(0, limit);
    const entries: Array<{
      rank: number;
      xp: number;
      displayName: string;
      avatarUrl: string | null;
      isYou: boolean;
      isPublic: boolean;
      level: number | null;
    }> = [];

    for (const item of slice) {
      const user = await ctx.db.get(item.userId);
      if (!user) continue;
      const display = getDisplayForViewer({ viewerUserId: viewer._id, user });
      const resolvedAvatarUrl =
        user.publicAvatarStorageId
          ? await ctx.storage.getUrl(user.publicAvatarStorageId)
          : display.avatarUrl;
      entries.push({
        rank: item.rank,
        xp: item.xp,
        displayName: display.displayName,
        avatarUrl: resolvedAvatarUrl,
        isYou: display.isYou,
        isPublic: display.isPublic,
        level: typeof user.level === "number" && Number.isFinite(user.level) ? user.level : null,
      });
    }

    return {
      period: args.period,
      entries,
      myRank: my?.rank ?? null,
      myXp: my?.xp ?? 0,
      myPublicEnabled: isLeaderboardOptInWish(viewer),
      myNickname: viewer.publicNickname ?? null,
      myAvatarUrl: viewer.publicAvatarUrl ?? null,
    };
  },
});

// Aggregated level distribution (no PII). Used for the Leaderboards "Level Progress" panel.
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getLevelDistribution = query({
  args: {
    maxLevel: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxLevel = Math.min(Math.max(args.maxLevel ?? 25, 3), 50);
    const users = await ctx.db.query("users").collect();
    const totalMembers = users.length;

    const counts = new Map<number, number>();
    for (const u of users) {
      const lvl = u.level ?? 1;
      if (!Number.isFinite(lvl) || lvl <= 0) continue;
      if (lvl > maxLevel) continue;
      counts.set(lvl, (counts.get(lvl) ?? 0) + 1);
    }

    const levels = Array.from({ length: maxLevel }, (_, idx) => {
      const level = idx + 1;
      const count = counts.get(level) ?? 0;
      const percent = totalMembers > 0 ? Math.round((count / totalMembers) * 100) : 0;
      return { level, count, percent };
    });

    return {
      maxLevel,
      totalMembers,
      levels,
      updatedAt: Date.now(),
    };
  },
});
