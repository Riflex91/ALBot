import {PROFILE_VIEWS,profileValue,profileView} from './profile-model.mjs';

// Construct nodes with textContent: saved GitHub values are untrusted data.
const make=(tag,text,cls)=>{
 const el=document.createElement(tag);
 if(text!==undefined)el.textContent=String(text);
 if(cls)el.className=cls;
 return el;
};
const compactPath=path=>path.map(String).join('.');

export function renderProfileSections(target,{document:profile,descriptor,view,editable,
 onField,onAdd,onRemove}){
 if(!profileView(view))throw Error('Unbekannter Profilbereich');
 const sections=PROFILE_VIEWS[view];
 for(const key of sections){
  const schema=descriptor.schema.properties[key];
  if(!schema)throw Error('Profilbereich fehlt im Schema: '+key);
  const root=make('section',undefined,'card profile-section');
  root.append(make('h2',schema.title??key));
  if(schema.description)root.append(make('p',schema.description,'help'));
  renderValue(root,schema,[key],profileValue(profile,descriptor,[key]),2);
  target.append(root);
 }
 function renderValue(parent,schema,path,value,depth){
  if(depth>13)return parent.append(make('p','Dieser Bereich ist zu tief; klassische Werkstatt verwenden.','help'));
  if(schema.type==='object'){
   const grid=make('div',undefined,'form-grid profile-fields');
   for(const [key,field] of Object.entries(schema.properties??{})){
    const childPath=[...path,key];
    let v=value&&Object.prototype.hasOwnProperty.call(value,key)?value[key]:undefined;
    if(v===undefined)v=profileValue(profile,descriptor,childPath);
    if(field.type==='object'||field.type==='array'){
     const block=make('div',undefined,'profile-nested');
     if(field.type==='object'){
      const legend=make('h3',field.title??key);
      block.append(legend);
      if(field.description)block.append(make('p',field.description,'help'));
     }
     renderValue(block,field,childPath,v,depth+1);
     parent.append(block);
    }else renderScalar(grid,field,childPath,v);
   }
   if(grid.children.length)parent.append(grid);
  }else if(schema.type==='array'){
   const list=make('div',undefined,'profile-list');
   const header=make('div',undefined,'profile-list-header');
   const rows=Array.isArray(value)?value:[];
   const title=make('h3',schema.title??path.at(-1));
   title.append(make('span',' ('+rows.length+')','muted'));
   const add=make('button','+ Hinzufügen','button');
   add.type='button';add.disabled=!editable||rows.length>=(schema.maxItems??2000);
   add.onclick=()=>onAdd(path);
   header.append(title,add);list.append(header);
   if(schema.description)list.append(make('p',schema.description,'help'));
   if(rows.length===0)list.append(make('p','Keine Einträge.','help'));
   for(let index=0;index<Math.min(rows.length,80);index++){
    const entry=rows[index],row=make('div',undefined,'profile-list-row');
    const bar=make('div',undefined,'profile-list-header');
    let caption='#'+(index+1);
    if(entry&&typeof entry==='object'&&!Array.isArray(entry))
     caption+=' · '+String(entry.name??entry.skill??entry.item??'').slice(0,80);
    const remove=make('button','Entfernen','button danger');
    remove.type='button';remove.disabled=!editable;
    remove.onclick=()=>onRemove(path,index);
    if(schema.items.type==='object'||schema.items.type==='array'){
     const details=make('details',undefined,'profile-entry');
     const summary=make('summary',caption);details.append(summary);
     renderValue(details,schema.items,[...path,index],entry,depth+1);
     bar.append(details,remove);
    }else{
     bar.append(make('span',caption,'muted'));
     const values=make('div',undefined,'profile-inline');
     renderScalar(values,schema.items,[...path,index],entry);
     bar.append(values,remove);
    }
    row.append(bar);list.append(row);
   }
   if(rows.length>80)list.append(make('p',
    'Nur 80 von '+rows.length+' Einträgen sichtbar. Für weitere Einträge die klassische Werkstatt verwenden.','help'));
   parent.append(list);
  }else renderScalar(parent,schema,path,value);
 }
 function renderScalar(parent,schema,path,value){
  const label=make('label',undefined,'field profile-field');
  label.append(make('span',schema.title??compactPath(path)));
  let input;
  if(schema.type==='boolean'){
   input=make('input');input.type='checkbox';input.checked=value===true;
  }else if(Array.isArray(schema.enum)){
   input=make('select');
   for(const option of schema.enum){
    const text=schema['x-labels']?.[option]??option;
    const child=make('option',text);child.value=option;input.append(child);
   }
   input.value=String(value??'');
  }else{
   input=make('input');
   input.type=['integer','number'].includes(schema.type)?'number':'text';
   if(schema.type==='number'||schema.type==='integer'){
    input.step=schema.type==='integer'?'1':'any';
    if(Number.isFinite(schema.minimum))input.min=String(schema.minimum);
    if(Number.isFinite(schema.maximum))input.max=String(schema.maximum);
   }else{
    if(Number.isFinite(schema.maxLength))input.maxLength=schema.maxLength;
   }
   input.value=value===undefined||value===null?'':String(value);
  }
  input.disabled=!editable;
  const error=make('small',undefined,'profile-field-error');
  error.hidden=true;
  input.addEventListener('change',()=>{
   const raw=schema.type==='boolean'?input.checked:input.value;
   const message=onField(path,raw);
   error.textContent=message??'';
   error.hidden=!message;
   input.setAttribute('aria-invalid',message?'true':'false');
  });
  label.append(input,error);
  parent.append(label);
 }
}
