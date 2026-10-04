export const ANATOMY_GENDER_KEY = "infytter.anatomy.gender";
const listeners = new Set();
let memory = "male";
let listening = false;
const valid = (value) => value === "male" || value === "female";
export function readAnatomyGender() {
  try {
    const stored = window.localStorage.getItem(ANATOMY_GENDER_KEY);
    if (valid(stored)) memory = stored;
  } catch { /* Storage may be unavailable; keep the in-session preference. */ }
  return memory;
}
const emit = () => listeners.forEach((listener) => listener());
export function setAnatomyGender(value) {
  if (!valid(value)) return;
  memory = value;
  try { window.localStorage.setItem(ANATOMY_GENDER_KEY, value); } catch { /* Keep working without storage. */ }
  emit();
}
const onStorage = (event) => {
  if (event.key === ANATOMY_GENDER_KEY || event.key === null) {
    memory = valid(event.newValue) ? event.newValue : "male";
    emit();
  }
};
export function subscribeAnatomyGender(listener) {
  listeners.add(listener);
  if (!listening && typeof window !== "undefined") { window.addEventListener("storage", onStorage); listening = true; }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && listening) { window.removeEventListener("storage", onStorage); listening = false; }
  };
}
