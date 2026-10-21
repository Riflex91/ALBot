import {neutralPullReadiness,verifiedFollowerOneShot,verifiedFollowerBoundedSpawn,assessFollowerSharedSpawn,verifiedLowThreatAimedSet} from './team-readiness.mjs';
import {assessQuestDetachment} from './quest-detachment.mjs';
import {distance,samePlace} from '../core/policy.mjs';
import {knowledgeFingerprint,semanticGear} from '../world/knowledge.mjs';

/**
 * Conservative admission for an entire proposed pull, not a per-monster gate.
 * New monsters have no known aggro owner: budget every one against the puller.
 * Unknown damage, position or required support blocks multi-pulls (single
 * targets remain governed by the existing farm/quest policy).
 */
export function evaluateMultiPullSafety({actor,team=[],targets=[],G={},now=Date.now(),healing=true}={}){
 const monsters=(targets??[]).filter(Boolean);
 if(monsters.length<=1)return {safe:true,reason:'single-target'};
 if(!actor||!Number.isFinite(actor.hp)||!(actor.max_hp>0)||
    monsters.length>5||!Array.isArray(team)||team.length<2)
  return {safe:false,reason:'multi-pull-team-unverified'};
 const verified=[];
 for(const member of team){
  if(!member?.name||member.rip||member.running===false||
     !samePlace(actor,member)||!Number.isFinite(member.x)||
     !Number.isFinite(member.y)||!Number.isFinite(member.hp)||
     !(member.max_hp>0)||member.hp/member.max_hp<.8||
     member.received!==undefined&&(!Number.isFinite(member.received)||
       member.received>now||now-member.received>4000)||
     !Number.isFinite(member.stats?.attack)||
     !(member.stats?.frequency>0)||!(member.stats?.range>0))
   return {safe:false,reason:'multi-pull-peer-unverified',member:member?.name};
  verified.push(member);
 }
 const healer=healing?verified.find(m=>m.class==='priest'):null;
 if(healing&&healer){
  const reach=healer.combatSupport?.healRange;
  if(healer.combatSupport?.healReady!==true||!(reach>0)||
     distance(healer,actor)>Math.max(1,reach-25)||
     !(healer.stats?.heal>0)||!(healer.mp>0))
   return {safe:false,reason:'multi-pull-priest-out-of-heal-range'};
 }
 let hpTotal=0,incoming=0;
 for(const monster of monsters){
  const meta=G.monsters?.[monster.mtype];
  if(!monster?.id||!samePlace(actor,monster)||!(monster.hp>0)||
     !(meta?.attack>=0)||!(meta?.frequency>0)||!(meta?.hp>0)||
     !Number.isFinite(meta.attack)||!Number.isFinite(meta.frequency)||
     !Number.isFinite(monster.x)||!Number.isFinite(monster.y))
   return {safe:false,reason:'multi-pull-monster-unverified',monster:monster?.mtype};
  hpTotal+=monster.hp;
  // Worst-case aggro is concentrated on the puller. Do not credit unverified
  // armor/dodge, uncast buffs, future potions or unmeasured critical strikes.
  incoming+=meta.attack*meta.frequency*1.45;
 }
 const dps=verified.reduce((sum,m)=>{
  if(healer?.name===m.name)return sum; // Priest heals or attacks, never both
  if(monsters.some(monster=>distance(m,monster)>m.stats.range-10))
    return sum;
  return sum+m.stats.attack*m.stats.frequency*.55;
 },0);
 if(!(dps>0))return {safe:false,reason:'multi-pull-no-verified-dps'};
 const healCredit=healer?
  Math.min(incoming*.40,healer.stats.heal*
    healer.stats.frequency*.38):0;
 const projectedSeconds=hpTotal/dps*1.5+2;
 const exposure=Math.max(0,incoming-healCredit)*projectedSeconds;
 const budget=actor.hp-Math.max(actor.max_hp*.55,actor.max_hp-actor.hp);
 const safe=budget>0&&exposure<budget&&actor.hp/actor.max_hp>=.85;
 return {safe,reason:safe?'bounded-pull-risk':'multi-pull-survival-budget',
  count:monsters.length,incomingDps:Math.ceil(incoming),
  conservativeDps:Math.floor(dps),healCredit:Math.floor(healCredit),
  projectedSeconds:+projectedSeconds.toFixed(2),
  exposure:Math.ceil(exposure),hpBudget:Math.floor(Math.max(0,budget))};
}

