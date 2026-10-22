import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAutomaticTelemetrySender,AUTO_TELEMETRY_INTERVAL_MS,
 ALBOT_AUTO_TELEMETRY_URL} from '../../src/runtime/telemetry-auto-sender.mjs';
const key='f'.repeat(64);
function fixture(role='merchant'){
 let t=1760000000000,token=key,running=true;
 const requests=[];
 const fetcher=async(url,options)=>{
  requests.push({url,options});
  return {ok:true,status:200,headers:{get:()=> 'application/json'},
   json:async()=>({ok:true})};
 };
 const character=()=>({name:'My_Merchant',map:'bank',level:70,hp:1200,mp:500,
  max_hp:2000,max_mp:900,real_x:12,real_y:25,
  items:[{name:'beewings',q:2,level:0}],bank:{
   items0:Array(42).fill(null),items1:Array(42).fill(null)
  }});
 const sender=createAutomaticTelemetrySender({fetcher,role,
  getCredential:()=>token,now:()=>t,isRunning:()=>running,
  getCharacter:character,getRealm:()=> 'EUII',
  getBankDefinitions:()=>({items0:['bank'],items1:['bank']})});
 return {sender,requests,advance:ms=>{t+=ms;},setToken:x=>{token=x;},
  setRunning:x=>{running=x;}};
}
test('direct telemetry sends automatically, credential only in Authorization header',async()=>{
 const f=fixture();
 assert.deepEqual(await f.sender.sendOnce(),{character:true,bank:true});
 assert.equal(f.requests.length,2);
 for(const r of f.requests){
  assert.equal(r.url,ALBOT_AUTO_TELEMETRY_URL);
  assert.equal(r.options.credentials,'omit');
  assert.equal(r.options.redirect,'error');
  assert.equal(r.options.mode,'cors');
  assert.equal(r.options.headers.authorization,'Bearer '+key);
  assert.equal(r.options.body.includes(key),false);
 }
 assert.deepEqual(f.requests.map(r=>JSON.parse(r.options.body).kind),['character','bank']);
 assert.equal(JSON.parse(f.requests[1].options.body).data.pack,'items0');
 assert.equal(JSON.stringify(f.sender.status()).includes(key),false);
 assert.deepEqual(await f.sender.sendOnce(),{character:false,bank:false});
 f.advance(AUTO_TELEMETRY_INTERVAL_MS-1);
 await f.sender.sendOnce();assert.equal(f.requests.length,2);
 f.advance(1);assert.deepEqual(await f.sender.sendOnce(),{character:true,bank:true});
 assert.equal(JSON.parse(f.requests[3].options.body).data.pack,'items1');
 assert.equal(f.sender.status().lastBankSuccess,1760000120000);
 assert.equal(f.sender.status().lastAttempt,1760000120000);
 assert.equal(f.sender.status().lastError,null);
 f.sender.dispose();
 await f.sender.sendOnce();assert.equal(f.requests.length,4);
});
test('missing or malformed secret and paused bot never make network requests',async()=>{
 const f=fixture();
 f.setToken('');await f.sender.sendOnce();
 f.setToken('not-a-token');await f.sender.sendOnce();
 f.setToken('a'.repeat(33)+'\r\n');await f.sender.sendOnce();
 f.setToken(key);f.setRunning(false);await f.sender.sendOnce();
 assert.equal(f.requests.length,0);
 assert.equal(f.sender.status().configured,true);
 f.setRunning(true);await f.sender.sendOnce();
 assert.equal(f.requests.length,2);
});
test('failed upload is throttled and does not leak server response or credentials',async()=>{
 let t=1760000000000;
 const calls=[];
 const sender=createAutomaticTelemetrySender({
  fetcher:async(url,options)=>{calls.push(options);return {
   ok:false,status:401,headers:{get:()=> 'application/json'},
   json:async()=>({error:'SECRET LEAK TEST',ok:false})
  };},
  getCredential:()=>key,getCharacter:()=>({name:'My_Ranger1',map:'main',level:1,
   hp:10,mp:10,max_hp:20,max_mp:20,x:0,y:0,items:[]}),
  getRealm:()=> 'EUII',getBankDefinitions:()=>({}),now:()=>t
 });
 assert.equal((await sender.sendOnce()).character,false);
 assert.equal(sender.status().lastResult,'character-rejected-401');
 assert.equal(sender.status().lastError,'character-rejected-401');
 assert.equal(JSON.stringify(sender.status()).includes('SECRET'),false);
 assert.equal((await sender.sendOnce()).character,false);
 assert.equal(calls.length,1);
 t+=AUTO_TELEMETRY_INTERVAL_MS;
 await sender.sendOnce();assert.equal(calls.length,2);
});
test('automatic integration has no browser popup, user-activation step or public credentials',async()=>{
 const main=await readFile(new URL('../../src/main.mjs',import.meta.url),'utf8');
 const build=await readFile(new URL('../../scripts/build.mjs',import.meta.url),'utf8');
 const auto=await readFile(new URL('../../src/runtime/telemetry-auto-sender.mjs',import.meta.url),'utf8');
 assert.match(main,/createAutomaticTelemetrySender/);
 assert.match(main,/telemetryAutoInterval=root\.setInterval/);
 assert.match(main,/void telemetryAuto\.sendOnce\(\)/);
 assert.match(main,/root\.ALBOT_AUTO_TELEMETRY_TOKEN/);
 assert.match(build,/'src\/runtime\/telemetry-auto-sender\.mjs'/);
 assert.doesNotMatch(auto,/window\.open|postMessage|localStorage|GITHUB_TOKEN|CF_ACCESS/);
 assert.doesNotMatch(main,/\bBearer\s+[A-Za-z0-9_-]{32,}/);
 assert.doesNotMatch(auto,/\bBearer\s+[A-Za-z0-9_-]{32,}/);
});

