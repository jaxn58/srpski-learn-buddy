# Feature Packages: Technical Implementation Plan

**Document Version:** 2.0  
**Date:** April 2026  
**Status:** Implementation Blueprint  
**Prerequisites:** Read `FEATURE_PACKAGES_MARKETING.md` (v2.0) for business context  
**Estimated Total Effort:** 4–6 development days (excluding QA and billing configuration)

> **Key Design Principles:**
> 1. The Buddy is a *personal companion, assistant, and Balkan life helper* ("Brate") — not a chatbot. All UI copy must reflect this.
> 2. Chat interactions are **metered** — message quotas per subscription + optional top-up packs. This adds a quota-tracking layer to the existing subscription system.
> 3. Existing subscribers (no `featureTier` field) default to `"complete"` with generous quota — zero-migration.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Phase 1: Schema & Backend Foundation](#2-phase-1-schema--backend-foundation)
3. [Phase 2: Client-Side Feature Gating](#3-phase-2-client-side-feature-gating)
4. [Phase 3: Navigation & Layout Adaptation](#4-phase-3-navigation--layout-adaptation)
5. [Phase 4: Chat Backend Enforcement](#5-phase-4-chat-backend-enforcement)
6. [Phase 5: Upgrade UX & Nudges](#6-phase-5-upgrade-ux--nudges)
7. [Phase 6: Billing Integration](#7-phase-6-billing-integration)
8. [Phase 7: Admin Tooling](#8-phase-7-admin-tooling)
9. [Migration Strategy](#9-migration-strategy)
10. [Testing Checklist](#10-testing-checklist)
11. [Risk Register](#11-risk-register)

---

## 1. Architecture Overview

### Core Principle: Single Field, Centralized Query

The entire feature-gating system is driven by **one new field** on the existing `userSubscriptions` table and **one centralized query** that resolves access flags. No new tables are required.

```
┌─────────────────────────────────────────────────────┐
│                 userSubscriptions                    │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  planType    │  │ featureTier  │  │  status    │ │
│  │  (duration)  │  │  (features)  │  │  (billing) │ │
│  └─────────────┘  └──────────────┘  └────────────┘ │
│       ↓                  ↓                ↓         │
│   "How long?"      "What features?"   "Is active?" │
└─────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌──────────────────────┐
              │   getFeatureAccess   │  ← Single source of truth
              │                      │
              │  { learning: bool,   │
              │    buddy: bool,      │
              │    contextChat: bool }│
              └──────────────────────┘
                     │          │
            ┌────────┘          └────────┐
            ▼                            ▼
    ┌──────────────┐            ┌──────────────┐
    │   Frontend   │            │   Backend    │
    │  (gating UI) │            │  (enforcing) │
    └──────────────┘            └──────────────┘
```

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Where to store tier? | `userSubscriptions.featureTier` | Co-located with billing; one query to check both access + tier |
| Fallback for existing users? | `?? "complete"` | Zero-migration: all current subscribers keep full access |
| Client enforcement? | UI-level gating (hide/redirect) | Good UX; backend still validates |
| Backend enforcement? | Query-level checks in mutations/actions | Defense-in-depth; prevents API abuse |
| New table needed? | No | One field on existing table is sufficient |

---

## 2. Phase 1: Schema & Backend Foundation

**Estimated effort:** 1 day  
**Files touched:** 3

### 2.1 Schema Change — Feature Tier

**File:** `convex/schema/core.ts`

Add `featureTier` to the `userSubscriptions` table definition:

```typescript
// In userSubscriptions table definition, add after maxAccessibleUnits:
featureTier: v.optional(v.union(
  v.literal("learning"),   // Units, Vocabulary, Exercises only
  v.literal("buddy"),      // AI Companion (Brate) only
  v.literal("complete")    // Everything + context-aware companion integration
)),
```

Using `v.optional()` is critical — it means:
- Existing rows don't need migration (they have no `featureTier` field)
- The backend treats `undefined` as `"complete"` (backward compatible)
- New subscriptions always set the field explicitly

### 2.2 Schema Change — Message Quota Tracking

**File:** `convex/schema/core.ts`

Add message quota fields to `userSubscriptions`:

```typescript
// Message quota fields (for Buddy/Complete tiers)
messageQuotaTotal: v.optional(v.number()),      // Total messages included in subscription
messageQuotaUsed: v.optional(v.number()),        // Messages consumed so far
messageQuotaTopUp: v.optional(v.number()),       // Additional messages from top-up purchases
```

**File:** `convex/schema/chat.ts`

New table for top-up purchase tracking:

```typescript
chatTopUpPurchases: defineTable({
  userId: v.id("users"),
  messagesAdded: v.number(),        // How many messages this purchase added
  priceCents: v.number(),           // What the user paid
  purchasedAt: v.number(),          // Timestamp
  billingProvider: v.optional(v.string()),
  providerPaymentId: v.optional(v.string()),
})
  .index("by_user", ["userId"]),
```

**Why on `userSubscriptions` and not a separate counter table?**
- Message quota is tied to the subscription lifecycle (resets on renewal, scales with plan)
- Co-locating it avoids cross-table consistency issues
- Top-up messages are tracked separately to distinguish "included" from "purchased" volume
- `messageQuotaUsed` is incremented atomically in the same mutation that creates the chat message

### 2.3 Central Access Query

**File:** `convex/subscriptions.ts`

New exported query `getFeatureAccess`:

```typescript
export const getFeatureAccess = query({
  handler: async (ctx) => {
    const noAccess = {
      learning: false, buddy: false, contextChat: false,
      messagesRemaining: 0, messagesTotal: 0, messagesUsed: 0,
    };
    const user = await getCurrentUser(ctx);
    if (!user) return noAccess;

    // Admins/Superadmins always get full, unlimited access
    if (user.role === "admin" || user.role === "superadmin") {
      return {
        learning: true, buddy: true, contextChat: true,
        messagesRemaining: Infinity, messagesTotal: Infinity, messagesUsed: 0,
      };
    }

    const subscription = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (!subscription) {
      if (user.isBetaTester) {
        return {
          learning: true, buddy: true, contextChat: true,
          messagesRemaining: Infinity, messagesTotal: Infinity, messagesUsed: 0,
        };
      }
      return noAccess;
    }

    const tier = subscription.featureTier ?? "complete";
    const quotaTotal = (subscription.messageQuotaTotal ?? 0)
                     + (subscription.messageQuotaTopUp ?? 0);
    const quotaUsed = subscription.messageQuotaUsed ?? 0;
    // Existing subscriptions without quota fields → treat as unlimited (backward compat)
    const hasQuota = subscription.messageQuotaTotal !== undefined;

    return {
      learning: tier === "learning" || tier === "complete",
      buddy: tier === "buddy" || tier === "complete",
      contextChat: tier === "complete",
      messagesRemaining: hasQuota ? Math.max(0, quotaTotal - quotaUsed) : Infinity,
      messagesTotal: hasQuota ? quotaTotal : Infinity,
      messagesUsed: quotaUsed,
    };
  },
});
```

**Key behaviors:**
- Admin/Superadmin → always full access, unlimited messages
- Beta testers → full access, unlimited messages (consistent with beta policy)
- No subscription → no features, zero messages
- Existing subscriptions without `featureTier` → `"complete"` (backward compatible)
- Existing subscriptions without `messageQuotaTotal` → unlimited messages (backward compatible)
- New subscriptions → explicit quota, tracks usage

### 2.4 Internal Helper for Backend Enforcement

**File:** `convex/subscriptions.ts`

For use within actions/mutations that can't call queries directly:

```typescript
export const internalGetFeatureAccess = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return { learning: false, buddy: false, contextChat: false };

    if (user.role === "admin" || user.role === "superadmin") {
      return { learning: true, buddy: true, contextChat: true };
    }

    const subscription = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (!subscription) {
      if (user.isBetaTester) {
        return { learning: true, buddy: true, contextChat: true };
      }
      return { learning: false, buddy: false, contextChat: false };
    }

    const tier = subscription.featureTier ?? "complete";
    return {
      learning: tier === "learning" || tier === "complete",
      buddy: tier === "buddy" || tier === "complete",
      contextChat: tier === "complete",
    };
  },
});
```

---

## 3. Phase 2: Client-Side Feature Gating

**Estimated effort:** 1 day  
**Files touched:** 3–4

### 3.1 Client Hook: `useFeatureAccess`

**New file:** `client/src/hooks/useFeatureAccess.ts`

```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export type FeatureAccess = {
  learning: boolean;
  buddy: boolean;
  contextChat: boolean;
  isLoading: boolean;
};

export function useFeatureAccess(): FeatureAccess {
  const access = useQuery(api.subscriptions.getFeatureAccess);
  return {
    learning: access?.learning ?? false,
    buddy: access?.buddy ?? false,
    contextChat: access?.contextChat ?? false,
    isLoading: access === undefined,
  };
}
```

This hook is reactive (Convex subscriptions), so UI updates immediately if a user upgrades.

### 3.2 Feature-Gated Route Component

**File:** `client/src/App.tsx`

New component alongside the existing `ProtectedRoute`:

```typescript
function FeatureGatedRoute({
  feature,
  children,
}: {
  feature: "learning" | "buddy";
  children: React.ReactNode;
}) {
  const { isLoaded } = useAuth();
  const access = useFeatureAccess();

  if (!isLoaded || access.isLoading) {
    return <DashboardLayoutSkeleton />;
  }

  const hasAccess =
    feature === "learning" ? access.learning :
    feature === "buddy" ? access.buddy :
    false;

  if (!hasAccess) {
    // Redirect to an upgrade page showing what they're missing
    return <Redirect to={`/upgrade?feature=${feature}`} />;
  }

  return <>{children}</>;
}
```

### 3.3 Route Classification

Apply `FeatureGatedRoute` to existing routes in `App.tsx`:

| Route(s) | Gate | Rationale |
|----------|------|-----------|
| `/units`, `/unit/:unitNumber` | `learning` | Core curriculum |
| `/vocabulary`, `/vocabulary-quiz`, `/vocabulary-list` | `learning` | Vocabulary system |
| `/chat` | `buddy` | AI Learn Buddy |
| `/dashboard` | none | Always accessible (summary view) |
| `/progress` | none | Shows whatever progress exists |
| `/leaderboards` | none | Social feature, accessible to all |
| `/profile`, `/subscription` | none | Account management |
| `/feedback`, `/wishlist/*` | none | Community features |
| `/changelog` | none | Informational |
| `/admin/*` | none (admin role check exists) | Admin area unchanged |

**Implementation pattern:**

```typescript
// Before (current):
<Route path="/units">
  {() => (
    <ProtectedRoute>
      <Suspense fallback={<DashboardLayoutSkeleton />}>
        <DashboardLayout><Units /></DashboardLayout>
      </Suspense>
    </ProtectedRoute>
  )}
</Route>

// After:
<Route path="/units">
  {() => (
    <ProtectedRoute>
      <FeatureGatedRoute feature="learning">
        <Suspense fallback={<DashboardLayoutSkeleton />}>
          <DashboardLayout><Units /></DashboardLayout>
        </Suspense>
      </FeatureGatedRoute>
    </ProtectedRoute>
  )}
</Route>
```

`FeatureGatedRoute` nests inside `ProtectedRoute` — authentication is always checked first.

---

## 4. Phase 3: Navigation & Layout Adaptation

**Estimated effort:** 0.5 days  
**Files touched:** 3

### 4.1 TopNavigation

**File:** `client/src/components/TopNavigation.tsx`

Currently shows 4 items: Dashboard, Units, Practice Vocab, AI Learn Buddy.

**Change:** Filter navigation items based on `useFeatureAccess()`:

```typescript
const { learning, buddy } = useFeatureAccess();

const navItems = [
  { label: t("sidebar.dashboard"), path: "/dashboard", show: true },
  { label: t("sidebar.units"), path: "/units", show: learning },
  { label: t("sidebar.vocabulary"), path: "/vocabulary", show: learning },
  { label: t("sidebar.aiLearnBuddy"), path: "/chat", show: buddy },
].filter(item => item.show);
```

**UX consideration:** Instead of hiding items entirely, an alternative is to show them greyed-out with a lock icon and "Upgrade" tooltip. This creates feature envy (see Marketing doc, Section 5.2). Decide per project guidelines.

### 4.2 FloatingChatButton

**File:** `client/src/components/DashboardLayout.tsx`

Current code (lines ~274, ~293):
```typescript
{!isChatRoute && <FloatingChatButton />}
```

**Change:**
```typescript
{!isChatRoute && access.buddy && <FloatingChatButton />}
```

Where `access` comes from `useFeatureAccess()` in `DashboardLayout`.

### 4.3 Dashboard Page

**File:** `client/src/pages/Dashboard.tsx` (or equivalent)

The dashboard is the landing page after login. It should adapt to the user's tier:

| Tier | Dashboard Shows |
|------|----------------|
| Learning | Unit progress, vocabulary stats, XP, streak — no assistant section |
| Buddy | Assistant quick-access, recent help sessions, "Ask your Buddy" prompt — no unit progress |
| Complete | Everything: unit progress + integrated assistant access |

This can be achieved with conditional rendering sections rather than entirely different pages. The Buddy dashboard section should feel like a "help desk" entry point, not a chat list — reinforce the assistant/companion role.

---

## 5. Phase 4: Chat Backend Enforcement

**Estimated effort:** 0.5 days  
**Files touched:** 1

### 5.1 Feature Gate + Quota Check in `sendMessage`

**File:** `convex/chat.ts`

The `sendMessage` action (line ~440) is the critical entry point for all AI companion interactions.

**Add at the beginning of the handler, after user validation:**

```typescript
// Feature gate: check if user has companion (buddy) access
const featureAccess = await ctx.runQuery(
  internal.subscriptions.internalGetFeatureAccess,
  { userId: user._id }
);
if (!featureAccess.buddy) {
  throw new Error("feature_not_available:buddy");
}

// Quota gate: check if user has messages remaining
if (featureAccess.messagesRemaining <= 0) {
  throw new Error("message_quota_exceeded");
}
```

**After successful AI response, increment the counter:**

```typescript
// In the mutation that saves the assistant's response (or a dedicated counter mutation):
await ctx.runMutation(internal.subscriptions.internalIncrementMessageUsage, {
  userId: user._id,
});
```

The `internalIncrementMessageUsage` mutation atomically increments `messageQuotaUsed` on `userSubscriptions`. Counting the *assistant* response (not the user message) ensures we count actual AI token usage.

### 5.2 Context-Aware Gating

Same file, in the section where `unitContext` is processed (around line ~510):

```typescript
// Unit context only available for "complete" tier
const effectiveUnitContext = featureAccess.contextChat
  ? args.unitContext
  : undefined;
```

This means:
- **Buddy tier:** The assistant works as a general Serbian language helper, but without awareness of which unit the learner is in → no RAG, no unit-specific responses. It can still explain grammar, vocabulary, and answer questions — it just doesn't know "you're in Unit 7 right now."
- **Complete tier:** The assistant is fully context-aware → it references the current unit's content, vocabulary, and grammar, and can proactively help with what the learner is studying right now.

### 5.3 HTTP Streaming Endpoint

**File:** `convex/chat.ts` (function `streamChatMessage`, also registered in `convex/http.ts`)

The streaming path also needs the feature gate. Apply the same check in `streamChatMessage`:

```typescript
// Inside streamChatMessage, after loading streamContext:
// The streaming endpoint reuses prepareStreamContext which already loads user data.
// Add feature check after user identification.
```

### 5.4 Session Creation

**File:** `convex/chat.ts`

The `createSession` mutation should also be gated:

```typescript
// In createSession handler:
const featureAccess = /* ... */;
if (!featureAccess.buddy) {
  throw new Error("feature_not_available:buddy");
}
```

This prevents users without buddy access from creating orphaned sessions.

---

## 6. Phase 5: Upgrade UX & Nudges

**Estimated effort:** 1 day  
**Files touched:** 2–3 new, 2–3 existing

### 6.1 Upgrade Page

**New file:** `client/src/pages/Upgrade.tsx`

A dedicated page that `FeatureGatedRoute` redirects to when access is denied. Reads the `?feature=` query param to customize messaging.

**Content for `?feature=learning`:**
- Headline: "Unlock Structured Serbian Lessons"
- Show preview of unit list (locked)
- Feature comparison table (Learning vs Complete)
- CTA: "Upgrade to Learning" / "Get Complete"

**Content for `?feature=buddy`:**
- Headline: "Get Your Personal Serbian Assistant"
- Subheadline: "Stuck on grammar? Need a word? Your AI assistant explains, helps, and encourages — 24/7."
- Show example assistant interaction (not a "chat" — frame it as Q&A / help session)
- Feature comparison table (Buddy vs Complete)
- CTA: "Get Your Assistant" / "Get Complete"

### 6.2 Contextual Upgrade Nudges

Subtle, non-intrusive prompts at **genuine struggle moments** — the nudge should feel like the app is trying to help, not sell:

| Moment | Where | Nudge |
|--------|-------|-------|
| Learning user fails an exercise 3× | `InteractiveTest.tsx` (after 3 wrong answers) | "Struggling with this? Your personal assistant could walk you through it step by step." |
| Learning user stares at grammar content | `UnitView.tsx` (time-on-page > 3min without action) | "Need someone to explain this differently? Your AI assistant is ready to help." |
| Learning user completes a unit | `UnitView.tsx` (completion screen) | "Well done! Want your assistant to quiz you on what you just learned?" |
| Buddy user asks about a grammar topic | `Chat.tsx` (AI response) | AI naturally mentions: "We have a structured lesson on this topic — with exercises and vocabulary." |
| Buddy user asks about vocabulary systematically | `Chat.tsx` (detected pattern) | "It looks like you're building vocabulary! Our structured vocabulary trainer with spaced repetition could help." |

**Implementation:** These nudges are client-side only, based on `useFeatureAccess()`. No backend changes needed. They should follow existing design patterns and **must feel like genuine help, not upselling**. The tone should be: "This exists and could help you" — never "Pay more to unlock."

### 6.3 Profile/Subscription Page Enhancement

**File:** `client/src/pages/Profile.tsx` (or the subscription section)

Show the current tier alongside the current plan:

```
Your Plan: Balanced (6 months)
Your Tier: Learning
          ↳ Upgrade to Complete for full access →
```

---

## 7. Phase 6: Billing Integration

**Estimated effort:** 1.5 days  
**Files touched:** 2–3

### 7.1 Dodo Products — Subscriptions

Each feature tier needs its own Dodo product per duration × payment mode combination.

**Current product matrix (8 products):**
- 4 plans × 2 payment modes (prepaid, installments)

**New product matrix (recommended MVP — prepaid-only for new tiers):**
- 4 plans × 1 mode for Learning (prepaid) = 4 new
- 4 plans × 1 mode for Buddy (prepaid) = 4 new
- 4 plans × 2 modes for Complete (prepaid + installments) = 8 existing

**Environment variables pattern:**
```
DODO_PRODUCT_INTENSIVE_LEARNING_PREPAID=prod_xxx
DODO_PRODUCT_INTENSIVE_BUDDY_PREPAID=prod_xxx
DODO_PRODUCT_INTENSIVE_PREPAID=prod_xxx          # ← existing = Complete
DODO_PRODUCT_INTENSIVE_INSTALLMENTS=prod_xxx     # ← existing = Complete only
```

### 7.2 Dodo Products — Message Top-Up Packs

Top-up packs are **one-time purchase** products in Dodo (not subscriptions):

```
DODO_PRODUCT_TOPUP_SMALL=prod_xxx     # 50 messages
DODO_PRODUCT_TOPUP_MEDIUM=prod_xxx    # 150 messages
DODO_PRODUCT_TOPUP_LARGE=prod_xxx     # 500 messages
```

**Checkout metadata for top-ups:**
```json
{
  "clerkId": "...",
  "kind": "message_topup",
  "messagesAdded": "50",
  "packSize": "small"
}
```

**Webhook handling:** When `payment.succeeded` arrives with `kind=message_topup`:
1. Look up user by `clerkId`
2. Increment `messageQuotaTopUp` on their `userSubscriptions` record
3. Insert a row into `chatTopUpPurchases` for tracking

### 7.3 Checkout Session Metadata

**File:** `convex/subscriptions.ts` → `createDodoCheckoutSession`

Add `featureTier` and `messageQuotaTotal` to checkout args and Dodo metadata:

```typescript
// New args:
featureTier: v.optional(v.union(
  v.literal("learning"),
  v.literal("buddy"),
  v.literal("complete")
)),

// In metadata sent to Dodo:
metadata: {
  ...existingMetadata,
  featureTier: String(args.featureTier ?? "complete"),
  messageQuotaTotal: String(computeQuotaForPlan(args.planType, args.featureTier)),
}
```

### 7.4 Webhook Processing

**File:** `convex/subscriptions.ts` → `internalApplyDodoPurchase`

Extract `featureTier` and `messageQuotaTotal` from webhook metadata and persist:

```typescript
// In internalApplyDodoPurchase, add to payload:
featureTier: args.featureTier ?? "complete",
messageQuotaTotal: args.messageQuotaTotal ?? undefined,
messageQuotaUsed: 0,
messageQuotaTopUp: 0,
```

### 7.5 Quota Reset on Renewal

For installment-based subscriptions, the `subscription.renewed` webhook handler should **not** reset `messageQuotaUsed` monthly — the quota is for the full subscription duration (Model B from the Marketing doc). The counter resets only when a user purchases a new subscription.

### 7.6 Tier Upgrades (Within Feature Tiers)

A user on Learning who wants to upgrade to Complete is a "tier upgrade" (same duration, more features + messages).

**Recommended approach:** Separate top-up product for the price difference (consistent with existing duration-upgrade system). Reuse the `resolveOrCreateDodoUpgradeTopupProductId` pattern. On successful upgrade:
- Patch `featureTier` to `"complete"`
- Add the additional message quota (Complete quota − Learning quota) to `messageQuotaTotal`

### 7.7 New Checkout Flow: Top-Up Purchase

**New action:** `createDodoTopUpCheckoutSession`

```typescript
export const createDodoTopUpCheckoutSession = action({
  args: {
    packSize: v.union(v.literal("small"), v.literal("medium"), v.literal("large")),
    returnUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user has active subscription with buddy/complete tier
    // Look up Dodo product ID from env var
    // Create checkout session with kind=message_topup metadata
    // Return checkout URL
  },
});
```

---

## 8. Phase 7: Admin Tooling

**Estimated effort:** 0.5 days  
**Files touched:** 1–2

### 8.1 Admin User Detail

Admin should see the user's current `featureTier` in the user detail view and be able to change it manually (for support cases, free upgrades, etc.).

### 8.2 Subscription Analytics

**File:** `convex/subscriptions.ts` → `getAnalytics`

Extend the existing analytics query to break down subscriptions by tier:

```typescript
// Add to analytics return value:
tierBreakdown: {
  learning: allSubscriptions.filter(s => s.featureTier === "learning" && s.status === "active").length,
  buddy: allSubscriptions.filter(s => s.featureTier === "buddy" && s.status === "active").length,
  complete: allSubscriptions.filter(s => (s.featureTier === "complete" || !s.featureTier) && s.status === "active").length,
},
```

### 8.3 Admin Override

For testing and support, add an admin mutation to change a user's tier:

```typescript
export const adminSetFeatureTier = mutation({
  args: {
    userId: v.id("users"),
    featureTier: v.union(v.literal("learning"), v.literal("buddy"), v.literal("complete")),
  },
  handler: async (ctx, args) => {
    // Admin auth check...
    const sub = await ctx.db.query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!sub) throw new Error("No subscription found");
    await ctx.db.patch(sub._id, { featureTier: args.featureTier });
  },
});
```

---

## 9. Migration Strategy

### 9.1 Zero-Migration for Existing Users

Because `featureTier` is `v.optional()` and the backend defaults to `"complete"`:
- **No data migration is needed**
- All existing subscribers automatically have full access
- The field is only set explicitly for new subscriptions going forward

### 9.2 Beta Users

Beta users are handled via `user.isBetaTester` flag (not through subscriptions). The `getFeatureAccess` query grants them full access regardless. No change needed.

### 9.3 Rollout Plan

| Step | Action | Risk |
|------|--------|------|
| 1 | Deploy schema changes (`featureTier` + quota fields + `chatTopUpPurchases` table) | Zero risk — all optional fields |
| 2 | Deploy `getFeatureAccess` query (with quota info) | Zero risk — new query, no callers yet |
| 3 | Deploy client hook `useFeatureAccess` | Zero risk — not wired into UI yet |
| 4 | Deploy admin tools (tier override, quota override, analytics) | Zero risk — admin only |
| 5 | Wire up navigation filtering + FloatingChatButton | **Low risk** — all users still "complete" + unlimited |
| 6 | Wire up `FeatureGatedRoute` in App.tsx | **Low risk** — all users still "complete" + unlimited |
| 7 | Deploy chat backend enforcement (feature gate + quota check) | **Low risk** — all users still "complete" + unlimited |
| 8 | Add message counter UI to Chat page | **Low risk** — shows "unlimited" for existing users |
| 9 | Create Dodo products: Learning/Buddy tiers + top-up packs | Zero risk — preparation only |
| 10 | Launch: Enable tier selection in checkout | **Medium risk** — new revenue paths |
| 11 | Launch: Enable top-up purchases | **Medium risk** — new one-time payment flow |
| 12 | Add upgrade nudges + low-quota warnings | Low risk — UX only |

Steps 1–8 can be deployed incrementally with zero user impact (all existing users remain on `"complete"` with unlimited messages). Steps 10–11 "turn on" the feature for new customers.

---

## 10. Testing Checklist

### 10.1 Unit Tests (Backend)

- [ ] `getFeatureAccess` returns `{ true, true, true }` for admin
- [ ] `getFeatureAccess` returns `{ true, true, true }` for superadmin
- [ ] `getFeatureAccess` returns `{ true, true, true }` for beta tester without subscription
- [ ] `getFeatureAccess` returns `{ true, true, true }` for subscription without `featureTier` (backward compat)
- [ ] `getFeatureAccess` returns `{ true, false, false }` for `featureTier: "learning"`
- [ ] `getFeatureAccess` returns `{ false, true, false }` for `featureTier: "buddy"`
- [ ] `getFeatureAccess` returns `{ true, true, true }` for `featureTier: "complete"`
- [ ] `getFeatureAccess` returns `{ false, false, false }` for no subscription, no beta
- [ ] `getFeatureAccess` returns `{ false, false, false }` for expired subscription
- [ ] `getFeatureAccess` returns `{ false, false, false }` for `past_due` subscription

### 10.2 Integration Tests (Chat + Quota)

- [ ] `sendMessage` succeeds for buddy tier with remaining quota
- [ ] `sendMessage` succeeds for complete tier with remaining quota
- [ ] `sendMessage` throws `feature_not_available:buddy` for learning tier
- [ ] `sendMessage` throws `message_quota_exceeded` when quota is depleted
- [ ] `sendMessage` with `unitContext` uses context for complete tier
- [ ] `sendMessage` with `unitContext` ignores context for buddy tier
- [ ] `createSession` blocked for learning tier
- [ ] Streaming endpoint respects feature gate AND quota
- [ ] `messageQuotaUsed` increments by 1 after successful AI response
- [ ] Top-up purchase adds to `messageQuotaTopUp`, not `messageQuotaTotal`
- [ ] Messages still work after top-up even if base quota is depleted
- [ ] Existing subscriptions (no quota fields) have unlimited messages

### 10.3 E2E Tests (Client)

- [ ] Learning user sees: Dashboard, Units, Vocabulary — no Companion in nav
- [ ] Learning user does NOT see FloatingChatButton
- [ ] Learning user navigating to `/chat` is redirected to `/upgrade?feature=buddy`
- [ ] Buddy user sees: Dashboard, AI Companion — no Units/Vocabulary in nav
- [ ] Buddy user navigating to `/units` is redirected to `/upgrade?feature=learning`
- [ ] Complete user sees: all navigation items and FloatingChatButton
- [ ] Admin user always sees everything regardless of subscription tier
- [ ] Upgrade page renders correct content based on `?feature=` param
- [ ] After tier upgrade (admin override), UI updates reactively (no page reload needed)
- [ ] Message counter is visible to Buddy/Complete users ("X messages remaining")
- [ ] When quota reaches 10%, a friendly warning appears (not blocking)
- [ ] When quota reaches 0, user sees top-up CTA (not an error)
- [ ] After top-up purchase, message counter updates reactively

### 10.4 Billing Tests

- [ ] Checkout for Learning tier creates subscription with `featureTier: "learning"`, no message quota
- [ ] Checkout for Buddy tier creates subscription with `featureTier: "buddy"` + correct `messageQuotaTotal`
- [ ] Checkout for Complete tier creates subscription with `featureTier: "complete"` + correct `messageQuotaTotal`
- [ ] Webhook processing persists `featureTier` and `messageQuotaTotal` from metadata
- [ ] Tier upgrade (Learning → Complete) charges correct difference and adds message quota
- [ ] Tier upgrade (Buddy → Complete) charges correct difference and increases message quota
- [ ] Existing subscriptions (no `featureTier` field) behave as "complete" with unlimited messages
- [ ] Top-up checkout creates one-time payment, not subscription
- [ ] Top-up webhook increments `messageQuotaTopUp` (not `messageQuotaTotal`)
- [ ] Top-up purchase is recorded in `chatTopUpPurchases` table

---

## 11. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Existing users lose access after deployment | Very Low | Critical | `v.optional()` + fallback `?? "complete"` + unlimited messages for existing subs |
| Billing complexity (Dodo products) | Medium | Medium | Start with prepaid-only for new tiers; top-ups are simple one-time products |
| Decision paralysis on pricing page | Medium | Medium | Display Complete prominently; clear comparison table |
| Chat backend not properly enforced | Low | High | Both client gating AND backend enforcement (defense-in-depth) |
| Feature envy becomes annoying | Medium | Medium | Nudges only at genuine struggle moments; tone is "this could help you"; follow design guidelines |
| Users game the system (API calls bypass client gate) | Low | Low | Backend enforcement in all mutations/actions; quota checked server-side |
| Admin forgets to set `featureTier` on manual subscription | Low | Low | Default `"complete"` + unlimited fallback handles this gracefully |
| Performance: extra query per page load | Low | Low | `getFeatureAccess` is a simple indexed query (~1ms); Convex caches reactively |
| AI cost overrun from heavy Buddy users | Medium | Medium | Message quota provides hard ceiling; top-ups ensure proportional payment; monitor avg cost/message |
| Message quota feels restrictive | Medium | Medium | Generous base quota; soft warnings at 10% remaining (not blocking); top-ups are affordable; never fully block the companion |
| Quota counter race condition | Low | Medium | Increment in same mutation as message insert; Convex mutations are serialized per document |
| Top-up purchase fails silently | Low | Medium | Track in `chatTopUpPurchases` table; webhook idempotency via existing `dodoWebhookEvents` pattern |

---

## File Impact Summary

| File | Change Type | Phase |
|------|------------|-------|
| `convex/schema/core.ts` | Modify (featureTier + 3 quota fields on userSubscriptions) | Phase 1 |
| `convex/schema/chat.ts` | Modify (new `chatTopUpPurchases` table) | Phase 1 |
| `convex/subscriptions.ts` | Modify (new queries, quota logic, top-up checkout, webhook handling) | Phase 1, 6 |
| `convex/chat.ts` | Modify (feature gates + quota check in 3 functions) | Phase 4 |
| `client/src/hooks/useFeatureAccess.ts` | **New file** | Phase 2 |
| `client/src/App.tsx` | Modify (FeatureGatedRoute + route wrapping) | Phase 2 |
| `client/src/components/TopNavigation.tsx` | Modify (conditional nav items) | Phase 3 |
| `client/src/components/DashboardLayout.tsx` | Modify (FloatingChatButton condition) | Phase 3 |
| `client/src/pages/Upgrade.tsx` | **New file** (tier upgrade + top-up CTA) | Phase 5 |
| `client/src/pages/Chat.tsx` | Modify (message counter display, low-quota warnings) | Phase 5 |
| `client/src/pages/Dashboard.tsx` | Modify (conditional sections by tier) | Phase 3 |
| `client/src/pages/Profile.tsx` | Modify (show tier + quota info) | Phase 5 |

**Total: 2 new files, ~10 modified files, 1 new table (`chatTopUpPurchases`).**  
Schema additions are all `v.optional()` — no data migration, no breaking changes.
