import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {FULL_DESCRIPTOR} from '../../src/config/full.mjs';
import {importProfile,envelope} from '../../editor/lib/contract.mjs';
import {signer,preparePrivateRelease} from '../worker/private-config-release.mjs';
import {createConfigSyncPreview} from '../../src/runtime/config-sync-preview.mjs';
import {CONFIG_POPUP_ORIGIN,CONFIG_READY,CONFIG_REQUEST,CONFIG_RELEASE,
 CONFIG_MAX_MESSAGE_CHARS,gameRequest,popupResponse,generateSyncNonce}
 from '../public/config-sync-protocol.mjs';

const fixture=JSON.parse(await readFile(new URL('../../profiles/full-team.json',import.meta.url),'utf8'));
const now=1792600000000;
async function signed(){
 const pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const key=await webcrypto.subtle.exportKey('jwk',pair.privateKey);
 const env={CONFIG_SIGNING_JWK:JSON.stringify(key),CONFIG_SIGNING_TARGET:'ALBot/TestAccount'};
 const identity=await signer(env,webcrypto.subtle);
 const profile=envelope(FULL_DESCRIPTOR,importProfile(FULL_DESCRIPTOR,fixture));
 return {identity,release:await preparePrivateRelease({profile,identity,now})};
}
function setup(identity,storageContents=null){
 const events=new Map(),sent=[];
 const popup={closed:false,postMessage:(value,origin)=>sent.push({value,origin})};
 const gameWindow={
  open:(url,name,features)=>{assert.equal(new URL(url).pathname,'/config-sync.html');return popup;},
  addEventListener:(event,fn)=>events.set(event,fn),
  removeEventListener:(event,fn)=>{if(events.get(event)===fn)events.delete(event);}
 };
 const store={getItem:key=>storageContents?.[key]??null};
 const receiver=createConfigSyncPreview({
  gameWindow,cryptoObject:webcrypto,
  readTrust:()=>({publicJwk:identity.publicJwk,target:identity.target}),
  readStorage:()=>store,now:()=>now
 });
 const dispatch=(type,extra={},origin=CONFIG_POPUP_ORIGIN,source=popup)=>
  events.get('message')?.({origin,source,data:{type,...extra}});
 const ready=()=>{
  dispatch(CONFIG_READY);
  assert.equal(sent.length,1);
  assert.equal(sent[0].value.type,CONFIG_REQUEST);
  assert.equal(sent[0].origin,CONFIG_POPUP_ORIGIN);
  return sent[0].value.nonce;
 };
 return {popup,receiver,dispatch,ready,sent,store,events};
}
async function settle(receiver){for(let i=0;i<60;i++){
  const s=receiver.status();if(!s.inFlight&&(s.verified||s.lastError))return;
  await new Promise(resolve=>setTimeout(resolve,10));
 }}

test('popup protocol enforces exact source, origin, opener ancestry and nonce',()=>{
 const opener={frames:[]};
 const child={frames:[]};opener.frames=[child];
 const nonce=generateSyncNonce(webcrypto);
 assert.match(nonce,/^[a-f0-9]{32}$/);
 assert.equal(gameRequest({origin:'https://adventure.land',source:child,
  data:{type:CONFIG_REQUEST,nonce}},opener).nonce,nonce);
 assert.equal(gameRequest({origin:'https://evil.test',source:child,
  data:{type:CONFIG_REQUEST,nonce}},opener),null);
 assert.equal(gameRequest({origin:'https://adventure.land',source:{},
  data:{type:CONFIG_REQUEST,nonce}},opener),null);
 const pop={};
 assert.equal(popupResponse({source:pop,origin:CONFIG_POPUP_ORIGIN,
  data:{type:CONFIG_RELEASE,nonce,release:{format:'test'}}},pop,nonce).release.format,'test');
 assert.equal(popupResponse({source:pop,origin:'https://evil.test',
  data:{type:CONFIG_RELEASE,nonce,release:{}}},pop,nonce),null);
 assert.equal(popupResponse({source:pop,origin:CONFIG_POPUP_ORIGIN,
  data:{type:CONFIG_RELEASE,nonce:'0'.repeat(32),release:{}}},pop,nonce),null);
 assert.equal(popupResponse({source:pop,origin:CONFIG_POPUP_ORIGIN,
  data:{type:CONFIG_RELEASE,nonce,release:{data:'x'.repeat(CONFIG_MAX_MESSAGE_CHARS)}}},pop,nonce),null);
});

