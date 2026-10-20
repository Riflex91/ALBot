# W12/N12 – Cave Priest: abgesicherte Reichweitenkorrektur

Stand: 20.10.2026. Ergänzung nach #285, auf aktuellem `main`.

## Konkrete Funktion

Wenn **genau ein verletzter Ranger** (45–80 % HP) bei einem
bereits engagierten, einzelnen Cave-Nahkampfangreifer am Rand der
Heilreichweite steht (122–140 Pixel), kann der **Priest**
einen einzigen, höchstens **24 Pixel** langen **nativen Direktschritt**
in seine Richtung beantragen. Der Bewegungspunkt muss:

- den verwundeten Ranger bis auf höchstens 115 Pixel erreichen,
- den anderen sichtbaren, unverletzten Ranger innerhalb von 125 Pixel
  und selbst den einzigen Cave-Gegner mit wenigstens 120 Pixel Abstand
  beziehungsweise `range + 85` Abstand halten,
- aus einer vollständig bestätigten eigenen Cave-Instanz mit
  `observed-run`-Journal, identischem Floor und Serverzeit
  von höchstens drei Sekunden stammen,
- einen Priest mit wenigstens 85 % HP und 30 % MP sowie genau zwei
  direkt sichtbare Ranger mit frischen und konsistenten Heartbeats
  voraussetzen. Nur der betroffene Ranger darf 1 Aggro zählen,
  der zweite darf keine Aggro tragen,
- ein einziges sichtbares, bereits auf den Ranger gebundenes Monster
  und dessen endliche offizielle `attack`, `frequency` und
  begrenzte Nahkampfreichweite nachweisen. Ein zusätzlicher neutraler
  oder aktiver Cave-Gegner blockiert jeden Positionsschritt,
- `can_move_to` unmittelbar vor Bewegung positiv bestätigen.

## Konkurrierende Aktionen

- **Heilen hat Vorrang vor der Priest-Bewegung.** Eine bereits
  laufende Heil-Anforderung blockiert neue Positionsschritte.
- Eigenständiger Movement-Owner `cave-priest`, maximal 45 Pixel
  im zentralen Movement-Executor, tatsächlich beantragter Schritt
  nur 24 Pixel. Kein `smart_move`, Town, Blink, AoE oder Pull.
- Vor Dispatch prüft das System erneut die Position und HP von
  Priest/Rangern, aktuelle Aggrozahlen, Monster-Identität,
  Ziel, Position, HP, Typ, Reichweite, Monster-Definition,
  Run/Floor und den exakt ausgewählten Zielpunkt.
- Veraltete Belege oder ein laufender fremder Bewegungsauftrag
  verhindern eine zweite Aktion. Eine Positionsfahrt wird bei
  Belegverlust oder wieder freigegebener Heilung gestoppt.
- Kein autonomes Nachlaufen außerhalb der belegten Cave-Zone.

## Fehlende Roadmap-Arbeiten

Diese Positionierung ist **keine vollständige Gruppen-Flucht**:
Sie hilft ausschließlich bei einer sicheren Randposition in einem
Ein-Gegner-Encounter. Nicht unterstützt sind zweite Aggro,
unbekannte neutrale Gegner, dynamische Hindernisse, verschobene
Heiler oder Ranger, eigener Priest-Aggro, komplette Crypt-/Cave-Runs,
automatische Kampfentscheidungen und mehrstufiges Pathfinding.
Ohne positive native Direktwegfreigabe wird nicht bewegt.
Keine Signierung des Bootstrap-V2-Releases oder Live-Abnahme
durch diesen Merge.

Tests: `test/roadmap-n12-cave-priest-support-step.test.mjs`,
weitere Cave-Heal-, Ranger-Evade- und Teamprüfungen,
vollständige Linux-/Windows-CI und source-aligned
Runtime-/Editor-Build.
