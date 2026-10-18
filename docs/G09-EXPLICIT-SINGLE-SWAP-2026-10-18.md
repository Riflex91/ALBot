# G09 – begrenzter expliziter Einzelitem-Tausch

Stand 18.10.2026. **Nur Annahme bestehender sichtbarer `trade_swap`-Angebote**, kein neues automatisches `trade_offer`-Posting und keine Reiseplanung.

Das CODE-API `trade_swap(target, trade_slot, num)` übernimmt serverseitig das aktuell ausgewählte Inventaritem. Der Game-Server prüft `rid`, aktuelle Stand-Slot-Belegung, `trade_want_matches`, eine erneute physische Itemidentität und Empfängerkapazität. Ein `want.level` ist normalerweise **Mindestlevel**, kein exakt geforderter Level – ALBot akzeptiert vorerst nur denselben präzisen Level und genau **ein unstackbares Item je Seite**. Beide Seiten bleiben jeweils an tatsächliche Lagerkapazität und beidseitige Wertbelege gebunden.

## Erforderliche explizite Itemregel

Eine aktive Itemregel benötigt:
- `action:swap`, `role:merchant`, `character:<exakter aktiver Merchant>`, `item:<abgegebenes Item>`; `minLevel=maxLevel` exakt; `statType`, `property` und `title` passen **genau** zur abgegebenen Variante.
- `keep>=1`, `teamReserve>=0`, `batch=1`, `maxActions=1..5`. Der vorhandene `production.reservedQuantity`-Bruttobedarf bleibt vollständig geschützt; die letzte Kopie ist nicht verfügbar.
- `wantItem:<erhaltene ID>`, `wantLevel:<genaues Level>`, `wantQuantity=1`, `wantStatType`, `wantProperty` und `wantTitle` exakt (leer bedeutet **kein** Zusatz). `wantTargetCount>=1` begrenzt den bereits getragenen Zielbestand.
- `lossBudget` erlaubt höchstens den belegten Wertunterschied von Zahlung und Erhalt; die übrigen Account-/Stunden-Gold-, Verlust- und Recovery-Gates des bestehenden Executors werden **nicht** abgeschwächt.

Eigene/gebundene/verriegelte/unklare Itemvarianten werden verweigert. Nur ein aktuell sichtbarer, erreichbarer, fremder Charakter mit offenem Stand, gültiger `rid`, passender `listing.want` und tatsächlicher angebotener Gegenleistung kann einen Job erzeugen. Das vorhandene `economy.perform('market.swap')` reserviert und journalisiert die Wertwirkung vor Dispatch und prüft das Angebot unmittelbar erneut.

**Ergebnisnachweis:** Eine erfolgreich aufgelöste API-Promise genügt nicht. Es müssen der konkrete Rückgabe-Slot `num`, die dort erhaltene exakte Variante, der Rückgang der abgegebenen Variante um eins und der entsprechende Zugang nachweisbar übereinstimmen. Abweichende/mehrdeutige Ergebnisse bleiben in der vorhandenen Quarantäne ohne Auto-Wiederholung.

## Nicht umgesetzt

Nicht vorgesehen in diesem Inkrement: Tausch-Stand-Erstellung (`trade_offer`), gestapelte Angebote, andere als einfache Itemvarianten mit `data`/`acc`, fremde Zahlungsteilvarianten, Optimierung aus unbelegter Nachfrage, Reisen zu vermuteten Ständen oder Öffnen eigener Standplätze. Diese bleiben G09-Restpunkte. Automatische Release-Signierung und echter Live-Swap sind ebenfalls **nicht** erfolgt.

Serverbelege: `node/server.js:9099-9213` und `js/old_common_functions.js:494-516` sowie `js/runner_functions.js` im öffentlich belegten Adventure-Land-Repository.
