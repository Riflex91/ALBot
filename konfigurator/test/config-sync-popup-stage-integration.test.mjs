import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {FULL_DESCRIPTOR} from '../../src/config/full.mjs';
import {importProfile,envelope} from '../../editor/lib/contract.mjs';
import {signer,preparePrivateRelease} from '../worker/private-config-release.mjs';
import {createConfigSyncPreview} from '../../src/runtime/config-sync-preview.mjs';
import {createVerifiedConfigStaging} from '../../src/runtime/config-sync-stage.mjs';
import {CONFIG_POPUP_ORIGIN,CONFIG_READY,CONFIG_RELEASE,CONFIG_REQUEST}
 from '../public/config-sync-protocol.mjs';

const CLOCK=1792600000000;
const fixture=JSON.parse(await readFile(new URL('../../profiles/full-team.json',import.meta.url),'utf8'));
const profile=envelope(FULL_DESCRIPTOR,importProfile(FULL_DESCRIPTOR,fixture));
const CHARACTER=profile.config.characters.find(x=>x.enabled)?.name;
assert.ok(CHARACTER);
async function signed(){
 const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const privateKey=await webcrypto.subtle.exportKey('jwk',keys.privateKey);
 const identity=await signer({CONFIG_SIGNING_JWK:JSON.stringify(privateKey),
  CONFIG_SIGNING_TARGET:'ALBot/TestAccount'},webcrypto.subtle);
 return {identity,release:await preparePrivateRelease({profile,identity,now:CLOCK})};
}
function setup(identity,{storage={},character=CHARACTER,clock=CLOCK,pin}={}){
 const state={character,clock,trust:pin??{publicJwk:identity.publicJwk,target:identity.target}};
 const events=new Map(),sent=[];
 const popup={closed:false,postMessage:(value,origin)=>sent.push({value,origin})};
 const gameWindow={
  open:url=>{assert.equal(new URL(url).pathname,'/config-sync.html');return popup;},
  addEventListener:(name,cb)=>events.set(name,cb),
  removeEventListener:(name,cb)=>{if(events.get(name)===cb)events.delete(name);}
 };
 const store={
  getItem:k=>Object.hasOwn(storage,k)?storage[k]:null,
  setItem:(k,v)=>{storage[k]=v;},
  removeItem:k=>{delete storage[k];}
 };
 const staging=createVerifiedConfigStaging({
  readTrust:()=>state.trust,readCharacter:()=>state.character,
  readStorage:()=>store,cryptoObject:webcrypto,now:()=>state.clock
 });
 const receiver=createConfigSyncPreview({
  gameWindow,cryptoObject:webcrypto,
  readTrust:()=>state.trust,readStorage:()=>store,
  now:()=>state.clock,staging
 });
 const dispatch=(type,data={},origin=CONFIG_POPUP_ORIGIN,source=popup)=>
  events.get('message')?.({origin,source,data:{type,...data}});
 const request=()=>{
  assert.equal(receiver.open(),true);
  dispatch(CONFIG_READY);
  assert.equal(sent.at(-1)?.value?.type,CONFIG_REQUEST);
  return sent.at(-1).value.nonce;
 };
 return {receiver,staging,storage,state,request,dispatch,popup,events};
}
async function settle(receiver){for(let i=0;i<100;i++){
 const s=receiver.status();
 if(!s.inFlight&&(s.staged?.memoryVerified||s.lastError))return s;
 await new Promise(resolve=>setTimeout(resolve,5));
 }throw Error('timed out awaiting signed popup stage');
}
test('real popup signed delivery stages only character-bound metadata and never touches applied cursor',async()=>{
 const {identity,release}=await signed(),x=setup(identity);
 const nonce=x.request();
 x.dispatch(CONFIG_RELEASE,{nonce,release},'https://evil.test');
 x.dispatch(CONFIG_RELEASE,{nonce,release},CONFIG_POPUP_ORIGIN,{});
 assert.equal(x.receiver.status().staged,null);
 x.dispatch(CONFIG_RELEASE,{nonce,release});
 const status=await settle(x.receiver);
 assert.equal(status.mode,'verified-stage-only');
 assert.equal(status.verified.sequence,release.sequence);
 assert.equal(status.staged.sequence,release.sequence);
 assert.equal(status.staged.character,CHARACTER);
 assert.equal(status.staged.memoryVerified,true);
 assert.equal(status.readyForActivation,false);
 assert.equal(status.applied,false);
 assert.equal(status.acknowledged,false);
 assert.equal(x.storage['albot:config:applied:v1:'+identity.target],undefined);
 const storageDump=JSON.stringify(x.storage);
 assert.equal(storageDump.includes(release.signature),false);
 assert.equal(storageDump.includes('maxAggro'),false);
 assert.equal(storageDump.includes('"config"'),false);
 assert.equal(JSON.stringify(status).includes('"profile"'),false);
 x.receiver.dispose();
 assert.equal(x.events.size,0);
 assert.equal(x.staging.status().disposed,true);
});
test('restart demands re-verification and permits same signed sequence without applying',async()=>{
 const {identity,release}=await signed(),storage={};
 const first=setup(identity,{storage});
 first.dispatch(CONFIG_RELEASE,{nonce:first.request(),release});
 assert.equal((await settle(first.receiver)).staged.memoryVerified,true);
 first.receiver.dispose();
 const second=setup(identity,{storage});
 assert.equal(second.receiver.status().staged.memoryVerified,false);
 assert.equal(second.receiver.status().staged.resumeRequiresReverification,true);
 assert.equal(second.receiver.status().verified,null);
 second.dispatch(CONFIG_RELEASE,{nonce:second.request(),release});
 const status=await settle(second.receiver);
 assert.equal(status.staged.memoryVerified,true);
 assert.equal(status.applied,false);
 second.receiver.dispose();
});
test('stage is fail-closed if character changes after signed delivery',async()=>{
 const {identity,release}=await signed(),x=setup(identity);
 const nonce=x.request();
 x.state.character='NotPartOfTeam';
 x.dispatch(CONFIG_RELEASE,{nonce,release});
 const status=await settle(x.receiver);
 assert.equal(status.verified,null);
 assert.equal(status.staged,null);
 assert.match(status.lastError,/staging rejected/i);
 assert.deepEqual(x.storage,{});
 x.receiver.dispose();
});
test('broken persisted stage receipt disallows popup and never resets applied journal',async()=>{
 const {identity}=await signed();
 const key='albot:config:stage:v1:'+encodeURIComponent(identity.target)+':'+encodeURIComponent(CHARACTER);
 const journal='albot:config:applied:v1:'+identity.target;
 const storage={[key]:'{bad',[journal]:JSON.stringify({
  target:identity.target,sequence:2,sha256:'a'.repeat(64)})};
 const x=setup(identity,{storage});
 assert.equal(x.receiver.open(),false);
 assert.match(x.receiver.status().reason,/receipt corrupted/);
 assert.equal(storage[journal]!==undefined,true);
 x.receiver.dispose();
});
test('TTL expiry and changed applied cursor invalidate prior verified staging metadata',async()=>{
 const {identity,release}=await signed(),x=setup(identity);
 x.dispatch(CONFIG_RELEASE,{nonce:x.request(),release});
 assert.equal((await settle(x.receiver)).staged.memoryVerified,true);
 x.state.clock=release.expiresAt;
 const expired=x.receiver.status();
 assert.equal(expired.verified,null);
 assert.equal(expired.staged,null);
 x.receiver.dispose();

 const y=setup(identity);
 y.dispatch(CONFIG_RELEASE,{nonce:y.request(),release});
 assert.equal((await settle(y.receiver)).staged.memoryVerified,true);
 y.storage['albot:config:applied:v1:'+identity.target]=JSON.stringify({
  target:identity.target,sequence:release.sequence,sha256:release.sha256});
 const moved=y.receiver.status();
 assert.equal(moved.staged,null);
 assert.equal(moved.verified,null);
 assert.equal(moved.applied,false);
 y.receiver.dispose();
});
