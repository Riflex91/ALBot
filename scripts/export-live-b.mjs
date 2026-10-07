import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Script} from 'node:vm';
import {ECONOMY_DESCRIPTOR as descriptor} from '../src/config/live-b.mjs';
import {DESCRIPTOR} from '../editor/lib/schema.mjs';
import {addMissingDefaults,defaultsFor,envelope,exportBundle,validateProfile} from '../editor/lib/contract.mjs';

const [input,destination]=process.argv.slice(2);
if(!input||!destination)throw Error('Aufruf: node scripts/export-live-b.mjs <Live-A-Profil.json> <neuer Ausgabeordner>');
const source=JSON.parse(await readFile(resolve(input),'utf8'));
if(source.schemaId!=='albot.live-a/v1')throw Error('Dieser Übergang erwartet ein Live-A-Profil.');
const base=addMissingDefaults(descriptor.schema,source.config);
const merchant=base.characters.find(c=>c.enabled&&c.role==='merchant'),farmer=base.characters.find(c=>c.enabled&&c.role==='farmer');
if(!merchant||!farmer)throw Error('Mindestens ein Farmer und ein Merchant erforderlich');
base.general.autostart=true;base.production.enabled=false;base.merchant.stand=false;base.merchant.massBuffs=false;
base.merchant.maxSpendPerHour=10000;base.production.lossBudget=5000;base.production.minChance=.95;
const rule=values=>({...defaultsFor(descriptor.schema.properties.items.items),...values});
const personal=(role,action,extra)=>rule({role,action,item:'gslime',name:action+' gslime',targetCount:2,maxCount:2,batch:2,maxActions:1,...extra});
const stage=(name,items,modify=()=>{})=>{const config=structuredClone(base);config.general.name='Live B · '+name;config.items.push(...items);modify(config);return [name,config];};
const stages=[
 stage('01-abholung',[
  personal('farmer','send',{recipient:merchant.name,targetCount:0}),
  personal('merchant','keep',{})
 ]),
 stage('02-bank', [personal('merchant','bank',{pack:'items0',targetCount:0})],c=>{c.merchant.pickup=false;}),
 stage('03-bank-npc',[
  personal('merchant','retrieve',{pack:'items0'}),personal('merchant','sell',{targetCount:0,minPrice:1})
 ],c=>{c.merchant.pickup=false;}),
 stage('04-upgrade-lieferung',[
  rule({name:'Ein Testhelm',role:'merchant',item:'helmet',action:'buy',minLevel:0,maxLevel:0,targetCount:1,maxCount:1,batch:1,maxActions:1,maxPrice:3200,goldBudget:3200}),
  rule({name:'Ein Testscroll',role:'merchant',item:'scroll0',action:'buy',targetCount:1,maxCount:1,batch:1,maxActions:1,maxPrice:1000,goldBudget:1000}),
  rule({name:'Ein Upgrade auf +1',role:'merchant',item:'helmet',action:'upgrade',minLevel:0,maxLevel:0,targetLevel:1,targetCount:1,maxCount:1,batch:1,maxActions:1,scroll:'scroll0',minChance:.95,lossBudget:5000}),
  rule({name:'Testhelm liefern',role:'merchant',item:'helmet',action:'send',minLevel:1,maxLevel:1,targetCount:0,maxCount:1,batch:1,recipient:farmer.name}),
  rule({name:'Testhelm empfangen',role:'farmer',character:farmer.name,item:'helmet',action:'keep',minLevel:1,maxLevel:1,targetCount:1,maxCount:1,batch:1})
 ],c=>{c.production.enabled=true;c.production.upgrade=true;c.merchant.pickup=false;})
];
const pkg=JSON.parse(await readFile(new URL('../dist/albot.package.json',import.meta.url),'utf8'));
await mkdir(resolve(destination)); // Intentionally refuse overwriting a previous test delivery.
const manifest=[];
for(const [name,config] of stages){
 const errors=validateProfile(descriptor,config).concat(validateProfile(DESCRIPTOR,addMissingDefaults(DESCRIPTOR.schema,config)));if(errors.length)throw Error(name+': '+errors.join('; '));
 const bundle=exportBundle(descriptor,config,pkg.runtime);new Script(bundle.code);
 await writeFile(resolve(destination,name+'.json'),JSON.stringify(envelope(descriptor,config),null,2)+'\n');
 await writeFile(resolve(destination,name+'.js'),bundle.code);manifest.push({name,bytes:bundle.bytes,autostart:config.general.autostart});
}
await writeFile(resolve(destination,'albot.package.json'),JSON.stringify(pkg));
await writeFile(resolve(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest));
