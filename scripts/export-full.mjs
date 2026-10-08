import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Script} from 'node:vm';
import {checkPackage,importProfile,defaultsFor,validateProfile,envelope,exportBundle} from '../editor/lib/contract.mjs';
const [input,destination,clientConfig]=process.argv.slice(2);if(!input||!destination)throw Error('node scripts/export-full.mjs Profil.json NEUER-Ordner [Client-config.json]');
const pkg=await checkPackage(JSON.parse(await readFile(new URL('../dist/albot.package.json',import.meta.url),'utf8'))),d=pkg.descriptor;if(d.schemaId!=='albot.full/v1')throw Error('Zuerst Vollbetrieb bauen.');
const cfg=importProfile(d,JSON.parse(await readFile(resolve(input),'utf8')));cfg.general.name='Super-Bot · gemeinsamer Vollbetrieb';cfg.general.autostart=cfg.general.testLogging=true;
// Explicitly replace the old staged export's two artificial Goo test rules.
cfg.items=cfg.items.filter(r=>!['Test: ein Goo-Item abholen','Test: ein Goo-Item empfangen'].includes(r.name));
if(clientConfig){const client=JSON.parse(await readFile(resolve(clientConfig),'utf8'));for(const c of client.characters){if(cfg.characters.some(x=>x.name===c.name))continue;const cls=c.name.toLowerCase().match(/(ranger|priest|rogue|mage|warrior|paladin|merchant)/)?.[1]??'auto';cfg.characters.push({...defaultsFor(d.schema.properties.characters.items),name:c.name,role:cls==='merchant'?'merchant':'farmer',class:cls,region:c.region,server:c.server,group:cfg.party.group,catchUp:true});}}
const merchant=cfg.characters.find(c=>c.enabled&&c.role==='merchant'&&c.name===cfg.party.merchant),farmers=cfg.characters.filter(c=>c.enabled&&c.role==='farmer');if(!merchant||!farmers.length)throw Error('Merchant und Farmer erforderlich.');
cfg.party.selection='adaptive';cfg.party.gearSynergy=cfg.party.advancedSkills=true;
cfg.farming.targets=[...new Set([...cfg.farming.targets,'goo','bee','spider'])];
Object.assign(cfg.merchant,{enabled:true,pickup:true,supply:true,mluck:true,massBuffs:true,stand:true,bank:true,consolidate:true,partialBank:true,bankGold:true,collectGold:true,bankReclaim:true,expandBank:true,bankBudget:200000,maxSpendPerHour:200000,ponty:true,giveaways:true,merrit:true,fishing:true,mining:true,marketHistory:true});
cfg.merchant.position.enabled=false;
Object.assign(cfg.production,{enabled:true,autonomy:true,upgrade:true,compound:true,craft:true,exchange:true,gear:true,autoGear:true,minChance:.9,lossBudget:150000,helperMaxPrice:30000,autoGearBudget:15000,autoGearMaxLevel:3,acquireBy:['bank','npc','market','farm','craft','exchange']});
Object.assign(cfg.world,{bosses:true,events:true,quests:true,anniversary:true,serverHop:true,magiport:true,learning:true,risk:'conservative'});
cfg.world.allowedBosses=[...new Set([...cfg.world.allowedBosses,'phoenix','jr','greenjr','goldenbat','snowman'])];cfg.world.allowedEvents=[...new Set([...cfg.world.allowedEvents,'snowman','pinkgoo','wabbit','mrpumpkin','mrgreen'])];
cfg.world.allowedRealms=[...new Set([...cfg.world.allowedRealms,...cfg.characters.map(c=>c.region+c.server)])];
const base=defaultsFor(d.schema.properties.items.items),add=r=>{const collision=cfg.items.some(x=>x.enabled&&x.item===r.item&&(x.role==='all'||x.role===r.role)&&(!x.character||!r.character||x.character===r.character)&&x.action!=='send');if(collision)throw Error('Bestehende '+r.item+'-Regel prüfen; Export ersetzt sie nicht.');cfg.items.push({...base,...r});};
for(const potion of ['hpot0','mpot0']){
 const farmerRule=cfg.items.find(r=>r.item===potion&&r.role==='farmer'&&r.action==='consume');if(!farmerRule)continue;
 for(const farmer of farmers)if(!cfg.items.some(r=>r.item===potion&&r.role==='merchant'&&r.action==='send'&&r.recipient===farmer.name)){const template=cfg.items.find(r=>r.item===potion&&r.role==='merchant'&&r.action==='send');if(template)cfg.items.push({...template,name:'Versorgung '+potion+' → '+farmer.name,recipient:farmer.name});}
 add({name:'Merchant-Nachkauf '+potion,item:potion,role:'merchant',action:'buy',priority:9000,targetCount:5000,requestBelow:1500,maxCount:8000,batch:1000,maxPrice:50,goldBudget:50000});
}
add({name:'Goo-Überschuss zum Merchant',item:'gslime',role:'farmer',action:'send',recipient:merchant.name,keep:5,targetCount:100,maxCount:9999,batch:100});
add({name:'Exchange freigeben',item:'gem1',role:'merchant',action:'exchange',targetCount:100,maxCount:100,batch:1});
add({name:'Exchange-Beute abgeben',item:'gem1',role:'farmer',action:'send',recipient:merchant.name,targetCount:100,maxCount:9999,batch:10});
add({name:'Carrot-Überschuss verkaufen',item:'carrot',role:'merchant',action:'sell',targetCount:100,maxCount:9999,batch:100,minPrice:1});
add({name:'Carrot-Beute abgeben',item:'carrot',role:'farmer',action:'send',recipient:merchant.name,targetCount:100,maxCount:9999,batch:100});
add({name:'Goo anbieten, übrigen Vorrat einlagern',item:'gslime',role:'merchant',action:'list',fallback:'bank',priority:100,keep:10,targetCount:100,maxCount:9999,batch:10,slot:'trade1',minPrice:10000});
add({name:'Kaufgesuch Beewings',item:'beewings',role:'merchant',action:'wishlist',slot:'trade2',targetCount:1,maxCount:1,batch:1,maxPrice:100,goldBudget:100});
add({name:'Spieler/Ponty-Suche Whiteegg',item:'whiteegg',role:'merchant',action:'marketBuy',targetCount:1,maxCount:1,batch:1,maxPrice:100,goldBudget:100});
if(!cfg.production.goals.length)cfg.production.goals=[{...defaultsFor(d.schema.properties.production.properties.goals.items),name:'Arbeitsvorrat STR-Ring +1',item:'strring',level:1,quantity:1,budget:160000,priority:20}];
const errors=validateProfile(d,cfg);if(errors.length)throw Error(errors.join('\n'));const bundle=exportBundle(d,cfg,pkg.runtime);new Script(bundle.code);
await mkdir(resolve(destination));await mkdir(resolve(destination,'docs'));
await writeFile(resolve(destination,'bot.js'),bundle.code);await writeFile(resolve(destination,'albot-profile.json'),JSON.stringify(envelope(d,cfg),null,2)+'\n');await writeFile(resolve(destination,'albot.package.json'),JSON.stringify(pkg));
await writeFile(resolve(destination,'manifest.json'),JSON.stringify({version:pkg.runtime.version,bytes:bundle.bytes,liveTest:'pending',autostart:true,oneCombinedProfile:true},null,2)+'\n');
const workshop=await readFile(new URL('../editor/Bot-Werkstatt.html',import.meta.url),'utf8');await writeFile(resolve(destination,'Bot-Werkstatt.html'),workshop.replace('const INITIAL_PROFILE=null;','const INITIAL_PROFILE='+JSON.stringify(cfg).replace(/</g,'\\u003c')+';'));
await copyFile(new URL('../docs/VOLLBETRIEB.md',import.meta.url),resolve(destination,'START-HIER.md'));await copyFile(new URL('../HOW-TO-USE.md',import.meta.url),resolve(destination,'HOW-TO-USE.md'));
console.log(JSON.stringify({version:pkg.runtime.version,bytes:bundle.bytes,characters:cfg.characters.map(c=>c.name),file:'bot.js'}));
