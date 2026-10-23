import test from 'node:test';
import assert from 'node:assert/strict';
import {currentPartyOwner,canAcceptPartyInvite,canAcceptPartyRequest,
 canonicalPartyOwner,coordinatedPartyFarmers,splitPartyRepairDecision} from '../src/main.mjs';

function fixture(self,party=null){
 const names=['My_Ranger1','My_Ranger2','My_Rogue','My_Merchant'];
 const peers=new Map(names.map(name=>[name,{name,running:true,rip:false,realm:'USIV',
  party:name==='My_Merchant'||name==='My_Ranger2'||name==='My_Rogue'?'My_Merchant':null}]));
 const bot={me:{name:self},running:true,teamNames:names,
  farmers:['My_Ranger1','My_Ranger2','My_Rogue'],leader:'My_Ranger1',
  cfg:{party:{enabled:true,merchant:'My_Merchant'}},
  p:{c:{party},realm:()=> 'USIV'},transport:{fresh:n=>peers.get(n)??null}};
 return {bot,peers};
}
test('Ranger1 detects an existing merchant-owned team after startup',()=>{
 const {bot}=fixture('My_Ranger1');
 assert.equal(currentPartyOwner(bot),'My_Merchant');
 assert.equal(canAcceptPartyInvite(bot,'My_Merchant'),true);
 assert.equal(canAcceptPartyInvite(bot,'Stranger'),false);
});
test('merchant accepts Ranger1 recovery request without changing configured combat leader',()=>{
 const {bot}=fixture('My_Merchant','My_Merchant');
 assert.equal(canAcceptPartyRequest(bot,'My_Ranger1'),true);
 assert.equal(bot.leader,'My_Ranger1');
 assert.equal(canAcceptPartyRequest(bot,'Stranger'),false);
});
test('Ranger1 does not create a competing party when owner is visible, and rejects stale owner',()=>{
 const {bot,peers}=fixture('My_Ranger1');
 assert.equal(currentPartyOwner(bot),'My_Merchant');
 peers.get('My_Merchant').realm='EUI';
 assert.equal(currentPartyOwner(bot),null);
 assert.equal(canAcceptPartyInvite(bot,'My_Merchant'),false);
 peers.get('My_Merchant').realm='USIV';
 peers.get('My_Merchant').party='My_Ranger2';
 assert.equal(currentPartyOwner(bot),null);
});
test('joined Ranger1 cannot accept another invitation while already in merchant group',()=>{
 const {bot}=fixture('My_Ranger1','My_Merchant');
 assert.equal(currentPartyOwner(bot),null);
 assert.equal(canAcceptPartyInvite(bot,'My_Merchant'),false);
});

