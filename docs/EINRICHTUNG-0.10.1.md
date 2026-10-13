# ALBot 0.10.1: automatischer Betrieb und passende Farmgruppen

Stand: 13. Oktober 2026. Offline geprüft; echter Browser-/Headless-Spielbetrieb mit dieser Version noch nicht bestätigt. Diese Anleitung ersetzt die manuellen Aktivierungsschritte 4–7 der Einrichtung 0.10.0 bei aktiviertem automatischem Betrieb.

## Was du jetzt machen musst

1. `editor/Bot-Werkstatt.html` aus diesem Paket öffnen und dein vorhandenes Profil importieren. Die Werkstatt übernimmt die neuen Felder. Merchant, Kampfcharaktere, Gruppe und Realm prüfen; die Beispieldateien enthalten Platzhalternamen.
2. „Lokale Funktionen automatisch aktivieren und planen“ (`general.autonomousSetup`) ist standardmäßig aktiv. Produktionswege, Helfer, Lernen und Bossadapter müssen nicht einzeln freigeschaltet werden. In diesem Modus werden die zugehörigen Schalter durch die Automatik gesteuert. Manuelle Kontrolle bleibt durch Abschalten dieses Modus möglich; bereits aktivierte Funktionen bleiben dann bis zu deiner Änderung aktiv.
3. Profil sichern und den Bot exportieren. Im Browser den Export in den CODE-Slot übernehmen; headless denselben Export als `CODE/main.js` verwenden. Die ZIP ist ein Bot-/Werkstattpaket, kein neuer Headless-Client. Die vorhandene Clientinstallation verwenden.
4. Merchant und gewünschte Farmer mit dem aktualisierten Export starten. Gleiche Gruppe, gleicher zuständiger Merchant und funktionierender CM-/IPC-Transport sind erforderlich. Es findet kein automatischer Login statt.
5. Zunächst Status und Testbericht beobachten: `ALBot.status()` zeigt beim Merchant `onlineSupplyFarmers`, bei unkonfigurierten Empfängern `supplyOnly`. `ALBot.transportStatus()` zeigt empfangene und frische Nachrichten. Vorhandene Wertjournale nicht löschen; unklare Transaktionen weiterhin anhand tatsächlicher Bestände klären.

## Automatische lokale Freigaben

Die gemeinsame Funktion `applyAutonomousMode` in `editor/lib/contract.mjs` wird sowohl in der Werkstatt als auch beim Runtime-Start angewendet. Auch ältere vollständige Profile ohne den neuen Schalter starten mit dieser Automatik. Persönliche Profildateien werden dadurch nicht auf der Festplatte überschrieben.

- Produktion: Upgrade, Compound, Craft, Exchange, Gearplanung/-optimierung, automatische Disposition, `purposeAllocation`, `autoHelpers`, `finiteHelpers`, `skillSupplies`, `tokenBuy`, `dismantle` und Progression-Beratung aktiv.
- Beschaffung: Bank, NPC, Markt, Farming, Crafting und Exchange stehen dem Planer zur Verfügung. Ein freigegebener Weg ist kein Kaufauftrag; Bedarf, gültige Rezepte, Preisbelege und Budgets entscheiden weiter.
- Merchant: Trankversorgung, Erkennung eigener Farmer, automatische Marktplanung und Bankentlastung aktiv. Bankarbeitsplätze bleiben bei der Profilvorgabe, in neuen Profilen zwei je Pack. Gold belegt keinen Platz. Geschützte Items werden nicht wegen Platzmangels verkauft.
- Welt: unterstützte Bossprofile aus den aktuellen Spieldaten automatisch ergänzen; Bossbereitschaft, Mechanikadapter, Karten-/Instanzfreigaben bleiben verbindlich. Unbekannte Bossmechaniken werden nicht pauschal freigegeben.
- Team: adaptive Auswahl, Gear-/Klassensynergie und erweiterte Skills aktiv. Feste Mitglieder, Leader und einzelne Rotationsfreigaben bleiben erhalten. Automatische Trankempfänger werden nicht zu Combat-Rotationskandidaten.
- Lernen: lokales adaptives Lernen aktiv. Das ist keine Aktivierung einer externen KI oder eines Cloud-Abonnements.

Mindestchancen, Gold-/Verlustbudgets, Preisgrenzen, Itemschutz und Reserven werden nicht erhöht oder abgeschaltet. Bei fehlender wirtschaftlich zulässiger Aktion wartet beziehungsweise plant der Bot neu. Vorhandene konkrete Keep-Regeln können daher weiterhin bestimmte Verarbeitungspfade verhindern.

## Alle eigenen Online-Farmer mit Tränken versorgen

