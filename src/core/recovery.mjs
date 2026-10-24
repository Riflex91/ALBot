import {identity,fingerprint} from './policy.mjs';
import {inspectItemTransferEvidence,inspectPairedItemTransfer,inspectReceiveSenderSession,inspectSendReceiverSession} from '../items/transfer-reconciliation.mjs';
import {exchangeDrops} from '../production/materials.mjs';
import {bankOwnershipConflict} from './bank-ownership.mjs';
// A legacy purchase can lack variant/RID metadata. Never guess its success.
// An aged, completely unchanged wallet and slot-by-slot inventory proves a
// no-effect observation; retain the original journal before releasing it.
export function unchangedPurchaseJournal(bot,now=Date.now()){
 const j=bot.journal,c=bot.p?.c,s=j?.evidence;
 return !!(bot.inventoryBlocked&&['buy','market.buy','ponty.buy'].includes(j?.kind)&&
  Number.isFinite(j.at)&&now-j.at>=120000&&now>=j.at&&
  Number.isSafeInteger(j.cost)&&j.cost>=0&&j.loss===0&&
  Number.isSafeInteger(j.quantity)&&j.quantity>0&&typeof j.item==='string'&&
  s?.realm===bot.p.realm()&&Number.isSafeInteger(s.gold)&&s.gold>=0&&c?.gold===s.gold&&
  Array.isArray(s.inventory)&&Array.isArray(c.items)&&c.items.length>0&&
  s.inventory.length===c.items.length&&(!Number.isInteger(c.isize)||c.items.length===c.isize)&&
  !bot.exec?.pending?.size&&!bot.logistics?.reserved&&!bot.gold?.reserved&&
  !Object.values(c.q??{}).some(Boolean)&&!c.items.some(i=>i?.name==='placeholder')&&
  bot.checkpoint?.durable===true&&
  Array.from(s.inventory).every((value,n)=>value===(c.items[n]?fingerprint(c.items[n]):null)));
}
// A gathering skill may time out without producing an item. Only a complete,
 // untouched, durable before-image can release that uncertainty automatically.
 // Never replay the skill or infer a missing reward from its cooldown.
