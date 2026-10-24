import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {FULL_DESCRIPTOR} from '../../src/config/full.mjs';
import {importProfile,envelope} from '../../editor/lib/contract.mjs';
import {profileDigest,verifySignedConfigRelease} from '../public/config-sync-contract.mjs';
import {signer,preparePrivateRelease,previousRelease} from '../worker/private-config-release.mjs';
import {githubReleaseFile,assertPrivateRepository,privateReleaseLocation}
 from '../worker/private-release-store.mjs';
import {handleRequest} from '../worker/index.mjs';
import {fakeSignedHighwaterDb} from './signed-highwater-db-fixture.mjs';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const subtle=webcrypto.subtle;
const fixture=JSON.parse(await readFile(new URL('../../profiles/full-team.json',import.meta.url),'utf8'));
const profile=()=>envelope(FULL_DESCRIPTOR,importProfile(FULL_DESCRIPTOR,fixture));
const secretEnv=async()=>{
 const pair=await subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const jwk=await subtle.exportKey('jwk',pair.privateKey);
 return {CONFIG_SIGNING_JWK:JSON.stringify(jwk),
  CONFIG_SIGNING_TARGET:'ALBot/TestAccount'};
};
const runtimeEnv=async()=>({
 ...(await secretEnv()),CONFIG_REPO:'Riflex91/private-albot-config',
 CONFIG_BRANCH:'main',GITHUB_TOKEN:'test_dummy_token_only',
 CF_ACCESS_TEAM_DOMAIN:'mine.cloudflareaccess.com',
 CF_ACCESS_AUD:'aud1',ALLOWED_EMAIL:'user@example.com'
});
function encode(value){return Buffer.from(JSON.stringify(value)).toString('base64url');}
async function credentials(){
 const keys=await subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,
  publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await subtle.exportKey('jwk',keys.publicKey);
 jwk.kid='test-key';jwk.alg='RS256';
 const head=encode({alg:'RS256',kid:'test-key'});
 const payload=encode({iss:'https://mine.cloudflareaccess.com',aud:['aud1'],
  email:'user@example.com',iat:Math.floor(Date.now()/1000)-10,
  exp:Math.floor(Date.now()/1000)+300});
 const signed=head+'.'+payload;
 const signature=Buffer.from(await subtle.sign('RSASSA-PKCS1-v1_5',
  keys.privateKey,new TextEncoder().encode(signed))).toString('base64url');
 return {jwt:signed+'.'+signature,certs:{keys:[jwk]}};
}
function mock(env,creds,{privateRepo=true}={}){
 env.DB??=fakeSignedHighwaterDb();
 const store={profile:profile(),profileSha:'a'.repeat(40),
  release:null,releaseSha:null,writes:0,requests:[]};
 const fetcher=async(url,options={})=>{
  const text=String(url);store.requests.push(text);
  if(text.endsWith('/cdn-cgi/access/certs'))
   return new Response(JSON.stringify(creds.certs));
  if(text==='https://api.github.com/repos/'+env.CONFIG_REPO)
   return new Response(JSON.stringify({full_name:env.CONFIG_REPO,private:privateRepo}));
  if(text.includes('/contents/albot/profile.json'))
   return new Response(JSON.stringify({type:'file',sha:store.profileSha,
    content:Buffer.from(JSON.stringify(store.profile)).toString('base64')}));
  if(text.includes('/contents/albot/private-signed-release.json')){
   if((options.method??'GET')==='PUT'){
    const body=JSON.parse(options.body);
    assert.equal(body.branch,'main');
    if(store.releaseSha)assert.equal(body.sha,store.releaseSha);
    else assert.equal(body.sha,undefined);
    store.release=JSON.parse(Buffer.from(body.content,'base64').toString());
    store.releaseSha='b'.repeat(40);
    store.writes++;
    return new Response(JSON.stringify({content:{sha:store.releaseSha},
     commit:{sha:'c'.repeat(40)}}));
   }
   if(!store.release)return new Response('',{status:404});
   return new Response(JSON.stringify({type:'file',sha:store.releaseSha,
    content:Buffer.from(JSON.stringify(store.release)).toString('base64')}));
  }
  throw Error('Unexpected network destination '+text);
 };
 const headers={'CF-Access-Jwt-Assertion':creds.jwt};
 const request=(path,method='GET',payload)=>new Request('https://albot.example.com'+path,{
  method,headers:{...headers,...(method==='PUT'?
   {origin:'https://albot.example.com','content-type':'application/json'}:{})},
  ...(payload?{body:JSON.stringify(payload)}:{})
 });
 const call=(path,method='GET',payload)=>handleRequest(
  request(path,method,payload),env,{}, {fetcher});
 return {store,fetcher,request,call};
}

