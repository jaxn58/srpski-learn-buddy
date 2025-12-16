# Email Automation Implementation Guide

This document provides technical implementation details for the automated email system.

---

## Architecture Overview

```
┌─────────────────┐
│  Database       │
│  (User Plans)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Cron Jobs      │◄─── Scheduled checks every hour
│  (Trigger Logic)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Email Service  │
│  (Resend API)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User Inbox     │
└─────────────────┘
```

---

## Database Schema Extensions

**Note:** This document was written for MySQL/TiDB. The application now uses Convex as the database. Schema changes should be implemented in `convex/schema.ts` instead of SQL.

### Email Tracking Requirements

The email automation system requires tracking:
- Email logs (sent_at, opened_at, clicked_at, status)
- Email preferences (marketing_emails, upgrade_reminders, etc.)
- User email frequency cap (max 3 emails per week)

These should be implemented as Convex tables in `convex/schema.ts`.

---

## File Structure

```
server/
├── emails/
│   ├── templates/
│   │   ├── welcome.html
│   │   ├── midpoint-progress.html
│   │   ├── upgrade-intensive.html
│   │   ├── upgrade-balanced.html
│   │   ├── expiration-30days.html
│   │   ├── expiration-7days.html
│   │   ├── plan-expired.html
│   │   ├── special-offer.html
│   │   └── streak-milestone.html
│   ├── emailService.ts          // Resend API wrapper
│   ├── emailTemplates.ts        // Template rendering
│   ├── emailTriggers.ts         // Trigger logic
│   └── emailScheduler.ts        // Cron job setup
├── cron/
│   └── checkEmailTriggers.ts    // Main cron job
└── routers.ts                   // Add email-related procedures
```

---

## Implementation Steps

### Step 1: Create Email Service Wrapper

**File:** `server/emails/emailService.ts`

```typescript
import { Resend } from 'resend';
import { ENV } from '../_core/env';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export interface EmailMetadata {
  userId: string;
  emailType: string;
  planName?: string;
  upgradeOffer?: {
    fromPlan: string;
    toPlan: string;
    cost: number;
  };
}

export async function sendEmail(params: SendEmailParams, metadata?: EmailMetadata): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { data, error } = await resend.emails.send({
      from: params.from || process.env.RESEND_FROM_EMAIL || 'Serbian AI Tutor <noreply@jacksenn.me>',
      to: params.to,
      subject: params.subject,
      html: params.html,
      replyTo: params.replyTo || process.env.RESEND_REPLY_TO_EMAIL,
      tags: metadata ? [
        { name: 'email_type', value: metadata.emailType },
        { name: 'user_id', value: metadata.userId },
      ] : undefined,
    });

    if (error) {
      console.error('[Email Service] Failed to send email:', error);
      return { success: false, error: error.message };
    }

    // Log to database
    if (metadata) {
      await logEmailSent(metadata.userId, metadata.emailType, data?.id || '', metadata);
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('[Email Service] Exception:', error);
    return { success: false, error: String(error) };
  }
}

async function logEmailSent(userId: string, emailType: string, messageId: string, metadata: EmailMetadata) {
  const db = await getDb();
  if (!db) return;

  try {
    await db.insert(emailLogs).values({
      id: messageId || `email_${Date.now()}_${userId}`,
      userId,
      emailType,
      status: 'sent',
      metadata: JSON.stringify(metadata),
    });
  } catch (error) {
    console.error('[Email Service] Failed to log email:', error);
  }
}

export async function hasReceivedEmail(userId: string, emailType: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .select()
    .from(emailLogs)
    .where(and(
      eq(emailLogs.userId, userId),
      eq(emailLogs.emailType, emailType)
    ))
    .limit(1);

  return result.length > 0;
}

export async function canSendEmail(userId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Check email preferences
  const prefs = await db
    .select()
    .from(emailPreferences)
    .where(eq(emailPreferences.userId, userId))
    .limit(1);

  if (prefs.length > 0 && prefs[0].unsubscribedAt) {
    return false; // User unsubscribed
  }

  // Check frequency cap (max 3 emails per week)
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentEmails = await db
    .select()
    .from(emailLogs)
    .where(and(
      eq(emailLogs.userId, userId),
      gte(emailLogs.sentAt, oneWeekAgo)
    ));

  return recentEmails.length < 3;
}
```

---

### Step 2: Create Template Renderer

**File:** `server/emails/emailTemplates.ts`

