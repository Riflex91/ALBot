import test from 'node:test';
import assert from 'node:assert/strict';
import {fitHeartbeat} from '../src/party/transport.mjs';
import {planMaterialQuotas} from '../src/production/material-quotas.mjs';

const data=()=>({
 name:'Ranger1',realm:'EUII',running:true,session:'test-session',
 free:5,storagePressure:false,items:[{item:'gem0',need:0,to:'Merchant',
  variant:{name:'gem0',level:0},surplus:12}],
 materials:[],materialProgress:[{objective:'material:gem0',item:'gem0',quantity:7}]
});
test('Merchant receives already collected material counts after unnecessary telemetry is shed',()=>{
 const d={...data(),performance:'x'.repeat(2400),
  bankOwner:'y'.repeat(2500),skills:'z'.repeat(2100)};
 const result=fitHeartbeat(d,4200);
 assert.ok(result,'the compressed heartbeat should remain valid');
 assert.deepEqual(result.materialProgress,d.materialProgress,
   'material count prevents Merchant allocating duplicate work');
 assert.deepEqual(result.items,d.items,
   'physical item-offer summaries must remain intact');
 assert.equal(result.name,'Ranger1');
 assert.equal(result.bankOwner,undefined);
 assert.ok(JSON.stringify(result).length<=4200);
});
test('full material progress is unchanged in normally sized heartbeat',()=>{
 const d=data(),result=fitHeartbeat(d,4200);
 assert.deepEqual(result,d);
 assert.notStrictEqual(result.items,d.items,'copy per-message item summary');
});
test('an oversized untrusted progress payload is not allowed to break heartbeat limit',()=>{
 const d={...data(),materialProgress:[{objective:'z'.repeat(5000),
  item:'gem0',quantity:7}]};
 const result=fitHeartbeat(d,4200);
 assert.ok(result);
 assert.equal(result.materialProgress,undefined,
  'only extreme evidence size forces optional progress removal');
 assert.equal(result.name,d.name);
 assert.deepEqual(result.items,d.items);
 assert.ok(JSON.stringify(result).length<=4200);
});
test('active material counts are preferred to unrelated skill telemetry near the cap',()=>{
 const d={...data(),performance:'x'.repeat(1200),
  bankOwner:'y'.repeat(1300),skills:'z'.repeat(1700),
  mluck:'w'.repeat(1000),elixir:'p'.repeat(400)};
 const result=fitHeartbeat(d,4200);
 assert.deepEqual(result.materialProgress,d.materialProgress);
 assert.deepEqual(result.items,d.items);
 assert.ok(JSON.stringify(result).length<=4200);
});

test('oversized heartbeat with lost material evidence cannot authorize another farming quota',()=>{
 const objective='material:gem0',request={objective,item:'gem0',quantity:10};
 const hidden=fitHeartbeat({...data(),running:true,rip:false,
  materialProgress:[{objective:'q'.repeat(5000),quantity:8}],
  free:15,inventoryBlocked:false},4200);
 assert.equal(hidden.materialProgress,undefined,
  'transport legitimately sheds impossible material evidence');
 const known={name:'Ranger2',running:true,rip:false,realm:'EUII',
  free:15,inventoryBlocked:false,
  materialProgress:[{objective,quantity:2}]};
 const active={...hidden,name:'Ranger1'};
 const peers={Ranger1:active,Ranger2:known};
 const guarded=planMaterialQuotas(request,['Ranger1','Ranger2'],
  name=>peers[name],'EUII',{freeReserve:4});
 assert.deepEqual(guarded,{remaining:10,quotas:[]});
 // Once a compact complete heartbeat arrives, current stock is accounted
 // for and only the exact remaining quantity can be assigned.
 peers.Ranger1={...active,materialProgress:[{objective,quantity:7}]};
 const reopened=planMaterialQuotas(request,['Ranger1','Ranger2'],
  name=>peers[name],'EUII',{freeReserve:4});
 assert.deepEqual(reopened,{remaining:1,quotas:[
  {name:'Ranger1',quantity:8},{name:'Ranger2',quantity:2}]});
});
