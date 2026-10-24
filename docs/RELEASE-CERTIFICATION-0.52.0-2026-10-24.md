# ALBot 0.52.0-candidate – Signierte Offline-Zertifizierung (24.10.2026)

## Freigabekette

- W06/G09-PR [#472](https://github.com/Riflex91/ALBot/pull/472): Nur aktuelle, kausal plausible Inventar- und Journalbelege dürfen als shadow-only gepaart diagnostiziert werden. Bei einem noch offenen SEND wird ein frischer Receiver-Session-Neustart angezeigt; weder automatische Journalfreigabe noch erneutes `send_item` wird erlaubt.
- Exact-head-PR `e6f1368811ccd85a7a63793dee4d2b7a1d6d3cb6`; unabhängige [Linux-/Windows-CI #40104297827](https://github.com/Riflex91/ALBot/actions/runs/40104297827) beide erfolgreich. `mergeable=true`, `mergeable_state=clean`, getestete Basis `1ebba5951c9c9e924adbb7c65ff776046538f29d` vor Merge unverändert.
- Verifizierter Merge-Commit `cdb8829014c9c99dc5a72a9a72fc41ffa8f83a91`; parallel freigegebener 0.51-Fokusfehlerfix und Release-Kanal erhalten.
- Geschützter vorhandener [P-256-Signierworkflow #40104446046](https://github.com/Riflex91/ALBot/actions/runs/40104446046) erfolgreich. Signierter Release-Tip `651c3383616d904b8c9e6c0a13084cd82e471d7e`.
- Signierter ALBot-Release `0.52.0-candidate`, **Sequence 52**, **997417 Bytes**, SHA-256 `8ac4297e7c39da65beccb31b1fb978be0a8dbc2e6418e87a8ac03696230e6fc1`. Geschützter Workflow bestätigte ECDSA-P-256 und Byteintegrität. Release-/main-Runtime haben denselben Git-Blob `d0911b276e048255495e2576c4c1c8d6ccbb812f`.
- Bestehendes persönliches ALBotConfig, installierter signierter V2-Ingame-Loader, Schlüsselmaterial und Release-URLs blieben unverändert.

## Grenzen

Zeitlich abgestimmte Inventardeltas aus zwei Heartbeats sind keine offizielle Adventure-Land-Serverquittung. Unaufgelöste Journale bleiben manuell gesperrt; kein weiterer Send-Dispatch ohne bestehende Wertaktionsverträge. Vollständig beidseitiger Materialhandel, accountweite Bankautonomie und zusammenhängende W14-Ingame-Dauerabnahme weiterhin offen.
