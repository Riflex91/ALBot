# Live C · Browser-Rückmeldung und Korrektur 0.3.1

Acht Nutzerberichte vom 7. Oktober 2026, Runtime 0.3.0-live-c: vier Charaktere in Phase 01 und dieselben vier in Phase 02. Kein Phase-03-Bericht und kein Headless-C-Nachweis in diesem Dateisatz.

## Befund

- Phase 01: Drei Ranger farmen Goo und verwenden Tränke. Keine Incidents, keine ungeklärten Inventaraktionen.
- Phase 02: Bei allen drei Rangern wurden Bee-Regeln und Farmaufgaben ausgelöst. Danach neun `move: failed`-Incidents: zwei, drei und vier je Ranger. Kein Bee-Angriff nachgewiesen. Der Bee-Test ist somit nicht bestanden.
- Die feststeckenden Koordinaten und der Chase-Code erklären den Fehler: 60-Pixel-Schritte entlang der Luftlinie können auf Hindernissen enden. smart_move erhielt diesen Zwischenpunkt statt eines erreichbaren Monsterziels.
- Merchant in beiden Phasen: Fishing/Mining, Pickup, feste Position und Stand ausgeschaltet. Keine freigegebenen Verkaufs-/Produktionsaufträge. Farmer besitzen weit mehr als die Nachschubschwelle von 50 Tränken. Kein Lieferbedarf und kein aktiver Nebenauftrag; Warten ist hier korrekt.
- Merchant-Auftragsmeldungen wurden trotzdem irreführend vom schnellen Farmer-Tick mit „Merchant bereit“ überschrieben. Das war ein Statusfehler.
- Abschlussgrund „Entladen“ entspricht dem Export beim Ersetzen/Entladen der CODE-Instanz. Kein Beleg für einen Absturz. Alle acht Berichte enden ohne Wertjournal oder Inventarsperre.

## Korrektur und nächste Prüfung

0.3.1-live-c behält kurze begehbare Schritte bei und routet bei Hindernissen zum tatsächlichen Gegnerpunkt. Bei erreichter Angriffsreichweite wird smart_move gestoppt; fehlgeschlagene Aufträge werden unmittelbar freigegeben und nach drei Sekunden erneut geplant. Abgebrochene alte Wege beeinflussen neue Aufträge nicht. Berichte enthalten Ziel, Bewegungsart und begrenzte Bewegungsereignisse. Merchant meldet seinen Wartegrund und behält Auftragsmeldungen zwischen Economy-Ticks.

65 gezielte Bot-/Werkstattprüfungen unter Windows bestanden, darunter der konkrete blockierte Bee-Anlauf im klassischen Runtime-Bundle, Ankunft während laufender Bewegung, Fehlerfreigabe und alte Promise-Ergebnisse. Kein Shadow-Test und kein Spielstart durch die Entwicklung. Dies bestätigt die Korrekturlogik, noch keinen erfolgreichen Bee-Live-Lauf.

Für den Wiederholungslauf die neue Phase 02 auf alle vier Charaktere laden. Gemeinsam zu Bee reisen und echte Bee-Angriffe beobachten; anschließend Berichte sichern. Merchant darf dabei ohne Nachschubbedarf warten. Für seinen Angeltest separat Phase 03 mit vorhandener ungesperrter Rod verwenden; keine automatische Werkzeugbeschaffung hinzugefügt. Ablauf und Voraussetzungen: [LIVE-C.md](LIVE-C.md).


## Headless-Retest mit 0.3.1 – noch nicht bestanden

Vier Berichte vom 7. Oktober 2026, Profil `Live C · 02-regelwechsel`, Runtime `0.3.1-live-c`: Merchant sowie drei Ranger.

