import {distance,samePlace} from '../core/policy.mjs';
import {damageMultiplier,outgoingDamageEstimate} from './damage-model.mjs';
import {isNaturallyAggressive} from './aggression.mjs';

const finite=(x,min=0,max=1e9)=>Number.isFinite(x)&&x>=min&&x<=max;
const cap=(v,min,max)=>Math.max(min,Math.min(max,v));
const refusal=(reason,detail={})=>({decision:'retreat',viable:false,
  evidence:'bounded-client-estimate',reason,...detail});

// No optimistic assumptions about taunt, buffs, dodge, crowd control or kills.
// Conservative credit requires verified heal/potion data or measured hits. Only an ALREADY engaged,
// naturally aggressive live monster may be evaluated for team defense.
// A missing healer/teammate or stale heartbeat makes the result RETREAT.
export function estimateThreatCapability({
 monster,meta,team,now=Date.now(),observed=[],otherMonsters=[],allowHealing=true
}={}){
 if(!monster?.id||!monster.target||!isNaturallyAggressive({monsters:{[monster.mtype]:meta}},monster)||
   !finite(monster.hp,1,100000000)||!finite(meta?.attack,0,100000)||
   !finite(meta?.frequency,.01,100)||!finite(meta?.hp,1,100000000))
  return refusal('monster-data-unverified');
 if(!Array.isArray(team)||!team.length||team.length>5||
   !team.some(h=>h?.name===monster.target))return refusal('target-or-team-unverified');
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
 // Multiple attackers may be defended only when every *additional* aggro
 // reported by fresh team heartbeats is visible and its actual species
 // damage can be independently bounded. Unknown mobs still fail closed.
 const extra=Array.isArray(otherMonsters)?otherMonsters.filter(m=>
  m?.id!==monster.id&&members.some(x=>x.name===m?.target)):null;
 if(otherAggro>0&&(!extra||extra.length!==otherAggro||otherAggro>3))
  return refusal('other-team-aggro-unmodelled',{otherAggro,visible:extra?.length??0});
 const secondary=[];
 for(const m of extra??[]){
  const target=members.find(x=>x.name===m.target),metaOther=m.meta;
  if(!target||!isNaturallyAggressive({monsters:{[m.mtype]:metaOther}},m)||
    !finite(m.hp,1,100000000)||!finite(metaOther?.attack,0,100000)||
    !finite(metaOther?.frequency,.01,100)||!finite(metaOther?.hp,1,100000000))
   return refusal('other-team-aggro-unverified',{otherAggro,id:m?.id});
  const protection=metaOther.damage_type==='magical'?'resistance':'armor';
  const pierce=protection==='armor'?metaOther.apiercing??0:metaOther.rpiercing??0;
  const multiplier=damageMultiplier(target.stats[protection]-pierce);
  if(!finite(multiplier,.01,1.5))
   return refusal('other-team-defense-unverified',{member:target.name});
  secondary.push({id:m.id,victim:target.name,hp:m.hp,
   incoming:metaOther.attack*metaOther.frequency*cap(multiplier,.05,1.5)*1.3});
 }
 if(secondary.length&&members.some(x=>{
   const owned=secondary.filter(m=>m.victim===x.name).length;
   return owned!==Math.max(0,x.threats-(x.name===victim.name?1:0));
  }))return refusal('other-team-aggro-count-mismatch',{otherAggro});
 const healer=allowHealing?members.find(m=>m.class==='priest'&&
  !m.s?.stunned&&!m.s?.silenced&&
  (m.combatSupport?.healReady===true||
   !m.combatSupport&&Array.isArray(m.skills)&&m.skills.includes('heal')&&
    Array.isArray(m.capabilities?.ready)&&m.capabilities.ready.includes('heal'))):null;
 let healingDps=0;
 if(healer){
  const healingRange=healer.combatSupport?.healRange??healer.stats.range;
  if(!finite(healer.stats.heal,1,100000)||
     distance(healer,victim)>Math.max(1,healingRange-12))
   return refusal('healer-unable-to-reach-victim',{
    healer:healer.name,healerDistance:Math.round(distance(healer,victim)),
    healRange:healingRange});
  // Healing and attack share the Priest's cadence. Only one verified ready
  // MP potion is budgeted, and not when the Priest is the victim (HP and MP
  // items share a potion cooldown). No future regen or repeated casts guessed.
  const mpCost=healer.combatSupport?.healMpCost??healer.stats.mp_cost??0;
  if(!finite(mpCost,0,10000))return refusal('heal-mp-cost-unverified');
  const mpPotion=healer.combatSupport?.mpPotion;
  const mpCredit=healer.name!==victim.name&&healer.combatSupport?.potionReady===true&&
   mpPotion?.count>0&&finite(mpPotion.restore,1,10000)?
   Math.min(healer.max_mp-healer.mp,mpPotion.restore*.65):0;
  const mpBuffer=Math.max(healer.max_mp*.12,mpCost);
  const casts=Math.floor(Math.max(0,healer.mp+mpCredit-mpBuffer)/Math.max(1,mpCost));
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
   h.kind==='incoming'&&h.victim===victim.name),
  healed=recent.filter(h=>h.kind==='healing'&&h.victim===victim.name&&
   h.actor===healer?.name);
 const rate=rows=>rows.length>=3&&Math.max(...rows.map(r=>r.at))-
   Math.min(...rows.map(r=>r.at))>=1000?
   rows.reduce((n,r)=>n+r.damage,0)/
     Math.max(1,(Math.max(...rows.map(r=>r.at))-
       Math.min(...rows.map(r=>r.at)))/1000):null;
 const observedOutgoing=rate(dealt),observedIncoming=rate(taken),
  observedHeal=rate(healed);
 // Repeated confirmed hits already include usable Ranger skills; a single
 // supershot/3shot burst is not sustained damage and earns no bonus.
 const sustainedDamage=dealt.length>=5&&
  Math.max(...dealt.map(h=>h.at))-Math.min(...dealt.map(h=>h.at))>=2500;
 const outgoingCap=rawDps*(sustainedDamage?1.2:1)*
  (monster.s?.cursed?1.08:1);
 const teamDps=Math.min(outgoingCap,observedOutgoing===null?rawDps:
   Math.max(1,observedOutgoing*(sustainedDamage?.85:1.15)));
 // Only a confirmed active curse can influence the model. The official
 // effect is 20%; credit at most half due to status-expiry uncertainty.
 const curseObserved=!!monster.s?.cursed;
 const incomingDps=Math.max(victim.incomingDps*(curseObserved?.90:1),
   observedIncoming??0)*1.3;
 // Actual Priest heal events confirm throughput, but cannot justify an
 // unlimited partyheal or an additional phantom healing stream.
 const sustainedHeal=healed.length>=2&&observedHeal!==null;
 const verifiedHeal=sustainedHeal?
  Math.min(healingDps*1.25,observedHeal*.8):0;
 const effectiveHeal=Math.min(Math.max(healingDps,verifiedHeal),incomingDps*.8);
 const netDps=Math.max(0,incomingDps-effectiveHeal);
 const hpPotion=victim.combatSupport?.hpPotion;
 // One confirmed inventory potion with known HP restoration and presently
 // free shared cooldown; no future potion spam or near-instant lethal hit.
 const potionHp=victim.combatSupport?.potionReady===true&&
  hpPotion?.count>0&&finite(hpPotion.restore,1,10000)&&
  victim.hp/incomingDps>=.8?
   Math.min(hpPotion.restore*.65,victim.max_hp*.25):0;
 const ttk=(monster.hp+secondary.reduce((n,m)=>n+m.hp,0))/
  Math.max(.01,teamDps*(secondary.length?.65:1));
 const survival=members.reduce((min,m)=>{
  const side=secondary.filter(x=>x.victim===m.name)
   .reduce((n,x)=>n+x.incoming,0);
  const actual=m.name===victim.name?netDps+side:side;
  return Math.min(min,actual>0?
   (m.hp+(m.name===victim.name?potionHp:0))/actual:300);
 },300);
 // Keep the prior large safety margin unless both real team damage AND
 // actual Priest healing have been observed over a sustained encounter.
 const measuredFight=sustainedDamage&&sustainedHeal;
 const safeTime=ttk*(measuredFight?1.3:1.5)+(measuredFight?2:3);
 const targetHealth=victim.hp/victim.max_hp;
 const viable=teamDps>0&&safeTime<survival*(measuredFight?.78:.72)&&
   targetHealth>=.4&&monster.hp>=1&&
   members.every(m=>!secondary.some(x=>x.victim===m.name)||m.hp/m.max_hp>=.4);
 return {decision:viable?'defend':'retreat',viable,
  reason:viable?'bounded-team-capacity':'insufficient-time-to-kill',
  evidence:'bounded-client-estimate',otherAggroMode:secondary.length?'fully-observed-bounded':'single-aggro',
  secondaryAggro:secondary.length,monster:monster.mtype,
  monsterId:monster.id,victim:victim.name,partySize:members.length,
  teamDps:Math.round(teamDps),incomingDps:Math.round(incomingDps),
  healingDps:Math.round(effectiveHeal),potionHp:Math.round(potionHp),
  observedSkillDamage:sustainedDamage&&teamDps>rawDps,
  observedHealHits:healed.length,measuredFight,
  ttkSeconds:+ttk.toFixed(2),
  survivalSeconds:+survival.toFixed(2),marginSeconds:+(survival-safeTime).toFixed(2),
  healer:healer?.name??null,tank:{
   name:victim.name,hp:victim.hp,armor:victim.stats.armor,
   resistance:victim.stats.resistance,
   // Available taunt does not guarantee actual aggro redirection.
   tauntReady:members.some(m=>m.class==='warrior'&&m.capabilities?.ready?.includes('taunt')),
   diversionCredited:false
  },skills:{
   activeCurseObserved:curseObserved,
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
    combatSupport:bot.transport?.combatSupport?.(),
    threats:bot.monsters().filter(m=>m.target===c.name).length};
  }
  const h=bot.transport?.fresh?.(name);
  return h?{...h}:null;
 });
 function assess(m){
  const outcome=estimateThreatCapability({monster:m,
   meta:bot.p.G.monsters?.[m?.mtype],team:team(),now:now(),observed:hits,
   otherMonsters:bot.monsters().filter(x=>x?.id!==m?.id&&
    bot.farmers.includes(x?.target)&&x.hp>0&&!x.dead).map(x=>({
     ...x,meta:bot.p.G.monsters?.[x.mtype]})),
   allowHealing:bot.cfg?.party?.healing!==false});
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
  const nowAt=now(),realm=bot.p.realm();
  const remote=bot.farmers.map(n=>n===bot.me.name?bot.p.c:bot.transport?.fresh?.(n)??null)
   .filter(x=>x!==null&&typeof x==='object'&&x.rip!==true&&
    x.running!==false&&(!x.realm||x.realm===realm)&&
    (!Number.isFinite(x.received)||nowAt-x.received>=0&&nowAt-x.received<=4000)&&
    Number.isFinite(x.hp)&&Number.isFinite(x.max_hp)&&
    x.max_hp>0&&x.hp>0&&x.hp/x.max_hp<.85&&
    (x.threats>0||mobs.some(m=>m.target===x.name)));
  return {active:mobs.length>0||remote.length>0,
   monsters:mobs,critical:remote,anchor:remote[0]??null};
 }
 function hit(d){
  if(!bot.running)return;
  const target=String(d?.target??''),actor=String(d?.actor??'');
  // Healing is credited only from an actual positive game hit event for
  // a selected teammate under current visible aggro, never just a cast.
  if(finite(d?.heal,1,1000000)&&bot.farmers.includes(target)&&
     bot.farmers.includes(actor)){
   const mob=bot.monsters().find(m=>m.target===target&&m.hp>0&&!m.dead);
   if(mob)hits.push({at:now(),monsterId:mob.id,kind:'healing',
    victim:target,actor,damage:d.heal});
  }
  if(!finite(d?.damage,1,1000000)){
   while(hits.length>48||hits.length&&hits[0].at<now()-8000)hits.shift();
   return;
  }
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
