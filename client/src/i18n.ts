import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Navigation & Common
      "app.title": "Serbian AI Tutor",
      "common.back": "Back",
      "common.logout": "Logout",
      "common.login": "Login",
      "common.loading": "Loading...",
      "common.save": "Save",
      "common.cancel": "Cancel",
      
      // Home Page
      "home.hero.title": "Learn Serbian with your",
      "home.hero.titleHighlight": "personal AI Learn Buddy",
      "home.hero.subtitle": "A structured course based on \"Step by Step Serbian 1\" – with interactive exercises, vocabulary training, and intelligent conversation practice.",
      "home.cta.start": "Start Now",
      "home.cta.learnMore": "Learn More",
      
      // Features
      "features.structuredPlan.title": "Structured Plan",
      "features.structuredPlan.desc": "Structured learning path through all 27 lessons of the course book",
      "features.aiProfessor.title": "AI Learn Buddy",
      "features.aiProfessor.desc": "Your personal tutor explains grammar, corrects mistakes, and motivates you",
      "features.conversation.title": "Conversation Practice",
      "features.conversation.desc": "Practice real conversations in Serbian with instant feedback",
      "features.progress.title": "Progress Tracking",
      "features.progress.desc": "See your achievements and stay motivated with clear milestones",
      
      // Course Structure
      "course.structure.title": "Your Learning Path",
      "course.month1.title": "Month 1",
      "course.month1.subtitle": "Building the Foundation",
      "course.month2.title": "Month 2",
      "course.month2.subtitle": "Deepening Grammar",
      "course.month3.title": "Month 3",
      "course.month3.subtitle": "Advanced Structures",
      
      // Dashboard
      "dashboard.welcome": "Welcome back, {{name}}!",
      "dashboard.weekProgress": "You are in week {{current}} of {{total}}. Keep it up!",
      "dashboard.totalProgress": "Total Progress",
      "dashboard.currentWeek": "Current Week",
      "dashboard.currentLesson": "Current Lesson",
      "dashboard.completed": "completed",
      "dashboard.continueLesson": "Continue Current Lesson",
      "dashboard.chatWithProfessor": "Unit Q&A Helper",
      "dashboard.chatDesc": "Get explanations and examples from course material",
      "dashboard.openChat": "Open Chat",
      "dashboard.lessonsThisWeek": "Lessons this week:",
      "dashboard.practiceActivities": "Practice Activities:",
      "dashboard.practiceVocab": "Practice Vocabulary",
      "dashboard.viewProgress": "View Progress",
      
      // Unit View
      "unit.backToDashboard": "Back to Dashboard",
      "unit.completed": "Completed",
      "unit.topics": "Topics in this Lesson",
      "unit.grammarFocus": "Grammar Focus",
      "unit.vocabulary": "Vocabulary Areas",
      "unit.activities": "Learning Activities",
      "unit.activitiesDesc": "Use these features to master the lesson",
      "unit.chatWithProfessor": "Unit Q&A Helper",
      "unit.askQuestions": "Ask about grammar, vocabulary, and examples",
      "unit.practiceVocab": "Practice Vocabulary",
      "unit.learnWords": "Learn new words",
      "unit.markComplete": "Mark lesson as completed",
      "unit.studyTips": "Study Tips",
      
      // Chat
      "chat.title": "Unit Q&A Helper",
      "chat.subtitle": "Get help with course content",
      "chat.description": "Ask questions about grammar, vocabulary, and get examples from the units",
      "chat.noMessages": "No messages yet. Start a conversation!",
      "chat.examples": "Examples:",
      "chat.typing": "Professor is typing...",
      "chat.placeholder": "Type a message...",
      
      // Learning Duration
      "duration.select": "Choose Learning Plan",
      "duration.3months": "3 Months",
      "duration.6months": "6 Months",
      "duration.9months": "9 Months",
      "duration.12months": "12 Months",
      "duration.weeks": "{{count}} weeks",
      
      // Settings
      "settings.language": "Language",
      "settings.learningPlan": "Learning Plan",
      "settings.changeDuration": "Change Course Duration",
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;

