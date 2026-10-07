# Änderungen

## 0.3.0-live-c · 7. Oktober 2026 · Live C ausstehend

- Bestätigten 0.2.2-Stand übernommen: Merchant-Loot-Fix, gleicher Offer-Retry und kein unnötiger Basiseinkauf nach erfülltem Upgradeziel.
- Tatsächliches C-Schema für bestehende Werkstatt; Wenn–dann-Regeln, erlaubte Aufgaben und Level-0-Nachschubanfragen.
- Faire Merchant-Aufträge mit Haltezeit/Alterung und explizitem Bank-/Hinweis-Fallback.
- Fishing/Mining mit G-Zonen, Offhand-/Toolwechsel und persistentem Rückwechsel; Merrit-Standplanung, Ponty mit Preis-/Mengen-/Budgetgrenzen.
- Erlaubte Boss/Event-Aktivität, Monsterhunt, Anniversary, Karten-/Risikofilter, begrenztes Farmranking.
- Accountwahl/Catch-up und wiederanlauffähige Rotation; Paladin-Auren; vereinbarter Magiport und expliziter Team-Realmwechsel.
- Ziellieferungen werden persistent und nach Transfer-ID gezählt; Reload erzeugt keinen erneuten bereits bestätigten Produktionsbedarf.
- Status/Testbericht enthält Aufgaben-, Account-, Welt-, Service- und Reisezustand. Unverändert begrenzter Testbericht, kein Voll-Logsystem.
- Neue Exporte mit Autostart true, alte A/B-Artefakte erhalten. B-Exporter verwendet das archivierte geprüfte B-Paket.
- Ausführung, Grenzen und Testumfang: [LIVE-C.md](docs/LIVE-C.md), [INTEGRATIONSSTAND.md](docs/INTEGRATIONSSTAND.md). Linux und neue C-Funktionen nicht als live bestanden markiert.

## 0.2.2-live-b

Vollständige vereinbarte Live-B-Kette in Browser und Windows-Headless bestanden. Temporär nicht angenommene Lieferangebote werden mit derselben ID wiederholt; erfüllte Upgrade-/Compound-Ziele unterdrücken neue Basisbeschaffung.

## 0.2.1-live-b

Merchant überspringt Farmer-Loot, damit Bank-/Economy-Arbeit das Inventar nutzen kann.
