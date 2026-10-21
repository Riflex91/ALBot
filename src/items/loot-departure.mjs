import {distance,samePlace} from '../core/policy.mjs';
export function collectableChests(character,chests,free,reserve=0){
 if(!character||!chests||typeof chests!=='object'||!Number.isFinite(free))return [];
 return Object.entries(chests).slice(0,128).filter(([id,chest])=>
  id&&chest&&Number.isFinite(chest.x)&&Number.isFinite(chest.y)&&
  (!chest.map||chest.map===character.map)&&
  (!chest.in||chest.in===(character.in??character.map))&&
  distance(character,chest)<=700&&Number.isSafeInteger(chest.items)&&
  chest.items>=0&&chest.items<=Math.max(0,free-reserve)).map(([id])=>id);
}
// A bounded pre-departure collection opportunity. Disappearing chests are
// observable world changes, never proof that this character received loot.
export function createLootDeparture(bot,{now=()=>Date.now()}={}){
 let context='',started=null;const skipped=new Map();
 const read=()=>bot.p.parent?.chests??{};
 function pending(){
  const key=bot.p.realm()+':'+bot.p.c.map+':'+(bot.p.c.in??bot.p.c.map);
  if(context!==key){context=key;started=null;skipped.clear();}
  for(const [id,until] of skipped)if(until<=now())skipped.delete(id);
  return collectableChests(bot.p.c,read(),bot.free(),bot.cfg.farming.freeSlots??0)
   .filter(id=>!skipped.has(id));
 }
 return {
  beforeDeparture(destination,owner='travel'){
   if(!bot.cfg.farming.loot||['kite','combat','rescue'].includes(owner)||
      bot.p.c.rip||bot.monsters().some(m=>m.target===bot.p.c.name&&m.hp>0&&!m.dead)||
      destination&&samePlace(bot.p.c,destination)&&distance(bot.p.c,destination)<350)
    return true;
   const ids=pending();if(!ids.length){started=null;return true;}
   if(bot.inventoryBlocked||bot.journal||bot.bank?.pending||bot.logistics?.reserved)
    return true; // Inventory uncertainty cannot be fixed by opening a chest.
   if(started===null)started=now();
   if(now()-started>=3500){
    for(const id of ids)skipped.set(id,now()+30000);
    bot.event?.('loot.departureIncomplete',{count:ids.length,reason:'bounded-wait-expired'});
    started=null;return true;
   }
   if(bot.p.has('loot'))bot.exec.run('loot.departure',['inventory'],
    ()=>bot.running&&!bot.p.c.rip&&!bot.inventoryBlocked&&!bot.journal&&
     !bot.bank?.pending&&!bot.logistics?.reserved&&pending().length>0,
    ()=>Promise.resolve(bot.p.call('loot')).catch(error=>{
     if(String(error?.reason??error?.message??'')==='openning')return {transient:'openning'};
     throw error;
    }),{delay:1600,timeout:3000,waitForObservation:true,
     observe:()=>ids.some(id=>!read()[id]),
     onSettle:state=>bot.event?.('loot.departureObservation',{
      state,gone:ids.filter(id=>!read()[id]).length,receipt:'not-attributed'})});
   return false;
  },
  status:()=>({waiting:started!==null,skipped:skipped.size}),
  reset(){started=null;skipped.clear();context='';}
 };
}


