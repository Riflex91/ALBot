# Erster Live-Test: ALBot 0.1.0-live-a

**Bereitgestellter Testkandidat, noch kein bestandener Live-Test.** Ziel sind P1 und P2 der Roadmap: derselbe Bot im Browser und im bestehenden Headless-Client, einfaches Farmen, Gruppe und eine kleine Lieferung. Kein neuer Login wurde bei der Entwicklung ausgeführt. Keine Shadow-Betriebsart.

## Vorbereitung

1. Die bestehende Bot-Werkstatt öffnen. Zuerst ein vorhandenes Profil sichern.
2. **Bot-Paket / Schema laden** → `dist/albot.package.json`. Das Testpaket verwendet `albot.live-a/v1`. Beim Schemawechsel die Vorgaben öffnen; das vollständige geplante Profil wird nicht stillschweigend gekürzt.
3. **Profil öffnen** → `profiles/live-a-solo.json`. `Farmer1` durch den tatsächlichen Namen ersetzen, ebenso den Leader. Klasse, Region und Server einstellen. Das Ziel ist zunächst `goo`.
4. **Beim Laden starten** einschalten und `bot.js` exportieren. Die generischen Beispielprofile sind standardmäßig pausiert. Eine gestartete Headless-Datei braucht Autostart, weil das Client-Dashboard keine Steuerbefehle anbietet.
5. Vorherigen Bot stoppen. Einen Charakter immer nur in EINER Umgebung anmelden. Die aktive Client-Konfiguration und bisheriges `CODE/main.js` wurden durch diese Entwicklung nicht umgestellt.

Die einzelnen Quelldateien unter `src` nicht als CODE laden. `dist/albot.runtime.js` benötigt eine vorgeschaltete Konfiguration. `dist/albot.js` enthält das generische Solo-Beispiel mit Platzhaltern. Der Werkstattexport enthält deine eigenen Einstellungen und die vollständige Test-Runtime.

## Ablauf, insgesamt etwa 10–15 Minuten

**Solo im Browser:** Export in den CODE-Slot laden. Status muss `Browser` melden. Rund drei Minuten Bewegung zu Goo, Grundangriffe, HP/MP und Loot beobachten. Das Panel zeigt Start, Pause und STOP. Pause drücken: keine neuen Angriffe oder Bewegung. Wieder starten. CODE neu laden: nur eine Botinstanz, keine doppelt laufenden Intervalle.

**Solo headless:** Charakter im Browser ausloggen. Exakt dieselbe exportierte Datei nach `CODE/live-a-solo.js` kopieren. In einer gesicherten `config.json` nur den Solo-Charakter aktivieren und seinen `script`-Pfad auf `./CODE/live-a-solo.js` setzen. `npm.cmd run check`, dann `npm.cmd start`. Unter Linux jeweils `npm`. Konsole muss `Headless` melden. Wieder Bewegung, Angriffe, Ressourcen und Loot beobachten. Mit Strg+C stoppen. Die Entwicklung hat diesen Wechsel noch nicht für dich vorgenommen.

**Kleines Team:** In der Werkstatt `profiles/live-a-team.json` laden und Namen anpassen. Alle Charaktere erhalten dieselbe Teamdatei. Das Beispiel enthält drei Ranger und einen Merchant, ist aber konfigurierbar. Nicht benötigte Farmer deaktivieren. Leader und zuständigen Merchant korrekt setzen. Bei einem reinen lokalen Headless-Team `Teamtransport = Nur lokales IPC` wählen; im Browser `Automatisch`. Gemischte Hosts brauchen bewusst CM und `allowRemoteCM` für den Headless-Autopfad.

**Eine günstige Lieferung:** Das Beispiel erlaubt dem Merchant ausschließlich vorhandene HP-Tränke zu liefern. Er behält 100, der Farmer wird bis 100 aufgefüllt, maximal 10 pro Übergabe. Dafür muss der Merchant mehr als 100 `hpot1` besitzen und Farmer1 weniger als 100. Beide benötigen freie Slots. Für genau einen kleinen Auftrag den Farmer-Zielbestand in der Werkstatt auf seinen aktuellen Bestand plus z.B. 5 setzen, Batch/MaxDelivery auf 5 begrenzen und nach dem sichtbaren Zuwachs pausieren. Es gibt in Live A keinen automatischen Einkauf und keinen Goldtransfer. Beim Sender müssen 5 fehlen und beim Empfänger 5 dazukommen. Anschließend beide Statusanzeigen auf offene Inventaraktionen prüfen.

