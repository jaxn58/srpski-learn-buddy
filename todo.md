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


