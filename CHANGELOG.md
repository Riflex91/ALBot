# Änderungen

## 0.4.0-merchant · 7. Oktober 2026 · Ergänzungen noch nicht live bestätigt

- Neue ausdrückliche Bank-Teilentnahme: begrenzten Stapel entnehmen, gewünschte Menge splitten, Rest zurücklagern. Persistenter Zwischenstand, Vorrang vor anderen Inventaraktionen, Wiederanlauf und beidseitiger Mengenabgleich.
- Zwei additive optionale C-Felder: merchant.partialBank (Standard false), partialBankMaxStack. Bestehende A/B/C-Profile bleiben ladbar; die Werkstatt liest die neuen Felder aus dem Paket ohne Änderung am Formulargenerator.
- Merrit bestätigt eigene Shell-Ereignisse und neue eigene Receipts, ignoriert alte/fremde Receipts und beliebige Cash-Änderungen. Gültige Listings genauer geprüft; Eventlistener werden bereinigt.
- Separater persönlicher Export mit Normalbetrieb und zwei begrenzten Beispielaufträgen; bestätigtes C-Paket archiviert. Autostart true.
- 70 gezielte Prüfungen insgesamt bestanden, Paket-/Syntax-/Bytekontrollen. Kein neuer Spielstart. [Ablauf und Grenzen](docs/MERCHANT-ERGAENZUNGEN.md).

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
