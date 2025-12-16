# 🌍 Multi-Language Migration Guide

## Übersicht

Diese Anleitung erklärt, wie du die Multi-Language-Funktionalität für bestehende User in deiner Datenbank aktivierst.

## Was wurde implementiert?

✅ **Alle 507 Vokabeln** ins Deutsche übersetzt  
✅ **i18n** mit deutschen UI-Strings  
✅ **Convex Schema** mit `learningLanguage` Feld erweitert  
✅ **Frontend** nutzt dynamische Sprach-Erkennung  
✅ **Registration** erfasst Sprachauswahl  
✅ **AI Chat** verwendet sprachspezifische Prompts  

## Migration durchführen

### Schritt 1: Convex Schema deployen

Das neue Schema mit `learningLanguage` Feld muss zuerst deployed werden:

```bash
# Stelle sicher, dass Convex läuft
npx convex dev

# In einem neuen Terminal:
npx convex deploy
```

**Wichtig:** Warte, bis das Deployment abgeschlossen ist!

### Schritt 2: Bestehende User migrieren

Jetzt müssen alle bestehenden User das neue `learningLanguage` Feld bekommen (Standard: "en"):

```bash
# Stelle sicher, dass du die richtige CONVEX_URL in .env.local hast
npx tsx scripts/migrate-user-language.ts
```

**Was passiert:**
- Das Script liest alle User aus der Datenbank
- Setzt `learningLanguage: "en"` für jeden User ohne dieses Feld
- Überspringt User, die bereits migriert wurden
- Zeigt eine Zusammenfassung am Ende

**Erwartete Ausgabe:**
```
🚀 Starting migration: Adding learningLanguage to existing users...

📊 Fetching all users from database...
📦 Found 15 users to migrate.

🔄 Migrating user: John Doe
   Setting learningLanguage to: en
✅ Successfully migrated user John Doe

...

============================================================
📊 MIGRATION SUMMARY
============================================================
✅ Successfully migrated: 15 users
⏭️  Skipped (already migrated): 0 users
❌ Errors: 0 users
📦 Total users: 15
============================================================

✨ Migration completed successfully!
```

### Schritt 3: Migrations-Query entfernen (Sicherheit)

Nach erfolgreicher Migration solltest du die temporäre Query entfernen:

```typescript
// In convex/admin.ts - LÖSCHE diese Zeilen:
export const getAllUsersForMigration = query({
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});
```

Dann nochmal deployen:
```bash
npx convex deploy
```

### Schritt 4: Testen

1. **Neuer User registrieren:**
   - Gehe zur Landing Page
   - Wähle "🇩🇪 Deutsch" im Language Selector
   - Registriere dich
   - Prüfe im Dashboard: Vokabeln sollten auf Deutsch sein

2. **Bestehender User:**
   - Melde dich an
   - Vokabeln sollten auf Englisch sein (Standard)
   - Optional: Ändere Sprache in den User-Settings (wenn implementiert)

3. **AI Chat testen:**
   - Öffne den Learn Buddy Chat
   - Frage: "Wie funktioniert das Verb biti?"
   - Deutscher User → Antwort auf Deutsch
   - Englischer User → Antwort auf Englisch

## Fehlerbehebung

### "CONVEX_URL environment variable not set"

Lösung:
```bash
# Prüfe .env.local
cat .env.local | grep CONVEX_URL

# Sollte enthalten:
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

### "Unauthorized" Error beim Fetching

Das `getAllUsersForMigration` Query hat **keine** Auth-Prüfung (absichtlich für Migration).  
Wenn dieser Fehler auftritt, stelle sicher, dass das Schema deployed wurde.

### Schema-Fehler: "learningLanguage is required"

Lösung: Das neue Feld ist **nicht** optional in der Schema-Definition.  
Stelle sicher, dass die Migration **nach** dem Schema-Deployment läuft.

## Manuelle User-Sprache ändern

Falls du die Sprache eines bestehenden Users manuell ändern möchtest:

```typescript
// In Convex Dashboard Console oder einem Script:
await ctx.db.patch(userId, {
  learningLanguage: "de" // oder "en", "es", "fr"
});
```

## Rollback (falls nötig)

Falls etwas schiefgeht:

1. **Schema Rollback:**
   ```bash
   # Gehe zurück zum vorherigen Schema (ohne learningLanguage)
   git checkout HEAD^ convex/schema.ts
   npx convex deploy
   ```

2. **Frontend Rollback:**
   ```bash
   # Reverte alle Frontend-Änderungen
   git checkout HEAD^ client/
   ```

## Nächste Schritte

Nach erfolgreicher Migration:

1. ✅ Teste alle Features mit deutschen & englischen Users
2. ✅ Erstelle einen Test-User für jede Sprache
3. ✅ Prüfe AI Chat-Antworten in beiden Sprachen
4. ✅ Optional: Implementiere User-Settings zum Sprachwechsel
5. ✅ Erweitere Landing Page mit vollständiger i18n-Integration

## Support

Bei Problemen:
1. Prüfe Convex Logs: `npx convex dashboard`
2. Prüfe Browser Console für Frontend-Errors
3. Schaue in `docs/LANGUAGE_SUPPORT.md` für technische Details

---

**Status:** ✅ Ready for Production  
**Erstellt:** 2025-12-04  
**Autor:** AI Assistant




















