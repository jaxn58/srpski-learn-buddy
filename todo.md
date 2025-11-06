# Serbian AI Tutor - TODO

## UI/UX Improvements
- [x] Redesign AI Professor chat with modern chat bubbles and better UX
- [x] Create vocabulary reference page with full word list
- [x] Add "Next Unit" button on unit page after completing a lesson
- [x] Add navigation between units (Previous/Next buttons)
- [x] Show success message after completing a unit
- [x] Add visual indicator showing which unit is next
- [x] Improve dashboard to show all available units in current week
- [ ] Add breadcrumb navigation showing progress through course
- [x] Expand vocabulary to include all words from all 27 units

## Features
- [x] Create comprehensive, detailed content for Units 1-3 (matching book depth with original examples)
- [ ] Create comprehensive, detailed content for Units 4-5 (after user feedback)
- [x] Improve text formatting in unit Overview sections (better structure, clear sections, more whitespace)
- [ ] Get user feedback on sample units
- [ ] Create Units 6-27 based on feedback
- [x] Extract actual content from PDF book (dialogues, grammar tables, exercises) for all 27 units - CHANGED TO: Create original content inspired by book topics
- [x] 27 units with detailed explanations
- [x] AI Professor chat
- [x] Vocabulary practice with quiz mode
- [x] Progress tracking
- [x] Admin dashboard
- [x] User management (Superadmin/Admin/Student)
- [x] Flexible learning plans (3/6/9/12 months)
- [x] Auto-advance to next unit after completion

## Bugs
- [x] JSON parsing error on unit pages (fixed)
- [x] Double JSON.parse in completeUnit (fixed)
- [x] TypeScript errors in Progress page (fixed)
- [x] React Hooks order error in UnitView (fixed)
- [x] Vocabulary trainer always shows Unit 1 instead of current unit (fixed)

## Future Enhancements
- [ ] Email notifications for progress milestones
- [ ] Spaced repetition algorithm for vocabulary
- [ ] Audio pronunciation for Serbian words
- [ ] Downloadable progress certificates
- [ ] Mobile app version



## Current Issues
- [x] Unit pages showing old short content instead of new comprehensive Markdown content (Fixed: Data now in database)
- [x] Fix CORS issue preventing unitExplanations.ts from loading in browser (Fixed: Using database instead)
- [x] Store unit explanations in database instead of separate file (Completed)

## In Progress
- [x] Create interactive fill-in-the-blank exercises with input fields and answer checking
- [x] Add "Check Answers" and "Show Solutions" buttons to exercises
- [x] Implement green/red feedback for correct/incorrect answers
- [x] Create comprehensive content for Units 2-5 with interactive exercises



- [x] Update course book reference to clarify content is original and independent



## Bugs
- [x] Current Lesson should show next incomplete unit, not the first completed one (Fixed: completeUnit now finds next incomplete unit)



## Montenegrin Language Support
- [x] Add Montenegrin alphabet note (Ś/Ź) to Unit 1 Grammar Explained section
- [x] Add Montenegrin variant hints for words with sj/zj combinations throughout Units 1-5 (No sj/zj words found in current content)



## Content Creation
- [x] Create comprehensive content for Units 6-10 with interactive exercises (COMPLETED)
- [ ] Create comprehensive content for Units 11-27 with interactive exercises

## Future Gamification (After Units 6-27)
- [ ] Achievement badges system (Airport Navigator, Café Regular, etc.)
- [ ] Title display under username on dashboard
- [ ] Level system (Level X/27)
- [ ] XP points (100 XP per unit)
- [ ] Streak counter with bonus badges
- [ ] Badge gallery/collection page



## Gamification Implementation (COMPLETED)
- [x] Extend database schema (XP, badges, exercise completions, streaks)
- [x] Implement XP system (50 XP unit + 50 XP exercises)
- [x] Create achievement badge definitions and logic
- [x] Build streak counter with daily activity tracking
- [x] Update Dashboard UI with XP, badges, and streak display
- [x] Add exercise completion tracking
- [x] Test gamification features



## UI Improvements
- [x] Move "Companion to" book reference from top banner to page footer



## User Management Audit (Beta Testing Readiness)
- [ ] Review authentication and user registration flow
- [ ] Test admin panel functionality
- [ ] Check user roles and permissions
- [ ] Verify user data privacy and security
- [ ] Identify missing features for beta testing



## Beta Testing Control Features
- [x] Add isBetaTester field to users table
- [x] Set new users to inactive by default (isActive = false)
- [x] Implement registration approval system (Superadmin activates users)
- [x] Add Beta Tester badge display in Admin Panel
- [x] Add Beta Tester badge display on user Dashboard
- [x] Create onboarding tutorial/welcome message for new users
- [x] Build feedback/wish list form component
- [x] Create feedback submissions table in database
- [x] Add feedback review panel in Admin Dashboard
- [x] Test registration approval workflow
- [x] Test beta tester badge functionality
- [x] Test onboarding tutorial flow
- [x] Test feedback form submission and admin review




