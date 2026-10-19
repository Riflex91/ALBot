# W13 – konkurrierende Gear-Empfänger im vorhandenen Merchant-Transport

Stand: 19.10.2026. **Priorisierung zulässiger Angebote, keine neue Allokationsbefugnis.**

## Beobachtung

Die bislang verwendete `sendRecipients()`-Reihenfolge folgte der Eintragsreihenfolge der Senderegeln. Dadurch konnte die erste in der Konfiguration genannte Person ein derzeit knappes Gear-Item angeboten bekommen, selbst wenn ein späterer Empfänger eine aktuell höher priorisierte Starterwaffe oder rollenbezogene Aufholausrüstung benötigt. Die vorhandenen `gear.goals()`-Werte berücksichtigen bereits explizite Target-Prioritäten, Starter-/Leerplatz-Dringlichkeit und die begrenzte W05/W08-Rollenfairness, wurden aber nicht für die eigentliche Empfängerreihenfolge benutzt.

## Strikte Grenzen

- Nur der **bereits eingeschaltete Merchant-Gear-Modus** kann mehrere bereits zulässige Empfänger umordnen.
- `cfg.items` mit einer aktiven, expliziten `keep`- oder `send`-Regel für den Gegenstand behält unverändert die eigene Vorrangstellung und ursprüngliche Reihenfolge.
- Unter nicht explizit übersteuerten Empfängern zählt nur ein aktuelles `gear.goals()`-Ziel für dieselbe Item-ID, denselben Level, passende kanonische Variante und ein `gearSlot`. Der angefragte Charakter muss laut frisch akzeptiertem Team-Heartbeat aktiv, lebendig, im selben Realm und durch seine Session identifizierbar sein.
- Bereits vorhandene `reserved`- oder `unresolved`-Allokationszusagen für denselben Empfänger und dieselbe Variante erhalten **keine zusätzliche Priorität**. Ein nicht belegbarer Score wird nicht als Dringlichkeit erfunden. Gleichstand wahrt die bisherige Reihenfolge.
- Kein neuer Empfänger, keine zweite Kopie, keine automatische Gearzusage und keine zusätzliche `send_item`-Ausführung werden erzeugt.
- Unverändert entscheiden die bestehenden `sendRule`, `availableTransfer`, `allocation.offer/reserve/guard`, `peerReadyForHandoff`, Sessionbindung, Einverständnis, physische Empfängerkapazität und persistente Sender-/Empfänger-Wertjournale über jeden tatsächlichen Transfer. Eine höher sortierte Person, die ein Gate nicht erfüllt, wird weiterhin übersprungen.

Das Ziel ist die **gerechtere Reihenfolge zulässiger Gear-Angebote**, nicht die endgültige automatische accountweite Rewardallokation. Echte Spiel- und Cross-Realm-Abnahmen stehen aus. `main` bleibt getrennt vom signierten Ingame-Bootstrap-Release.