test('separate P256 signer emits self-verifying account-bound releases and monotonic sequence',async()=>{
 const env=await secretEnv();
 const identity=await signer(env,subtle);
 assert.equal(identity.keyId.length,64);
 const now=1792600000000;
 const first=await preparePrivateRelease({profile:profile(),identity,now});
 assert.equal(first.sequence,1);
 assert.equal(first.target,env.CONFIG_SIGNING_TARGET);
 assert.equal(first.signature.length,86);
 assert.equal(first.expiresAt-now,86400000);
 assert.equal((await verifySignedConfigRelease(first,{pinnedPublicJwk:identity.publicJwk,
  target:identity.target,now,subtle})).verified,true);
 const afterExpiry=now+3*86400000;
 assert.equal(await previousRelease(first,identity,afterExpiry),1);
 const next=await preparePrivateRelease({profile:profile(),prior:first,identity,
  now:afterExpiry});
 assert.equal(next.sequence,2);
 const changed={...first,profile:structuredClone(first.profile)};
 changed.profile.config.farming.maxAggro=12;
 await assert.rejects(previousRelease(changed,identity,afterExpiry));
 const other=await signer(await secretEnv(),subtle);
 await assert.rejects(previousRelease(first,other,afterExpiry));
 const modified={...first,target:'ALBot/OtherAccount'};
 await assert.rejects(previousRelease(modified,identity,afterExpiry));
});

test('private release storage blocks key collisions and rejects a public GitHub repository',async()=>{
 const env=await runtimeEnv();
 assert.equal(privateReleaseLocation(env).path,'albot/private-signed-release.json');
 assert.throws(()=>privateReleaseLocation({...env,CONFIG_RELEASE_PATH:'albot/profile.json'}));
 assert.throws(()=>privateReleaseLocation({...env,CONFIG_RELEASE_PATH:'../escape'}));
 const fetcher=async()=>new Response(JSON.stringify({private:false,full_name:env.CONFIG_REPO}));
 await assert.rejects(assertPrivateRepository(env,fetcher),/privates GitHub/);
});

