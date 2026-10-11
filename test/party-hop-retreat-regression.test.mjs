import test from 'node:test';
import assert from 'node:assert/strict';
import {nonPvpRealm,normalizeServerRegistry} from '../src/party/travel.mjs';
import {assessServerHop} from '../src/world/servers.mjs';
import {selectedPartyMember,canAcceptPartyRequest} from '../src/main.mjs';
import {isNaturallyAggressive} from '../src/combat/aggression.mjs';

test('EU and American numbered official realms accepted, no PvP naming variants',()=>{
 for(const id of ['EUI','EUII','EUIII','EUIV','USI','USII','USIII','USIV','USV'])assert.equal(nonPvpRealm(id),true,id);
 for(const id of ['EUPVP','USPVP','EUIPVP','USI-pvp','ASIAI','EUHARDCORE','EUTEST','US','US1','EU'])assert.equal(nonPvpRealm(id),false,id);
});
test('official game server census admits canonical safe realms, never PvP or explicitly offline',()=>{
 const at=Date.now();
 const census=[
  {region:'EU',name:'II',players:55},{region:'US',name:'V',players:21},
  {region:'EU',name:'PVP',players:1},
  {region:'US',name:'PVP',players:2,mode:'NORMAL',online:true},
  {region:'EU',name:'I',players:44,mode:'PVP'},
  {region:'US',name:'III',players:45,pvp:true},
  {region:'EU',name:'IV',players:35,online:false},
  {region:'US',name:'II',players:19,mode:'HARDCORE'},
  {region:'EU',name:'III',players:null}
 ];
 const r=normalizeServerRegistry(census,at,true),policy={cooldown:300000,pvp:false};
 for(const id of ['EUII','USV'])assert.equal(assessServerHop(r.find(x=>x.realm===id),[],at,policy).allowed,true,id);
 for(const id of ['EUPVP','USPVP','EUI','USIII','EUIV','USII','EUIII'])assert.equal(assessServerHop(r.find(x=>x.realm===id),[],at,policy).allowed,false,id);
 const untrusted=normalizeServerRegistry([{region:'EU',name:'II',players:55}],at,false)[0];
 assert.equal(assessServerHop(untrusted,[],at,policy).allowed,false);
});
test('only fresh configured team members including merchant can be admitted, never strangers',()=>{
 const peer={running:true,realm:'EUII'};
 const bot={running:true,me:{name:'My_Ranger1'},leader:'My_Ranger1',
  cfg:{party:{enabled:true,merchant:'My_Merchant'}},farmers:['My_Ranger1','My_Ranger2','My_Rogue'],
  teamNames:['My_Ranger1','My_Ranger2','My_Rogue','My_Merchant'],
  transport:{fresh:name=>name==='My_Merchant'||name==='My_Ranger2'?peer:null},
  p:{realm:()=> 'EUII'}};
 assert.equal(selectedPartyMember(bot,'My_Merchant'),true);
 assert.equal(canAcceptPartyRequest(bot,'My_Merchant'),true);
 assert.equal(canAcceptPartyRequest(bot,'My_Ranger2'),true);
 assert.equal(canAcceptPartyRequest(bot,'Stranger'),false);
 assert.equal(canAcceptPartyRequest(bot,'My_Ranger1'),false);
 peer.realm='USI';assert.equal(canAcceptPartyRequest(bot,'My_Merchant'),false);
 peer.realm='EUII';peer.running=false;assert.equal(canAcceptPartyRequest(bot,'My_Merchant'),false);
});
test('natural aggression only comes from game monster metadata, not boss, target or live aggro',()=>{
 const G={monsters:{bee:{attack:100,boss:true},prat:{aggro:1},goo:{aggro:0},ogre:{aggro:true}}};
 for(const m of [{mtype:'bee',aggro:10,target:'Me'},{mtype:'goo',aggro:1,target:'Me'}])assert.equal(isNaturallyAggressive(G,m),false);
 assert.equal(isNaturallyAggressive(G,{mtype:'prat'}),true);
 assert.equal(isNaturallyAggressive(G,{mtype:'ogre'}),true);
 assert.equal(isNaturallyAggressive(G,{mtype:'unknown',aggro:1}),false);
});
