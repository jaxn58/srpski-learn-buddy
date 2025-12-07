# Multi-Language Support Implementation Plan

## 🎯 Zielsetzung

Erweiterung der Serbian AI Tutor App um mehrsprachige Unterstützung. Aktuell: Englisch → Serbisch. Geplant: Deutsch → Serbisch (später: Spanisch, Französisch, etc.)

**Kernkonzept:** Jeder User wird bei der Registrierung einer Lernsprache zugewiesen und behält diese dauerhaft.

---

## 📊 Aktuelle Situation

### Bestehende Infrastruktur
- ✅ **i18next bereits implementiert** (nur Englisch)
- ✅ **User Schema vorhanden** in Convex
- ✅ **Vokabeldatenbank** mit 507 Wörtern (nur Englisch)
- ✅ **27 Units** vollständig strukturiert
- ⚠️ **`uiLanguage` Feld** existiert bereits (Zeile 31 in `convex/schema.ts`), wird aber nicht genutzt

### Herausforderungen
- 507 Vokabeln müssen übersetzt werden
- UI-Texte (~90 Strings) müssen übersetzt werden
- Learn Buddy Chat muss sprachspezifisch werden
- Separate Landing Pages pro Sprache
- Content in `weeks.ts` ist bereits teilweise gemischt (DE/EN)

---

## ✅ Empfohlene Lösung: Language-Scoped Users

### Warum dieser Ansatz?

**Pro:**
1. ✅ Klarere User Experience (keine Sprachverwirrung)
2. ✅ Einfachere Datenstruktur
3. ✅ Besseres Marketing (separate Domains/Landing Pages)
4. ✅ Getrennte Analytics pro Sprache
5. ✅ Einfach zu skalieren (neue Sprache = neues Sign-Up)
6. ✅ Kein Language-Toggle nötig
7. ✅ Content bleibt DRY (ein Vocabulary-File für alle Sprachen)

**Contra:**
- User kann Sprache nicht wechseln (Feature, kein Bug!)
- Initiale Übersetzungsarbeit erforderlich

---

## 🏗️ Architektur-Änderungen

### 1. Schema-Änderungen

#### `convex/schema.ts`

**User Table erweitern:**

```typescript
users: defineTable({
  clerkId: v.string(),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  loginMethod: v.optional(v.string()),
  role: v.union(v.literal("superadmin"), v.literal("admin"), v.literal("student")),
  
  // NEW: User's learning language (UI version they signed up for)
  learningLanguage: v.union(
    v.literal("en"), // English → Serbian
    v.literal("de"), // Deutsch → Serbisch
    v.literal("es"), // Español → Serbio (future)
    v.literal("fr")  // Français → Serbe (future)
  ),
  
  isActive: v.boolean(),
  isBetaTester: v.boolean(),
  totalXP: v.number(),
  level: v.number(),
  currentStreak: v.number(),
  longestStreak: v.number(),
  lastActiveDate: v.optional(v.number()),
})
.index("by_clerk_id", ["clerkId"])
.index("by_email", ["email"])
.index("by_language", ["learningLanguage"]), // NEW: Query by language
```

**Optional: userProgress.uiLanguage entfernen** (redundant mit users.learningLanguage)

---

### 2. Vokabel-Datenstruktur

#### `shared/data/vocabulary/words.ts`

**Neue Structure:**

```typescript
export type VocabWord = {
  serbian: string;
  translations: {
    en: string;
    de: string;
    es?: string;  // Optional für zukünftige Sprachen
    fr?: string;
  };
  alternatives?: {
    en?: string[];
    de?: string[];
    es?: string[];
    fr?: string[];
  };
  unit: number;
};

// Beispiele:
export const VOCABULARY: VocabWord[] = [
  // Unit 1
  { 
    serbian: "aerodrom", 
    translations: {
      en: "airport",
      de: "Flughafen"
    },
    unit: 1 
  },
  { 
    serbian: "pasoš", 
    translations: {
      en: "passport",
      de: "Reisepass"
    },
    unit: 1 
  },
  { 
    serbian: "hvala", 
    translations: {
      en: "thank you",
      de: "danke"
    },
    unit: 1 
  },
  { 
    serbian: "molim", 
    translations: {
      en: "please",
      de: "bitte"
    },
    alternatives: {
      en: ["you're welcome"],
      de: ["gern geschehen"]
    },
    unit: 1 
  },
  // ... 503 weitere Wörter
];
```

