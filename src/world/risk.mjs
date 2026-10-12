// Conservative planning estimate: unknown healing, kiting and critical hits are not guaranteed.
export function assessCombat(monster,members,mode='balanced',aggro=1){
 const limits={conservative:{hit:.12,seconds:12,exposure:.35},balanced:{hit:.25,seconds:25,exposure:.55},aggressive:{hit:.4,seconds:45,exposure:.75}}[mode]??{hit:.12,seconds:12,exposure:.35};
 const alive=members.filter(c=>!c.rip&&c.hp>0&&c.max_hp>0&&c.attack>0&&c.frequency>0);
 if(!monster||!(monster.hp>0)||!Number.isFinite(monster.attack)||!(monster.frequency>0)||!alive.length)return {safe:false,reason:'Kampfwerte fehlen'};
 const unsupported=Object.keys(monster.abilities??{}).filter(k=>!['self_healing','heal'].includes(k));
 if(unsupported.length||monster.reflection>0||monster.explosion||monster.respawn_as||monster.spawns||monster.aura||monster.rbuff==='mlifesteal')
  return {safe:false,reason:'Spezialmechanik benötigt validiertes Kampfprofil: '+(unsupported.join(',')||'Phasen/Reflexion/Aura'),mechanics:true};
 if(monster.s?.fullguard||monster.s?.fullguardx)return {safe:false,reason:'Aktive Schutzphase',mechanics:true};
 const weakest=Math.min(...alive.map(c=>Math.min(c.hp,c.max_hp))),armor=Math.max(0,Math.max(monster.armor??0,monster.resistance??0));
 // Ignoring the attackers' piercing overestimates fight duration for safety.
 const damageFactor=Math.max(.05,1/(1+armor/100));
 const avoidance=1-Math.min(100,Math.max(0,monster.avoidance??0))/100;
 const rawOutgoing=alive.reduce((sum,c)=>{
  const avoid=avoidance*(1-Math.min(100,Math.max(0,c.damage_type==='magical'?monster.reflection??0:monster.evasion??0))/100);
  return sum+(monster['1hp']?1:c.attack*damageFactor)*c.frequency*avoid;
 },0);
 const healing=Object.values(monster.abilities??{}).reduce((n,a)=>n+(a.heal>0&&a.cooldown>0?a.heal*1000/a.cooldown:0),0);
 const outgoing=rawOutgoing-healing;
 if(!(outgoing>0))return {safe:false,reason:'Schaden überwindet Schutz/Heilung nicht',outgoing,healing,seconds:Infinity};
 const seconds=monster.hp/outgoing,incoming=monster.attack*monster.frequency*Math.max(1,aggro),exposure=incoming*seconds;
 const safe=monster.attack<=weakest*limits.hit&&seconds<=limits.seconds&&exposure<=weakest*limits.exposure;
 return {safe,reason:safe?'Bekannte Gruppe innerhalb des Risikobudgets':'Treffer, Kampfdauer oder Schadensbudget überschritten',seconds,incoming,outgoing,exposure,availableHp:weakest};
}
