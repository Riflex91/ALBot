# Ergänzung 0.7.0-full

[AUTONOMIE-0.7.0](AUTONOMIE-0.7.0.md) ist der aktuelle Vertrag für gemeinsame Autonomie. Leaderplan bindet Realm, Sitzung, Generation, Spawn-/Monsterdefinition und Ablauf; Materialintent bindet Quelle/Teilnehmer/Menge. Quarantäne stoppt geänderte Definitionen vor erneuter Bewertung. Priorität ergänzt, ersetzt aber keine Ressourcen-/Wertguards. Automatische Recovery benötigt Variantenbelege und vollständige Inventardifferenz; ungeklärte Transfers niemals blind wiederholen.

# Ergänzung 0.6.0-full

Aktueller Vertrag: [VOLLBETRIEB.md](VOLLBETRIEB.md), Schema albot.full/v1. Ein integrierter Scheduler, Gold-/Item-/Produktionsreservierungen und begrenzte Diagnoseringspeicher. Neue API ALBot.chooseLogDirectory(); im Browser nur nach Benutzeraktion Ordnerfreigabe, headless über vorhandenes writeTestReport. Keine Hostimports im Bot. Historische Abschnitte unten bleiben Referenz für die ursprüngliche Portgrenze.

# Browser und Headless: verbindlicher Bot-Vertrag

Stand 6. Oktober 2026. Referenz: [Client-Handbuch](../HOW-TO-USE.md), Client 1.2.1, `apiVersion: 1`. Der erste P1/P2-Testkandidat ist implementiert; [Live A](LIVE-A.md) ist noch ausstehend. Die Werkstatt und der [Konfigurations-/Paketvertrag](WORKSHOP-CONTRACT.md) bleiben maßgeblich. Spätere Etappen ergänzen fehlende Fähigkeiten.

## Erkennung und Auslieferung

Ein klassisches, selbststartendes JS-Bundle mit eingebetteter Benutzerkonfiguration. Build-Werkzeuge dürfen Node/TypeScript verwenden; das ausgelieferte Skript benötigt weder `require`, `import`, `process` noch `Buffer`. Keine Top-Level-Module oder Top-Level-await. Dasselbe Artefakt wird in den Browser-CODE-Slot und als lokale CODE-Datei geladen.

Den sicheren Zugriff auf `parent.headless` kapseln und API-Version/Fähigkeiten prüfen. Unser Client bietet `parent.headless.apiVersion === 1`. Ein `parent.caracAL` ohne dieses Objekt kennzeichnet nur einen anderen CaracAL-kompatiblen Host, nicht automatisch unseren vollständigen IPC-Vertrag. `window`, `document`, `navigator` und `parent` existieren auch in jsdom. Ihre Existenz beweist keinen Browserbetrieb.

Unbekannte Headless-API: verständlicher Hinweis und nur ausdrücklich verfügbare Operationen. Keinen Browser-UI-Modus versehentlich im jsdom aktivieren. Browser und Headless dürfen nicht gleichzeitig denselben Charakter übernehmen.

## Port-Zuordnung

| Bot-Aufgabe | Unser Headless-Client | Browser |
|---|---|---|
| Kampf, Loot, Skills, NPC-Handel | Offizielle CODE-Funktionen | Dieselben CODE-Funktionen |
| Teamnachricht an lokale Geschwister | `parent.headless.send(name, topic, data)` | `send_cm(name, envelope)` |
| Empfang | `parent.headless.onMessage(handler)`; Rückgabe ist Abmeldefunktion | `on_cm` sauber einhängen und bestehenden Handler erhalten |
| Nachricht an Charakter außerhalb dieses Supervisors | Expliziter `send_cm`-Pfad, wenn konfiguriert | `send_cm` |
| Bekannte laufende Charaktere | `get_active_characters()`; ergänzend `parent.caracAL.siblings` | `get_active_characters()` plus Team-Heartbeats |
| Charakter starten/stoppen | Gemeinsame `start_character`/`stop_character` oder gezielt `caracAL.deploy`/`shutdown` gemäß Handbuch | Offizielle Lifecycle-Funktionen; Browsergrenzen beachten |
| Realmwechsel | `change_server` über Supervisor | Verfügbare offizielle Funktion; Rückkehr nach Neustart einplanen |
| Persistente Bot-Regeln/kleine Checkpoints | `set`/`get` über replizierten Storage | `set`/`get`; Browser-Speichergrenzen beachten |
| UI / visuelles Prüfen | Kein Ingame-DOM-Panel; Client-Dashboard bleibt zuständig für Laufzeitwerte | Optionales Ingame-Panel und Spielgrafik |
| Regelbearbeitung ohne Spiel | Lokaler Konfigurationseditor erzeugt Bundle/JSON | Derselbe Editor; Import/Export identisch |
| Meldungen | Kurzes `game_log`/`console`, Client übernimmt Ausgabe | Kurzes `game_log` |
| Audio-/Sichtbarkeitstricks | Nicht aufrufen | `performance_trick` beim Laden immer automatisch anfordern; laufenden Loop wiederverwenden, fehlende API/Fehler melden. Browser-Autoplayfreigabe kann Benutzerinteraktion benötigen. |
| Skriptbibliotheken | Explizite Client-`libraries` oder dokumentiertes `caracAL.load_scripts` | Cloud-`load_code` |

