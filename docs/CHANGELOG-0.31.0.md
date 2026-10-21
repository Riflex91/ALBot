# ALBot 0.31.0-candidate – Loot-Rückstand bei freier Zielwahl

Stand 21.10.2026; Gameplay-Fix, Spiel-Liveabnahme offen.

## Ausgangslage
Live-Berichte dreier Farmer (0.29.0) meldeten in rund 20 Minuten 511, 480 und 402 beendete Loot-Aktionen bei 39–40 freien Slots. Das Video zeigt trotzdem viele Truhen am Bee-Spawn. Ein erfolgreicher loot()-Return beweist keinen Gegenstand. Unabhängige Zielwahl/AoE erhöht die Kill-Rate, während die alte Loot-Routine nur im Farmer-Tick nach früh beendenden Kampfzweigen lief.

## Änderungen
- Der zentrale Scheduler ruft den Loot-Rückstandscontroller unabhängig vom Kampftick auf. Der alte duplizierte Loot-Aufruf entfällt.
- Sichtbare Truhen werden nur mit belegten Karten-/Instanzkoordinaten und Inventarreserve als Ziele betrachtet. Maximal 128 pro kurzer Momentaufnahme.
- Einzelne sichtbare Truhen werden gezielt via loot(id) angesprochen; bei fehlender Sichtbarkeit bleibt loot() ohne ID erhalten. Bei vielen Truhen werden Aufrufe begrenzt beschleunigt; Wiederholsperren verhindern ständige Auswahl desselben Ziels.
- Bei mindestens sechs erreichbaren Truhen werden freiwillige neue Pulls maximal vier Sekunden unterbrochen; anschließend eine zehnsekündige Freigabe gegen dauerhafte Blockaden. Team-Notfallkampf, Heilung und Wertjournale behalten Vorrang.
- loot.backlog und loot.backlogYieldExpired melden Rückstand, keine physischen Beuteeingänge. Bestehende W10/W13-Bestätigungsgrenzen bleiben erhalten.
- Regressionstests prüfen gezielte Auswahl, Rate-Limit, begrenzte Pausen, Notfallschutz, Karten-/Instanz-/Inventarfilter und Headless-Fallback.

## Freigabe
Linux- und Windows-CI, vollständige Offline-Suite, kryptografische Signatur und Main-/Runtime-Bytegleichheit sind vor Freigabe Pflicht. Persönliche Konfiguration, V2-Loader, Public Key und URLs bleiben unverändert. Ingame-Liveabnahme offen.