Standardziele je Farmer: **3.000 `hpot0` und 300 `mpot0` insgesamt im Inventar**, nicht zusätzlich je Lieferung. Der Merchant kauft und liefert die fehlende Menge. Eigene Merchantreserve, Lieferbatches und Ausgabenlimits bleiben wirksam; größere Fehlmengen können mehrere Fahrten benötigen. Die Carry-Obergrenze bleibt verbindlich.

`get_characters()` bestätigt Accountzugehörigkeit. Der Bot übernimmt daraus ausschließlich Name und Klasse, keine Account-Secrets. Onlinezustand und Trankbestand kommen aus frischen ALBot-Heartbeats desselben Realms. Das Spiel-Accountlisting allein genügt nicht als Online-/Bestandsnachweis.

Auch eigene Charaktere außerhalb der Profilliste können den gleichen Export starten. Sie laufen dann als **reine Trankempfänger**: Heartbeats und bestätigte Trankübergaben, keine neu gestartete Kampf-, Loot- oder Goldlogik. Für autonomes Farming müssen sie weiterhin als Farmer konfiguriert werden. Ein fremdes Farmskript ohne ALBot-Heartbeat kann nicht zuverlässig versorgt werden. Explizit deaktivierte Charaktere und andere konfigurierte Gruppen werden nicht automatisch aufgenommen.

Offline-Farmer blockieren die Merchant-Abfahrt nicht mehr. Unbekannte Bestände lösen keinen Blindkauf aus. Vor dem verzögerten Kauf werden Bedarf und Anwesenheit erneut geprüft; vor Versand wird der verbleibende Trankplatz erneut kontrolliert. Standardlieferungen benötigen keine individuellen Send-Regeln. Explizite Itemregeln bleiben vorrangig.

Einstellbar unter Merchant: `discoverOwnFarmers`, `hpPotionTarget`, `mpPotionTarget`. Zielmenge null deaktiviert die betreffende Standardversorgung. Die automatische Erkennung wird im Automatikmodus aktiv gehalten.

## Gegner passend zu Rollen, Ausrüstung und Skills auswählen

Vorhanden waren bereits Spawn-/Respawn-, Reisezeit-, EXP-/Gold- und Risikobewertung. Ergänzt wurde `src/world/composition.mjs`, eingebunden in die normale Risikoprüfung und die gemeinsame Standortplanung.

| Aspekt | Tatsächliche Berechnung |
|---|---|
| Gruppenmitgliedschaft | Nur gewählte Kampfmitglieder mit frischen Lebens-/Realm-Daten. Reiseplanung darf entfernte Mitglieder berücksichtigen; unmittelbare Kämpfe zählen nur nahe Mitglieder derselben Karte/Instanz. |
| Drei Ranger | Beitrag jedes Rangers einzeln. Verfügbares 3shot/5shot mit Schadensfaktor aus `G.skills`, Manareserve und begrenzter Einsatzdauer. Kein pauschales Verfünffachen des gesamten Gruppenschadens. |
| Spawnangebot | Killrate begrenzt durch Spawnzahl und Respawnzeit; Reisezeit, Konkurrenz, Leerstand, Todesfälle und vorhandene Lerndaten bleiben berücksichtigt. |
| Priest | Ein verfügbarer Gruppenheiler erhält konservative, mana- und zeitbegrenzte Heilgutschrift. Sein Angriffsschaden wird für diese Prognose nicht gleichzeitig angerechnet. Reichweite, Gift, Widerstand und Anlaufzeit begrenzen die Heilung. Solo-Priests behalten ihre Angriffsfähigkeit. |
| Warrior/Paladin als Tank | Tatsächliche HP, Rüstung oder Magieresistenz nach Schadensart und gegnerische Durchdringung. Kritische Spitzen bleiben gefährlich. Tankfokus nur bei einem kontrollierten Einzelziel; keine Addition aller Gruppen-HP zu einem fiktiven Tank. |
| Aggrokontrolle | Beobachtetes Tankziel oder geeigneter Leader mit verfügbarer Taunt-/Agitate-Fähigkeit. Mehrfachpulls und beliebige Zielwahl erhalten keinen pauschalen Tankbonus. Nicht-Tanks müssen die anfängliche Belastung überstehen. |
| Paladin-Auren | Aktive Effekte und bereits gemeldete effektive Werte, gültige Quelle, Reichweite und Restdauer. Kein zweites Addieren von Aura-HP/Rüstung/Resistenz. Zeal wirkt bereits über gemeldeten Angriff/Angriffstempo; Warding erzeugt keine erfundene physische Schadensreduktion. |
| Hard Shell/Shelter | Bereits in den Livewerten enthalten. Läuft die Wirkung vor dem prognostizierten Kampfende aus, entfällt deren Rüstungs-/Resistenzbonus in der Sicherheitsrechnung. |
| Mana Shield | Nur aktiv und zeitlich gültig, begrenzt durch tatsächlich verfügbares Mana oberhalb einer Reserve. |
| Aether Shield | Keine HP-Schadensreduktion angerechnet; die Fähigkeit gibt Mana nach erlittenem Schaden zurück. |
| Guardian’s Oath | Nur bestehende Verbindung mit ausreichender Restdauer, nahe lebende Quelle und ausreichend HP-Budget des Paladins. Umgeleiteter Schaden verschwindet nicht aus der Betrachtung. |
| Courage/Fear | Zusätzliche Gegner können Schaden stark reduzieren. Bekannte Courage-Werte begrenzen die Prognose; vorhandene Fear-Abzüge werden nicht doppelt berechnet. Ein kurzer Beacon-Bonus wird nicht als dauerhafte Erhöhung eingeplant. |
| Skills allgemein | Fähigkeiten müssen durch den vorhandenen Skillprüfer tatsächlich nutzbar sein: Klasse, Level, Waffe, Mana, Zustände und Regeln. Ein gewöhnlicher kurzer Attack-Cooldown löscht eine nachhaltig nutzbare Fähigkeit nicht aus der Prognose. Benutzerdefinierte Skillregeln werden nicht als garantiert ausgeführte Rotation angenommen. |

