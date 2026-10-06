# ALBot: Roadmap zum gemeinsamen Super-Bot

Stand: 6. Oktober 2026. **Werkstatt 2.0 und P1/P2-Testkandidat 0.1.2-live-a implementiert. Erster Browser-Teamlauf wegen voller Speicherung nicht bestanden; siehe [Auswertung](docs/LIVE-A-ERGEBNIS.md). Headless-Nachweis noch offen.**

Vorab aus P1/P3 umgesetzt: vollständiges schemaorientiertes Einstellungsmodell, lokale Oberfläche, Item-Katalog/Mehrfachbearbeitung, Regelvorschau, Konfliktprüfung, Profilimport/-export und fertiger Bot-Paket-Exportweg. Der Teilrelease konsumiert bereits das reduzierte Schema albot.live-a/v1; die übrigen Spielmodule folgen. Verbindlich: [Werkstatt-Vertrag](docs/WORKSHOP-CONTRACT.md). Das Schema kann neue Einstellungen liefern, ohne den Formulargenerator neu zu programmieren.

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
- [ ] Getrennte Farmer- und Merchant-Aktionen pro Item, aber ein gemeinsamer Regelsatz. Levelintervalle, Mengen, Eigenschaften, Schutzmerkmale und Reservierungen berücksichtigen.
- [x] Auflösen von Regelkonflikten mit verständlicher Anzeige „Diese Regel gewinnt, weil …“ in der Werkstatt. Identische Priorität und Filter sind für Live-A-Items bereits in der Spiellaufzeit eingebunden; weitere Aktionsphasen folgen. Die Vorschau ist kein Shadow-Testlauf.
- [ ] Loot-Abholung, Nachschub, Goldreserven, Zustellung an genauen Empfänger, Arbeitsvorrat und freie Inventarplätze.
- [ ] Bank ein-/auslagern, Gold, Packwahl, Zusammenlegen und begrenzte Kapazitätserweiterung nach explizitem Budget.
- [ ] NPC-Kauf/-Verkauf und Spielerhandel einschließlich Stand, Listings, Wishlist, Preisunter-/obergrenzen, Marktvergleich und Ponty.
- [ ] Mluck-Service, Merchant-Buffs und faire Task-Priorisierung. Lange Markt-/Merrit-/Gathering-Aufgaben dürfen notwendigen Nachschub nicht verdrängen.
- [ ] Wiederanlauf gleicht beobachtete Bestände ab; ein unklarer Transfer wird nicht blind erneut gesendet.

Fertig, wenn die lokale Oberfläche ein gültiges, vollständiges Bundle erzeugt und Farmer/Merchant dieselben Regeln anwenden. Logikprüfungen an Regelpriorität, Mengenreserven und Item-Identität; gemeinsamer Live-Termin folgt nach P4.

### P4 — Gear, Produktion und vollständige Merchant-Autonomie — Live-Test B

- [ ] Rollen-/Klassenbezogene Gear-Bewertung für aktive und offline bekannte eigene Charaktere, Zielausrüstung und Reservierungen.
- [ ] Upgrade und Compound mit Ziellevel, Scroll/Offering-Regeln, Verlustbudget, Goldreserve und Ergebnisabgleich.
- [ ] Exchange und Craft aus aktuellen Rezepten; Bedarf, Zutaten, Arbeitsplätze und Kapazität konsistent planen.
- [ ] v3-Produktionsgraph übernehmen: vorhandener Bestand → Bank → Kauf → Farmauftrag → Exchange/Craft/Upgrade/Compound → Lieferung. Rekursion/Zyklen und Mengen begrenzen.
- [ ] Beschaffung nach Kosten, erwarteter Farmzeit, Dropquelle und passender aktueller Gruppe; keine Erfolgswahrscheinlichkeit als Garantie darstellen.
- [ ] Fishing/Mining inklusive Werkzeugwechsel/-rückwechsel und sicherer Zone; Merrit, Teilnahme an Giveaways, geeignete Wishlist und begrenzte Schnäppchensuche.
- [ ] Auto-Optimierung berücksichtigt accountweite Ziele, aktuelle Preise und Verlustregeln. Alte Zahlen wie 150M/170M oder 80 Prozent werden veränderbare Profile, keine versteckten universellen Konstanten.

**Live B, ca. 15–20 Minuten:** mit kleinen festgelegten Mengen eine vollständige Kette durchspielen: Farmer sammelt → Merchant übernimmt → Bank/NPC → eine günstige freigegebene Verarbeitung → Lieferung. Gezielt eine Unterbrechung vor/nach einer normalen Übergabe und veränderten Inventarslot abgleichen. Teure/seltene Items werden nicht als Testmaterial verwendet. Erfolgsbeobachtung ist Pflicht, lange Einzelfreigabe-Zeremonien nicht.

Fertig, wenn fachliche Teilaktionen zu einer funktionierenden Auftragskette zusammenspielen und Regelkonflikte keine Verkäufe/Verarbeitungen gegen die Nutzervorgabe auslösen.

