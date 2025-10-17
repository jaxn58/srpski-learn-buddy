import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  de: {
    translation: {
      // Navigation & Common
      "app.title": "Serbian AI Tutor",
      "common.back": "Zurück",
      "common.logout": "Abmelden",
      "common.login": "Anmelden",
      "common.loading": "Lädt...",
      "common.save": "Speichern",
      "common.cancel": "Abbrechen",
      
      // Home Page
      "home.hero.title": "Lernen Sie Serbisch mit Ihrem",
      "home.hero.titleHighlight": "persönlichen AI-Professor",
      "home.hero.subtitle": "Ein strukturierter Kurs basierend auf \"Step by Step Serbian 1\" – mit interaktiven Übungen, Vokabeltraining und intelligenter Konversationspraxis.",
      "home.cta.start": "Jetzt starten",
      "home.cta.learnMore": "Mehr erfahren",
      
      // Features
      "features.structuredPlan.title": "Strukturierter Plan",
      "features.structuredPlan.desc": "Strukturierter Lernpfad durch alle 27 Lektionen des Kursbuchs",
      "features.aiProfessor.title": "AI-Professor",
      "features.aiProfessor.desc": "Ihr persönlicher Tutor erklärt Grammatik, korrigiert Fehler und motiviert Sie",
      "features.conversation.title": "Konversationspraxis",
      "features.conversation.desc": "Üben Sie echte Gespräche auf Serbisch mit sofortigem Feedback",
      "features.progress.title": "Fortschrittsverfolgung",
      "features.progress.desc": "Sehen Sie Ihre Erfolge und bleiben Sie motiviert durch klare Meilensteine",
      
      // Course Structure
      "course.structure.title": "Ihr Lernweg",
      "course.month1.title": "Monat 1",
      "course.month1.subtitle": "Die Grundlagen schaffen",
      "course.month2.title": "Monat 2",
      "course.month2.subtitle": "Grammatik vertiefen",
      "course.month3.title": "Monat 3",
      "course.month3.subtitle": "Fortgeschrittene Strukturen",
      
      // Dashboard
      "dashboard.welcome": "Willkommen zurück, {{name}}!",
      "dashboard.weekProgress": "Sie sind in Woche {{current}} von {{total}}. Weiter so!",
      "dashboard.totalProgress": "Gesamtfortschritt",
      "dashboard.currentWeek": "Aktuelle Woche",
      "dashboard.currentLesson": "Aktuelle Lektion",
      "dashboard.completed": "abgeschlossen",
      "dashboard.continueLesson": "Aktuelle Lektion fortsetzen",
      "dashboard.chatWithProfessor": "Mit AI-Professor chatten",
      "dashboard.chatDesc": "Stellen Sie Fragen und üben Sie Konversation",
      "dashboard.openChat": "Chat öffnen",
      "dashboard.lessonsThisWeek": "Lektionen dieser Woche:",
      "dashboard.practiceActivities": "Praxis-Aktivitäten:",
      "dashboard.practiceVocab": "Vokabeln üben",
      "dashboard.viewProgress": "Fortschritt ansehen",
      
      // Unit View
      "unit.backToDashboard": "Zurück zum Dashboard",
      "unit.completed": "Abgeschlossen",
      "unit.topics": "Themen dieser Lektion",
      "unit.grammarFocus": "Grammatik-Schwerpunkte",
      "unit.vocabulary": "Vokabular-Bereiche",
      "unit.activities": "Lernaktivitäten",
      "unit.activitiesDesc": "Nutzen Sie diese Funktionen, um die Lektion zu meistern",
      "unit.chatWithProfessor": "Mit AI-Professor chatten",
      "unit.askQuestions": "Fragen Sie nach Erklärungen",
      "unit.practiceVocab": "Vokabeln üben",
      "unit.learnWords": "Lernen Sie neue Wörter",
      "unit.markComplete": "Lektion als abgeschlossen markieren",
      "unit.studyTips": "Lerntipps",
      
      // Chat
      "chat.title": "AI-Professor Chat",
      "chat.subtitle": "Chatten Sie mit Ihrem Serbisch-Professor",
      "chat.description": "Stellen Sie Fragen zu Grammatik, Vokabeln oder üben Sie Konversation auf Serbisch",
      "chat.noMessages": "Noch keine Nachrichten. Starten Sie ein Gespräch!",
      "chat.examples": "Beispiele:",
      "chat.typing": "Professor tippt...",
      "chat.placeholder": "Schreiben Sie eine Nachricht...",
      
      // Learning Duration
      "duration.select": "Lernplan wählen",
      "duration.3months": "3 Monate",
      "duration.6months": "6 Monate",
      "duration.9months": "9 Monate",
      "duration.12months": "12 Monate",
      "duration.weeks": "{{count}} Wochen",
      
      // Settings
      "settings.language": "Sprache",
      "settings.learningPlan": "Lernplan",
      "settings.changeDuration": "Kursdauer ändern",
    }
  },
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
      "home.hero.titleHighlight": "personal AI Professor",
      "home.hero.subtitle": "A structured course based on \"Step by Step Serbian 1\" – with interactive exercises, vocabulary training, and intelligent conversation practice.",
      "home.cta.start": "Start Now",
      "home.cta.learnMore": "Learn More",
      
      // Features
      "features.structuredPlan.title": "Structured Plan",
      "features.structuredPlan.desc": "Structured learning path through all 27 lessons of the course book",
      "features.aiProfessor.title": "AI Professor",
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
      "dashboard.chatWithProfessor": "Chat with AI Professor",
      "dashboard.chatDesc": "Ask questions and practice conversation",
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
      "unit.chatWithProfessor": "Chat with AI Professor",
      "unit.askQuestions": "Ask for explanations",
      "unit.practiceVocab": "Practice Vocabulary",
      "unit.learnWords": "Learn new words",
      "unit.markComplete": "Mark lesson as completed",
      "unit.studyTips": "Study Tips",
      
      // Chat
      "chat.title": "AI Professor Chat",
      "chat.subtitle": "Chat with your Serbian Professor",
      "chat.description": "Ask questions about grammar, vocabulary, or practice conversation in Serbian",
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
    lng: 'de', // default language
    fallbackLng: 'de',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;

