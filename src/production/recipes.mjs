export function findRecipe(G,item,alias=''){
 const entries=alias?[[alias,G.craft?.[alias]]]:Object.entries(G.craft??{});
 for(const [key,recipe] of entries)if(recipe&&(recipe.output?.name??key)===item)return {key,recipe};return null;
}
// The game's craft(i0,...,i8) API takes ONE inventory slot per recipe
// position. Keep that positional representation distinct from the aggregated
// material demand used by the production planner.
export function recipeGridIngredients(recipe){
 if(!Array.isArray(recipe?.items)||recipe.items.length<1||recipe.items.length>9)throw Error('Ungültiges Rezeptgitter');
 return recipe.items.map(row=>{
  if(!Array.isArray(row)||!Number.isSafeInteger(row[0])||row[0]<1||
     typeof row[1]!=='string'||!row[1]||!Number.isSafeInteger(row[2]??0)||(row[2]??0)<0)
   throw Error('Ungültige Rezeptzutat');
  return {quantity:row[0],item:row[1],level:row[2]??0};
 });
}
export function recipeIngredients(recipe){
 const result=[];
 for(const row of recipeGridIngredients(recipe)){
  const previous=result.find(x=>x.item===row.item);
  if(previous){
   if(previous.level!==row.level)throw Error('Rezept mit mehreren Leveln derselben Zutat nicht ausführbar');
   if(!Number.isSafeInteger(previous.quantity+row.quantity))throw Error('Rezeptmenge überschreitet sichere Ganzzahl');
   previous.quantity+=row.quantity;
  }else result.push({...row});
 }
 return result;
}
