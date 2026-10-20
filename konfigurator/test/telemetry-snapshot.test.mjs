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
 assert.equal(rows.length,1);
 assert.equal(rows[0].kind,'bank');
 assert.equal(rows[0].data.pack,'items0');
 assert.deepEqual(rows[0].data.slots[0],{name:'beewings',q:25,level:0});
 assert.deepEqual(observedBankTelemetry({...bank,map:'main'},'EUI',definitions),[]);
 assert.equal(observedBankTelemetry(bank,'EUI',{}).length,2); // items0 and items1 are known default bank packs
});

test('both read-only packet kinds pass real Worker ingest validation with private bearer token',async()=>{
 const records=[];
 const env={INGEST_TOKEN:token,DB:{prepare(sql){return {bind(...args){return {
  async run(){records.push({sql,args});return {success:true};}
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