export function unchangedGatherJournal(bot,now=Date.now()){
 const j=bot.journal,snap=j?.evidence,c=bot.p?.c;
 if(!bot.inventoryBlocked||!['gather.fishing','gather.mining'].includes(j?.kind)||
    j.cost!==0||j.loss!==0||!Array.isArray(j.slots)||j.slots.length||
    !Number.isFinite(j.at)||now-j.at<120000||now<j.at||
    !snap||snap.realm!==bot.p.realm()||!Number.isSafeInteger(snap.gold)||
    snap.gold!==c?.gold||!Array.isArray(snap.inventory)||!Array.isArray(c?.items)||
    snap.inventory.length!==c.items.length||bot.exec?.pending?.size||
    c.q?.fishing||c.q?.mining||bot.checkpoint?.durable===false)return false;
 return snap.inventory.every((value,index)=>value===(c.items[index]?fingerprint(c.items[index]):null));
}
// Safe automatic reconciliation is a proof of *one specific exchange*, not
// a guess from a reduced stack. A reward must be a known drop of the source
// item and every other variant and gold must match exactly. Preserve journals
// if drops, variant metadata or any concurrent action are not observable.
export function inspectExchangeRecovery(bot){
 const j=bot.journal,c=bot.p?.c,snap=j?.evidence,G=bot.p?.G;
 const deny=reason=>({eligible:false,reason});
 if(!bot.inventoryBlocked||j?.kind!=='exchange'||bot.me?.role!=='merchant')
  return deny('not-a-blocked-merchant-exchange');
 if(!snap||snap.realm!==bot.p.realm()||!Number.isSafeInteger(snap.gold)||
   !Number.isSafeInteger(c?.gold)||c.gold<snap.gold||
   !Array.isArray(snap.inventory)||!Array.isArray(c?.items)||
   snap.inventory.length!==c.items.length)return deny('before-after-evidence-incomplete');
 if(bot.exec?.pending?.size||c.q?.exchange||c.items.some(x=>x?.name==='placeholder')||
   bot.checkpoint?.durable===false)return deny('exchange-or-checkpoint-pending');
 if(!Number.isSafeInteger(j.quantity)||j.quantity<1||typeof j.item!=='string'||
   !Array.isArray(j.slots)||j.slots.length!==1)return deny('exchange-source-unpinned');
 const [slot,pinned]=j.slots[0];
 if(!Number.isSafeInteger(slot)||slot<0||slot>=snap.inventory.length||
   typeof pinned!=='string'||snap.inventory[slot]!==pinned)
  return deny('exchange-source-mismatch');
 const read=id=>{
  if(typeof id!=='string')return null;
  const colon=id.lastIndexOf(':'),q=Number(id.slice(colon+1));
  if(colon<1||!Number.isSafeInteger(q)||q<1)return null;
  try{const variant=JSON.parse(id.slice(0,colon));
   if(!Array.isArray(variant)||variant[0]!==j.item)return {id:id.slice(0,colon),q,name:variant[0]};
   return {id:id.slice(0,colon),q,name:variant[0]};
  }catch{return null;}
 };
 const source=read(pinned);
 if(!source||source.name!==j.item)return deny('exchange-source-invalid');
 const count=(fingerprints)=>{
  const map=new Map();
  for(const fp of fingerprints){if(fp===null)continue;
   const row=read(fp);if(!row)return null;
   const next=(map.get(row.id)??0)+row.q;
   if(!Number.isSafeInteger(next))return null;
   map.set(row.id,next);
  }return map;
 };
 const before=count(snap.inventory),after=count(c.items.map(x=>x?fingerprint(x):null));
 if(!before||!after)return deny('exchange-variants-unreadable');
 const loss=(before.get(source.id)??0)-(after.get(source.id)??0);
 if(loss!==j.quantity)return deny('exchange-input-not-consumed-exactly');
 const rewards=[];for(const id of new Set([...before.keys(),...after.keys()])){
  if(id===source.id)continue;
  const delta=(after.get(id)??0)-(before.get(id)??0);
  if(delta<0)return deny('unrelated-item-consumed');
  if(delta>0){
   let item;try{item=JSON.parse(id)[0];}catch{return deny('reward-unreadable');}
   rewards.push({item,quantity:delta});
  }
 }
 const table=exchangeDrops(G,G?.drops?.[j.item]);
 if(!table.length)return deny('exchange-reward-table-unavailable');
 const goldGain=c.gold-snap.gold;
 // The game can pay gold instead of an inventory item (notably the 10-year
 // anniversary gift: +5000 or +20000). Previously a genuine, completed
 // exchange with an exact gold prize was permanently quarantined because the
 // recovery insisted on unchanged gold AND a physical reward. Prove exactly
 // one official outcome using the pinned source, all other inventory
 // variants, and the exact observed wallet delta. Never replay an exchange.
 const officialGold=table.some(x=>x.item==='gold'&&
  Number.isSafeInteger(x.quantity)&&x.quantity>0&&x.quantity===goldGain);
 let outcome=null;
 if(goldGain>0&&!rewards.length&&officialGold)
  outcome={reason:'exact-input-consumption-and-official-gold-reward',
   rewards:[{item:'gold',quantity:goldGain}]};
 else if(goldGain===0&&rewards.length===1&&
  table.some(x=>x.item===rewards[0].item&&x.quantity===rewards[0].quantity))
  outcome={reason:'exact-input-consumption-and-verified-reward',rewards};
 if(!outcome)return deny(goldGain>0?'gold-reward-not-an-exact-official-outcome':
  !rewards.length?'reward-not-observed':'reward-not-an-exact-official-outcome');
 return {eligible:true,reason:outcome.reason,
  consumed:j.quantity,source:j.item,rewards:outcome.rewards,
  signature:JSON.stringify([j.at,j.item,j.quantity,snap.realm,snap.gold,
   c.gold,c.items.map(x=>x?fingerprint(x):null)])};
}

// A timed-out bank.gold operation is not proof of a missing deposit/withdrawal.
// Only a fresh, on-bank authoritative wallet+bank observation can resume work.
// This verifies current balances, NOT the unknown outcome of the old transfer.
export function bankGoldRecoverySnapshot(j,c,realm,bankMap='bank',now=Date.now()){
 const deny=reason=>({eligible:false,reason});
 if(j?.kind!=='bank.gold'||!Number.isSafeInteger(j.quantity)||j.quantity<=0||
    !Number.isSafeInteger(j.before)||j.before<0||
    !Number.isFinite(j.at)||now<j.at||now-j.at<120000||
    j.cost!==0||j.loss!==0||!Array.isArray(j.slots)||j.slots.length||
    !j.evidence||j.evidence.realm!==realm||j.evidence.gold!==j.before)
  return deny('invalid-or-too-new-bank-gold-journal');
 if(c?.map!==bankMap||!c.bank||!Number.isSafeInteger(c.bank.gold)||
    c.bank.gold<0||!Number.isSafeInteger(c.gold)||c.gold<0)
  return deny('authoritative-bank-balance-not-visible');
 if(!Array.isArray(j.evidence.inventory)||!Array.isArray(c.items)||
    c.items.length!==j.evidence.inventory.length)
  return deny('inventory-baseline-unavailable');
 // bank.gold cannot change inventory; unrelated physical drift invalidates
 // the old before-image as a complete reconciliation basis.
 const current=c.items.map(x=>x?fingerprint(x):null);
 if(current.some((fp,i)=>fp!==j.evidence.inventory[i]))
  return deny('inventory-changed-since-bank-gold-intent');
 return {eligible:true,reason:'current-bank-and-wallet-observed',
  wallet:c.gold,bankGold:c.bank.gold,ageMs:now-j.at,
  signature:JSON.stringify([j.at,j.quantity,j.before,realm,c.gold,c.bank.gold,current])};
}