Der Bot wählt somit geeignete Gegner nach aktuellen Fähigkeiten statt nach einer festen Regel „Priest vorhanden = starker Gegner“. Ein stärkerer Gegner muss auch wirtschaftlich sinnvoll sein. Unterstützte Bosskämpfe verwenden weiterhin ihre speziellen Mechanik-/Bereitschaftsadapter; diese normale Farmheuristik ersetzt sie nicht.

Grenzen: Prognosen sind konservative Schätzungen, keine garantierte Kampfsimulation. Nicht aktive Schutzskills, zufällige Procs, zukünftige Manaheilung und unbekannte Spezialmechaniken geben keine pauschalen Sicherheitsboni. Nicht jeder AoE-Skill erhält schon einen numerischen Ertragsbonus; der neue belastbare Multishot-Vergleich gilt für Ranger. Andere Klassen bleiben über ihren tatsächlichen Schaden, Schutz, Heilung und vorhandene Skill-/Pulllogik beteiligt. Livefeedback bleibt für weitere Kalibrierung erforderlich.

## Cloudflare, Supabase, Backblaze

Für diese Änderungen sind keine neuen Anbieterressourcen, Secrets oder Migrationen nötig. Die schon dokumentierte Einrichtung in **neuen Projekten innerhalb deiner bestehenden Konten** bleibt ein eigener Schritt. Kein Altimport. Cloud und externe KI bleiben standardmäßig aus; die lokale Automatik aktiviert sie nicht. Bestehende Kontingent-, Free-Tarif-, Kosten- und Abschaltprüfungen bleiben unverändert. Keine neuen Dienste wurden bereitgestellt.

## Einstieg für die nächste KI und Abnahme

Lesereihenfolge: `AGENTS.md`, diese Datei, `src/world/composition.mjs`, `src/world/risk.mjs`, `src/world/team-plan.mjs`, `src/party/capabilities.mjs`, `src/items/potion-supply.mjs`, `src/items/logistics.mjs`, `src/merchant/controller.mjs`, `editor/lib/contract.mjs`, Tests.

Gezielte Tests: `test/composition.test.mjs`, `test/autonomy.test.mjs`, `test/potion-discovery.test.mjs`, `test/merchant-pickup-capacity.test.mjs`, `test/runtime.test.mjs`. Stand: **503/503 Offline-Tests bestanden**, Runtime und Werkstatt gebaut. Alle Änderungen verwenden die gemeinsame Browser-/Headless-Runtime und den vorhandenen Executor; keine zweite Steuerungsschleife.

Offene Liveabnahme: tatsächliche Account-Erkennung, Tranklieferung mit Verbrauch während der Fahrt, Farmer-Disconnect, drei Ranger an dichtem Spawn, Priest-Ausfall, Paladin-Aurawechsel, Tankzielwechsel und Verbrauch der Schutzressourcen in beiden Laufzeitumgebungen. Vor und nach dem Lauf Testbericht und Journale sichern; keine Budgets erhöhen, um eine Verweigerung zu umgehen.

Mechanikquellen: [offizielle Spieldokumentation](https://adventure.land/docs) und offizieller Quellstand `kaansoral/adventureland` Commit `2148cf25d01060f54bcab01dfa7c2cf5b7baf374`, insbesondere `design/skills.js`, `design/conditions.js`, `node/server.js` und `js/old_common_functions.js` (`damage_multiplier`). Runtimewerte stammen weiterhin aus dem tatsächlich geladenen `G` und den Charakteren.
