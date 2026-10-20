# ALBot Konfigurator – Account-Bestands- und Verkaufslogik

Stand: 20.10.2026. Schritt 1: nicht-invasive read-only Grundlage.

## Stand vor dem Umbau

- Explizite \`sell\`-Regeln prüfen Menge, Preis, Schutz, Reservierungen und Transaktionsausgang, erzwingen aber nicht allgemein eine ökonomische Alternative-Analyse.
- \`keep + maxCount + excessAction=sell\` greift bei lokal verifiziertem Überschuss, nicht beim vollständigen Account-Bankbestand.
- \`bank\` mit \`maxCount\` ist **keine** accountweite Bank-Mengenobergrenze.
- \`accountPhysicalLedger.complete\` bezeichnet die vorhandenen frischen Quellen inklusive des aktuell sichtbaren Bankbereichs; es beweist keine vollständige Bankabdeckung über mehrere Maps.

## Neue read-only API

\`ALBot.previewAccountStock({name:'beewings',level:0},{keep:1000,targetCount:3000,maxCount:5000})\`

Liefert eine überschlägige Gesamtmenge der beobachteten Quellen, die Schutzgrenze und einen *provisorischen* Überschuss. Die Schutzgrenze berücksichtigt zusätzlich beobachtete Itemschutz- und Reservationsmengen konservativ. Da derzeit nicht alle Bank-Maps autoritativ vorliegen, ist \`status=unverified\` und \`saleAuthorized=false\`. Auch hypothetisch vollständig verifizierte Ergebnisse bleiben \`executable=false\`: Eine spätere ökonomische Bewertung und eine separate frische Dispatch-Prüfung sind zwingend.

Die API führt weder Banktransaktionen noch Käufe/Verkäufe aus und verändert die eingestellte persönliche \`ALBotConfig\` nicht.

## Nächste Schritte

1. Vollständigen Bank-Pack-Abdeckungsvertrag und accountweite Item-Reservierungen etablieren, ohne alte/stale Snapshots in Verfügungsrechte umzudeuten.
2. Eine eigene Wirtschaftlichkeitsentscheidung für explizite Verkäufe einführen (Herstellungs-/Exchange-/Marktalternative, Mindestpreis, fehlende Daten = behalten), mit ausdrücklich getrenntem Notverkaufsmodus.
3. Lagerziel und Verkaufsschwelle in einem neuen Itemregelvertrag zusammenführen; mit neuem ALBot-Konfigurator transparent pro Item darstellen.
4. CI/Browser/Headless-Grenzen und Merchant-Livetest abnehmen. Keinen Bootstrap oder signierten Release ohne diese Abnahme automatisch ändern.

Die vorhandene Runtime, Bankjournale und Releases werden nicht automatisch freigegeben.