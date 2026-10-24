# 2026-10-24 – ALBot live loss: prat corridor, root-cause and release blockade

**Status: REVIEW / NOT APPROVED FOR MERGE OR IN-GAME RELEASE.**
Evidence: all four `test-My_*` and four `albot-teamcheck-My_*` attachments from the 0.53.0-candidate EU II test. These are 2048-event ring-buffer exports, not complete continuous JSONL; event gaps and timestamp slices must not be mistaken for exhaustive play history.

## Grounded timeline (UTC)
- 17:30:21 – My_Ranger1 farm plan selects `bbpompom` in `level3`.
- 17:32:02 – that plan fails; new farm goal `spider` on `main`.
- 17:32:50 – My_Ranger2 selects `cgoo` in `level2s`.
- 17:32:53 – road aggro and preserved route on `level1`.
- 17:32:54 – My_Ranger2 selects `bee` on `main` while inside the dangerous map.
- 17:32:54 – Ranger2 logs `combat.emergencyBasicDefense` on a `prat` targeting My_Priest.
- 17:33:05 – My_Priest dies on `level1`, approx (-129,761).
- 17:33:26–17:33:30 – My_Ranger1 dies on `level1`, approx (-37,635).
- 17:33:33–17:33:38 – My_Ranger2 dies on `level1`, approx (43,564).
- The logs show repeated movement owners `farm`, `follow`, `kite`, `regroup`; the lead and followers alternated the farm destination and temporary rally points. A follower requested `level2s` even after adopting a new `main` farm plan.

## Authoritative game engine evidence
- https://github.com/kaansoral/adventureland_mongodb/blob/main/js/runner_functions.js
  - `smart_move` explicitly says it is not very smart; native BFS uses collision checks (`can_move`) and door/transporter traversal, not monster danger admission.
  - `smart.plot` is produced AFTER smart_move starts; observing it afterward is not a hard pre-dispatch guarantee.
  - `stop('move')` interrupts the active promise and its physical route.
- https://github.com/kaansoral/adventureland_mongodb/blob/main/design/monsters.js
  - `prat`: `aggro:1`, `attack:320`, `frequency:1.6`, `lifesteal:120`, `charge:86`, `speed:12`.
- https://github.com/kaansoral/adventureland_mongodb/blob/main/design/maps.js
  - `level1`: five `prat` each in [-86,17,64,212] and [-308,629,0,762].
  - The second spawn rectangle overlaps the live death positions of Priest and Ranger1; Ranger2 was nearby.
  - Portal routes on this map connect main/halloween/cave/level2. A map-hop graph alone does not represent traversed coordinates.

## Critical self-review of PR #485 (BLOCKERS)
1. `farmTransitAdmission` considers map-graph shortest paths. Native `smart_move` does NOT have to select the shortest map-hop path; a clean graph path is NOT evidence that an actual chosen path avoids hazards. The helper must not be treated as certification.
2. The admission currently ignores aggressive monsters on the current map and at the destination. After the party entered `level1`, a new plan targeting `main` could appear admissible although the character is physically inside the prat spawn.
3. Replanning and swapping movement ownership amid a hotspot is still possible from quest escort, healer repositioning, regroup or combat code. Merely preserving one existing `farm` route under some threats is insufficient.
4. Death safety should not rely on a still-valid `travelPlan()`: plans may be cleared or reassigned as the lethal threat arrives; the last route/farm transit state needs to be durable across those changes. A first death should stop further unattended combat/respawn.
5. Mock tests that assert a synthetic portal route can be accepted do not prove actual safety; all fast-path acceptance cases need cross-validation against the official engine's path results, monster boundaries, and live navigation.

## Required acceptance before merge
- Fail-closed launch policy for cross-map autonomous farm trips without an independently validated, complete physical corridor. Temporary local-only farming is acceptable; do NOT silently fall back to unverified cross-map smart_move.
- Independent native movement admission at every dispatch and after every plan/role/leader change. No travel offence, stationary defence, or chase when a verified safe corridor remains; if the corridor fails, enter a bounded survival/abort procedure, not a new combat objective.
- Threat geometry: actual monster spawn rectangles including multi-boundaries, roaming/charge, attack range, and margins for latency/observer staleness. A shortest topological path is not proof of geometric safety.
- Squad trip state: one owner, one immutable destination during dangerous transit, validated three-member readiness at safe checkpoints *before* entering an unsafe region. No rapid plan changes and no repeatedly stopping a path under enemy attack.
- Fail-closed death policy on the first unattended fatal encounter; stop all farmers rather than autonomously restarting the same run.
- Replay the 17:30–17:33 UTC incident and adversarial cases for stale/trimmed heartbeat, interrupted smart_move, death after plan invalidation, underpowered healer, diverging follower routes, and competing skills.
- Run full Linux and Windows CI on the exact final SHA, verify artifact/personal-config parity, separately sign with protected key, then conduct a real controlled live-game acceptance test. CI success does not certify absence of deaths.

## CI and release state
- Initial candidate build CI 40117723996: succeeded; candidate is not signed.
- Initial PR verification 40117742308: failed (Linux: personal bot.js runtime mismatch on old head; Windows artifact/contract check). Branch progressed after the build job. This must be rerun after integration with current main.
- Main moved from 0.53.0 to 0.55.0 while the draft branch was under construction. The PR became conflicted; **never force-merge, force-update, or publish the unsigned branch**.
