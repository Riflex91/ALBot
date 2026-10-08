# Super-Bot 0.6.0 · gemeinsamer Livebetrieb

Ein vollständiges Betriebsprofil ersetzt die getrennten P3/P4-Testabschnitte. Alle Module arbeiten in derselben Runtime und demselben Scheduler. Der Updater ist auf Nutzerwunsch ausgeschlossen. Implementiert und gezielt geprüft bedeutet noch keinen bestandenen Vollbetriebs-Livetest.

## Start

**Browser:** `bot.js` vollständig in CODE auf jedem beteiligten Charakter einfügen und starten. Autostart ist true, performance_trick wird beim Laden angefordert. Auf jedem Charakter sofort **Testordner wählen** anklicken und den Desktop oder einen gemeinsamen Desktop-Unterordner wählen. Die Dateifreigabe erfolgt im Browserdialog. Keine zweite Anmeldung desselben Charakters im Headless-Client.

**Headless:** Die Desktopinstallation enthält die neue Reportausgabe. Client mit Strg+C beenden und erneut `npm.cmd start` ausführen. Die Client-Konfiguration verweist auf `./CODE/albot-full/bot.js`. Die bisher aktiven vier Charaktere starten; zusätzliche konfigurierte Charaktere bleiben zunächst ausgeschaltet. Der Bot darf bei adaptiver Teamwahl einen bekannten Ersatz starten und einen Farmer stoppen. Es wird während der Entwicklung kein Login ausgelöst.

Die persönliche Bot-Werkstatt enthält das passende Runtimepaket und das Vollbetriebsprofil bereits. `Bot-Werkstatt.html` öffnen, Einstellungen ändern, **Fertige bot.js exportieren**. JSON ist das bearbeitbare Profil, JS der vollständige ausführbare Bot. Ältere persönliche Dateien bleiben separat.

## Was gleichzeitig aktiviert ist

- Farmerkampf, Klassenrotationen, Gruppenheilung/Buffs, Loot, Nachschub, Schutz und gemeinsame Ziele.
- Merchant-Abholung, Trank-Nachkauf und Zustellung, Goldabholung oberhalb der Farmerreserven, Mluck, Stand, NPC-Verkauf, Spielerhandel/Wishlist, Ponty und Giveaways.
- Banklager, Konsolidierung, Teilentnahme, Goldausgleich, regelgebundene Platzfreigabe und budgetierte Erweiterung.
- Produktionsgraph mit Bestand, Bank, NPC, Markt, Farmmaterialien, Craft/Exchange/Upgrade/Compound, Scrolls und bestätigter Lieferung. Fishing/Mining einschließlich eigener Werkzeugbeschaffung und Rückwechsel; Merrit.
- Explizite und automatische Gearziele, bekannte Offlineprofile, adaptive Teamwahl mit effektiven Gearwerten, Catch-up und Klassenkombination. Weltziele, Monsterhunt, Anniversary, Magiport, erlaubter Realmwechsel und begrenzte adaptive Bewertung.

„Aktiviert“ bedeutet, dass ein Modul bei einem passenden Bedarf und erfüllten Spielvoraussetzungen arbeitet. Es erzeugt keinen künstlichen Bedarf, kein Event und keinen Verkäufer. Fehlendes Werkzeug/Skilllevel/Stand, geschützte Ausrüstung, fehlende Marktangebote, unerschwingliche Bankpacks oder ausgeschöpfte Budgets werden nicht als bestandene Aktion gezählt. Alle Items bleiben einzeln über die gemeinsamen Regeln konfigurierbar; eine fehlende Regel erteilt keine allgemeine Verkaufserlaubnis.

## Persönliches Profil und Grenzen

Die vorhandenen Namen, Trankreserven und Rollen werden übernommen. Goo/Bee und Spider sind erlaubte Farmziele; Spider ermöglicht die Beschaffung von spidersilk für Werkzeuge. Die eigentliche Wahl erfolgt durch aktuelle Materialanforderungen und Ranking. Zusätzliche Namen aus der Client-Konfiguration sind im Botroster bekannt. Ein unbekannter Offlinecharakter wird nicht blind rotiert: seinen CODE mit derselben Datei einmal ausführen, damit Klasse, Level und Ausrüstung beobachtet werden. Anschließend kann er wieder ausgeschaltet bleiben. Im Browser muss auch sein CODE-Slot vorbereitet sein.

