import test from 'node:test';
import assert from 'node:assert/strict';
import {provisionalImpactDamage,pendingImpactDamage,
 preferUnreservedEngagedTarget} from '../src/combat/impact-coordination.mjs';
import {createImpactIntents} from '../src/combat/impact-intents.mjs';

const time=10000;
const char={name:'My_Ranger3',ctype:'ranger',attack:350,frequency:2,
 hp:500,max_hp:500,map:'main',in:'main',x:0,y:0};
const enemy=(id,hp=90,target='My_Ranger2',x=40)=>({
 id,hp,max_hp:hp,mtype:'bee',type:'monster',target,map:'main',in:'main',
 x,y:0,armor:0,resistance:0,evasion:0,avoidance:0,reflection:0
});
const selected=enemy('bee-a');
const alternative=enemy('bee-b',150,'My_Ranger1',50);
const team=['My_Ranger1','My_Ranger2','My_Ranger3'];
function source({name='My_Ranger2',realm='USIV',session='r2-2026',
 received=time,at=time-350,expires=time+650,
 damage=160,kind='damage',target='bee-a'}={}){
 return {name,realm,session,received,running:true,rip:false,
  impactIntents:[{action:'attack',kind,targets:[target],
   damage:{[target]:damage},at,expires,realm,session}]};
}
function choose(o={}){
 const s=o.selected??selected,candidates=o.candidates??[s,alternative];
 return preferUnreservedEngagedTarget({
  selected:s,candidates,character:o.character??char,roster:o.roster??team,
  realm:'USIV',now:time,sources:o.sources??[source()],maxRange:o.maxRange??130
 });
}
test('phase2 active: redirect only to a DIFFERENT already-engaged and preapproved safe target',()=>{
 const x=choose();
 assert.equal(x.changed,true);
 assert.equal(x.target.id,'bee-b');
 assert.equal(x.reserved,160);
 assert.equal(x.reason,'redirect-only-to-engaged-safe-target');
 assert.equal(selected.hp,90,'world entities must not be modified');
 assert.equal(selected.dead,undefined);
});

test('target handling is fail-open: no safe alternatives means attack the original target',()=>{
 for(const candidates of [
  [selected],[selected,enemy('neutral',150,null)],
  [selected,enemy('stranger',150,'Unknown')],
  [selected,enemy('wrong-species',150,'My_Ranger1')],
  [selected,enemy('out-of-range',150,'My_Ranger1',9999)]
 ]){
  if(candidates[1]?.id==='wrong-species')candidates[1].mtype='goo';
  const x=choose({candidates});
  assert.equal(x.changed,false);
  assert.equal(x.target.id,'bee-a');
 }
 assert.equal(choose({selected:{...selected,target:'My_Ranger3'}}).changed,false,
  'never redirect an enemy attacking the local ranger');
 assert.equal(choose({character:{...char,name:'outsider'}}).changed,false,
  'no roster authority');
 assert.equal(choose({selected:{...selected,boss:true}}).changed,false,
  'no boss profile inferred from generic intent evidence');
});

test('ignore stale sessions, stale heartbeat, wrong realm, malformed damage and expired TTL',()=>{
 const base=source();
 for(const altered of [
  {...base,received:time-2600},
  {...base,realm:'EUII'},
  {...base,session:'new-session'},
  {...base,running:false},
  {...base,rip:true},
  {...base,impactIntents:[{...base.impactIntents[0],expires:time-10}]},
  {...base,impactIntents:[{...base.impactIntents[0],at:time-3000}]},
  {...base,impactIntents:[{...base.impactIntents[0],kind:'heal'}]},
  {...base,impactIntents:[{...base.impactIntents[0],damage:{'bee-a':NaN}}]},
  {...base,impactIntents:[{...base.impactIntents[0],damage:{'bee-a':0}}]}
 ]){
  const x=choose({sources:[altered]});
  assert.equal(x.changed,false);
  assert.equal(x.target.id,'bee-a');
 }
});

test('require near-lethal coverage with safety buffer, never redirect for weak estimate',()=>{
 assert.equal(choose({sources:[source({damage:105})]}).changed,false,
  '105 projected for 90 live HP is below 130% confidence threshold');
 assert.equal(choose({sources:[source({damage:120})]}).changed,true);
 assert.equal(choose({sources:[source({damage:160,target:'bee-b'})]}).changed,false);
 const both=choose({sources:[source(),
  source({name:'My_Ranger1',session:'r1',damage:300,target:'bee-b'})]});
 assert.equal(both.changed,false,'all alternative targets already pending near-lethal damage');
});

test('damage estimates are strictly conservative and unknown combat input falls back',()=>{
 const attacker={...char,attack:350};
 const ordinary=enemy('target',300);
 const estimate=provisionalImpactDamage(attacker,ordinary);
 assert.ok(estimate>=1&&estimate<350);
 assert.equal(provisionalImpactDamage(attacker,{...ordinary,armor:NaN}),0);
 assert.equal(provisionalImpactDamage({...attacker,attack:NaN},ordinary),0);
 assert.equal(provisionalImpactDamage(attacker,{...ordinary,evasion:25}),0,
  'uncertain hit probability is never treated as credible lethal pending damage');
 const shot=provisionalImpactDamage(attacker,ordinary,{damage_multiplier:.7});
 assert.ok(shot>0&&shot<estimate);
});

test('ledger emits conservative damage per target while preserving evidence-only confirmation',()=>{
 let t=1000;
 const ledger=createImpactIntents({name:'My_Ranger2',session:'r2',realm:'USIV',
  now:()=>t});
 const id=ledger.launched('3shot',['bee-a','bee-b','bee-c'],{
  damage:{'bee-a':120,'bee-b':130,'bee-c':140},
  kind:'damage'});
 assert.ok(id);
 assert.deepEqual(ledger.heartbeat()[0].damage,
  {'bee-a':120,'bee-b':130,'bee-c':140});
 assert.equal(ledger.settle(id,'returned'),false);
 assert.equal(ledger.heartbeat().length,1);
 assert.equal(ledger.confirmedHit({actor:'My_Ranger2',target:'bee-a',damage:120}),true);
 assert.equal(ledger.snapshot().confirmed,1);
 assert.equal(ledger.heartbeat()[0].damage['bee-a'],undefined,
  'a server-confirmed hit is no longer projected as pending damage');
 const second=ledger.launched('attack',['bee-x'],{
  damage:{'bee-x':-30,'extra':9999}
 });
 assert.ok(second);
 assert.deepEqual(ledger.heartbeat().find(x=>x.action==='attack').damage,{});
 ledger.settle(second,'rejected');
 assert.equal(ledger.snapshot().failed,1);
 t+=4000;
 assert.equal(ledger.snapshot().active,0);
});

test('peer snapshots do not double count same intent and only accepted roster contributes',()=>{
 const repeated=source();
 assert.equal(pendingImpactDamage('bee-a',time,[repeated,repeated],
  new Set(team),'USIV'),160);
 const stranger=source({name:'RandomStranger'});
 assert.equal(pendingImpactDamage('bee-a',time,[stranger],
  new Set(team),'USIV'),0);
 assert.equal(pendingImpactDamage('bee-a',time,[source({damage:115})],
  new Set(team),'USIV'),115);
});
