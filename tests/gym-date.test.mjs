import test from "node:test";
import assert from "node:assert/strict";
import { addCalendarDays, addCalendarMonths, gymDateISO, isCalendarDate } from "../src/services/gymDate.js";

test("usa el día argentino aunque UTC ya haya cambiado", () => {
  assert.equal(gymDateISO(new Date("2026-09-14T02:30:00Z")), "2026-09-13");
  assert.equal(gymDateISO(new Date("2026-09-14T03:30:00Z")), "2026-09-14");
});

test("suma días sin depender de la zona horaria de la PC", () => {
  assert.equal(addCalendarDays("2026-12-31", 1), "2027-01-01");
});

test("suma meses conservando el último día válido", () => {
  assert.equal(addCalendarMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addCalendarMonths("2028-01-31", 1), "2028-02-29");
  assert.equal(addCalendarMonths("2026-12-15", 2), "2027-02-15");
});

test("rechaza fechas de calendario imposibles", () => {
  assert.equal(isCalendarDate("2026-02-29"), false);
  assert.throws(() => addCalendarMonths("2026-02-29", 1), /inválida/);
});
