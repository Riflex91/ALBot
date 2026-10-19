# W03 – Quote-gebundene Bankfinanzierung (19.10.2026)

## Befund und bereits vorhandenes Verhalten

`createMarket` konnte schon eine endliche, persistierte Bankreise für
`marketBuy` auslösen. `createBank.gold()` führt echte Goldentnahmen
ausschließlich über das bestehende Wertjournal `economy.perform('bank.gold')`
mit frischem Bankpack- und erneutem Verpflichtungsbeleg aus.

Die bislang persistierte `offerKey`-Zeichenkette wurde beim Zurückkehren zum
Markt jedoch **nicht** als verpflichtende Verkäufer-/Slot-/RID-/Preisbindung
verwendet: sobald die Wallet den Finanzierungsboden erreichte, wurde der
Checkpoint gelöscht und die nächste gewöhnliche Marktentscheidung durfte eine
andere Offerte wählen.

## Umsetzung

- Für neu ausgelöste **Live-Marktangebote** wird der Finanzierungsauftrag
  zusätzlich mit exakter `sellerId`, dem `trade1`–`trade16`-Slot,
  Server-`rid`, Einheitsgoldpreis und endlicher Menge gespeichert.
- Schon die Erstellung verlangt eine positive ganzzahlige Menge, einen
  gültigen Live-Seller-Identifier, erlaubten Slot und arithmetisch exakten
  `price * quantity = cost`.
- Auf dem Markt wird nach der Bankrückkehr die **gleiche sichtbare**
  Verkäuferfigur und genau dieses Angebot nochmals geprüft:
  Realm-/Map-Nähe, Live-Stand, RID, Preis, verbleibende Menge,
  Item-/Variantenidentität und vorhandene Zulassungsregeln.
- Der persistente Auftrag bleibt bis zur Übergabe an `market.buy` aktiv.
  Alternative Angebote erhalten **keine** Berechtigung aus der Bankreise.
  Eine ungültige, verschwundene oder abgelaufene Quote wird ohne Kauf
  zurückgestellt und mit `market.fundingBlocked` diagnostiziert.
- Erst wenn der normale Marktkauf die aktuellen Preis-/Inventar-/Budget-/
  Kapazitäts- und Liveguards bestehen kann, wird der Finanzierungscheckpoint
  *vor* dem Übergang zum vorhandenen `economy.perform('market.buy')` dauerhaft
  gelöscht. Misslingt das Löschen, erfolgt keine Übergabe. Ungewisse echte
  Kauf- oder Bankwirkung bleibt Sache der vorhandenen Wertjournale.
- Ein altes Finanzierungsschema ohne überprüfbare Seller-ID, Slot und RID
  liefert **keine** Bankgold-Berechtigung. Der alte Checkpoint wird ohne
  Kauf ausgeräumt (kein Replay).
- Die separate `ponty`-Sonderbeschaffung erhält bewusst nur ihren
  bestehenden Ablauf; sie wird **nicht** fälschlich als sichtbarer Player-Stand
  behandelt.

## Nicht verändert

Keine neue Käuferberechtigung, kein zusätzliches Kauf- oder Entnahmelimit,
keine Freigabe von Items, Bankreserven, eigenen Goldgeboten oder
Wertjournalen. Die persönliche Konfiguration, V2-Ingame-Loader-URL,
Signieridentität, Server-/Risk-/Cooldown-Gates und Broker-APIs bleiben
unverändert. Die Änderungen betreffen sowohl die gemeinsame Browser-/
Headless-Runtime als auch deren bestehende Vergleichsartefakte.

Die neue Testdatei deckt gültige Quote, Verkäufer-/Slot-/RID-/Preis-/
Mengenabweichung, alternative Offerte, Restart und fehlgeschlagene
Checkpointlöschung ab. Die Tests sind **Offline-Abnahmen**; kein
echter Ingame-Kauf ist dadurch belegt. Ein Merge ist kein signierter Release.
