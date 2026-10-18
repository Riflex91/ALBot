import {distance,samePlace} from '../core/policy.mjs';
import {damageMultiplier,outgoingDamageEstimate} from '../combat/damage-model.mjs';

// Ownership/online supply discovery never enlarges the combat roster.
export function combatMembers(bot,planned=false){
 const {p,cfg,me}=bot;
 const peers=cfg.party.enabled===false?[]:(bot.farmers??[]).filter(n=>n!==me.name).map(n=>bot.transport.fresh(n))
  .filter(h=>h?.running&&!h.rip&&!h.questVisit&&h.realm===p.realm()&&(planned||samePlace(p.c,h)&&distance(p.c,h)<=cfg.party.followDistance*2))
  .map(h=>({...h,...h.gear?.stats,...h.stats,hp:h.hp,max_hp:h.max_hp}));
 return [{...p.c,capabilities:bot.capabilities?.snapshot()},...peers].filter(c=>c.name!==cfg.party.merchant&&!c.rip&&c.hp>0);
}
export function compositionOptions(bot,planned=false){
 return {G:bot.p.G,outgoingUncertainty:0,healing:bot.cfg.party.enabled!==false&&bot.cfg.party.healing===true,
  aoe:bot.cfg.party.aoe===true,planned,leader:bot.leader,ttl:bot.cfg.general.messageTtlMs??10000};
}
function freshCapability(c,id,options){
 const cap=c.capabilities,age=Date.now()-(cap?.at??0);
 return age>=0&&age<(options.ttl??10000)&&(cap?.sustainable??cap?.ready)?.includes(id)&&!c.s?.stunned&&!c.s?.silenced;
}
export function farmHealer(members,options={}){
 const skill=options.G?.skills?.heal;if(!options.healing||!skill||members.length<2)return null;
 const candidates=members.filter(c=>(c.ctype??c.class)==='priest'&&freshCapability(c,'heal',options)&&
  c.max_mp>0&&c.mp>c.max_mp*.2&&Number.isFinite(skill.mp??c.mp_cost)&&
  (skill.mp??c.mp_cost)>=0&&c.mp-c.max_mp*.2>=(skill.mp??c.mp_cost)&&
  (options.planned||members.every(t=>samePlace(c,t)&&distance(c,t)<=(skill.range??c.range??0))));
 // One designated healer; shared heal/attack cooldown means no simultaneous DPS credit.
 return candidates.sort((a,b)=>b.hp/b.max_hp-a.hp/a.max_hp||a.name.localeCompare(b.name))[0]??null;
}
export function farmHealing(healer,members,seconds,options={}){
 if(!healer)return 0;
 const skill=options.G.skills.heal,cost=skill.mp??healer.mp_cost;
 const delay=Math.max(1/healer.frequency,(skill.cooldown??0)/1000)+.5;
 const casts=Math.min(Math.floor(Math.max(0,seconds-delay)*healer.frequency),cost>0?Math.floor(Math.max(0,healer.mp-healer.max_mp*.2)/cost):Infinity);
 // Conservative lower estimate: defense, poison, latency and shared attack time.
 const defense=Math.max(0,...members.map(c=>c.resistance??0));
 const poison=members.some(c=>c.s?.poisoned)?.25:1;
 const amount=Math.max(0,healer.heal??healer.attack)*.5/(1+defense/100)*poison;
 return Math.max(0,casts*amount);
}
export function farmThroughput(monster,members,count,options={}){
 const healer=farmHealer(members,options),active=members.filter(c=>c!==healer&&c.attack>0&&c.frequency>0);
 // Every member uses its own damage type and armor/resistance piercing.
 // Safety uncertainty is distinct from the official damage multiplier.
 const perMember=c=>outgoingDamageEstimate(c,monster,{
  fearFactor:farmFearFactor(c,monster,count),
  uncertainty:options.outgoingUncertainty??0
 }).damage*c.frequency;
 const base=active.reduce((n,c)=>n+perMember(c),0),seconds=Math.max(1,monster.hp/Math.max(1,base)),horizon=Math.max(10,seconds*count);
 const damage=active.reduce((sum,c)=>{
  let multiplier=1;
  if(options.aoe&&!monster['1hp'])for(const id of ['3shot','5shot']){
   const s=options.G?.skills?.[id],capacity=id==='3shot'?3:5;
   if(!s||!freshCapability(c,id,options)||(c.ctype??c.class)!=='ranger'||!(s.damage_multiplier>0)||!(s.mp>0)||!(c.max_mp>0))continue;
   const casts=Math.floor(Math.max(0,c.mp-c.max_mp*.2)/s.mp),period=Math.max(1/c.frequency,(s.cooldown??0)/1000,(s.cooldown_multiplier??1)/c.frequency,.6);
   const duty=Math.min(1,casts/(horizon/period));
   multiplier=Math.max(multiplier,1+Math.max(0,Math.min(count,capacity)*s.damage_multiplier/(period*c.frequency)-1)*duty);
  }
  return sum+perMember(c)*multiplier;
 },0);
 const enemyHealing=Object.values(monster.abilities??{}).reduce((n,s)=>n+(s.heal>0&&s.cooldown>0?s.heal*1000/s.cooldown:0),0);
 return {baseDps:base,effectiveDps:Math.max(0,damage-enemyHealing*count),aoeMultiplier:base>0?damage/base:1,healer:healer?.name??null,
  classes:members.map(c=>c.ctype??c.class??'unknown')};
}

