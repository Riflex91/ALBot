import {combatMembers,compositionOptions,farmThroughput} from './composition.mjs';
import {verifiedTeamRoleOwner,chooseFarmAreaSwitch,chooseHuntSpawn,liveSpawnCompetition} from './spawn-choice.mjs';
import {materialEvent} from '../production/probability.mjs';
import {materialQuotaCap,materialRequestHasWork} from '../production/material-quotas.mjs';
import {materialDrops,expectedMonsterGold} from '../production/materials.mjs';
import {distance,samePlace,xy} from '../core/policy.mjs';
import {spawnLocations,knowledgeFingerprint,semanticGear,mapGraph,mapHops} from './knowledge.mjs';
// Persisted spawn measurements are observations, never authority. Reject
// malformed or future-dated samples before they affect farm target ranking.
export function verifiedAreaHistory(row,now=Date.now()){
 if(!row||typeof row!=='object'||Array.isArray(row)||
    !Number.isFinite(now)||!Number.isFinite(row.at)||row.at>now||
    !Number.isFinite(row.seconds)||row.seconds<=0||
    !Number.isFinite(row.xp)||row.xp<0||
    !Number.isFinite(row.gold)||row.gold<0||
    !Number.isFinite(row.empty)||row.empty<0||row.empty>row.seconds||
    !Number.isFinite(row.foreign)||row.foreign<0||
    !Number.isSafeInteger(row.deaths??0)||(row.deaths??0)<0||
    !Number.isSafeInteger(row.lostKills??0)||(row.lostKills??0)<0)return null;
 return row;
}
export function areaRateBaseline(previousKey,nextKey,xp,gold,lastXp,lastGold){
 return previousKey===nextKey?{xp:lastXp,gold:lastGold}:{xp,gold};
}
export function areaObservationSeconds(previousKey,nextKey,dt){
 return previousKey===nextKey&&Number.isFinite(dt)&&dt>=0?Math.min(5000,dt)/1000:0;
}
// Pressure observations decay when their measurement window grows stale.
// Unknown or expired pressure must not permanently blacklist a viable spawn.
export function areaPressure(row,now=Date.now(),freshMs=21600000){
 if(!row||!Number.isFinite(freshMs)||freshMs<=0||row.seconds<30)return {empty:0,foreign:0};
 const age=now-row.at;
 if(!Number.isFinite(age)||age<0||age>=freshMs)return {empty:0,foreign:0};
 const weight=1-age/freshMs;
 return {empty:row.empty/row.seconds*weight,foreign:row.foreign/row.seconds*weight};
}
// Summarize observed pressure across *fresh*, approved spawn observations.
// Unknown is null, never zero: absence of measurements is not a settled home.
export function summarizeSpawnPressure(rows,now=Date.now(),freshMs=180000){
 if(!Array.isArray(rows)||!Number.isFinite(now)||!Number.isFinite(freshMs)||freshMs<=0)
  return {pressure:null,reason:'invalid-or-missing-evidence',spawns:[]};
 const observed=rows.filter(r=>r&&Number.isFinite(r.observedAt)&&r.observedAt<=now&&
  now-r.observedAt<=freshMs&&Number.isFinite(r.evidenceSeconds)&&
  r.evidenceSeconds>=60&&Number.isFinite(r.pressureRatio)&&
  r.pressureRatio>=0&&r.pressureRatio<=1&&typeof r.key==='string');
 if(!observed.length)return {pressure:null,reason:'no-fresh-60s-spawn-evidence',spawns:[]};
 const ranked=[...observed].sort((a,b)=>b.pressureRatio-a.pressureRatio||b.observedAt-a.observedAt);
 return {pressure:ranked[0].pressureRatio,reason:'verified-spawn-observations',
  measuredAt:Math.max(...observed.map(r=>r.observedAt)),
  spawns:ranked.slice(0,5).map(r=>({key:r.key,pressure:r.pressure,
   pressureRatio:r.pressureRatio,evidenceSeconds:r.evidenceSeconds,observedAt:r.observedAt}))};
}
// A farm destination is a squad march, not permission for the Leader to
// sprint beyond the healer. Each hop requires fresh, colocated and healthy
// selected Farmers, including a verified healer if one is in the roster.
export function assessFarmMarch(character,peers,{realm,now=Date.now(),
 maxGap=165,hpFloor=.85,step=85,destination=null}={}){
 if(!character||!Array.isArray(peers)||!Number.isFinite(now)||
  !Number.isFinite(character.x)||!Number.isFinite(character.y))
  return {ready:false,reason:'leader-unverified'};
 let farthest=0;
 for(const peer of peers){
  if(!peer?.running||peer.rip||peer.realm!==realm||
    !samePlace(character,peer)||!Number.isFinite(peer.x)||
    !Number.isFinite(peer.y)||!Number.isFinite(peer.hp)||
    !Number.isFinite(peer.max_hp)||peer.max_hp<=0||
    !Number.isFinite(peer.received)||peer.received>now||
    now-peer.received>4000)
   return {ready:false,reason:'teammate-unverified',peer:peer?.name??null};
  if(peer.hp/peer.max_hp<hpFloor)
   return {ready:false,reason:'teammate-needs-heal',peer:peer.name,
    hpRatio:peer.hp/peer.max_hp};
  const gap=distance(character,peer);farthest=Math.max(farthest,gap);
  if(gap>maxGap)return {ready:false,reason:'teammate-behind',peer:peer.name,gap};
 }
 if(destination&&samePlace(character,destination)&&
   distance(character,destination)>step){
  const pos=xy(character),goal=xy(destination),d=distance(character,destination);
  const next={...destination,x:pos.x+(goal.x-pos.x)*step/d,
   y:pos.y+(goal.y-pos.y)*step/d,radius:20};
  const laggard=peers.find(peer=>distance(next,peer)>maxGap);
  if(laggard)return {ready:false,reason:'projected-healer-leash',
   peer:laggard.name,gap:distance(next,laggard)};
  return {ready:true,reason:'cohesive-march',next,gap:farthest};
 }
 return {ready:true,reason:'cohesive-march',next:destination,gap:farthest};
}
// A teammate already traversing the SAME verified plan must not immobilize
// the Leader merely because a portal placed them on a different map.
// Compact march intents are carried even when large heartbeats shed farmPlan.
export function squadCombatEngaged(monsters,teamNames=[],peers=[]){
 const names=new Set(teamNames);
 return (monsters??[]).some(m=>m?.hp>0&&!m.dead&&names.has(m.target))||
  (peers??[]).some(h=>h?.running&&!h.rip&&Number.isFinite(h.threats)&&h.threats>0);
}
// A queued smart_move can stay flagged as active even without any physical
// progress. Keep a position/time witness for each follower on the same plan.
export function stalledSquadRoutePeer(peers,plan,observed,now=Date.now(),stallMs=30000){
 if(!(observed instanceof Map)||!plan?.id||!Number.isFinite(now))return null;
 const active=new Set();
 for(const peer of peers??[]){
  if(!peer?.name)continue;active.add(peer.name);
  const traveling=peer.running&&!peer.rip&&peer.march?.plan===plan.id&&
   peer.march?.moving===true&&!peer.questVisit&&!(peer.threats>0)&&
   Number.isFinite(peer.x)&&Number.isFinite(peer.y)&&
   (!samePlace(peer,plan)||distance(peer,plan)>85);
  if(!traveling){observed.delete(peer.name);continue;}
  const old=observed.get(peer.name);
  if(!old||old.plan!==plan.id||!samePlace(old,peer)||
     distance(old,peer)>18||old.at>now){
   observed.set(peer.name,{plan:plan.id,map:peer.map,in:peer.in??peer.map,
    x:peer.x,y:peer.y,at:now});continue;
  }
  if(now-old.at>=stallMs)return peer.name;
 }
 for(const key of observed.keys())if(!active.has(key))observed.delete(key);
 return null;
}
export function assessLiveSquadMarch(character,peers,{realm,plan,
 now=Date.now(),maxGap=300,hpFloor=.6,crossMapSince=new Map(),portalGraceMs=12000,mapDistance=null}={}){
 if(!character||!plan?.id||!Array.isArray(peers))return {ready:false,reason:'invalid-plan'};
 for(const peer of peers){
  if(!peer?.running||peer.rip||peer.realm!==realm||
     !Number.isFinite(peer.received)||peer.received>now||
     now-peer.received>4000||!Number.isFinite(peer.hp)||
     !Number.isFinite(peer.max_hp)||peer.max_hp<=0)
   return {ready:false,reason:'teammate-unverified',peer:peer?.name??null};
  if(peer.travelBlock?.plan===plan.id&&now-peer.travelBlock.at>=0&&
     now-peer.travelBlock.at<=6000)return {ready:false,reason:'teammate-transit-blocked',peer:peer.name};
  if(peer.questVisit===true)return {ready:false,reason:'teammate-on-quest-visit',peer:peer.name};
  if(peer.hp/peer.max_hp<hpFloor)return {ready:false,
   reason:'teammate-needs-heal',peer:peer.name,hpRatio:peer.hp/peer.max_hp};
  const close=samePlace(character,peer)&&distance(character,peer)<=maxGap;
  const progress=peer.march?.plan===plan.id&&
    peer.march?.realm===realm&&peer.march?.moving===true&&
    peer.questVisit!==true;
  // Physical arrival at the *verified* destination is sufficient even if
  // optional plan telemetry was dropped from this peer's heartbeat.
  const reached=samePlace(peer,plan)&&distance(peer,plan)<=85;
  const aheadOnMap=samePlace(character,peer)&&samePlace(character,plan)&&
   distance(peer,plan)+60<distance(character,plan)&&
   peer.march?.plan===plan.id&&peer.march?.realm===realm;
  const aheadAcrossPortal=!samePlace(character,peer)&&typeof mapDistance==='function'&&
   Number.isFinite(mapDistance(peer.map))&&mapDistance(peer.map)<mapDistance(character.map)&&
   peer.march?.plan===plan.id&&peer.march?.realm===realm;
  if(samePlace(character,peer)){
   crossMapSince.delete(peer.name);
   if(!close&&!aheadOnMap)return {ready:false,reason:'teammate-behind',peer:peer.name,gap:distance(character,peer)};
  }else{
   const key=plan.id+':'+character.map+':'+(character.in??character.map)+':'+peer.map+':'+(peer.in??peer.map);
   let checkpoint=crossMapSince.get(peer.name);
   if(checkpoint?.key!==key){checkpoint={key,at:now};crossMapSince.set(peer.name,checkpoint);}
   if(!reached&&!aheadAcrossPortal&&now-checkpoint.at>=portalGraceMs)return {ready:false,reason:'teammate-portal-checkpoint',peer:peer.name};
  }
  if(!close&&!progress&&!reached&&!aheadAcrossPortal&&!aheadOnMap)return {ready:false,
    reason:'teammate-not-on-shared-route',peer:peer.name,
    gap:samePlace(character,peer)?distance(character,peer):null,
    observedMap:peer.map??null};
 }
 return {ready:true,reason:'team-traversing-shared-route'};
}
// A change of objective or hunt/farm label at one spawn is NOT a movement
// destination change. Preserve native smart_move across such handoffs.
export function sameFarmDestination(a,b){
 return !!a&&!!b&&a.target===b.target&&samePlace(a,b)&&
   Number.isFinite(a.x)&&Number.isFinite(a.y)&&
   Number.isFinite(b.x)&&Number.isFinite(b.y)&&distance(a,b)<=20;
}
// A follower may already be moving along the compact leader route before
// receiving the full validated plan. Adopting that plan must not cancel the
// same native path merely because its previous local plan was absent.
export function activeFarmRouteMatches(order,plan){
 const dest=order?.dest;
 return !!plan&&!!dest&&['follow','farm'].includes(order.owner)&&
  samePlace(dest,plan)&&Number.isFinite(dest.x)&&
  Number.isFinite(dest.y)&&Number.isFinite(plan.x)&&
  Number.isFinite(plan.y)&&distance(dest,plan)<=100;
}
// A projected geometric hop is NOT a navigable game route. A blocked
// straight line must be routed through native smart_move to the real spawn.
// If that route was already rejected, try a small locally verified detour
// without widening the healer leash.
export function chooseMarchWaypoint(character,destination,peers,{
 canMove=()=>false,failed=()=>false,maxGap=165,step=85
}={}){
 if(!samePlace(character,destination))
  return {point:{...destination,radius:65},reason:'cross-map-native-route'};
 const position=xy(character),goal=xy(destination);
 const distanceToGoal=distance(character,destination);
 if(distanceToGoal<=65)return {point:null,reason:'arrived'};
 const direct={...destination,x:position.x+(goal.x-position.x)*
  Math.min(step,distanceToGoal)/distanceToGoal,
  y:position.y+(goal.y-position.y)*Math.min(step,distanceToGoal)/
  distanceToGoal,radius:20};
 if(canMove(direct.x,direct.y)&&!failed(direct))
  return {point:direct,reason:'verified-local-hop'};
 // Native pathfinding knows map collision that a linear projection cannot.
 const final={...destination,radius:65};
 if(!failed(final))return {point:final,reason:'native-path-around-obstacle'};
 const angle=Math.atan2(goal.y-position.y,goal.x-position.x);
 for(const delta of [Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2,
   3*Math.PI/4,-3*Math.PI/4]){
  const x=position.x+Math.cos(angle+delta)*65;
  const y=position.y+Math.sin(angle+delta)*65;
  const point={...destination,x,y,radius:12};
  if(!failed(point)&&canMove(x,y)&&
   (peers??[]).every(p=>samePlace(character,p)&&distance(p,point)<=maxGap))
   return {point,reason:'verified-local-detour'};
 }
 return {point:null,reason:'no-navigable-safe-route'};
}
// The same semantic team-gear identity must index both measured and
// ranked spawn history; heartbeat timestamps are not gear changes.
export function farmAreaHistoryKey(realm,hour,spawnKey,gears){
 return realm+':'+hour+':'+spawnKey+':'+knowledgeFingerprint(gears.map(semanticGear));
}
import {huntForFarmer,advanceHuntCycle,skipHuntWithoutSpawn,advancePastSkippedHunts,huntDeadlineStatus} from './hunt-rotation.mjs';
// A pending, unobservable or unsafe monsterhunt may not starve the shared
// farming plan. Only the verified quest monster earns quest priority.
// Existing safely ranked farm targets remain available as temporary work.
// Ordinary plans must not alternate between bee/main and minimush/halloween
// while the party has not even reached the chosen spawn. A hunt->farm label
// change at the SAME species also retains existing location hysteresis.
// Active hunts and unsafe plans keep their existing priority paths. Ordinary
// material demand, including shell refill, respects the same location hold.
export function shouldHoldOrdinaryLocation(current,next,selectedKind,shellRefill=false){
 return ['farm','achievement'].includes(selectedKind)&&!!next&&
  (['farm','material','elixir'].includes(current?.kind)||current?.kind==='hunt'&&
   current.target===next.target);
}
// Keep a verified ordinary farm trip until the actual destination is reached,
// then observe it for the configured minimum hold time before applying normal
// score + travel hysteresis. Recomputing trip cost from each passing waypoint
// is not evidence that the destination became less attractive.
export function chooseCommittedFarmArea({
 current,currentRank,candidate,character,now=Date.now(),
 holdMs=60000,improvement=.2
}={}){
 if(!current||!currentRank||currentRank.key!==current.key||!candidate||
   candidate.key===current.key)
  return {choice:candidate??null,reason:'new-or-unchanged-farm-spawn'};
 if(!character||!samePlace(character,current)||
   !Number.isFinite(distance(character,current))||
   distance(character,current)>65)
  return {choice:currentRank,reason:'committed-farm-trip'};
 if(!Number.isFinite(current.arrivedAt)||current.arrivedAt>now||
   now-current.arrivedAt<holdMs)
  return {choice:currentRank,reason:'farm-arrival-observation-hold'};
 return chooseFarmAreaSwitch({
  current:{...current,started:current.arrivedAt},
  currentRank,candidate,now,holdMs,improvement
 });
}
export function selectHuntArea(ranking,hunt){
 const ordinary=ranking?.[0]??null;
 if(!hunt)return {area:ordinary,kind:'farm',deferred:null};
 if(hunt.phase==='combat'){
  const matching=ranking?.find(row=>row.target===hunt.monster);
  return matching?{area:matching,kind:'hunt',deferred:null}:
   {area:ordinary,kind:'farm',deferred:'NO_SAFE_HUNT_SPAWN'};
 }
 const deferred=hunt.phase==='turnin'?'HUNT_TURNIN_PENDING':
  hunt.phase==='acquire'?'HUNT_ACQUIRE_PENDING':
  hunt.phase==='blocked'?'HUNT_ALL_DEFERRED_NO_SAFE_SPAWN':
  'HUNT_STATUS_UNVERIFIED';
 return {area:ordinary,kind:'farm',deferred};
}

