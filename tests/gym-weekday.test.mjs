import test from "node:test";
import assert from "node:assert/strict";
import { gymWeekDay } from "../src/services/gymDate.js";

test("the training day follows Argentina before UTC midnight changes the weekday", () => {
  assert.equal(gymWeekDay("2026-09-28T01:30:00Z"), 7);
  assert.equal(gymWeekDay("2026-09-28T03:30:00Z"), 1);
});

test("weekday calculation is independent of the device timezone", () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ["UTC", "Asia/Tokyo", "America/Los_Angeles"]) {
      process.env.TZ = zone;
      assert.equal(gymWeekDay("2026-09-30T02:59:59Z"), 2);
      assert.equal(gymWeekDay("2026-09-30T03:00:00Z"), 3);
    }
  } finally {
    if (previous == null) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
