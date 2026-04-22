# Clerk Webhook: `user.deleted` aktivieren

Checkliste zur Aktivierung des `user.deleted`-Events, damit die vollständige
User-Löschung (inkl. Clerk → Convex Safety-Net) funktioniert.

Muss in **zwei Clerk-Environments** gemacht werden: erst **Development**,
nach erfolgreichem Test dann **Production**.

## Vorher wissen

- **Code-Seite ist fertig.** Die Convex-Funktionen (`deleteUser` Action,
  `_deleteUserCascade`, Webhook-Handler, Self-Service) sind deployed, sobald
  `npx convex dev` bzw. `npx convex deploy` gelaufen ist.
- **Einzige verbleibende Aufgabe**: im Clerk-Dashboard das Event `user.deleted`
  abonnieren, damit manuelles Löschen im Clerk-Dashboard auch Convex aufräumt.
- `CLERK_WEBHOOK_SECRET` ist in der Dev-Convex-Env bereits gesetzt (geprüft).

---

## Teil A — Development

### A.1 Clerk Dashboard öffnen

- [ ] https://dashboard.clerk.com öffnen
- [ ] Projekt **Serbian AI Tutor / srpski-tutor-en** auswählen
- [ ] Oben rechts den Environment-Schalter auf **Development** stellen

### A.2 Webhook-Eintrag finden

- [ ] Linkes Menü: **Configure** → **Webhooks** öffnen
- [ ] Prüfen, ob es einen Endpoint mit URL
      `https://reminiscent-panda-57.convex.site/clerk-webhook` gibt
- [ ] Falls der Endpoint fehlt: neu anlegen (siehe Anhang 1), sonst weiter mit A.3

### A.3 `user.deleted` abonnieren

- [ ] Auf den Endpoint klicken, um in die Detailansicht zu kommen
- [ ] Tab **Subscribed events** (oder **Message filtering**) öffnen
- [ ] Prüfen, dass folgende Events bereits aktiv sind:
  - [ ] `session.created`
  - [ ] `user.created`
- [ ] **Neu aktivieren**: `user.deleted`
- [ ] Mit **Save** / **Update** bestätigen

### A.4 Signing Secret abgleichen (nur falls Endpoint neu angelegt)

- [ ] Im Endpoint-Detail **Signing Secret** → **Reveal / Copy**
- [ ] In Terminal: `npx convex env list` → Wert von `CLERK_WEBHOOK_SECRET` prüfen
- [ ] Wenn ungleich: `npx convex env set CLERK_WEBHOOK_SECRET whsec_<neuer-wert>`

### A.5 Test-Event aus dem Dashboard senden

- [ ] Im Endpoint-Detail Tab **Testing** (bzw. **Send test event**) öffnen
- [ ] Aus dem Dropdown `user.deleted` wählen
- [ ] **Send** klicken
- [ ] Response ist **200 OK**
- [ ] In den Convex-Logs erscheint einer der beiden Log-Einträge:
  - `[Clerk Webhook] user.deleted: no Convex user for clerkId=... (already clean)`  oder
  - `[Clerk Webhook] user.deleted cascade done`

### A.6 End-to-End Smoke-Test: Löschung AUS DER APP

Zweck: prüfen, dass der Admin-Flow Clerk + Convex sauber entfernt.

- [ ] In der Dev-App mit einem **neuen Test-Account** registrieren (z. B. `delete-test-1@…`)
- [ ] Als Admin im **Admin-Panel** diesen User öffnen
- [ ] Button **Delete user** klicken, Bestätigung durchführen
- [ ] Toast zeigt „User fully deleted from Clerk and Convex" + Zeilenzähler
- [ ] Clerk Dashboard → **Users**: Test-User ist weg
- [ ] Convex Dashboard → Tabelle `users`: Test-User ist weg

### A.7 End-to-End Smoke-Test: Löschung AUS DEM CLERK-DASHBOARD

Zweck: prüfen, dass das Webhook-Safety-Net greift.

- [ ] Erneut Test-Account registrieren (z. B. `delete-test-2@…`)
- [ ] Clerk Dashboard → **Users** → Test-User suchen und löschen
  (z. B. über **…** → **Delete user**)
- [ ] 2–3 Sekunden warten (Webhook-Laufzeit)
- [ ] Convex-Logs zeigen `[Clerk Webhook] user.deleted cascade done {...}`
- [ ] Convex Dashboard → Tabelle `users`: Test-User ist weg
- [ ] Convex Dashboard → z. B. `userProgress`, `vocabularyProgress`: keine
      verwaisten Zeilen mehr zu diesem User

### A.8 End-to-End Smoke-Test: Self-Service „Konto löschen"

Zweck: prüfen, dass der User sich selbst löschen kann (DSGVO-konform).

- [ ] Erneut Test-Account registrieren (z. B. `delete-test-3@…`)
- [ ] Als dieser User einloggen
- [ ] **Profil** öffnen, nach unten scrollen bis **Gefahrenzone / Danger Zone**
- [ ] **Konto löschen** klicken
- [ ] Im Dialog die Konto-E-Mail eintippen, **Endgültig löschen** drücken
- [ ] User wird automatisch ausgeloggt, Redirect auf `/`
- [ ] Clerk Dashboard → **Users**: Test-User ist weg
- [ ] Convex Dashboard → `users`: Test-User ist weg

### A.9 Negativ-Test: Self-Service mit falscher E-Mail

- [ ] Neuen Test-Account registrieren, einloggen, Profil → Gefahrenzone öffnen
- [ ] Im Bestätigungsdialog eine **andere** E-Mail tippen
- [ ] Button **Endgültig löschen** bleibt deaktiviert (grau)
- [ ] Mit korrekter E-Mail wird der Button wieder klickbar

