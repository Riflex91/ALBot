# G12 – De-Statting nur aus ausdrücklich freigegebenem Überschuss

Stand: 18.10.2026, Implementierung ausgehend von PR #179.

Die Adventure-Land-Server-API `destat` am Scrollsmith in `desertland` entfernt `stat_type`, zieht Gold ab und erstattet **[1,10,100,1000,9999,...]** Scrolls nach dem *ursprünglichen* Grade (nicht dem aktuellen Upgrade-Level). Es gibt keine unabhängige `destat(...,calculate=true)`-Vorschau im belegten Serververtrag. Deshalb leitet ALBot die Gebühr aus live `item_grade({name,level:0})` und dem aktuellen Stat-Scroll-Katalogpreis ab und akzeptiert die Mutation erst nach einer exakten Serverquittung **plus** physisch belegten Änderungen.

## Ausdrückliche, minimale Freigabe

Eine **aktive** Itemregel muss genau `action=destat`, `role=merchant`, `character=<eigener Merchant>`, `item=<ID>`, `statType=str|int|dex|vit` und **`minLevel=maxLevel=<genauer Level>`** nennen. Außerdem:

- `keep >= 1`, `maxActions = 1..20`, `batch >= 1`, `teamReserve >= 0`.
- `goldBudget` muss die **gesamte** Scrollsmith-Gebühr tragen; `lossBudget` muss eine mögliche Wertverschlechterung abdecken. Alle bisherigen Hourly-/Account-Budget-/Verlustsperren bleiben erhalten.
- Es muss mindestens **eine zusätzliche physische identische Stat-Variante über** `keep + teamReserve + reservedQuantity` hinaus vorhanden sein. Kein gesperrtes, gebundenes, versiegeltes oder ausgerüstetes Item.
- Besteht ein aktives Gearziel desselben Items und Levels, bleibt die gesamte Umwandlung für diesen Typ gesperrt.
- Eine echte Rückgabekapazität für **alle** Scrolls ist erforderlich; vorhandene Stapel sind nur mit geprüfter Metadatenkapazität anrechenbar.
- Der bereits vorhandene gemeinsame Executor führt über `economy.perform('destat')` mit Journal, unmittelbar erneuerten Fingerprints, Policy-, Mengen-, Kapazitäts- und Budgetprüfungen aus.

Ohne diese enge Regel erfolgt **keine** De-Statting-Aktion. Der frühere N01-Stat-Tailoring-Pfad und seine expliziten Gearziele bleiben davon unabhängig. Kein automatisches Unlock, kein Unseal, keine Scroll-Nachbeschaffung und kein zusätzlicher Bot-/Serverprozess.

## Quittung und offene Verifikation

Bestätigung benötigt ein erfolgreiches Resultat mit genauer `num`, `cost`, `scroll`, `quantity`, den passenden Goldabzug, das unveränderte Item **ohne** `stat_type`, das Sinken des alten Variantenbestands um genau eins und den Zuwachs der zurückgegebenen Scrolls um genau die belegte Menge. Bei Fehler, Timeout oder widersprüchlicher Beobachtung bleibt die bestehende Quarantäne des Wertjournals wirksam, es erfolgt **keine** blinde Wiederholung.

Die vollständigen Offline-Tests belegen diese lokalen Verträge. Sie sind **kein** tatsächlicher Spiel-Livetest und keine Veröffentlichung im signierten Bootstrap-Kanal. G12 wird erst mit realen Receipt-/Kapazitätslogs live bestätigt.
