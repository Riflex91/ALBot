# ALBot 0.54.0-candidate — Offline-Zertifizierung (24.10.2026)

## Freigegebener Code und signierter Kanal
- Entwicklungs- und Fix-PR: [#479](https://github.com/Riflex91/ALBot/pull/479), nach [Linux-/Windows-CI #40116429438](https://github.com/Riflex91/ALBot/actions/runs/40116429438) in `main` gemergt: `28c481e4c42d040fc7ad689a3d82cfa38e7df31f`.
- Deterministische kryptografische Negativprüfung: [#481](https://github.com/Riflex91/ALBot/pull/481), nach [Linux-/Windows-CI #40116773884](https://github.com/Riflex91/ALBot/actions/runs/40116773884) in `main` gemergt: `bf6942ed91bbb4a29efede7c91852f8ee1d222c6`.
- Geschützter Signierkanal: `codex/w00-w01-readonly-disposition-20261018`.
- Releaseanforderung: `2b44d0e739397d323d6cdf7988a68e0491365c9a`.
- Veröffentlichter, ECDSA-P-256-signierter Release-Commit: `cbcb18a7f8b9c67da3ca73c9c24ab8c2410925bc`.
- Die 0.53-Vorgängersignatur blieb für die signierte Versions- und Sequenzsteigerung erhalten.

## Exakte technische Prüfergebnisse
- [Geschützter Signierworkflow #40117020642](https://github.com/Riflex91/ALBot/actions/runs/40117020642): **2634/2634 Offline-Tests**, 0 Fehler; persönlicher CODE-Konfigurationsabschnitt unverändert; `npm run sign:release` und `npm run verify:release` erfolgreich.
- Runtime-Version: **0.54.0-candidate**; signierte Sequence: **54**.
- Runtime-Bytezahl: **1005098**.
- SHA-256: `69977528620eeb209edbbb0e25fee1bcaa5167e060469ee4352faed942a2a747`.
- Git-Blob der Runtime in `main` und im signierten Release-Branch: `b651f52a5c52683d450922c63bde40d5b050bef6` — identische veröffentlichte Runtime.
- [Signiertes Manifest](https://github.com/Riflex91/ALBot/blob/codex/w00-w01-readonly-disposition-20261018/dist/albot.release.json) und [Runtime](https://github.com/Riflex91/ALBot/blob/codex/w00-w01-readonly-disposition-20261018/dist/albot.runtime.js).

## Verhaltenskorrekturen
- Ein verifizierter nativer Farm-Transit wird nicht durch den bloßen Hinweis `endangeredPeer` zu stationärem gefährlichem Notwehrkampf umgewidmet; der Priest kann weiterhin in Reichweite heilen.
- Während ein bestätigtes Farmziel noch nicht erreicht ist, werden offensive Angriffe auf Weggegner unterdrückt. Bei nachgewiesener physischer Blockierung bleibt die defensive Flucht- und Überlebenslogik zuständig; keine unbewiesene Weiterfahrt durch Hindernisse.
- Gesunde, frische Teammitglieder, die nachweislich auf derselben Route vorankommen, erhalten begrenzte Leinen-Toleranz statt ständigen Leader-Stopps. Echte Trennung, tote/stale Teammitglieder und fehlende Fortschritte bleiben Sperrbedingungen.
- Der Merchant darf entfernte NPC-Standorte anhand des offiziellen `G.maps`-Katalogs als Wegziel auflösen, wenn `find_npc` lokal keinen Standort liefert. Das ist **kein Beleg für tatsächliches Warenangebot**; Item-Verfügbarkeit, Kaufbudget, freie Slots, Lieferjournal und bestätigte Übergabe werden weiter unabhängig geprüft.
- Regressionsprüfungen für Weg-Aggro, begrenzte Gruppenformation und Katalog-Zubehörpositionen; der bisher probabilistische Signaturfälschungstest wurde deterministisch gestaltet.

## Unveränderte Grenzen und offene Ingame-Prüfung
- Persönliche `globalThis.ALBotConfig` (einschließlich `world.risk=assertive` und `farming.maxCombatSeconds=45`), URLs des bestehenden V2-Loaders, gepinnter P-256 Public Key und signierter Kanal bleiben unverändert.
- Offline-Zertifizierung ist **kein** authentifizierter Ingame-Langzeittest. Todesfreiheit auf der zuvor beobachteten `bigbird`-Strecke und physisch bestätigte Lieferung/Anlegen von Ohrringen und Umhängen aller Farmer sind im Live-Spiel noch **nicht nachgewiesen**.
- Ein nicht nachgewiesener NPC-/Marktbestand wird weiterhin niemals als Lieferung, tatsächlicher Kauf oder verfügbare Ware behauptet.
