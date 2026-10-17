import {distance,samePlace} from '../core/policy.mjs';
import {damageMultiplier,outgoingDamageEstimate} from './damage-model.mjs';
import {isNaturallyAggressive} from './aggression.mjs';

const finite=(x,min=0,max=1e9)=>Number.isFinite(x)&&x>=min&&x<=max;
const cap=(v,min,max)=>Math.max(min,Math.min(max,v));
const refusal=(reason,detail={})=>({decision:'retreat',viable:false,
  evidence:'bounded-client-estimate',reason,...detail});

// No optimistic assumptions about taunt, buffs, dodge, crowd control,
// projected healing, consumables or kills. Only an ALREADY engaged,
// naturally aggressive live monster may be evaluated for team defense.
// A missing healer/teammate or stale heartbeat makes the result RETREAT.
export function estimateThreatCapability({
 monster,meta,team,now=Date.now(),observed=[]
}={}){
 if(!monster?.id||!monster.target||!isNaturallyAggressive({monsters:{[monster.mtype]:meta}},monster)||
   !finite(monster.hp,1,100000000)||!finite(meta?.attack,0,100000)||
   !finite(meta?.frequency,.01,100)||!finite(meta?.hp,1,100000000))
  return refusal('monster-data-unverified');
 if(!Array.isArray(team)||!team.length||team.length>5||
   !team.some(h=>h.name===monster.target))return refusal('target-or-team-unverified');
 const members=[],attackers=[];
 for(const m of team){
  if(!m||!m.running||m.rip||!samePlace(m,monster)||
    !finite(m.hp,1,1000000)||!finite(m.max_hp,m.hp,1000000)||
    !finite(m.mp,0,1000000)||!finite(m.max_mp,1,1000000)||
    !finite(m.stats?.attack,1,100000)||!finite(m.stats?.frequency,.01,20)||
    !finite(m.stats?.armor,-1000,100000)||!finite(m.stats?.resistance,-1000,100000)||
    !finite(m.stats?.range,1,3000)||
    !finite(m.x,-100000,100000)||!finite(m.y,-100000,100000)||
    (m.received!==undefined&&(!finite(m.received,0,now)||now-m.received>4000)))
   return refusal('party-member-stale-or-unverified',{member:m?.name??null});
  const d=distance(m,monster);
  // Teammates who would have to travel for several seconds contribute no
  // survival or damage credit during a potentially lethal engagement.
  if(d>Math.max(180,m.stats.range+130))
   return refusal('party-not-in-combat-support-range',{member:m.name,distance:Math.round(d)});
  const incomingType=meta.damage_type==='magical'?'resistance':'armor';
  const pierced=(m.stats[incomingType]??0)-
   (incomingType==='armor'?(meta.apiercing??0):(meta.rpiercing??0));
  const multiplier=damageMultiplier(pierced);
  if(!finite(multiplier,.01,1.5))return refusal('unknown-defense',{member:m.name});
  const estimate=outgoingDamageEstimate({
   attack:m.stats.attack,damage_type:m.stats.damage_type,
   apiercing:m.stats.apiercing??0,rpiercing:m.stats.rpiercing??0,
   ctype:m.class
  },{...meta,...monster,armor:monster.armor??meta.armor??0,
   resistance:monster.resistance??meta.resistance??0});
  if(!estimate.valid)return refusal('outgoing-damage-unverified',{member:m.name});
  const priest=m.class==='priest',dps=estimate.damage*m.stats.frequency*
   (priest?.55:.72); // priest's heal shares the basic attack opportunity
  attackers.push({name:m.name,dps,attack:m.stats.attack});
  members.push({...m,d,incomingDps:meta.attack*meta.frequency*
   cap(multiplier,0.05,1.5),dps});
 }
 const victim=members.find(m=>m.name===monster.target);
 if(!victim)return refusal('victim-not-verified');
 const otherAggro=members.reduce((n,m)=>n+(finite(m.threats,0,20)?Math.max(0,m.threats-(m.name===victim.name?1:0)):0),0);
 if(otherAggro>0)return refusal('other-team-aggro-unmodelled',{otherAggro});
 const healer=members.find(m=>m.class==='priest'&&
  Array.isArray(m.skills)&&m.skills.includes('heal')&&
  Array.isArray(m.capabilities?.ready)&&m.capabilities.ready.includes('heal')&&
  !m.s?.stunned&&!m.s?.silenced);
 let healingDps=0;
 if(healer){
  const healingRange=healer.stats.range;
  if(!finite(healer.stats.heal,1,100000)||
     distance(healer,victim)>Math.max(1,healingRange-12))
   return refusal('healer-unable-to-reach-victim',{
    healer:healer.name,healerDistance:Math.round(distance(healer,victim)),
    healRange:healingRange});
  // Cast throughput and MP budget, conservative. Do not count potion use,
  // partyheal, revives or unverified cross-actor healing as already received.
  const mpCost=healer.stats.mp_cost??0;
  if(!finite(mpCost,0,10000))return refusal('heal-mp-cost-unverified');
  const mpBuffer=Math.max(healer.max_mp*.12,mpCost);
  const casts=Math.floor(Math.max(0,healer.mp-mpBuffer)/Math.max(1,mpCost));
  healingDps=healer.stats.heal*
   Math.min(healer.stats.frequency*.65,casts/Math.max(8,monster.hp/Math.max(1,
     attackers.reduce((n,a)=>n+a.dps,0))));
  healingDps=Math.max(0,healingDps*.7);
 }
 const rawDps=attackers.reduce((n,m)=>n+m.dps,0);
 if(!finite(rawDps,.01,1e8))return refusal('insufficient-damage');
 const recent=Array.isArray(observed)?observed.filter(h=>
   h?.monsterId===monster.id&&finite(h.at,now-8000,now)&&
   finite(h.damage,1,1000000)).slice(-48):[];
 const dealt=recent.filter(h=>h.kind==='outgoing'),taken=recent.filter(h=>
   h.kind==='incoming'&&h.victim===victim.name);
 const rate=rows=>rows.length>=3&&Math.max(...rows.map(r=>r.at))-
   Math.min(...rows.map(r=>r.at))>=1000?
   rows.reduce((n,r)=>n+r.damage,0)/
     Math.max(1,(Math.max(...rows.map(r=>r.at))-
       Math.min(...rows.map(r=>r.at)))/1000):null;
 const observedOutgoing=rate(dealt),observedIncoming=rate(taken);
 const teamDps=Math.min(rawDps,observedOutgoing===null?rawDps:
   Math.max(1,observedOutgoing*1.15));
 const incomingDps=Math.max(victim.incomingDps,observedIncoming??0)*1.3;
 const effectiveHeal=Math.min(healingDps,incomingDps*.8);
 const netDps=Math.max(0,incomingDps-effectiveHeal);
 const ttk=monster.hp/Math.max(.01,teamDps);
 const survival=netDps>0?victim.hp/netDps:300;
 const safeTime=ttk*1.5+3; // latency/coordination + low-confidence hit margin
 const targetHealth=victim.hp/victim.max_hp;
 const viable=teamDps>0&&safeTime<survival*.72&&
   targetHealth>=.4&&monster.hp>=1;
 return {decision:viable?'defend':'retreat',viable,
  reason:viable?'bounded-team-capacity':'insufficient-time-to-kill',
  evidence:'bounded-client-estimate',monster:monster.mtype,
  monsterId:monster.id,victim:victim.name,partySize:members.length,
  teamDps:Math.round(teamDps),incomingDps:Math.round(incomingDps),
  healingDps:Math.round(effectiveHeal),ttkSeconds:+ttk.toFixed(2),
  survivalSeconds:+survival.toFixed(2),marginSeconds:+(survival-safeTime).toFixed(2),
  healer:healer?.name??null,tank:{
   name:victim.name,hp:victim.hp,armor:victim.stats.armor,
   resistance:victim.stats.resistance,
   // Available taunt does not guarantee actual aggro redirection.
   tauntReady:members.some(m=>m.class==='warrior'&&m.capabilities?.ready?.includes('taunt')),
   diversionCredited:false
  },skills:{
   heal:!!healer,
   partyheal:!!healer?.capabilities?.ready?.includes('partyheal'),
   emergencyDefenses:members.filter(m=>m.capabilities?.ready?.some(s=>
    ['hardshell','reflection','guardians_oath','taunt','entangle'].includes(s))).map(m=>m.name),
   defensiveBuffCredit:0
  },measuredHits:{outgoing:dealt.length,incoming:taken.length},
  memberDamage:attackers};
}

