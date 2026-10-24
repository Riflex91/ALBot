import {carriedAchievementCarrier,trackerDeliveryNeed,trackerMerchantKeep} from '../items/achievement-utility.mjs';
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
 let reason=pending?'await-recipient':'no-need',nextBankProbe=0;
 const legacyRecoveryKey=key+':legacy-recovered';
 const tokenCount=()=>Array.isArray(p.c.items)?p.c.items.reduce((n,i)=>
  n+(i?.name==='monstertoken'?(i.q??1):0),0):0;
 const trackerCount=()=>Array.isArray(p.c.items)?
  p.c.items.filter(i=>i?.name==='tracker').length:0;
 // Recover a pre-dispatch intent only after the LIVE inventory proves that
 // no tokens and no Tracker changed. A snapshot-free legacy intent may be
 // retried once, after a long hold, only with fresh recipient/stock evidence.
 function recoveryDue(){
  if(!pending||pending.invalid||!Number.isFinite(pending.at)||
     pending.at<=0||Date.now()-pending.at<60000||
     bot.checkpoint?.durable!==true||!bot.running||bot.journal||
     bot.inventoryBlocked||bot.bank?.pending||bot.logistics?.reserved||
     recipient()!==pending.recipient||!Array.isArray(p.c.items))return false;
  if(Number.isSafeInteger(pending.tokensBefore)&&
     Number.isSafeInteger(pending.trackersBefore))
   return tokenCount()===pending.tokensBefore&&
     trackerCount()===pending.trackersBefore;
  return Date.now()-pending.at>=300000&&
     p.read?.(legacyRecoveryKey)!==true&&tokenCount()>=4&&
     !p.c.items.some(i=>i?.name==='tracker'&&!protectedItem(i));
 }

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
 // Prefer already-owned, LIVE-observed bank inventory. Persisted catalog
 // rows are planning hints only; a bank retrieve must still independently
 // validate the exact live pack, slot and item variant before dispatch.
 function bankCandidate(){
  if(me.role!=='merchant'||!cfg.merchant?.enabled||!cfg.merchant.supply||
    !cfg.merchant.bank||!bot.running||!bot.checkpoint?.durable||
    bot.inventoryBlocked||bot.journal||bot.bank?.pending||
    bot.logistics?.reserved||pending||!Array.isArray(p.c.items)||
    p.c.items.filter(i=>!i).length<=(cfg.merchant.minFreeSlots??4)||
    !recipient()||
    (cfg.items??[]).some(r=>r?.enabled&&
      ['tracker','monstertoken'].includes(r.item)))return null;
  const own=p.c.items.filter(i=>i?.name==='tracker'&&!protectedItem(i)).length;
  if(own>trackerMerchantKeep(p.c.items))return null;
  for(const [pack,items] of Object.entries(p.c.bank??{})){
   if(!/^items[0-9]+$/.test(pack)||!Array.isArray(items)||
      !p.G?.bank_packs?.[pack])continue;
   const item=items.find(i=>i?.name==='tracker'&&!protectedItem(i)&&
     (i.level??0)===0&&(i.q??1)===1&&!i.data&&!i.acc&&!i.rid&&
     !i.p&&!i.title&&!i.stat_type&&!i.v&&!i.special);
   if(item)return {pack,item};
  }
  return null;
 }
 function candidate(){
  if(me.role!=='merchant'||!cfg.merchant?.enabled||!cfg.merchant.supply||
    !bot.running||!bot.checkpoint?.durable||bot.inventoryBlocked||bot.journal||
    bot.logistics?.reserved||bot.bank?.pending||pending)return null;
  if(p.G?.tokens?.monstertoken?.tracker!==4||
    p.G.items?.tracker?.type!=='tracker'||
    p.G.items?.monstertoken?.type!=='token'||
    p.G.items?.monstertoken?.npc!=='monsterhunter'||
    p.G.npcs?.monsterhunter?.role!=='monstertokens'||
    !Number.isSafeInteger(p.G.items.monstertoken.g)||
    p.G.items.monstertoken.g<0)return null;
  if((cfg.items??[]).some(r=>r?.enabled&&
    ['tracker','monstertoken'].includes(r.item)))return null;
  const dest=recipient();
  if(!dest||!Array.isArray(p.c.items))return null;
  const own=p.c.items.filter(i=>i?.name==='tracker'&&!protectedItem(i)).length;
  if(own>trackerMerchantKeep(p.c.items)||bankCandidate())return null;
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
 function bankProbeDue(){
  // A stale bank catalog is NOT evidence for a withdrawal, but it is safe
  // to revisit the real bank, at a bounded frequency, for missing Tracktrix.
  return me.role==='merchant'&&cfg.merchant?.enabled&&cfg.merchant.supply&&
   cfg.merchant.bank&&bot.running&&bot.checkpoint?.durable&&
   !pending&&!bot.journal&&!bot.inventoryBlocked&&!bot.bank?.pending&&
   !bot.logistics?.reserved&&Date.now()>=nextBankProbe&&
   !!p.G?.bank_packs?.items0&&!p.c.bank&&
   typeof bot.bank?.ready==='function'&&
   !(cfg.items??[]).some(r=>r?.enabled&&['tracker','monstertoken'].includes(r.item))&&
   p.c.items.filter(i=>!i).length>(cfg.merchant.minFreeSlots??4)&&
   !p.c.items.some(i=>i?.name==='tracker'&&!protectedItem(i))&&
   !p.c.items.some(i=>i?.name==='monstertoken'&&!protectedItem(i)&&i.q>=4)&&
   !!recipient();
 }
 function catalogCandidate(){
  // Planning-only bank rows can justify a fresh inspection, but they are
  // never retrieval authority. A previously failed verification must not
  // trigger another bank journey every time the Merchant leaves the bank.
  return Date.now()>=nextBankProbe&&!p.c.bank&&!!recipient()&&
   bot.bank?.catalogStock?.()?.some(r=>r.item?.name==='tracker'&&
    !protectedItem(r.item))===true;
 }
 function eligible(){return recoveryDue()||!!bankCandidate()||!!candidate()||
   catalogCandidate()||bankProbeDue();}
 function tick(){
  if(pending){
   const h=bot.transport?.fresh?.(pending.recipient);
   if(h?.running&&h.realm===p.realm()&&
      ['tracker','supercomputer'].includes(h.achievementCarrier)){
    if(p.write?.(key,null)!==true)return false;
    pending=null;reason='recipient-confirmed';
   }else if(recoveryDue()){
    const legacy=!Number.isSafeInteger(pending.tokensBefore);
    if(legacy&&p.write?.(legacyRecoveryKey,true)!==true)return false;
    if(p.write?.(key,null)!==true)return false;
    bot.event?.('tracker.reconciled',{recipient:pending.recipient,
      reason:legacy?'bounded-legacy-recovery':'unchanged-pre-dispatch-inventory',
      tokens:tokenCount(),trackers:trackerCount()});
    pending=null;reason='unspent-order-recovered';
   }else{reason=pending.invalid?'invalid-durable-state':'await-recipient';return false;}
  }
  // A fresh catalog may justify travel, never withdrawal without live slots.
  if(catalogCandidate()&&!bankCandidate()){
   const row=bot.bank?.catalogStock?.().find(r=>r.item?.name==='tracker'&&!protectedItem(r.item));
   if(row){
    // Positive cached stock is a planning hint only. Bounded one probe per
    // three minutes, even when the live pack lacks the promised Tracker.
    nextBankProbe=Date.now()+180000;
    reason='bank-travel-for-verified-stock';
    const arrived=bot.bank.ready(row.pack);
    return !!arrived||bot.movement?.order?.owner==='economy';
   }
  }
  const stored=bankCandidate();
  if(stored){
   reason='bank-stock-first';
   return bot.bank?.retrieve?.({name:'tracker',level:0,stat_type:'',p:'',title:''},
    {enabled:true,name:'Bankreserve Tracktrix für Farmer',item:'tracker',
     action:'retrieve',pack:stored.pack,batch:1,maxCount:9999,
     keep:0,teamReserve:0,maxActions:0},1)??false;
  }
  if(bankProbeDue()){
   nextBankProbe=Date.now()+180000;reason='bank-stock-verification';
   const arrived=bot.bank.ready('items0');
   return !!arrived||bot.movement?.order?.owner==='economy';
  }
  const plan=candidate();if(!plan)return false;
  const e=bot.economy,d=e?.destination?.('monsterhunter');
  if(!d||!e?.npcTravel?.(d,'Daisy: Tracktrix gegen 4 Monster Tokens'))return false;
  const tokenValue=p.G.items.monstertoken.g,loss=4*tokenValue;
  if(!Number.isSafeInteger(loss))return false;
  const valid=()=>{const next=candidate();return !!next&&next.recipient===plan.recipient&&
    next.slot===plan.slot&&next.sourceFingerprint===plan.sourceFingerprint&&
    next.tokensBefore===plan.tokensBefore&&next.trackersBefore===plan.trackersBefore&&
    e.npcAt?.(d)===true&&p.G.tokens.monstertoken.tracker===4&&
    p.G.items.monstertoken.npc==='monsterhunter'&&
    p.G.npcs?.monsterhunter?.role==='monstertokens'&&
    p.G.items.monstertoken.g===tokenValue;};
  if(!valid())return false;
  // Tokens are real economic value, not a free reagent. Reserve their
  // verified NPC reference cost under the existing durable loss budget.
  return e.perform('tracker.exchange',{
   slots:[plan.slot],loss,guard:valid,timeout:20000,
   call:()=>{
    // Durable intent is written before ANY token is spent. An unknown
    // exchange stays locked until a verified recipient carries Tracktrix.
    const next={recipient:plan.recipient,at:Date.now(),
      tokensBefore:plan.tokensBefore,trackersBefore:plan.trackersBefore,
      sourceFingerprint:plan.sourceFingerprint,slot:plan.slot};
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
   reason,nextBankProbe}),close(){}};
}
