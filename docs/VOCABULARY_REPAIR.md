# Vocabulary Repair

## Problem

Beim Publishing von Units im Content Studio kann es vorkommen, dass Vokabeleintraege (`courseVocabulary`) nicht korrekt als "published" markiert werden. Das aeussert sich dadurch, dass auf der Unit-Seite keine Vokabeln, Audio-Links oder Buddy-Buttons angezeigt werden, obwohl die Unit als "published" markiert ist.

### Ursache

Ein Bug in `promoteLanguagePreviewToPublished` (behoben) hat dazu gefuehrt, dass englische Vokabeleintraege beim Promote von "preview" auf "published" nicht korrekt uebernommen wurden. Die Preview-Eintraege wurden archiviert, ohne dass neue Published-Eintraege erstellt wurden.

## Loesung: Repair-Mutation

Die interne Mutation `contentStudio/_mutations:repairPublishedUnitVocabulary` stellt Vokabeleintraege fuer eine betroffene Unit wieder her.

### Ausfuehrung via Terminal

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"; cmd /c 'npx convex run "contentStudio/_mutations:repairPublishedUnitVocabulary" "{""unitNumber"":X,""confirm"":""REPAIR VOCAB UNIT X""}"'
```

`X` durch die betroffene Unit-Nummer ersetzen (z.B. `5`).

### Beispiel fuer Unit 5

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"; cmd /c 'npx convex run "contentStudio/_mutations:repairPublishedUnitVocabulary" "{""unitNumber"":5,""confirm"":""REPAIR VOCAB UNIT 5""}"'
```

### Erwartete Ausgabe

```json
{
  "ok": true,
  "previousActiveCount": 0,
  "reactivated": 603,
  "strategy": "reactivated_archived_preview",
  "unitNumber": 5
}
```

### Repair-Strategien

Die Mutation versucht drei Strategien in dieser Reihenfolge:

| Prioritaet | Strategie | Beschreibung |
|---|---|---|
| 1 | `reactivated_archived_preview` | Archivierte Preview-Eintraege werden als "published" reaktiviert |
| 2 | `reactivated_latest_archived` | Neueste archivierte Eintraege (pro serbischem Key) werden reaktiviert |
| 3 | `recreated_from_snapshot` | Vokabeln werden aus dem letzten `contentDrafts`-Snapshot neu erstellt |

### Sicherheitsmechanismen

- **Confirmation-String**: Muss exakt `REPAIR VOCAB UNIT <nummer>` lauten
- **Nur bei 0 aktiven Eintraegen**: Die Mutation greift nur, wenn keine aktiven Vokabeln vorhanden sind
- **Internal Mutation**: Kann nur ueber CLI (`npx convex run`) oder intern aufgerufen werden, nicht vom Client

## Hinweise

- **TLS-Warnung**: `NODE_TLS_REJECT_UNAUTHORIZED=0` ist noetig, falls ein VPN/Proxy das Zertifikat blockiert. Betrifft nur den CLI-Aufruf.
- **Dev vs. Prod**: Der Befehl laeuft standardmaessig gegen das Dev-Deployment. Fuer Production `--prod` anhaengen (nur nach expliziter Freigabe!).
- **Pruefen nach Repair**: Unit-Seite im Browser oeffnen und pruefen, ob Vokabeln mit Audio und Buddy-Buttons angezeigt werden.
