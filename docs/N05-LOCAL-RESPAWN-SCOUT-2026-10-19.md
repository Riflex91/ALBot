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

## Aktive Teilstufe: einmaliger lokaler Solo-Scout-Hopp (19.10.2026)

Die bisher passive N05-Beobachtung darf erstmals **genau eine kurze lokale Bewegung** versuchen, **aber nur innerhalb eines bereits von TeamPlan unabhängig genehmigten gewöhnlichen Farmspawns**. Der vorhandene TeamPlan-Movement-Einstieg ruft diese Option erst auf, nachdem der Farmer die reguläre Farmankermitte bereits erreicht hat. Es entsteht kein zweiter Pathfinder.

Verbindliche Bedingungen:

- **Nur Solo-Farmer und eigener Leader** (`party.enabled=false`, keine zusätzlichen gelisteten Farmer); gemeinsame Märsche werden nicht durch eigenständige Scoutbewegung überholt.
- Ein aktueller `farm`-Plan ohne Material-/Hunt-/Elixir-Sonderauftrag muss von `teamPlan.valid`, `teamPlan.allowed` und `strategy.permittedMap` weiterhin ausdrücklich bestätigt sein. Kein PvP, keine Instanzänderung, kein neuer Monster-Typ oder neuer Spawn.
- Der tatsächlich lokal selbst getötete Monsterbeleg muss **innerhalb der vergangenen fünf Minuten** mindestens eine **frische** negative Sichtung aus einer vollständigen Monsterliste aufweisen; maximal zwölf negative Proben. Ein altes persistiertes Killereignis darf keinen neuen Hopp auslösen.
- Nur eine bekannte Monsterkoordinate **mit mindestens zehn Einheiten Innenabstand in den genehmigten Spawn-Grenzen** ist zulässig. Die Figur bleibt höchstens 65 Einheiten vom genehmigten Farmanker entfernt; Scoutpunkt höchstens 70 Einheiten. Der Hopp selbst darf nur **45 bis 95 Einheiten** betragen; `can_move_to` muss am echten aktuellen Ort Erfolg melden.
- Keine offene Value-Transaktion, Inventar-/Logistik-Reservation, andere Bewegung, Quest/Reiseaktivität, Kampfaggro oder aktive Combat-Notlage; mindestens 90 % lokale Gesundheit. Bei unsicherem Kontext wird kein Hopp gestartet.
- Jeder eigene Killbeleg kann **höchstens einen Hopp** auslösen, ohne automatische Wiederholung. Währenddessen prüfen die bereits laufenden N05-Samples die Freigabe bei jedem Tick erneut; bei Session-/Realm-/Zielplanwechsel, neuem Kampf, niedriger HP oder nach zwölf Sekunden wird die eigene `scout`-Bewegung gestoppt.
- `respawn.localScoutHop` dokumentiert einen Bewegungsversuch. **Die Bewegung ist weder ein bewiesener Respawn noch ein garantierter Reiseerfolg.** N05 bleibt ohne eigenständige Kampf- oder Respawn-Zeitfreigabe.

Die weiter oben dokumentierte Aussage »keine autonomen Scout-Reisen« bleibt für **kartenübergreifende, gruppengeführte oder spekulative Scout-Ziele** weiterhin gültig. Dieses Inkrement fügt lediglich einen lokal genehmigten Solo-Hopp hinzu. Signierter Ingame-Release, persönliche Einstellungen und Live-Abnahme bleiben getrennt.

## Bewegungsbeleg nach dem lokalen Hopp

Ein `movement.local(...,'scout')`-Aufruf belegt lediglich die **Annahme eines lokalen Bewegungsauftrags**, nicht die physische Ankunft oder gar den Respawn eines Monsters. N05 veröffentlicht daher im Status `respawns.localScoutHop` einen flüchtigen, rein diagnostischen Einmalbeleg mit `state='in-flight'`.

Wenn der Bewegungsauftrag verschwindet, wird `local-arrival-observed` nur mit **aktueller eigener physischer Position** innerhalb von zwölf Einheiten des genehmigten Punkts, unveränderter Realm-/Sessionbindung, demselben weiterhin gültigen Farmplan und unverändert gültigem lokalem Killbeleg gesetzt. Ein verschwundener oder durch fremde Bewegung ersetzter Auftrag ohne diese unmittelbare Beobachtung bleibt `outcome-unverified`. Ein durch die Sicherheitskontrolle gestoppter eigener Hopp wird `safety-aborted` bzw. `timeout-aborted`; er wird **nicht** nochmals automatisch versucht. Das Ereignis `respawn.localScoutOutcome` und der Status sind ausschließlich Audit-/Diagnostikquellen.

Ein Session- oder Realmwechsel löscht flüchtige Scout-Abschlussdaten, statt sie in einer neuen Laufzeit künstlich zu bestätigen. **Kein Zustand bedeutet eine Monster-Respawn-Quittung, einen Farm-/Looterfolg oder eine neue Berechtigung für weitere Wege.**

## Native Direktroute und laufende Freigabekontrolle (Folgeinkrement)

Der lokale N05-Scoutauftrag ist ab jetzt **ausnahmslos ein nativer geradliniger `move`-Befehl**. Ein Scout-Hop darf **nie** auf `smart_move` oder `blink` zurückfallen, falls sich der lokale Kollisionsnachweis zwischen Planentscheidung und tatsächlichem Dispatch ändert. Auch ein direkter Aufruf der generischen Bewegungsroutine mit Owner `scout` wird bei anderem Map-/Instanzkontext oder einer Strecke über 95 Einheiten ohne Ausführung abgewiesen. Normale Farm-, Quest- und Merchant-Routen behalten ihre bisherigen Routing-Fallbacks.

