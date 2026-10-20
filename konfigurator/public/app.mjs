import {defaultPolicy,validatePolicyDocument,previewGlobalItem} from './policy.mjs';
import {DASHBOARD_REFRESH_MS,SNAPSHOT_FRESH_MS} from './free-tier.mjs';

const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e;};
const state={view:'dashboard',policy:{version:1,items:[]},sha:null,configured:false,dirty:false,saving:false,
 characters:[],bank:[],catalog:[],health:null,filter:'',selected:null,loaded:false,error:''};
const fmt=x=>typeof x==='number'&&Number.isFinite(x)?new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(x):'—';
const age=t=>!Number.isFinite(t)?'unbekannt':Math.max(0,Math.floor((Date.now()-t)/1000))+' s';
const fresh=t=>Number.isFinite(t)&&Date.now()-t<SNAPSHOT_FRESH_MS;
const itemName=id=>state.catalog.find(x=>x.id===id)?.name??id;
const sourceNote='Die Daten sind ausschließlich zur Ansicht bestimmt. Bank-Snapshots sind keine Berechtigung, Items zu verkaufen.';
const content=$('content');
let toastTimer=null;
function toast(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),5500);}
function heading(title,subtitle){const h=node('div',undefined,'heading'),wrap=node('div');wrap.append(node('h1',title),node('p',subtitle));h.append(wrap);return h;}
function card(title){const c=node('section',undefined,'card');if(title)c.append(node('h2',title));return c;}
function pill(label,kind=''){return node('span',label,'pill '+kind);}
function empty(title,description){const e=node('div',undefined,'empty');e.append(node('strong',title),node('span',description));return e;}
function labelField(text,value,min,max,type='number'){
 const l=node('label',undefined,'field'),title=node('span',text),input=node('input');input.type=type;
 if(type==='number'){input.min=min;input.max=max;input.step='1';}
 input.value=value??'';l.append(title,input);return {label:l,input};
}
function metric(title,value,foot){const c=card();c.classList.add('metric');c.append(node('div',title,'label'),node('div',value,'value'),node('div',foot,'foot'));return c;}
function notice(text,info=false){return node('div',text,'notice'+(info?' info':''));}
function markDirty(){state.dirty=true;const s=$('saved-state');s.textContent='Ungespeicherte Änderungen';$('save').disabled=false;}
function setSaveState(){const s=$('saved-state');s.textContent=state.dirty?'Ungespeicherte Änderungen':
 state.loaded?'GitHub-Stand geladen (nicht im Spiel aktiv)':'GitHub nicht verbunden';$('save').disabled=!state.dirty||state.saving||!state.configured;}
