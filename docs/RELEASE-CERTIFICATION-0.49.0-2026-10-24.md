# ALBot 0.49.0-candidate – Signierte Offline-Zertifizierung vom 24.10.2026

## Exakte Herkunft und Freigabe

- Funktionaler Entwicklungs-PR [#463](https://github.com/Riflex91/ALBot/pull/463): W06/G09 Materialquoten werden, soweit ein vollständiger frischer zweiter Inventarbeleg mitgesendet wurde, gegen diesen unabhängig physisch gemeldeten Bestand, Itemvariante, Realm, Owner, Session und TTL abgeglichen. Ein Widerspruch blockiert neue Farmaufträge; ein fehlender optionaler Beleg ist kein Nullbestand.
- Final getesteter PR-Head `548fd61b4bf6d4ecbabcaf989f6d85006cae274b`. Unabhängige Linux/Windows CI [#40099377751](https://github.com/Riflex91/ALBot/actions/runs/40099377751) erfolgreich. `mergeable=true`, `mergeable_state=clean`, PR-Basis vor Merge `4a14bbcfaa4e33122826e743ac9212597a120e55` gleich damals aktuellem main.
- Verifizierter Merge-Commit `5032696d7180d0e381c6212a72bfbda417778198`. Parallel integrierte PRs #462 (Gear, Greenjr, Merchant), #464 (Konfigurator-D1) und signiertes Release 0.48 / Sequence 48 (PR #465) bleiben erhalten.
- Geschützter bestehender GitHub Signierworkflow [#40099680310](https://github.com/Riflex91/ALBot/actions/runs/40099680310) vollständig erfolgreich. Signierter Release-Branch-Commit `6af36f2309d7cea70d0dabdf3ec7d4e679262051`.
- ECDSA-P-256 signiertes Manifest: `0.49.0-candidate`, **Sequence 49**, **994168 Bytes**, SHA-256 `991266fab388bbc64dd5422f48b8c593763134b5e3d7c71975fb72b7b0bada62`. Signatur und Byteintegrität vom geschützten Signierworkflow bestätigt.
- Runtime-Git-Blob in signiertem Release-Branch und main **identisch**: `9c55893a8a042dcddff6e0a0ad0a4e96159de006`.
- Persönliche `ALBotConfig`, signierter V2-Ingame-Bootstrap, Release-URLs, öffentlicher Trust-Key und geschützte private Signiermittel unverändert.

## Grenzen

Eine Farmer-Statusmeldung ist weiterhin eine Peer-Aussage, keine bestätigte Servertransaktion. Physische beidseitige Handelsquittungen, persistentes Material-Lifecycle-Recovery, vollständige W02–W14-Roadmap und **W14-Ingame-Dauertest** bleiben offen. Offline-CI darf nicht als Ingame-Abnahme umgedeutet werden.
