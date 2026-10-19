import test from 'node:test';
import assert from 'node:assert/strict';
import {accountHopPenaltyDecision} from '../src/party/travel-economics.mjs';
import {createTeamTravel} from '../src/party/travel.mjs';

const home='EUII',away='USIV',now=1000000;
const member=(name,level,ctype='ranger',extra={})=>({
 name,character:{level,ctype,s:{},...extra}
});
const decision=(members,options={})=>accountHopPenaltyDecision({
 members,from:home,to:away,home,automatic:true,...options
});

test('G04 automatic hop checks the weakest member-specific cost rather than leader alone',()=>{
 assert.equal(decision([member('Leader',40),member('Ranger',80)]).allowed,false);
 const denied=decision([member('Leader',40),member('Ranger',80)]);
 assert.equal(denied.member,'Ranger');
 assert.equal(denied.reason,'member-unpriced-online-hop-penalty');
 assert.equal(decision([member('Leader',40),member('Ranger',55)]).allowed,true);
 assert.equal(decision([member('Leader',80,'merchant'),member('Ranger',55)]).allowed,true);
 assert.equal(decision([member('Leader',40),member('Merchant',80,'merchant')]).allowed,true);
});

test('G04 unknown or duplicated roster cost evidence cannot masquerade as level zero',()=>{
 for(const members of [[],Array(9).fill(member('P',30)),
  [member('A',40),member('A',35)],
  [member('A',40),member('B',NaN)],
  [member('A',40),member('B',0)],
  [member('A',40),{name:'B',character:{level:50}}],
  [member('A',40),{name:'B',character:null}]
 ]){
  assert.equal(decision(members).allowed,false);
 }
 assert.equal(decision([member('A',40)],{automatic:false}).allowed,true);
 assert.equal(decision([member('A',90)],{pressureEscape:true}).allowed,true);
 assert.equal(decision([member('A',90)],{to:home}).allowed,true);
});

function fixture({leader=true,level=40,peerLevel=80,respect=true}={}){
 const storage=new Map(),events=[],sent=[],calls=[];
 const roster={
  Leader:{name:'Leader',class:'ranger',level:leader?level:40,running:true,realm:home,s:{}},
  Peer:{name:'Peer',class:'ranger',level:peerLevel,running:true,realm:home,s:{}}
 };
 const meName=leader?'Leader':'Peer';
 const cfg={general:{testLogging:true},farming:{pvp:false},
  party:{enabled:true,merchant:'',leader:'Leader'},
  world:{serverHop:true,allowedRealms:[home,away],homeRealm:home,
   hopCooldownMs:60000,respectHopPenalties:respect,
   autoHop:false,magiport:false}};
 const root={ALBotServerRegistry:[home,away].map(realm=>({
  realm,mode:'NORMAL',online:true,players:20,at:now}))};
 const p={root,parent:{socket:{connected:true}},
  c:{name:meName,ctype:'ranger',level:leader?level:peerLevel,
   home,rip:false,q:{},s:{},map:'main'},
  realm:()=>home,
  read:k=>storage.get(k)??null,write:(k,v)=>{storage.set(k,v);return true;},
  call:(...args)=>{calls.push(args);return Promise.resolve(true);}};
 const bot={p,cfg,me:{name:meName},leader:'Leader',farmers:['Leader','Peer'],
  teamNames:['Leader','Peer'],running:true,session:'session-g04',
  journal:null,inventoryBlocked:false,bank:{pending:false},
  logistics:{reserved:false},monsters:()=>[],movement:{stop(){}},
  exec:{pending:new Map(),run:(key,locks,guard,call)=>guard()&&call()},
  transport:{fresh:n=>roster[n]??null,
   send:(n,type,data,id)=>{sent.push({name:n,type,data,id});return Promise.resolve(true);}},
  event:(type,data)=>events.push({type,data}),report(){}};
 return {travel:createTeamTravel(bot),roster,p,events,sent,calls};
}
test('G04 leader vetoes optional team hop on a costly peer; unaffected manual and low-level hop',()=>{
 const oldDate=Date.now;Date.now=()=>now;
 try{
  const expensive=fixture();
  assert.equal(expensive.travel.requestHop(away,{automatic:true}),false);
  assert.equal(expensive.sent.length,0);
  assert.equal(expensive.travel.status().hop,null);
  assert.equal(expensive.events.some(e=>e.type==='server.hopCostDeferred'&&
   e.data.member==='Peer'),true);
  const inexpensive=fixture({peerLevel:45});
  assert.equal(inexpensive.travel.requestHop(away,{automatic:true}),true);
  assert.equal(inexpensive.sent[0].type,'hopPlan');
  assert.equal(inexpensive.sent[0].data.automatic,true);
  const manual=fixture();
  assert.equal(manual.travel.requestHop(away,{automatic:false}),true);
  assert.equal(manual.sent[0].data.automatic,false);
  const optOut=fixture({respect:false});
  assert.equal(optOut.travel.requestHop(away,{automatic:true}),true);
 }finally{Date.now=oldDate;}
});

test('G04 follower vetoes automatic penalty on fresh local state before ACK',()=>{
 const oldDate=Date.now;Date.now=()=>now;
 try{
  const follower=fixture({leader:false,peerLevel:80});
  const plan=automatic=>({type:'hopPlan',id:'leader:hop:1',data:{
   realm:away,pressureEscape:false,automatic}});
  follower.travel.receive('Leader',plan(true));
  assert.equal(follower.travel.status().hop,null);
  assert.equal(follower.sent.some(m=>m.type==='hopAck'),false);
  follower.travel.receive('Leader',plan(false));
  assert.equal(follower.travel.status().hop.realm,away);
  assert.equal(follower.sent.some(m=>m.type==='hopAck'),true);
 }finally{Date.now=oldDate;}
});