Goldausgaben maximal **200000 pro Stunde**, Verlustexposition maximal **150000 pro Stunde**, Bankerweiterung insgesamt maximal **200000**. Deine vorhandenen eigenen und Merchant-Goldreserven bleiben erhalten. Ein automatisches Gearziel besitzt ein Budget von **15000**, verbessert ausschließlich freigegebene Basisitems höchstens bis **+3**, und unterliegt der Verbesserungsschwelle sowie Mindestchance **0.9**. Die Zahlen sind sichtbare Profileinstellungen. Ein teurerer Bankpack oder eine höherwertige Ausrüstung benötigt ein bewusst angepasstes Budget/Ziel in der Werkstatt. Offerings benötigen weiterhin eine explizite Mutationsregel.

Ein STR-Ring +1 ist als begrenzter Arbeitsvorrat vorgesehen: drei identische strring +0 bereithalten, wenn diese Compound-Kette unmittelbar getestet werden soll. Für Werkzeuge spidersilk (rod) sowie zusätzlich blade (pickaxe) bereitstellen oder erlaubte Materialbeschaffung abwarten. Bereits fertige Ziele werden nicht nochmals künstlich produziert. Goldabholung beginnt erst bei mindestens 10000 Farmerüberschuss, höchstens 100000 je bestätigter Übergabe.

Goo kann in trade1 angeboten werden; ist das Angebot belegt, lagert die gemeinsame Fallbackregel übrigen Vorrat ein und behält 10. Beewings-Wishlist in trade2 und Whiteegg-Kauf sind auf ein Stück und 100 Gold begrenzt. Aktive Spielangebote bleiben nach Pause bestehen. Eigene Preis- und Itemregeln in der Werkstatt anpassen; andere Spieler können echte Angebote annehmen.

Boss-/Event-Allowlisten und konservative Risikoprüfung sind aktiv; die normale Tätigkeit kehrt nach Ende zurück. Monsterhunt kann ein aktuell sicheres Questmonster vorübergehend zum gemeinsamen Ziel machen. Es werden keine fremden Instanzen oder PvP-Ziele freigegeben. Paladin-Schutz/Transfer berücksichtigt eigenen Ressourcen- und Schadensdruck; Mana Burst verbraucht die gesamte MP und wird nur als begründeter Finisher ohne offenen Gruppen-Mana-Bedarf automatisch gewählt. Controlled Burst berücksichtigt eine konkrete Manareserve.

Serverwechsel ist auf erlaubte Realms beschränkt und wird mit `ALBot.requestServerHop("EUI")` vom Leader angefordert. EUI zuerst in `world.allowedRealms` ergänzen, wenn du dort testen möchtest. Das ausgelieferte Profil erlaubt zunächst die bereits konfigurierten Realms. Kein zielloses automatisches Durchwechseln. Magiport benötigt einen aktiven Mage mit Level/MP und bestätigte Zustimmung des Zielcharakters.

## Testlogs

Headless legt fortlaufende Dateien unter **Desktop/ALBot-Testlogs** an, zum Beispiel:

`test-My_Ranger1-2026-10-08T19-30-45-123Z-part001.jsonl`

Der Zeitteil ist **UTC**; im Oktober entspricht 19:30Z in Deutschland 21:30 Uhr. Jede CODE-Instanz erhält eine neue Startzeit. Sortieren nach Änderungszeit zeigt die aktuell geschriebenen Dateien. Eine Datei enthält eine JSON-Zeile pro Ereignis/Statusaufnahme, keine rohen Socket-/Kontodaten. Alle zehn Sekunden werden neue Ereignisse und ein aktueller Zustand geschrieben, außerdem beim Fehler, Pause, STOP und Entladen. Ab 16 MiB folgt der nächste part. Ältere Sitzungen bleiben erhalten. Der bisherige kompakte JSON-Bericht im Client unter test-logs/CHARAKTER bleibt zusätzlich verfügbar.

