// No game actions, eval or dynamic script loading in the editor.
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const STORAGE='albot.workshop.v2';
let descriptor=structuredClone(INITIAL_DESCRIPTOR),catalog=structuredClone(INITIAL_CATALOG),config=defaultsFor(descriptor.schema),runtime=null,section='general',history=[],future=[],dirty=false;
let fileMode='',itemSearch='',ruleSearch='',itemPage=0,selected=new Set(),draftTimer;
const draftMessages=[];
checkDescriptor(descriptor);
try{const raw=localStorage.getItem(STORAGE);if(raw){const d=parseData(raw);checkDescriptor(d.descriptor);if(!d.config||typeof d.config!=='object'||Array.isArray(d.config))throw Error('Entwurf unvollständig.');descriptor=d.descriptor;config=d.config;draftMessages.push('Lokalen Entwurf wiederhergestellt. Bot-Paket bei Bedarf erneut laden.');}}catch(e){draftMessages.push('Lokaler Entwurf nicht geladen: '+e.message);}
function feedback(text){$('feedback').textContent=text;}
function remember(){history.push(JSON.stringify(config));if(history.length>30)history.shift();future=[];}
function change(fn,redraw=false){remember();fn();dirty=true;update();if(redraw)render();}
function scheduleSave(){clearTimeout(draftTimer);draftTimer=setTimeout(()=>{try{localStorage.setItem(STORAGE,JSON.stringify({descriptor,config}));$('draft-status').textContent='Entwurf lokal gesichert. JSON-Export ist deine portable Sicherung.';}catch{$('draft-status').textContent='Browserspeicher nicht verfügbar/voll. Bitte Profil als JSON speichern.';}},300);}
function pathGet(path){return path.reduce((x,k)=>x?.[k],config);}
function pathSet(path,value){let node=config;for(const k of path.slice(0,-1))node=node[k];node[path.at(-1)]=value;}
function download(name,text,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type})),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function update(){
  const errors=validateProfile(descriptor,config);$('profile-name').textContent=config.general?.name||'Mein Profil';$('schema-label').textContent=descriptor.schemaId+' · '+(config.characters?.length??0)+' Charaktere · '+(config.items?.length??0)+' Item-Regeln';
  $('runtime-status').textContent=runtime?'Bot-Paket '+runtime.version+' geladen. Export enthält deine Einstellungen und den Bot.':'Konfiguration für den vollständigen Super-Bot. Noch kein fertiges Bot-Paket geladen: Profile sind speicherbar, bot.js folgt mit der Runtime.';
  $('errors').textContent=errors.join('\n');$('validation').textContent=errors.length?'Bitte '+errors.length+' Punkt(e) korrigieren.':'Profil ist gültig.';
  $('validation').className=errors.length?'error':'good';$('save-profile').disabled=!!errors.length;
  let bytes=new TextEncoder().encode(JSON.stringify(config)).length,exportError='';
  if(runtime&&!errors.length){try{bytes=exportBundle(descriptor,config,runtime).bytes;}catch(e){exportError=e.message;$('errors').textContent+='\n'+exportError;}}
  $('bytes').textContent=new Intl.NumberFormat('de-DE').format(bytes)+' B';$('byte-label').textContent=runtime?'Bot + Einstellungen / 1.048.576 Byte':'Nur Einstellungen · Bot-Größe nach Paketimport';$('sizebar').style.width=Math.min(100,100*bytes/SLOT_LIMIT)+'%';$('sizebar').style.background=bytes>SOFT_LIMIT?'var(--amber)':'var(--green)';
  $('download-bot').disabled=!runtime||!!errors.length||!!exportError;$('undo').disabled=!history.length;$('redo').disabled=!future.length;scheduleSave();
}
function labelFor(value){if(value&&typeof value==='object')return value.name||value.item||value.skill||value.field||'Eintrag';return String(value||'Eintrag');}
function schemaField(parent,s,path){
  const value=pathGet(path),id='field-'+path.join('-');
  if(s.type==='object'){
    if(descriptor.schemaId==='albot.config/v1'&&path[0]==='items'&&path.length===2){
      const groups=[['Regel & Geltungsbereich',['name','enabled','priority','item','role','character','minLevel','maxLevel','statType','property','title','map','server','task']],['Aktion, Mengen & Empfänger',['action','keep','targetCount','maxCount','batch','recipient','teamReserve']],['Preise & Budgets',['minPrice','maxPrice','priceSource','goldBudget','lossBudget']],['Verarbeitung & Ablauf',['targetLevel','scroll','offering','minChance','recipe','pack','slot','fallback','ttlMs']]];
      const handled=new Set();
      for(const [title,keys] of groups){const d=el('details');d.open=title.startsWith('Regel')||title.startsWith('Aktion');d.append(el('summary',title));const grid=el('div',undefined,'grid detail-body');for(const k of keys)if(s.properties[k]){handled.add(k);schemaField(grid,s.properties[k],[...path,k]);}d.append(grid);parent.append(d);}
      const extra=el('div',undefined,'grid');for(const [k,v] of Object.entries(s.properties))if(!handled.has(k))schemaField(extra,v,[...path,k]);parent.append(extra);return;
    }
    const grid=el('div',undefined,'grid');for(const [k,v] of Object.entries(s.properties)){if(!Object.prototype.hasOwnProperty.call(value??{},k)){const p=el('div',undefined,'wide notice');p.append(el('span',(v.title||k)+' fehlt. '));const b=el('button','Vorgabe ergänzen');b.onclick=()=>change(()=>pathSet([...path,k],defaultsFor(v)),true);p.append(b);grid.append(p);continue;}
      if(['object','array'].includes(v.type)){const box=el('div',undefined,'wide');if(v.type==='object'){const d=el('details');d.append(el('summary',v.title||k));const body=el('div',undefined,'detail-body');if(v.description)body.append(el('p',v.description,'small'));schemaField(body,v,[...path,k]);d.append(body);box.append(d);}else schemaField(box,v,[...path,k]);grid.append(box);}else schemaField(grid,v,[...path,k]);}
    parent.append(grid);return;
  }
  if(s.type==='array'){
    parent.append(el('h3',s.title||path.at(-1)));if(s.description)parent.append(el('p',s.description,'small'));
    if(!Array.isArray(value)){parent.append(el('p','Ungültige Liste – Profil korrigieren oder importieren.','error'));return;}
    const entries=el('div');let page=0,filter='';
    const search=el('input');search.placeholder='Einträge durchsuchen …';search.setAttribute('aria-label',(s.title||'Liste')+' durchsuchen');
    if(value.length>8||path[0]==='items')parent.append(search);
    if(path[0]==='items'&&path.length===1){search.value=ruleSearch;filter=ruleSearch;}
    const draw=()=>{entries.replaceChildren();const matching=value.map((v,i)=>({v,i})).filter(({v})=>JSON.stringify(v).toLowerCase().includes(filter.toLowerCase()));const total=Math.max(1,Math.ceil(matching.length/15));page=Math.min(page,total-1);
      for(const {v,i} of matching.slice(page*15,page*15+15)){
        const d=el('details');d.open=!!(window.openRulePath&&window.openRulePath===JSON.stringify([...path,i]));
        const title=labelFor(v)+(v?.action?' · '+(ACTIONS[v.action]||v.action):'')+(v?.role?' · '+v.role:'');d.append(el('summary',(i+1)+'. '+title));
        const body=el('div',undefined,'detail-body'),buttons=el('div',undefined,'row end');
        for(const [label,fn,disabled] of [['↑',()=>{[value[i-1],value[i]]=[value[i],value[i-1]];},i===0],['↓',()=>{[value[i+1],value[i]]=[value[i],value[i+1]];},i===value.length-1],['Kopieren',()=>{value.splice(i+1,0,structuredClone(v));},value.length>=s.maxItems],['Entfernen',()=>value.splice(i,1),false]]){const b=el('button',label);b.disabled=disabled;b.setAttribute('aria-label',label+': '+labelFor(v));b.onclick=()=>change(fn,true);buttons.append(b);}body.append(buttons);schemaField(body,s.items,[...path,i]);d.append(body);entries.append(d);
      }
      if(!matching.length)entries.append(el('p','Noch keine passenden Einträge. Über „Hinzufügen“ anlegen.','small'));
      const controls=el('div',undefined,'row');const prev=el('button','Zurück'),next=el('button','Weiter');prev.disabled=page===0;next.disabled=page+1>=total;prev.onclick=()=>{page--;draw();};next.onclick=()=>{page++;draw();};controls.append(prev,el('span',matching.length+' Einträge · Seite '+(page+1)+' / '+total,'small'),next);entries.append(controls);
    };
    search.oninput=()=>{filter=search.value;if(path[0]==='items'&&path.length===1)ruleSearch=filter;page=0;draw();};parent.append(entries);draw();
    const add=el('button','+ Hinzufügen');add.style.marginTop='12px';add.disabled=value.length>=s.maxItems;add.onclick=()=>change(()=>{value.push(defaultsFor(s.items));window.openRulePath=JSON.stringify([...path,value.length-1]);if(path[0]==='items')ruleSearch='';},true);parent.append(add);return;
  }
  const label=el('label',undefined,'field'+(s.type==='boolean'?' check':''));label.htmlFor=id;
  const title=el('span',s.title||path.at(-1));let input;
  if(s.enum){input=el('select');for(const v of s.enum){const o=el('option',s['x-labels']?.[v]||v);o.value=v;input.append(o);}input.value=value;}
  else {input=el('input');input.type=s.type==='boolean'?'checkbox':['number','integer'].includes(s.type)?'number':'text';if(s.type==='boolean')input.checked=value===true;else input.value=value??'';if(s.minimum!==undefined)input.min=s.minimum;if(s.maximum!==undefined)input.max=s.maximum;if(s.maxLength)input.maxLength=s.maxLength;input.step=s.type==='integer'?'1':'any';}
  input.id=id;input.oninput=()=>change(()=>pathSet(path,s.type==='boolean'?input.checked:['number','integer'].includes(s.type)?(input.value===''?null:Number(input.value)):input.value));
  if(s['x-catalog']){const datalist=el('datalist');datalist.id=id+'-choices';const choices=s['x-catalog']==='items'?catalog.items.map(x=>[x.id,x.name]):s['x-catalog']==='characters'?(config.characters??[]).map(x=>[x.name,x.name]):[];for(const [v,n] of choices){const o=el('option');o.value=v;o.label=n;datalist.append(o);}input.setAttribute('list',datalist.id);label.append(datalist);}
  if(s.type==='boolean')label.append(input,title);else label.append(title,input);if(s.description)label.append(el('span',s.description,'help'));parent.append(label);
}
function drawCatalog(parent){
  const d=el('details');d.open=true;d.append(el('summary','Item-Katalog · '+catalog.items.length+' Items · Spielstand '+catalog.version));const body=el('div',undefined,'detail-body');
  body.append(el('p','Suche nach ID, Namen oder Typ. Mehrere Items auswählen und gemeinsame Regeln anlegen. Neue Spiel-Items sind jederzeit per Katalogimport oder freier ID verfügbar.','small'));
  const search=el('input');search.placeholder='z. B. hpot1, Schwert, weapon …';search.value=itemSearch;search.setAttribute('aria-label','Item-Katalog durchsuchen');body.append(search);const matches=el('div',undefined,'catalog'),pager=el('div',undefined,'row');body.append(matches,pager);
  const draw=()=>{matches.replaceChildren();pager.replaceChildren();const all=catalog.items.filter(x=>(x.id+' '+x.name+' '+x.type).toLowerCase().includes(itemSearch.toLowerCase()));const pages=Math.max(1,Math.ceil(all.length/20));itemPage=Math.min(itemPage,pages-1);
    for(const item of all.slice(itemPage*20,itemPage*20+20)){const row=el('label',undefined,'catalog-row'),check=el('input');check.type='checkbox';check.checked=selected.has(item.id);check.onchange=()=>{if(check.checked)selected.add(item.id);else selected.delete(item.id);count.textContent=selected.size+' ausgewählt';};row.append(check,el('span',item.name+' · '+item.id),el('small',item.type));matches.append(row);}
    const prev=el('button','←'),next=el('button','→');prev.disabled=itemPage===0;next.disabled=itemPage+1>=pages;prev.onclick=()=>{itemPage--;draw();};next.onclick=()=>{itemPage++;draw();};pager.append(prev,el('span',all.length+' Treffer · Seite '+(itemPage+1)+' / '+pages,'small'),next);
  };
  const actions=el('div',undefined,'row');actions.style.marginTop='16px';const role=el('select');role.style.width='130px';role.setAttribute('aria-label','Rolle für Item-Regeln');for(const [v,n] of [['farmer','Farmer'],['merchant','Merchant'],['all','Alle Rollen']]){const o=el('option',n);o.value=v;role.append(o);}const action=el('select');action.style.width='180px';action.setAttribute('aria-label','Aktion für neue Item-Regeln');for(const [v,n] of Object.entries(ACTIONS)){const o=el('option',n);o.value=v;action.append(o);}const add=el('button','Regeln anlegen','primary'),clear=el('button','Auswahl leeren'),count=el('span',selected.size+' ausgewählt','small');
  add.onclick=()=>{if(!selected.size)return feedback('Zuerst Items auswählen.');if(config.items.length+selected.size>descriptor.schema.properties.items.maxItems)return feedback('Zu viele Regeln.');change(()=>{for(const id of selected){const rule=defaultsFor(descriptor.schema.properties.items.items);rule.name=id+' / '+role.value;rule.item=id;rule.role=role.value;rule.action=action.value;config.items.push(rule);}selected.clear();ruleSearch='';},true);feedback('Regeln angelegt. Empfänger, Mengen und Preise jetzt pro Regel anpassen.');};clear.onclick=()=>{selected.clear();draw();count.textContent='0 ausgewählt';};actions.append(role,action,add,clear,count);body.append(actions);
  const bulk=el('details');bulk.append(el('summary','Bestehende Regeln gemeinsam ändern'));const bulkBody=el('div',undefined,'detail-body');bulkBody.append(el('p','Ändert ein Feld in allen Regeln der ausgewählten Item-IDs mit exakt der oben gewählten Rolle. Eine Änderung lässt sich vollständig rückgängig machen.','small'));const field=el('select');field.setAttribute('aria-label','Gemeinsam zu änderndes Feld');const props=descriptor.schema.properties.items.items.properties;for(const [k,s] of Object.entries(props))if(!['item','role','name'].includes(k)){const o=el('option',s.title||k);o.value=k;field.append(o);}const valueBox=el('div');let bulkInput;
  const valueDraw=()=>{valueBox.replaceChildren();const s=props[field.value];bulkInput=el(s.enum?'select':'input');bulkInput.setAttribute('aria-label','Neuer gemeinsamer Wert');if(s.enum)for(const v of s.enum){const o=el('option',s['x-labels']?.[v]||v);o.value=v;bulkInput.append(o);}else bulkInput.type=s.type==='boolean'?'checkbox':['number','integer'].includes(s.type)?'number':'text';if(s.type==='boolean')bulkInput.checked=s.default;else bulkInput.value=s.default??'';valueBox.append(bulkInput);};field.onchange=valueDraw;valueDraw();const apply=el('button','Gemeinsam übernehmen');apply.onclick=()=>{const targets=config.items.filter(r=>selected.has(r.item)&&r.role===role.value);if(!targets.length)return feedback('Keine Regeln mit dieser Auswahl und Rolle vorhanden.');const s=props[field.value],v=s.type==='boolean'?bulkInput.checked:['number','integer'].includes(s.type)?(bulkInput.value===''?null:Number(bulkInput.value)):bulkInput.value;const errors=validateSchema(s,v);if(errors.length)return feedback(errors.join('\n'));change(()=>{for(const r of targets)r[field.value]=v;},true);feedback(targets.length+' Regeln gemeinsam geändert.');};bulkBody.append(field,valueBox,apply);bulk.append(bulkBody);body.append(bulk);
  search.oninput=()=>{itemSearch=search.value;itemPage=0;draw();};draw();d.append(body);parent.append(d);
}
function preview(parent){
  parent.append(el('h2','Welche Regel greift?'),el('p','Vorschau der Item-Auswahl und Priorität. Es werden keine Spielaktionen oder Shadow-Läufe ausgeführt. Live-Budgets, Erreichbarkeit und Verarbeitung prüft erst die Bot-Laufzeit.'));
  const query={item:'hpot1',role:'farmer',character:'',level:0,quantity:500,phase:'inventory',statType:'',property:'',title:'',map:'',server:'',task:'',locked:false,equipped:false,reserved:false};
  const grid=el('div',undefined,'grid');const result=el('div');
  const labels={item:'Item-ID',role:'Rolle',character:'Charakter',level:'Item-Level',quantity:'Aktueller Bestand',phase:'Arbeitsphase',statType:'Stat-Typ',property:'Eigenschaft p',title:'Titel',map:'Karte',server:'Realm',task:'Aktivität',locked:'Gesperrt',equipped:'Ausgerüstet',reserved:'Reserviert'};
  for(const [k,v] of Object.entries(query)){const label=el('label',labels[k],'field'),input=['role','phase'].includes(k)?el('select'):el('input');if(k==='role'||k==='phase')for(const val of k==='role'?['farmer','merchant']:['inventory','acquisition','production']){const o=el('option',val);o.value=val;input.append(o);}else input.type=typeof v==='boolean'?'checkbox':typeof v==='number'?'number':'text';if(input.type==='number')input.min=0;input.value=v;input.id='preview-'+k;input.oninput=()=>{query[k]=typeof v==='boolean'?input.checked:typeof v==='number'?Number(input.value):input.value;draw();};label.htmlFor=input.id;label.append(input);grid.append(label);}
  function draw(){result.replaceChildren();const errors=validateProfile(descriptor,config);if(errors.length){result.append(el('p','Erst Profilfehler beheben: '+errors[0],'error'));return;}const r=resolveItem(config,query);result.append(el('p',r.reason,'notice'));if(r.rule)result.append(el('p','Aktion: '+ACTIONS[r.rule.action]+(['send','sell','bank','list'].includes(r.rule.action)?' · Überschussmenge: '+r.quantity:'')+' · Empfänger: '+(r.rule.recipient||'—')));for(const c of r.candidates)result.append(el('p',c.name+' · Spezifität '+c.rank+' · Priorität '+c.priority,'small'));}parent.append(grid,result);draw();
}
function render(){
  const nav=$('nav');nav.replaceChildren();const filter=$('nav-search').value.toLowerCase();const sections=Object.entries(descriptor.schema.properties);
  for(const [key,s] of [...sections,['preview',{title:'Regelvorschau'}],['json',{title:'Import & JSON'}]]){if(key==='preview'&&descriptor.schemaId!=='albot.config/v1')continue;if(filter&&!JSON.stringify(s).toLowerCase().includes(filter))continue;const b=el('button',s.title||key);if(section===key)b.setAttribute('aria-current','page');b.onclick=()=>{section=key;render();};nav.append(b);}
  const main=$('content');main.replaceChildren();if(section==='preview'){preview(main);}else if(section==='json'){
    main.append(el('h2','Konfiguration als JSON'),el('p','Dieses Profil ist kein eigenständiger Bot. Für den fertigen JavaScript-Export ein passendes Bot-Paket laden.'));
    const area=el('textarea');area.id='profile-json';area.setAttribute('aria-label','Profil-JSON');area.value=JSON.stringify(envelope(descriptor,config),null,2);const apply=el('button','JSON prüfen und übernehmen');apply.onclick=()=>{try{const next=importProfile(descriptor,parseData(area.value));change(()=>{config=next;},true);feedback('JSON übernommen.');}catch(e){feedback(e.message);}};main.append(area,apply);
    const schemaButton=el('button','Aktuelles Schema speichern');schemaButton.style.marginLeft='8px';schemaButton.onclick=()=>download('albot.settings.json',JSON.stringify(descriptor,null,2));main.append(schemaButton);
  }else{if(!descriptor.schema.properties[section])section=sections[0][0];const s=descriptor.schema.properties[section];main.append(el('h2',s.title||section));if(s.description)main.append(el('p',s.description));if(section==='items'&&descriptor.schemaId==='albot.config/v1')drawCatalog(main);schemaField(main,s,[section]);}
  update();
}
async function openData(value){
  if(fileMode==='profile'){const next=importProfile(descriptor,value);change(()=>{config=next;},true);feedback('Profil geladen.');}
  else if(fileMode==='catalog'){
    if(!Array.isArray(value.items)||value.items.length>10000||value.items.some(x=>!x||typeof x.id!=='string'||!/^[a-zA-Z0-9_]+$/.test(x.id)||typeof x.name!=='string'||typeof x.type!=='string')||new Set(value.items.map(x=>x.id)).size!==value.items.length)throw Error('Katalog braucht eindeutige items mit id, name und type.');
    catalog={version:String(value.version??'benutzerdefiniert'),items:value.items};selected.clear();render();feedback('Item-Katalog geladen. Regeln bleiben erhalten.');
  }else{
    let nextDescriptor, nextRuntime=null;
    if(value.format==='albot-package'){await checkPackage(value);nextDescriptor=value.descriptor;nextRuntime=value.runtime;}else nextDescriptor=checkDescriptor(value);
    const additions=[];
    let next=addMissingDefaults(nextDescriptor.schema,config,'',additions);
    // Only explicit migrations supplied as profile data are accepted. Never
    // silently drop unknown fields or infer changed semantics from equal names.
    const errors=validateProfile(nextDescriptor,next);
    if(nextDescriptor.schemaId!==descriptor.schemaId||errors.length){
      const main=$('content');main.replaceChildren(el('h2','Schemawechsel vorbereiten'),el('p','Das neue Schema passt nicht vollständig zu diesem Profil. Sichere dein bisheriges Profil, bevor du ein neues anlegst. Bestehende Werte werden nicht stillschweigend verworfen.'));
      const save=el('button','Bisherigen Entwurf sichern');save.onclick=()=>download('albot-previous-draft.json',JSON.stringify(envelope(descriptor,config),null,2));const accept=el('button','Neues Schema mit Vorgaben öffnen','primary');accept.onclick=()=>{descriptor=structuredClone(nextDescriptor);runtime=nextRuntime;config=defaultsFor(descriptor.schema);history=[];future=[];section=Object.keys(descriptor.schema.properties)[0];dirty=true;render();feedback('Neues Schema geöffnet. Voriges Profil kann mit seinem ursprünglichen Schema erneut geladen werden.');};const cancel=el('button','Abbrechen');cancel.onclick=render;main.append(save,accept,cancel);feedback('Schemawechsel benötigt eine ausdrückliche Auswahl.');return;
    }
    if(additions.length){
      const main=$('content');main.replaceChildren(el('h2','Neue Einstellungen ergänzen'),el('p','Deine bestehenden Werte bleiben erhalten. Folgende neue Felder erhalten die Schema-Vorgaben: '+additions.join(', ')));
      const accept=el('button','Ergänzungen übernehmen','primary'),cancel=el('button','Abbrechen');
      accept.onclick=()=>{descriptor=structuredClone(nextDescriptor);runtime=nextRuntime;config=next;history=[];future=[];render();feedback('Schema ergänzt; bestehende Werte erhalten.');};cancel.onclick=render;main.append(accept,cancel);return;
    }
    descriptor=structuredClone(nextDescriptor);runtime=nextRuntime;history=[];future=[];render();feedback(runtime?'Bot-Paket geprüft und geladen. Der Code wurde nicht ausgeführt.':'Schema geladen. Passendes Bot-Paket für JavaScript-Export erforderlich.');
  }
}
function pick(mode){fileMode=mode;$('file').click();}
$('import-profile').onclick=()=>pick('profile');$('import-package').onclick=()=>pick('package');$('catalog-import').onclick=()=>pick('catalog');
$('file').onchange=async()=>{try{const f=$('file').files[0];if(f){if(f.size>8*1024*1024)throw Error('Datei größer als 8 MiB.');await openData(parseData(await f.text()));}}catch(e){feedback('Import fehlgeschlagen: '+e.message);}finally{$('file').value='';}};
$('save-profile').onclick=()=>{const errors=validateProfile(descriptor,config);if(errors.length)return feedback(errors.join('\n'));download('albot-profile.json',JSON.stringify(envelope(descriptor,config),null,2));dirty=false;feedback('Profil exportiert.');};
$('download-bot').onclick=()=>{try{const result=exportBundle(descriptor,config,runtime);download('bot.js',result.code,'text/javascript;charset=utf-8');feedback('bot.js exportiert: '+result.bytes+' UTF-8-Bytes. Im Browser-CODE oder als lokale CODE-Datei laden.');}catch(e){feedback(e.message);}};
$('show-json').onclick=()=>{section='json';render();};$('undo').onclick=()=>{future.push(JSON.stringify(config));config=JSON.parse(history.pop());dirty=true;render();};$('redo').onclick=()=>{history.push(JSON.stringify(config));config=JSON.parse(future.pop());dirty=true;render();};$('nav-search').oninput=render;
window.addEventListener('beforeunload',()=>{try{localStorage.setItem(STORAGE,JSON.stringify({descriptor,config}));}catch{}});
render();if(draftMessages.length)feedback(draftMessages.join('\n'));
