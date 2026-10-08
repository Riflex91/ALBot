# Integrierte Autonomie · 0.7.0-full

Stand 8. Oktober 2026. Der Auftrag ergänzt die fachlichen Lücken aus FUNKTIONSVERGLEICH-0.6.2.md. Ein klassisches Bundle und ein Profil für Browser und bestehenden Headless-Client. Neue Abläufe sind implementiert und offline geprüft; ein gemeinsamer Live-Nachweis steht aus. Frühere Livebestätigungen gelten weiterhin nur für ihre damaligen Szenarien. Updater, Shadow-Verfahren und zusätzliche Host-/Telemetrieinfrastruktur bleiben ausgeschlossen.

## Zuordnung zum Vergleich

| Auditpunkt | Integrierter Ablauf in 0.7.0 | Wesentliche Grenze |
|---|---|---|
| 01–02 Kandidaten, Spawn, EXP/Gold bis Angriff | world/team-plan, strategy, farmer: Leader wählt öffentliche sichere Spawns; Heartbeat überträgt dieselbe Plangeneration; Kampf und Reise verwenden deren Monstertyp | Instanzen, nicht aktive Eventquellen, gesperrte Karten und unsichere Gegner bleiben ausgeschlossen. Keine mathematische Garantie eines globalen Optimums |
| 03 Standortlernen | Standortgeschichte nach Realm und UTC-Stunde mit EXP, Leerzeit, Konkurrenz, bestätigten verlorenen Kills und Fehlversuchen | 96 Einträge, keine Telemetrieplattform; Lernwerte brauchen tatsächliche Laufzeit |
| 04 Wechselhysterese | Mindesthaltedauer und erforderliche Nutzenverbesserung | Materialbedarf, ungültige Definition und Gefahr dürfen sofort unterbrechen |
| 05 AoE-Gebiete | Packgröße und Teamklassen bestimmen den begrenzten Dichtebonus; Aggrogrenze und vorhandene Skillguards begrenzen tatsächliche Pulls | Keine unkontrollierte Massenaggro; theoretischer Gruppenbonus wird durch Standortbeobachtung korrigiert |
| 06 Mehrgegner-Rückzug | Gewichteter Fluchtvektor, geschwindigkeitsabhängiger Schritt, geprüfte Ausweichrichtungen | Bei blockiertem Gelände kein erfundener freier Weg |
| 07 Klassen-Elixiere | Stat/Dauer/Preis-Auswahl, Bedarf mit persistenter Verbrauchsgeneration, Merchant-Beschaffung/Lieferung, beobachtetes Equip und Erneuerung; Farmquelle als Rückfall | Explizites keep und geschützte Items haben Vorrang; Buff ohne bekannte Ablaufzeit wird nicht dauernd ersetzt |
| 08 Quellenbindung | Materialquelle an Monster-/Dropdefinition und aktives Event/Quest gebunden; bekannte Eventendformate geprüft. Rezept-/Exchange-NPC-Prüfung bleibt erhalten | Fehlende Livebedingungen geben keine Eventquelle frei |
| 09 Unsicherheit | Erwartungszeit, P50/P90 und Vertrauensangabe; Bernoulli-Quantile bis 128 Erfolge, darüber bezeichnete Näherung; konservative Ausbeute bei unterschiedlichen Dropmengen; Unsicherheit auch in Upgrade-/Exchange-Kosten | Wahrscheinlichkeiten und geschätzte Killraten sind keine Zusage. P90 enthält zusätzlichen Zuschlag bei ungemessener Leistung |
| 10 Gemeinsamer Materialauftrag | Persistente Intentkennung, Quelle, Phase und Teilnehmersitzungen; Farmer melden Mengen, Merchant verteilt Quoten; bei erfüllter Teammenge keine neuen Pulls; gemeinsame ACK-/Receipt-Logistik | Fortschritt zählt frische aktive Farmer im gleichen Realm. Tatsächliche Lieferung wird getrennt bestätigt |
| 11 Konkurrierende Aktivitäten | Erholung/Sicherheit vor Normalaufgaben, Materialauftrag vor automatischen Weltbesuchen; Boss-/Eventkandidaten mit Nutzenvergleich gegen Farming; ausdrücklich angeforderte Aktivität hat Vorrang | Aktiver Monsterhunt und manuelle Regeln bleiben bewusste Aufträge, keine ausschließlich EXP-maximierende Politik |
| 12 Gearalternativen/Endlevel | Zugelassene Alternativen und kompatible freie/belegte Slots für bekannte aktive/offline Charaktere; Nutzen, Mindestverbesserung, geschätzte Kosten und kumulierte Chance bestimmen Ziellevel | Nur autoGearItems, autoGearMaxLevel und autoGearBudget; explizite Gearziele gewinnen |
| 13 Produktionsökonomie | Beobachtete echte Previewchance bevorzugt; ansonsten gekennzeichnete historische Planungskurven bzw. vorhandene G-Tabellen; keine Mindestchance als angenommene Erfolgschance | Vor jeder echten Mutation bleibt die tatsächliche aktuelle Spielpreview zwingend |
| 14 Item-Disposition | Explizite Regeln, Produktionsbedarf und Reservierungen vor automatischer Einordnung. Farmer geben freigegebene gewöhnliche Beute ab; Merchant hält Rezeptbestand, verarbeitet belegbar wirtschaftlichen Exchange-Überschuss innerhalb des Verlustbudgets, verkauft günstigen Überschuss oder lagert ein | Cash-/Quest-/Eventitems, Gear, levelnde Items, Werkzeuge, Buffs, Scrolls und geschützte Bestände werden nicht blind verkauft. Produktion nutzt weiterhin den gemeinsamen Bedarfsgrafen |
| 15 Mluck-Service | Fehlende/auslaufende Buffs zuerst; sichere Anreise als begrenzter fairer Merchantauftrag; fremder starker Buff wird respektiert | Gefährlicher Farmerstandort sperrt Anreise; Versorgung und Recovery haben Vorrang |
| 16 Markt | Getrennte BUY/SELL-Historie mit Menge/Zeit, Ask/Bid/Spread, Mindestzahl unabhängiger Anbieter; dieselbe Quote für Auswahl und Preisaktion; Verkauf an kompatible Spieler-Wishlist | Ask/Bid sind Angebote, keine belegten Verkaufspreise. 128 Beobachtungen mit TTL; bekannte Schutzvarianten sperren serverseitig unbestimmte Verkäufe |
| 17 Fähigkeiten/Leader | Leader verteilt Heal/Aggro/Schutz/Energize/Speed-Aufgaben aus frischen Fähigkeiten; lokale Ressourcenprüfung bleibt. Ohne expliziten Leader wird ein lebender geeigneter Träger gewählt | Explizite Skillregeln und vorgegebener Leader bleiben maßgeblich. Teamrotation bleibt opt-in |
| 18 Globale Priorität | Emergency/Safety/Normal/Background, Priorität und Alter in core/priority; gemeinsame Ressourcenlocks; Merchant-Unteraufträge bleiben fair | Laufende wertverändernde Aktionen werden abgeglichen, bevor neue konkurrierende Arbeit startet |
| 19 Inhaltsänderungen | Stabile Scope-Fingerprints, protokollierte Quarantäne und Freigabe nach stabiler Definition; alte Spawns/Aktivitäten werden verworfen; Economy prüft aktuelle Itemdefinitionen | Keine Shadow-Promotion. Neue Definition wird erneut auf Risiko/Budget geprüft |
| 20 Wiederanlauf | Produktionsintent persistiert; tatsächliche Bestände planen die Restarbeit neu. Exakt gepinnte Kauf-/Verkauf-/Equipänderungen können bestätigt werden, wenn andere Inventarvarianten unverändert sind | Alter Checkpoint ohne ausreichende Belege und ungeklärter Versand/Gold bleiben manuell abzugleichen; keine blinde Wiederholung |
| v5 Bankzuständigkeit | Ein benannter Merchant, Session/Epoche/Realm/Frist im Heartbeat und Konfliktprüfung vor Bankaktionen | Kein vorgetäuschter atomarer Storage-Lock; externe Skripte gehören nicht zu dieser kooperierenden Gruppe |
| v5 Physische Gear-Allokation | Persistenter Ledger bindet Lieferung an konkreten Slot-/Itemfingerprint, Empfängersitzung, Realm und bestätigtes Settlement | Unaufgelöster Transfer bleibt geschützt; ein Neustart des Empfängers erteilt keine alte Versandfreigabe |
| v5 Threat/CC/Ownership | Begrenzter frischer Gegnerledger, Definitionsfingerprint, beobachtete Team-/Fremdtreffer, CC und Immunität; umkämpfte/immune Gegner werden geprüft | Ein ungetroffener Gegner wird nicht als Teambesitz behauptet; fehlende Beobachtung wird nicht erfunden |
| v5 Serverpolicy | Frische explizite Online-/Modusregistry, Allowlist, Team-ACK, Cooldown und maximal drei Hops/Stunde; automatische Wahl bei belegtem Standortdruck und geringerem Serverbesatz | Ohne diese Daten kein automatischer Wechsel. Unbekannt/HARDCORE/TEST/DUNGEON werden abgelehnt |
| v5 Kartengraph | Gerichtete Türen und Transporter aus G mit Definitionsfingerprint und strategischen Kartenentfernungen | Die konkrete Wegfindung führt weiterhin smart_move aus |