### P5 — Accountstrategie, Welt und adaptive Optimierung

- [ ] Teamwahl nach Aufgabe, realen Klassenfähigkeiten, Gear, Levelentwicklung, Catch-up und Überlebensfähigkeit. Charakterrotation mit stabilen Haltezeiten.
- [ ] Aktuelle Benutzerkonfiguration setzt Teamgrößen und erlaubte Charaktere; Spielservergrenzen bleiben maßgeblich. Der Headless-Client startet nur konfigurierte Namen.
- [ ] Event-/Boss-/Quest-Erkennung, Aktivitätswahl, Saisonaktionen, gefährliche Inhalte und Rückkehr zum normalen Farmziel.
- [ ] Paladin-Aurapolitik aus v3 ergänzen; in ALFinal ausdrücklich ausgelassene situationsabhängige Skills nur mit passender Fachregel integrieren, nicht wahllos auslösen.
- [ ] Serverwechsel mit Teamabgleich; Transport-/Bewegungsfunktionen wie Magiport nur bei vereinbarter Zuständigkeit und gültigem Ziel.
- [ ] Dynamische Spawn-/Karten-/Item-/Skilldaten aus `G` und Livezustand, kleine Caches invalidieren bei Änderung.
- [ ] Lern-/Rankingfunktionen aus den Vorgängern auf begrenzte interne Kennzahlen reduzieren: aktuelle Gruppeneffizienz, Reisezeit, Marktwerte. Deterministischer Rückfall, keine externen Modelle als notwendige Abhängigkeit.
- [ ] Versionsgebundener optionaler Updater: definierter sauberer Botstop, kein Update mitten in ungeklärter Wertaktion, Rückfall auf bekannten Stand. Kein eigener Prozesswatchdog.

Fertig, wenn diese Fähigkeiten in die bestehenden Planer und Aufträge passen. Kein zweiter Scheduler und kein separater „Autonomie-Bot“. Prüfung gemeinsam mit P6.

### P6 — Gesamtintegration, Größe und Freigabe — Live-Test C

- [ ] Jede Zeile der Funktionsmatrix ist einem Modul und einer Konfigurationsmöglichkeit zugeordnet. Übrige Lücken ausdrücklich nennen.
- [ ] Bundle minifizieren und UTF-8-Bytes einschließlich Konfiguration messen. Hartes Limit 1.048.576 Byte; Ziel maximal 921.600 Byte. Alte Gesamtbundles nicht einfach aneinanderhängen.
- [ ] Editor, Testwerkzeuge, Quellkarten, statische Komplettkopien von `G`, Telemetrie und Hostcode aus dem Runtime-Bundle halten. Funktionsumfang nicht heimlich kürzen, um das Limit zu erreichen.
- [ ] Ereignisbasierte Aktualisierung und getrennte Tickraten: Kampf häufig, Economy langsamer, Katalog-/Account-Neubewertung nur bei Änderung bzw. größeren Intervallen. Begrenzte Caches und keine offenen Timer nach Stop.
- [ ] Installation und Build unter Windows und Linux dokumentieren und tatsächlich verfügbare Plattformprüfungen ehrlich ausweisen.
- [ ] Kurze Benutzeranleitung, Beispielprofile, KI-API-Vertrag und Changelog ergänzen.

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

## 7. Übergabe an Live A

Testkandidat und Ablauf: [docs/LIVE-A.md](docs/LIVE-A.md). Build, Syntax, Paket-Hash, Größenlimit und 21 gezielte Tests bestanden. Darunter Kontextisolation, Stop/Reload, fehlende jsdom-Hilfsfunktionen, Item-Identität, Reserven sowie Annahme und beidseitiger Mengenabgleich einer Lieferung. Keine Shadow-Tests, kein echter Login, kein Live- oder Linux-Erfolg behauptet. P3-P6 bleiben offen. Die aktive Client-Konfiguration wurde nicht umgestellt.

### Live-A-Korrektur 0.1.1 (6. Oktober 2026)

Vom Nutzer gelieferte Screenshots belegen Browser-Goo-Kills und danach QuotaExceededError beim optionalen Konfigurationscache und Checkpoint. Test A ist damit begonnen, aber nicht bestanden. Repariert: keine komplette Configkopie mehr im Browserstorage, eigener kleiner Checkpoint mit Platzreserve, bei vollem Storage RAM-Abgleich für frische Verbräuche und weiterhin gesperrte Lieferungen. Keine fremden Speicherschlüssel gelöscht. Begrenzter Testbericht mit Browserdownload und optionaler Dateiausgabe durch Client 1.2.2; Anleitung in LIVE-A.md. 25 Bot-/Werkstatt-Tests und 30 Clienttests bestanden, darunter der konkrete Quota-Fall. Erneuter Browser-Lauf und Headless-Lauf stehen aus.
