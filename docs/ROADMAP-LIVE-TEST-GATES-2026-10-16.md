# Roadmap live-test gates (16 October 2026)

**Status:** Preparation / evidence protocol; these steps have not run against a live Adventure Land game server. Test success in GitHub Actions is **not** live acceptance. Keep issue #95 open for unverified phases.

## 0 – Freeze an attributable build
1. Use only an exact commit whose Linux and Windows workflows both passed. Confirm `npm ci --ignore-scripts && npm run build && node scripts/sync-personal-code.mjs --check && npm test` against the same commit.
2. Compare the original personalized `globalThis.ALBotConfig` prefix byte-for-byte with the built `bot.js`; do not modify user budgets, item rules, potion thresholds, automatic services or risk gates in the name of testing.
3. Export a test report per character and environment (browser and headless), preserving `started`, `gameVersion`, `realm`, `environment`, `character`, `events`, `dropped`, `settings`, `actionStats`, checkpoint/inventory blocker and version. Never collect account tokens or authentication material.
4. Record any active value journal or unresolved transfer and **stop value-action tests** rather than clearing it manually.

### W14 – Mehrcharakter-Zeitfenster für bestehende Berichte

`scripts/CHECK-LIVE-TEAM.mjs` darf keine zeitlich getrennten Exporte als
zusammenhängende Teambeobachtung werten. Der Offlineprüfer verlangt je Charakter
endliche, aufsteigende Export-/Startzeiten sowie eine **echte gemeinsame
Zeitüberschneidung** aller eingereichten Reports. Er liefert unter
`scope.sharedObservation` Anfang, Ende, Dauer und Eignung. Optional kann
`--min-overlap-seconds 600` einen mindestens zehnminütigen gemeinsamen
Beobachtungszeitraum verlangen; ohne diese Option genügt bereits eine positive
Überschneidung. Fehlende oder zeitlich disjunkte Fenster blockieren die
Prüfer-Akzeptanz. Diese Metadaten **beweisen keine laufende Ingame-Sitzung**,
keinen signierten Release und keine tatsächliche Spielabnahme.

Für Wertaktions-/Bankabnahmen zusätzlich `--require-settled-value-state`
verwenden. Dieser aktivierbare W14-Gate verlangt für **jede** Figur einen
abschließenden expliziten `status.inventoryBlocked`-Boolean und einen
`status.journal`-Checkpoint im Testreport. Er verweigert Akzeptanz bei
Inventarsperre, beliebigem offenen Wertjournal oder einem belegten
`bankPartial`-Journal. Fehlende Pflichtfelder sind **kein**
erfolgreicher Nullzustand. Der Prüfbericht liefert nur Charakternamen und
Blockadecodes, keine Journalinhalte. Das Tool löst nichts auf und erlaubt
keinen Replay. Ein sauberer Endschnappschuss allein ist noch keine
Bestätigung sämtlicher zuvor ausgeführter Wertaktionen und keine
Ingame-Liveabnahme.


### W14 – Beobachtete Aktivität im gemeinsamen Zeitfenster

Für die strengere Prüfung echter Teamaktivität kann zusätzlich
`--require-observed-overlap` gesetzt werden:

```powershell
node scripts/CHECK-LIVE-TEAM.mjs --strict --require-three-farmers --min-overlap-seconds 600 --require-observed-overlap --require-settled-value-state merchant.json ranger1.json ranger2.json priest.json
```

Der neue Gate verlangt für **jeden** Charakter mindestens zwei zeitlich
unterschiedliche, sequenzierte `sample`-Ereignisse mit `running:true`
und `rip:false` innerhalb der **gemeinsamen** Start-/Export-Intersektion.
Browser- und Headless-Berichte dürfen nicht als derselbe gleichzeitige
Teamdurchlauf kombiniert werden. Fehlende, abgeschnittene oder verlorene
Ereignisse verhindern diese strenge Abnahme. Der ältere reine
Zeitfenster-/Diagnosemodus bleibt ohne das Flag unverändert.

Das weist nur die **im Report protokollierte** Laufzeitaktivität nach.
Serverseitig bestätigte Spielhandlungen, Restart- und Disconnect-Recovery,
physische Bank-/Loot-Quittungen und getrennte vollständige Browser- und
Headless-Liveabnahmen bleiben zwingend eigenständige W14-Nachweise.

