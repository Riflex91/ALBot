import {farmHealer,farmHealing,farmDefense,farmFearFactor} from './composition.mjs';
import {outgoingDamageEstimate} from '../combat/damage-model.mjs';
// Conservative planning estimate: unknown healing, kiting and critical hits are not guaranteed.
export function assessCombat(monster,members,mode='balanced',aggro=1,options={}){
 const limits={conservative:{hit:.12,seconds:12,exposure:.35},balanced:{hit:.25,seconds:25,exposure:.55},aggressive:{hit:.4,seconds:45,exposure:.75}}[mode]??{hit:.12,seconds:12,exposure:.35};
 const alive=members.filter(c=>!c.rip&&c.hp>0&&c.max_hp>0&&c.attack>0&&c.frequency>0);
 if(!monster||!(monster.hp>0)||!Number.isFinite(monster.attack)||!(monster.frequency>0)||!alive.length)return {safe:false,reason:'Kampfwerte fehlen'};
 const unsupported=Object.keys(monster.abilities??{}).filter(k=>!['self_healing','heal'].includes(k));
 if(unsupported.length||monster.reflection>0||monster.explosion||monster.respawn_as||monster.spawns||monster.aura)
  return {safe:false,reason:'Spezialmechanik benötigt validiertes Kampfprofil: '+(unsupported.join(',')||'Phasen/Reflexion/Aura'),mechanics:true};
 if(monster.s?.fullguard||monster.s?.fullguardx)return {safe:false,reason:'Aktive Schutzphase',mechanics:true};
 const weakest=Math.min(...alive.map(c=>Math.min(c.hp,c.max_hp)));
 const healer=farmHealer(alive,options);
 // Preserve the old exclusive healer budget until full heal/attack scheduling
 // is validated. A solo priest continues to attack, never heal simultaneously.
 const damageRows=alive.filter(c=>c!==healer).map(c=>({
  c,estimate:outgoingDamageEstimate(c,monster,{
   fearFactor:farmFearFactor(c,monster,aggro),
   uncertainty:options.outgoingUncertainty??0
  })
 }));
 if(damageRows.some(r=>!r.estimate.valid))
  return {safe:false,reason:'Schadensmodell: unbestätigter Gegner- oder Angreiferwert',model:'unsupported'};
 const rawOutgoing=damageRows.reduce((sum,{c,estimate})=>
  sum+estimate.damage*c.frequency,0);
 const healing=Object.values(monster.abilities??{}).reduce((n,a)=>n+(a.heal>0&&a.cooldown>0?a.heal*1000/a.cooldown:0),0);
 const lifesteal=monster.attack*1.1*(monster.crit>0?2+Math.max(0,monster.critdamage??0)/100:1)*monster.frequency*Math.max(0,monster.lifesteal??0)/100;
 const outgoing=rawOutgoing-healing-lifesteal;
 if(!(outgoing>0))return {safe:false,reason:'Schaden überwindet Schutz/Heilung nicht',outgoing,healing,seconds:Infinity};
 const seconds=monster.hp/outgoing,incoming=monster.attack*monster.frequency*Math.max(1,aggro),exposure=incoming*seconds;
 const healCredit=farmHealing(healer,alive,seconds,options)*(healer?farmFearFactor(healer,monster,aggro):1);
 const protection=farmDefense(monster,alive,seconds,aggro,limits,healCredit,options);
 // A personal override changes only the estimated fight-time cap; the
 // selected risk profile retains all hit, exposure and mechanics safeguards.
 const maxSeconds=Number.isSafeInteger(options.maxCombatSeconds)&&options.maxCombatSeconds>=1&&options.maxCombatSeconds<=300?
  options.maxCombatSeconds:limits.seconds;
 const safe=seconds<=maxSeconds&&protection.safe;
 return {reason:safe?'Bekannte Gruppe innerhalb des Risikobudgets':'Treffer, Kampfdauer oder Schadensbudget überschritten',seconds,incoming,outgoing,rawExposure:exposure,...protection,safe,healCredit,healer:healer?.name??null,availableHp:weakest};
}
