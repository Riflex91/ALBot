# Arbeitsvertrag für ALBot

Vor einer Änderung README.md, ROADMAP.md, HOW-TO-USE.md, docs/RUNTIME-VERTRAG.md und docs/WORKSHOP-CONTRACT.md lesen. Für eine Portierung außerdem den passenden Abschnitt in docs/BOT-ANALYSE.md und die dort verlinkten Originalfunktionen lesen.

- Dieses Repository beginnt mit Planung. Der Auftrag vom 6. Oktober 2026 autorisiert Analyse und Roadmap, noch keine Super-Bot-Implementierung. Mit einem späteren Implementierungsauftrag die Roadmap abarbeiten.
- Der Folgeauftrag autorisiert und implementiert bereits die Werkstatt für den vollständigen Bot. `editor/lib/schema.mjs` ist der gemeinsame Konfigurationsvertrag. Die spätere Runtime muss `globalThis.ALBotConfig` lesen und ein Paket nach docs/WORKSHOP-CONTRACT.md liefern. Keine neue abweichende Werkstatt bauen. Spielmodule sind durch den Werkstattauftrag noch nicht implementiert.
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
