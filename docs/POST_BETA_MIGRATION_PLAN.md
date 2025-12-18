# Post-Beta Migration Plan

**Plan für die Migration nach Ende des Beta-Tests**

---

## 🎯 Übersicht

Nach Ende des Beta-Tests müssen wir die Production-Datenbank bereinigen und sicherstellen, dass alle Beta-Tester-Daten korrekt migriert werden, ohne dass Content-Updates verloren gehen.

---

## 📋 Situation nach Beta-Test

### Was haben wir:

1. **Production-Datenbank** mit:
   - Beta-Tester User-Daten (Fortschritt, XP, Badges, etc.)
   - Content-Daten (Units, Vocabulary, Tests)
   - User-Fortschritt für Fragen (`questionProgress`)

2. **Development-Datenbank** mit:
   - Aktualisierte Content-Daten (verbesserte Units, neue Tests, etc.)
   - Möglicherweise neue Features

### Problem:

- Fragen mit User-Fortschritt werden aktuell **nicht überschrieben** (Schutz aktiv)
- Content-Updates aus Development können nicht migriert werden, wenn User bereits Fortschritt haben
- Nach Beta-Ende müssen wir Content-Updates durchführen, ohne User-Daten zu verlieren

---

## 🔄 Migrations-Strategien

### Option 1: Content-Versionierung (Empfohlen)

**Konzept:** Fragen bekommen Versionsnummern, alte Versionen bleiben erhalten.

**Vorgehen:**
1. Neue Fragen bekommen neue `questionId`s (z.B. `u1_trans_q1_v2`)
2. Alte Fragen bleiben mit alten IDs erhalten
3. User-Fortschritt bleibt an alten IDs gebunden
4. Neue User sehen automatisch neue Versionen

**Vorteile:**
- ✅ Keine Datenverluste
- ✅ Beta-Tester behalten ihren Fortschritt
- ✅ Neue User bekommen verbesserte Content

**Nachteile:**
- ⚠️ Datenbank wird größer (alte + neue Fragen)
- ⚠️ Mehr Wartungsaufwand

**Implementierung:**
```typescript
// In Development: Neue Frage-ID mit Version
questionId: "u1_trans_q1_v2"  // statt "u1_trans_q1"

// Migration erkennt automatisch neue IDs und migriert sie
// Alte IDs bleiben unberührt
```

---

### Option 2: Fortschritt-Migration

**Konzept:** User-Fortschritt wird auf neue Frage-IDs migriert.

**Vorgehen:**
1. Neue Fragen bekommen neue `questionId`s
2. Mapping-Tabelle: `oldQuestionId -> newQuestionId`
3. Script migriert `questionProgress` von alten zu neuen IDs
4. Alte Fragen werden gelöscht

**Vorteile:**
- ✅ Saubere Datenbank (keine Duplikate)
- ✅ User behalten Fortschritt

**Nachteile:**
- ⚠️ Komplexe Migration
- ⚠️ Risiko von Datenverlusten bei Mapping-Fehlern

**Implementierung:**
```typescript
// Mapping-Tabelle erstellen
const questionMapping = {
  "u1_trans_q1": "u1_trans_q1_v2",
  "u1_trans_q2": "u1_trans_q2_v2",
  // ...
};

// Fortschritt migrieren
for (const [oldId, newId] of Object.entries(questionMapping)) {
  const oldProgress = await getProgressByQuestionId(oldId);
  if (oldProgress) {
    await migrateProgress(oldProgress, newId);
  }
}
```

---

### Option 3: Content-Freeze für Beta-Tester

**Konzept:** Beta-Tester behalten alte Content-Version, neue User bekommen neue Version.

**Vorgehen:**
1. Beta-Tester bekommen Flag `usesLegacyContent: true`
2. App zeigt Beta-Testern alte Fragen (alte `questionId`s)
3. Neue User sehen neue Fragen (neue `questionId`s)
4. Nach Beta-Ende: Graduelle Migration

**Vorteile:**
- ✅ Keine Störung für Beta-Tester
- ✅ Neue User bekommen sofort verbesserte Content

**Nachteile:**
- ⚠️ Zwei Content-Versionen parallel
- ⚠️ Mehr Komplexität im Code

---

## ✅ Empfohlener Plan: Option 1 (Content-Versionierung)

### Phase 1: Vorbereitung (Während Beta)

1. **Content-Updates in Development**
   - Neue/verbesserte Fragen bekommen Version-Suffix
   - Beispiel: `u1_trans_q1` → `u1_trans_q1_v2`
   - Migration-Script erkennt automatisch neue IDs

2. **Migration testen**
   - Test-Migration auf Staging
   - Prüfen, dass alte Fragen erhalten bleiben
   - Prüfen, dass neue Fragen migriert werden

### Phase 2: Migration nach Beta-Ende

1. **Content-Migration**
   ```bash
   # Migriert nur neue Fragen (mit _v2, _v3, etc.)
   pnpm migrate:production
   ```

2. **Verifizierung**
   - Prüfen, dass Beta-Tester-Fortschritt erhalten ist
   - Prüfen, dass neue Fragen verfügbar sind
   - Testen mit Beta-Tester-Accounts