test('game preview accepts valid pinned signature and records only metadata, never applies',async()=>{
 const {identity,release}=await signed();
 const s=setup(identity);
 assert.equal(s.receiver.status().configured,true);
 assert.equal(s.receiver.open(),true);
 const nonce=s.ready();
 // A correct-looking payload from a different origin or window is ignored.
 s.dispatch(CONFIG_RELEASE,{nonce,release},'https://adventure.land');
 s.dispatch(CONFIG_RELEASE,{nonce,release},CONFIG_POPUP_ORIGIN,{});
 assert.equal(s.receiver.status().verified,null);
 s.dispatch(CONFIG_RELEASE,{nonce,release});
 await settle(s.receiver);
 const status=s.receiver.status();
 assert.equal(status.verified.sequence,1);
 assert.equal(status.verified.sha256,release.sha256);
 assert.equal(status.applied,false);
 assert.equal(status.acknowledged,false);
 assert.equal(status.lastError,null);
 assert.equal(JSON.stringify(status).includes('My_Ranger1'),false);
 s.dispatch(CONFIG_RELEASE,{nonce,release});
 await settle(s.receiver);
 assert.equal(s.receiver.status().verified.sequence,1);
 s.receiver.dispose();
 assert.equal(s.events.size,0);
});

test('invalid signature and expired release fail closed without changing an applied cursor',async()=>{
 const {identity,release}=await signed();
 const bad=structuredClone(release);bad.profile.config.farming.maxAggro=12;
 const s=setup(identity);
 assert.equal(s.receiver.open(),true);
 const nonce=s.ready();
 s.dispatch(CONFIG_RELEASE,{nonce,release:bad});
 await settle(s.receiver);
 assert.equal(s.receiver.status().verified,null);
 assert.match(s.receiver.status().lastError,/Signed profile digest mismatch/);
 assert.equal(s.receiver.status().applied,false);
 s.receiver.dispose();

 const expired=setup(identity);
 assert.equal(expired.receiver.open(),true);
 const otherNonce=expired.ready();
 expired.dispatch(CONFIG_RELEASE,{nonce:otherNonce,release:{...release,expiresAt:now-1}});
 await settle(expired.receiver);
 assert.equal(expired.receiver.status().verified,null);
 assert.equal(expired.receiver.status().applied,false);
 expired.receiver.dispose();
});

test('local applied high-water mark blocks rollback and corrupt journals prevent preview',async()=>{
 const {identity,release}=await signed();
 const key='albot:config:applied:v1:'+identity.target;
 const store={[key]:JSON.stringify({target:identity.target,sequence:1,sha256:release.sha256})};
 const s=setup(identity,store);
 assert.equal(s.receiver.status().appliedHighwater,1);
 assert.equal(s.receiver.open(),true);
 s.dispatch(CONFIG_RELEASE,{nonce:s.ready(),release});
 await settle(s.receiver);
 assert.equal(s.receiver.status().verified,null);
 assert.match(s.receiver.status().lastError,/Config signature preconditions failed/);
 s.receiver.dispose();

 const damaged=setup(identity,{[key]:'{invalid json'});
 assert.equal(damaged.receiver.open(),false);
 assert.match(damaged.receiver.status().reason,/corrupted/);
 damaged.receiver.dispose();
});

test('no trust pin or durable journal prevents popup opening',()=>{
 let opened=0,listener;
 const popup={closed:false};
 const gameWindow={open:()=>{opened++;return popup;},
  addEventListener:(name,fn)=>{listener=fn;},removeEventListener:()=>{}};
 const receiver=createConfigSyncPreview({gameWindow,cryptoObject:webcrypto,
  readTrust:()=>null,readStorage:()=>({getItem:()=>null})});
 assert.equal(receiver.open(),false);
 assert.equal(opened,0);
 assert.equal(receiver.status().configured,false);
 receiver.dispose();
 const noStorage=createConfigSyncPreview({gameWindow,cryptoObject:webcrypto,
  readTrust:()=>({publicJwk:{},target:'ALBot/TestAccount'}),readStorage:()=>null});
 assert.equal(noStorage.open(),false);
 assert.equal(opened,0);
 noStorage.dispose();
});
