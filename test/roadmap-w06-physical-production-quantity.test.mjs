import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedProductionStockQuantity} from '../src/items/stock-policy.mjs';
import {createEconomicIntelligence} from '../src/production/intelligence.mjs';

const G={items:{
 ring:{type:'ring',compound:true,grades:[10,20]},
 cscroll0:{g:1},
 ore:{type:'material',s:10},
 potion:{type:'pot',s:true}
},compounds:[[null,1,1]],version:1};
const R={name:'ring',level:0};

test('W06 non-stackable production supply needs individual positive singles',()=>{
 assert.equal(verifiedProductionStockQuantity(G,[R,{...R,q:1}],R),2);
 for(const q of [null,0,-1,1.5,2,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
  assert.equal(verifiedProductionStockQuantity(G,[R,{...R,q:1},{...R,q}],R),
   null,'invalid nonstackable source q='+q);
 }
 assert.equal(verifiedProductionStockQuantity(G,[{name:'ring',level:1},R],R),1,
  'other upgrade levels cannot count as the requested variant');
 assert.equal(verifiedProductionStockQuantity(G,[null,R,undefined],R),1);
});
test('W06 stackable source must remain within actual metadata stack limit',()=>{
 const ore={name:'ore'};
 assert.equal(verifiedProductionStockQuantity(G,[{...ore,q:10}],ore),10);
 assert.equal(verifiedProductionStockQuantity(G,[{...ore,q:11}],ore),null);
 assert.equal(verifiedProductionStockQuantity(G,[{...ore,q:null}],ore),null);
 const potion={name:'potion'};
 assert.equal(verifiedProductionStockQuantity(G,[{...potion,q:9999}],potion),9999);
 assert.equal(verifiedProductionStockQuantity(G,[{...potion,q:10000}],potion),null);
 assert.equal(verifiedProductionStockQuantity(G,[R],{name:'not-defined'}),null);
 const malformed={name:'ring',data:{x:1}};
 malformed.data.self=malformed.data;
 assert.equal(verifiedProductionStockQuantity(G,[malformed,R],R),null,
  'a cyclic unrelated inventory variant cannot certify the physical set');
});
function compoundFixture(inventory){
 const bot={p:{G,c:{items:inventory},call:()=>0},
  cfg:{merchant:{budgetMode:'account-loss',bank:true},
   production:{autoHelpers:false,autoProfitMaxLevel:1,
    autoGearMaxLevel:1,helperMaxPrice:1000,minChance:.5,
    minImprovement:0,lossBudget:10000}},
  me:{name:'M',role:'merchant'},
  economy:{safe:i=>!!i,value:i=>i.level===1?100:10},
  production:{reservedQuantity:()=>0}};
 return createEconomicIntelligence(bot);
}
test('W06 compound EV refuses phantom copies instead of inventing profitable triples',()=>{
 const healthy=Array.from({length:6},()=>({...R}));
 assert.equal(compoundFixture(healthy).mutationEconomics(R).action,'compound');
 for(const q of [null,0,-1,1.5,2,NaN,Infinity]){
  const invalid=healthy.map(i=>({...i}));invalid[5].q=q;
  const choice=compoundFixture(invalid).mutationEconomics(R);
  assert.equal(choice.action,'bank','must keep uncertain economic input q='+q);
  assert.equal(choice.reason,'unverified-physical-compound-quantity');
  const hypothetical=compoundFixture(invalid).mutationEconomics(R,{heldOverride:100});
  assert.equal(hypothetical.action,'bank',
   'a hypothetical account reserve cannot override malformed physical stock');
 }
});
test('W06 validated physical units prevent unknown q in remote profit planning',()=>{
 // Validating pooled stock is read-only. Peer, bank and local rows cannot
 // fabricate additional compound units with q:null or q:2.
 const mixed=[R,{...R,q:null},R];
 assert.equal(verifiedProductionStockQuantity(G,mixed,R),null);
 assert.equal(verifiedProductionStockQuantity(G,[R,R,R],R),3);
 assert.equal(verifiedProductionStockQuantity(G,[R,{name:'ore',q:3}],R),1);
});
