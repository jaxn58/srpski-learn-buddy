# 🧪 Quiz-System Testing Guide

**Datum:** 2025-12-04  
**Feature:** Intelligentes Vokabel-Quiz mit DB-Persistierung

---

## 🎯 **Test-Szenario 1: Erstes Quiz**

### Schritte:
1. **Browser neu laden** (`F5`)
2. **Vokabeln üben** aufrufen
3. **Quiz-Modus** wählen
4. **Lektion 1** auswählen
5. Quiz starten

### Erwartetes Verhalten:
- ✅ Quiz startet normal
- ✅ Vokabeln werden angezeigt
- ✅ Antworten werden geprüft
- ✅ Score wird angezeigt

---

## 🎯 **Test-Szenario 2: Fehler machen**

### Schritte:
1. Im Quiz absichtlich **2-3 Fehler** machen
2. Falsche Antworten geben (z.B. "xyz")
3. Quiz zu Ende spielen
4. Seite neu laden

### Erwartetes Verhalten:
- ✅ **Quiz-Statistik Card erscheint** (blauer Hintergrund)
- ✅ Zeigt letzten Score (z.B. "75%")
- ✅ Zeigt Anzahl Versuche (z.B. "1")
- ✅ Zeigt **"⚠️ Wiederhole X falsch beantwortete Vokabeln"**
- ✅ Zeigt die **Namen der falschen Vokabeln** (z.B. "aerodrom, taksi")
- ✅ **Button "🔄 Falsche Vokabeln üben"** ist sichtbar

---

## 🎯 **Test-Szenario 3: Falsche Vokabeln wiederholen**

### Schritte:
1. Auf **"🔄 Falsche Vokabeln üben"** klicken
2. Beobachte die Änderungen

### Erwartetes Verhalten:
- ✅ **Orange Card erscheint**: "🎯 Wiederholungsmodus aktiv"
- ✅ Zeigt an: "Du übst jetzt nur die X falsch beantworteten Vokabeln"
- ✅ Quiz zeigt **nur die falschen Vokabeln**
- ✅ Keine anderen Vokabeln werden gezeigt

---

## 🎯 **Test-Szenario 4: Alle richtig beim Wiederholen**

### Schritte:
1. Im Wiederholungsmodus **alle Vokabeln richtig** beantworten
2. Quiz zu Ende spielen
3. Seite neu laden

### Erwartetes Verhalten:
- ✅ Quiz-Statistik Card zeigt: **"✅ Du hast alle Vokabeln gemeistert!"**
- ✅ Button "Falsche Vokabeln üben" ist **verschwunden**
- ✅ Orange Card ist weg
- ✅ Score ist jetzt 100%

---

## 🎯 **Test-Szenario 5: Persistierung über Geräte**

### Schritte:
1. Auf Computer A: Quiz machen, Fehler machen
2. Auf Computer B: **Gleicher Account** einloggen
3. Vokabeln üben aufrufen

### Erwartetes Verhalten:
- ✅ **Gleiche falsche Vokabeln** werden angezeigt
- ✅ **Gleicher Score** wird angezeigt
- ✅ Daten sind **synchronisiert** (DB-basiert, nicht localStorage)

---

## 🎯 **Test-Szenario 6: Mehrere Lektionen**

### Schritte:
1. **Lektion 1** Quiz machen → Fehler machen
2. **Lektion 2** Quiz machen → Fehler machen
3. Zwischen Lektionen wechseln

### Erwartetes Verhalten:
- ✅ **Jede Lektion** hat eigene Quiz-Statistik
- ✅ Falsche Vokabeln sind **pro Lektion** getrennt
- ✅ "Falsche Vokabeln üben" zeigt nur Vokabeln **dieser Lektion**

---

## ⚠️ **Bekannte Einschränkungen:**

1. **"Alle Lektionen" Modus:**
   - Quiz-Statistik wird **nicht angezeigt** (nur bei einzelnen Lektionen)
   - Grund: `unitNumber: 0` wird zwar getrackt, aber UI zeigt es nicht

2. **Lernmodus:**
   - Keine Quiz-Statistik (nur im Quiz-Modus)

---

## 🐛 **Häufige Probleme:**

### Problem: Quiz-Statistik erscheint nicht
**Lösung:**
1. Browser neu laden (F5)
2. Prüfe ob Quiz-Modus aktiv ist
3. Prüfe ob eine einzelne Lektion ausgewählt ist (nicht "Alle Lektionen")
4. Prüfe ob Convex deployed ist: `npx convex dev --once`

### Problem: Button "Falsche Vokabeln üben" ist ausgegraut
**Lösung:**
- Das ist korrekt! Button ist disabled wenn bereits im Wiederholungsmodus

### Problem: Falsche Vokabeln werden nicht gespeichert
**Lösung:**
1. Prüfe Convex Console: `quizProgress` Tabelle
2. Check `incorrectWordIds` Array
3. Falls leer: Backend-Fehler beim `updateQuizProgress`

---

## 📊 **Datenbank-Struktur prüfen:**

### Convex Console öffnen:
```bash
npx convex dashboard
```

### Tabelle: `quizProgress`
```json
{
  "userId": "...",
  "unitNumber": 1,
  "currentIndex": 5,
  "totalAttempts": 2,
  "lastScore": 75,
  "incorrectWordIds": ["aerodrom", "taksi", "kovčeg"],
  "lastAttemptAt": 1733342400000
}
```

---

## ✅ **Erfolgs-Checkliste:**

- [ ] Quiz-Statistik Card erscheint nach Fehler
- [ ] Falsche Vokabeln werden angezeigt
- [ ] Button "Falsche Vokabeln üben" ist klickbar
- [ ] Wiederholungsmodus zeigt nur falsche Vokabeln
- [ ] Nach 100% richtig: Liste wird geleert
- [ ] Daten bleiben nach Browser-Neustart
- [ ] Daten sind über Geräte synchronisiert

---

**Status:** ✅ Bereit zum Testen  
**Nächste Schritte:** User-Feedback sammeln → Spaced Repetition implementieren





