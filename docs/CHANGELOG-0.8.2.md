# Livekorrekturen 0.8.2-full

Die vier Browserlogs vom 8. Oktober 2026 mit Starts 18:31–18:32 UTC zeigen keine Laufzeit-Incidents und keine offenen Inventarjournale beim abschließenden manuellen STOP. Zwei Town-Reisen, neun Item-Empfänge und ein Item-Versand des Merchants sowie ein NPC-Verkauf und zwei NPC-Käufe sind bestätigt. Das ist kein vollständiger P3/P4-Livenachweis.

## Ursachen und Änderungen

- Goldangebote liefen teilweise ohne Annahme aus. Eine laufende Bewegung wurde als generelle Sperre behandelt. Der Merchant darf jetzt während einer gewöhnlichen Reise ein gültiges Angebot annehmen und hält für die Übergabe an. Offene Wertaktionen, Inventarsperren, Sitzungen, Entfernung und Reserven bleiben geprüft. Ein unangenommenes Angebot beweist keinen Goldverlust.
- Die Gruppe konnte an einem geplanten Farmort warten, obwohl alle dort sichtbaren passenden Gegner von der konkreten Risikoprüfung verworfen wurden. Der Leader sperrt dieses Ziel jetzt vorübergehend mit der bestehenden Fehlerabkühlung und wählt erneut. Sicherheitsgrenzen werden nicht angehoben. autoTargets=true erlaubt weiterhin Ziele außerhalb der ursprünglich benannten Goo/Bee-Liste.
- Produktions-, Regel-, Bank- und Zielansichten wurden innerhalb derselben Entscheidung wiederholt berechnet. Sie werden jetzt pro Tick wiederverwendet; Produktionsplanung folgt planningTickMs, bestätigte Inventaränderungen verwerfen veränderliche Ansichten. Unveränderliche Item-Eigenschaften werden begrenzt zwischengespeichert. Unveränderte Paneltexte und set_message-Ausgaben werden nicht wieder geschrieben. Mutationsguards prüfen weiterhin den tatsächlichen Bestand vor Dispatch.
- Neue schedulerTiming-Werte im Testbericht enthalten Tickanzahl, Gesamt-, Mittel-, letzte und maximale Tickdauer; scheduler.slow meldet Ticks über 100 ms höchstens alle zehn Sekunden. Die alten performance.elapsed-Werte messen Beobachtungsfenster, keine CPU-Dauer. Eine tatsächliche Verbesserung der Browserruckler muss der nächste Lauf zeigen.
- Die Planung zählt bei ausgeschalteter Teilentnahme größere Bankstapel nicht mehr als einzeln abrufbare Menge. Bei eingeschalteter Teilentnahme nutzt sie die vorhandene Teilentnahme mit temporärem Arbeitsbestand, persistentem Wiederanlauf und Rest-Rücklagerung.

## Persönliches Profil und Validierung

Auf ausdrücklichen Benutzerwunsch ist merchant.partialBank im persönlichen Vollbetriebsprofil eingeschaltet. Die allgemeine Schema-Vorgabe bleibt unverändert. Bestehende Schutzmerkmale, Reserven, Inventarplatzprüfungen und Budgets gelten weiterhin; keine Journale werden gelöscht. Autostart bleibt true. Browser und Headless erhalten dasselbe Bundle.

162 bestehende und gezielte Logikprüfungen unter Windows bestanden. Klassisches Bundle, Werkstatt und Größenlimit geprüft. Keine Shadow-Tests, automatischen Logins oder Spielaktionen. Die neuen Korrekturen und Bank-Teilentnahme benötigen noch die gemeinsame Livebestätigung; Linux-Livebetrieb und ein vollständiger Funktionsdurchlauf bleiben offen.
