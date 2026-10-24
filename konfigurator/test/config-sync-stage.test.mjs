import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {FULL_DESCRIPTOR} from '../../src/config/full.mjs';
import {envelope,importProfile} from '../../editor/lib/contract.mjs';
import {signer,preparePrivateRelease} from '../worker/private-config-release.mjs';
import {createVerifiedConfigStaging} from '../../src/runtime/config-sync-stage.mjs';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const CLOCK=1792600000000;
const fixture=JSON.parse(await readFile(new URL('../../profiles/full-team.json',import.meta.url),'utf8'));
const profile=envelope(FULL_DESCRIPTOR,importProfile(FULL_DESCRIPTOR,fixture));
const CHARACTER=profile.config.characters.find(x=>x.enabled===true)?.name;
assert.ok(CHARACTER);
async function signed({target='ALBot/TestAccount',profileDocument=profile,issuedAt=CLOCK}={}){
 const pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const privateJwk=await webcrypto.subtle.exportKey('jwk',pair.privateKey);
 const identity=await signer({CONFIG_SIGNING_JWK:JSON.stringify(privateJwk),
  CONFIG_SIGNING_TARGET:target},webcrypto.subtle);
 const release=await preparePrivateRelease({profile:profileDocument,identity,now:issuedAt});
 return {release,identity};
}
function sandbox(identity,{character=CHARACTER,stored={},clock=CLOCK,trust}={}){
 const records=stored,context={now:clock,character,trust:trust??{
  target:identity.target,publicJwk:identity.publicJwk}};
 const storage={
  getItem:key=>Object.prototype.hasOwnProperty.call(records,key)?records[key]:null,
  setItem:(key,value)=>{records[key]=value;},
  removeItem:key=>{delete records[key];}
 };
 const create=(extra={})=>createVerifiedConfigStaging({
  readStorage:()=>storage,readTrust:()=>context.trust,
  readCharacter:()=>context.character,
  cryptoObject:webcrypto,now:()=>context.now,...extra
 });
 const key='albot:config:stage:v1:'+encodeURIComponent(identity.target)+':'+encodeURIComponent(character);
 const applied='albot:config:applied:v1:'+identity.target;
 return {records,storage,context,create,key,applied};
}
test('valid signature stages only a character-bound receipt and never applies a profile',async()=>{
 const {identity,release}=await signed(),box=sandbox(identity),stage=box.create();
 assert.equal(await stage.stage(release),true);
 const status=stage.status();
 assert.equal(status.mode,'stage-only');
 assert.equal(status.configured,true);
 assert.equal(status.staged.memoryVerified,true);
 assert.equal(status.staged.character,CHARACTER);
 assert.equal(status.staged.sha256,release.sha256);
 assert.equal(status.staged.sequence,1);
 assert.equal(status.readyForActivation,false);
 assert.equal(status.applied,false);
 assert.equal(status.acknowledged,false);
 assert.equal(box.records[box.applied],undefined);
 assert.equal(JSON.stringify(box.records).includes('characters'),false);
 assert.equal(JSON.stringify(box.records).includes(release.signature),false);
 assert.equal(JSON.stringify(status).includes('items'),false);
 stage.dispose();
 assert.equal(stage.status().staged,null);
});
test('after reload the only durable evidence is untrusted metadata, not resumable private bytes',async()=>{
 const {identity,release}=await signed(),box=sandbox(identity);
 const receiver=box.create();
 assert.equal(await receiver.stage(release),true);
 receiver.dispose();
 const restarted=box.create();
 const status=restarted.status();
 assert.equal(status.staged.sequence,1);
 assert.equal(status.staged.memoryVerified,false);
 assert.equal(status.staged.resumeRequiresReverification,true);
 assert.equal(status.readyForActivation,false);
 // A reload can recover the same signed sequence only by verifying
 // the full private release again; the existing applied cursor is untouched.
 assert.equal(await restarted.stage(release),true);
 assert.equal(restarted.status().staged.memoryVerified,true);
 assert.equal(box.records[box.applied],undefined);
});
test('wrong account, tampered digest, forged signature and disabled character never stage',async()=>{
 const {identity,release}=await signed(),box=sandbox(identity);
 const altered=structuredClone(release);
 altered.profile.config.farming.maxAggro=13;
 const changed={...release,target:'ALBot/Other'};
 // Generated P-256 signatures may already begin with 'A'. Mutate to a
 // DIFFERENT valid base64url character on every platform/run.
 const forgedFirst=release.signature.startsWith('A')?'B':'A';
 const forged={...release,signature:forgedFirst+release.signature.slice(1)};
 for(const item of [altered,changed,forged]){
  const receiver=box.create();
  assert.equal(await receiver.stage(item),false);
  assert.equal(receiver.status().staged,null);
  assert.equal(box.records[box.key],undefined);
 }
 const others=sandbox(identity,{character:'NotInSignedTeam'});
 assert.equal(await others.create().stage(release),false);
 assert.equal(others.records[others.key],undefined);
});
test('applied cursor guards replay and rollback without being written by staging',async()=>{
 const {identity,release}=await signed(),box=sandbox(identity);
 box.records[box.applied]=JSON.stringify({target:identity.target,sequence:1,sha256:release.sha256});
 const stage=box.create();
 assert.equal(await stage.stage(release),false);
 assert.equal(box.records[box.key],undefined);
 box.records[box.applied]='{corrupt';
 assert.equal(await stage.stage(release),false);
 assert.equal(stage.status().configured,false);
 assert.match(stage.status().reason,/journal corrupted/);
});
test('same character cannot replay a staged sequence or downgrade it',async()=>{
 const {identity,release}=await signed(),box=sandbox(identity);
 const stage=box.create();
 assert.equal(await stage.stage(release),true);
 assert.equal(await stage.stage(release),false);
 assert.equal(stage.status().staged.memoryVerified,false);
 assert.match(stage.status().lastError,/replay or rollback/);
 assert.equal(JSON.parse(box.records[box.key]).sequence,1);
});
test('staging is isolated by character and trust pin and reacts to expiry',async()=>{
 const {identity,release}=await signed(),stored={},first=sandbox(identity,{stored}),one=first.create();
 assert.equal(await one.stage(release),true);
 const secondCharacter=profile.config.characters.filter(x=>x.enabled).find(x=>x.name!==CHARACTER)?.name;
 assert.ok(secondCharacter);
 const second=sandbox(identity,{stored,character:secondCharacter}),two=second.create();
 assert.equal(await two.stage(release),true);
 assert.notEqual(first.key,second.key);
 assert.equal(Object.keys(stored).length,2);
 one.dispose();two.dispose();
 const reloaded=first.create();
 assert.equal(reloaded.status().staged.memoryVerified,false);
 first.context.now=release.expiresAt;
 assert.equal(reloaded.status().staged,null);
 assert.equal(reloaded.status().readyForActivation,false);
 const fresh=sandbox(identity,{stored,trust:{target:identity.target,
  publicJwk:{...identity.publicJwk,x:'A'.repeat(43)}}});
 assert.equal(fresh.create().status().configured,false);
 assert.match(fresh.create().status().reason,/trust pin changed/);
});
test('storage write failure, missing storage and malformed receipt fail closed',async()=>{
 const {identity,release}=await signed(),box=sandbox(identity);
 const badWrite=box.create({readStorage:()=>({
  getItem:()=>null,setItem:()=>{throw Error('Disk full');},removeItem:()=>{}
 })});
 assert.equal(await badWrite.stage(release),false);
 assert.equal(badWrite.status().staged,null);
 assert.equal(box.records[box.key],undefined);
 const missing=box.create({readStorage:()=>null});
 assert.equal(missing.status().configured,false);
 assert.equal(await missing.stage(release),false);
 box.records[box.key]='{"bad":"json"}';
 const broken=box.create();
 assert.equal(broken.status().configured,false);
 assert.equal(await broken.stage(release),false);
 assert.match(broken.status().reason,/receipt corrupted/);
});
test('trust and applied journal mutation during asynchronous verification aborts staging',async()=>{
 const {identity,release}=await signed();
 for(const mutation of ['target','cursor']){
  const box=sandbox(identity);
  const subtle=webcrypto.subtle;
  let entered,resolveEntered,continueVerify;
  const sawVerify=new Promise(resolve=>{resolveEntered=resolve;});
  const barrier=new Promise(resolve=>{continueVerify=resolve;});
  const slow={
   importKey:(...args)=>subtle.importKey(...args),
   digest:(...args)=>subtle.digest(...args),
   verify:async(...args)=>{
    resolveEntered();
    await barrier;
    return subtle.verify(...args);
   }
  };
  const stage=box.create({cryptoObject:{subtle:slow}});
  const work=stage.stage(release);
  await sawVerify;
  if(mutation==='target')box.context.trust={...box.context.trust,target:'ALBot/Another'};
  else box.records[box.applied]=JSON.stringify({
   target:identity.target,sequence:1,sha256:release.sha256});
  continueVerify();
  assert.equal(await work,false);
  assert.equal(stage.status().staged,null);
  assert.equal(box.records[box.key],undefined);
 }
});
test('discard removes only own staging receipt, not applied rollback journal',async()=>{
 const {identity,release}=await signed(),box=sandbox(identity);
 const stage=box.create();
 assert.equal(await stage.stage(release),true);
 const before=box.records[box.key];
 assert.ok(before);
 assert.equal(stage.discard(),true);
 assert.equal(box.records[box.key],undefined);
 assert.equal(box.records[box.applied],undefined);
 assert.equal(stage.status().staged,null);
});