**Migration Helper Function:**

```typescript
// shared/data/vocabulary/helpers.ts

export function getTranslation(
  word: VocabWord, 
  language: "en" | "de" | "es" | "fr"
): string {
  return word.translations[language] || word.translations.en;
}

export function getAlternatives(
  word: VocabWord,
  language: "en" | "de" | "es" | "fr"
): string[] {
  return word.alternatives?.[language] || [];
}
```

---

### 3. User Registration Flow

#### `convex/users.ts` - syncUser erweitern

```typescript
export const syncUser = mutation({
  args: {
    // NEW: Accept language parameter from sign-up
    learningLanguage: v.optional(v.union(
      v.literal("en"),
      v.literal("de"),
      v.literal("es"),
      v.literal("fr")
    ))
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastActiveDate: Date.now(),
      });
      return existing._id;
    }

    // NEW: Get language from registration (default: en)
    const userLanguage = args.learningLanguage || "en";

    // Determine beta status
    const betaMode = process.env.BETA_MODE === "on" || process.env.BETA_MODE === "true";
    const betaEnd = process.env.BETA_END_DATE ? Date.parse(process.env.BETA_END_DATE) : undefined;
    const now = Date.now();
    const shouldBeBetaTester = betaMode && (!betaEnd || now <= betaEnd);

    // Create new user with language preference
    const userId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      name: identity.name ?? undefined,
      email: identity.email ?? undefined,
      loginMethod: "clerk",
      role: "student",
      learningLanguage: userLanguage, // ← SET LANGUAGE HERE
      isActive: true,
      isBetaTester: shouldBeBetaTester,
      totalXP: 0,
      level: 1,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: Date.now(),
    });

    // Create initial user progress
    await ctx.db.insert("userProgress", {
      userId,
      currentWeek: 1,
      currentUnit: 1,
      completedUnits: [],
      learningDuration: 12,
      uiLanguage: userLanguage, // Keep for backward compatibility or remove
    });

    return userId;
  },
});
```

---

### 4. Separate Landing Pages

#### URL-Struktur

```
serbiantutor.com          → Redirect to /en (default)
serbiantutor.com/en       → English Version
serbiantutor.com/de       → Deutsche Version
serbiantutor.de           → Alternative Domain → Deutsche Version (future)
serbiantutor.com/es       → Spanish Version (future)
serbiantutor.com/fr       → French Version (future)
```

#### Implementation

**Option A: Query Parameter (einfacher)**

```typescript
// client/src/pages/Home.tsx

const Home = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const lang = urlParams.get('lang') as 'en' | 'de' || 'en';
  
  // Set i18n language
  useEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang]);

  // On Sign Up, pass language
  const handleSignUp = () => {
    clerk.redirectToSignUp({
      redirectUrl: `/register?lang=${lang}`,
    });
  };
  
  return (
    <div>
      {/* Content based on lang */}
    </div>
  );
};
```

**Option B: Separate Routes (cleaner)**

```typescript
// client/src/main.tsx

<Route path="/" component={Home_EN} />
<Route path="/en" component={Home_EN} />
<Route path="/de" component={Home_DE} />
<Route path="/es" component={Home_ES} />
```

**Option C: Dynamic Route mit i18n (beste Lösung)**

```typescript
// client/src/App.tsx

<Route path="/:lang?" component={Home} />

// In Home.tsx:
const { lang = 'en' } = useParams();
```

---

### 5. Frontend: Vokabeln basierend auf User-Sprache anzeigen

#### `client/src/pages/Vocabulary.tsx`