Aufträge gehen über Angebot → Annahme → Versandversuch → beobachteten Eingang → Abschluss. Lokales `queued` zählt nicht als Lieferung. Merchant-Abholung verwendet explizite Farmer-Senderegeln; auch der Merchant benötigt eine passende Empfangsregel mit Zielbestand. `keep` schützt den vorhandenen Bestand, verhindert aber nicht ein ausdrücklich konfiguriertes Auffüllen bis zum Zielbestand.

## Kompakte Bedien-API

Im jeweiligen CODE-Kontext:

```js
ALBot.status(); // Version, Profil, Umgebung, Rolle, Grund, Ziel, offene Aktionen
ALBot.start();  // auch Wiederaufnahme; false mit Statusgrund bei blockiertem Start
ALBot.pause();  // neue Aktionen und Bewegung stoppen, Konfiguration behalten
ALBot.stop();   // wie Pause, Status STOP; kein Logout
ALBot.dispose(); // Instanz, Timer, Listener und Panel entfernen
```

`ALBot.version` und `ALBot.schemaId` beschreiben das geladene Artefakt. `ALBotConfig` ist die eingebettete Eingabekonfiguration. Änderungen daran wirken erst nach einem erneuten Laden des Bundles; die aktive Instanz arbeitet mit einer eigenen Kopie. Der öffentliche Name ist pro CODE-Kontext, nicht auf dem geteilten `parent`.

Wenn ein offener Versand oder Verbrauch nach Timeout/Stop/Reload nicht sicher geklärt ist, bleibt das Inventar gesperrt. `ALBot.status().journal` zeigt den kleinen offenen Vorgang. **Tatsächliche Bestände auf beiden Seiten prüfen**, pausieren und erst anschließend:

```js
ALBot.acknowledgeInventory(); // bestätigt deinen manuellen Bestandsabgleich
ALBot.start();
```

Diese Bestätigung löst keinen alten Auftrag erneut aus. Sie ist kein Reparaturknopf, der eine verlorene Lieferung automatisch findet. Mit `pauseOnUnknown=false` darf unabhängiges Farmen weiterlaufen; Inventarmutationen bleiben trotzdem gesperrt. Für den ersten Live-Test den Standard `true` beibehalten. Ein API-Promise oder eine verschwundene Verbindung beweist nicht, dass keine Mutation stattgefunden hat.

## Implementierter Umfang und Grenzen

- Ein Scheduler, instanzlokaler Lifecycle, Ressourcenbesitz, aktuelle Guards, begrenzte offene Aktionen, Reload-Generationen und kleiner eigener Checkpoint. Kleine Konfigurationen unter 16.000 Zeichen werden zusätzlich einmalig gespeichert; die eingebettete Datei bleibt maßgeblich.
- Farmen erlaubter Monster, Abstand/Kiting, öffentliche Spawn-Reise, Wegstillstand, tatsächliche Ankunft, Ruhe, Regeneration, ausgewählte Tränke, Todesgrenze, Respawn und Inventarreserve. Keine PvP-Automatik.
- Standardrotationen für Warrior, Ranger, Mage, Priest, Rogue und Paladin, konkrete optionale Skillregeln sowie Heilung, Energize, Buffs und Wiederbelebung. Fähigkeiten hängen von tatsächlichem Level, Stats, Waffe, Material, Mana, Zustand und Cooldown ab. Nicht verfügbar bedeutet überspringen. Vorhandene Regeln zu einer Skill-ID ersetzen deren Standardwahl; eine deaktivierte solche Regel sperrt ihre Automatik. Unterstützte IDs stehen im mitgelieferten Schema.
- AoE ist standardmäßig aus. Es wird nur gegen erlaubte, bereits am eigenen Team gebundene Monster ausgeführt, innerhalb der eingestellten Zielgrenze. Teure Spezialfähigkeiten wie Burst/CBurst, Aura-Automatik, Spieler-PvP und destruktive Fähigkeiten sind nicht Teil dieses Testschemas.
- Gruppe: festes Roster, Leader, frische Statusmeldungen, Fokusziel, Folgeabstand und Einladung. Keine automatische Charakterrotation. Farmer halten bei fehlendem Leader an; das zusätzliche Warten auf alle Farmer ist konfigurierbar.
- Items: gleiche Priorität wie in der vollständigen Werkstatt, Varianten/Charakterausnahmen, Reserven, Verbrauch und Lieferung. Ohne Itemregel werden normale Tränke und benötigte Skillmaterialien aus ungeschützten Beständen verwendet. Eine Keep-Regel blockiert diesen Verbrauch; bei Consume-Regeln gelten Mindest- und Teamreserve. Andere Konsumgüter als Tränke oder tatsächlich eingesetzte Skillmaterialien werden in Live A nicht automatisch benutzt.
- Merchant: Nachschub aus dem vorhandenen Bestand und Abholung. Jeder Empfänger braucht eine passende Itemregel; Ziel-/Maximalbestand und Platzreserve begrenzen die Annahme. Bedarfsmeldungen enthalten höchstens 25 Item-IDs und rotieren bei mehr Regeln. Keine Warenbeschaffung, Bank, Listings, Upgrade, Compound, Craft oder Events. Diese Bereiche folgen in P3–P5.
- Der Teilrelease zeigt nur seine Felder über den vorhandenen generischen Formulargenerator. Die besondere v1-Katalog-Sammelbearbeitung und Regelvorschau bleiben beim vollständigen Schema. Die Werkstattdatei wurde nicht für diesen Teilrelease verändert.