export function farmFearFactor(c,monster,count){
 const courage=c[monster.damage_type==='magical'?'mcourage':monster.damage_type==='pure'?'pcourage':'courage'];
 if(!Number.isFinite(courage))return 1;
 // Beacon bonuses are already in live Courage. Do not rely on a short buff
 // surviving a newly planned pull; do not double-apply existing Fear penalties.
 const stable=courage-(c.s?.beacon_of_resolve?1:0),fear=Math.max(0,count-stable);
 const penalty=n=>n>2?.2:n>1?.4:n>0?.6:1;
 return Math.min(1,penalty(fear)/penalty(c.fear??0));
}

// Official damage_multiplier curve; unlike 1/(1+armor/100), it does not
// overstate the protection of modest armor. Monster piercing remains effective.
export const farmDamageMultiplier=damageMultiplier;
function effectLasts(c,id,seconds){
 const effect=c.s?.[id];if(!effect||typeof effect!=='object')return false;
 const age=Math.max(0,Date.now()-(c.received??Date.now()));
 return Number.isFinite(effect.ms)&&effect.ms-age>=(seconds+.5)*1000;
}
export function stableFarmDefense(c,members,seconds,options={}){
 const result={armor:c.armor??0,resistance:c.resistance??0,hp:c.hp,max_hp:c.max_hp,auras:[]};
 for(const [id,effect] of Object.entries(c.s??{})){
  const aura=id.startsWith('paladin_aura_'),definition=options.G?.conditions?.[id]??{};
  const source=aura?members.find(m=>m.name===effect.f&&(m.ctype??m.class)==='paladin'):null;
  const active=effectLasts(c,id,seconds)&&(!aura||source&&samePlace(source,c)&&distance(source,c)<=(options.G?.skills?.paladin_aura?.range??0));
  if(active){if(aura)result.auras.push(id);continue;}
  // Live stats already include buffs. Remove expiring/unverified bonuses;
  // never add the aura or Hard Shell for a second time.
  for(const stat of ['armor','resistance'])result[stat]-=Math.max(0,(aura?effect[stat]:definition[stat])??0);
  const hp=Math.max(0,(aura?effect.hp:definition.hp)??0);result.max_hp=Math.max(1,result.max_hp-hp);result.hp=Math.min(result.hp,result.max_hp);
 }
 return result;
}
export function farmDefense(monster,members,seconds,aggro,limits,healCredit=0,options={}){
 const magical=monster.damage_type==='magical',pure=monster.damage_type==='pure',defense=magical?'resistance':'armor',piercing=magical?monster.rpiercing??0:monster.apiercing??0;
 const rows=members.map(c=>({c,...stableFarmDefense(c,members,seconds,options)}));
 // Tank focus is credited only for one controlled target. Multi-pulls and
 // arbitrary/area targeting must survive the worst recipient distribution.
 const tank=aggro===1&&!monster.cleave&&!monster.splash&&!monster.random_target&&rows.find(r=>
  ['warrior','paladin'].includes(r.c.ctype??r.c.class)&&
  (monster.target===r.c.name||!monster.target&&r.c.name===options.leader&&
   (freshCapability(r.c,'taunt',options)||freshCapability(r.c,'agitate',options))));
 let worst=0,worstRatio=0,hitSafe=true;const details=[];
 for(const r of rows){
  const c=r.c,factor=pure?1:farmDamageMultiplier(r[defense]-piercing),hit=monster.attack*1.1*(monster.crit>0?2+Math.max(0,monster.critdamage??0)/100:1)*factor;
  const duration=tank&&tank!==r?Math.min(seconds,3):seconds;
  let exposure=hit*monster.frequency*Math.max(1,aggro)*duration,shield=0,redirect=0;
  if((c.ctype??c.class)==='paladin'&&effectLasts(c,'mshield',seconds)&&!c.s?.aether_shield){
   const efficiency=c.level>99?3:c.level>89?2.4:c.level>79?2:c.level>69?1.75:1.5;
   shield=Math.min(exposure,Math.max(0,(c.mp??0)-Math.max(200,(c.max_mp??0)*.5))*efficiency);
  }
  exposure-=shield;
  const oath=options.G?.skills?.guardians_oath,guardian=rows.find(g=>g.c.name===c.s?.guardians_oath?.f&&(g.c.ctype??g.c.class)==='paladin');
  if(guardian&&guardian!==r&&oath?.ratio>0&&oath.ratio<1&&effectLasts(c,'guardians_oath',seconds)&&samePlace(c,guardian.c)&&distance(c,guardian.c)<=oath.link_range){
   const requested=exposure*oath.ratio;
   if(requested<=Math.min(guardian.hp,guardian.max_hp)*limits.exposure){redirect=requested;exposure-=redirect;}
  }
  // Healing cannot prevent the opening burst. Aether Shield returns MP, not HP.
  const net=Math.max(Math.min(exposure,hit*monster.frequency*Math.max(1,aggro)*Math.min(duration,1.5)),exposure-healCredit);
  const hp=Math.min(r.hp,r.max_hp),ratio=net/Math.max(1,hp);
  hitSafe&&=hit<=hp*limits.hit;worst=Math.max(worst,net);worstRatio=Math.max(worstRatio,ratio);
  details.push({name:c.name,class:c.ctype??c.class,defense:r[defense],hit,exposure:net,shield,redirect,auras:r.auras,
   aetherShield:effectLasts(c,'aether_shield',seconds),tank:tank===r});
 }
 return {safe:hitSafe&&worstRatio<=limits.exposure,exposure:worst,exposureRatio:worstRatio,tank:tank?.c?.name??null,defense:details};
}
