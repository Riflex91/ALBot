import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {GAME_ORIGINS,RELAY_MESSAGE_TYPE,RELAY_READY_TYPE,
 acceptRelayMessage,relayBucket} from '../public/relay-protocol.mjs';
import {TELEMETRY_MIN_INTERVAL_MS} from '../public/free-tier.mjs';

async function relayFixture(){
 const script=(await readFile(new URL('../public/relay.mjs',import.meta.url),'utf8'))
  .replace(/^import .*;\n/gm,'');
 const page=await readFile(new URL('../public/relay.html',import.meta.url),'utf8');
 for(const id of ['character-result','bank-result','result','counter','activate'])
  assert.ok(page.includes('id="'+id+'"'));
 const callbacks={},opener={postMessage(){}};
 const elements=Object.fromEntries(['state','result','counter','activate',
  'character-result','bank-result'].map(id=>[id,{
    textContent:'',disabled:false,addEventListener(type,fn){callbacks['click']=fn;}
  }]));
 const window={opener,addEventListener(type,fn){callbacks[type]=fn;}};
 let currentTime=1760000000000;
 class MockDate extends Date{static now(){return currentTime;}}
 const requests=[];
 const fetch=async(path,options)=>{
  requests.push({path,options});
  const packet=JSON.parse(options.body);
  const accepted=packet.kind==='character'||requests.filter(x=>
   JSON.parse(x.options.body).kind==='bank').length>1;
  return {status:accepted?200:400,ok:accepted,
   headers:{get:()=> 'application/json'},
   async json(){return accepted?{ok:true}:{ok:false,error:'Ungültige Bankdaten'};}};
 };
 runInNewContext(script,{window,document:{getElementById:id=>elements[id]},
  GAME_ORIGINS,RELAY_MESSAGE_TYPE,RELAY_READY_TYPE,acceptRelayMessage,
  relayBucket,TELEMETRY_MIN_INTERVAL_MS,fetch,Date:MockDate});
 callbacks.click();
 const deliver=packet=>callbacks.message({source:opener,origin:'https://adventure.land',
  data:{type:RELAY_MESSAGE_TYPE,packet}});
 const char={version:1,kind:'character',data:{name:'My_Merchant'}};
 const bank={version:1,kind:'bank',data:{pack:'items0'}};
 return {elements,requests,deliver,char,bank,advance:ms=>{currentTime+=ms;}};
}

test('relay preserves rejected bank status after successful character upload',async()=>{
 const f=await relayFixture();
 await f.deliver(f.bank);
 await f.deliver(f.char);
 assert.match(f.elements['bank-result'].textContent,/Bank \(items0\).*HTTP 400.*Ungültige Bankdaten/);
 assert.match(f.elements['character-result'].textContent,/Charakter \(My_Merchant\).*erfolgreich/);
 assert.equal(f.elements.counter.textContent,'Erfolgreiche Uploads: 1 (Charakter: 1; Bank: 0)');
 assert.equal(f.requests.length,2);
 assert.equal(f.requests[0].path,'/api/relay-ingest');
 assert.equal(f.requests[0].options.credentials,'same-origin');
});

test('relay tracks successful bank separately with bounded retry and no extra polling',async()=>{
 const f=await relayFixture();
 await f.deliver(f.bank);
 await f.deliver(f.bank);
 assert.equal(f.requests.length,1,'local attempt throttle prevents immediate retry');
 f.advance(TELEMETRY_MIN_INTERVAL_MS);
 await f.deliver(f.bank);
 assert.match(f.elements['bank-result'].textContent,/Bank \(items0\).*erfolgreich/);
 assert.equal(f.elements.counter.textContent,'Erfolgreiche Uploads: 1 (Charakter: 0; Bank: 1)');
 assert.equal(f.requests.length,2);
 const src=await readFile(new URL('../public/relay.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(src,/INGEST_TOKEN|GITHUB_TOKEN|Bearer |setInterval\s*\(/);
});
