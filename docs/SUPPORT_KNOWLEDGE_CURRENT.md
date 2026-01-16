# Support Knowledge Base (Current)
Last updated: 2026-01-16  
Applies to: Serbian AI Tutor (production: `https://learn-with.me`)  

This document is the current, human-reviewed knowledge source for support replies.
If something is not explicitly covered here, treat it as unknown and ask a clarifying question.

## PRODUCT FACTS (verified) — highest priority

### Product summary
- Serbian AI Tutor is a Serbian learning app for beginners.
- It offers a structured learning path, vocabulary practice, and an AI chat feature ("AI Learn Buddy").

### Current version / environment
- App version: 1.1.0 (see `CHANGELOG.md`, released 2026-01-09)
- Production URL: `https://learn-with.me`
- Environments are separated:
  - Dev Convex deployment: `reminiscent-panda-57`
  - Prod Convex deployment: `fleet-labrador-324` (`https://fleet-labrador-324.convex.cloud`)

### Core user-facing features (high level)
- Authentication: Clerk sign-in/sign-up.
- Learning path: units/modules (structured course).
- Vocabulary practice: dedicated practice + dictionary pages.
- AI Learn Buddy: chat-style support for questions and learning help.
- Progress tracking & gamification: XP, badges, streak, progress views.
- Feedback: users can submit feedback (bug/feature/improvement/other) and see their submission history.

### Security & bot protection (user-visible behavior)
- Registration is protected with Cloudflare Turnstile (adaptive CAPTCHA).
- Content Security Policy is strict (see `CHANGELOG.md` and `docs/CSP_CONFIGURATION.md`).

### XP rules / policies
- Mastery: after 3 correct answers, the item is considered mastered (no further XP for that item).
- XP per correct answer until mastery:
  - 1st correct: 10 XP
  - 2nd correct: 5 XP
  - 3rd correct: 3 XP
  - After mastery: 0 XP

### Content language policy (current)
- Public content is English-only until multi-language is enabled.

### Newsletter (public-facing + operational facts)
- Newsletter infrastructure exists (contacts, campaigns, unsubscribe, tracking).
- Unsubscribe is supported via a frontend confirmation UI and also one-click-unsubscribe (RFC 8058).
- In development, newsletter sending is restricted via whitelist when test mode is active (see `docs/NEWSLETTER_SYSTEM.md`).

### Feedback replies (what users should experience)
- When an admin sends a reply to a feedback item, the user should be able to read the reply in-app in their feedback history.
- A reply may also be sent via email, depending on whether a valid user email is available.
- Support replies must not expose internal-only notes.

### Support troubleshooting (common)
- Login issues:
  - Ask which sign-in method they used and whether the issue is on sign-in or after sign-in.
  - Ask for screenshot + timestamp.
- App not loading / blank page:
  - Ask for browser + device + screenshot.
  - Ask if it happens in private/incognito mode and after a hard refresh.
- Email not received:
  - Ask them to check spam/junk.
  - Ask for the email address domain (do not request passwords).

### Known issues (keep short; verified only)
- None documented here yet. Add entries only when confirmed.

Template for an entry:
- [KI-###] Title:
  - Symptoms:
  - Affected:
  - Status:
  - Workaround:
  - Safe phrasing:

### Recent changes (factual, last 30–60 days)
- 2026-01-09: Security hardening (CSP), Turnstile bot protection, production-safe logging, production deployment success (see `CHANGELOG.md`).

## TONE & WORDING (newsletter-derived) — style & consistent naming

### Voice
- Friendly, calm, competent, human.
- Short paragraphs. No marketing fluff.
- Clear next steps and one focused question when needed.

### Do / Don’t
- Do: confirm you understood and thank the user.
- Do: ask for minimal reproduction details for bug reports (device/browser, steps, expected vs. actual).
- Do: be transparent when something is unknown.
- Don’t: promise timelines, guarantees, or specific release dates.
- Don’t: mention internal tools, admin features, AI, or “knowledge base”.

### Canonical naming (use these terms)
- Product: “Serbian AI Tutor”
- “AI Learn Buddy”
- “Modules”
- “Vocabulary Practice”
- “Vocabulary Dictionary”
- “Feedback”
- “Waitlist”
- “Newsletter”

### Safe support phrases (copy-ready)
- “Thanks for reporting this — we’re looking into it.”
- “Could you share your device/browser and the steps to reproduce?”
- “What did you expect to happen, and what happened instead?”
- “I don’t have enough detail yet to confirm — could you clarify …?”

## FUTURE PLANS (defensive) — roadmap signals, never promises

Rules:
- Only use “considering / on our roadmap”.
- No ETA, no guarantees.
- If it’s not in this list: say it’s not on our published roadmap and ask what problem they want to solve.

### Roadmap items (currently empty)
Add items only when they are explicitly mentioned in a newsletter or an approved internal roadmap note.

Entry format:
- ID:
  - Topic:
  - Status: considering | planned | in_progress | paused
  - Source (newsletter issue/date):
  - Safe wording (customer-facing):
  - One key question to ask:

## SOURCES (for maintenance)
- `docs/README.md`
- `CHANGELOG.md`
- `docs/NEWSLETTER_SYSTEM.md`
- `docs/DEVELOPMENT_WORKFLOW.md`

