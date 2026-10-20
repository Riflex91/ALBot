import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GAME_ORIGINS,RELAY_MESSAGE_TYPE,RELAY_READY_TYPE,acceptRelayMessage,relayBucket} from '../public/relay-protocol.mjs';

const source={};
const packet={version:1,kind:'character',data:{name:'My_Ranger1',hp:200}};
const message=(overrides={})=>({source,origin:'https://adventure.land',
 data:{type:RELAY_MESSAGE_TYPE,packet},...overrides});

test('relay accepts only exactly the opener and official Adventure Land origins',()=>{
 const accepted=acceptRelayMessage(message(),source);
 assert.equal(accepted.packet.kind,'character');
 assert.equal(JSON.parse(accepted.serialized).data.name,'My_Ranger1');
 assert.ok(GAME_ORIGINS.includes('https://www.adventure.land'));
 assert.equal(acceptRelayMessage(message({source:{}}),source),null);
 assert.equal(acceptRelayMessage(message({origin:'https://evil.example'}),source),null);
 assert.equal(acceptRelayMessage(message({origin:'https://adventure.land.evil.example'}),source),null);
 assert.equal(acceptRelayMessage(message({data:{type:RELAY_READY_TYPE,packet}}),source),null);
 assert.equal(acceptRelayMessage(message(),null),null);
});

test('relay rejects malformed and oversized packets without serialization loops',()=>{
 assert.equal(acceptRelayMessage(message({data:{type:RELAY_MESSAGE_TYPE,packet:{version:2,kind:'bank',data:{}}}}),source),null);
 assert.equal(acceptRelayMessage(message({data:{type:RELAY_MESSAGE_TYPE,packet:{version:1,kind:'command',data:{}}}}),source),null);
 assert.equal(acceptRelayMessage(message({data:{type:RELAY_MESSAGE_TYPE,packet:{...packet,data:{name:'Ranger',large:'X'.repeat(40000)}}}}),source),null);
 const cycle={version:1,kind:'character',data:{name:'x'}};
 cycle.data.cycle=cycle;
 assert.equal(acceptRelayMessage(message({data:{type:RELAY_MESSAGE_TYPE,packet:cycle}}),source),null);
 assert.equal(relayBucket({kind:'character',data:{name:'My_Ranger1'}}),'character:My_Ranger1');
 assert.equal(relayBucket({kind:'bank',data:{pack:'items0'}}),'bank');
 assert.equal(relayBucket({kind:'character',data:{name:'bad-name'}}),null);
});

test('relay requires explicit user activation, throttles attempts and has no token',async()=>{
 const browser=await readFile(new URL('../public/relay.mjs',import.meta.url),'utf8');
 const page=await readFile(new URL('../public/relay.html',import.meta.url),'utf8');
 assert.match(page,/id="activate"/);
 assert.match(browser,/if\(!activated\)return/);
 assert.match(browser,/acceptRelayMessage\(event,window\.opener\)/);
 assert.match(browser,/lastAttempt\.set\(bucket,now\)/);
 assert.match(browser,/credentials:'same-origin'/);
 assert.match(browser,/window\.opener\.postMessage/);
 assert.doesNotMatch(browser,/INGEST_TOKEN|Bearer |targetOrigin:\s*['"]\*['"]/);
});
