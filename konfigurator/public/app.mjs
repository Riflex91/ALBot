import {defaultPolicy,validatePolicyDocument,previewGlobalItem} from './policy.mjs';
import {DASHBOARD_REFRESH_MS,SNAPSHOT_FRESH_MS} from './free-tier.mjs';
import {telemetrySummary} from './telemetry-summary.mjs';
import {profileSyncStages} from './sync-stage-model.mjs';
import {parseSignedPublicationAnchor,signedAnchorProposal,sameSignedPublication}
 from './signed-anchor-model.mjs';
import {profileView,checkedProfileDocument,setProfileScalar,
 addProfileArrayItem,removeProfileArrayItem,profileEnvelope} from './profile-model.mjs';
import {renderProfileSections} from './profile-editor.mjs';

const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e;};
const state={view:'dashboard',policy:{version:1,items:[]},sha:null,configured:false,dirty:false,saving:false,
 characters:[],bank:[],telemetryErrors:{characters:null,bank:null},catalog:[],health:null,filter:'',selected:null,loaded:false,error:''};
const profileState={document:null,descriptor:null,sha:null,loaded:false,loading:false,
 dirty:false,saving:false,error:'',fieldErrors:new Map()};
const syncState={data:null,loading:false,preparing:false,loaded:false,error:'',anchor:null,anchorError:'',reconciling:false};
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
function setSaveState(){
 const s=$('saved-state'),button=$('save');
 if(profileView(state.view)){
  s.textContent=profileState.loading?'GitHub-Profil wird geladen':
   profileState.dirty?'Ungespeicherte Profiländerungen':
   profileState.loaded?'Privates GitHub-Profil · nicht im Spiel aktiv':
   'Privates Profil nicht geladen';
  button.textContent=profileState.saving?'Speichere Profil …':'Profil auf GitHub speichern';
  button.disabled=!profileState.loaded||!profileState.dirty||
   profileState.saving||profileState.loading||profileState.fieldErrors.size>0;
 }else{
  s.textContent=state.dirty?'Ungespeicherte Richtlinien':
   state.loaded?'GitHub-Richtlinien · nicht im Spiel aktiv':'GitHub nicht verbunden';
  button.textContent=state.saving?'Speichere …':'Itemrichtlinien speichern';
  button.disabled=!state.dirty||state.saving||!state.configured;
 }
}
async function refreshSyncStatus(){
 if(syncState.loading)return;
 syncState.loading=true;syncState.error='';syncState.anchor=null;syncState.anchorError='';
 if(state.view==='settings')render();
 try{
  const result=await api('/api/profile-sync/status');
  if(result?.ok!==true||typeof result?.signed!=='boolean'||
   result?.published!==false||result?.applied!==false||
   result?.acknowledged!==false)
   throw Error('Unerwarteter Synchronisationsstatus');
  syncState.data=result;
  syncState.loaded=true;
  if(result.configured&&result.signerReady&&result.releasePrepared){
   try{
    syncState.anchor=parseSignedPublicationAnchor(
     await api('/api/profile-sync/signed-highwater'));
   }catch(error){
    syncState.anchorError=String(error?.message??error).slice(0,180);
   }
  }
 }catch(error){
  syncState.data=null;syncState.loaded=true;
  syncState.error=String(error?.message??error).slice(0,180);
 }finally{
  syncState.loading=false;
  if(state.view==='settings')render();
 }
}
async function preparePrivateProfile(){
 const latest=syncState.data;
 if(syncState.loading||syncState.preparing||!latest?.configured||
  latest.signerReady!==true||(latest.releaseMatchesCurrent===true&&!latest.releaseExpired)||
  profileState.dirty||state.dirty)return;
 if(!window.confirm('Diese exakt geprüfte GitHub-Revision privat signieren?\\n'+
  'SHA-256: '+latest.profile.sha256+'\\n'+
  'GitHub: '+latest.profile.githubSha+'\\n\\n'+
  'Es erfolgt ausdrücklich KEINE Übernahme im Spiel.'))return;
 syncState.preparing=true;syncState.error='';
 if(state.view==='settings')render();
 try{
  const response=await api('/api/profile-sync/prepare',{
   method:'PUT',headers:{'content-type':'application/json'},
   body:JSON.stringify({confirm:true,
    githubSha:latest.profile.githubSha,sha256:latest.profile.sha256,
    previousReleaseSha:latest.releaseSha??null})
  });
  if(response?.signed!==true||response?.releasePrepared!==true||
    response?.published!==false||response?.applied!==false)
   throw Error('Private Veröffentlichung wurde nicht bestätigt');
  toast('Profilrevision privat signiert. Keine Ingame-Änderung vorgenommen.');
  syncState.loaded=false;
 }catch(error){
  syncState.error=String(error?.message??error).slice(0,180);
  toast('Private Signatur fehlgeschlagen: '+syncState.error);
 }finally{
  syncState.preparing=false;
  if(!syncState.error)void refreshSyncStatus();
  else if(state.view==='settings')render();
 }
}
async function reconcileSignedPublication(){
 if(syncState.loading||syncState.preparing||syncState.reconciling||
  profileState.dirty||state.dirty)return;
 const old=syncState.data,prior=syncState.anchor;
 if(!signedAnchorProposal(old,prior).allowed)return;
 syncState.reconciling=true;syncState.error='';
 if(state.view==='settings')render();
 try{
  const freshStatus=await api('/api/profile-sync/status');
  const freshAnchor=parseSignedPublicationAnchor(
   await api('/api/profile-sync/signed-highwater'));
  if(!sameSignedPublication(old,freshStatus))
   throw Error('Signierte Revision hat sich geändert – erneut prüfen');
  if(freshAnchor.anchored!==prior.anchored||
   freshAnchor.anchor?.sequence!==prior.anchor?.sequence||
   freshAnchor.anchor?.sha256!==prior.anchor?.sha256||
   freshAnchor.anchor?.releaseSha!==prior.anchor?.releaseSha||
   freshAnchor.anchor?.updatedAt!==prior.anchor?.updatedAt)
   throw Error('D1-Höchststand hat sich geändert – erneut prüfen');
  const proposal=signedAnchorProposal(freshStatus,freshAnchor);
  if(!proposal.allowed)throw Error(proposal.reason);
  const release=proposal.release;
  const authorized=window.confirm(
   'Signierten PRIVATEN Release ausdrücklich in D1 registrieren?\n\n'+
   'Signatursequenz: '+release.sequence+'\n'+
   'SHA-256: '+release.sha256+'\n'+
   'Privater GitHub-Release-SHA: '+release.releaseSha+'\n'+
   'Signierschlüssel: '+release.keyFingerprint+'\n'+
   'Bisherige D1-Sequenz: '+(proposal.previousSequence??'noch keine')+'\n'+
   'Signaturablauf: '+new Date(release.expiresAt).toLocaleString('de-DE')+
   '\n\nDer Worker überprüft Repository und P-256-Signatur erneut.'+
   '\nWeder Ingame-Aktivierung noch Charakter-ACK werden ausgelöst.');
  if(!authorized)return;
  const confirmed=parseSignedPublicationAnchor(
   await api('/api/profile-sync/signed-highwater',{
    method:'PUT',headers:{'content-type':'application/json'},
    body:JSON.stringify(proposal.payload)
   }));
  if(confirmed.anchor?.sequence!==release.sequence||
   confirmed.anchor?.sha256!==release.sha256||
   confirmed.anchor?.releaseSha!==release.releaseSha)
   throw Error('Registrierte D1-Revision stimmt nicht mit der bestätigten Revision überein');
  toast('Privater signierter Release in D1 registriert. Im Spiel nichts aktiviert.');
 }catch(e){
  syncState.error=String(e?.message??e).slice(0,180);
  toast('D1-Registrierung fehlgeschlagen: '+syncState.error);
 }finally{
  syncState.reconciling=false;
  if(!syncState.error)void refreshSyncStatus();
  else if(state.view==='settings')render();
 }
}
async function api(path,init={}){
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...init});
 let body;try{body=await response.json();}catch{throw Error('Unerwartete Serverantwort');}
 if(!response.ok)throw Error(body.error??'HTTP '+response.status);
 return body;
}
function acceptTelemetryResult(kind,outcome){
 if(outcome.status==='rejected'){
  state.telemetryErrors[kind]=String(outcome.reason?.message??outcome.reason).slice(0,180);
  return;
 }
 const data=outcome.value;
 if(data?.configured!==true||!Array.isArray(data?.rows)){
  state.telemetryErrors[kind]='Telemetrie-API nicht verfuegbar oder ungueltige Antwort';
  return;
 }
 state.telemetryErrors[kind]=null;
 state[kind]=data.rows;
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
 acceptTelemetryResult('characters',chars);
 acceptTelemetryResult('bank',bank);
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
 acceptTelemetryResult('characters',chars);
 acceptTelemetryResult('bank',bank);
 if(['dashboard','characters','bank','settings'].includes(state.view))render();
 }finally{refreshingLive=false;}
}
function save(){
 if(profileView(state.view)){void saveProfile();return;}
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
 for(const [label,kind] of [['Charaktere','characters'],['Bank','bank']])
  if(state.telemetryErrors[kind])content.append(notice(label+': Abruf fehlgeschlagen – '+state.telemetryErrors[kind]));
 const observation=telemetrySummary({characters:state.characters,bank:state.bank,
  errors:state.telemetryErrors});
 const measured=state.characters.filter(x=>fresh(x.observedAt)&&x.ratesMeasured!==false);
 const gold=measured.reduce((n,x)=>n+(Number(x.goldPerHour)||0),0);
 const metrics=node('div',undefined,'grid metrics');metrics.append(
  metric('Charakter-Meldungen',observation.characters.available?
   observation.characters.recent+' / '+observation.characters.total:'—',
   'Innerhalb 5 Minuten beobachtet · kein Verbindungsnachweis'),
  metric('Gold pro Stunde',measured.length?fmt(gold):'—','Nur gemessene, frische Charakterdaten'),
  metric('Bankfächer frisch',observation.bank.available?
   observation.bank.recent+' / '+observation.bank.total:'—',
   'Nur gemeldete Fächer · keine vollständige Bankinventur'),
  metric('Itemrichtlinien',fmt(state.policy.items.length),'GitHub · nicht automatisch aktiviert'));content.append(metrics);
 const grid=node('div',undefined,'grid two'),one=card('Aktivitätsübersicht'),two=card('Sicherheit & Synchronisierung');
 if(!state.characters.length)one.append(empty(state.telemetryErrors.characters?'Charakterabfrage fehlgeschlagen':'Noch keine Live-Telemetrie',state.telemetryErrors.characters?'Fehler oben beachten. Falls der Relay-Upload erfolgreich war, /api/characters pruefen.':'Der ALBot-Direktsender überträgt bei korrekt konfiguriertem privatem Token automatisch alle 120 Sekunden. Prüfe im Spiel ALBot.telemetryStatus(); das Relay ist nur ein optionaler Ausweichweg.'));else{
  const t=table(['Name','Map / Realm','HP','Zuletzt']);
  for(const c of state.characters.slice(0,12))addRow(t.body,[c.name,c.map+' · '+c.realm,fmt(c.hp)+' / '+fmt(c.maxHp),fresh(c.observedAt)?pill('Live · '+age(c.observedAt),'ok'):pill('Veraltet · '+age(c.observedAt),'off')]);
  one.append(t.wrap);
 }
 two.append(notice('Veränderte Itemrichtlinien erzeugen weder direkte Verkäufe noch automatische Game-Updates. Der signierte ALBot-Bootstrap bleibt geschützt.',true));
 const list=node('div',undefined,'stack');
 for(const row of [['GitHub-Konfiguration',state.configured?'Verbunden':'Nicht eingerichtet'],
  ['Telemetrie',state.health?.telemetryEnabled===true?'Worker bereit':state.health?.telemetryEnabled===false?'Worker nicht bereit':'Worker-Status nicht verfügbar'],
  ['Letzter Charakter-Snapshot',observation.characters.available&&observation.characters.latest!==null?
    'vor '+age(observation.characters.latest):'Nicht bestätigt'],
  ['Letztes Bankfach',observation.bank.available&&observation.bank.latest!==null?
    'vor '+age(observation.bank.latest):'Nicht bestätigt'],
  ['Live-Übernahme','Noch nicht freigeschaltet'],
  ['Verkaufsfreigabe','Nur Ingame-Runtime nach eigener Prüfung']]){
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
 if(state.telemetryErrors.characters)content.append(notice('Charakterdaten konnten nicht geladen werden: '+state.telemetryErrors.characters));
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
 if(state.telemetryErrors.bank)content.append(notice('Bankdaten konnten nicht geladen werden: '+state.telemetryErrors.bank));
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

async function loadProfile({force=false}={}){
 if(profileState.loading||profileState.saving)return;
 if(!force&&profileState.loaded)return;
 if(force&&profileState.dirty&&!window.confirm(
  'Ungespeicherte Änderungen verwerfen und die aktuelle GitHub-Version laden?'))return;
 profileState.loading=true;profileState.error='';setSaveState();render();
 try{
  const [schema,source]=await Promise.all([
   api('/api/profile-schema'),api('/api/profile')]);
  if(schema?.descriptor?.schemaId!=='albot.full/v1')
   throw Error('Das erforderliche Full-v1-Schema ist nicht verfügbar.');
  if(!source?.document)throw Error(
   'Noch kein privates ALBot-Profil gespeichert. Erstelle oder importiere es zunächst in der klassischen Bot-Werkstatt.');
  const verified=checkedProfileDocument(source.document,schema.descriptor);
  profileState.descriptor=schema.descriptor;
  profileState.document=verified;
  profileState.sha=source.sha??null;
  profileState.loaded=true;profileState.dirty=false;
  profileState.fieldErrors.clear();
 }catch(error){
  if(!profileState.dirty){
   profileState.loaded=false;profileState.document=null;profileState.descriptor=null;
  }
  profileState.error=String(error?.message??error).slice(0,220);
 }finally{profileState.loading=false;setSaveState();render();}
}
async function saveProfile(){
 if(!profileState.loaded||!profileState.dirty||profileState.loading||
    profileState.saving||profileState.fieldErrors.size>0)return;
 const staged=JSON.stringify(profileState.document);
 profileState.saving=true;setSaveState();
 try{
  // The Worker validates the complete authoritative ALBot profile, including
  // cross-field rules. The optimistic SHA rejects concurrent Classic edits.
  const result=await api('/api/profile',{
   method:'PUT',headers:{'content-type':'application/json'},
   body:JSON.stringify({sha:profileState.sha,
    document:profileEnvelope(profileState.document)})
  });
  profileState.sha=result.sha;
  syncState.loaded=false;syncState.data=null;
  if(JSON.stringify(profileState.document)===staged)profileState.dirty=false;
  profileState.error='';
  toast('Profil versioniert auf GitHub gespeichert. Keine Änderung wurde im Spiel aktiviert.');
 }catch(error){
  profileState.error=String(error?.message??error).slice(0,220);
  toast('Profil nicht gespeichert: '+profileState.error);
 }finally{profileState.saving=false;setSaveState();render();}
}
function profileFieldChange(path,raw){
 const key=path.join('/');
 try{
  setProfileScalar(profileState.document,profileState.descriptor,path,raw);
  profileState.fieldErrors.delete(key);
  profileState.dirty=true;profileState.error='';
  setSaveState();
  return null;
 }catch(error){
  const message=String(error?.message??error).slice(0,130);
  profileState.fieldErrors.set(key,message);
  setSaveState();
  return message;
 }
}
function profileListChange(kind,path,index){
 if(profileState.saving)return;
 if(kind==='remove'&&!window.confirm('Diesen Profileintrag entfernen? Die Änderung bleibt bis zum Speichern ein Entwurf.'))return;
 try{
  if(kind==='add')addProfileArrayItem(profileState.document,profileState.descriptor,path);
  else removeProfileArrayItem(profileState.document,profileState.descriptor,path,index);
  // Removed/reindexed fields no longer have meaningful validation errors.
  profileState.fieldErrors.clear();
  profileState.dirty=true;profileState.error='';
 }catch(error){toast('Profil nicht geändert: '+String(error?.message??error));}
 setSaveState();render();
}
function profileEditorView(view){
 const descriptions={
  combat:'Skill- und Kampfregeln des privaten vollständigen ALBot-Profils.',
  farming:'Farm- und Weltoptionen aus dem vollständigen ALBot-Schema.',
  merchant:'Logistik, Budgetgrenzen, Gearplanung und ausdrücklich freigegebene Marktkäufe. Im Bereich Alle Items · Regeln: Aktion Markt kaufen, Preisquelle Prozentual zum beobachteten Marktpreis, Anteil (%) und absolute Obergrenze festlegen.',
  team:'Gruppeneinstellungen und die bekannten Charaktere.'
 };
 const title={combat:'Kampf & Fähigkeiten',farming:'Farmen & Welt',
  merchant:'Merchant & Produktion',team:'Team & Charaktere'}[view];
 content.append(heading(title,descriptions[view]));
 content.append(notice(
  'Änderungen werden ausschließlich nach ausdrücklichem Speichern in das private GitHub-Profil übernommen. Die aktuell laufenden Bots verwenden weiterhin ihre bestehende Konfiguration.',true));
 if(profileState.error)content.append(notice('Profil: '+profileState.error));
 if(profileState.fieldErrors.size)content.append(notice(
  'Ungültige Eingaben verhindern das Speichern: '+
  [...profileState.fieldErrors.entries()].slice(0,3)
   .map(([path,error])=>path+': '+error).join(' · ')));
 const actionBar=node('div',undefined,'toolbar');
 const reload=node('button','Aktuelle GitHub-Version laden','button');
 reload.type='button';reload.disabled=profileState.loading||profileState.saving;
 reload.onclick=()=>{void loadProfile({force:true});};
 const classic=node('a','Klassische Werkstatt öffnen','button');
 classic.href='./classic.html';classic.rel='noopener';
 actionBar.append(reload,classic);content.append(actionBar);
 if(profileState.loading){
  content.append(empty('Profil wird geladen','Cloudflare Access und privates GitHub-Profil werden geprüft.'));
  return;
 }
 if(!profileState.loaded){
  content.append(empty('Kein bearbeitbares GitHub-Profil',
   'Ein vollständiges Profil kann zunächst über die klassische Werkstatt importiert und gespeichert werden.'));
  return;
 }
 renderProfileSections(content,{
  document:profileState.document,descriptor:profileState.descriptor,
  view,editable:!profileState.saving,
  onField:profileFieldChange,
  onAdd:path=>profileListChange('add',path),
  onRemove:(path,index)=>profileListChange('remove',path,index)
 });
 content.append(node('p',
  'Schema-Validierung und Konfliktprüfung erfolgen beim Speichern serverseitig. Änderungen in der klassischen Werkstatt können nur nach einem erneuten Laden übernommen werden.','help'));
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
 const observation=telemetrySummary({characters:state.characters,bank:state.bank,
  errors:state.telemetryErrors});
 const availability=state.health?.telemetryEnabled===true?'Worker-Telemetrie aktiviert':
  state.health?.telemetryEnabled===false?'Worker-Telemetrie nicht bereit':
  'Worker-Status derzeit nicht abrufbar';
 b.append(node('p',availability+'. Ein gespeicherter Datensatz bestätigt nur die letzte empfangene Beobachtung, nicht dass ein Charakter derzeit online ist.','help'));
 for(const [label,data] of [['Charaktere',observation.characters],['Bankfächer',observation.bank]]){
  const line=node('div',undefined,'row');
  line.append(node('span',label,'muted'),node('strong',
   data.available?(data.recent+' / '+data.total+' jüngere als 5 Minuten · zuletzt '+
    (data.latest===null?'nie':'vor '+age(data.latest))):'API-Abruf fehlgeschlagen'));
  b.append(line);
 }
 b.append(node('p','Die private ALBot-Telemetrie wird direkt aus Adventure Land übertragen. Das Relay ist nur ein optionaler Ausweichweg. Kein Token wird auf dieser Seite abgefragt oder angezeigt.','help'));
 b.append(node('p',sourceNote,'help'));
 const sync=card('Konfigurationsabgleich · Nachweisstufen');
 sync.append(notice('Eine gültig signierte Profilrevision kann über den geschützten Cloudflare-Access-Popup-Abruf bereitstehen. Im Spiel ist nur die manuelle, unabhängige Prüfvorschau vorgesehen. Bereitstellung beweist weder Empfang noch Aktivierung oder eine Charakterbestätigung.',true));
 const check=node('button',syncState.loading?'Prüfe Revision …':'Gespeicherte Revision prüfen','button');
 check.type='button';check.disabled=syncState.loading;
 check.onclick=()=>void refreshSyncStatus();
 sync.append(check);
 if(syncState.error)sync.append(notice('Abgleich fehlgeschlagen: '+syncState.error));
 const entry=syncState.data;
 if(syncState.loaded&&!syncState.error){
  const statusLabels={confirmed:'Bestätigt',ready:'Für Popup-Abruf bereit',
   pending:'Ausstehend',unknown:'Nicht nachgewiesen',
   unavailable:'Nicht implementiert'};
  for(const [index,stage] of profileSyncStages(entry).entries()){
   const line=node('div',undefined,'row sync-revision');
   line.append(node('span',(index+1)+'. '+stage.label,'muted'),
    node('strong',statusLabels[stage.state]));
   sync.append(line);
  }
  sync.append(node('p','Es liegen keine authentifizierten Ingame-ACKs vor. Charakterbezogene Empfangszeiten, Aktivierungssequenzen und Abweichungen können daher nicht zuverlässig ausgewiesen werden.','help'));
 }
 if(entry?.configured===false)sync.append(node('p',
  'Im privaten GitHub-Repository liegt noch kein vollständiges Profil vor.','help'));
 if(entry?.configured===true){
  const info=[['Privater GitHub-SHA',entry.profile?.githubSha??'—'],
   ['Profil-SHA-256',entry.profile?.sha256??'—'],
   ['Profilformat',entry.profile?.schemaId??'—'],
   ['Privater Signierer',entry.signerReady?'Eingerichtet':'Nicht eingerichtet'],
   ['Signierte Revision',entry.signed?'Aktuelle Revision signiert':
    entry.releasePrepared?'Andere Revision signiert':'Noch keine'],
   ['Signatursequenz',entry.release?.sequence??'—'],
   ['Private Signatur abgelaufen',entry.releaseExpired?'Ja':'Nein'],
   ['Signatur gültig bis',entry.release?.expiresAt?
    new Date(entry.release.expiresAt).toLocaleString('de-DE'):'—'],
   ['Signaturschlüssel-Kennung',entry.keyFingerprint??'—'],
   ['Bereitstellungsmodus','Cloudflare-Access-Popup (manuell)'],
   ['Direkter Ingame-Abruf','Nicht aktiviert'],
   ['Authentische Charakter-ACKs','Nicht verfügbar']];
  for(const [key,value] of info){
   const line=node('div',undefined,'row sync-revision');
   line.append(node('span',key,'muted'),node('strong',value));
   sync.append(line);
  }
  if(entry.signerReady!==true)
   sync.append(node('p',
    'Private Signierung ist noch gesperrt: CONFIG_SIGNING_JWK und CONFIG_SIGNING_TARGET müssen als Worker-Secrets/Variablen getrennt vom Ingest-Token eingerichtet werden.','help'));
  if(entry.releasePrepared===true&&!entry.releaseMatchesCurrent)
   sync.append(notice('Die vorhandene signierte Revision stimmt nicht mit dem aktuell gespeicherten Profil überein.'));
  const anchor=syncState.anchor;
  const anchorLabel=syncState.anchorError?'Nicht prüfbar: '+syncState.anchorError:
   !anchor?'Noch nicht geprüft':anchor.anchored?
   'Sequenz '+anchor.anchor.sequence+' · SHA-256 '+anchor.anchor.sha256:
   'Tabelle vorhanden, aber noch kein signierter Release registriert';
  const anchorRow=node('div',undefined,'row sync-revision');
  anchorRow.append(node('span','D1-Publikationsanker','muted'),node('strong',anchorLabel));
  sync.append(anchorRow);
  sync.append(node('p','D1 belegt nur privat signierte Veröffentlichungen, keine Ingame-Übernahme oder Charakterbestätigung.','help'));
  if(syncState.anchorError){
   sync.append(notice('D1-Anker nicht verfügbar. Die additive Datenbankmigration könnte noch fehlen.'));
   const doc=node('a','Geschützter GitHub-Workflow zur D1-Einrichtung');
   doc.href='https://github.com/Riflex91/ALBot/actions/workflows/manual-konfigurator-d1-highwater.yml';
   doc.rel='noopener noreferrer';sync.append(doc);
  }
  const proposal=signedAnchorProposal(entry,anchor);
  if(proposal.allowed){
   const register=node('button',syncState.reconciling?'Prüfe und registriere …':
    'Signierten Release nach Prüfung in D1 registrieren','button');
   register.type='button';
   register.disabled=syncState.loading||syncState.preparing||syncState.reconciling||
    profileState.dirty||state.dirty;
   register.onclick=()=>void reconcileSignedPublication();
   sync.append(register);
   sync.append(node('p',proposal.initial?
    'Erstregistrierung: Vor dem Speichern werden private GitHub-Datei, P-256-Signatur und aktuelle Revision erneut geprüft.':
    'Die vorherige D1-Sequenz wird nur nach expliziter Bestätigung durch den höheren signierten Release ersetzt.','help'));
  }else if(anchor&&entry.releasePrepared)
   sync.append(node('p','Registrierung gesperrt: '+proposal.reason,'help'));
  const prepare=node('button',syncState.preparing?'Signiere privat …':
   'Aktuelle Profilrevision privat signieren','button');
  prepare.type='button';
  prepare.disabled=syncState.loading||syncState.preparing||
   entry.signerReady!==true||(entry.releaseMatchesCurrent===true&&!entry.releaseExpired)||
   profileState.dirty||state.dirty;
  prepare.onclick=()=>void preparePrivateProfile();
  sync.append(prepare);
  if(profileState.loaded&&profileState.sha!==entry.profile?.githubSha)
   sync.append(notice('Die im Browser geladene Profilrevision stimmt nicht mit dem zuletzt gespeicherten GitHub-Stand überein. Vor der Bearbeitung erneut laden.'));
  if(profileState.dirty||state.dirty)
   sync.append(notice('Im Browser gibt es zusätzliche ungespeicherte Änderungen. Diese sind nicht Bestandteil des angezeigten Fingerprints.'));
 }
 content.append(sync);
 const link=node('a','GitHub-Implementierungsstand und Einrichtung');link.href='https://github.com/Riflex91/ALBot/blob/main/konfigurator/README.md';link.rel='noopener noreferrer';b.append(link);grid.append(a,b);content.append(grid);
}
function render(){
 const names={dashboard:['Dashboard','Accountübersicht'],characters:['Charaktere','Live-Status'],bank:['Bank','Bestand'],items:['Items & Regeln','Globale Richtlinien'],combat:['Kampf','Fähigkeiten'],farming:['Farmen','Welt'],merchant:['Merchant','Wirtschaft'],team:['Team','Gruppe'],settings:['System','Synchronisierung']};
 $('page-title').textContent=names[state.view]?.[0]??state.view;
 $('page-subtitle').textContent=names[state.view]?.[1]??'';
 for(const b of document.querySelectorAll('[data-view]'))b.classList.toggle('active',b.dataset.view===state.view);
 content.replaceChildren();
 ({dashboard,characters,bank,items,settings}[state.view]??
  (profileView(state.view)?()=>profileEditorView(state.view):()=>placeholder(state.view)))();
}
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>{
 state.view=b.dataset.view;state.selected=null;document.body.classList.remove('menu-open');
 setSaveState();render();
 if(profileView(state.view))void loadProfile();
 if(state.view==='settings'&&!syncState.loaded)void refreshSyncStatus();
 content.focus();
});
$('menu-toggle').addEventListener('click',()=>document.body.classList.toggle('menu-open'));
$('save').addEventListener('click',save);
window.addEventListener('beforeunload',event=>{
 if(!state.dirty&&!profileState.dirty)return;
 event.preventDefault();event.returnValue='';
});
render();bootstrap();setInterval(refreshLive,DASHBOARD_REFRESH_MS);