## Owner Notifications
- [x] Implement notifyOwner() call when new user registers
- [ ] Test notification delivery to Manus dashboard
- [x] Add user details (name, email) to notification

## Monetization Strategy
- [x] Create monetization strategy document
- [x] Define pricing tiers (Free, Premium, Pro)
- [x] Plan payment integration (Stripe)
- [x] Design subscription management system
- [x] Plan feature access control based on subscription tier




## Navigation Improvements
- [x] Add "View Landing Page" link to Dashboard header
- [x] Remove auto-redirect from Home page for logged-in users
- [x] Test navigation flow between Home and Dashboard




## Landing Page Content Updates
- [x] Remove "Step by Step Serbian 1" book references from hero section
- [x] Update AI Professor description (focus on review & reinforcement, not tutoring)
- [x] Remove "Conversation Practice" feature card
- [x] Add "Gamification" feature card
- [x] Update Learning Path to 3 months (flexible)
- [x] Change "Start for Free" to "Register for Beta Test"
- [x] Update footer: remove book reference, add jaXn.me copyright




## Landing Page Redesign (Balkan-Inspired)
- [x] Fetch all 27 units data with vocabulary counts
- [x] Create vibrant Balkan-inspired color scheme (warm colors, energy)
- [x] Design 27-unit overview section with individual cards
- [x] Add vocabulary count display for each unit
- [x] Explain flexible course duration system (3-12 months)
- [x] Create beta registration form component (name, email, motivation)
- [x] Integrate registration form on landing page
- [x] Update hero section with energetic design
- [x] Test all new features and design




## Serbian Flag Color Scheme
- [x] Update CSS color variables to Serbian flag colors (red, blue, white, gold)
- [x] Update primary color to Serbian red
- [x] Add secondary color as royal blue
- [x] Add accent/gold color from crown
- [x] Update landing page gradients with flag colors
- [x] Update card borders and hover effects with blue accents
- [x] Test color harmony across all sections




## Simplify Color Scheme (Red-Blue-White Focus)
- [x] Remove gold from button gradients (use solid red instead)
- [x] Remove gold from title gradients (use red-to-blue only)
- [x] Simplify backgrounds to clean white with subtle red/blue accents
- [x] Keep gold only for small accent elements (badges)
- [x] Update hover effects to blue (no gold)
- [x] Test cleaner, less playful design




## Content Updates
- [x] Change hero headline to "Serbisch für Anfänger. Nutze die Hilfe von AI."




## English Text & Feature Updates
- [x] Change hero text to English: "Serbian for Beginners. Use AI to help."
- [x] Add 5th feature card: "Vocabulary Trainer"
- [x] Remove vocabulary count badges from unit cards (top-right corner)



- [x] Add beta tester incentive: "50% off at launch" message




## Footer Correction
- [x] Fix copyright from "jaXn.me" to "jacksenn.me"




## Date Format Correction
- [x] Change date format from US (MM/DD/YYYY) to European (DD.MM.YYYY)
- [x] Admin.tsx: Last Signed In field (line 266)
- [x] Admin.tsx: Last Activity At field (line 388)
- [x] Progress.tsx: Started date (line 154)
- [x] Progress.tsx: Estimated Completion date (line 160)
- [x] FeedbackManagement.tsx: Submitted At (lines 155, 178)




## Beta Registration Bug
- [x] Investigate why beta registration doesn't create user in database
- [x] Create betaRegistrations table in database schema
- [x] Create tRPC mutation for beta registration
- [x] Add owner notification to beta registration
- [x] Fix beta registration form submission flow
- [x] Test complete registration workflow




## Beta Registration Admin Page
- [x] Create tRPC queries to fetch all beta registrations
- [x] Create tRPC mutations to approve/reject registrations
- [x] Create BetaRegistrations.tsx admin page component
- [x] Add table with registration data (name, email, motivation, status, date)
- [x] Add approve/reject action buttons
- [x] Add status filter (pending, approved, rejected)
- [x] Add route to App.tsx
- [x] Add navigation link from Admin panel
- [x] Test approval/rejection workflow




## Admin Procedure Permission Fix
- [x] Update adminProcedure to allow both 'admin' and 'superadmin' roles
- [x] Test beta registrations page access with superadmin account