### A.10 Negativ-Test: Self-Service bei aktivem Abo

Nur relevant, falls Abos in Dev überhaupt aktivierbar sind.

- [ ] Test-Account mit aktivem Abo anlegen
- [ ] Versuch, das Konto über Gefahrenzone zu löschen
- [ ] Toast zeigt „Du hast ein aktives Abonnement. Bitte kündige es …"
- [ ] Account existiert weiter in Clerk und Convex

---

## Teil B — Production

Erst starten, wenn Teil A vollständig grün ist.

### B.1 Clerk auf Production umschalten

- [ ] https://dashboard.clerk.com → Environment-Schalter oben rechts auf **Production**

### B.2 Production-Webhook finden

- [ ] **Configure** → **Webhooks**
- [ ] Endpoint mit URL `https://fleet-labrador-324.convex.site/clerk-webhook` öffnen
- [ ] Falls fehlt: siehe Anhang 1 (neu anlegen)

### B.3 Events in Production

- [ ] `session.created` aktiv
- [ ] `user.created` aktiv
- [ ] **`user.deleted` aktivieren**
- [ ] **Save**

### B.4 Production-Secret in Convex-Prod setzen (falls nötig)

- [ ] Signing Secret im Production-Endpoint **Reveal / Copy**
- [ ] Convex-Prod-Deploy:
      `npx convex env set CLERK_WEBHOOK_SECRET whsec_<prod-wert> --prod`

> Hinweis: `CLERK_SECRET_KEY` (Produktion, `sk_live_...`) muss in der
> Convex-Prod-Env ebenfalls gesetzt sein — ohne den Key schlägt der Clerk-
> Delete-Call im Admin-/Self-Service-Flow fehl. Prüfen mit
> `npx convex env list --prod`.

### B.5 Test-Event in Production senden

- [ ] Tab **Testing** → `user.deleted` → **Send**
- [ ] Response **200 OK**
- [ ] Convex-Prod-Logs zeigen den erwarteten Log-Eintrag

### B.6 Sanfter Smoke-Test in Production

> Vorsicht: **keinen echten User** löschen. Immer mit einem dedizierten
> Test-Account arbeiten.

- [ ] Test-Account `prod-delete-test@…` per Sign-Up in der Live-App anlegen
- [ ] Admin-Flow: über Admin-Panel löschen → Clerk + Convex leer?
- [ ] Optional: zweiter Test-Account + Löschung aus Clerk-Dashboard →
      Convex-Cascade greift?

---

## Abschluss

- [ ] Teil A vollständig abgehakt
- [ ] Teil B vollständig abgehakt
- [ ] Optional: diesen Guide (oder die Checklisten-Kopie) als „erledigt"
      archivieren bzw. Abschluss-Datum oben ergänzen

---

## Anhang 1 — Falls der Endpoint in Clerk fehlt

Nur nötig, wenn in Schritt A.2 oder B.2 kein passender Endpoint existiert.

1. **Configure → Webhooks → + Add Endpoint**
2. **Endpoint URL**:
   - Development: `https://reminiscent-panda-57.convex.site/clerk-webhook`
   - Production:  `https://fleet-labrador-324.convex.site/clerk-webhook`
3. **Message filtering / Subscribed events** anhaken:
   - [ ] `session.created`
   - [ ] `user.created`
   - [ ] `user.deleted`
4. **Create**
5. **Signing Secret** kopieren und in Convex setzen:
   - Dev:  `npx convex env set CLERK_WEBHOOK_SECRET whsec_...`
   - Prod: `npx convex env set CLERK_WEBHOOK_SECRET whsec_... --prod`
6. Test-Event senden (siehe A.5 / B.5)

---

## Anhang 2 — Troubleshooting

**Test-Event bekommt 500 oder 400**
- Convex-Logs öffnen (Convex Dashboard → Logs)
- Fehlermeldung lesen. Häufigste Ursache: `CLERK_WEBHOOK_SECRET` stimmt nicht
  mit dem Signing Secret in Clerk überein. → in Convex neu setzen.

**Löschung aus Admin-UI sagt „Clerk deletion failed"**
- `CLERK_SECRET_KEY` ist in der passenden Convex-Env nicht gesetzt oder falsch.
- Prüfen mit `npx convex env list` (Dev) bzw. `npx convex env list --prod`.

**Nach Clerk-Dashboard-Löschung bleibt Convex-User bestehen**
- Event `user.deleted` ist im entsprechenden Clerk-Environment NICHT abonniert.
- Zurück zu A.3 / B.3.

**Self-Service-Button ist im Profil unsichtbar**
- Frontend-Cache leeren (hart reloaden). Die Komponente ist direkt in
  `client/src/pages/Profile.tsx` als „Danger Zone"-Card unterhalb der
  Subscription-Card eingebaut.

**Self-Service bricht ab mit „You have an active subscription"**
- Erwartet — so verhindert der Code, dass eine laufende Zahlung verwaist.
- Subscription zuerst kündigen, dann nochmals versuchen.

---

## Referenzen

- Backend-Pfade: `convex/admin.ts` (`deleteUser` Action, `_deleteUserCascade`),
  `convex/users.ts` (`deleteMyAccount`), `convex/http.ts` (Webhook-Handler).
- Admin-UI: `client/src/pages/AdminUserDetail.tsx`.
- Self-Service-UI: `client/src/pages/Profile.tsx` (Danger Zone).
- Weitere Doku: `docs/CLERK_PRODUCTION_MIGRATION.md` → Abschnitt
  „User Deletion Flow".
