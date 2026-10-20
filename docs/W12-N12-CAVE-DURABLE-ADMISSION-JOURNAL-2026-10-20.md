# W12/N12 – persistentes Cave-Eintrittsjournal und Neustartbeleg (20.10.2026)

## Befund

Die bisherigen PRs #260, #262 und #263 implementierten sichere, **rein
lesende** Cave-Auskunft, zeitlich begrenzte `cave_info()`-RPCs sowie
eine konservative lokale Eintritts-/Resume-Vorprüfung. Die Belege
`lastObservedRun` und `entryPreflight` waren jedoch nur im
laufenden Arbeitsspeicher verfügbar. Nach CODE-Neustart oder
Verbindungswechsel konnte die vorherige aktive Instanz verschwinden,
ohne dass ein dauerhaftes Cave-Journal den erneut geplanten Eintritt
blockierte. Laut offizieller Serverimplementierung priorisiert
`open_generated_zone` einen Resume, während ein neuer Start
Tageskontingente, Charakterlocks, Team- und Socketprotokoll erfordert.

## Umsetzung

- Neues eigenständiges `src/world/cave-lifecycle.mjs`, gespeichert
  ausschließlich im benannten Charakter-Schlüssel
  `albot:cave-lifecycle:<charakter>`, **getrennt von
  Item-/Bank-/Goldjournalen und persönlicher Konfiguration**.
- `ALBot.prepareCaveEntry()` erstellt nach einer weiterhin
  gültigen lokalen Cave-Vorprüfung einen **persistierten,
  charakter-/realm-/sessiongebundenen** `prepared`-Eintrag.
  Dieser Schritt sendet **keine** `cave_enter`-Anfrage.
- Der getrennte, für einen späteren Executor vorbereitete Übergang
  `markDispatchUnknown()` muss **vor einem künftigen**
  `cave_enter()` dauerhaft geschrieben sein. Er ist im
  Hauptprogramm noch an **keinen** API-Sendeaufruf angeschlossen.
  Nach unbekanntem Dispatch gibt es **keinen** automatischen
  Wiederholungsversuch und keinen ungesicherten Clear.
- Ein tatsächlich gültiger, beobachteter
  `character.cave`-Run kann als `observed-run` persistiert werden,
  selbst wenn der Run vor dem Einbau des Journals begonnen wurde.
  Der Beleg behauptet nur: *dieser Charakter war auf der aktuellen
  servergebundenen Cave-Map sichtbar*. Er ist **keine**
  Quittung, dass ALBot die Instanz eröffnet oder einen früheren
  RPC erfolgreich abgeschlossen hat. Bei einer bloß beobachteten
  Instanz bleibt `dispatchAt:null`.
- Nach Neustart, fehlendem Sichtbeleg, fremdem Realm, beschädigtem
  Journal, Lese-/Schreibfehler oder ungesichertem Dispatch bleibt
  der Status **gesperrt**. Eine fehlende Cave-Map ist **kein**
  belegter Exit oder Tageskontingent-Refund. Ein Resume mit anderer
  Run-ID wird als Widerspruch erkannt. Gleichzeitige lokale
  Journaländerungen werden vor Überschreiben erneut erkannt.
- Nur ein **noch nie versandtes**, in derselben Session
  vorbereitetes Journal kann durch
  `ALBot.discardPreparedCaveEntry()` ausdrücklich verworfen werden.
  Dispatch-unknown, Observed-Run, fremde Session und beschädigte
  Persistenz können auf diesem Weg **nicht** entsperrt werden.
- `ALBot.status().caveLifecycle` zeigt `blocked`, `state`,
  `reason` und den sicheren ursprünglichen Journalbeleg.
  Alle Ausführungsflags `canEnter`, `canResume`, `canVote`,
  `canExit` bleiben **false**. Kein zusätzlicher Cave-Aufruf,
  keine automatische Rückkehr, keine Konto-Wertmutation.

## Tests und Grenzen

`test/roadmap-n12-cave-durable-lifecycle.test.mjs` testet
persistentes Prepared auf Reboot, dispatch-unknown ohne Replay,
Resume-Bindung, fremde Run-ID, bestätigte und später verschwundene
Serverinstanz, ein bereits laufendes/journalloses altes Cave,
inkonsistente oder fremde Persistenz, Schreibausfälle,
Sessionwechsel, beschädigte Daten, parallelen lokalen Drift
und sichere ausdrückliche Verwerfung vor Dispatch.

**Offen**: Die eigentliche sichere Einbindung eines einzigen
`cave_enter()` in den Executor, serverseitige Antwort- und
Ingame-Quittung, Cave-Combat, Abstimmungen, Loot/Exit und
vollständige Crypt-/Cave-Liveabnahmen. Diese Änderung ist
ein unabhängiger, persistenter Sicherheitsbaustein, **kein**
vollständiger automatischer Cave-Runner oder signierter Release.
