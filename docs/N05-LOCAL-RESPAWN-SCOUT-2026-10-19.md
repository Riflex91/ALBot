# N05 – endlich begrenzter lokaler Respawn-Scout (19.10.2026)

## Implementierter Zwischenschritt

Der bestehende passive, an Realm und Instanz gebundene Respawnkalender kann nach einem **physisch beobachteten eigenen Kill** einen kleinen lokalen Scout-Beleg sammeln:

- Maximal **fünf Minuten** ab dem lokalen Killbeleg.
- Maximal **zwölf** negative, mindestens 1,5 Sekunden auseinanderliegende lokale Sichtbarkeitsproben.
- Nur bei unverändertem Server-Realm, identischer Map und Instanz und höchstens **650 Einheiten** Abstand zum ursprünglichen Ort.
- Ein negatives Sichtbarkeitsergebnis ist **weder Tod noch endgültige Abwesenheit**; der Beleg erteilt keine Kampf-, Reise- oder Respawn-Genehmigung.
- Eine erneute lebende Sichtung derselben Monster-ID und desselben Typs *nach mindestens einer negativen Probe* wird als `live-resighting-observed` markiert, **nicht** als serverseitig verifizierter Respawnzeitpunkt. Ein alter weiterhin sichtbarer Kill-Snapshot erzeugt keine Neusichtung.
- Alle Zeitfenster laufen ab; nach zwölf negativen Proben oder fünf Minuten werden weitere lokale Scout-Zählungen gestoppt.
- Der bestehende Persistenzvertrag für Kill-/Sichtungsbelege bleibt unverändert. Nach Neustart dürfen gespeicherte Kills **kein neues Scoutfenster** beginnen. Bei Realmwechsel werden alle flüchtigen Sichtungsbelege gelöscht.
- `ALBot.status().respawns.rows[].scout` liefert einen **rein diagnostischen** Status. `executable=false` und `respawnAt=null` bleiben ausdrücklich erhalten.

## Nicht implementiert / weiterhin offen

Ein reisender autonomer Scout benötigt zusätzliche serverseitig belastbare Spawnmetadaten, eine genehmigte Ziel-/Map-Liste, Team- und Kampfbereitschaft, Reisebudget und robuste negative Vor-Ort-Belege. Dieses Paket **autorisiert keinen** neuen Wegpunkt, keine neue Monster-ID, kein Server-Hopping, keine Temporal-Orb-Nutzung und keinen Kampf anhand von Kalenderdaten.

Es wurden nur Offline-Regressionstests ergänzt. Es liegt keine Ingame-Liveabnahme vor, und der separate signierte Bootstrap-Release wurde nicht geändert.
