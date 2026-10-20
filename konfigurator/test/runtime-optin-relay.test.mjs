import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createGameRelaySender,ALBOT_RELAY_URL,GAME_RELAY_INTERVAL_MS} from '../../src/runtime/telemetry-relay-sender.mjs';

test('runtime integration is disabled without approved game window and explicit panel click',async()=>{
 const main=await readFile(new URL('../../src/main.mjs',import.meta.url),'utf8');
 const panel=await readFile(new URL('../../src/ui/panel.mjs',import.meta.url),'utf8');
 const build=await readFile(new URL('../../scripts/build.mjs',import.meta.url),'utf8');
 assert.match(main,/if\(!p\.headless\)/);
 assert.match(main,/\['https:\/\/adventure\.land','https:\/\/www\.adventure\.land'\]/);
 assert.match(main,/openTelemetryRelay\(\)/);
 assert.match(main,/telemetryInterval=root\.setInterval/);
 assert.match(main,/telemetryRelay\.sendOnce\(\)/);
 assert.match(main,/telemetryRelay\?\.disconnect\(\)/);
 assert.match(panel,/relayButton\.onclick=\(\)=>/);
 assert.match(panel,/api\.openTelemetryRelay\(\)/);
 assert.match(build,/'src\/runtime\/telemetry-snapshot\.mjs'/);
 assert.match(build,/'src\/runtime\/telemetry-relay-sender\.mjs'/);
 assert.doesNotMatch(main,/INGEST_TOKEN|GITHUB_TOKEN/);
 assert.ok(GAME_RELAY_INTERVAL_MS>=120000);
});

test('official popup ready handshake sends first snapshot once after consent, then requires interval',()=>{
 let onMessage,now=1760000000000;
 const popup={closed:false,posts:[],postMessage(value,origin){this.posts.push({value,origin});}};
 const window={
  addEventListener(_,fn){onMessage=fn;},removeEventListener(){},
  open(){return popup;}
 };
 let readyCount=0,instance;
 instance=createGameRelaySender({gameWindow:window,now:()=>now,
  getCharacter:()=>({name:'My_Ranger1',map:'main',level:71,
   hp:1000,mp:500,max_hp:1500,max_mp:800,x:0,y:0,items:[]}),
  getRealm:()=> 'EUI',getBankDefinitions:()=>({}),
  onReady:()=>{readyCount++;instance.sendOnce();}
 });
 assert.equal(instance.status().opened,false);
 instance.open();
 assert.equal(popup.posts.length,0);
 const ack={source:popup,origin:new URL(ALBOT_RELAY_URL).origin,
  data:{type:'albot.relay.ready.v1'}};
 onMessage({...ack,origin:'https://evil.invalid'});
 assert.equal(popup.posts.length,0);
 onMessage(ack);
 onMessage(ack);
 assert.equal(readyCount,1);
 assert.equal(popup.posts.length,1);
 instance.sendOnce();
 assert.equal(popup.posts.length,1);
 now+=GAME_RELAY_INTERVAL_MS;
 instance.sendOnce();
 assert.equal(popup.posts.length,2);
 instance.disconnect();
});
