import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedAdaptiveCapacity} from '../src/combat/encounter.mjs';

const key='USIV:bee:three-rangers';
const success=(samples=1)=>({samples,failures:0,seconds:10*samples,xp:100*samples});
const failed=(samples=1)=>({samples,failures:1,seconds:10*samples,xp:100*samples});

test('completed safe two-target encounter unlocks three, even without 5% XP benefit',()=>{
 const profiles={[key+':1']:success(8),[key+':2']:success(3)};
 assert.equal(verifiedAdaptiveCapacity(profiles,key,3,true,true),3);
 assert.equal(verifiedAdaptiveCapacity(profiles,key,5,true,true),3,
  'unobserved size three prevents an unmeasured jump to four or five');
});

test('healthy teams test at most one new capacity per observed, successful size',()=>{
 const profiles={[key+':1']:success(1)};
 assert.equal(verifiedAdaptiveCapacity(profiles,key,5,true,true),2);
 profiles[key+':2']=success(1);
 assert.equal(verifiedAdaptiveCapacity(profiles,key,5,true,true),3);
 profiles[key+':3']=success(1);
 assert.equal(verifiedAdaptiveCapacity(profiles,key,5,true,true),4);
 profiles[key+':4']=success(1);
 assert.equal(verifiedAdaptiveCapacity(profiles,key,5,true,true),5);
 assert.equal(verifiedAdaptiveCapacity(profiles,key,3,true,true),3);
});

test('never expand after failure or without validated healthy team',()=>{
 const profiles={[key+':1']:success(7),[key+':2']:success(5)};
 assert.equal(verifiedAdaptiveCapacity(profiles,key,5,false,true),2);
 assert.equal(verifiedAdaptiveCapacity(profiles,key,5,true,false),2);
 profiles[key+':2']=failed(8);
 assert.equal(verifiedAdaptiveCapacity(profiles,key,5,true,true),1);
 assert.equal(verifiedAdaptiveCapacity({},key,5,true,true),1);
 assert.equal(verifiedAdaptiveCapacity(profiles,key,1,true,true),1);
});

test('do not trust contaminated prior evidence to probe another mob',()=>{
 const profiles={[key+':1']:success(5),[key+':2']:success(5)};
 profiles[key+':2'].failures=1;
 assert.equal(verifiedAdaptiveCapacity(profiles,key,5,true,true),1);
 delete profiles[key+':2'];profiles[key+':1']=failed(5);
 assert.equal(verifiedAdaptiveCapacity(profiles,key,5,true,true),1);
});
