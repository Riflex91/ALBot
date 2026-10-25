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

## 11. Released October 2026 semantics are NOT the old Wiki contract

Official current release notes: https://adventure.land/allnotes — latest release **21/10/26**, and official per-version metadata: https://github.com/kaansoral/adventureland_mongodb/blob/main/UPDATE_NOTES.md. Never assume older `smart_move`, CODE return values or combat range formulas still hold.

| Release | Confirmed material change | ALBot design consequence |
|---|---|---|
| 21/10/26 | `town()` and `smart_move` now wait for Town teleport completion; `smart_move` continues waiting during new path search | Await server observation and avoid repeated replacement attempts; distinguish search stalls from failure |
| 21/10/26 | Monster targets persist when splash kills a *different* player | Retaliation and party death model cannot assume target dropped on teammate death |
| 21/10/26 | Attack speed now includes status-condition effects; item skill cooldown persists across reconnect / server changes | Recompute DPS / TTK from *effective* live stats, and never reset cooldown state when swapping realms |
| 21/10/26 | Reconnecting no longer jumps character to incomplete movement endpoint; full entity-delta / MAINFRAME update fixes | Do not infer position from last requested destination; use fresh authoritative location and entity update revision |
| 21/10/26 | Headless Horseman / Graveyard Rising / Halloween map and monster changes, Witch's Cipher | Dynamic boss/event and map mutation cannot be represented by a single permanent static spawn blacklist |
| 06/10/26 | Official documentation clarified both spawn-boundary formats | Support `boundary:[x1,y1,x2,y2]` and `boundaries:[[map,x1,y1,x2,y2],...]` and polygon/position/random; never omit an active monster on parse failure |
| 04/10/26 | Monster attack ranges seen in CODE now match server, Cave targets exposed | Use accurate combat-bound geometry, explicit target freshness, and separate Cave-only controllers |
| 27/09/26 | Many Eye, Mimic and Pale Dino rare monsters / underground Kobolds, map changes | Route risk needs rare/event/special living enemies and should not assume only routine `count>0` spawns |
| 24/08/26 | Async public CODE functions now settle on actual server response; `server.status` available | Promise resolution and authoritative results replace timing assumptions; maintain failure/cancel token semantics |
| 01/03/26 | Engine migrated to `adventureland_mongodb` | Read current maintained repository, not the old archived/inactive server as runtime authority |

**Physical data availability limit:** actual `G.geometry` for the deployed map is computed from game geometry assets / served game data; it is not established by reading `design/maps.js` alone. The server's collision test `node/test/map_collision.test.js` exercises `x_lines`, `y_lines`, collision bases and entry braziers. The official geometry module `common/js/common_functions.js` referenced by that test is not available as a regular committed file at the path examined in this public checkout. The in-game `can_move_to` API can certify *one local line only*. Consequently neither the map-boundary rectangles nor the examined public repository alone can prove a particular alternative desertland walking corridor passable.

## 12. Prioritized implementation/test defects in ALBot (engineering backlog)

1. **P0 route authority gap:** `src/core/movement.mjs` calls `smart_move` for any non-direct destination, yet other owners can issue `movement.stop()` / different destinations during travel. No shared itinerary epoch binding follower, Priest and Leader. Implement route-owner lease and emergency preemption with measured hysteresis, never suppress a real life-threatening self-defense.
2. **P0 no complete physical corridor:** `src/world/knowledge.mjs` `mapGraph/mapHops` understand map topology but not path geometry or threat. `src/world/team-plan.mjs` ranks cross-map objectives using hops; `src/combat/farmer.mjs` follows a final endpoint through native `smart_move`. All three need *one* certified route object rather than competing graph-hop heuristics.
3. **P0 live threat before initial attack:** Current navigation code can treat non-targeted monsters as dangerous using `isNaturallyAggressive`, but native cross-map movement bypasses this during path search. Validate every **segment and portal landing** against both live moving threats and conservative spawn/boss zones.
4. **P0 one death / shared safety:** Death stop cannot hinge on `travelPlan()` still existing. Per-character and group-wide state/receipt must halt optional new routes and pulls after one unreconciled fatality and require explicit safe rescue or coordinated restart.
5. **P1 spawn parser coverage:** `spawnLocations` handles `boundary/boundaries`, but a route's risk model must additionally cover `polygon`, `position/radius`, `random`, roaming, special/event and locally summoned enemies. Unknown monster definition is not a free pass.
6. **P1 combat rectangle/range:** `distance()` in policy and custom Euclidean geometry are only approximations of the server combat distance. Use server-compatible width/height, live monster speed/attack/projectiles, armor/resistance and health horizon in exposure calculation. Resist a fake 100% safe claim based on a fixed 70-unit buffer.
7. **P1 healing priority:** Priest heal within line/range must be prioritized over follow ownership, with mana/cooldown/cast confirmation and squad checkpoint cohesion, not optimism about a healer on a different map.
8. **P1 merchant and quest contracts:** Portal itineraries cannot preempt bank/item value journal or personal Monsterhunt without a deliberate safe-point transfer. No unsafe Town cast in hostile aggro, and no bypass of protected Cave instance rules.
9. **P1 telemetry:** Record per-segment `routeId,routeEpoch,owner,sourceMap,targetMap,portal/spawn,geometryVersion,threatVersion,HP/MP,visibleHostiles,actionResult`, with monotonic timestamps and stale-proof checks. Ring-buffer logs alone cannot justify “tested all cases.”
10. **P2 build/runtime:** Size budget, game CODE bootstrap, manifests and config-sync trust must remain aligned. Detect `G`/server evolution and block an unreviewed stale path cache. No production signing until exact build SHA + Linux/Windows + controlled live pass.

