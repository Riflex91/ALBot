import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';
import {createHash} from 'node:crypto';
import {minify} from 'terser';
import {FULL_DESCRIPTOR as LIVE_DESCRIPTOR} from '../src/config/full.mjs';
import {VERSION} from '../src/version.mjs';
import {checkDescriptor,defaultsFor,envelope,exportBundle,checkPackage} from '../editor/lib/contract.mjs';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const version=VERSION;
const files=['src/runtime/primitives.js','src/version.mjs','editor/lib/schema.mjs','editor/lib/contract.mjs','src/config/live-a.mjs','src/config/live-b.mjs','src/config/live-c.mjs','src/config/p3p4.mjs','src/config/full.mjs','src/core/policy.mjs','src/core/executor.mjs','src/core/test-report.mjs','src/core/checkpoint.mjs','src/core/fair-tasks.mjs','src/core/priority.mjs','src/core/recovery.mjs','src/runtime/ports.mjs','src/party/transport.mjs','src/core/movement.mjs','src/party/capabilities.mjs','src/combat/encounter.mjs','src/combat/navigation.mjs','src/combat/threats.mjs','src/production/allocation.mjs','src/combat/skills.mjs','src/items/logistics.mjs','src/items/gold.mjs','src/combat/farmer.mjs','src/ui/panel.mjs','src/merchant/economy.mjs','src/merchant/bank.mjs','src/merchant/market.mjs','src/production/probability.mjs','src/production/materials.mjs','src/production/recipes.mjs','src/production/observations.mjs','src/production/costs.mjs','src/production/planner.mjs','src/production/production.mjs','src/production/gear.mjs','src/merchant/service-plan.mjs','src/merchant/controller.mjs','src/merchant/services.mjs','src/world/risk.mjs','src/world/knowledge.mjs','src/world/content.mjs','src/world/servers.mjs','src/world/team-plan.mjs','src/world/progression.mjs','src/items/elixirs.mjs','src/production/intelligence.mjs','src/world/strategy.mjs','src/core/behavior.mjs','src/party/account.mjs','src/party/aura.mjs','src/party/travel.mjs','src/main.mjs'];
checkDescriptor(LIVE_DESCRIPTOR);
const chunks=await Promise.all(files.map(async path=>'// '+path+'\n'+(await readFile(path,'utf8')).replace(/\r\n/g,'\n').replace(/^import .*;\n/gm,'').replace(/^export /gm,'')));
const source='/* ALBot '+version+' · Vollbetrieb Live-Test pending */\n(function(root){"use strict";\n'+chunks.join('\n')+'\ninstall(root);\n})(globalThis);';
const minimized=await minify(source,{ecma:2022,compress:false,mangle:true,format:{comments:false}});
if(!minimized.code)throw Error('Minifizierung lieferte keinen Code.');
const code='/* ALBot '+version+' · Vollbetrieb Live-Test pending */\n'+minimized.code;
new Script(code);
const runtime={version,contractVersion:1,schemaId:LIVE_DESCRIPTOR.schemaId,sha256:createHash('sha256').update(code).digest('hex'),code};
const pkg={format:'albot-package',formatVersion:1,descriptor:LIVE_DESCRIPTOR,runtime};await checkPackage(pkg);
const config=defaultsFor(LIVE_DESCRIPTOR.schema);
const character=defaultsFor(LIVE_DESCRIPTOR.schema.properties.characters.items);
config.characters=[{...character,name:'Farmer1',class:'ranger'}];config.party.leader='Farmer1';config.party.waitForTeam=false;
const solo=envelope(LIVE_DESCRIPTOR,config);
const team=structuredClone(config);team.general.name='Vollbetrieb · drei Farmer und Merchant';team.characters=[...['Farmer1','Farmer2','Farmer3'].map(name=>({...character,name,class:'ranger'})),{...character,name:'Merchant',role:'merchant',class:'merchant'}];team.party.merchant='Merchant';team.party.waitForTeam=true;
const item=defaultsFor(LIVE_DESCRIPTOR.schema.properties.items.items);
team.items=[{...item,name:'Merchant liefert HP-Tränke',item:'hpot1',role:'merchant',action:'send',recipient:'Farmer1',keep:100,targetCount:200,maxCount:500,batch:10},{...item,name:'Farmer verbraucht HP-Tränke',item:'hpot1',role:'farmer',action:'consume',targetCount:100,maxCount:200,batch:10}];
const bundle=exportBundle(LIVE_DESCRIPTOR,config,runtime);new Script(bundle.code);
await mkdir('dist',{recursive:true});await mkdir('profiles',{recursive:true});
await Promise.all([
 writeFile('dist/albot.js',bundle.code),writeFile('dist/albot.runtime.js',code),writeFile('dist/albot.package.json',JSON.stringify(pkg)),
 writeFile('dist/albot.settings.json',JSON.stringify(LIVE_DESCRIPTOR,null,2)+'\n'),
 writeFile('profiles/full-solo.json',JSON.stringify(solo,null,2)+'\n'),writeFile('profiles/full-team.json',JSON.stringify(envelope(LIVE_DESCRIPTOR,team),null,2)+'\n'),
 writeFile('dist/manifest.json',JSON.stringify({version,schemaId:LIVE_DESCRIPTOR.schemaId,bytes:bundle.bytes,sha256:createHash('sha256').update(bundle.code).digest('hex'),liveTest:'pending',runtimeBytes:Buffer.byteLength(code)},null,2)+'\n')
]);
console.log(JSON.stringify({version,bytes:bundle.bytes,limit:1048576,liveTest:'pending'}));
