# N05 – zeitgebundener Nachweis für Spawn-Auslastungswechsel (19.10.2026)

## Problem

Ein 90 Sekunden lang beobachteter Spawn konnte im bisherigen Farm- und
Monsterhunt-Switch noch nach langer Zeit als vergleichbar ausgeleitet werden:
die eigentliche Switchentscheidung prüfte `evidenceSeconds` und
`pressureRatio`, nicht aber das Erfassungsalter `observedAt`.
Der bestehende Bereichsverlauf darf für allgemeine historische Renditen
verwendet werden, ist jedoch kein aktueller Beleg für Konkurrenzdruck.

## Änderung

`src/world/spawn-choice.mjs` nutzt für **druckbasierte** Wechsel nun die
gemeinsame Funktion `freshSpawnPressure(row, now)`:

- Jede Spawnfläche braucht unabhängig mindestens 90 Sekunden gültigen Verlauf.
- `observedAt` muss ein positiver sicherer Ganzzahlzeitstempel sein,
  darf nicht aus der Zukunft kommen und darf höchstens 15 Minuten zurückliegen.
- `pressureRatio` muss endlich und in `[0, 1]` liegen.
- Beide Belege müssen aktuell sein. Alte oder kaputte Werte aktivieren weder
  `verified-crowded-spawn-relief` noch
  `verified-less-crowded-hunt-spawn`.
- Bei fehlendem Nachweis bleibt der alte, gültige Farm-/Huntplan unter den
  bereits bestehenden Halte-, Reise- und Hysteresevorgaben bestehen.
  Gewöhnliche genehmigte Farmwechsel nach sonstigen Bewertungsregeln,
  priorisierte Missionen und die bestehenden Sicherheitsgates bleiben erhalten.

Dies ist ein enges N05-Integrationsinkrement. Es gibt weder neue Monster-
oder Spawnrechte noch neue Maps, Server-Hops oder automatische Respawnzeiten.
Ein Bereichsverlauf ist eine Beobachtung, keine Berechtigung für Spielaktionen.

## Prüfungen und Grenzen

`test/roadmap-n05-fresh-pressure.test.mjs` prüft frische, gerade noch gültige,
alte, künftige, fehlende und nicht endliche Beobachtungen sowie den Unterschied
zwischen einem echten Druckwechsel und einer bloßen historischen Schätzung.
Die bestehende Switch-Regressionsfixture erhält echte Zeitstempel.

Nachweise für Code-/CI- und Artefaktparität sind im zugehörigen PR abzulesen.
Es wurde keine Ingame-Liveabnahme durchgeführt. Der separat signierte
Ingame-Release und die persönliche Konfiguration bleiben unverändert.
