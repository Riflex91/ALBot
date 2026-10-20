import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {defaultPolicy,validatePolicyDocument,previewGlobalItem,reviewEconomicSale} from '../public/policy.mjs';
import {validateAccess,handleRequest} from '../worker/index.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const policy={...defaultPolicy('beewings'),minimum:1000,target:3000,maximum:5000,action:'economic-sell'};
const snapshot=()=>({at:Date.now(),complete:true,
 coverage:{allCharacters:true,allBankPacks:true,noPendingTransfers:true},
 variants:[{item:'beewings',level:0,quantity:8000,protectedUnits:0,reservedUnits:0}]});
test('item target document requires unique IDs and monotonic limits',()=>{
 assert.deepEqual(validatePolicyDocument({version:1,items:[policy]}),[]);
 assert.ok(validatePolicyDocument({version:1,items:[policy,policy]}).length);
 assert.ok(validatePolicyDocument({version:1,items:[{...policy,minimum:6000}]}).length);
 assert.ok(validatePolicyDocument({version:1,items:[{...policy,item:'__proto__',other:'bad'}]}).length);
});
test('beewings excess is provisional and can never authorize a sale',()=>{
 const result=previewGlobalItem(policy,snapshot());
 assert.equal(result.provisionalExcess,3000);
 assert.equal(result.protectedFloor,5000);
 assert.equal(result.saleAuthorized,false);
 assert.equal(result.reason,'economic-review-required');
});
test('stale and partial source coverage fails closed',()=>{
 const s=snapshot();s.coverage.allBankPacks=false;
 assert.equal(previewGlobalItem(policy,s).reason,'incomplete-account-coverage');
 assert.equal(previewGlobalItem(policy,{...s,at:Date.now()-90000}).reason,'missing-or-stale-snapshot');
});
test('reservations raise the protection floor conservatively',()=>{
 const s=snapshot();s.variants[0].protectedUnits=2200;s.variants[0].reservedUnits=2300;
 const r=previewGlobalItem(policy,s);
 assert.equal(r.protectedFloor,5500);assert.equal(r.provisionalExcess,2500);
});
test('unknown alternatives block even with full account stock',()=>{
 const view=previewGlobalItem(policy,snapshot());
 assert.equal(reviewEconomicSale(policy,view,{npcValue:25,purposeKnown:true,alternatives:[]}).review,'hold');
 assert.equal(reviewEconomicSale(policy,view,{npcValue:25,purposeKnown:true,alternatives:[{verified:false,netValue:1}]}).review,'hold');
});
test('better alternatives block selling and only fully checked review is candidate',()=>{
 const view=previewGlobalItem(policy,snapshot());
 const evidence={npcValue:25,purposeKnown:true,protected:false,alternatives:[{verified:true,netValue:40}]};
 assert.equal(reviewEconomicSale(policy,view,evidence).reason,'higher-value-alternative');
 const r=reviewEconomicSale(policy,view,{...evidence,alternatives:[{verified:true,netValue:20}]});
 assert.equal(r.review,'candidate');assert.equal(r.saleAuthorized,false);assert.equal(r.provisionalQuantity,3000);
});
test('Cloudflare Access missing setup returns 503 before any assets',async()=>{
 const request=new Request('https://albot.example.com/');
 const r=await handleRequest(request,{ASSETS:{fetch(){throw Error('should not serve asset')}}});
 assert.equal(r.status,503);
});
test('Cloudflare Access missing assertion returns 401',async()=>{
 const r=await validateAccess(new Request('https://albot.example.com/api/health'),
  {CF_ACCESS_TEAM_DOMAIN:'mine.cloudflareaccess.com',CF_ACCESS_AUD:'aud1',ALLOWED_EMAIL:'user@example.com'});
 assert.equal(r.status,401);
});
function enc(json){return Buffer.from(JSON.stringify(json)).toString('base64url');}
async function credential(){
 const keypair=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,
  publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await webcrypto.subtle.exportKey('jwk',keypair.publicKey);jwk.kid='kid01';jwk.alg='RS256';
 const header=enc({alg:'RS256',kid:'kid01'});
 const payload=enc({iss:'https://mine.cloudflareaccess.com',aud:['aud1'],
   email:'user@example.com',iat:Math.floor(Date.now()/1000)-5,
   exp:Math.floor(Date.now()/1000)+300});
 const input=header+'.'+payload;
 const signature=Buffer.from(await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',
  keypair.privateKey,new TextEncoder().encode(input))).toString('base64url');
 return {token:input+'.'+signature,certs:{keys:[jwk]}};
}
test('validated Cloudflare Access controls GET and rejects wrong audience',async()=>{
 const {token,certs}=await credential();
 const env={CF_ACCESS_TEAM_DOMAIN:'mine.cloudflareaccess.com',CF_ACCESS_AUD:'aud1',
  ALLOWED_EMAIL:'user@example.com'};
 const fetcher=async()=>new Response(JSON.stringify(certs));
 const req=new Request('https://albot.example.com/api/health',{
  headers:{'CF-Access-Jwt-Assertion':token}});
 assert.equal((await validateAccess(req,env,fetcher)).ok,true);
 assert.equal((await validateAccess(req,{...env,CF_ACCESS_AUD:'wrong'},fetcher)).ok,false);
});
test('private GitHub policy GET and optimistic SHA conflict stay isolated',async()=>{
 const {token,certs}=await credential(),requestHeaders={'CF-Access-Jwt-Assertion':token};
 const env={CF_ACCESS_TEAM_DOMAIN:'mine.cloudflareaccess.com',CF_ACCESS_AUD:'aud1',
  ALLOWED_EMAIL:'user@example.com',CONFIG_REPO:'Riflex91/private-albot-config',
  CONFIG_BRANCH:'main',GITHUB_TOKEN:'ghp_a_dummy_test_only'};
 const fetcher=async url=>{
  if(String(url).endsWith('/cdn-cgi/access/certs'))return new Response(JSON.stringify(certs));
  if(String(url).startsWith('https://api.github.com'))return new Response('',{status:404});
  throw Error('unexpected external request '+url);
 };
 const get=await handleRequest(new Request('https://albot.example.com/api/policy',{headers:requestHeaders}),env,{}, {fetcher});
 assert.equal(get.status,200);const body=await get.json();assert.equal(body.sha,null);
 const put=await handleRequest(new Request('https://albot.example.com/api/policy',{
  method:'PUT',headers:{...requestHeaders,origin:'https://albot.example.com'},
  body:JSON.stringify({sha:'a'.repeat(40),document:{version:1,items:[policy]}})
 }),env,{}, {fetcher});
 assert.equal(put.status,409);
});
test('no cross-origin write even with valid Access JWT',async()=>{
 const {token,certs}=await credential();
 const env={CF_ACCESS_TEAM_DOMAIN:'mine.cloudflareaccess.com',CF_ACCESS_AUD:'aud1',
  ALLOWED_EMAIL:'user@example.com'};
 const put=await handleRequest(new Request('https://albot.example.com/api/policy',{
  method:'PUT',headers:{'CF-Access-Jwt-Assertion':token,origin:'https://evil.invalid'},
  body:'{}'}),env,{}, {fetcher:async()=>new Response(JSON.stringify(certs))});
 assert.equal(put.status,403);
});

