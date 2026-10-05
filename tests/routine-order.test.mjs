import test from 'node:test';
import assert from 'node:assert/strict';
import { reorderRoutineItems } from '../src/services/routineOrder.js';
test('mover adelante y atrás conserva todos los datos y no muta la rutina', () => {
 const items=[{exercise_id:'a',sets:3,notes:'Control',rest_seconds:60},{exercise_id:'b',sets:4},{exercise_id:'c',reps:'12'}];
 const next=reorderRoutineItems(items,0,2);
 assert.deepEqual(next.map(i=>i.exercise_id),['b','c','a']);
 assert.equal(next[2],items[0]);
 assert.deepEqual(items.map(i=>i.exercise_id),['a','b','c']);
 assert.deepEqual(reorderRoutineItems(next,2,0),items);
});
test('destinos inválidos o sin cambio dejan la rutina intacta', () => {
 const items=[{exercise_id:'a'}];
 for (const [from,to] of [[0,0],[-1,0],[0,1],[0,null],[.5,0]]) assert.equal(reorderRoutineItems(items,from,to),items);
});
