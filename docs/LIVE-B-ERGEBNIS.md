# Live B – Ergebnisstand

Stand 7. Oktober 2026.

## Schritt 01 – Abholung – bestanden

Browserlauf mit `0.2.0-live-b`. `My_Ranger2` sendete zwei `gslime` an `My_Merchant`; Sender und Empfänger meldeten die wertverändernde Aktion jeweils als `confirmed`. Der Merchant hatte anschließend genau zwei `gslime` im Inventar. Ein paralleles Angebot von Ranger 1 lief aus, nachdem der Zielbestand bereits durch Ranger 2 erfüllt war; es entstand keine ungeklärte Inventaraktion.

## Schritt 02 – Bank – mit 0.2.0 nicht bestanden

Das Profil enthielt die korrekte Merchant-Regel `gslime -> bank`, Pack `items0`, Batch 2 und `maxActions: 1`. Während des Browserlaufs blieb der Teststapel jedoch im Merchant-Inventar. Es gab keine `inventory.intent`-/`inventory.result`-Bankaktion und keine Fahrt zur Bank.

Ursache: `src/combat/farmer.mjs` führte auch für die Merchant-Rolle zuerst den normalen Lootpfad aus. Loot reserviert die Executor-Ressource `inventory`. Der Scheduler ruft den Merchant-Controller unmittelbar danach am Economy-Tick auf; dessen Schutz `exec.busy('inventory')` brach deshalb wiederholt ab. Im Bericht startete der Merchant ungefähr alle zwei Sekunden ausschließlich Loot und blieb mit Grund `Merchant bereit` auf der Farmposition.

## Korrektur 0.2.1-live-b

Der Merchant-Ausstieg im Farmer-Controller liegt nun direkt hinter `recover()` und vor Farmer-Loot. Dadurch behält der Merchant Tod/Respawn, HP/MP-Recovery und Trank-/Regenlogik, beansprucht aber nicht mehr die Farmer-Loot-Inventarressource. Merchant-Bank/NPC/Produktion kann damit am Economy-Tick planen und dispatchen.

Ein Regressionstest stellt sicher, dass ein Live-B-Merchant selbst bei `farming.loot=true` keinen Farmer-Loot startet. Die vorhandenen Banktests prüfen weiterhin `bank_store`, beidseitige Beobachtung und Schutz geänderter/gesperrter Slots.

## Nächster Live-Schritt

**Nur Schritt 02 mit `0.2.1-live-b` wiederholen.** Erwartung: Merchant fährt zur Bank, genau zwei `gslime` verschwinden aus dem Inventar und erscheinen in `items0`; `inventory.intent` und `inventory.result: confirmed` für `bank.store`; anschließend `pending: 0`, `journal: null`, `inventoryBlocked: false`.

Erst nach diesem Nachweis mit Schritt 03 `03-bank-npc.js` fortfahren.
