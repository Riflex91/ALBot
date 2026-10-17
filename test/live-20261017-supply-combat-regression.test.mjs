import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingGearReceipt} from '../src/production/allocation.mjs';
import {fitHeartbeat} from '../src/party/transport.mjs';
import {farmPlanOrTeamDefense} from '../src/combat/farmer.mjs';
import {chooseStockedElixir} from '../src/items/elixirs.mjs';

test('received gear is held against automatic loot return until equipped or expired',()=>{
 const belt={name:'hpbelt',level:0};
 const receipt={item:belt,state:'accepted',expires:2000};
 assert.equal(pendingGearReceipt([receipt],belt,1000),true);
 assert.equal(pendingGearReceipt([receipt],{name:'hpbelt',level:2},1000),false);
 assert.equal(pendingGearReceipt([{...receipt,state:'equipped'}],belt,1000),false);
 assert.equal(pendingGearReceipt([receipt],belt,2000),false);
 assert.equal(pendingGearReceipt([],belt,1000),false);
});

test('bounded heartbeat retains elixir demand and small carried-stock evidence',()=>{
 const data={
  name:'My_Merchant',realm:'USV',running:true,
  items:[{item:'mpot0',need:0,held:214}],
  materials:[{item:'gem0',quantity:2}],elixir:{item:'candypop',quantity:1},
  elixirStock:[{name:'elixirint0'},{name:'elixirvit0'}],
  stock:Array.from({length:16},(_,i)=>({name:'item'+i,level:5})),
  performance:'p'.repeat(4500),gear:{debug:'g'.repeat(2000)},
  materialProgress:[{objective:'test',quantity:1}]
 };
 const result=fitHeartbeat(data,4200);
 assert.ok(result);
 assert.deepEqual(result.elixir,data.elixir);
 assert.deepEqual(result.elixirStock,data.elixirStock);
 assert.ok(JSON.stringify(result).length<=4200);
 const G={items:{elixirint0:{type:'elixir',int:35,duration:20,g:100}}};
 assert.equal(chooseStockedElixir(G,'priest',result.elixirStock).name,'elixirint0');
});

test('already engaged team attacker survives farm-plan species change without permitting neutral pulls',()=>{
 const names=['My_Ranger1','My_Ranger2','My_Priest'];
 assert.equal(farmPlanOrTeamDefense(['bee'],{mtype:'goo',target:'My_Priest'},names),true);
 assert.equal(farmPlanOrTeamDefense(['bee'],{mtype:'goo',target:null},names),false);
 assert.equal(farmPlanOrTeamDefense(['bee'],{mtype:'goo',target:'Stranger'},names),false);
 assert.equal(farmPlanOrTeamDefense(['bee'],{mtype:'bee',target:null},names),true);
});
