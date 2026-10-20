import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createGameRelaySender,ALBOT_RELAY_URL,GAME_RELAY_INTERVAL_MS} from '../../src/runtime/telemetry-relay-sender.mjs';
import {acceptRelayMessage} from '../public/relay-protocol.mjs';

const character=()=>({name:'My_Ranger1',map:'main',level:70,hp:1200,mp:500,
 max_hp:2000,max_mp:900,real_x:20,real_y:30,items:[{name:'beewings',q:2,level:0}]});
function browser(){
 const sent=[];let listener=null,openCount=0,removed=false;
 const gameWindow={
  addEventListener(type,fn){assert.equal(type,'message');listener=fn;},
  removeEventListener(type,fn){removed=type==='message'&&listener===fn;listener=null;},
  open(url){openCount++;assert.equal(url,ALBOT_RELAY_URL);return popup;}
 };
 const popup={closed:false,postMessage(data,targetOrigin){sent.push({data,targetOrigin});}};
 return {gameWindow,popup,sent,deliver(event){listener?.(event);},
  get opened(){return openCount;},get removed(){return removed;}};
}

test('sender requires user open plus authenticated popup handshake and exact response origin',()=>{
 const b=browser();let t=1760000000000;
 const sender=createGameRelaySender({gameWindow:b.gameWindow,getCharacter:character,
  getRealm:()=> 'EUI',getBankDefinitions:()=>({}),now:()=>t});
 assert.deepEqual(sender.sendOnce(),{character:false,bank:false});
 assert.equal(b.opened,0);assert.equal(sender.open(),true);
 assert.deepEqual(sender.sendOnce(),{character:false,bank:false});
 b.deliver({source:{},origin:new URL(ALBOT_RELAY_URL).origin,data:{type:'albot.relay.ready.v1'}});
 b.deliver({source:b.popup,origin:'https://evil.example',data:{type:'albot.relay.ready.v1'}});
 assert.equal(sender.status().connected,false);
 b.deliver({source:b.popup,origin:new URL(ALBOT_RELAY_URL).origin,data:{type:'albot.relay.ready.v1'}});
 assert.equal(sender.status().connected,true);
 assert.deepEqual(sender.sendOnce(),{character:true,bank:false});
 assert.equal(b.sent.length,1);
 assert.equal(b.sent[0].targetOrigin,new URL(ALBOT_RELAY_URL).origin);
 assert.equal(acceptRelayMessage({source:b.gameWindow,origin:'https://adventure.land',
  data:b.sent[0].data},b.gameWindow).packet.data.name,'My_Ranger1');
 assert.deepEqual(sender.sendOnce(),{character:false,bank:false});
 t+=GAME_RELAY_INTERVAL_MS;
 assert.deepEqual(sender.sendOnce(),{character:true,bank:false});
 sender.disconnect();
 assert.equal(b.removed,true);
 assert.deepEqual(sender.sendOnce(),{character:false,bank:false});
});

test('merchant sends at most one actually observed bank pack per interval, rotating packs',()=>{
 const b=browser();let t=1760000000000;
 const merchant=()=>({...character(),name:'My_Merchant',map:'bank',
  bank:{items0:Array(42).fill(null),items1:Array(42).fill(null)}});
 const sender=createGameRelaySender({gameWindow:b.gameWindow,getCharacter:merchant,
  getRealm:()=> 'EUI',getBankDefinitions:()=>({items0:['bank'],items1:['bank']}),
  role:'merchant',now:()=>t});
 sender.open();
 b.deliver({source:b.popup,origin:new URL(ALBOT_RELAY_URL).origin,data:{type:'albot.relay.ready.v1'}});
 assert.deepEqual(sender.sendOnce(),{character:true,bank:true});
 assert.equal(b.sent.length,2);
 assert.equal(b.sent[1].data.packet.data.pack,'items0');
 for(let i=0;i<100;i++)sender.sendOnce();
 assert.equal(b.sent.length,2);
 t+=GAME_RELAY_INTERVAL_MS;
 assert.deepEqual(sender.sendOnce(),{character:true,bank:true});
 assert.equal(b.sent[3].data.packet.data.pack,'items1');
 sender.disconnect();
});

test('sender rejects destination spoofing, unsafe browser and never performs network fetches',async()=>{
 const b=browser();
 const base={gameWindow:b.gameWindow,getCharacter:character,getRealm:()=> 'EUI',
  getBankDefinitions:()=>({})};
 assert.throws(()=>createGameRelaySender({...base,relayUrl:'https://evil.example/relay.html'}));
 assert.throws(()=>createGameRelaySender({...base,relayUrl:ALBOT_RELAY_URL+'?token=bad'}));
 assert.throws(()=>createGameRelaySender({...base,gameWindow:{}}));
 const src=await readFile(new URL('../../src/runtime/telemetry-relay-sender.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(src,/\bfetch\s*\(|INGEST_TOKEN|GITHUB_TOKEN|\bsetInterval\s*\(/);
});