Browser schreibt nach **Testordner wählen** ebenfalls alle zehn Sekunden JSONL-Dateien in den freigegebenen Ordner. Jeder Charakter benötigt seine eigene Freigabe; nach CODE-Neuladen erneut wählen. Ein Browser darf keinen beliebigen Desktop-Pfad ohne deine Freigabe beschreiben. Falls der Browser die Ordner-API im CODE-Frame nicht erlaubt, **Testlog speichern** verwenden: der Download hat ebenfalls Charaktername und Startzeit. Diesen auf dem Desktop speichern. Der Download enthält den begrenzten jüngsten Verlauf und Zähler, nicht die unbegrenzt laufende Chronik. Ausgelassene Sequenzen werden im fortlaufenden Log ausdrücklich als `log.gap` markiert.

Die Datei erklärt Aktionen, Zeit, Grund, Rolle, Aufgabe, Ziel, Bewegungsbesitzer, Regeln/Prioritäten, Inventarabsicht und bestätigtes oder unbekanntes Ergebnis. Zustandsaufnahmen enthalten Inventar, Equipment, Reservierungen, Item-Regelentscheidungen, Aufträge, Produktionsplan, Budgets, Teamwahl und Fehlerstack. Normalbetrieb verwendet begrenzte RAM-Puffer; die Testdatei ist keine Telemetrieplattform. `general.testLogging=false` deaktiviert das neue fortlaufende Testlog und lässt den bisherigen kompakten Testbericht bestehen.

Bei einem Fehler: möglichst pausieren, **Testlog speichern** ausführen und die neueste betroffene Charakterdatei plus die Merchantdatei schicken. Bei Teildateien die letzte und, falls der Auftrag früher begann, die vorherige mitsenden. Notiere nur, ob du absichtlich neu gestartet hast. Nicht benötigte alte Testdateien kannst du später selbst löschen.

## Gemeinsamer Nachweis

Den Bot mit echten Zielen länger laufen lassen; Nachschubbedarf, ausreichend Gold oberhalb der Reserve, freie Merchant-Arbeitsplätze und ein Stand-Item bereitstellen. Während einer Produktion/Gathering-Aufgabe Nachschubbedarf erzeugen und beobachten, dass Versorgung zuerst erfolgt und Werkzeuge vor Lieferung zurückgewechselt werden. Danach Pause/Resume und einen Reload bei ruhendem Wertjournal prüfen. Ein absichtlich ungeklärter Transfer wird manuell anhand beider Bestände aufgelöst, niemals blind erneut geschickt.

Optionale Klassenwechsel, andere Realms, Saisonereignisse oder Angebote gelten nur dann als geprüft, wenn sie tatsächlich ausgeführt und bestätigt wurden. Linux wurde bisher nicht live getestet. Windows und Linux verwenden dieselbe Datei und denselben Clientvertrag.

## KI-/Entwicklungsvertrag

Schema `albot.full/v1`, `src/config/full.mjs`. Ergänzungen zu P3/P4: general.testLogging; merchant.collectGold/goldTransferMax/goldCollectBelow/bankWorkspace/bankReclaim; party.gearSynergy/advancedSkills; production.autoGear/autoGearMaxLevel/autoGearBudget/autoGearItems; world.questTargets. Kein Updaterfeld.

Öffentliche Bot-API: start, pause, stop, dispose, status, requestTask, requestSupply, requestServerHop, testReport, exportTestReport, acknowledgeInventory sowie neu **chooseLogDirectory** (Browser: Promise mit Ordnername oder false; Headless: verfügbare Reportausgabe). Vor manuellem Inventory-Abgleich pausieren und physische Bestände prüfen. Der Bot importiert keine Hostmodule. Die neue Client-Dateiausgabe ist als reproduzierbare Quelle in `tools/client-test-report.js` enthalten; sie ersetzt die gleichnamige Datei unter src des separaten Clients. API-Version bleibt 1.

Build: Node >=22.9, `npm ci`, `npm run build`, `npm run build:editor`, `npm test`. Terser ist ausschließlich Buildabhängigkeit, Kompression ist deaktiviert und lokale Namen werden verkürzt; keine Property-Mangling-/Hostabhängigkeit im Bot. Export: `node scripts/export-full.mjs Profil.json NEUER-Ordner [Client-config.json]`. Quelle und bestehende Ausgabeordner werden nicht überschrieben. Für den zugrunde liegenden Vertrag zusätzlich P3-P4.md, RUNTIME-VERTRAG.md, WORKSHOP-CONTRACT.md und HOW-TO-USE.md lesen.
