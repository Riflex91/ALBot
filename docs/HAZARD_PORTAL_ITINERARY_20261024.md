# ALBot 2026-10-24 — threat-aware portal itinerary candidate

**Status:** UNSIGNED developmental runtime 0.57.0-candidate; **no merge**, **no live-game certification**. This module is an engineering increment toward continuous safe cross-map navigation, not a claim to cover every eventuality.

## What changed

- `src/world/hazard-itinerary.mjs` builds candidate world routes through **actual portal and transporter source positions / server spawn indices**, not just map-hop length.
- Same-map routes use a bounded A* spatial search with 90-unit cells. A segment is accepted only when the official runtime's **arbitrary-map native `can_move`** validates that exact segment AND an aggressive spawn/live-monster threat check permits it. Search caps: 54 world states, 5 map transfers, 1300 local expansions per attempt and 3500 native collision queries, no infinite synchronous retries.
- Conservative hazards include naturally aggressive spawns (`boundary`, `boundaries`, `polygon`, `position/radius`, random spawns fail closed), authoritative monster range (NEVER capped at 170), speed and dangerous damage, and observed live/targeted monsters beyond static spawn areas. Dynamic live monster positions require observation; no unknown enemy position is invented.
- `src/world/hazard-travel.mjs` runs **one native direct `move(x,y)` or `transport(map,spawn)` at a time**, never a cross-map native `smart_move()` fallback for incident-scoped ordinary farmer movement. Before dispatch, direct collision and live threat are checked again. During in-flight movement, a newly hostile corridor aborts the step. Portal permissions and actual source and arrival zones are re-evaluated; observed map and landing coordinate determine completion. A post-portal native cooldown is respected.
- `src/core/movement.mjs` admits that navigator for farmer owners `farm/follow/regroup/quest/quest-escort/cohesion` on known `prat` worlds whenever a cross-map route is requested, as well as ordinary travel within `level1`. A non-emergency farm/follow rerank cannot overwrite an ongoing itinerary; explicitly threatened emergency combat may preempt. An inherited native smart route is stopped before a new itinerary.
- `src/combat/farmer.mjs` halts repeated autonomous respawning after a fatal verified-itinerary route or death on the lethal `level1` prat map, even without a surviving plan/order.
- `test/20261024-hazard-portal-itinerary.test.mjs` exercises real prat rectangles, geometry/path-crossing, detour planner, synthetic alternate transporter itinerary, live monster intrusion, changed transporter permission, no geometry oracle, failed passage, real dangerous monster stats, and fatal respawn stop.

## Critical empirical distinctions

- The official maps provide `main -> level1 -> level2 -> level2s` and an **alternative** `main transporter -> desertland -> level2s`, plus doors through cave/Halloween. The presence of an alternative portal does not mean its route is safe.
- Real October 2026 `fireroamer` data is `range:280`, `attack:320`, `aggro:0.2` at `desertland` spawn rectangles `[91,-952,353,-702]` / `[161,-868,453,-697]`. The official desertland transporter arrives at `[10,-386]`, inside this planner's conservative attack-horizon region. An initially simplified test fixture with `range:32` overstated route safety. A follow-up official-data regression corrected that false-positive risk and removed the upper cap on hostile range.
- A `level1` arrival at `[0,9]` is also within the aggressive `prat` safety margin. A pathfinder must reject both unsafe arrivals when no safe alternative is proven. No environment can guarantee that a hostile monster will not move into a newly cleared path.
- Actual geometry `G.geometry`, runtime `can_move` capability, portal state, teammate HP/MP/cooldowns, invisible/unseen hostile movement and server-side arrival events must be verified on the **specific active runtime**. Successful synthetic tests alone cannot prove game safety.

## Open release blockers

1. **Full physical geometry in live CODE:** `p.has('can_move')` must be verified for the real browser/Steam/Mainframe runtime and true map-aware behavior tested on remote maps. Without it the route planner should refuse unverified cross-map travel. Do not replace denial with native unguarded `smart_move`.
2. **Combat destinations:** goal coordinates inside cgoo/other aggressive spawn zones are *intentionally* rejected pending a distinct **combat staging/engagement admission** based on actual Ranger/Priest combat geometry, HP, MP, effective damage, buffs, enemy count and heal cadence. This can prevent reaching such goals; it is not finished autonomous farming.
3. **Group safety:** no atomic 3-farmer shared itinerary consensus and no live-tested Priest healing/retreat checkpointing. Existing emergency ownership and recovery paths still need adversarial in-game validation.
4. **Arrival semantics:** game `character.map` and spawn proximity are observed, but a dedicated per-action server event correlation receipt would offer stronger proof against coincidental map changes or delayed retries.
5. **Scope:** incident-scoped ordinary farmer travel uses the new navigator; independent Cave/scout and combat kiting remain on their specialized controllers. General non-prat maps/ordinary short routes have not yet been migrated. Live moving monster visibility is incomplete by design; remote maps rely on static geometry.
6. **Sign-off:** controlled, operator-observed actual 3-farmer + merchant EU II traversal, hostile aggro, heal and rescue tests; entire Linux and Windows offline CI at the exact committed Runtime SHA; review of all death-related logs; protected release signature created separately only after passing. The current release channel and signed manifest are untouched.

## Proof and references

- [Current official Adventure Land server](https://github.com/kaansoral/adventureland_mongodb/blob/main/node/server.js)
- [Current native CODE and smart_move](https://github.com/kaansoral/adventureland_mongodb/blob/main/js/runner_functions.js)
- [Official maps](https://github.com/kaansoral/adventureland_mongodb/blob/main/design/maps.js)
- [Official monster stats](https://github.com/kaansoral/adventureland_mongodb/blob/main/design/monsters.js)
- [Adventure Land source-grounded engine investigation PR #490](https://github.com/Riflex91/ALBot/pull/490)
- [Earlier non-traversable containment proposal PR #487](https://github.com/Riflex91/ALBot/pull/487)