```typescript
import { useAuth } from "@/_core/hooks/useAuth";
import { VOCABULARY } from "@shared/data";
import { getTranslation } from "@shared/data/vocabulary/helpers";

export default function Vocabulary() {
  const { user } = useAuth();
  const userLang = user?.learningLanguage || "en";

  const filteredVocab = useMemo(() => {
    // ... existing filter logic ...
    return filtered;
  }, [selectedUnit, accessInfo]);

  return (
    <Card>
      <CardContent>
        {/* Serbian Word */}
        <div className="text-3xl font-bold text-center">
          {currentWord.serbian}
        </div>
        
        {/* Translation in User's Language */}
        {showAnswer && (
          <div className="text-xl text-muted-foreground text-center">
            {getTranslation(currentWord, userLang)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

#### Quiz Mode - Antworten prüfen

```typescript
const checkAnswer = () => {
  const userInput = userAnswer.trim().toLowerCase();
  const correctAnswer = getTranslation(currentWord, userLang).toLowerCase();
  const alternatives = getAlternatives(currentWord, userLang).map(a => a.toLowerCase());
  
  const isCorrect = 
    userInput === correctAnswer || 
    alternatives.includes(userInput);
  
  setIsCorrect(isCorrect);
  // ... rest of logic
};
```

---

### 6. i18n Erweiterung

#### `client/src/i18n.ts`

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Existing English translations (90+ strings)
      "app.title": "Serbian AI Tutor",
      "home.hero.title": "Learn Serbian with your",
      "home.hero.titleHighlight": "personal AI Learn Buddy",
      // ... all existing strings
    }
  },
  de: {
    translation: {
      // NEW: German translations
      "app.title": "Serbisch AI Tutor",
      "home.hero.title": "Lerne Serbisch mit deinem",
      "home.hero.titleHighlight": "persönlichen KI Lernbuddy",
      "home.hero.subtitle": "Ein strukturierter Kurs basierend auf „Step by Step Serbian 1" – mit interaktiven Übungen, Vokabeltraining und intelligentem Konversationstraining.",
      "home.cta.start": "Jetzt starten",
      "home.cta.learnMore": "Mehr erfahren",
      
      "features.structuredPlan.title": "Strukturierter Plan",
      "features.structuredPlan.desc": "Strukturierter Lernpfad durch alle 27 Lektionen des Kursbuchs",
      "features.aiProfessor.title": "KI Lernbuddy",
      "features.aiProfessor.desc": "Dein persönlicher Tutor erklärt Grammatik, korrigiert Fehler und motiviert dich",
      "features.conversation.title": "Konversationstraining",
      "features.conversation.desc": "Übe echte Gespräche auf Serbisch mit sofortigem Feedback",
      "features.progress.title": "Fortschrittsverfolgung",
      "features.progress.desc": "Sieh deine Erfolge und bleib motiviert mit klaren Meilensteinen",
      
      "dashboard.welcome": "Willkommen zurück, {{name}}!",
      "dashboard.weekProgress": "Du bist in Woche {{current}} von {{total}}. Weiter so!",
      "dashboard.totalProgress": "Gesamtfortschritt",
      "dashboard.currentWeek": "Aktuelle Woche",
      "dashboard.currentLesson": "Aktuelle Lektion",
      "dashboard.completed": "abgeschlossen",
      "dashboard.continueLesson": "Aktuelle Lektion fortsetzen",
      "dashboard.chatWithProfessor": "KI Lernbuddy",
      "dashboard.chatDesc": "Erhalte Erklärungen und Beispiele aus dem Kursmaterial",
      "dashboard.openChat": "Chat öffnen",
      
      "unit.backToDashboard": "Zurück zum Dashboard",
      "unit.completed": "Abgeschlossen",
      "unit.topics": "Themen in dieser Lektion",
      "unit.grammarFocus": "Grammatik-Fokus",
      "unit.vocabulary": "Vokabelbereiche",
      "unit.practiceVocab": "Vokabeln üben",
      "unit.markComplete": "Lektion als abgeschlossen markieren",
      
      "chat.title": "KI Lernbuddy",
      "chat.subtitle": "Erhalte Hilfe mit Kursinhalten",
      "chat.description": "Stelle Fragen zu Grammatik, Vokabeln und erhalte Beispiele aus den Lektionen",
      "chat.noMessages": "Noch keine Nachrichten. Starte eine Unterhaltung!",
      "chat.typing": "Tutor schreibt...",
      "chat.placeholder": "Schreibe eine Nachricht...",
      
      // ... weitere 60+ Strings
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // Default
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
```

#### Auto-Switching basierend auf User

```typescript
// client/src/App.tsx oder Layout

const { user } = useAuth();

useEffect(() => {
  if (user?.learningLanguage) {
    i18n.changeLanguage(user.learningLanguage);
  }
}, [user]);
```

---

### 7. Learn Buddy Chat - Sprachspezifisch

#### `server/_core/llm.ts` oder Chat-Handler

