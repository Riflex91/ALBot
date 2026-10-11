import {identity,fingerprint} from './policy.mjs';
export function createRecovery(bot){const {p,me,cfg}=bot;let checked=null,lease=null,conflict=null;
 function authorize(kind){if(!kind.startsWith('bank.'))return true;if(me.name!==cfg.party.merchant)return false;const other=[...bot.transport.peers].map(([name,h])=>({name,...h})).find(h=>h.bankOwner&&h.name!==me.name&&h.running&&Date.now()-h.received<cfg.general.messageTtlMs);if(other){conflict=other.name;bot.report('Bankbesitz-Konflikt: '+other.name);return false;}conflict=null;lease={owner:me.name,session:bot.session,realm:p.realm(),epoch:Date.now(),purpose:kind,expires:Date.now()+cfg.general.messageTtlMs};return true;}
 // Resolve a legacy bank_store that the server executed as a stack swap.
 // Both addressed slots, the complete before-inventory and gold must match.
 // Do not infer success from global item counts or from the bank pack total.
 function reconcileBankStore(j){
  const snap=j.evidence,items=p.c.items,pack=p.c.bank?.[j.pack];
  if(!bot.inventoryBlocked||me.name!==cfg.party.merchant||!snap||snap.realm!==p.realm()||
     !Array.isArray(snap.inventory)||!Array.isArray(items)||!Array.isArray(pack)||
     !/^items\\d+$/.test(j.pack)||!Number.isSafeInteger(j.sourceSlot)||
     !Number.isSafeInteger(j.bankSlot)||!Number.isSafeInteger(j.quantity)||
     j.quantity<1||j.sourceSlot<0||j.sourceSlot>=items.length||
     j.bankSlot<0||j.bankSlot>=pack.length||
     !Number.isFinite(snap.gold)||p.c.gold!==snap.gold)return false;
  const source=snap.inventory[j.sourceSlot],bankBefore=j.bankTargetBefore;
  if(typeof source!=='string'||typeof bankBefore!=='string'||source!==j.slots?.[0]?.[1]||
     j.slots?.[0]?.[0]!==j.sourceSlot)return false;
  const fp=fingerprint;
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

 function reconcile(){const j=bot.journal;if(!j)return false;if(j.kind==='bank.store')return reconcileBankStore(j);if(checked===j.at)return false;checked=j.at;const snap=j.evidence;if(!snap||!Array.isArray(snap.inventory)||typeof j.variant!=='string'||j.kind==='send'||j.kind.startsWith('gold.')||j.kind.startsWith('bank.')||p.realm()!==snap.realm)return false;
  // Only a complete pinned before/expected snapshot admits automatic confirmation.
  const before=new Map(),after=new Map();for(const fp of snap.inventory)if(fp){const n=fp.lastIndexOf(':'),id=fp.slice(0,n),q=Number(fp.slice(n+1));if(!Number.isSafeInteger(q)||q<1)return false;before.set(id,(before.get(id)??0)+q);}for(const i of p.c.items??[])if(i){const id=identity(i);after.set(id,(after.get(id)??0)+(i.q??1));}const delta=(after.get(j.variant)??0)-(before.get(j.variant)??0),othersUnchanged=[...new Set([...before.keys(),...after.keys()])].every(id=>id===j.variant||(before.get(id)??0)===(after.get(id)??0));if(!othersUnchanged)return false;let confirmed=false;
  if(j.kind==='elixir.equip')confirmed=delta===-1&&p.c.slots?.elixir?.name===j.item;
  if(j.kind==='buy'||j.kind==='market.buy'||j.kind==='ponty.buy')confirmed=delta===j.quantity&&p.c.gold===snap.gold-j.cost;
  if(j.kind==='sell'||j.kind==='market.sell')confirmed=delta===-j.quantity&&Number.isFinite(j.expectedGold)&&p.c.gold===snap.gold+j.expectedGold;
  if(confirmed){bot.event('recovery.confirmed',{kind:j.kind,reason:'Gepinnte Bestände und Gold-/Equipänderung stimmen überein'});bot.inventoryBlocked=false;bot.endValue('confirmed');return !bot.journal;}
  bot.event('recovery.unresolved',{kind:j.kind,reason:'Beobachtung ist nicht eindeutig; kein erneuter Versand'});return false;
 }
 return {authorize,reconcile,heartbeat:()=>lease&&lease.expires>Date.now()?{...lease}:null,status:()=>({bankOwner:lease,conflict}),close(){lease=null;}};
}
