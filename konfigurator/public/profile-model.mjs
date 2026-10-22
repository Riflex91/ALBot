// Typed, schema-derived edits of the private GitHub profile. No game actions,
// local credential storage, automatic profile creation or runtime activation.
export const PROFILE_VIEWS=Object.freeze({
 combat:['skills','rules'],
 farming:['farming','world'],
 merchant:['merchant','production'],
 team:['party','characters']
});
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const forbidden=new Set(['__proto__','prototype','constructor']);
export const profileView=view=>own(PROFILE_VIEWS,view);

export function checkedProfileDocument(document,descriptor){
 if(!descriptor||descriptor.schemaId!=='albot.full/v1'||
   descriptor.schema?.type!=='object'||!descriptor.schema.properties)
  throw Error('Das vollständige ALBot-Konfigurationsschema ist nicht verfügbar.');
 if(!document||document.format!=='albot-profile'||document.formatVersion!==1||
   document.schemaId!==descriptor.schemaId||!document.config||
   typeof document.config!=='object'||Array.isArray(document.config))
  throw Error('Das GitHub-Profil ist nicht mit dem aktuellen Full-v1-Schema kompatibel.');
 return structuredClone(document);
}

export function schemaNode(schema,path=[]){
 let node=schema;
 for(const segment of path){
  if(node?.type==='object'&&typeof segment==='string'&&
    !forbidden.has(segment)&&own(node.properties??{},segment))
   node=node.properties[segment];
  else if(node?.type==='array'&&Number.isSafeInteger(segment)&&segment>=0)
   node=node.items;
  else throw Error('Unbekannter Profilpfad');
 }
 return node;
}
export function defaultField(schema,depth=0){
 if(!schema||depth>14)throw Error('Ungültige Profilstruktur');
 if(own(schema,'default'))return structuredClone(schema.default);
 if(schema.type==='array')return [];
 if(schema.type==='object')return Object.fromEntries(
  Object.entries(schema.properties??{}).map(([name,part])=>
   [name,defaultField(part,depth+1)]));
 if(schema.type==='boolean')return false;
 if(schema.type==='string')return schema.enum?.[0]??'';
 return schema.minimum??0;
}

export function profileValue(document,descriptor,path=[]){
 const schema=schemaNode(descriptor.schema,path);
 let value=document?.config;
 for(const segment of path){
  if(value===undefined||value===null||!own(value,segment))
   return defaultField(schema);
  value=value[segment];
 }
 return value===undefined?defaultField(schema):value;
}
export function scalarValue(schema,input){
 if(schema.type==='boolean'){
  if(typeof input!=='boolean')throw Error('Ja/Nein erwartet');
  return input;
 }
 if(schema.type==='string'){
  if(typeof input!=='string'||input.length<(schema.minLength??0)||
    input.length>(schema.maxLength??Infinity)||schema.enum&&!schema.enum.includes(input))
   throw Error('Ungültiger Text oder Auswahlwert');
  return input;
 }
 if(schema.type==='number'||schema.type==='integer'){
  if(typeof input!=='string'&&typeof input!=='number'||
    String(input).trim()==='')throw Error('Eine Zahl ist erforderlich');
  const value=Number(input);
  if(!Number.isFinite(value)||schema.type==='integer'&&!Number.isSafeInteger(value)||
    value<(schema.minimum??-Infinity)||value>(schema.maximum??Infinity))
   throw Error('Zahl außerhalb der gültigen Grenzen');
  return value;
 }
 throw Error('Das Feld ist nicht direkt bearbeitbar');
}
function writePath(document,descriptor,path,value){
 schemaNode(descriptor.schema,path);
 if(!Array.isArray(path)||path.length<1)throw Error('Profilwurzel nicht veränderbar');
 let obj=document.config,atSchema=descriptor.schema;
 for(let index=0;index<path.length-1;index++){
  const key=path[index];
  atSchema=schemaNode(atSchema,[key]);
  if(!own(obj,key)||obj[key]===undefined||obj[key]===null)
   obj[key]=defaultField(atSchema);
  obj=obj[key];
  if(!obj||typeof obj!=='object')throw Error('Profil enthält einen ungültigen Zwischenwert');
 }
 obj[path.at(-1)]=value;
 return document;
}
export function setProfileScalar(document,descriptor,path,input){
 const node=schemaNode(descriptor.schema,path);
 return writePath(document,descriptor,path,scalarValue(node,input));
}
export function addProfileArrayItem(document,descriptor,path){
 const s=schemaNode(descriptor.schema,path);
 if(s.type!=='array')throw Error('Keine Liste');
 const previous=profileValue(document,descriptor,path);
 if(!Array.isArray(previous)||previous.length>=(s.maxItems??2000))
  throw Error('Listenlimit erreicht');
 // Clone the list to avoid side effects on a previously captured snapshot.
 return writePath(document,descriptor,path,[...previous,defaultField(s.items)]);
}
export function removeProfileArrayItem(document,descriptor,path,index){
 const s=schemaNode(descriptor.schema,path);
 const previous=profileValue(document,descriptor,path);
 if(s.type!=='array'||!Array.isArray(previous)||!Number.isInteger(index)||
   index<0||index>=previous.length)throw Error('Ungültiger Listeneintrag');
 const next=previous.filter((_,i)=>i!==index);
 if(next.length<(s.minItems??0))throw Error('Mindestanzahl von Einträgen unterschritten');
 return writePath(document,descriptor,path,next);
}
export function profileEnvelope(document){
 return {format:'albot-profile',formatVersion:1,
  schemaId:document.schemaId,config:document.config};
}