```typescript
// Beim Chat-Request User-Sprache berücksichtigen

const generateChatResponse = async (
  userMessage: string,
  userId: string,
  unitContext?: number
) => {
  // Get user from database
  const user = await ctx.db.get(userId);
  const userLang = user.learningLanguage || "en";
  
  // Language-specific system prompts
  const systemPrompts = {
    en: `You are a friendly Serbian tutor for English-speaking learners.
         Explain grammar in English, but use Serbian examples.
         The course material is based on "Step by Step Serbian 1".
         Be encouraging and patient. Use simple language.`,
         
    de: `Du bist ein freundlicher Serbisch-Tutor für deutschsprachige Lernende.
         Erkläre Grammatik auf Deutsch, aber verwende auch serbische Beispiele.
         Das Kursmaterial basiert auf "Step by Step Serbian 1".
         Sei ermutigend und geduldig. Verwende einfache Sprache.`,
         
    es: `Eres un tutor amigable de serbio para estudiantes de habla hispana.
         Explica la gramática en español, pero usa ejemplos en serbio.
         El material del curso se basa en "Step by Step Serbian 1".`,
         
    fr: `Tu es un tuteur serbe sympathique pour les apprenants francophones.
         Explique la grammaire en français, mais utilise des exemples serbes.
         Le matériel de cours est basé sur "Step by Step Serbian 1".`
  };
  
  const systemPrompt = systemPrompts[userLang];
  
  // If unit context provided, add unit-specific instructions
  if (unitContext) {
    const unitInfo = COURSE_UNITS.find(u => u.number === unitContext);
    const unitDescription = userLang === "de" 
      ? `Die aktuelle Lektion ist Unit ${unitContext}: "${unitInfo?.title}" (${unitInfo?.titleEnglish}). 
         Fokus: ${unitInfo?.grammarFocus.join(", ")}`
      : `The current unit is Unit ${unitContext}: "${unitInfo?.titleEnglish}". 
         Focus: ${unitInfo?.grammarFocus.join(", ")}`;
    
    systemPrompt += `\n\n${unitDescription}`;
  }
  
  // Call LLM with language-specific prompt
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ]
  });
  
  return response.choices[0].message.content;
};
```

---

## 🔄 Migration Plan

### Phase 1: Schema & Backend (Tag 1)

**1.1 Schema Migration**
- [ ] `convex/schema.ts` erweitern mit `learningLanguage`
- [ ] Index `by_language` hinzufügen
- [ ] Migration Script für existierende User (default: "en")

**1.2 User Sync anpassen**
- [ ] `convex/users.ts` - `syncUser` erweitern
- [ ] Language-Parameter akzeptieren
- [ ] Tests für verschiedene Sprachen

**1.3 Queries anpassen**
- [ ] Alle User-Queries überprüfen
- [ ] `learningLanguage` in Response inkludieren

---

### Phase 2: Vokabel-Datenstruktur (Tag 1-2)

**2.1 TypeScript Types aktualisieren**
- [ ] `VocabWord` Type erweitern
- [ ] Helper Functions erstellen
- [ ] Backward compatibility sicherstellen

**2.2 Deutsche Übersetzungen hinzufügen**
- [ ] Unit 1-10 übersetzen (177 Wörter)
- [ ] Unit 11-20 übersetzen (218 Wörter)
- [ ] Unit 21-27 übersetzen (112 Wörter)
- [ ] Quality Check: Alternatives prüfen

**Tools zum schnellen Übersetzen:**
- ChatGPT/Claude mit Context
- DeepL für Qualität
- Manuelles Review für Kontext

---

### Phase 3: Frontend Anpassungen (Tag 2-3)

**3.1 Vocabulary Practice**
- [ ] `pages/Vocabulary.tsx` - `getTranslation()` verwenden
- [ ] Quiz Mode - Mehrsprachige Antworten
- [ ] Learn Mode - Korrekte Sprache anzeigen

**3.2 Vocabulary List**
- [ ] `pages/VocabularyList.tsx` anpassen
- [ ] Sprachbasierte Anzeige

**3.3 Dashboard & Unit Views**
- [ ] Unit-Beschreibungen mehrsprachig?
- [ ] Oder nur UI-Texte mehrsprachig?

---

### Phase 4: i18n Integration (Tag 3)

**4.1 Deutsche UI-Strings**
- [ ] Home Page (~15 Strings)
- [ ] Dashboard (~10 Strings)
- [ ] Units/Exercises (~20 Strings)
- [ ] Chat (~10 Strings)
- [ ] Settings/Profile (~10 Strings)
- [ ] Common/Navigation (~15 Strings)
- [ ] Feedback/Errors (~10 Strings)