Der Standardbuild ist vollständig und braucht diese Bibliothekspfade nicht. Weder Client noch Bot müssen für jede Spielfunktion eigene APIs erfinden.

## Nachrichten und Zuständigkeiten

Ein gemeinsames Nachrichtenformat: Version, Typ, Absender, Empfänger, Auftrags-ID, Sequenz, Team-/Sitzungsgeneration, Gültigkeitsdauer und begrenzte Nutzdaten. Typen z.B. Status, Materialbedarf, Lieferauftrag, Annahme, Erledigung, Storno, STOP. Absenderidentität immer aus dem Transport übernehmen, nicht aus frei behaupteten Nutzdaten. Maximal 65.536 UTF-8-Bytes beim Headless-Transport; bewusst viel kleinere Statuspakete verwenden.

`headless.send()` meldet, dass der Supervisor Nachrichten angenommen hat. Für Lieferungen braucht es zuerst Auftragsannahme und danach ein beobachtetes Spielergebnis. Doppelte Nachrichten dürfen nicht doppelt handeln. Bei Verbindungsabbruch erst Zustand abgleichen; kein automatisches erneutes `send_item`, `buy`, `upgrade` oder `compound`.

Ein konfigurierter Merchant koordiniert Economy und Bank. Ein separat bestimmter Kampf-Leader koordiniert Ziele. Eine Fallback-Wahl verwendet Generationen und feste Prioritäten; bei unklarer Bankzuständigkeit keine Bankmutation. Browser/Headless-Mischteams sind ein ausdrücklich konfigurierter CM-Fallback-Fall: lokales IPC verbindet keine unterschiedlichen Prozesse auf anderen PCs, Browserfenster oder weitere Supervisoren.

`get_active_characters()` und `siblings` sind kein Beweis für einen gesunden Bot oder gemeinsame Karte/Instanz. Bot-Heartbeat, aktuelle Charakterdaten und Instanz müssen zur konkreten Aktion passen.

## Speicher und Wiederanlauf

Namensraum `albot:<schema>:<character>:<key>`, getrennte eigene Schreibschlüssel. Zentraler Merchant schreibt gemeinsame Auftragsentscheidungen; Farmer veröffentlichen ihre eigenen Zustände. Keine dauerhaft wachsenden Historien.

Der Client schreibt replizierten Storage verzögert auf Disk. `set()` bietet keine dauerhafte Transaktion und keine atomare Sperre. Speichern eines Intents vor einer Aktion garantiert daher keine Exactly-once-Ausführung nach einem Prozessabsturz. Nach Wiederanlauf Inventar, Gold, Equipment, Bank und aktuelle Aufträge neu lesen. Bei unklarem wertveränderndem Vorgang die betroffene Aktion anhalten und melden; normale unabhängige Spielfunktionen können weiterarbeiten.

Ein kleiner offener Auftrags-/Transaktionszustand ist Spielzustand, kein neues Log-System. Keine großen Roh-Snapshots, Telemetriearchive, FTPS-Uploads oder SSD-/Windows-Bridge-Voraussetzung.

## UI, Ressourcen und Stoppen

UI nur im Browser initialisieren. Lokaler Editor bleibt vom read-only Client-Dashboard getrennt; das Dashboard besitzt aktuell keinen Bot-Regel-Schreibkanal. Vorerst Konfiguration exportieren und den Bot mit dieser Konfiguration neu laden. Einen Live-Schreibkanal nicht als bereits vorhanden behaupten.

Ein Scheduler mit schneller Kampfspur und langsamen Economy-/Planungsspuren. Keine vollständige `G`-Serialisierung pro Tick, kein Minimap-Zeichnen im Bot, keine eigene Socket-Verbindung und kein Reconnect-Loop. Große Kataloge aus dem geladenen `G` lesen, kleine Indizes bei Bedarf neu aufbauen.

`on_destroy` zur Bereinigung verwenden. Browser-Hot-Reload ebenfalls explizit behandeln: alte lokale Botinstanz stoppen, Timer entfernen, Listener abmelden, verspätete Promises anhand der Generation ignorieren. Ein anderer Charakter im gleichen Browser darf davon nicht betroffen sein.

