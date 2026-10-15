# 0.10.8-candidate – Upgrade-Scrollwahl (15.10.2026)

Im Merchantlog vom 15.10.2026 wurde `pants` +4 → +5 mit `scroll0` wiederholt mit 60,86236 % gegenüber 70 % Mindestchance abgelehnt. Die Gear-Produktion suchte im Unterschied zur Gewinnproduktion keine alternative Scroll. Zusätzlich erkannte die Kaufanforderung irrtümlich `uscroll1` statt der tatsächlichen Item-ID `scroll1`.

Die globale Mindestchance des persönlichen Bots und der Vorgabewert neuer Full-Profile betragen auf Benutzerwunsch jetzt 65 %. Bestehende importierte Profile behalten ihre eigenen Werte; explizit strengere Itemregeln gelten weiterhin.

Bei Upgrades mit impliziter Standardschriftrolle, Grade 0 und ohne Offering prüft der Bot nach einer gültigen, aber unzureichenden scroll0-Servervorschau, ob scroll1 die Mindestchance erreichen kann. Er berechnet die höhere Scrollchance aus der Grundwahrscheinlichkeit der aktuellen Spieldaten und dem unveränderten Bonus der ursprünglichen Servervorschau: `min(beobachteteChance + Grundchance*0.2 + 0.01, Grundchance+0.36, Grundchance*3)`. Das ist ausschließlich ein Kaufnachweis. Fehlende Definitionen oder eine nicht eindeutig rekonstruierbare, bereits gedeckelte Ausgangschance erlauben keinen Kauf.

Vorhandene freie scroll1 werden verwendet; andernfalls wird genau eine über den vorhandenen NPC-Kaufpfad angefordert. Bei unveränderten Bedingungen ergeben die geloggten Werte 73,86236 %. Der echte Upgrade-Aufruf erfolgt erst nach einer frischen Servervorschau mit der tatsächlich vorhandenen scroll1, ausreichender Chance und allen bisherigen Wert-/Inventar-/Reserven-/Zahlungsfähigkeitsprüfungen. Ein geändertes Item oder eine geänderte Mindestchance verwirft die Kaufberechtigung auch vor verzögertem Dispatch. scroll2 wird nicht automatisch als nächste Eskalation gekauft. Feste Scroll-/Offeringregeln bleiben verbindlich; die bestehende wirtschaftliche Helferauswahl bleibt für Gewinnproduktion zuständig.

Unzureichende rekonstruierbare Versuche werden 60 Sekunden zurückgestellt; der Bot kann andere Arbeiten prüfen. Neue Vorschauereignisse nennen Scroll und Offering, `production.scroll-fallback` dokumentiert Prognose und Entscheidung.

Neue Spiel-Liveabnahme steht aus. Offlinetests decken Kauf → echte scroll1-Vorschau → genau ein Upgrade, Wiederverwendung, unzureichende Chance, unveränderte explizite Scrollregeln, widerrufene Kaufbelege und fehlende Definitionen ab.
