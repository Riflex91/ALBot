# Adventure Land — Engine, Navigation, Combat and ALBot: evidence-based deep audit
**Research date:** 2026-10-24. **Purpose:** derive the necessary game-mechanics model and implementation contract for a reliable 3-farmer + merchant ALBot. **State:** research evidence / design, NOT a delivered safe cross-map navigation engine and NOT a live certification.

## 0. Evidence hierarchy and versioning

1. **Runtime truth:** currently loaded `G` data, `character`, server-owned action results, fresh `parent.entities`, socket/character events, current map and instance, actual health and equipment. Snapshot and hash their *semantic* fields per session. Do not silently combine data from unrelated game versions.
2. **Server implementation:** `kaansoral/adventureland_mongodb/node/server.js` and `node/server_functions.js`, `node/logic/*`, `node/test/*`. As of the official [01/03/26] update, the live game migrated to the MongoDB repository.
3. **Client implementation:** `js/runner_functions.js`, `js/game.js`, `js/functions.js`; game geometry/collision in `common/js/common_functions.js` and the engine's processed `G.geometry`.
4. **Static world data:** `design/maps.js`, `design/monsters.js`, `design/skills.js`, `design/npcs.js`, `design/conditions.js`, `design/classes.js`, `design/items.js`, `design/events.js`; these may change in live deployments.
5. **Independent comparators:** `earthiverse/ALClient/source/Pathfinder.ts` uses `alpathfinder` and route-method/cost abstractions; Zinal's AL-Mapper provides externally computed geometric paths. Neither asserts monster-safe paths for ALBot. ALClient is not directly compatible with in-game CODE.

Evidence URLs:
- https://github.com/kaansoral/adventureland_mongodb/blob/main/js/runner_functions.js (observed blob b808eefac069a0a40c41be49250152abe4ac9904)
- https://github.com/kaansoral/adventureland_mongodb/blob/main/node/server.js (observed blob dbe7460fac7d56a2d1b3edb762ca792ac6a02b1)
- https://github.com/kaansoral/adventureland_mongodb/blob/main/design/maps.js (observed blob 85979f23a081b80eeb9567f67c072789356d9e52)
- https://github.com/kaansoral/adventureland_mongodb/blob/main/design/monsters.js (observed blob d0764b134d6685251dadf3da24061e669153ef9c)
- https://github.com/kaansoral/adventureland_mongodb/blob/main/design/npcs.js
- https://github.com/kaansoral/adventureland_mongodb/blob/main/design/skills.js
- https://github.com/kaansoral/adventureland_mongodb/blob/main/node/test/map_collision.test.js
- https://github.com/kaansoral/adventureland_mongodb/blob/main/node/test/monster_combat_distance.test.js
- https://github.com/kaansoral/adventureland_mongodb/blob/main/node/test/town.test.js
- https://github.com/earthiverse/ALClient/blob/master/source/Pathfinder.ts
- https://github.com/earthiverse/ALClient/blob/master/source/definitions/pathfinder.ts
- https://almap.zinals.dev/index.php/api/help
- https://adventure.land/allnotes

**Source limitation:** this review reads public current source, not the *deployed* EU II in-memory state, its live collision geometry or all runtime packets. 2026 updates changed monsters, CODE results, entity updates, and map collisions. Treat source as strong guidance, NOT a live signed/world-version certificate.

## 1. Native CODE navigation is NOT safe navigation