**4.2 Auto-Language-Switching**
- [ ] App.tsx: Detect user language
- [ ] Automatic i18n.changeLanguage()
- [ ] Fallback auf "en"

---

### Phase 5: Landing Pages (Tag 4)

**5.1 Deutsche Landing Page**
- [ ] `/de` Route erstellen
- [ ] Content übersetzen
- [ ] SEO Meta Tags (de)
- [ ] Hreflang Tags

**5.2 Registration Flow**
- [ ] Language parameter in URL
- [ ] Clerk Sign-Up mit Language
- [ ] Redirect nach Registration

**5.3 Domain (Optional)**
- [ ] `serbischlernen.de` Domain kaufen
- [ ] DNS Setup
- [ ] Redirect zu `/de`

---

### Phase 6: Learn Buddy Chat (Tag 4-5)

**6.1 System Prompts**
- [ ] Deutsche System Prompts schreiben
- [ ] Context-Aware Prompts
- [ ] Unit-spezifische Prompts

**6.2 Chat Handler**
- [ ] Language Detection
- [ ] Prompt Selection
- [ ] Response in korrekter Sprache

**6.3 Testing**
- [ ] Deutsche Fragen testen
- [ ] Grammatik-Erklärungen testen
- [ ] Vokabel-Fragen testen

---

### Phase 7: Testing & QA (Tag 5)

**7.1 User Flows**
- [ ] Registration EN
- [ ] Registration DE
- [ ] Vocabulary Practice EN/DE
- [ ] Quiz Mode EN/DE
- [ ] Chat EN/DE

**7.2 Edge Cases**
- [ ] User ohne Sprache (Migration)
- [ ] Fehlende Übersetzungen
- [ ] Fallback auf Englisch

**7.3 Performance**
- [ ] Keine Performance-Einbußen
- [ ] Lazy Loading für Übersetzungen?

---

## 📝 Content-Erstellung: Deutsche Vokabeln

### Automatisierte Übersetzung mit AI

**Script-Vorschlag:**

```typescript
// scripts/translate-vocabulary.ts

import { VOCABULARY } from "../shared/data/vocabulary/words";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function translateVocabulary() {
  const updatedVocab = [];
  
  // Batch processing (10 words at a time for context)
  for (let i = 0; i < VOCABULARY.length; i += 10) {
    const batch = VOCABULARY.slice(i, i + 10);
    
    const prompt = `Übersetze folgende serbische Vokabeln ins Deutsche. 
    Achte auf Kontext und gib idiomatische Übersetzungen.
    
    Format: JSON Array mit { serbian, english, german, alternatives_de }
    
    Vokabeln:
    ${batch.map(w => `- ${w.serbian}: ${w.english}`).join('\n')}`;
    
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }]
    });
    
    const translations = JSON.parse(response.content[0].text);
    updatedVocab.push(...translations);
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Write to new file
  fs.writeFileSync(
    'shared/data/vocabulary/words-multilang.ts',
    `export const VOCABULARY_MULTILANG = ${JSON.stringify(updatedVocab, null, 2)}`
  );
}

translateVocabulary();
```

### Manuelle Review-Liste

**Prioritäten für manuelle Überprüfung:**

1. **Greetings & Basic Phrases** (Unit 1) - Kritisch
2. **Numbers & Time** (Units 2, 6, 7) - Wichtig
3. **Food & Restaurant** (Units 3, 8) - Alltagsrelevant
4. **Directions & City** (Unit 4) - Praktisch
5. **Family & People** (Units 10, 11) - Persönlich
6. **Rest** - AI-Übersetzung OK mit Stichproben

---

## 🌍 SEO & Marketing

### Landing Page Optimierung

**Deutsche Keywords:**
- Serbisch lernen
- Serbisch Kurs
- Serbisch für Anfänger
- Serbisch Vokabeln
- Step by Step Serbian auf Deutsch
- Serbisch AI Tutor
- Serbisch Sprachkurs online

**Meta Tags:**

```html
<!-- /de -->
<html lang="de">
<head>
  <title>Serbisch lernen mit KI Tutor | Step by Step Serbian auf Deutsch</title>
  <meta name="description" content="Lerne Serbisch strukturiert mit deinem persönlichen KI Lernbuddy. Basierend auf dem Kursbuch Step by Step Serbian 1. Vokabeln, Grammatik, Konversation." />
  <link rel="alternate" hreflang="en" href="https://serbiantutor.com/en" />
  <link rel="alternate" hreflang="de" href="https://serbiantutor.com/de" />
  <link rel="alternate" hreflang="x-default" href="https://serbiantutor.com" />
</head>
```

