## Merchant-Pingpong/AutoDisposition-Härtung – 11.10.2026

Aus Live-Report `test-My_Merchant-2026-10-11T14-00-37-682Z-part001.json`: 53 Bewegungsaufträge in rund fünf Minuten, 40 Ankünfte, 15 bestätigte `bank.store`, aber wiederholte Bank–Mitspieler–Bank–NPC–Bank-Routen. Nach jeder `bank.store`-Bestätigung konnte die höher priorisierte `logistics.travel`-Routine den Merchant verlassen lassen, obwohl vor Ort weitere gültige Bankregeln warteten. `npcSell` prüfte das Konto-/AutoDisposition-Budget bisher erst nach Ankunft am NPC, wodurch vergebliche Routen möglich waren. Ein Bank-Reclaim verkaufte ein seltenes `cxjar` (`data:makeawish`) für 1 Gold.

Die neue `logistics.travel`-Routine respektiert innerhalb der Bankkarte vorhandene Lagerarbeitslisten aus gültigen `economy.rules` und freien Bankplätzen, bevor sie **normale**, nicht dringende Lieferfahrten plant. Kritische Trankversorgung bleibt ausgenommen. `npcSell` prüft `remaining` und `budget` vor der NPC-Anreise. Bank-`reclaim` darf nun nur **explizit freigegebene Verkaufsregeln** verwenden; dynamische Wertklassifizierung von Items mit `data` oder Sonderattributen unterbleibt. Eine adaptive Gruppe mit weniger Mitgliedern als aktuell online möglich nimmt nach Re-Stabilisierung zurückgekehrte Farmer wieder auf. Keine geänderten Budgets, keine automatischen Liveaktionen, kein Merge.

---

## NPC-Reichweite: maximale Interaktionsdistanz mit kleinem Puffer (11.10.2026)

