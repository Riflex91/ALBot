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

## Session-Schutz (Folgeinkrement)

Die lokale Kill-Sichtung und ihr flüchtiges Hit-Journal sind nun zusätzlich an die **konkrete laufende Bot-Session** gebunden. Wechselt die Session bei gleichem Realm, räumt der Kalender eigene kurzlebige Treffer-, Scout- und Sichtungsbelege vollständig ab; selbst bei anschließender Rückkehr in die ursprüngliche Session werden sie nicht neu freigeschaltet. Ein Server-Todesereignis aus der alten Session kann keinen Kill für die neue Session zertifizieren.

Fehlt eine gültige Session-ID, erzeugt N05 weder neue lokale Sichtungen noch einen eigenen Killbeleg. Der Status zeigt die aktuelle Session nur diagnostisch; der Kalender bleibt nicht ausführbar und erteilt weiterhin keine Reise- oder Kampfberechtigungen. Persistierte historische Killzeilen bleiben nach Neustart (unverändert zu oben) nicht zur Verlängerung eines Scoutfensters berechtigt.

## Folgeinkrement – Schutz gegen alte Monster-Renderdaten

Ein nach einem bestätigten Kill **immer noch als lebendig gerenderter** Eintrag derselben Monster-ID darf den gerade gespeicherten Killbeleg nicht löschen. Ein neuer Lebenszyklus dieser ID wird daher erst aus einer späteren, direkt und lokal beobachteten **Sichtungslücke** und einer neuen Lebendsichtung abgeleitet. Ein wiederholtes Hit-/Death-Ereignis, solange die vorherige Killmarkierung noch besteht, wird nicht erneut als Kill quittiert.

Auch nach dem Neustart gespeicherte historische Kills behalten diesen Schutz; eine danach lokal beobachtete negative Sichtung erlaubt später eine neue gewöhnliche Lebendsichtung, jedoch **keine neu gestartete Scout-Lease** und keine behauptete Respawnzeit. Die Beobachtung des Fehlens darf bei unbekannten oder nicht endlichen Charakterkoordinaten weder als positiv noch als negativ gewertet werden.

Dieses Paket bleibt vollständig passiv: kein Scout-Reisen, keine neuen Monsterfreigaben, keine Kampf- oder Respawn-Prognose und keine Änderung an der separat signierten Ingame-Runtime.

## Folgeinkrement – negative Sichtungsbelege nur aus vollständig gelesenen lokalen Snapshots

Die lokale N05-Abwesenheitsprobe darf nicht aus einer **abgeschnittenen** Monsterliste konstruiert werden. Der Kalender verarbeitet höchstens 128 Monster pro Tick. Wenn die gelieferte Liste länger ist, dürfen einzelne daraus direkt beobachtete positive Sichtungen weiterhin übernommen werden, es werden aber **keinerlei negative** Beobachtungen aus dem unvollständigen Ausschnitt abgeleitet. Dasselbe gilt bei fehlender oder formal ungültiger Monsterliste. Bei einer später wieder vollständig gelieferten Liste können neue lokale Negativproben normal fortgesetzt werden, sofern die bereits vorhandenen Zeit-, Session-, Realm- und Beobachtungsgrenzen noch gelten.

Auch eine vollständige lokale Liste ist ausschließlich begrenzte Sichtbarkeitsinformation, keine serverbestätigte Monsterabwesenheit, kein Respawntimer und keine Reise- oder Kampferlaubnis. Ingame-Release und persönliche Einstellungen bleiben unangetastet.
