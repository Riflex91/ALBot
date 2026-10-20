import test from 'node:test';
import assert from 'node:assert/strict';
import {observedCharacterTelemetry,observedBankTelemetry} from '../../src/runtime/telemetry-snapshot.mjs';
import {handleRequest} from '../worker/index.mjs';
const token='t'.repeat(48);
const char={name:'My_Ranger1',map:'main',level:71,hp:2340,mp:980,max_hp:2400,max_mp:1000,
 x:100,y:200,real_x:110,real_y:210,items:[{name:'beewings',q:12,level:0},null]};

test('character read-only snapshot strips game-only fields and preserves slot identities',()=>{
 const input=structuredClone(char);const packet=observedCharacterTelemetry(input,'EUI');
 assert.equal(packet.kind,'character');
 assert.equal(packet.data.name,'My_Ranger1');
 assert.equal(packet.data.x,110);
 assert.equal(packet.data.y,210);
 assert.deepEqual(packet.data.inventory,[{name:'beewings',q:12,level:0},null]);
 assert.equal(packet.data.ratesMeasured,false);
 input.items[0].q=700;
 assert.equal(packet.data.inventory[0].q,12);
 assert.equal(observedCharacterTelemetry({...char,items:[{name:'invalid-bad',q:1}]},'EUI'),null);
 assert.equal(observedCharacterTelemetry({...char,x:NaN,real_x:undefined},'EUI'),null);
});

test('bank evidence includes only fully observed local map packs with exactly 42 slots',()=>{
 const bank={...char,map:'bank',bank:{items0:Array(42).fill(null),items1:Array(42).fill(null),
  items8:Array(42).fill(null),items2:Array(41).fill(null)}};
 bank.bank.items0[0]={name:'beewings',q:25};
 const definitions={items0:['bank'],items1:['bank_b'],items2:['bank'],items8:['bank_u']};
 const rows=observedBankTelemetry(bank,'EUI',definitions);
 assert.equal(rows.length,2,'visible 41-slot pack is still a complete 42-slot bank view');
 assert.deepEqual(rows.map(r=>r.data.pack),['items0','items2']);
 assert.equal(rows[0].kind,'bank');
 assert.deepEqual(rows[0].data.slots[0],{name:'beewings',q:25,level:0});
 assert.equal(rows[1].data.slots.length,42);
 assert.equal(rows[1].data.slots[41],null);
 assert.deepEqual(observedBankTelemetry({...bank,map:'main'},'EUI',definitions),[]);
 assert.equal(observedBankTelemetry(bank,'EUI',{}).length,3); // bank defaults only local items0..7
});

test('compact, sparse and empty locally observed bank packs normalize to 42 slots',()=>{
 const compact={...char,map:'bank',bank:{
  items0:[],
  items1:[null,{name:'beewings',q:2}],
  items2:Array(4),
  items3:Array(43).fill(null),
  items8:[{name:'beewings'}]
 }};
 compact.bank.items2[3]={name:'beewings',level:1};
 const mapping={items0:['bank'],items1:['bank'],items2:['bank'],
  items3:['bank'],items8:['bank_b']};
 const got=observedBankTelemetry(compact,'EUI',mapping);
 assert.deepEqual(got.map(x=>x.data.pack),['items0','items1','items2']);
 for(const row of got)assert.equal(row.data.slots.length,42);
 assert.equal(got[0].data.slots.every(x=>x===null),true);
 assert.deepEqual(got[1].data.slots[1],{name:'beewings',q:2,level:0});
 assert.equal(got[1].data.slots[41],null);
 assert.equal(got[2].data.slots[0],null);
 assert.deepEqual(got[2].data.slots[3],{name:'beewings',q:1,level:1});
 assert.equal(got[2].data.slots[41],null);
 assert.equal(observedBankTelemetry({...compact,map:'bank_b'},'EUI',mapping).length,1);
 assert.equal(observedBankTelemetry({...compact,map:'main'},'EUI',mapping).length,0);
 assert.equal(observedBankTelemetry({...compact,bank:{}},'EUI',mapping).length,0);
 assert.equal(observedBankTelemetry({...compact,bank:undefined},'EUI',mapping).length,0);
});

test('both read-only packet kinds pass real Worker ingest validation with private bearer token',async()=>{
 const records=[];
 const env={INGEST_TOKEN:token,DB:{prepare(sql){return {bind(...args){return {
  async run(){records.push({sql,args});return {meta:{changes:1}};}
 };}};}}};
 const packets=[observedCharacterTelemetry(char,'EUI'),...observedBankTelemetry({
  ...char,map:'bank',bank:{items0:Array(42).fill(null)}},'EUI',{items0:['bank']})];
 for(const packet of packets){
  const req=new Request('https://albot.example.com/api/ingest',{method:'POST',
   headers:{authorization:'Bearer '+token,origin:'https://adventure.land',
    'content-type':'application/json'},body:JSON.stringify(packet)});
  const response=await handleRequest(req,env);
  assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
  assert.equal((await response.json()).ok,true);
 }
 assert.equal(records.length,2);
 const denied=await handleRequest(new Request('https://albot.example.com/api/ingest',{
  method:'POST',headers:{origin:'https://adventure.land'},body:JSON.stringify(packets[0])}),env);
 assert.equal(denied.status,401);
 assert.equal(records.length,2);
});