```typescript
import fs from 'fs/promises';
import path from 'path';

export interface TemplateVariables {
  USER_NAME: string;
  USER_EMAIL: string;
  PLAN_NAME: string;
  PLAN_DURATION: number;
  PLAN_PRICE: number;
  EXPIRATION_DATE: string;
  DAYS_REMAINING: number;
  UNITS_COMPLETED: number;
  COMPLETION_PERCENTAGE: number;
  VOCABULARY_LEARNED: number;
  XP_EARNED: number;
  STREAK_DAYS: number;
  NEXT_PLAN?: string;
  UPGRADE_COST?: number;
  EXTRA_MONTHS?: number;
  DASHBOARD_URL: string;
  UPGRADE_URL: string;
  PRICING_URL: string;
  HELP_URL: string;
  UNSUBSCRIBE_URL: string;
  [key: string]: string | number | undefined;
}

export async function renderTemplate(templateName: string, variables: TemplateVariables): Promise<string> {
  const templatePath = path.join(__dirname, 'templates', `${templateName}.html`);
  
  try {
    let html = await fs.readFile(templatePath, 'utf-8');
    
    // Replace all {{VARIABLE}} placeholders
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, String(value || ''));
    }
    
    return html;
  } catch (error) {
    console.error(`[Template Renderer] Failed to render ${templateName}:`, error);
    throw error;
  }
}

export function getTemplateVariables(user: any, userPlan: any, userProgress: any): TemplateVariables {
  const baseUrl = process.env.VITE_FRONTEND_URL || 'https://serbian-ai-tutor.manus.space';
  
  return {
    USER_NAME: user.name || 'there',
    USER_EMAIL: user.email || '',
    PLAN_NAME: userPlan.planType || 'Intensive',
    PLAN_DURATION: userPlan.durationMonths || 3,
    PLAN_PRICE: userPlan.price || 69,
    EXPIRATION_DATE: new Date(userPlan.expiresAt).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    DAYS_REMAINING: Math.ceil((new Date(userPlan.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    UNITS_COMPLETED: userProgress.unitsCompleted || 0,
    COMPLETION_PERCENTAGE: Math.round(((userProgress.unitsCompleted || 0) / 27) * 100),
    VOCABULARY_LEARNED: userProgress.vocabularyLearned || 0,
    XP_EARNED: userProgress.xp || 0,
    STREAK_DAYS: userProgress.currentStreak || 0,
    DASHBOARD_URL: `${baseUrl}/dashboard`,
    UPGRADE_URL: `${baseUrl}/upgrade`,
    PRICING_URL: `${baseUrl}/#pricing`,
    HELP_URL: 'https://help.jacksenn.me',
    UNSUBSCRIBE_URL: `${baseUrl}/unsubscribe?userId=${user.id}`,
  };
}

export function calculateUpgradeOffer(currentPlan: string): { nextPlan: string; cost: number; extraMonths: number } | null {
  const upgrades: Record<string, { nextPlan: string; cost: number; extraMonths: number }> = {
    'intensive': { nextPlan: 'Balanced', cost: 10, extraMonths: 3 },
    'balanced': { nextPlan: 'Standard', cost: 16, extraMonths: 3 },
    'standard': { nextPlan: 'Relaxed', cost: 24, extraMonths: 3 },
  };
  
  return upgrades[currentPlan.toLowerCase()] || null;
}
```

---

### Step 3: Implement Trigger Logic

**File:** `server/emails/emailTriggers.ts`

```typescript
import { sendEmail, hasReceivedEmail, canSendEmail } from './emailService';
import { renderTemplate, getTemplateVariables, calculateUpgradeOffer } from './emailTemplates';
import { getDb } from '../db';
import { users, userPlans, userProgress } from '../../drizzle/schema';
import { eq, and, lte, gte } from 'drizzle-orm';

export async function checkAndSendWelcomeEmail(userId: string) {
  if (await hasReceivedEmail(userId, 'welcome')) return;
  if (!(await canSendEmail(userId))) return;

  const db = await getDb();
  if (!db) return;

  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const plan = await db.select().from(userPlans).where(eq(userPlans.userId, userId)).limit(1);
  
  if (!user[0] || !plan[0]) return;

  const variables = getTemplateVariables(user[0], plan[0], {});
  const html = await renderTemplate('welcome', variables);

  await sendEmail({
    to: user[0].email!,
    subject: `🎉 Welcome to Serbian AI Tutor! Your Learning Journey Starts Now`,
    html,
  }, {
    userId,
    emailType: 'welcome',
    planName: plan[0].planType,
  });
}

