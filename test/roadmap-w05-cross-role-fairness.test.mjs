import test from 'node:test';
import assert from 'node:assert/strict';
import {crossRoleGearPriority,gearCatchUpPriority} from '../src/production/gear-fairness.mjs';
const now=Date.now();
const slots={
 mainhand:null,offhand:null,helmet:null,chest:null,pants:null,shoes:null,
 gloves:null,amulet:null,belt:null,cape:null,ring1:null,ring2:null,
 earring1:null,earring2:null,orb:null
};
const profile=(cls,filled=[],at=now)=>({
 class:cls,level:70,complete:true,at,
 slots:Object.fromEntries(Object.keys(slots).map(k=>[k,
  filled.includes(k)?{name:k,level:2}:null]))
});
test('W05 fair coverage compares distinct roles rather than cross-class raw stats',()=>{
 const healer=profile('priest',['chest','helmet','pants','shoes']);
 const dps=profile('ranger',['mainhand','chest','helmet','pants','shoes','gloves','amulet','ring1']);
 const cohort=[{profile:healer,role:'healer'},{profile:dps,role:'dps'}];
 const missingWeapon=crossRoleGearPriority(healer,cohort,{role:'healer',slot:'mainhand',now});
 const alreadyFilled=crossRoleGearPriority(healer,cohort,{role:'healer',slot:'shoes',now});
 assert.ok(missingWeapon>alreadyFilled);
 assert.ok(missingWeapon>0);
 assert.equal(gearCatchUpPriority(healer,[dps]),0,'existing same-class rule remains independent');
});
test('W05 stale or incomplete profiles do not grant account-wide priority',()=>{
 const weak=profile('priest',[]);
 const old=profile('ranger',['mainhand','chest','helmet','pants','shoes','gloves'],now-8*86400000);
 assert.equal(crossRoleGearPriority(weak,[{profile:weak,role:'healer'},{profile:old,role:'dps'}],{role:'healer',slot:'mainhand',now}),0);
 assert.equal(crossRoleGearPriority({...weak,complete:false},[{profile:weak,role:'healer'},{profile:profile('ranger',['mainhand']),role:'dps'}],{role:'healer',slot:'mainhand',now}),0);
});
test('W05 verified wait bonus is time-bounded and absent without receipt',()=>{
 const weak=profile('priest',[]);
 const strong=profile('ranger',['mainhand','chest','helmet','pants','shoes','gloves','amulet','ring1']);
 const cohort=[{profile:weak,role:'healer'},{profile:strong,role:'dps'}];
 const ordinary=crossRoleGearPriority(weak,cohort,{role:'healer',slot:'mainhand',now});
 const waiting=crossRoleGearPriority(weak,cohort,{role:'healer',slot:'mainhand',now,lastImprovedAt:now-12*86400000});
 assert.ok(waiting>=ordinary);
 assert.ok(waiting-ordinary<=12);
 assert.equal(ordinary,crossRoleGearPriority(weak,cohort,{role:'healer',slot:'mainhand',now,lastImprovedAt:null}));
});
test('W05 role-specific vacancies and upper bound are deterministic',()=>{
 const empty=profile('merchant',[]);
 const full=profile('warrior',Object.keys(slots));
 const cohort=[{profile:empty,role:'economy'},{profile:full,role:'tank'}];
 const shoes=crossRoleGearPriority(empty,cohort,{role:'economy',slot:'shoes',now});
 const weapon=crossRoleGearPriority(empty,cohort,{role:'economy',slot:'mainhand',now});
 assert.ok(shoes>weapon);
 assert.ok(shoes<=60);
 assert.equal(crossRoleGearPriority(empty,[],{role:'economy',slot:'shoes',now}),0);
});
