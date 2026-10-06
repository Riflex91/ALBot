# Bot-Werkstatt 2.0

`Bot-Werkstatt.html` per Doppelklick im Browser öffnen. Kein npm, Server oder Internet für die Bedienung erforderlich. Die Datei enthält Oberfläche, Schema und den mitgelieferten Item-Katalog. Windows und Linux verwenden dieselbe HTML-Datei.

Die Werkstatt ist für den **vollständigen geplanten Super-Bot** gebaut. Seine Spiel-Laufzeit ist noch nicht fertig. Du kannst bereits alle Profile erstellen und speichern. Ein eigenständiger `bot.js`-Export wird erst angeboten, nachdem du ein passendes fertiges Bot-Paket geladen hast. Ein JSON-Profil allein führt keine Spielfunktionen aus.

## Arbeitsablauf

Für den ersten spielbaren Teilrelease ist jetzt [Live A](../docs/LIVE-A.md) mit eigenem Bot-Paket und reduziertem Schema verfügbar. Die vollständige v1-Spielroutine bleibt in Entwicklung. Das Testpaket funktioniert mit dieser unveränderten Werkstattdatei.

1. Unter **Charaktere & Rollen** deine Namen, Rollen und Regionen/Server anlegen. Den zuständigen Merchant und Kampf-Leader unter **Gruppe & Skills** auswählen. Namen auch im Headless-Client konfigurieren.
2. **Farmer & Überleben**, **Gruppe & Skills** und **Merchant & Logistik** einstellen. **Individuelle Skill-Regeln** erlauben Bedingungen, Prioritäten, Ziele, Manareserve und Ausführungsabstände.
3. Unter **Alle Items · Regeln** nach Namen/ID/Typ suchen, Items auswählen, Rolle/Aktion wählen und Regeln anlegen. Level, besondere Eigenschaften, Mengen, Empfänger, Preise, Budgets, Scrolls, Offerings und Verarbeitung pro Regel festlegen.
4. Für mehrere vorhandene Regeln die Item-IDs im Katalog auswählen, Rolle setzen und **Bestehende Regeln gemeinsam ändern** öffnen. Ein einzelnes Feld wird für die gesamte Auswahl geändert. Rückgängig stellt den vorherigen Zustand wieder her.
5. Unter **Produktion & Gear** Produktionsziele, Beschaffungswege, Verlustgrenzen und Ausrüstungsziele einstellen. **Welt, Bosse & Entwicklung** steuert Aktivitäten, Realms und adaptive Bewertung.
6. **Wenn–dann-Regeln** verbinden Bedingungen mit Rückzug, Versorgung, Skill, Farmziel, Bankauftrag, Aktivitätswechsel, Pause oder Hinweis. Kein JavaScript erforderlich.
7. Unter **Regelvorschau** Item und Situation eingeben. Die Werkstatt nennt die passende Regel samt Spezifität/Priorität und berücksichtigt Itemschutz. Das ist eine statische Entscheidungshilfe, kein Testlauf im Spiel. Sie prüft keine echte Erreichbarkeit, Marktpreise oder Cooldowns.
8. **Profil speichern** erzeugt `albot-profile.json`. **Profil öffnen** lädt es unverändert zurück. Das JSON-Feld erlaubt fortgeschrittene Bearbeitung mit derselben Validierung.
9. Sobald der fertige Bot verfügbar ist, **Bot-Paket / Schema laden** → `albot.package.json`. Danach erzeugt **Fertige bot.js exportieren** Einstellungen und Laufzeit in einer Datei. Dieselbe Datei im Browser-CODE oder im Headless-Client unter `CODE` verwenden.

## Regeln verstehen

Ein Item kann mehrere Regeln besitzen: z.B. Farmer liefert Überschuss, Merchant kauft bis zum Zielbestand und lagert Überschuss ein. Beschaffung, Inventarverteilung und Verarbeitung sind getrennte Phasen. Eine Behalten-Regel gilt phasenübergreifend.

Gesperrte, ausgerüstete oder reservierte Items werden in der Auswahl geschützt. Danach: Charakterausnahme vor Rollenregel vor globaler Regel; spezifische Varianten innerhalb dieser Stufe; höhere Priorität; bei identischem Ergebnis stabile Listenreihenfolge. Gleichrangige überlappende Regeln mit unterschiedlichem Ergebnis blockieren den Export. Reihenfolge alleine löst keine widersprüchlichen Regeln.

