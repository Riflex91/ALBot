const FARMER_CLASSES=['warrior','mage','priest','ranger','rogue','paladin'];
export function ownSupplyCharacters(p){
 try{if(!p.has?.('get_characters'))return [];const rows=p.call('get_characters');
  if(!Array.isArray(rows)||rows.length>128)return [];
  return rows.filter(r=>r&&typeof r.name==='string'&&/^[A-Za-z0-9_]{1,80}$/.test(r.name)).map(r=>({name:r.name,class:r.type??r.ctype??r.class??null}));
 }catch{return [];}
}
export function potionTarget(cfg,id){
 const base=id.startsWith('hpot')?cfg.merchant.hpPotionTarget??3000:cfg.merchant.mpPotionTarget??300;
 return Number.isSafeInteger(base)&&base>=0?Math.min(base,cfg.farming?.potionCarryMax??1000000):0;
}
export function onlineSupplyFarmers(bot){
 const configured=(bot.cfg.characters??[]).filter(c=>c.enabled&&c.role==='farmer'&&c.group===bot.me.group).map(c=>c.name);
 const names=new Set(configured.length?configured:bot.farmers??[]);
 if(bot.cfg.merchant.discoverOwnFarmers===true)for(const c of bot.transport?.ownCharacters?.()??[])if(c.class!=='merchant')names.add(c.name);
 return [...names].filter(n=>n!==bot.me.name).map(name=>({name,peer:bot.transport?.fresh?.(name)})).filter(({name,peer})=>
  peer?.running===true&&!peer.rip&&peer.realm===bot.p.realm()&&
  (configured.includes(name)||(bot.farmers??[]).includes(name)||FARMER_CLASSES.includes(peer.class)));
}
export function automaticSupplyReceiver(cfg,p){
 if(cfg.merchant.discoverOwnFarmers!==true||cfg.characters.some(c=>c.name===p.c?.name)||!FARMER_CLASSES.includes(p.c?.ctype))return null;
 const own=ownSupplyCharacters(p);if(!own.some(c=>c.name===p.c.name)||!own.some(c=>c.name===cfg.party.merchant))return null;
 return {name:p.c.name,enabled:true,class:p.c.ctype,role:'farmer',group:cfg.party.group,region:(p.realm().match(/^([A-Z]{2})(.+)$/)?.[1]??''),server:(p.realm().match(/^([A-Z]{2})(.+)$/)?.[2]??''),merchantMobility:'mobile',rotation:false,catchUp:false,goldReserve:0,gearRole:'auto',farmTargets:[]};
}
