# W02/W04 – Validierte Mengen- und Reservierungsbelege bei Kapazitätsverkäufen

Stand: 20. Oktober 2026.

## Befund

Die vorhandene `createStoragePlanner.lowQualityRule` verlangt
belegte Ersetzbarkeit, negative Gear-/Questnutzung, keine explizite
Itemregel, einen zulässigen Wert und Deckung der Produktionsreserve
sowie höchstens eines dokumentierten Rezeptbedarfs. Bei der letzten
Deckungsprüfung summierte sie jedoch die Mengen identischer,
unverschlossener lokaler und (nur bei Bankbesuch aktuell bestätigter)
Bankstacks über `q ?? 1` ohne Validierung jeder Einzelmenge.

Damit konnten ausdrücklich ungültige Mengen (`q:null`, gebrochene,
negative oder nicht-endliche Zahlen) trotzdem auf eine passende
Gesamtsumme führen. Noch kritischer: eine `NaN`-Reservierung konnte
`required=NaN` erzeugen, sodass der Vergleich
`held - saleQuantity < required` **false** zurückgab und ein
Kapazitätsverkauf trotz unbelegter Reservedeckung möglich war.

## Änderung

- Alle in den konkreten Variantenbeleg aufgenommenen, nicht geschützten
  lokalen und aktuell beobachteten Bankstacks müssen eine **positive,
  sichere Ganzzahl** aufweisen. Nur ein wirklich nicht vorhandenes
  `q` bedeutet eine Menge von eins; `null` tut dies nicht.
- Die Summe aller Komponenten muss ohne Safe-Integer-Überlauf
  rekonstruierbar sein. Ungültige Bank- oder Inventarstacks dürfen
  weder zulasten anderer Stacks kompensiert werden noch den
  berechneten Reserveboden aufblähen.
- Produktive, ausdrücklich ausgegebene Reservierungen sowie
  dokumentierte Rezeptmengen müssen nichtnegative, sichere Ganzzahlen
  sein. Eine vorhandene Reservefunktion mit `null`-/`NaN`-Antwort
  ist **unbekannt**, nicht automatisch Null.
- Die letzte Verkaufsmenge muss selbst gültig sein. Externe
  Account-Snapshots bleiben ohne Dispositionsautorität;
  Bankdeckung erfordert weiterhin den bisherigen lokalen Bankbesuch.

Unverändert bleiben: die bestehende manuelle Regelpriorität,
`itemPurposes`, Schutz von Equipment und Questgütern, Preis- und
Ersetzbarkeitsprüfung, die finalen Economy-Dispatchguards,
Produktions-/Bank-/Wertjournale und der signierte Ingame-Kanal.

## Nachweis und Grenzen

Neue Regressionen in `test/preventive-storage.test.mjs` decken
ungültige Verkaufs- und Schwesterstacks, korrupte Bankdeckungen,
Overflow, valide `q`-lose Einzelitems, fehlende Bankbeobachtung
sowie ungültige Produktionsreservierungen ab.

Dies ist eine eng begrenzte Sicherheitskorrektur, nicht die
vollständige W02/W04-Multiaktions-Recovery oder die W14-Liveabnahme.
