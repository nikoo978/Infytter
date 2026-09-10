// Calendar rules belong to the gym, regardless of the PC/browser time zone.
export const GYM_TIME_ZONE = "America/Argentina/Buenos_Aires";
const DAY_MS = 86_400_000;
const gymDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: GYM_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});

function calendarDay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.getTime() / DAY_MS;
}

function instant(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  // Stored access events must include their offset; never infer the PC's zone.
  if (typeof value !== "string" || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  if (calendarDay(value.slice(0, 10)) === null) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function gymDay(value) {
  const date = instant(value);
  if (!date) return null;
  const parts = Object.fromEntries(gymDateFormatter.formatToParts(date).map(({ type, value: part }) => [type, part]));
  return calendarDay(`${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}`);
}

export function daysUntilExpiry(expiry, now = new Date()) {
  const expiryDay = calendarDay(expiry);
  const today = gymDay(now);
  return expiryDay === null || today === null ? null : expiryDay - today;
}

export function statusOf(person, now = new Date()) {
  if (person?.role === "Profesor") return "Vigente";
  const days = daysUntilExpiry(person?.expiry, now);
  if (days === null || days < 0) return "Vencida";
  return days <= 7 ? "Por vencer" : "Vigente";
}

// Input must already be scoped to one person (e.g. the authenticated client RPC).
export function weeklyAccessUsage(accesses, now = new Date()) {
  const checkedAt = instant(now);
  const today = gymDay(now);
  if (today === null) throw new RangeError("Fecha de control de acceso inválida.");
  const weekday = new Date(today * DAY_MS).getUTCDay();
  const monday = today - ((weekday + 6) % 7);
  const days = new Set();
  for (const access of accesses) {
    if (!access?.allowed || access.manual) continue;
    const date = instant(access.date);
    if (!date || date > checkedAt) continue;
    const day = gymDay(date);
    if (day !== null && day >= monday && day < monday + 7) days.add(day);
  }
  const alreadyEnteredToday = days.has(today);
  return { usedDays: days.size, alreadyEnteredToday, limitReached: days.size >= 3 && !alreadyEnteredToday };
}

export function planUsage(person, accesses, now = new Date()) {
  if (person?.plan !== "3 días") return { usedDays: 0, limitReached: false, alreadyEnteredToday: false };
  return weeklyAccessUsage(accesses.filter((access) => access?.personId === person.id), now);
}