Die Fachfunktionen wurden in ALBot integriert; die alten v5-Modelle wurden nicht als zweite Laufzeit kopiert. Das ist kein Nachweis, dass jede historische Hilfsfunktion oder jede Spielkombination bereits live gleichwertig arbeitet.

## Werkstatt und Einstellungen

Die bestehende Werkstatt lädt Runtime und Schema 0.7.0. Ein alter Entwurf mit derselben Schema-ID erhält die neuen Vorgaben, ohne vorhandene Werte zu ersetzen. Profil-JSON und fertiger JS-Export bleiben getrennt.

| Pfad | Vorgabe | Verwendung |
|---|---|---|
| farming.autoTargets | true | Offene sichere Spawnwahl; false verwendet farming.targets. Eine nicht leere individuelle farmTargets-Liste bleibt eine harte Einschränkung |
| farming.mode | vorhandener Profilwert | xp, gold oder balanced. Das ausgelieferte persönliche Profil bleibt balanced; für EXP-Priorität xp wählen |
| farming.planHoldMs | 60000 | Standort zunächst halten |
| farming.switchImprovement | 0.2 | Mindestens 20 Prozent besserer Nutzen für normalen Wechsel |
| farming.elixirs | true | Bedarf/Equip/Erneuerung von Klassen-Elixieren |
| production.optimizeGear | true | Wirtschaftliche Alternativen, nur zusammen mit production.gear und autoGear |
| production.autoDisposition | true | Konservative automatische Regeln ausschließlich für nicht ausdrücklich geregelte Items |
| production.autoSellMaxValue | 100 | Obergrenze des Itemwerts für automatische NPC-Disposition |
| production.farmConfidence | p90 | Beschaffungsbudget mit P90 statt nur Erwartungszeit |
| merchant.marketMinSamples | 3 | Unabhängige Anbieter für Marktreferenz |
| merchant.mluckTravel | true | Sicherer Mluck-Anreiseauftrag |
| world.autoHop | true | Automatische Serverauswahl, zusätzlich serverHop, erlaubte Realms und belegte Registry erforderlich |