test('full ALBot profile can be fetched from private GitHub, with revision SHA',async()=>{
 const {token,certs}=await credential();
 const fixture=JSON.parse(await readFile(new URL('../../profiles/full-team.json',import.meta.url),'utf8'));
 const source=Buffer.from(JSON.stringify(fixture)).toString('base64');
 const env={CF_ACCESS_TEAM_DOMAIN:'mine.cloudflareaccess.com',CF_ACCESS_AUD:'aud1',
  ALLOWED_EMAIL:'user@example.com',CONFIG_REPO:'Riflex91/private-albot-config',
  CONFIG_BRANCH:'main',GITHUB_TOKEN:'ghp_a_dummy_test_only'};
 const fetcher=async url=>{
  if(String(url).includes('/cdn-cgi/access/certs'))return new Response(JSON.stringify(certs));
  if(String(url).includes('/contents/albot/profile.json'))return new Response(JSON.stringify({type:'file',sha:'a'.repeat(40),content:source}));
  throw Error('unexpected endpoint '+url);
 };
 const req=new Request('https://albot.example.com/api/profile',{headers:{'CF-Access-Jwt-Assertion':token}});
 const response=await handleRequest(req,env,{}, {fetcher});
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.sha,'a'.repeat(40));
 assert.equal(body.document.schemaId,'albot.full/v1');
 assert.ok(body.document.config.characters.length>=1);
 assert.equal(body.applied,false);
});
test('profile write is rejected if GitHub SHA changed',async()=>{
 const {token,certs}=await credential();
 const env={CF_ACCESS_TEAM_DOMAIN:'mine.cloudflareaccess.com',CF_ACCESS_AUD:'aud1',
  ALLOWED_EMAIL:'user@example.com',CONFIG_REPO:'Riflex91/private-albot-config',
  GITHUB_TOKEN:'ghp_a_dummy_test_only'};
 const fetcher=async url=>{
  if(String(url).includes('/cdn-cgi/access/certs'))return new Response(JSON.stringify(certs));
  return new Response('',{status:404});
 };
 const fixture=JSON.parse(await readFile(new URL('../../profiles/full-team.json',import.meta.url),'utf8'));
 const req=new Request('https://albot.example.com/api/profile',{method:'PUT',
  headers:{'CF-Access-Jwt-Assertion':token,'origin':'https://albot.example.com','content-type':'application/json'},
  body:JSON.stringify({sha:'a'.repeat(40),document:fixture})});
 const response=await handleRequest(req,env,{}, {fetcher});
 assert.equal(response.status,409);
});
test('classic editor receives hash-scoped CSP instead of unsafe-inline',async()=>{
 const {token,certs}=await credential();
 const sha='a'.repeat(43)+'=';
 const env={CF_ACCESS_TEAM_DOMAIN:'mine.cloudflareaccess.com',CF_ACCESS_AUD:'aud1',
  ALLOWED_EMAIL:'user@example.com',ASSETS:{async fetch(req){
   if(String(req).includes('classic-csp.json'))return new Response(JSON.stringify({script:sha,style:sha}));
   return new Response('<!doctype html><title>Classic</title>',{headers:{'content-type':'text/html'}});
  }}};
 const response=await handleRequest(new Request('https://albot.example.com/classic.html',{
  headers:{'CF-Access-Jwt-Assertion':token}}),env,{},{
  fetcher:async()=>new Response(JSON.stringify(certs))});
 assert.equal(response.status,200);
 const csp=response.headers.get('content-security-policy');
 assert.ok(csp.includes("'sha256-"+sha+"'"));
 assert.equal(csp.includes("'unsafe-inline'"),false);
});

