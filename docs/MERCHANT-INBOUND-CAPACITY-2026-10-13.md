# Merchant-Kapazität: Receive-Preflight (13.10.2026)

## Bezug zum Implementierungsauftrag
Quelle: hochgeladenes `ALBot-Implementierungsauftrag-fuer-KI.md`, Paket B (§4.1, §4.3, §4.8, §4.10). Ausgangsbefund: My_Merchant konnte bei vollem Inventar trotz nominell erlaubter Transfers keine weiteren Einheiten aufnehmen. PR #41 hat reversible Bankentlastung und Kapazitätshysterese ergänzt.

## Diese Ergänzung (Paket B, Teilmaßnahme)
`src/items/logistics.mjs` begrenzt nun die quittierte `accept.quantity` anhand eines konkreten **physischen** Live-Inventars, des geladenen `G.items[item].s` und der exakten Itemidentität. Bereits identische kompatible ungeschützte Stacks liefern begrenzte Restkapazität. Für einen einzelnen `send_item`-Auftrag wird maximal ein zusätzlicher leerer Slot als nutzbar angerechnet; mehrere leere Plätze implizieren **keine** garantierte serverseitige Multi-Stack-Einlagerung.

Bei laufender Merchant-Kapazitätsentlastung werden neue, gewöhnliche Loot-Eingänge auf vorhandene passende Stapelplätze beschränkt; priorisierte bestätigte Gear-/Elixierzustellungen bleiben innerhalb realer physischer Kapazität möglich. Ein fehlendes Spielitem in bekanntem Live-G ergibt Kapazität null, nicht eine optimistische Annahme. `logistics.receiveCapacity` erklärt zurückgestellte Angebote. Die vorhandenen Peer-/Session-/Journal- und Dispatchguards bleiben unverändert.

### Deterministische Fälle
- 42 belegte Slots, kompatibler Trankstapel 9998/9999: Annahme höchstens 1.
- 42 belegte Slots, nur inkompatible/besonders geschützte Stapel: Annahme 0, kein neues Empfangsjournal.
- Ein echter freier Slot: ein neuer Standalone-Stack möglich, niemals mehr als der gültige Stack-Cap.
- Kein garantierter Erfolg: endgültige Bestandsänderung und beidseitige Quittungen müssen weiterhin beobachtet werden.

## Grenzen / verbleibende Abnahme
Ein `accept` reserviert in Adventure Land keinen serverseitig atomaren Platz. Die interne Journal-/Sessionprüfung verhindert ungesicherte Wiederholungen, nicht jede mögliche äußere Inventaränderung. Der vollständig vernetzte Paket-B-Betriebszustandsautomat, kombinierte Pack-/Tourplanung, echte Exchange-Ausgabeverteilung, Drucksteuerung beim Farmer, längere Überlastsimulation und Live-24h-Abnahme bleiben offen.

Die persönliche `globalThis.ALBotConfig` wird nicht angepasst. Runtime und persönliche `bot.js` müssen mit `npm run build` sowie `node scripts/sync-personal-code.mjs --write` auf dem Arbeitsbranch und anschließendem `--check` synchronisiert werden; CI erhält vor Merge wieder den ursprünglichen lesenden Workflow.
