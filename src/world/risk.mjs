// Conservative planning estimate: unknown healing, kiting and critical hits are not guaranteed.
export function assessCombat(monster,members,mode='balanced',aggro=1){
 const limits={conservative:{hit:.12,seconds:12,exposure:.35},balanced:{hit:.25,seconds:25,exposure:.55},aggressive:{hit:.4,seconds:45,exposure:.75}}[mode]??{hit:.12,seconds:12,exposure:.35};
 const alive=members.filter(c=>!c.rip&&c.hp>0&&c.max_hp>0&&c.attack>0&&c.frequency>0);
 if(!monster||!(monster.hp>0)||!Number.isFinite(monster.attack)||!(monster.frequency>0)||!alive.length)return {safe:false,reason:'Kampfwerte fehlen'};
 const weakest=Math.min(...alive.map(c=>Math.min(c.hp,c.max_hp))),armor=Math.max(0,Math.max(monster.armor??0,monster.resistance??0));
 // Ignoring the attackers' piercing overestimates fight duration for safety.
 const damageFactor=Math.max(.05,1/(1+armor/100)),outgoing=alive.reduce((sum,c)=>sum+c.attack*c.frequency*damageFactor,0);
 const seconds=monster.hp/outgoing,incoming=monster.attack*monster.frequency*Math.max(1,aggro),exposure=incoming*seconds;
 const safe=monster.attack<=weakest*limits.hit&&seconds<=limits.seconds&&exposure<=weakest*limits.exposure;
 return {safe,reason:safe?'Bekannte Gruppe innerhalb des Risikobudgets':'Treffer, Kampfdauer oder Schadensbudget überschritten',seconds,incoming,outgoing,exposure,availableHp:weakest};
}
