# 0.7.0-full · integrierte Autonomie

Die im Audit zu 0.6.2 benannten fachlichen Ergänzungen sind mit dem bestehenden Vollbetrieb verbunden. Vollständige Zuordnung und Grenzen: [AUTONOMIE-0.7.0](AUTONOMIE-0.7.0.md).

- Gemeinsame sichere automatische Spawnwahl bis zu Reise/Angriff; offene Kandidaten, EXP/Gold, AoE-Dichte, Respawn/Reise, Standortdruck und Hysterese. Gold nutzt G.monster_gold/G.drops.gold und Lerndaten statt einer nicht vorhandenen Goldzeile in normalen Itemdrops.
- Persistente Materialabsicht mit Quellenbindung, Phasen/Teilnehmern, Mengenquoten, kontinuierlicher Werbung und beobachtetem Teamfortschritt. Event-/Questbedingungen, Ende und P50/P90 werden geprüft.
- Klassen-Elixierzyklen einschließlich Merchant, wirtschaftliche Gearalternativen/Ziellevel, physische Gearallokation, konservative gemeinsame Beutedisposition einschließlich begrenzter wirtschaftlicher Exchanges.
- Globale Aktionspriorität, Fähigkeiten-/Leaderwahl, Mehrgegner-Rückzug, frischer Threat/CC/Ownership-Ledger, Inhaltsquarantäne und strikt belegbare Recovery.
- Mluck-Anreise/Erneuerung; getrennte BUY/SELL-Marktgeschichte, Anbieteruntergrenze und Ask/Bid/Spread; sichere Verkäufe an Spieler-Wishlist; geprüfte Serverregistry/Wechselfenster und strategischer Tür-/Transportergraph.
- Dasselbe full/v1-Schema mit optionalen Vorgaben; alte Werte bleiben erhalten. Alter lokaler Werkstattentwurf erhält aktuelles Schema und Runtime. Kein Updater.

141 gezielte Prüfungen bestanden, einschließlich des fertigen Bundles in Browser-/Headless-Umgebung und echter Auswahl bis zum Attack-Aufruf. Standardbundle 238.795 UTF-8-Bytes, Grenze 1.048.576. Keine Shadow-Tests, kein automatischer Login. Gemeinsamer neuer Livetest und Linux weiterhin ausstehend. Persönliches Profil und vorherige Dateien werden vor Aktualisierung gesichert; bestehende Budgets, Regeln, Charaktere und autostart=true erhalten.
