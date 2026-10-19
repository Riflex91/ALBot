# 0.10.13-candidate – Standortbindung und gemeinsame Reise

Ausgangspunkt sind die vier Farmer-/Merchant-Logpaare vom 19.10.2026,
anschließend die Präzisierung: normale Weg-Aggro erlaubt Weiterreisen;
ein tatsächlich durch einen Angreifer aufgehaltenes Mitglied erhält Teamhilfe.

## Änderungen

- Gewöhnliche Material-/Seashell-Anfragen umgehen die bestehende Standortbindung
  nicht mehr. Die Haltezeit beginnt weiterhin erst bei physischer Ankunft.
  Aktive Hunts und ungültige/unsichere Ziele behalten ihre bisherigen Gates.
- Ein neuer Leader übernimmt einen noch gültigen Standort samt Ankunftszeit.
  Frische Ablehnungen anderer ausgewählter Farmer werden für dieselbe
  Monsterdefinition und denselben Realm übernommen, maximal zehn Minuten.
- Auf derselben Map gilt die physische Gruppenleash auch bei aktivem smart_move.
  Vorauseilende Follower warten auch am nächsten bekannten Portal; der Leader darf sie einholen. Zurückliegende Follower schließen zunächst zum Leader auf. Nach einem
  Mapwechsel beträgt die Übergangsfrist zwölf Sekunden, danach wartet der
  Leader auf zurückliegende Mitglieder. Bereits am Ziel angekommene Mitglieder
  verhindern das Aufholen nicht.
- Der gesunde Priest behält bei bloßer Weg-Aggro seine Route wie die Ranger.
  Eine durch die frühere Support-Reichweitenlogik abgebrochene Route kann wieder
  aufgenommen werden. Heil-/Tranklogik bleibt aktiv.
- Ein Reiseblock erfordert einen tatsächlichen Angreifer und entweder
  Immobilisierung, kritische HP oder mindestens sechs Sekunden ohne 20 Einheiten
  Positionsfortschritt bei tatsächlichem Bewegungsstatus und mindestens
  max(25 HP, 3 % Max-HP) Schaden. Pfadsuche oder bloßes Logikwarten allein
  gelten nicht als Beleg. Der Block bleibt während der Verteidigung bestehen,
  bis der Angreifer entfällt oder wieder physischer Fortschritt möglich ist.
  Teamhilfe verlangt frischen Status, denselben Plan und einen sichtbaren,
  weiterhin genau dieses Mitglied angreifenden Gegner. Die vorhandenen
  Kampf-/Dispatch-Gates entscheiden weiterhin über einen zulässigen Kill;
  andernfalls bleibt die vorhandene sichere Rettung/Rückzugslogik zuständig.
- Nach Ankunft konkurriert die Farmankerfahrt im Umkreis von 220 Einheiten
  während eines Teamkampfes nicht mehr mit der lokalen Kampfpositionierung.
  Das adressiert einen möglichen Konflikt bei Gebäudekämpfen; der beobachtete
  Rat-Fall war in den gelieferten Logs nicht enthalten und ist nicht live belegt.
- Fähigkeitsmeldungen enthalten nur implementierte Spielerskills. Nachhaltige
  konfigurierte Heilung wird korrekt gemeldet und übersteht als kompakter
  Nachweis auch die Kürzung großer Heartbeats.
- Fertige, durch die vorhandene Logistik freigegebene Gearlieferungen können
  auch ohne akuten Lagerdruck früher fahren. Wertjournale, Variantenbindung,
  Empfangsnachweise und Kapazitätsregeln bleiben verbindlich.
- Produktionsbuffs werden an konkrete lokale Produktionsschritte gebunden,
  statt allein durch aktivierte Produktion ausgelöst zu werden. Marktwarteschritte
  lösen keinen Produktionsbuff aus. Ausgesetzte Ziele werden vor aufwendiger
  Routenbewertung gefiltert; ein noch nicht verfügbares Marktangebot erhält
  während der bestehenden Wartefrist keinen fiktiv günstigen Routenpreis.
  Unbeteiligte Inventar-/Goldänderungen beenden eine Marktwartefrist nicht mehr;
  ein frisches autorisiertes Angebot kann sie weiterhin beenden.
- Merchant-Deferrals übernehmen keine unveränderte Begründung des vorherigen Jobs.

## Prüfung und Liveabnahme

Neue Regressionen: `test/20261019-teamflow.test.mjs` (zehn Szenarien), dazu
angepasste bisherige Tests für den ausdrücklich geänderten Umgang mit
Seashell-Priorität und bloßer Weg-Aggro. Vollständige lokale Offline-Suite:
1753/1753 erfolgreich; Runtime/Werkstatt/Bootstrap gebaut. Linux-/Windows-CI [39313454586](https://github.com/Riflex91/ALBot/actions/runs/39313454586) grün.
Signierworkflow [39313699242](https://github.com/Riflex91/ALBot/actions/runs/39313699242) erfolgreich; Sequence 9, 760242 Bytes,
SHA-256 `e7c4183cb912d567462fb288fe401374311659bad6cbf96982454bf6a2dacf7e`, ECDSA-P-256-Signatur und Bytegleichheit zu Main verifiziert.
Persönliche `ALBotConfig` bleibt unverändert.

Im Spiel noch zu prüfen: zehn Minuten gemeinsame Reise einschließlich Portal,
gesunder Priest mit Gruppen-Aggro, echte Reiseblockade mit anschließendem
Weiterreisen, Rat in einem Gebäude sowie Merchant-Lieferung und echte Mutation.
Offlineprüfungen ersetzen diese Liveabnahme nicht.


## Nachträgliches signiertes Bootstrap-V2-Release – Sequence 10 (19.10.2026)

Nach den erfolgreich getesteten PRs #238 (exakte G09-Tauschprüfung) und #239 (belegte W06-Materialquellen) wurde die Runtime aus [main-Commit `2f55d8a907f3ae90cab6d301188d481a1f815121`](https://github.com/Riflex91/ALBot/commit/2f55d8a907f3ae90cab6d301188d481a1f815121) über den bereits installierten Release-Branch neu gebaut und als **sequence 10** ECDSA-P-256-signiert veröffentlicht. [GitHub-Actions-Lauf 39317203696](https://github.com/Riflex91/ALBot/actions/runs/39317203696): 1.769/1.769 Tests grün, unveränderte persönliche `ALBotConfig`, Signaturprüfung und SHA-256-Verifikation erfolgreich. **762149 Bytes**, SHA-256 `d73796591d7964a525ac3725bc91f6d11d07bcabd6c48acb76d766231d6f9def`, identisch mit dem `main`-Runtime-Build. Das Release ersetzt die vorherige sequence 9 ohne Änderung des vorhandenen Ingame-Loaders, des öffentlichen Schlüssels oder der Manifest-/Runtime-URLs. Nach dem nächsten CODE-Neustart kann der Loader sequence 10 beziehen. **Ingame-Liveabnahme von sequence 10 ist noch nicht belegt.**
