# W12/N12 – Cave-Schonung ohne Overworld-Rückzug (20.10.2026)

## Problem

Mit PR #273 verfügt die Cave bereits über instanzgebundene
Priest-Einzelheilung. Im Farmer-Ablauf wird jedoch weiterhin
`recover()` vor der Cave-Verzweigung ausgeführt.
Ein Charakter unter der gewöhnlichen `restBelow`-Schwelle
konnte deshalb die normale `roadTravel()`-, `retreat()`-
oder `skills.rotation(null)`-Behandlung erreichen.
Diese Routen und Skills sind **keine** instanzgebundenen Cave-Aktionen
und können die dynamische Map, Priest-Nähe und Zielzulassung ignorieren.
Besonders beim angeschlagenen Priest wurde so die neu eingeführte
Cave-Heilung durch die normale Recovery vorzeitig unterbrochen.

## Korrektur

- Eigene `inCaveInstance(c)`-Grenze **nach** der vorhandenen
  Sicherheitsversorgung mit HP-/MP-Tränken und einfacher Regeneration,
  aber **vor** allen gewöhnlichen Overworld-Rest-/Flucht- und
  Skillrotationspfaden.
- Bei niedrigem Cave-HP setzt die Routine ein diagnostisches
  Schonungsmerkmal und entfernt das normale Farmziel.
  Danach geht die Steuerung weiter in die Cave-Verzweigung von
  `farmer.tick()` statt zu `roadTravel()`, `retreat()`
  oder `skills.rotation(null)`.
- Die Cave-Verzweigung beendet weiterhin alte Farm-,
  Follow- und Escort-Routen. Der dedizierte Priest-Heal-Executor
  darf bei unter 70 % eigener HP durch das abgesenkte
  `caveTeam.healStatus()` weiter arbeiten. Ranger-Grundangriffe
  bleiben bei unzureichender Teamgesundheit gesperrt.
- Der unveränderte Todes-/Respawnpfad und die ursprüngliche
  dringende Verbrauchsmaterialversorgung stehen weiterhin vor
  dieser Grenze. Außerhalb der Cave ändert sich die Recovery nicht.

## Nachweise und Grenzen

Neue Integrationstests setzen einen Priest auf 10 % und einen Ranger
auf 15 % HP, während noch eine alte Follow-/Farmroute und ein
Overworld-Ziel vorhanden sind. Nach dem Farmer-Tick darf weder
`movement.go()` noch gewöhnliche `skills.rotation(null)` laufen.
Der Priest heilt stattdessen nachweislich den eigenen kritischen
HP-Zustand über die Cave-spezifische Routine, der Ranger
unterlässt Angriffe und Pulls. Die gesamte bisherige Cave-
Combat-/Healing-/Team-/Recovery-Suite wird zusätzlich geprüft.

Offen: sichere Cave-Bewegungs-/Fluchtstrategie, mehrere
Angreifer, Gruppenheal, Killbelege, Crypt-Lifecycle und
echte Ingame-Liveabnahmen. Keine signierte neue Runtime.
