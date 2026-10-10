export function findRecipe(G,item,alias=''){
 const entries=alias?[[alias,G.craft?.[alias]]]:Object.entries(G.craft??{});
 for(const [key,recipe] of entries)if(recipe&&(recipe.output?.name??key)===item)return {key,recipe};return null;
}
// The game's craft(i0,...,i8) API takes ONE inventory slot per recipe
// position. Keep that positional representation distinct from the aggregated
// material demand used by the production planner.
function parsedRecipeRows(recipe){
 if(!Array.isArray(recipe?.items)||recipe.items.length<1)throw Error('Ungültige Rezeptzutaten');
 return recipe.items.map(row=>{
  if(!Array.isArray(row)||!Number.isSafeInteger(row[0])||row[0]<1||
     typeof row[1]!=='string'||!row[1]||!Number.isSafeInteger(row[2]??0)||(row[2]??0)<0)
   throw Error('Ungültige Rezeptzutat');
  return {quantity:row[0],item:row[1],level:row[2]??0};
 });
}
export function recipeGridIngredients(recipe){
 const rows=parsedRecipeRows(recipe);
 if(rows.length>9)throw Error('Ungültiges Rezeptgitter (maximal 9 Positionen)');
 return rows;
}
export function recipeIngredients(recipe){
 const result=[];
 // Resource planning is allowed to inspect overwide *hypothetical* recipes
 // so its existing dependency and 256-node bounds can reject them. Only the
 // actual craft(i0,...,i8) dispatch is limited to nine grid positions.
 for(const row of parsedRecipeRows(recipe)){
  const previous=result.find(x=>x.item===row.item);
  if(previous){
   if(previous.level!==row.level)throw Error('Rezept mit mehreren Leveln derselben Zutat nicht ausführbar');
   if(!Number.isSafeInteger(previous.quantity+row.quantity))throw Error('Rezeptmenge überschreitet sichere Ganzzahl');
   previous.quantity+=row.quantity;
  }else result.push({...row});
 }
 return result;
}
