# Live B – Ergebnisstand

Stand 7. Oktober 2026.

## Gesamtstatus – bestanden

**Live B ist mit `0.2.2-live-b` in Browser und Windows-Headless vollständig bestanden.** Die vierteilige Kette wurde mit beobachteten Wertaktionen und sauberen Endzuständen nachgewiesen:

1. Farmer → Merchant: genau zwei `gslime` übertragen.
2. Merchant → Bank: genau zwei `gslime` per bestätigtem `bank.store` eingelagert.
3. Bank → NPC: genau zwei `gslime` per bestätigtem `bank.retrieve` entnommen und per bestätigtem `sell` verkauft.
4. Produktion/Lieferung: ein `helmet +0` wurde erfolgreich auf `+1` verarbeitet; die Lieferung an `My_Ranger1` wurde vollständig mit `offer → accept → send → receipt → done` bestätigt.

Bei den bestandenen Abschlussläufen endeten die beteiligten Charaktere ohne offene Wertaktion: `pending: 0`, `journal: null`, `inventoryBlocked: false`.

## Browser

### Schritt 01 – Abholung – bestanden

Der Browserlauf bestätigte die Übergabe von insgesamt zwei `gslime` an den Merchant. Sender und Empfänger bestätigten die Wertaktion; der Merchant hatte anschließend genau zwei Stück.

### Schritt 02 – Bank – bestanden nach 0.2.1-Korrektur

Der erste 0.2.0-Lauf wurde durch Merchant-Loot/Inventory-Starvation blockiert. `0.2.1-live-b` verschob den Merchant-Ausstieg im Farmer-Controller vor Farmer-Loot. Im Retest führte der Merchant genau ein bestätigtes `bank.store` für zwei `gslime` aus.

### Schritt 03 – Bank zu NPC – bestanden

Mit `0.2.1-live-b` entnahm der Merchant genau zwei `gslime` aus `items0`, reiste zurück nach `main` und verkaufte genau zwei Stück per bestätigtem `sell`. Danach lag kein `gslime` mehr im Merchant-Inventar.

### Schritt 04 – Upgrade und Lieferung – bestanden mit 0.2.2

Der 0.2.1-Lauf bestätigte Preview, Upgrade und Kauf, scheiterte aber beim Liefer-Handshake: das erste Offer wurde beim temporär beschäftigten Empfänger verworfen und lief aus. `0.2.2-live-b` wiederholt dasselbe Offer mit derselben ID innerhalb der kurzen Offer-Phase und verhindert zusätzlich unnötiges Nachkaufen des +0-Basisinputs, sobald das +1-Ziel erfüllt ist.

Der Browser-Retest mit 0.2.2 bestätigte anschließend die Lieferung: ein `helmet +1` wurde genau einmal gesendet, Ranger 1 nahm ihn an, und der Handshake endete ohne Timeout mit Receipt/Done.

## Windows-Headless

Alle Headless-Abschlussläufe verwendeten `0.2.2-live-b` und lokale IPC.

### Schritt 01 – Abholung – bestanden

Ein Farmer sendete genau zwei `gslime` an `My_Merchant`. Sender und Empfänger meldeten die Inventaränderung als `confirmed`; der Merchant endete mit genau zwei `gslime`. Der frühere Merchant-Loot-Pfad griff im Headless-Lauf nicht mehr.

### Schritt 02 – Bank – bestanden

Der Merchant fuhr zur Bank und führte genau ein `bank.store` für zwei `gslime` aus. Aktion und Inventarergebnis waren `confirmed`; anschließend war der Teststapel nicht mehr im Merchant-Inventar.

### Schritt 03 – Bank zu NPC – bestanden

Der Merchant führte genau ein bestätigtes `bank.retrieve` für zwei `gslime` aus, reiste nach `main` und verkaufte genau zwei Stück per bestätigtem `sell`. Danach war kein `gslime` mehr im Merchant-Inventar.

### Schritt 04 – Upgrade – bestanden

Der erste Headless-Schritt-04-Lauf bestätigte `production.preview` und genau einen `upgrade`-Versuch. Der Upgrade-Pfad endete `confirmed`. Eine Lieferung entstand in diesem Lauf absichtlich nicht, weil `My_Ranger1` noch einen `helmet +1` aus dem Browser-Test besaß und sein Zielbestand damit bereits erfüllt war.

### Schritt 04 – Lieferung – bestanden

Nach Entfernen des vorhandenen +1-Helms bei Ranger 1 wurde Schritt 04 erneut gestartet. Der Merchant meldete:

- `offersSent: 1`
- `acceptsReceived: 1`
- `sendsStarted: 1`
- `receiptsReceived: 1`
- `doneSent: 1`
- `timeouts: 0`

Die konkrete Wertaktion sendete genau einen `helmet +1` an `My_Ranger1` und endete `confirmed`. Ranger 1 meldete entsprechend `offersReceived: 1`, `acceptsSent: 1`, `receiptsSent: 1`, `doneReceived: 1`, `timeouts: 0`; sein Endinventar enthielt danach genau einen `helmet +1`.

## Korrekturen, die durch Live B bestätigt wurden

- `0.2.1`: Merchant-Farmer-Controller blockiert Bank-/Economy-Arbeit nicht mehr durch Farmer-Loot.
- `0.2.2`: Temporär nicht angenommene Offers werden mit derselben ID begrenzt erneut gesendet; dadurch entsteht kein zweiter Wertauftrag.
- `0.2.2`: Vor einem Retry werden Slot/Fingerprint und übertragbare Menge erneut geprüft.
- `0.2.2`: Ein erfülltes Upgrade-/Compound-Ziel unterdrückt unnötigen erneuten Erwerb des verbrauchten Basisinputs.

## Verbleibende Grenzen

Der bestandene Live-B-Testpunkt bedeutet **nicht**, dass P3/P4 vollständig fertig sind. Die in `docs/LIVE-B.md` und `ROADMAP.md` noch offenen Merchant-, Produktions-, Gear- und Langzeitfunktionen bleiben offen. Linux wurde für Live B noch nicht live geprüft.
