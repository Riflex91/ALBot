import test from 'node:test';
import assert from 'node:assert/strict';
import {committedFarmTransit,roadAggroTravelDecision} from '../src/combat/transit-defense.mjs';
import {selectedFarmerAvailable} from '../src/party/account.mjs';
import {reclaimRollbackEvidence,createBank} from '../src/merchant/bank.mjs';
import {fingerprint as canonicalFingerprint} from '../src/core/policy.mjs';
const char={name:'My_Ranger1',map:'main',in:'main',x:1200,y:420,hp:4000,max_hp:4200};
const plan={id:'p:1',key:'halloween:minimush:4',map:'halloween',
 in:'halloween',x:8,y:630,kind:'farm'};
const route={owner:'follow',mode:'smart_move',dest:{map:'halloween',in:'halloween',x:8,y:630}};
const bigbird={id:'danger',mtype:'bigbird',target:'My_Ranger1',hp:3200,dead:false};
test('roadside bigbird must NOT replace the verified shared native route with orbit/spiral',()=>{
 assert.equal(committedFarmTransit(char,route,plan),true);
 assert.deepEqual(roadAggroTravelDecision(char,route,plan,[bigbird],
  ['My_Ranger1','My_Ranger2','My_Priest']),{
  continueRoute:true,reason:'team-road-aggro-preserve-native-route',hostileCount:1});
 assert.equal(committedFarmTransit(char,{...route,owner:'kite'},plan),false);
 assert.equal(committedFarmTransit(char,{...route,dest:{...route.dest,x:1000}},plan),false);
 assert.equal(committedFarmTransit({...char,map:'halloween',in:'halloween',x:8,y:630},route,plan),false);
 assert.equal(committedFarmTransit(char,route,{...plan,kind:'quest'}),false);
 assert.equal(roadAggroTravelDecision(char,route,plan,[{...bigbird,target:'Other'}],
  ['My_Ranger1','My_Ranger2']).continueRoute,false);
});
test('respawn keeps already observed selected combat roster for at most 45s',()=>{
 const now=100000,dead={running:true,rip:true,realm:'EUII'};
 const options={selected:true,lastSeen:65000,now,realm:'EUII'};
 assert.equal(selectedFarmerAvailable(dead,options),true);
 assert.equal(selectedFarmerAvailable(dead,{...options,lastSeen:54999}),false);
 assert.equal(selectedFarmerAvailable(dead,{...options,selected:false}),false);
 assert.equal(selectedFarmerAvailable({...dead,running:false},options),false);
 assert.equal(selectedFarmerAvailable({...dead,realm:'USIV'},options),false);
 assert.equal(selectedFarmerAvailable({...dead,inventoryBlocked:true},options),true,
  'gold or item recovery can run while the selected character respawns');
 assert.equal(selectedFarmerAvailable({...dead,rip:false},options),true);
});
test('revoked bank sale rolls back ONLY an exact still-carried item into empty original slot',()=>{
 const item={name:'beewings',level:0,q:7};
 const record={item,pack:'items0',slot:9,dest:3,quantity:7,
  before:2,bankBefore:18,sourcePrint:'beewings'};
 assert.equal(reclaimRollbackEvidence(record,{...item},null,11),true);
 assert.equal(reclaimRollbackEvidence(record,{...item,q:6},null,11),false);
 assert.equal(reclaimRollbackEvidence(record,{...item,level:1},null,11),false);
 assert.equal(reclaimRollbackEvidence(record,{...item},item,11),false);
 assert.equal(reclaimRollbackEvidence(record,{...item},null,12),false);
 assert.equal(reclaimRollbackEvidence({...record,quantity:0},{...item},null,11),false);
 assert.equal(reclaimRollbackEvidence(record,null,null,11),false);
});


