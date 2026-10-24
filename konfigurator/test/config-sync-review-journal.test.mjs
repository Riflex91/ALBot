import test from 'node:test';
import assert from 'node:assert/strict';
import {createConfigActivationReviewJournal} from '../../src/runtime/config-sync-review-journal.mjs';

const TIME=1792600000000,HEX='a'.repeat(64);
const TARGET='ALBot/TestAccount',CHAR='My_Ranger1';
const TEST_PIN={kty:'EC',crv:'P-256',x:'x'.repeat(43),y:'y'.repeat(43)};
function fixture({character=CHAR,records={},now=TIME}={}){
 const context={character,now,trust:{target:TARGET,publicJwk:TEST_PIN}};
 const applied='albot:config:applied:v1:'+TARGET;
 const staging='albot:config:stage:v1:'+encodeURIComponent(TARGET)+':'+encodeURIComponent(character);
 const key='albot:config:review:v1:'+encodeURIComponent(TARGET)+':'+encodeURIComponent(character);
 const record={
  mode:'verified-stage-only',configured:true,inFlight:false,
  stageInFlight:false,appliedHighwater:0,
  verified:{target:TARGET,sequence:4,sha256:HEX,expiresAt:TIME+86400000},
  staged:{target:TARGET,character,sequence:4,sha256:HEX,
   expiresAt:TIME+86400000,memoryVerified:true,
   resumeRequiresReverification:false}
 };
 const preflight={format:'albot-config-activation-preflight/v1',
  mode:'read-only-local-preflight',character,locallyQuiescent:true,
  signedStageVerified:true,blockers:[],readyForActivation:false,
  stagedSequence:4,applied:false,acknowledged:false,
  activationBlockers:['authoritative-account-rollback-anchor-missing',
   'atomic-full-profile-apply-and-rollback-unimplemented',
   'authenticated-per-character-ack-unimplemented']};
 const writes=[],deletes=[];
 const store={
  getItem:key=>Object.hasOwn(records,key)?records[key]:null,
  setItem:(key,value)=>{records[key]=value;writes.push(key);},
  removeItem:key=>{delete records[key];deletes.push(key);}
 };
 const create=(extra={})=>createConfigActivationReviewJournal({
  readStorage:()=>store,readTrust:()=>context.trust,
  readCharacter:()=>context.character,readStage:()=>record,
  readPreflight:()=>preflight,now:()=>context.now,...extra
 });
 return {create,context,records,store,writes,deletes,record,preflight,key,applied,staging};
}
test('manual review persists only target-scoped signed revision metadata, no configuration or ACK',()=>{
 const f=fixture(),j=f.create();
 const before=structuredClone(f.record);
 assert.equal(j.prepare(),true);
 const status=j.status();
 assert.equal(status.mode,'review-only');
 assert.equal(status.review.currentEvidenceValid,true);
 assert.equal(status.review.sequence,4);
 assert.equal(status.review.character,CHAR);
 assert.equal(status.review.sha256,HEX);
 assert.equal(status.readyForActivation,false);
 assert.equal(status.applied,false);
 assert.equal(status.acknowledged,false);
 assert.deepEqual(f.record,before);
 assert.deepEqual(f.writes,[f.key]);
 assert.equal(f.records[f.applied],undefined);
 assert.equal(f.records[f.staging],undefined);
 assert.equal(JSON.stringify(f.records).includes('signature'),false);
 assert.equal(JSON.stringify(f.records).includes('"profile"'),false);
 assert.equal(JSON.stringify(f.records).includes('"config"'),false);
 assert.equal(JSON.stringify(status).includes('pinnedX'),false);
 j.dispose();
 assert.equal(j.status().review,null);
});
test('reloaded review record requires independently reverified signed staging and manual new prepare',()=>{
 const f=fixture(),j=f.create();
 assert.equal(j.prepare(),true);j.dispose();
 const restarted=f.create(),first=restarted.status();
 assert.equal(first.review.sequence,4);
 assert.equal(first.review.resumeRequiresReverification,true);
 assert.equal(first.review.currentEvidenceValid,false);
 assert.equal(first.readyForActivation,false);
 assert.equal(restarted.prepare(),true);
 assert.equal(restarted.status().review.currentEvidenceValid,true);
 assert.equal(f.records[f.applied],undefined);
});
test('safe-point and staging failures prohibit writing review intent',()=>{
 const changes=[
  f=>{f.preflight.locallyQuiescent=false;},
  f=>{f.preflight.blockers=['inventory-journal-open'];},
  f=>{f.preflight.signedStageVerified=false;},
  f=>{f.preflight.readyForActivation=true;},
  f=>{f.preflight.character='My_Merchant';},
  f=>{f.record.staged.memoryVerified=false;},
  f=>{f.record.staged.resumeRequiresReverification=true;},
  f=>{f.record.staged.sha256='b'.repeat(64);},
  f=>{f.record.staged.sequence=3;},
  f=>{f.record.staged.character='My_Merchant';},
  f=>{f.record.staged.target='ALBot/Other';},
  f=>{f.record.staged.expiresAt=TIME-1;},
  f=>{f.record.stageInFlight=true;},
  f=>{f.record.appliedHighwater=4;},
  f=>{f.context.character='My_Merchant';}
 ];
 for(const change of changes){
  const f=fixture();change(f);
  const j=f.create();
  assert.equal(j.prepare(),false,JSON.stringify(change.toString()));
  assert.deepEqual(f.writes,[]);
  assert.equal(j.status().readyForActivation,false);
 }
});
test('single-session replay and changed-sequence downgrade are rejected',()=>{
 const f=fixture(),j=f.create();assert.equal(j.prepare(),true);
 assert.equal(j.prepare(),false);
 assert.match(j.status().lastError,/replay/i);
 const other=f.create(),before=f.records[f.key];
 f.record.staged.sequence=3;f.record.verified.sequence=3;f.preflight.stagedSequence=3;
 assert.equal(other.prepare(),false);
 assert.equal(f.records[f.key],before);
 assert.equal(f.records[f.applied],undefined);
});
test('corrupt record, wrong pin and invalid storage are fail-closed',()=>{
 const f=fixture(),j=f.create();assert.equal(j.prepare(),true);
 f.records[f.key]='{invalid';
 assert.equal(j.status().configured,false);
 assert.match(j.status().reason,/corrupted/);
 assert.equal(j.discard(),false);
 const changed=fixture({records:{[f.key]:JSON.stringify({
  ...JSON.parse(JSON.stringify({
   format:'albot-config-activation-review/v1',state:'review-only',
   target:TARGET,character:CHAR,sequence:4,sha256:HEX,
   expiresAt:TIME+86400000,writtenAt:TIME,
   pinnedX:'x'.repeat(43),pinnedY:'y'.repeat(43)}))
 })}});
 changed.context.trust={target:TARGET,publicJwk:{...TEST_PIN,x:'z'.repeat(43)}};
 const other=changed.create();
 assert.equal(other.status().configured,false);
 assert.match(other.status().reason,/trust changed/);
 const missing=f.create({readStorage:()=>null});
 assert.equal(missing.prepare(),false);
 assert.equal(missing.status().configured,false);
});
test('persistence failure, read-back mismatch and deletion failure never authorize config',()=>{
 const f=fixture();
 const writeFailure=f.create({readStorage:()=>({
  getItem:()=>null,setItem:()=>{throw Error('quota exceeded');},removeItem:()=>{}
 })});
 assert.equal(writeFailure.prepare(),false);
 assert.equal(writeFailure.status().review,null);
 const silent=f.create({readStorage:()=>({
  getItem:()=>null,setItem:()=>{},removeItem:()=>{}
 })});
 assert.equal(silent.prepare(),false);
 assert.match(silent.status().lastError,/persistence/);
 const j=f.create();assert.equal(j.prepare(),true);
 const denied=f.create({readStorage:()=>({
  ...f.store,removeItem:()=>{}
 })});
 assert.equal(denied.discard(),false);
 assert.ok(f.records[f.key]);
 assert.equal(j.status().applied,false);
});
test('trust, preflight or stage drift during a synchronous write leaves a blocked review only',()=>{
 const variants=[
  f=>{f.preflight.locallyQuiescent=false;},
  f=>{f.context.trust={...f.context.trust,target:'ALBot/Attacker'};},
  f=>{f.record.staged.sequence=5;}
 ];
 for(const change of variants){
  const f=fixture();
  const store={
   getItem:f.store.getItem,setItem:(key,data)=>{
    f.store.setItem(key,data);change(f);
   },removeItem:f.store.removeItem
  };
  const j=f.create({readStorage:()=>store});
  assert.equal(j.prepare(),false);
  assert.equal(j.status().readyForActivation,false);
  assert.equal(j.status().applied,false);
  assert.equal(f.records[f.applied],undefined);
 }
});
test('TTL, changed applied high-water, lost stage and changed active character invalidate review',()=>{
 const f=fixture(),j=f.create();assert.equal(j.prepare(),true);
 const changes=[
  x=>{x.context.now=TIME+86400000;},
  x=>{x.record.appliedHighwater=4;},
  x=>{x.record.staged.memoryVerified=false;},
  x=>{x.context.character='My_Merchant';}
 ];
 for(const change of changes){
  const sample=fixture(),instance=sample.create();
  assert.equal(instance.prepare(),true);
  change(sample);
  const status=instance.status();
  assert.equal(status.readyForActivation,false);
  assert.notEqual(status.review?.currentEvidenceValid,true);
 }
});
test('discard erases exactly own review entry, never other character or applied rollback state',()=>{
 const f=fixture(),j=f.create();assert.equal(j.prepare(),true);
 f.records[f.applied]='signed-applied-cursor-untouched';
 f.records['albot:config:review:v1:'+encodeURIComponent(TARGET)+':My_Merchant']='other';
 assert.equal(j.discard(),true);
 assert.equal(f.records[f.key],undefined);
 assert.equal(f.records[f.applied],'signed-applied-cursor-untouched');
 assert.equal(f.records['albot:config:review:v1:'+encodeURIComponent(TARGET)+':My_Merchant'],'other');
 assert.deepEqual(f.deletes,[f.key]);
 assert.equal(j.status().review,null);
});
