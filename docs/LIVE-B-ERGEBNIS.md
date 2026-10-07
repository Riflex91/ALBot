# Live B – Ergebnisstand

Stand 7. Oktober 2026.

## Schritt 01 – Abholung – bestanden

Browserlauf mit `0.2.0-live-b`. `My_Ranger2` sendete zwei `gslime` an `My_Merchant`; Sender und Empfänger meldeten die wertverändernde Aktion jeweils als `confirmed`. Der Merchant hatte anschließend genau zwei `gslime` im Inventar. Ein paralleles Angebot von Ranger 1 lief aus, nachdem der Zielbestand bereits erfüllt war; es entstand keine ungeklärte Inventaraktion.

## Schritt 02 – Bank – bestanden

Der erste Lauf mit `0.2.0-live-b` wurde durch Merchant-Loot/Inventory-Starvation blockiert. `0.2.1-live-b` verschob den Merchant-Ausstieg im Farmer-Controller vor Farmer-Loot. Im Retest fuhr der Merchant zur Bank und führte genau ein `bank.store` für zwei `gslime` aus; `inventory.intent`, Aktionsende und `inventory.result` waren bestätigt. Abschluss: `pending: 0`, `journal: null`, `inventoryBlocked: false`.

## Schritt 03 – Bank zu NPC – bestanden

Browserlauf mit `0.2.1-live-b`. Der Merchant entnahm genau zwei `gslime` aus `items0` per bestätigtem `bank.retrieve`, reiste zurück nach `main` und verkaufte genau zwei Stück per bestätigtem `sell`. Danach lag kein `gslime` mehr im Merchant-Inventar; keine offene Wertaktion blieb zurück.

## Schritt 04 – Upgrade und Lieferung – Produktionsanteil bestanden, Lieferung mit 0.2.1 nicht bestanden

`0.2.1-live-b` führte `production.preview` aus und bestätigte genau einen Upgradeversuch. Der Merchant besaß danach einen lieferbaren `helmet +1`. Die Logistik sendete ein Angebot an `My_Ranger1`; Ranger 1 registrierte das Angebot, sendete aber kein `accept`. Der Merchant meldete deshalb `offersSent: 1`, `acceptsReceived: 0`, `sendsStarted: 0`, `timeouts: 1`. Ranger 1 meldete `offersReceived: 1`, `acceptsSent: 0`. `send_item` wurde nicht gestartet.

Der Empfänger-Handler verwarf Offers bisher endgültig, wenn im Empfangsmoment unter anderem `inventory` belegt, ein Journal offen oder der Nähe-/Peerstatus noch nicht frisch war. Ein solcher temporärer Zustand wurde nicht an den Sender zurückgemeldet. Zusätzlich kaufte die Basisregel nach erfolgreichem Upgrade einen neuen +0-Helm nach, weil ihr lokaler Zielbestand wieder null war.

## Korrektur 0.2.2-live-b

- Solange ein Job noch im Zustand `offered` ist, sendet der Absender dasselbe Offer mit derselben ID in begrenzten Abständen erneut. Es entsteht kein neuer Wertauftrag und keine zweite Sendung. Nach `accept` gelten unverändert Fingerprint-, Mengen-, Nähe- und Inventarguards.
- Vor jedem Retry wird erneut geprüft, dass Slot/Fingerprint und übertragbare Menge noch passen. Ein verändertes Item wird nicht weiter angeboten.
- Erwerbsregeln `buy/retrieve/marketBuy/wishlist` werden übersprungen, wenn für denselben Basisinput eine passende Upgrade-/Compound-Regel existiert und deren Ziellevel/Zielmenge bereits erreicht ist. Damit kann ein fehlender +0-Helm vor der Verarbeitung beschafft werden, wird nach erfolgreichem +1 aber nicht sofort ersetzt.
- Gezielte Regression: erster Offer-Empfang bei belegter Inventarressource wird verworfen, Retry wird angenommen, exakt eine Sendung startet und kein Timeout entsteht. Zweite Regression: vorhandenes +1-Ziel unterdrückt Basis-Nachkauf; fehlt das Ziel, bleibt Erwerb erlaubt.

## Nächster Live-Schritt

**Nur `04-upgrade-lieferung.js` mit `0.2.2-live-b` wiederholen.** Vorher die Vorbereitung aus `docs/LIVE-B.md` herstellen: nur ein gewöhnlicher ungesperrter +0-Testhelm oder keiner beim Merchant; andere Helme sperren/einlagern; `My_Ranger1` darf keinen +1-Helm im Inventar haben.

Erfolg: höchstens ein Kauf je Regel, ein Upgradeversuch, danach vollständiger Handshake `offer → accept → send → receipt → done`; Sender und Empfänger bestätigen die Wertaktion, der +1-Helm liegt bei `My_Ranger1`, und alle Charaktere enden mit `pending: 0`, `journal: null`, `inventoryBlocked: false`.

Erst dann ist die vierteilige Browser-Live-B-Kette vollständig bestanden.