## Ergebnis zurückmelden

Jeweils Browser und Headless: Charakterklasse, Farmziel, Start/Stop/Reload, Bewegung, HP/MP, Angriff und Loot. Im Team zusätzlich IPC/CM, gemeinsames Ziel und Mengen vor/nach der Lieferung. Bei Fehlern die erste konkrete Meldung plus `ALBot.status()` liefern; keine Zugangsdaten. Dann nur den betroffenen Ablauf nachprüfen. P3 startet nach Bewertung dieses Live-Punkts.

Aktueller Prüfstand: Build und gezielte Tests bestanden; echter Spielbetrieb und Linux-Ausführung noch offen. Alte Live-Nachweise der Vorgänger gelten nicht als Nachweis für dieses Bundle.

## Testprotokoll ab Bot 0.1.1-live-a / Client 1.2.2

Während Live A wird ein begrenztes Testprotokoll im Arbeitsspeicher geführt: Version, Umgebung, Einstellungen (höchstens 80 Itemregeln/30 Skillregeln), aktuelles Inventar, Status, Aktionsanfänge/-ergebnisse, HP/MP-/Positionswerte alle fünf Sekunden, 256 letzte Ereignisse und 24 gesondert erhaltene Fehler. Keine Accounttokens, Cookies, vollständigen Spielobjekte oder externen Übertragungen. Die Datei ist JSON und lässt sich als Text schicken.

**Browser:** Im Bot-Panel „Testlog speichern“ anklicken. Downloadname: `test-ausgeführtertest.json`. Bei Pause/STOP/Fehler versucht der Bot zusätzlich einmal pro geladenem Test einen Download. Browser können automatische Downloads blockieren; dann den Knopf verwenden. Bei fehlendem Panel: `ALBot.exportTestReport()`. Als Text: `ALBot.testReport()`. Browser-CODE kann keine beliebige lokale Datei still im Hintergrund überschreiben. Vor Neuladen/Schließen exportieren; bei einem harten Browserabsturz ist der RAM-Bericht nicht garantiert erhalten.

**Headless:** Mit Client 1.2.2 entsteht automatisch `test-logs/<Charakter>/test-ausgeführtertest.json` relativ zum Clientordner. Aktualisierung spätestens alle zehn Sekunden während des laufenden Bots, zusätzlich beim geordneten Anhalten/Fehler. Pro Charakter wird genau diese Datei atomar ersetzt, höchstens 1 MiB. Vor einem neuen Test die benötigte alte Datei sichern. Client nach dem Update vollständig neu starten; ein alter laufender Prozess hat die neue API noch nicht geladen. Mit älteren Clients liefert `ALBot.testReport()` weiterhin den Text, aber keine automatische Datei.

**Reparatur des gemeldeten QuotaExceededError:** Die optionale komplette Konfigurationskopie wird nicht mehr gespeichert. Nur deren eigener veralteter Schlüssel wird entfernt; fremde Schlüssel bleiben unberührt. Ein kleiner Checkpoint reserviert festen Platz. Reicht der Speicher trotzdem nicht, werden Trank-/Skillverbräuche im RAM anhand frischer Mengen abgeglichen und nie aus einem alten Auftrag erneut abgespielt. Lieferungen benötigen weiterhin einen schreibbaren Checkpoint und bleiben sonst gesperrt. Bereits vorhandene ungeklärte Vorgänge werden nicht gelöscht oder automatisch bestätigt. Der Bericht nennt `checkpointMode` und den Speicherfehler. Das Testlog verwendet kein localStorage.