`runner_functions.js`:
- `smart_move(destination)` starts the asynchronous state machine, resets `smart.plot` and owns a Promise. An incoming `smart_move` interrupts the previous one.
- `bfs()` enumerates 15-unit axis-aligned moves, and 5-unit near destination or `small_steps`; it calls `can_move` to check **collision geometry** only. Movement order is shuffled. Doors, NPC transporter and optionally Town add graph edges. This does NOT incorporate spawn risk, live monsters, other players, exposure budgets or team survival.
- Search may span multiple frames. `smart.plot` is published only after path discovery; attempting to inspect it AFTER starting movement does not constitute pre-dispatch route proof.
- `smooth_path` omits intermediate waypoints if `can_move` certifies a straight collision-free segment; the removed waypoints might have been less exposed to aggro.
- `smart_move_logic` consumes one `smart.plot` waypoint roughly every 80 ms when movement is idle. Node type can be `move`, `transport` or `town`.
- `stop('move')` interrupts the smart route and sends a move-to-self command. An outstanding promise may reject `interrupted`. Repeated owner switches are therefore physically disruptive.
- `can_move_to(x,y)` calls `can_move({map: character.map, x: character.real_x, y: character.real_y, going_x:x,going_y:y, base:character.base})`; it validates **one direct segment on the current map**. It says nothing about danger or cross-map route.
- `xmove(x,y)` falls back to `smart_move` when `can_move_to` is false; it MUST NOT be an uninspected safety escape hatch.

`node/server.js` movement handler:
- Coordinates are validated using current map data and movement path; direct manipulation of character position is not an option. The server may correct position and penalize anomalous travel (including jail).
- Server tracks its own position through disconnect. Client-side `moving=false` alone cannot prove a route completed.

## 2. Portals, transporter, Town, locks, instances

A door row is `[x,y,width,height,targetMap,targetSpawn,sourceSpawn, optionalCondition, optionalComplexity]` in observed official maps. The server's `socket.on('transport')` checks *actual* proximity to the appropriate door/source spawn region or the actual transporter NPC, checks target map/instance and the exact destination spawn index, rejects excessive attackers (`player.targets > 5`), dampening, locked/protected doors, unavailable instances and other conditions.

Native pathfinder `bfs()` can construct edges to all `G.npcs.transporter.places` when near an NPC. `G.npcs.transporter.places` contains `desertland:1`, `main:9`, `winterland:1`, `cyberland:0`, etc. These are not unconditional magic teleport permissions: the server rechecks true NPC proximity and state.

`town()` is a server-owned delayed channel (~3000 ms in the observed server handler, with client timeout/cancel semantics), potentially interrupted on damage/status/movement/condition. `character.c.town` expiring locally is not proof of successful transport; the official client waits for `new_map` arrival evidence (`effect === 1`). An empty `smart.plot` likewise is not portal proof. `new_map` must match expected map **and instance**, and confirmed arrival coordinates should match spawn geometry.

Cave/generated maps, locked bank sublevels, event instances, PvP areas, and owner/party-specific access MUST use specialized policy; never treat an arbitrary cross-map graph edge as public/freely traversable.

## 3. Confirmed level1 death geography and an ALTERNATIVE route

Official `G.maps.level1` contains:
- `prat` spawn #1 `[-86,17,64,212]` (count 5, grow).
- `prat` spawn #2 `[-308,629,0,762]` (count 5, grow).
- Exit main from near `[0,-4]`; entrance to `level2` around `[-313,544]`.

Official `G.monsters.prat`: `hp=9200`, `attack=320`, `frequency=1.6`, `range=32`, `aggro=1`, `rage=0.4`, `speed=12`, `charge=86`, `lifesteal=120`. Base raw attack-frequency product is 512/s per rat before actual defenses, conditional effects and attack/projectile scheduling; NOT a certified effective DPS bound. Ten defined rats, `grow:true`, random aggro and pursuit can compound the danger.

**CRITICAL topology:** `level2s` DOES NOT have a direct portal to/from `level1`. The upper underground chain is `main -> level1 -> level2 -> level2s`. A SECOND topology exists:
`main` transporter NPC `(-83,-441)` -> `desertland` transporter spawn #1 `(10,-386)` -> `desertland` door near `(600,-2383)` -> `level2s` spawn #1 `(-240,681)`.

