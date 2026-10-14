import {carriedAchievementCarrier,trackerDeliveryNeed,trackerMerchantKeep}
 from '../items/achievement-utility.mjs';
import {protectedItem,fingerprint} from '../core/policy.mjs';

// Official: G.tokens.monstertoken.tracker = 4; runner exchange_buy()
// addresses the FIRST matching token slot, not a caller-provided slot.
// Pin precisely that slot, its quantity, the NPC and a durable recipient
// assignment before dispatch. Never auto-spend tokens for an unknown Farmer.
export function createTrackerAcquisition(bot){
 const {p,cfg,me}=bot,key='albot:tracker-exchange:'+me.name;
 const saved=p.read?.(key);
 // Malformed durable state is an unresolved value intent, not a reset.
 let pending=saved===null||saved===undefined?null:
   saved&&typeof saved.recipient==='string'&&
   Number.isFinite(saved.at)?saved:{recipient:'',at:0,invalid:true};
 let reason=pending?'await-recipient':'no-need';

 function recipient(){
  if(!Array.isArray(bot.farmers))return null;
  for(const name of bot.farmers){
   if(typeof name!=='string'||!name||name===me.name)continue;
   const h=bot.transport?.fresh?.(name);
   if(trackerDeliveryNeed(h,p.realm(),{reserve:cfg.farming?.freeSlots??4}))
    return name;
  }
  return null;
 }
 function candidate(){
  if(me.role!=='merchant'||!cfg.merchant?.enabled||!cfg.merchant.supply||
    !bot.running||!bot.checkpoint?.durable||bot.inventoryBlocked||bot.journal||
    bot.logistics?.reserved||bot.bank?.pending||pending)return null;
  if(p.G?.tokens?.monstertoken?.tracker!==4||
    p.G.items?.tracker?.type!=='tracker'||
    p.G.items?.monstertoken?.type!=='token')return null;
  if((cfg.items??[]).some(r=>r?.enabled&&
    ['tracker','monstertoken'].includes(r.item)))return null;
  const dest=recipient();
  if(!dest||!Array.isArray(p.c.items))return null;
  if(!carriedAchievementCarrier(p.c.items))return null;
  const own=p.c.items.filter(i=>i?.name==='tracker'&&!protectedItem(i)).length;
  if(own>trackerMerchantKeep(p.c.items))return null;
  // The game function exchange_buy chooses the FIRST token slot, including
  // locked/undersized stacks. Do not accidentally spend a different stack.
  const slot=p.c.items.findIndex(i=>i?.name==='monstertoken');
  const token=p.c.items[slot];
  if(slot<0||protectedItem(token)||!Number.isSafeInteger(token.q)||
    token.q<4||token.level>0||token.data!==undefined||
    token.acc||token.rid||token.p||token.title||token.stat_type||
    bot.production?.reservedQuantity?.(token)>0)return null;
  if(p.c.items.filter(i=>!i).length<=(cfg.merchant.minFreeSlots??4))return null;
  return {recipient:dest,slot,sourceFingerprint:fingerprint(token),
   tokensBefore:p.c.items.reduce((n,i)=>n+(i?.name==='monstertoken'?(i.q??1):0),0),
   trackersBefore:p.c.items.filter(i=>i?.name==='tracker').length};
 }
 function eligible(){return !!candidate();}
 function tick(){
  if(pending){
   const h=bot.transport?.fresh?.(pending.recipient);
   if(h?.running&&h.realm===p.realm()&&
      ['tracker','supercomputer'].includes(h.achievementCarrier)){
    if(p.write?.(key,null)!==true)return false;
    pending=null;reason='recipient-confirmed';
   }else{reason=pending.invalid?'invalid-durable-state':'await-recipient';return false;}
  }
  const plan=candidate();if(!plan)return false;
  const e=bot.economy,d=e?.destination?.('monsterhunter');
  if(!d||!e?.npcTravel?.(d,'Daisy: Tracktrix gegen 4 Monster Tokens'))return false;
  const valid=()=>{const next=candidate();return !!next&&next.recipient===plan.recipient&&
    next.slot===plan.slot&&next.sourceFingerprint===plan.sourceFingerprint&&
    next.tokensBefore===plan.tokensBefore&&next.trackersBefore===plan.trackersBefore&&
    e.npcAt?.(d)===true&&p.G.tokens.monstertoken.tracker===4;};
  if(!valid())return false;
  return e.perform('tracker.exchange',{
   slots:[plan.slot],guard:valid,timeout:20000,
   call:()=>{
    // Durable intent is written before ANY token is spent. An unknown
    // exchange stays locked until a verified recipient carries Tracktrix.
    const next={recipient:plan.recipient,at:Date.now()};
    if(p.write?.(key,next)!==true)throw Error('Tracktrix-Auftrag nicht dauerhaft gespeichert');
    pending=next;reason='await-recipient';
    return p.call('exchange_buy','monstertoken','tracker');
   },
   observe:()=>p.c.items.filter(i=>i?.name==='tracker').length===
       plan.trackersBefore+1&&
     p.c.items.reduce((n,i)=>n+(i?.name==='monstertoken'?(i.q??1):0),0)===
       plan.tokensBefore-4,
   details:{item:'tracker',token:'monstertoken',quantity:1,tokensSpent:4,
    recipient:plan.recipient,sourceSlot:plan.slot,
    tokenSourceFingerprint:plan.sourceFingerprint,
    tokensBefore:plan.tokensBefore,trackersBefore:plan.trackersBefore}
  });
 }
 return {eligible,tick,status:()=>({pendingRecipient:pending?.recipient||null,
   reason}),close(){}};
}