test('getter failures are safe to diagnose without displaying or contacting a secret',async()=>{
 let called=0;
 const sender=createAutomaticTelemetrySender({
  fetcher:async()=>{called++;throw Error('must not send');},
  getCredential:()=>{throw Error('PRIVATE-KEY-READ-FAILED');},
  getCharacter:()=>null,getRealm:()=> 'EUII',getBankDefinitions:()=>({}),
  now:()=>1760000000000
 });
 const status=sender.status();
 assert.equal(status.mode,'automatic');
 assert.equal(status.configured,false);
 assert.equal(status.lastAttempt,null);
 assert.equal(JSON.stringify(status).includes('PRIVATE-KEY'),false);
 await sender.sendOnce();
 assert.equal(called,0);
 sender.dispose();
});

test('disposal aborts an in-flight browser upload and frees the sender',async()=>{
 let signal=null;
 const sender=createAutomaticTelemetrySender({
  fetcher:(_url,options)=>{
   signal=options.signal;
   return new Promise((_resolve,reject)=>{
    signal.addEventListener('abort',()=>reject(Error('abort')), {once:true});
   });
  },
  getCredential:()=>key,getCharacter:()=>({name:'My_Ranger1',map:'main',
   level:10,hp:200,mp:100,max_hp:200,max_mp:100,x:1,y:1,items:[]}),
  getRealm:()=> 'EUII',getBankDefinitions:()=>({}),
  now:()=>1760000000000
 });
 const pending=sender.sendOnce();
 assert.equal(sender.status().inFlight,true);
 assert.ok(signal instanceof AbortSignal);
 sender.dispose();
 await pending;
 assert.equal(signal.aborted,true);
 assert.equal(sender.status().inFlight,false);
 assert.equal(sender.status().disposed,true);
 assert.equal(sender.status().lastResult,'character-network-error');
 assert.equal(sender.status().lastError,'character-network-error');
});

test('runtime status reports automatic mode even without private credential',async()=>{
 const main=await readFile(new URL('../../src/main.mjs',import.meta.url),'utf8');
 assert.match(main,/telemetryStatus:\(\)=>telemetryAuto\?\{/);
 assert.match(main,/active:!disposed&&bot\.running&&telemetryAutoInterval!==null/);
 assert.match(main,/relay:telemetryRelay\?\.status\(\)\?\?null/);
 assert.doesNotMatch(main,/telemetryAuto\?\.status\(\)\.configured\?telemetryAuto\.status\(\)/);
});