Auf Nutzerwunsch nutzt der Merchant für **reguläre NPC-Interaktionen** (NPC-Kauf und -Verkauf, Upgrade, Compound, Craft, Exchange, Ponty) künftig **375 statt bisher typischerweise 90** Spieleinheiten. Adventure-Land-Serverquelle [`node/server.js`](https://github.com/kaansoral/adventureland_mongodb/blob/main/node/server.js) setzt `B.sell_dist=400`, prüft z. T. strikt `<400`. 25 Einheiten Reserve gegen Positionsänderung, Tick-Latenz und Rundung. Sowohl `npcTravel` als auch der Dispatch-Guard `npcAt` verwenden dieselbe effektive Distanz, sodass der Bot nicht am Ziel ankommt und die Aktion anschließend wegen des bisherigen 110er Guards verweigert. Der NPC-Radius wird auch an `movement.go` übergeben und beendet Bewegungen, sobald der Character innerhalb des 375er Radius ist.

**Nicht auf 375 erweitert:** Bank/Bankpack (orts- und kartenabhängig), Gathering mit Radius 5, manuell gesetzter Merchantstand-Platz, Spielerhandel (separate 300er Grenze), Transport/Delivery und Skill-/Mluck-Reichweiten. `npcSell` validiert zudem verbleibende Aktionsanzahl und Freigabe-/Budgetstatus **vor** einer NPC-Reise, um unnötige Pendelwege zu vermeiden. Regressionen prüfen Grenze 375/376, NPC-Kauf/-Verkauf in 375 Distanz und unveränderten allgemeinen 90er Radius.

CI und Browser-Test erforderlich; ungemergter Draft PR #9.

---

## Merchant-Task-Lease: normale Nebenarbeit unterbricht keinen gehaltenen Auftrag (11.10.2026)

Die Nutzerlogs meldeten `merchant.selected:53` in rund 5½ Minuten; davon waren 32 wiederholte `services`-Selektionen, nicht 32 tatsächliche Taskwechsel. `createFairTasks.rank()` priorisierte bisher jedoch jede lokale Nebenaufgabe **vor** einem gerade gehaltenen Job, obwohl `taskHoldMs=30000` festgelegt war. Dies erklärt einen Teil der schnellen Wechsel nach Ankunft an NPCs. Der Scheduler bevorzugt nun den bestehenden Task innerhalb des 30-s-Haltefensters, solange keine kritische Aktion ansteht und kein anderer Task unzulässig lange wartet. Explizit kritische Bank-/Verkaufsaktionen bei knappem Inventar, dringende Gold-/Itemtransfers und Freigabe-/Sicherheitsprüfungen bleiben höher priorisiert. `merchant.selected` wird nur bei wirklicher Task-ID-Änderung geloggt; tatsächliche Ausführungen bleiben im Aktionslog. Neue Regressionstests prüfen normalen Hold und Notfall-Vorrang. Nicht im Browser neu abgenommen, keine Live-Aktivierung oder Änderung an Benutzerbudgets.

---

## Merchant-Routen, Gathering und Rogue-Waffen nach In-Game-Livelogs (11.10.2026)

**Aus Nutzer-Uploads vom 11.10.2026, 12:36:53–12:42:52 UTC:** My_Rogue (Stufe 38, class `rogue`) hatte `fireblade +0` in `mainhand` und keinen belegten `offhand`. Der Merchant hatte nach Lieferungen noch **eine** `fireblade +0` im Inventar. Über das beidseitig bestätigte Delivery-Protokoll wurden Rogue *fünf* Gear-Items übergeben (fireblade, shoes1+3, wshoes+3, poker+3, hpamulet+1), aber nur `gear.equipped` für Fireblade im `mainhand` sowie `gear.equip` 1/1 waren nachgewiesen. In `cfg.production.gearTargets` keine harten Vorgaben; die optimierende Zielwahl listete `blade +3` **mainhand**, nicht `fireblade` offhand. **Ob die konkrete Fireblade legal offhand ist, lässt sich aus den Reports ohne aktuelle `G.classes.rogue.offhand` und `G.items.fireblade.wtype` nicht sicher schließen.** In-Game-Teamcheck erhält daher genau diese read-only Spiel-Metadaten. Eine zweite Waffe wird nicht ohne Game-Klassenkompatibilität automatisch versendet. Sparse `character.slots` war zudem eine bestätigte Gear-Sperre für leere Slots: `createGear.equip` forderte `Object.hasOwn(slots,target)` statt die Klasseneignung zu prüfen. Dies wurde für fehlende, aber gültige Slots korrigiert.

**Merchant-Report (5m36s):** `merchant.selected` 53 insgesamt, davon **32× services**, 11× acquisition, 6× production, 4× market.background. Nicht jede erneute Auswahl ist ein Taskwechsel. 34 Bewegungsanfragen, 21 Ankünfte, **2 native smart_move-Fehler** (woffice; main -942/-352). `merrit` meldete mehrfach „kein freigegebenes Angebot/Kaufgesuch“ und der Merchant fuhr dennoch davor teilweise zu einem Merrit-Punkt. Nach erfolgreichem `smart_move` zu Gathering-Route startete kein einziger `gather.mining`/`gather.fishing`-Aufruf. Inventar zuletzt **37 belegt, 5 frei**, `merchant.minFreeSlots=4`, `bankWorkspace=2`; trotzdem verweigerte die Gather-Logik Offhand-Unequip bei `free<=minFreeSlots+1` (5<=5), obwohl exakt **ein** Slot benötigt wird und vier Reserveplätze verbleiben würden. Früh beginnende 30-Sekunden-Service-Slice konnte sogar während der Anreise unterbrechen, und die Auswahl der Gathering-Art war nicht an einen begonnenen Weg/Toolwechsel gebunden. Ebenfalls implementiert war der unbegründete Merrit-Lauf ohne verkaufbares Standangebot.

**Gezielte Härtung:** Offhand-Unequip zulassen, sobald `free>minFreeSlots` (volle Reserve bleibt erhalten); beim fehlenden Slot weiter sicher warten. 30-s-Slice erst nach Beginn der tatsächlichen Arbeit am Ziel zählen, nicht während Wegsuche. Während `approaching` oder `kind` läuft keine spontane Umschaltung zwischen mining/fishing. Merrit ohne gültiges Standangebot gar nicht erst anlaufen (60s Wiederprüfintervall); alle Ausgaben nach wie vor read-only dokumentiert. Kein ungezielter Verkauf, kein Budgetwechsel, kein Merge. Offline-Regressionen für diese drei Gates und Gear in leeren Slot hinzugefügt. Vor der Livefreigabe vollständige Linux/Windows CI und Browser-Sichtprüfung notwendig.

---

## In-Game-Testbedienung ohne DevTools-Konsole (11.10.2026)

Auf Nutzerwunsch bietet das bestehende ALBot-Panel bei `general.ui:true` und `general.testLogging:true` neu den Knopf **„Party/Kampf prüfen + speichern“**. Ein Klick zeigt Party-ID, aktuelle adaptiv gewählte Teamliste, Leader, frische Heartbeat-Peers und Angriffszahl im Spiel an und lädt gleichzeitig ein kompaktes `albot-teamcheck-<charakter>-<zeit>.json` herunter. Die Datei enthält außerdem echte Ingame-Party-Mitglieder (falls API sichtbar), Parteianfragen und deren Statistik, Farmplan, Attack-Ergebnisse, Inventarsperren und letzte Fehler. Bestehende UI-Knöpfe Start/Pause/STOP und „Testlog speichern“ bleiben unverändert; letzterer weiterhin für vollständige Testberichte.

Die API-Aufrufe `ALBot.teamCheck()` (read-only) und `ALBot.exportTeamCheck()` (Download) stehen für optionale Automatisierung zur Verfügung; für reguläre Verwendung ist keine Konsoleneingabe erforderlich. Die Funktion führt keine `send_party_invite`, Bewegung, Kampf-, Handels- oder Wertaktionen aus und greift keine Code-Editor-Inhalte an. Prüfung durch Unit-Tests inklusive echter Mock-Download-Auslösung. Browser-Liveinteraktion muss noch manuell bestätigt werden.

---

## Teamkoordination: Offline-Farmer blockiert adaptive Gruppenbildung (11.10.2026)

**Quelle: vier vom Nutzer bereitgestellte `albot-test-report`-JSON-Exporte** um 11:38–11:42 UTC für My_Merchant, My_Ranger1, My_Ranger2 und My_Rogue auf `EUII`. Bei allen vier war `My_Ranger3` weder gesehen noch frisch. `account.names` blieb dennoch überall `["My_Ranger1","My_Ranger2","My_Ranger3"]`, obwohl `My_Rogue` bereits Heartbeats sendete. `My_Ranger1` erhielt acht `invalid`-Ablehnungen für Party-Einladungen an Ranger3; an Ranger2 gingen fünf `returned`-Einladungen, aber **kein Report beweist einen angenommenen Ingame-Party-Beitritt**. `My_Ranger2` meldete `Warte auf Kampf-Leader`, mit je fünf `move`-Aufträgen und nur einem `movement.arrived`, aber **null Attack-Starts**; seine Ereignisse wechselten zwischen `farm`-Weg nach (−82, 1901) für `snake` und `follow` zu Ranger1 bei (102, −361). `My_Rogue` adoptierte einen Farmplan, blieb aber außerhalb der ausgewählten Dreierliste und startete keine Angriffsaktionen. Ranger1 hatte `plan.selected: snake` und keine Attack-Starts und wurde vor Export pausiert. Die Heartbeat-Kommunikation selbst war zwischen den aktiven Charakteren funktionsfähig.

**Code-Ursachen:** In der bisherigen `createAccount.tick()`-Rotation verhinderte `!bot.farmers.every(safe)` bei einem nicht laufenden Ranger3 **jede Neuwahl**. `teamPlan.travel()` ließ Follower unabhängig vom Leader zum Farm-Spawn reisen, bevor `farmer.tick()` sie zum Leader zurückschickte. Der Invite-Loop filterte nicht auf frische online Peers; im Browser ist zudem der tatsächliche Empfang/Annahme von Ranger2-Einladungen aus den Reports nicht ersichtlich.

**Fixes im Draft PR #9, Head `00f93b4`:** Nach maximal 15 s Initialstabilisierung wählt der Merchant-Koordinator bei missing selected peers automatisch vorhandene lebende Team-Clients und bevorzugt den ursprünglichen Leader, sofern online. Beispiel `Ranger1, Ranger2, Rogue` statt `Ranger1, Ranger2, Ranger3`. Falls der Leader nicht mehr frisch ist, wird ein aktiver Ersatz gewählt. **Keine neuen `start_character`- oder `stop_character`-Aufrufe in dieser Sofortkorrektur**. Die gewählte Liste wird über den existierenden Account-Heartbeat verteilt. Nur der Leader startet Farmreisen; Follower folgen seinem tatsächlichen Ort und bekämpfen erst danach gemeinsame Ziele. Der Party-Invite-Loop ignoriert offline Empfänger; als fallback können ausgewählte Follower im Browser nach 30 s einen `send_party_request` an den erreichbaren Leader senden (nur wenn keine Party besteht). Öffentlicher read-only Status: `gameParty`, `teamLeader`, `selectedFarmers` in `ALBot.status()` und `party` im Testreport.

**CI:** [GitHub Actions #38137074435](https://github.com/Riflex91/ALBot/actions/runs/38137074435), **277/277 Offline-Tests** auf Linux und Windows, darunter neue Tests für dynamischen Ersatz, Leader-Fallback, Heartbeat-Adoption und Verhinderung unkoordinierter Follower-Farmreisen. Die persönlich konfigurierte Runtime im separaten ZIP nutzt **dieselben geprüften Runtime-Bytes** (`857cc5074e80f4e9314101dff164517d6f33e96cdc1c7782e00a22e41039c5c8`); Profil mit 8 Charakteren, 26 Regeln, `autostart:false`, Stand-Idle 2 s, schema-validiert, Syntax geprüft.

**Live-Gate (noch offen):** Auf Merchant, Ranger1, Ranger2, Rogue den identischen korrigierten Vollbetriebscode laden, jeweils manuell starten. Nach 30–60 s kontrollieren: Merchant wählt tatsächlich `Ranger1, Ranger2, Rogue`; `gameParty` zeigt bei mindestens zwei ausgewählten Farmern gleiche Ingame-Gruppe; erster echter Angriff/Attack-Result wird im Verlauf beobachtet. Bei fehlendem tatsächlichem Spielparty-Beitritt Benutzerstatus und `on_party_request`-Ablehnungen sichern, nicht allein von Heartbeats auf eine erfolgreiche Party schließen. Kein Merge, kein automatischer Live-Start.

---

**Anpassung des Stillstandsfensters (11.10.2026):** Auf ausdrücklichen Nutzerwunsch wurde die Wartezeit vor `open_stand` von 10 s auf **2 s echten, ununterbrochenen Stillstand** verkürzt. Alle zuvor implementierten Sperren für aktives `move`, `smart_move`, native Pfadsuche, `town`, Pending-`stand` und konkurrierende Executor-Jobs bleiben unverändert. Zusätzliche Regression für den Neustart der Stillstandsuhr nach einer Bewegungsunterbrechung. Änderung erst nach erneuter Linux/Windows-CI und Ausgabe eines aktuell geprüften Builds zur Nutzung vorgesehen.

## Merchant-Stand während aktiver smart_move-Wegsuche geöffnet (11.10.2026)

**Nutzermeldung samt Browser-Testreport:** Trotz Status `Unterwegs: services` läuft der Merchant mit geöffnetem Merchantstand und damit stark reduzierter Bewegungsgeschwindigkeit. Der Vollbetriebsreport dokumentiert u. a. um 11:23:00 UTC `movement.request` (`smart_move` nach `tunnel`) und im selben Moment `action.start:stand`; Abschluss `stand` 11:23:01 UTC, Weg nach zwei Minuten `timeout`. Erneute `travel.town`-Aktion 11:25:08 UTC und Standöffnung 11:25:10 UTC **während** der Reise. Reportzählung `stand` 12/12, `stand.close` 11/11 in ~5 Minuten; `inventoryBlocked:false`, `journal:null`, Bot laut Report anschließend pausiert. **Das ist ein bestätigter Lifecycle-/Scheduling-Race, kein bloß langsamer Weg.**

**Selektive Härtung:** `src/merchant/controller.mjs` öffnet den Stand nicht mehr vor Job-/Movement-Planung, sondern ausschließlich nach einem durchgängigen 2-s-Stillstandsfenster (Nutzerwunsch, ursprünglich 10 Sekunden) und nur wenn kein lokaler/nativer `smart_move`, Town, Bewegung oder relevantes Executor-Frame läuft. Der Dispatch-Guard prüft die Bedingungen nochmals, damit zwischen Einplanung und Ausführung kein Stand während einer gestarteten Route geöffnet wird. `src/core/movement.mjs` blockiert zusätzlich den Beginn eines Merchant-Wegs, solange eine asynchrone Standaktion läuft, und prüft `!character.stand` vor der effektiven Wegausführung. Offen stehender Stand wird über die bestehende `stand.close`-Logik geschlossen; Bewegung darf erst nach der Schließung starten. Das reduziert Stand-Flattern und vermeidet die erhebliche Geschwindigkeitsdrosselung bei Wegsuche. **Offline-Regressionen dürfen einen echten Browser-Movement-Livetest nicht ersetzen.** Kein Eingriff in Wertjournale, Itemregeln, Goldbudgets oder Konfiguration.

---

## Merchant-Routefix: erste Live-Failover-Beobachtung (11.10.2026)

**Bestätigter Teilnachweis des Nutzers:** In der neu geladenen Normalbetriebsruntime mit Route-Failover blieb `My_Merchant` aktiv (`running:true`, `inventoryBlocked:false`, `journal:null`, `pending:1`, `runtimeWarnings:0`). Im Browser wurde um **11:22:52.676 UTC** eine `movement.request` nach `woffice` (owner `economy`, `mode:"smart_move"`, Ziel -170/-248) protokolliert. Nach 297 ms folgten genau eine `movement.route-quarantined` (retryAfter 1791718072973, reason `failed`) und eine `movement.failed` für `woffice`. Um **11:23:00.977 UTC** erfolgte bereits ein neuer `smart_move`-Request nach `tunnel` (280/-44), ohne erneuten `woffice`-Request im vorgelegten Ausschnitt. Vorher waren mehrere direkte `move`-Aufträge auf `main` mit `movement.arrived` bestätigt.

**Abnahmegrenze:** Die **Fehlererkennung, temporäre Quarantäne und alternative Zielwahl sind live beobachtet**; ein bestätigtes `movement.arrived` für `tunnel` liegt noch **nicht** vor. Mangels längeren Zeitfensters ist die komplette fünfminütige Vermeidung von `woffice` nicht live belegt; CI deckt sie offline ab. Keine neue Inventarsperre oder Runtime-Warnung im gelieferten Auszug. Für die schnelle Rückkehr können zusätzliche Farmer manuell gestartet werden; bei erneutem Bewegungsfehler-Spam oder unklaren Werttransfers die jeweilige Bot-Instanz pausieren.

---

## Browser-Merchant: erfolglose Mining-Route nach woffice (11.10.2026)

**Vom Nutzer gelieferter Normalbetriebs-Diagnoseauszug:** My_Merchant, `main` (24, -48), laufender `smart_move` mit owner `economy` zum Mining-Standort `woffice` (-170, -248), während Merchant-Serviceplanner `services` aktiv blieb. Gesamte Ereigniszähler `movement.request:37`, `movement.arrived:22`, `movement.failed:8`, `merchant.selected:78`; mehrere `smart_move`-Aufträge zu identischem Ziel scheiterten nach ca. 0,3 s mit `reason:"failed"`. Das ist **kein 12-s-Stall-Watchdog**, sondern eine Rückmeldung der nativen Wegsuche. Zwischendurch direkte `move`-Ankünfte auf `main`; wiederholte Strecken zwischen anderen Zielen und der fehlschlagenden `woffice`-Route sind belegt. Beim Report waren `inventoryBlocked:false`, `journal:null`, `pending:1`. Auf Benutzeranforderung nach rascher Rückkehr zum Normalbetrieb wurde eine begrenzte Failover-Härtung vorgenommen.

**Fix im Draft-Branch, noch nicht live bestätigt:** Ein fehlgeschlagener `economy`-Auftrag mit `mode:"smart_move"` sperrt vorübergehend seine Zielkarte für Gathering-Routen (5 Minuten, maximal 16 Cacheeinträge), inklusive beobachtetem `timeout`. `src/merchant/services.mjs` überspringt diese Zone und nutzt eine andere öffentliche Zone desselben Gathering-Typs, sofern vorhanden; andernfalls kein erneuter Gather-Weg bis zum Cooldownablauf. Dokumentierendes `movement.route-quarantined`-Ereignis. Nicht betroffen: Farm-/Kampfbewegung, normale Direktbewegung, manuelle STOPs, Gold-/Item-Policy, Bank-/Produktionsjournale, bestehende Budgets. Da die tatsächliche Ursache des nicht erreichbaren `woffice`-Pfades nicht bewiesen ist, wird die Karte nur temporär gemieden und nicht dauerhaft ausgeschlossen.

**Live-Gate:** Erst CI mit diesem Commit abwarten, anschließend beim Merchant beobachten: kein Miningschleifen-Spam Richtung `woffice`, keine neuen Inventarsperren und normale Peer-Heartbeats. Beim Auftreten eines neuen `movement.failed`-Musters erneut pausieren. My_Ranger3 meldete im getrennten Farmerlog 6 ungültige Party-Einladungen, nicht Teil dieses selektiven Movement-Fixes.

---

## Ranger-Schnellabnahme: Farm/Movement (11.10.2026)

**Browser-Livebeleg des Nutzers (tatsächlich durchgeführter 80-Sekunden-Schnelltest):** `My_Ranger1`, Karte `main`, 80.016 ms, anschließend automatisch pausiert (`paused:true`), keine Stornierung/Abbruchwarnung. Standort von (13,46; 189,70) nach (-30,10; 755,09). 7 `movement.request` und 6 `movement.arrived`, alle mit `mode:"move"`, `smartMoveStarted:false`, `smartMoveFailed:false`, `movementLiveEvidence:"not_observed"`. Die offenen Bewegungsaufträge sind **nicht** als `smart_move`-Erfolg zu werten. `runtimeWarnings:0`, `valueActions:[]`, Gold unverändert 500.582, nach Pausierung `inventoryBlocked:false`, `journal:null`, `pending:0`. Scheduler 318 Ticks, Ø 2,90 ms, Maximum 19 ms. Testurteil `SMOKE_OK` für die bewusst eingeschränkte Testkonfiguration.

Bei diesem **Einzeltest mit pausiertem Merchant** waren 41 Heartbeats vom Ranger versendet und 0 empfangen; der bidirektionale CM-Empfang ist separat bereits in Phase 1 live bestätigt. `action.start:17` vs. `action.end:13` sind kumulative Zähler und kein Beleg für 17 abgeschlossene Aktionen; vollständiges Ereignisjournal dieses Fensters wurde nicht mitgesandt, also keine darüber hinausgehende Transaktionsbestätigung behaupten.

**Beschleunigte Rückkehr:** Bereits grüne Offline-CI und bidirektionale Browser-Heartbeats nicht wiederholen. Zwei separate lokale, schema-validierte Profile vorbereitet: eingeschränktes `ALBot-Schnelltest-Ranger.js` für diesen Test und `ALBot-Normalbetrieb-Startbereit.js` (ursprüngliche acht konfigurierten Charaktere, 26 aktive Itemregeln, Betrags- und Risikogrenzen beibehalten; `general.autostart:false`; erforderliche aktuelle Pflichtdefaults ergänzt). Ein VM-Offline-Start von Ranger und Merchant mit dem Normalprofil war erfolgreich. **Voller Merchant-/Item-/Gold-/Bank-/Produktionsbetrieb wurde durch den 80-s-Rangertest nicht live geprüft; ein kontrollierter Wiederanlauf bleibt deshalb bewusst risikobehaftet und muss laufende Wertjournale/Fehler beobachten.** Originalprofil unverändert. Kein automatisch ausgeführter Normalbetriebsstart, kein Merge, keine erneute Codeänderung durch die Dokumentation.

---

## Browser-Phase-1-Beobachtungen und Transportdiagnose (11.10.2026)

**Vom Nutzer gelieferte Browserreports:** My_Ranger1 und My_Merchant mit Profil `ALBot Phase 1 - Browser-Diagnose`, `0.8.4-full`, EUII, `transport:auto`, je ~44 Sekunden beobachtet und wieder pausiert. Ranger: 852 Scheduler-Ticks, Ø 1,57 ms, max. 17 ms. Merchant: 170 Ticks, Ø 0,82 ms, max. 8 ms. Nach manueller Bestandsprüfung und Freigabe älterer `shoes +4`-/`beewings`-Journale blieben beide bei `inventoryBlocked:false`, `journal:null`, `pending:0`. Im kumulierten Rangerlog standen drei `regen`-Aufrufe; der genaue Zeitpunkt ist nicht belegt. Kein neuer Wertauftrag im beobachteten Testbericht. Bundle-SHA256 nicht vom Nutzer geliefert, daher konkrete Dateigleichheit zum CI-Artefakt nicht belegt. **Der folgende, spätere Browser-Livetest bestätigt den gegenseitigen CM-Heartbeat-Empfang; live `smart_move` bleibt ungetestet.**

**Codeerweiterung in PR #9, nicht in main:** `ALBot.transportStatus()` sowie `transport` im Testreport zeigen Zähler für Heartbeat-Versuch, erfolgreiche Adapter-Rückgabe, validierten Empfang, Versandfehler, abgelehnte Pakete und Duplikate. Je Team-Peer werden Empfangsalter, Session, Realm, Laufstatus, Frische gemäß TTL und Zähler angezeigt. Rein lesende Diagnose ohne zusätzliche CM- oder Wertaktion; keine Gold-/Item-/Inventardaten in dieser Übersicht. Das Feld `heartbeatSent` bedeutet **nur**, dass der CM-/IPC-Adapter Erfolg gemeldet hat, nicht dass der Empfänger das Paket erhalten hat; auf der Gegenseite sind `heartbeatReceived > 0` und `fresh:true` erforderlich. Bestehende Session-/Sequenzprüfung und Sicherheitslimits gelten weiter.

**Nachgelieferter Browser-Livetest – Kommunikations-Gate bestanden (11.10.2026):** Nutzer führte bei `My_Ranger1` und `My_Merchant` im Spiel die erneute manuelle Phase-1-Ausführung mit der korrigierten Diagnoseruntime `0.8.4-full` durch. Die Startvorprüfung meldete je `running:false`, `inventoryBlocked:false`, `journal:null`, `pending:0`, gegenseitigen Roster-Eintrag sowie null Zähler. Während beide danach liefen (`running:true`, Realm `EUII`) wurden folgende reale CM-Ergebnisse gemeldet:
  
| Messgröße | My_Merchant | My_Ranger1 |
|---|---:|---:|
| `heartbeatAttempts` / `heartbeatSent` | 18 / 18 | 23 / 23 |
| `heartbeatReceived` | **19** | **22** |
| Partner `fresh` / `running` | true / true | true / true |
| Empfangsalter Partner | 995 ms | 983 ms |
| `sendFailed` / `rejected` / `duplicates` | 0 / 0 / 0 | 0 / 0 / 0 |
| `inventoryBlocked` / Journal / `pending` | false / null / 0 | false / null / 0 |

Die gemeldeten Peer-Sessions waren `My_Ranger1-mv3p46j3-h3626b` beim Merchant und `My_Merchant-mv3p49y7-ibad4w` beim Ranger. Beide sahen `realm:EUII`. Sende-/Empfangszähler sind Momentaufnahmen und müssen nicht übereinstimmen; **entscheidend ist der validierte Empfängerzähler auf beiden Seiten**. Die Diagnose enthält keinerlei Item-/Goldtransfers; aus den Statusausgaben allein folgt auch kein vollständiger Aktions-/Wertlog-Nachweis für das letzte Zeitfenster. Der Nutzer wurde angewiesen, beide Bots anschließend zu pausieren; separate Bestätigung der Pause steht noch aus. Eine erneute Hashmessung der real geladenen `bot.js` fehlt weiterhin. **Keine Livefreigabe von `smart_move`, Farming, Kampf, Merchant-Wirtschaft oder Wertaktionen**; als nächste Teilphase zuerst sichere Standortkoordinaten und eine kontrollierte Movement-Testfreigabe beschaffen.

---

## Freigabevorbereitung: Movement-Korrektur und Browser-Phase 1 (11.10.2026)

**Code-Gate auf dem Arbeitsbranch:** `smart_move`-Suche wird nicht mehr vom 12-s-Positions-Stall-Watchdog abgebrochen, `move` hingegen schon. Ein unabhängig in `parent.smart` aktiver Such-/Bewegungszustand wird beim Stoppen bzw. vor dem Merchant-`town` erkannt. Absolute 120-s-Grenze bleibt aktiv; `movement.failed` gibt `no_progress` oder `timeout` aus. 5 neue Regressionen, [CI 38129349846](https://github.com/Riflex91/ALBot/actions/runs/38129349846), **261/261 Tests auf Linux und Windows** plus Build/Editor/SHA256. Keine echte Spielbewegung dadurch nachgewiesen. **PR #8 ausdrücklich nicht gemergt.**

**Phase 1 – konkret und ohne Wirtschaft:** CI-geprüftes `dist/albot.js` ausschließlich aus dem neuen PR-#9-Review-Artefakt wählen; keine ältere persönliche Test-/Live-C-Datei ersetzen. In **separater Kopie** des gültigen `albot.full/v1`-Profils vor dem Laden `general.autostart=false`, `general.testLogging=true`, `farming.enabled=false`, `farming.autoTravel=false`, `farming.loot=false`, `merchant.enabled=false`, `merchant.collectGold=false`, `production.enabled=false` und die World-Aktivitäten `world.bosses/events/quests/anniversary/autoHop=false` prüfen. Bestehende Nutzerbudgets, Regeln, `keep`-Vorgaben und Charakterzuordnung unverändert lassen. Erst einen Charakter in Browser-CODE laden, `ALBot.status()` (running=false, pending=0, journal/inventoryBlocked) prüfen, Testlogging/Report sichern und nur nach kontrollierter Zustimmung `ALBot.start()` aufrufen. Danach zweiten Charakter, Heartbeats/Session/Realm/Timer, anschließend `pause`/erneutes `start` ohne Wertaktionen prüfen. **Keine automatische Kampf-/Produktions-/Market-/Gold-/Itemfreigabe in Phase 1.**

**Belege:** Pro Charakter Browser-Testreport/`.jsonl`, aktive Bundleversion und SHA256, UTC-Zeit/Session, `action.selection/start/end`, `movement.request/arrived/failed`, `scheduler.slow`, `runtime.warning`, frische Peer-Heartbeats. Vor jeder späteren Bewegungs-/Bee-Phase `smart_move`-Wegsuche und Abbruchursachen im Browser tatsächlich messen. Unter **keinen** Umständen `acknowledgeInventory` benutzen, um eine offene ungeklärte Wertaktion pauschal freizugeben. Unklarer Journal-/Inventarstatus oder unerwartete Spielaktion = sofortiger Abbruch. **Browser-Test ist nur vorbereitet, noch nicht durchgeführt.**

## Zusätzlicher Abnahmefall: Item-Storno ohne Versand (11.10.2026)

**Bereits offline getestet:** Ein Itemempfänger akzeptiert ein Angebot und speichert `receive`. Bei Sender-STOP/Pause **bevor** `send_item` ausgeführt wird, oder bei Inventardrift im noch nicht ausgeführten Angebot, erhält der Empfänger `itemCancel/notDispatched` und darf sein Journal nur bei identischer Absender-Session/ID, unverändertem Bestand und ohne `sent`/beobachtete Lieferung abschließen. Späte, doppelte, fremde sowie nach einem gestarteten Versand empfangene Stornierungen dürfen keine Inventarsperre aufheben. Das neue Ereignis `logistics.cancelled` zeigt ID, Peer, Abbruchzustand und Grund; die **fehlende** Nachricht (Transportausfall) ist ausdrücklich **kein** Bestätigungsnachweis. [CI 38128697671](https://github.com/Riflex91/ALBot/actions/runs/38128697671): je 256/256 Offline-Tests auf Linux und Windows, gemeinsames Bundle und Manifest erfolgreich.

**Noch erforderlicher Live-Nachweis in Phase 3/6:** Nur nach ausdrücklicher Erlaubnis die reale `offer/accept`-Kette mit kontrolliertem STOP **vor** dem Versand beobachten. UTC-Zeit, Sender/Empfänger-Session, Message-ID und `inventory.intent/result`, `logistics.cancelled/timeout`, `action.start/end` in beiden Logs abgleichen. Nach **bereits begonnenem** `send_item` nicht bewusst nachträglich ein Cancel zur Freigabe erzwingen. Bestands-/Goldabweichungen oder Storage-Ausfälle weiterhin manuell und fail-closed behandeln. Keine freigegebene Live-Aktion in dieser Offline-Runde, kein automatischer Login, Merge oder Deployment.

## Ergänzung – Empfänger-Session als Handoff-Gate (11.10.2026)

**Offline bestätigter und behobener Integrationsfehler:** Ein bereits akzeptiertes Itemangebot darf nicht über eine Empfänger-Runtime-Session hinweg ausgeführt werden. Zwei simulierte Charaktere prüfen `offer` → `accept` → Empfänger-Reload mit neuer Session → **kein** `send_item`, **kein** neues Senderjournal; auch wenn die neue Session erst zwischen Scheduler-Einplanung und `Executor.flush()` sichtbar wird. Die verworfene, noch nicht ausgeführte Zusage erzeugt `logistics.session-changed`. [CI 38128018952](https://github.com/Riflex91/ALBot/actions/runs/38128018952): **250/250 Tests je Linux/Windows**, Builds und Bundle-Hash erfolgreich. Das ist kein Beleg eines echten Itemtransfers im Spiel.

**Zusätzliche Live-Gates für Phase 3 und 6:** Bei kontrollierten, manuell freigegebenen Tests Session-ID des Senders und Empfängers für jede `offer/accept/sent/receipt/done`-Kette erfassen. Wird der Empfänger **vor** dem Versand neu gestartet, darf kein veralteter Versand erfolgen. Nach einem **bereits versandten** oder nicht eindeutig quittierten Item bleibt die Inventar-Journalsperre bis zur belegten Bestandsprüfung erhalten. Zu Diagnosezwecken `logistics.session-changed`, `logistics.timeout`, `inventory.intent`, `inventory.result` und `action.selection/start/end` mit UTC-Zeit korrelieren; bei Differenzen sofort abbrechen. Kein Auto-Retry, kein automatisches Quittieren.

# PR #9: Gemeinsame Integrationsprüfung und kontrollierte Live-Abnahme

Stand: **11. Oktober 2026**. Gilt für den **nicht gemergten** Arbeitsbranch `work/u01-u02-source-verification-20261010` in [PR #9](https://github.com/Riflex91/ALBot/pull/9). **Nicht** als vorhandene Livebestätigung interpretieren. Testphase erst nach bewusster manueller Auswahl des passenden Builds und der eigenen Konfiguration starten; **kein** automatischer Login, Deployment, Merge oder Game-API-Aufruf durch die Offline-CI.

## Bereits offline geprüft

- Derselbe Runtime-Build und das Werkstattpaket durchlaufen Node-Suite, Browser-/Headless-Harness, Syntax und Byte-/Manifestprüfung auf Linux und Windows.
- Teamstatus mit gleichzeitig großen Gear-, Farm-, Produktions-, Performance- und Account-Zusätzen bleibt unter der **5-KB-Grenze** für CM/IPC. Sicherheitsrelevante Felder (Gold, Transfersperre, Journal, Inventarsperre, Status, Realm und Peer-Bedarf) werden bevorzugt erhalten; rein optionale Angaben fallen zuerst weg.
- Ein zweiter simulierter Charakter empfängt den gekürzten Status und verarbeitet den anstehenden Goldtransfer in der Account-Risikoberechnung konservativ. Explizites `false` oder `{success:false}` der Transportadapter wird nicht als erfolgreich gemeldeter Versand behandelt.

## Vorbereitungen ohne Spielaktionen

1. [PR #9](https://github.com/Riflex91/ALBot/pull/9) und [Roadmap](../ROADMAP.md) abgleichen. Erst einen **erfolgreichen CI-Lauf auf exakt dem ausgewählten Commit** abwarten. Für einen lokalen Windows-Abgleich die vorhandenen Skripte nutzen: `npm ci`, `npm test`, `npm run build`, `npm run build:editor`, `scripts/VERIFY-U01-U07.ps1`. Keine persönlichen Profil- oder CODE-Dateien überschreiben.
2. Vollbetrieb-Konfiguration `albot.full/v1` beibehalten. Testlogging (`general.testLogging`) einschalten und kontrollieren, dass Namen, Charakterklassen, Realm, erlaubte Monster, Gruppenleiter und Merchant konsistent sind. Einstellungen für bewusst ausgeschaltete Funktionen nicht versehentlich einschalten. Eigene Goldreserve, `maxSpendPerHour`, `lossBudget`, Mindestchancen und `keep`-/`teamReserve`-Regeln beibehalten.
3. Headless: Ausgabe **Desktop/ALBot-Testlogs**, je Charakter eine eigene mit Startzeit benannte `.jsonl`-Datei. Browser: `chooseLogDirectory` nach ausdrücklicher Ordnerfreigabe oder `exportTestReport` / „Testlog speichern“. [Betriebsanleitung](VOLLBETRIEB.md) beschreibt Speicherort und Format.
4. Zu Beginn der Abnahme alten **offenen** `journal`-/`inventoryBlocked`-Status und bereits laufende Spiel-Standangebote feststellen. **Kein** `acknowledgeInventory` ohne manuellen Vergleich der wirklichen Bestände. Ein offener unbekannter Wertauftrag stoppt die Abnahme wirtschaftlicher Aktionen.

## Kontrollierter gemeinsamer Live-Test – Freigabereihenfolge

Die folgenden Zeitfenster sind **Prüfumfang und Orientierung**, keine behaupteten Messungen oder garantierte Zeit. Während aller Phasen dieselbe Runtime, dieselbe Party und dasselbe Profil verwenden; einzelne Risiken nur bewusst gezielt freigeben.

| Phase | Beobachten / zulassen | Bestehenskriterium / Nachweis |
|---|---|---|
| 1. Start / Teamstatus | Browser und Windows-Headless jeweils mit echtem Charakter, anschließend Merchant + Farmer; Heartbeats, Realm und Roster | Je Instanz genau ein Scheduler, gültige Peer-Statusmeldungen; keine ausbleibenden Heartbeats durch übergroße Daten, keine ungewollten Duplikate oder Charakterstops |
| 2. Kampf / Farming | Sicher freigegebene Monster, Leader, Aggro, AoE/Pull, Retreat, Aura und Nachschubbedarf | Keine unerlaubten PvP-/Fremdziele, keine ungewollte gefährliche Pull-Eskalation; Kampf/Erholung behalten Vorrang |
| 3. Item-/Goldlogistik | **Eine** kleine ausdrücklich freigegebene Item- und Goldübergabe zwischen realen Charakteren | Vollständige Offer/Accept/Sent/Receipt/Done-Kette, Menge stimmt auf beiden Seiten; Transfers werden nicht als Vermögenszuwachs doppelt gezählt |
| 4. Wirtschaft / Produktion | Einzelnes risikoarmes, explizit erlaubtes Crafting einschließlich vorbereitendem Merge; erst danach ein gesondert freigegebenes kleines Upgrade/Compound, falls Zutaten/Scrolls/Chancen vorhanden | Rezeptpositionen, Materialreserven, Produktionsziel, reale Vor-/Nachbestände und Wertjournal passen zusammen. Keine wiederholte Wertaktion bei unklarem Ausgang |
| 5. Markt / Bank / Service | Geringwertige zulässige Handels-/Wishlist-Aktion und Bedarf für Merchant, Bank-/Werkzeugabläufe | Live-Preis/Slot/Instanz eingehalten; kein geschütztes Item verkauft; freier Platz, Budget und Werkzeugrückwechsel korrekt |
| 6. Unterbrechung / Wiederanlauf | Pause/Resume während **wertfreier** Arbeit; Reload erst bei ruhendem Wertjournal; anschließend mehrere Charaktere gleichzeitig beobachten | Ein Timer und keine geleakten Listener; kein doppelter Transfer oder Replay; Risiken, Reserven und Scheduler bleiben konsistent |

**Sofort pausieren**, wenn ein unbekanntes Wertjournal, eine unerklärte Gold-/Itemdifferenz, wiederholte Transferaufträge, drohende unkontrollierte Goldverluste, falsch freigegebene Items, fremde Kampfziele, eine kritische Bewegungsschleife oder ein außer Kontrolle geratenes Tick-Zeitbudget erkennbar sind. Laufende unklare Aktionen niemals blind erneut senden oder Journale einfach löschen.

## Erforderliche Belege für die Auswertung

- Pro beteiligtem Charakter das **neueste Headless-JSONL**; bei längeren Aktionen zusätzlich die direkt vorherige Teildatei. Für Browser-Test die zugehörigen Dateien oder Testberichte.
- Zu jedem auffälligen Vorgang: UTC-Zeit, Charakter/Rolle, Realm/Map, Art des Auftrags, gewolltes Ergebnis, tatsächlich beobachtete Vor-/Nachbestände und ob bewusst pausiert/neugestartet wurde.
- Besondere Eventfamilien: `action.selection`, `action.start`, `action.end`, `inventory.intent`, `inventory.result`, `logistics.*`, `gold.*`, `production.*`, `scheduler.slow`, `runtime.warning`. Logs ohne Roh-Socketdaten/Zugangsdaten weitergeben.
- Fortschrittsmetriken getrennt ausweisen: XP/h, belegte Netto-Goldänderung **ohne interne Transfers**, Tode/Retreats, fehlgeschlagene Lieferungen, offene Journale, Zeit in Wartestellung, Produktoutput und Tick-Laufzeiten.
- Für jedes bestätigte Liveproblem: reproduzierbare Konfiguration (ohne Geheimnisse), betroffene Logzeilen, tatsächliche Spielwirkung, erwartete Wirkung, kleinste Korrektur und erneuter Regressionstest.

## Freigabe-Gates

- **Code/CI:** vollständig bestanden auf genau dem PR-HEAD (Linux + Windows, Paketparität).
- **Live-Integration:** wird **erst nach** den genannten realen Tests als bestanden markiert. Ein älterer bestandener Live-C-Teiltest bestätigt nicht automatisch neue U01–U07-Funktionen.
- **Merge:** PR #9 bleibt **Draft**, bis der Diff geprüft, überlappende ältere PRs (insbesondere [PR #8](https://github.com/Riflex91/ALBot/pull/8)) bewusst eingeordnet und Livefehler behoben oder dokumentiert sind. `main` nicht vorzeitig überschreiben.
- **Noch nicht belegt:** echtes `get_progression()` in Browser/Headless, alle Klassen-/Boss-/Eventfälle und Linux-Livebetrieb. Ohne passenden Testfall ausdrücklich **nicht getestet** notieren.