- Der frühere direkte Bewegungsfehler ist nicht mehr sichtbar: Ranger 1 meldet 123 `movement.request` und 122 `movement.arrived`, Ranger 2 122/121, Ranger 3 128/118; kein Bericht enthält `movement.failed`.
- Ranger 1 und Ranger 2 enden im Goo-Betrieb. Ranger 3 löst den Bee-Regelauftrag aus (`strategy.request: farm:bee`, `behavior.rule`, `strategy.manual.id: bee`) und endet mit „Unterwegs zu bee“.
- Ranger 3 enthält im gesamten Bericht keinen `attack`-Aktionsblock. Damit ist weiterhin kein echter Bee-Angriff nachgewiesen; Phase 02 bleibt nicht bestanden.
- Die Bewegungsfolge zeigt die nächste Ursache: ein `combat`-`smart_move` zum tatsächlichen Bee-Punkt bleibt während der Pfadsuche zunächst ohne Positionsänderung. Der bisherige 12-Sekunden-Fortschrittswächter beendet diesen Auftrag, obwohl `smart_move` noch seinen kollisionsbewussten Pfad berechnet. Weil das kein Promise-Fehler ist, entstand dabei auch kein `movement.failed`.
- Zusätzlich kann ein Farmer mit aktivem `farm:bee`-Regelauftrag von der normalen Follow-/Wait-for-Team-Logik wieder zum noch Goo-farmenden Leader gezogen werden. Das erzeugt Ziel-Pingpong, wenn nicht alle Farmer gleichzeitig die Regelbedingung erfüllen.
- Der Merchant wartet korrekt ohne freigegebenen Auftrag/Nachschubbedarf und endet ohne Journal oder Inventarsperre.

### Korrektur 0.3.2-live-c

- Solange `smart_move` noch aktiv nach einem Pfad sucht, gilt fehlende Positionsänderung nicht als Bewegungsstillstand. Das bestehende absolute Executor-Timeout bleibt erhalten.
- Nach gefundener Route führt echter Stillstand weiterhin zum Abbruch, wird jetzt als `movement.failed` mit Grund `no_progress` protokolliert und nach drei Sekunden neu geplant.
- Ein expliziter `farm:<ziel>`-Auftrag aus der Regelengine hat während seiner TTL Vorrang vor normalem Follow-/Wait-for-Team. Außerhalb eines solchen Auftrags bleibt die Gruppenleine unverändert.
- Gezielt geprüft wurden der lange `smart_move`-Suchzustand mit anschließendem No-Progress-Retry sowie der Bee-Regelauftrag bei entferntem Goo-Leader. Das ist kein Live-Nachweis.

Für den nächsten Retest Phase 02 mit `0.3.2-live-c` laden. Erfolg verlangt weiterhin mindestens einen tatsächlich beobachteten Bee-Angriff eines regelgesteuerten Farmers; bei mehreren gesunden/freien Farmern sollen deren Bee-Regelaufträge ebenfalls nicht zum Goo-Leader zurückspringen.


## Headless-Retest mit 0.3.2 – noch nicht bestanden

Vier Berichte vom 7. Oktober 2026, Profil `Live C · 02-regelwechsel`, Runtime `0.3.2-live-c`.

- Alle vier Instanzen starten erfolgreich mit 0.3.2; der vorherige Konfigurations-Bootfehler ist damit beseitigt.
- Ranger 1 und Ranger 2 aktivieren die Bee-Regel jeweils zweimal, melden aber vier bzw. fünf `movement.failed: no_progress`. Kein Ranger-Bericht enthält einen `attack`-Aktionsblock.
- Ranger 3 erreicht zunächst mehrere Movement-Ankünfte, aktiviert `farm:bee`, wird danach aber von einer Economy-/Monsterhunt-Bewegung verdrängt. Das zeigt eine zweite Prioritätslücke außerhalb der bereits korrigierten Follow-/Wait-for-Team-Logik.
- Der Headless-Lauf legt außerdem offen, dass der `smart_move`-Suchzustand am Parent-Kontext liegt. 0.3.2 prüfte nur `root.smart`; deshalb konnte aktive Pfadsuche weiterhin fälschlich als Stillstand gewertet werden.
- Die verwendete persönliche 0.3.2-Testdatei enthielt zusätzlich versehentlich aktivierte Optionen (u. a. AOE, Production, Events/Quests und Magiport), die im zuvor funktionierenden Phase-02-Profil ausgeschaltet waren. Dieser Exportfehler wird nicht als Botverhalten gewertet.

### Korrektur 0.3.3-live-c

- Movement liest den Smart-Move-Zustand aus `root.smart` oder `parent.smart`.
- Monsterhunt und Anniversary starten nicht, solange ein manueller Strategieauftrag aktiv ist.
- Die persönliche Phase-02-Datei wurde aus dem zuvor funktionierenden 0.3.1-Settings-Satz neu erzeugt; AOE, Production, Events, Quests und Magiport sind dort wieder ausgeschaltet.
- Der nächste gültige Live-Nachweis benötigt weiterhin mindestens einen echten Bee-Angriff. Vollständiger Repository-Testlauf wurde in der Entwicklungsumgebung nicht ausgeführt; gezielte Movement-/Farmer-Regressionen laufen 4/4 grün.
