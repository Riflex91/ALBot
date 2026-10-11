import test from 'node:test';
import assert from 'node:assert/strict';
import {currentPartyOwner,canAcceptPartyInvite,canAcceptPartyRequest} from '../src/main.mjs';

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