The desertland route is **NOT YET CERTIFIED SAFE**. Desertland has, among others:
- `fireroamer` spawn rectangles around `[91,-952,353,-702]` and `[161,-868,453,-697]`;
- `gscorpion` roughly `[220,-1569,561,-1276]`;
- `bscorpion`, `plantoid`, `porcupine` and `ent` elsewhere.
A straight line from desertland arrival to the `level2s` door intersects dangerous-looking spawn regions; replacing `level1` with `desertland` and running another native `smart_move` would merely substitute an unproven lethal corridor. An actual obstacle-aware, spawn-risk-weighted multi-leg plan is required.

At destination `level2s`, `cgoo` itself spawns near `[-52.5,359.33,120.29,646.25]` (8, grow), with `attack=320`, `frequency=1.2`, `aggro=0.1`, `range=64`, `hp=2400`. Therefore arrival at the *farm* location is a planned combat admission, not a claim of a monster-free path.

Logs from three farmers around 17:32–17:33 UTC show current-map exposure to prat, oscillating owners farm/follow/regroup/kite, Priest death around (-129,761), Ranger1 death around (-37,635) and Ranger2 death around (43,564). The first two final deaths lie in/near the second prat pack; Ranger2 died nearby. Eight exports are ring-buffer snapshots, NOT continuous records of all prior play.

## 4. Monster threat is dynamic, NOT bounded by spawn rectangles

In `node/server.js`:
- `new_monster` starts monsters from `boundary`, `boundaries`, `polygon`, `position/radius` or `random`. `special`, `count:0`, dynamic spawns, `grow`, respawn substitutions, event mobs and monster-created minions may occur. A rectangle-only parser is incomplete.
- Server aggro logic considers `mode.aggro`, monster `aggro` probability, `last_aggro`, attack frequency, monster/player facing, actual combat reach, player `aggro_diff` and `rage`. An unprovoked hit can happen before a persistent target assignment. Never use `monster.target === character.name` alone as proof of hostility.
- Engaged monsters can pursue the player, using motion or worker-based `fast_astar`; one spawn box is NOT a leash or a permanent containment boundary.
- `rage_logic`, abilities, hazards such as `spikes`, conditions, invisible players/PvP, rare/event spawns, monster-on-hit spawns, and group pulls extend risk.
- If a monster stops targeting, delayed projectiles or renewed aggro can still cause damage. Live entity visibility is range-limited and may contain stale objects; authoritative event chronology matters.
- October 2026 game updates changed rare monsters, cave behavior, entity delta handling and monster ranges. Do not hardcode a once-for-all monster whitelist.

## 5. Actual damage, healing and survival

`node/test/monster_combat_distance.test.js` confirms gameplay `distance` and server range use entity/character **combat bounds**, not always plain center-to-center Euclidean distance. Geometry-only Euclidean clearance with a constant 70 units cannot guarantee no hit. `character.range`, monster dimensions, server hit range, target movement, cooldown, flight time, ticks and lag must enter the horizon model.

Relevant combat quantities must be recomputed from live equipped slots, `stats`, buffs/debuffs, resistances, armor, damage type, dodge, crowd-control, survivability and potion availability; never rely only on `G.monsters[species].attack` or the character's max HP. At a minimum:
- Estimate incoming *upper* damage and time-to-death for every selected farmer; attribute multiple concurrently targeting monsters.
- Estimate projected healing actually available based on Priest MP, cooldown, range, line of sight, current client/remote entity visibility, action confirmation and projectile ETA, with a pessimistic lag margin.
- No path leg may depend on a heal that has not been independently confirmed possible; do not count other farmers' damage as guaranteed interruption/kill.
- During movement, use healing/potion survival first, and do not start optional neutral attacks when path risk, party separation or health violate thresholds.
- Dynamic engagement, boss focus changes, status impairment, disconnects and server-change/reconnect invalidate assumptions.

## 6. A genuinely traversable safer navigation design