test('Worker preparation requires Access, origin, exact revision, private repo and explicit confirmation',async()=>{
 const env=await runtimeEnv(),creds=await credentials();
 const m=mock(env,creds),path='/api/profile-sync/prepare';
 const status=await (await m.call('/api/profile-sync/status')).json();
 assert.equal(status.signerReady,true);
 assert.equal(status.signed,false);
 assert.equal(status.releasePrepared,false);
 assert.equal(status.releaseSha,null);
 assert.equal(status.deliveryReady,false);
 assert.equal(JSON.stringify(status).includes('My_Ranger1'),false);
 const payload={confirm:true,githubSha:status.profile.githubSha,
  sha256:status.profile.sha256,previousReleaseSha:status.releaseSha};
 const noJwt=await handleRequest(new Request('https://albot.example.com'+path,{
  method:'PUT',headers:{origin:'https://albot.example.com',
   'content-type':'application/json'},body:JSON.stringify(payload)
 }),env,{}, {fetcher:m.fetcher});
 assert.equal(noJwt.status,401);
 assert.equal(m.store.writes,0);
 const wrongOrigin=await handleRequest(new Request('https://albot.example.com'+path,{
  method:'PUT',headers:{'CF-Access-Jwt-Assertion':creds.jwt,
   origin:'https://adventure.land','content-type':'application/json'},
  body:JSON.stringify(payload)}),env,{}, {fetcher:m.fetcher});
 assert.equal(wrongOrigin.status,403);
 assert.equal((await m.call(path,'PUT',{...payload,confirm:false})).status,422);
 assert.equal((await m.call(path,'PUT',{...payload,githubSha:'b'.repeat(40)})).status,409);
 assert.equal(m.store.writes,0);
 const signed=await m.call(path,'PUT',payload);
 assert.equal(signed.status,200);
 const body=await signed.json();
 assert.equal(body.signed,true);
 assert.equal(body.published,false);
 assert.equal(body.applied,false);
 assert.equal(body.acknowledged,false);
 assert.equal(m.store.writes,1);
 assert.equal(JSON.stringify(body).includes('My_Ranger1'),false);
 assert.equal(JSON.stringify(body).includes('CONFIG_SIGNING_JWK'),false);
 const current=(await (await m.call('/api/profile-sync/status')).json());
 assert.equal(current.releasePrepared,true);
 assert.equal(current.signed,true);
 assert.equal(current.release.sequence,1);
 assert.equal(current.releaseSha,'b'.repeat(40));
 assert.equal(current.deliveryReady,true);
 assert.equal(current.deliveryMode,'access-popup-only');
 assert.equal(current.published,false);
 assert.equal(current.applied,false);
 assert.equal(current.acknowledged,false);
 assert.equal((await m.call(path,'PUT',payload)).status,409);
 assert.equal(m.store.writes,1);
 m.store.profile=structuredClone(m.store.profile);
 m.store.profile.config.farming.maxAggro=14;
 m.store.profileSha='e'.repeat(40);
 const changed=(await (await m.call('/api/profile-sync/status')).json());
 assert.equal(changed.releasePrepared,true);
 assert.equal(changed.releaseMatchesCurrent,false);
 assert.equal(changed.signed,false);
 assert.equal(changed.deliveryReady,false);
});

test('preparation never writes to a public repository or without configured secret',async()=>{
 const env=await runtimeEnv(),creds=await credentials();
 const m=mock(env,creds,{privateRepo:false});
 const status=await (await m.call('/api/profile-sync/status')).json();
 const payload={confirm:true,githubSha:status.profile.githubSha,
  sha256:status.profile.sha256,previousReleaseSha:null};
 assert.equal((await m.call('/api/profile-sync/prepare','PUT',payload)).status,403);
 assert.equal(m.store.writes,0);
 assert.equal((await handleRequest(m.request('/api/profile-sync/prepare','PUT',payload),
  {...env,CONFIG_SIGNING_JWK:''},{},{fetcher:m.fetcher})).status,503);
 assert.equal(m.store.writes,0);
 const stale={...payload,previousReleaseSha:'d'.repeat(40)};
 assert.equal((await m.call('/api/profile-sync/prepare','PUT',stale)).status,409);
 assert.equal(m.store.writes,0);
});

test('delivery readiness cannot be claimed from a public repository',async()=>{
 const env=await runtimeEnv(),creds=await credentials();
 const m=mock(env,creds,{privateRepo:false});
 const identity=await signer(env,subtle);
 m.store.release=await preparePrivateRelease({
  profile:m.store.profile,identity,now:Date.now()});
 m.store.releaseSha='b'.repeat(40);
 const reply=await m.call('/api/profile-sync/status');
 assert.equal(reply.status,503);
 const body=await reply.json();
 assert.equal(body.ok,false);
 assert.equal(JSON.stringify(body).includes('My_Ranger1'),false);
});

