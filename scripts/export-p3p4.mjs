import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Script} from 'node:vm';
import {checkPackage,importProfile,defaultsFor,validateProfile,envelope,exportBundle} from '../editor/lib/contract.mjs';
const [input,destination]=process.argv.slice(2);
if(!input||!destination)throw Error('node scripts/export-p3p4.mjs <Profil.json> <neuer Ausgabeordner>');
const pkg=await checkPackage(JSON.parse(await readFile(new URL('../dist/albot-p3p4.package.json',import.meta.url),'utf8'))),d=pkg.descriptor;
if(d.schemaId!=='albot.p3p4/v1')throw Error('Zuerst P3/P4 bauen.');
const base=importProfile(d,JSON.parse(await readFile(resolve(input),'utf8')));base.general.autostart=true;
const merchant=base.characters.find(c=>c.enabled&&c.role==='merchant'&&c.name===base.party.merchant),farmer=base.characters.find(c=>c.enabled&&c.role==='farmer');if(!merchant||!farmer)throw Error('Zuständiger Merchant und Farmer erforderlich.');
const rule=values=>({...defaultsFor(d.schema.properties.items.items),...values});
const goal=values=>({...defaultsFor(d.schema.properties.production.properties.goals.items),...values});
const stages=['01-versorgung','02-bank','03-handel','04-produktion','05-gear','06-nebenaufgaben','07-wiederanlauf'];
const outputs=[];
for(const name of stages){
 const cfg=structuredClone(base);cfg.general.name='P3/P4 · '+name;
 cfg.world.serverHop=false;cfg.world.magiport=false;cfg.party.selection='fixed';cfg.merchant.fishing=cfg.merchant.mining=cfg.merchant.merrit=cfg.merchant.ponty=cfg.merchant.giveaways=false;
 cfg.merchant.bankGold=cfg.merchant.consolidate=cfg.merchant.expandBank=false;cfg.merchant.partialBank=false;cfg.merchant.position.enabled=false;
 cfg.production.enabled=cfg.production.autonomy=cfg.production.gear=cfg.production.upgrade=cfg.production.compound=cfg.production.craft=cfg.production.exchange=false;cfg.production.goals=[];cfg.production.gearTargets=[];
 const add=r=>{if(cfg.items.some(x=>x.enabled&&x.item===r.item&&(x.role==='all'||x.role===r.role)&&(!x.character||!r.character||x.character===r.character)))throw Error(name+': vorhandene Regel für '+r.item+' kollidiert mit Beispiel. Eigenes Profil in der Werkstatt erstellen; Quelle wird nicht verändert.');cfg.items.push(rule(r));};
 const mr=values=>({role:'merchant',character:merchant.name,priority:10000,batch:1,maxActions:1,...values});
 if(name==='01-versorgung'){
  cfg.merchant.pickup=true;add({name:'Test: ein Goo-Item abholen',item:'gslime',role:'farmer',action:'send',recipient:merchant.name,batch:1,targetCount:1,maxCount:100000});add(mr({name:'Test: ein Goo-Item empfangen',item:'gslime',action:'keep',targetCount:1,maxCount:1}));
 }
 if(name==='02-bank'){
  cfg.merchant.partialBank=cfg.merchant.bank=true;cfg.merchant.partialBankMaxStack=9999;
  add(mr({name:'Test: ein Goo-Item entnehmen',item:'gslime',action:'retrieve',targetCount:1,maxCount:1,pack:'items0'}));
  cfg.items.push(rule(mr({name:'Test: ein Goo-Item zurücklegen',item:'gslime',action:'bank',targetCount:1,maxCount:1,pack:'items0'})));
 }
 if(name==='03-handel'){
  cfg.merchant.stand=true;cfg.merchant.merrit=true;cfg.merchant.giveaways=true;cfg.merchant.ponty=true;
  add(mr({name:'Test: ein Goo-Item anbieten',item:'gslime',action:'list',slot:'trade1',targetCount:1,maxCount:1,minPrice:10000}));
  add(mr({name:'Test: NPC-Verkauf',item:'carrot',action:'sell',targetCount:1,maxCount:1,minPrice:1}));
  add(mr({name:'Test: Spieler-/Ponty-Kauf',item:'whiteegg',action:'marketBuy',targetCount:1,maxCount:1,maxPrice:100,goldBudget:100}));
  add(mr({name:'Test: Kaufgesuch',item:'beewings',action:'wishlist',slot:'trade2',targetCount:1,maxCount:1,maxPrice:100,goldBudget:100}));
 }
 if(['04-produktion','05-gear','06-nebenaufgaben','07-wiederanlauf'].includes(name)){
  cfg.production.enabled=cfg.production.autonomy=true;cfg.production.acquireBy=['bank','npc','craft'];cfg.production.minChance=.9;cfg.production.lossBudget=150000;cfg.production.helperMaxPrice=30000;cfg.merchant.maxSpendPerHour=200000;
 }
 if(name==='04-produktion'){
  cfg.production.upgrade=cfg.production.compound=cfg.production.craft=cfg.production.exchange=true;
  cfg.production.goals=[goal({name:'Test: ein Helm +1',item:'helmet',level:1,budget:15000,priority:30}),goal({name:'Test: ein STR-Ring +1',item:'strring',level:1,budget:160000,priority:20}),goal({name:'Test: ein Werkzeug herstellen',item:'rod',budget:10000,priority:10})];
  add(mr({name:'Test: einmal Exchange',item:'gem1',action:'exchange',targetCount:1,maxCount:1}));
 }
 if(name==='05-gear'){
  cfg.production.gear=cfg.production.upgrade=true;
  cfg.production.gearTargets=[{...defaultsFor(d.schema.properties.production.properties.gearTargets.items),name:'Test: Farmer-Helm',character:farmer.name,slot:'helmet',item:'helmet',level:1,budget:15000}];
 }
 if(['06-nebenaufgaben','07-wiederanlauf'].includes(name)){cfg.production.craft=true;cfg.production.acquireBy=['bank','npc','craft','farm'];cfg.merchant.fishing=cfg.merchant.mining=true;cfg.merchant.toolBudget=10000;}
 const errors=validateProfile(d,cfg);if(errors.length)throw Error(name+': '+errors.join('; '));const bundle=exportBundle(d,cfg,pkg.runtime);new Script(bundle.code);outputs.push({name,cfg,...bundle});
}
await mkdir(resolve(destination)); // Existing releases are never overwritten.
for(const o of outputs){await writeFile(resolve(destination,o.name+'.js'),o.code);await writeFile(resolve(destination,o.name+'.json'),JSON.stringify(envelope(d,o.cfg),null,2)+'\n');}
await writeFile(resolve(destination,'albot.package.json'),JSON.stringify(pkg));
await writeFile(resolve(destination,'manifest.json'),JSON.stringify({version:pkg.runtime.version,liveTest:'pending',autostart:true,files:outputs.map(({name,bytes})=>({name,bytes}))},null,2)+'\n');
await copyFile(new URL('../editor/Bot-Werkstatt.html',import.meta.url),resolve(destination,'Bot-Werkstatt.html'));
await copyFile(new URL('../docs/P3-P4-LIVE.md',import.meta.url),resolve(destination,'START-HIER.md'));
await copyFile(new URL('../HOW-TO-USE.md',import.meta.url),resolve(destination,'HOW-TO-USE.md'));
console.log(JSON.stringify(outputs.map(({name,bytes})=>({name,bytes}))));