### Counterexamples a safe pathfinder MUST pass

- A `level1` portal entry at `[0,9]` begins just outside the first prat spawn rectangle (which starts at y=17); the mere fact that the spawn coordinate isn't *inside* the rectangle says nothing about aggro reach or safe entry.
- `cgoo` at `level2s` is itself mildly aggressive. A direct route to the spawn center without distinguishing *combat admission at destination* from *transit safety* is unsound.
- Desertland `main`-transporter alternative is genuinely topologically possible, but the direct southeast walking line passes known monster regions: a graph-only “take desertland, not level1” recommendation is still not a proof.
- A monster that wanders outside its spawn boundary or changes target after a teammate's death invalidates a static route even if the original spawn rectangles were correctly avoided.
- A `town()` channel might fail or be interrupted without changing map. The executor must consume the **actual** observed result and not start an overlapping move, quest or regroup.
- A late game data update, unseen special mob, altered door restriction or missing `G.geometry` requires conservative diagnosis/alternative/replan, not falling back to unverified native `smart_move`.

## 13. Official CODE execution and third-party pathfinder trust

Adventure Land's latest official **Adventure MCP** guide (https://adventure.land/docs/guide/tracktrix/null/adventure-mcp) explicitly advises reading `character`, `G`, `server`, `game`, `smart` and game mechanics; using public `move/smart_move/use_skill` Promise APIs; **not overlapping an async loop**; treating old `entities` as stale after disappear/map change; and not assuming Node/network/filesystem capabilities inside Mainframe. It states Mainframe `smart_move` keeps the public API but uses **Mainframe navigation**, so a browser-runner's internal `smart.plot` implementation is **not automatically evidence** of the same movement internals on that host.

Mainframe can run 1 root + 3 included workers on one prepaid machine, each with separate CODE slot, game session, worker identity, memory limit and authentication; `start_character/stop_character` and root disconnect have nontrivial effects. If ALBot targets the user's four-character team through Mainframe, route epoch/coordination must tolerate these independent execution contexts and shared resource budgets. Test on the actual chosen host (browser, Steam, Mainframe/headless), not only a representative Node harness.

Alternative libraries are **candidate geometric solvers, not a death-prevention feature by themselves**:
- ALClient (https://github.com/earthiverse/ALClient/blob/master/source/Pathfinder.ts) and `alpathfinder` Rust/WASM offer multi-map pathfinding and `avoidMaps`; there is no evidence in the inspected interface of dynamic monster threat scoring or Priest health/buff/latency risk. The public `alpathfinder` npm release checked was 0.6.0; compatibility with in-game 1 MiB CODE / Mainframe must be established independently.
- AL-Mapper (https://almap.zinals.dev/index.php/api/help) performs external pathfinding using game G. The public viewer itself reports data last updated **2026-03-06** (https://almap.zinals.dev/). Until its live backend version, provenance, availability, privacy and dynamic hazard handling are proven, avoid making it an unverified production dependency. The service does not remove the requirement for ALBot's own server-confirmed portal and damage admission.

Bottom line: **geometry-only shortest path** is not **monster-safe itinerary**; **monster-safe itinerary** is not **risk-free continuous play**. Admission must be revisited after live data drift, asynchronous state changes and server-owned results, or the bot must choose a demonstrably safer attainable task.
