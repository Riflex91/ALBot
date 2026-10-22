import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../worker/index.mjs';
import {GAME_ORIGINS} from '../public/relay-protocol.mjs';

const endpoint='https://albot-konfigurator.example/api/ingest';
const env={INGEST_TOKEN:'x'.repeat(64)};

test('private ingest preflight admits both exact official game origins without a bearer',async()=>{
 assert.deepEqual([...GAME_ORIGINS],
  ['https://adventure.land','https://www.adventure.land']);
 for(const origin of GAME_ORIGINS){
  const response=await handleRequest(new Request(endpoint,{
   method:'OPTIONS',headers:{
    origin,'access-control-request-method':'POST',
    'access-control-request-headers':'authorization,content-type'
   }
  }),env);
  assert.equal(response.status,204);
  assert.equal(response.headers.get('access-control-allow-origin'),origin);
  assert.equal(response.headers.get('access-control-allow-methods'),'POST, OPTIONS');
  assert.match(response.headers.get('access-control-allow-headers'),/Authorization/);
  assert.equal(response.headers.get('vary'),'Origin');
 }
});

test('both official origins still require a valid private bearer for POST',async()=>{
 for(const origin of GAME_ORIGINS){
  const post=(authorization)=>handleRequest(new Request(endpoint,{
   method:'POST',headers:{origin,'content-type':'application/json',
    ...(authorization?{authorization}:{})},
   body:'{}'
  }),env);
  const missing=await post('');
  assert.equal(missing.status,401);
  assert.equal(missing.headers.get('access-control-allow-origin'),origin);
  const wrong=await post('Bearer '+'z'.repeat(64));
  assert.equal(wrong.status,401);
  const authenticated=await post('Bearer '+env.INGEST_TOKEN);
  assert.equal(authenticated.status,503,'valid token reaches D1 gate, never open ingest');
  assert.equal(authenticated.headers.get('access-control-allow-origin'),origin);
 }
});

test('lookalike, insecure and untrusted origins are rejected before ingest',async()=>{
 for(const origin of [
  'http://adventure.land','https://adventure.land.evil.example',
  'https://evil.example','https://www.adventure.land.evil.example',
  'https://ADVENTURE.land','null'
 ]){
  for(const method of ['OPTIONS','POST']){
   const response=await handleRequest(new Request(endpoint,{
    method,headers:{origin,authorization:'Bearer '+env.INGEST_TOKEN},
    ...(method==='POST'?{body:'{}'}:{})
   }),env);
   assert.equal(response.status,403,origin+' '+method);
   assert.equal(response.headers.get('access-control-allow-origin'),null);
  }
 }
});