STOP verhindert neue Spielaufträge; für bereits gesendete Aktionen nur noch Ergebnisse abgleichen. Pause, Wiederaufnahme und Charakter-Ausloggen sind unterschiedliche Befehle. Ein Bot-STOP muss keinen Clientprozess beenden.


## Live-B-Erweiterung (0.2.0-live-b)

Die öffentliche ALBot-API bleibt `start()`, `pause()`, `stop()`, `status()`, `testReport()`, `exportTestReport()`, `acknowledgeInventory()` und `dispose()`, plus `version` und `schemaId`. Neue Profile starten automatisch. Keine neue Host-API erforderlich: Economy verwendet dieselben Ports, `get`/`set`, Executor und persistente Wertjournale. `status().journal`/`inventoryBlocked` entscheiden über ungeklärte Aktionen; `acknowledgeInventory()` verlangt einen pausierten Bot und manuellen Bestandsabgleich.

`albot.live-b/v1` ergänzt die tatsächlich verfügbaren Merchant-/Item-/Produktionseinstellungen. Regeln werden in acquisition, inventory und production aufgelöst; keep gilt phasenübergreifend. `maxActions` zählt pro Regel gestartete Economy-Aktionen in dieser CODE-Instanz (keine Lieferung, kein Verbrauch, keine vorgelagerte Bank-Stackteilung). Pause/Resume erhält die Zähler. Gold-/Verlustbudgets werden vor Dispatch namensgebunden gespeichert; konservativ keine Rückerstattung bei Fehlschlag/Unklarheit. Eine Produktion benötigt explizite Regeln für jeden Schritt. Planer maximal 256 Abhängigkeiten und konfigurierbare Rekursionstiefe.

Testbericht enthält zusätzlich `economy`, `production`, `gear` und Live-B-Profilwerte. Gearprofile sind begrenzt und namensgebunden. Browser nutzt weiter performance_trick; keine DOM-/Node-Abhängigkeit in Fachmodulen. Neue API-Aufrufe werden im Executor ausgeführt, Inventaränderungen anhand aktueller Mengen/Identitäten bestätigt. `buy_with_gold` verhindert versehentlichen Shell-Kauf. Details, Grenzen und Testpfad: [LIVE-B.md](LIVE-B.md).

## Live-C-Erweiterung (0.3.0-live-c)

Das aktuelle Paket liefert `albot.live-c/v1`. A/B-Konfigurationen bleiben ausführbar; die C-Werkstattmigration ergänzt neue Optionen ausdrücklich. Alle Spielfunktionen verwenden weiter denselben Executor und Scheduler. Die vollständige Funktionszuordnung einschließlich Restlücken steht in [INTEGRATIONSSTAND.md](INTEGRATIONSSTAND.md).

Zusätzliche öffentliche Funktionen auf `ALBot`:

| Funktion | Vertrag |
|---|---|
| `requestTask(task, ttlMs = 120000)` | Boolesche Annahme; 1 Sekunde bis 1 Stunde. `farm` oder `farm:monster`, `boss:id`, `event:id`, Merchant `fishing`/`mining`/`merrit`/`bank`. Nur erlaubte Ziele/aktivierte Module und laufender Bot ohne Wertjournal/Logistikreservierung. Keine Garantie auf erfolgreiche Reise/Spielaktion. |
| `requestSupply(item, quantity)` | Boolesche Annahme einer Level-0-Nachschubanfrage für 120 Sekunden. Benötigt eigene passende Item-Regel, positive Ganzzahl höchstens maxCount; tatsächlicher Empfang folgt weiter Schutz/Varianten/Reserve/Handshake. Erhöht keinen Merchantbestand automatisch. |
| `requestServerHop(realm)` | Boolesche Annahme des Leaders. world.serverHop, Allowliste, Cooldown, frisches Team und ruhender sicherer Eigenzustand erforderlich. Ein Protokoll sammelt sichere Peer-ACKs, sperrt neue Aktionen und übergibt den erlaubten Realm an offizielle change_server. Keine automatische zyklische Serverwahl. |

Bestehende Funktionen: `start()`, `pause()`, `stop()`, `status()`, `testReport()`, `exportTestReport()`, `acknowledgeInventory()`, `dispose()`; Eigenschaften `version`, `schemaId`. `status().task` ergänzt den aktiven Kontext. Testberichte ergänzen `strategy`, `account`, `travel`, `services`, `merchantTask` sowie Welt-/Regelkonfiguration.

Ab 0.3.1 enthält der Testbericht außerdem `movement`: null oder aktueller Auftrag mit `owner`, `mode`, `destination` und `started`. Begrenzte `movement.request`, `movement.arrived` und `movement.failed`-Ereignisse erklären Wegwahl und Fehler. Das ist Diagnosezustand, keine neue öffentliche Steuerfunktion. Merchant-Meldungen bleiben zwischen Economy-Ticks erhalten; ohne Bedarf wird sein Wartegrund angezeigt.