// Balanced mode should not choose extremely weak spawns merely because
// cheap, frequent kills dominate a 50/50 geometric XP/Gold score. Retain
// positive Gold weight, verified throughput and full travel/pressure costs.
// Prefer an actual, attainable official stat milestone only among fully
// approved safe spawn candidates; an active feasible Monsterhunt wins first.
export function selectVerifiedStatMilestoneArea(ranking,milestones,G,{
 maxGap=300,maxSeconds=3600
}={}){
 if(!Array.isArray(ranking)||!Array.isArray(milestones)||!G?.monsters)return null;
 const opts=[];
 for(const row of milestones){
  if(!row||typeof row.monster!=='string'||!Number.isFinite(row.score)||
   !Number.isFinite(row.gap)||row.gap<=0||row.gap>maxGap||
   !Number.isSafeInteger(row.threshold)||row.threshold<=row.score||
   typeof row.stat!=='string'||!Number.isFinite(row.bonus)||row.bonus<=0)continue;
  const monster=G.monsters[row.monster];
  if(!monster||!Array.isArray(monster.achievements)||
   !monster.achievements.some(a=>Array.isArray(a)&&a[0]===row.threshold&&
    a[1]==='stat'&&a[2]===row.stat&&a[3]===row.bonus))continue;
  for(const area of ranking.filter(a=>a.target===row.monster)){
   const hp=monster.hp,dps=area.composition?.effectiveDps,travel=area.travelSeconds;
   if(!Number.isFinite(hp)||hp<=0||!Number.isFinite(dps)||dps<=0||
      !Number.isFinite(travel)||travel<0)continue;
   // Conservative 0.5 score per kill permits co-op halving; an estimate,
   // never a guarantee of monsterhunt credit or monster safety.
   const seconds=travel+row.gap*2*Math.max(1,hp/dps);
   if(seconds>maxSeconds)continue;
   opts.push({area,milestone:row,estimatedSeconds:Math.ceil(seconds)});
  }
 }
 return opts.sort((a,b)=>a.estimatedSeconds-b.estimatedSeconds||
  b.milestone.bonus-a.milestone.bonus||a.area.key.localeCompare(b.area.key))[0]??null;
}
export function balancedFarmUtility(xp,gold){
 if(!Number.isFinite(xp)||xp<0||!Number.isFinite(gold)||gold<0)return 0;
 return Math.pow(Math.max(1,xp),.65)*Math.pow(Math.max(1,gold),.35);
}
export function createTeamPlan(bot){
 const crossMapSince=new Map();
 const {p,cfg,me}=bot,key='albot:teamplan:'+me.name;let marchState={reason:'',peer:'',at:0},routeBlockedAt=0,routeProgress=new Map();let current=null,last=0,generation=0,history=p.read(key+':areas')??{},area=null,previous=Date.now(),lastXp=p.c.xp??0,lastGold=p.c.gold??0,absence=0,samples=0,lastSave=0,ranking=[],huntFallback='',switchAdvice=null,definition='',graph={edges:[]},roles={},validEpoch=-1,validCache=new Map(),dangerousAreas=new Map(),materialAck=null,lastMaterialAck='';
 if(!history||typeof history!=='object'||Array.isArray(history))history={};
 function areaKey(spawnKey,now=Date.now()){
  return farmAreaHistoryKey(p.realm(),new Date(now).getUTCHours(),spawnKey,
   bot.farmers.map(n=>n===me.name?bot.gear?.snapshot():bot.transport.fresh(n)?.gear));
 }
 function areaQuarantined(key){const until=dangerousAreas.get(key);if(!until)return false;if(until>Date.now())return true;dangerousAreas.delete(key);return false;}
 const huntKey='albot:teamhunt:'+me.group;
 let huntState=p.read?.(huntKey)??null,huntObjective=null;
 function orderedHunt(){
  if(me.role!=='farmer'||!cfg.world.quests||!cfg.world.questTargets||
     !Array.isArray(bot.farmers)||!bot.farmers.length)return null;
  if(me.name!==bot.leader){
   const h=bot.transport?.fresh?.(bot.leader);
   return h?.running&&h.realm===p.realm()?h.huntObjective??null:null;
  }
  const valid=JSON.stringify(huntState?.names)===JSON.stringify(bot.farmers)&&
   Number.isSafeInteger(huntState?.index)&&huntState.index>=0&&
   huntState.index<bot.farmers.length;
  const lookup=name=>huntForFarmer(name,me.name,p.c.s?.monsterhunt,
   bot.transport?.fresh?.(name),p.realm());
  const name=valid?bot.farmers[huntState.index]:bot.farmers[0];
  const next=advanceHuntCycle(huntState,bot.farmers,lookup(name));
  if(next.changed){
   if(p.write?.(huntKey,next.state)!==true){
    bot.event?.('hunt.persistenceBlocked',{owner:name});
    return {owner:name,phase:'unknown'};
   }
   huntState=next.state;
  }
  const passed=advancePastSkippedHunts(huntState,bot.farmers,lookup);
  if(passed.changed){
   if(p.write?.(huntKey,passed.state)!==true){
    bot.event?.('hunt.persistenceBlocked',{owner:bot.farmers[huntState.index]});
    return {owner:bot.farmers[huntState.index],phase:'unknown'};
   }
   huntState=passed.state;
  }
  if(passed.allBlocked){
   huntObjective={owner:null,phase:'blocked',monster:null,remaining:null};
   return huntObjective;
  }
  const owner=bot.farmers[huntState?.index??0];
  const active=lookup(owner);
  huntObjective={owner,phase:active===undefined?'unknown':active===null?'acquire':
   active.c===0?'turnin':'combat',monster:active?.id??null,remaining:active?.c??null,
   remainingMs:active?.ms??null,server:active?.sn??null};
  return huntObjective;
 }
 function candidates(){const explicit=me.farmTargets?.length?me.farmTargets:cfg.farming.targets;return cfg.farming.autoTargets===false||me.farmTargets?.length?explicit:Object.keys(p.G.monsters??{}).filter(id=>{const m=p.G.monsters[id];return !m.boss&&!(m.respawn<0)&&!m.cooperative&&!m.stationary;});}
 function verifiedHuntSpecies(id){
  // Ordinary farming exclusions must not silently remove an active server
  // monsterhunt. This is species eligibility only, NOT safety admission.
  const h=me.name===bot.leader?huntObjective:
   bot.transport?.fresh?.(bot.leader)?.huntObjective;
  return h?.phase==='combat'&&h.monster===id&&
   typeof id==='string'&&!!p.G.monsters?.[id];
 }
 function allowed(id){return (candidates().includes(id)||verifiedHuntSpecies(id))&&
  materialEvent(p.G,id,p.root.S??p.parent.S).active&&
  bot.strategy.safeTarget(id,undefined,true,true);}
 function materialRequests(){const h=bot.transport.fresh(cfg.party.merchant);return h?.running===true&&h.realm===p.realm()?h.materials??[]:[];}
 function valid(plan){if(!Number.isInteger(bot.decisionEpoch))return validRaw(plan);if(validEpoch!==bot.decisionEpoch){validEpoch=bot.decisionEpoch;validCache.clear();}if(!validCache.has(plan))validCache.set(plan,validRaw(plan));return validCache.get(plan);}
 function validRaw(plan){if(!plan||plan.realm!==p.realm()||plan.expires<=Date.now()||plan.leader!==bot.leader||!['farm','material','elixir','hunt'].includes(plan.kind)||!Number.isFinite(plan.x)||!Number.isFinite(plan.y)||!bot.strategy.permittedMap(plan.map)||!allowed(plan.target))return false;
  const source=spawnLocations(p.G,[plan.target],cfg.world.excludedMaps,cfg.farming.pvp).find(s=>s.key===plan.key);if(!source||areaQuarantined(plan.key)||plan.definition!==source.definition||bot.content?.approve('farm:'+plan.map+':'+plan.target,[p.G.monsters[plan.target],p.G.maps[plan.map]?.monsters?.filter(s=>s.type===plan.target)])===false)return false;
  if(!plan.objective)return true;if(plan.kind==='elixir')return bot.elixirs?.objective()?.objective===plan.objective||bot.transport.fresh(plan.leader)?.elixir?.item===plan.item;
  return materialRequests().some(r=>r.objective===plan.objective&&
    (!r.expires||r.expires>Date.now())&&r.monster===plan.target&&(!r.sourceFingerprint||r.sourceFingerprint===knowledgeFingerprint([p.G.monsters[r.monster],p.G.drops?.monsters?.[r.monster]]))&&
    materialRequestHasWork(r,bot.farmers,name=>name===me.name?bot.session:bot.transport?.fresh?.(name)?.session));
 }
 function observe(){if(me.name!==bot.leader)return;const now=Date.now(),dt=Math.max(0,Math.min(5000,now-previous));previous=now;if(!current||!samePlace(p.c,current)||distance(p.c,current)>220){area=null;lastXp=p.c.xp??0;lastGold=p.c.gold??0;return;}
  const id=areaKey(current.key,now),old=verifiedAreaHistory(history[id],now)??{seconds:0,xp:0,gold:0,empty:0,foreign:0,deaths:0,lostKills:0,samples:0};const visible=bot.monsters().filter(m=>m.mtype===current.target&&distance(p.c,m)<500),foreign=Object.values(p.entities).filter(e=>e.type==='character'&&!bot.teamNames.includes(e.name)&&distance(p.c,e)<500).length;
  // A new spawn/hour/gear key starts a fresh rate window. Experience and gold
  // earned on the way to this area must not be attributed to its throughput.
  ({xp:lastXp,gold:lastGold}=areaRateBaseline(area,id,p.c.xp??0,p.c.gold??0,lastXp,lastGold));
  const observedSeconds=areaObservationSeconds(area,id,dt);
  old.seconds+=observedSeconds;old.xp+=Math.max(0,(p.c.xp??0)-lastXp);lastXp=p.c.xp??0;if(!bot.journal&&!bot.logistics.reserved&&!bot.gold?.reserved)old.gold=(old.gold??0)+Math.max(0,(p.c.gold??0)-lastGold);lastGold=p.c.gold??0;old.empty+=visible.length?0:observedSeconds;old.foreign+=foreign*observedSeconds;old.samples++;old.at=now;history[id]=old;area=id;
  // A crowded spawn is often NOT empty: other players claim monsters before
  // us. Count sustained foreign presence as pressure, not just empty time.
  const emptyRatio=old.empty/Math.max(1,old.seconds);
  const foreignAvg=old.foreign/Math.max(1,old.seconds);
  absence=old.seconds>=60?Math.max(emptyRatio,foreignAvg>=2?.75:0):0;
  samples++;
  history=Object.fromEntries(Object.entries(history).sort((a,b)=>b[1].at-a[1].at).slice(0,96));if(now-lastSave>30000){lastSave=now;p.write(key+':areas',history);}
 }
 function capabilities(){
  const names=(bot.farmers??[]).slice(0,8),members=names.map(name=>{
   if(name!==me.name){const h=bot.transport?.fresh?.(name);return h?.name===name?h:null;}
   return {name,running:bot.running,rip:!!p.c.rip,
    hp:p.c.hp,max_hp:p.c.max_hp,mp:p.c.mp,max_mp:p.c.max_mp,
    class:p.c.ctype,ctype:p.c.ctype,s:p.c.s,realm:p.realm(),
    capabilities:bot.capabilities?.snapshot?.()};
  }).filter(Boolean);
  const context={now:Date.now(),ttlMs:cfg.general.messageTtlMs??10000,realm:p.realm()};
  roles=Object.fromEntries(['heal','aggro','protect','energize','speed','mark']
   .map(role=>[role,verifiedTeamRoleOwner(members,role,context)?.name??null]));
  return roles;
 }
 function tick(){if(cfg.general.testLogging===undefined||me.role!=='farmer')return;
    // An active emergency must block new pulls, not strand the squad without
    // a shared destination. Keep an already verified plan stable, but when
    // none exists allow the leader to select a safe spawn and followers to
    // adopt it. The farmer/encounter emergency gates still prevent pulls.
    if(bot.combatAssessment?.emergency?.().active&&valid(current)){
      current.expires=Date.now()+cfg.general.messageTtlMs*2;
      return;
    }
  // Receipt is based on the actual merchant heartbeat and validated monster
  // source, rather than merely assuming send_cm reached every farmer.
  const incomingOrder=materialRequests().find(x=>x.objective&&x.item&&x.monster&&
    x.quantity>0&&(!x.expires||x.expires>Date.now())&&allowed(x.monster)&&
    (!x.sourceFingerprint||x.sourceFingerprint===knowledgeFingerprint(
      [p.G.monsters[x.monster],p.G.drops?.monsters?.[x.monster]])));
  materialAck=incomingOrder?{objective:incomingOrder.objective,item:incomingOrder.item,monster:incomingOrder.monster}:null;
  if(materialAck&&lastMaterialAck!==materialAck.objective){
    lastMaterialAck=materialAck.objective;
    bot.event('farmOrder.received',{...materialAck,merchant:cfg.party.merchant});
  }
  observe();if(cfg.party.enabled&&me.name!==bot.leader){
  const h=bot.transport.fresh(bot.leader),now=Date.now();
  // transport.fresh() enforces the configured heartbeat TTL and sender
  // membership. The candidate plan itself independently proves realm,
  // leader, expiry, game-definition fingerprint and permitted spawn.
  const ownerReady=!!h?.running&&!h.rip;
  // Prefer the full leader plan, but recover from a trimmed heartbeat with
  // the leader's own independently validated compact march anchor.
  // Both representations must pass the *same* local spawn/realm/risk gate.
  const proposed=ownerReady?[h.farmPlan,h.march?.anchor]:[];
  const next=proposed.find(candidate=>valid(candidate))??null;
  if(valid(next)){
   const prior=current,changed=!prior||prior.id!==next.id;
   current={...next};roles=h.roles??{};
   if(changed){
    if(!sameFarmDestination(prior,current)&&
       !activeFarmRouteMatches(bot.movement.order,current)&&
       ['farm','world','combat','follow'].includes(bot.movement.order?.owner))
     bot.movement.stop();
    bot.target=null;
    bot.event('plan.adopt',{id:current.id,target:current.target,
     leader:bot.leader,reason:current.reason});
   }
  }else if(!(ownerReady&&h.march?.plan===current?.id&&valid(current))){
   // Keep an existing verified plan only while the leader's fresh compact
   // march identity agrees. Do not infer that a missing plan is approval.
   if(current||h?.march?.plan)
     bot.event?.('plan.followerRejected',{leader:bot.leader,
       previous:current?.id??null,remote:h?.farmPlan?.id??null,
       compact:h?.march?.anchor?.id??null,
       reason:!ownerReady?'leader-heartbeat-not-fresh':
        h?.march?.anchor?'no-locally-approved-leader-plan':'plan-missing'});
   current=null;
  }
  return;}
  // A new leader adopts the already verified physical destination. Rebinding
  // identity must not erase arrival time or restart an aligned native route.
  if(current&&current.leader!==bot.leader){
   const adopted={...current,leader:bot.leader};
   if(valid(adopted)){current={...adopted,id:me.name+':handoff:'+Date.now()};
    bot.event?.('plan.leaderHandoff',{id:current.id,key:current.key});}
  }
  // A quest collection/turn-in is an individual errand. Keep the existing
  // farm anchor stable throughout the visit, even if travel score, team DPS
  // or the provisional hunt rotation changes while a member is absent.
  // Existing target/plan validation continues to deny unsafe attacks.
  const questAbsent=cfg.party.enabled&&
   (bot.strategy?.busy||(bot.farmers??[]).some(n=>n!==me.name&&
    bot.transport?.fresh?.(n)?.questVisit===true));
  if(questAbsent&&current){
   current.expires=Date.now()+cfg.general.messageTtlMs*2;
   switchAdvice={reason:'monsterhunt-npc-anchor-hold',from:current.key,to:current.key};
   return;
  }
  // Do not replace a valid shared plan while an ally still has hostile aggro.
  // The next tick after that fight may reconsider urgent quest/material work.
  const fightPeers=(bot.farmers??[]).filter(n=>n!==me.name)
   .map(n=>bot.transport?.fresh?.(n));
  if(valid(current)&&squadCombatEngaged(bot.monsters(),bot.teamNames,fightPeers)){
   current.expires=Date.now()+cfg.general.messageTtlMs*2;
   return;
  }
  // Arrival is physical evidence, not elapsed time since selecting a route.
  // Keep it across leader re-ranking of the same destination.
  if(valid(current)&&!Number.isFinite(current.arrivedAt)&&
     samePlace(p.c,current)&&distance(p.c,current)<=65)
   current.arrivedAt=Date.now();
  if(Date.now()-last<Math.min(10000,cfg.world.cacheTtlMs)&&valid(current))return;last=Date.now();capabilities();const raw=knowledgeFingerprint([p.G.monsters,p.G.maps]);if(raw!==definition){definition=raw;graph=mapGraph(p.G);if(current&&!valid(current)){bot.event('plan.drift',{id:current.id,reason:'Spawn-/Monsterdefinition geändert'});current=null;}}
  const materials=materialRequests(),requests=materials.filter(r=>materialRequestHasWork(r,bot.farmers,name=>name===me.name?bot.session:bot.transport?.fresh?.(name)?.session)&&(!r.expires||r.expires>Date.now())&&allowed(r.monster)&&(!r.sourceFingerprint||r.sourceFingerprint===knowledgeFingerprint([p.G.monsters[r.monster],p.G.drops?.monsters?.[r.monster]])));const elixir=bot.elixirs?.objective();const request=requests.sort((a,b)=>Number(b.objective===current?.objective)-Number(a.objective===current?.objective)||(b.priority??0)-(a.priority??0)||(b.utilityPerHour??0)-(a.utilityPerHour??0))[0]??elixir;
  const combat=combatMembers(bot,true),composition=compositionOptions(bot,true);
  // Availability, not a legacy global AoE opt-out, governs farmer density.
  const aoeAvailable=(bot.farmers??[]).some(name=>{
   const cap=name===me.name?bot.capabilities?.snapshot?.():
     bot.transport?.fresh?.(name)?.capabilities;
   return (cap?.sustainable??[]).some(id=>['3shot','5shot','cleave','stomp','fanofknives','cburst'].includes(id))||
    (cap?.aoe?.length??0)>0||(name!==me.name&&(bot.transport?.fresh?.(name)?.combatSupport?.aoe?.length??0)>0);
  });
  let hunt=orderedHunt();
  const types=[...new Set([...candidates(),...(hunt?.phase==='combat'&&p.G.monsters?.[hunt.monster]?[hunt.monster]:[])])].filter(allowed),locations=spawnLocations(p.G,types,cfg.world.excludedMaps,cfg.farming.pvp),teamDps=Math.max(1,combat.reduce((n,c)=>n+(c.attack??0)*(c.frequency??1),0));
  ranking=locations.filter(s=>!areaQuarantined(s.key)&&bot.content?.approve('farm:'+s.map+':'+s.target,[p.G.monsters[s.target],p.G.maps[s.map]?.monsters?.filter(x=>x.type===s.target)])!==false).map(s=>{const m=p.G.monsters[s.target],density=Math.max(1,Math.min(s.count,(cfg.party.aoe||aoeAvailable)?cfg.party.aoeMaxTargets??1:1,cfg.farming.maxAggro??1)),fit=farmThroughput(m,combat,density,composition),seconds=Math.max(1,m.hp/Math.max(1,fit.effectiveDps)),learned=verifiedAreaHistory(history[areaKey(s.key)]),hops=mapHops(graph,p.c.map,s.map),trip=s.map===p.c.map?distance(p.c,s)/Math.max(1,p.c.speed??40):Number.isFinite(hops)?hops*60:120;const {empty,foreign}=areaPressure(learned,Date.now(),(cfg.farming.knowledgeFreshMs??21600000)*12);const live=liveSpawnCompetition(s,p.entities,bot.monsters(),bot.teamNames,p.c);
   const killsPerHour=Math.min(3600/seconds,s.count*3600/(seconds*density+Math.max(0,m.respawn??0))),theoretical=(m.xp??0)*killsPerHour,empirical=learned?.seconds>=60&&Date.now()-learned.at<(cfg.farming.knowledgeFreshMs??21600000)*12?learned.xp*3600/learned.seconds:theoretical,freshness=learned?Math.max(0,1-(Date.now()-learned.at)/(cfg.farming.knowledgeFreshMs??21600000)/12):0,xp=theoretical*(1-.3*freshness)+empirical*.3*freshness,gold=expectedMonsterGold(p.G,s.target)*killsPerHour*(1-.3*freshness)+(learned?.seconds>=60?(learned.gold??0)*3600/learned.seconds:expectedMonsterGold(p.G,s.target)*killsPerHour)*.3*freshness;const utility=request&&s.target===request.monster?((request.utilityPerHour??0)>0?request.utilityPerHour*(cfg.farming.mode==='xp'?(cfg.production.materialXpPerGold??10):1):Math.max(1,...types.map(id=>(p.G.monsters[id].xp??0)*3600/Math.max(1,p.G.monsters[id].hp/teamDps)))*(cfg.production.materialPreference??1.25)):cfg.farming.mode==='xp'?xp:cfg.farming.mode==='gold'?gold:balancedFarmUtility(xp,gold);return {...s,score:utility*(bot.adaptive?.factor(s.target)??1)/(1+trip/300+empty*2+foreign*.2+live.players*.8+live.fighters*3+(learned?.deaths??0)+(learned?.lostKills??0)*.05)*(request?1:1+(bot.progression?.bonus(s.target,s.map)??0)),xpPerHour:xp,goldPerHour:gold,composition:fit,travelSeconds:trip,evidenceSeconds:learned?.seconds??0,observedAt:learned?.at??null,
   pressureRatio:Math.max(empty,foreign>=2?.75:0),livePlayers:live.players,liveFighters:live.fighters,
   occupancyObserved:live.observed,
   pressure:empty>.6?'spawn-starved':foreign>=2||live.fighters>0?'contested':'healthy'};}).filter(r=>Number.isFinite(r.score)).sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key));
  // Rank the complete set of *approved* spawns before deciding a quest has
  // nowhere safe to run. Persist only an ordering decision, never forge quest
  // completion or clear any farmer's actual monsterhunt state.
  const huntRow=hunt?.phase==='combat'?
   ranking.find(x=>x.target===hunt.monster):null;
  const huntHorizon=hunt?.phase==='combat'?
   huntDeadlineStatus({id:hunt.monster,c:hunt.remaining,
    ...(hunt.remainingMs===null?{}:{ms:hunt.remainingMs}),
    ...(hunt.server?{sn:hunt.server}:{})},p.realm(),huntRow?.travelSeconds??0,
    huntRow?Math.max(1,p.G.monsters[hunt.monster].hp/
      Math.max(1,huntRow.composition?.effectiveDps??teamDps)):0):null;
  const noApprovedSpawn=hunt?.phase==='combat'&&!huntRow;
  const infeasibleHunt=hunt?.phase==='combat'&&
   ['expired','insufficient-time','wrong-realm'].includes(huntHorizon?.state);
  if(noApprovedSpawn||infeasibleHunt){
   const skipped=skipHuntWithoutSpawn(huntState,bot.farmers,{
    owner:hunt.owner,monster:hunt.monster,remaining:hunt.remaining,
    safeSpawnChecked:true
   });
   if(skipped.changed){
    if(p.write?.(huntKey,skipped.state)===true){
     huntState=skipped.state;
     bot.event?.('hunt.noApprovedSpawn',{owner:hunt.owner,monster:hunt.monster,
      remaining:hunt.remaining,nextOwner:bot.farmers[huntState.index],
      retryAfter:huntState.skipped[hunt.owner].until,
      // The event transport flattens nested objects to "[object Object]".
      // Serialize this bounded diagnostic so live rejects remain explainable.
      diagnostics:JSON.stringify({candidateSpawns:spawnLocations(p.G,[hunt.monster],cfg.world.excludedMaps,cfg.farming.pvp).length,
       allowedMonster:allowed(hunt.monster),approvedRanking:ranking.filter(r=>r.target===hunt.monster).length,
       permittedMaps:cfg.world.excludedMaps,deadline:huntHorizon?.state??null}),
      reason:infeasibleHunt?'Monsterhunt-Zeitfenster / Server nicht passend: '+huntHorizon.state:
        'Kein freigegebener sicherer Spawn; Auftrag bleibt bestehen',
       remainingMs:hunt.remainingMs??null,neededMs:huntHorizon?.neededMs??null});
     hunt=orderedHunt();
    }else bot.event?.('hunt.persistenceBlocked',{owner:hunt.owner,
     reason:'Kein Wechsel ohne dauerhaft gespeicherten Rotationszustand'});
   }
  }
  let selected=selectHuntArea(ranking,hunt);
  // Active hunts and Daisy visits take precedence over milestone farming.
  // Without a feasible hunt, only a fresh server-verified Tracker score
  // and a separately approved safe spawn can take ordinary farm priority.
  const milestone=(!hunt||hunt.phase==='blocked')?
   selectVerifiedStatMilestoneArea(ranking,bot.progression?.milestones?.()??[],p.G):null;
  if(selected.kind==='farm'&&milestone&&!request){
   selected={...selected,area:milestone.area,kind:'achievement'};
   bot.event?.('achievement.statMilestonePriority',{
    monster:milestone.milestone.monster,score:milestone.milestone.score,
    threshold:milestone.milestone.threshold,remaining:milestone.milestone.gap,
    stat:milestone.milestone.stat,
    estimatedSeconds:milestone.estimatedSeconds,
    source:'official-tracker-and-verified-safe-spawn'});
  }
  // Accepted material/elixir work selects an approved source explicitly.
  // Existing ordinary travel still finishes its arrival observation window.
  const materialRequested=!!request;
  if(materialRequested){const source=ranking.find(r=>r.target===request.monster);
   if(source)selected={kind:'farm',area:source,deferred:null};}
  let next=selected.area,selectedRequest=selected.kind!=='achievement'&&!!request&&next?.target===request?.monster?request:null;
  const old=ranking.find(r=>r.key===current?.key);
  // Keep existing hold-time for safe ordinary farming while waiting for
  // the active farmer's quest NPC or an independently verified hunt spawn.
  // A hunt -> ordinary-farm transition does not imply travel to a different
  // spawn of the SAME monster. Keep the physical location's hold time even
  // when the plan kind and reason change.
  const holdOrdinary=shouldHoldOrdinaryLocation(current,next,selected.kind,materialRequested);
  switchAdvice=null;
  // Monsterhunt priority must not erase *location* hysteresis. A switch
  // between two osnake spawns is still an ordinary travel decision, not a
  // new quest. Hold the same safe hunt location while collecting the
  // observation window needed for a coordinated non-PvP server hop.
  if(selected.kind==='hunt'&&current?.kind==='hunt'&&
     current.target===next?.target&&old&&valid(current)&&
     !infeasibleHunt){
   const choice=chooseHuntSpawn({
    current,currentRank:old,candidate:next,now:Date.now()
   });
   switchAdvice={reason:choice.reason,from:old.key,to:next?.key??null,
    scope:'same-monsterhunt'};
   next=choice.choice;
  }
  if(holdOrdinary&&(!request||current?.kind==='farm'||current?.objective===request.objective)&&old&&valid(current)){
   const choice=chooseCommittedFarmArea({
    current,candidate:next,currentRank:old,character:p.c,now:Date.now(),
    holdMs:cfg.farming.planHoldMs??60000,
    improvement:cfg.farming.switchImprovement??.2
   });
   switchAdvice={reason:choice.reason,threshold:choice.threshold,
    from:old.key,to:next?.key??null};
   next=choice.choice;
  }
  selectedRequest=selected.kind!=='achievement'&&!!request&&next?.target===request?.monster?request:null;
  const fallbackKey=selected.deferred?selected.deferred+':'+hunt?.owner+':'+(hunt?.monster??''):null;
  if(fallbackKey!==huntFallback){
   huntFallback=fallbackKey;
   if(fallbackKey)bot.event?.('hunt.farmFallback',{owner:hunt.owner,phase:hunt.phase,
    monster:hunt.monster??null,reason:selected.deferred,alternative:next?.target??null});
  }
  if(!next){
   if(current){current=null;bot.target=null;
    if(['farm','world','combat'].includes(bot.movement.order?.owner))bot.movement.stop();}
   if(selected.deferred)bot.reason='Monsterhunt '+hunt.owner+': '+selected.deferred+'; kein sicheres Farmziel';
   return;
  }
  const planKind=selected.kind==='hunt'?'hunt':selectedRequest?
   (selectedRequest.elixir?'elixir':'material'):'farm';
  const same=current?.key===next.key&&current.kind===planKind&&
   current.objective===(selectedRequest?.objective??null);
  const bounds=next.bounds;
  const proposal={...next,bounds,definition:knowledgeFingerprint([p.G.monsters[next.target],bounds]),
   kind:planKind,objective:selectedRequest?.objective??null,item:selectedRequest?.item??null,
   leader:bot.leader,realm:p.realm(),id:same?current.id:bot.session+':plan:'+(++generation),
   started:same?current.started:Date.now(),
   arrivedAt:sameFarmDestination(current,next)?current.arrivedAt??null:
    samePlace(p.c,next)&&distance(p.c,next)<=65?Date.now():null,
   expires:Date.now()+cfg.general.messageTtlMs*2,
   reason:selected.kind==='hunt'?'Monsterhunt '+hunt.owner+' / '+hunt.monster+' ('+hunt.remaining+' offen)':
    selected.kind==='achievement'?'Tracktrix-Statbonus: '+milestone.milestone.monster+' ('+milestone.milestone.gap+' Score bis '+milestone.milestone.stat+')':
    selected.deferred?'Sicheres Zwischenfarming: '+selected.deferred+' ('+hunt.owner+')':
    selectedRequest?'Gemeinsamer Material-/Elixierbedarf':
    'Sicherer Standort nach EXP/Gold, Reisezeit, Spawnangebot und Gruppeneignung'};
  if(!same){if(current?.objective&&current.objective!==proposal.objective)bot.event('farmOrder.suspended',{objective:current.objective,reason:proposal.objective?'higher-priority-material-work':'merchant-order-unavailable-or-source-not-approved'});bot.target=null;if(!sameFarmDestination(current,proposal)&&['farm','world','combat'].includes(bot.movement.order?.owner))bot.movement.stop();bot.event('plan.selected',{id:proposal.id,target:proposal.target,map:proposal.map,objective:proposal.objective,reason:proposal.reason,score:proposal.score});}current=proposal;
 }
 return {tick,orderedHunt,allowed,candidates,valid,materialAck:()=>materialAck,roles:()=>roles,heartbeat:()=>current?{...current}:null,target:()=>valid(current)?current.target:null,travel(){
  if(!valid(current)||bot.strategy.busy)return false;
  if(cfg.party.enabled&&me.name!==bot.leader)return false;
  // The quest owner's NPC journey is NEVER a farm march destination.
  // A leader at the anchor stays there; an incomplete travelling squad
  // pauses rather than following the departing quest owner.
  if((bot.farmers??[]).some(n=>n!==me.name&&
      bot.transport?.fresh?.(n)?.questVisit===true)){
   if(bot.movement.order?.owner==='quest-escort')bot.movement.stop();
   if(!samePlace(p.c,current)||distance(p.c,current)>65){
    // The quest visitor is not needed to *travel* to the previously
    // approved ordinary farm anchor. Keep the two surviving farmers
    // together and let the independent two-person combat gate decide
    // whether any new neutral fight is admissible after arrival.
    const active=(bot.farmers??[]).filter(n=>n===me.name||
      bot.transport?.fresh?.(n)?.questVisit!==true);
    const safeDuo=active.length===2&&active.every(n=>{
      if(n===me.name)return !p.c.rip&&p.c.hp/Math.max(1,p.c.max_hp)>=.6;
      const h=bot.transport?.fresh?.(n);
      return h?.running&&!h.rip&&h.realm===p.realm()&&
       samePlace(p.c,h)&&distance(p.c,h)<=140&&
       h.hp/Math.max(1,h.max_hp)>=.6&&!(h.threats>0);
    })&&!squadCombatEngaged(bot.monsters(),bot.teamNames,
      active.filter(n=>n!==me.name).map(n=>bot.transport?.fresh?.(n)));
    if(safeDuo){
      bot.reason='Monsterhunt: Zweiergruppe reist zum bestätigten Farmanker';
      if(!bot.movement.order)bot.movement.go({...current,radius:65},'farm');
      return true;
    }
    if(bot.movement.order?.owner==='farm')bot.movement.stop();
    bot.reason='Monsterhunt-Besuch: Zweiergruppe nicht reisefähig';
    return true;
   }
   if(bot.movement.order?.owner==='farm')bot.movement.stop();
   return false;
  }
  if(bot.movement.order?.owner==='scout')return true;
  // Combat near the reached spawn owns local positioning; do not repeatedly
  // send a kiting/chasing farmer back through a building to the anchor.
  if(Number.isFinite(current.arrivedAt)&&samePlace(p.c,current)&&
     distance(p.c,current)<=220&&squadCombatEngaged(bot.monsters(),bot.teamNames))return false;
  if(samePlace(p.c,current)&&distance(p.c,current)<=65){
   // Only after reaching an independently verified, already approved
   // ordinary farm plan may a SOLO farmer make one short local N05 hop.
   // This does not route to speculative or distant respawns.
   if(current.kind==='farm'&&bot.respawns?.scout?.(current)===true)
    return true;
   return false;
  }
  let destination={...current,radius:65};
  if(cfg.party.enabled&&me.name===bot.leader){
   const peers=(bot.farmers??[]).filter(n=>n!==me.name).map(n=>bot.transport?.fresh?.(n)??{name:n});
   // A single native route is smoother and safer than restarting movement
   // after every 85 units. The squad follows the SAME final spawn target.
   // Only *actual* separation/serious injury interrupts the live path.
   const march=assessLiveSquadMarch(p.c,peers,{realm:p.realm(),
    plan:current,maxGap:Math.min(300,Math.max(100,cfg.party.followDistance??180)),hpFloor:.6,crossMapSince,
    mapDistance:map=>mapHops(graph,map,current.map)});
   const stuck=stalledSquadRoutePeer(peers,current,routeProgress);
   if(stuck&&march.ready){
    if(bot.movement.order?.owner==='farm')bot.movement.stop();
    bot.reason='Gruppenmarsch wartet auf festhängendes Mitglied: '+stuck;
    if(marchState.reason!=='teammate-route-stalled'||marchState.peer!==stuck||
      Date.now()-marchState.at>12000){
     marchState={reason:'teammate-route-stalled',peer:stuck,at:Date.now()};
     bot.event?.('party.marchPaused',{plan:current.id,
      reason:'teammate-route-stalled',peer:stuck});
    }
    return true;
   }
   if(!march.ready){
    // When a FOLLOWER is the active hunter, escort that member to Daisy
    // instead of abandoning them for the old farming destination. The
    // other followers receive squadQuestVisit and stay with the Leader.
    if(march.reason==='teammate-on-quest-visit'&&
       !squadCombatEngaged(bot.monsters(),bot.teamNames,peers)){
     const npc=bot.economy?.destination?.('monsterhunter');
     if(npc&&Number.isFinite(npc.x)&&Number.isFinite(npc.y)&&
        bot.strategy?.permittedMap?.(npc.map)!==false){
      if(bot.movement.order?.owner==='farm')bot.movement.stop();
      bot.reason='Monsterhunt: Gruppenbegleitung zu Daisy ('+march.peer+')';
      if(!samePlace(p.c,npc)||distance(p.c,npc)>75){
       if(!bot.movement.order)bot.movement.go({...npc,radius:65},'quest-escort');
      }else if(bot.movement.order?.owner==='quest-escort')bot.movement.stop();
      return true;
     }
    }
    if(['farm','quest-escort'].includes(bot.movement.order?.owner))bot.movement.stop();
    bot.reason='Gruppenmarsch pausiert (echte Trennung/Gefahr): '+march.reason+' / '+(march.peer??'Team');
    if(march.reason!==marchState.reason||march.peer!==marchState.peer||Date.now()-marchState.at>12000){
     marchState={reason:march.reason,peer:march.peer,at:Date.now()};
     bot.event?.('party.marchPaused',{plan:current.id,reason:march.reason,
      peer:march.peer??null,gap:march.gap??null,hpRatio:march.hpRatio??null});
    }
    return true;
   }
   if(bot.movement.order?.owner==='quest-escort')bot.movement.stop();
   if(bot.movement.order?.owner==='farm'){
    // Check health/roster/leash during a live smart route on EVERY tick.
    // A full native route may not outrun the healer.
    bot.reason='Gemeinsamer Gruppenmarsch: '+current.target;
    return true;
   }
   // Route to the real spawn, not a geometrically projected 85-unit
   // intermediate goal. Only seek verified local detours after a genuine
   // smart_move failure for the full route.
   const mainRoute={...current,radius:65};
   const recentFailure=bot.movement.failedRecently?.(mainRoute,'farm')===true;
   const route=recentFailure?chooseMarchWaypoint(p.c,current,peers,{
    canMove:(x,y)=>p.has?.('can_move_to')===true&&
      p.call('can_move_to',x,y)===true,
    failed:point=>bot.movement.failedRecently?.(point,'farm')===true,
    maxGap:300,step:85}):
    {point:mainRoute,reason:'continuous-native-squad-route'};
   if(!route.point){
    const now=Date.now();if(!routeBlockedAt)routeBlockedAt=now;
    if(now-routeBlockedAt>=45000){
     const old=current,until=now+300000;
     dangerousAreas.set(old.key,until);
     bot.event?.('plan.quarantined',{key:old.key,target:old.target,map:old.map,
      until,reason:'repeated-unreachable-squad-march-route'});
     bot.event?.('party.marchRouteAbandoned',{plan:old.id,blockedMs:now-routeBlockedAt,
      reason:'no-navigable-safe-route'});
     bot.movement.stop();current=null;last=0;routeBlockedAt=0;
     return true;
    }
    bot.reason='Gruppenmarsch: Weg blockiert, sichere Umleitung fehlt';
    if(Date.now()-marchState.at>12000||marchState.reason!==route.reason){
     marchState={reason:route.reason,peer:'',at:Date.now()};
     bot.event?.('party.marchRouteBlocked',{plan:current.id,
      reason:route.reason,map:p.c.map,x:p.c.x,y:p.c.y});
    }
    return true;
   }
   routeBlockedAt=0;destination=route.point;
   if(route.reason==='native-path-around-obstacle'){
    if(Date.now()-marchState.at>12000||marchState.reason!==route.reason){
     marchState={reason:route.reason,peer:'',at:Date.now()};
     bot.event?.('party.marchDetour',{plan:current.id,
      reason:route.reason,map:p.c.map,x:p.c.x,y:p.c.y,
      destination:current.key});
    }
   }
  }
  bot.reason='Gemeinsamer Gruppenmarsch: '+current.target;
  bot.movement.go(destination,'farm');return true;
 },materialActive:()=>!!current?.objective,wantsCombat:()=>{if(!current?.objective)return true;const r=materialRequests().find(r=>r.objective===current.objective);if(!r)return current.kind==='elixir';const held=bot.production?.progress?.().find(q=>q.objective===r.objective)?.quantity??0;
  return Number.isSafeInteger(held)&&held>=0&&held<materialQuotaCap(r,me.name,bot.session);},lostKill(monster){if(current?.target===monster&&area&&history[area])history[area].lostKills=(history[area].lostKills??0)+1;},failed(reason){if(area&&history[area])history[area].deaths++;
   if(current){if(/Gefährlich|Aggro|Tod|stark|risk|Gefahr|gefähr/i.test(reason)){const until=Date.now()+Math.max(600000,cfg.farming.deathWindowMs??600000);dangerousAreas.set(current.key,until);bot.event('plan.quarantined',{key:current.key,target:current.target,map:current.map,until,reason});}bot.event('plan.failed',{id:current.id,reason});}current=null;last=0;},status:()=>({current:current?{...current}:null,roles,areas:Object.keys(history).length,pressure:summarizeSpawnPressure(ranking).pressure,
   pressureEvidence:summarizeSpawnPressure(ranking),rawLocalPressure:absence,hunt:orderedHunt(),huntFallback:huntFallback||null,switchAdvice,ranking:ranking.slice(0,5),mapEdges:graph.edges.length}),close(){current=null;last=0;}};
}
