import {combatMembers,compositionOptions,farmThroughput} from './composition.mjs';
import {verifiedTeamRoleOwner,chooseFarmAreaSwitch,chooseHuntSpawn} from './spawn-choice.mjs';
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
// The same semantic team-gear identity must index both measured and
// ranked spawn history; heartbeat timestamps are not gear changes.
export function farmAreaHistoryKey(realm,hour,spawnKey,gears){
 return realm+':'+hour+':'+spawnKey+':'+knowledgeFingerprint(gears.map(semanticGear));
}
import {huntForFarmer,advanceHuntCycle,skipHuntWithoutSpawn,advancePastSkippedHunts,huntDeadlineStatus} from './hunt-rotation.mjs';
// A pending, unobservable or unsafe monsterhunt may not starve the shared
// farming plan. Only the verified quest monster earns quest priority.
// Existing safely ranked farm targets remain available as temporary work.
export function selectHuntArea(ranking,hunt){
 const ordinary=ranking?.[0]??null;
 if(!hunt)return {area:ordinary,kind:'farm',deferred:null};
 if(hunt.phase==='combat'){
  const matching=ranking?.find(row=>row.target===hunt.monster);
  return matching?{area:matching,kind:'hunt',deferred:null}:
   {area:ordinary,kind:'farm',deferred:'NO_SAFE_HUNT_SPAWN'};
 }
 const deferred=hunt.phase==='turnin'?'HUNT_TURNIN_PENDING':
  hunt.phase==='acquire'?'HUNT_ACQUIRE_PENDING':'HUNT_STATUS_UNVERIFIED';
 return {area:ordinary,kind:'farm',deferred};
}

