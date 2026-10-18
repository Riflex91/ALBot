import {fingerprint,identity,distance} from '../core/policy.mjs';
export function boosterExpiry(item){
 if(!item?.expires)return null;
 const at=typeof item.expires==='number'?item.expires:Date.parse(item.expires);
 return Number.isFinite(at)&&at>0?at:null;
}
export function preferredBooster(mode,role){
 return role==='merchant'?'luckbooster':mode==='xp'?'xpbooster':
  mode==='gold'?'goldbooster':'luckbooster';
}
export function holidayOpportunity(character,G,state){
 const ref=G.maps?.[character?.map]?.ref?.newyear_tree;
 return !!(state?.holidayseason&&(state.holidayseason===true||state.holidayseason.live!==false&&state.holidayseason.active!==false)&&
  !character?.rip&&!character?.s?.holidayspirit&&!character?.cave&&
  !G.maps?.[character?.map]?.instance&&ref&&
  Number.isFinite(ref.x)&&Number.isFinite(ref.y)&&distance(character,ref)<275);
}
export function createWorldOpportunities(bot,{now=()=>Date.now()}={}){
 const {p,cfg}=bot,e=bot.economy,key='albot:booster-shift:'+bot.me.name;
 let lastProbe=0;
 const safe=()=>bot.running&&!p.c.rip&&!bot.recovering&&!bot.journal&&
  !bot.inventoryBlocked&&!bot.bank?.pending&&!bot.logistics?.reserved&&
  !bot.movement?.order&&!Object.keys(p.c.c??{}).length&&
  !bot.monsters().some(m=>m.target===p.c.name&&m.hp>0&&!m.dead);
 const unconstrained=i=>!['inventory','production','acquisition'].some(phase=>
  e.explicit(i,phase)&&e.explicit(i,phase).action!=='consume');
 function booster(){
  if(!e||cfg.world?.boosters!==true||!safe())return false;
  const want=preferredBooster(cfg.farming.mode,bot.me.role),
   names=['xpbooster','goldbooster','luckbooster'];
  const candidates=(p.c.items??[]).flatMap((item,slot)=>
   item&&names.includes(item.name)&&e.safe(item)&&unconstrained(item)?
    [{item,slot,expiry:boosterExpiry(item)}]:[]);
  const active=candidates.filter(row=>row.expiry>now()).sort((a,b)=>
   (b.item.level??0)-(a.item.level??0)||b.expiry-a.expiry);
  if(active.length){
   if(active.some(row=>row.item.name===want)||!p.has('shift')||
      p.c.s?.penalty_cd||now()-Number(p.read(key)??0)<3600000)return false;
   const {item,slot,expiry}=active[0],before=fingerprint(item);
   return e.perform('booster.shift',{slots:[slot],
    guard:()=>cfg.world.boosters===true&&safe()&&p.has('shift')&&
     fingerprint(p.c.items[slot])===before&&boosterExpiry(p.c.items[slot])===expiry&&
     unconstrained(p.c.items[slot])&&!p.c.s?.penalty_cd&&
     preferredBooster(cfg.farming.mode,bot.me.role)===want,
    call:()=>{if(p.write(key,now())!==true)throw Error('Boosterfrist nicht speicherbar');
     return p.call('shift',slot,want);},
    observe:()=>p.c.items[slot]?.name===want&&
     (p.c.items[slot].level??0)===(item.level??0)&&boosterExpiry(p.c.items[slot])===expiry,
    details:{item:item.name,slot,to:want,expiry},timeout:10000});
  }
  if(cfg.world.activateBoosters!==true||!p.has('activate'))return false;
  const chosen=candidates.filter(row=>!row.item.expires)
   .sort((a,b)=>(b.item.level??0)-(a.item.level??0))[0];
  if(!chosen)return false;
  const {item,slot}=chosen,before=fingerprint(item),variant=identity(item);
  return e.perform('booster.activate',{slots:[slot],
   guard:()=>cfg.world.boosters===true&&cfg.world.activateBoosters===true&&safe()&&
    fingerprint(p.c.items[slot])===before&&!p.c.items[slot].expires&&
    unconstrained(p.c.items[slot]),
   call:()=>p.call('activate',slot),
   observe:()=>identity(p.c.items[slot])===variant&&boosterExpiry(p.c.items[slot])>now(),
   details:{item:item.name,slot,beforeExpires:null},timeout:10000});
 }
 function holiday(){
  if(cfg.world?.seasonalBuff===false||!e||!safe()||!p.has('interact')||
     bot.free()<1||!holidayOpportunity(p.c,p.G,p.root.S??p.parent.S))return false;
  return e.perform('quest.holidayspirit',{
   guard:()=>safe()&&cfg.world.seasonalBuff!==false&&bot.free()>0&&
    holidayOpportunity(p.c,p.G,p.root.S??p.parent.S),
   call:()=>p.call('interact','newyear_tree'),
   observe:()=>!!p.c.s?.holidayspirit,
   details:{quest:'holidayspirit'},timeout:10000});
 }
 return {tick(){if(now()-lastProbe<5000)return false;lastProbe=now();
   return holiday()||booster();}};
}