test('Merchant safely dispatches exact bank-rollback instead of entering an eternal pending loop',()=>{
 const {identity,fingerprint}=({identity:x=>x?.name+':'+(x?.level??0),fingerprint:x=>x?x.name+':'+(x.q??1):':1'});
 // The production implementation uses stricter identity/fingerprint helpers;
 // this fixture only passes a plain level-zero stack with one identical copy.
 const item={name:'beewings',level:0,q:7},prior={name:'beewings',level:0,q:2};
 const inv=Array(42).fill(null),bank=Array(42).fill(null);
 inv[0]=prior;inv[3]={...item};bank[1]={name:'beewings',level:0,q:11};
 const state=new Map(),reports=[],work=[];
 const fp=x=>x?JSON.stringify([x.name,x.level??0,'','','','','','',''])+':'+(x.q??1):':1';
 const at=Date.now(),sourcePrint=canonicalFingerprint(item);
 const record={version:2,owner:'My_Merchant',realm:'EUII',at,item,
  pack:'items0',slot:9,dest:3,before:2,bankBefore:18,quantity:7,
  sourcePrint,gold:100,expectedSaleGold:7,explicitOnly:false,
  prepared:{kind:'bank.reclaim',session:'previous',at,realm:'EUII',
   pack:'items0',slot:9,dest:3,sourcePrint},
  dispatch:{kind:'bank.reclaim',session:'previous',at,realm:'EUII',
   pack:'items0',slot:9,dest:3,sourcePrint},
  withdrawal:{at,realm:'EUII',pack:'items0',slot:9,dest:3,
   sourcePrint,inventoryCount:9,bankCount:11}};
 state.set('albot:bank-reclaim:My_Merchant',record);
 const p={c:{name:'My_Merchant',map:'bank',bank:{items0:bank,gold:0},items:inv,gold:100},
  G:{bank_packs:{items0:['bank']},items:{beewings:{type:'material',s:9999}}},
  realm:()=> 'EUII',read:k=>state.get(k)??null,
  write:(k,v)=>{state.set(k,v);return true;},root:{},parent:{},call:()=>true};
 const e={safe:i=>!!i,explicit:()=>null,rules:()=>({action:'keep'}),
  value:()=>1,remaining:()=>true,
  count:i=>p.c.items.reduce((n,x)=>n+(x?.name===i.name?(x.q??1):0),0),
  note:s=>reports.push(s),perform:(kind,data)=>{work.push({kind,data});
   assert.equal(data.guard(),true);assert.equal(data.call(),true);
   assert.ok(state.get('albot:bank-reclaim:My_Merchant').rollback.dispatchedAt);
   const old=inv[3];bank[9]=old;inv[3]=null;
   assert.equal(data.observe(),true);assert.equal(data.onConfirmed(),true);return true;}};
 const bot={p,cfg:{party:{merchant:'My_Merchant'},merchant:{bank:true,bankReclaim:true},
  production:{autoDisposition:false,goals:[],gearTargets:[]}},
  me:{name:'My_Merchant'},economy:e,inventoryBlocked:false,logistics:{reserved:false},
  running:true,session:'test',journal:null};
 const m=createBank(bot);
 assert.equal(m.pending,true);
 assert.equal(m.recoverCapacity(),true);
 assert.equal(work.length,1,JSON.stringify({reports,current:state.get('albot:bank-reclaim:My_Merchant'),status:m.recoveryStatus()}));
 assert.equal(work[0].kind,'bank.store');
 assert.equal(work[0].data.details.reason,'revoked-emergency-sale-rollback');
 assert.equal(m.recoverCapacity(),false,'synchronous confirmed rollback has already cleared its journal');
 assert.equal(m.pending,false,'checkpoint cleared only after seeing exact restored bank state');
 assert.equal(state.get('albot:bank-reclaim:My_Merchant'),null);
});

test('W04 rollback evidence rejects explicit null or overstacked source quantities',()=>{
 const record={item:{name:'beewings'},before:0,bankBefore:1,quantity:1};
 const G={items:{beewings:{type:'material',s:9}}};
 assert.equal(reclaimRollbackEvidence(record,{name:'beewings'},null,0,G),true);
 assert.equal(reclaimRollbackEvidence(record,{name:'beewings',q:null},null,0,G),false);
 const many={...record,item:{name:'beewings',q:10},quantity:10,bankBefore:10};
 assert.equal(reclaimRollbackEvidence(many,{name:'beewings',q:10},null,0,G),false);
});
