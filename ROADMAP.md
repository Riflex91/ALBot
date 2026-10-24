## W06/G09 – Farmer-Materialquoten gegen eigene physische Inventarbelege (24.10.2026)

Die bisherige sichere endliche Materialquotenverteilung kann jetzt eine **zweite eigenständige Mengenbeobachtung** verwerten: wenn ein Farmer im gleichen frischen, session-/realmgebundenen Heartbeat zusätzlich zum Materialfortschritt ein vollständiges Inventarevidenzprotokoll mitsendet, müssen Materialfortschritt und physische Itemmenge logisch konsistent sein. Widersprüche, veraltete/Future-, Realm-/Owner-/Sessionabweichungen, Duplikate und ungültige Mengen frieren den gesamten Materialauftrag statt einen nicht belegten Mehrbedarf auf andere Farmer zu verteilen. Die beobachtete physische Summe schließt gesperrte Bestände ein; deshalb liegt der vom Farmer gemeldete tatsächliche verfügbare Progress konservativ zwischen physisch freien und gesamten vorhandenen Stückzahlen. Ein wegen des bestehenden Heartbeat-Bytebudgets ausgelassener optionaler Vollbeleg ist **kein** künstlicher Nullbestand; der bisherige sichere Materialfortschrittsbeleg bleibt verwendbar. Es entstehen weder Transfer- noch Kauf-/Sell-RPCs, und eine Peer-Meldung ist weiterhin keine offizielle Serverquittung. [Details und Grenzen](docs/W06-MATERIAL-PHYSICAL-QUOTA-CONSISTENCY-2026-10-24.md). Vollständig beidseitige Handelsquittungen, accountweite Bankautonomie und W14-Ingame-Dauertest bleiben offen.

## W02/W04 – physisch freie statt nur vorhandene Betriebsvorräte (24.10.2026)

Der Merchant zählt bei NPC-ersetzbaren Betriebsvorräten nur ungebundene, physisch gültige Itemkopien als verfügbare Reserve. Gesperrte, reservierte, auszustellende oder ausgerüstete Stückzahlen derselben Variante können den geschützten Boden weder für den Banküberschussverkauf erfüllen noch den Inventarverkauf aufblähen. Bei physisch bestätigter Bankdeckung kann stattdessen zusätzliches ordentlich journalisiertes Reservestaging stattfinden. Selbst gebundene Stapel werden weiter auf korrekte physische Mengen geprüft. Die Bankreserve-Neustart-Recovery verwendet exakt dieselbe freie Menge wie der ursprüngliche Dispatch. Jede verzögerte Aktion prüft die aktuellen Slots erneut; Nutzerregeln, Locks, Limits, ECDSA-Verträge und V2-Bootstrap bleiben unverändert. [Details](docs/W02-W04-UNENCUMBERED-OPERATING-RESERVE-2026-10-24.md). Vollständige accountweite Koordination und W14-Liveabnahme bleiben offen.

## W03/W04 – persistente Bankreserve über CODE-Neustart (24.10.2026)

Die Reserve-Staging-Folge erhält eine eigene **dauerhafte, strikt owner-/realm-/varianten-/mengen-/schrittgebundene Wiederaufnahmespur**. Vor jedem echten Einzel-/Teilbank-Dispatch wird zusätzlich zum vorhandenen Originaljournal die Reserve-Folgenvorbereitung geschrieben; die Dispatchgeneration wird erst nach dem originalen Bank-Dispatch-Journal durable markiert. Nach Browserneustart darf nur ein separat bestätigter physischer Inventarzuwachs plus exakt erwarteter lokaler Quellbankrest die Folgenschrittquittung liefern. Prepared-only ohne Dispatch wird nur bei unverändertem Vorzustand aufgeklärt. Widersprüche blockieren weitere Wertaktionen; persistierte Cursor berechtigen nie selbst zu Verkauf, Entnahme oder neuem RPC. Nach vollständigem physischem Reserveboden wird die Folge gelöscht; **danach** kann ein unabhängiger Bankverkaufsscan neu autorisieren. Die Folge ist auf 16 bestätigte Schritte begrenzt. Die bestehenden Regeln und Journale bleiben bindend. Regression: `test/roadmap-w04-bank-disposition.test.mjs`. Weitere accountweite parallele Reservierungsplanung, Live-Serverquittungen und W14-Abnahme bleiben offen.

## W04 – terminale physische Reservestaging-Folge (24.10.2026)

Der automatisch erzeugte NPC-ersetzbare Betriebsvorrat kann nun eine fehlende Bankreserve über mehrere einzeln persistierte, physisch bestätigte Entnahmen schließen, auch wenn der letzte ganze Stapel die Restlücke übersteigt und Teilentnahme deaktiviert ist. Die Überfüllung ist auf höchstens einen Schutzboden pro Schlussstapel begrenzt und folgt anschließend den unveränderten Inventar-Verkaufsregeln; explizite Keep-/Batch-/MaxCount-Limits werden nicht überschrieben. Pro Schritt müssen aktueller Realm, lokale Bankkopien, Gesamtbestand und ursprünglicher Dispatch-Quellslot unverändert und belegbar bleiben. Eine nicht quittierte Operation wird nicht wiederholt. Vollständig persistente accountweite Mehr-Schritt-Koordination, Neustart-/Realm-Live-Recovery und W14 bleiben offen. Die Runtime 0.43.0-candidate wurde inzwischen mit Sequence 43 im geschützten GitHub-Kanal P-256-signiert (Workflow 40091743604); das ersetzt keine W14-Liveabnahme. [Implementierung und Regressionen](docs/W04-TERMINAL-FULL-STACK-2026-10-24.md).

## W05/W08 – relative Verbesserungswirkung bei konkurrierendem Gear-Vorrat (23.10.2026)

Falls der Merchant für mehrere freigegebene Farmer nur **eine echte Ausrüstungskopie** hält, vergibt der bereits bestehende `urgentStockUpgrade`-Pfad diese jetzt nach dem normalisierten relativen `item_properties`-Wertzuwachs für das jeweilige **eigene bisherige Slotgear**, nicht mehr nach unvereinbaren absoluten DPS-/Priest-/Tank-/Merchant-Punktdifferenzen. Physische Kopienzahl, Klassen-/Slotkompatibilität, Schutz/Locks, explizite Regeln, Survival-Eignung und das konfigurierte Minimum-Improvement bleiben unverändert; bei relativen Gleichständen gewinnt weiterhin stabile Namens-/Slotordnung. Der automatische Gearziel-Rankingpass verwendet außerdem **eine** einmalig beobachtete Gruppe und ein einziges bestätigtes Allokationsjournal statt pro Ziel veränderliche Snapshots zu holen. Verifizierte Wartealterquittungen zählen nur im exakt selben Realm und derselben gespeicherten Empfängersitzung, niemals aus der Zukunft. Regressionen unter `test/gear-delivery-035-regressions.test.mjs` und `test/roadmap-w05-measured-slot-utility.test.mjs`; signiertes Release und W14-Liveabnahme bleiben getrennt.

## W12/N11 – bestätigter Crypt-Austritt innerhalb derselben CODE-Sitzung (23.10.2026)

Die bestehende strikt journalisierte Crypt-Eintrittskette kann jetzt einen schon serverseitig **und physisch bestätigten** `inside-observed`-Checkpoint nach einem späteren, zweifach beobachteten regulären Rückweg auf die öffentliche `main`-Map abschließen. Voraussetzung sind dieselbe Prozesssitzung, Owner, Realm, Instanzquittung, lebender Charakter mit gültigen Koordinaten, kein konkurrierendes Journal/Executor-/Account-/Cave-Kommando und zwei eigenständige stabile Außenbeobachtungen im Abstand von mindestens zwei und höchstens 30 Sekunden. Der Erstbeleg ist ausschließlich volatil; ein Neustart, Rückkehr in die Crypt, unbekannte Map/Instanz oder Journaldrift widerrufen ihn. Der dauerhafte Originaleintrag wird erst nach erfolgreicher strikter Lese-/Schreibbestätigung gelöscht. Damit wird ein späterer **expliziter** neuer Eintritt wieder möglich, ohne einen neuen `enter`, `leave` oder anderen Game-RPC zu erfinden. `dispatch-unknown` bleibt zwingend blockiert; der Befund ist weder eine abgeschlossene Loot-/Dungeon-Auswertung noch W14-Liveabnahme. Tests: `test/roadmap-w12-crypt-keyed-entry.test.mjs`.

## W03/W04 – erneute physische Kapazitätsprüfung beim verzögerten Banknotverkauf (23.10.2026)

Die bereits vorhandenen zwei dauerhaften Druckbeobachtungen berechtigen eine irreversible Bankentnahme nur, wenn der **Executor unmittelbar vor dem tatsächlichen API-Dispatch** nochmals den geöffneten Bankbestand samt lokalem Workspace und sichtbar geöffneten Remote-Packs prüft. Neu freigewordener Platz oder ein neu beobachtetes nutzbares Pack sperrt den geplanten Notverkauf. Native kompakte Bankarrays repräsentieren auch bei kurzer Arraylänge 42 Slots. Defekte, zu lange, unbekannt zugeordnete oder unmöglich gestapelte beobachtete Packs können keinen vollständigen Bankdruck mehr belegen; bekannte `G.items`-Stackgrenzen gelten und unbekannte Items höchstens als Einzelstück. Unabhängige explizit freigegebene präventive Verkäufe und das bestehende Bankjournal bleiben unverändert. Dies ist keine neue Verkaufsbefugnis, keine W14-Liveabnahme und kein neues signiertes Release. Regressionen in `test/bank-pressure-per-pack.test.mjs`.

## N05/N10 – lokaler Respawn-Scout verweigert Aktionen bei unbekannter Monsterlage (23.10.2026)

Die zeitlich und räumlich begrenzte Einmal-Scout-Bewegung verwendet für Planungsfreigabe, verzögerten nativen Dispatch und aktive Sicherheitsüberwachung jetzt denselben prüfbaren, auf 128 Einträge begrenzten lokalen Monstersnapshot. Fehlende, fehlerwerfende, nicht-arrayförmige, übergroße oder physisch fehlerhafte Monsterlisten sind **keine Gegnerfreiheit**: Neue Scout-Bewegungen werden verweigert und laufende ausschließlich scout-eigene Bewegungen sicher gestoppt. Eine fehlgebildete/duplizierte Sicht kann auch keine passive **negative Respawn-Beobachtung** erzeugen; positiv tatsächlich sichtbare Monster bleiben weiterhin rein beobachtbar. Kein zweiter Hop aus derselben Kill-Quittung, keine neue Monsterziel- oder Farmregel, keine erfundene Spawnzeit und keine W14-Liveabnahme. Regressionen in `test/roadmap-n05-approved-local-scout-hop.test.mjs` und `test/roadmap-n05-respawn-evidence.test.mjs`.

## W12/N12 – verifizierte vollständige Einzelgegnerbeobachtung bei Cave-Notausweichen (22.10.2026)

Die bereits freigegebene kurze Ranger-Notausweichbewegung benötigt weiterhin exakt **einen** selbst angreifenden Cave-Nahkampfgegner und frische Priest-/Team-, Bewegungs- und Gesundheitsbelege. Die Auswertung ignoriert jedoch nicht mehr stillschweigend einen zweiten lebenden Gegner ohne belegte Map/Instanz: dessen unklare Lokalisierung blockiert jetzt den 28-Pixel-Direktschritt. Ebenso verhindern fehlerhafte, unlesbare oder übergroße lokale Monsterlisten eine Ausführung. Explizit fernab lokalisierte, nicht auf das Dreierteam zielende Gegner bleiben außerhalb der Cave-Gefahrengruppe. Der vorhandene native Dispatch-Guard bewertet diese Daten bei verzögerten Aktionen erneut. Keine Angriffs-, Smart-Move- oder Retreat-Freigabe zusätzlich; W14-Liveverifikation bleibt offen. Regressionstests: `test/roadmap-n12-cave-emergency-direct.test.mjs`.

## W12/N12 – Cave-Direktbewegung mit einem atomaren Monster-Beobachtungssnapshot (22.10.2026)

Die bereits streng begrenzte direkte Ranger-Kohäsionsbewegung zum sichtbar bestätigten Priest liest pro Planung bzw. Dispatchfreigabe jetzt **genau einmal** die beobachtete Monsterliste. Ein gegenläufiger zweiter Frame darf zuvor sichtbare Angriffe nicht „wegprüfen“. Fehlende, fehlerwerfende, nicht-arrayförmige oder übergroße (>128) Listen sperren den Schritt. Für beobachtete Einträge ohne eindeutig belegte Map-/Instanzzuordnung gilt die Position als unklar und damit nicht als sichere Gegnerabwesenheit; explizit anderswo lokalisierte Gegner bleiben unberücksichtigt, aktuelle Cave-Gegner und Team-Aggro sperren wie bisher. Die native `can_move_to`-Abfrage, die zweite **eigenständige** Dispatchfreigabe, aktive Gefahrenerkennung und bisherige Spielaktions-/Journalsperren bleiben erhalten. Regressionen in `test/roadmap-n12-cave-direct-cohesion.test.mjs`. Dies ist keine vollständige automatische Cave-Retreat-Ausführung und keine W14-Liveabnahme.