### Domain-Strategie

**Option A: Subdomain**
- `de.serbiantutor.com`
- `en.serbiantutor.com`

**Option B: Path (Empfohlen)**
- `serbiantutor.com/de`
- `serbiantutor.com/en`

**Option C: Separate Domains**
- `serbischlernen.de` → Deutsche Version
- `serbiantutor.com` → Englische Version
- **Vorteil:** Lokale Brand, besseres SEO
- **Nachteil:** Mehr Maintenance

---

## 📊 Analytics & Tracking

### Sprach-spezifische Metriken

**Convex Queries erweitern:**

```typescript
// convex/admin.ts

export const getUsersByLanguage = query({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    
    const byLanguage = {
      en: users.filter(u => u.learningLanguage === "en").length,
      de: users.filter(u => u.learningLanguage === "de").length,
      es: users.filter(u => u.learningLanguage === "es").length,
      fr: users.filter(u => u.learningLanguage === "fr").length,
    };
    
    return byLanguage;
  }
});

export const getSubscriptionsByLanguage = query({
  handler: async (ctx) => {
    const subs = await ctx.db.query("userSubscriptions")
      .filter(q => q.eq(q.field("status"), "active"))
      .collect();
    
    const users = await ctx.db.query("users").collect();
    const userMap = new Map(users.map(u => [u._id, u.learningLanguage]));
    
    const byLanguage = {
      en: { count: 0, revenue: 0 },
      de: { count: 0, revenue: 0 },
    };
    
    subs.forEach(sub => {
      const lang = userMap.get(sub.userId) || "en";
      byLanguage[lang].count++;
      byLanguage[lang].revenue += sub.planPrice;
    });
    
    return byLanguage;
  }
});
```

**Google Analytics Events:**

```typescript
// Track language on sign-up
gtag('event', 'sign_up', {
  method: 'clerk',
  language: userLanguage
});

// Track vocabulary practice by language
gtag('event', 'vocabulary_practice', {
  language: user.learningLanguage,
  unit: selectedUnit
});
```

---

## 🚀 Rollout-Strategie

### Soft Launch (Woche 1)

1. **Tag 1-2:** Schema Migration + Backend
2. **Tag 3-4:** Vokabel-Übersetzungen + Frontend
3. **Tag 5:** Deutsche Landing Page (Beta)
4. **Tag 6-7:** Testing mit Beta-Usern

### Public Launch (Woche 2)

1. **Announce auf deutscher Zielgruppe:**
   - Reddit: r/German, r/languagelearning
   - Facebook: Deutsch-lernen Gruppen
   - Montenegro Expat Groups
   
2. **Content Marketing:**
   - Blog: "Serbisch lernen für Deutsche"
   - YouTube: Demo-Video auf Deutsch
   - TikTok: Kurze Serbisch-Tipps auf Deutsch

3. **Email Campaign:**
   - Beta-Tester informieren
   - Deutsche Version ankündigen

---

## 🔮 Zukunft: Weitere Sprachen

### Spanisch (Q2 2025)

- Große Zielgruppe
- Ähnliche Struktur wie Deutsch
- Übersetzungsaufwand: ~3 Tage

### Französisch (Q3 2025)

- Europäische Zielgruppe
- Montenegro hat französische Touristen
- Übersetzungsaufwand: ~3 Tage

### Implementierung neuer Sprachen

**Prozess (1 Woche):**

1. ✅ 507 Vokabeln übersetzen (Tag 1-2)
2. ✅ UI-Strings übersetzen (Tag 3)
3. ✅ Landing Page erstellen (Tag 4)
4. ✅ Learn Buddy Prompt anpassen (Tag 5)
5. ✅ Testing (Tag 6-7)

**Kein Code-Change nötig** - nur Content!

---

## ⚠️ Wichtige Entscheidungen

### 1. Können User ihre Sprache wechseln?

**Empfehlung: NEIN**

**Pro:**
- Einfachere Implementierung
- Klarere User Experience
- Verhindert Verwirrung
- Bessere Analytics

**Contra:**
- User muss neuen Account erstellen

