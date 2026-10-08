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
