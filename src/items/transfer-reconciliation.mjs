import {identity,fingerprint} from '../core/policy.mjs';

// A paired transfer snapshot is a diagnostic cross-check, not a transaction
// receipt and NEVER a reason to clear a value journal or resend an item.
const transferEvidenceLimit=10000000;
const transferEvidenceName=x=>typeof x==='string'&&x.length>0&&x.length<=120;
const transferEvidenceQuantity=x=>Number.isSafeInteger(x)&&x>=0&&x<=transferEvidenceLimit;
function transferEvidenceCounts(fingerprints){
 if(!Array.isArray(fingerprints)||fingerprints.length>50)return null;
 const result=new Map();
 for(const fp of fingerprints){
  if(fp===null)continue;
  if(typeof fp!=='string'||fp.length>1400)return null;
  const colon=fp.lastIndexOf(':'),quantity=Number(fp.slice(colon+1));
  if(colon<2||!transferEvidenceQuantity(quantity)||quantity<1)return null;
  let variant;
  try{variant=JSON.parse(fp.slice(0,colon));}catch{return null;}
  if(!Array.isArray(variant)||!transferEvidenceName(variant[0])||
     !Number.isSafeInteger(variant[1])||variant[1]<0||variant[1]>99)
   return null;
  const key=fp.slice(0,colon),sum=(result.get(key)??0)+quantity;
  if(!transferEvidenceQuantity(sum))return null;
  result.set(key,sum);
 }
 return result;
}
export function inspectItemTransferEvidence({
 journal,inventory,gold,owner,session,realm,now=Date.now()
}={}){
 const invalid=reason=>({version:1,verified:false,reason,
  mode:'shadow-only',authority:'none',executable:false});
 if(!journal||!['send','receive'].includes(journal.kind))return null;
 if(!transferEvidenceName(owner)||!transferEvidenceName(session)||
   !transferEvidenceName(realm)||!Number.isFinite(now)||
   !Number.isFinite(journal.at)||journal.at>now||now-journal.at>120000||
   !transferEvidenceName(journal.id)||
   !transferEvidenceName(journal.session)||!transferEvidenceName(journal.to??journal.from)||
   !transferEvidenceQuantity(journal.quantity)||journal.quantity===0||
   !transferEvidenceQuantity(journal.before)||
   !transferEvidenceQuantity(gold)||
   !journal.evidence||journal.evidence.realm!==realm||
   journal.evidence.gold!==gold||
   !Array.isArray(inventory)||inventory.length>50||
   !Array.isArray(journal.evidence.inventory)||
   journal.evidence.inventory.length!==inventory.length)
  return invalid('incomplete-or-stale-local-journal');
 const sep=journal.id.lastIndexOf(':'),senderSession=journal.id.slice(0,sep);
 if(sep<1||!transferEvidenceName(senderSession)||
   (journal.kind==='send'&&senderSession!==session)||
   (journal.kind==='receive'&&(senderSession!==journal.session||journal.ownerSession!==session)))
  return invalid('sender-session-not-pinned');
 const item=journal.item;
 if(!item||!transferEvidenceName(item.name)||
   !Number.isSafeInteger(item.level)||item.level<0||item.level>99)
  return invalid('item-variant-unreadable');
 const key=identity(item),before=transferEvidenceCounts(journal.evidence.inventory),
  after=transferEvidenceCounts(inventory.map(i=>i?fingerprint(i):null));
 if(!before||!after)return invalid('inventory-variants-unverified');
 if((before.get(key)??0)!==journal.before)return invalid('journal-before-count-mismatch');
 const delta=(after.get(key)??0)-(before.get(key)??0);
 const wanted=journal.kind==='send'?-journal.quantity:journal.quantity;
 if(delta!==wanted)return invalid('exact-transfer-delta-not-observed');
 for(const id of new Set([...before.keys(),...after.keys()])){
  if(id!==key&&(before.get(id)??0)!==(after.get(id)??0))
   return invalid('unrelated-inventory-variant-changed');
 }
 const sender=journal.kind==='send'?owner:journal.from;
 const receiver=journal.kind==='receive'?owner:journal.to;
 if(!transferEvidenceName(sender)||!transferEvidenceName(receiver)||
   sender===receiver)return invalid('sender-or-recipient-invalid');
 return {version:1,verified:true,mode:'shadow-only',authority:'none',
  executable:false,id:journal.id,kind:journal.kind,owner,session,realm,
  sender,receiver,senderSession,receiverSession:journal.kind==='send'?
   journal.session:session,itemKey:key,quantity:journal.quantity,
  before:journal.before,after:after.get(key)??0,delta,
  observedAt:now,journalAt:journal.at,
  goldUnchanged:true,otherVariantsUnchanged:true};
}
export function inspectPairedItemTransfer(local,peer,{
 realm,now=Date.now(),ttlMs=10000
}={}){
 const deny=reason=>({eligible:false,reason,
  mode:'shadow-only',authority:'none',executable:false});
 if(!local)return deny('no-local-item-transfer');
 if(!local.verified||local.authority!=='none'||local.executable!==false)
  return deny('local-transfer-unverified');
 if(!peer||peer.running!==true||peer.rip||peer.realm!==realm||
   !transferEvidenceName(peer.name)||!transferEvidenceName(peer.session)||
   !Number.isFinite(peer.received)||peer.received>now||
   now-peer.received>ttlMs||!peer.journal||!peer.inventoryBlocked)
  return deny('fresh-locked-counterparty-unavailable');
 const other=peer.itemTransferEvidence;
 if(!other?.verified||other.authority!=='none'||other.executable!==false||
   local.realm!==realm||other.realm!==realm||
   !Number.isFinite(other.observedAt)||other.observedAt>peer.received||
   peer.received-other.observedAt>ttlMs||
   other.owner!==peer.name||other.session!==peer.session||
   local.id!==other.id||local.itemKey!==other.itemKey||
   local.quantity!==other.quantity||
   local.kind===other.kind||
   !['send','receive'].includes(other.kind)||
   other.sender!==local.sender||other.receiver!==local.receiver||
   local.senderSession!==other.senderSession||
   local.receiverSession!==other.receiverSession||
   (local.kind==='send'?other.owner!==local.receiver:
    other.owner!==local.sender)||
   (local.kind==='send'?local.session!==local.senderSession:
    local.session!==local.receiverSession)||
   (other.kind==='send'?other.session!==other.senderSession:
    other.session!==other.receiverSession)||
   local.delta+other.delta!==0||
   local.goldUnchanged!==true||other.goldUnchanged!==true||
   local.otherVariantsUnchanged!==true||
   other.otherVariantsUnchanged!==true)
  return deny('paired-journal-or-inventory-evidence-mismatch');
 return {eligible:true,reason:'paired-exact-journal-deltas-shadow-only',
  id:local.id,itemKey:local.itemKey,quantity:local.quantity,
  sender:local.sender,receiver:local.receiver,
  mode:'shadow-only',authority:'none',executable:false,
  conclusion:'corroborated-snapshots-not-server-receipt'};
}
