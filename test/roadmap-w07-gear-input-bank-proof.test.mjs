import test from 'node:test';
import assert from 'node:assert/strict';
import {gearInputReady,gearChainReady,unbankedDemand} from '../src/production/production.mjs';

const gear={item:'ring',level:1,gearSlot:'ring1'},
 meta={compound:true};
const ring={name:'ring',level:0};
test('W07 gear compound needs three distinct observed valid input copies',()=>{
 assert.equal(gearInputReady(gear,[ring,ring,ring],meta),true);
 assert.equal(gearInputReady(gear,[ring,ring],meta),false);
 assert.equal(gearChainReady(gear,[ring,ring,ring],meta),true);
 assert.equal(gearInputReady({...gear,level:2},[ring,ring,ring],meta),false);
 assert.equal(gearInputReady(gear,[ring,ring,{...ring,q:1}],meta),true);
});
test('W07 non-stackable phantom copies cannot fund a gear upgrade or compound',()=>{
 for(const qty of [null,0,-1,0.5,2,NaN,Infinity,
    Number.MAX_SAFE_INTEGER+1]){
  const rows=[ring,ring,{...ring,q:qty}];
  assert.equal(gearInputReady(gear,rows,meta),false,String(qty));
  assert.equal(gearChainReady(gear,rows,meta),false,String(qty));
 }
 assert.equal(gearInputReady({...gear,level:1},
  [{...ring,q:2}],{upgrade:true}),false);
});
test('W07 gear source quantity proof permits only true item-defined stack boundaries',()=>{
 const stackable={compound:true,s:10};
 assert.equal(gearInputReady(gear,[{...ring,q:3}],stackable),true);
 assert.equal(gearInputReady(gear,[{...ring,q:10}],stackable),true);
 assert.equal(gearInputReady(gear,[{...ring,q:11}],stackable),false);
 assert.equal(gearInputReady(gear,[{...ring,q:2},ring],stackable),true);
});
test('W07 malformed variants are not evaluated as current gear inputs',()=>{
 const cycle={stat_type:'int'};cycle.self=cycle;
 assert.equal(gearInputReady({...gear,variant:cycle},
  [ring,ring,ring],meta),false);
 const exact={...gear,variant:{stat_type:'dex'}};
 assert.equal(gearInputReady(exact,[ring,ring,ring],meta),false);
 assert.equal(gearInputReady(exact,[
  {name:'ring',level:0,stat_type:'dex'},
  {name:'ring',level:0,stat_type:'dex'},
  {name:'ring',level:0,stat_type:'dex'}],meta),true);
});
test('W07 bank demand counts only physically witnessed stack quantities',()=>{
 const need=[{item:'ore',level:0,quantity:5}];
 assert.equal(unbankedDemand(need,[{name:'ore',level:0,q:3}],'ore',0),2);
 assert.equal(unbankedDemand(need,[{name:'ore',level:0,q:5}],'ore',0),0);
 assert.equal(unbankedDemand(need,[],'ore',0),5);
 assert.equal(unbankedDemand(need,null,'ore',0),5);
 assert.equal(unbankedDemand(need,[{name:'ore',q:2},
  {name:'other',q:100}],'ore',0),3);
 for(const q of [null,0,-1,1.5,NaN,Infinity,
   Number.MAX_SAFE_INTEGER+1])
  assert.equal(unbankedDemand(need,[{name:'ore',q}],'ore',0),Infinity,
   'invalid bank inventory quantity '+String(q));
});
test('W07 bank variants and malformed accounting never release held reservation',()=>{
 const goals=[{item:'ring',level:0,quantity:2,variant:{stat_type:'dex'}}];
 const physical=[{name:'ring',level:0,stat_type:'str'}];
 assert.equal(unbankedDemand(goals,physical,'ring',0),2);
 assert.equal(unbankedDemand(goals,[{name:'ring',level:0,
  stat_type:'dex'}],'ring',0),1);
 const cyclic={stat_type:'dex'};cyclic.self=cyclic;
 assert.equal(unbankedDemand([{...goals[0],variant:cyclic}],
  physical,'ring',0),Infinity);
 assert.equal(unbankedDemand([{item:'ore',level:0,quantity:2.5}],
  [{name:'ore',q:3}],'ore',0),Infinity);
});
