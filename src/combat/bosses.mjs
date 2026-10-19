import {runtimeConditionGate,currentConditionEvidence} from '../core/action-admission.mjs';
import {distance,samePlace} from '../core/policy.mjs';
import {knowledgeFingerprint,semanticGear} from '../world/knowledge.mjs';
import {outgoingDamageEstimate} from './damage-model.mjs';
// Mechanic adapters are derived from design/monsters.js and node/server.js.
// Unsupported mechanics are catalogued with an explicit refusal, never guessed.
const BOSS_NAMES=['phoenix','jr','greenjr','mvampire','fvampire','goldenbat','pinkgoo','snowman','wabbit','dragold','icegolem','franky','mrgreen','mrpumpkin','crabxx','crabx','grinch','skeletor','stompy','cutebee','rharpy','rimedjinn','manyeye','mimic','paledino'];
export function bossProfile(G,id){
 const m=G.monsters?.[id];if(!m)return null;
 if(!BOSS_NAMES.includes(id)&&!m.special&&!m.cooperative&&!m.boss)return null;
 const abilities=Object.keys(m.abilities??{}),unsupported=abilities.filter(a=>!['self_healing','heal','multi_burn','multi_freeze','portal','rimeshell'].includes(a));
 if(m.explosion)unsupported.push('explosion');
 for(const [name,a] of Object.entries(m.abilities??{}))if(!a||typeof a!=='object'||!['rimeshell','portal'].includes(name)&&(!(a.cooldown>0)||['self_healing','heal'].includes(name)&&!(a.heal>=0)))unsupported.push('invalid-'+name);
 if(m.respawn_as)unsupported.push('transformation');if(m.aura)unsupported.push('aura');
 if(m.spawns&&(!Array.isArray(m.spawns)||m.spawns.some(r=>!G.monsters?.[r?.[1]])))unsupported.push('unknown-adds');
 return {id,definition:knowledgeFingerprint(m),supported:!unsupported.length,unsupported,
  mode:m['1hp']?'hits':'damage',healing:Object.values(m.abilities??{}).reduce((n,a)=>n+(a?.heal>0&&a.cooldown>0?a.heal*1000/a.cooldown:0),0),
  physicalOnly:m.reflection>0,
  area:!!m.hit?.startsWith('explode')||!!m.abilities?.multi_burn||!!m.abilities?.multi_freeze,
  adds:(Array.isArray(m.spawns)?m.spawns:[]).map(r=>r?.[1]),roles:['tank','healer',m['1hp']?'fast-attacker':'damage'],
  recommended:m['1hp']?['priest','ranger','ranger']:['warrior','priest',m.reflection>0?'ranger':'mage'],
  tactics:['Assemble fresh team','Verify HP/MP and healing margin','Wait for guard expiry','Single coordinated target','Control visible adds','Retreat on invalidated readiness']};
}
// Shadow comparison against the legacy, type-agnostic boss estimator.
// A candidate's DAMAGE may never exceed the legacy gate until live
// calibration. This is not permission to attack and does not affect pull logic.
export function bossDamageShadow(monster,members,{physicalOnly=false,mode='damage',
 healer=null,uncertainty=.15,conditions={}}={}){
 const blocked=reason=>({valid:false,mode:'shadow-only',reason,
  authority:'conservative-gate',oldEstimate:null,newEstimate:null});
 if(!monster||!Array.isArray(members)||!members.length||
    !['damage','hits'].includes(mode)||!Number.isFinite(uncertainty)||
    uncertainty<0||uncertainty>.5)return blocked('invalid-combat-context');
 if(monster.immune===true||monster.invincible===true)return blocked('immune-or-invincible');
 if(!Number.isFinite(monster.avoidance??0)||(monster.avoidance??0)<0||
    (monster.avoidance??0)>100)return blocked('invalid-avoidance');
 const freeze=monster.abilities?.multi_freeze?.3:1;
 const rows=[];
 let legacy=0,current=0;
 for(const c of members){
  const type=c?.damage_type??(['mage','priest'].includes(c?.ctype??c?.class)?
   'magical':'physical');
  if(physicalOnly&&type!=='physical')continue;
  if(!Number.isFinite(c?.frequency)||c.frequency<=0||
     !Number.isFinite(c?.attack)||c.attack<=0)
   return blocked('unverified-attacker');
  const measured=outgoingDamageEstimate(c,monster,{uncertainty});
  if(!measured.valid)return blocked(measured.reason);
  const oldRate=(mode==='hits'?1:c.attack/
   Math.max(1,1+Math.max(monster.armor??0,monster.resistance??0)/100))*
   c.frequency*(1-(monster.avoidance??0)/100)*
   (1-(type==='physical'?monster.evasion??0:0)/100);
  if(!Number.isFinite(oldRate)||oldRate<0)return blocked('invalid-legacy-estimate');
  const newRate=measured.damage*c.frequency;
  // Priests who may be healing have NO simultaneous guaranteed attack time.
  // This preserves the existing exclusive-healer risk assumption.
  const attacking=healer!==c.name&&runtimeConditionGate(c,{conditions},'attack',['attack']).allowed;
  legacy+=oldRate;current+=attacking?newRate:0;
  rows.push({name:c.name??null,type,oldDps:oldRate,
   newDps:attacking?newRate:0,healerExcluded:!attacking,
   hitAccuracy:measured.accuracy,damageFactor:measured.factor});
 }
 if(!rows.length)return blocked('no-compatible-attacker');
 const oldEstimate=legacy*freeze,newEstimate=current*freeze;
 if(!Number.isFinite(oldEstimate)||!Number.isFinite(newEstimate)||
    newEstimate<=0)return blocked('no-verified-damage');
 return {valid:true,mode:'shadow-only',authority:'conservative-gate',
  oldEstimate,newEstimate,conservativeEstimate:Math.min(oldEstimate,newEstimate),
  change:newEstimate-oldEstimate,reason:healer?'shared-healer-time-excluded':'typed-defense-and-accuracy',
  uncertainty,rows};
}

