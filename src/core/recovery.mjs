import {identity,fingerprint} from './policy.mjs';
import {exchangeDrops} from '../production/materials.mjs';
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
   c?.gold!==snap.gold||!Array.isArray(snap.inventory)||!Array.isArray(c?.items)||
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
 if(!rewards.length)return deny('reward-not-observed');
 const table=exchangeDrops(G,G?.drops?.[j.item]);
 if(!table.length)return deny('exchange-reward-table-unavailable');
 const permitted=new Set(table.map(x=>x.item));
 if(rewards.some(x=>!permitted.has(x.item)))return deny('reward-not-in-official-drop-table');
 return {eligible:true,reason:'exact-input-consumption-and-verified-reward',
  consumed:j.quantity,source:j.item,rewards,
  signature:JSON.stringify([j.at,j.item,j.quantity,snap.realm,snap.gold,
   c.items.map(x=>x?fingerprint(x):null)])};
}

export function createRecovery(bot){const {p,me,cfg}=bot;let checked=null,lease=null,conflict=null,exchangeSample=null,exchangeStatus=null;
 function authorize(kind){if(!kind.startsWith('bank.'))return true;if(me.name!==cfg.party.merchant)return false;const other=[...bot.transport.peers].map(([name,h])=>({name,...h})).find(h=>h.bankOwner&&h.name!==me.name&&h.running&&Date.now()-h.received<cfg.general.messageTtlMs);if(other){conflict=other.name;bot.report('Bankbesitz-Konflikt: '+other.name);return false;}conflict=null;lease={owner:me.name,session:bot.session,realm:p.realm(),epoch:Date.now(),purpose:kind,expires:Date.now()+cfg.general.messageTtlMs};return true;}
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

 function reconcileExchange(){
  const audit=inspectExchangeRecovery(bot);
  exchangeStatus={eligible:audit.eligible,reason:audit.reason,rewards:audit.rewards??[]};
  if(!audit.eligible){exchangeSample=null;return false;}
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
   rewards:audit.rewards,reason:'Exakter Bestandsvergleich, bekannte Drops, unverändertes Gold und zwei stabile Beobachtungen'});
  exchangeSample=null;exchangeStatus={eligible:false,reason:'confirmed',rewards:audit.rewards};
  return true;
 }
 function reconcile(){const j=bot.journal;if(!j)return false;
  if(j.kind==='exchange')return reconcileExchange();
  if(unchangedGatherJournal(bot)){
   bot.inventoryBlocked=false;
   bot.endValue('confirmed');
   if(!bot.journal){bot.event?.('recovery.gatherUnchanged',{kind:j.kind,reason:'Gathering beendet; vollständiger Bestand und Gold nach Wartefrist unverändert, keine Wiederholung'});return true;}
   return false;
  }if(j.kind==='bank.store')return reconcileBankStore(j);if(checked===j.at)return false;checked=j.at;const snap=j.evidence;if(!snap||!Array.isArray(snap.inventory)||typeof j.variant!=='string'||j.kind==='send'||j.kind.startsWith('gold.')||j.kind.startsWith('bank.')||p.realm()!==snap.realm)return false;
  // Only a complete pinned before/expected snapshot admits automatic confirmation.
  const before=new Map(),after=new Map();for(const fp of snap.inventory)if(fp){const n=fp.lastIndexOf(':'),id=fp.slice(0,n),q=Number(fp.slice(n+1));if(!Number.isSafeInteger(q)||q<1)return false;before.set(id,(before.get(id)??0)+q);}for(const i of p.c.items??[])if(i){const id=identity(i);after.set(id,(after.get(id)??0)+(i.q??1));}const delta=(after.get(j.variant)??0)-(before.get(j.variant)??0),othersUnchanged=[...new Set([...before.keys(),...after.keys()])].every(id=>id===j.variant||(before.get(id)??0)===(after.get(id)??0));if(!othersUnchanged)return false;let confirmed=false;
  if(j.kind==='elixir.equip')confirmed=delta===-1&&p.c.slots?.elixir?.name===j.item;
  if(j.kind==='buy'||j.kind==='market.buy'||j.kind==='ponty.buy')confirmed=delta===j.quantity&&p.c.gold===snap.gold-j.cost;
  if(j.kind==='sell'||j.kind==='market.sell')confirmed=delta===-j.quantity&&Number.isFinite(j.expectedGold)&&p.c.gold===snap.gold+j.expectedGold;
  if(confirmed){bot.event('recovery.confirmed',{kind:j.kind,reason:'Gepinnte Bestände und Gold-/Equipänderung stimmen überein'});bot.inventoryBlocked=false;bot.endValue('confirmed');return !bot.journal;}
  bot.event('recovery.unresolved',{kind:j.kind,reason:'Beobachtung ist nicht eindeutig; kein erneuter Versand'});return false;
 }
 return {authorize,reconcile,heartbeat:()=>lease&&lease.expires>Date.now()?{...lease}:null,status:()=>({bankOwner:lease,conflict,exchange:exchangeStatus}),close(){lease=null;}};
}
