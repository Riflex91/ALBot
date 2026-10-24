import test from 'node:test';
import assert from 'node:assert/strict';
import {profileSyncStages} from '../public/sync-stage-model.mjs';
const ready={
 configured:true,profile:{githubSha:'a'.repeat(40),sha256:'b'.repeat(64)},
 signed:true,releasePrepared:true,releaseMatchesCurrent:true,
 releaseExpired:false,release:{sequence:4,sha256:'b'.repeat(64)},
 deliveryReady:true,published:false,applied:false,acknowledged:false
};
const states=value=>profileSyncStages(value).map(x=>x.state);
test('private signed delivery readiness is not a game receipt or application',()=>{
 assert.deepEqual(states(ready),[
  'confirmed','confirmed','ready','unknown','unknown','unavailable','unavailable']);
 assert.equal(profileSyncStages(ready).length,7);
});
test('missing, stale and tampered status fails closed instead of implying a delivery',()=>{
 assert.deepEqual(states(null),[
  'pending','pending','pending','unknown','unknown','unavailable','unavailable']);
 for(const variant of [
  {...ready,deliveryReady:false},
  {...ready,signed:false},
  {...ready,releaseExpired:true},
  {...ready,releaseMatchesCurrent:false},
  {...ready,release:{...ready.release,sha256:'c'.repeat(64)}},
  {...ready,release:{...ready.release,sequence:0}},
  {...ready,profile:{...ready.profile,githubSha:'invalid'}}
 ]){
  assert.notEqual(states(variant)[2],'ready');
 }
});
test('untrusted applied and acknowledged flags cannot forge per-character evidence',()=>{
 const malicious={...ready,received:true,verified:true,applied:true,
  acknowledged:true,characters:[{name:'Test',acknowledged:true}]};
 assert.deepEqual(states(malicious).slice(3),
  ['unknown','unknown','unavailable','unavailable']);
});