Neue Vorgaben ändern keine vorhandenen Gold-/Verlustbudgets, Preise, Schutzregeln, Charakterlisten oder expliziten Ziele. Autostart bleibt true. Dieselbe Botdatei auf allen Teamcharakteren verwenden.

## Entwicklungs- und Diagnosevertrag

Neue interne Module: core/priority, core/recovery, combat/threats, items/elixirs, production/intelligence, production/allocation, production/probability, world/team-plan, world/knowledge, world/content, world/servers. Kein Hostimport im Bot. Öffentliche ALBot-API und vorhandene Headless-API bleiben kompatibel; interne Module sind keine zusätzlich exportierten Spiel-Globals.

Status/Testbericht enthält teamPlan, economicIntelligence, gearAllocation, priority, recovery, contentQuarantine und threats. Ereignisse wie plan.selected/adopt/failed/drift, production.cancel/wait/intent.complete, content.quarantine/release und recovery.confirmed/unresolved enthalten den Entscheidungsgrund. Fortlaufende Logs behalten Charakter, UTC-Start und Teilnummer. Browser-Downloads bzw. Ordnerfreigabe und Headless-Desktopausgabe bleiben wie in VOLLBETRIEB.md beschrieben.

Optional kann eine vorhandene Quelle globalThis.ALBotServerRegistry als Array mit {realm, mode, online, at, players} bereitstellen. mode: NORMAL/PVP/HARDCORE/TEST/DUNGEON, online muss ausdrücklich bestätigt und at eine UTC-Zeit in Millisekunden sein. Ohne Adapterquelle wird parent.X.servers gelesen, aber fehlende Modus-/Online-/Besatzinformationen werden nicht ergänzt oder geraten. Es wird kein eigener Serverpoller gestartet.

## Gemeinsamer Livetest

Alle Charaktere mit dem aktuellen identischen JS neu laden. Beobachten: gemeinsame Plangeneration/Monstertyp, sichere Gruppenbildung, Materialbedarf → gemeinsame Beschaffung → Merchant-Receipt → Produktion → Zielcharakter, Elixiererneuerung, Gearlieferung, Merchant-Fairness und Neustart. Ein vorhandener ungeklärter Wertcheckpoint muss zunächst anhand tatsächlicher Bestände geprüft werden; nicht zur Testvorbereitung pauschal löschen.

Aktuelle Offlineprüfungen umfassen außerdem das fertige klassische Bundle in Browser-/Headless-Umgebung, echte Zielauswahl bis zum Attack-Aufruf, persistente Materialplanung und Ledger, Quantile, Quellen-/Serverfrische, Rollen, Risikofilter, Wirtschaftlichkeit und Profilmigration. Keine Shadow-Tests und kein automatischer Spiel-Login. Linux und neuer gemeinsamer Livebetrieb bleiben unbestätigt.

Ergebnis der gezielten Offlineprüfung: **141 Prüfungen bestanden**, klassisches Standardbundle **238.795 UTF-8-Bytes** bei 1.048.576 Byte harter Grenze. Keine Aussage eines Live- oder Linux-Nachweises.
