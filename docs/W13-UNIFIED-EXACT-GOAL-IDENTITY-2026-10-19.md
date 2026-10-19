# W13 – Einheitlicher Vertrag für exakte Gear-/Produktionsvarianten

Stand: 19.10.2026 · vorheriges `main`: `a30c2aa17d2578aec60e45658e9928c7f566c58f`.

## Befund

Die kanonische Itemidentität umfasst die tatsächlich relevanten
Game-Attribute `name`, `level`, `stat_type`, `p`, `title`,
`acc`, `rid`, `l`, `b` und `data`. Ein Gear-/Produktionsziel
konnte jedoch zusätzliche Variantenschlüssel wie `q`, `src`
oder `owner` enthalten. Bei der Bildung von
`identity({...goal.variant})` wurden diese Schlüssel **nicht**
berücksichtigt: Ein als exakt bezeichneter Bedarf konnte dadurch
unbemerkt zu einem breiteren physischen Match werden.

Der Produktions- und Sendepfad, der W02-Bruttoreservierungsplaner
und der passive W10-Loot-Recipient-Hinweis hatten dafür bisher
unterschiedliche Prüfregeln.

## Umsetzung

- `verifiedExactGoalIdentity` in `src/core/policy.mjs` ist der
  gemeinsame Vertrag für eine echte exakte Zielvariante. Ausschließlich
  die bereits durch `identity` abgebildeten Itemattribute und
  fakultative, zum Elternziel passende Name-/Levelangaben sind erlaubt.
- Zusätzliche Felder, zyklische oder nicht serialisierbare Varianten,
  abweichende Itemnamen/-Level und übergroße Identitäten liefern
  **keine** exakte Autorisierung. Dies gilt auch für vollkommen
  erfüllte Ziele.
- `productionGoalMatchesItem`,
  `exactAutoDeliveryVariant`, `purposeReservations` und
  `lootPurposeEvidence` verwenden denselben exakten Nachweis.
  Dies verhindert voneinander abweichende Entscheidungen über
  die gleiche Variante.
- Gültige, auch opake physische `data`-Attribute behalten ihre
  vollständige Identität; generische Ziele bleiben explizit generisch.
- Bestehende manuell konfigurierte Editor-Itemregeln erhalten
  **keine** zusätzliche automatische Sendeberechtigung.

## Test und Restrisiken

Sieben Regressionstests prüfen die gleiche Variante über
Produktionsbedarf, automatische Senderegeln, Bruttoreservierungen
und passive W10-Empfängeranzeigen hinweg. Der Patch
ändert keine Bank- oder Gear-Wertjournale und keine persönlichen
Profile. Er erweitert keine Transferrechte, verifiziert keine
Ende-zu-Ende-Lieferquittung und veröffentlicht keinen signierten
Ingame-Release.

Die Liveabnahme im Spiel und die vollständige Accountallokation
bleiben offen.
