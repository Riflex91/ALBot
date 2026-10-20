import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
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
