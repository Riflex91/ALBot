# 0.30.0-candidate — Farmer-Gear-Lieferung und Town-Reise (21.10.2026)

## Anlass
In den echten Browser-Logs der vier Charaktere (0.28) besitzt My_Merchant
`skullamulet +2`, während My_Ranger1 und My_Ranger2 ein Upgrade brauchen.
Die Brutto-Reservierung über beide Farmer und Merchant verhindert erst die
automatische Senderegel und anschließend den physischen Versand. Die bereits
eingebaute Merchant-Eigen-Equip-Sperre schützt nur vor dem falschen Träger.

Town-Teleports sind für Quest-Reisen zwar zeitlich vorteilhaft, werden aber
bei laufender Teamverteidigung abgebrochen. Der bisherige 30-Sekunden-Hold
beginnt fälschlich schon bei Teleportstart. Sichere Farmer-Farm-/Folgerouten
dürfen die gleiche beschleunigte Town-Reiseroute bisher nicht verwenden.

## Änderungen
- Nur für **fertiges, physisch vorhandenes Farmer-Gear** wird eine endliche
  Einzelzuordnung aus zulässigen Exemplaren gebildet. Höher priorisierte
  Farmer-Ziele bekommen zuerst ein Exemplar; Merchant-Eigenbedarf und weitere
  Farmer-Ziele ziehen dieselbe Kopie nicht virtuell mehrfach ab.
- Explizite Itemregeln, `keep`/`teamReserve`, geschützte Items,
  Variantenbindung und bestehende bestätigungsbedürftige Lieferjournale
  werden weiterhin angewendet. Ohne passende Ziele/Bestand kein Versand.
- Sowohl Erzeugung der `send`-Regeln als auch tatsächliche Transfermenge
  referenzieren denselben aktuellen physischen Gear-Anspruch. Der
  bestehende Gear-Allocation-Claim und der Receiver-Handshake bleiben Pflicht.
- Die Town-Zeitoptimierung gilt nun auch für sichere, explizit beauftragte
  Farmer-`farm`-, `follow`-, `regroup`- und `quest-escort`-Routen,
  nicht aber für `combat`, `kite`, `cohesion` oder `scout`.
- Beim Start/Dispatch verhindert eine nahe aktuell angreifende Team-Bedrohung
  den Town-Kanal. Nach einer fehlgeschlagenen/unterbrochenen Anwendung greift
  ein kurzer 4-Sekunden-Versuchsschutz, nicht die 30-Sekunden-Erfolgssperre.
  Nach bestätigtem Teleport bleiben 30 Sekunden Schutz erhalten.
- Keine neuen Loader-/Signierschlüssel und keine Änderung an der persönlichen
  `ALBotConfig`. Keine Umgehung von Inventar-/Value-Journalen.

## Regressionen und Freigabekriterium
Tests: Ein Amulett für zwei Farmer plus Merchant; Zuweisung des physischen
Exemplars; spätere Wiederzuordnung nach Zustandswechsel; expliziter Keep,
Level/Variant/Locked-Stock und tatsächliche Zwei-Kopien-Grenze; erlaubte
und verbotene Town-Owner; Team-Aggro-Sperre; Backoff nach unterbrochenem
Town-Kanal. Zusätzlich vollständige Linux-/Windows-CI vor automatischem
Main-Merge und signierte Bootstrap-Release-Workflow-Abnahme nach Merge.

Die Offline-Abnahme ist kein Ingame-Nachweis: Ein echter Merchant-zu-Farmer-
Send mit bestätigtem Gear-Equip und sichere Town-Reisen müssen anschließend
im Spiel erneut beobachtet werden.
