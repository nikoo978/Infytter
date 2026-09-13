import test from "node:test";
import assert from "node:assert/strict";
import { archivePersonRecord, permanentlyDeletePerson, restorePersonRecord } from "../src/services/personLifecycle.js";

const person = { id: "p1", name: "Ana Pérez", dni: "123", role: "Cliente", branch: "centro" };

test("archivar conserva la ficha y restaurar elimina sólo los metadatos de archivo", () => {
  const archived = archivePersonRecord(person, { at: "2026-09-13T12:00:00Z", actorId: "u1", actorName: "Admin", reason: "Baja temporal" });
  assert.equal(archived.archivedReason, "Baja temporal");
  assert.equal(archived.dni, "123");
  assert.deepEqual(restorePersonRecord(archived), person);
});

test("eliminar quita la ficha, conserva contabilidad y anonimiza referencias", () => {
  const state = {
    people: [person, { id: "p2", name: "Otra" }],
    transactions: [{ id: "t1", personId: "p1", detail: "Renovación · Ana Pérez", amount: 100 }],
    accesses: [{ id: "a1", personId: "p1", allowed: true }],
    notificationLog: [{ id: "n1", body: "Ana Pérez ingresó al gimnasio." }],
    closures: [{ id: "c1", expected: 100 }],
  };
  const next = permanentlyDeletePerson(state, person);
  assert.deepEqual(next.people.map((item) => item.id), ["p2"]);
  assert.equal(next.transactions[0].personId, null);
  assert.equal(next.transactions[0].detail, "Renovación · Cliente eliminado");
  assert.equal(next.accesses[0].personId, null);
  assert.equal(next.notificationLog[0].body, "Cliente eliminado ingresó al gimnasio.");
  assert.deepEqual(next.closures, state.closures);
});