// Recover only a *corroborated* persisted gold handoff. Never send gold again.
export function goldRecoveryEvidence(j,balance,realm,locked=true){
 if(!locked||!['gold.send','gold.receive'].includes(j?.kind)||
  typeof j.id!=='string'||!j.id.includes(':gold:')||
  typeof j.peer!=='string'||!j.peer||
  !Number.isSafeInteger(j.quantity)||j.quantity<1||
  !Number.isSafeInteger(j.before)||j.before<0||
  !Number.isSafeInteger(balance)||balance<0||
  j.evidence?.realm!==realm||!Number.isFinite(j.at))return null;
 return {kind:j.kind,id:j.id,peer:j.peer,quantity:j.quantity,
  before:j.before,balance,realm,session:j.session??null,at:j.at};
}
export function inspectGoldRecovery(bot){
 const deny=reason=>({eligible:false,reason});
 const j=bot.journal,c=bot.p?.c,realm=bot.p?.realm?.();
 if(!bot.inventoryBlocked||!['gold.send','gold.receive'].includes(j?.kind))
  return deny('not-a-blocked-gold-transfer');
 if(bot.checkpoint?.durable===false||bot.exec?.pending?.size)
  return deny('checkpoint-or-value-action-pending');
 const local=goldRecoveryEvidence(j,c?.gold,realm);
 if(!local)return deny('invalid-local-journal-or-balance');
 const peer=bot.transport?.fresh?.(j.peer);
 if(!peer||peer.running!==true||peer.rip||peer.realm!==realm)
  return deny('no-fresh-same-realm-peer');
 const other=peer.goldReconcile;
 if(!other||other.id!==local.id||other.peer!==bot.me.name||
    other.quantity!==local.quantity||other.realm!==realm||
    other.kind!==(j.kind==='gold.send'?'gold.receive':'gold.send')||
    !Number.isSafeInteger(other.before)||other.before<0||
    !Number.isSafeInteger(other.balance)||other.balance<0||
    (!other.verified&&(!peer.inventoryBlocked||peer.journal!==true))||
    (!other.verified&&peer.goldBalance!==undefined&&peer.goldBalance!==null&&
      peer.goldBalance!==other.balance))
  return deny('peer-journal-or-live-balance-mismatch');
 const senderSession=local.id.split(':gold:')[0];
 if(!senderSession||(j.kind==='gold.receive'?local.session:other.session)!==senderSession)
  return deny('sender-session-mismatch');
 const sender=j.kind==='gold.send'?local:other;
 const receiver=j.kind==='gold.receive'?local:other;
 if(sender.before<sender.quantity||sender.balance!==sender.before-sender.quantity)
  return deny('sender-exact-loss-not-observed');
 const received=receiver.balance-receiver.before;
 if(!Number.isSafeInteger(received)||received<receiver.quantity)
  return deny('receiver-minimum-gain-not-observed');
 // Other legitimate income at the Merchant is possible (+15 in the report);
 // two independent journal identities and an exact sender loss are mandatory.
 return {eligible:true,reason:'paired-journals-and-exact-sender-loss',
  local,extraReceived:received-receiver.quantity,
  signature:JSON.stringify([local.id,sender.balance,receiver.balance,
   sender.before,receiver.before,realm])};
}
export function createRecovery(bot){const {p,me,cfg}=bot;let checked=null,lease=null,conflict=null,exchangeSample=null,exchangeStatus=null,goldSample=null,goldStatus=null;
 let purchaseSample=null,bankGoldSample=null,bankGoldStatus=null,lastBankGoldEvent=0;
 const goldAckKey='albot:gold:'+me.name+':recovery-receipt';
 function itemStatus(){
  const j=bot.journal;
  if(!['send','receive'].includes(j?.kind))return null;
  const at=Date.now(),local=inspectItemTransferEvidence({
   journal:j,inventory:p.c?.items,gold:p.c?.gold,owner:me.name,
   session:bot.session,realm:p.realm(),now:at
  });
  const recipient=j.kind==='send'?j.to:j.from;
  const peer=bot.transport?.fresh?.(recipient);
  const result=inspectPairedItemTransfer(local,peer,{
   realm:p.realm(),now:at,ttlMs:cfg.general?.messageTtlMs??10000
  });
  const senderSession=j.kind==='receive'?inspectReceiveSenderSession({
   journal:j,peer,ownerSession:bot.session,realm:p.realm(),now:at,
   ttlMs:cfg.general?.messageTtlMs??10000
  }):null;
  const receiverSession=j.kind==='send'?inspectSendReceiverSession({
   journal:j,peer,ownerSession:bot.session,realm:p.realm(),now:at,
   ttlMs:cfg.general?.messageTtlMs??10000
  }):null;
  return {localVerified:!!local?.verified,localReason:local?.reason??null,
   peer:recipient,peerSession:peer?.session??null,
   originalSenderSession:j.kind==='receive'?j.session:null,
   senderSessionChanged:senderSession?.changed??false,
   senderSessionReason:senderSession?.reason??null,
   senderSessionRestartObserved:senderSession?.changed??false,
   originalReceiverSession:j.kind==='send'?j.session:null,
   receiverSessionChanged:receiverSession?.changed??false,
   receiverSessionReason:receiverSession?.reason??null,
   receiverSessionRestartObserved:receiverSession?.changed??false,
   paired:result.eligible,pairedReason:result.reason,
   requiresManualReview:true,unlocksValueActions:false,executable:false};
 }
 const oldGoldAck=p.read?.(goldAckKey);
 let goldAck=oldGoldAck?.until>Date.now()?oldGoldAck:null;
 function goldEvidence(){
  const evidence=goldRecoveryEvidence(bot.journal,p.c?.gold,p.realm(),bot.inventoryBlocked);
  if(evidence)return evidence;
  return goldAck?.until>Date.now()?{...goldAck.evidence,verified:true}:null;
 }
 function reconcileGold(){
  const result=inspectGoldRecovery(bot);
  goldStatus={eligible:result.eligible,reason:result.reason,
   extraReceived:result.extraReceived??null};
  if(!result.eligible){goldSample=null;return false;}
  const now=Date.now();
  if(now-result.local.at<1500)return false;
  if(goldSample?.signature!==result.signature){
   goldSample={signature:result.signature,at:now};return false;
  }
  if(now-goldSample.at<1000)return false;
  const j=bot.journal;
  // Publish a durable receipt before unlocking. A slower partner can use it
  // after this journal is cleared or this browser tab restarts.
  const receipt={evidence:result.local,at:now,until:now+120000};
  if(p.write?.(goldAckKey,receipt)!==true){
   goldStatus={eligible:false,reason:'recovery-receipt-write-failed'};
   return false;
  }
  goldAck=receipt;
  bot.inventoryBlocked=false;
  bot.endValue('confirmed');
  if(bot.journal){bot.inventoryBlocked=true;return false;}
  bot.event?.('recovery.goldConfirmed',{id:j.id,kind:j.kind,peer:j.peer,
   quantity:j.quantity,extraReceived:result.extraReceived,
   reason:'Matching old journals, exact sender balance loss and receiver gain; no resend'});
  goldSample=null;goldStatus={eligible:false,reason:'confirmed',extraReceived:result.extraReceived};
  return true;
 }

 function bankPeersAllow(){
  const evidence=bankOwnershipConflict(bot.transport?.peers??[],{
   owner:me.name,session:bot.session,realm:p.realm(),now:Date.now(),
   ttlMs:cfg.general?.messageTtlMs??10000});
  if(!evidence.allowed){
   if(conflict!==evidence.conflict)
    bot.report?.('Bankbesitz-Konflikt: '+(evidence.conflict??evidence.reason));
   conflict=evidence.conflict??evidence.reason;
   return false;
  }
  conflict=null;return true;
 }
 function authorize(kind){
  if(!kind.startsWith('bank.'))return true;
  if(me.name!==cfg.party.merchant||!bankPeersAllow())return false;
  const now=Date.now(),ttl=cfg.general?.messageTtlMs??10000;
  lease={owner:me.name,session:bot.session,realm:p.realm(),
   epoch:now,purpose:kind,expires:now+ttl};
  return true;
 }
 // Executor.flush() may run after new authenticated peer heartbeats arrive.
 // Never treat the earlier admission snapshot as final dispatch permission.
 function bankDispatchAllowed(kind){
  if(!kind.startsWith('bank.'))return true;
  return me.name===cfg.party.merchant&&
   lease?.owner===me.name&&lease.session===bot.session&&
   lease.realm===p.realm()&&lease.purpose===kind&&
   Number.isFinite(lease.expires)&&lease.expires>Date.now()&&
   bankPeersAllow();
 }
 // Never replay a timed-out bank deposit/withdrawal. Observe the actual
 // server-provided bank balance at the bank, archive the unknown old outcome
 // durably, and only then release unrelated work. A drifting inventory or
 // disputed bank lease must remain blocked for inspection.
 function reconcileBankGold(j){
  const now=Date.now(),bankMap=p.G?.bank_packs?.items0?.[0]??'bank';
  const blocked=reason=>{
   bankGoldStatus={eligible:false,reason,ageMs:now-j.at};
   if(now-lastBankGoldEvent>=30000){lastBankGoldEvent=now;
    bot.event?.('recovery.bankGoldDeferred',{kind:j.kind,quantity:j.quantity,
     ageMs:now-j.at,reason,map:p.c.map,bankMap});
   }
   bankGoldSample=null;return false;
  };
  if(me.role!=='merchant'||!bot.inventoryBlocked||
     bot.checkpoint?.durable!==true||bot.exec?.pending?.size||
     bot.bank?.pending||p.c.q?.bank||!bankPeersAllow())
   return blocked('pending-action-checkpoint-or-bank-ownership');
  if(!Number.isFinite(j.at)||now-j.at<120000)
   return blocked('bank-gold-settlement-wait');
  if(p.c.map!==bankMap){
   bot.bank?.ready?.('items0',true);
   return blocked('travel-to-bank-for-authoritative-observation');
  }
  const snapshot=bankGoldRecoverySnapshot(j,p.c,p.realm(),bankMap,now);
  if(!snapshot.eligible)return blocked(snapshot.reason);
  if(bankGoldSample?.signature!==snapshot.signature){
   bankGoldSample={signature:snapshot.signature,at:now};
   bankGoldStatus={eligible:false,reason:'await-second-stable-bank-snapshot',ageMs:snapshot.ageMs};
   return false;
  }
  if(now-bankGoldSample.at<5000)return false;
  const record={version:1,kind:'bank.gold',status:'unknown-no-replay',
   originalAt:j.at,at:now,realm:p.realm(),quantity:j.quantity,
   before:j.before,observedWallet:snapshot.wallet,
   observedBankGold:snapshot.bankGold,
   evidenceSignature:snapshot.signature};
  if(p.write?.('albot:bank-gold-unconfirmed:'+me.name,record)!==true)
   return blocked('unconfirmed-bank-gold-archive-write-failed');
  if(bot.checkpoint?.clear?.(j)!==true)
   return blocked('bank-gold-checkpoint-clear-failed');
  bot.journal=null;bot.inventoryBlocked=false;
  bankGoldSample=null;bankGoldStatus={eligible:false,reason:'archived-unknown-no-replay'};
  bot.production?.invalidate?.();bot.intelligence?.invalidate?.();
  bot.event?.('recovery.bankGoldResumed',{kind:'bank.gold',quantity:j.quantity,
   originalAt:j.at,observedWallet:snapshot.wallet,
   observedBankGold:snapshot.bankGold,originalOutcome:'unknown',replayed:false});
  return true;
 }

 // Resolve a legacy bank_store that the server executed as a stack swap.
 // Both addressed slots, the complete before-inventory and gold must match.
 // Do not infer success from global item counts or from the bank pack total.
 function reconcileBankStore(j){
  const snap=j.evidence,items=p.c.items,pack=p.c.bank?.[j.pack];
  if(!bot.inventoryBlocked||me.name!==cfg.party.merchant||!snap||snap.realm!==p.realm()||
     !Array.isArray(snap.inventory)||!Array.isArray(items)||!Array.isArray(pack)||
     !/^items\d+$/.test(j.pack)||!Number.isSafeInteger(j.sourceSlot)||
     !Number.isSafeInteger(j.bankSlot)||!Number.isSafeInteger(j.quantity)||
     j.quantity<1||j.sourceSlot<0||j.sourceSlot>=items.length||
     j.bankSlot<0||j.bankSlot>=pack.length||
     !Number.isFinite(snap.gold)||p.c.gold!==snap.gold)return false;
  const source=snap.inventory[j.sourceSlot],bankBefore=j.bankTargetBefore;
  if(typeof source!=='string'||typeof bankBefore!=='string'||source!==j.slots?.[0]?.[1]||
     j.slots?.[0]?.[0]!==j.sourceSlot)return false;
  const fp=x=>x?fingerprint(x):null;
  const untouched=snap.inventory.every((v,i)=>i===j.sourceSlot||v===fp(items[i]));
  if(!untouched)return false;
  const nowSource=fp(items[j.sourceSlot]),nowBank=fp(pack[j.bankSlot]);
  let outcome=null;
  if(bankBefore===':1'||bankBefore===''||bankBefore==null){
   if(!items[j.sourceSlot]&&nowBank===source)outcome='deposited';
  }else if(nowSource===bankBefore&&nowBank===source&&
     j.bankTargetQuantity>0&&j.bankTargetQuantity!==j.quantity){
   outcome='swapped';
  }
  if(!outcome)return false;
  bot.event('recovery.bankStoreVerified',{kind:j.kind,outcome,pack:j.pack,sourceSlot:j.sourceSlot,bankSlot:j.bankSlot,
   reason:'Beide belegten Slots und alle übrigen Inventarpositionen exakt nachgewiesen'});
  bot.inventoryBlocked=false;
  bot.endValue('confirmed');
  return !bot.journal;
 }

 // When a previously dispatched exchange has definitely consumed its
 // pinned source stack, but the reward cannot be reconstructed after a
 // restart, archive the uncertainty and resume using the live inventory.
 // Never assume a reward, confirm a delivery or replay the old command.
 // Unlike a speculative timeout this requires 60s of elapsed time, two
 // unchanged samples and durable archive+checkpoint writes.
 let unknownExchangeSample=null;
 let unchangedExchangeSample=null;
 // A server-rejected exchange (e.g. 'distance') leaves the original source,
 // every inventory slot and gold exactly as they were. The old code would
 // quarantine this forever, because no item had been consumed. After 120s
 // without any pending exchange and two STABLE full snapshots 5s apart,
 // archive the uncertain command without ever calling exchange again here.
 // This is not a success receipt and does not infer any drop or gold.
 function releaseUnchangedExchange(j){
  const c=p.c,snap=j?.evidence,now=Date.now();
  if(me.role!=='merchant'||!bot.inventoryBlocked||j?.kind!=='exchange'||
    !Number.isFinite(j.at)||now-j.at<120000||
    !Array.isArray(snap?.inventory)||!Array.isArray(c?.items)||
    snap.realm!==p.realm()||snap.inventory.length!==c.items.length||
    !Number.isSafeInteger(snap.gold)||c.gold!==snap.gold||
    !Number.isSafeInteger(j.quantity)||j.quantity<1||
    !Array.isArray(j.slots)||j.slots.length!==1||
    bot.exec?.pending?.size||c.q?.exchange||
    c.items.some(x=>x?.name==='placeholder')||
    bot.checkpoint?.durable!==true){
   unchangedExchangeSample=null;return false;
  }
  const [slot,source]=j.slots[0];
  if(!Number.isSafeInteger(slot)||slot<0||slot>=c.items.length||
    typeof source!=='string'||snap.inventory[slot]!==source||
    typeof j.item!=='string'||!j.item){
   unchangedExchangeSample=null;return false;
  }
  const live=c.items.map(i=>i?fingerprint(i):null);
  if(live.some((fp,i)=>fp!==snap.inventory[i])||!live[slot]){
   unchangedExchangeSample=null;return false;
  }
  const signature=JSON.stringify([j.at,j.item,j.quantity,slot,source,
   snap.realm,snap.gold,live]);
  if(unchangedExchangeSample?.signature!==signature){
   unchangedExchangeSample={signature,at:now};return false;
  }
  if(now-unchangedExchangeSample.at<5000)return false;
  const record={version:1,kind:'exchange',status:'unchanged-unverified-no-replay',
   item:j.item,quantity:j.quantity,sourceSlot:slot,originalAt:j.at,
   at:now,realm:p.realm(),source,observedGold:c.gold,
   evidenceSignature:signature};
  if(p.write?.('albot:exchange-unconfirmed:'+me.name,record)!==true||
     bot.checkpoint?.clear?.(j)!==true)return false;
  bot.allocation?.settle?.(j,'unknown');
  bot.journal=null;bot.inventoryBlocked=false;
  bot.production?.invalidate?.();bot.intelligence?.invalidate?.();
  unchangedExchangeSample=null;unknownExchangeSample=null;
  exchangeStatus={eligible:false,reason:'archived-unchanged-unverified',
   rewards:[]};
  bot.event?.('recovery.exchangeUnchangedReleased',{
   item:j.item,quantity:j.quantity,slot,ageMs:now-j.at,
   reason:'Gesamtes Inventar und Gold nach Abweisungsfenster unverändert; kein Replay des alten Exchange'});
  return true;
 }
 function releaseConsumedExchange(j){
  const c=p.c,snap=j?.evidence;
  if(me.role!=='merchant'||!bot.inventoryBlocked||j?.kind!=='exchange'||
    !Array.isArray(snap?.inventory)||!Array.isArray(c?.items)||
    snap.realm!==p.realm()||snap.inventory.length!==c.items.length||
    !Number.isSafeInteger(j.quantity)||j.quantity<1||
    !Number.isFinite(j.at)||Date.now()-j.at<60000||
    bot.exec?.pending?.size||c.q?.exchange||
    c.items.some(x=>x?.name==='placeholder')||
    bot.checkpoint?.durable===false||
    !Number.isSafeInteger(c.gold)||c.gold<0||
    !Array.isArray(j.slots)||j.slots.length!==1){
    unknownExchangeSample=null;return false;
  }
  const [slot,source]=j.slots[0];
  if(!Number.isSafeInteger(slot)||slot<0||slot>=c.items.length||
    typeof source!=='string'||snap.inventory[slot]!==source){
    unknownExchangeSample=null;return false;
  }
  const colon=source.lastIndexOf(':'),qty=Number(source.slice(colon+1));
  if(colon<=0||!Number.isSafeInteger(qty)||qty<j.quantity){
   unknownExchangeSample=null;return false;
  }
  const live=c.items[slot]?fingerprint(c.items[slot]):null;
  const expected=qty===j.quantity?null:source.slice(0,colon)+':'+(qty-j.quantity);
  if(live!==expected){unknownExchangeSample=null;return false;}
  const sign=JSON.stringify([j.at,source,live,c.gold,
   c.items.map(i=>i?fingerprint(i):null)]);
  const now=Date.now();
  if(!unknownExchangeSample||unknownExchangeSample.sign!==sign){
   unknownExchangeSample={sign,at:now};return false;
  }
  if(now-unknownExchangeSample.at<5000)return false;
  const record={version:1,kind:'exchange',item:j.item,
   quantity:j.quantity,sourceSlot:slot,at:now,originalAt:j.at,
   realm:p.realm(),status:'consumed-unverified-no-replay',
   before:source,after:live,observedGold:c.gold};
  // An archive write is required BEFORE clearing the original value journal.
  if(p.write?.('albot:exchange-unconfirmed:'+me.name,record)!==true||
     bot.checkpoint?.clear?.(j)!==true)return false;
  bot.allocation?.settle?.(j,'unknown');
  bot.journal=null;bot.inventoryBlocked=false;
  bot.production?.invalidate?.();bot.intelligence?.invalidate?.();
  unknownExchangeSample=null;
  exchangeStatus={eligible:false,reason:'archived-consumed-unverified',rewards:[]};
  bot.event?.('recovery.exchangeUnconfirmedReleased',{
   item:j.item,quantity:j.quantity,slot,ageMs:now-j.at,
   reason:'Original-Eingang nachgewiesen; unbekannter Output archiviert, kein Replay'});
  return true;
 }
 function reconcileExchange(){
  const audit=inspectExchangeRecovery(bot);
  exchangeStatus={eligible:audit.eligible,reason:audit.reason,rewards:audit.rewards??[]};
  if(!audit.eligible){
   exchangeSample=null;
   // Consumption and non-consumption are mutually exclusive. Both paths
   // demand durable archive writes BEFORE clearing the old value journal.
   return releaseConsumedExchange(bot.journal)||
    releaseUnchangedExchange(bot.journal);
  }
  unchangedExchangeSample=null;unknownExchangeSample=null;
  const now=Date.now();
  // Require two *identical* completed inventory observations at least one
  // second apart, after the original exchange was dispatched.
  if(!Number.isFinite(bot.journal?.at)||now-bot.journal.at<1500)return false;
  if(!exchangeSample||exchangeSample.signature!==audit.signature){
   exchangeSample={signature:audit.signature,at:now};return false;
  }
  if(now-exchangeSample.at<1000)return false;
  const j=bot.journal;
  bot.inventoryBlocked=false;
  bot.endValue('confirmed');
  if(bot.journal){bot.inventoryBlocked=true;return false;}
  bot.event?.('recovery.exchangeVerified',{item:j.item,consumed:audit.consumed,
   rewards:audit.rewards,reason:'Exakter Bestands- und Goldvergleich, offizielle Exchange-Belohnung und zwei stabile Beobachtungen'});
  exchangeSample=null;exchangeStatus={eligible:false,reason:'confirmed',rewards:audit.rewards};
  return true;
 }
 function reconcile(){const j=bot.journal;if(!j)return false;
  if(unchangedPurchaseJournal(bot)){
   const proof=JSON.stringify([j.at,j.evidence,p.c.gold,p.c.items.map(i=>i?fingerprint(i):null)]);
   if(purchaseSample?.proof!==proof){purchaseSample={proof,at:Date.now()};return false;}
   if(Date.now()-purchaseSample.at<2000)return false;
   const key='albot:purchase-recovery:'+me.name,old=p.read(key)??[];
   if(!Array.isArray(old)||!p.write(key,[...old.slice(-15),{journal:j,at:Date.now(),
     outcome:'unchanged-inventory-and-gold',replayed:false}])||!bot.checkpoint.clear(j))return false;
   bot.journal=null;bot.inventoryBlocked=false;
   bot.event?.('recovery.purchaseNoEffect',{kind:j.kind,item:j.item,
    reason:'Vollständiger Bestand und Gold unverändert; Journal archiviert, keine Wiederholung, Budget nicht erstattet'});
   return true;
  }
  purchaseSample=null;
  if(j.kind==='bank.gold')return reconcileBankGold(j);
   if(['gold.send','gold.receive'].includes(j.kind))return reconcileGold();
  if(j.kind==='exchange')return reconcileExchange();
  if(unchangedGatherJournal(bot)){
   bot.inventoryBlocked=false;
   bot.endValue('confirmed');
   if(!bot.journal){bot.event?.('recovery.gatherUnchanged',{kind:j.kind,reason:'Gathering beendet; vollständiger Bestand und Gold nach Wartefrist unverändert, keine Wiederholung'});return true;}
   return false;
  }if(j.kind==='bank.store')return reconcileBankStore(j);const observation=JSON.stringify([j.at,p.c.gold,p.c.items,p.c.slots?.elixir]);if(checked===observation)return false;checked=observation;const snap=j.evidence;if(!snap||!Array.isArray(snap.inventory)||typeof j.variant!=='string'||j.kind==='send'||j.kind.startsWith('gold.')||j.kind.startsWith('bank.')||p.realm()!==snap.realm)return false;
  // Only a complete pinned before/expected snapshot admits automatic confirmation.
  const before=new Map(),after=new Map();for(const fp of snap.inventory)if(fp){const n=fp.lastIndexOf(':'),id=fp.slice(0,n),q=Number(fp.slice(n+1));if(!Number.isSafeInteger(q)||q<1)return false;before.set(id,(before.get(id)??0)+q);}for(const i of p.c.items??[])if(i){const id=identity(i);after.set(id,(after.get(id)??0)+(i.q??1));}const delta=(after.get(j.variant)??0)-(before.get(j.variant)??0),othersUnchanged=[...new Set([...before.keys(),...after.keys()])].every(id=>id===j.variant||(before.get(id)??0)===(after.get(id)??0));if(!othersUnchanged)return false;let confirmed=false;
  if(j.kind==='elixir.equip')confirmed=delta===-1&&p.c.slots?.elixir?.name===j.item;
  if(j.kind==='buy'||j.kind==='market.buy'||j.kind==='ponty.buy')confirmed=delta===j.quantity&&p.c.gold===snap.gold-j.cost;
  if(j.kind==='sell'||j.kind==='market.sell')confirmed=delta===-j.quantity&&Number.isFinite(j.expectedGold)&&p.c.gold===snap.gold+j.expectedGold;
  if(confirmed){bot.event('recovery.confirmed',{kind:j.kind,reason:'Gepinnte Bestände und Gold-/Equipänderung stimmen überein'});bot.inventoryBlocked=false;bot.endValue('confirmed');return !bot.journal;}
  bot.event('recovery.unresolved',{kind:j.kind,reason:'Beobachtung ist nicht eindeutig; kein erneuter Versand'});return false;
 }
 return {authorize,bankDispatchAllowed,reconcile,itemStatus,heartbeat:()=>lease&&lease.expires>Date.now()?{...lease}:null,status:()=>({bankOwner:lease,conflict,exchange:exchangeStatus,gold:goldStatus,bankGold:bankGoldStatus}),goldEvidence,close(){lease=null;}};
}