export function bossReadiness(G,id,live,members,{maxSeconds=300,planned=false,metrics=null,maxAdds=2}={}){
 const profile=bossProfile(G,id),m={...G.monsters?.[id],...live};
 let damageShadow=null;
 const reject=reason=>({safe:false,reason,profile,phase:'ABORT',
  ...(damageShadow?{damageShadow}:{})});
 if(!profile?.supported)return reject('Unmodellierte Bossmechanik: '+(profile?.unsupported.join(',')??id));
 if(!members.length||members.some(c=>c.rip||!(c.hp>0)||!(c.max_hp>0)))return reject('Gruppe unvollständig');
 if(members.some(c=>c.hp/c.max_hp<.8||c.mp/Math.max(1,c.max_mp)<.5))return reject('HP/MP-Bereitschaft fehlt');
 if(!planned&&(live?.s?.fullguard||live?.s?.fullguardx))return {...reject('Schutzphase abwarten'),phase:'WAIT'};
 // Unknown live protection mechanics are never assumed to be inactive.
 if(Object.keys(live?.s??{}).some(k=>/^(invincib|immune|guard|shield|phase)/i.test(k)&&
    !['fullguard','fullguardx','rimeshell'].includes(k)))
  return reject('Unbekannte Schutzphase');
 const weakest=Math.min(...members.map(c=>c.hp));
 const freeze=m.abilities?.multi_freeze?.3:1;
 const worstHit=x=>Math.ceil((x.attack??Infinity)*1.1*(x.crit>0?2+Math.max(0,x.critdamage??0)/100:1));
 // A designated priest must not be credited simultaneously with healing
 // and full DPS. Existing evidence-based healing checks remain in force.
 const healers=members.filter(c=>(c.ctype??c.class)==='priest'&&runtimeConditionGate(c,G,'skill:heal',['mana','attack']).allowed);
 damageShadow=bossDamageShadow(m,members,{physicalOnly:profile.physicalOnly,
  mode:profile.mode,conditions:G.conditions,healer:healers.length&&members.length>1&&
   metrics?.seconds>=10&&metrics?.healing>0?healers[0].name:null});
 if(!damageShadow.valid)return reject('Boss-Schadensmodell: '+damageShadow.reason);
 const measured=metrics?.seconds>=10&&metrics.damage>0?metrics.damage/metrics.seconds:null;
 const estimate=damageShadow.conservativeEstimate;
 const dps=Math.min(estimate,measured??estimate)-profile.healing-worstHit(m)*(m.frequency??1)*Math.max(0,m.lifesteal??0)/100;
 if(!(dps>0))return reject('Schaden überwindet Bossheilung nicht');
 const shell=m.abilities?.rimeshell;
 if(shell){
  if(!(shell.duration>0&&shell.break_fraction>0&&shell.break_fraction<=1))return reject('Unbekannte Shell-Definition');
  const remaining=live?.s?.rimeshell?.remaining??(m.max_hp??G.monsters[id].hp)*shell.break_fraction;
  const window=(live?.s?.rimeshell?.ms??shell.duration)/1000;
  if(!(window>0)||dps*window<remaining*1.5)return reject('Rime-Shell kann nicht rechtzeitig gebrochen werden');
 }
 const seconds=(live?.hp??m.hp)/dps;if(!Number.isFinite(seconds)||seconds>maxSeconds)return reject('Kampfzeit überschritten');
 if(profile.adds.length&&!members.some(c=>['warrior','mage','ranger'].includes(c.ctype??c.class)))return reject('Add-Kontrolle fehlt');
 const addDamage=profile.adds.reduce((n,a)=>n+worstHit(G.monsters[a])*(G.monsters[a].frequency??1),0)*Math.max(1,maxAdds);
 const burst=Math.max(worstHit(m),m.abilities?.multi_burn?.damage??0,m.abilities?.multi_freeze?.damage??0);
 // Fireball applies five seconds of burn; repeated burns can accumulate.
 // Reserve up to 9 hits per cast (impact plus accumulated DoT), no resistance credit.
 const incoming=worstHit(m)*(m.frequency??1)+addDamage+['multi_burn','multi_freeze'].reduce((n,a)=>n+(m.abilities?.[a]?Math.max(worstHit(m),m.abilities[a].damage??0)*(a==='multi_burn'?9:1)*1000/m.abilities[a].cooldown:0),0);
 if(!Number.isFinite(incoming)||burst>weakest*.25)return reject('Burst-/Add-Schaden zu hoch');
 // Healing is credited only from observed effective heal events. Without
 // evidence the entire fight must fit in the existing HP reserve.
 const hps=(metrics?.seconds>=10?Math.max(0,metrics.healing??0)/metrics.seconds:0)*freeze;
 const burden=profile.area?incoming*members.length:incoming;
 if(burden*seconds>weakest*.5&&(!healers.length||hps<burden*1.5))return reject('Belegte Heilreserve fehlt');
 const tank=[...members].sort((a,b)=>b.hp-a.hp)[0];
 return {safe:true,profile,phase:live?.s?.rimeshell?'BREAK_SHELL':'ENGAGE',seconds,incoming,dps,hps,tank:tank.name,healer:healers[0]?.name??null,
  damageShadow,reason:'Bossprofil, Gruppe und Ressourcen geprüft'};
}
export const shouldDeferBossReadiness=result=>!!result&&!result.safe&&
 ['WAIT','ASSEMBLE'].includes(result.phase);