## Resend Email Integration
- [x] Request Resend API key and email configuration via secrets form
- [x] Implement Resend email service helper
- [x] Create beta registration confirmation email template
- [x] Create user activation email template
- [x] Update beta registration mutation to send confirmation email
- [x] Add activation email to toggleUserStatus mutation
- [x] Test email sending functionality




## Email Delivery Debugging
- [x] Check server logs for email sending errors (Found: Missing API key at initialization)
- [x] Verify Resend domain verification status
- [x] Test email sending with detailed error logging (Fixed lazy initialization)
- [x] Check if emails are landing in spam folder (Fixed reply_to format)
- [x] Fix identified email delivery issues (reply_to field corrected)




## Beta Registration UX Improvements
- [x] Change redirect from login page to homepage after registration
- [x] Add success message with "Check your email!" notification
- [x] Reset form after successful submission
- [x] Scroll to top for better UX
- [x] Test complete registration flow with new UX




## Email Protection & Opt-out
- [x] Remove reply_to address from beta registration email
- [x] Remove "feel free to reply" text from email template
- [x] Add "Didn't register?" warning message for user protection
- [x] Add feedback form mention to activation email
- [x] Test updated email templates




## Landing Page Transparency Updates
- [x] Add "Gratis*" asterisk notation to landing page where "free" is mentioned
- [x] Add footer disclaimer explaining Gratis* refers to first 5 units only



## Beta Access Restrictions (Units 1-5 Only)
- [x] Add backend validation to restrict beta testers to Units 1-5
- [x] Update getUnitExplanation to check beta tester status
- [x] Update completeUnit to prevent completing Units 6-27 for beta testers
- [x] Add UI lock icons on Units 6-27 for beta testers
- [x] Show "Upgrade to unlock" message when clicking locked units
- [x] Update dashboard to visually distinguish locked units
- [x] Test beta tester access restrictions



## Beta Registration Email Template Update
- [x] Update "What You'll Get" section to clarify 5 units for beta
- [x] Add clear messaging about 50% discount at launch
- [x] Remove misleading "all 27 units" text
- [x] Test updated email template



## Dashboard Issues
- [ ] Fix "Current Week" showing "Week" instead of actual week number
- [ ] Fix "Current Lesson" showing "Unit" instead of actual unit number
- [x] Fix "Go to Lesson" button navigation (currently goes nowhere)
- [ ] Ensure user progress is properly initialized after onboarding
- [ ] Test dashboard with fresh user account
- [ ] Fix Unit page loading infinitely when clicking "Go to Lesson"



## Pending Approval Overlay & Activation Email
- [x] Add overlay to dashboard for inactive users (isActive: false)
- [x] Show "Waiting for approval" message with instructions
- [x] Create activation email template
- [x] Send activation email when admin approves beta tester
- [x] Add admin endpoint to activate users
- [x] Test complete workflow (register → pending → activate → email)



## Learning Plan & Subscription Features
- [ ] Add Learning Plan selection to Dashboard (Intensive/Balanced/Relaxed)
- [ ] Link Learning Plan to subscription/payment (longer plans require upgrade)
- [ ] Add "Upgrade Plan" feature for users who need more time
- [x] Add Beta-Tester benefits banner to Dashboard (Units 1-5 free, 50% off after launch)



## Beta Banner Not Showing
- [x] Check JACK SENN's isBetaTester flag in database
- [x] Set isBetaTester to true for JACK SENN
- [ ] Debug why banner doesn't show despite isBetaTester=true
- [ ] Fix banner visibility logic
- [ ] Verify banner appears on dashboard



# Bug Fixes
- [x] Fix Beta Tester Benefits Banner layout (broken vertical stacking)
- [x] Fix auth.me query to load full user data from database (isBetaTester field)



# Banner Updates
- [x] Remove "Priority support and early access to new features" from Beta Tester Benefits Banner
- [x] Change Beta Tester badge color from blue to gold gradient
- [x] Update badge text color for better contrast with gold background



## Payment Integration - Paddle
- [ ] Gather pricing requirements (subscription model, prices, currencies)
- [ ] Create Paddle account and get API credentials
- [ ] Implement Paddle SDK integration
- [ ] Create subscription products in Paddle dashboard
- [ ] Implement checkout flow for Units 6-27 access
- [ ] Add paywall component for locked units
- [ ] Implement 50% beta tester discount code
- [ ] Add subscription status to user database
- [ ] Create subscription management page in dashboard
- [ ] Implement webhook handlers for subscription events (created, updated, cancelled)
- [ ] Test complete payment flow end-to-end
- [ ] Add subscription status display in admin panel



