# W10/W02 – Mengenbelege im Account-Stock-Heartbeat (20.10.2026)

## Befund

Nach den W02/W04- und W03/W04-Mengenreparaturen vom 20.10.2026
verwendete `inventoryStockEvidence` weiterhin `entry.q ?? 1`.
Ein ausdrücklich vorhandenes `q:null` wurde als ein ungestapeltes Item
gezählt. Damit konnte ein vollständiger Peer-Heartbeat eine nicht belegte
Menge an die accountweite W10-Zielplanung melden. Zudem akzeptierte
`reconcileStockEvidence` manipulierte `reservedUnits` über der
physischen `quantity`, obwohl das Transportformat sie verwirft.

## Änderung

- Nur **fehlendes** `q` ist implizit eins. Explizit ungültige,
  gebrochene, nicht-endliche und unsichere Mengen invalidieren den Beleg.
- Bruttoreservierungen dürfen mehr als den lokalen Bestand betragen.
  Der physisch reservierte Anteil im Schattenbeleg wird auf den
  vorhandenen Bestand begrenzt. Die eigentlichen Bruttoansprüche,
  Budgets, Wertregeln und Verkaufsgrenzen bleiben unverändert.
- Eingehende Peerzeilen mit `reservedUnits > quantity` gelten als
  unvollständig und erlauben keine vollständige Schattenbilanz.

## Nachweis und Restgrenzen

`test/roadmap-w10-stock-heartbeat-quantity.test.mjs` prüft ungültige
Mengen, legale ungestapelte Items, übergroße Bruttoreservierungen,
Pack-/Unpack-Parität und manipulierte Peerbelege. Linux-/Windows-CI
sowie gemeinsame Runtime-/Editor-Builds müssen am finalen PR-Commit
bestätigt werden.

Das Stock-Ledger bleibt `shadow-only`, `authority:none` und
`executable:false`. W10/W13 und die vollständigen W02/W03/W04-Folgen
bleiben offen. Keine Ingame-, Cave-/Crypt- oder Cloud-Liveabnahme,
kein signierter Release und keine Änderung persönlicher Konfiguration,
Wertgrenzen oder Journale.
