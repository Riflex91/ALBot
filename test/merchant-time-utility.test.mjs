import test from 'node:test';
import assert from 'node:assert/strict';
import {exchangeWorksiteValue,travelLowerBoundMs,timeAdjustedMerchantPriority} from '../src/merchant/time-utility.mjs';

const merchant={name:'M',x:0,y:0,map:'main',in:'main',speed:50};
const local={map:'main',in:'main',x:70,y:0};
const distant={map:'main',in:'main',x:750,y:0};
test('time value uses measurable same-map travel only; no cross-map ETA is invented',()=>{
 assert.equal(travelLowerBoundMs(merchant,local),1400);
 assert.equal(travelLowerBoundMs(merchant,distant),15000);
 assert.equal(travelLowerBoundMs(merchant,{...local,map:'bank'}),null);
 assert.equal(travelLowerBoundMs({...merchant,speed:0},local),null);
 assert.equal(travelLowerBoundMs({...merchant,x:NaN},local),null);
});
test('1088 gift backlog has real remaining work, never permission to execute any gift',()=>{
 const v=exchangeWorksiteValue({character:merchant,destination:local,
  item:{name:'anniversarygift',q:1088},unit:1,confirmed:20,
  observedBatchMs:2800,now:20000,lastConfirmed:17500});
 assert.equal(v.local,true);
 assert.equal(v.remainingBatches,1088);
 assert.equal(v.remainingWorkMs,3046400);
 assert.equal(v.confirmed,20);
 assert.equal(v.freshnessMs,2500);
 assert.equal(exchangeWorksiteValue({character:merchant,destination:local,
  item:{name:'anniversarygift',q:0},unit:1}).remainingBatches,0);
 assert.equal(exchangeWorksiteValue({character:merchant,destination:local,
  item:{name:'anniversarygift',q:1088},unit:undefined}).remainingBatches,0);
});
test('bounded time-aware ranking favors nearby repeated AUTOMATIC work without overriding user priority',()=>{
 const base=-500;
 const localPriority=timeAdjustedMerchantPriority({base,automatic:true,
  character:merchant,destination:local,units:1088,perAction:1});
 const remotePriority=timeAdjustedMerchantPriority({base,automatic:true,
  character:merchant,destination:distant,units:1088,perAction:1});
 assert.ok(localPriority>base);
 assert.ok(localPriority<=base+12);
 assert.ok(remotePriority<base);
 assert.equal(timeAdjustedMerchantPriority({base,automatic:false,
  character:merchant,destination:local,units:1088}),base);
 assert.equal(timeAdjustedMerchantPriority({base,automatic:true,critical:true,
  character:merchant,destination:local,units:1088}),base);
 assert.equal(timeAdjustedMerchantPriority({base,automatic:true,
  character:merchant,destination:{...distant,map:'bank'},units:1088}),base);
});
