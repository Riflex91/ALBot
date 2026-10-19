# W03 – Bankgold mit exakten Handelszusagen und Live-Map-Nachweis (19.10.2026)

## Bereits vorhandenes System

`createBank.gold()` verwendet weiterhin den vorhandenen zentralen
`economy.perform('bank.gold')`-Wertjournalweg. Ein unbestätigtes
`bank_deposit` oder `bank_withdraw` wird nicht blind wiederholt. Die
bestehenden lokalen Goldreserven und die gebundenen Buy-Stand-Angebote
bestimmen den Zielbestand des Merchants.

## Behobene Lücke

Zuvor wurden stehende Buy-Stand-Preise und Mengen mit
`Number(...) || 0`, `Math.max` und gewöhnlicher Multiplikation
summiert. Ein ungültiger Wert konnte dadurch als null, eins oder
nicht-sichere Ganzzahl behandelt werden. Zudem genügte bislang die
bloße Existenz eines `character.bank`-Objekts, selbst wenn die
Bank-Map nicht mehr aktiv beobachtbar war.

## Umsetzung

- `bankGoldTransferPlan` summiert nur belegte aktive
  `trade1` bis `trade16`-Kaufgebote (`b=true`). Jeder Preis, jede
  Menge, jede Summe und jeder Transfer muss eine sichere nichtnegative
  Ganzzahl sein; Preis und Menge müssen positiv sein.
- Die übliche Goldzielhöhe bleibt
  `max(goldTarget, goldReserve, characterReserve) + commitments`.
  Aktuelle Salden und der Summenausdruck müssen ohne Überlauf
  berechenbar sein.
- Vor der Planung **und** beim tatsächlichen Dispatch muss mindestens
  ein Bankpack derselben aktuell beobachteten Map verfügbar sein.
  Offsite-Kopien von `bank.gold` sind kein Mutationsbeleg.
- Der Dispatch-Guard berechnet Gold, Bankgold, Handelszusagen und Ziel
  erneut. Preis-/Mengenänderungen, Stornierungen und Bankwechsel
  verwerfen den bereits eingeplanten Auftrag.
- Das vorhandene Bankgold-Wertjournal, Recovery- und Budgetsystem sowie
  persönliche Profile bleiben unverändert. Es werden keine neuen
  Wertoperationen erfunden.

## Abgrenzung

**Nicht abgeschlossen:** Eine auftragsbezogene Bankfinanzierung eines
konkreten `marketBuy` mit gebundener Listing-RID, Markt-Bank-Rückweg
und erneuter Preis-/Verfügbarkeitsprüfung ist weiterhin ein eigener
Entwicklungsschritt. Dieser Patch schützt die Basiskontrakte, er
erhöht nicht den Goldtarget allein aufgrund eines Angebots. Kein
signierter Release; keine Ingame-Liveabnahme.