Pause/Stop löscht manuelle Aufgaben und Transportzustimmungen. Ein bereits beobachteter Gathering-Vorgang wird nicht erfunden rückgängig gemacht; der namensgebundene Tool-Checkpoint bleibt erhalten und führt nach Resume/Reload zuerst zur ursprünglichen Mainhand/Offhand zurück. Beschädigte Tooldaten sperren Inventararbeit; nicht automatisch löschen. Tatsächliche Ausrüstung prüfen, pausieren und den eigenen `albot:tools:NAME`-Zustand nur nach manuellem Abgleich korrigieren. Kein fremder Storage wird bereinigt.

Accountrotation ist explizit `selection=adaptive`; `rotation=false` hält aktive Charaktere im Team, ein expliziter Leader bleibt. Unbekannte Offlineklasse/-level werden nicht blind eingesetzt. Ein Merchant (sonst Leader) koordiniert genau einen Wechsel. Vor dem Stop wird eine eigene Wiederherstellungsabsicht gespeichert. Nach Unterbrechung wird zuerst der Ersatz gestoppt und der ursprüngliche Charakter gestartet. Der Host muss sämtliche Namen und denselben Botcode bereits kennen; standby bedeutet kein Farmen, kein zusätzlicher Login durch den Bot. Speicher bleibt der begrenzt persistente Clientvertrag, keine Exactly-once-Transaktion.

Magiport benötigt aktuelle, konfigurierte Peers am Leader und eine kurzlebige Zustimmung mit identischer Auftrags-ID. Keine beliebigen Teleportanfragen annehmen. Zielregel, MPreserve und ruhendes Inventar gelten zusätzlich. Realmwechsel und Rotation bleiben im persönlichen C-Testprofil ausgeschaltet.

Produktionsziele mit Empfänger zählen bestätigte Liefermenge und letzte Transfer-IDs persistent. Bestätigung wird vor dem Leeren des Wertjournals gespeichert. Gleiche Zielidentität (Name/Item/Level/Menge/Empfänger) startet nach Reload nicht neu; ein bewusst neues Ziel erhält eine neue Identität. Allgemeine Budgets werden dabei nicht automatisch zurückgesetzt.

## Merchant-Ergänzungen (0.4.0-merchant)

Der C-Vertrag wird additiv um optionale `merchant.partialBank` (false) und `partialBankMaxStack` (9999) erweitert. Alte C-Profile ohne diese Felder bleiben gültig. Die vollständige Werkstatt ergänzt Vorgaben beim Paketimport. Aktivierte Teilentnahme erlaubt einen begrenzten temporären Arbeitsbestand oberhalb der Item-Höchstmenge, nur bis zur bestätigten Rest-Rücklagerung. Zwischenstand `albot:bank-partial:NAME`, Bericht `bankPartial`; keine neue öffentliche Aktions-API. Offene Bankarbeit sperrt andere Inventararbeit, Rotation und Realmwechsel. Pausieren bleibt möglich; unbekannte Wertaktionen bleiben manuell abzugleichen.

Merrit beobachtet das offizielle eigene `character.on('merrit', handler)`-Ereignis; die API gibt eine Listener-ID zurück, Cleanup verwendet `character.remove(id)`. Für alternative EventEmitter-Kontexte steht ein on/off-Fallback bereit. Namensgebundene neue Receipt oder beobachtete zusätzliche Parcels bleiben alternative Bestätigungspfade. Keine CM-Nachricht oder Cash-Differenz als Geschenk interpretieren. Umfang und gezielter Ergänzungstest: [MERCHANT-ERGAENZUNGEN.md](MERCHANT-ERGAENZUNGEN.md).

## P3/P4 0.5.0

Aktuelles Paket: albot.p3p4/v1. Neue Ziellogik, Vorrang expliziter Regeln, Budgets, Rezept-/Itemdaten, Unterbrechung und Schema-Migration sind vollständig in [P3-P4.md](P3-P4.md) beschrieben. Öffentliche ALBot-API und Headless-Fähigkeiten bleiben gleich. Neue Berichtsbereiche: gearTargets, market, performance; production ergänzt autonomy/blocked. Alte A/B/C-Schemaerkennung bleibt erhalten. Werkstatt kann alte Profile in P3/P4 übernehmen; fehlende Felder erhalten Vorgaben, aktive Updater und unbekannte Felder werden abgelehnt. Explizite Auswahl beim Paketwechsel erhält bestehende Einstellungen. Der gemeinsame Test steht aus: [P3-P4-LIVE.md](P3-P4-LIVE.md).
