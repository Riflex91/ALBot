# W02/W10 – Vollständig variantengetreue physische Ausrüstung im Account-Bestandsledger (24.10.2026)

## Ausgangsproblem

Der rein lesende Account-Ledger zählt ausgerüstete Gegenstände als physische, vollständig geschützte Kopien. Beim Übertragen des lokalen Ausrüstungs-Snapshots wurden bisher nur Name, Level, stat_type, p und title übernommen. Die für die exakte Variantenidentität relevanten Felder `acc`, `rid` und `data` gingen verloren. Dadurch konnten zwei in Wahrheit verschiedene Ringe, Ohrringe oder Umhänge falsch aggregiert werden. Außerdem wurden vor dem Herausfiltern leerer Equipment-Slots nur die ersten 24 Schlüssel berücksichtigt; eine später liegende belegte Position konnte unbemerkt verschwinden, obwohl die Ansicht weiterhin `complete:true` meldete.

## Änderung

Die Ausrüstungsaufnahme überträgt alle sieben bestehenden Variantenfelder (`stat_type`, `p`, `title`, `acc`, `rid`, `data`) unverändert in denselben bestehenden physischen Variantenprüfer wie Inventar und Bank. Null-Felder bleiben null; unbelegte Slots zählen nicht zum Limit von höchstens 24 belegten Slots. Wenn ein belegter Slot keine gültige Name/Level/Variantensignatur liefert, ein Item ein unbekanntes strukturiertes Attribut enthält oder mehr als 24 Slots belegt sind, wird **das gesamte Aggregat unverifiziert** (`complete:false`, leere publizierte Varianten, `equipped-variant-evidence-incomplete`). Es gibt keine Teilmengen-Freigabe bei Trunkierung.

Ein ausgerüstetes Stück bleibt unverändert als `protectedUnits:1`, `transferable:false` markiert. Dieses Ledger ist und bleibt **ausschließlich shadow-only**: keine automatische Verkaufserlaubnis, keine Bankentnahme, kein Versand und kein Equip-Dispatch. Die accountweite vollständige Mehr-Map-Bankdeckung ist nach wie vor **nicht** nachgewiesen.

## Offline-Regressionen

`test/roadmap-w10-account-stock-completeness.test.mjs` prüft identische vollständig modifizierte Varianten im Inventar und am Körper, variantenseparierende acc-Werte, mehr als 24 leere Slots vor tatsächlich belegter Ausrüstung, zu viele belegte Slots und ungültige spätere Varianten. Unvollständige physische Beobachtungen müssen den gesamten Account-Ledger blockieren.

Der bestehende signierte V2-Loader, persönliche ALBotConfig und private Signing-Keys bleiben unberührt. Ein erfolgreicher Offline-Test ersetzt weder tatsächliche serverseitige Material-/Gearübergaben noch W14-Ingame-Abnahme.