// Promote one new concurrent pull only after the previous size has a
// completed, failure-free episode. Unlike an XP-only gate, a successful
// size-two encounter can progress to size three even when both sizes have
// similar short-window XP rates. Any measured failure blocks escalation.
export function verifiedAdaptiveCapacity(profiles,context,max,healthy,enabled=true){
 const ceiling=Number.isFinite(max)?Math.max(1,Math.floor(max)):1;
 let capacity=1;
 for(let size=2;size<=ceiling;size++){
  const previous=profiles?.[context+':'+(size-1)];
  const row=profiles?.[context+':'+size];
  const samples=Number.isSafeInteger(row?.samples)?row.samples:0;
  const failures=Number.isSafeInteger(row?.failures)?row.failures:0;
  if(samples>0&&failures>0)break; // fail closed; never probe higher sizes
  if(samples>0&&failures===0){
   // Size has been observed safe; it may be kept while testing a new size.
   capacity=size;continue;
  }
  // Only one unmeasured size may be tried in a healthy complete team.
  if(enabled&&healthy&&previous?.samples>=1&&previous.failures===0){
   capacity=size;
  }
  break;
 }
 return capacity;
}
// An observed, complete healthy team and three immediately verified normal
// targets permit a bounded 3shot test even when the persisted learning key
// changed because of gear, roster or context. A known failed 3-target episode
// still vetoes the attempt. No boss/event/foreign or unknown-risk pull.
export function safeThreeShotOpportunity({healthy,max,failed,planned,visible,safe,teamNames=[],minTargets=3}){
 return !!(healthy&&max>=minTargets&&[2,3].includes(minTargets)&&!failed&&planned&&
  (visible??[]).filter(m=>m?.id&&m.hp>0&&!m.dead&&
   m.type==='monster'&&m.mtype===planned&&(!m.target||teamNames.includes(m.target))&&safe(m))
   .filter((m,i,a)=>a.findIndex(x=>x.id===m.id)===i).length>=minTargets);
}
export function createEncounter(bot){
 const key='albot:pull:'+bot.me.name;let profiles=bot.p.read(key)??{},active=null,phase='RECOVER',capacity=1,context='',lastSave=0;const gearEvidence=new Map();
 function self(){const c=bot.p.c;return {...c,class:c.ctype,running:bot.running,
  received:Date.now(),stats:{attack:c.attack,frequency:c.frequency,range:c.range,
   heal:c.heal},combatSupport:bot.transport?.combatSupport?.()};}
 function riskRoster(){return (bot.farmers??[]).map(n=>n===bot.me.name?
  self():bot.transport?.fresh?.(n)).filter(Boolean);}
 function unsafeKey(id){return 'unsafe:'+bot.p.c.map+':'+id;}
 function unsafeUntil(id){return profiles[unsafeKey(id)]?.until??0;}
 function holdUnsafe(id,reason){
  if(!id)return;
  const until=Date.now()+30*60*1000,k=unsafeKey(id);
  if((profiles[k]?.until??0)>=until-5000)return;
  profiles[k]={until,reason,at:Date.now()};
  bot.p.write?.(key,profiles);
  bot.event?.('combat.multiPullQuarantined',{target:id,until,reason});
 }
 function approvePullSet(targets){
  const planned=(targets??[]).filter(m=>m?.hp>0&&!m.dead);
  if(planned.length<=1)return {safe:true,reason:'single-target'};
  if(planned.some(m=>unsafeUntil(m.mtype)>Date.now()))
   return {safe:false,reason:'multi-pull-quarantine'};
  const last=bot.combatAssessment?.status?.()?.last;
  if(last&&Date.now()-last.at<5000&&last.viable===false)
   return {safe:false,reason:'active-negative-survival-budget'};
  const result=evaluateMultiPullSafety({actor:bot.p.c,team:riskRoster(),
   targets:planned,G:bot.p.G,healing:bot.cfg.party?.healing!==false});
  return result;
 }
 function members(){return bot.farmers.map(n=>n===bot.me.name?{name:n,running:bot.running,hp:bot.p.c.hp,max_hp:bot.p.c.max_hp,mp:bot.p.c.mp,max_mp:bot.p.c.max_mp,class:bot.p.c.ctype,level:bot.p.c.level,gear:bot.gear?.snapshot(),capabilities:bot.capabilities?.snapshot()}:bot.transport.fresh(n)).filter(h=>h?.running&&!h.rip);}
 function complete(failed){if(!active)return;
  if(failed&&active.peak>1)holdUnsafe(active.target,'failed-multi-encounter');const row=profiles[active.key]??{samples:0,seconds:0,xp:0,failures:0};row.samples++;row.seconds+=(Date.now()-active.at)/1000;row.xp+=Math.max(0,(bot.p.c.xp??0)-active.xp);row.failures+=failed?1:0;bot.adaptive?.episode({target:active.target,contextKey:active.adaptiveContext,seconds:(Date.now()-active.at)/1000,reward:Math.max(0,(bot.p.c.xp??0)-active.xp),failed});row.at=Date.now();profiles[active.key]=row;active=null;profiles=Object.fromEntries(Object.entries(profiles).sort((a,b)=>b[1].at-a[1].at).slice(0,96));if(Date.now()-lastSave>30000){lastSave=Date.now();bot.p.write(key,profiles);}}
 function tick(){const detachment=assessQuestDetachment(bot),ms=members(),target=bot.strategy?.heartbeat?.()?.target??bot.teamPlan?.target(),mobs=bot.monsters().filter(m=>bot.teamNames.includes(m.target)),healthy=!detachment&&ms.length===bot.farmers.length&&ms.every(h=>h.hp/h.max_hp>=(bot.cfg.farming.pullHp??.8)&&h.mp/Math.max(1,h.max_mp)>=(bot.cfg.farming.pullMp??.5));
  context=knowledgeFingerprint([ms.map(h=>{const gear=semanticGear(h.gear);if(gear?.[3]?.length)gearEvidence.set(h.name,gear[3]);return [h.name,h.class??h.gear?.class,h.level??h.gear?.level,gearEvidence.get(h.name)??null];}),target,bot.p.G.monsters?.[target]]);
  const aoe=ms.flatMap(h=>h.capabilities?.sustainable? h.capabilities.sustainable.filter(id=>['3shot','5shot'].includes(id)).map(id=>({id,capacity:id==='3shot'?3:5})).concat((h.capabilities.aoe??[]).filter(x=>!['3shot','5shot'].includes(x.id))):h.combatSupport?.aoe??h.capabilities?.aoe??[]),max=(bot.me?.role==='farmer'||bot.cfg.party.aoe)&&aoe.length?Math.min(bot.cfg.farming.maxAggro,bot.cfg.party.aoeMaxTargets,Math.max(...aoe.map(s=>s.capacity))):1;
  capacity=detachment?1:verifiedAdaptiveCapacity(profiles,context,max,healthy,
   bot.cfg.farming.adaptivePull!==false);
  for(const probe of bot.cfg.world?.risk==='aggressive'?[2,3]:[3]){
  const noThreeFailure=!Array.from({length:probe},(_,i)=>profiles[context+':'+(i+1)]).some(row=>row?.failures>0);
  // Probe only independently verified same-spawn targets. Aggressive mode
  // can build a beneficial two-target cast while the third is out of range.
  // Neither cooldown telemetry nor a new learning key grants a risky pull.
  if(!detachment&&bot.me.name===bot.leader&&bot.me.role==='farmer'&&
    safeThreeShotOpportunity({healthy,max,minTargets:probe,failed:!noThreeFailure,
      planned:target,visible:bot.monsters(),teamNames:bot.teamNames,safe:m=>
       !bot.recovering&&bot.teamPlan?.wantsCombat?.()!==false&&
       !bot.p.parent?.is_pvp&&!bot.p.G.maps?.[m.map]?.pvp&&
       m.map===bot.p.c.map&&(m.in??m.map)===(bot.p.c.in??bot.p.c.map)&&
       distance(bot.p.c,m)<(bot.p.G.skills?.['3shot']?.range??bot.p.c.range)-5&&
       bot.strategy?.safeTarget?.(m.mtype,m,true)===true&&
       bot.threats?.permitted?.(m)!==false&&
       bot.navigation?.permitted?.(m)!==false}))
    capacity=Math.max(probe,capacity);
  }
  const bad=bot.combatAssessment?.status?.()?.last;
  if(mobs.length>1&&bad?.viable===false&&Date.now()-bad.at<5000)
   holdUnsafe(mobs[0]?.mtype,'negative-survival-budget');
  if(capacity>1){
   const visible=bot.monsters().filter(m=>m?.hp>0&&!m.dead&&
    m.mtype===target&&(!m.target||bot.teamNames.includes(m.target))&&
    samePlace(bot.p.c,m)&&distance(bot.p.c,m)<(bot.p.G.skills?.['3shot']?.range??bot.p.c.range)-5);
   if(visible.length>=2&&!approvePullSet(visible.slice(0,Math.min(capacity,visible.length))).safe)
    capacity=1;
   if(unsafeUntil(target)>Date.now())capacity=1;
  }
  if(bot.recovering||bot.p.c.rip||active&&ms.length!==bot.farmers.length||ms.some(h=>h.hp/h.max_hp<(bot.cfg.farming.restBelow??.3)||h.mp/Math.max(1,h.max_mp)<.15)){phase=mobs.length?'ABORT':'RECOVER';if(active)complete(true);}else if(!mobs.length){if(active)complete(false);phase=healthy?'BUILD':'RECOVER';}else if(!healthy)phase='HOLD';else if(mobs.length<capacity)phase='BUILD';else phase=mobs.every(m=>m.hp<(bot.p.c.attack??1)*2)?'FINISH':'BURN';
  if(active&&mobs.length)active.peak=Math.max(active.peak??1,mobs.length);
  if(active&&mobs.length)active.key=context+':'+Math.max(Number(active.key.split(':').at(-1)),Math.min(max,mobs.length));if(mobs.length&&!active)active={target,adaptiveContext:bot.adaptive?.context(),key:context+':'+Math.max(1,Math.min(max,mobs.length)),at:Date.now(),xp:bot.p.c.xp??0,peak:mobs.length};
 }
 function soloOneShot(m,skill=null){
  if(!m||m.target||bot.me?.role!=='farmer'||bot.me.name===bot.leader||
     !bot.cfg.party?.enabled||!bot.running||bot.p.c.rip||
     bot.journal||bot.inventoryBlocked||bot.logistics?.reserved||
     bot.account?.rotationPending?.()||bot.teamTravel?.blocked||
     bot.strategy?.busy||bot.recovering||
     bot.teamPlan?.wantsCombat?.()===false||
     typeof bot.free!=='function'||
     typeof bot.free!=='function'||
     bot.free()<=(bot.cfg.farming?.freeSlots??0)||
     bot.combatAssessment?.emergency?.()?.active)return null;
  const plan=bot.teamPlan?.heartbeat?.();
  if(!plan||bot.teamPlan?.target?.()!==m.mtype||
     bot.monsters().some(x=>x.hp>0&&x.target&&bot.teamNames.includes(x.target)))
    return null;
  const leader=bot.transport?.fresh?.(bot.leader);
  const peers=(bot.farmers??[]).filter(n=>n!==bot.me.name)
   .map(n=>bot.transport?.fresh?.(n));
  if(peers.length!==(bot.farmers??[]).length-1)return null;
  if(bot.strategy?.safeTarget?.(m.mtype,m,true)!==true)return null;
  return verifiedFollowerOneShot(bot.p.c,m,{
    plan,leader,peers,realm:bot.p.realm(),game:bot.p.G,skill});
 }
 // Independent local spawn cleanup is permitted for a healthy, verified
 // follower after the exact one-shot path. Unlike ordinary multi-pull
 // escalation it is bounded to one active enemy per follower and no more
 // than three concurrent party threats, with live conservative team risk.
 function soloBoundedSpawn(m,skill=null){
  if(!m||m.target||bot.me?.role!=='farmer'||bot.me.name===bot.leader||
     !bot.cfg.party?.enabled||!bot.running||bot.p.c.rip||
     bot.p.parent?.is_pvp||bot.p.G.maps?.[bot.p.c.map]?.pvp||
     bot.journal||bot.inventoryBlocked||bot.logistics?.reserved||
     bot.account?.rotationPending?.()||bot.teamTravel?.blocked||
     bot.strategy?.busy||bot.recovering||
     bot.teamPlan?.wantsCombat?.()===false||
     typeof bot.free!=='function'||
     bot.free()<=(bot.cfg.farming?.freeSlots??0)||
     bot.combatAssessment?.emergency?.()?.active)return null;
  const plan=bot.teamPlan?.heartbeat?.();
  if(!plan||bot.teamPlan?.target?.()!==m.mtype||
     bot.monsters().some(x=>x.hp>0&&x.target===bot.p.c.name))
    return null;
  if(bot.strategy?.safeTarget?.(m.mtype,m,true)!==true)return null;
  const leader=bot.transport?.fresh?.(bot.leader);
  const peers=(bot.farmers??[]).filter(n=>n!==bot.me.name)
   .map(n=>bot.transport?.fresh?.(n));
  if(peers.length!==(bot.farmers??[]).length-1)return null;
  const proof=verifiedFollowerBoundedSpawn(bot.p.c,m,{
    plan,leader,peers,realm:bot.p.realm(),game:bot.p.G,skill});
  if(!proof)return null;
  const engaged=bot.monsters().filter(x=>x.hp>0&&!x.dead&&
    x.target&&bot.teamNames.includes(x.target));
  if(engaged.length>=Math.min(3,bot.cfg.farming?.maxAggro??1))
    return null;
  if(engaged.length&&approvePullSet([...engaged,m]).safe!==true)
    return null;
  return proof;
 }
 // A shared farming plan is a destination and species contract, not a
 // leader-exclusive combat target. Every assembled, healthy farmer may
 // independently handle one sufficiently harmless nearby normal monster.
 // Keep this separate from the legacy one-hit gate and adaptive group
 // multi-pull state, whose exact-kill and phase assumptions are different.
 function sharedSpawnAssessment(m){
  const deny=reason=>({allowed:false,reason});
  if(!m||bot.me?.role!=='farmer'||bot.me.name===bot.leader||
     !bot.cfg.party?.enabled||!bot.running||bot.p.c.rip||
     bot.p.parent?.is_pvp||bot.p.G.maps?.[bot.p.c.map]?.pvp)
   return deny('not-active-overworld-follower');
  if(bot.journal||bot.inventoryBlocked||bot.logistics?.reserved||
     bot.account?.rotationPending?.()||bot.teamTravel?.blocked||
     bot.strategy?.busy||bot.recovering||
     bot.combatAssessment?.emergency?.()?.active||
     bot.teamPlan?.wantsCombat?.()===false||
     bot.free?.()<=(bot.cfg.farming?.freeSlots??0))
   return deny('follower-operational-hold');
  const plan=bot.teamPlan?.heartbeat?.();
  if(!plan||bot.teamPlan?.target?.()!==m.mtype)
   return deny('monster-not-current-farm-species');
  if(bot.strategy?.safeTarget?.(m.mtype,m,true)!==true)
   return deny('strategy-declines-monster');
  const engaged=bot.monsters().filter(x=>x?.hp>0&&!x.dead&&
   x.target&&bot.teamNames.includes(x.target));
  if(engaged.some(x=>x.target===bot.p.c.name))
   return deny('follower-already-under-attack');
  if(engaged.length>=Math.min(3,bot.cfg.farming?.maxAggro??1))
   return deny('team-threat-capacity-reached');
  return assessFollowerSharedSpawn(bot.p.c,m,{
   plan,leader:bot.transport?.fresh?.(bot.leader),
   realm:bot.p.realm(),game:bot.p.G
  });
 }
 function soloSharedSpawn(m){return sharedSpawnAssessment(m).allowed===true;}
 // Aimed Ranger skills own a separate all-target authorization. The
 // adaptive BUILD phase is not proof that a weak, fully bounded aimed set
 // is unsafe, but a normal leader-neutral attack may not inherit this grant.
 function aimedSpawnAssessment(m){
  if(bot.me?.role!=='farmer'||bot.p.c.ctype!=='ranger')
   return {allowed:false,reason:'not-ranger-farm-skill'};
  if(bot.me.name!==bot.leader)return sharedSpawnAssessment(m);
  if(!bot.running||bot.p.c.rip||bot.strategy?.busy||
     bot.recovering||bot.journal||bot.inventoryBlocked||
     bot.logistics?.reserved||bot.account?.rotationPending?.()||
     bot.combatAssessment?.emergency?.()?.active||
     bot.p.parent?.is_pvp||bot.p.G.maps?.[bot.p.c.map]?.pvp||
     bot.teamPlan?.wantsCombat?.()===false||
     bot.free?.()<=(bot.cfg.farming?.freeSlots??0))
   return {allowed:false,reason:'leader-operational-hold'};
  const readiness=neutralPullReadiness(bot);
  if(!readiness.ready)return {allowed:false,
   reason:'leader-'+readiness.reason};
  const plan=bot.teamPlan?.heartbeat?.();
  if(!plan||bot.teamPlan?.target?.()!==m?.mtype||
     bot.strategy?.safeTarget?.(m.mtype,m,true)!==true)
   return {allowed:false,reason:'unapproved-leader-spawn'};
  const now=Date.now();
  return assessFollowerSharedSpawn(bot.p.c,m,{
   plan,realm:bot.p.realm(),game:bot.p.G,now,
   leader:{...bot.p.c,name:bot.me.name,realm:bot.p.realm(),
    running:bot.running,received:now,farmPlan:plan}
  });
 }
 function approveAimedSpawnPull(targets,skillId,skill){
  const deny=reason=>({safe:false,reason});
  if(!Array.isArray(targets)||bot.me?.role!=='farmer'||
     bot.p.c?.ctype!=='ranger'||!bot.running||
     bot.p.c.rip||bot.recovering||
     bot.journal||bot.inventoryBlocked||bot.logistics?.reserved||
     bot.account?.rotationPending?.()||
     bot.combatAssessment?.emergency?.()?.active||
     bot.p.parent?.is_pvp||bot.p.G.maps?.[bot.p.c.map]?.pvp)
   return deny('aimed-skill-operational-hold');
  const teamThreats=bot.monsters().filter(m=>m?.hp>0&&!m.dead&&
    m.target&&bot.teamNames.includes(m.target));
  // Entirely fresh weak-spawn engagements only. Existing aggro remains
  // subject to the ordinary encounter AoE planner, including healing.
  if(teamThreats.length)return deny('existing-team-aggro');
  const ids=targets.map(m=>String(m?.id??''));
  if(ids.some(id=>!id)||new Set(ids).size!==ids.length)
   return deny('duplicate-or-missing-aimed-id');
  const invalid=targets.find(m=>aimedSpawnAssessment(m).allowed!==true);
  if(invalid)return {safe:false,reason:'aimed-target-not-authorized',
   target:invalid?.id??null,
   targetReason:aimedSpawnAssessment(invalid).reason};
  const now=Date.now(),plan=bot.teamPlan?.heartbeat?.();
  const leader=bot.me.name===bot.leader?{
   ...bot.p.c,name:bot.me.name,realm:bot.p.realm(),
   running:bot.running,received:now,farmPlan:plan
  }:bot.transport?.fresh?.(bot.leader);
  // Disallow a new multiple pull when another selected farmer is lost,
  // stale, injured, or cannot supply local team support if needed.
  const peers=(bot.farmers??[]).filter(n=>n!==bot.me.name)
   .map(n=>bot.transport?.fresh?.(n));
  if(!peers.length||peers.some(h=>!h?.running||h.rip||
     h.realm!==bot.p.realm()||
     !samePlace(h,bot.p.c)||
     !Number.isFinite(h.received)||h.received>now||
     now-h.received>4000||!(h.hp/h.max_hp>=.8)||
     !(h.mp/h.max_mp>=.15)||
     distance(h,bot.p.c)>285))
   return deny('aimed-support-team-not-ready');
  const proof=verifiedLowThreatAimedSet(bot.p.c,targets,{
   skillId,skill,plan,leader,realm:bot.p.realm(),
   game:bot.p.G,now});
  return proof.allowed?{safe:true,...proof}:{
    safe:false,reason:proof.reason,target:proof.target??null,
    targetReason:proof.targetReason??null};
 }
 function permit(m){
  if(m.target)return true;
  if(soloOneShot(m)||soloBoundedSpawn(m)||soloSharedSpawn(m))return true;
  const readiness=neutralPullReadiness(bot);
  if(!readiness.ready)return false;
  const detached=readiness.detachment;
  if(bot.me.name!==(detached?.puller??bot.leader)&&bot.cfg.party.enabled)return false;
  const engaged=bot.monsters().filter(x=>x.target&&bot.teamNames.includes(x.target)).length;
  // During a solo Monsterhunt visit, only one attached farmer may pull
  // exactly one approved spawn mob, using the LIVE two-person risk model.
  // No adaptive multi-pull, AoE probing or neutral attack while aggro exists.
  const last=bot.combatAssessment?.status?.()?.last;
  if(last&&Date.now()-last.at<5000&&last.viable===false)return false;
  if(detached)return !bot.recovering&&!bot.p.c.rip&&
    engaged===0&&m.mtype===detached.target&&
    bot.teamPlan?.wantsCombat?.()!==false&&
    bot.strategy?.safeTarget?.(m.mtype,m,true)===true;
  const planned=m.mtype&&m.mtype===bot.teamPlan?.target();
  if(planned&&bot.teamPlan?.wantsCombat?.()===false)return false;
  if(phase==='BUILD')return engaged<capacity&&
   (engaged===0||approvePullSet([...bot.monsters().filter(x=>x.target&&bot.teamNames.includes(x.target)&&x.hp>0),m]).safe);
  // Party-wide 50% MP is a *multi-pull* readiness threshold, not a
  // veto on every basic solo attack. When a member is regenerating mana
  // above the emergency floor, continue safely with ONE neutral mob.
  // Never relax this for injured teams, existing aggro or an active retreat.
  if(phase==='RECOVER'&&!bot.recovering&&engaged===0){
    const team=members();
    const hpFloor=Math.max(bot.cfg.farming.pullHp??.8,bot.cfg.farming.restBelow??.4);
    return team.length===bot.farmers.length&&team.every(h=>
      h.hp/Math.max(1,h.max_hp)>=hpFloor&&
      h.mp/Math.max(1,h.max_mp)>=.15);
  }
  return false;
 }
 function pull(){
  if(assessQuestDetachment(bot)||bot.me.name!==bot.leader||phase!=='BUILD'||capacity<2||!bot.teamPlan?.target()||!bot.teamPlan.wantsCombat()||
     !neutralPullReadiness(bot).ready)return false;
  const engaged=bot.monsters().filter(m=>m.target&&bot.teamNames.includes(m.target));
  if(!engaged.length||engaged.length>=capacity||bot.recovering)return false;
  if(bot.capabilities?.available(bot.me.name,'agitate')){
   const range=bot.p.G.skills.agitate?.range??320,near=bot.monsters().filter(m=>distance(bot.p.c,m)<=range);
   if(near.length>=2&&near.length<=capacity&&near.every(m=>m.mtype===bot.teamPlan.target()&&(!m.target||bot.teamNames.includes(m.target))&&bot.strategy.safeTarget(m.mtype,m))&&approvePullSet(near).safe&&bot.skills.use('agitate',null,.35,2000))return true;
  }
  // Rangers cannot use agitate. Pull ONE additional explicitly selected, safe
  // spawn mob with the normal attack; teammates can then use 3shot/5shot.
  const range=Math.max(5,(bot.p.c.range??0)-Math.min(bot.cfg.farming.rangeBuffer??0,(bot.p.c.range??0)*.25));
  const candidate=bot.monsters().filter(m=>!m.target&&m.mtype===bot.teamPlan.target()&&distance(bot.p.c,m)<=range&&bot.allowed(m)&&bot.strategy.safeTarget(m.mtype,m)).sort((a,b)=>distance(bot.p.c,a)-distance(bot.p.c,b))[0];
  if(!candidate||!approvePullSet([...engaged,candidate]).safe)return false;
  const guard=()=>{
   const m=bot.entity(candidate.id);
   return bot.running&&phase==='BUILD'&&capacity>1&&neutralPullReadiness(bot).ready&&bot.teamPlan.target()===candidate.mtype&&m&&!m.target&&
    bot.monsters().filter(t=>t.target&&bot.teamNames.includes(t.target)).length<capacity&&
    bot.allowed(m)&&bot.strategy.safeTarget(m.mtype,m)&&approvePullSet([...bot.monsters().filter(t=>t.target&&bot.teamNames.includes(t.target)&&t.hp>0),m]).safe&&distance(bot.p.c,m)<=range&&
    bot.p.call('can_attack',m)&&!bot.p.call('is_on_cooldown','attack');
  };
  return bot.exec.run('attack',['attack','mana'],guard,()=>bot.p.call('attack',bot.entity(candidate.id)),{delay:250});
 }
 return {tick,permit,soloOneShot,soloBoundedSpawn,soloSharedSpawn,sharedSpawnAssessment,aimedSpawnAssessment,approveAimedSpawnPull,pull,approvePullSet,status:()=>({phase,capacity,context,profiles:Object.keys(profiles).length,unsafeUntil:unsafeUntil(bot.teamPlan?.target())}),close(){complete(phase==='ABORT');bot.p.write(key,profiles);}};
}
