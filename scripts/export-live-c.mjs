import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Script} from 'node:vm';
import {DESCRIPTOR} from '../editor/lib/schema.mjs';
import {addMissingDefaults,defaultsFor,envelope,exportBundle,validateProfile,checkPackage} from '../editor/lib/contract.mjs';

const [input,destination,...options]=process.argv.slice(2);
if(!input||!destination||options.some(o=>o!=='--from-live-b-test'))throw Error('Aufruf: node scripts/export-live-c.mjs <Profil oder vollständiger Testbericht.json> <neuer Ausgabeordner> [--from-live-b-test]');
const pkg=await checkPackage(JSON.parse(await readFile(new URL('../dist/albot-live-c.package.json',import.meta.url),'utf8'))),descriptor=pkg.descriptor;
const source=JSON.parse(await readFile(resolve(input),'utf8'));
let value;
if(source.format==='albot-profile'&&['albot.live-a/v1','albot.live-b/v1','albot.live-c/v1','albot.config/v1'].includes(source.schemaId))value=structuredClone(source.config);
else if(source.settings&&source.settings.omittedItemRules===0){value=structuredClone(source.settings);delete value.omittedItemRules;}
else throw Error('Ein gültiges Profil oder ein Testbericht mit allen Item-Regeln ist erforderlich.');
if(value.general?.autoUpdate||value.items?.some(r=>r.recipe))throw Error('Updater und freies Rezeptfeld werden von Live C noch nicht unterstützt.');
delete value.general.autoUpdate;delete value.general.updateChannel;for(const r of value.items??[])delete r.recipe;
const base=addMissingDefaults(descriptor.schema,value);base.general.autostart=true;
const removed=[];
if(options.includes('--from-live-b-test')){
 if(base.general.name!=='Live B · 04-upgrade-lieferung')throw Error('Testbereinigung erwartet das bekannte Live-B-Stufe-04-Profil.');
 const temporary=new Map([['Ein Testhelm','helmet:buy'],['Ein Testscroll','scroll0:buy'],['Ein Upgrade auf +1','helmet:upgrade'],['Testhelm liefern','helmet:send'],['Testhelm empfangen','helmet:keep']]);
 base.items=base.items.filter(r=>{if(temporary.get(r.name)===r.item+':'+r.action){removed.push(r.name);return false;}return true;});
 if(removed.length!==5)throw Error('Die fünf bekannten temporären Live-B-Regeln fehlen oder wurden verändert; keine automatische Bereinigung.');
 base.production.enabled=false;base.production.upgrade=false;
}
const rule=values=>({...defaultsFor(descriptor.schema.properties.rules.items),...values});
const condition=values=>({...defaultsFor(descriptor.schema.properties.rules.items.properties.conditions.items),...values});
const stages=[['01-normalbetrieb',structuredClone(base)],['02-regelwechsel',structuredClone(base)],['03-merchant-nebenaufgabe',structuredClone(base)]];
for(const [name,cfg] of stages){
 cfg.general.name='Live C · '+name;cfg.world.bosses=false;cfg.world.events=false;cfg.world.quests=false;cfg.world.anniversary=false;cfg.world.serverHop=false;cfg.world.magiport=false;cfg.party.selection='fixed';cfg.merchant.fishing=false;cfg.merchant.mining=false;cfg.merchant.merrit=false;cfg.merchant.ponty=false;cfg.merchant.giveaways=false;
 if(name==='02-regelwechsel'){
  if(!cfg.farming.targets.includes('bee'))cfg.farming.targets.push('bee');
  for(const c of cfg.characters.filter(c=>c.enabled&&c.role==='farmer'))if(c.farmTargets.length&&!c.farmTargets.includes('bee'))c.farmTargets.push('bee');
  cfg.rules.push(rule({name:'Live C: gesund zu Bee wechseln',role:'farmer',action:'farm',target:'bee',everyMs:2000,cooldownMs:60000,conditions:[condition({field:'hpRatio',operator:'gte',value:'0.95'}),condition({field:'freeSlots',operator:'gte',value:'6'})]}));
 }
 if(name==='03-merchant-nebenaufgabe'){cfg.merchant.fishing=true;cfg.merchant.massBuffs=false;}
}
if(pkg.runtime.schemaId!==descriptor.schemaId)throw Error('Zuerst den Live-C-Build erzeugen.');
const outputs=[];
for(const [name,cfg] of stages){const errors=validateProfile(descriptor,cfg).concat(validateProfile(DESCRIPTOR,addMissingDefaults(DESCRIPTOR.schema,cfg)));if(errors.length)throw Error(name+': '+errors.join('; '));const bundle=exportBundle(descriptor,cfg,pkg.runtime);new Script(bundle.code);outputs.push({name,cfg,code:bundle.code,bytes:bundle.bytes});}
await mkdir(resolve(destination)); // Refuse overwriting an earlier delivery.
for(const o of outputs){await writeFile(resolve(destination,o.name+'.json'),JSON.stringify(envelope(descriptor,o.cfg),null,2)+'\n');await writeFile(resolve(destination,o.name+'.js'),o.code);}
await writeFile(resolve(destination,'albot.package.json'),JSON.stringify(pkg));
await writeFile(resolve(destination,'manifest.json'),JSON.stringify({version:pkg.runtime.version,autostart:true,removedLiveBTestRules:removed,files:outputs.map(({name,bytes})=>({name,bytes}))},null,2)+'\n');
console.log(JSON.stringify(outputs.map(({name,bytes})=>({name,bytes}))));
