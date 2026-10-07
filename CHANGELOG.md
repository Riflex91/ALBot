# Änderungen

## 0.3.4-live-c · 7. Oktober 2026 · Native smart_move-Lebensdauer und sichere Checkpoint-Erholung

- Vier eindeutige 0.3.3-Headless-Berichte mit Profil `FIXED-2002` geprüft. Merchant startet sauber. Ranger 1/2 aktivieren `farm:bee`, wählen ein Bee-Ziel und starten `combat/smart_move`, bleiben aber nahezu am Startpunkt und werden weiterhin durch ALBots eigenen `movement.failed: no_progress`-Wächter abgebrochen. Kein Bee-Angriff nachgewiesen.
- Adventure Lands `smart_move` besitzt eigene Pfadsuche, Promise-Abschluss und Fehlerbehandlung. Deshalb wird der 12-Sekunden-Positions-Stallwächter jetzt nur noch auf normales `move` angewendet. `smart_move` bleibt bis zu seinem nativen Abschluss bzw. dem vorhandenen 120-Sekunden-Executor-Timeout in Besitz.
- Ranger 3 war durch einen alten persistenten `quest.monsterhunt`-Checkpoint blockiert. Ein Monsterhunt-Journal mit `cost=0`, `loss=0` und ohne Inventarslots ist keine Wertaktion und wird beim Start jetzt automatisch sicher bereinigt.
- Gezielter lokaler Modulharness: 6/6 Regressionen bestanden. Vollständiger Repository-Testlauf wurde in dieser Umgebung nicht ausgeführt.
- Persönliche Phase 02 neu als `02-regelwechsel-0.3.4-FIXED.js` mit eindeutigem Profil `Live C · 02-regelwechsel · FIXED-034` erzeugt. Live-Bee-Nachweis bleibt ausstehend.


## 0.3.3-live-c · 7. Oktober 2026 · Headless-Pfadsuche und manuelle Aufgabenpriorität korrigiert

- Vier echte Headless-Berichte mit `0.3.2-live-c` geprüft: alle Instanzen starten, aber kein Bee-Angriff; Ranger 1/2 melden mehrere `movement.failed: no_progress`, Ranger 3 wird nach aktivierter Bee-Regel zeitweise von Monsterhunt-/Economy-Bewegung verdrängt.
- Headless hält den `smart_move`-Suchzustand am Parent-Kontext. Die Stillstandserkennung liest deshalb jetzt `root.smart` oder `parent.smart`, damit laufende BFS-Pfadsuche nicht nach zwölf Sekunden fälschlich abgebrochen wird.
- Opportunistische Monsterhunt-/Anniversary-Aktionen geben einem aktiven manuellen Strategieauftrag Vorrang; ein `farm:bee`-Regelauftrag darf nicht unmittelbar von World-/Economy-Arbeit verdrängt werden.
- Die persönliche Phase-02-Testdatei wurde vollständig aus dem zuvor funktionierenden 0.3.1-Settings-Satz neu aufgebaut. Dabei bleiben AOE, Production, Events, Quests und Magiport wie im validierten Phase-02-Profil ausgeschaltet.
- Ein erster 0.3.3-Testexport stoppte beim Boot, weil das reine Berichtsfeld `omittedItemRules` versehentlich als Profilfeld serialisiert worden war. Die persönliche Phase-02-Datei enthält nun nur die zehn erlaubten Top-Level-Profilfelder; die Runtime blieb unverändert 0.3.3.
- Gezielte Movement-/Farmer-Regressionen laufen lokal 4/4 grün. Vollständiger Repository-Testlauf wurde in dieser Umgebung nicht ausgeführt. Live-Retest bleibt erforderlich.


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
