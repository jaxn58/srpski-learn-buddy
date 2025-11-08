# Extracted Email Templates for Review

## Template 1: Upgrade Reminder - Intensive Users (Week 8)

**Trigger:** 8 weeks after Intensive plan purchase (2/3 through 3-month plan)  
**Audience:** Intensive plan users only  
**Goal:** Encourage upgrade to Balanced plan

---

### Subject Line
```
⏰ Only 4 weeks left on your Intensive plan - Need more time?
```

### Preheader
```
Upgrade to Balanced for just €10 and get 3 extra months to master Serbian
```

### Email Body (HTML)

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

### Variables Used
- `{{USER_NAME}}` - User's first name
- `{{UNITS_COMPLETED}}` - Number of units completed (0-27)

### Design Notes
- **Highlight Box:** Light blue background (#EFF6FF), blue left border (#3B82F6)
- **CTA Button:** Red background (#C8102E), white text, bold, 16px padding
- **Small Text:** 14px, gray color (#6B7280)

### Conversion Goal
Target: 8-12% upgrade rate from Intensive to Balanced

---

## Template 2: Plan Expiration Warning - 7 Days

**Trigger:** 7 days before plan expiration  
**Audience:** All users approaching expiration  
**Goal:** Create urgency for renewal

---

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

### Variables Used
- `{{USER_NAME}}` - User's first name
- `{{PLAN_NAME}}` - Intensive/Balanced/Standard/Relaxed
- `{{EXPIRATION_DATE}}` - Format: "March 15, 2026"
- `{{UNITS_COMPLETED}}` - Number of units completed
- `{{VOCABULARY_LEARNED}}` - Words learned count
- `{{XP_EARNED}}` - Total XP earned
- `{{NEXT_PLAN}}` - Recommended upgrade plan
- `{{UPGRADE_COST}}` - Cost to upgrade (€10/€16/€24)
- `{{EXTRA_MONTHS}}` - Additional months from upgrade

### Design Notes
- **Urgency Elements:** 
  - Red warning emoji (🚨) in subject
  - "URGENT" in all caps
  - "7 DAYS" emphasized
  - Loss-framing (what they'll lose)
  
- **Psychological Triggers:**
  - Loss aversion (lose access to content)
  - Sunk cost fallacy (don't waste your progress)
  - Scarcity (only 7 days left)
  - Social proof (your achievements)

- **CTA Button:** Red background (#C8102E), white text, bold
- **P.S. Line:** Reinforces urgency and cost savings

### Conversion Goal
Target: 15-20% extension/upgrade rate

---

## Comparison: Upgrade Reminder vs. Expiration Warning

| Aspect | Upgrade Reminder (Week 8) | 7-Day Expiration Warning |
|--------|---------------------------|--------------------------|
| **Tone** | Encouraging, supportive | Urgent, action-required |
| **Timing** | Proactive (4 weeks left) | Reactive (7 days left) |
| **Framing** | Gain-focused (more time to learn) | Loss-focused (lose access) |
| **Urgency** | Moderate | High |
| **Offer** | Standard upgrade pricing | Standard upgrade pricing + urgency |
| **CTA** | "Upgrade for €10" | "Extend My Plan Now" |
| **Emoji** | ⏰ (clock) | 🚨 (warning) |
| **Subject Length** | 58 characters | 52 characters |

---

## A/B Testing Recommendations

### For Upgrade Reminder (Intensive):

**Test 1: Subject Line**
- A: "⏰ Only 4 weeks left on your Intensive plan - Need more time?"
- B: "{{USER_NAME}}, you're running out of time - upgrade for just €10?"

**Test 2: Offer Framing**
- A: "Upgrade to Balanced for just €10"
- B: "Get 3 extra months for only €10"

**Test 3: CTA Copy**
- A: "Upgrade for €10 →"
- B: "Get 3 More Months →"

### For 7-Day Expiration Warning:

**Test 1: Subject Line**
- A: "🚨 URGENT: Only 7 days left on your Serbian AI Tutor plan"
- B: "{{USER_NAME}}, your access expires in 7 days - extend now!"

**Test 2: Loss Framing**
- A: Show what they'll lose (current version)
- B: Show what they'll keep if they extend

**Test 3: Urgency Level**
- A: High urgency (current version with ✗ symbols)
- B: Moderate urgency (softer language)

---

## Expected Performance Metrics

### Upgrade Reminder (Intensive - Week 8)

| Metric | Target | Industry Benchmark |
|--------|--------|-------------------|
| Open Rate | 35-45% | 20-30% |
| Click-through Rate | 8-12% | 3-5% |
| Conversion Rate | 8-12% | 5-8% |
| Unsubscribe Rate | <0.5% | <1% |

**Revenue Impact:**
- If 100 Intensive users receive this email
- 40 open (40% open rate)
- 4 upgrade (10% conversion)
- Revenue: 4 × €10 = **€40 per 100 emails**

### 7-Day Expiration Warning

| Metric | Target | Industry Benchmark |
|--------|--------|-------------------|
| Open Rate | 50-60% | 25-35% |
| Click-through Rate | 15-20% | 5-8% |
| Conversion Rate | 15-20% | 8-12% |
| Unsubscribe Rate | <1% | <2% |

**Revenue Impact:**
- If 100 users receive this email
- 55 open (55% open rate)
- 11 extend/upgrade (20% conversion)
- Average upgrade: €16
- Revenue: 11 × €16 = **€176 per 100 emails**

---

## Implementation Priority

**Phase 1 (High Priority):**
1. ✅ 7-Day Expiration Warning (highest conversion)
2. ✅ 30-Day Expiration Warning (early warning)
3. ✅ Welcome Email (onboarding)

**Phase 2 (Medium Priority):**
4. Upgrade Reminder - Intensive (Week 8)
5. Upgrade Reminder - Balanced (Month 4)
6. Plan Expired - Reactivation Offer

**Phase 3 (Low Priority):**
7. Midpoint Progress Check
8. Special Upgrade Offer (seasonal)
9. Streak Milestone (engagement)

---

## Next Steps

1. **Review & Approve:** Confirm these two templates meet your requirements
2. **Create HTML Versions:** Build full HTML templates with inline CSS
3. **Set Up Variables:** Ensure all {{VARIABLES}} are populated from database
4. **Test Rendering:** Send test emails to yourself in Gmail, Outlook, Apple Mail
5. **Configure Triggers:** Set up cron jobs for automated sending
6. **Monitor Performance:** Track open rates, clicks, and conversions
7. **Iterate:** A/B test subject lines and CTAs based on data

---

**Document Created:** {{CURRENT_DATE}}  
**Templates Extracted:** 2 of 9  
**Status:** Ready for Review

