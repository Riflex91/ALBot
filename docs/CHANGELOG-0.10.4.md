# 0.10.4-candidate · Logkorrekturen vom 14.10.2026

Basis: main `15c023f`. Neue Abläufe sind offline geprüft, noch nicht live bestätigt.

## Gold und Town

Farmer bieten ihren gesamten beobachteten Goldüberschuss über der eigenen Reserve in einer Übergabe an. `goldTransferMax` bleibt für bestehende Profile importierbar, wird aber nicht mehr als Stückelungsgrenze angewendet. Menge, Empfängersitzung, Reserve, dauerhafte Journale und beidseitige Bestandsbestätigung bleiben verbindlich. Nach dem Angebot neu verdientes Gold gehört zu einer späteren Übergabe.

Laufender Town-Kanal sperrt neue Gold- und Itemannahmen. Diese Angebote dürfen Town nicht mit `movement.stop()` abbrechen. Heartbeats melden Town und laufenden Fensterwechsel als Übergabesituation ohne Annahmebereitschaft.

## Beute und Bank

Farmer dürfen Produktionszutaten und für andere Charaktere reservierte Beute zum zentralen Merchant schicken. Fertige eigene Zielausrüstung sowie explizite Keep-Regeln und geschützte Items bleiben erhalten. Die Produktion behandelt den Ortswechsel zum Merchant nicht als Verkauf/Verbrauch der Reserven.

Ein abgelaufener Bankkatalog zählt nicht mehr als beobachteter aktueller Bankbestand. Produktion fordert erneut eine Bankinspektion an. Nur ein tatsächlicher Aufenthalt auf der passenden Bankmap kann den unveränderten Livebestand auffrischen. Slot-/Bankmutationen verwenden weiterhin ausschließlich Livearrays.

## Catch-up im Browser

Materialfarming gilt als gewöhnliche Levelarbeit: Nach Mindesthaltezeit und belegtem Levelabstand darf dort ebenfalls der schwächere Offline-Farmer nachrücken. Während Questarbeit wird der Levelausgleich aufgeschoben; dieser Aufschub darf nicht in eine Klassenrotation zu anderen Offlinecharakteren umschlagen. Bestehende Mindesthaltezeit und Levelabstand bleiben erhalten.

Im Browser sendet der Koordinator `accountSwap` an den ausgehenden Farmer. Dieser prüft Absender/Sitzung, Realm, Teilnehmer, Deadline, laufende Aufträge und Kämpfe; speichert den Incoming-Checkpoint und bestätigt den Auftrag. Er sichert den bestehenden CODE-Slot über die offizielle Persistenzfunktion, trennt seine eigene Socketverbindung und navigiert sein eigenes Spielfenster zum eintretenden Farmer im gleichen Realm mit demselben CODE-Slot. Keine CM-Codeausführung, keine zusätzliche Merchant-iframe-Sitzung.

Der eintretende Farmer übernimmt die neue ausgewählte Gruppe vor dem regulären Party-/Follow-Scheduler. Der Koordinator schließt erst nach Empfang von Bestätigung und frischem Incoming-Heartbeat ab. Eine gespeicherte Bestätigung wird nach Reload weiter abgeglichen. Alte Browser-Runner-Checkpoints werden nur gegen tatsächlich lokale Hilfsfenster und echte Peerzustände abgeglichen; sie starten keinen Ersatz-Farmer im Merchant-Fenster. Ein nicht erreichbares Incoming-Fenster bleibt ein offener Wiederherstellungsfall; kein zusätzlicher Blindstart.

Der vorhandene Headless-Host-Lifecycle bleibt erhalten. Gemischte Browser-/Headless-Fensterwechsel sind nicht live abgenommen.

## Produktionsdiagnose

Verweigerte Economy-Budgets nennen künftig den konkreten Grund und gegebenenfalls das benötigte Gesamtbudget sowie die Account-Sitzungsgrenze. Produktionsvorschauen protokollieren Chance, Kosten und Mindestchance. Wartende Produktionsschritte übernehmen nicht mehr einen zufälligen alten Merchant-Status als Sperrgrund.

Gold-/Verlustbudgets, konservative Account-Anteile, Mindestchancen, Verkaufsgrenzen und offene Wertjournale werden nicht aufgeweicht. Ein geblocktes Budget bleibt geblockt. Vorhandene Logs ohne Preview-/Risikowerte beweisen nicht jeden einzelnen Ablehnungsgrund.

## Prüfung

743 Node-Tests unter Windows bestanden, davon 18 neue Regressionen für die oben genannten Fehlergrenzen. Klassisches Bundle gebaut und syntaxgeprüft; 471.037 UTF-8-Byte für den Standardexport, unter dem Grenzwert 1.048.576. Persönliche Quellprofil-Konfiguration bei Runtime-Synchronisierung unverändert. Standalone-Werkstatt ebenfalls neu gebaut. Keine echten Transfers, Upgrades, Verkäufe oder Browser-Logins ausgeführt.
