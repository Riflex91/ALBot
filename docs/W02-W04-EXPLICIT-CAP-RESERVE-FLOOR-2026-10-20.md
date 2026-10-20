# W02/W04 – konsistenter Schutzboden für explizite Bank-Reservefolgen

Stand: 20. Oktober 2026. Geprüfte Grundlage: `src/items/stock-policy.mjs`, `src/items/operating-stock.mjs`, `src/merchant/bank.mjs` und W04-Bankregressionen.

## Fehlende Verbindung

Bei expliziten Itemregeln mit `action=keep` und `excessAction=sell`
schützt der spätere Verkauf durch `boundedStockSurplus` den Boden
`max(maxCount, keep + teamReserve + tatsächlich reservierte Menge)`.
Das bereits vorhandene *vorbereitende* Bank-Reservestaging berücksichtigte
nur `keep + teamReserve + reservierte Menge` und konnte so eine echte
Bankentnahme beginnen, obwohl die danach physisch getragene Menge
unter `maxCount` bleiben würde. Die echte Bankentnahme wird ohnehin
durch das persistierte `single`-/`partial`-Journal bestätigt; ein
ungenützter Stagingvorgang beansprucht trotzdem Slots und Aktionen.

## Änderung

`bankOperatingReserveNeed` verwendet bei expliziten, unverändert
freigegebenen Keep-/Excess-Sell-Regeln nun denselben Schutzboden wie
`boundedStockSurplus`:

- `max(maxCount, keep + teamReserve + reservedQuantity)` als
  Schutzboden vor einem späteren Überschussverkauf.
- Ungültiges oder nicht-ganzzahliges `maxCount` sowie ein Überlauf
  in der Summenbildung verhindern die Planung.
- Normale automatisch abgeleitete Betriebsvorräte verwenden weiterhin
  den bisherigen Boden ohne zusätzliches erfundenes Maximum.
- Die W04-Planung fordert weiterhin den strikt **positiven lokalen**
  Überschuss `carried + observedLocalBank > protectedFloor`.
  Bloße Offsite-/Account-Kataloge gelten nicht als Erlaubnis.
- Die bereits bestehenden Einzelentnahme- und Teilentnahmejournale,
  Dispatchbelege, Recovery-Phasen, Slot-Sperren, Policy- und
  Wirtschaftsprüfungen bleiben unverändert. Reservestaging ist
  weiterhin **kein** Verkauf. Ein separater Scan und frische
  Quittungen müssen einen Verkauf erneut freigeben.

## Nachweis und Restgrenze

Neue W02/W04-Regressionsfälle decken explizite Obergrenzen, eine
getrennte spätere Verkaufsentnahme, fehlenden Überschuss, stärkere
Zweckreservierungen, ungültige Maxima und arithmetische Überläufe ab.

Nicht als vollständig erledigt behauptet werden alle W02-/W04-
Zwischenplatz- und Produktionsfolgen. Offlinetests sind keine
Ingame-Liveabnahme. Der unveränderte signierte Bootstrap-Kanal
und die persönliche Konfiguration werden nicht neu veröffentlicht
oder zurückgesetzt.
