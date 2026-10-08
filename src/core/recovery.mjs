import {identity} from './policy.mjs';
export function createRecovery(bot){const {p,me,cfg}=bot;let checked=null,lease=null,conflict=null;
 function authorize(kind){if(!kind.startsWith('bank.'))return true;if(me.name!==cfg.party.merchant)return false;const other=[...bot.transport.peers].map(([name,h])=>({name,...h})).find(h=>h.bankOwner&&h.name!==me.name&&h.running&&Date.now()-h.received<cfg.general.messageTtlMs);if(other){conflict=other.name;bot.report('Bankbesitz-Konflikt: '+other.name);return false;}conflict=null;lease={owner:me.name,session:bot.session,realm:p.realm(),epoch:Date.now(),purpose:kind,expires:Date.now()+cfg.general.messageTtlMs};return true;}
 function reconcile(){const j=bot.journal;if(!j||checked===j.at)return false;checked=j.at;const snap=j.evidence;if(!snap||!Array.isArray(snap.inventory)||typeof j.variant!=='string'||j.kind==='send'||j.kind.startsWith('gold.')||j.kind.startsWith('bank.')||p.realm()!==snap.realm)return false;
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
