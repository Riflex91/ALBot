import {gearCompatible,gearScore,gearSuitability} from './gear.mjs';
import {defaultsFor} from '../../editor/lib/contract.mjs';
import {ITEM_RULE} from '../../editor/lib/schema.mjs';
import {fingerprint,identity,protectedItem} from '../core/policy.mjs';
// Protect a confirmed inbound gear allocation until equip or expiry. An
// automatic loot handoff must not return the very item the merchant supplied.
export function pendingGearReceipt(receiving,item,now=Date.now()){
 return !!item&&Array.isArray(receiving)&&receiving.some(r=>
  r?.state!=='equipped'&&Number.isFinite(r?.expires)&&r.expires>now&&
  r.item&&identity(r.item)===identity(item));
}
// A durable unresolved/reserved gear claim still owns a physical copy.
// An identical live item is not automatically a second available copy.
export function unclaimedGearUnits(rows,items,item,{excludeId=null}={}){
 if(!Array.isArray(rows)||!Array.isArray(items)||!item||
    typeof item.name!=='string'||!item.name)return 0;
 const key=identity(item);
 let held=0;
 for(const x of items){
  if(!x||identity(x)!==key||protectedItem(x))continue;
  const n=x.q??1;
  if(!Number.isSafeInteger(n)||n<1)return 0;
  held+=n;
  if(!Number.isSafeInteger(held))return 0;
 }
 let claimed=0;
 for(const row of rows){
  if(!row||!['reserved','unresolved'].includes(row.state)||
     row.variant!==key||row.id===excludeId)continue;
  if(!Number.isSafeInteger(row.quantity)||row.quantity<1)return 0;
  claimed+=row.quantity;
  if(!Number.isSafeInteger(claimed))return 0;
 }
 return Math.max(0,held-claimed);
}
// Reconciliation is evidence for an operator, NOT a delivery receipt.
// In particular a matching equipped item might have come from elsewhere.
export function inspectGearClaimEvidence(row,{items=[],peer=null,realm=null}={}){
 if(!row||!['reserved','unresolved'].includes(row.state)||
    typeof row.id!=='string'||!row.id||
    typeof row.recipient!=='string'||!row.recipient||
    typeof row.variant!=='string'||!row.variant||
    typeof row.gearSlot!=='string'||!row.gearSlot||
    !Number.isSafeInteger(row.quantity)||row.quantity!==1)
   return null;
 const live=Array.isArray(items)?items:[];
 const sourceCount=live.reduce((n,item)=>{
  if(!item||identity(item)!==row.variant)return n;
  const q=item.q??1;
  return Number.isSafeInteger(q)&&q>0?Math.min(1000000,n+q):n;
 },0);
 const sameSession=!!peer?.running&&!peer.rip&&
  peer.realm===realm&&typeof row.recipientSession==='string'&&
  !!row.recipientSession&&peer.session===row.recipientSession;
 const equipped=peer?.gear?.slots?.[row.gearSlot];
 const recipientEquippedMatch=sameSession&&!!equipped&&
  identity({...equipped,l:undefined,b:undefined})===row.variant;
 return {id:row.id,recipient:row.recipient,state:row.state,
  variant:row.variant,gearSlot:row.gearSlot,
  senderStillCarriesUnits:sourceCount,
  recipientSessionVerified:sameSession,
  recipientEquippedVariantMatches:recipientEquippedMatch,
  receiverReceiptRecorded:row.settlement?.receipt===true,
  evidence:recipientEquippedMatch?
   'matching-gear-is-not-unique-transfer-proof':
   sameSession?'recipient-gear-does-not-match':'recipient-session-not-verified',
  requiresManualReview:true,canClearClaim:false,canResend:false};
}
export function createGearAllocation(bot){
 const key='albot:gear:'+bot.me.name+':allocations';
 const stored=bot.p.read(key),source=stored??[];
 let unsafeHistory=!Array.isArray(source);
 const valid=Array.isArray(source)?source.filter(x=>x&&
  typeof x.id==='string'&&!!x.id&&typeof x.recipient==='string'&&
  !!x.recipient&&typeof x.fingerprint==='string'&&
  ['reserved','unresolved','delivered','equipped'].includes(x.state)&&
  typeof x.variant==='string'&&!!x.variant&&
  Number.isSafeInteger(x.quantity)&&x.quantity>0):[];
 if(Array.isArray(source)&&valid.length!==source.length)unsafeHistory=true;
 // Never discard an unresolved/reserved record to fit a status-history cap.
 // If there are more outstanding records than the bounded storage permits,
 // preserve them for review and prohibit new gear allocations.
 const outstanding=valid.filter(r=>['reserved','unresolved'].includes(r.state));
 if(outstanding.length>64)unsafeHistory=true;
 const completed=valid.filter(r=>!['reserved','unresolved'].includes(r.state));
 const completedSpace=Math.max(0,64-outstanding.length);
 let rows=[...outstanding,...(completedSpace?completed.slice(-completedSpace):[])];
 function save(next){if(unsafeHistory||!bot.p.write(key,next))return false;rows=next;return true;}
 function goalFor(item,to,slot=null){return bot.gear?.goals()?.find(g=>g.recipient===to&&g.item===item.name&&g.level===(item.level??0)&&(!slot||g.gearSlot===slot));}
 // An offer is not a physical receiver receipt. Before reserving a copy
 // and again at the delayed dispatch boundary, verify the actual addressed
 // receiver's heartbeat identity, life, realm and pinned process session.
 function verifiedRecipient(to,session=null){
  const peer=bot.transport?.fresh?.(to);
  if(!peer||peer.name!==to||peer.running!==true||peer.rip!==false||
     peer.realm!==bot.p.realm()||typeof peer.session!=='string'||
     !peer.session||session!==null&&peer.session!==session)return null;
  return peer;
 }
 function reserve(j){
  const goal=goalFor(j.item,j.to,j.gear?.slot);
  if(!j.gear)return !goal;
  if(unsafeHistory)return false;
  // Once an offer has promised gear, removing/changing its goal must
  // cancel its dispatch, not silently turn it into an ordinary send.
  if(!goal||!Number.isSafeInteger(j.quantity)||j.quantity!==1)return false;
  const peer=verifiedRecipient(j.to,j.session),live=bot.p.c.items[j.slot];
  if(!peer?.session||peer.session!==j.session||
     fingerprint(live)!==j.fingerprint||
     !j.gearAck||j.gearAck!==j.gear.expected||
     fingerprint(peer.gear?.slots?.[j.gear.slot])!==j.gear.expected)
    return false;
  const old=rows.find(r=>r.id===j.id);
  if(old)return old.state==='reserved'&&old.realm===bot.p.realm()&&old.recipient===j.to&&
    old.recipientSession===j.session&&old.fingerprint===j.fingerprint&&
    old.slot===j.slot&&old.variant===identity(live)&&
    old.quantity===j.quantity;
  if(unclaimedGearUnits(rows,bot.p.c.items,live)<j.quantity)return false;
  const kept=rows.filter(r=>['reserved','unresolved'].includes(r.state));
  // Completed history is disposable. Open claims are not.
  if(kept.length>=64)return false;
  const historySpace=63-kept.length;
  const history=historySpace>0?rows.filter(r=>
   !['reserved','unresolved'].includes(r.state)&&
   r.at>Date.now()-86400000).slice(-historySpace):[];
  const next=[...kept,...history];
  next.push({id:j.id,recipient:j.to,recipientSession:j.session,slot:j.slot,fingerprint:j.fingerprint,variant:identity(live),quantity:j.quantity,gearSlot:goal.gearSlot,expected:j.gear?.expected,realm:bot.p.realm(),at:Date.now(),state:'reserved'});return save(next);
 }
 function guard(j){
  if(!j.gear)return true;
  if(unsafeHistory)return false;
  const live=bot.p.c.items?.[j.slot],peer=verifiedRecipient(j.to,j.session);
  if(!goalFor(j.item,j.to,j.gear.slot)||
     !peer?.session||peer.session!==j.session||
     j.gearAck!==j.gear.expected||
     fingerprint(peer.gear?.slots?.[j.gear.slot])!==j.gear.expected||
     fingerprint(live)!==j.fingerprint)return false;
  const row=rows.find(r=>r.id===j.id);
  if(!row)return unclaimedGearUnits(rows,bot.p.c.items,live)>=j.quantity;
  return row.state==='reserved'&&row.recipient===j.to&&
   row.recipientSession===j.session&&row.realm===bot.p.realm()&&
   row.slot===j.slot&&row.gearSlot===j.gear.slot&&
   row.variant===identity(live)&&row.quantity===j.quantity&&
   row.fingerprint===j.fingerprint&&
   unclaimedGearUnits(rows,bot.p.c.items,live,{excludeId:j.id})>=j.quantity;
}
 function settle(j,state){const row=rows.find(r=>r.id===j.id);if(!row)return true;if(row.state==='delivered')return state==='confirmed';return save(rows.map(r=>r.id===j.id?{...r,state:state==='confirmed'?'delivered':'unresolved',settled:Date.now(),settlement:{id:j.id,variant:identity(j.item),recipientSession:j.session,quantity:j.quantity,receipt:!!j.receipt}}:r));}
 const receivingKey=key+':receiving';let receiving=bot.p.read(receivingKey)??[];if(!Array.isArray(receiving))receiving=[];
 function offer(item,to){
  const g=goalFor(item,to);if(!g)return null;
  if(unsafeHistory)return false;
  const peer=verifiedRecipient(to);
  if(!peer?.gear)return false;
  if(unclaimedGearUnits(rows,bot.p.c.items,item)<1)return false;
  return {goal:g.name,slot:g.gearSlot,
   expected:fingerprint(peer.gear.slots?.[g.gearSlot]),
   item,expires:Date.now()+bot.cfg.general.messageTtlMs};
}
 function accept(id,from,session,item,g){if(!g)return true;const profile=bot.gear.snapshot(),old=bot.p.c.slots?.[g.slot],explicit=bot.economy.explicit(item);
  if(g.expires<Date.now()||from!==bot.cfg.party.merchant||protectedItem(old)&&old||g.expected!==fingerprint(profile.slots?.[g.slot])||!gearCompatible(bot.p.G,profile,item,g.slot)||explicit&&explicit.action!=='equip')return false;
  const role=bot.me.gearRole==='auto'?(profile.class==='priest'?'healer':profile.class==='merchant'?'economy':'dps'):bot.me.gearRole;
  try{const next=bot.p.call('item_properties',item),previous=old?bot.p.call('item_properties',old):null;
   if(!gearSuitability(previous,next,role,profile.class,bot.me.merchantMobility).ok)return false;
   if(old&&gearScore(next,role,profile.class)<=gearScore(previous,role,profile.class))return false;
  }catch{return false;}
  const row={id,from,session,item,slot:g.slot,expected:g.expected,expires:Date.now()+600000,state:'accepted'};const next=receiving.filter(r=>r.id!==id&&r.expires>Date.now()).slice(-15);next.push(row);if(!bot.p.write(receivingKey,next))return false;receiving=next;return true;
 }
 function rules(){receiving=receiving.filter(r=>r.expires>Date.now());return receiving.filter(r=>fingerprint(bot.gear.snapshot().slots?.[r.slot])===r.expected).map(r=>({...defaultsFor(ITEM_RULE),name:'Gearzusage '+r.id,item:r.item.name,minLevel:r.item.level,maxLevel:r.item.level,statType:r.item.stat_type??'',property:r.item.p??'',title:r.item.title??'',role:bot.me.role,character:bot.me.name,action:'equip',slot:r.slot,priority:50000,targetCount:1,maxCount:1}));}
 function equipGuard(item,slot){const r=receiving.find(r=>r.slot===slot&&r.state!=='equipped'&&r.expires>Date.now());return !r||identity(r.item)===identity(item)&&fingerprint(bot.gear.snapshot().slots?.[slot])===r.expected;}
 function tick(){
  const newReceiving=receiving.map(r=>r.state!=='equipped'&&
   identity(bot.p.c.slots?.[r.slot])===identity(r.item)?
   {...r,state:'equipped'}:r);
  if(newReceiving.some((r,i)=>r!==receiving[i])&&
     bot.p.write(receivingKey,newReceiving)){
   for(let i=0;i<newReceiving.length;i++)if(newReceiving[i]!==receiving[i])
    bot.event('gear.equipped',{id:newReceiving[i].id,slot:newReceiving[i].slot,
     item:newReceiving[i].item.name,reason:'Empfaengerzustand bestaetigt'});
   receiving=newReceiving;
  }
  // Build a new copy: failed durable writes must not clear an outstanding
  // sender claim or claim equipment receipt in memory.
  const next=rows.map(r=>{
   if(r.state!=='delivered')return r;
   // A matching item after a session/realm switch is not evidence that
   // the original recipient equipped this confirmed transfer.
   const peer=bot.transport?.fresh?.(r.recipient);
   if(!peer?.running||peer.rip||!r.recipientSession||
      peer.session!==r.recipientSession||!r.realm||
      peer.realm!==r.realm||bot.p.realm()!==r.realm)return r;
   const equipped=peer.gear?.slots?.[r.gearSlot];
   return equipped&&identity({...equipped,l:undefined,b:undefined})===r.variant?
    {...r,state:'equipped'}:r;
  });
  if(next.some((r,i)=>r!==rows[i]))save(next);
}
 return {offer,accept,rules,equipGuard,tick,reserve,guard,settle,
  pendingReceived:item=>pendingGearReceipt(receiving,item),
  status:()=>rows.map(r=>({...r})),
  recoveryStatus:()=>({unsafeHistory,blockedNewGear:unsafeHistory,
   outstandingCount:rows.filter(r=>['reserved','unresolved'].includes(r.state)).length,
   outstanding:rows.filter(r=>['reserved','unresolved'].includes(r.state))
    .slice(0,32).map(r=>inspectGearClaimEvidence(r,{
     items:bot.p.c.items,peer:bot.transport?.fresh?.(r.recipient),
     realm:bot.p.realm()})).filter(Boolean),
   authority:'diagnostic-only',autoClear:false,autoResend:false}),close(){}};
}
