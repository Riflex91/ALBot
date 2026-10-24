import test from 'node:test';
import assert from 'node:assert/strict';
import {fingerprint} from '../src/core/policy.mjs';
import {inspectItemTransferEvidence,inspectPairedItemTransfer,
 inspectSendReceiverSession} from '../src/items/transfer-reconciliation.mjs';
import {createRecovery} from '../src/core/recovery.mjs';

const now=1792858200000,realm='EUII',item={name:'ore',level:0};
const senderSnapshot=()=>({
 kind:'send',id:'sender-old:17',session:'receiver-old',to:'Receiver',
 item,quantity:3,before:5,at:now-3000,
 evidence:{realm,gold:100,inventory:[fingerprint({name:'ore',q:5}),null]}
});
const receiverSnapshot=()=>({
 kind:'receive',id:'sender-old:17',session:'sender-old',
 ownerSession:'receiver-old',from:'Sender',item,quantity:3,before:0,
 at:now-3000,evidence:{realm,gold:100,inventory:[null,null]}
});
function sender(at=now-600){
 return inspectItemTransferEvidence({journal:senderSnapshot(),
  inventory:[{name:'ore',q:2},null],gold:100,
  owner:'Sender',session:'sender-old',realm,now:at});
}
function receiver(at=now-500){
 return inspectItemTransferEvidence({journal:receiverSnapshot(),
  inventory:[{name:'ore',q:3},null],gold:100,
  owner:'Receiver',session:'receiver-old',realm,now:at});
}
function peer(evidence=receiver(),changes={}){
 return {name:'Receiver',session:'receiver-old',realm,received:now-100,
  running:true,rip:false,journal:true,inventoryBlocked:true,
  itemTransferEvidence:evidence,...changes};
}
test('W06 paired fresh physical losses and gains stay nonauthoritative',()=>{
 const proof=inspectPairedItemTransfer(sender(),peer(),{realm,now,ttlMs:10000});
 assert.equal(proof.eligible,true);
 assert.equal(proof.authority,'none');
 assert.equal(proof.executable,false);
 assert.equal(proof.conclusion,'corroborated-snapshots-not-server-receipt');
});
test('W06 stale local evidence is never paired with a fresh peer heartbeat',()=>{
 const historicalJournal={...senderSnapshot(),at:now-30000};
 const old=inspectItemTransferEvidence({journal:historicalJournal,
  inventory:[{name:'ore',q:2},null],gold:100,
  owner:'Sender',session:'sender-old',realm,now:now-20000});
 assert.equal(old.verified,true,'2-minute journal check alone admits this observation');
 const result=inspectPairedItemTransfer(old,peer(),{realm,now,ttlMs:10000});
 assert.equal(result.eligible,false);
 assert.equal(result.reason,'local-transfer-observation-stale');
 for(const corrupted of [
  {...sender(),observedAt:now+1},
  {...sender(),observedAt:Infinity},
  {...sender(),journalAt:now+1},
  {...sender(),journalAt:now-300000}
 ]){
  assert.equal(inspectPairedItemTransfer(corrupted,peer(),{
   realm,now,ttlMs:10000}).eligible,false);
 }
});
test('W06 peer journal evidence must be causally recent, not a replay',()=>{
 for(const evidence of [
  {...receiver(),journalAt:now+1},
  {...receiver(),journalAt:now-200000},
  {...receiver(),observedAt:now-15000},
  {...receiver(),observedAt:now+1000}
 ]){
  const result=inspectPairedItemTransfer(sender(),peer(evidence),{
   realm,now,ttlMs:10000});
  assert.equal(result.eligible,false);
  assert.equal(result.authority,'none');
  assert.equal(result.executable,false);
 }
 for(const opts of [{now:Infinity},{ttlMs:0},{ttlMs:120001}]){
  assert.equal(inspectPairedItemTransfer(sender(),peer(),{
   realm,now,ttlMs:10000,...opts}).eligible,false);
 }
});
test('W06 SEND journal observes real Receiver restart but cannot retry or unlock',()=>{
 const journal=senderSnapshot(),base={journal,ownerSession:'sender-old',
  realm,now,ttlMs:10000};
 const same=inspectSendReceiverSession({...base,peer:peer()});
 assert.equal(same.reason,'original-receiver-session-still-live');
 assert.equal(same.changed,false);
 const restarted=inspectSendReceiverSession({...base,
  peer:peer(receiver(),{session:'receiver-new'})});
 assert.equal(restarted.reason,'receiver-session-changed-during-send');
 assert.equal(restarted.changed,true);
 assert.equal(restarted.newSession,'receiver-new');
 for(const result of [same,restarted]){
  assert.equal(result.authority,'none');
  assert.equal(result.executable,false);
  assert.equal(result.retry,false);
  assert.equal(result.unlock,false);
  assert.equal(result.requiresManualReview,true);
 }
});
test('W06 unknown, realm-mismatched and own-restarted SEND journal never claim peer drift',()=>{
 const j=senderSnapshot(),base={journal:j,ownerSession:'sender-old',
  realm,now,ttlMs:10000};
 for(const overrides of [
  {peer:null},{peer:peer(undefined,{realm:'USI'})},
  {peer:peer(undefined,{running:false})},
  {peer:peer(undefined,{rip:true})},
  {peer:peer(undefined,{received:now-12000})},
  {peer:peer(undefined,{received:now+1})},
  {ownerSession:'sender-new'},
  {journal:{...j,id:'bad'}},
  {journal:{...j,session:null}}
 ]){
  const v=inspectSendReceiverSession({...base,peer:peer(),...overrides});
  assert.equal(v.changed,false);
  assert.equal(v.retry,false);
  assert.equal(v.unlock,false);
 }
});
test('W06 recovery status reports Receiver restart but preserves blocked journal',()=>{
 const journal=senderSnapshot();
 const bot={journal,inventoryBlocked:true,session:'sender-old',
  me:{name:'Sender'},cfg:{general:{messageTtlMs:10000}},
  p:{c:{items:[{name:'ore',q:2},null],gold:100},
   realm:()=>realm},
  transport:{fresh:()=>peer(receiver(),{
   session:'receiver-new',received:Date.now()-50
  })}};
 // Journal receipt needs a fresh Date.now-relative timestamp for this
 // actual createRecovery status diagnostic, not the static historical one.
 journal.at=Date.now()-1000;
 const status=createRecovery(bot).itemStatus();
 assert.equal(status.receiverSessionChanged,true);
 assert.equal(status.receiverSessionReason,'receiver-session-changed-during-send');
 assert.equal(status.originalReceiverSession,'receiver-old');
 assert.equal(status.paired,false);
 assert.equal(status.requiresManualReview,true);
 assert.equal(status.unlocksValueActions,false);
 assert.equal(status.executable,false);
 assert.equal(bot.journal,journal);
 assert.equal(bot.inventoryBlocked,true);
});