Für Vorräte gilt: eigene Reserve + zusätzliche Teamreserve ≤ Zielbestand ≤ Maximalbestand. Die zusätzliche Teamreserve wird pro regelzuständigem Bestand gerechnet; sie ist kein verteilter atomarer Accountzähler. Für Lieferungen/Verkäufe begrenzt `batch` die Menge. Ein Preis ist Gold pro Stück, Budgets sind Gold je Auftrag bzw. je Stunde wie beschriftet, Prozentwerte sind Anteile zwischen 0 und 1, Zeitwerte Millisekunden. `maxCount` ist ein Planungsmaximum, kein automatischer Vernichtungsauftrag.

Filter, Mindestbestände und Budgets sind auch nach erfolgreicher Vorschau vor einer tatsächlichen Spielaktion erneut durch den Bot zu prüfen. Die Werkstatt garantiert nicht, dass die gewünschte Aktion für das aktuelle Item im Spiel möglich ist; neue Item-IDs sind bewusst erlaubt. Das verhindert, dass jedes Spielupdate ein Werkstattupdate erfordert.

## Langfristig erweiterbar

- Die Botversion liefert Daten statt neuen Formularcode: `albot.settings.json` oder ein komplettes `albot.package.json`.
- Objekte, Listen, Text, Zahlen, Checkboxen und Auswahlfelder werden generisch dargestellt. Neue kompatible Felder können mit sichtbarer Zustimmung ergänzt werden; bestehende Werte bleiben dabei erhalten.
- Bei anderer Schema-ID oder inkompatiblen Feldern wird kein stilles Mapping vorgenommen. Bisheriges Profil sichern, dann neues Schema starten oder abbrechen. Eine KI kann bei Bedarf eine ausdrücklich dokumentierte Profilmigration liefern.
- Fremde Schemafelder, unzulässige Schlüssel und unbekannte Feldtypen werden abgelehnt. Es werden weder Schema-Skripte noch importierter Bot-Code in der Werkstatt ausgeführt.
- Der Item-Katalog wird separat aktualisiert: JSON `{ "version": "…", "items": [{"id":"hpot1","name":"HP Potion","type":"pot"}] }`. Bis zu 10.000 eindeutige IDs. Die mitgelieferte Momentaufnahme enthält 638 Items aus Spielversion 17478. Eigene IDs bleiben jederzeit eintragbar.
- Derzeit bis zu 2.000 Item-Regeln, andere Listen bis zu 500. Ein späteres kompatibles Schema kann Listen bis 2.000 deklarieren. Die Browserleistung und das abschließende CODE-Limit gelten weiterhin.
- Vollkommen neue Interaktionsarten, neue Schema-Formate oder fundamentale Spieländerungen können eine neue Werkstattversion erfordern. „Für immer kein Update“ lässt sich nicht garantieren; normale neue Einstellungen erfordern keinen UI-Umbau.

## Dateien und Sicherungen

Der Browser sichert den letzten Entwurf lokal. Dateibrowser behandeln lokalen Speicher je nach Browser/Dateipfad unterschiedlich; deshalb Profile zusätzlich als JSON speichern. Ein fehlgeschlagener oder voller Speicher wird angezeigt. Bot-Pakete und zusätzlich geladene Item-Kataloge werden nach dem Schließen nicht automatisch wieder geladen; die Konfiguration bleibt im Entwurf. Bis zu 30 Bearbeitungsschritte lassen sich während der Sitzung rückgängig machen.

Die bisherige ausführbare Werkstatt liegt als `Bot-Werkstatt-Klassisch.html` daneben. Ihre alten Profile funktionieren dort unverändert. Sie werden nicht stillschweigend in das Super-Bot-Schema übersetzt, weil frei programmierte Regeln und alte Aktionssemantik anders arbeiten.

## Entwicklung und Prüfung

Im Repository:

```sh
npm run build:editor
npm run test:editor
```

Keine Paketinstallation erforderlich. Der Build erzeugt die einzelne HTML-Datei, das Schema und ein Beispielprofil. Geprüft werden die fachlich wichtigen Grenzen: Vorräte, Empfänger, Regelkonflikte, Priorität, Schema-Erweiterung, Paketintegrität, exakter Export und UTF-8-Limit. Keine Shadow- oder Spieltests.

Der [Integrationsvertrag](../docs/WORKSHOP-CONTRACT.md) ist für jede KI verbindlich, die den Super-Bot implementiert.

## Geprüfter Stand (6. Oktober 2026)

Neun gezielte Logiktests erfolgreich; Syntax und Git-Diff geprüft. Im Browser geprüft: Item-Auswahl, Regelerstellung und Mengenänderung, Überschussvorschau, additive Schema-Erweiterung unter Erhalt bestehender Werte, Rückkehr zum ursprünglichen Schema und Exportauslösung mit einem ausdrücklich lokalen Testpaket. Keine Browser-Konsolenfehler. Der Testcode wird nicht ausgeliefert. Keine Spiel- oder Shadow-Tests; die spätere Spiel-Laufzeit bleibt offen.
