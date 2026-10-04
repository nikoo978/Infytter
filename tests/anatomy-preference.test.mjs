import test from "node:test";
import assert from "node:assert/strict";
import { ANATOMY_GENDER_KEY, readAnatomyGender, setAnatomyGender, subscribeAnatomyGender } from "../src/services/anatomyPreference.js";
test("anatomy choice persists, synchronizes subscribers/tabs and survives blocked storage", () => {
  const previous = globalThis.window;
  const values = new Map(); const events = new Map();
  globalThis.window = { localStorage: { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) }, addEventListener: (key, cb) => events.set(key, cb), removeEventListener: (key) => events.delete(key) };
  try {
    let count = 0;
    const unsubscribe = subscribeAnatomyGender(() => count++);
    setAnatomyGender("female");
    assert.equal(readAnatomyGender(), "female");
    assert.equal(values.get(ANATOMY_GENDER_KEY), "female");
    assert.equal(count, 1);
    setAnatomyGender("invalid"); assert.equal(count, 1);
    values.set(ANATOMY_GENDER_KEY, "male");
    events.get("storage")({ key: ANATOMY_GENDER_KEY, newValue: "male" });
    assert.equal(readAnatomyGender(), "male"); assert.equal(count, 2);
    window.localStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    setAnatomyGender("female"); assert.equal(readAnatomyGender(), "female");
    unsubscribe(); assert.equal(events.size, 0);
  } finally { globalThis.window = previous; }
});
