# ALBot 0.61.0-candidate – signierte Offline-Zertifizierung (25.10.2026)

## Anlass und Korrektur

Ein nach einer AoE-Fähigkeit überlebender Tiny Crab (beobachtet: 61/400 HP,
Ziel `My_Ranger2`) wurde von der Farmer-Notfallzielauswahl nicht mehr erfasst,
weil die bisherige Auswahl nur Monster aus der Liste natürlicher Aggression
berücksichtigte. Bereits auf einen Teamkameraden gerichtete, aber nicht mehr
als Natur-Aggro eingestufte Gegner fielen aus der Kampfverteidigung und konnten
die Farmer untätig lassen.

Mit [PR #498](https://github.com/Riflex91/ALBot/pull/498) berücksichtigt die
Fokusauswahl alle lebenden Monster derselben Karteninstanz, die einen Farmer
angreifen. Die vorhandenen Kampf- und Kapazitätsprüfungen bleiben vorgeschaltet:
Ein unbeteiligtes neutrales Ziel wird nicht neu angegriffen, und ein als
nicht sicher verteidigbar erkanntes Ziel wird nicht erzwungen. Die Grenzdistanz
zum Farmanker wurde von 85 auf 90 angehoben, damit der Warrior in der
beobachteten Ankunftssituation nicht fälschlich Weg-Aggro-Flucht wählt.

## Verifizierte Prüfkette

- Lokale vollständige Offline-Suite: **2699/2699 Tests erfolgreich**.
  Die drei in einer eingeschränkten Sandbox fehlgeschlagenen Child-Process-Tests
  liefen außerhalb dieser Sandbox vollständig grün.
- Neue Regressionstests prüfen den 61/400-HP-Finisher, das Unterlassen
  fremder/neutraler/unsicherer Angriffe und den Übergang zwischen Farmanker
  und Weg-Aggro-Flucht.
- [Linux- und Windows-CI #40182507912](https://github.com/Riflex91/ALBot/actions/runs/40182507912):
  beide Jobs erfolgreich, einschließlich Build, persönlichem Code-Sync,
  Bootstrap-Vertrag, Signierkanalprüfung, vollständiger Offline-Suite,
  Editor und Artefaktintegrität.
- Main-Merge: `eeaa0a902bbb0cf414f1fc2dad4a084f387d536c`.
- Signierter Release-Request: `591974458a1b7830f8bd579f33194315d136de2f`,
  konfliktfreie Zusammenführung des Main-Baums mit dem bisherigen Release-Branch.
- [Geschützter ECDSA-P-256-Signierworkflow #40182692815](https://github.com/Riflex91/ALBot/actions/runs/40182692815):
  sämtliche Offline-Prüfungen, Konfigurationskonstanz, Editor-Build,
  Manifest-Signierung und kryptografische Gegenprüfung erfolgreich.
  Veröffentlichung von Runtime und Manifest gemeinsam im Commit
  `d26dc8879da6c1ad63e8a2628110b59162f5182e`.

## Freigegebene Runtime

| Eigenschaft | Nachweis |
| --- | --- |
| Version | `0.61.0-candidate` |
| Signierte Sequenz | `61` |
| Runtime-Länge | `1040534` Bytes |
| SHA-256 | `64c7230067a175596484612321d54c373b5da3ca17374942710762165f51f4ff` |
| Git-Blob auf Main und Release | `f13cbe935309098d871976c46037ee089889ad90` |
| Vertrauensanker | Unveränderter öffentlicher ECDSA-P-256-Schlüssel des V2-Bootstraps |
| Runtime-URL | Unveränderter Pfad `dist/albot.runtime.js` im signierten Release-Branch |

Die SHA-256-Prüfung der lokalen Main-Runtime stimmt mit dem öffentlich
veröffentlichten signierten Manifest überein. Das unveränderte persönliche
`ALBotConfig`-Segment und der bestehende Bootstrap werden nicht ersetzt.
Das kombinierte Offline-Review-Artefakt wird nach dem dokumentierten
Bootstrap-Vertrag beurteilt; das separate Direkt-CODE-Limit ist für die
geladene Runtime nicht maßgeblich.

## Ingame-Abnahme weiterhin offen

Die Runtime wird vom installierten V2-Bootstrap beim **nächsten CODE-Start**
geladen, nicht mitten im laufenden Kampf. Kryptografische Signatur, Dateigröße,
Hash und Version werden vor Ausführung geprüft. Der Live-Nachweis, dass Farmer
die konkrete AoE-Rest-HP-Situation im Spiel vollständig zu Ende kämpfen,
steht noch aus; Offline-Zertifizierung behauptet keinen abgeschlossenen
Ingame-Dauertest.