### W14 – JSONL-Segmentintegrität und Neustartgrenzen

Der read-only Auswerter akzeptiert übereinanderliegende JSONL-Dateisegmente
nur bei **identischen** Ereignissen mit derselben `seq`. Zwei
unterschiedliche Ereignisse mit derselben Sequenznummer sind kein erlaubter
Replay: sowohl innerhalb einer JSONL-Datei als auch beim Zusammenführen
mehrerer Teile wird die Auswertung mit Fehler abgebrochen. Gleiche Segmente
dürfen unverändert wiederholt werden; es erfolgt keine Doppelzählung.

Für das Zusammenführen bleiben Startzeit, Realm und Runtimeversion gebunden.
Zusätzlich müssen `environment` und `gameVersion` übereinstimmen.
Browser-/Headless-Wechsel, Spielversionswechsel oder ein neuer Start dürfen
keine künstlich unterbrechungsfreie Einzelsitzung erzeugen. Solche Läufe
müssen separat ausgewertet und als Neustart-/Wechsel-Szenario durch echte
Spielbeobachtung belegt werden. Auch konfliktfreie JSONL-Segmente
bestätigen **keine** Servertransaktion.

## 1 – Read-only startup and runtime parity
- Verify start/stop/reload creates one scheduling timer and no leaked event handlers in both environments.
- Check heartbeat round trips, session and realm changes, team roster, script version and user config. Review the measured dispatch p95/p99 and wall-load proxy separately from real CPU use.
- Stop on repeated scheduler errors, unexpected target acquisition, mismatch between source/build or any unrequested value action.

## 2 – Controlled safe farm and heal observations
- Start with a known safe approved monster and no new boss. Confirm attack projectile game `hit.damage` fields and heal `hit.heal` fields are actually provided, including actor/target identifiers, before enabling any double-heal suppression.
- Compare hit/heal event timing to pending intents and expiration; verify no synthetic deaths or new neutral pulls.
- Reject any phase's result if uncertainty/HP/mana/accuracy fields are missing or if the healer is double-counted.

## 3 – Exact inventory and bank evidence
- Observe item variants, stack counts, locked/equipped/reserved inventory and live bank packs by current map. Cross-check each against the game UI without performing mutations.
- Verify a bank map transition marks previously seen bank packs unavailable, not empty. Restart between snapshots and ensure stale account-wide quantities are never actionable.
- Only after separately authorized server test: send a tiny, non-valuable test stack with matched sender/receiver sessions and check sender decrease, receiver increase, exact item identity, receipt and journal settlement. **No silent retry after unknown server outcome.**
- Apply the same evidence protocol to bank retrieve/store, upgrade/compound, market and gold tests, inside existing budgets and allowlists.

## 4 – Merchant, gear, bosses, autonomous learning
- Check fresh potion stock-decrease trend against independent real consumption records; a stock decrease alone is not proof of consumption.
- Validate tour switching, target selection, gear swap/restore and boss protections in read-only or shadow before any new execution authority. Unknown boss phases and damaged gear remain fail-closed.
- Check learning under equal game version, realm, character, semantic team gear, farm area and level. Distinguish sample-derived net gold/potions from actual earned/consumed values. Do not roll out a proposed policy from an unconfirmed replay.

## 5 – Offline replay comparison
Reports from the new sample format include `task`, `farmArea`, semantic `farmContext`, `xp`, `level`, `gold`, `hpPotions`, `mpPotions`, `rip`, inventory-blocked and value-action-pending indicators.

```powershell
node scripts/COMPARE-LIVE-EPISODES.mjs .\reports\baseline.json .\reports\candidate.json
```

The analyzer requires at least three comparable farm episodes per arm and 300 seconds of observation per arm to show **comparable-observation**. Browser and headless may be compared, but mismatched contexts, missing sequences, interrupted journals, level changes, map changes and dropped events invalidate the evidence. Result is always `authority: none`, `executable: false`. Periodic snapshots cannot establish death-free runs, real potion consumption or the causes of gold changes.

## 6 – Phase acceptance
Close a phase in issue #95 only when its actual listed deliverables, offline Linux/Windows CI, exact personalized bundle parity, read-only CI restoration, replay/error/rollback tests **and** the required controlled game evidence all exist. A review log must identify tested build SHA, date, realm, character, scenario, outcomes, limitations and any incidents.

Never claim that any step above has been executed merely because this document exists.
