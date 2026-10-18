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