## W05/W08 – eindeutige benannte Rollenvergleichsprofile (22.10.2026)

Der Gearplaner sammelt pro Rankingpass nur einen aktuellen Snapshot je konfiguriertem Charakter. Bei rollenübergreifenden Prioritätszuschlägen ist ein einzigartiger gleichlautender Eigentümer-Eintrag mit genau dieser Snapshot-Instanz und bestätigter Rolle notwendig; gleichnamige Peers werden nicht mehrfach gezählt, ungültige Rollen nicht zu DPS umgedeutet, andere Realms bleiben ausgeschlossen. Frische, bereits vorhandene Offlineprofile und bisherige begrenzte Wartealterboni bleiben nutzbar. Dies betrifft nur die Ordnung automatisch zugelassener Ziele; Gear-Freigabe, Nutzerlocks, Budgets, Gear-Werte und W14-Livebeweis bleiben unverändert beziehungsweise offen.

## W03/W04 – kompatible kompakte Bankquittungen und Validierung beobachteter Stapel (22.10.2026)

Die Adventure-Land-Bank liefert native **kompakte Arrays**: selbst `[]` stellt ein komplett leeres Pack mit 42 möglichen Slots dar. Die nach PR #415 eingeführte starre Arraylängenpflicht wird aufgrund eines nachvollziehbaren Gegenbelegs aus der vollständigen Linux-CI korrigiert. Alle fünf Recovery-Pfade (Reclaim, Einzelentnahme, Store, Swap, Teilentnahme) akzeptieren die kompakten Bankpacks, verwerfen Packs mit mehr als 42 Slots und stufen jeden **beobachteten** ungültigen Gegenstand bzw. Mengenstapel als `ambiguous` ein. Bei W04-Reclaim werden bekannte tatsächlich beobachtete Bankzeilen zusätzlich auf aktuelle `G.items`-Stapelgrenzen geprüft. Ein im aktuell verfügbaren Metadatenkatalog unbekannter Gegenstand darf nur als echter Einzelgegenstand (nicht als Phantom-Mehrfachstapel) auftreten. Es werden keine Verkaufs-, Dispatch- oder Replay-Rechte erweitert. Der signierte Bootstrap, ALBotConfig und Journalformen bleiben erhalten. Vollständige W03/W04-Autonomie und W14-Livetest offen.

## W03/W07/N01/G12 – vollständiger physischer Inventarbeleg vor Stat-Mutationen (22.10.2026)

Die bestehenden Stat-Tailoring- und expliziten De-Statting-Pfade nutzen jetzt `capacityAfterConsumption` mit `G.items`-Stapelgrenzen für den **gesamten** aktuellen Inventarzustand, nicht nur das umzuwandelnde Gear beziehungsweise den zugehörigen Scroll. Physisch unmögliche andere Inventarzeilen (beispielsweise zwei nicht stapelbare Ringe in einem Slot oder ein überfüllter Heiltrankstapel) dürfen weder einen Upgrade-Preview noch ein De-Statting-Journal autorisieren. Legitime einzelne Items und echte Stapel bis zur Servergrenze bleiben nutzbar. Das ändert **nicht** die bestätigten Scrollmengen, erlaubte Stat-Typen, explizite Opt-ins, Verlust-/Goldbudgets, Wert-Executor-Recovery oder den signierten Bootstrap. Regressionen in `test/roadmap-n01-stat-tailoring.test.mjs` und `test/roadmap-g12-destat.test.mjs`. Volle W03-/W07-/G12- und W14-Liveabnahme bleibt offen.

## W06/G09 – Marktvarianten und Standabgleich fail-closed (22.10.2026)

Der vorhandene Merchant-Marktpfad validiert `G.items` jetzt ausschließlich über echte Katalogeigenschaften. Physisch plausible, aber zyklische oder unlesbare Varianten dürfen weder bestätigte Sales, autonome Listvorschläge noch Stand-Fingerprints oder verzögerte `unequip`-Reclaimaktionen authorisieren. `proposal`, `posted` und `expire` verwenden identische ausfallsichere Varianten-/Fingerprintprüfungen; der Executor und seine physische Vor-/Nachherquittung bleiben erhalten. Regressionen in `test/roadmap-w06-g09-market-demand-evidence.test.mjs`. Vollständiger Account-Tauschmarkt, Markt-Liveabnahme und W14 bleiben offen.

## W10/W13 – nur katalogechte und physisch mögliche Chest-Ereignisse (22.10.2026)

Der vorhandene `createOwnLootReceipts`-Ablauf validiert jetzt auch die einzelnen offiziellen `chest_opened`-Einträge gegen die physischen `G.items[name].s`-Grenzen und eigene Katalogeinträge. Vererbte JS-Objektfelder sind keine Spielitems, übergroße/unmögliche Mengen (auch von fremden Lootempfängern) sind keine vollständige Zuordnung. Die bisherige Pre-Loot-Baseline, Deltaquittung, Eigentümerzuweisung und konservative Session-/Realm-Sperre bleiben unverändert. Regressionen in `test/roadmap-w10-w13-own-loot-receipts.test.mjs`. **Dies ist keine vollständige rollenverteilte Lootmission, keine live bestätigte Eigentumsquittung und kein signierter Release.**

## W03 – bekannte Quellstapelgrenzen im Produktions-Kapazitätsbeleg (22.10.2026)

Der bestehende gemeinsame `capacityAfterConsumption`-Prüfer erhält optional das aktuelle `G.items`-Metadatenwörterbuch und verweigert bei bekannten Gegenständen physisch übergroße Quellenbestände, auch wenn sie nur indirekt einen freien Ausgabeslot finanzieren. `actionCapacity` übergibt diese Metadaten jetzt in den bestehenden Produktionspfad. Fehlende Metadaten werden nicht erfunden und lösen keine zusätzlichen Wertaktionen aus. Regressionen in `test/shared-physical-capacity.test.mjs`; Build- und CI-Nachweise getrennt prüfen. **Keine vollständige W02/W03/W04-Transaktions-Recovery oder W14-Liveabnahme.**

## N05 – dynamische Scout-Wegfreiheit (22.10.2026)

Der vorhandene begrenzte lokale Scout überprüft die native `can_move_to`-Wegfreiheit jetzt mit demselben ausfallsicheren Adapter vor Planung, unmittelbar beim Dispatch und während der aktiven Bewegung. Verlorene Wegfreiheit, fehlende/werfende API oder aktivierter Stand brechen den Scout kontrolliert ab; das einmalige Kill-Ticket wird nicht erneut verwendet. Tests in `test/roadmap-n05-approved-local-scout-hop.test.mjs`. **Teilabsicherung, keine N05/N10-Vollabnahme, kein Live- oder Respawn-Zeitbeleg.** Linux-/Windows-CI und Artefakt-Synchronisierung gesondert prüfen.

## 21.10.2026 — W03/W04 physische Stackgrenzen bei Bank-Reclaim und Rollback

Die bestehende persistente Bank-Reclaim-/NPC-Verkaufs-/Rücklagerungskette überprüft jetzt jeden passenden Bank- und Inventarstapel zusätzlich gegen `G.items[name].s`. Defekte oder übergroße Komponenten dürfen keine belegte Vorher-/Nachher-Summe, Offsite-Verkaufsfreigabe oder Rücklagerung bestätigen. Auch eine ausdrücklich gesetzte `q:null`-Quellmenge ist keine einzelne physische Einheit. Bisheriger V2-Journaltyp, Originalslots, geschützter Executor und unterbrochene Transaktionen bleiben unverändert; unklare Zustände werden nicht automatisch erneut ausgeführt. Regressionen in `test/roadmap-w04-reclaim-recovery.test.mjs` und `test/roadmap-w03-w04-bank-recovery-quantity-proof.test.mjs` sowie Rollback-Integrationstest. Vollständige Bankfolgen-/W14-Liveabnahme bleibt offen.

## 21.10.2026 — W06/G09 echte Handelsmengen für automatische Marktnachfrage

`createMarketDemand` akzeptiert bestätigte Handelsereignisse und zuvor gespeicherte Siebentages-Absatzeinträge nur noch bei einem nach `G.items[name].s` physisch möglichen einzelnen Handelsstapel. Ausdrückliches `q:null`, übergroße Stapel, unbekannte Items und beschädigte alte Varianten dürfen keine zusätzliche Verkaufsrate und dadurch automatische Listings finanzieren. Auch das bestehende kontrollierte `market.expire` entnimmt keine offensichtlich unmöglichen Standstapel; Menge, Slotidentität und Inventaränderung werden erneut geprüft. Keine neue Spiel-API und keine Änderung an Value-Executor, Nutzerregeln oder signiertem Bootstrap. Neue Regressionen in `test/roadmap-w06-g09-market-demand-evidence.test.mjs`. Allgemeiner accountweiter Tauschmarkt und Live-Abnahme bleiben offen.

## 21.10.2026 — G09: striktes Angebotsjournal und einmaliges Tausch-Receipt

Der vorhandene einseitige `trade_offer`-Pfad nutzt nun denselben strikt lesenden `cstore_`-Mechanismus wie Cave-/Crypt-Wertjournale: Ein fehlender, unlesbarer oder beschädigter Journaldatensatz darf nie als frei für erneutes Posting gewertet werden. Jeder Ausgangs- und Abschlusscheckpoint wird vor/nach Schreibvorgängen mit dem tatsächlich gespeicherten Wert abgeglichen. Konkurrierend veränderte Journale bleiben gesperrt; `trade_offer` wird in diesem Fall nicht aufgerufen. Explizites manuelles Löschen eines vollständig belegten erfolgreichen Swaps bleibt auf den pausierten Bot beschränkt. Tests: `test/roadmap-g09-own-offer.test.mjs`. Vollständige autonome Tauschmarkt-Liquidität und W14-Liveabnahme weiterhin offen.

## 21.10.2026 — W12/N12 Cave-Recovery vor dem tatsächlichen Dispatch

Der bestehende Cave-Lifecycle räumt nach Sitzungswechsel einen dauerhaft `prepared`-Checkpoint jetzt ausschließlich dann automatisch weg, wenn **noch kein** `cave_enter` dispatch-unknown erreicht wurde und eine frische, nach dem alten Checkpoint gelesene `cave_info`-Antwort genau die aktuelle neue Eintrittserlaubnis oder denselben serverseitig resumierbaren Run bestätigt. Realm, ursprüngliche bis zu drei Teilnehmer, lokal geprüfter Eintrittskontext und konfliktfreie Journale/Executor müssen identisch bleiben. Unsichere oder bereits versendete Eintritte werden nicht neu gestartet. Tests in `test/roadmap-n12-cave-durable-lifecycle.test.mjs`. Crypt-/Cave-Live-End-to-End einschließlich Loot, Vote und Exit weiterhin offen.

## 21.10.2026 — W10/W13 physisch gültige Lootquittungen und Hinweise

Der vorhandene `createOwnLootReceipts`-Pfad beweist einen Loot-Erhalt nur aus Inventarständen, deren jede belegte Position das echte `G.items[name].s`-Limit einhält. `q:null`, nicht stapelbare Mehrfacheinträge, unbekannte Itemdefinitionen und übergroße Potionstapel können keine physische Lootquittung oder nachgelagerte readonly-Gear-/Produktionshinweise mehr begründen. Ein Versionswechsel der G-Itemdefinitionen zwischen Vorher-/Nachher-Snapshot widerruft die physische Bestätigung. Gültige Einzelitems und tatsächlich passende Potion-Merges werden weiterhin bestätigt. Regressionen in `test/roadmap-w10-w13-own-loot-receipts.test.mjs`. Mehrspieler-Lootmission, serverseitiger Eigentumsnachweis und W14-Live-Abnahme bleiben offen.

## 21.10.2026 — W02: reale Stackgrenzen bei vorbeugendem Lagerverkauf

Die bestehende `createStoragePlanner`-Kapazitätsdisposition akzeptiert als physische Rezept-/Produktionsreserve nur noch einzelne Inventar- oder aktuell beobachtete Bankstapel mit den realen `G.items[name].s`-Grenzen. Für Gegenstände ohne gültiges Stackmerkmal gilt nur eine physische Einzelkopie pro Slot; übergroße Bank- oder Inventarstapel legitimieren keinen NPC-Verkauf. Vorhandene gebundene Bank-/Rezeptevidenz und Value-Executor bleiben unverändert. Tests in `test/preventive-storage.test.mjs`. Gesamtübergreifende Langzeit-W02-/W03- und Live-Abnahme offen.

## 21.10.2026 — W06/G09 sichere accountweite Materialquoten

Die bestehende 0.24-Materialarbeit bleibt aktiv. `planMaterialQuotas` verweigert allerdings jede neue Farmzuteilung, wenn die Addition gültiger, einzeln belegter Farmerbestände keinen sicheren Integer mehr ergibt, ein frischer Peerabruf fehlschlägt oder Peer-/Roster-/Reservegrenzen ungültig sind. Die ursprünglichen Quoten bei gültiger Online-Gruppe sind unverändert. Tests: `test/material-quotas-active-farmers.test.mjs` und `test/heartbeat-material-progress.test.mjs`. Dies ist keine vollständige Markt-/Tauschbeschaffung oder Account-Liveabnahme.

