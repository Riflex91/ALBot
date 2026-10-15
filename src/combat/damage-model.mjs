// Conservative outgoing damage estimate, using the same defense curve as the
// official Adventure Land damage_multiplier implementation. No skills are
// dispatched by this module; the server remains the source of truth.
//
// Reference: kaansoral/adventureland_mongodb js/progression/stats.js.
// Chance, target-specific defense and attacker-specific piercing must not be
// conflated with confidence: the latter is a separate bounded planning margin.
export function damageMultiplier(defense){
 if(!Number.isFinite(defense))return null;
 const weights=[.001,.001,.00095,.0009,.00082,.0007,.0006,.0005];
 const reduction=weights.reduce((n,w,i)=>n+Math.max(0,Math.min(100,defense-i*100))*w,0)+Math.max(0,defense-800)*.0004;
 const negative=Math.max(0,Math.min(50,-defense))*.001+
  Math.max(0,Math.min(50,-50-defense))*.00075+
  Math.max(0,Math.min(50,-100-defense))*.0005+
  Math.max(0,-150-defense)*.00025;
 return Math.min(1.32,Math.max(.05,1-reduction+negative));
}

export function outgoingDamageEstimate(attacker,monster,{
 skill=null,fearFactor=1,uncertainty=0
}={}){
 const type=skill?.damage_type??attacker?.damage_type??
  (['mage','priest'].includes(attacker?.ctype??attacker?.class)?'magical':'physical');
 if(!['physical','magical','pure'].includes(type)||
    !Number.isFinite(attacker?.attack)||attacker.attack<=0||
    !monster||!Number.isFinite(fearFactor)||fearFactor<0||fearFactor>1||
    !Number.isFinite(uncertainty)||uncertainty<0||uncertainty>=1)
  return {valid:false,reason:'unknown-combat-parameters',damage:0};
 const defense=type==='physical'?monster.armor??0:type==='magical'?monster.resistance??0:0;
 const piercing=type==='physical'?attacker.apiercing??0:type==='magical'?attacker.rpiercing??0:0;
 if(!Number.isFinite(defense)||!Number.isFinite(piercing))return {valid:false,reason:'invalid-defense',damage:0};
 const factor=type==='pure'?1:damageMultiplier(defense-piercing);
 const skillMultiplier=skill?.damage_multiplier??1;
 if(!Number.isFinite(skillMultiplier)||skillMultiplier<=0)
  return {valid:false,reason:'unknown-skill-multiplier',damage:0};
 const clampChance=x=>Number.isFinite(x)&&x>=0&&x<=100?1-x/100:null;
 const avoidance=clampChance(monster.avoidance??0);
 const typeAvoidance=clampChance(type==='magical'?monster.reflection??0:monster.evasion??0);
 if(avoidance===null||typeAvoidance===null)
  return {valid:false,reason:'unknown-avoidance',damage:0};
 const accuracy=avoidance*typeAvoidance;
 // 1-HP creatures still require a real hit. Never create guaranteed hits.
 const raw=monster['1hp']?1:attacker.attack*factor*skillMultiplier;
 const damage=raw*accuracy*fearFactor*(1-uncertainty);
 return {valid:true,damage,raw,accuracy,type,defense,piercing,factor,
  fearFactor,uncertainty,skillMultiplier};
}