// Recover chest backlog independently of combat/follower early returns.
// A successful loot() return is not proof of a received item: receipts
// continue to require the official chest_opened event and physical evidence.
export function createLootBacklog(bot,{now=()=>Date.now()}={}){
 let lastAttempt=-Infinity,lastAudit=-Infinity,holdStarted=null,releaseUntil=0;
 let scanAt=-Infinity,cached=[],place='',lastSelection='';
 const retry=new Map();
 const safe=()=>bot.running&&bot.me?.role==='farmer'&&
  bot.cfg.farming.loot&&!bot.p.c?.rip&&
  !bot.inventoryBlocked&&!bot.journal&&!bot.bank?.pending&&
  !bot.logistics?.reserved&&!bot.gold?.reserved&&
  !bot.strategy?.busy&&!bot.account?.rotationPending?.()&&
  bot.account?.active?.()!==false&&
  !['quest','economy'].includes(bot.movement?.order?.owner)&&
  bot.combatAssessment?.emergency?.()?.active!==true&&
  bot.free()>Math.max(0,bot.cfg.farming.freeSlots??0);
 function nearby(){
  const c=bot.p.c,key=bot.p.realm()+':'+c.map+':'+(c.in??c.map);
  if(key!==place){place=key;cached=[];scanAt=-Infinity;retry.clear();
   holdStarted=null;releaseUntil=0;}
  if(now()-scanAt<200)return cached;
  scanAt=now();
  const free=bot.free()-Math.max(0,bot.cfg.farming.freeSlots??0);
  const chests=bot.p.parent?.chests;
  cached=!chests||typeof chests!=='object'?[]:
   Object.entries(chests).slice(0,128)
    .filter(([id,chest])=>typeof id==='string'&&id.length>0&&
      chest&&Number.isFinite(chest.x)&&Number.isFinite(chest.y)&&
      (!chest.map||chest.map===c.map)&&
      (!chest.in||chest.in===(c.in??c.map))&&
      distance(c,chest)<=650&&
      (!Number.isSafeInteger(chest.items)||
        chest.items>=0&&chest.items<=free))
    .map(([id,chest])=>({id,distance:distance(c,chest)}))
    .sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));
  return cached;
 }
 function shouldYieldPull(){
  if(!safe()||bot.monsters().some(m=>m.hp>0&&!m.dead&&
     bot.teamNames?.includes(m.target))){holdStarted=null;return false;}
  const count=nearby().length;
  if(count<6){holdStarted=null;releaseUntil=0;return false;}
  if(now()<releaseUntil)return false;
  if(holdStarted===null)holdStarted=now();
  if(now()-holdStarted>=4000){
   releaseUntil=now()+10000;holdStarted=null;
   bot.event?.('loot.backlogYieldExpired',{remaining:count,reason:'bounded-combat-pause'});
   return false;
  }
  return true;
 }
 function tick(){
  if(!safe()||!bot.p.has('loot'))return false;
  const visible=nearby(),count=visible.length;
  const configured=Number.isFinite(bot.cfg.farming.lootEveryMs)?
   Math.max(300,bot.cfg.farming.lootEveryMs):1600;
  const interval=count>=4?Math.min(configured,400):configured;
  if(now()-lastAttempt<interval)return false;
  // Do not repeatedly pin the same chest after an unobserved result.
  for(const [id,until] of retry)if(until<=now())retry.delete(id);
  const selected=visible.find(row=>!retry.has(row.id));
  const id=selected?.id??null;
  if(count&&id===null)return false;
  const guard=()=>safe()&&(!id||nearby().some(x=>x.id===id));
  const accepted=bot.exec.run('loot',['inventory'],guard,()=>{
   if(id){retry.set(id,now()+1600);lastSelection=id;}
   return Promise.resolve(bot.p.call('loot',...(id?[id]:[]))).catch(error=>{
    if(String(error?.reason??error?.message??'')==='openning')
     return {transient:'openning'};
    throw error;
   });
  },{delay:interval,timeout:3000});
  if(accepted)lastAttempt=now();
  if(now()-lastAudit>=5000){
   lastAudit=now();
   bot.event?.('loot.backlog',{visible:count,selected:id,
    capacity:bot.free(),hold:holdStarted!==null,
    outcome:'dispatch-attempt-not-physical-receipt'});
  }
  return accepted;
 }
 return {tick,shouldYieldPull,
  status:()=>({visible:nearby().length,lastSelected:lastSelection,
   holding:holdStarted!==null,releasedUntil:releaseUntil}),
  reset(){lastAttempt=-Infinity;lastAudit=-Infinity;holdStarted=null;
   releaseUntil=0;scanAt=-Infinity;cached=[];retry.clear();place='';lastSelection='';}};
}