3. **Cleanup (Optional)**
   - Alte Fragen können später gelöscht werden (nach 6-12 Monaten)
   - Oder: Behalten für historische Zwecke

### Phase 3: App-Update

1. **Frontend anpassen**
   - App zeigt automatisch neueste Version einer Frage
   - Fallback auf alte Version, falls neue nicht existiert

2. **User-Erfahrung**
   - Beta-Tester sehen weiterhin ihre Fortschritte
   - Neue User sehen automatisch neue Content-Versionen

---

## 🛠️ Technische Implementierung

### 1. Migration-Script erweitern

```typescript
// In migrate-to-production.ts
// Automatisch erkennen, ob Frage-ID Version hat
function hasVersionSuffix(questionId: string): boolean {
  return /_v\d+$/.test(questionId);
}

// Nur migrieren, wenn:
// - Neue Frage-ID (nicht in Production)
// - ODER: Frage-ID hat Version-Suffix (_v2, _v3, etc.)
```

### 2. Content-Versionierung in Development

```typescript
// Beim Erstellen neuer Fragen:
const newQuestionId = `${baseQuestionId}_v2`;

// Oder automatisch:
function generateQuestionId(unitNumber: number, category: string, order: number, version: number = 1): string {
  const base = `u${unitNumber}_${category}_q${order}`;
  return version > 1 ? `${base}_v${version}` : base;
}
```

### 3. Frontend-Logik

```typescript
// Beim Laden von Fragen: Neueste Version bevorzugen
async function getQuestion(unitNumber: number, category: string, order: number) {
  // Versuche zuerst neueste Version
  const versions = [3, 2, 1]; // Aktuelle Versionen
  for (const version of versions) {
    const questionId = version > 1 
      ? `u${unitNumber}_${category}_q${order}_v${version}`
      : `u${unitNumber}_${category}_q${order}`;
    
    const question = await getQuestionById(questionId);
    if (question) return question;
  }
  
  throw new Error("Question not found");
}
```

---

## 📊 Checkliste für Post-Beta Migration

### Vor der Migration

- [ ] Alle Content-Updates in Development getestet
- [ ] Versionsnummern für neue Fragen vergeben
- [ ] Migration-Script getestet (Dry-Run)
- [ ] Backup der Production-Datenbank erstellt
- [ ] Beta-Tester informiert (optional)

### Während der Migration

- [ ] Migration-Script ausführen
- [ ] Logs prüfen (geschützte Fragen, neue Fragen)
- [ ] Verifizieren, dass Beta-Tester-Fortschritt erhalten ist

### Nach der Migration

- [ ] Production-App testen
- [ ] Beta-Tester-Accounts testen
- [ ] Neue User-Accounts testen
- [ ] Content-Verfügbarkeit prüfen
- [ ] Performance prüfen

---

## 🔍 Monitoring & Validierung

### Prüfungen nach Migration

1. **Beta-Tester-Fortschritt**
   ```sql
   -- Prüfen, ob alle Beta-Tester ihren Fortschritt haben
   SELECT COUNT(*) FROM questionProgress 
   WHERE userId IN (SELECT _id FROM users WHERE isBetaTester = true);
   ```

2. **Content-Verfügbarkeit**
   ```sql
   -- Prüfen, ob neue Fragen verfügbar sind
   SELECT COUNT(*) FROM unitInteractiveTests 
   WHERE questionId LIKE '%_v2%';
   ```

3. **User-Erfahrung**
   - Beta-Tester können ihre Units weiterhin abschließen
   - Neue User sehen neue Content-Versionen
   - Keine Fehler in Browser-Console

---

## 🚨 Rollback-Plan

Falls etwas schiefgeht:

1. **Sofort:**
   - Migration stoppen
   - Production-Datenbank aus Backup wiederherstellen
   - App auf vorherige Version zurücksetzen

2. **Analyse:**
   - Logs prüfen
   - Fehler identifizieren
   - Migration-Script anpassen

3. **Erneut:**
   - Auf Staging testen
   - Dann erneut auf Production migrieren

---

## 📝 Langfristige Strategie

### Content-Lifecycle

1. **Neue Content-Version**
   - Entwicklung in Development
   - Version-Suffix vergeben
   - Migration nach Production

2. **Alte Content-Versionen**
   - Behalten für 6-12 Monate
   - Dann optional archivieren/löschen

3. **User-Migration**
   - Graduell: Neue User bekommen neue Versionen
   - Beta-Tester behalten alte Versionen (oder freiwillige Migration)

---

## 💡 Best Practices

1. **Immer Versionen verwenden**
   - Nie bestehende `questionId`s ändern
   - Immer neue Versionen erstellen

2. **Migration testen**
   - Immer zuerst auf Staging testen
   - Dry-Run vor echter Migration

3. **Backup vor Migration**
   - Immer Backup vor größeren Migrationen
   - Rollback-Plan bereit haben

4. **Kommunikation**
   - Beta-Tester informieren (optional)
   - Changelog führen

---

**Letzte Aktualisierung:** Dezember 2025


