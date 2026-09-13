function escapedRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function archivePersonRecord(person, { at, actorId = null, actorName = "Usuario", reason = "" }) {
  return {
    ...person,
    archivedAt: at,
    archivedBy: actorId,
    archivedByName: actorName,
    archivedReason: String(reason || "").trim(),
  };
}

export function restorePersonRecord(person) {
  const { archivedAt, archivedBy, archivedByName, archivedReason, ...active } = person;
  return active;
}

export function permanentlyDeletePerson(state, person) {
  const pattern = escapedRegExp(person?.name);
  const anonymize = (value) => pattern ? String(value || "").replace(new RegExp(pattern, "gi"), "Cliente eliminado") : value;
  return {
    ...state,
    people: (state.people || []).filter((item) => item.id !== person.id),
    transactions: (state.transactions || []).map((item) => item.personId === person.id
      ? { ...item, personId: null, detail: anonymize(item.detail), deletedPerson: true }
      : item),
    accesses: (state.accesses || []).map((item) => item.personId === person.id
      ? { ...item, personId: null, deletedPerson: true }
      : item),
    notificationLog: (state.notificationLog || []).map((item) => ({ ...item, body: anonymize(item.body) })),
  };
}
