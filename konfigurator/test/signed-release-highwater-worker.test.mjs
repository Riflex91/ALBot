import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {FULL_DESCRIPTOR} from '../../src/config/full.mjs';
import {importProfile,envelope} from '../../editor/lib/contract.mjs';
import {signer,preparePrivateRelease} from '../worker/private-config-release.mjs';
import {handleRequest} from '../worker/index.mjs';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const json64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const profileRaw=JSON.parse(await readFile(
 new URL('../../profiles/full-team.json',import.meta.url),'utf8'));
const profile=envelope(FULL_DESCRIPTOR,importProfile(FULL_DESCRIPTOR,profileRaw));
const SHA='d'.repeat(40),BASE='https://albot.example.com',TARGET='ALBot/TestAccount';
class D1{
 constructor(){this.rows=new Map();this.writes=0;this.available=true;}
 prepare(sql){
  if(!this.available)throw Error('no such table: signed_config_highwater');
  if(!sql.includes('signed_config_highwater'))throw Error('Unexpected SQL');
  return {bind:(...args)=>({
   first:async()=>structuredClone(this.rows.get(args[0])??null),
   run:async()=>{
    const [target,key_id,sequence,sha256,release_sha,updated_at]=args;
    const last=this.rows.get(target);
    if(last&&(last.key_id!==key_id||sequence<=last.sequence))
     return {meta:{changes:0}};
    this.rows.set(target,{key_id,sequence,sha256,release_sha,updated_at});
    this.writes++;return {meta:{changes:1}};
   }
  })};
 }
}
async function setup(){
 const keys=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',
  modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),
  hash:'SHA-256'},true,['sign','verify']);
 const accessJwk=await webcrypto.subtle.exportKey('jwk',keys.publicKey);
 accessJwk.kid='signed-anchor-test';accessJwk.alg='RS256';
 const privatePair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},
  true,['sign','verify']);
 const privateJwk=await webcrypto.subtle.exportKey('jwk',privatePair.privateKey);
 const env={CF_ACCESS_TEAM_DOMAIN:'owner.cloudflareaccess.com',
  CF_ACCESS_AUD:'audit-aud',ALLOWED_EMAIL:'owner@example.com',
  CONFIG_REPO:'Riflex91/private-albot-config',CONFIG_BRANCH:'main',
  GITHUB_TOKEN:'fake_test_github_token',CONFIG_SIGNING_JWK:JSON.stringify(privateJwk),
  CONFIG_SIGNING_TARGET:TARGET,DB:new D1()};
 const identity=await signer(env,webcrypto.subtle);
 let release=await preparePrivateRelease({profile,identity,now:Date.now()});
 let releaseSha=SHA,privateRepo=true;
 async function jwt(extra={}){
  const t=Math.floor(Date.now()/1000);
  const head=json64({alg:'RS256',kid:accessJwk.kid});
  const body=json64({iss:'https://owner.cloudflareaccess.com',
   aud:['audit-aud'],email:'owner@example.com',iat:t-5,exp:t+300,...extra});
  const message=head+'.'+body;
  const sig=await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,
   new TextEncoder().encode(message));
  return message+'.'+Buffer.from(sig).toString('base64url');
 }
 const token=await jwt();
 const requests=[];
 const fetcher=async url=>{
  const u=String(url);requests.push(u);
  if(u.endsWith('/cdn-cgi/access/certs'))
   return new Response(JSON.stringify({keys:[accessJwk]}));
  if(u==='https://api.github.com/repos/'+env.CONFIG_REPO)
   return new Response(JSON.stringify({private:privateRepo,full_name:env.CONFIG_REPO}));
  if(u.includes('/contents/albot/private-signed-release.json'))
   return new Response(JSON.stringify({type:'file',sha:releaseSha,
    content:Buffer.from(JSON.stringify(release)).toString('base64')}));
  throw Error('Unapproved upstream '+u);
 };
 const path='/api/profile-sync/signed-highwater';
 const req=(method='GET',payload=null,{origin=BASE,tokenOverride=token,
  contentType='application/json'}={})=>new Request(BASE+path,{
  method,headers:{...(tokenOverride?{'CF-Access-Jwt-Assertion':tokenOverride}:{}),
   ...(method==='PUT'?{origin,'content-type':contentType}:{})},
  ...(payload!==null?{body:JSON.stringify(payload)}:{})
 });
 const call=(method='GET',payload=null,opts={})=>handleRequest(
  req(method,payload,opts),env,{}, {fetcher});
 const payload=()=>({confirm:true,releaseSha,sequence:release.sequence,
  sha256:release.sha256});
 return {env,call,req,payload,requests,identity,fetcher,jwt,
  setRelease:r=>{release=r;},setSha:sha=>{releaseSha=sha;},
  setPrivate:privateValue=>{privateRepo=privateValue;},getRelease:()=>release};
}
test('Access-only publication anchor reads empty, pins signed GitHub release and refuses downgrade',async()=>{
 const x=await setup();
 assert.equal((await x.call('GET',null,{tokenOverride:null})).status,401);
 assert.equal(x.requests.length,0);
 const empty=await (await x.call()).json();
 assert.equal(empty.anchored,false);
 assert.equal(empty.anchor,null);
 assert.equal(empty.applied,false);
 assert.equal(empty.acknowledged,false);
 const pinned=await x.call('PUT',x.payload());
 assert.equal(pinned.status,200);
 const b=await pinned.json();
 assert.equal(b.anchor.sequence,1);
 assert.equal(b.anchor.sha256,x.getRelease().sha256);
 assert.equal(b.anchor.releaseSha,SHA);
 assert.equal(b.changed,true);
 assert.equal(b.issuedOnly,true);
 assert.equal(b.applied,false);
 assert.equal(b.acknowledged,false);
 assert.equal(x.env.DB.writes,1);
 assert.equal((await (await x.call('PUT',x.payload())).json()).idempotent,true);
 assert.equal(x.env.DB.writes,1);
 assert.equal((await (await x.call()).json()).anchor.sequence,1);
 assert.equal(JSON.stringify(b).includes('"profile"'),false);
 assert.equal(JSON.stringify(b).includes('CONFIG_SIGNING_JWK'),false);
 const forged={...x.payload(),sequence:2};
 assert.equal((await x.call('PUT',forged)).status,409);
 assert.equal(x.env.DB.writes,1);
});
test('strict same-origin PUT, genuine Access JWT and private repo required before writing',async()=>{
 const x=await setup();
 assert.equal((await x.call('PUT',x.payload(),{origin:'https://adventure.land'})).status,403);
 assert.equal((await x.call('PUT',x.payload(),{origin:'https://evil.test'})).status,403);
 assert.equal((await x.call('PUT',x.payload(),{tokenOverride:null})).status,401);
 assert.equal((await x.call('PUT',x.payload(),{contentType:'text/plain'})).status,415);
 assert.equal((await x.call('POST',x.payload())).status,405);
 assert.equal((await x.call('PUT',{...x.payload(),confirm:false})).status,422);
 assert.equal((await x.call('PUT',{...x.payload(),evil:true})).status,422);
 assert.equal((await x.call('PUT',{...x.payload(),releaseSha:'a'.repeat(40)})).status,409);
 const other=await x.jwt({email:'imposter@example.com'});
 assert.equal((await x.call('GET',null,{tokenOverride:other})).status,403);
 x.setPrivate(false);
 assert.equal((await x.call('PUT',x.payload())).status,403);
 assert.equal(x.env.DB.writes,0);
});
test('no trust in client data, forged private signature or signer rotation',async()=>{
 const x=await setup();
 const old=x.getRelease();
 x.setRelease({...old,sha256:'b'.repeat(64)});
 assert.equal((await x.call('PUT',x.payload())).status,503);
 // Never accidentally reuse a valid signature that already starts with x.
 // Test that a genuinely modified signature is rejected, independently
 // of the random ECDSA signature prefix from this fixture.
 x.setRelease({...old,signature:(old.signature[0]==='x'?'y':'x')+
  old.signature.slice(1)});
 assert.equal((await x.call('PUT',x.payload())).status,503);
 assert.equal(x.env.DB.writes,0);
 x.setRelease(old);
 assert.equal((await x.call('PUT',x.payload())).status,200);
 const pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},
  true,['sign','verify']);
 x.env.CONFIG_SIGNING_JWK=JSON.stringify(
  await webcrypto.subtle.exportKey('jwk',pair.privateKey));
 assert.equal((await x.call()).status,409);
 assert.equal((await x.call('PUT',x.payload())).status,503);
 assert.equal(x.env.DB.writes,1);
});
test('new valid signed release monotonically advances; stale replay even if GitHub is reverted is rejected',async()=>{
 const x=await setup();assert.equal((await x.call('PUT',x.payload())).status,200);
 const prior=x.getRelease();
 const next=await preparePrivateRelease({profile,prior,identity:x.identity,
  now:Date.now()});
 x.setRelease(next);x.setSha('e'.repeat(40));
 const second=await x.call('PUT',x.payload());
 assert.equal(second.status,200);
 assert.equal((await second.json()).anchor.sequence,2);
 assert.equal(x.env.DB.writes,2);
 x.setRelease(prior);x.setSha(SHA);
 assert.equal((await x.call('PUT',x.payload())).status,409);
 const anchor=await (await x.call()).json();
 assert.equal(anchor.anchor.sequence,2);
 assert.equal(anchor.applied,false);
 assert.equal(anchor.acknowledged,false);
});
test('missing D1 schema or storage error never silently treats anchor as zero',async()=>{
 const x=await setup();
 x.env.DB.available=false;
 assert.equal((await x.call()).status,503);
 assert.equal((await x.call('PUT',x.payload())).status,503);
 x.env.DB.available=true;
 assert.equal((await (await x.call()).json()).anchored,false);
});
