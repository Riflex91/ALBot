import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveLiveEntity,liveMonsterEntries} from '../src/main.mjs';
import {chooseRule} from '../src/core/policy.mjs';

test('farmer leader resolution skips transient null and undefined entity tombstones',()=>{
 const entities={
  vanished:null,
  midDespawn:undefined,
  oldMonster:false,
  m:{type:'monster',hp:100,name:'bee',id:'m',map:'main'},
  opaque:{name:'My_Ranger1',type:'character',map:'main',x:20,y:30}
 };
 assert.equal(resolveLiveEntity(entities,'My_Ranger1')?.name,'My_Ranger1');
 assert.equal(resolveLiveEntity(entities,'vanished'),null);
 assert.equal(resolveLiveEntity(entities,'not-found'),null);
 assert.equal(resolveLiveEntity(entities,'My_Ranger1',{name:'My_Ranger1'}).name,'My_Ranger1');
 assert.equal(resolveLiveEntity(null,'My_Ranger1'),null);
 assert.equal(resolveLiveEntity(entities,null),null);
 assert.deepEqual(liveMonsterEntries(entities).map(([id])=>id),['m']);
 assert.deepEqual(liveMonsterEntries(null),[]);
});
test('null inventory slots and malformed optional rules do not throw or authorize a sale',()=>{
 const rules=[null,{enabled:true,item:'beewings',minLevel:0,maxLevel:99,
  role:'all',priority:0,action:'bank'}];
 const context={role:'merchant',character:'My_Merchant',map:'bank',
  server:'EUII',task:'supply'};
 for(const item of [null,undefined,{},'beewings',0]){
  assert.doesNotThrow(()=>chooseRule(rules,item,context));
  assert.equal(chooseRule(rules,item,context),null);
 }
 const live={name:'beewings',level:0};
 assert.equal(chooseRule(rules,live,context)?.action,'bank',
  'real unchanged item rules still operate normally');
 assert.equal(chooseRule(rules,live,{...context,role:'farmer'})?.action,'bank');
});
