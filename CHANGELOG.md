# Änderungen

## 0.3.2-live-c · 7. Oktober 2026 · Bee-Pfadsuche und Regelbesitz korrigiert

- Vier Headless-Berichte des 0.3.1-Phase-02-Retests geprüft: kein `movement.failed` mehr, aber nur Ranger 3 aktivierte `farm:bee`; echte Bee-Angriffe wurden weiterhin nicht nachgewiesen.
- `smart_move`-Pfadsuche darf länger als zwölf Sekunden ohne Positionsänderung rechnen. Erst nach gefundener Route zählt fehlender Positionsfortschritt wieder als Fehler; dann wird nach drei Sekunden neu geplant und `movement.failed: no_progress` protokolliert.
- Ein expliziter, zeitlich begrenzter `farm:<ziel>`-Auftrag aus einer Verhaltensregel behält während seiner TTL Vorrang vor normalem Follow-/Wait-for-Team. Damit wird ein Bee-Auftrag nicht unmittelbar zurück zum Goo-Leader gezogen.
- Zwei gezielte Regressionen ergänzen genau diese Fehlerbilder. Der Bee-Live-Retest bleibt ausstehend; keine Live-C-Freigabe daraus abgeleitet.


## 0.3.1-live-c · 7. Oktober 2026 · Bee-Bewegung repariert

- Acht Browserberichte geprüft: Normalbetrieb ohne Incidents; Bee-Regeln ausgelöst, aber neun fehlgeschlagene Bewegungen. Fishing war in beiden verwendeten Profilen ausgeschaltet.
- Hinter Hindernissen zum tatsächlichen Monsterpunkt routen statt einen blockierten 60-Pixel-Zwischenpunkt an smart_move zu übergeben. Innerhalb der Angriffsreichweite den laufenden Weg beenden.
- Fehlgeschlagenen Weg sofort freigeben und nach drei Sekunden neu planen; verspätete Ergebnisse abgebrochener Wege dürfen keinen neuen Auftrag abbrechen.
- Merchant-Wartegrund anzeigen; der schnelle Farmer-Tick überschreibt Merchant-Auftragsmeldungen nicht mehr. Ohne freigegebenen Auftrag und bei ausreichenden Farmer-Tränken bleibt Warten vorgesehen.
- Testbericht ergänzt begrenzte movement.request/arrived/failed-Ereignisse und das aktuelle Bewegungsziel. Autostart bleibt true.
- 65 gezielte Prüfungen bestanden. Wiederholung des Bee-Wechsels im echten Spiel steht aus; [Auswertung](docs/LIVE-C-ERGEBNIS.md).

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