test('ingest CORS preflight is narrowly scoped to Adventure Land',async()=>{
 const allowed=await handleRequest(new Request('https://albot.example.com/api/ingest',{
  method:'OPTIONS',headers:{origin:'https://adventure.land',
   'access-control-request-method':'POST','access-control-request-headers':'authorization,content-type'}
 }),{});
 assert.equal(allowed.status,204);
 assert.equal(allowed.headers.get('access-control-allow-origin'),'https://adventure.land');
 const blocked=await handleRequest(new Request('https://albot.example.com/api/ingest',{
  method:'OPTIONS',headers:{origin:'https://untrusted.example'}
 }),{});
 assert.equal(blocked.status,403);
});
test('CORS permission does not replace telemetry token authentication',async()=>{
 const response=await handleRequest(new Request('https://albot.example.com/api/ingest',{
  method:'POST',headers:{origin:'https://adventure.land','content-type':'application/json'},
  body:JSON.stringify({version:1,kind:'character',data:{name:'bad'}})
 }),{DB:{}});
 assert.equal(response.status,401);
 assert.equal(response.headers.get('access-control-allow-origin'),'https://adventure.land');
});

test('Access relay accepts only authenticated same-origin JSON, while legacy ingest still requires bearer',async()=>{
 const {token,certs}=await credential();
 const writes=[];
 const env={CF_ACCESS_TEAM_DOMAIN:'mine.cloudflareaccess.com',CF_ACCESS_AUD:'aud1',
  ALLOWED_EMAIL:'user@example.com',
  DB:{prepare(sql){return {bind(...args){return {async run(){
   writes.push({sql,args});return {meta:{changes:1}};
  }};}};}}};
 const packet={version:1,kind:'character',data:{
  name:'My_Ranger1',realm:'EUI',map:'main',level:70,
  hp:1200,mp:500,maxHp:2000,maxMp:900,x:20,y:30,
  expPerHour:0,goldPerHour:0,ratesMeasured:false,
  inventory:[{name:'beewings',q:2,level:0}]
 }};
 const fetcher=async url=>{
  if(String(url).includes('/cdn-cgi/access/certs'))return new Response(JSON.stringify(certs));
  throw Error('unexpected network call');
 };
 const request=(path,headers={})=>new Request('https://albot.example.com'+path,{
  method:'POST',headers:{'CF-Access-Jwt-Assertion':token,
   origin:'https://albot.example.com','content-type':'application/json',...headers},
  body:JSON.stringify(packet)});
 const authorized=await handleRequest(request('/api/relay-ingest'),env,{}, {fetcher});
 assert.equal(authorized.status,200);
 assert.equal((await authorized.json()).ok,true);
 assert.equal(writes.length,1);
 assert.equal(authorized.headers.get('access-control-allow-origin'),null);
 const badOrigin=await handleRequest(request('/api/relay-ingest',{origin:'https://adventure.land'}),env,{}, {fetcher});
 assert.equal(badOrigin.status,403);
 const noJwt=await handleRequest(new Request('https://albot.example.com/api/relay-ingest',{
  method:'POST',headers:{origin:'https://albot.example.com','content-type':'application/json'},
  body:JSON.stringify(packet)}),env,{}, {fetcher});
 assert.equal(noJwt.status,401);
 const wrongType=await handleRequest(request('/api/relay-ingest',{'content-type':'text/plain'}),env,{}, {fetcher});
 assert.equal(wrongType.status,415);
 const oldRoute=await handleRequest(request('/api/ingest'),env,{}, {fetcher});
 assert.equal(oldRoute.status,401);
 assert.equal(writes.length,1);
});
