# 0.11.0-candidate – aggressives persönliches Profil, AoE und belegte Recovery

## Befunde aus den acht Logs vom 19.10.2026, ca. 21:48–22:01 Uhr

- Alle vier Clients liefen mit 0.10.13-candidate und `world.risk=assertive`.
  Ranger1: 18 gestartete 3shots gegenüber 233 Basic-Attacks; Ranger2: 29 gegenüber
  423. Das ist eine Anzahl von Aktionen, keine Messung des gesamten Schadens.
- `skill.waitingForThree` meldet Kapazität 1 und fehlende Pullfreigabe. Die
  Encounterkapazität verwendete kurzfristige AoE-Cooldownmeldungen; ihr
  Lernkontext wechselte bei fehlenden Gearmeldungen und flüchtigen Stats.
  Zusätzlich lehnte die Skilllogik jeden Zweiziel-3shot grundsätzlich ab.
- Beim Merchant ist seit vor dem Start ein `ponty.buy`-Journal für drei Poison
  offen: vorher sieben Poison, Kosten 3600 Gold, vorher 200000 Gold. Das alte
  Journal besitzt keine gepinnte Variante. Die Recovery versuchte allgemeine
  Kaufjournale nicht regelmäßig erneut. Der Merchant führte in diesem Lauf
  ausschließlich drei Mail-Leseaktionen aus.
- `balanceHoldMs=1800000` verlangt 30 Minuten, die Logs umfassen etwa zwölf.
  Zusätzlich verhinderte die globale Prüfung `safe(Merchant)` wegen des
  Kaufjournals sogar die Auswahldiagnose. Dauernde normale Aggro kann außerdem
  ohne eine gezielte Pullpause jedes spätere sichere Wechselfenster verhindern.
- Beide Ranger besitzen kein Klassenelixier im Inventar oder Elixirslot.
  Der Merchant hat STR/INT/VIT-Elixiere, aber kein DEX-Elixier. Seine geplanten
  DEX-Beschaffungen und Lieferungen kommen wegen der Quarantäne nicht zum Zug.
  Vorhandene STR-/INT-Elixiere sind keine stillschweigenden DEX-Ersatzprodukte.

## Umsetzung

Das persönliche Repositoryprofil verwendet jetzt `risk=aggressive`,
`maxCombatSeconds=45`, `pullMp=0.3` und unverändert 30 Minuten Mindesthaltezeit für den
Levelausgleich. 3shot verlangt mindestens zwei Ziele; die bisherige konfigurierte
Obergrenze 15 bleibt erhalten, die echte Skillkapazität beträgt weiterhin drei.
Generische Profile und explizit eingestellte andere Risikomodi werden nicht
heimlich überschrieben. Der installierte Bootstrap enthält seine eigene
Konfiguration: Für diese Profiländerung muss der aktualisierte persönliche
Bootstrap einmal in den CODE übernommen werden. Ein Runtime-Reload allein
ändert dessen eingebettetes `assertive` nicht.

Die Kapazität und Spawn-Dichte verwenden nachhaltige Skillverfügbarkeit statt
des momentanen Cooldowns. Kompakte AoE-Nachweise überstehen große Heartbeats.
Lernkontexte behalten zuletzt beobachtete Gearidentitäten; fehlende Telemetrie
und temporäre Kampfwerte löschen den Lernerfolg nicht mehr. Aggressiver Betrieb
kann zwei oder drei unabhängig geprüfte normale Spawngegner zulassen; bekannte
Fehlschläge, Gruppenbereitschaft, PvP-/Fremdziel- und Mechanikregeln bleiben aktiv.

Ein Zweiziel-3shot benötigt einen bekannten positiven Skillmultiplikator und
mehr berechneten effektiven Gesamtschaden als ein Basic-Attack. Drittes Ziel,
fremde Aggro oder die Gruppen-Pullgrenze werden dafür nicht umgangen. Explizite
MP-, Klassen-, Zielzahl- und Cooldownregeln bleiben verbindlich.

Kauf-Recovery löst ausschließlich einen mindestens zwei Minuten alten Kauf mit
vollständig unverändertem Gold und identischem Inventar auf. Zwei gleiche
Beobachtungen mit mindestens zwei Sekunden Abstand, dauerhafter Speicher,
keine Queue, keine Platzhalter und keine laufende Übergabe sind erforderlich.
Das Originaljournal wird vor Freigabe dauerhaft archiviert; keine alte Aktion
wird wiederholt, kein Budget zurückerstattet und kein Kauf als erfolgt behauptet.
Fehlender Speicher oder irgendeine Abweichung lässt die Sperre bestehen.
Neue Ponty-Journale enthalten Variante und Angebots-RID. Exakte spätere
Kauf-/Equipbeobachtungen werden erneut geprüft, statt am ersten unklaren
Snapshot endgültig zu scheitern. Andere unbekannte Transaktionen erhalten
dadurch keine pauschale Freigabe.

Der Levelausgleich berechnet und meldet seine Auswahl auch während einer
Merchant-Quarantäne. Ein fälliger Wechsel hält neue neutrale Pulls an und
wartet, bis sämtliche ausgewählten Farmer sicher sind. Die bestehenden
Browser-Session-, Bestätigungs- und Lifecycle-Gates führen den Wechsel aus.
Eine unbekannte Level-/Browserfähigkeit wird weiterhin nicht erfunden.

Fehlende Klassenelixiere erscheinen mit Grund in `ALBot.status().elixir` und
als `elixir.waiting` im Log. Nach belegter Merchant-Recovery können die
bestehenden Beschaffungs- und Lieferpfade wieder arbeiten. Ein am Markt nicht
vorhandenes DEX-Angebot wird dadurch nicht als verfügbar behauptet.

## Abnahme

Neue Regressionen stehen in `test/20261019-aggressive-aoe-recovery.test.mjs`:
Legacy-Ponty-Recovery einschließlich Speicher-/Drift-Negativfällen und später
exakter Kaufbeobachtung, Zweiziel-AoE ohne Fremdziel/Pullumgehung, stabiler
Kapazitätskontext, fälliger Browserwechsel trotz Merchant-Journal sowie
Pullpause und Fehlschlagsveto. Vollständige Offline-CI und signierter Kanal
werden vor Veröffentlichung geprüft; tatsächlicher Spielbetrieb bleibt eine
separate Liveabnahme. Insbesondere kein pauschales Versprechen, dass jeder
unbekannte Inventar-/Wertzustand automatisch auflösbar ist.

Ab dieser Veröffentlichung wird jede neue signierte Runtime um eine Minor-Version (+0.1, Patch 0) erhöht: 0.11.0, 0.12.0 usw. Die Signierung prüft dies gegen das vorherige gültige Manifest. Auswahlregeln und Gear-Aufholplanung bleiben unverändert; die Rotationskorrektur schafft nur bei fälligem Bedarf nach 30 Minuten ein sicheres Wechselfenster.