## 21.10.2026 — W12/N11 automatisierte Recovery sicherer Crypt-Vorbereitung

Die bestehende dauerhafte `createCryptLifecycle`-Eintrittskette erhält eine begrenzte automatische **Pre-Dispatch-Recovery**: Nach einem echten Sessionwechsel darf `sample()` einen alten `prepared`-Checkpoint ausschließlich dann dauerhaft verwerfen, wenn der Realm/Owner unverändert ist, keine Lifecycle-/Inventarkollision besteht und der identische physische Crypt-Schlüssel am selben Slot noch nachweisbar ist. Eine alte `join`-Vorbereitung ohne Schlüssel darf unter denselben belegten Umfeldbedingungen freigegeben werden. Für `dispatch-unknown`, `inside-observed`, Schlüssel-/Bankdrift oder fehlgeschlagene Journalzugriffe bleibt die Sperre erhalten – ohne automatisches `enter()`, API-Replay oder erfundene Exitbelege. Regressionen: `test/roadmap-w12-crypt-keyed-entry.test.mjs`. Vollständiger Crypt-Run und W14-Liveabnahme bleiben offen.

## 21.10.2026 — W03/G01 physische Quell- und Empfangsbelege

Der gemeinsame `capacityAfterConsumption`-Vorprüfer verwirft ungültige vorhandene Inventarpositionen (einschließlich explizit `q:null`), ungültige oder übergroße Ausgabestapel und übergroße passende Merge-Quellen vor Kauf, Produktion, Team-Transfer und Reward-Mail. Die W03-Slotfolgensuche behandelt leere Slots nicht als entfernbare Ware oder mergefähige Quelle. Tests: `test/shared-physical-capacity.test.mjs`, `test/logistics-inbound-capacity.test.mjs`, `test/roadmap-w03-slot-sequence.test.mjs`. Vollständige serverquittierte W03-Kette und W14-Liveabnahme bleiben ausdrücklich offen. Der parallel gemergte 0.24.0-Material-/Rotationsstand bleibt erhalten.

**0.24.0-candidate: dauerhafte Rotation und Material-/Craftingaufträge.** [Implementierung und Tests](docs/CHANGELOG-0.24.0.md).

# W02/W04: Physisch gültige Betriebs- und Bankreservemengen (21.10.2026)

Der vorhandene, bereits persistente W04-Bank-Reserve-Staging-/Single-/Partial-Recovery-Pfad bleibt unverändert. Vor dem Einstieg in denselben Pfad gelten für den konkreten Bankquellstack und für alle passenden getragenen Vorratsvarianten nun die echten Mengenobergrenzen aus `G.items[name].s`; ungültige `q:null`, Bruchteile, Mehrfach-Phantomkopien und übergroße Stapel dürfen weder Vorrat verkaufen noch eine Zwischenentnahme legitimieren. Dieselbe reine physische Bestandsprüfung sperrt automatisch abgeleitete Betriebsvorratsverkäufe. Positiv-/Negativregressionen `test/operating-stock.test.mjs`. **Weiter offen:** vollständig accountweite endliche Bedarfs-/Slotfolgen, deren belastbare Langzeitrecovery und W14-Livebelege. Kein neuer Wertexecutor, Spielaufruf, signiertes Release oder persönliches Konfigupdate.

# W14: Sitzungsbindung innerhalb von JSONL-Liveberichten (21.10.2026)

Der vorhandene Offline-Parser verweigert jetzt zusammengesetzte Dateien mit widersprüchlichen `session`-Headern oder fortlaufenden Snapshots bei Start, Charakter, Runtime/Spielversion, Realm und Laufzeitumgebung. Gleichbleibende Zwischenstände bleiben erlaubt. Regressionen in `test/roadmap-w14-jsonl-session-consistency.test.mjs`, Live-Gate-Anleitung ergänzt. **Kein Live-/Restartbeweis; W14 insgesamt weiterhin offen.** CI-Ergebnis und PR nach Merge gesondert nachweisen.

# W14: Konfliktfreie JSONL-Ereignisübernahme (21.10.2026)

Der bereits vorhandene Offline-Liveprüfer lehnt widersprüchliche doppelte `seq`-Ereignisse beim einzelnen JSONL-Import **und** beim Zusammenfügen wiederholter Reports jetzt ab. Identische Mehrfachbeobachtungen werden weiter dedupliziert; Browser-/Headless- und Spielversionswechsel bleiben getrennte Läufe. Ergänzt: negative und positive Regressionen `test/roadmap-w14-log-part-integrity.test.mjs`; dokumentiert in `docs/ROADMAP-LIVE-TEST-GATES-2026-10-16.md`. **W14 bleibt ohne getrennte tatsächlich beobachtete Live-/Restart-/Disconnect-Abnahmen unvollständig.**

# W14: Beobachtete gleichzeitige Laufzeitaktivität (21.10.2026, PR #346)

Der vorhandene read-only Live-Team-Prüfer kann optional mit `--require-observed-overlap` zwei echte, zeitlich getrennte und sequenzierte Running-Samples **pro Charakter innerhalb der gemeinsamen Beobachtungsintersektion** verlangen. Fehlende, abgeschnittene und gedroppte Ereignisfolgen sowie gemischte Browser-/Headless-Berichte sperren diese strengere Prüferakzeptanz. Der bisherige Diagnosemodus bleibt unverändert. Positiv-/Negativtests und CLI-Prüfung: `test/roadmap-w14-running-overlap.test.mjs`. Dokumentierter Aufruf: `docs/ROADMAP-LIVE-TEST-GATES-2026-10-16.md`.

**Nicht erledigt:** Das ist eine Offline-Evidenzprüfung, kein tatsächlich ausgeführter W14-Live-/Dauertest, keine serverseitige Bestätigung und kein Nachweis von Disconnect-/Tod-/Revive-/Bank-Recovery. Linux-/Windows-CI und Merge nur nach unabhängiger Bestätigung im verlinkten PR. Alle übrigen offenen Roadmap-Pakete bleiben offen.

# Umsetzung 0.10.11-candidate: Autonomie-Abgleich (18.10.2026)

