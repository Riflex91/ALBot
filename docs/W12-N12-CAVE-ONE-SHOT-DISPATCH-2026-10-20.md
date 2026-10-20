# W12/N12 – One-shot-Cave-Entry/Resume mit persistiertem Dispatch (20.10.2026)

## Gesicherte Servergrundlage

Geprüft gegen den Adventure-Land-Quellstand
`kaansoral/adventureland_mongodb@2148cf25d01060f54bcab01dfa7c2cf5b7baf374`:
`js/runner_functions.js` veröffentlicht `cave_enter()` als Promise
auf `parent.cave_request('enter')`. Der Game-Server
`node/logic/generated_maps.js` entscheidet zunächst, ob ein Run wieder
aufgenommen wird (`generated_return_run`); anderenfalls startet er
nach serverseitiger Party-/Account-/Tageskontingent-Prüfung einen neuen
Cave-Run. Ein erfolgreiches `game_response` kann `run`, `expires`
und `level` enthalten. **Erst die tatsächliche eigene
`character.cave`-Beobachtung mit passender Instanzmap bestätigt
eine physische Teilnahme.**

## Implementierung

- `ALBot.prepareCaveEntry()` erstellt weiterhin einen rein lokalen,
  dauerhaft gespeicherten Cave-Intent ohne Servermutation.
- Der **neue, ausschließlich explizit aufrufbare**
  `ALBot.requestCaveEntry()` fordert einen einmaligen
  `cave_enter()`-Sendeschritt über den bestehenden `Executor` an.
  **Nicht** im normalen Bot-Tick, nie automatisch durch einen
  Timeout und niemals als unsichere Retry-Queue.
- Erforderlich: unveränderte frische N12-Vorprüfung mit exakt gleichem
  Neu-/Resume-Modus, Run-ID und Teilnehmerfolge; gleicher Charakter,
  Realm und CODE-Session; weiterhin lebendige lokale Lage; kein
  laufender Value-/Bank-/Logistik-/Serverhop-/Charakterwechsel-Job;
  freie Executor-Ressourcen, Runtime-Action-Budget sowie echte
  `cave_enter`-Capability des aktuellen Spielhosts.
- Nach Executor-Zulassung schreibt die Dispatchfunktion zuerst
  den vorbereiteten Eintrag **dauerhaft als
  `phase:'dispatch-unknown'`** (inklusive Read-after-Write-Beleg).
  Nur nach erfolgreicher Journalpersistenz folgt exakt **ein**
  `p.call('cave_enter')`. Auch wenn der Aufruf synchron wirft,
  später zurückgewiesen wird oder die Zeitüberschreitung erreicht,
  bleibt der Versuch als *unbekannt* gesperrt. Keine erneute
  Serveranfrage und kein automatisches Löschen des Journals.
- Eine gültige positive Antwort des Servers wird optional und
  getrennt als `serverReply:{run,expires,level,at}` gespeichert.
  Sie ist **nicht** die Bestätigung eines bereits betretenen Runs
  und entriegelt keine Folgeaktion. Fremde Resume-IDs, negative,
  veraltete oder beschädigte Antworten werden nicht akzeptiert.
  Späte Antworten aus einer neuen Session dürfen den alten
  Journalzustand nicht umschreiben.
- Ein aktuell beobachtetes `character.cave` bleibt die einzige
  physische Runbestätigung. Falls eine positive Serverantwort und
  die tatsächlich beobachtete Instanz unterschiedliche Run-IDs
  nennen, ist der Status `conflict`; der Beleg wird nicht
  als normaler `observed-run` überschrieben. Fehlende Sichtbarkeit
  beweist **weiterhin keinen Exit**.
- Die bisherigen `canEnter/canResume/canVote/canExit:false`
  Kennzeichen des passiven Cave-Adapters bleiben ausdrücklich
  unverändert; `requestCaveEntry()` ist eine separate,
  ausdrücklich ausgelöste, journalgebundene Aktion. Ihr
  `true` bedeutet nur: vom Executor angenommen, **nicht**
  den bestätigten Eintritt.

## Tests und Nichtziele

Neue Offline-Regressionen decken fehlendes Prepared, genau einen
API-Aufruf, durable Dispatch-vor-Send, Storage-Failure, RPC-Throw,
Promise-Rejection, Server-Fehlerantwort, unpassende Run-ID, neues
Server-Receipt, erst späteren physischen Run, Reboot nach Exit-Unsicherheit,
Realm-/Session-/Party-Drift, Value-/Bank-/Serverhop-Sperren und
späte alte Antworten ab.

Nicht implementiert: unbeaufsichtigtes eigenständiges Betreten,
aktive Return-/Exit-Freigabe, automatische Gold-/Amber-Votes,
Cave-Combat und Loot sowie Crypt-/Cave-Liveabnahme. Der getrennte
signierte Ingame-Releasekanal bleibt unangetastet. Die Funktion
steht nur in neu gebauten, **nicht signierten Main-Runtime-Artefakten**
zur Verfügung und ist keine Behauptung einer Ingame-Bestätigung.