// Balanced mode should not choose extremely weak spawns merely because
// cheap, frequent kills dominate a 50/50 geometric XP/Gold score. Retain
// positive Gold weight, verified throughput and full travel/pressure costs.
export function balancedFarmUtility(xp,gold){
 if(!Number.isFinite(xp)||xp<0||!Number.isFinite(gold)||gold<0)return 0;
 return Math.pow(Math.max(1,xp),.65)*Math.pow(Math.max(1,gold),.35);
}
export function createTeamPlan(bot){
 const {p,cfg,me}=bot,key='albot:teamplan:'+me.name;let current=null,last=0,generation=0,history=p.read(key+':areas')??{},area=null,previous=Date.now(),lastXp=p.c.xp??0,lastGold=p.c.gold??0,absence=0,samples=0,lastSave=0,ranking=[],huntFallback='',switchAdvice=null,definition='',graph={edges:[]},roles={},validEpoch=-1,validCache=new Map(),dangerousAreas=new Map(),materialAck=null,lastMaterialAck='';
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
 function allowed(id){return candidates().includes(id)&&materialEvent(p.G,id,p.root.S??p.parent.S).active&&bot.strategy.safeTarget(id,undefined,true,true);}
 function materialRequests(){return bot.transport.fresh(cfg.party.merchant)?.materials??[];}
 function valid(plan){if(!Number.isInteger(bot.decisionEpoch))return validRaw(plan);if(validEpoch!==bot.decisionEpoch){validEpoch=bot.decisionEpoch;validCache.clear();}if(!validCache.has(plan))validCache.set(plan,validRaw(plan));return validCache.get(plan);}
 function validRaw(plan){if(!plan||plan.realm!==p.realm()||plan.expires<=Date.now()||plan.leader!==bot.leader||!['farm','material','elixir','hunt'].includes(plan.kind)||!Number.isFinite(plan.x)||!Number.isFinite(plan.y)||!bot.strategy.permittedMap(plan.map)||!allowed(plan.target))return false;
  const source=spawnLocations(p.G,[plan.target],cfg.world.excludedMaps,cfg.farming.pvp).find(s=>s.key===plan.key);if(!source||areaQuarantined(plan.key)||plan.definition!==source.definition||bot.content?.approve('farm:'+plan.map+':'+plan.target,[p.G.monsters[plan.target],p.G.maps[plan.map]?.monsters?.filter(s=>s.type===plan.target)])===false)return false;
  if(!plan.objective)return true;if(plan.kind==='elixir')return bot.elixirs?.objective()?.objective===plan.objective||bot.transport.fresh(plan.leader)?.elixir?.item===plan.item;
  return materialRequests().some(r=>r.objective===plan.objective&&
    (!r.expires||r.expires>Date.now())&&r.monster===plan.target&&
    materialRequestHasWork(r,bot.farmers));
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
  observe();if(cfg.party.enabled&&me.name!==bot.leader){const h=bot.transport.fresh(bot.leader);const next=h?.running&&!h.rip? h?.farmPlan:null;if(valid(next)){const changed=!current||current.id!==next.id;current={...next};roles=h.roles??{};if(changed){if(['farm','world','combat','follow'].includes(bot.movement.order?.owner))bot.movement.stop();bot.target=null;bot.event('plan.adopt',{id:current.id,target:current.target,leader:bot.leader,reason:current.reason});}}else current=null;return;}
  if(Date.now()-last<Math.min(10000,cfg.world.cacheTtlMs)&&valid(current))return;last=Date.now();capabilities();const raw=knowledgeFingerprint([p.G.monsters,p.G.maps]);if(raw!==definition){definition=raw;graph=mapGraph(p.G);if(current&&!valid(current)){bot.event('plan.drift',{id:current.id,reason:'Spawn-/Monsterdefinition geändert'});current=null;}}
  const materials=materialRequests(),requests=materials.filter(r=>materialRequestHasWork(r,bot.farmers)&&(!r.expires||r.expires>Date.now())&&allowed(r.monster)&&(!r.sourceFingerprint||r.sourceFingerprint===knowledgeFingerprint([p.G.monsters[r.monster],p.G.drops?.monsters?.[r.monster]])));const elixir=bot.elixirs?.objective();const request=requests.sort((a,b)=>(b.priority??0)-(a.priority??0)||(b.utilityPerHour??0)-(a.utilityPerHour??0))[0]??elixir;
  const combat=combatMembers(bot,true),composition=compositionOptions(bot,true);
  // Availability, not a legacy global AoE opt-out, governs farmer density.
  const aoeAvailable=(bot.farmers??[]).some(name=>{
   const cap=name===me.name?bot.capabilities?.snapshot?.():
     bot.transport?.fresh?.(name)?.capabilities;
   return (cap?.aoe?.length??0)>0;
  });
  let hunt=orderedHunt();
  const types=[...new Set([...candidates(),...(hunt?.phase==='combat'&&p.G.monsters?.[hunt.monster]?[hunt.monster]:[])])].filter(allowed),locations=spawnLocations(p.G,types,cfg.world.excludedMaps,cfg.farming.pvp),teamDps=Math.max(1,combat.reduce((n,c)=>n+(c.attack??0)*(c.frequency??1),0));
  ranking=locations.filter(s=>!areaQuarantined(s.key)&&bot.content?.approve('farm:'+s.map+':'+s.target,[p.G.monsters[s.target],p.G.maps[s.map]?.monsters?.filter(x=>x.type===s.target)])!==false).map(s=>{const m=p.G.monsters[s.target],density=Math.max(1,Math.min(s.count,(cfg.party.aoe||aoeAvailable)?cfg.party.aoeMaxTargets??1:1,cfg.farming.maxAggro??1)),fit=farmThroughput(m,combat,density,composition),seconds=Math.max(1,m.hp/Math.max(1,fit.effectiveDps)),learned=verifiedAreaHistory(history[areaKey(s.key)]),hops=mapHops(graph,p.c.map,s.map),trip=s.map===p.c.map?distance(p.c,s)/Math.max(1,p.c.speed??40):Number.isFinite(hops)?hops*60:120;const {empty,foreign}=areaPressure(learned,Date.now(),(cfg.farming.knowledgeFreshMs??21600000)*12);
   const killsPerHour=Math.min(3600/seconds,s.count*3600/(seconds*density+Math.max(0,m.respawn??0))),theoretical=(m.xp??0)*killsPerHour,empirical=learned?.seconds>=60&&Date.now()-learned.at<(cfg.farming.knowledgeFreshMs??21600000)*12?learned.xp*3600/learned.seconds:theoretical,freshness=learned?Math.max(0,1-(Date.now()-learned.at)/(cfg.farming.knowledgeFreshMs??21600000)/12):0,xp=theoretical*(1-.3*freshness)+empirical*.3*freshness,gold=expectedMonsterGold(p.G,s.target)*killsPerHour*(1-.3*freshness)+(learned?.seconds>=60?(learned.gold??0)*3600/learned.seconds:expectedMonsterGold(p.G,s.target)*killsPerHour)*.3*freshness;const utility=request&&s.target===request.monster?((request.utilityPerHour??0)>0?request.utilityPerHour*(cfg.farming.mode==='xp'?(cfg.production.materialXpPerGold??10):1):Math.max(1,...types.map(id=>(p.G.monsters[id].xp??0)*3600/Math.max(1,p.G.monsters[id].hp/teamDps)))*(cfg.production.materialPreference??1.25)):cfg.farming.mode==='xp'?xp:cfg.farming.mode==='gold'?gold:balancedFarmUtility(xp,gold);return {...s,score:utility*(bot.adaptive?.factor(s.target)??1)/(1+trip/300+empty*2+foreign*.2+(learned?.deaths??0)+(learned?.lostKills??0)*.05)*(request?1:1+(bot.progression?.bonus(s.target,s.map)??0)),xpPerHour:xp,goldPerHour:gold,composition:fit,travelSeconds:trip,evidenceSeconds:learned?.seconds??0,
   pressureRatio:Math.max(empty,foreign>=2?.75:0),
   pressure:empty>.6?'spawn-starved':foreign>2?'contested':'healthy'};}).filter(r=>Number.isFinite(r.score)).sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key));
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
      reason:infeasibleHunt?'Monsterhunt-Zeitfenster / Server nicht passend: '+huntHorizon.state:
        'Kein freigegebener sicherer Spawn; Auftrag bleibt bestehen',
       remainingMs:hunt.remainingMs??null,neededMs:huntHorizon?.neededMs??null});
     hunt=orderedHunt();
    }else bot.event?.('hunt.persistenceBlocked',{owner:hunt.owner,
     reason:'Kein Wechsel ohne dauerhaft gespeicherten Rotationszustand'});
   }
  }
  const selected=selectHuntArea(ranking,hunt);
  let next=selected.area,selectedRequest=!hunt&&next?.target===request?.monster?request:null;
  const old=ranking.find(r=>r.key===current?.key);
  // Keep existing hold-time for safe ordinary farming while waiting for
  // the active farmer's quest NPC or an independently verified hunt spawn.
  const holdOrdinary=selected.kind==='farm'&&current?.kind==='farm';
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
  if(holdOrdinary&&old&&valid(current)&&!selectedRequest){
   const choice=chooseFarmAreaSwitch({
    current,candidate:next,currentRank:old,now:Date.now(),
    holdMs:cfg.farming.planHoldMs??60000,
    improvement:cfg.farming.switchImprovement??.2
   });
   switchAdvice={reason:choice.reason,threshold:choice.threshold,
    from:old.key,to:next?.key??null};
   next=choice.choice;
  }
  selectedRequest=!hunt&&next?.target===request?.monster?request:null;
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
   started:same?current.started:Date.now(),expires:Date.now()+cfg.general.messageTtlMs*2,
   reason:selected.kind==='hunt'?'Monsterhunt '+hunt.owner+' / '+hunt.monster+' ('+hunt.remaining+' offen)':
    selected.deferred?'Sicheres Zwischenfarming: '+selected.deferred+' ('+hunt.owner+')':
    selectedRequest?'Gemeinsamer Material-/Elixierbedarf':
    'Sicherer Standort nach EXP/Gold, Reisezeit, Spawnangebot und Gruppeneignung'};
  if(!same){bot.target=null;if(['farm','world','combat'].includes(bot.movement.order?.owner))bot.movement.stop();bot.event('plan.selected',{id:proposal.id,target:proposal.target,map:proposal.map,objective:proposal.objective,reason:proposal.reason,score:proposal.score});}current=proposal;
 }
 return {tick,orderedHunt,allowed,candidates,valid,materialAck:()=>materialAck,roles:()=>roles,heartbeat:()=>current?{...current}:null,target:()=>valid(current)?current.target:null,travel(){if(!valid(current)||bot.strategy.busy)return false;if(cfg.party.enabled&&me.name!==bot.leader)return false;if(me.name===bot.leader&&cfg.party.enabled&&cfg.party.waitForTeam&&bot.farmers.some(n=>n!==me.name&&(!bot.transport.fresh(n)?.running||bot.transport.fresh(n)?.rip||bot.transport.fresh(n)?.realm!==p.realm()))){bot.reason='Warte auf aktive Gruppe vor Farmreise';return true;}// A 250-unit exit stranded ranged farmers outside verified spawn areas.
  if(samePlace(p.c,current)&&distance(p.c,current)<=Math.min(85,Math.max(40,(cfg.farming.orbitRadius??220)/2)))return false;bot.reason='Gemeinsamer Plan: '+current.target;bot.movement.go({...current,radius:65},'farm');return true;},materialActive:()=>!!current?.objective,wantsCombat:()=>{if(!current?.objective)return true;const r=materialRequests().find(r=>r.objective===current.objective);if(!r)return current.kind==='elixir';const held=bot.production?.progress?.().find(q=>q.objective===r.objective)?.quantity??0;
  return Number.isSafeInteger(held)&&held>=0&&held<materialQuotaCap(r,me.name);},lostKill(monster){if(current?.target===monster&&area&&history[area])history[area].lostKills=(history[area].lostKills??0)+1;},failed(reason){if(area&&history[area])history[area].deaths++;
   if(current){if(/Gefährlich|Aggro|Tod|stark|risk|Gefahr|gefähr/i.test(reason)){const until=Date.now()+Math.max(600000,cfg.farming.deathWindowMs??600000);dangerousAreas.set(current.key,until);bot.event('plan.quarantined',{key:current.key,target:current.target,map:current.map,until,reason});}bot.event('plan.failed',{id:current.id,reason});}current=null;last=0;},status:()=>({current:current?{...current}:null,roles,areas:Object.keys(history).length,pressure:absence,hunt:orderedHunt(),huntFallback:huntFallback||null,switchAdvice,ranking:ranking.slice(0,5),mapEdges:graph.edges.length}),close(){current=null;last=0;}};
}
