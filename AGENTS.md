# Arbeitsübergabe vom 10. Oktober 2026: v3-/ALFinal-Übernahmen

[Konkreter Arbeitsplan mit Quellbelegen und Abnahmekriterien](docs/UEBERNAHME-V3-ALFINAL-2026-10-10.md). **U01–U07 sind auf dem Draft-PR-Arbeitsbranch implementiert, nicht in main.** Stand der tatsächlichen Offlineabnahme 10. Oktober 2026: GitHub Actions unter Linux und Windows jeweils 200/200 Tests bestanden; gemeinsames Browser-/Headless-Bundle und Werkstatt gebaut, Bundle 283.384 UTF-8-Bytes, SHA-256 `dd95fed2673968e88e61eacffcab0ce11b83e5d4478d4776bc2fefd6845eb5d5`. Referenz: [CI-Lauf](https://github.com/Riflex91/ALBot/actions/runs/38077402402). U07 benutzt den offiziellen Progression Guide nur als zusätzliche, begrenzte Entscheidungsquelle; echter Browser-/Headless-Spiel-Livetest und Verfügbarkeit der offiziellen Headless-API sind offen. Kein Merge oder Deployment. Vor weiteren Änderungen den Arbeitsplan, den aktuellen PR und neue Main-Änderungen prüfen.

---

# Aktuell: fortlaufender Betrieb und Merchant-Planung 0.8.4-full

Auf Benutzerauftrag Runtimefehler/unklare Wertwirkung protokollieren und Scheduler weiterführen; Journale behalten und Wertaktionen sperren. Reentranten Itemtimeout korrigiert, ALFinal-artige Servicebindung/Rückwechselschutz, Auftragsabkühlung und lokale Bündelung integriert. [Befunde, Vergleich und Wiederanlauf](docs/CHANGELOG-0.8.4.md). 173 Prüfungen bestanden; neue Livebestätigung steht aus. Verkaufsgrenze 1.000.000 und Mindestchance 65 % erhalten. Historische Aufforderungen zum automatischen Pausieren bei Runtimefehlern sind durch diesen Auftrag ersetzt; keine Journale blind löschen.

---

# Aktuelle Merchant-Korrekturen 0.8.3-full

Gold-/Item-Aufträge gegen gegenseitige Blockade getrennt; Goldabbruch ohne Dispatch sitzungsgebunden abgleichen. Bei Platzmangel freigegebene Bank-/Verkaufsaufträge vor gewöhnlicher Besorgung auswählen. Upgrade-Scrollvorrat schützen. [Befunde, Einstellungen und alte Empfangssperre](docs/CHANGELOG-0.8.3.md). 168 Prüfungen bestanden; neue Livebestätigung steht aus. Keine Journale automatisch löschen, keine Verkaufslimits oder Mindestchancen verändern.

---

# Aktuelle Livekorrekturen 0.8.2-full

Bewegte Goldempfänger, Neuwahl bei ausschließlich zu starken sichtbaren Farmgegnern und nicht ausführbare Bank-Stapelplanung korrigiert. Wiederholte Berechnungen begrenzt, Ticklaufzeiten im Testbericht ergänzt. [Befunde und Grenzen](docs/CHANGELOG-0.8.2.md). 162 Prüfungen unter Windows bestanden; neue Livebestätigung steht aus. Persönliche Bank-Teilentnahme auf Benutzerwunsch aktiviert; allgemeine Vorgabe unverändert. Bestehende Journale und Budgets erhalten.

---

# Aktuelle Livekorrektur 0.8.1-full

Goldversand trotz laufender Farmbeute repariert, Town bei laufender Bewegung und geringerem Zeitgewinn, getrennten 250-ms-Übergabetakt eingebunden und Pickup-Pendel während Besorgung begrenzt. Vor weiteren Änderungen docs/CHANGELOG-0.8.1.md lesen. [Befunde, Änderungen und Umgang mit alter Goldsperre](docs/CHANGELOG-0.8.1.md). 158 Prüfungen unter Windows bestanden; neue Livebestätigung steht aus. Vorhandene Wertjournale werden nicht automatisch gelöscht.

---

# Maßgeblicher Implementierungsstand 0.8.0-full

Vor weiteren Änderungen docs/PARITAET-0.8.0.md lesen. F01–F03 und D01–D15 aus dem historischen v3/v4-Audit sind integriert; keine Gleichheit sämtlicher historischer Hotfix-Hilfsfunktionen behaupten. Gemeinsame Aktionsauswahl prüft Guards direkt vor Dispatch. Nicht ausgeführte Wertabsichten dürfen kein fremdes Journal abschließen. Gearzusage und Empfängerslot binden; vorhandene Gearquellen mit ihrem tatsächlichen Level anfordern. 154 gezielte Prüfungen unter Windows; neuer gemeinsamer Livetest und Linux bleiben offen. Profile, explizite Regeln, Budgets und Journale schützen. Keine Shadow-Tests, Updater oder automatischen Logins.

---

# Maßgeblicher Folgeaudit: v3/v4-Parität

Vor weiteren Paritätsänderungen docs/V3-V4-PARITAET-0.7.0.md lesen. 0.7.0 implementiert viele Grundmechanismen, aber nicht alle fachlichen Abläufe. F01/F02/F03 und D01–D15 bleiben offen; alte Formulierungen „alle Auditpunkte umgesetzt“ nicht als Vollständigkeitsnachweis verwenden. Das vollständige strukturelle Quelleninventar steht in docs/V3-V4-MODULINVENTAR-0.7.0.csv. Der Audit hat keine Runtime oder persönlichen Profile geändert, keine Spielaktionen und keine Shadow-Tests ausgeführt. Grundfunktionen erhalten und fehlende Entscheidungen in die bestehende Runtime/Werkstatt integrieren; keine zweite Architektur.

# Implementierungsauftrag 0.7.0-full

Vor Änderungen docs/AUTONOMIE-0.7.0.md lesen. Integrierte gemeinsame Planung und Economy; autoTargets/elixirs/optimizeGear/autoDisposition/farmConfidence/marketMinSamples/mluckTravel/autoHop sind optionale Ergänzungen zu full/v1. Bestehende Regeln und Budgets schützen. Keine Inventar-/Produktions-/Gearallokationsjournale pauschal löschen. Neue gemeinsame Livebestätigung und Linux fehlen. Keine Shadow-Tests, Updater oder automatischen Logins. Audit von 0.6.2 bleibt als historische Gegenüberstellung; aktuelle Grenzen stehen in der Autonomiematrix.

# Aktuelle Livekorrektur 0.6.2-full

Vor weiteren Änderungen docs/CHANGELOG-0.6.2.md lesen. Risikoprüfung über aktuelle Farmerwerte und konservative Schadens-/Zeitbudgets, persistente begrenzte Ziel-Sperre; keine Wertjournale löschen. Merchant-Economywege bis Ankunft/Timeout halten, sichere Logistik darf vorgehen. Erholung vor Economy. Neue Livebestätigung steht aus.

# Aktuelle Livekorrektur 0.6.1-full

Vor weiteren Änderungen docs/CHANGELOG-0.6.1.md lesen: Monsterhunt ist interact, kein Skill; Leader-Questbesitz ohne Inventarjournal. Alte genau identifizierte Fehlaufruf-Checkpoints werden gezielt migriert, echte Wertjournale bleiben geschützt. npcFor muss Händler ohne Kartenstandort überspringen. Browser-FSA ist optional, Downloadfallback verbindlich. 100 gezielte Prüfungen bestanden, neue Livebestätigung ausstehend.

# Aktueller Auftrag · Vollbetrieb 0.6.0-full

Der Nutzer beauftragte den gesamten integrierten Bot zum gemeinsamen echten Livetest; optionalen Updater ausdrücklich nicht einbauen. Vor Änderungen docs/VOLLBETRIEB.md lesen. Aktueller Vertrag src/config/full.mjs, albot.full/v1. Ein Betriebsprofil und ein Scheduler; keine getrennten Testabschnitte. Autostart true, Browser performance_trick. Fortlaufende benannte Diagnosedateien mit Grund/Ergebnis sind ausdrücklich autorisiert: Desktopausgabe über vorhandenen Client, Browser nach Ordnerfreigabe. 2048 RAM-Ereignisse, Dateien rotieren bei 16 MiB; keine Logs im localStorage. Historische Grenzen unten beschreiben alte Releases und schränken diesen Auftrag nicht ein. Keine Shadow-Tests oder automatischen Logins. Neue gemeinsame Livebestätigung und Linux bleiben ausstehend.

# Aktueller Folgeauftrag: vollständiges P3/P4

0.5.0-p3p4 schließt die P3/P4-Implementierungslücken. Vor Änderungen docs/P3-P4.md und docs/P3-P4-LIVE.md lesen. Gemeinsamer großer Test vorbereitet, noch nicht live bestätigt. Neues Schema src/config/p3p4.mjs; frühere A/B/C-Verträge und persönliche bestätigte Dateien schützen. Keine Shadow-Tests oder automatischen Logins. Updater außerhalb dieses Auftrags. Neue Ziellogik nur bei autonomy=true; explizite Item-Regeln, Reserven, Gold-/Verlustbudgets und bestätigter Wiederanlauf bleiben verbindlich.

# Arbeitsvertrag für ALBot

Live C mit `0.3.1-live-c` wurde am 7. Oktober 2026 vom Nutzer als vollständig bestanden bestätigt. Maßgeblich: docs/LIVE-C-ERGEBNIS.md; Schema `src/config/live-c.mjs`, Anleitung docs/LIVE-C.md und genaue Funktionszuordnung docs/INTEGRATIONSSTAND.md lesen. Bestätigung auf den vereinbarten Testablauf begrenzen; ausgeschaltete Optionen und Linux nicht pauschal als live geprüft darstellen. Der bisherige Entwicklungsauftrag bis Live C ist abgeschlossen. Keine automatischen Logins oder zusätzlichen Shadow-/Freigabephasen. Vorhandene Nutzerkonfiguration schützen. Optionaler automatischer Updater und die ausdrücklich genannten Optimierungslücken bleiben offen.

Vor einer Änderung README.md, ROADMAP.md, HOW-TO-USE.md, docs/RUNTIME-VERTRAG.md und docs/WORKSHOP-CONTRACT.md lesen. Für eine Portierung außerdem den passenden Abschnitt in docs/BOT-ANALYSE.md und die dort verlinkten Originalfunktionen lesen.

Der Folgeauftrag „mach weiter mit der roadmap“ autorisiert die nächste Entwicklungsstufe. Aktuell 0.4.0-merchant: Bank-Teilentnahme und Merrit-Receipt/Event-Abgleich; docs/MERCHANT-ERGAENZUNGEN.md lesen. Neue Ergänzungen sind offline geprüft, noch nicht live bestätigt. Bestätigte C-Dateien separat erhalten; neue persönliche Dateien separat ausliefern. Teilentnahme standardmäßig false, Autostart true. Offene größere Optimierungs-/Updaterblöcke bleiben offen.

- Live A hat kurze Browser-/Windows-Headless-Nachweise. Live B ist mit `0.2.2-live-b` in Browser und Windows-Headless vollständig bestanden; docs/LIVE-B-ERGEBNIS.md ist der maßgebliche Nachweis. P3/P4 sind trotzdem nur teilweise implementiert; offene Funktionsblöcke nicht aufgrund des bestandenen Live-Testpunkts als fertig markieren. Neue Profile/Exporte standardmäßig autostart: true; historische Artefakte nicht still ändern.
- Die Werkstatt für den vollständigen Bot ist vorhanden. `editor/lib/schema.mjs` ist der gemeinsame Konfigurationsvertrag. Die Runtime liest `globalThis.ALBotConfig` und liefert ein Paket nach docs/WORKSHOP-CONTRACT.md. Live A nutzt `src/config/live-a.mjs`, eine ausdrücklich reduzierte Ansicht desselben Vertrags mit eigener Schema-ID. Keine zweite Werkstatt bauen; keine unimplementierten Einstellungen als unterstützt ausliefern.
- Ziel ist EIN klassisches JavaScript-Bundle, identisch im Browser-CODE und in `CODE/main.js` des vorhandenen Clients. Kein Node-Zugriff im Bot. `document` existiert auch headless: nicht zur Laufzeiterkennung verwenden.
- Client 1.2.1 / API 1 ist der dokumentierte Ausgangspunkt. `parent.headless` und Fähigkeiten prüfen, einzelne Funktionen nicht nur aufgrund eines Versionsstrings voraussetzen. Browser-UI und `performance_trick` nur im Browser.
- Alle Spielfunktionen aus der Übernahmematrix erhalten. Keine Telemetrieplattform, kein komplettes Log-System, kein eigener Headless-Betrieb. Eine kompakte Statusanzeige und verständliche Fehlermeldungen sind erlaubt.
- Kein Shadow-Modus und keine Shadow-Tests. Drei gemeinsame Live-Testpunkte laut Roadmap. Dazwischen Syntax, Bundle-Größe und wenige gezielte Logiktests nur an wichtigen Grenzen oder bei konkreten Fehlern.
- Keine erneute allgemeine Adventure-Land-API-Recherchephase. Bestehende funktionierende Aufrufe und vorhandene Spielquellen verwenden; nur einen konkreten Widerspruch gezielt klären.
- Eine zentrale Stelle führt Spielaktionen aus. Direkt vor wertverändernden Aktionen Live-Inventar, Menge, Item-Eigenschaften, Budget und Empfänger prüfen. Ein Timeout ist kein Beweis, dass die Aktion nicht stattfand. Keine blinden Wiederholungen.
- Merchant- und Farmer-Regeln greifen auf EINEN Item-Regelsatz zu. Regeln nach Item-ID, Level, Eigenschaften, Rolle und Charakter; explizite Nutzervorgabe hat Vorrang vor automatischer Optimierung. Gesperrte/equippte/reservierte Items schützen.
- Lokale IPC braucht weiterhin Anwendungsbestätigungen für Aufträge. `queued` bestätigt keine Spielaktion. Keine Locks über `get`/`set`: Storage ist asynchron repliziert, ohne atomaren Compare-and-Swap.
- Namensgebundene Zustände und genau ein Bot pro CODE-Kontext. Kein fensterübergreifender Singleton, der beim Laden des zweiten Charakters den ersten beendet. Timer, Listener und offene Arbeit beim Stoppen/Ersetzen bereinigen.
- Typisierte Nachrichten statt übertragenem JavaScript. Kein `eval` aus CM oder IPC. Fremde Absender und unbekannte Nachrichtenversionen ignorieren.
- Keine Hostdateipfade, Konto-IDs, Tokens oder Zugangsdaten ins Repository. Nutzerkonfiguration nicht überschreiben.
- UTF-8-Bytes messen: harter Bundle-Grenzwert 1.048.576 Byte; Entwicklungsziel maximal 900 KiB inklusive Benutzerregeln. Keine künstliche Freigabe durch Erhöhen des Grenzwerts.
- Neue Dateien und Änderungen in ALBot vornehmen. Die Quellrepositories dienen als Referenz; ihre alten Freigabe-, Shadow- und Host-Workflows nicht in dieses Projekt kopieren. Alte Live-Nachweise sind Erfahrungen, kein Nachweis für den neuen Bot.
- Nach jeder Etappe ROADMAP-Status, tatsächlich geprüfte Ergebnisse und verbleibende Punkte knapp aktualisieren. Keine neue Bürokratie pro Feature und keine erfundenen Live-Ergebnisse.

- Der Folgeauftrag erlaubt ein begrenztes Testprotokoll. Kein vollständiges Log-/Telemetriesystem: 256 Ereignisse, 24 Fehler, periodische kleine Snapshots plus kompakte dauerhafte Aktions-/Logistikzähler; keine Zugangsdaten oder rohen Spiel-/Socketobjekte. Logs nicht im Browser-localStorage ablegen.
- Browserbetrieb fordert immer `performance_trick()` an, unabhängig von UI/Autostart; bereits spielenden Loop wiederverwenden. Headless niemals aufrufen. Der dritte Browser-Teamtest bestätigt persistenten Checkpoint und Teamkampf; `0.1.4-live-a` korrigiert Multi-Empfänger-Nachschub und ergänzt eine getrennte Nachschubschwelle. Die anschließenden Browser-/Headless-Läufe bestätigen diese Grundabläufe; docs/LIVE-A-ERGEBNIS.md beachten.

- Live B nutzt src/config/live-b.mjs. Nicht fertig integrierte Merchant-Optionen bleiben aus diesem Paket ausgeschlossen. maxActions begrenzt neue Economy-Regeln pro CODE-Instanz, nicht Lieferungen/Verbrauch, und bleibt bei Pause/Start erhalten. Ein Reload setzt nur diesen Zähler zurück, nicht persistente Gold-/Verlustbudgets. 0.2.1 beseitigte Merchant-Loot/Inventory-Starvation. 0.2.2 sendet dieselbe Offer-ID während der kurzen Offer-Phase erneut und stoppt Basis-Erwerb, sobald das zugehörige Upgrade-/Compound-Ziel erfüllt ist. Die vollständige Live-B-Kette 01–04 ist mit 0.2.2 in Browser und Windows-Headless bestanden; der Headless-Retest bestätigte `offer → accept → send → receipt → done` ohne Timeout.
