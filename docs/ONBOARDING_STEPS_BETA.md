# Onboarding Steps — Beta Test (English)

Ready-to-copy texts for **Admin → Onboarding Management** (`/admin/onboarding`).

**Beta defaults used in these texts:**

- Max units: **3** (`betaMaxUnits`)
- AI Energy / month: **120** (`betaEnergyQuotaMonthly`)
- Limits are described as **beta-only / for testing the system**

**How to enter in the admin UI:**

1. Create or edit a step
2. Fill **Title**, **Description**, **Icon**, **Step Number**, **Active**
3. Paste **Content** into the TipTap editor (plain text — format headings/lists in the editor yourself)
4. Optionally use **AI Translate DE** for German

**Placeholder:** In Step 1 title, `{{USER_NAME}}` is replaced with the learner’s name.

---

## Step 1

| Field | Value |
|-------|-------|
| Step Number | `1` |
| Title (EN) | `Welcome to Serbian AI Tutor, {{USER_NAME}}!` |
| Description (EN) | `Step 1 of 6` |
| Icon | `Sparkles` |
| Active | on |

### Content (EN)

```
Your Serbian learning journey starts here

Serbian AI Tutor is your interactive companion for learning Serbian — structured lessons, vocabulary practice, and an AI tutor in one place.

What you will learn:
- The Serbian alphabet and pronunciation
- Essential grammar (cases, verb conjugation, gender)
- Practical vocabulary for everyday situations
- Conversation skills through interactive practice

You are currently in the beta test. Some features and limits are set specifically for testing the system and may change after the beta ends.

This short tour shows you around. You can skip it or reopen it later.
```

---

## Step 2

| Field | Value |
|-------|-------|
| Step Number | `2` |
| Title (EN) | `The Course: Modules & Units` |
| Description (EN) | `Step 2 of 6` |
| Icon | `BookOpen` |
| Active | on |

### Content (EN)

```
Learn step by step

The course is organized into modules with bite-sized units. Each unit builds on the previous one, so you always have a clear next step.

What you find in a unit:
- Unit content — overview, grammar explanations, and examples
- Interactive exercises — translation and fill-in-the-blank practice
- Progress tracking — your progress is saved automatically

Beta test note: During the beta, you can access the first 3 units. This limit is only for testing the system and may change after the beta ends. Use the Modules page — or the quick switcher in the top bar — to jump between available units.
```

---

## Step 3

| Field | Value |
|-------|-------|
| Step Number | `3` |
| Title (EN) | `Practice Vocabulary` |
| Description (EN) | `Step 3 of 6` |
| Icon | `Target` |
| Active | on |

### Content (EN)

```
Build your word power

The vocabulary trainer uses spaced repetition: words come back when you are about to forget them, so they stick for the long term.

Where to practice:
- Practice Vocabulary — short, focused review sessions with words from your units
- Vocabulary Dictionary — browse and search course words anytime, including audio pronunciation

Tip: Train a little every day. Consistent short sessions work better than long, rare ones.
```

---

## Step 4

| Field | Value |
|-------|-------|
| Step Number | `4` |
| Title (EN) | `XP, Levels & Streaks` |
| Description (EN) | `Step 4 of 6` |
| Icon | `Trophy` |
| Active | on |

### Content (EN)

```
Stay motivated as you learn

Every correct answer can earn XP — from vocabulary practice and unit exercises.

How XP works:
- 1st correct answer: 5 XP
- 2nd correct answer: 10 XP
- 3rd correct answer: 20 XP — mastered (35 XP total)
- After mastery: no more XP for that item

Level up: every 300 XP advances you one level. Watch your progress ring in the top bar.

Streaks and leaderboards: learn a little every day to build your streak, and compare your progress on the leaderboards.
```

---

## Step 5

| Field | Value |
|-------|-------|
| Step Number | `5` |
| Title (EN) | `Meet your AI Learn Buddy` |
| Description (EN) | `Step 5 of 6` |
| Icon | `Brain` |
| Active | on |

### Content (EN)

```
Your personal AI tutor

The AI Learn Buddy answers grammar questions, explains vocabulary, and lets you practice conversations in Serbian.

What you can do:
- Ask anything — get clear answers at your level
- Practice conversations — short chats to apply what you have learned
- Get examples — extra explanations tailored to your progress

AI Energy in the beta test: During the beta, you have 120 AI Energy per month for chat actions. Different actions use different amounts of Energy (short answers cost less, longer or context-heavy answers cost more). This Energy limit is only for testing the system during the beta and may change after the beta ends.

When your Energy runs low, you will see a clear hint in the chat. You can also check your remaining Energy in the chat header.
```

---

## Step 6

| Field | Value |
|-------|-------|
| Step Number | `6` |
| Title (EN) | `My Library & getting started` |
| Description (EN) | `Step 6 of 6` |
| Icon | `Rocket` |
| Active | on |

### Content (EN)

```
Keep everything organized

In My Library you can organize your saved AI chats into folders. Depending on your access during the beta, you may also use the Knowledge Base for documents the AI can reference.

Chat Library: your AI chats are saved automatically — sort them into folders so you can find them again quickly.

Knowledge Base: upload documents once and reuse them in conversations (availability depends on your plan / beta access).

You are ready!

Start with Unit 1 and take it one step at a time. Remember: during the beta you can open the first 3 units and use up to 120 AI Energy per month — these limits are only for testing the system.

Srećno — good luck!
```

---

## Checklist after entry

- [ ] Deactivate or delete outdated onboarding steps
- [ ] All 6 new steps active, step numbers 1–6
- [ ] Preview in Admin (EN)
- [ ] Translate DE via AI Translate (or paste DE manually later)
- [ ] Preview DE
- [ ] Spot-check as beta tester: 3 units + 120 Energy wording matches live config