Die laufende Scoutbewegung wird bei jedem N05-Tick zusätzlich gegen den exakten autorisierten Zielpunkt sowie `order.mode === 'move'` geprüft. Ein fremder oder veränderter Modus, verschobene Koordinaten, neue PvP-Map-Eigenschaften, fehlende Monsterfreigabe oder widerrufene Map-Freigabe stoppen ausschließlich den eigenen Scoutauftrag als `safety-aborted`. Ein abgebrochener Hopp bleibt eine verbrauchte Einmalberechtigung: kein Wiederholungsversuch, keine neue Fernreise oder Monsterjagd, kein Respawnnachweis.

Offline-Regressionstests prüfen den letzten fehlgeschlagenen `can_move_to`-Recheck, unverändertes herkömmliches Smart-Routing, die reine Direktroute und laufende Sicherheitswiderrufe. Der signierte Bootstrap-Release und persönliche Einstellungen bleiben unverändert.

## Vollständige lokale Spawnflächen-Begrenzung (Folgeinkrement)

Die freigegebene N05-Solo-Direktroute muss **vollständig innerhalb** der vom bestehenden Farmplan genehmigten rechteckigen Spawnfläche liegen, jeweils mit einem Sicherheitsrand von mindestens zehn Einheiten. Es reicht nicht mehr, dass nur der Zielpunkt in diesem Bereich liegt: Auch die *aktuelle Ausgangsposition* muss denselben Rand erfüllen. Weil das Rechteck konvex ist und der Scout ausschließlich einen nativen geradlinigen `move`-Befehl nutzt, liegt bei zwei zulässigen Endpunkten die ganze geplante Strecke innerhalb dieser genehmigten Innenfläche. Ungültige, zu schmale, umgedrehte oder mapfremde Grenzen werden abgelehnt.

Während eines eigenen laufenden Scout-Auftrags prüft N05 erneut die **aktuelle physische Charakterposition** und den genehmigten Zielpunkt gegen diese Grenzen. Eine unerwartete Positionsabweichung oder eine Verkleinerung der genehmigten Spawnfläche beendet den Hopp sicherheitsbedingt und verbraucht die Einmalfreigabe. Ein verschwundener Bewegungsauftrag kann nur als `local-arrival-observed` gelten, wenn die aktuelle Endposition und der ursprünglich genehmigte Scoutpunkt weiterhin innerhalb der aktuellen zulässigen Spawnfläche liegen. Andernfalls bleibt das Ergebnis `outcome-unverified`.

Weiterhin keine Wanderung zu anderen Maps oder Spawns, keine Gruppen-Sonderreise, keine Respawnvorhersage und keine automatische Wiederholung.

## Erneute N05-Freigabe zum tatsächlichen Dispatch-Zeitpunkt

Die Bot-Aktionsausführung kann eine Bewegung zunächst nur in einem Frame vormerken. Die ursprüngliche N05-Planprüfung allein schützt daher nicht vor **Freigabeänderungen zwischen Reservierung und dem späteren nativen `move`-Aufruf**.

Jeder Scout-Bewegungsauftrag führt jetzt eine flüchtige, an Session, Realm, genehmigte Plan-ID, konkrete Monster-ID, Kill-Zeitstempel und exakten Zielpunkt gebundene Dispatch-Freigabe mit sich. Der Executor prüft diese Freigabe unmittelbar beim tatsächlichen Ausführen erneut: aktuelle Solo- und Team-/Kampfsicherheit, gültiger Farmplan, Map-/Monsterfreigabe, HP und Auftragssperren, weiterhin frische negative Sichtung, genehmigte Spawn-Innenfläche und unveränderte reale Geometrie. Gleichzeitig wird der letzte `can_move_to`-Nachweis erneut eingeholt. Fehlt eine Bedingung, gibt es **keinen** nativen `move`-Aufruf.

Direkte `go(..., 'scout')`- oder `local(..., 'scout')`-Aufrufe ohne eine solche aktive Freigabefunktion bleiben gesperrt. Das allgemeine Bewegungsverhalten von Farm-, Quest- und Merchant-Aktionen bleibt unverändert. Ein vorgemerkter, später widerrufener Scout-Hopp bleibt **ohne automatische Wiederholung**. Der Status unterscheidet weiterhin angeforderte/ungeklärte Bewegung von physisch belegter Ankunft; daraus entsteht kein Respawnbeweis.

## Konfliktschutz mit nativ bereits laufenden Bewegungen

ALBot kann eine native Bewegung oder eine noch laufende Smart-Move-Suche auch dann vorfinden, wenn der interne Bewegungsauftrag (`movement.order`) leer ist. Der enge lokale N05-Solo-Hopp darf eine solche fremde bzw. noch nicht zuordenbare Bewegung **nicht überlagern**. Deshalb liest `movement.nativeBusy()` sowohl `character.moving` als auch die Statusinformationen von `root.smart` und `parent.smart` (`moving`/`searching`).

Scout-Planung wird bei nativer Aktivität gesperrt. Die unmittelbar vor dem **echten** `move`-Aufruf geprüfte Frame-Freigabe führt denselben Check nochmals aus: Beginnt zwischen Vormerkung und Ausführung eine externe Bewegung oder Smart-Route-Suche, wird **kein Scout-`move`** gesendet. Alle üblichen Farm-/Quest-/Merchant-Routen behalten ihre bisherige Bewegungsarbitrierung. Die neue Schranke erlaubt weder weiteres Scoutsuchen, neue Monster noch einen Replay-Versuch nach abgebrochener Genehmigung.

Diese Regressionstests sind Offline-Nachweise, keine Ingame-Beobachtung. Signierter Bootstrap und persönliche Konfiguration bleiben unverändert.