test('publication requires a prepared D1 schema, and GitHub must not receive a new signature without it',async()=>{
 const env=await runtimeEnv(),creds=await credentials();
 const m=mock(env,creds);
 const current=await (await m.call('/api/profile-sync/status')).json();
 const payload={confirm:true,githubSha:current.profile.githubSha,
  sha256:current.profile.sha256,previousReleaseSha:null};
 env.DB.noTable=true;
 assert.equal((await m.call('/api/profile-sync/prepare','PUT',payload)).status,503);
 assert.equal(m.store.writes,0);
 env.DB.noTable=false;
 assert.equal((await m.call('/api/profile-sync/prepare','PUT',payload)).status,200);
 assert.equal(m.store.writes,1);
 assert.equal(env.DB.writes,1);
 assert.equal(env.DB.rows.get(env.CONFIG_SIGNING_TARGET).sequence,1);
});
test('D1 failure after GitHub save blocks success and delivery until explicit verified reconciliation',async()=>{
 const env=await runtimeEnv(),creds=await credentials();
 const m=mock(env,creds);
 const current=await (await m.call('/api/profile-sync/status')).json();
 const payload={confirm:true,githubSha:current.profile.githubSha,
  sha256:current.profile.sha256,previousReleaseSha:null};
 env.DB.failWrites=true;
 assert.equal((await m.call('/api/profile-sync/prepare','PUT',payload)).status,503);
 assert.equal(m.store.writes,1); // GitHub CAS succeeded, D1 CAS failed
 const blocked=await (await m.call('/api/profile-sync/status')).json();
 assert.equal(blocked.signed,true);
 assert.equal(blocked.publicationAnchorReady,false);
 assert.equal(blocked.deliveryReady,false);
 assert.notEqual((await m.call('/api/profile-sync/delivery')).status,200);
 env.DB.failWrites=false;
 const previous=m.store.release;
 const approved={confirm:true,releaseSha:m.store.releaseSha,
  sequence:previous.sequence,sha256:previous.sha256};
 const reconciled=await m.call('/api/profile-sync/signed-highwater','PUT',approved);
 assert.equal(reconciled.status,200);
 assert.equal((await (await m.call('/api/profile-sync/status')).json()).deliveryReady,true);
 assert.equal((await m.call('/api/profile-sync/delivery')).status,200);
 assert.equal(m.store.writes,1); // no duplicate GitHub publication
});
test('existing unanchored private release cannot be overwritten, rolled back or delivered',async()=>{
 const env=await runtimeEnv(),creds=await credentials();
 const m=mock(env,creds);
 const status=await (await m.call('/api/profile-sync/status')).json();
 const payload={confirm:true,githubSha:status.profile.githubSha,
  sha256:status.profile.sha256,previousReleaseSha:null};
 assert.equal((await m.call('/api/profile-sync/prepare','PUT',payload)).status,200);
 const original=structuredClone(m.store.release);
 const earlierHash=m.store.releaseSha;
 env.DB.rows.clear();
 const disabled=await (await m.call('/api/profile-sync/status')).json();
 assert.equal(disabled.signed,true);
 assert.equal(disabled.publicationAnchorReady,false);
 assert.equal(disabled.deliveryReady,false);
 assert.notEqual((await m.call('/api/profile-sync/delivery')).status,200);
 m.store.profile=structuredClone(m.store.profile);
 m.store.profile.config.farming.maxAggro=12;
 m.store.profileSha='f'.repeat(40);
 const newStatus=await (await m.call('/api/profile-sync/status')).json();
 const next={confirm:true,githubSha:newStatus.profile.githubSha,
  sha256:newStatus.profile.sha256,previousReleaseSha:earlierHash};
 assert.equal((await m.call('/api/profile-sync/prepare','PUT',next)).status,409);
 assert.equal(m.store.writes,1);
 assert.deepEqual(m.store.release,original);
});
