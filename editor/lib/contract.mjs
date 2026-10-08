import { DESCRIPTOR } from './schema.mjs';
export const SLOT_LIMIT = 1048576;
export const SOFT_LIMIT = 921600;
const badKeys = new Set(['__proto__','constructor','prototype']);
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
export function parseData(source) {
  if(new TextEncoder().encode(source).length>8*1024*1024) throw Error('Datei ist größer als 8 MiB.');
  const value=JSON.parse(source); let nodes=0;
  function walk(x,depth){if(++nodes>150000||depth>32)throw Error('Dateistruktur ist zu groß oder zu tief.');if(x&&typeof x==='object')for(const k of Object.keys(x)){if(badKeys.has(k))throw Error('Unzulässiger Datenschlüssel: '+k);walk(x[k],depth+1);}}
  walk(value,0);return value;
}
export function checkDescriptor(d) {
  if(d?.format!=='albot-settings'||d.formatVersion!==1||typeof d.schemaId!=='string'||!d.schemaId.trim())throw Error('Unbekanntes Werkstatt-Schemaformat. Erwartet: albot-settings / 1.');
  let count=0;
  function visit(s,depth){
    if(++count>5000||depth>12||!s||typeof s!=='object'||Array.isArray(s))throw Error('Schema ist zu groß, zu tief oder ungültig.');
    const allowed=['type','title','description','properties','required','additionalProperties','items','default','enum','minimum','maximum','minLength','maxLength','minItems','maxItems','uniqueItems','x-labels','x-catalog'];
    for(const k of Object.keys(s))if(!allowed.includes(k))throw Error('Nicht unterstütztes Schemafeld: '+k);
    if(!['object','array','string','number','integer','boolean'].includes(s.type))throw Error('Nicht unterstützter Feldtyp: '+s.type);
    for(const k of ['title','description','x-catalog'])if(s[k]!==undefined&&(typeof s[k]!=='string'||s[k].length>4000))throw Error('Ungültige Feldbeschreibung.');
    for(const k of ['minimum','maximum','minLength','maxLength','minItems','maxItems'])if(s[k]!==undefined&&(!Number.isFinite(s[k])||(['minLength','maxLength','minItems','maxItems'].includes(k)&&(!Number.isInteger(s[k])||s[k]<0))))throw Error('Ungültige Grenze: '+k);
    for(const [a,b] of [['minimum','maximum'],['minLength','maxLength'],['minItems','maxItems']])if(s[a]!==undefined&&s[b]!==undefined&&s[a]>s[b])throw Error('Umgekehrte Schemagrenzen: '+a);
    if(s.enum&&(!Array.isArray(s.enum)||!s.enum.length||s.enum.length>500||s.enum.some(v=>typeof v!=='string')))throw Error('Ungültige Auswahlliste.');
    if(s['x-labels']&&(typeof s['x-labels']!=='object'||Array.isArray(s['x-labels'])||Object.values(s['x-labels']).some(v=>typeof v!=='string')))throw Error('Ungültige Auswahlnamen.');
    if(s.type==='object'){
      if(!s.properties||typeof s.properties!=='object'||Array.isArray(s.properties)||s.additionalProperties!==false)throw Error('Objekte benötigen properties und additionalProperties:false.');
      if(s.required&&(!Array.isArray(s.required)||s.required.some(k=>!own(s.properties,k))))throw Error('Ungültige Pflichtfelder.');
      for(const [k,v] of Object.entries(s.properties)){if(badKeys.has(k)||!k.length)throw Error('Ungültiger Feldname.');visit(v,depth+1);}
    }
    if(s.type==='array'){if(s.maxItems===undefined||s.maxItems>2000)throw Error('Listen brauchen maxItems ≤ 2000.');visit(s.items,depth+1);}
  }
  visit(d.schema,0);if(d.schema.type!=='object')throw Error('Wurzelschema muss ein Objekt sein.');
  const errors=validateSchema(d.schema,defaultsFor(d.schema));
  // Empty required user text may intentionally need completion, so validate
  // declared scalar defaults separately only when they contain a value.
  if(errors.some(e=>/Typ|unbekannt|Auswahl|endlich/.test(e)))throw Error('Ungültige Schema-Defaults: '+errors.join('; '));
  return d;
}
export function defaultsFor(s){
  if(own(s,'default'))return structuredClone(s.default);
  if(s.type==='object')return Object.fromEntries(Object.entries(s.properties).map(([k,v])=>[k,defaultsFor(v)]));
  if(s.type==='array')return [];
  if(s.type==='boolean')return false;
  if(s.type==='string')return s.enum?.[0]??'';
  return s.minimum??0;
}
export function validateSchema(s,value,path='Profil',errors=[]){
  if(errors.length>=100)return errors;
  const error=m=>errors.push(path+': '+m);
  if(s.type==='object'){
    if(!value||typeof value!=='object'||Array.isArray(value)){error('Objekt erwartet (Typ).');return errors;}
    for(const k of Object.keys(value))if(!own(s.properties,k))error('unbekanntes Feld '+k);
    for(const k of s.required??[])if(!own(value,k))error('Pflichtfeld fehlt: '+k);
    for(const [k,v] of Object.entries(s.properties))if(own(value,k))validateSchema(v,value[k],path+' / '+(v.title||k),errors);
  } else if(s.type==='array'){
    if(!Array.isArray(value)){error('Liste erwartet (Typ).');return errors;}
    if(value.length>(s.maxItems??2000)||value.length<(s.minItems??0))error('Ungültige Anzahl Einträge.');
    if(s.uniqueItems&&new Set(value.map(x=>JSON.stringify(x))).size!==value.length)error('Doppelte Einträge.');
    value.slice(0,2000).forEach((v,i)=>validateSchema(s.items,v,path+' #'+(i+1),errors));
  } else if(s.type==='string'){
    if(typeof value!=='string')error('Text erwartet (Typ).');
    else {if(value.length<(s.minLength??0)||value.length>(s.maxLength??Infinity))error('Textlänge außerhalb der Grenzen.');if(s.enum&&!s.enum.includes(value))error('Unbekannte Auswahl: '+value);}
  } else if(s.type==='boolean'){if(typeof value!=='boolean')error('Ja/Nein erwartet (Typ).');}
  else if(typeof value!=='number'||!Number.isFinite(value))error('Endliche Zahl erwartet (Typ).');
  else {if(s.type==='integer'&&!Number.isSafeInteger(value))error('Ganze sichere Zahl erwartet.');if(value<(s.minimum??-Infinity)||value>(s.maximum??Infinity))error('Zahl außerhalb der Grenzen.');}
  return errors;
}
export function phaseOf(action){return ['buy','marketBuy','wishlist','retrieve','farm'].includes(action)?'acquisition':['upgrade','compound','exchange','craft'].includes(action)?'production':action==='keep'?'all':'inventory';}
export function ruleRank(r){return (r.character?100:0)+(r.role!=='all'?10:0)+['statType','property','title','map','server','task'].filter(k=>r[k]).length+(r.minLevel!==0||r.maxLevel!==99?1:0);}
function overlap(a,b){if(a.action==='send'&&b.action==='send'&&a.recipient&&b.recipient&&a.recipient!==b.recipient)return false;return a.item===b.item&&a.minLevel<=b.maxLevel&&b.minLevel<=a.maxLevel&&(a.role==='all'||b.role==='all'||a.role===b.role)&&['character','statType','property','title','map','server','task'].every(k=>!a[k]||!b[k]||a[k]===b[k])&&(phaseOf(a.action)==='all'||phaseOf(b.action)==='all'||phaseOf(a.action)===phaseOf(b.action));}
function outcome(r){const x={...r};for(const k of ['name','enabled','priority','item','role','character','minLevel','maxLevel','statType','property','title','map','server','task'])delete x[k];return JSON.stringify(x);}
export function validateProfile(descriptor,c){
  const errors=validateSchema(descriptor.schema,c);
  if(errors.length||!['albot.config/v1','albot.p3p4/v1','albot.full/v1'].includes(descriptor.schemaId))return errors;
  // An imported descriptor can ADD v1 fields, but cannot redefine the existing
  // contract while retaining its identity. Project only known fields to check it.
  const known=(s,v)=>s.type==='object'&&v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(s.properties).filter(([k])=>own(v,k)).map(([k,x])=>[k,known(x,v[k])])):s.type==='array'&&Array.isArray(v)?v.map(x=>known(s.items,x)):v;
  const coreErrors=validateSchema(DESCRIPTOR.schema,descriptor.schemaId!=='albot.config/v1'?addMissingDefaults(DESCRIPTOR.schema,known(DESCRIPTOR.schema,c)):known(DESCRIPTOR.schema,c));
  if(coreErrors.length)return coreErrors;
  const names=c.characters.map(x=>x.name);
  if(names.some(n=>!n.trim()||n!==n.trim()))errors.push('Charaktername darf nicht leer sein oder Rand-Leerzeichen enthalten.');
  if(new Set(names).size!==names.length)errors.push('Charakternamen müssen eindeutig sein.');
  const ref=(v,where)=>{if(v&&!names.includes(v))errors.push(where+': unbekannter Charakter '+v);};
  ref(c.party.leader,'Kampf-Leader');ref(c.party.merchant,'Merchant');
  if(c.party.merchant&&!c.characters.some(x=>x.name===c.party.merchant&&x.role==='merchant'&&x.enabled))errors.push('Zuständiger Merchant muss ein aktiver Merchant sein.');
  if(c.general.autostart&&!c.characters.some(x=>x.enabled))errors.push('Autostart benötigt mindestens einen aktiven Charakter.');
  if(c.farming.restBelow>=c.farming.resumeAbove)errors.push('Farmer: Weiter-Schwelle muss über Ruhe-Schwelle liegen.');
  if(c.merchant.expandBank&&c.merchant.bankBudget<=0)errors.push('Bankerweiterung benötigt ein positives Budget.');
  for(const [i,r] of c.items.entries()){
    const p='Item-Regel '+(i+1)+' ('+r.name+')';ref(r.character,p);ref(r.recipient,p);
    if(!/^[a-zA-Z0-9_]+$/.test(r.item))errors.push(p+': ungültige Item-ID.');
    if(r.minLevel>r.maxLevel)errors.push(p+': Levelbereich ist umgekehrt.');
    if(r.keep+r.teamReserve>r.maxCount||r.targetCount>r.maxCount||r.targetCount<r.keep+r.teamReserve)errors.push(p+': Reserve ≤ Zielbestand ≤ Maximalbestand erforderlich.');
    if((r.requestBelow??0)>0&&r.requestBelow>r.targetCount)errors.push(p+': Nachschubschwelle darf nicht über dem Zielbestand liegen.');
    if(r.enabled&&r.action==='send'&&!r.recipient)errors.push(p+': Lieferempfänger fehlt.');
    if(r.enabled&&r.action==='send'&&r.character&&r.recipient===r.character)errors.push(p+': Lieferung an sich selbst.');
    if(r.enabled&&['list','equip'].includes(r.action)&&!r.slot)errors.push(p+': Slot fehlt.');
    if(r.enabled&&r.action==='list'&&!/^trade([1-9]|1[0-6])$/.test(r.slot))errors.push(p+': Stand-Slot trade1 bis trade16 erforderlich.');
    if(r.enabled&&['upgrade','compound'].includes(r.action)&&r.targetLevel<=r.minLevel)errors.push(p+': Ziellevel muss größer als Startlevel sein.');
  }
  const active=c.items.filter(r=>r.enabled);
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)if(ruleRank(active[i])===ruleRank(active[j])&&active[i].priority===active[j].priority&&overlap(active[i],active[j])&&outcome(active[i])!==outcome(active[j]))errors.push('Regelkonflikt: „'+active[i].name+'“ / „'+active[j].name+'“. Priorität oder Filter unterscheiden.');
  for(const r of [...c.skills,...c.rules]){
    ref(r.character,r.name);
    if(r.enabled&&own(r,'match')&&!r.conditions.length)errors.push(r.name+': mindestens eine Wenn-Bedingung erforderlich.');
    for(const x of r.conditions){if(!['map','task','rip'].includes(x.field)&&!Number.isFinite(Number(x.value)))errors.push(r.name+': Vergleichswert muss eine Zahl sein.');if(x.field==='rip'&&!['true','false'].includes(x.value))errors.push(r.name+': Tot-Wert muss true oder false sein.');if(['map','task','rip'].includes(x.field)&&!['eq','neq'].includes(x.operator))errors.push(r.name+': für Text/Ja-Nein nur Gleich/Ungleich verwenden.');if(x.field==='itemCount'&&!x.item)errors.push(r.name+': Item-ID in Bedingung fehlt.');}
  }
  for(const g of c.production.goals)ref(g.recipient,g.name);
  const targetKeys=new Set();for(const g of c.production.gearTargets??[]){
    ref(g.character,g.name);const key=g.character+':'+g.slot;
    if(g.enabled&&targetKeys.has(key))errors.push(g.name+': doppeltes Ausrüstungsziel für '+key);if(g.enabled)targetKeys.add(key);
    if(!/^[a-zA-Z0-9_]+$/.test(g.item)||!['mainhand','offhand','helmet','chest','pants','shoes','gloves','cape','belt','amulet','orb','ring1','ring2','earring1','earring2','elixir'].includes(g.slot))errors.push(g.name+': ungültiges Item oder Equipment-Slot.');
    if(g.enabled&&!c.characters.some(x=>x.name===g.character&&x.enabled))errors.push(g.name+': Zielcharakter muss aktiviert sein.');
  }
  return [...new Set(errors)].slice(0,100);
}
export function resolveItem(c,query){
  if(query.locked||query.equipped||query.reserved)return {rule:null,reason:'Itemschutz: gesperrt, ausgerüstet oder reserviert.',quantity:0,candidates:[]};
  const rows=c.items.map((r,index)=>({r,index})).filter(({r})=>r.enabled&&r.item===query.item&&query.level>=r.minLevel&&query.level<=r.maxLevel&&(r.role==='all'||r.role===query.role)&&['character','statType','property','title','map','server','task'].every(k=>!r[k]||r[k]===query[k])&&(phaseOf(r.action)==='all'||phaseOf(r.action)===query.phase));
  rows.sort((a,b)=>ruleRank(b.r)-ruleRank(a.r)||b.r.priority-a.r.priority||a.index-b.index);
  const r=rows[0]?.r;
  return {rule:r??null,candidates:rows.map(x=>({name:x.r.name,rank:ruleRank(x.r),priority:x.r.priority})),reason:r?'„'+r.name+'“ gewinnt: Spezifität '+ruleRank(r)+', Priorität '+r.priority+'. Explizite Regel vor automatischer Zielplanung.':c.production?.enabled&&c.production.autonomy?'Keine explizite Regel. Ein konfiguriertes Ziel kann beim tatsächlichen Bedarf eine begrenzte Regel ableiten; diese Vorschau führt keinen Produktionsplan aus.':'Keine passende Regel: behalten.',quantity:!r||r.action==='keep'?0:Math.max(0,Math.min(r.batch,(query.quantity??0)-r.keep-r.teamReserve))};
}
export function envelope(descriptor,config){return {format:'albot-profile',formatVersion:1,schemaId:descriptor.schemaId,config};}
export function addMissingDefaults(schema,value,path='',changes=[]){
  if(schema.type==='object'&&value&&typeof value==='object'&&!Array.isArray(value)){
    const next=structuredClone(value);
    for(const [key,s] of Object.entries(schema.properties)){
      if(!own(next,key)){next[key]=defaultsFor(s);changes.push((path?path+'.':'')+key);}
      else next[key]=addMissingDefaults(s,next[key],(path?path+'.':'')+key,changes);
    }
    return next;
  }
  if(schema.type==='array'&&Array.isArray(value))return value.map((x,i)=>addMissingDefaults(schema.items,x,path+'['+i+']',changes));
  return structuredClone(value);
}
export function importProfile(descriptor,value){
  if(value?.format!=='albot-profile'||value.formatVersion!==1)throw Error('Kein Super-Bot-Profil. Alte Generatorprofile bleiben in der klassischen Werkstatt nutzbar.');
  if(['albot.p3p4/v1','albot.full/v1'].includes(descriptor.schemaId)&&value.schemaId!==descriptor.schemaId&&['albot.live-a/v1','albot.live-b/v1','albot.live-c/v1','albot.config/v1','albot.p3p4/v1'].includes(value.schemaId)){
    const config=structuredClone(value.config);if(config.general?.autoUpdate)throw Error('Aktiver Updater gehört nicht zu P3/P4; im bisherigen Profil ausdrücklich deaktivieren.');delete config.general.autoUpdate;delete config.general.updateChannel;
    const next=addMissingDefaults(descriptor.schema,config),errors=validateProfile(descriptor,next);if(errors.length)throw Error(errors.join('\n'));return next;
  }
  if(value.schemaId!==descriptor.schemaId)throw Error('Profil benötigt das Schema '+value.schemaId+'. Zuerst passendes Bot-Paket / Schema laden.');
  const next=descriptor.schemaId==='albot.full/v1'?addMissingDefaults(descriptor.schema,value.config):value.config;const errors=validateProfile(descriptor,next);if(errors.length)throw Error(errors.join('\n'));return structuredClone(next);
}
export function exportBundle(descriptor,config,runtime){
  const errors=validateProfile(descriptor,config);if(errors.length)throw Error(errors.join('\n'));
  if(!runtime||runtime.schemaId!==descriptor.schemaId||runtime.contractVersion!==1)throw Error('Passendes fertiges Bot-Paket fehlt. JSON-Profil kann bereits gespeichert werden.');
  // Store field names once, rather than repeating dozens of names for every
  // item. The tiny decoder reconstructs the EXACT ordinary config object.
  function shape(s){return s.type==='object'?{keys:Object.keys(s.properties),children:Object.values(s.properties).map(shape)}:s.type==='array'?{item:shape(s.items)}:null;}
  function encode(t,v){if(!t)return v;if(own(t,'item'))return v.map(x=>encode(t.item,x));const missing=t.keys.map((k,i)=>own(v,k)?-1:i).filter(i=>i>=0);return [missing,t.keys.map((k,i)=>own(v,k)?encode(t.children[i],v[k]):null)];}
  function unpack(t,v){if(!t)return v;if(Object.prototype.hasOwnProperty.call(t,'item'))return v.map(x=>unpack(t.item,x));return Object.fromEntries(t.keys.flatMap((k,i)=>v[0].includes(i)?[]:[[k,unpack(t.children[i],v[1][i])]]));}
  const template=shape(descriptor.schema),safe=x=>JSON.stringify(x).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  const code='// ALBot '+runtime.version+' | Einstellungen + Runtime\n'+'globalThis.ALBotConfig=('+unpack.toString()+')('+safe(template)+','+safe(encode(template,config))+');\n'+runtime.code+'\n';
  const bytes=new TextEncoder().encode(code).length;
  if(bytes>SLOT_LIMIT)throw Error('Bot inklusive Einstellungen zu groß: '+bytes+' / '+SLOT_LIMIT+' UTF-8-Bytes.');
  return {code,bytes};
}
export async function checkPackage(data){
  if(data?.format!=='albot-package'||data.formatVersion!==1)throw Error('Bot-Paketformat unbekannt.');
  checkDescriptor(data.descriptor);const r=data.runtime;
  if(!r||r.contractVersion!==1||r.schemaId!==data.descriptor.schemaId||typeof r.code!=='string'||!r.code.trim()||typeof r.version!=='string'||!/^[a-zA-Z0-9.+_-]{1,80}$/.test(r.version)||!/^[a-f0-9]{64}$/.test(r.sha256??''))throw Error('Runtime-Vertrag oder Versions-/Hashangabe ungültig.');
  if(new TextEncoder().encode(r.code).length>SLOT_LIMIT)throw Error('Runtime überschreitet bereits das CODE-Limit.');
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.code));
  if(Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')!==r.sha256)throw Error('Bot-Paket ist beschädigt: SHA-256 stimmt nicht.');
  return data;
}