[Konkrete Implementierung und Restliste](docs/AUTONOMIE-ABGLEICH-2026-10-18.md), [PR #167](https://github.com/Riflex91/ALBot/pull/167). Aktuellen Main geprüft; vorhandene Overflow-, Bank-, Crafting-, Liefer- und Browserrotation nicht doppelt implementiert. Dauerbetriebs-Lücken in Vorrat/Bank, Aktionskosten, Conditions, Eventbeobachtung, Abreiseloot, Revival, Gearpriorität und Systembelohnungen ergänzt. Die komplette Forschungsroadmap bleibt teilweise offen; Crypt/Cave, Tailoring/De-Statting, Temporal-Loadouts und Tauschmarkt nicht als fertig markieren. Finale GitHub-CI und tatsächlicher Spiel-Livetest sind getrennte Nachweise. Der signierte V2-Kanal bleibt separat.

# Browser-Rotation: laufenden CODE-Slot erhalten (16.10.2026)

Der zuvor nur lokale Fix `1f06f0b` wurde auf Mainbasis `47095a9` (PR #110) integriert. Browserwechsel bindet den aktiven Runner-Slot und speichert den laufenden Code über `upload_code`; veränderter Editor-Slot und unbestätigte Speicherung führen nicht zum falschen Neustart. 904/904 lokale Offlinetests bestanden, Runtime/Werkstatt und persönliche bot.js neu gebaut. Echte Browserrotation noch nicht live bestätigt. [Implementierung, Herkunft und Testablauf](docs/BROWSER-ROTATION-2026-10-15.md).

# Upgrade-Scrollwahl 0.10.8-candidate (15.10.2026)

Benutzerauftrag umgesetzt: 65 % globale Mindestchance im persönlichen Bot und in neuen Full-Profilen; nach unzureichender scroll0-Vorschau passende scroll1 prüfen, vorhandene verwenden oder genau eine kaufen, echte Servervorschau vor Upgrade. Kaufanforderung für tatsächliche Scroll-IDs korrigiert. 806/806 Offlinetests; Runtime/Werkstatt und persönliche Bundleparität geprüft. Neue Spiel-Liveabnahme offen. [Details](docs/CHANGELOG-0.10.8.md).

# Vorbeugende Lagerplanung und Ranger-Ziele 0.10.7-candidate (14.10.2026)

Auf aktuellem Mainstand umgesetzt: 8-Slot-Vorwarnung / 12-Slot-Arbeitsziel, geschützte lokale und bankgestützte Compounds, nachgewiesene Ersetzbarkeit und Gegenwartsnutzen vor Freiverkäufen, vorbeugende Bankfreigabe, Worst-Case-Exchange-Outputprüfung, Annahmereserve und getrennte Ranger-Ziel-/Pullgrenzen. Persönlicher Auftrag maxAggro=12 und Accountgold-Verluststeuerung berücksichtigt. 801/801 Offlinetests; Runtime/Werkstatt gemeinsam gebaut. Liveabnahme und Langzeitverhalten offen. [Details](docs/CHANGELOG-0.10.7.md).

# Produktions- und Dispositionskorrektur 0.10.3-candidate (13.10.2026)

Aus der externen ALFinal-Analyse werden die Ursachen Reservierungsüberdeckung, Inventardruck und fehlende Mutation-Helper übernommen. Der vorgeschlagene rechnerische Schritt `reservation - localStock` wäre für eine bereits erfüllte Zielmenge gefährlich und wurde **nicht** übernommen: `reservedQuantity()` bleibt der konservative Bruttobedarf; `surplusQuantity(held,reserved,keep,teamReserve)` lässt nur physisch überschüssige identische Varianten frei. Alte persönliche Einstellungen einschließlich `maxSpendPerHour=5000000` und die öffentliche API bleiben unverändert. Ein Merchant mit zu wenig Arbeitsplätzen versucht zuerst sichere Stapelkonsolidierung, danach freigegebene Bankablage und zuletzt unreservierte NPC-Verkäufe. Wirtschaftlich sinnvolle Upgrades ohne Scroll werden als `no-helper-available` erfasst; mögliche Standard-Helper-Käufe bleiben begrenzt und sämtlichen bestehenden Kosten-/Inventar-Guards unterworfen. Bank-Reclaim und alle vorhandenen Wertjournale bleiben unangetastet.

Vollständige Offline-CI und tatsächlicher 10-Minuten-Team-Livetest müssen getrennt bewertet werden. Im Spiel sind keine echten Gold-/Bank-/Mutationsaktionen bestätigt; ein erfolgreicher Node-Test ist hierfür kein Beweis. [PR #35](https://github.com/Riflex91/ALBot/pull/35).

---

# ALBot 0.10.2-candidate – Livetest-Reparaturen (13.10.2026)

Auf Basis der Farmer-/Merchant-Logs vom 13.10.2026: alter Farmregel-Konflikt, zu großer Spawn-Ankunftsradius und waffenloser Mage korrigiert; sequenzielle Merchant-Depotpflege mit persistierten Phasen ergänzt. Produktionsziel-Haltezeit verlängert und Diagnostik erweitert. Standard für Merchant maxSpendPerHour: **5.000.000 Gold/Stunde**. Für bereits exportierte persönliche Profile wird der Wert ausdrücklich nicht ohne einen neuen Export überschrieben. **Offline-CI erfolgreich; Spiel-Liveabnahme noch offen.** Geschützte Items, Transaktionsjournale, Account-Budget- und Erfolgschancenprüfungen bleiben gültig. Siehe [PR #34](https://github.com/Riflex91/ALBot/pull/34).

---

# Automatischer Betrieb und Gruppenwahl 0.10.1 – 13.10.2026

Lokale Automatik aktiviert Produktions-/Merchant-/Lernfunktionen und unterstützte Bossprofile innerhalb bestehender Budgets und Schutzregeln. Eigene Online-Farmer werden automatisch erkannt und auf 3.000 HP-/300 MP-Tränke aufgefüllt. Die Farmwahl berücksichtigt individuellen AoE-Beitrag, Priest-Heilung, Tankkontrolle, Rüstung/Resistenz, aktive Paladin-Auren und begrenzte Schutzressourcen.

[Einrichtung, Codezuordnung, Grenzen und Liveabnahme](docs/EINRICHTUNG-0.10.1.md). **503/503 Offline-Tests bestanden**, Runtime/Werkstatt gebaut; neue Spiel-Liveabnahme steht aus. Cloud/KI bleiben aus, keine Anbieteränderungen. Die folgenden älteren Statusblöcke sind historisch.

---

# Aktueller Kandidat 0.10.0 – 12.10.2026

Restmodule für gemeinsame Itemreservierung, endliche Upgrade-/Compound-Planung, belegte Marktverkäufe, Bossbereitschaft, adaptives Lernen, optionale KI sowie begrenzte Cloud-Rotation und Restore sind eingebunden. **Die neue Liveabnahme steht noch aus.**

- [Einrichtung und Live-Testmatrix](docs/EINRICHTUNG-0.10.0.md)
- [Implementierung, Codezuordnung und tatsächliche Grenzen](docs/IMPLEMENTIERUNGSSTAND-0.10.0.md)
- [Quellbelegter Bosskatalog](docs/BOSS-KATALOG.md)
- [Draft PR #32](https://github.com/Riflex91/ALBot/pull/32), Branch `codex/autonomous-merchant-20261012`

Cloud und KI bleiben standardmäßig aus. Neue Projekte in bestehenden Konten, neue Secrets, kein Altimport. Eine automatische kontoweite Abrechnungsprüfung ist nicht implementiert; Free-Tarife, Anbieter-Caps und alle sieben Tage manuell bestätigte Kontingente sind Voraussetzung. Funktionen können lokal ohne Cloud laufen.

Offline-Abnahme: **481/481 Tests** auf Windows/Node 24, Runtime und Werkstatt gebaut, gemeinsames Bundle **410.613 Bytes**. Worker mit Wrangler 4.149.0 als Dry-run gebaut; kein Deployment, keine neue Spiel-/Provider-Liveabnahme.

Die folgenden Einträge sind historisch und gelten nicht als aktuelle Liste offener Implementierungsarbeiten.

---

# Aktueller Kandidat 0.9.0 – 12.10.2026

Offline-Abnahme auf Windows/Node 24: **465/465 Tests**, Runtime und Werkstatt gebaut, Bundle **387.037 Bytes**. Keine neue Linux-, Spielserver- oder Provider-Liveabnahme. Ein Regressionstest hat eine zu lange Trank-Abkühlung durch Fehlerlernen aufgedeckt; Überlebensaktionen behalten ihren bisherigen Wiederholungsabstand.

Merchant-/Item-Ergänzungen, lokale Fehlerabkühlung und optionale neue Cloud-Backups sind implementiert. **Der vollständige Autonomieauftrag ist noch nicht abgeschlossen.** Einrichtung: [EINRICHTUNG-0.9.0](docs/EINRICHTUNG-0.9.0.md). Funktionen, Grenzen und konkrete Restarbeit: [IMPLEMENTIERUNGSSTAND-0.9.0](docs/IMPLEMENTIERUNGSSTAND-0.9.0.md). Cloud standardmäßig aus; neue Projekte in bestehenden Konten, keine alten Daten oder Schlüssel. Keine neuen Live-Nachweise. Die folgenden älteren Einträge beschreiben ihren jeweiligen historischen Stand.

---
## Browser-Livetest-Vorbereitung: Smart-Move-Fix (11.10.2026)

- **Auf PR #9 umgesetzt (nicht `main`):** Ein ausstehendes `smart_move` wird nicht mehr nach 12 s Positionsstillstand fälschlich beendet; maximale 120 s Wegzeit bleibt bestehen. Parent-geführte `smart.moving/searching`-Pfade werden bei STOP sowie vor `town` berücksichtigt. Bewahrte Merchant-Town-Strategie, Sicherheitsgrenzen und Executor-Ressourcen. Diagnosen nennen `movement.failed` mit `no_progress` oder `timeout`.
- **Gezielte Tests:** 5 neue Szenarien (Pfadsuche über 12/59 s, normaler Stall, Town-Parent-Suche, smart-Timeout, Parent-Cleanup). Vorher zwei rot auf [38129268253](https://github.com/Riflex91/ALBot/actions/runs/38129268253), danach [38129349846](https://github.com/Riflex91/ALBot/actions/runs/38129349846) Linux und Windows jeweils **261/261**, Bytegleichheit, Bundle **291.766 Bytes**, SHA256 `7875e1f825189c50421e3bcbad7e6673c13748a23450f895357c398b24e83408`.
- **Nächstes Gate:** Manueller **Browser-Phase-1-Livetest** des exakt CI-geprüften Bundles aus PR #9; Autostart aus, getrennte sichere Testkonfiguration, Logs pro Charakter. Zunächst Start, Stop, Status, Session, Heartbeats und Scheduler ohne Freigabe von Kampf-, Wirtschafts- oder Transferaktionen; erst nach Befund Phase 2 (Farm/Bee) bewusst freigeben. PR #8 bleibt offen und wird nicht automatisch übernommen. Browser/Headless-Live-Parität, Long-Path-Smart-Move und tatsächliche Spielserver-Ergebnisse noch **nicht bestätigt**.

## Integration: kontrollierte Stornierung nicht versandter Itemübergaben (11.10.2026)

- **Fehler bestätigt und auf Draft-PR #9 behoben:** Ein empfangsseitig persistiertes `receive`-Journal blieb nach STOP/Pause des Senders oder Abbruch eines noch nicht gesendeten Angebots wegen Bestandsänderung offen. Das blockierte wirtschaftliche Folgeaktionen, obwohl keine Itemübertragung stattgefunden hatte. Beleg: `b8e64a9`, reproduzierend [GitHub Actions 38128428331](https://github.com/Riflex91/ALBot/actions/runs/38128428331), zwei gezielt rote Tests unter Linux/Windows.
- **Lösung:** `itemCancel/notDispatched` nur vor dem tatsächlichen `send_item`. Empfänger prüft Nachrichten-ID, Session, Journalbesitz, Bestand, fehlendes `sent` und fehlende Beobachtung. Ein nach Ausführung/Unklarheit ankommendes Cancel entsperrt **nichts**. Zwei-Charakter-, Race-, falsche ID/Session-, unbekannte Serverwirkung-, IPC-Duplikat- und Cleanup-Regressionen ergänzt.
- **Offline-Abnahme:** [CI 38128697671](https://github.com/Riflex91/ALBot/actions/runs/38128697671) je **256/256** Tests, Linux und Windows, identische **291.496 Bytes** sowie SHA256 `1a9f70591d8281c0e126d80a64add40c401ece01e0ee49081420a500fa71f5bb`. Keine Live-Spielaktion oder reale Serverquittung.
- **Offen:** Empfänger-Reload **nach** begonnenem Versand, verlorene `done`-/`receipt`-Nachrichten, Storage-Ausfälle beim abschließenden Checkpoint-Clear, Produktions-/Gear-Zusagen bei Storno, kontrollierte Livephasen. PR #8 nicht blind übernehmen. Kein Merge/Deployment.

## Integrationsaudit – Sessionwechsel beim Item-Handoff (11.10.2026)

- **Behoben auf PR-#9-Arbeitsbranch, noch nicht in `main`:** Ein vor Empfänger-Restart bestätigtes Itemangebot konnte bei weiterhin gültiger Entfernung und neuem Heartbeat mit einer **alten Empfangszusage** ausgeführt werden. Der Item-Executor verlangt jetzt am Dispatch dieselbe Peer-Session wie beim `accept` und verwirft nachweislich veraltete, noch nicht ausgeführte Aufträge. Eigenes Diagnoseevent `logistics.session-changed`.
- **Reproduktion/Abnahme:** Zwei simulierte Charaktere, echtes `offer/accept`, Empfänger-Neustart und zusätzlich Sessionwechsel nach Scheduler-Einplanung vor `Executor.flush()`; **250/250 Offline-Tests je Linux/Windows**, Build, Editor, Manifest und Byteidentität bestanden. [GitHub Actions 38128018952](https://github.com/Riflex91/ALBot/actions/runs/38128018952); 290.676 Bytes, SHA256 `6fddfb3360b7b9fb659bddcb1c3d318bef381be118b70b83f82d7af290500ac7`.
- **Offene Integrationsgates:** Gold-/Item-Quittungen bei Empfänger-Neustart **nach** unbekannter Serverwirkung, Speicherfehler, Doppel-/Verspätungsnachrichten, Journale nach STOP/Reload, bank-/produktionsübergreifende Ressourcenlocks, kontrollierte Livephasen 1–6 nach Integrationsplan. Keine automatischen Wertaktionen im Test, kein Live-Nachweis, kein Merge/Deployment. PR #8 separat bewerten.

# Arbeitsübergabe vom 10. Oktober 2026: v3-/ALFinal-Übernahmen

[Konkreter Arbeitsplan mit Quellbelegen und Abnahmekriterien](docs/UEBERNAHME-V3-ALFINAL-2026-10-10.md). U01–U06 sind auf dem nicht gemergten Arbeitsbranch `work/u01-u02-source-verification-20261010` implementiert und gezielt offline geprüft; U07 hat eine begrenzte offizielle `get_progression()`-Beratungsanbindung mit kontrolliertem Fallback. **Vollständige Node-Tests und Build/Werkstattpaket sind jetzt auf GitHub Actions unter Linux und Windows bestanden (je 249/249 Tests, 290.358-Byte-Bundle, gleicher SHA-256).** U07 verwirft veraltete, undatierte oder realm-fremde Guide-Antworten; U05 verhindert doppelte Goldzählung durch zeitversetzte Transfer-Heartbeats. Browser-/eigene Headless-API-Verfügbarkeit im echten Spiel und Livebestätigung bleiben offen. Account-Risiko begrenzt zusätzlich automatische kumulative Exposition, Paladin-Auren antizipieren Eingangsgefahr; Progression setzt keine fremden Aktionen um. Offline-Prüfskript: `scripts/VERIFY-U01-U07.ps1` (im Windows-Runner erfolgreich ausgeführt); [CI-Lauf inklusive prüfbarem Paket](https://github.com/Riflex91/ALBot/actions/runs/38126788338). U07 beschreibt ausdrücklich die Integration von get_progression() samt Browser-/Headless-Abnahme. ALBot 0.8.4 bleibt die gemeinsame Browser-/Headless-Basis. Diese Ergänzung ist nur Dokumentation; keine neue Runtime oder Livebestätigung. Vor Implementierung den Arbeitsplan lesen und inzwischen erfolgte Änderungen abgleichen.

**U04 Live-Bid-Schutz:** Da die offizielle `trade_sell`-API den verkauften Slot serverseitig auswählt, kontrolliert ALBot jetzt alle gleichnamigen/gleichleveligen Inventarstapel auf ausreichende Menge, Schutzregeln, Sperren und identische Varianten – vor und unmittelbar beim Dispatch. Ungültige Trade-Slots und unendliche Preise werden abgewiesen. Zwei zusätzliche Offline-Regressionstests bestanden, echter Handel nicht ausgeführt.

**U04 Marktkauf:** Händler und Käufer müssen im selben Map-/Instanzkontext sein; unmittelbare Dispatch-Guards bestätigen erneut aktiven Händlerstand, Angebotstyp, RID, Menge und Preisobergrenze. Zwei weitere Regressionstests (249/249 plattformübergreifend), keine reale Markttransaktion.

**U05 parallele automatische Ausgaben:** Die berechnete Account-Risikogrenze wird pro konfigurierter Gruppensitzung deterministisch aufgeteilt; es gibt keinen nichtatomaren `get/set`-Lock zwischen Clients. Unbekannte Peers bleiben im Teiler enthalten. Summe unsicherer Ganzzahlen verweigert die automatische Budgetfreigabe. Drei neue Regressionstests belegen Zwei-Sitzungs-Quoten, unvollständige Kontodaten und Overflow; echte parallele Livetransaktionen sind ungeprüft.

**U04 weitere Marktkauf-Guards:** Bei der Auswahl fremder Verkaufseinträge gelten ausschließlich `trade1` bis `trade16`; vor tatsächlichem `trade_buy` prüft der gemeinsame Executor erneut den eigenen Bestand, die Zielmengengrenze und freie Inventarplätze. Für `market.wishlist` werden Bedarf und aktuelle Preisobergrenze direkt vor Veröffentlichung erneut geprüft. Drei weitere Offline-Regressionstests bestanden, keine echten Trades.

**U05 Produktionsdispatch:** Crafting validiert vor dem Dispatch erneut Rezeptinhalt/-kosten, Zielmenge, Zutatsbedarf, `keep`-Regeln und Materialreserven. Upgrade-/Compound-Vorschauen sind zusätzlich an die aktuelle Definition, Erfolgschancengrenze und Scrollregel gebunden; direkt vor Dispatch werden Materialschutz, aktivierte Aktion und Ziellevel erneut geprüft. Vier neue Regressionstests, **249/249 auf Linux und Windows**. Keine echte Craft-/Upgrade-Aktion ausgelöst.

**U07 Progression-Lebenszyklus und Sicherheitsformat:** Beim ALBot-Stopp wird nur ein tatsächlich vom Port erzeugtes lokales `ProgressionRuntime` abgemeldet; die von Adventure Land geteilten `get_progression.runtime`- oder `parent.progression_read`-Objekte bleiben unangetastet. Offizielle Farm-Routen mit fehlenden oder anders formatierten `reasons` gelten ab sofort als nicht belegbar, auch wenn `safe:true` gesetzt ist. Vier neue Regressionstests, **249/249** plattformübergreifend. Keine Spielaktionen oder Livebestätigung.

**U05 Goldtransfer nach Neustart:** Gesendete/empfangene Goldübergaben hinterlegen einen lokalen, zeitbegrenzten und dauerhaft gespeicherten Übergabezeitpunkt (`albot:gold:<Charakter>:recent-transfer`). Nach Modulneustart wird eine frische Sperrfrist wiederhergestellt, sodass verschobene Sender-/Empfänger-Heartbeats nicht als doppelte Liquidität gelten. Empfänger bestätigt einen Transfer erst nach erfolgreicher Speicherung; Sender bricht eine nicht speicherbare Zusage **vor** dem Executor ab, ohne Wertjournal oder Inventarsperre. Drei neue Neustart-/Speichertests, ein zusätzlicher Sender-Abbruchtest und angepasste bestehende Gold-Fixtures. Offline-Abnahme **249/249 unter Linux und Windows**, keine echte Spiel-Goldübertragung.

**U04 späte Verkaufspreisänderungen:** `market.sell` friert den gebotenen Stückpreis und den zugesagten Gesamterlös vor Einplanung ein. Der Dispatch vergleicht den Live-Preis mit dieser unveränderlichen Zahl und prüft neu erhöhte Mindestpreise, Angebotsmenge und -typ. `market.list` validiert den neuen Preisboden und fixiert den Trade-Slot. Passive `market.wishlist` bindet den Slot ebenfalls und verlangt sichere, ganzzahlige Gesamtsummen. Vier zusätzliche gezielte Tests; **249/249 auf Linux und Windows**; keine echte Handelstransaktion.

**U05 Crafting-Rezeptpositionen (API-Abgleich):** Die offizielle `craft(i0,...,i8)`-API übergibt den Inventarslot je **Rezeptposition**. ALBot erhält deshalb originale Rezeptzeilen separat von für die Beschaffungsplanung aggregierten Materialmengen. Mehrfach vorkommende Zutaten belegen getrennte Positionen, respektieren ihre gemeinsame `keep`-/Teamreserve und werden erst nach nachgewiesenem Gesamtverbrauch als produziert verbucht. Live-Crafting auf neun Positionen beschränkt, die historische 256-Einträge-Prüfung des rein hypothetischen Planers bleibt bestehen. Drei neue Regressionen; **249/249 Tests je Linux und Windows**, kein echter Crafting-Auftrag.

**U05 Crafting mit gleichem Item auf verschiedenen Leveln:** Materialaggregation gruppiert jetzt nach **Item-ID und Level**, nicht nur nach Name; Rezepte mit mehreren Upgrade-Leveln derselben Itemart behalten getrennte Bedarfe/Reserven und positionale Craft-Slots. Malforme G.craft-Definitionen werden vor Ausführung kontrolliert und ohne Bot-Tick-Ausnahme verworfen, samt Event `production.craft-unavailable`. Drei zusätzliche Offline-Regressionen, **249/249 Linux+Windows**, keine echten Crafting-Aktionen.

**U05 vollständige Positionszuordnung:** Beim Crafting werden die bis zu neun Rezeptpositionen mittels eindeutiger Slot-Zuordnung (augmentierende Pfade, begrenzte Suche) mit Inventarstapeln belegt. Diese Zuordnung verhindert falsche Ablehnungen durch First-Fit bei unterschiedlich großen Stapeln desselben Materials; der Aufruf an die offizielle `craft`-API behält die ursprüngliche Rezeptreihenfolge. Keine doppelte Slot-Nutzung; Materialschutz, Rezeptprüfung und Dispatcher-Guards bleiben wirksam. Drei neue Regressionen; **249/249 Linux+Windows**, keine realen Crafting-Aktionen.

**U05 geschützte Stack-Merges im Crafting:** Vor vorbereitenden `inventory.merge`-Aufträgen berücksichtigt ALBot neben expliziten auch effektiv/abgeleitet wirksame `keep`-Regeln. Der verzögerte `swap`-Dispatch prüft Materialreserve, Produktionsfreigabe, maximale Stack-Größe, identische zulässige Varianten und sichere Ganzzahlsummen erneut. Ungültige oder nachträglich geschützte Stapel werden nicht zusammengeführt. Drei zusätzliche Regressionstests; **249/249 je Linux und Windows**, kein tatsächlicher Stack-Merge im Spiel.

**U05 vollständiger Craft-Merge-Pfad statt größtem Einzelpaar (11.10.2026):** Vor `inventory.merge` wird jetzt anhand der sicheren, nicht geschützten Stapel eine **vollständige erreichbare Zielsumme** innerhalb des Game-Stacklimits gesucht (höchstens 4096 Zustände). Damit darf eine lokale 4+3-Zusammenführung keine erreichbare 4+2+2-Lösung für ein 8er-Rezept blockieren. Die Auswahl bleibt deterministisch, überprüft bestehende Materialregeln und wird nach jedem Merge neu berechnet. Ohne vollständig erreichbare Kombination kein vorbereitender `swap`. Drei neue Regressionen, **249/249 Tests auf Linux und Windows**, keine Live-Transaktion.

**U05 Rezept-/Zieländerungen beim Craft-Merge (11.10.2026):** Ein für Crafting eingeplanter `inventory.merge`-Auftrag wird vor dem verzögerten `swap` nur ausgeführt, wenn der ursprüngliche Rezeptschlüssel und die vollständige Live-Rezeptdefinition unverändert sind, die Craft-Regel weiter `action:'craft'` enthält und das Output-Ziel noch Platz für das Rezeptergebnis hat. Auch direkte geplante `craft`-Aufträge lehnen den nachträglichen Wechsel der Regelaktion zu `keep` ab. Zwei zusätzliche Regressionstests und zwei erweiterte Guards, **249/249 Node-Tests auf Linux und Windows**, keinerlei Liveaktionen.

**Integrationsprüfung PR #9 (11.10.2026):** Ein vollständiger Teamheartbeat mit Gear-, Material-, Performance- und Account-Daten wird vor CM/IPC auf 4200 Zeichen JSON-Nutzdaten begrenzt (Nachrichtenhülle bleibt unter 5 KB). Zuerst entfallen optionale Telemetriefelder; Goldbestand, Transfersperren, offenes Journal, Sperrstatus, Standort/Realm und soweit möglich Item-Bedarf bleiben erhalten. Ein simuliertes Peer-System bestätigt den Nachrichtenempfang und die daran gekoppelte konservative Account-Risikoberechnung. Explizite `false`-/`success:false`-Rückgaben von IPC/CM melden künftig einen fehlgeschlagenen Versand. Drei neue Regressionen, **249/249 Tests auf Linux und Windows**. Die konkrete **noch nicht live ausgeführte** Prüf- und Logreihenfolge steht in [Integrationsabnahme PR #9](docs/INTEGRATIONSABNAHME-PR9-2026-10-11.md).

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

Goldversand trotz laufender Farmbeute repariert, Town bei laufender Bewegung und geringerem Zeitgewinn, getrennten 250-ms-Übergabetakt eingebunden und Pickup-Pendel während Besorgung begrenzt. [Befunde, Änderungen und Umgang mit alter Goldsperre](docs/CHANGELOG-0.8.1.md). 158 Prüfungen unter Windows bestanden; neue Livebestätigung steht aus. Vorhandene Wertjournale werden nicht automatisch gelöscht.

---

# Aktueller Umsetzungsstand · 0.8.0-full

F01/F02/F03 und die abgegrenzten Fachbereiche D01–D15 des v3/v4-Audits sind umgesetzt und in Kampf, Produktion, Gear und Logistik verbunden. Maßgeblich: [PARITAET-0.8.0](docs/PARITAET-0.8.0.md). 154 gezielte Prüfungen bestanden; Browser-/Headless-Vertrag, Syntax und Bytegrenze geprüft. Nächster Schritt: gemeinsamer Vollbetrieb mit allen aktivierten Funktionen, aktuellen Charakterlogs und einem Neustart. Neue Livebestätigung und Linux-Livebetrieb bleiben ausstehend. Kein Updater, Shadow-Verfahren oder automatischer Login. Historische offene Häkchen unten beschreiben den jeweiligen früheren Release; sie ersetzen nicht die aktuelle Umsetzungsmatrix.

---

# Aktueller Auditstand · v3/v4-Parität noch offen

Der erneute Vergleich von 0.7.0 bestätigt vorhandene Grundabläufe, aber keine vollständige Vereinigung. Maßgeblich: [V3-V4-PARITAET-0.7.0](docs/V3-V4-PARITAET-0.7.0.md). Offen sind F01/F02/F03 und D01–D15: Mengen-/Materialintegration und Gear-Equip-Zusage, Pull-/AoE und Bewegung, ökonomische Bestandsoptimierung sowie gemeinsame Aktions-/Service-/Fähigkeitsentscheidungen. Der aktuelle Auftrag ist eine Prüfung; keine Runtimeänderung und kein neuer Live-Nachweis. Vor einem als vollständig bezeichneten Gesamtvergleich sind diese Punkte abzuarbeiten. Updater und Shadow-Verfahren bleiben ausgeschlossen.

# Historischer Umsetzungsstand · 0.7.0-full

Die 20 fachlichen Auditpunkte und fünf zusätzlichen v5-Vertragsbereiche sind in die gemeinsame Runtime eingebunden. Maßgeblich ist die genaue Implementierungs-/Grenzenmatrix in [AUTONOMIE-0.7.0](docs/AUTONOMIE-0.7.0.md); historische Häkchen sind keine neuen Live-Nachweise. P3/P4-Werkstatt, gemeinsame Regeln/Logistik, Produktion und Autonomie werden gemeinsam getestet. Nächster Schritt: integrierter Livetest mit allen Charakteren, aktuellen Logs und einem Neustart; neue gemeinsame Bestätigung und Linux stehen aus. Keine neuen Shadow- oder Zwischenfreigaben. Updater bleibt ausgeschlossen.

# ALBot: Roadmap zum gemeinsamen Super-Bot
Stand: 8. Oktober 2026. **Live A grundlegend bestanden. Live B ist mit 0.2.2-live-b in Browser und Windows-Headless vollständig bestanden: 01 Abholung, 02 Bank, 03 Bank→NPC sowie 04 Upgrade und bestätigte Lieferung. Die 0.2.2-Korrekturen für Offer-Retry und Basis-Nachkauf sind live bestätigt. 0.6.0-full ergänzt die verbleibende Integration und bereitet einen gemeinsamen Vollbetriebs-Livetest vor. Linux-Live-Nachweis und gemeinsame Vollbetriebsbestätigung stehen aus.**

**Live C mit `0.3.1-live-c` ist laut Nutzerbestätigung vom 7. Oktober 2026 bestanden.** Der vereinbarte Testpunkt und der Entwicklungsauftrag bis zu diesem Termin sind abgeschlossen. Dies bestätigt den Testablauf, nicht alle ausgeschalteten Welt-/Account-/Teamreiseoptionen oder noch offene Funktionen. Genaue Implementierungszuordnung und verbleibende Lücken: [INTEGRATIONSSTAND.md](docs/INTEGRATIONSSTAND.md). Nachweis und Grenzen: [LIVE-C-ERGEBNIS.md](docs/LIVE-C-ERGEBNIS.md).

Vorab aus P1/P3 umgesetzt: vollständiges schemaorientiertes Einstellungsmodell, lokale Oberfläche, Item-Katalog/Mehrfachbearbeitung, Regelvorschau, Konfliktprüfung, Profilimport/-export und fertiger Bot-Paket-Exportweg. Das aktuelle Vollbetriebsrelease verwendet albot.full/v1; A/B-Artefakte bleiben verfügbar. Verbindlich: [Werkstatt-Vertrag](docs/WORKSHOP-CONTRACT.md). Das Schema kann neue Einstellungen liefern, ohne den Formulargenerator pro Botversion neu zu programmieren.

## 1. Ziel und feste Entscheidungen

Alle fachlichen Bot-Funktionen aus ALFinal, v3, v4 und v5 werden in einem gemeinsamen Bot zusammengeführt. Er läuft als identische JavaScript-Datei im Adventure-Land-Browser-CODE und im bestehenden Windows-/Linux-Headless-Client. Er erkennt die Umgebung selbst. Farmer und Merchant verwenden gemeinsame Regeln, Aufträge und Item-Identitäten.

Nicht enthalten: eigene Headless-Laufzeit, Login-/Socket-/Reconnect-Infrastruktur, Telemetrieplattform, vollständiges Log-/Archivsystem, Windows-/Linux-Bridge, Host-Watchdog, FTPS oder ein zweites Monitoring-Dashboard. Kompakte Fehlermeldungen, aktueller Botstatus und begrenzter fachlicher Zustand bleiben erforderlich. Interne Lernwerte für Farm-/Marktentscheidungen sind keine Telemetrieexporte.

**Keine Shadow-Tests, keine Shadow-Betriebsart und keine neue Forschungsphase für die gesamte Adventure-Land-API.** Vorhandene Aufrufe werden übernommen und an den wenigen geänderten Grenzen geprüft. Es gibt drei gebündelte Live-Testpunkte. Ein fehlender Nachweis für den neuen Bot wird nicht durch alte Testberichte ersetzt.

Die Regeln aus alten Repositories, die jede einzelne Mutation durch viele Freigabestufen schicken, sind kein Entwicklungsprozess für ALBot. Technische Schutzmaßnahmen gegen falsche Items, Doppelaktionen und widersprüchliche Bewegung bleiben erhalten.

## 2. Übernahmestrategie

| Quelle | Übernehmen | Umbauen/ersetzen |
|---|---|---|
| ALFinal | Controller für Kampf, Klassen, Ressourcen, Gruppe, Farming, Merchant, Bank, Trade, Gear, Upgrade/Compound, Exchange/Craft, Events, Accountstrategie | Controller-Abhängigkeiten entkoppeln; Bridge/Telemetrie/Live-Test-Orchestratoren entfernen; einen Scheduler und Runtime-Adapter verwenden |
| v3 | Produktionsgraph, Materialbeschaffung, Bankplatz-Recovery, Merchant-Auftragsbesitz, Gruppenentwicklung, Paladin-Auren, erprobte Navigation-/Logistikfehlerbehandlung | Fachlogik extrahieren; keine Alpha-/Hotfix-Schichten und keine komplette v3-Runtime portieren |
| v4 | Klare Zustandsmodelle, Priorisierung, Ressourcenbesitz, frische Skills-/Gruppenfähigkeiten, Trennung von Planung und Ausführung | Ausgewählte kleine Funktionen übernehmen, nicht den vollständigen Typ-/Freigabeapparat |
| v5 | Item-Fingerprints, Reservierungen, Mengen-/Goldbudgets, Ergebnisabgleich, Ankunftsprüfung, Bankzuständigkeit, Starvation-Vermeidung, begrenztes Lernen | Kompakte fachliche Verträge; keine Shadow-/One-shot-/Ratifikationsketten oder zweite Hostverwaltung |

Details und konkrete Ausgangsdateien stehen in [BOT-ANALYSE.md](docs/BOT-ANALYSE.md). Maßgeblich sind die dort festgehaltenen Commitstände, nicht die neuesten zufälligen Änderungen auf `main`.

**Architektur:** Konfiguration → aktuelle Spielbeobachtung → Fachplaner → priorisierte Aufträge → zentrale Aktionsausführung → Ergebnisabgleich. Pro Bewegungs-/Inventar-/Bankressource nur ein Besitzer. Die Regeln werden nicht in mehreren Controllern erneut implementiert.

Geplante Struktur: `src/runtime`, `src/config`, `src/core`, `src/combat`, `src/party`, `src/items`, `src/merchant`, `src/world`, `src/ui`; `editor` für die lokale Einstellungsoberfläche, `scripts` für Build und Größenprüfung, `dist/albot.js` für die identische Ausgabedatei. Modulnamen sind Vorschläge, kein Auftrag zur sofortigen Codeerstellung.

## 3. Etappen in Entwicklungsreihenfolge

### P0 — Ausgangspunkt festhalten — erledigt

- [x] PowerShell-Ausgabe des Clients analysiert; Account-Code-Liste und Texturfehler in Client 1.2.1 korrigiert.
- [x] Ausführbare Einstiegspunkte, Controller und ausgewählte Tests/Nachweise der vier Versionen geprüft.
- [x] Funktionsmatrix und Übernahmeentscheidungen dokumentiert.
- [x] Headless-Handbuch und Typdefinitionen in dieses Repository übernommen.
- [x] Roadmap und KI-Arbeitsvertrag erstellt.

Die Clientkorrektur wurde lokal mit offiziellen Spielquellen geprüft, nicht durch einen neuen echten Login. Sie ist kein Live-Nachweis für ALBot.

### P1 — Gemeinsamer Kern und Konfigurationsmodell

Durch den Folgeauftrag autorisiert und als Testkandidat implementiert. Die Häkchen bezeichnen Code, nicht bestandenen Live-Betrieb.

- [x] Klassisches IIFE-Bundle mit Versions-/Byteangabe und eingebetteter Konfiguration bauen. Größenprüfung ab dem ersten Build.
- [x] Browser-/Headless-Erkennung und Runtime-Ports gemäß [RUNTIME-VERTRAG.md](docs/RUNTIME-VERTRAG.md).
- [x] Zentraler Scheduler, instanzlokaler Start/Stop, Bereinigung, Pause/STOP und Generationsprüfung für verspätete Antworten.
- [x] Eine Aktionsausführung für Spielbefehle; aktuelle Zustandsprüfung, Ressourcenbesitz, begrenzte Warteschlangen.
- [x] Gemeinsames Regelschema für Charaktere, Farmziele, Skills, Merchant und jedes Item; Import/Export und verständliche Validierung in der Werkstatt. Runtime-Konsum für den unterstützten Live-A-Teilumfang vorhanden.
- [x] Teamtransport mit lokaler Headless-IPC, Browser-CM, vertrauenswürdigem Roster, kurzen Statusmeldungen, Auftrags-ID und Bestätigung.
- [x] Persistenz kleiner Konfigurationen und offener Aufträge; keine atomaren Storage-Locks voraussetzen.

Fertig, wenn derselbe Build beide Umgebungen korrekt erkennt, sauber startet/stoppt und eine Einstellung in derselben Form verarbeitet. Keine neue Spiellogik doppelt implementieren. Noch kein separater Live-Testtermin; gemeinsam mit P2 prüfen.

### P2 — Farmer und Gruppe spielbar machen — Live-Test A

- [x] HP/MP-Regeneration und Verbrauchsmittel, Tod/Respawn, Loot, Inventarreserve.
- [x] Zielauswahl, Reichweite, Cooldowns, Kiting, sichere Reise, Wegfehler und Ankunft anhand tatsächlicher Karte/Instanz/Position.
- [x] Klassenrotationen für Warrior, Ranger, Mage, Priest, Rogue, Paladin; Skills nach Klasse, Level, Ausrüstung, Kosten und Situation.
- [x] Gruppenheilung, Energize, Buffs, gemeinsames Ziel, Aggro-/AoE-Grenzen und Schutz vor fremden Zielen.
- [x] Konfigurierbarer Farmer-Leader und optionales Standardprofil drei Farmer plus Merchant; keine fest eingebauten Accountnamen.
- [x] Farmer-Itemregeln mindestens Behalten/Verbrauchen/Reservieren/Übergabe anwenden. Merchant erhält zunächst begrenzte Liefer-/Nachschubaufträge.
- [x] Kurzes Browser-Bedienpanel: Status, Start/Pause/STOP, aktive Rolle und blockierender Grund. Headless erzeugt kein DOM-Panel.

**Live A, ca. 10–15 Minuten:** identisches Artefakt nacheinander im Browser und Headless ausführen, zunächst an einem einfachen Farmziel. Ein kleiner Teamlauf prüft Zielteilung und einen Lieferauftrag. Beobachten: Bewegung, HP/MP, Attack-Cooldown, Loot, IPC/CM, Stop/Neuladen. Keine parallele Anmeldung desselben Charakters. Bei einem konkreten Fehler nur den betroffenen Ablauf nachprüfen.

Fertig, wenn normales Farmen und Teamkommunikation in beiden Umgebungen funktionieren. Anschließend die Fachmodule weiter ausbauen; keine Shadow-Phase dazwischenschalten.

### P3 — Merchant, alle Item-Regeln und lokale Oberfläche

- [x] Lokalen Editor mit Katalog aus den verfügbaren Spieldaten bauen; jedes Item einzeln suchbar, Rollen- und Charakterausnahmen, Kopieren/Mehrfachbearbeitung und erweiterbare Schema-Vorgaben.
- [x] Getrennte Farmer- und Merchant-Aktionen pro Item, aber ein gemeinsamer Regelsatz. Levelintervalle, Mengen, Eigenschaften, Schutzmerkmale und Reservierungen berücksichtigen. Implementiert in policy/economy/logistics/production; accountweite Gearziele und Reservierungen sind ab 0.5.0 ergänzt.
- [x] Auflösen von Regelkonflikten mit verständlicher Anzeige „Diese Regel gewinnt, weil …“ in der Werkstatt. Identische Priorität und Filter gelten inzwischen in inventory/acquisition/production. Die Vorschau ist kein Shadow-Testlauf.
- [x] Loot-Abholung, Nachschub, Goldreserven, Zustellung an genauen Empfänger, Arbeitsvorrat und freie Inventarplätze. Regelgebundene Übergabe/Versorgung, Reserven und Platzgrenzen implementiert; A/B bestätigen die dokumentierten Lieferketten. 0.6.0 ergänzt Farmer→Merchant-Goldabholung mit Sitzungs-/ID-Handshake und beidseitigem Balanceabgleich.
- [x] Bank ein-/auslagern, Gold, Packwahl, Zusammenlegen und begrenzte Kapazitätserweiterung nach explizitem Budget. 0.4.0 ergänzt opt-in-Teilentnahme mit temporärem Arbeitsbestand, persistentem Wiederanlauf und Rest-Rücklagerung; dieser neue Teil noch nicht live bestätigt.
- [x] NPC-Kauf/-Verkauf und Spielerhandel einschließlich Stand, Listings, Wishlist, Preisunter-/obergrenzen, Marktvergleich und Ponty. Regelgebundene Implementierung vorhanden, Marktvergleich einschließlich begrenzter Angebotshistorie und Kosten-/Zeitplanung in 0.5.0; nicht alle Handelswege sind live nachgewiesen.
- [x] Mluck-Service, Merchant-Buffs und faire Task-Priorisierung. Mluck/Buffs, Haltezeit/Alterung und Vorrang für Logistik sind implementiert. 0.5.0 prüft Logistik in jedem Economy-Tick, unterbricht auch nahe Merrit-Aufgaben und gibt Gathering-Aufträge regelmäßig zurück. Bereits gestartete Serverqueues müssen beobachtet enden; keine feste Netzwerklatenz versprechen.
- [x] Wiederanlauf gleicht beobachtete Bestände ab; ein unklarer Transfer wird nicht blind erneut gesendet. Wertjournal, beidseitiger Lieferabgleich und Sperre bei Unklarheit vorhanden; 0.4.0 ergänzt Bank-Zwischenzustand. Manuelle Aufklärung unbekannter Wertaktionen bleibt vorgesehen.

Fertig, wenn die lokale Oberfläche ein gültiges, vollständiges Bundle erzeugt und Farmer/Merchant dieselben Regeln anwenden. Logikprüfungen an Regelpriorität, Mengenreserven und Item-Identität; gemeinsamer Live-Termin folgt nach P4.

### P4 — Gear, Produktion und vollständige Merchant-Autonomie — Live-Test B

- [x] Rollen-/Klassenbezogene Gear-Bewertung für aktive und offline bekannte eigene Charaktere, Zielausrüstung und Reservierungen.
- [x] Upgrade und Compound mit Ziellevel, Scroll/Offering-Regeln, Verlustbudget, Goldreserve und Ergebnisabgleich.
- [x] Exchange und Craft aus aktuellen Rezepten; Bedarf, Zutaten, Arbeitsplätze und Kapazität konsistent planen.
- [x] v3-Produktionsgraph übernehmen: vorhandener Bestand → Bank → Kauf → Farmauftrag → Exchange/Craft/Upgrade/Compound → Lieferung. Rekursion/Zyklen und Mengen begrenzen.
- [x] Beschaffung nach Kosten, erwarteter Farmzeit, Dropquelle und passender aktueller Gruppe; keine Erfolgswahrscheinlichkeit als Garantie darstellen.
- [x] Fishing/Mining inklusive Werkzeugwechsel/-rückwechsel und sicherer Zone; Merrit, Teilnahme an Giveaways, geeignete Wishlist und begrenzte Schnäppchensuche.
- [x] Auto-Optimierung berücksichtigt accountweite Ziele, aktuelle Preise und Verlustregeln. Alte Zahlen wie 150M/170M oder 80 Prozent werden veränderbare Profile, keine versteckten universellen Konstanten.

**Historischer P4-Reststand vor 0.5.0 (durch den folgenden Abschluss ersetzt):**

| Punkt | Bereits implementiert | Noch zu entwickeln / klären |
|---|---|---|
| Gear | Rollenbewertung, Live-Klassen-/Slotprüfung, Verbesserungsschwelle, bekannte Offlineprofile und Vorschläge | Gemeinsame Zielausrüstung/Reservierung für den ganzen Account, automatische Zuordnung und Beschaffungsplanung |
| Upgrade/Compound | Ziellevel, identische Inputs, Scroll/Offering-Auswahl, Chancevorschau, Verlustreserve, Ergebnisabgleich | Vollständige Goldkostenbehandlung der Mutation überprüfen: Vorschau setzt cost derzeit auf 0; fehlende Hilfsmittel als automatische Plandependenzen aufnehmen |
| Exchange/Craft | Gewöhnliche aktuelle G-Rezepte, Zutaten/Reserven, NPC-Reise, Craftkosten und beobachtete Änderungen | Freie Rezept-/Exchange-Zielangabe, umfassende Kapazitäts-/Stapelvorbereitung und Spezialrezepte |
| Produktionsgraph | Bestand/Bank/NPC/Markt/Farm/Exchange/Craft/Mutation, Mengenallokation, Zyklen-/Tiefengrenze, bestätigte Ziellieferungen | Hilfsmittelabhängigkeiten und Kapazitätsplanung vervollständigen; vollständige v3-Autonomie nicht aus dem vorhandenen begrenzten Graph ableiten |
| Beschaffungswahl | Dropquellen, erwartete Ausbeute, erlaubte Monster und Farmzeitlimit | Gemessene Killrate des aktuellen Teams statt fester Schätzung von 20 Kills/Stunde; Kosten-/Zeit-/Reisevergleich aller erlaubten Wege statt fester Wegreihenfolge |
| Nebenaufgaben/Handel | Fishing/Mining, Werkzeugrückwechsel, Merrit, Giveaways, Wishlist und begrenzter Ponty-Scan | Versorgungslatenz/Unterbrechungsübergänge abschließen; neue 0.4.0-Bank-/Merrit-Pfade live bestätigen. Vorhandene Fähigkeiten benötigen keinen erneuten vollständigen Neubau |
| Auto-Optimierung | Konfigurierbare Budgets/Ziele, aktueller Angebotsmedian, begrenzte Farmbewertung | Accountweiter gemeinsamer Optimierer, Markt-/Reise-/Gruppenmesswerte und kostenbewusste Zielpriorisierung |

Die offenen P4-Häkchen bedeuten **teilweise implementiert, Zielumfang noch nicht vollständig erreicht**. Sie bedeuten nicht „kein Code vorhanden“. Ein bestandener Live-Test und die Anzahl gezielter Tests ersetzen diese Restarbeiten nicht. Die Priorität bleibt zunächst P3/P4 vervollständigen, danach abschließende Integration; der Updater entfällt auf Nutzerwunsch.

**Live B – bestanden (Browser + Windows-Headless, 7. Oktober 2026):** Die festgelegte Kette Farmer sammelt → Merchant übernimmt → Bank/NPC → günstige freigegebene Verarbeitung → Lieferung wurde mit `0.2.2-live-b` vollständig live nachgewiesen. Browser und Headless bestätigten Wertaktionen durch beobachtete Inventar-/Bankänderungen; der abschließende Liefer-Handshake lief ohne Timeout bis `done`. Details: [docs/LIVE-B-ERGEBNIS.md](docs/LIVE-B-ERGEBNIS.md).

Der Live-Testpunkt ist bestanden. Das schließt P3/P4 nicht pauschal ab: die oben noch offenen Funktionsblöcke bleiben offen.

### P5 — Accountstrategie, Welt und adaptive Optimierung

- [x] Teamwahl nach Aufgabe, realen Klassenfähigkeiten, Gear, Levelentwicklung, Catch-up und Überlebensfähigkeit. Charakterrotation mit stabilen Haltezeiten.
- [x] Aktuelle Benutzerkonfiguration setzt Teamgrößen und erlaubte Charaktere; Spielservergrenzen bleiben maßgeblich. Der Headless-Client startet nur konfigurierte Namen.
- [x] Event-/Boss-/Quest-Erkennung, Aktivitätswahl, Saisonaktionen, gefährliche Inhalte und Rückkehr zum normalen Farmziel.
- [x] Paladin-Aurapolitik aus v3 ergänzen; in ALFinal ausdrücklich ausgelassene situationsabhängige Skills nur mit passender Fachregel integrieren, nicht wahllos auslösen.
- [x] Serverwechsel mit Teamabgleich; Transport-/Bewegungsfunktionen wie Magiport nur bei vereinbarter Zuständigkeit und gültigem Ziel.
- [x] Dynamische Spawn-/Karten-/Item-/Skilldaten aus `G` und Livezustand, kleine Caches invalidieren bei Änderung.
- [x] Lern-/Rankingfunktionen aus den Vorgängern auf begrenzte interne Kennzahlen reduzieren: aktuelle Gruppeneffizienz, Reisezeit, Marktwerte. Deterministischer Rückfall, keine externen Modelle als notwendige Abhängigkeit.
- Optionaler Updater entfällt ausdrücklich auf Nutzerwunsch. Manueller Paketimport und Reload bleiben verfügbar.

Fertig, wenn diese Fähigkeiten in die bestehenden Planer und Aufträge passen. Kein zweiter Scheduler und kein separater „Autonomie-Bot“. Prüfung gemeinsam mit P6.

### P6 — Gesamtintegration, Größe und Freigabe — Live-Test C

- [x] Jede Zeile der Funktionsmatrix ist einem Modul und einer Konfigurationsmöglichkeit zugeordnet. Übrige Lücken ausdrücklich nennen.
- [x] Bundle minifizieren und UTF-8-Bytes einschließlich Konfiguration messen. Hartes Limit 1.048.576 Byte; Ziel maximal 921.600 Byte. Alte Gesamtbundles nicht einfach aneinanderhängen.
- [x] Editor, Testwerkzeuge, Quellkarten, statische Komplettkopien von `G`, Telemetrie und Hostcode aus dem Runtime-Bundle halten. Funktionsumfang nicht heimlich kürzen, um das Limit zu erreichen.
- [x] Ereignisbasierte Aktualisierung und getrennte Tickraten: Kampf häufig, Economy langsamer, Katalog-/Account-Neubewertung nur bei Änderung bzw. größeren Intervallen. Begrenzte Caches und keine offenen Timer nach Stop.
- [x] Installation und Build unter Windows und Linux dokumentieren und tatsächlich verfügbare Plattformprüfungen ehrlich ausweisen.
- [x] Kurze Benutzeranleitung, Beispielprofile, KI-API-Vertrag und Changelog ergänzen.

**Live C, ca. 20–30 Minuten:** normales Zusammenspiel Merchant + Farmer, anschließend ein kontrollierter Aktivitäts-/Konfigurationswechsel, Pause/Resume, Reload und Wiederanlauf. Browser und Headless verwenden denselben Build. Bestehendes Client-Dashboard/PowerShell reichen für die Beobachtung. Windows und Linux prüfen, sobald beide realen Umgebungen verfügbar sind; eine nicht verfügbare Plattform nicht als bestanden markieren.

Fertig, wenn der vereinbarte Funktionsumfang integriert ist, der Size-Gate besteht und die wenigen Live-Szenarien keine ungelösten Fehler zeigen. Zusätzliche Live-Tests nur aufgrund eines konkreten Problems, nicht routinemäßig für jeden kleinen Patch.

## 4. Detaillierter Item-/Merchant-Vertrag

Jedes im geladenen Spielkatalog vorhandene Item muss konfigurierbar sein. Neue IDs automatisch anzeigen, aber unbekannte Eigenschaften vor Wertaktionen klären. Namen nur zur Anzeige nutzen; Item-ID ist der Schlüssel.

| Bereich | Einstellbare Regeln |
|---|---|
| Auswahl | Item-ID, Levelbereich, benötigte Eigenschaften, Rolle, Charakter, optional Server/Map/Aufgabe |
| Schutz | Gesperrt/gebunden/equipped, persönliche Reserve, Gear-/Craft-/Lieferreservierung, unbekannte Variante |
| Farmer | Behalten, nutzen/equippen, bis Mindest-/Zielmenge sammeln, Überschuss liefern, Empfänger, erlaubte Direktverkäufe |
| Merchant | Behalten, Bank, NPC-Verkauf, Marktlisting, Kauf/Wishlist, Zustellung, Upgrade, Compound, Exchange, Craft |
| Mengen | Mindestbestand je Charakter, Teamreserve, Zielbestand, Höchstbestand, Stapel-/Inventarreserve |
| Preise | Mindestverkaufspreis, maximaler Einkaufspreis, Budget je Vorgang/Zeitfenster, Goldreserve, zulässige Preisquelle |
| Verarbeitung | Ziellevel, erlaubter Scroll/Offering, Verlustgrenze, erforderliche Anzahl/Zutaten, Abbruch-/Fallback-Regel |
| Koordination | Genau ein zuständiger Merchant, Auftragspriorität, Ablaufzeit, Reserve vor Transfer, exakter Empfänger |

Auflösungsreihenfolge: unverhandelbarer Itemschutz → explizite konkrete Charakter-/Itemvariante → Rollen-/Itemregel → globale Itemregel → konservative Vorgabe. Bei gleicher Spezifität explizite Regelpriorität, danach stabile Reihenfolge; widersprüchliche gleichrangige Wertaktionen schon im Editor ablehnen. Gear-/Zielreservierung entsteht vor Überschussverkauf. Autonomie darf eine explizite Einstellung nicht durch Profitoptimierung überschreiben.

Ein Beispiel muss später durchgängig funktionieren: Farmer behält eine Trankreserve, sendet Überschuss an Merchant; Merchant hält Teamvorrat und liefert bedarfsbezogen zurück. Dasselbe Item darf nicht durch zwei unabhängige Regeln permanent hin- und hergeschickt werden.

## 5. Wie die Entwicklung zügig bleibt

- Pro Etappe ein zusammenhängender nutzbarer Ablauf; keine Mini-Roadmap pro API-Aufruf.
- Bestehende reine Fachfunktionen zuerst portieren; Runtimeabhängigkeiten an einer Stelle ersetzen.
- Keine vier Frameworks und keine alten Alpha-/H-/PR-Schichten mitschleppen.
- Kleine zielgerichtete Tests für Preis-/Mengenlogik, Identität, Doppelaktionen und Runtime-Erkennung. Kein Vollnachbau des Spielservers.
- Alte API-Erfahrung weiterverwenden; nur tatsächlich abweichende Aufrufe anhand der offiziellen geladenen Quellen klären.
- Live-Termine A/B/C zusammenlegen, wenn die Entwicklung schnell voranschreitet. Nicht ausweiten, solange kein konkreter Fehler es erfordert.
- Keine belastbaren Kalendertermine aus Dateimengen ableiten. Nach P2 Aufwand für die verbleibenden Extraktionen neu einschätzen; die Priorität bleibt spielbarer Kern → Merchant/Items → Produktion → Welt/Optimierung.

## 6. Aktuelle Grenzen und bewusste Entscheidungen

ALFinal `dist/al-bot.js` hat am analysierten Commit 1.948.865 Byte, v3 `dist/aio-v3-runtime.js` 3.340.785 Byte. Beide ungekürzt über dem CODE-Slot-Limit. ALFinal umgeht das mit einem kleinen Bootstrap und extern geladenem Bundle; das erfüllt allein nicht unser Ziel einer vollständigen Datei unter dem Limit. Die kompakte Zusammenführung muss den Größenvertrag tatsächlich erfüllen.

Die öffentliche Serverreferenz prüft UTF-8-Bytegröße, nicht sichtbare Zeichen: [mainframe.js am untersuchten Commit](https://github.com/kaansoral/adventureland_mongodb/blob/987831288c40928b959bc06a626a4d67cd0c98ca/mainframe.js#L1475). Vor endgültiger Veröffentlichung die dann aktuelle Save-API-Grenze gezielt bestätigen, falls das Spiel geändert wurde.

Der Client bietet bereits lokale Nachrichten und Prozessverwaltung, jedoch keinen transaktionalen Bot-Datenspeicher und keinen Konfigurations-Schreibkanal im Dashboard. Diese Grenzen werden im Botdesign berücksichtigt; neue Clientfunktionen nicht voraussetzen. Nicht alle Browser-Eigenheiten werden automatisch durch jsdom korrekt; deshalb Live A mit demselben Artefakt in beiden Umgebungen.

Diese Planung verspricht Funktionszusammenführung, keinen heute bereits fertigen Bot und keine aus früheren Projekten abgeleitete Garantie für fehlerfreien Dauerbetrieb.

## 7. Historische Übergabe an Live A

Testkandidat und Ablauf: [docs/LIVE-A.md](docs/LIVE-A.md). Build, Syntax, Paket-Hash, Größenlimit und 21 gezielte Tests bestanden. Darunter Kontextisolation, Stop/Reload, fehlende jsdom-Hilfsfunktionen, Item-Identität, Reserven sowie Annahme und beidseitiger Mengenabgleich einer Lieferung. Keine Shadow-Tests, kein echter Login, kein Live- oder Linux-Erfolg behauptet. P3-P6 bleiben offen. Die aktive Client-Konfiguration wurde nicht umgestellt.

### Live-A-Korrektur 0.1.1 (6. Oktober 2026)

Vom Nutzer gelieferte Screenshots belegen Browser-Goo-Kills und danach QuotaExceededError beim optionalen Konfigurationscache und Checkpoint. Test A ist damit begonnen, aber nicht bestanden. Repariert: keine komplette Configkopie mehr im Browserstorage, eigener kleiner Checkpoint mit Platzreserve, bei vollem Storage RAM-Abgleich für frische Verbräuche und weiterhin gesperrte Lieferungen. Keine fremden Speicherschlüssel gelöscht. Begrenzter Testbericht mit Browserdownload und optionaler Dateiausgabe durch Client 1.2.2; Anleitung in LIVE-A.md. 25 Bot-/Werkstatt-Tests und 30 Clienttests bestanden, darunter der konkrete Quota-Fall. Erneuter Browser-Lauf und Headless-Lauf stehen aus.

### Live-A-Korrektur 0.1.3 (6. Oktober 2026)

Der zweite Browser-Teamtest mit `0.1.2-live-a` hat den früheren Storage-/CM-Blocker beseitigt: alle vier Berichte verwenden einen persistenten Checkpoint und alle drei Ranger kämpfen gegen `goo`. Gefunden wurden stattdessen zwei konkrete Laufzeitgrenzen. Erstens konnte ein nicht benötigtes erstes Supply-Item weitere benötigte Items für denselben Empfänger bis zum Timeout verdrängen. `0.1.3-live-a` bindet Angebote deshalb an den frischen gemeldeten Empfängerbedarf, begrenzt die Menge auf `need` und führt Item-spezifische Angebots-Cooldowns. Zweitens werden die bekannten Adventure-Land-Races `attack:not_there` und `loot:openning` als transiente Zustände behandelt und aggregiert berichtet, während unbekannte Fehler weiterhin Incidents bleiben. Skillbedingungen unterscheiden nun explizit den eigenen `hpRatio` vom `targetHpRatio` des aktuellen Gegners. Testberichte enthalten dauerhafte `actionStats` und Logistikzähler. Gezielt geprüft wurden Syntax des zusammengesetzten Runtime-Bundles, Demand-Supply und die beiden transienten Fehlerpfade; echter Wiederholungslauf und Headless bleiben ausstehend.


## 8. Historische Übergabe: Live B vorbereitet

Der Folgeauftrag autorisiert Entwicklung bis zum nächsten Live-Test. Live A: Browser-Teamkampf/Verbrauch und fünf bestätigte Merchant-Lieferungen; Windows headless sechs bestätigte Lieferungen und fünf Trankverwendungen, ohne ungeklärtes Inventar. Kurze Funktionsnachweise, kein Dauerlauf und kein Linuxnachweis.

Implementiert und mit 46 gezielten Offlineprüfungen geprüft: gemeinsame Aktionsphasen, Bank/NPC-/Marktgrundlagen, persistente Ausgaben-/Verlustgrenzen, exakte Variantenmeldungen, Upgrade/Compound-Chanceabfrage, gewöhnliche Rezepte/Exchange, begrenzte Produktionspläne und Geargrundlagen. Vier exportierbare Live-B-Profile führen Abholung → Bank → NPC → günstiges Upgrade → Lieferung durch. Autostart ab jetzt standardmäßig true. Build/Syntax/Paket/Größe geprüft; kein Shadow-Test und kein neuer Login.

Die offenen P3/P4-Häkchen bleiben bewusst offen, soweit sie umfangreichere Fähigkeiten umfassen: faire langfristige Priorisierung, Teilentnahme großer Bankstapel, Merrit/Fishing/Mining/Ponty, empirische Beschaffungsoptimierung und vollständige Account-Ziele. Diese Restarbeiten werden nach Rückmeldung zum Kernablauf weitergeführt; der nächste Test ist ein Merchant-Kettentest, keine Vollfreigabe von P4. Details und exakt begrenzte Aktionen: [LIVE-B.md](docs/LIVE-B.md).

## 9. Historische Übergabe: Live C vorbereitet

Live B vollständig bestätigt; 0.2.2-Fixes sind im C-Kern erhalten. Implementiert: Wenn–dann-Aktionen und erlaubte temporäre Aufgaben; Item-Fallbacks; faire Merchant-Auswahl mit Haltezeit/Alterung; Fishing/Mining mit Offhand-/Tool-Rückwechsel und persistentem Zustand; Merrit-Anker/Parcel-Bestätigung; budgetierter Ponty-Scan; bestätigte Produktionsziellieferungen über Reload; Boss-/Event-Whitelist, Monsterhunt und Anniversary; öffentliche Karten-/Risikofilter und begrenztes Farmranking; bekannte Accountprofile/Catch-up, wiederanlauffähiger Einzelwechsel, Paladin-Auren und abgestimmter Magiport/Leader-Realmwechsel.

Neue Optionen laden als C-Paket in dieselbe lokale Werkstatt. Katalog, gemeinsame Itembearbeitung und Regelvorschau werden jetzt anhand vorhandener Schemafelder freigeschaltet, nicht anhand einer festen Schema-ID; Aktionen bleiben auf das geladene Schema begrenzt. Dies beseitigt eine bisherige Einschränkung beim Teilpaketimport und benötigt keine Sonderoberfläche pro zukünftiger Version.

Gezielt geprüft: Bestand/Transfer-ID bei Produktionszielen; Toolwechsel vor Doublehand und Rückwechsel nach Reload; Task-Alterung; erlaubt/gesperrt/zu riskant bei Weltzielen; Magiport-Auftragsbindung; Realm-Allowliste und offene Wertaktion; Wiederherstellung einer unterbrochenen Rotation; klassischer C-Build in Browser-/Headless-Kontext mit Regeln, Pause, Resume und Reload. Dazu bestehende A/B-Regressionen, Paket-Hash, Syntax und realer C-Build mit 1.276 Regeln für alle 638 Katalogitems unter dem 900-KiB-Ziel. Tatsächlich ausgeführt unter Windows, kein Shadow-Test und kein neuer Login.

Persönlicher Live-C-Lauf: Normalbetrieb → gesundheitsbedingter Bee-Wechsel → Rückkehr/Pause/Reload → optional einmal Fishing mit vorhandener Rod. Neue gefährliche Weltaktionen und Rotation sind im Testprofil ausgeschaltet. Dateien und Ablauf: [LIVE-C.md](docs/LIVE-C.md). Weitere C-Optionen gelten erst bei tatsächlicher passender Ausführung als live bestätigt.

Offen bleiben insbesondere Updater, Teilentnahme zu großer Bankstapel, Shell-only-Merrit-Abgleich, langfristige Markt-/Reise-/Accountoptimierung sowie endgültige Vollfreigabe/Minifizierung. Der kompakte, lesbare Build liegt bereits deutlich unter dem Slotlimit; Minifizierung wird nicht als durchgeführt behauptet. Linux-Livebetrieb bleibt ausstehend. P3–P6 werden wegen der genauen Restlücken nicht pauschal abgehakt; die neue Zuordnung in INTEGRATIONSSTAND.md ersetzt kein Live-Ergebnis.

### Live-C-Korrektur 0.3.1

Acht Browserberichte ausgewertet: Goo-Normalbetrieb ohne Incidents; Bee-Regeln aktiv, aber neun fehlgeschlagene Wege. Hindernisrouting zum tatsächlichen Monsterpunkt, Ankunfts-Stopp und Fehlerfreigabe repariert. Merchant ohne freigegebenen Auftrag/Nachschubbedarf wartet korrekt; irreführendes Überschreiben seiner Meldungen entfernt. 65 gezielte Prüfungen bestanden. Bee-Wiederholung und Phase 03 Fishing bleiben live ausstehend. [Auswertung](docs/LIVE-C-ERGEBNIS.md).

### Live C bestätigt

Am 7. Oktober 2026 bestätigt der Nutzer nach Auslieferung von 0.3.1: alle Tests bestanden. Der vereinbarte Live-C-Ablauf ist abgeschlossen. Vorherige Fehlermeldungen sind historisch; offene Implementierungsbereiche und ausgeschaltete Optionen bleiben offen. Keine zusätzlichen C-Umgebungsnachweise oder neuen Logauswertungen behauptet. Siehe docs/LIVE-C-ERGEBNIS.md.

## 10. Merchant-Ergänzungen nach bestandenem Live C

Folgeauftrag autorisiert die Weiterentwicklung. 0.4.0-merchant schließt Bank-Teilentnahme und Merrit-Bestätigung über eigene Shell-Events/neue Receipts. Die Bankoption ist ausdrücklich aktivierbar und standardmäßig aus; größere Stapel werden nur vorübergehend entnommen, geteilt und mit bestätigtem Mengenabgleich zurückgelagert. Persistenter Wiederanlauf und Vorrang vor Inventar-/Liefer-/Rotationsarbeit. Schema additiv und alte Profile kompatibel, bestehender Werkstattgenerator unverändert. 70 gezielte Prüfungen unter Windows bestanden; neue Abläufe noch nicht live bestätigt. Persönliche Normal-/Bank-/Merrit-Exporte und ein kurzer Ergänzungsablauf liegen bereit. Keine erneute A/B/C-Gesamtrunde und keine Shadow-Phase. Details: [MERCHANT-ERGAENZUNGEN.md](docs/MERCHANT-ERGAENZUNGEN.md).

Historischer Folgeplan vor 0.6.0: accountweite Gear-/Beschaffungsoptimierung und begrenzte Markt-/Reise-/Teamwerte, anschließend Gesamtintegration. Der optionale Updater ist inzwischen ausdrücklich ausgeschlossen. Historische offene Bank-/Shell-Vermerke oben beschreiben den früheren Stand; aktuelle Übernahmematrix ist aktualisiert.

## P3/P4-Implementierungsabschluss · 0.5.0-p3p4

Der Nutzer beauftragte das vollständige Schließen der P3/P4-Lücken vor einem gemeinsamen großen Test. Neues Schema albot.p3p4/v1: accountweite Gearziele, abgeleitete begrenzte Beschaffungs-/Lieferregeln mit explizitem Regelvorrang, Scroll-/Offeringabhängigkeiten, Rezeptalias und Spezialoutput, Stapel-/Arbeitsplatzvorbereitung, Bankabgleich vor automatischem Kauf, Kosten-/Zeit-/Reisewahl mit konservativer Gruppenrate, begrenzte Angebotspreishistorie und Merchant-Unterbrechungen. Bestehende A/B/C-Verträge, Profile und bestätigte Artefakte bleiben erhalten; Updater weiterhin außerhalb dieses Auftrags.

Die P3/P4-Häkchen bezeichnen den implementierten Umfang, **keinen neuen Live-Erfolg**. Der frühere Reststand in der Tabelle oben ist historische Ausgangslage. Aktueller Vertrag: [P3-P4.md](docs/P3-P4.md); ein gemeinsamer Testtermin mit sieben nacheinander geladenen Abschnitten: [P3-P4-LIVE.md](docs/P3-P4-LIVE.md). Browser und Headless verwenden denselben Code; Autostart true. Keine Shadow-Tests und kein automatischer Login. Optionale fehlende Markt-/Saisonfälle und Linux erst nach tatsächlicher Ausführung bestätigen.

Abschlussprüfung am 7. Oktober 2026: 83 gezielte Prüfungen bestanden, keine übersprungen. Runtime und Werkstatt gebaut; generischer Bot 213208 Bytes bei 1048576 Bytes Limit. Auch der Export mit 1276 Item-Regeln besteht die Größenprüfung. Live-Freigabe bleibt bis zur Auswertung des gemeinsamen Testlaufs offen.

## Vollbetriebsabschluss · 0.6.0-full

P5/P6-Häkchen bezeichnen integrierte Implementierung, keine neue Livefreigabe. Ergänzt: gear-/klassensynergetische Teamwahl, sichere Questzielteilung und Rückkehr, Paladin-Schutz und begründete Mage-Burst-Politik, bestätigte Goldlogistik, Bankkapazitäts-Recovery mit persistentem Verkaufsauftrag, automatische begrenzte Starter-Gearziele, faire Produktion mit temporär zurückgestellten unerfüllbaren Zielen und erhaltenen Zutatenreservierungen. Unbekannte Wertaktionen werden weiterhin angehalten. Keine wahllose Freigabe aller Skill-IDs oder unerlaubter Weltziele.

Minifiziertes klassisches Bundle, eingebautes Paket in derselben Werkstatt, persönliche Profilmigration und fortlaufende Desktop-Testlogs sind fertig. Ein gemeinsames Betriebsprofil aktiviert die Module bei tatsächlichem Bedarf; sieben getrennte P3/P4-Abschnitte werden durch normalen Livebetrieb ersetzt. Anleitung: [VOLLBETRIEB.md](docs/VOLLBETRIEB.md). Der optionale Updater ist ausgeschlossen. Nachweis unter Windows: gezielte Logik-/Vertragsprüfungen, Größen-/Syntaxprüfung und Client-Reportprüfungen. Linux-Installation ist dokumentiert, tatsächlicher Linux-Livebetrieb weiterhin ausstehend.

Abschlussprüfung 8. Oktober 2026: 94 Bot-/Werkstatt-Prüfungen und 31 Client-Prüfungen bestanden; keine Shadow-Tests und kein Login. Persönlicher Vollbetriebs-Build ca. 196 kB, deutlich unter 1.048.576 Bytes. Persönliche Standalone-Werkstatt öffnet ohne Scriptfehler und mit aktivem Exportbutton. Client prüft alle acht Skriptzuordnungen, vier aktive Charaktere. Gemeinsamer Spiel-Livetest noch ausstehend.

## Vollbetrieb-Korrektur · 0.6.1-full

Erster Browserlauf zeigt zwei API-/Auflösungsfehler und konkurrierende Questbewegung. Repariert: interact(monsterhunt), Leader-Questbesitz und beobachteter Status ohne falsches Inventarjournal, gezielte Altzustands-Recovery, Händler ohne Standort überspringen, Browser-Ordnerfähigkeit und Downloadhinweis. 100 gezielte Prüfungen bestanden. Live-Wiederholung ausstehend; Details: [CHANGELOG-0.6.1.md](docs/CHANGELOG-0.6.1.md).

### Vollbetrieb-Korrektur 0.6.2 · 8. Oktober 2026

Der neue gemeinsame Browserlauf war wegen Todesfällen und Merchant-Reisewechseln nicht bestanden. Risikobewertung, Ziel-Sperren, Gruppenrückzug und zusammenhängende Händlerwege repariert; neun neue gezielte Regressionen. Erneuter gemeinsamer Vollbetriebsnachweis bleibt offen. [Änderungen](docs/CHANGELOG-0.6.2.md).
