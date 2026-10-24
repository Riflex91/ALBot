import {runtimeConditionGate} from '../core/action-admission.mjs';
import {farmHealer,farmHealing,farmDefense,farmFearFactor} from './composition.mjs';
import {outgoingDamageEstimate} from '../combat/damage-model.mjs';
import {estimateCombatTimeline} from '../combat/combat-time.mjs';
import {stableFarmOffense,horizonMonsterStats,verifiedTargetDamageAmplification} from './effect-risk.mjs';
// Conservative planning estimate: unknown healing, kiting and critical hits are not guaranteed.
export function assessCombat(monster,members,mode='balanced',aggro=1,options={}){
 const limits={conservative:{hit:.12,seconds:12,exposure:.35},balanced:{hit:.25,seconds:25,exposure:.55},assertive:{hit:.32,seconds:35,exposure:.65},aggressive:{hit:.4,seconds:45,exposure:.75}}[mode]??{hit:.12,seconds:12,exposure:.35};
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
 // Use the real server-observed stats as a starting point. When a buff or
 // debuff expires during the modeled encounter, recompute without that credit.
 // Time is monotone: expiration can only increase the conservative estimate.
 const healing=Object.values(monster.abilities??{}).reduce((n,a)=>
  n+(a.heal>0&&a.cooldown>0?a.heal*1000/a.cooldown:0),0);
 let seconds=0,outgoing=0,rawOutgoing=0,projectedMonster=monster,removedEffects=[];
 for(let i=0;i<8;i++){
  projectedMonster=horizonMonsterStats(monster,seconds,{...options,
   monsterBase:options.G?.monsters?.[monster.mtype]});
  const rows=alive.filter(c=>c!==healer&&
   runtimeConditionGate(c,options.G,'attack',['attack']).allowed).map(c=>{
    const stable=stableFarmOffense(c,seconds,{G:options.G,members:alive});
    return {stable,estimate:stable.valid?
     outgoingDamageEstimate(stable.stats,projectedMonster,{
      fearFactor:farmFearFactor(stable.stats,projectedMonster,aggro),
      uncertainty:options.outgoingUncertainty??0
     }):{valid:false,reason:stable.reason}};
   });
  if(rows.some(r=>!r.stable.valid||!r.estimate.valid))
   return {safe:false,reason:'Schadensmodell: ablaufender oder unbestätigter Kampfeffekt',
    model:'unsupported',effect:rows.find(r=>!r.stable.valid||!r.estimate.valid)?.stable?.effect??null};
  removedEffects=[...new Set(rows.flatMap(r=>r.stable.removed))];
  const amplification=verifiedTargetDamageAmplification(monster,seconds,options.G);
  rawOutgoing=rows.reduce((sum,{stable,estimate})=>
   sum+estimate.damage*stable.stats.frequency,0)*amplification;
  const lifesteal=projectedMonster.attack*1.1*
   (projectedMonster.crit>0?2+Math.max(0,projectedMonster.critdamage??0)/100:1)*
   projectedMonster.frequency*Math.max(0,projectedMonster.lifesteal??0)/100;
  outgoing=rawOutgoing-healing-lifesteal;
  if(!(outgoing>0)||!Number.isFinite(outgoing))
   return {safe:false,reason:'Schaden überwindet Schutz/Heilung nicht',outgoing,healing,seconds:Infinity};
  const next=projectedMonster.hp/outgoing;
  if(!Number.isFinite(next))
   return {safe:false,reason:'Kampfzeit nicht sicher berechenbar'};
  if(i>0&&next<=seconds+1e-8)break;
  seconds=Math.max(seconds,next);
  if(i===7)return {safe:false,reason:'Kampfeffekt-Prognose nicht konvergiert'};
 }
 const incoming=projectedMonster.attack*projectedMonster.frequency*Math.max(1,aggro),
  exposure=incoming*seconds;
 const stableHealer=healer&&stableFarmOffense(healer,seconds,{G:options.G,members:alive});
 const healCredit=stableHealer?.valid?
  farmHealing(stableHealer.stats,alive,seconds,options)*
  farmFearFactor(stableHealer.stats,projectedMonster,aggro):0;
 const protection=farmDefense(projectedMonster,alive,seconds,aggro,limits,healCredit,options);
 // A personal override changes only the estimated fight-time cap; the
 // selected risk profile retains its hit, exposure and mechanics safeguards.
 const maxSeconds=Number.isSafeInteger(options.maxCombatSeconds)&&options.maxCombatSeconds>=1&&options.maxCombatSeconds<=300?
  options.maxCombatSeconds:limits.seconds;
 const safe=seconds<=maxSeconds&&protection.safe;
 // Shadow projection is diagnostic only. Preserve the exact current
 // allow/deny criteria (including the exclusive healer budget).
 const model=estimateCombatTimeline(monster,alive,{
  healer:healer?.name,healing:!!options.healing,game:options.G,aggro,
  incomingSeconds:seconds,uncertainty:.1});
 const timelineShadow={valid:model.valid,reason:model.reason??null,
  projectedSeconds:model.seconds??null,lowerBoundDps:model.lowerBoundDps??null,
  expectedDps:model.expectedDps??null,
  healerDuty:model.healerBudget?.healerDuty??null,
  healerProjectedHeals:model.healerBudget?.projectedHeals??null,
  healerManaLimited:model.healerBudget?.healingDeficit??null,
  healerCastSlots:model.healerBudget?.casts??null,
  healerAttackSlots:model.healerBudget?.attackSlots??null,
  attackIntervalsMs:model.rows?.map(r=>({name:r.name,intervalMs:r.attackIntervalMs}))??[],
  expectedCritScenarioDps:model.expectedDps??null,
  deltaSeconds:model.valid&&Number.isFinite(model.seconds)?model.seconds-seconds:null,
  authority:'none'};
 return {timelineShadow,reason:safe?'Bekannte Gruppe innerhalb des Risikobudgets':'Treffer, Kampfdauer oder Schadensbudget überschritten',seconds,incoming,outgoing,rawExposure:exposure,...protection,safe,healCredit,healer:healer?.name??null,availableHp:weakest,removedOffensiveEffects:removedEffects};
}
