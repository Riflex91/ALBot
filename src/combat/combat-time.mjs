import {outgoingDamageEstimate} from './damage-model.mjs';

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
  const damage=outgoingDamageEstimate(c,monster,{skill,uncertainty});
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
   lowerBoundDps:rate});
 }
 if(!rows.length)return invalid('no-active-attacker');
 const h=healing&&healer?members.find(c=>c.name===healer):null;
 let healerBudget=null,healerDuty=0;
 if(h&&rows.some(r=>r.name===h.name)){
  const healSkill=game?.skills?.heal;
  const cost=healSkill?.mp??h.mp_cost??null;
  const baseHeal=h.heal??null;
  if(Number.isFinite(cost)&&cost>=0&&Number.isFinite(baseHeal)&&baseHeal>0&&
     Number.isFinite(h.mp)&&Number.isFinite(h.max_mp)&&h.max_mp>0&&
     Number.isFinite(h.frequency)&&h.frequency>0){
   const period=Math.max(1/h.frequency,Math.max(0,healSkill?.cooldown??0)/1000);
   const reserve=h.max_mp*.2;
   const casts=cost===0?Infinity:Math.floor(Math.max(0,h.mp-reserve)/cost);
   const duration=Math.max(5,Math.min(120,Number.isFinite(incomingSeconds)&&incomingSeconds>0?incomingSeconds:30));
   const availableCasts=Math.min(Math.floor(duration/period),casts);
   const sustainableRate=availableCasts*baseHeal/duration;
   const incomingRate=Number.isFinite(monster.attack)&&Number.isFinite(monster.frequency)?
    Math.max(0,monster.attack)*Math.max(0,monster.frequency)*aggro:0;
   // Reserve one full time slot per healing action. Never credit its attack
   // in the same slot or assume unbounded MP/heal throughput.
   healerDuty=Math.min(.95,Math.max(0,Math.min(1,incomingRate/
    Math.max(1,sustainableRate)))*Math.min(1,availableCasts*period/duration));
   healerBudget={name:h.name,periodMs:period*1000,mpCost:cost,
    casts:availableCasts,availableMp:Math.max(0,h.mp-reserve),
    projectedHeals:availableCasts*baseHeal,healerDuty,
    estimatedIncomingPerSecond:incomingRate};
  }else{
   // Unknown heal metadata: do not count any healer DPS in shadow.
   healerDuty=1;
   healerBudget={name:h.name,reason:'heal-parameters-unverified',healerDuty};
  }
 }
 const rawDps=rows.reduce((sum,r)=>sum+r.lowerBoundDps,0);
 const lowerBoundDps=rows.reduce((sum,r)=>sum+r.lowerBoundDps*
  (r.name===h?.name?1-healerDuty:1),0);
 const conservativeCritFreeDps=lowerBoundDps;
 const expectedDps=rows.reduce((sum,r)=>
  sum+(r.lowerBoundDps+r.expectedBonusRate)*
  (r.name===h?.name?1-healerDuty:1),0);
 return {valid:true,mode:'shadow-only',seconds:lowerBoundDps>0?
  monster.hp/lowerBoundDps:null,lowerBoundDps,expectedDps,
  rawDps,healerBudget,uncertainty,rows,
  explanation:'Critical hits excluded from conservative DPS; healing and attacks share time'};
}