**Kompromiss:**
- Superadmin kann User-Sprache ändern (Support-Funktion)
- Oder: "Request Language Change" Feature mit Manual Review

### 2. Sind Unit-Descriptions auch mehrsprachig?

**Aktuell in `shared/data/course/units.ts`:**

```typescript
{
  number: 1,
  title: "Na aerodromu",  // Serbisch
  titleEnglish: "At the airport",  // Englisch
  topics: ["Greetings...", "Gender..."],  // Englisch
  grammarFocus: ["Verb 'biti'..."],  // Englisch
}
```

**Option A: Nur Vokabeln mehrsprachig** (Empfohlen für MVP)
- Unit-Descriptions bleiben Englisch
- Reduziert Übersetzungsaufwand massiv
- Fokus auf Vokabeltraining

**Option B: Vollständig mehrsprachig**
- `titleGerman`, `topicsGerman`, `grammarFocusGerman`
- Mehr Arbeit, aber konsistenter

**Empfehlung:** Start mit **Option A**, später erweitern

### 3. Separate Domain oder Path?

**Path (Empfohlen):**
- `serbiantutor.com/de`
- Einfacher zu managen
- Shared Auth
- Ein Deployment

**Separate Domain:**
- `serbischlernen.de`
- Besseres lokales SEO
- Eigenständige Brand
- Mehr Aufwand

---

## 📋 Checkliste: Ready to Start

### Vorbereitung

- [ ] Backup der Datenbank
- [ ] Git Branch erstellen: `feature/multi-language`
- [ ] Testing-User Account vorbereiten (EN + DE)

### Environment Variables

```env
# .env.local
BETA_MODE=on
DEFAULT_LANGUAGE=en
SUPPORTED_LANGUAGES=en,de
```

### Dependencies

```bash
# Falls zusätzliche i18n-Tools gebraucht werden
pnpm add i18next-browser-languagedetector
pnpm add i18next-http-backend  # Falls Translations extern geladen
```

---

## 🎯 Success Metrics

### KPIs für Deutsche Version

**Nach 1 Monat:**
- [ ] 100+ deutsche Registrierungen
- [ ] 50+ aktive deutsche User
- [ ] 10+ deutsche Subscriptions
- [ ] <5% Bug-Reports für deutsche Version

**Nach 3 Monaten:**
- [ ] 500+ deutsche User
- [ ] 20%+ Conversion Rate (DE)
- [ ] 80%+ User Satisfaction (DE)
- [ ] Feedback für weitere Verbesserungen

---

## 📚 Ressourcen

### Tools
- **DeepL API** - Hochwertige Übersetzungen
- **Anthropic Claude** - Context-aware Übersetzungen
- **i18next** - Frontend Internationalization
- **Google Translate Toolkit** - Batch-Übersetzungen

### Design
- **Flaggen:** nicht verwenden (Sprache ≠ Land)
- **Language Switcher:** Text-basiert ("English", "Deutsch")
- **Icons:** 🌍 für Language Selection

### Testing
- **Browser-Sprachen testen:** de-DE, en-US, en-GB
- **Mobile:** iOS/Android mit verschiedenen Sprachen
- **Accessibility:** Screen Reader auf Deutsch

---

## 🤝 Support & Maintenance

### Wer übersetzt neue Features?

**Option A: Du übersetzt selbst**
- Kontrolle über Qualität
- Zeitaufwand

**Option B: AI-unterstützt**
- Claude/GPT mit Context
- Manuelle Review-Stichproben

**Option C: Community**
- Beta-Tester als Übersetzer
- Gamification: "Translator Badge"

### Bug-Reports mehrsprachig?

```typescript
// Feedback Form - detect language
const feedbackLanguage = user.learningLanguage;

// Show form in user's language
{t('feedback.title')}
{t('feedback.description')}

// But store in database with language tag
await submitFeedback({
  ...feedbackData,
  submittedInLanguage: feedbackLanguage
});
```

---

## ✅ Next Steps

**Bereit zum Starten?**

1. ✅ Dokumentation gelesen
2. ⬜ Schema Migration vorbereiten
3. ⬜ Vokabel-Übersetzungs-Script testen
4. ⬜ Deutsche Landing Page skizzieren
5. ⬜ Git Branch erstellen

**Let's go! 🚀**

---

**Autor:** AI Assistant  
**Datum:** 2025-12-04  
**Version:** 1.0  
**Status:** Ready for Implementation

