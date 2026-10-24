import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {handleRequest} from '../worker/index.mjs';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const origin='https://albot.example.com';
const env={CF_ACCESS_TEAM_DOMAIN:'owner.cloudflareaccess.com',CF_ACCESS_AUD:'aud-security',
 ALLOWED_EMAIL:'owner@example.com',CONFIG_REPO:'Riflex91/private-albot-config',
 GITHUB_TOKEN:'dummy_inaccessible_private_repo_token',INGEST_TOKEN:'T'.repeat(32)};
const enc=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const keypair=await webcrypto.subtle.generateKey({
 name:'RSASSA-PKCS1-v1_5',modulusLength:2048,
 publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const publicKey=await webcrypto.subtle.exportKey('jwk',keypair.publicKey);
publicKey.kid='security-contract-key';
publicKey.alg='RS256';
const certs={keys:[publicKey]};
async function token(overrides={}){
 const time=Math.floor(Date.now()/1000);
 const head=enc({alg:'RS256',kid:publicKey.kid});
 const payload=enc({iss:'https://'+env.CF_ACCESS_TEAM_DOMAIN,
  aud:[env.CF_ACCESS_AUD],email:env.ALLOWED_EMAIL,
  iat:time-5,exp:time+300,...overrides});
 const data=head+'.'+payload;
 const sig=Buffer.from(await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',
  keypair.privateKey,new TextEncoder().encode(data))).toString('base64url');
 return data+'.'+sig;
}
function context({githubFailure=false}={}){
 const fetched=[],assetCalls=[];
 const fetcher=async url=>{
  fetched.push(String(url));
  if(String(url)==='https://'+env.CF_ACCESS_TEAM_DOMAIN+'/cdn-cgi/access/certs')
   return new Response(JSON.stringify(certs));
  if(githubFailure&&String(url).startsWith('https://api.github.com/'))
   return new Response('unavailable',{status:503});
  throw Error('Unapproved private network read '+url);
 };
 const assets={fetch:async req=>{
  assetCalls.push(String(req.url));return new Response('STATIC-ASSET-CANARY');
 }};
 const call=(path,options={},overrides={})=>handleRequest(
  new Request(origin+path,options),
  {...env,ASSETS:assets,...overrides},{},{fetcher});
 return {call,fetched,assetCalls};
}
const authHeader=jwt=>({'CF-Access-Jwt-Assertion':jwt});
test('every private API and static asset requires Access before any upstream request',async()=>{
 const c=context();
 for(const path of ['/api/profile','/api/policy','/api/bank','/api/characters',
  '/api/profile-sync/delivery','/api/profile-sync/signed-highwater','/api/profile-sync/status',
  '/api/profile-sync/prepare','/config-sync.html','/api/relay-ingest']){
  const response=await c.call(path);
  assert.equal(response.status,401,path);
  assert.equal(response.headers.get('access-control-allow-origin'),null,path);
  assert.doesNotMatch(await response.text(),/STATIC-ASSET-CANARY|private-albot-config/);
 }
 assert.deepEqual(c.fetched,[]);
 assert.deepEqual(c.assetCalls,[]);
});
test('telemetry bearer never authorizes any private profile endpoint',async()=>{
 const c=context();
 for(const path of ['/api/profile-sync/delivery','/api/profile-sync/signed-highwater','/api/profile','/config-sync.html']){
  const response=await c.call(path,{headers:{
   authorization:'Bearer '+env.INGEST_TOKEN,
   origin:'https://adventure.land'}});
  assert.equal(response.status,401,path);
  assert.equal(response.headers.get('access-control-allow-origin'),null,path);
 }
 assert.deepEqual(c.fetched,[]);
 assert.deepEqual(c.assetCalls,[]);
});
test('signed but wrong/expired Access claims fail before secret repository access',async()=>{
 const variants=[
  await token({aud:['other-audience']}),
  await token({email:'wrong@example.com'}),
  await token({exp:Math.floor(Date.now()/1000)-2}),
  await token({iss:'https://evil.cloudflareaccess.com'})
 ];
 const valid=await token();
 const bits=valid.split('.');
 variants.push(bits[0]+'.'+bits[1]+'.'+('A'===bits[2][0]?'B':'A')+bits[2].slice(1));
 for(const jwt of variants){
  const c=context(),res=await c.call('/api/profile-sync/delivery',{headers:authHeader(jwt)});
  assert.ok([401,403].includes(res.status),res.status+' unexpected');
  assert.equal(c.fetched.some(x=>x.includes('api.github.com')),false);
  assert.equal(c.assetCalls.length,0);
  assert.equal(res.headers.get('access-control-allow-origin'),null);
 }
});
test('private profile routes refuse game-origin CORS, browser preflight and cross-origin writes',async()=>{
 const c=context(),jwt=await token(),headers={
  ...authHeader(jwt),origin:'https://adventure.land'};
 const status=await c.call('/api/health',{headers});
 assert.equal(status.status,200);
 assert.equal(status.headers.get('access-control-allow-origin'),null);
 const delivery=await c.call('/api/profile-sync/delivery',{headers});
 assert.equal(delivery.status,503); // deliberately missing separate private signer
 assert.equal(delivery.headers.get('access-control-allow-origin'),null);
 for(const method of ['OPTIONS','POST']){
  const res=await c.call('/api/profile-sync/delivery',{method,headers});
  assert.equal(res.status,405);
  assert.equal(res.headers.get('access-control-allow-origin'),null);
 }
 const publish=await c.call('/api/profile-sync/prepare',{
  method:'PUT',headers:{...headers,'content-type':'application/json'},
  body:'{}'});
 assert.equal(publish.status,403);
 const profilePut=await c.call('/api/profile',{
  method:'PUT',headers:{...headers,'content-type':'application/json'},
  body:'{}'});
 assert.equal(profilePut.status,403);
 assert.equal(c.fetched.some(x=>x.includes('api.github.com')),false);
});
test('only exact ingest path has origin-scoped preflight, without relaxing profile access',async()=>{
 const c=context();
 for(const game of ['https://adventure.land','https://www.adventure.land']){
  const r=await c.call('/api/ingest',{method:'OPTIONS',headers:{origin:game}});
  assert.equal(r.status,204);
  assert.equal(r.headers.get('access-control-allow-origin'),game);
  assert.match(r.headers.get('access-control-allow-methods'),/POST/);
  assert.doesNotMatch(r.headers.get('access-control-allow-methods'),/PUT|GET/);
 }
 for(const game of ['https://evil.example','https://adventure.land.evil.example',
  'http://adventure.land','null']){
  const r=await c.call('/api/ingest',{method:'OPTIONS',headers:{origin:game}});
  assert.equal(r.status,403);
  assert.equal(r.headers.get('access-control-allow-origin'),null);
 }
 const protectedOptions=await c.call('/api/profile-sync/delivery',{
  method:'OPTIONS',headers:{origin:'https://adventure.land'}});
 assert.equal(protectedOptions.status,401);
 assert.equal(protectedOptions.headers.get('access-control-allow-origin'),null);
 assert.deepEqual(c.fetched,[]);
});
test('private response status never becomes a game-application acknowledgment',async()=>{
 const c=context({githubFailure:true}),jwt=await token();
 const result=await c.call('/api/profile-sync/status',{headers:authHeader(jwt)});
 // Unknown/missing private profile is only a read failure, never an ACK.
 assert.notEqual(result.status,200);
 const body=await result.text();
 assert.doesNotMatch(body,/albot-profile|My_Ranger1|GITHUB_TOKEN|CONFIG_SIGNING_JWK/);
 assert.equal(result.headers.get('access-control-allow-origin'),null);
});

test('signed publication high-water cannot be advanced via Access-less game CORS or telemetry token',async()=>{
 const c=context(),jwt=await token();
 const path='/api/profile-sync/signed-highwater';
 for(const origin of ['https://adventure.land','https://www.adventure.land','https://evil.test']){
  const req=await c.call(path,{method:'PUT',headers:{
   ...authHeader(jwt),origin,'content-type':'application/json'},
   body:JSON.stringify({confirm:true,releaseSha:'a'.repeat(40),
    sequence:7,sha256:'b'.repeat(64)})});
  assert.equal(req.status,403);
  assert.equal(req.headers.get('access-control-allow-origin'),null);
 }
 for(const method of ['OPTIONS','POST','DELETE']){
  const req=await c.call(path,{method,headers:authHeader(jwt)});
  assert.equal(req.status,405);
 }
 const noDb=await c.call(path,{headers:authHeader(jwt)});
 assert.equal(noDb.status,503);
 assert.deepEqual(c.fetched.filter(u=>u.includes('api.github.com')),[]);
 assert.equal(c.assetCalls.length,0);
});
