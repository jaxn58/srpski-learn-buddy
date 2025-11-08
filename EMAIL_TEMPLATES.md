# Automated Email Templates - Serbian AI Tutor

This document contains all automated email templates for user engagement, upgrade reminders, and plan expiration warnings.

---

## Table of Contents

1. [Welcome Email (Day 1)](#1-welcome-email-day-1)
2. [Midpoint Progress Check (50% Complete)](#2-midpoint-progress-check-50-complete)
3. [Upgrade Reminder - Intensive Users (Week 8)](#3-upgrade-reminder---intensive-users-week-8)
4. [Upgrade Reminder - Balanced Users (Month 4)](#4-upgrade-reminder---balanced-users-month-4)
5. [Plan Expiration Warning - 30 Days](#5-plan-expiration-warning---30-days)
6. [Plan Expiration Warning - 7 Days](#6-plan-expiration-warning---7-days)
7. [Plan Expired - Reactivation Offer](#7-plan-expired---reactivation-offer)
8. [Special Upgrade Offer - Limited Time](#8-special-upgrade-offer---limited-time)
9. [Streak Milestone - Upgrade Incentive](#9-streak-milestone---upgrade-incentive)

---

## Email Template Structure

All emails follow this structure:
- **Subject Line:** Clear, action-oriented
- **Preheader:** 40-100 characters summary
- **Header:** Serbian AI Tutor branding
- **Body:** Personalized content with clear value proposition
- **CTA Button:** Single, prominent call-to-action
- **Footer:** Unsubscribe link, contact info

---

## 1. Welcome Email (Day 1)

**Trigger:** Immediately after plan purchase  
**Audience:** All new users  
**Goal:** Onboard users and set expectations

### Subject Line
```
🎉 Welcome to Serbian AI Tutor! Your Learning Journey Starts Now
```

### Preheader
```
Here's everything you need to know to get started with your {{PLAN_NAME}} plan
```

### Email Body (HTML)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Serbian AI Tutor</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Main Container -->
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #C8102E 0%, #012169 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">🎉 Welcome to Serbian AI Tutor!</h1>
            </td>
          </tr>
          
          <!-- Body Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 16px; color: #374151; line-height: 1.6; margin: 0 0 20px 0;">
                Hi <strong>{{USER_NAME}}</strong>,
              </p>
              
              <p style="font-size: 16px; color: #374151; line-height: 1.6; margin: 0 0 20px 0;">
                Congratulations on starting your Serbian learning journey! You've purchased the <strong>{{PLAN_NAME}} plan</strong> ({{PLAN_DURATION}} months), 
                giving you access to all 27 units until <strong>{{EXPIRATION_DATE}}</strong>.
              </p>
              
              <!-- Plan Summary Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #EFF6FF; border-left: 4px solid #3B82F6; border-radius: 8px; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 18px; color: #1F2937;">Your Plan Details</h3>
                    <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 14px; line-height: 1.8;">
                      <li><strong>Plan:</strong> {{PLAN_NAME}} (€{{PLAN_PRICE}})</li>
                      <li><strong>Duration:</strong> {{PLAN_DURATION}} months</li>
                      <li><strong>Access until:</strong> {{EXPIRATION_DATE}}</li>
                      <li><strong>Recommended pace:</strong> {{HOURS_PER_WEEK}} hours/week</li>
                    </ul>
                  </td>
                </tr>
              </table>
              
              <h3 style="font-size: 20px; color: #1F2937; margin: 30px 0 15px 0;">🚀 Get Started in 3 Easy Steps</h3>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 10px 0;">
                    <strong style="color: #3B82F6; font-size: 18px;">1.</strong>
                    <span style="color: #374151; font-size: 16px; margin-left: 10px;">Log in to your dashboard</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <strong style="color: #3B82F6; font-size: 18px;">2.</strong>
                    <span style="color: #374151; font-size: 16px; margin-left: 10px;">Start with Unit 1: Greetings & Introductions</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <strong style="color: #3B82F6; font-size: 18px;">3.</strong>
                    <span style="color: #374151; font-size: 16px; margin-left: 10px;">Practice daily to build your streak 🔥</span>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="{{DASHBOARD_URL}}" style="display: inline-block; background-color: #C8102E; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold;">
                      Start Learning Now →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="font-size: 14px; color: #6B7280; line-height: 1.6; margin: 20px 0 0 0;">
                <strong>Pro tip:</strong> Set a daily reminder to practice for 20-30 minutes. Consistency is key to language learning success!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 30px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #E5E7EB;">
              <p style="font-size: 14px; color: #6B7280; margin: 0 0 10px 0;">
                Questions? Reply to this email or visit our <a href="{{HELP_URL}}" style="color: #3B82F6; text-decoration: none;">Help Center</a>
              </p>
              <p style="font-size: 12px; color: #9CA3AF; margin: 0;">
                Serbian AI Tutor | <a href="{{UNSUBSCRIBE_URL}}" style="color: #9CA3AF; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

### Variables
- `{{USER_NAME}}` - User's first name
- `{{PLAN_NAME}}` - Intensive/Balanced/Standard/Relaxed
- `{{PLAN_DURATION}}` - 3/6/9/12
- `{{PLAN_PRICE}}` - 69/79/95/119
- `{{EXPIRATION_DATE}}` - Format: "March 15, 2026"
- `{{HOURS_PER_WEEK}}` - 12+/6-8/4-5/3-4
- `{{DASHBOARD_URL}}` - Link to user dashboard
- `{{HELP_URL}}` - Help center link
- `{{UNSUBSCRIBE_URL}}` - Unsubscribe link

---

## 2. Midpoint Progress Check (50% Complete)

**Trigger:** When user completes 50% of their plan duration  
**Audience:** All active users  
**Goal:** Celebrate progress and encourage upgrade if needed

### Subject Line
```
🎯 You're halfway there, {{USER_NAME}}! Keep up the great work
```

### Preheader
```
You've completed {{UNITS_COMPLETED}} units. Here's your progress update and what's next.
```

### Email Body (Text Version)

```
Hi {{USER_NAME}},

Congratulations! You've reached the halfway point of your {{PLAN_NAME}} plan. 🎉

YOUR PROGRESS SO FAR:
✓ {{UNITS_COMPLETED}} units completed ({{COMPLETION_PERCENTAGE}}%)
✓ {{VOCABULARY_LEARNED}} vocabulary words learned
✓ {{XP_EARNED}} XP earned
✓ {{STREAK_DAYS}} day learning streak 🔥

You have {{DAYS_REMAINING}} days left on your plan (until {{EXPIRATION_DATE}}).

WHAT'S NEXT?
Continue at your current pace to complete all 27 units. Based on your progress, you're on track to finish {{ON_TRACK_STATUS}}.

[If user is behind schedule:]
Need more time? Upgrade to a longer plan and pay only the difference:
→ Upgrade to {{NEXT_PLAN}} for just €{{UPGRADE_COST}} ({{EXTRA_MONTHS}} extra months)

[CTA BUTTON: View My Progress →]

Keep up the excellent work!

The Serbian AI Tutor Team

---
Questions? Reply to this email
Unsubscribe: {{UNSUBSCRIBE_URL}}
```

---

## 3. Upgrade Reminder - Intensive Users (Week 8)

**Trigger:** 8 weeks after Intensive plan purchase (2/3 through 3-month plan)  
**Audience:** Intensive plan users only  
**Goal:** Encourage upgrade to Balanced plan

### Subject Line
```
⏰ Only 4 weeks left on your Intensive plan - Need more time?
```

### Preheader
```
Upgrade to Balanced for just €10 and get 3 extra months to master Serbian
```

### Email Body (HTML - Abbreviated)

```html
<h1>Running out of time? We've got you covered.</h1>

<p>Hi {{USER_NAME}},</p>

<p>You're doing great! You've completed <strong>{{UNITS_COMPLETED}} units</strong> in just 8 weeks. 
However, we noticed you have only <strong>4 weeks left</strong> on your Intensive plan.</p>

<div class="highlight-box">
  <h3>🎁 Special Upgrade Offer</h3>
  <p>Upgrade to <strong>Balanced (6 months)</strong> for just <strong>€10</strong></p>
  <ul>
    <li>Pay only the difference (€79 - €69 = €10)</li>
    <li>Get 3 extra months of access</li>
    <li>All your progress preserved</li>
    <li>Instant activation</li>
  </ul>
</div>

<p><strong>Why upgrade now?</strong></p>
<ul>
  <li>More time to practice and reinforce what you've learned</li>
  <li>No rush to finish - learn at a comfortable pace</li>
  <li>Better retention with spaced repetition</li>
</ul>

[CTA BUTTON: Upgrade for €10 →]

<p class="small-text">Not sure? You can always upgrade later, but this offer gives you the best value.</p>
```

---

## 4. Upgrade Reminder - Balanced Users (Month 4)

**Trigger:** 4 months after Balanced plan purchase  
**Audience:** Balanced plan users only  
**Goal:** Encourage upgrade to Standard or Relaxed

### Subject Line
```
📚 2 months left - Want to extend your learning journey?
```

### Preheader
```
Upgrade to Standard for €16 and get 3 more months (best value: €10.56/month)
```

### Email Body (Text Version)

```
Hi {{USER_NAME}},

You're making excellent progress! You've completed {{UNITS_COMPLETED}} units and have 2 months left on your Balanced plan.

EXTEND YOUR LEARNING:
Many students find that extra time helps solidify their knowledge. Here are your options:

Option 1: Standard Plan (9 months total)
→ Pay just €16 more (€95 - €79)
→ Get 3 extra months
→ Best value: €10.56/month

Option 2: Relaxed Plan (12 months total)
→ Pay €40 more (€119 - €79)
→ Get 6 extra months
→ Maximum flexibility: €9.92/month

WHY EXTEND?
✓ More time for review and practice
✓ Better long-term retention
✓ No pressure to rush through units
✓ Lifetime access to your progress

[CTA BUTTON: View Upgrade Options →]

Your progress is automatically saved, so you can upgrade anytime without losing anything.

Happy learning!
The Serbian AI Tutor Team
```

---

## 5. Plan Expiration Warning - 30 Days

**Trigger:** 30 days before plan expiration  
**Audience:** All users approaching expiration  
**Goal:** Prompt renewal or upgrade

### Subject Line
```
⚠️ Your Serbian AI Tutor access expires in 30 days
```

### Preheader
```
Don't lose your progress! Extend your plan or upgrade to continue learning.
```

### Email Body (HTML - Abbreviated)

```html
<h1>Your plan expires on {{EXPIRATION_DATE}}</h1>

<p>Hi {{USER_NAME}},</p>

<p>This is a friendly reminder that your <strong>{{PLAN_NAME}} plan</strong> will expire in <strong>30 days</strong> ({{EXPIRATION_DATE}}).</p>

<div class="progress-summary">
  <h3>Your Learning Journey So Far:</h3>
  <ul>
    <li>{{UNITS_COMPLETED}}/27 units completed ({{COMPLETION_PERCENTAGE}}%)</li>
    <li>{{VOCABULARY_LEARNED}} vocabulary words mastered</li>
    <li>{{XP_EARNED}} XP earned</li>
    <li>{{ACHIEVEMENTS_COUNT}} achievements unlocked</li>
  </ul>
</div>

<h3>Don't Stop Now! Here are your options:</h3>

<table class="options-table">
  <tr>
    <td class="option-card">
      <h4>🔄 Extend Your Current Plan</h4>
      <p>Upgrade to a longer plan and pay only the difference</p>
      <p class="price">From €{{MIN_UPGRADE_COST}}</p>
      <a href="{{UPGRADE_URL}}" class="btn-secondary">View Upgrade Options</a>
    </td>
    <td class="option-card">
      <h4>🔁 Repurchase</h4>
      <p>Buy any plan again at standard pricing</p>
      <p class="price">From €69</p>
      <a href="{{PRICING_URL}}" class="btn-secondary">See Pricing</a>
    </td>
  </tr>
</table>

<div class="guarantee-box">
  <p><strong>✓ Your progress is saved forever</strong></p>
  <p>Even if your plan expires, all your completed units, vocabulary, and achievements are permanently stored. 
  You can pick up right where you left off anytime you renew.</p>
</div>

[CTA BUTTON: Extend My Plan →]
```

---

## 6. Plan Expiration Warning - 7 Days

**Trigger:** 7 days before plan expiration  
**Audience:** All users approaching expiration  
**Goal:** Create urgency for renewal

### Subject Line
```
🚨 URGENT: Only 7 days left on your Serbian AI Tutor plan
```

### Preheader
```
Your access expires {{EXPIRATION_DATE}}. Extend now to keep learning!
```

### Email Body (Text Version)

```
Hi {{USER_NAME}},

This is your final reminder: Your {{PLAN_NAME}} plan expires in just 7 DAYS ({{EXPIRATION_DATE}}).

WHAT HAPPENS ON {{EXPIRATION_DATE}}:
✗ You'll lose access to all 27 units
✗ You won't be able to practice vocabulary
✗ Your AI Learn Buddy will be unavailable
✓ Your progress will be saved (you can restore it anytime)

YOU'VE COME SO FAR:
→ {{UNITS_COMPLETED}} units completed
→ {{VOCABULARY_LEARNED}} words learned
→ {{XP_EARNED}} XP earned

Don't let your hard work go to waste!

EXTEND YOUR PLAN TODAY:
Pay only the difference to upgrade:
• {{NEXT_PLAN}}: +€{{UPGRADE_COST}} for {{EXTRA_MONTHS}} more months

[CTA BUTTON: Extend My Plan Now →]

Questions? Reply to this email - we're here to help!

The Serbian AI Tutor Team

P.S. After expiration, you'll need to repurchase at full price. Extending now saves you money!
```

---

## 7. Plan Expired - Reactivation Offer

**Trigger:** 1 day after plan expiration  
**Audience:** Users whose plans have expired  
**Goal:** Win back expired users with special offer

### Subject Line
```
💔 We miss you! Get 20% OFF to reactivate your Serbian learning
```

### Preheader
```
Special comeback offer: Save 20% on any plan for the next 7 days only
```

### Email Body (HTML - Abbreviated)

```html
<h1>Welcome back! We saved your progress.</h1>

<p>Hi {{USER_NAME}},</p>

<p>Your {{PLAN_NAME}} plan expired yesterday, but <strong>all your progress is safe</strong>:</p>

<div class="saved-progress">
  <h3>✓ Still Saved in Your Account:</h3>
  <ul>
    <li>{{UNITS_COMPLETED}} completed units</li>
    <li>{{VOCABULARY_LEARNED}} vocabulary words</li>
    <li>{{XP_EARNED}} XP and {{ACHIEVEMENTS_COUNT}} achievements</li>
    <li>Your {{STREAK_DAYS}}-day learning streak record</li>
  </ul>
</div>

<div class="special-offer">
  <h2>🎁 Special Comeback Offer</h2>
  <p class="big-text">Get <strong>20% OFF</strong> any plan</p>
  <p>Valid for 7 days only (expires {{OFFER_EXPIRATION}})</p>
  
  <table class="pricing-table">
    <tr>
      <td>Intensive (3 mo)</td>
      <td><s>€69</s> <strong>€55</strong></td>
    </tr>
    <tr>
      <td>Balanced (6 mo)</td>
      <td><s>€79</s> <strong>€63</strong></td>
    </tr>
    <tr>
      <td>Standard (9 mo)</td>
      <td><s>€95</s> <strong>€76</strong></td>
    </tr>
    <tr>
      <td>Relaxed (12 mo)</td>
      <td><s>€119</s> <strong>€95</strong></td>
    </tr>
  </table>
</div>

[CTA BUTTON: Claim My 20% Discount →]

<p class="urgency">⏰ This offer expires in 7 days. Don't miss out!</p>

<p>Pick up right where you left off - your progress is waiting for you.</p>
```

---

## 8. Special Upgrade Offer - Limited Time

**Trigger:** Manual/seasonal campaign (e.g., New Year, Summer)  
**Audience:** Active users on shorter plans  
**Goal:** Drive upgrades during promotional periods

### Subject Line
```
🎉 New Year Special: Upgrade for 50% OFF the difference!
```

### Preheader
```
Limited time: Extend your plan and pay only half the upgrade cost
```

### Email Body (Text Version)

```
Hi {{USER_NAME}},

Happy New Year! 🎊

To celebrate 2026, we're offering an exclusive upgrade deal for our active learners:

🎁 UPGRADE FOR 50% OFF THE DIFFERENCE

Example: Intensive → Balanced
• Normal upgrade cost: €10
• Your price: €5 (50% off!)
• You save: €5

YOUR PERSONALIZED UPGRADE OPTIONS:
{{PLAN_NAME}} → {{NEXT_PLAN}}
Regular: €{{REGULAR_UPGRADE_COST}}
New Year Price: €{{DISCOUNTED_UPGRADE_COST}}
You save: €{{SAVINGS}}

WHY UPGRADE NOW?
✓ More time to complete all 27 units
✓ Better learning retention with extra practice
✓ Best value per month
✓ This discount expires January 31, 2026

[CTA BUTTON: Upgrade Now & Save 50% →]

This offer is valid until January 31, 2026. Don't miss out!

Happy learning,
The Serbian AI Tutor Team

P.S. This discount applies to the upgrade cost only. Your original plan price stays the same.
```

---

## 9. Streak Milestone - Upgrade Incentive

**Trigger:** User reaches 30-day learning streak  
**Audience:** Users with active streaks on shorter plans  
**Goal:** Reward consistency and encourage upgrade

### Subject Line
```
🔥 30-day streak! Here's €5 OFF your next upgrade
```

### Preheader
```
Congratulations on your dedication! Claim your reward and keep the momentum going.
```

### Email Body (HTML - Abbreviated)

```html
<h1>🔥 Incredible! 30 Days in a Row!</h1>

<p>Hi {{USER_NAME}},</p>

<p>We're amazed by your dedication! You've maintained a <strong>30-day learning streak</strong> - that's serious commitment! 🎉</p>

<div class="achievement-badge">
  <img src="{{STREAK_BADGE_IMAGE}}" alt="30-Day Streak Badge" />
  <h3>Streak Master Achievement Unlocked</h3>
  <p>+500 XP Bonus</p>
</div>

<div class="reward-box">
  <h3>🎁 Your Reward: €5 OFF Any Upgrade</h3>
  <p>As a thank you for your consistency, we're giving you <strong>€5 OFF</strong> your next plan upgrade.</p>
  <p class="code">Use code: <strong>STREAK30</strong></p>
  <p class="expiry">Valid until {{REWARD_EXPIRATION}}</p>
</div>

<h3>Keep Your Momentum Going!</h3>
<p>You have {{DAYS_REMAINING}} days left on your {{PLAN_NAME}} plan. 
With your dedication, you might want more time to master Serbian:</p>

<table class="upgrade-options">
  <tr>
    <td>Upgrade to {{NEXT_PLAN}}</td>
    <td><s>€{{REGULAR_COST}}</s> <strong>€{{DISCOUNTED_COST}}</strong></td>
    <td><a href="{{UPGRADE_URL}}?code=STREAK30" class="btn">Upgrade Now</a></td>
  </tr>
</table>

<p>Your streak proves you're serious about learning Serbian. Give yourself the time you deserve!</p>

[CTA BUTTON: Claim My €5 Discount →]
```

---

## Email Trigger Logic & Timing

### Trigger Schedule

| Email | Trigger Condition | Timing | Frequency |
|-------|------------------|--------|-----------|
| Welcome | Plan purchased | Immediately | Once |
| Midpoint Progress | 50% of plan duration elapsed | Day {{PLAN_DAYS/2}} | Once |
| Intensive Upgrade | Intensive plan, 8 weeks in | Day 56 | Once |
| Balanced Upgrade | Balanced plan, 4 months in | Day 120 | Once |
| 30-Day Warning | 30 days before expiration | Day {{PLAN_DAYS-30}} | Once |
| 7-Day Warning | 7 days before expiration | Day {{PLAN_DAYS-7}} | Once |
| Plan Expired | 1 day after expiration | Day {{PLAN_DAYS+1}} | Once |
| Special Offer | Manual campaign | Varies | Campaign-based |
| Streak Milestone | 30-day streak achieved | On achievement | Once per milestone |

### Implementation Notes

1. **Email Service:** Use Resend API (already configured in project)
2. **Template Storage:** Store HTML templates in `server/emails/templates/`
3. **Scheduling:** Use cron jobs or database triggers
4. **Personalization:** Replace `{{VARIABLES}}` with user data
5. **Unsubscribe:** Honor unsubscribe preferences (exclude from promotional emails)
6. **Testing:** Test all templates in major email clients (Gmail, Outlook, Apple Mail)

---

## Variables Reference

### User Variables
- `{{USER_NAME}}` - First name
- `{{USER_EMAIL}}` - Email address
- `{{USER_ID}}` - Unique user ID

### Plan Variables
- `{{PLAN_NAME}}` - Intensive/Balanced/Standard/Relaxed
- `{{PLAN_DURATION}}` - 3/6/9/12 months
- `{{PLAN_PRICE}}` - 69/79/95/119
- `{{PLAN_DAYS}}` - Total days (90/180/270/360)
- `{{EXPIRATION_DATE}}` - Format: "March 15, 2026"
- `{{DAYS_REMAINING}}` - Days until expiration

### Progress Variables
- `{{UNITS_COMPLETED}}` - Number of units completed (0-27)
- `{{COMPLETION_PERCENTAGE}}` - Percentage complete
- `{{VOCABULARY_LEARNED}}` - Words learned
- `{{XP_EARNED}}` - Total XP
- `{{STREAK_DAYS}}` - Current streak
- `{{ACHIEVEMENTS_COUNT}}` - Achievements unlocked

### Upgrade Variables
- `{{NEXT_PLAN}}` - Recommended next plan
- `{{UPGRADE_COST}}` - Cost to upgrade
- `{{EXTRA_MONTHS}}` - Additional months
- `{{REGULAR_UPGRADE_COST}}` - Normal upgrade price
- `{{DISCOUNTED_UPGRADE_COST}}` - Promotional price
- `{{SAVINGS}}` - Amount saved

### URL Variables
- `{{DASHBOARD_URL}}` - User dashboard
- `{{UPGRADE_URL}}` - Upgrade page
- `{{PRICING_URL}}` - Pricing page
- `{{HELP_URL}}` - Help center
- `{{UNSUBSCRIBE_URL}}` - Unsubscribe link

---

## Design Guidelines

### Color Palette
- **Primary (Serbian Red):** #C8102E
- **Secondary (Serbian Blue):** #012169
- **Success:** #10B981
- **Warning:** #F59E0B
- **Text Dark:** #1F2937
- **Text Light:** #6B7280
- **Background:** #F3F4F6

### Typography
- **Headings:** Bold, 24-28px
- **Body:** Regular, 16px, line-height 1.6
- **Small Text:** 14px
- **Font Family:** System fonts (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto)

### Button Styles
- **Primary CTA:** Red background (#C8102E), white text, 16px padding
- **Secondary CTA:** White background, blue border, blue text
- **Border Radius:** 8px
- **Font Weight:** Bold

### Mobile Responsiveness
- Use responsive tables (`width="100%"`)
- Stack columns on mobile (<600px width)
- Minimum touch target: 44x44px for buttons
- Font size minimum: 14px on mobile

---

## A/B Testing Recommendations

Test these variables to optimize conversion:

1. **Subject Lines:** Emoji vs. no emoji
2. **CTA Copy:** "Upgrade Now" vs. "Extend My Plan"
3. **Urgency:** With vs. without countdown timers
4. **Social Proof:** Include testimonials vs. no testimonials
5. **Discount Format:** Percentage vs. absolute amount

---

## Compliance & Best Practices

1. **CAN-SPAM Compliance:**
   - Include physical address in footer
   - Honor unsubscribe requests within 10 days
   - Clear "From" name (Serbian AI Tutor)

2. **GDPR Compliance:**
   - Only send to users who opted in
   - Provide easy unsubscribe mechanism
   - Store consent records

3. **Deliverability:**
   - Authenticate with SPF, DKIM, DMARC
   - Maintain low bounce rate (<5%)
   - Monitor spam complaints (<0.1%)
   - Use reputable email service (Resend)

4. **Accessibility:**
   - Alt text for all images
   - Semantic HTML structure
   - Sufficient color contrast (WCAG AA)
   - Text-only fallback version

---

## Next Steps for Implementation

1. Create email templates in `server/emails/templates/`
2. Build email service wrapper around Resend API
3. Set up cron jobs for scheduled emails
4. Implement trigger logic in user journey
5. Test all templates across email clients
6. Monitor open rates, click rates, and conversions
7. Iterate based on A/B test results

---

**Document Version:** 1.0  
**Last Updated:** {{CURRENT_DATE}}  
**Maintained by:** Serbian AI Tutor Development Team

