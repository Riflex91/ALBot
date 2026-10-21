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
  bankOwner:{owner:'Ranger1',session:'test-session',realm:'EUII',
   purpose:'bank.retrieve',epoch:1700000000000,expires:1700000010000},
  skills:'z'.repeat(2100)};
 const result=fitHeartbeat(d,4200);
 assert.ok(result,'the compressed heartbeat should remain valid');
 assert.deepEqual(result.materialProgress,d.materialProgress,
   'material count prevents Merchant allocating duplicate work');
 assert.deepEqual(result.items,d.items,
   'physical item-offer summaries must remain intact');
 assert.equal(result.name,'Ranger1');
 assert.deepEqual(result.bankOwner,d.bankOwner,
   'a real active bank claim is security-critical, never optional telemetry');
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

test('G11 oversized bank owner cannot be hidden to make a heartbeat fit',()=>{
 const d={...data(),bankOwner:{owner:'Ranger1',session:'test-session',
  realm:'EUII',purpose:'bank.retrieve',extra:'x'.repeat(5000)}};
 assert.equal(fitHeartbeat(d,4200),null,
  'missing a live bank claim would make account access appear safe');
});

test('bounded material counts survive a large farmPlan that previously forced their removal',()=>{
 const d={...data(),farmPlan:{id:'plan',reason:'x'.repeat(3000)},corePadding:''};
 d.corePadding='p'.repeat(4200-JSON.stringify(d).length+50);
 const result=fitHeartbeat(d,4200);assert.ok(result);
 assert.deepEqual(result.materialProgress,d.materialProgress);
 assert.equal(result.farmPlan,undefined);
});

test('W06 suspicious aggregate material progress cannot trigger extra pulls after heartbeat transport',()=>{
 const objective='material:gem0',request={objective,item:'gem0',quantity:20};
 const producer=name=>({
  name,realm:'EUII',running:true,rip:false,
  free:8,inventoryBlocked:false,materialProgress:[{
   objective,item:'gem0',quantity:name==='A'?Number.MAX_SAFE_INTEGER:3}]
 });
 const outgoingA=fitHeartbeat(producer('A'),4200),
  outgoingB=fitHeartbeat(producer('B'),4200);
 const peers={A:outgoingA,B:outgoingB};
 assert.ok(outgoingA?.materialProgress&&outgoingB?.materialProgress);
 const plan=planMaterialQuotas(request,['A','B'],
  name=>peers[name],'EUII',{freeReserve:4});
 assert.deepEqual(plan,{remaining:20,quotas:[]});
});
