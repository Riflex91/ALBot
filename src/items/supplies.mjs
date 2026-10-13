// Skill consumption must follow the real, currently unlocked rotation,
// not only the subset of skills that have an explicit editor rule.
// These are the consuming skills actually invoked by skills.rotation/support;
// the live G remains authoritative for class, unlock level and item ID.
export function plannedSkillReagents(G,character,cfg,me){
 const rotation={
  ranger:['poisonarrow'],rogue:['pcoat'],mage:['entangle'],
  priest:['phaseout',...(cfg.party?.enabled&&cfg.party?.revive?['revive']:[])]
 }[character?.ctype]??[];
 const custom=(cfg.skills??[]).filter(r=>r.enabled&&
  (!r.character||r.character===me.name)&&
  (r.class==='auto'||r.class===character?.ctype)).map(r=>r.skill);
 return [...new Set([...rotation,...custom])].filter(id=>{
  const s=G.skills?.[id];
  return !!s&&typeof s.consume==='string'&&!!G.items?.[s.consume]&&
   (!s.class||s.class.includes(character.ctype))&&
   (s.level??0)<=character.level;
 }).map(id=>G.skills[id].consume).filter((item,i,items)=>items.indexOf(item)===i);
}
// Reagent orders use the existing production and acknowledged delivery path.
export function createSupplies(bot){
 const {p,cfg,me}=bot,key='albot:supplies:v1:'+me.name;
 let saved=p.read(key),requests=saved?.version===1&&Array.isArray(saved.requests)?saved.requests.filter(r=>
  r&&typeof r.item==='string'&&Number.isSafeInteger(r.quantity)&&r.quantity>0&&r.quantity<=100&&
  Number.isSafeInteger(r.cycle)&&r.cycle>0&&r.cycle<=Date.now()).slice(0,6):[];
 let last=0;
 const selected=()=>plannedSkillReagents(p.G,p.c,cfg,me);

 function request(){
  if(cfg.production.skillSupplies!==true||!bot.running||p.c.rip)return [];
  if(Date.now()-last<5000)return requests;last=Date.now();
  const target=cfg.production.skillSupplyCount??20;
  const ids=[...new Set(selected())].slice(0,6),next=[];
  for(const item of ids){
   const rule=bot.economy.explicit({name:item,level:0});if(rule?.action==='keep')continue;
   const held=bot.count(item),old=requests.find(r=>r.item===item);
   if(held>=target)continue;
   if(old&&Date.now()-old.cycle<3600000){next.push(old);continue;}
   if(held>Math.floor(target/2))continue;
   next.push({item,quantity:target-held,cycle:Date.now()});
  }
  if(JSON.stringify(next)!==JSON.stringify(requests)&&p.write(key,{version:1,requests:next}))requests=next;
  return requests;
 }
 function goals(){
  if(cfg.production.skillSupplies!==true||me.role!=='merchant')return [];
  return [...new Set([...bot.farmers,me.name])].flatMap(name=>{
   const peer=name===me.name?{running:bot.running,realm:p.realm(),class:p.c.ctype,supplies:request()}:bot.transport.fresh(name);
   if(!peer?.running||peer.rip||peer.realm!==p.realm())return [];
   return (Array.isArray(peer.supplies)?peer.supplies:[]).slice(0,6).filter(r=>
    r&&typeof r.item==='string'&&Number.isSafeInteger(r.quantity)&&r.quantity>0&&r.quantity<=100&&
    Number.isSafeInteger(r.cycle)&&r.cycle<=Date.now()&&Date.now()-r.cycle<3600000&&
    Object.values(p.G.skills??{}).some(s=>s.consume===r.item&&(!s.class||s.class.includes(peer.class)))&&
    bot.economy.explicit({name:r.item,level:0},'acquisition')?.action!=='keep'
   ).map(r=>({name:'Skillvorrat: '+name+' / '+r.item+' / '+r.cycle,enabled:true,item:r.item,
    level:0,quantity:r.quantity,recipient:name===me.name?'':name,budget:cfg.production.helperMaxPrice,priority:60}));
  });
 }
 return {request,goals};
}
