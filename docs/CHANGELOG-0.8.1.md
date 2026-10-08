# Livekorrektur und Übergabetakt 0.8.1-full

Die vier Browserlogs vom 8. Oktober 2026 (Start 18:15 UTC, Dauer etwa 181–205 Sekunden) zeigen laufenden gemeinsamen Kampf, bestätigte Beuteübergaben und einen konkreten Goldfehler. Kein vollständiger P3/P4-Livenachweis: Produktion, Gear, Bank und Markt wurden in diesem kurzen Ausschnitt nicht vollständig durchlaufen.

## Befunde

- 14 Item-Übergaben an den Merchant, alle mit Accept, Bestandsbeobachtung und Abschluss; keine Item-Timeouts. Zusätzlich ein bestätigter NPC-Trankkauf. Keine Laufzeit-Incidents, keine verlorenen Logereignisse; performance_trick angefordert.
- Empfängerabschluss von Inventaraktionen median 0,516 Sekunden, Maximum 1,083 Sekunden. Senderabschluss median etwa 0,26–0,52 Sekunden. Die eigentliche Übergabe ist zügig; neue Angebote waren trotzdem an economyTickMs=2000 gebunden.
- Goldangebot des dritten Rangers wurde angenommen, aber send_gold wurde nie ausgeführt. Der Sender verlangte den exakt unveränderten Angebotsbestand; normale Farmbeute machte den Guard ungültig. Nach zehn Sekunden blieb gold.receive unklar und stoppte den Merchant. Andere angebotene Goldaufträge liefen ohne Annahme aus; das ist kein Nachweis verlorenen Goldes.
- Stadtbesorgung und gewöhnliche Abholung unterbrachen einander wiederholt. Town war zwar an, verlangte aber 30 Sekunden Zeitgewinn und verbot laufende Bewegung; dadurch wurde ein vorteilhafter Teleport oft gar nicht angefordert. Die alten Logs enthalten keinen separaten Town-Vergleich, deshalb ist keine einzelne blockierende Bedingung je Reise beweisbar.
- Bee wurde nach fehlender Gruppenbereitschaft unter Beschuss gesperrt. Danach wählte der Leader Snake und beide Follower übernahmen diesen Plan. Prat wurde ausdrücklich als zu riskant verworfen. Die Rangers wurden am Ende mit STOP angehalten; nur der Merchant hielt zuvor wegen unklarer Goldaktion an.

## Änderungen

Gold prüft direkt vor Dispatch den aktuellen Überschuss, Reserve, Sitzung und Entfernung und pinnt dann den tatsächlichen Versandbestand. Eine betrags- und auftragsgebundene Empfangsbestätigung plus beobachteter Abfluss beim Sender toleriert spätere normale Farmbeute. Ohne beobachteten Empfang gibt es weiterhin keine Bestätigung oder blinde Wiederholung.

Town wird mit laufender Bewegung verglichen; bei Zeitgewinn wird die Bewegung vor dem Kanal beendet. Standard-Mindestgewinn jetzt 3000 ms. Town reserviert die Bewegung bereits innerhalb der gemeinsamen Tick-Auswahl, wartet auf tatsächliche Ankunft und wird beim Stoppen abgebrochen. travel.compare/travel.town protokollieren Berechnung und Entscheidung. Gewöhnliche Abholung darf eine laufende Economy-Besorgung nicht ständig verdrängen; vorhandener ausführbarer Nachschub bleibt vorrangig.

Neue additive full/v1-Einstellung general.transferIntervalMs, Standard 250 ms. Neue Item-/Goldangebote folgen diesem Takt statt dem Economy-Takt; tatsächliche Guards, ein offener Auftrag pro Charakter, Bestandsabgleich, Budget und Sitzungsbindung bleiben bestehen. Der reale Tick ist die Untergrenze: ein langsamerer combatTickMs macht Übergaben ebenfalls langsamer. CM-Laufzeit, Server und Inventaränderungen bestimmen den tatsächlichen Gewinn; keine behauptete achtfache Gesamtbeschleunigung.

158 bestehende und gezielte Prüfungen bestanden unter Windows, einschließlich Farmbeute vor/nach Goldversand, nicht beobachteter Goldwirkung, bewegtem Merchant vor Town und Economy-Weg ohne Pickup-Pendel. Klassisches Bundle, Editor und Größenlimit geprüft. Die Korrekturen benötigen einen neuen gemeinsamen Livetest. Keine automatischen Logins, Shadow-Tests oder Änderungen an Client-Zugangsdaten.

## Bestehende Goldsperre

Ein Update löscht keine alten Wertjournale. Bei einem weiterhin wegen der alten gold.receive-Aktion gesperrten Merchant zunächst den tatsächlichen Goldbestand und die Senderlogs abgleichen. Die vorliegenden Logs zeigen keinen Goldversand und unveränderten Merchant-Bestand. Erst nach diesem Abgleich im pausierten Merchant-CODE-Kontext `ALBot.acknowledgeInventory(); ALBot.start();` verwenden. Das bestätigt die manuelle Bestandsprüfung, sendet selbst kein Gold und löscht keine Bank-/Budgethistorie. Bei abweichendem Bestand nicht bestätigen, sondern die neuen Logs prüfen.
