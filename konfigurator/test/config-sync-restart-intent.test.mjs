import test from 'node:test';
import assert from 'node:assert/strict';
import {createConfigRestartIntentGate} from '../../src/runtime/config-sync-restart-intent.mjs';

const AT=1792600000000,TARGET='ALBot/TestAccount',CHAR='My_Ranger1';
const HASH='a'.repeat(64),PIN={kty:'EC',crv:'P-256',x:'x'.repeat(43),y:'y'.repeat(43)};
function fixture({records={},character=CHAR}={}){
 const ctx={now:AT,character,pin:{target:TARGET,publicJwk:PIN}};
 const key='albot:config:restart-intent:v1:'+encodeURIComponent(TARGET)+':'+encodeURIComponent(character);
 const applied='albot:config:applied:v1:'+TARGET;
 const stage={mode:'verified-stage-only',configured:true,inFlight:false,
  stageInFlight:false,planning:false,appliedHighwater:0,
  verified:{target:TARGET,sequence:4,sha256:HASH,expiresAt:AT+86400000},
  staged:{target:TARGET,character,sequence:4,sha256:HASH,
   expiresAt:AT+86400000,memoryVerified:true,
   resumeRequiresReverification:false}};
 const preflight={mode:'read-only-local-preflight',character,
  locallyQuiescent:true,signedStageVerified:true,blockers:[],
  stagedSequence:4,readyForActivation:false,applied:false,acknowledged:false};
 const review={mode:'review-only',configured:true,review:{
  target:TARGET,character,sequence:4,sha256:HASH,
  expiresAt:AT+86400000,persisted:true,currentEvidenceValid:true,
  resumeRequiresReverification:false}};
 const dryRun={ok:true,mode:'detached-validation-only',
  character,sequence:4,sha256:HASH,restartRequired:true,
  inPlaceSwapSupported:false,transactionCommitted:false,
  readyForActivation:false,applied:false,acknowledged:false};
 const writes=[],deletes=[];
 const storage={
  getItem:key=>Object.hasOwn(records,key)?records[key]:null,
  setItem:(key,v)=>{records[key]=v;writes.push(key);},
  removeItem:key=>{delete records[key];deletes.push(key);}
 };
 const create=(overrides={})=>createConfigRestartIntentGate({
  readStorage:()=>storage,readTrust:()=>ctx.pin,
  readCharacter:()=>ctx.character,readStage:()=>stage,
  readPreflight:()=>preflight,readReview:()=>review,
  now:()=>ctx.now,...overrides});
 return {create,records,key,applied,ctx,stage,preflight,review,
  dryRun,storage,writes,deletes};
}
test('explicit restart-review intent writes exactly one bounded metadata record, never applied config',()=>{
 const x=fixture(),j=x.create();
 assert.equal(j.prepare(x.dryRun),true);
 const s=j.status();
 assert.equal(s.format,'albot-config-restart-intent/v1');
 assert.equal(s.mode,'restart-review-only');
 assert.equal(s.intent.currentEvidenceValid,true);
 assert.equal(s.intent.sequence,4);
 assert.equal(s.intent.sha256,HASH);
 assert.equal(s.intent.resumeRequiresReverification,true);
 assert.equal(s.readyForActivation,false);
 assert.equal(s.transactionCommitted,false);
 assert.equal(s.hasAutomaticRestartAuthority,false);
 assert.equal(s.applied,false);
 assert.equal(s.acknowledged,false);
 assert.deepEqual(x.writes,[x.key]);
 assert.equal(x.records[x.applied],undefined);
 assert.ok(x.records[x.key].length<850);
 for(const token of ['"config"','"profile"','signature','"d"','"items"'])
  assert.equal(x.records[x.key].includes(token),false);
 assert.equal(JSON.stringify(s).includes('pinnedX'),false);
});
test('restart retains inert receipt only, not an auto-apply or trustworthy rollback grant',()=>{
 const x=fixture(),first=x.create();
 assert.equal(first.prepare(x.dryRun),true);first.dispose();
 const second=x.create(),s=second.status();
 assert.equal(s.intent.sequence,4);
 assert.equal(s.intent.currentEvidenceValid,false);
 assert.equal(s.intent.resumeRequiresReverification,true);
 assert.equal(s.hasAutomaticRestartAuthority,false);
 assert.equal(s.applied,false);
 assert.equal(second.prepare(x.dryRun),true);
 assert.equal(second.status().intent.currentEvidenceValid,true);
 assert.equal(x.records[x.applied],undefined);
});
test('strict signed stage, paused preflight, manual reviewed intent and detached dry run all mandatory',()=>{
 const changes=[
  x=>{x.preflight.locallyQuiescent=false;},
  x=>{x.preflight.blockers=['inventory-journal-open'];},
  x=>{x.preflight.signedStageVerified=false;},
  x=>{x.preflight.readyForActivation=true;},
  x=>{x.preflight.character='My_Merchant';},
  x=>{x.stage.configured=false;},
  x=>{x.stage.inFlight=true;},
  x=>{x.stage.stageInFlight=true;},
  x=>{x.stage.planning=true;},
  x=>{x.stage.staged.memoryVerified=false;},
  x=>{x.stage.staged.resumeRequiresReverification=true;},
  x=>{x.stage.staged.target='WrongAccount';},
  x=>{x.stage.staged.character='WrongCharacter';},
  x=>{x.stage.verified.sequence=5;},
  x=>{x.stage.staged.sha256='b'.repeat(64);},
  x=>{x.stage.staged.expiresAt=AT-1;},
  x=>{x.stage.appliedHighwater=4;},
  x=>{x.review.configured=false;},
  x=>{x.review.review.currentEvidenceValid=false;},
  x=>{x.review.review.resumeRequiresReverification=true;},
  x=>{x.review.review.sha256='b'.repeat(64);},
  x=>{x.dryRun.ok=false;},
  x=>{x.dryRun.transactionCommitted=true;},
  x=>{x.dryRun.restartRequired=false;},
  x=>{x.dryRun.inPlaceSwapSupported=true;},
  x=>{x.dryRun.readyForActivation=true;},
  x=>{x.dryRun.applied=true;},
  x=>{x.dryRun.acknowledged=true;},
  x=>{x.dryRun.sequence=5;}
 ];
 for(const change of changes){
  const x=fixture();change(x);
  const j=x.create();
  assert.equal(j.prepare(x.dryRun),false,change.toString());
  assert.deepEqual(x.writes,[]);
  assert.equal(j.status().applied,false);
 }
});
test('restart receipt replay, conflicting hashes, sequence downgrades and bad trust are blocked',()=>{
 const x=fixture(),j=x.create();
 assert.equal(j.prepare(x.dryRun),true);
 assert.equal(j.prepare(x.dryRun),false);
 assert.match(j.status().lastError,/replay/i);
 const replay=x.create();
 x.stage.staged.sequence=3;x.stage.verified.sequence=3;
 x.preflight.stagedSequence=3;x.review.review.sequence=3;x.dryRun.sequence=3;
 assert.equal(replay.prepare(x.dryRun),false);
 assert.equal(x.writes.length,1);
 x.ctx.pin={target:TARGET,publicJwk:{...PIN,x:'z'.repeat(43)}};
 assert.equal(replay.status().configured,false);
 assert.match(replay.status().reason,/changed/);
});
test('corrupt, oversized, missing or silently failing durable store never authorizes restart',()=>{
 const x=fixture();
 x.records[x.key]='{broken';
 assert.equal(x.create().prepare(x.dryRun),false);
 assert.match(x.create().status().reason,/corrupted/);
 x.records[x.key]='a'.repeat(1000);
 assert.equal(x.create().status().configured,false);
 delete x.records[x.key];
 const noStore=x.create({readStorage:()=>null});
 assert.equal(noStore.prepare(x.dryRun),false);
 assert.equal(noStore.status().configured,false);
 const failure=x.create({readStorage:()=>({
  getItem:()=>null,setItem:()=>{throw Error('quota');},removeItem:()=>{}
 })});
 assert.equal(failure.prepare(x.dryRun),false);
 const discard=x.create({readStorage:()=>({
  getItem:()=>null,setItem:()=>{},removeItem:()=>{}
 })});
 assert.equal(discard.prepare(x.dryRun),false);
 assert.match(discard.status().lastError,/persistence/);
});
test('races during storage write, time expiration, pin and safe point drift block current evidence',()=>{
 for(const change of [
  x=>{x.ctx.now=AT+86400000;},
  x=>{x.ctx.pin={target:'ALBot/Changed',publicJwk:PIN};},
  x=>{x.review.review.currentEvidenceValid=false;},
  x=>{x.preflight.locallyQuiescent=false;},
  x=>{x.stage.staged.sequence=5;}
 ]){
  const x=fixture();const wrapped={...x.storage,
   setItem:(key,value)=>{x.storage.setItem(key,value);change(x);}};
  const j=x.create({readStorage:()=>wrapped});
  assert.equal(j.prepare(x.dryRun),false,change.toString());
  assert.equal(j.status().hasAutomaticRestartAuthority,false);
  assert.equal(x.records[x.applied],undefined);
 }
});
test('discard affects own restart review only, never another character or applied cursor',()=>{
 const x=fixture(),j=x.create();
 assert.equal(j.prepare(x.dryRun),true);
 const sibling='albot:config:restart-intent:v1:'+encodeURIComponent(TARGET)+':My_Merchant';
 x.records[sibling]='other-character-inert';
 x.records[x.applied]='previous-local-cursor';
 assert.equal(j.discard(),true);
 assert.equal(x.records[x.key],undefined);
 assert.equal(x.records[sibling],'other-character-inert');
 assert.equal(x.records[x.applied],'previous-local-cursor');
 assert.deepEqual(x.deletes,[x.key]);
 assert.equal(j.status().intent,null);
});