## Database Migration - TiDB to Supabase
- [ ] Create Supabase account and project
- [ ] Gather Supabase credentials (Project URL, API Keys, Database Password)
- [ ] Backup current TiDB database
- [ ] Convert TiDB schema to PostgreSQL schema
- [ ] Export all data from TiDB
- [ ] Create tables in Supabase
- [ ] Import data to Supabase
- [ ] Update drizzle/schema.ts to use PostgreSQL (pgTable instead of mysqlTable)
- [ ] Update drizzle.config.ts to use PostgreSQL dialect
- [ ] Update package.json (remove mysql2, add pg)
- [ ] Update DATABASE_URL in environment variables
- [ ] Test all features locally (login, dashboard, units, chat, admin)
- [ ] Verify data integrity in Supabase
- [ ] Performance testing
- [ ] Create checkpoint with Supabase configuration
- [ ] Deploy to production
- [ ] Monitor Supabase dashboard for issues
- [ ] Keep TiDB backup for rollback (if needed)



## Badge Visual Enhancements
- [x] Redesign badges with gold gradient (like medals/trophies) - REVERTED
- [ ] Redesign badges to match Learning Progress Achievements style (simple, clean)
- [ ] Use icon + name + description layout
- [ ] Apply subtle colors instead of gold gradient
- [ ] Make badges responsive on mobile
- [ ] Test badge display on dashboard



## Header Navigation Redesign
- [x] Build professional header navigation with icons + text - CHANGED TO SIDEBAR
- [ ] Build professional sidebar navigation (left side)
- [ ] Add navigation items: Dashboard, Learning Progress, Practice Vocabulary, View All Words
- [ ] Make sidebar responsive (collapsible on mobile)
- [ ] Highlight active navigation links
- [ ] Add user info at bottom of sidebar
- [ ] Modern design with hover effects
- [ ] Test sidebar on desktop and mobile



## Apply Sidebar to All Pages
- [ ] Add Sidebar to Progress.tsx
- [ ] Add Sidebar to Vocabulary.tsx
- [ ] Add Sidebar to VocabularyList.tsx
- [ ] Add Sidebar to WeekView.tsx
- [ ] Add Sidebar to UnitView.tsx
- [ ] Add Sidebar to Chat.tsx
- [ ] Test navigation consistency across all pages



## Pricing Offer Cards on Landing Page
- [x] Design 3 pricing cards (Intensive €39, Balanced €69, Relaxed €119)
- [x] Add pricing details (duration, units per week, features)
- [x] Style "Balanced" as "Most Popular" (highlighted)
- [x] Add "Choose Plan" buttons (disabled during beta)
- [x] Add "Available after launch" hint on disabled buttons
- [x] Create full-width beta tester banner below pricing cards
- [x] Beta banner: Gold/yellow background with 50% OFF message
- [x] Beta banner: Free Units 1-5 + 50% discount at launch
- [x] Test pricing cards on desktop and mobile



## Beta Registration Form Scroll Fix
- [x] Add id="beta-registration" to beta registration form section
- [x] Test "Register for Beta Test" button scroll behavior



## Feedback Page for Dashboard Users
- [x] Create Feedback.tsx page with form component
- [x] Add form fields: Type, Title, Description
- [x] Add "Help us make our software better" message
- [x] Add Sidebar to Feedback page
- [x] Use existing tRPC feedback.submit mutation
- [x] Add "Send Feedback" link to Sidebar navigation
- [x] Add routing for /feedback in App.tsx
- [x] Test feedback form submission
- [x] Test navigation to feedback page

## Feedback Form Validation Fix
- [x] Reduce title minimum length from 5 to 3 characters

## Feedback Email Notifications
- [x] Send confirmation email to user when feedback is submitted
- [x] Send admin notification email when new feedback is received
- [x] Create feedback confirmation email template
- [x] Create feedback admin notification email template
- [x] Add feedback history section to Feedback page (show user's previous submissions)
- [ ] Test email notifications for feedback submissions




## Admin Header Navigation
- [x] Create AdminHeader component with navigation links
- [x] Add links: User Management, Feedback Management, Beta Registrations
- [x] Display admin header only for Superadmin and Admin roles
- [x] Style header to match dashboard design
- [x] Add to Dashboard and other pages

## Role-Based Access Control for Admin
- [x] Superadmin: Full access (view, edit, delete, activate users)
- [x] Admin: Read-only access (view only, no edit/delete buttons)
- [x] Hide edit/delete buttons for Admin role on User Management page
- [x] Hide status update buttons for Admin role on Feedback page
- [x] Hide approve/reject buttons for Admin role on Beta Registrations page
- [x] Show "Read-Only Mode" indicator for Admin users
- [ ] Backend: Restrict mutations to Superadmin only




## AdminHeader Layout Fix
- [x] Position AdminHeader navigation links to the right side
- [x] Prevent AdminHeader from overlapping dashboard content
- [x] Ensure admin role indicator stays visible

