# W02/W10 – Exact Variant Purpose Reservation

Stand: 19.10.2026 · Baseline `2388a642b3c4e769e22300e659865775da0bc6b5`

## Ist-Befund

Der bestehende `purposeReservations`-Planer berücksichtigt
rollen-/empfängergebundene Produktions-, Upgrade- und Gearbedarfe
gemeinsam und reserviert *Bruttobedarf* statt bereits gehaltene
Bestände freizugeben.

Bei exakten Varianten verwendete die alte Berechnung
`identity({name,level,...variant})`. Ein fälschlich gesetztes
`variant.name` oder `variant.level` überschrieb das eigentliche
Ziel. Dadurch konnten echte Bedarfsreservierungen mit einem fremden
Item/Levelbestand verrechnet oder bei `quantity(item)` dem
korrekten physischen Item nicht mehr zugeordnet werden. Das gefährdete
die gemeinsame Schutzmenge für Wertaktionen und Disposition.

Zudem konnte eine beschädigte physische Itemidentität mit zyklischem
`data` die erst nach Planung aufgerufene Mengenabfrage werfen.

## Umsetzung

- Bei jeder aktivierten exakten Zweckreservierung müssen Itemname,
  Level und Variantendaten zusammenpassen. Fremde `name`-/`level`-
  Overrides, Zyklen, nicht serialisierbare Daten und übergroße
  Identitäten sperren den betroffenen **gesamten** Plan.
- Unvollständige oder negative Lieferquittungen und ungültige
  Bedarfs-/Inventarzähler führen zu `blocked:true` und
  `quantity() = Infinity`. Unbekannte Ware gilt nicht als frei.
- Die spätere Mengenabfrage gibt auch bei beschädigtem
  Bestands-Item oder Überlauf den konservativen Schutzwert
  `Infinity` zurück, statt eine Exception oder einen
  ungeschützten Überschuss auszugeben.
- Bereits nachgewiesen übererfüllte, inzwischen gesenkte Ziele
  gelten als erfüllt und blockieren nicht unnötig andere
  erlaubte Produktionsziele.
- Die bestehende Aufteilung generischer und exakter
  Varianten, Upgrade-/Rezept-Rekursion und Empfängerpriorität
  bleibt erhalten. Keine zusätzliche Wertaktion oder neue Regel.

## Testumfang und Abgrenzung

Acht neue deterministische Regressionstests decken spoofed
Name/Level, zyklische Varianten, beschädigte Bestandsproben,
exakt/generisch geteilte Stockpools, korrupte Delivery-Counts
und übererfüllte Ziele ab. Keine Änderungen an persönlichen
Profilen, Accountbudgets, Wertjournalen oder signiertem
Bootstrap. Die vollständige Live-Abnahme bleibt offen.