function splitFixture(self){
 const names=['My_Ranger1','My_Ranger2','My_Priest','My_Merchant'];
 const native={My_Ranger1:['My_Ranger1','My_Merchant'],
  My_Merchant:['My_Ranger1','My_Merchant'],
  My_Ranger2:['My_Ranger2','My_Priest'],
  My_Priest:['My_Ranger2','My_Priest']};
 const parties={My_Ranger1:'My_Ranger1',My_Merchant:'My_Ranger1',
  My_Ranger2:'My_Ranger2',My_Priest:'My_Ranger2'};
 const peers=new Map(names.map(name=>[name,{name,party:parties[name],
  running:true,realm:'EUII',rip:false,threats:0}]));
 const cfg={party:{enabled:true,leader:'My_Ranger1',merchant:'My_Merchant',
   maxFarmers:3},characters:names.map(name=>({name,enabled:true,
   group:'squad',role:name==='My_Merchant'?'merchant':'farmer'}))};
 peers.get('My_Merchant').team={names:names.filter(n=>n!=='My_Merchant'),
  leader:'My_Ranger1'};
 const bot={me:{name:self,group:'squad'},running:true,
  cfg,teamNames:names,farmers:self==='My_Ranger1'?['My_Ranger1']:
   ['My_Ranger1','My_Ranger2','My_Priest'],leader:'My_Ranger1',
  p:{c:{name:self,party:parties[self],hp:100,max_hp:100,rip:false},
   parent:{party:native[self]},realm:()=> 'EUII',has:n=>n==='leave_party'},
  transport:{fresh:n=>peers.get(n)??null},
  monsters:()=>[],movement:{order:null},logistics:{reserved:false},
  gold:{reserved:false},bank:{pending:false},account:{rotationPending:()=>false}};
 return {bot,peers,native,parties};
}
test('split EUII live logs elect the one Ranger1 party, not rival Ranger2',()=>{
 for(const name of ['My_Ranger1','My_Ranger2','My_Priest','My_Merchant']){
  const {bot}=splitFixture(name);
  assert.equal(canonicalPartyOwner(bot),'My_Ranger1');
 }
});
test('leader with stale one-farmer local roster trusts confirmed merchant team selection',()=>{
 const {bot}=splitFixture('My_Ranger1');
 assert.deepEqual(coordinatedPartyFarmers(bot),
  ['My_Ranger1','My_Ranger2','My_Priest']);
 assert.equal(selectedPartyMemberCheck(bot,'My_Ranger2'),true);
 function selectedPartyMemberCheck(b,n){return coordinatedPartyFarmers(b).includes(n);}
});
test('wrong two-person party becomes eligible to leave after stable and safe proof',()=>{
 for(const name of ['My_Ranger2','My_Priest']){
  const {bot}=splitFixture(name);
  assert.equal(splitPartyRepairDecision(bot,'My_Ranger1',11999),'await-stable-owner');
  assert.equal(splitPartyRepairDecision(bot,'My_Ranger1',12000),'leave-split-party');
  assert.equal(canAcceptPartyInvite(bot,'My_Ranger1'),false,
   'cannot accept a new party invite before leaving the old party');
  assert.equal(canAcceptPartyRequest(bot,'My_Priest'),false,
   'rival owner must not accept another independent request');
 }
 for(const name of ['My_Ranger1','My_Merchant']){
  const {bot}=splitFixture(name);
  assert.equal(splitPartyRepairDecision(bot,'My_Ranger1',20000),'no-split');
 }
});
test('split repair never abandons unsafe, foreign or unconfirmed parties',()=>{
 const {bot,peers}=splitFixture('My_Ranger2');
 const row=()=>splitPartyRepairDecision(bot,'My_Ranger1',20000);
 bot.p.parent.party.push('Foreign');
 assert.equal(row(),'party-roster-unverified');
 bot.p.parent.party.pop();
 bot.journal={kind:'gold.send'};assert.equal(row(),'party-repair-unsafe-now');
 bot.journal=null;bot.movement.order={owner:'farm'};
 assert.equal(row(),'party-repair-unsafe-now');bot.movement.order=null;
 peers.get('My_Priest').threats=1;assert.equal(row(),'party-repair-unsafe-now');
 peers.get('My_Priest').threats=0;
 bot.monsters=()=>[{hp:30,target:'My_Priest'}];
 assert.equal(row(),'party-repair-unsafe-now');bot.monsters=()=>[];
 bot.p.has=()=>false;assert.equal(row(),'await-stable-owner');
 bot.p.has=()=>true;peers.get('My_Ranger1').party='Other';
 assert.equal(canonicalPartyOwner(bot),null,'owner proof must be fresh and self-owned');
});
test('merchant-owned party remains canonical even when combat leader runs another party',()=>{
 const {bot,peers}=splitFixture('My_Ranger1');
 bot.p.c.party='My_Ranger1';peers.get('My_Merchant').party='My_Merchant';
 assert.equal(canonicalPartyOwner(bot),'My_Merchant');
 assert.equal(splitPartyRepairDecision(bot,'My_Merchant',20000),
  'leave-split-party');
});
