import test from 'node:test';
import assert from 'node:assert/strict';
import {orderedGearRecipients} from '../src/items/logistics.mjs';
import {identity} from '../src/core/policy.mjs';

function fixture(){
 const item={name:'staff',level:3,stat_type:'int'};
 const peers={
  Ranger1:{running:true,rip:false,realm:'EUI',session:'r1'},
  Ranger2:{running:true,rip:false,realm:'EUI',session:'r2'},
  Priest:{running:true,rip:false,realm:'EUI',session:'p'}
 };
 const goals=[
  {enabled:true,recipient:'Ranger1',item:'staff',level:3,gearSlot:'mainhand',priority:25,variant:{stat_type:'int'}},
  {enabled:true,recipient:'Ranger2',item:'staff',level:3,gearSlot:'mainhand',priority:140,variant:{stat_type:'int'}},
  {enabled:true,recipient:'Priest',item:'staff',level:3,gearSlot:'mainhand',priority:1000,urgentStarter:true,variant:{stat_type:'int'}}
 ];
 const recipients=['Ranger1','Ranger2','Priest'];
 const opts={role:'merchant',gearEnabled:true,explicitRules:[],
  goals,peers,realm:'EUI',allocations:[]};
 return {item,goals,peers,recipients,opts};
}
test('W13 live gear priorities select the urgent existing recipient, not fixed config order',()=>{
 const f=fixture();
 assert.deepEqual(orderedGearRecipients(f.recipients,f.item,f.opts),
  ['Priest','Ranger2','Ranger1']);
 assert.deepEqual(f.recipients,['Ranger1','Ranger2','Priest'],
  'caller and original precedence are not mutated');
});
test('W13 user-defined keep or send rule retains its original recipient order',()=>{
 const f=fixture();
 for(const action of ['keep','send']){
  f.opts.explicitRules=[{enabled:true,item:'staff',action,recipient:'Ranger1'}];
  assert.deepEqual(orderedGearRecipients(f.recipients,f.item,f.opts),
   f.recipients);
 }
 f.opts.explicitRules=[{enabled:false,item:'staff',action:'send'}];
 assert.equal(orderedGearRecipients(f.recipients,f.item,f.opts)[0],'Priest');
});
test('W13 stale, dead, different-realm or absent session cannot earn gear dispatch preference',()=>{
 for(const mutate of [
  p=>{p.running=false;},
  p=>{p.rip=true;},
  p=>{p.realm='USI';},
  p=>{p.session='';},
  p=>{p.session=undefined;}
 ]){
  const f=fixture();mutate(f.peers.Priest);
  assert.deepEqual(orderedGearRecipients(f.recipients,f.item,f.opts),
   ['Ranger2','Ranger1','Priest']);
 }
});
test('W13 wrong variant and competing claims never get priority credit',()=>{
 const f=fixture();
 f.goals[2].variant.stat_type='str';
 assert.deepEqual(orderedGearRecipients(f.recipients,f.item,f.opts),
  ['Ranger2','Ranger1','Priest']);
 f.goals[2].variant.stat_type='int';
 for(const state of ['reserved','unresolved']){
  f.opts.allocations=[{state,variant:identity(f.item),recipient:'Priest'}];
  assert.deepEqual(orderedGearRecipients(f.recipients,f.item,f.opts),
   ['Ranger2','Ranger1','Priest']);
 }
 f.opts.allocations=[{state:'delivered',variant:identity(f.item),recipient:'Priest'}];
 assert.equal(orderedGearRecipients(f.recipients,f.item,f.opts)[0],'Priest',
  'a delivered claim does not mark a second physical copy permanently unusable');
});
test('W13 no fresh target proof leaves legacy order and cannot create a recipient',()=>{
 const f=fixture();
 f.opts.goals=[];
 assert.deepEqual(orderedGearRecipients(f.recipients,f.item,f.opts),f.recipients);
 f.opts.goals=f.goals;
 assert.deepEqual(orderedGearRecipients(f.recipients,f.item,{...f.opts,gearEnabled:false}),f.recipients);
 assert.deepEqual(orderedGearRecipients(f.recipients,f.item,{...f.opts,role:'farmer'}),f.recipients);
 assert.deepEqual(orderedGearRecipients(['Ranger1'],f.item,f.opts),['Ranger1']);
 assert.deepEqual(orderedGearRecipients([],f.item,f.opts),[]);
 assert.deepEqual(orderedGearRecipients(f.recipients,{name:'other',level:0},f.opts),f.recipients);
 assert.deepEqual(orderedGearRecipients(['Priest','Ranger1'],f.item,f.opts),
  ['Priest','Ranger1']);
});
test('W13 deterministic priority ties preserve original rule ordering and no invalid scores grant boost',()=>{
 const f=fixture();
 f.goals.forEach(g=>{g.priority=30;});
 assert.deepEqual(orderedGearRecipients(f.recipients,f.item,f.opts),f.recipients);
 f.goals[2].priority=NaN;
 assert.deepEqual(orderedGearRecipients(f.recipients,f.item,f.opts),f.recipients);
 f.goals[0].priority=90;
 assert.deepEqual(orderedGearRecipients(f.recipients,f.item,f.opts),
  ['Ranger1','Ranger2','Priest']);
});
