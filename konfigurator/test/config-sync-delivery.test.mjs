import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {FULL_DESCRIPTOR} from '../../src/config/full.mjs';
import {importProfile,envelope} from '../../editor/lib/contract.mjs';
import {signer,preparePrivateRelease} from '../worker/private-config-release.mjs';
import {handleRequest} from '../worker/index.mjs';
import {verifySignedConfigRelease} from '../public/config-sync-contract.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const fixture=JSON.parse(await readFile(new URL('../../profiles/full-team.json',import.meta.url),'utf8'));
const form=()=>envelope(FULL_DESCRIPTOR,importProfile(FULL_DESCRIPTOR,fixture));
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
async function auth(){
 const pair=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',
  modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),
  hash:'SHA-256'},true,['sign','verify']);
 const key=await webcrypto.subtle.exportKey('jwk',pair.publicKey);
 key.kid='test';key.alg='RS256';
 const h=encode({alg:'RS256',kid:'test'});
 const p=encode({iss:'https://mine.cloudflareaccess.com',aud:['aud1'],
  email:'user@example.com',iat:Math.floor(Date.now()/1000)-10,
  exp:Math.floor(Date.now()/1000)+300});
 const signed=h+'.'+p;
 const sig=Buffer.from(await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',
  pair.privateKey,new TextEncoder().encode(signed))).toString('base64url');
 return {jwt:signed+'.'+sig,certs:{keys:[key]}};
}
async function scenario(){
 const access=await auth();
 const pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const privateJwk=await webcrypto.subtle.exportKey('jwk',pair.privateKey);
 const env={
  CF_ACCESS_TEAM_DOMAIN:'mine.cloudflareaccess.com',CF_ACCESS_AUD:'aud1',
  ALLOWED_EMAIL:'user@example.com',CONFIG_REPO:'Riflex91/private-albot-config',
  CONFIG_BRANCH:'main',GITHUB_TOKEN:'test_dummy_private_token',
  CONFIG_SIGNING_JWK:JSON.stringify(privateJwk),
  CONFIG_SIGNING_TARGET:'ALBot/TestAccount'
 };
 const identity=await signer(env,webcrypto.subtle);
 const profile=form();
 const release=await preparePrivateRelease({profile,identity,now:Date.now()});
 let profileData=profile,releaseData=release;
 const requests=[];
 const fetcher=async url=>{
  const u=String(url);requests.push(u);
  if(u.endsWith('/cdn-cgi/access/certs'))
   return new Response(JSON.stringify(access.certs));
  if(u==='https://api.github.com/repos/'+env.CONFIG_REPO)
   return new Response(JSON.stringify({private:true,full_name:env.CONFIG_REPO}));
  if(u.includes('/contents/albot/profile.json'))
   return new Response(JSON.stringify({type:'file',sha:'a'.repeat(40),
    content:Buffer.from(JSON.stringify(profileData)).toString('base64')}));
  if(u.includes('/contents/albot/private-signed-release.json'))
   return new Response(JSON.stringify({type:'file',sha:'b'.repeat(40),
    content:Buffer.from(JSON.stringify(releaseData)).toString('base64')}));
  throw Error('Unapproved upstream '+u);
 };
 const path='https://albot.example.com/api/profile-sync/delivery';
 const req=(method='GET',jwt=access.jwt)=>new Request(path,{
  method,headers:{...(jwt?{'CF-Access-Jwt-Assertion':jwt}:{})}});
 const call=(method='GET',jwt=access.jwt,modifiedEnv=env)=>handleRequest(
  req(method,jwt),modifiedEnv,{}, {fetcher});
 return {env,profile,release,identity,requests,call,
  setProfile:v=>{profileData=v;},setRelease:v=>{releaseData=v;}};
}
test('Access-only delivery returns exactly the private, already signed profile under no-store',async()=>{
 const s=await scenario();
 const unauth=await s.call('GET',null);
 assert.equal(unauth.status,401);
 assert.equal(s.requests.length,0);
 assert.equal((await s.call('PUT')).status,403);
 const res=await s.call();
 assert.equal(res.status,200);
 assert.equal(res.headers.get('cache-control'),'no-store');
 assert.equal(res.headers.get('access-control-allow-origin'),null);
 const body=await res.json();
 assert.equal(body.format,'albot-config-delivery/v1');
 assert.equal(body.release.sequence,s.release.sequence);
 assert.equal(body.release.sha256,s.release.sha256);
 assert.equal((await verifySignedConfigRelease(body.release,{
  pinnedPublicJwk:s.identity.publicJwk,target:s.identity.target,
  now:Date.now(),subtle:webcrypto.subtle})).verified,true);
 assert.equal(s.requests.some(x=>x.includes('api.github.com/repos/')),true);
});

test('cannot deliver unsigned, mismatched, expired or absent private profile',async()=>{
 const s=await scenario();
 const altered=structuredClone(s.profile);altered.config.farming.maxAggro=11;
 s.setProfile(altered);
 assert.equal((await s.call()).status,409);
 s.setProfile(s.profile);
 s.setRelease({...s.release,expiresAt:Date.now()-1});
 assert.notEqual((await s.call()).status,200);
 // ECDSA signatures are randomized: an unconditional 'X' replacement
 // leaves the original signature unchanged whenever it already starts X.
 const invalidFirst=s.release.signature.startsWith('A')?'B':'A';
 s.setRelease({...s.release,signature:invalidFirst+s.release.signature.slice(1)});
 assert.equal((await s.call()).status,503);
 assert.equal((await s.call('GET',null)).status,401);
});