async function api(path,init={}){
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...init});
 let body;try{body=await response.json();}catch{throw Error('Unerwartete Serverantwort');}
 if(!response.ok)throw Error(body.error??'HTTP '+response.status);
 return body;
}
async function bootstrap(){
 const [health,policy,chars,bank,catalog]=await Promise.allSettled([
  api('/api/health'),api('/api/policy'),api('/api/characters'),api('/api/bank'),
  api('/api/catalog')]);
 if(health.status==='fulfilled')state.health=health.value;
 if(policy.status==='fulfilled'){
  state.policy=policy.value.document;
  state.sha=policy.value.sha;
  state.configured=true;state.loaded=true;state.dirty=false;
 }else state.error=String(policy.reason?.message??policy.reason);
 if(chars.status==='fulfilled')state.characters=chars.value.rows??[];
 if(bank.status==='fulfilled')state.bank=bank.value.rows??[];
 if(catalog.status==='fulfilled')state.catalog=catalog.value.items??[];
 $('connection').textContent=state.configured?'● GitHub verbunden':'● Einrichtung ausstehend';
 $('connection').style.color=state.configured?'#64d9b3':'#f1bf71';
 setSaveState();render();
}
let refreshingLive=false;
async function refreshLive(){
 if(document.visibilityState==='hidden'||refreshingLive)return;
 refreshingLive=true;
 try{
 const [chars,bank]=await Promise.allSettled([api('/api/characters'),api('/api/bank')]);
 if(chars.status==='fulfilled')state.characters=chars.value.rows??[];
 if(bank.status==='fulfilled')state.bank=bank.value.rows??[];
 if(['dashboard','characters','bank'].includes(state.view))render();
 }finally{refreshingLive=false;}
}
function save(){
 if(!state.configured||state.saving||!state.dirty)return;
 const errors=validatePolicyDocument(state.policy);
 if(errors.length){toast(errors.join(' · '));return;}
 state.saving=true;setSaveState();$('save').textContent='Speichere …';
 api('/api/policy',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({
  sha:state.sha,document:state.policy
 })}).then(r=>{
  state.sha=r.sha;state.dirty=false;
  toast('Auf GitHub gespeichert. Änderungen sind noch nicht im Spiel angewendet.');
  setSaveState();
 }).catch(e=>{toast('Speichern fehlgeschlagen: '+e.message);setSaveState();})
 .finally(()=>{state.saving=false;$('save').textContent='Konfiguration speichern';setSaveState();});
}
function table(headers){
 const wrap=node('div',undefined,'table-wrap'),t=node('table',undefined,'table'),head=node('thead'),tr=node('tr');
 for(const x of headers)tr.append(node('th',x));head.append(tr);const body=node('tbody');t.append(head,body);wrap.append(t);return {wrap,body};
}
function addRow(body,cells){const tr=node('tr');for(const c of cells){const td=node('td');td.append(c instanceof Node?c:node('span',c));tr.append(td);}body.append(tr);return tr;}
function dashboard(){
 content.append(heading('Dashboard','Status deiner ALBot-Charaktere, Bank und Konfiguration.'));
 if(!state.configured)content.append(notice('Cloudflare Access und der private GitHub-Konfigurationsspeicher sind noch nicht verbunden. Bis zur Einrichtung bleibt die Weboberfläche read-only.'));
 const online=state.characters.filter(x=>fresh(x.observedAt)&&x.hp>0);
 const measured=state.characters.filter(x=>fresh(x.observedAt)&&x.ratesMeasured!==false);
 const gold=measured.reduce((n,x)=>n+(Number(x.goldPerHour)||0),0);
 const metrics=node('div',undefined,'grid metrics');metrics.append(
  metric('Charaktere online',online.length+' / '+state.characters.length,'Status jünger als 5 Minuten'),
  metric('Gold pro Stunde',measured.length?fmt(gold):'—','Nur gemessene, frische Charakterdaten'),
  metric('Bankfächer',fmt(state.bank.length),'Letzte beobachtete Snapshots'),
  metric('Itemrichtlinien',fmt(state.policy.items.length),'GitHub · nicht automatisch aktiviert'));content.append(metrics);
 const grid=node('div',undefined,'grid two'),one=card('Aktivitätsübersicht'),two=card('Sicherheit & Synchronisierung');
 if(!state.characters.length)one.append(empty('Noch keine Live-Telemetrie','Charaktere erscheinen nach dem Einrichten der gesicherten Telemetrie-Schnittstelle.'));else{
  const t=table(['Name','Map / Realm','HP','Zuletzt']);
  for(const c of state.characters.slice(0,12))addRow(t.body,[c.name,c.map+' · '+c.realm,fmt(c.hp)+' / '+fmt(c.maxHp),fresh(c.observedAt)?pill('Live · '+age(c.observedAt),'ok'):pill('Veraltet · '+age(c.observedAt),'off')]);
  one.append(t.wrap);
 }
 two.append(notice('Veränderte Itemrichtlinien erzeugen weder direkte Verkäufe noch automatische Game-Updates. Der signierte ALBot-Bootstrap bleibt geschützt.',true));
 const list=node('div',undefined,'stack');
 for(const row of [['GitHub-Konfiguration',state.configured?'Verbunden':'Nicht eingerichtet'],['Telemetrie',state.health?.telemetryEnabled?'Server bereit':'Noch nicht eingerichtet'],['Live-Übernahme','Noch nicht freigeschaltet'],['Verkaufsfreigabe','Nur Ingame-Runtime nach eigener Prüfung']]){
  const x=node('div',undefined,'row');x.append(node('span',row[0],'muted'),node('strong',row[1]));list.append(x);
 }two.append(list);grid.append(one,two);content.append(grid);
}
function inventory(items){
 const grid=node('div',undefined,'inventory');
 for(const i of (Array.isArray(items)?items:[])){
  const s=node('div',undefined,'slot');
  if(i){s.title=itemName(i.name)+' · '+(i.q??1);s.append(node('strong',i.name));if(i.q>1)s.append(node('small',fmt(i.q)));}
  grid.append(s);
 }return grid;
}
function characters(){
 content.append(heading('Charaktere','Live-Werte, Inventare und zuletzt gemeldete Kartenpositionen.'));
 if(!state.characters.length){content.append(empty('Keine Charakterdaten vorhanden','Beim Cloudflare-Setup richten wir die Telemetrieaufnahme ein. Bis dahin zeigen wir keine erfundenen Werte.'));return;}
 const grid=node('div',undefined,'character-grid');
 for(const c of state.characters){
  const section=card(),top=node('div',undefined,'card-flex'),name=node('div');
  name.append(node('h2',c.name),node('span','Level '+fmt(c.level)+' · '+c.realm,'muted'));
  top.append(name,fresh(c.observedAt)?pill('Online · '+age(c.observedAt),'ok'):pill('Letzte Meldung '+age(c.observedAt),'off'));section.append(top);
  const pairs=[['HP',c.hp,c.maxHp,''],['MP',c.mp,c.maxMp,'mp']];
  for(const [label,value,max,clazz] of pairs){
   const row=node('div',undefined,'row');row.append(node('span',label,'muted'),node('span',fmt(value)+' / '+fmt(max)));
   const bar=node('div',undefined,'progress '+clazz),inner=node('span');inner.style.width=max>0?Math.min(100,Math.max(0,100*value/max))+'%':'0%';
   bar.append(inner);section.append(row,bar);
  }
  const stats=node('div',undefined,'char-stats');
  for(const [key,val] of [['EXP/h',c.ratesMeasured===false?'—':fmt(c.expPerHour)],['Gold/h',c.ratesMeasured===false?'—':fmt(c.goldPerHour)]]){
   const v=node('div',undefined,'char-stat');v.append(node('span',key,'muted'),node('strong',val));stats.append(v);
  }section.append(stats);
  const map=node('div',undefined,'coord');map.append(node('span',c.map,'coord-label'),node('div',undefined,'coord-pin'),node('span','X '+fmt(c.x)+' / Y '+fmt(c.y),'coord-text'));
  map.title='Schematische Positionsanzeige ohne Originalkarten-Hintergrund';section.append(map);
  section.append(node('p','Position schematisch · Map: '+c.map+' · Datenalter '+age(c.observedAt),'help'));
  section.append(node('h3','Inventar ('+(c.inventory?.filter(Boolean).length??0)+' belegte Slots)'));
  section.append(inventory(c.inventory));grid.append(section);
 }content.append(grid);
}
function bank(){
 content.append(heading('Bank','Globale Bankübersicht nach zuletzt gemeldeten Fächern.'));
 content.append(notice('Bankdaten stammen aus Momentaufnahmen. Andere Maps können fehlen. Veraltete Bankfächer werden niemals als aktuelle Verkaufsgrundlage verwendet.'));
 if(!state.bank.length){content.append(empty('Bankbestand noch nicht erfasst','Beim Bankbesuch können später einzelne 42-Slot-Fächer übertragen werden. Ein fehlendes Fach bedeutet nicht, dass es leer ist.'));return;}
 const all=node('div',undefined,'stack');
 for(const pack of state.bank){
  const c=card(),h=node('div',undefined,'card-flex'),left=node('div');
  left.append(node('h2',pack.pack+' · '+pack.map),node('p',pack.realm+' · Stand vor '+age(pack.observedAt),'help'));
  h.append(left,fresh(pack.observedAt)?pill('Kürzlich beobachtet','ok'):pill('Veraltet','off'));c.append(h);
  const used=pack.slots?.filter(Boolean).length??0;
  c.append(node('div',used+' / 42 Plätze belegt','counts'));
  c.append(inventory(pack.slots));all.append(c);
 }content.append(all);
}
function policyRows(filter){
 const rows=[...state.policy.items].sort((a,b)=>a.item.localeCompare(b.item)||a.level-b.level);
 return rows.filter(p=>(p.item+' '+itemName(p.item)+' '+p.action).toLowerCase().includes(filter.toLowerCase()));
}
function items(){
 content.append(heading('Items & Regeln','Pro Item eine klare Lagergrenze und ein eindeutiges Verhalten für Überschüsse.'));
 content.append(notice('Wichtig: Diese neuen globalen Itemrichtlinien sind derzeit ein Entwurf im privaten GitHub-Konfigurationsspeicher. Die Runtime setzt sie noch nicht um. Die alten aktiven Itemregeln bleiben bestehen.',true));
 const c=card('Globale Itemrichtlinien'),bar=node('div',undefined,'toolbar'),input=node('input');
 input.placeholder='Itemname oder ID suchen';input.setAttribute('aria-label','Itemrichtlinien suchen');input.value=state.filter;
 const add=node('button','+ Item hinzufügen','button');add.disabled=!state.configured;
 bar.append(input,add);c.append(bar);
 const results=node('div');c.append(results);content.append(c);
 function draw(){
  results.replaceChildren();
  const matching=policyRows(state.filter),t=table(['Item / Variante','Verhalten','Mindestmenge','Ziel','Maximal','Aktion']);
  for(const p of matching){
   const name=node('div');name.append(node('strong',itemName(p.item)),node('span',p.item+' · Level '+p.level,'sub'));
   const label={hold:'Behalten',store:'Einlagern', 'economic-sell':'Verkaufen nach Prüfung'}[p.action];
   const edit=node('button','Bearbeiten','click');edit.onclick=()=>{state.selected=p.item+'#'+p.level;draw();};
   addRow(t.body,[name,pill(label,p.action==='economic-sell'?'warn':''),fmt(p.minimum),fmt(p.target),fmt(p.maximum),edit]);
  }
  if(matching.length)results.append(t.wrap);else results.append(empty('Noch keine passenden Richtlinien','Lege ein Item an. Die bestehenden Botregeln werden dabei nicht überschrieben.'));
  if(state.selected)editor(results);
 }
 function editor(parent){
  const p=state.policy.items.find(x=>x.item+'#'+x.level===state.selected);
  if(!p)return;
  const d=card('Richtlinie bearbeiten · '+itemName(p.item)),header=node('div',undefined,'row');
  header.append(node('strong',p.item+' · Level '+p.level));
  const close=node('button','Schließen','button');close.onclick=()=>{state.selected=null;draw();};header.append(close);d.append(header);
  const fields=node('div',undefined,'form-grid');
  const values=[['Mindestreserve',p.minimum,'minimum'],['Zielbestand',p.target,'target'],['Maximaler Gesamtbestand',p.maximum,'maximum'],['NPC-Mindestpreis',p.minNpcPrice,'minNpcPrice']];
  for(const [label,v,k] of values){
   const f=labelField(label,v,0,10000000);
   f.input.onchange=()=>{
    const value=Number(f.input.value);
    if(!Number.isSafeInteger(value)||value<0||value>10000000){toast('Ganze Zahl zwischen 0 und 10 Millionen erforderlich');draw();return;}
    const trial={...p,[k]:value};
    const errors=validatePolicyDocument({version:1,items:[trial]});
    if(errors.length){toast(errors[0]);draw();return;}
    p[k]=value;markDirty();draw();
   };fields.append(f.label);
  }
  const choice=node('label',undefined,'field');choice.append(node('span','Verhalten bei Überschuss'));
  const select=node('select');
  for(const [v,label] of [['hold','Behalten – keine automatische Entsorgung'],['store','Zur Bank lagern (erst nach Runtime-Freigabe)'],['economic-sell','Vor jedem Verkauf wirtschaftlich prüfen']]){
   const o=node('option',label);o.value=v;select.append(o);
  }select.value=p.action;select.onchange=()=>{p.action=select.value;markDirty();draw();};choice.append(select);fields.append(choice);d.append(fields);
  d.append(node('p','Die globale Obergrenze ist unabhängig von der Stapelgröße. Geschützte Reservierungen dürfen sie übersteuern. Bei fehlender Bankabdeckung gibt es keine Verkaufsfreigabe.','help'));
  const remove=node('button','Richtlinie entfernen','button danger');
  remove.onclick=()=>{state.policy.items=state.policy.items.filter(x=>x!==p);state.selected=null;markDirty();draw();};
  d.append(remove);parent.append(d);
 }
 input.oninput=()=>{state.filter=input.value;draw();};
 add.onclick=()=>{
  const id=prompt('Exakte Item-ID aus Adventure Land (z. B. beewings):');
  if(id===null)return;
  const name=id.trim();
  if(!/^[A-Za-z0-9_]{1,100}$/.test(name))return toast('Ungültige Item-ID');
  if(state.policy.items.some(x=>x.item===name&&x.level===0))return toast('Für dieses Item gibt es bereits eine Richtlinie');
  if(state.policy.items.length>=300)return toast('Maximum von 300 Richtlinien erreicht');
  state.policy.items.push(defaultPolicy(name));state.selected=name+'#0';markDirty();draw();
 };
 draw();
 const refs=card('Wirtschaftliche Entscheidung');
 refs.append(node('p','Vor einem geplanten Verkauf werden künftig Mindest-/Zielbestand, vollständige Accountabdeckung, Produktionsreservierungen, NPC-Preis sowie nachgewiesene Alternativen geprüft. Die neue Vorschau führt niemals selbst Verkäufe aus.','help'));
 refs.append(node('p','Die vollständige klassische Bot-Werkstatt bleibt verfügbar: ','help'));
 const a=node('a','Klassische Item-/Skill-Regeln bearbeiten');a.href='./classic.html';a.rel='noopener';refs.append(a);
 content.append(refs);
}
function placeholder(view){
 const names={combat:'Kampf & Fähigkeiten',farming:'Farmen & Welt',merchant:'Merchant',team:'Team'};
 content.append(heading(names[view],'Konfiguration der bestehenden ALBot-Runtime.'));
 const c=card('Bestehende Konfiguration sicher weiterverwenden');
 c.append(notice('Dieser Bereich wird im nächsten Integrationsschritt als vollständiger Editor eingebunden. Bitte keine Einstellungen in der Live-Runtime aus einer unvollständig migrierten Ansicht ersetzen.'));
 c.append(node('p','Die klassische Werkstatt wurde für den Cloudflare-Build beigefügt. Dort bleiben sämtliche aktuellen Felder, Regeln und Abhängigkeiten zugänglich.','help'));
 const a=node('a','Klassische Bot-Werkstatt öffnen');a.href='./classic.html';a.rel='noopener';c.append(a);
 content.append(c);
}
function settings(){
 content.append(heading('System & Synchronisierung','GitHub-Versionierung, Sicherheit und Cloudflare-Betriebszustand.'));
 const grid=node('div',undefined,'grid two'),a=card('GitHub-Konfiguration'),b=card('Live-Schnittstellen');
 const values=[['Verbindung',state.configured?'Bereit':'Einrichtung erforderlich'],['Gespeicherter SHA',state.sha??'Noch nicht angelegt'],['Änderungen',state.dirty?'Ungespeichert':'Keine offenen'],['Ingame-Übernahme','Noch nicht aktiviert']];
 for(const [k,v] of values){const row=node('div',undefined,'row');row.append(node('span',k,'muted'),node('span',v));a.append(row);a.append(node('hr',undefined,'separator'));}
 b.append(node('p','Cloudflare Worker API, D1-Schema und Access-Verifikation sind vorbereitet. Die Character-/Bank-Telemetrie ist erst nach Einrichtung der geheimen Zugangsdaten nutzbar.','help'));
 b.append(node('p',sourceNote,'help'));
 const link=node('a','GitHub-Implementierungsstand und Einrichtung');link.href='https://github.com/Riflex91/ALBot/blob/main/konfigurator/README.md';link.rel='noopener noreferrer';b.append(link);grid.append(a,b);content.append(grid);
}
function render(){
 const names={dashboard:['Dashboard','Accountübersicht'],characters:['Charaktere','Live-Status'],bank:['Bank','Bestand'],items:['Items & Regeln','Globale Richtlinien'],combat:['Kampf','Fähigkeiten'],farming:['Farmen','Welt'],merchant:['Merchant','Wirtschaft'],team:['Team','Gruppe'],settings:['System','Synchronisierung']};
 $('page-title').textContent=names[state.view]?.[0]??state.view;
 $('page-subtitle').textContent=names[state.view]?.[1]??'';
 for(const b of document.querySelectorAll('[data-view]'))b.classList.toggle('active',b.dataset.view===state.view);
 content.replaceChildren();
 ({dashboard,characters,bank,items,settings}[state.view]??(()=>placeholder(state.view)))();
}
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>{
 state.view=b.dataset.view;state.selected=null;document.body.classList.remove('menu-open');render();content.focus();
});
$('menu-toggle').addEventListener('click',()=>document.body.classList.toggle('menu-open'));
$('save').addEventListener('click',save);
render();bootstrap();setInterval(refreshLive,DASHBOARD_REFRESH_MS);