export function createBosses(bot){
 const {p,cfg}=bot;let active=null,damage=0,healing=0,since=Date.now(),phase='IDLE',reason='',definition='',heals=[];
 const lastReadinessNote=new Map();
 const healContext=()=>knowledgeFingerprint([p.G.version,p.realm(),bot.farmers.map(n=>semanticGear(n===bot.me.name?bot.gear?.snapshot():bot.transport.fresh(n)?.gear))]);
 function members(planned){return bot.farmers.map(n=>n===bot.me.name?{...p.c,name:n}:bot.transport.fresh(n)).filter(h=>h&&(h.name===bot.me.name||h.running&&h.realm===p.realm())&&!h.rip&&(planned||samePlace(p.c,h)&&distance(p.c,h)<=cfg.party.followDistance*2)).map(h=>currentConditionEvidence(bot,{...h,...h.stats}));}
 function evaluate(id,live,planned=false){if(!cfg.world.bossTactics||!bossProfile(p.G,id))return null;
  const team=members(planned);if(team.length!==bot.farmers.length)return {safe:false,reason:'Bossgruppe unvollständig',phase:'ASSEMBLE'};
  const profile=bossProfile(p.G,id),maxAdds=Math.max(0,cfg.farming.maxAggro-1);
  if(profile.adds.length&&(!cfg.party.aoe||!maxAdds||bot.monsters().filter(m=>profile.adds.includes(m.mtype)&&bot.teamNames.includes(m.target)).length>maxAdds))return {safe:false,reason:'Add-Kapazität überschritten',phase:'ABORT'};
  const training=trainedHealing(),elapsed=(Date.now()-since)/1000;
  return bossReadiness(p.G,id,live,team,{planned,maxSeconds:cfg.world.bossMaxSeconds,maxAdds,
   metrics:active===id&&damage>0?{seconds:elapsed,damage,healing:Math.max(healing,(training?.healing??0)/60*elapsed)}:training});
 }
 function trainedHealing(){const ctx=healContext();heals=heals.filter(r=>Date.now()-r.at<60000&&r.context===ctx);return heals.length>=3?{seconds:60,damage:0,healing:heals.reduce((n,r)=>n+r.value,0)}:null;}
 function hit(d){const target=bot.entity(d?.target);
  if(bot.farmers.includes(d?.actor)&&bot.farmers.includes(d?.target)&&Number.isFinite(d.heal)&&d.heal>0){
   const value=Math.min(d.heal,Math.max(0,(target?.max_hp??0)-(target?.hp??0)));
   heals.push({at:Date.now(),value,context:healContext()});heals=heals.slice(-128);if(active)healing+=value;
  }
  if(!active)return;
  if(bot.farmers.includes(d?.actor)&&target?.mtype===active&&Number.isFinite(d.damage)&&d.damage>0)damage+=d.damage;
 }
 function tick(){const a=bot.strategy?.heartbeat?.(),id=a?.target;
  if(!id||!bossProfile(p.G,id)){active=null;phase='IDLE';return;}
  const stamp=knowledgeFingerprint([p.G.monsters[id],bot.farmers.map(n=>semanticGear(n===bot.me.name?bot.gear?.snapshot():bot.transport.fresh(n)?.gear))]);
  if(active!==id||stamp!==definition){active=id;definition=stamp;since=Date.now();damage=healing=0;}
  const live=bot.monsters().find(m=>m.mtype===id),r=evaluate(id,live,!live);phase=r?.phase??'IDLE';reason=r?.reason??'';
  if(live&&shouldDeferBossReadiness(r)){
   // A travelling or regrouping squad is not evidence of a failed boss fight.
   // Do not add this species to the death/failure quarantine while assembling.
   bot.target=null;bot.reason=reason;
   if(Date.now()-(lastReadinessNote.get(id+':'+phase)??0)>=30000){
    lastReadinessNote.set(id+':'+phase,Date.now());
    bot.event?.('boss.readinessDeferred',{target:id,phase,reason,
     present:bot.farmers.filter(n=>n===bot.me.name||!!bot.transport.fresh(n)?.running),
     required:bot.farmers});
   }
   return;
  }
  if(live&&r&&!r.safe){
   bot.event?.('boss.readinessRejected',{target:id,phase,reason,
    dps:r.dps??null,seconds:r.seconds??null,damageModel:r.damageShadow?.reason??null});
   bot.strategy.failActivity(reason,id);return;
  }
  if(live&&r?.safe&&cfg.party.enabled&&live.target&&live.target!==r.tank&&bot.me.name===r.tank&&p.c.ctype==='warrior')bot.skills?.use('taunt',live,.5,2000);
  if(live&&phase==='BREAK_SHELL'&&p.c.slots?.mainhand?.name==='basher')bot.skills?.use('stomp',live,.5,1000);
  // Adds remain separate targets unless individually approved by the same
  // safety path. Never let a generic AoE pull unknown additional species.
 }
 function adds(){const profile=active&&bossProfile(p.G,active);return profile?.supported?profile.adds.filter(id=>bot.monsters().some(m=>m.mtype===id&&bot.teamNames.includes(m.target))):[];}
 function objective(){if(!cfg.world.bossTactics||!cfg.world.bosses)return null;
  const state=p.root.S??p.parent.S??{};
  return cfg.world.allowedBosses.map(id=>bossProfile(p.G,id)).find(r=>r?.supported&&(state[r.id]?.live===true||bot.monsters().some(m=>m.mtype===r.id)))??null;
 }
 return {evaluate,hit,tick,adds,objective,canAttack:m=>!cfg.world.bossTactics||!bossProfile(p.G,m.mtype)?.physicalOnly||(p.c.damage_type??(['mage','priest'].includes(p.c.ctype)?'magical':'physical'))==='physical',profile:id=>bossProfile(p.G,id),
  status:()=>({active,phase,reason,damage,healing,seconds:(Date.now()-since)/1000}),
  catalog:()=>Object.keys(p.G.monsters??{}).map(id=>bossProfile(p.G,id)).filter(Boolean),
  close(){active=null;phase='IDLE';}};
}