Proposed architecture (must be built and tested; NOT claimed to be implemented):
1. **World capture:** snapshot live `G.version`, selected maps/geometry/doors/transporter places, monster types/abilities/special-spawns, live player stats and server/instance. Reject malformed/changed data and reassess after updates.
2. **Portal graph:** edges consist of a concrete **departure region** with door/source spawn or transporter coordinate and a concrete destination `map,spawn`. Reject inaccessible/locked/event/instance/PvP portals. Apply transition time, spawn arrival risk, dynamic danger and party access.
3. **Local geometric solver:** use real collision data, preferably the game's `can_move` for *arbitrary map segments* if exposed and validated, otherwise a tested replica of `G.geometry` / engine line collision; bounded A*/Dijkstra (with budget, cancellation and caching), explicit character base/size, straight-segment revalidation. No purely graph-hop planner. ALClient/`alpathfinder` is an independent comparison oracle, not a drop-in in-game dependency.
4. **Risk field:** inflated aggressive-spawn/polygon/roam regions plus live-monster trajectories, projected attack radius (combat rectangles), uncertain visibility, buffs, dynamic spawns and unavoidable portal-entry exposure. Distance alone is inadequate. Split risk into hard-excluded lethal corridors and survivability-costed encounters with pessimistic damage/HP budgets.
5. **Goal-aware admission:** distinguish safe transit, intentionally admitted combat arrival, guarded rescue and emergency withdrawal; do not ban all monsters on main (ordinary bee has `aggro=1`) nor authorize dangerous monsters merely because they are the farm target.
6. **Multi-map planner:** compare `main -> level1 -> level2 -> level2s` against `main -> transporter -> desertland -> level2s` using ACTUAL local paths + portal constraints and exposure. If the latter is safe within team budgets, select it. If neither is provable, propose a shorter safe farm destination or verified Town/recovery. NO fallback to unguarded `smart_move`.
7. **Execution FSM:** central one-owner itinerary with `IDLE/PLANNING/READY/MOVING/PORTAL_PENDING/ARRIVAL_VERIFY/REPLAN/RETREAT/HALT`. A plan is a versioned sequence of small concrete steps and verified portal actions, not a raw `smart_move({map:finalGoal})`. Keep authority stable through farm-target reranking; never let follow/kite/regroup silently seize travel ownership.
8. **Actuation:** each local `move(x,y)` needs native direct `can_move_to` and risk admission at DISPATCH TIME (after any queued delay). Portal `transport(to,s)` only at verified door/transporter position, one at a time. Wait for exact authoritative server/new_map observation, not an elapsed timer. Block simultaneous movement/teleport channels.
9. **Continuous monitoring:** recheck risk/HP/teammate positions periodically and on incoming attacks, damage, monster creation/movement, map change, interrupted Promise, stand/quest/rally ownership, reconnect and server change. Stop the unsafe step and replan a safer available route; avoiding one mob must not route another teammate into its aggro.
10. **Squad contract:** protect Priest positioning and heal range, enforce safety of **each** selected farmer rather than only Leader, shared destination + checkpoint synchronization, bounded waiting/portal rendezvous, follower separation and recovery logic, escalation if one teammate dies.
11. **Failure modes:** no safe route -> safe local hold with a clear diagnostic (not death-loop), operator-assisted rescue if already trapped, no uncontrolled respawn chain; cooldown/hysteresis for goals and route retries, independent blocked-map evidence and telemetry.

## 7. What PR #487 DOES and DOES NOT provide

Current draft #487 implements an incident-scoped emergency guard: it rejects unsafe-looking direct segments, forbids farmer cross-map travel in the known prat world, and can stop recurring respawns on hostile maps. It is **not a finished navigation solution**. Its unit tests prove specified synthetic behavior, not that it can traverse `desertland` without damage or keep the 3-farmer party operational. Its specific implementation assumptions remain unproven: constant 70-unit margin, complete spawn information, stable live-monster coverage, lack of alternative route evaluation, lack of risk-budget treatment at farm destination, potential legitimate route starvation. **Do not merge/sign as the requested autonomous smart navigator merely because Linux+Windows CI passed.** PR #485's shortest-map-hop guard is also insufficient.

