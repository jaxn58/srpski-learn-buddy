# 🎯 Quiz-System Verbesserungen

**Datum:** 2025-12-04  
**Status:** 🚧 In Arbeit

---

## 📋 **Aktuelle Probleme:**

1. ❌ **LocalStorage-basiert** - Daten gehen verloren bei Browser-Cache löschen
2. ❌ **Kein gezieltes Wiederholen** - Falsche Vokabeln werden nicht tracked
3. ❌ **Keine persistente Historie** - Über mehrere Geräte hinweg nicht sync
4. ❌ **Kein Spaced Repetition** - Keine intelligente Wiederholung

---

## ✅ **Implementierte Lösungen:**

### 1. **DB-Schema** ✅
```typescript
quizProgress: {
  userId: Id<"users">;
  unitNumber: number;
  currentIndex: number;
  totalAttempts: number;
  lastScore: number;
  incorrectWordIds: string[]; // Array von falsch beantworteten Wörtern!
  lastAttemptAt: number;
}
```

### 2. **Neue Convex Queries** ✅
- `getQuizProgress(unitNumber)` - Holt Quiz-Fortschritt aus DB
- `updateQuizProgress(...)` - Speichert Fortschritt + falsche Vokabeln
- `getIncorrectWords(unitNumber)` - Holt falsche Vokabeln
- `clearIncorrectWords(unitNumber)` - Löscht falsche Vokabeln nach erfolgreichem Üben

---

## 🚀 **Geplante Frontend-Features:**

### Phase 1: Basis-Verbesserungen ✅
- [x] DB als primäre Quelle (localStorage nur als Backup)
- [x] incorrectWordIds werden bei jeder falschen Antwort gespeichert
- [x] Quiz-Progress wird sofort in DB geschrieben

### Phase 2: Wiederholungs-Feature 🚧
- [ ] Button "Falsche Vokabeln üben" (nur wenn > 0 falsch)
- [ ] Neuer Modus: Nur falsche Vokabeln zeigen
- [ ] Nach erfolgreichem Durchgang: incorrectWordIds löschen

### Phase 3: Spaced Repetition (Zukunft)
- [ ] Wiederholungs-Intervalle: 1 Tag, 3 Tage, 1 Woche, 1 Monat
- [ ] "Due for review" Indikator
- [ ] Priorität basierend auf Schwierigkeit

---

## 🎨 **UI-Verbesserungen:**

### Neues Card-Element (nach Filter by Unit):
```
┌─────────────────────────────────────────┐
│ 📊 Quiz-Statistik                       │
│                                         │
│ Letzter Versuch: 75% (12 Versuche)    │
│ Falsche Vokabeln: 8 Wörter            │
│                                         │
│ [🔄 Falsche Vokabeln üben]            │
└─────────────────────────────────────────┘
```

---

## 💾 **Daten-Flow:**

### Bei falscher Antwort:
```
1. User gibt falsche Antwort
2. Frontend: Fügt word.serbian zu lokaler Liste hinzu
3. Backend: updateQuizProgress({ 
     incorrectWordIds: [...existing, word.serbian] 
   })
4. DB speichert: ["aerodrom", "taksi", "kovčeg"]
```

### "Falsche Vokabeln üben" Modus:
```
1. User klickt Button
2. Frontend: query getIncorrectWords(unitNumber)
3. Backend: return ["aerodrom", "taksi", "kovčeg"]
4. Frontend: Filtert VOCABULARY nach diesen IDs
5. Quiz nur mit diesen Vokabeln
6. Bei 100% richtig: clearIncorrectWords()
```

---

## 🧪 **Testing-Checkliste:**

- [ ] Quiz machen, bewusst Fehler machen
- [ ] Browser neu laden → Fortschritt bleibt
- [ ] "Falsche Vokabeln üben" Button erscheint
- [ ] Nur falsche Vokabeln werden gezeigt
- [ ] Nach erfolgreichem Durchgang: Liste ist leer
- [ ] Anderes Gerät → gleicher Fortschritt

---

## 📝 **Offene Fragen:**

1. Soll localStorage komplett entfernt werden?
   → **Nein**, als Backup für Offline-Nutzung behalten

2. Wie viele Wiederholungen bis Vokabel als "gelernt" gilt?
   → **Aktuell:** 1x richtig im "Falsche Vokabeln" Modus
   → **Zukunft:** Spaced Repetition mit mehrfachen Intervallen

3. Soll Quiz-Progress auch Unit-übergreifend gespeichert werden?
   → **Ja**, per `unitNumber: 0` für "Alle Lektionen"

---

## ✅ **Nächste Schritte:**

1. ✅ Convex Queries erstellt
2. ✅ i18n Übersetzungen hinzugefügt
3. 🚧 Frontend: Quiz-Stats Card hinzufügen
4. 🚧 Frontend: "Falsche Vokabeln üben" Button
5. 🚧 Frontend: Filtered vocab mode
6. 🧪 Testing
7. 📝 Dokumentation aktualisieren

---

**Status:** Backend ✅ | Frontend 🚧 | Testing ⏳