export function createCombatAssessment(bot){
 const hits=[],now=()=>Date.now();let last=null,lastEmitted='',lastAt=0;
 const team=()=>bot.farmers.map(name=>{
  if(name===bot.me.name){
   const c=bot.p.c;
   return {...c,running:bot.running,received:now(),class:c.ctype,
    stats:{attack:c.attack,frequency:c.frequency,armor:c.armor,
     resistance:c.resistance,range:c.range,heal:c.heal,
     mp_cost:c.mp_cost,damage_type:c.damage_type,apiercing:c.apiercing,
     rpiercing:c.rpiercing},skills:['heal','partyheal','taunt'].filter(id=>
     (bot.p.G.skills?.[id]?.class??[]).includes?.(c.ctype)),
    capabilities:bot.capabilities?.snapshot(),
    threats:bot.monsters().filter(m=>m.target===c.name).length};
  }
  const h=bot.transport?.fresh?.(name);
  return h?{...h}:null;
 });
 function assess(m){
  const outcome=estimateThreatCapability({monster:m,
   meta:bot.p.G.monsters?.[m?.mtype],team:team(),now:now(),observed:hits});
  last={at:now(),...outcome};
  const key=[m?.id,outcome.decision,outcome.reason,outcome.victim].join(':');
  if(key!==lastEmitted||now()-lastAt>12000){
   lastEmitted=key;lastAt=now();
   bot.event?.('combat.threatCapability',last);
  }
  return last;
 }
 function emergency(){
  const mobs=bot.monsters().filter(m=>m.target&&bot.farmers.includes(m.target)&&
   isNaturallyAggressive(bot.p.G,m));
  const remote=bot.farmers.map(n=>n===bot.me.name?bot.p.c:bot.transport.fresh(n))
   .filter(x=>x?.running!==false&&!x.rip&&Number.isFinite(x.hp)&&
    Number.isFinite(x.max_hp)&&x.max_hp>0&&x.hp/x.max_hp<.65&&
    (x.threats>0||mobs.some(m=>m.target===x.name)));
  return {active:mobs.length>0||remote.length>0,
   monsters:mobs,critical:remote,anchor:remote[0]??null};
 }
 function hit(d){
  if(!bot.running||!finite(d?.damage,1,1000000))return;
  const target=String(d.target??''),actor=String(d.actor??'');
  let monsterId=null,kind=null,victim=null;
  const mob=bot.monsters().find(m=>String(m.id)===target);
  if(mob&&bot.farmers.includes(actor)){monsterId=mob.id;kind='outgoing';}
  else if(bot.farmers.includes(target)){
   const monster=bot.monsters().find(m=>String(m.id)===actor);
   if(monster){monsterId=monster.id;kind='incoming';victim=target;}
  }
  if(!kind)return;
  hits.push({at:now(),monsterId,kind,victim,damage:d.damage});
  while(hits.length>48||hits.length&&hits[0].at<now()-8000)hits.shift();
 }
 return {assess,emergency,hit,
  canDefend:m=>last?.viable===true&&last.monsterId===m?.id&&
   last.victim===m.target&&now()-last.at<1200,
  status:()=>({last,hits:hits.length}),
  close:()=>{hits.length=0;last=null;}};
}
