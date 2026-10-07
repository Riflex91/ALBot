# Live C · Browser-Rückmeldung und Korrektur 0.3.1

**Aktueller Status: Live C bestanden laut Nutzerbestätigung vom 7. Oktober 2026 („die tests sind alle bestanden“), nach Auslieferung von 0.3.1-live-c.** Die Bestätigung gilt für den vereinbarten Testablauf einschließlich Bee-Wiederholung und Merchant-Nebenaufgabe. Es wurden dazu keine neuen Berichte geliefert; die Ausführungsumgebungen wurden in dieser Bestätigung nicht einzeln benannt. Kein zusätzlicher Linuxnachweis oder Nachweis für ausgeschaltete Boss-/Event-/Rotations-/Magiport-Optionen daraus abgeleitet. Die folgende Analyse dokumentiert den vorherigen fehlgeschlagenen Browserlauf und dessen Reparatur.

Acht Nutzerberichte vom 7. Oktober 2026, Runtime 0.3.0-live-c: vier Charaktere in Phase 01 und dieselben vier in Phase 02. Kein Phase-03-Bericht und kein Headless-C-Nachweis in diesem Dateisatz.

## Historischer Befund vor der Korrektur

- Phase 01: Drei Ranger farmen Goo und verwenden Tränke. Keine Incidents, keine ungeklärten Inventaraktionen.
- Phase 02: Bei allen drei Rangern wurden Bee-Regeln und Farmaufgaben ausgelöst. Danach neun `move: failed`-Incidents: zwei, drei und vier je Ranger. Kein Bee-Angriff nachgewiesen. Der Bee-Test ist somit nicht bestanden.
- Die feststeckenden Koordinaten und der Chase-Code erklären den Fehler: 60-Pixel-Schritte entlang der Luftlinie können auf Hindernissen enden. smart_move erhielt diesen Zwischenpunkt statt eines erreichbaren Monsterziels.
- Merchant in beiden Phasen: Fishing/Mining, Pickup, feste Position und Stand ausgeschaltet. Keine freigegebenen Verkaufs-/Produktionsaufträge. Farmer besitzen weit mehr als die Nachschubschwelle von 50 Tränken. Kein Lieferbedarf und kein aktiver Nebenauftrag; Warten ist hier korrekt.
- Merchant-Auftragsmeldungen wurden trotzdem irreführend vom schnellen Farmer-Tick mit „Merchant bereit“ überschrieben. Das war ein Statusfehler.
- Abschlussgrund „Entladen“ entspricht dem Export beim Ersetzen/Entladen der CODE-Instanz. Kein Beleg für einen Absturz. Alle acht Berichte enden ohne Wertjournal oder Inventarsperre.

## Korrektur und anschließend bestätigter Testablauf

0.3.1-live-c behält kurze begehbare Schritte bei und routet bei Hindernissen zum tatsächlichen Gegnerpunkt. Bei erreichter Angriffsreichweite wird smart_move gestoppt; fehlgeschlagene Aufträge werden unmittelbar freigegeben und nach drei Sekunden erneut geplant. Abgebrochene alte Wege beeinflussen neue Aufträge nicht. Berichte enthalten Ziel, Bewegungsart und begrenzte Bewegungsereignisse. Merchant meldet seinen Wartegrund und behält Auftragsmeldungen zwischen Economy-Ticks.

65 gezielte Bot-/Werkstattprüfungen unter Windows bestanden, darunter der konkrete blockierte Bee-Anlauf im klassischen Runtime-Bundle, Ankunft während laufender Bewegung, Fehlerfreigabe und alte Promise-Ergebnisse. Kein Shadow-Test und kein Spielstart durch die Entwicklung. Dies bestätigt die Korrekturlogik, noch keinen erfolgreichen Bee-Live-Lauf.

Für den Wiederholungslauf die neue Phase 02 auf alle vier Charaktere laden. Gemeinsam zu Bee reisen und echte Bee-Angriffe beobachten; anschließend Berichte sichern. Merchant darf dabei ohne Nachschubbedarf warten. Für seinen Angeltest separat Phase 03 mit vorhandener ungesperrter Rod verwenden; keine automatische Werkzeugbeschaffung hinzugefügt. Ablauf und Voraussetzungen: [LIVE-C.md](LIVE-C.md).
