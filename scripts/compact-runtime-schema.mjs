import {parse} from 'acorn';
// Workshop metadata remains in source, settings JSON and editor/package.
// CODE only needs validation, defaults and the stable schema/field IDs.
// Never compact user-provided defaults or item-variant title fields.
export function compactRuntimeSchema(source){
 const ast=parse(source,{ecmaVersion:2022,sourceType:'module'}),edits=[];
 const types=new Set(['object','array','string','boolean','integer','number']),
  presentation=new Set(['title','description','x-labels','x-catalog']);
 const key=p=>p.key?.name??p.key?.value;
 function walk(node,inDefault=false){
  if(!node||typeof node!=='object')return;
  if(node.type==='ObjectExpression'&&!inDefault){
   const properties=node.properties;
   const typed=properties.some(p=>p.type==='Property'&&key(p)==='type'&&types.has(p.value?.value));
   if(typed)for(let i=0;i<properties.length;i++){
    const p=properties[i];if(p.type!=='Property'||!presentation.has(key(p)))continue;
    const next=properties[i+1],previous=properties[i-1];
    edits.push(next?{start:p.start,end:next.start}:
     previous?{start:previous.end,end:p.end}:{start:p.start,end:p.end});
   }
  }
  for(const [name,value] of Object.entries(node)){
   if(['start','end','loc','raw'].includes(name))continue;
   const nestedDefault=inDefault||node.type==='Property'&&key(node)==='default'&&name==='value';
   if(Array.isArray(value))for(const child of value)walk(child,nestedDefault);
   else if(value&&typeof value==='object')walk(value,nestedDefault);
  }
 }
 walk(ast);
 const merged=[];
 for(const edit of edits.sort((a,b)=>a.start-b.start)){
  const prior=merged.at(-1);
  if(prior&&edit.start<=prior.end)prior.end=Math.max(prior.end,edit.end);
  else merged.push({...edit});
 }
 let result=source;
 for(const edit of merged.reverse())result=result.slice(0,edit.start)+result.slice(edit.end);
 parse(result,{ecmaVersion:2022,sourceType:'module'});
 return result;
}
