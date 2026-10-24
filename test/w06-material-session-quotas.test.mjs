import test from 'node:test';
import assert from 'node:assert/strict';
import {planMaterialQuotas,materialQuotaCap,materialRequestHasWork}
 from '../src/production/material-quotas.mjs';

const NOW=1792857300000,realm='EUII';
const request={objective:'material:gem0:session-epoch',item:'gem0',
 monster:'goo',quantity:14};
const member=(name,quantity,session='session-1',extras={})=>({
 name,session,received:NOW,realm,running:true,rip:false,
 inventoryBlocked:false,free:16,
 materialProgress:[{objective:request.objective,quantity}],...extras
});
function fixture(A=member('A',3,'a-1'),B=member('B',2,'b-1')){
 const peers={A,B};
 const allocate=()=>planMaterialQuotas(request,['A','B'],
  name=>peers[name],realm,{now:NOW,ttlMs:10000,freeReserve:4,
   bindSessions:true});
 return {peers,allocate};
}
test('W06 published material work binds each physical quota to the observed process session',()=>{
 const {peers,allocate}=fixture(),plan=allocate();
 assert.deepEqual(plan,{remaining:9,quotaSessions:true,quotas:[
  {name:'A',quantity:8,session:'a-1'},
  {name:'B',quantity:6,session:'b-1'}]});
 const work={...request,...plan};
 assert.equal(materialQuotaCap(work,'A','a-1'),8);
 assert.equal(materialQuotaCap(work,'B','b-1'),6);
 assert.equal(materialQuotaCap(work,'A'),0);
 assert.equal(materialQuotaCap(work,'A','restarted-a-2'),0);
 assert.equal(materialRequestHasWork(work,['A','B'],name=>peers[name].session),true);
 assert.equal(materialRequestHasWork(work,['A'],()=>null),false);
});

test('W06 old heartbeat assignment cannot authorize harvesting after a Farmer restart',()=>{
 const {peers,allocate}=fixture(),old={...request,...allocate()};
 peers.A=member('A',3,'a-2');
 assert.equal(materialQuotaCap(old,'A',peers.A.session),0);
 assert.equal(materialRequestHasWork(old,['A'],n=>peers[n].session),false);
 const newer={...request,...allocate()};
 assert.equal(materialQuotaCap(newer,'A','a-1'),0);
 assert.equal(materialQuotaCap(newer,'A','a-2'),8);
 assert.equal(materialRequestHasWork(newer,['A'],n=>peers[n].session),true);
});

test('W06 stale or unknown sessions freeze all new quotas until a fresh heartbeat',()=>{
 for(const extra of [
  {session:''},{session:null},{session:77},
  {session:'x'.repeat(121)},
  {received:NOW-10001},{received:NOW+1},{received:null}
 ]){
  const {allocate}=fixture(member('A',3,'a-1',extra));
  assert.deepEqual(allocate(),{remaining:14,quotas:[],quotaSessions:true});
 }
 const {allocate}=fixture(member('A',3,'a-1',{running:false}));
 const off=allocate();
 assert.deepEqual(off,{remaining:12,quotaSessions:true,quotas:[
  {name:'B',quantity:14,session:'b-1'}]});
});

test('W06 no eligible physical receiver keeps request pending without any assignment',()=>{
 const {allocate}=fixture(member('A',3,'a-1',{free:0}),
  member('B',2,'b-1',{inventoryBlocked:true}));
 const plan=allocate();
 assert.deepEqual(plan,{remaining:9,quotaSessions:true,quotas:[]});
 assert.equal(materialRequestHasWork({...request,...plan},['A','B'],()=>null),false);
});

test('W06 malformed, duplicated or downgraded quota rows are never executable',()=>{
 const template={...request,remaining:5,quotaSessions:true,quotas:[
  {name:'A',quantity:8,session:'a-1'}]};
 for(const changes of [
  {quotas:[{name:'A',quantity:8}]},
  {quotas:[{name:'A',quantity:8,session:null}]},
  {quotas:[{name:'A',quantity:8,session:'a-1'}, {name:'A',quantity:1,session:'a-2'}]},
  {quotas:[{name:'A',quantity:-1,session:'a-1'}]},
  {quotas:Array.from({length:129},(_,n)=>({name:'n'+n,quantity:1,session:'s'}))},
  {quotaSessions:'true'}
 ]){
  const row={...template,...changes};
  assert.equal(materialQuotaCap(row,'A','a-1'),0);
  assert.equal(materialRequestHasWork(row,['A'],()=> 'a-1'),false);
 }
 const legacy={...request,quotas:[{name:'A',quantity:6}],remaining:6};
 assert.equal(materialQuotaCap(legacy,'A'),6);
 assert.equal(materialQuotaCap({...request},'A'),14);
 assert.equal(materialQuotaCap({...request,quotaSessions:true},'A','a-1'),0);
});
