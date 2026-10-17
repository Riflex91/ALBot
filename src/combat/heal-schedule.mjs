// Deterministic finite healing/attack opportunity model, without making
// speculative healing into HP. All quantities are planning estimates, not
// observed server receipts. No gameplay or combat authority is granted here.
export function estimateHealAttackSchedule(healer,monster,{
 skill=null,durationSeconds=30,aggro=1,mpReserveRatio=.2
}={}){
 const invalid=reason=>({valid:false,reason,authority:'none',mode:'shadow-only',
  healerDuty:1,healerAttackFraction:0});
 if(!healer||!monster||!Number.isFinite(durationSeconds)||
    durationSeconds<1||durationSeconds>300||
    !Number.isFinite(aggro)||aggro<1||aggro>20||
    !Number.isFinite(mpReserveRatio)||mpReserveRatio<0||mpReserveRatio>.9)
  return invalid('invalid-schedule-context');
 const frequency=healer.frequency,mp=healer.mp,maxMp=healer.max_mp,
  baseHeal=healer.heal,cost=skill?.mp??healer.mp_cost,
  cooldown=skill?.cooldown??(1000/frequency);
 if(!Number.isFinite(frequency)||frequency<=0||frequency>100||
    !Number.isFinite(mp)||mp<0||!Number.isFinite(maxMp)||maxMp<=0||
    mp>maxMp||!Number.isFinite(cost)||cost<0||cost>1e7||
    !Number.isFinite(cooldown)||cooldown<0||cooldown>300000||
    !Number.isFinite(baseHeal)||baseHeal<=0||baseHeal>1e7)
  return invalid('heal-parameters-unverified');
 if(!Number.isFinite(monster.attack)||monster.attack<0||
   !Number.isFinite(monster.frequency)||monster.frequency<=0||
   monster.frequency>100)return invalid('incoming-hit-cadence-unverified');
 const durationMs=durationSeconds*1000,intervalMs=1000/frequency,
  healIntervalMs=Math.max(intervalMs,cooldown),
  slots=Math.max(0,Math.floor(durationMs/intervalMs)),
  cooldownSlots=Math.max(0,Math.floor(durationMs/healIntervalMs));
 const availableMp=Math.max(0,mp-maxMp*mpReserveRatio);
 const manaSlots=cost===0?cooldownSlots:Math.floor(availableMp/cost);
 const possibleCasts=Math.min(slots,cooldownSlots,manaSlots);
 const incomingPerSecond=monster.attack*monster.frequency*aggro;
 // Model the number of real heal-action opportunities needed to cover the
 // incoming threat. These casts compete with attacks for the SAME slots.
 // Never invent MP regeneration or pre-count heals as received HP.
 const requestedCasts=Math.min(slots,Math.ceil(incomingPerSecond*
   durationSeconds/baseHeal));
 const healSlots=Math.min(possibleCasts,requestedCasts);
 const deficitCasts=Math.max(0,requestedCasts-healSlots);
 const healingDeficit=healSlots*baseHeal<
   incomingPerSecond*durationSeconds;
 const attackSlots=Math.max(0,slots-healSlots);
 // A resource-starved healer may spend every available attack opportunity
 // triaging rather than attack. Do not add guaranteed DPS in that case.
 const healerDuty=healingDeficit?1:slots>0?healSlots/slots:1;
 return {valid:true,authority:'none',mode:'shadow-only',
  intervalMs,healIntervalMs,seconds:durationSeconds,
  actionSlots:slots,possibleCasts,requestedCasts,
  casts:healSlots,attackSlots:healingDeficit?0:attackSlots,
  deficitCasts,healingDeficit,availableMp,mpCost:cost,
  projectedHeals:healSlots*baseHeal,
  estimatedIncomingPerSecond:incomingPerSecond,
  healerDuty,healerAttackFraction:1-healerDuty,
  note:'Projected healing is not a server-confirmed HP increase'};
}
