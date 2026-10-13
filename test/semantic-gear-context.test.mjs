import test from 'node:test';
import assert from 'node:assert/strict';
import {knowledgeFingerprint,semanticGear} from '../src/world/knowledge.mjs';

const base={
 class:'ranger',level:61,complete:true,session:'old',realm:'EUII',at:111,
 slots:{mainhand:{name:'bow',level:5,stat_type:'dex',p:'',title:'',l:false,b:false},
  offhand:null},
 stats:{attack:450,frequency:1.13,armor:100}
};

test('gear identity ignores transport freshness, session, HP/MP and buff clocks',()=>{
 const next=structuredClone(base);
 next.at=Date.now();next.session='new';next.received=1234567;
 next.hp=1;next.mp=0;next.buffs={mluck:{ms:12}};
 assert.deepEqual(semanticGear(base),semanticGear(next));
 assert.equal(knowledgeFingerprint(semanticGear(base)),knowledgeFingerprint(semanticGear(next)));
});

test('gear identity changes for actual gear level, variant and performance changes',()=>{
 const first=knowledgeFingerprint(semanticGear(base));
 for(const change of [
  x=>{x.slots.mainhand.level++;},
  x=>{x.slots.mainhand.stat_type='int';},
  x=>{x.stats.attack+=20;},
  x=>{x.complete=false;}
 ]){
  const changed=structuredClone(base);change(changed);
  assert.notEqual(knowledgeFingerprint(semanticGear(changed)),first);
 }
});

test('stable context carries multiple independent members without heartbeat churn',()=>{
 const friend={...base,class:'mage',stats:{attack:300},at:18};
 const before=knowledgeFingerprint([semanticGear(base),semanticGear(friend)]);
 const newer=structuredClone(friend);newer.at=Date.now();newer.session='new';
 assert.equal(knowledgeFingerprint([semanticGear({...base,at:Date.now()}),semanticGear(newer)]),before);
 assert.notEqual(knowledgeFingerprint([semanticGear(base),semanticGear({...friend,level:62})]),before);
});
