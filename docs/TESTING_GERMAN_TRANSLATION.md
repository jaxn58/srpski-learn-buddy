# 🧪 Testanleitung: Deutsche Übersetzung

## ✅ Was wurde übersetzt:

1. **Dashboard.tsx** - Alle UI-Texte
2. **Sidebar.tsx** - Navigation, Stats, Labels
3. **UnitView.tsx** - UI-Texte (Tabs, Buttons, Messages)
4. **Home.tsx** - Landing Page komplett
5. **Vokabeln** - Alle 507 Wörter
6. **Unit-Titel & Topics** - Alle 27 Units

## ⚠️ Was noch fehlt:

- **Unit-Erklärungen** (Markdown aus DB) - Die langen Texte in den Unit-Tabs sind noch auf Englisch

---

## 🧪 Test-Schritte:

### 1. **Dev-Server starten**

```bash
pnpm dev
```

### 2. **Landing Page testen**

1. Öffne `http://localhost:5173`
2. **Language Switcher** oben rechts klicken
3. Wähle **🇩🇪 Deutsch**
4. **Prüfe:**
   - ✅ Hero-Titel: "Lerne Serbisch mit deinem persönlichen KI Lernbuddy"
   - ✅ Features auf Deutsch
   - ✅ Pricing auf Deutsch
   - ✅ FAQ auf Deutsch
   - ✅ Unit-Karten zeigen deutsche Titel ("Am Flughafen" statt "At the airport")

### 3. **Registrierung testen**

1. Auf **"Jetzt kostenlos testen"** klicken
2. **Prüfe:**
   - ✅ Clerk Sign-Up Formular auf Deutsch
   - ✅ Nach Registrierung: Dashboard auf Deutsch

### 4. **Dashboard testen**

1. Nach Login: Dashboard öffnen
2. **Prüfe:**
   - ✅ "Willkommen zurück, [Name]!"
   - ✅ "Gesamtfortschritt", "Aktuelle Woche", "Aktuelle Lektion"
   - ✅ Beta-Banner auf Deutsch
   - ✅ Unit-Karten zeigen deutsche Titel
   - ✅ "Lektion 1" statt "Unit 1"
   - ✅ "Gesperrt" statt "Locked"
   - ✅ "Abgeschlossen" statt "Completed"

### 5. **Sidebar testen**

1. Links in der Sidebar schauen
2. **Prüfe:**
   - ✅ "Dashboard", "Vokabeln üben", "Alle Wörter ansehen"
   - ✅ "Mein Abonnement", "Feedback senden"
   - ✅ Stats: "Level", "Gesamt-XP", "Serie", "Badges"
   - ✅ "Abmelden" statt "Logout"

### 6. **UnitView testen**

1. Auf eine Unit klicken (z.B. Lektion 1)
2. **Prüfe:**
   - ✅ Header: "Lektion 1" statt "Unit 1"
   - ✅ "Zurück zum Dashboard" statt "Back to Dashboard"
   - ✅ Tabs: "Lektionen-Übersicht", "Grammatik erklärt", "Übungsbeispiele"
   - ✅ Unit-Titel: "Am Flughafen" (deutsch)
   - ✅ Topics auf Deutsch: "Begrüßungen und wichtige Phrasen"
   - ⚠️ **Unit-Erklärungen** (Markdown) sind noch auf Englisch (erwartet!)

### 7. **Vokabeln testen**

1. Zu "Vokabeln üben" gehen
2. **Prüfe:**
   - ✅ Serbische Wörter werden angezeigt
   - ✅ Deutsche Übersetzungen werden angezeigt (nicht Englisch!)
   - ✅ Quiz-Mode akzeptiert deutsche Antworten

### 8. **Chat testen**

1. Zu "KI Lernbuddy" gehen
2. Frage stellen: "Wie funktioniert das Verb biti?"
3. **Prüfe:**
   - ✅ Antwort kommt auf Deutsch (wenn User learningLanguage = "de")

---

## 🐛 Bekannte Probleme:

### Unit-Erklärungen noch auf Englisch

**Status:** Erwartet! Die Markdown-Inhalte müssen noch übersetzt werden.

**Wo sieht man das:**
- UnitView → Tab "Lektionen-Übersicht" → Lange Erklärungstexte
- UnitView → Tab "Grammatik erklärt" → Grammatik-Erklärungen
- UnitView → Tab "Übungsbeispiele" → Übungsdialoge

**Workaround:** UI-Texte sind übersetzt, nur der Content fehlt noch.

---

## ✅ Checkliste:

- [ ] Landing Page komplett auf Deutsch
- [ ] Dashboard komplett auf Deutsch
- [ ] Sidebar komplett auf Deutsch
- [ ] UnitView UI-Texte auf Deutsch
- [ ] Unit-Titel & Topics auf Deutsch
- [ ] Vokabeln auf Deutsch
- [ ] Chat antwortet auf Deutsch
- [ ] Clerk Formulare auf Deutsch

---

## 📝 Feedback sammeln:

Wenn du etwas findest, das noch nicht übersetzt ist:

1. **Screenshot machen**
2. **Datei + Zeile notieren**
3. **Text aufschreiben, der übersetzt werden soll**

---

**Status:** ✅ Ready for Testing  
**Erstellt:** 2025-12-04




