export async function checkMidpointProgressEmails() {
  const db = await getDb();
  if (!db) return;

  // Find users at 50% of their plan duration
  const now = new Date();
  const plans = await db.select().from(userPlans).where(/* TODO: Add midpoint logic */);

  for (const plan of plans) {
    if (await hasReceivedEmail(plan.userId, 'midpoint-progress')) continue;
    if (!(await canSendEmail(plan.userId))) continue;

    const user = await db.select().from(users).where(eq(users.id, plan.userId)).limit(1);
    const progress = await db.select().from(userProgress).where(eq(userProgress.userId, plan.userId)).limit(1);

    if (!user[0]) continue;

    const variables = getTemplateVariables(user[0], plan, progress[0] || {});
    const html = await renderTemplate('midpoint-progress', variables);

    await sendEmail({
      to: user[0].email!,
      subject: `🎯 You're halfway there, ${user[0].name}! Keep up the great work`,
      html,
    }, {
      userId: plan.userId,
      emailType: 'midpoint-progress',
    });
  }
}

export async function checkExpirationWarnings() {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // 30-day warning
  const plans30Days = await db
    .select()
    .from(userPlans)
    .where(and(
      lte(userPlans.expiresAt, thirtyDaysFromNow),
      gte(userPlans.expiresAt, new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000))
    ));

  for (const plan of plans30Days) {
    if (await hasReceivedEmail(plan.userId, 'expiration-30days')) continue;
    if (!(await canSendEmail(plan.userId))) continue;

    const user = await db.select().from(users).where(eq(users.id, plan.userId)).limit(1);
    if (!user[0]) continue;

    const variables = getTemplateVariables(user[0], plan, {});
    const upgrade = calculateUpgradeOffer(plan.planType);
    if (upgrade) {
      variables.NEXT_PLAN = upgrade.nextPlan;
      variables.UPGRADE_COST = upgrade.cost;
      variables.EXTRA_MONTHS = upgrade.extraMonths;
    }

    const html = await renderTemplate('expiration-30days', variables);

    await sendEmail({
      to: user[0].email!,
      subject: `⚠️ Your Serbian AI Tutor access expires in 30 days`,
      html,
    }, {
      userId: plan.userId,
      emailType: 'expiration-30days',
    });
  }

  // 7-day warning (similar logic)
  // ... implement 7-day warning
}

export async function checkUpgradeReminders() {
  const db = await getDb();
  if (!db) return;

  // Intensive users at week 8
  const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000);
  const intensivePlans = await db
    .select()
    .from(userPlans)
    .where(and(
      eq(userPlans.planType, 'intensive'),
      lte(userPlans.createdAt, eightWeeksAgo)
    ));

  for (const plan of intensivePlans) {
    if (await hasReceivedEmail(plan.userId, 'upgrade-intensive')) continue;
    if (!(await canSendEmail(plan.userId))) continue;

    const user = await db.select().from(users).where(eq(users.id, plan.userId)).limit(1);
    if (!user[0]) continue;

    const variables = getTemplateVariables(user[0], plan, {});
    variables.NEXT_PLAN = 'Balanced';
    variables.UPGRADE_COST = 10;
    variables.EXTRA_MONTHS = 3;

    const html = await renderTemplate('upgrade-intensive', variables);

    await sendEmail({
      to: user[0].email!,
      subject: `⏰ Only 4 weeks left on your Intensive plan - Need more time?`,
      html,
    }, {
      userId: plan.userId,
      emailType: 'upgrade-intensive',
      upgradeOffer: {
        fromPlan: 'Intensive',
        toPlan: 'Balanced',
        cost: 10,
      },
    });
  }

  // Similar logic for Balanced users at month 4
  // ... implement balanced upgrade reminder
}
```

---

### Step 4: Set Up Cron Job

**File:** `server/cron/checkEmailTriggers.ts`

```typescript
import cron from 'node-cron';
import { 
  checkMidpointProgressEmails, 
  checkExpirationWarnings, 
  checkUpgradeReminders 
} from '../emails/emailTriggers';

export function startEmailCronJobs() {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[Email Cron] Running email trigger checks...');
    
    try {
      await checkMidpointProgressEmails();
      await checkExpirationWarnings();
      await checkUpgradeReminders();
      
      console.log('[Email Cron] Email checks completed');
    } catch (error) {
      console.error('[Email Cron] Error running email checks:', error);
    }
  });

  console.log('[Email Cron] Email automation cron jobs started');
}
```

**Update `server/index.ts`:**

```typescript
import { startEmailCronJobs } from './cron/checkEmailTriggers';

// ... existing code ...

// Start cron jobs
startEmailCronJobs();
```

---

### Step 5: Add tRPC Procedures for Manual Triggers

**File:** `server/routers.ts`

```typescript
import { sendEmail, renderTemplate, getTemplateVariables } from './emails';

