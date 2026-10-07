import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Script} from 'node:vm';
import {defaultsFor,addMissingDefaults,checkPackage,validateProfile,envelope,exportBundle} from '../editor/lib/contract.mjs';
const [input,destination]=process.argv.slice(2);
if(!input||!destination)throw Error('Aufruf: node scripts/export-merchant.mjs <C-Profil.json> <neuer Ausgabeordner>');
const pkg=await checkPackage(JSON.parse(await readFile(new URL('../dist/albot-merchant.package.json',import.meta.url),'utf8'))),descriptor=pkg.descriptor;
const source=JSON.parse(await readFile(resolve(input),'utf8'));
if(source.format!=='albot-profile'||source.schemaId!==descriptor.schemaId)throw Error('Passendes C-Profil erforderlich.');
const base=addMissingDefaults(descriptor.schema,source.config);base.general.autostart=true;
const merchant=base.characters.find(c=>c.enabled&&c.role==='merchant'&&c.name===base.party.merchant);if(!merchant)throw Error('Aktiver zuständiger Merchant fehlt.');
const profiles=[['bot',structuredClone(base)],['bank-teilentnahme',structuredClone(base)],['merrit',structuredClone(base)]];
const rule=values=>({...defaultsFor(descriptor.schema.properties.items.items),...values});
for(const [name,cfg] of profiles){
 cfg.general.name='Merchant-Ergänzungen · '+name;
 if(name!=='bot'){
  if(cfg.items.some(r=>r.enabled&&r.item==='gslime'&&(!r.character||r.character===merchant.name)&&['merchant','all'].includes(r.role)))throw Error('Vorhandene Merchant-gslime-Regeln kollidieren mit dem Beispieltest. Im Editor ein anderes Testitem wählen; Nutzerregeln bleiben erhalten.');
  cfg.merchant.fishing=false;cfg.merchant.mining=false;cfg.merchant.merrit=false;cfg.merchant.ponty=false;cfg.merchant.giveaways=false;cfg.merchant.position.enabled=false;cfg.merchant.bankGold=false;cfg.merchant.consolidate=false;cfg.merchant.expandBank=false;cfg.production.enabled=false;cfg.merchant.partialBank=false;
 }
 if(name==='bank-teilentnahme'){
  cfg.merchant.bank=true;cfg.merchant.partialBank=true;cfg.merchant.partialBankMaxStack=9999;cfg.merchant.stand=false;
  cfg.items.push(rule({name:'Test: ein Goo-Item aus Bankstapel',item:'gslime',role:'merchant',character:merchant.name,action:'retrieve',pack:'items0',targetCount:1,maxCount:1,batch:1,maxActions:1,priority:10000}));
 }
 if(name==='merrit'){
  cfg.merchant.merrit=true;cfg.merchant.stand=true;
  cfg.items.push(rule({name:'Test: ein Goo-Item als Merrit-Angebot',item:'gslime',role:'merchant',character:merchant.name,action:'list',slot:'trade1',keep:0,targetCount:1,maxCount:1,batch:1,maxActions:1,minPrice:10000,priceSource:'fixed',priority:10000}));
 }
 const errors=validateProfile(descriptor,cfg);if(errors.length)throw Error(name+': '+errors.join('; '));
}
const outputs=profiles.map(([name,cfg])=>{const bundle=exportBundle(descriptor,cfg,pkg.runtime);new Script(bundle.code);return {name,cfg,...bundle};});
await mkdir(resolve(destination));
for(const {name,cfg,code} of outputs){await writeFile(resolve(destination,name+'.js'),code);await writeFile(resolve(destination,name+'.json'),JSON.stringify(envelope(descriptor,cfg),null,2)+'\n');}
await writeFile(resolve(destination,'albot.package.json'),JSON.stringify(pkg));
await writeFile(resolve(destination,'manifest.json'),JSON.stringify({version:pkg.runtime.version,autostart:true,files:outputs.map(({name,bytes})=>({name,bytes}))},null,2)+'\n');
console.log(JSON.stringify(outputs.map(({name,bytes})=>({name,bytes}))));
