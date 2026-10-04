import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesRecipe, recipePayload, safeRecipeImage } from '../src/services/recipePolicy.js';
import { readFileSync, readdirSync } from 'node:fs';
const form = { title:' Avena ', category:'Desayunos', ingredients:'50 g avena\n\n100 ml leche', steps:'Mezclar\nCocinar', image_url:'/images/recipes/1.webp', minutes:'10', protein_g:'2.5' };
test('recetas: búsqueda por todos los términos, ingredientes y acentos', () => {
  const r={title:'Tortitas de plátano',category:'Desayunos',ingredients:['Harina de espelta']};
  assert.equal(matchesRecipe(r,'platano espelta'),true);
  assert.equal(matchesRecipe(r,'platano atun'),false);
});
test('recetas: valida valores opcionales, listas e imágenes seguras', () => {
  const p=recipePayload(form); assert.equal(p.title,'Avena'); assert.equal(p.protein_g,2.5);assert.equal(p.fat_g,null);assert.equal(p.is_hidden,false);assert.equal(p.ingredients.length,2);
  for (const change of [{title:''},{steps:''},{ingredients:''},{minutes:1.5},{protein_g:-1},{carbs_g:'Infinity'},{image_url:'javascript:alert(1)'}]) assert.throws(()=>recipePayload({...form,...change}));
  for (const url of ['data:image/svg+xml,test','http://example.com/a.png','https://user:secret@example.com/a.png','//example.com/a.png']) assert.equal(safeRecipeImage(url),'');
  assert.equal(safeRecipeImage('https://example.com/a.webp'),'https://example.com/a.webp');
});
test('importación completa: 99 recetas con pasos y sus fotos; ninguna duplicada', () => {
  const name=readdirSync('supabase/migrations').find(n=>n.endsWith('_recipes_catalog.sql'));
  const sql=readFileSync('supabase/migrations/'+name,'utf8');
  const recipes=JSON.parse(sql.split('$recetas$')[1]);
  assert.equal(recipes.length,99);assert.equal(new Set(recipes.map(r=>r.source_key)).size,99);
  for(const r of recipes) { assert.ok(r.ingredients.length && r.steps.length);assert.ok(readFileSync('public'+r.image_url).length>0);assert.ok(r.steps.every(s=>!/^\d+\.\s/.test(s))); }
});