## 8. Game subsystems to cover beyond walking

A universal ALBot's safety must also coordinate:
- **Runtime/transport:** browser/Steam/headless differences, authenticated API, CODE Promise semantics, socket disconnect/reconnect, verified `server.status`/realm/instance and current G, entity delta/visibility and event clocks.
- **Party and roles:** Leader elections, three-farmer combat team, independent Priest healing and mana constraints, Merchant support, remote heartbeat freshness, temporary quest detachment, consistent route epoch and route ownership.
- **Combat:** single/multi aggro and TTK, AoE and attack range, defensive focus, boss/special abilities, crowd control, kiting movement, projectile arrival and terminal damage, retreat and death recovery.
- **Progression:** hunts, Tracker, achievements, rewards, boss/event rotations, zones, Cave/generated maps, availability/timeouts, rank/milestone objectives.
- **Economy/items:** bank/multi-pack, storage ledger, inventory capacity, trade/mail/exchange, value-bearing journal recovery, merchant prices, protected gear, potions, item quality/version, gear preparation.
- **World dynamics:** PvP-server exposure, events/Halloween, seasonal/rare spawns, collision/door changes, server updates, trap tiles, unlock/key/state-dependent entrances.
- **Operational security:** explicit provenance and independent signed update channel, no unauthorized CODE/config replacement, exact SHA artifacts, authenticated test reports, offline+controlled-live acceptance.

See `design/{classes,skills,items,conditions,events,monsters,maps,npcs}.js`, `node/logic/*`, `node/test/*`, official CODE docs and recent update notes. This audit maps the important systems and sources; **it does not falsely certify that every line of the entire game, every undocumented live event and all private game state has been exhaustively inspected**.

## 9. Required adversarial acceptance tests before autonomous 24/7 activation

Use **actual official fixtures and generated version hashes** in addition to mocks:
- Route topology: alternate desertland route exists, `level1` forbidden when unsafe; transporter unavailable/locked; door spawn index mismatch; no direct level1->level2s edge; off-route cross-map `smart_move` forbidden.
- Geometry: native collision walls, misleading straight-line short paths, smoothing across aggro, portals behind obstructions, geometry changes while en route, multiple aggressive patches, narrow safe corridors, unwitnessed dynamic targets.
- Combat: `prat` #1/#2, 5+5 spawns/grow, `cgoo` destination aggro, hawk/bigbird ambush, roaming aggressor outside spawn, projectiles, cooldown/lag, Priest mana starvation and focus split.
- Control: leader switches plan mid-map, follower ahead and stranded, `follow/farm/kite/regroup` contention, transit decision epoch changes, partial new_map, canceled transport, slow native move, orphan move on restart.
- Safety: single death halts group optional farming, no unbounded respawn; already inside prat corridor allows supervised outward retreat only; unknown source map or disabled API fails closed without falsified arrival.
- Performance: bounded planning time, memory and route cache, runtime below 1 MiB, portable Linux/Windows tests and exact in-game CODE parity.

**Live verification:** controlled EU II sessions with explicit human supervision, snapshots of `G` and `character`, all four team logs, concrete waypoint, portal actions, monster encounters, health/MP, damage events, interruptions. A synthetic fixture, passed CI, or signed bundle alone is NOT proof of safe gameplay.

## 10. Delivery status and next engineering action

- The investigation has identified a **real alternative map topology** via Desertland and **specific reasons native `smart_move` is unsafe** for automatic cross-map farming.
- A complete dynamic cross-map path executor is **not yet implemented in the shipped main or certified** by this document.
- To satisfy the actual request, implement a bounded geometry + threat-aware portal itinerary executor and integrate it with ONE movement authority; retain #487 as temporary containment only; verify using real `G.geometry`/enemy data before independent signing.
