# W10/W13 – Serverzuordnung und physische Bestätigung eigenen Truhen-Loots

Stand: 19.10.2026. Rein passive Belegschicht; **keine** neue Bewegung, Chest-Öffnung, Sendelogik, Markttransaktion oder automatische Kontoallokation.

## Serververtrag

Im fest überprüften Adventure-Land-Serverhandler `node/server.js`, `open_chest` (Zeilen ungefähr 11323–11605), erhält der Öffner bei Solo-Loot `socket.emit('chest_opened',r)`, bei Gruppenloot **jeder Gruppenempfänger** das entsprechende `chest_opened`-Resultat. `r.id` benennt die Truhe, `r.opener` den Öffner, `r.items[].looter` den **konkreten Empfänger** und `r.gold` den Goldanteil des jeweiligen Empfängers. Gruppenloot wird serverseitig verteilt. `r.items[].lostandfound` und `r.items[].looter=null` sind keine Bestätigung, dass ein eigener Charakter diesen Gegenstand erhalten hat.

Ein verschwundener Truheneintrag oder eine abgeschlossene `loot()`-Promise ist **kein** belastbarer physischer Empfangsbeleg. Der zuvor implementierte N04-Abreise-Timeout bleibt lediglich eine begrenzte Gelegenheit zum Einsammeln.

## Implementierung

- Der bestehende Runtime-Port kann das offizielle Socket-`chest_opened` **nur lesend** abonnieren und beim Dispose abmelden. Keine nachgebildete Headless-API und kein zusätzlicher Spielaufruf.
- Vor einem vorhandenen, durch ALBot ausgelösten `loot()`-Aufruf wird ein zeitlich begrenzter Bestands-/Gold-Snapshot für die aktuell sichtbaren passenden Truhen gespeichert. `loot(id)` ist gezielt; `loot(true)` (Commander-Kontext) begründet ausdrücklich **keine** eigene Ausgangsbasis.
- Aus der tatsächlichen Serverantwort werden nur dem eigenen Namen zugeordnete Itemmengen plus die **eigene** Goldzuweisung extrahiert. Verlorene oder fremd zugewiesene Gegenstände werden nicht als eigenes Loot gezählt. Unbekannte Itemdefinitionen, zu große Werte oder fehlende ID sind keine Quittung.
- Physisch bestätigt wird erst nach unverändertem Realm/Session und innerhalb von **3,5 Sekunden**, wenn der gesamte Inventar-Variantenbestand **genau** um die serverseitig zugewiesenen Mengen zunimmt, keine fremden Varianten sich ändern und das Gold exakt um den zugewiesenen Betrag steigt. Offenes Wertjournal, gesperrtes Inventar und laufende Transfers verhindern die Bestätigung. Das serverseitige `src`-Feld ist dabei keine neue Itemvariante.
- Ohne eindeutigen Snapshot bleibt der Eingang `server-attributed-unverified`; auch nach Zeitablauf wird er nicht als eigener physischer Zugang gemeldet. Höchstens 16 offene Belege, 64 letzte Diagnosen, sechs Stunden Rückschau. Realm-/Sessionwechsel verwerfen offene Baselines.
- `ALBot.status().lootReceipts` und Testreport zeigen die Zustände. Der Teamheartbeat kann höchstens die letzten zwei **physisch bestätigten** Belege transportieren. Diese optionale Diagnostik wird **vor** unverzichtbaren Status- und Materialfeldern gekürzt, wenn die bestehende 4200-Zeichen-Grenze überschritten würde.

**Autorisierungsgrenze:** Die Belege sind ausschließlich Diagnose (`dispatchAuthorized:false`). Sie vergeben keine Itemregeln, überschreiben keine Reserven, lösen keine Empfängerwahl oder Itemsendung aus und gelten nicht als Abschluss einer Account-Rewardsmission. W10/W13 vollständig und W14-Liveabnahme bleiben offen.
