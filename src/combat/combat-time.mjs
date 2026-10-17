import {outgoingDamageEstimate} from './damage-model.mjs';
import {farmFearFactor} from '../world/composition.mjs';
import {estimateHealAttackSchedule} from './heal-schedule.mjs';

// Experimental, read-only combat model. It may NEVER authorize a pull, change
// a target or replace assessCombat's verified conservative healer exclusion.
// Compare shadow predictions with actual fights before using them for safety.
export function estimateCombatTimeline(monster,members,{
 healer=null,healing=false,skill=null,uncertainty=.1,aggro=1,
 incomingSeconds=0,game=null
}={}){
 const invalid=reason=>({valid:false,reason,mode:'shadow-only'});
 if(!monster||!Number.isFinite(monster.hp)||monster.hp<=0||
    !Array.isArray(members)||!members.length||
    !Number.isFinite(uncertainty)||uncertainty<0||uncertainty>.5||
    !Number.isFinite(aggro)||aggro<1||aggro>20)
  return invalid('invalid-combat-context');
 const rows=[];
 for(const c of members){
  if(c?.rip||!(c?.hp>0))continue;
  if(!Number.isFinite(c.attack)||c.attack<=0||
     !Number.isFinite(c.frequency)||c.frequency<=0)
   return invalid('unverified-attacker');
  const damage=outgoingDamageEstimate(c,monster,{skill,uncertainty,
   fearFactor:farmFearFactor(c,monster,aggro)});
  if(!damage.valid)return invalid(damage.reason);
  // Avoid assuming a critical hit for the conservative lower bound.
  const crit=c.crit??0,extra=c.critdamage??0;
  if(!Number.isFinite(crit)||crit<0||crit>100||
     !Number.isFinite(extra)||extra<0||extra>500)
   return invalid('unverified-crit');
  const rate=damage.damage*c.frequency;
  rows.push({name:c.name??'',class:c.ctype??c.class??'',rate,
   attacksPerSecond:c.frequency,meanIntervalMs:1000/c.frequency,
   critChance:crit/100,expectedBonusRate:rate*crit/100*(1+extra/100),
   lowerBoundDps:rate,
   minimumHitDamage:damage.raw>0?damage.raw*(1-uncertainty):0,
   nominalDamage:damage.raw,hitAccuracy:damage.accuracy,
   attackIntervalMs:1000/c.frequency});
 }
 if(!rows.length)return invalid('no-active-attacker');
 const h=healing&&healer?members.find(c=>c.name===healer):null;
 let healerBudget=null,healerDuty=0;
 if(h&&rows.some(r=>r.name===h.name)){
  const duration=Number.isFinite(incomingSeconds)&&incomingSeconds>0?
    Math.max(5,Math.min(120,incomingSeconds)):30;
  const schedule=estimateHealAttackSchedule(h,monster,{
   skill:game?.skills?.heal??null,durationSeconds:duration,aggro
  });
  if(!schedule.valid){
   // Unknown heal data is not permission to count any healer attacks.
   healerDuty=1;healerBudget={name:h.name,reason:schedule.reason,healerDuty,
    healingDeficit:true,authority:'none'};
  }else{
   healerDuty=schedule.healerDuty;
   healerBudget={...schedule,name:h.name,periodMs:schedule.healIntervalMs};
  }
 }
 const rawDps=rows.reduce((sum,r)=>sum+r.lowerBoundDps,0);
 const lowerBoundDps=rows.reduce((sum,r)=>sum+r.lowerBoundDps*
  (r.name===h?.name?1-healerDuty:1),0);
 const conservativeCritFreeDps=lowerBoundDps;
 const expectedDps=rows.reduce((sum,r)=>
  sum+(r.lowerBoundDps+r.expectedBonusRate)*
  (r.name===h?.name?1-healerDuty:1),0);
 const skillScenario=skill?{id:skill.name??null,damageMultiplier:skill.damage_multiplier??1,
  authority:'none',reason:'skill-cast-frequency-not-observed'}:null;
 return {valid:true,mode:'shadow-only',authority:'none',
  skillScenario,healingDeficit:healerBudget?.healingDeficit??null,
  attacksNotGuaranteed:true,
  seconds:lowerBoundDps>0?
  monster.hp/lowerBoundDps:null,lowerBoundDps,expectedDps,
  rawDps,healerBudget,uncertainty,rows,
  explanation:'Estimated hit accuracy is not a hit guarantee; critical hits are scenario-only; verified cooldown/MP healing consumes attack slots'};
}
