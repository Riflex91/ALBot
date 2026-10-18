export function potionChannelPolicy(character,{threatened=false,emergencyRatio=.35}={}){
 const channels=['town','fishing','mining'].filter(key=>!!character?.c?.[key]);
 const emergency=threatened&&Number.isFinite(character?.hp)&&
  character.max_hp>0&&character.hp/character.max_hp<emergencyRatio;
 return {allowed:!channels.length||emergency,interrupt:emergency?channels:[],
  reason:channels.length?(emergency?'survival-before-channel':'channel-active'):'ready'};
}
// Both HP and MP lines in dual potions contribute; unused restoration does not.
// Selection only ranks already authorized physical inventory candidates.
export function rankRecoveryPotion(character,gives,resource){
 if(!Array.isArray(gives))return -Infinity;
 const missing=key=>Math.max(0,(character['max_'+key]??0)-(character[key]??0));
 const restore=key=>gives.filter(r=>Array.isArray(r)&&r[0]===key&&
  Number.isFinite(r[1])&&r[1]>0).reduce((n,r)=>n+r[1],0);
 if(restore(resource)<=0)return -Infinity;
 const gain=key=>Math.min(missing(key),restore(key))/Math.max(1,missing(key));
 const waste=['hp','mp'].reduce((n,key)=>n+Math.max(0,restore(key)-missing(key))/
  Math.max(1,restore(key)),0);
 return gain(resource)+.25*gain(resource==='hp'?'mp':'hp')-.05*waste;
}
export function beginCombatLife(bot){
 const dead=!!bot.p.c?.rip,prior=bot.combatLife;
 if(prior&&prior.dead===dead)return false;
 bot.combatLife={dead,generation:(prior?.generation??0)+1};
 if(prior){
  bot.target=null;
  for(const resource of ['attack','mana','skill','movement'])bot.exec.cancelResource(resource);
  bot.movement.stop();
  bot.event?.('combat.lifeGeneration',{...bot.combatLife,reason:dead?'death':'revived'});
 }
 return true;
}
