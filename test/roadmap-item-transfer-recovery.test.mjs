import test from 'node:test';
import assert from 'node:assert/strict';
import {fingerprint} from '../src/core/policy.mjs';
import {inspectItemTransferEvidence,inspectPairedItemTransfer} from '../src/items/transfer-reconciliation.mjs';
import {fitHeartbeat} from '../src/party/transport.mjs';
import {createRecovery} from '../src/core/recovery.mjs';

const now=100000,realm='USIV',item={name:'ore',level:0};
const oldItems=(values)=>values.map(x=>x?fingerprint(x):null);
function journal(kind,{
 before=kind==='send'?5:0,quantity=3,items=kind==='send'?
  [{name:'ore',q:5},null]:[null,null],gold=100,
 id='s1:9',session=kind==='send'?'r1':'s1',at=now-1000,
 itemValue=item
}={}){
 return {kind,id,session,item:itemValue,quantity,before,at,
  ...(kind==='send'?{to:'Receiver'}:{from:'Sender'}),
  evidence:{realm,gold,inventory:oldItems(items)}};
}
function inspect(kind,{snapshot,after,owner,session,at=now,gold=100}={}){
 const sender=kind==='send';
 return inspectItemTransferEvidence({
  journal:snapshot??journal(kind),inventory:after??(sender?
   [{name:'ore',q:2},null]:[{name:'ore',q:3},null]),
  gold,owner:owner??(sender?'Sender':'Receiver'),
  session:session??(sender?'s1':'r1'),realm,now:at});
}
function peer(evidence,overrides={}){
 return {running:true,rip:false,name:evidence.owner,
  session:evidence.session,realm,received:now+1,
  journal:true,inventoryBlocked:true,itemTransferEvidence:evidence,...overrides};
}
test('paired exact sender decrease and receiver increase are corroborated but non-authoritative',()=>{
 const sender=inspect('send'),receiver=inspect('receive');
 assert.equal(sender.verified,true);
 assert.equal(receiver.verified,true);
 assert.equal(sender.delta,-3);
 assert.equal(receiver.delta,3);
 assert.equal(sender.senderSession,'s1');
 assert.equal(receiver.receiverSession,'r1');
 const match=inspectPairedItemTransfer(sender,peer(receiver),{
  realm,now:now+2,ttlMs:2000});
 assert.equal(match.eligible,true);
 assert.equal(match.executable,false);
 assert.equal(match.authority,'none');
 assert.equal(match.conclusion,'corroborated-snapshots-not-server-receipt');
 const reverse=inspectPairedItemTransfer(receiver,peer(sender),{
  realm,now:now+2,ttlMs:2000});
 assert.equal(reverse.eligible,true);
 assert.equal(reverse.executable,false);
});
test('sender count decrease without receiver increase never proves delivery',()=>{
 const s=inspect('send'),r=inspect('receive',{after:[{name:'ore',q:1},null]});
 assert.equal(s.verified,true);
 assert.equal(r.verified,false);
 assert.equal(r.reason,'exact-transfer-delta-not-observed');
 assert.equal(inspectPairedItemTransfer(s,peer(r),{realm,now:now+2}).eligible,false);
});
test('exact received variant may be newly introduced into empty inventory',()=>{
 const receiver=inspect('receive',{snapshot:journal('receive',{
  items:[null,null],before:0
 }),after:[null,{name:'ore',q:3}]});
 assert.equal(receiver.verified,true);
 assert.equal(receiver.before,0);
 assert.equal(receiver.after,3);
});
test('new session, changed realm, different counterpart and receipt IDs reject pair',()=>{
 const s=inspect('send'),r=inspect('receive');
 for(const patch of [
  {session:'r2'}, {realm:'EUII'}, {name:'Other'},
  {received:now-20000},{running:false},{journal:false},
  {inventoryBlocked:false},
  {itemTransferEvidence:{...r,id:'s1:10'}},
  {itemTransferEvidence:{...r,quantity:4}},
  {itemTransferEvidence:{...r,session:'r2'}}
 ]){
  assert.equal(inspectPairedItemTransfer(s,peer(r,patch),{
   realm,now:now+2,ttlMs:10000}).eligible,false,JSON.stringify(patch));
 }
});
test('retry against old sender session after restart cannot produce new proof',()=>{
 const restarted=inspect('send',{session:'restarted'});
 assert.equal(restarted.verified,false);
 assert.equal(restarted.reason,'sender-session-not-pinned');
 const oldReceiver=inspect('receive',{session:'restarted'});
 assert.equal(oldReceiver.verified,false);
});
test('unrelated inventory mutation or gold delta blocks even if target quantity matches',()=>{
 for(const kind of ['send','receive']){
  const after=kind==='send'?
   [{name:'ore',q:2},{name:'gem',q:1}]:
   [{name:'ore',q:3},{name:'gem',q:1}];
  const proof=inspect(kind,{after});
  assert.equal(proof.verified,false);
  assert.equal(proof.reason,'unrelated-inventory-variant-changed');
  assert.equal(inspect(kind,{gold:99}).verified,false);
 }
});
test('source journal before-image count must match exactly; partial sends are unknown',()=>{
 assert.equal(inspect('send',{snapshot:journal('send',{before:7})}).reason,
  'journal-before-count-mismatch');
 assert.equal(inspect('send',{after:[{name:'ore',q:3},null]}).reason,
  'exact-transfer-delta-not-observed');
 assert.equal(inspect('send',{snapshot:journal('send',{quantity:-2})}).verified,false);
});
test('other item variants and protected identity changes cannot be silently ignored',()=>{
 const s=inspect('send',{
  after:[{name:'ore',q:2,l:true},null]});
 assert.equal(s.verified,false);
 const j=journal('send',{items:[{name:'ore',q:5,l:true},null]});
 assert.equal(inspect('send',{snapshot:j}).verified,false);
});
test('stale/future-dated and corrupt inventory evidence fails closed',()=>{
 const s=inspect('send');
 assert.equal(inspectPairedItemTransfer(s,null,{realm,now:now+1}).eligible,false);
 assert.equal(inspect('send',{snapshot:journal('send',{at:now+100})}).verified,false);
 assert.equal(inspect('send',{snapshot:journal('send',{at:now-300000})}).verified,false);
 const bad=journal('send');bad.evidence.inventory=['invalid',null];
 assert.equal(inspect('send',{snapshot:bad}).verified,false);
});
test('heartbeat budget sheds shadow transfer evidence before core demand and identity',()=>{
 const data={name:'Sender',items:[{item:'ore',need:1}],
  materials:[],itemTransferEvidence:{verified:true,
   payload:'x'.repeat(3500)},realm,session:'s1'};
 const fit=fitHeartbeat(data,250);
 assert.ok(fit);
 assert.equal(fit.itemTransferEvidence,undefined);
 assert.equal(fit.name,'Sender');
 assert.equal(fit.items[0].item,'ore');
});
test('recovery remains manual-only despite paired corroboration',()=>{
 const j=journal('send',{at:Date.now()-1000}),
  other=journal('receive',{at:Date.now()-1000});
 const s=inspectItemTransferEvidence({journal:j,
  inventory:[{name:'ore',q:2},null],gold:100,
  owner:'Sender',session:'s1',realm});
 const r=inspectItemTransferEvidence({journal:other,
  inventory:[{name:'ore',q:3},null],gold:100,
  owner:'Receiver',session:'r1',realm});
 // A separately constructed deterministic fixture is used to avoid
 // invoking any settlement, recovery writes or network dispatches.
 assert.equal(s.verified,true);
 assert.equal(r.verified,true);
 const bot={journal:j,inventoryBlocked:true,me:{name:'Sender'},
  session:'s1',cfg:{general:{messageTtlMs:10000}},checkpoint:{durable:true},
  p:{c:{items:[{name:'ore',q:2},null],gold:100},
   realm:()=>realm,read:()=>null},
  transport:{fresh:()=>peer({...r,observedAt:Date.now()-100})}};
 const status=createRecovery(bot).itemStatus();
 assert.equal(status.localVerified,true);
 assert.equal(status.requiresManualReview,true);
 assert.equal(status.unlocksValueActions,false);
 assert.equal(status.executable,false);
});