export const appRouter = router({
  // ... existing routers ...

  email: router({
    // Manual trigger for testing
    sendTestEmail: protectedProcedure
      .input(z.object({ emailType: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        const plan = await getUserPlan(user.id);
        const progress = await getUserProgress(user.id);

        const variables = getTemplateVariables(user, plan, progress);
        const html = await renderTemplate(input.emailType, variables);

        const result = await sendEmail({
          to: user.email!,
          subject: `Test: ${input.emailType}`,
          html,
        }, {
          userId: user.id,
          emailType: input.emailType,
        });

        return result;
      }),

    // Get email history
    getEmailHistory: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) return [];

        const logs = await db
          .select()
          .from(emailLogs)
          .where(eq(emailLogs.userId, ctx.user.id))
          .orderBy(desc(emailLogs.sentAt))
          .limit(50);

        return logs;
      }),

    // Update email preferences
    updatePreferences: protectedProcedure
      .input(z.object({
        marketingEmails: z.boolean().optional(),
        upgradeReminders: z.boolean().optional(),
        expirationWarnings: z.boolean().optional(),
        progressUpdates: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');

        await db.insert(emailPreferences).values({
          userId: ctx.user.id,
          ...input,
        }).onDuplicateKeyUpdate({
          set: input,
        });

        return { success: true };
      }),

    // Unsubscribe
    unsubscribe: publicProcedure
      .input(z.object({ userId: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');

        await db.insert(emailPreferences).values({
          userId: input.userId,
          marketingEmails: false,
          upgradeReminders: false,
          expirationWarnings: false,
          progressUpdates: false,
          unsubscribedAt: new Date(),
        }).onDuplicateKeyUpdate({
          set: {
            marketingEmails: false,
            upgradeReminders: false,
            expirationWarnings: false,
            progressUpdates: false,
            unsubscribedAt: new Date(),
          },
        });

        return { success: true };
      }),
  }),
});
```

---

## Testing Checklist

- [ ] Test all 9 email templates in Gmail, Outlook, Apple Mail
- [ ] Verify mobile responsiveness (<600px width)
- [ ] Test unsubscribe functionality
- [ ] Verify email frequency cap (max 3/week)
- [ ] Test variable replacement (no {{MISSING}} placeholders)
- [ ] Check spam score (use mail-tester.com)
- [ ] Verify SPF, DKIM, DMARC authentication
- [ ] Test cron job execution
- [ ] Monitor bounce rate and deliverability
- [ ] A/B test subject lines and CTAs

---

## Monitoring & Analytics

Track these metrics in your dashboard:

1. **Delivery Metrics:**
   - Sent count
   - Delivered rate (>95% target)
   - Bounce rate (<5% target)
   - Spam complaint rate (<0.1% target)

2. **Engagement Metrics:**
   - Open rate (20-30% target)
   - Click-through rate (3-5% target)
   - Conversion rate (upgrade emails: 5-10% target)

3. **Revenue Metrics:**
   - Revenue attributed to email campaigns
   - Average upgrade value per email
   - ROI of email automation

---

## Deployment Steps

1. **Install Dependencies:**
   ```bash
   pnpm add resend node-cron
   pnpm add -D @types/node-cron
   ```

2. **Run Database Migrations:**
   ```bash
   pnpm db:push
   ```

3. **Create HTML Templates:**
   - Copy templates from EMAIL_TEMPLATES.md to `server/emails/templates/`

4. **Configure Environment Variables:**
   - `RESEND_API_KEY` (already configured)
   - `RESEND_FROM_EMAIL` (already configured)
   - `VITE_FRONTEND_URL` (for links in emails)

5. **Start Cron Jobs:**
   - Cron jobs start automatically with server

6. **Test in Staging:**
   - Send test emails to yourself
   - Verify all links work
   - Check rendering in multiple email clients

7. **Deploy to Production:**
   - Monitor logs for errors
   - Track delivery metrics
   - Adjust based on user feedback

---

## Troubleshooting

### Emails Not Sending
- Check Resend API key is valid
- Verify user has valid email address
- Check email frequency cap hasn't been exceeded
- Review email logs for error messages

### Low Open Rates
- Test different subject lines
- Check spam score (mail-tester.com)
- Verify sender reputation
- Ensure emails aren't landing in spam folder

### High Unsubscribe Rate
- Reduce email frequency
- Improve email relevance
- Make unsubscribe process easier
- Segment audience better

---

**Next Steps:**
1. Implement database schema changes
2. Create email service files
3. Build HTML templates
4. Set up cron jobs
5. Test thoroughly
6. Deploy and monitor


