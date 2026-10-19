# W10/W13 – bestätigtes eigenes Loot priorisiert bestehende sichere Abgaben

Stand: 19.10.2026; auf Basis der rein diagnostischen W10/W13-PRs #185 und #186.

Die vorhandene Teamlogistik hat bereits zweiphasige `send_item`-Angebote, authentifizierte Session-Bindung, überprüfte physische `sendRule`-Reservierungen, ein persistentes Wertjournal, Empfängerzustimmung, einen beobachteten Bestandsschwund beim Sender, einen Bestandszuwachs beim Empfänger sowie abgeschlossene Transfer-IDs. Diese Kette ist die **einzige Ausführungsbefugnis** für Teamtransfers.

## Neue Scheduling-Heuristik

Ein Farmer, für den `cfg.merchant.pickup===true` und ein Merchant-Name gesetzt sind, betrachtet vor seinem bestehenden Angebotsdurchlauf die rein passiven `lootReceipts.purposeHints`. Nur eigene serverseitig zugewiesene **und physisch bestätigte** Lootbelege mit einem exakten kanonischen `variantIdentity`, einem positiven `observedUnits` und einem jetzt **über Bruttoreserven und geschützte Exemplare hinaus freien** `uncommittedEstimate` dürfen die Reihenfolge bestehender Inventarslots beeinflussen.

- Eine belegte Menge erzeugt höchstens genauso viele bevorzugte Slotkandidaten; doppelte Hints können das Prioritätskontingent nicht erhöhen.
- Bei ungültiger, fehlender oder unvollständiger Diagnostik bleibt die bisherige Inventarreihenfolge erhalten.
- Ein geschütztes Item wird nie allein wegen des Lootbelegs bevorzugt.
- Alle Kandidaten laufen **unverändert** durch `sendRecipients`, `sendRule`, `availableTransfer`, `peerReadyForHandoff`, `allocation.offer/guard/reserve`, `potionRoom`, den bestätigten Empfangsvertrag und `bot.beginValue/endValue`. Das neue Feld `variantIdentity` ist ein Diagnosewert, **keine neue Itemregel und kein Berechtigungsbeleg**.
- Die bestehende Merchant-Priorität für dringende Versorgung und andere Rollen bleibt unverändert; dieses Paket ordnet ausschließlich vorhandene Farmer-Abgabeversuche.

Damit können belegte frisch eingesammelte Gegenstände bei bereits erlaubter Abgabe bevorzugt an den Merchant gelangen, ohne einen gesperrten oder für eigenes Gear benötigten Bestand zu entziehen. Das ist **kein** neues automatisches Abgeben unautorisierter Items, keine autonome Merchant→Farmer-Gearverteilung, keine accountweite finale Rewardallokation und kein Ersatz eines Live-Tests.
