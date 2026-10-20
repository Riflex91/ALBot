# W12/N12 – konservative Cave-Notfallpositionierung (20.10.2026)

Nach PR #283 können Ranger bei **einem einzigen bereits engagierten,
sichtbaren Nahkampfangreifer** einen kleinen lokalen Direktschritt beantragen,
falls sie verwundet sind. Dies ist KEIN autonomes Cave-Escape-Navigationsmesh,
kein Smart-Move, kein garantierter Treffervermeidungs- oder Bosskampfplan.

## Strikte Aktionserlaubnis

- Nur laufende eigene Farmer-Ranger mit 25–65 % aktueller HP, vollständigem
  lebendem Originaltrio, Cave-`observed-run`-Journal und frischer
  Realm-/Floor-/Serverzeit (maximal drei Sekunden) können vorprüfen.
- Der Heiler muss aktuell sichtbar sein, maximal acht Pixel zwischen
  sichtbarer Position und frischem Heartbeat abweichen, selbst mindestens
  70 % HP sowie mindestens 20 % MP haben und **keinen** gemeldeten Angreifer
  tragen. Der andere Ranger muss ebenfalls mindestens 70 % HP haben,
  auf demselben Floor sein und keine weitere Aggro melden.
- Die gesamte lokale Monsterliste darf genau einen noch aktiven Gegner
  auf dem Cave-Floor oder mit Ziel im Team enthalten. Dieser muss ein
  bestätigter eigener Nahkampfangreifer mit positivem HP, bekannter
  Reichweite 10–65 Pixel und identischer eigener Map/Instanz sein.
  Zusätzliche neutrale Cave-Monster blockieren, nicht nur zusätzliche Aggro.
- Gegnerattacke, Frequenz und Geschwindigkeit stammen aus dem
  offiziellen aktuell geladenen Monsterkatalog. Der Ranger muss
  mindestens etwa 18 % schneller sein (`monster.speed < 0.85 * hero.speed`).
  Zu geringe verbleibende Ranger-HP gegenüber zwei modellierten Hits
  sperren ebenfalls; es wird nie zukünftige Heilung, Potion, Block oder
  Dodge als garantiert verrechnet.
- Ein auswählbarer Direktschritt ist maximal 28 Pixel lang, vergrößert
  den Abstand zum Angreifer um mindestens 20 Pixel und behält zum
  Heiler höchstens 110 Pixel sowie zum anderen Ranger höchstens
  150 Pixel Abstand. Alle Kandidaten benötigen natives,
  positives `can_move_to`. Es erfolgt keine Erkundung, kein
  `smart_move`, keine Teleportation, kein neuer Pull oder Skill.
- Vor tatsächlichem `move` wird der Beleg vollständig neu erhoben und
  die Identität, HP, Ziel und Koordinaten des Monsters, aktuelle
  eigene Position/HP, Priest-Position, Run, Floor und exakt der
  Zielpunkt auf unveränderte Werte geprüft. Abgebrochene Belege
  stoppen einen laufenden Cave-Notfallschritt.
- Die Bewegung verwendet im zentralen Movement-Executor einen
  eigenen Owner `cave-evade`, maximal 45 Pixel allgemeine Cave-Grenze,
  nativen direkten `move` und die bestehende kontrollierte
  Bewegungsbeobachtung. Sie hat Vorrang vor dem Ranger-Basisangriff,
  **nicht** vor der Cave-Priest-Heilung.
- Bestehende Sicherheitsfreigaben für Lager, Handel, Journale,
  Browserrotation und Aktionskonkurrenz bleiben wirksam.

## Grenzen / Restarbeiten

Ein natives `can_move_to` beweist eine begehbare direkte Linie zum
Ziel, nicht die zukünftige Kollisionsfreiheit bei dynamischen Monstern
oder eine reale Treffervermeidung. Unbekannte Flure, mehrere Gegner,
ranged Monster, bewegende Priests, fehlende Heartbeats und
nicht bestätigte Floorwechsel sind nicht autonom begehbar.

**Noch offen:** Koordinierte Flucht bei Mehrfachaggro, vollständige
Priest-Kampfpositionskontrolle, generierte Cave-Geometrie/Navigation,
komplette Encounterstrategie sowie Live-Belege mit realen Drei-Charakter-
Cave-Runs. Die signierte Bootstrap-Runtime 0.17.0 / Sequence 17
enthält den neuen Schritt noch nicht: Code-Merge ist keine Signierung.

Tests: `test/roadmap-n12-cave-emergency-direct.test.mjs` und die
bestehenden N12-Bewegungs-, Kampf-, Heilungs- und Mehrgegnerregressionen.
