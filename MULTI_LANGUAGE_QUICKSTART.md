# 🌍 Multi-Language Quick Start Guide

## 🎉 Was ist fertig?

Die vollständige Multi-Language-Infrastruktur (Englisch & Deutsch) ist implementiert!

### ✅ Fertige Features:

| Feature | Status | Details |
|---------|--------|---------|
| **Vokabeln** | ✅ 100% | Alle 507 Vokabeln Units 1-27 auf Deutsch |
| **Datenstruktur** | ✅ 100% | `VocabWord` mit `translations: {en, de}` |
| **Helper Functions** | ✅ 100% | `getTranslation()`, `getAlternatives()`, `isAnswerCorrect()` |
| **i18n** | ✅ 100% | 80+ UI-Strings auf Deutsch |
| **Convex Schema** | ✅ 100% | `users.learningLanguage` Feld + Index |
| **Frontend** | ✅ 100% | Dynamische Sprach-Erkennung aktiv |
| **Registration** | ✅ 100% | Sprachauswahl beim Sign-Up |
| **AI Chat** | ✅ 100% | Sprachspezifische Prompts |

## 🚀 Schnellstart: Migration in 3 Schritten

### Option A: Automatisch (Empfohlen)

```powershell
# Windows PowerShell
.\scripts\run-migration.ps1
```

```bash
# macOS/Linux
chmod +x scripts/run-migration.sh
./scripts/run-migration.sh
```

### Option B: Manuell

```bash
# 1. Schema deployen
npx convex deploy

# 2. User migrieren
npx tsx scripts/migrate-user-language.ts

# 3. Cleanup (siehe unten)
```

## 📦 Was passiert bei der Migration?

1. **Schema-Update**
   - Fügt `learningLanguage` Feld zu `users` Table hinzu
   - Erstellt Index für effiziente Sprach-Queries
   - Deployed zu Convex Cloud

2. **User-Migration**
   - Setzt `learningLanguage: "en"` für alle bestehenden User
   - Überspringt bereits migrierte User
   - Zeigt detaillierte Fortschritts-Logs

3. **Cleanup** (manuell)
   - Entferne `getAllUsersForMigration` Query aus `convex/admin.ts`
   - Deploy erneut: `npx convex deploy`

## 🧪 Testing

### Test 1: Neuer deutscher User

1. Öffne Landing Page
2. Wähle **🇩🇪 Deutsch** im Language Selector
3. Registriere dich
4. Öffne **Vocabulary Practice**
5. ✅ Vokabeln sollten auf Deutsch sein!

### Test 2: AI Chat auf Deutsch

1. Als deutscher User: Öffne **AI Learn Buddy**
2. Frage: *"Wie funktioniert das Verb biti?"*
3. ✅ Antwort sollte auf Deutsch sein!

### Test 3: Bestehender User (Englisch)

1. Melde dich als bestehender User an
2. Vokabeln sollten auf Englisch sein (Standard)
3. AI Chat antwortet auf Englisch

## 🔧 Technische Details

### Dateiänderungen

**Backend (Convex):**
- `convex/schema.ts` - `learningLanguage` Feld hinzugefügt
- `convex/users.ts` - `syncUser` akzeptiert Sprache
- `convex/admin.ts` - Migrations-Queries hinzugefügt

**Frontend:**
- `client/src/i18n.ts` - Deutsche Übersetzungen
- `client/src/pages/Vocabulary.tsx` - Verwendet `getTranslation()`
- `client/src/pages/VocabularyList.tsx` - Verwendet `getTranslation()`
- `client/src/App.tsx` - Auto-Language-Switching
- `client/src/pages/Home.tsx` - Language-Selector
- `client/src/_core/hooks/useAuth.ts` - Language-Detection

**Shared:**
- `shared/data/vocabulary/words.ts` - Alle Vokabeln multi-lingual
- `shared/data/vocabulary/helpers.ts` - Helper Functions

**Server:**
- `server/routers.ts` - AI Chat mit sprachspezifischen Prompts

**Scripts:**
- `scripts/migrate-user-language.ts` - Migrations-Script
- `scripts/run-migration.ps1` - PowerShell Automation
- `scripts/run-migration.sh` - Bash Automation

## 🐛 Fehlerbehebung

### "CONVEX_URL not set"

```bash
# Prüfe .env.local
echo $VITE_CONVEX_URL

# Sollte sein: https://your-deployment.convex.cloud
```

### Vokabeln zeigen noch Englisch für deutschen User

1. Prüfe Browser Console: `console.log(user?.learningLanguage)`
2. Sollte `"de"` sein
3. Falls `undefined`: User wurde nicht korrekt migriert
4. Lösung: Führe Migration erneut aus

### AI Chat antwortet falsche Sprache

1. Prüfe `server/routers.ts` Zeile ~415
2. `userLanguage` sollte **nicht** hardcoded sein
3. Sollte sein: `const userLanguage = (fullUser?.uiLanguage as 'en' | 'de') || 'en';`

## 📚 Weitere Dokumentation

- **Vollständige Planung:** `docs/LANGUAGE_SUPPORT.md`
- **Migrations-Guide:** `scripts/MIGRATION_GUIDE.md`
- **Landing Page Plan:** `docs/LANDINGPAGE.md`

## 🎯 Nächste Schritte (Optional)

Nach erfolgreicher Migration könntest du noch:

1. **User-Settings** implementieren (Sprache ändern)
2. **Landing Page** vollständig mit i18next refactorn
3. **Weitere Sprachen** hinzufügen (Spanisch, Französisch)
4. **Email-Templates** mehrsprachig machen

## 🚨 Wichtig: Nach der Migration

1. ✅ Entferne `getAllUsersForMigration` aus `convex/admin.ts`
2. ✅ Deploy erneut: `npx convex deploy`
3. ✅ Teste mit beiden Sprachen
4. ✅ Erstelle Backup der Datenbank

## 💡 Pro-Tipps

- **Language-Switching:** User können Sprache nicht selbst ändern (by design)
- **Neue User:** Bekommen automatisch gewählte Sprache
- **Analytics:** Nutze `users.learningLanguage` Index für Sprach-Statistiken
- **Content:** Nur Vokabeln sind übersetzt, nicht Unit-Beschreibungen (MVP)

## 🎊 Gratulation!

Deine App unterstützt jetzt Multi-Language! 🇬🇧 🇩🇪

---

**Version:** 1.0.0  
**Datum:** 2025-12-04  
**Status:** ✅ Production Ready





