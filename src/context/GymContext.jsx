"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../services/supabase";
import { getCloudState, getWalOperations, recoverWalOperations, setCloudState, stagePendingOperations, unstagePendingOperations } from "../services/storage";
import { applyOperationsLocally, buildStateOperations, flushPendingOperations, getDeviceId, pendingOperations, queueStateOperations } from "../services/offlineSync";
import { cancelMembershipNotifications, scheduleMembershipNotifications, sendRemoteEvent } from "../services/notifications";
import { useAuth } from "./AuthContext";
import { daysUntilExpiry, planUsage, statusOf } from "../services/accessPolicy";

export { planUsage, statusOf } from "../services/accessPolicy";

const GymContext = createContext(null);
const iso = (days = 0) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const BRANCH_KEY = "gymflow-active-branch";
const localBranch = () => { try { return localStorage.getItem(BRANCH_KEY); } catch { return null; } };
const defaultNotificationPreferences = {
  newClient: true,
  income: true,
  withdrawal: true,
  expense: true,
  membershipExpiring: true,
  membershipExpired: true,
  clientAccess: false,
  staffAccess: false,
  deniedAccess: true,
  manualAccess: true,
};

const seed = {
  branches: [{ id: "centro", name: "Junín" }, { id: "norte", name: "Chacabuco" }],
  activeBranch: "centro",
  people: [],
  transactions: [],
  accesses: [],
  closures: [],
  notificationPreferences: defaultNotificationPreferences,
  notificationLog: [],
  pushTokens: [],
};

const normalizeData = (value) => ({
  ...seed,
  ...(value || {}),
  branches: Array.isArray(value?.branches) && value.branches.length ? value.branches : seed.branches,
  activeBranch: localBranch() || value?.activeBranch || seed.activeBranch,
  people: Array.isArray(value?.people) ? value.people : [],
  transactions: Array.isArray(value?.transactions) ? value.transactions : [],
  accesses: Array.isArray(value?.accesses) ? value.accesses : [],
  closures: Array.isArray(value?.closures) ? value.closures : [],
  notificationPreferences: { ...defaultNotificationPreferences, ...value?.notificationPreferences },
  notificationLog: value?.notificationLog || [],
  pushTokens: value?.pushTokens || [],
});

const showDeviceNotification = (title, body) => {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
  navigator.serviceWorker?.ready.then((registration) => registration.showNotification(title, { body, icon: "/favicon.svg", badge: "/favicon.svg" })).catch(() => undefined);
};

export function GymProvider({ children }) {
  const { user, isCloud, isLocal, isOnline, exitLocalMode, permissions } = useAuth();
  const [data, setData] = useState(seed);
  const [sync, setSync] = useState("Cargando");
  const [pendingCount, setPendingCount] = useState(0);
  const [storageReady, setStorageReady] = useState(false);
  const loadedIdentity = useRef("");
  const dataRef = useRef(seed);
  const syncingRef = useRef(false);
  const flushTimerRef = useRef(null);
  const volatileOpsRef = useRef([]);
  const deviceIdRef = useRef(null);

  if (!deviceIdRef.current && typeof window !== "undefined") deviceIdRef.current = getDeviceId();

  const replaceData = (value) => {
    const next = normalizeData(value);
    dataRef.current = next;
    setData(next);
    return next;
  };

  const localUnsentOperations = async (userId = user?.id) => {
    if (!userId) return [];
    const persisted = await pendingOperations(userId).catch(() => []);
    const wal = getWalOperations(userId);
    const combined = [...persisted, ...wal, ...volatileOpsRef.current];
    const unique = new Map();
    combined.forEach((operation) => unique.set(operation.id, operation));
    return [...unique.values()].sort((a, b) => Number(a.queuedAt || 0) - Number(b.queuedAt || 0));
  };

  const refreshPendingCount = async (userId = user?.id) => {
    if (!userId) { setPendingCount(0); return 0; }
    const count = (await localUnsentOperations(userId)).length;
    setPendingCount(count);
    return count;
  };

  const syncPendingNow = async () => {
    if (!user?.id || !storageReady || syncingRef.current) return false;
    if (!permissions?.isStaff) { setSync("Cuenta cliente"); return false; }
    if (!isOnline) {
      const count = await refreshPendingCount(user.id);
      setSync(isLocal ? `Modo local · ${count} pendiente${count === 1 ? "" : "s"}` : `Sin conexión · ${count} pendiente${count === 1 ? "" : "s"}`);
      return false;
    }

    syncingRef.current = true;
    try {
      await recoverWalOperations(user.id).catch(() => undefined);
      setSync(isLocal ? "Reconectando…" : "Sincronizando…");
      let remoteState = null;
      let sentAny = false;

      while (true) {
        const pending = await pendingOperations(user.id);
        if (!pending.length) break;
        const result = await flushPendingOperations(user.id, 200);
        if (!result.sent) break;
        sentAny = true;
        remoteState = result.remoteState || remoteState;

        const remaining = await localUnsentOperations(user.id);
        if (remoteState) {
          const merged = applyOperationsLocally(normalizeData(remoteState), remaining);
          replaceData(merged);
          await setCloudState(user.id, merged).catch(() => undefined);
        }
      }

      if (!sentAny) {
        const { data: remote, error } = await supabase.rpc("gf_get_gym_state");
        if (error) throw error;
        remoteState = remote || seed;
      }

      const remaining = await localUnsentOperations(user.id);
      const finalState = remoteState ? applyOperationsLocally(normalizeData(remoteState), remaining) : dataRef.current;
      replaceData(finalState);
      await setCloudState(user.id, finalState).catch(() => undefined);
      setPendingCount(remaining.length);

      if (remaining.length) {
        setSync(`${remaining.length} cambio${remaining.length === 1 ? "" : "s"} pendiente${remaining.length === 1 ? "" : "s"}`);
        return false;
      }

      setSync("Sincronizado");
      if (isLocal) exitLocalMode();
      return true;
    } catch {
      const count = await refreshPendingCount(user.id);
      setSync(isLocal
        ? `Modo local · ${count} pendiente${count === 1 ? "" : "s"}`
        : count ? `Sin conexión · ${count} pendiente${count === 1 ? "" : "s"}` : "Sin conexión");
      return false;
    } finally {
      syncingRef.current = false;
    }
  };

  useEffect(() => {
    let active = true;
    const identity = user?.id ? `${isLocal ? "local" : isCloud ? "cloud" : "none"}:${user.id}` : "none";
    loadedIdentity.current = identity;
    setStorageReady(false);
    setSync(isLocal ? "Cargando modo local" : isCloud ? "Conectando" : "Sin sesión");

    (async () => {
      if (isCloud && user?.id && !permissions?.isStaff) {
        if (!active || loadedIdentity.current !== identity) return;
        replaceData(seed);
        setPendingCount(0);
        setSync("Cuenta cliente");
        setStorageReady(true);
        return;
      }

      if ((isLocal || isCloud) && user?.id) {
        const cached = await getCloudState(user.id).catch(() => null);
        await recoverWalOperations(user.id).catch(() => undefined);
        const queued = await pendingOperations(user.id).catch(() => []);
        if (cached && active && loadedIdentity.current === identity) replaceData(applyOperationsLocally(normalizeData(cached), queued));
        setPendingCount(queued.length);

        if (isLocal) {
          if (!active || loadedIdentity.current !== identity) return;
          replaceData(applyOperationsLocally(normalizeData(cached || seed), queued));
          setSync(queued.length ? `Modo local · ${queued.length} pendiente${queued.length === 1 ? "" : "s"}` : "Modo local · protegido");
          setStorageReady(true);
          return;
        }

        try {
          const { data: remoteState, error } = await supabase.rpc("gf_get_gym_state");
          if (error) throw error;
          const remote = normalizeData(remoteState || seed);
          const next = applyOperationsLocally(remote, queued);
          await setCloudState(user.id, next).catch(() => undefined);
          if (!active || loadedIdentity.current !== identity) return;
          replaceData(next);
          setSync(queued.length ? `Sincronizando ${queued.length} pendiente${queued.length === 1 ? "" : "s"}…` : "Sincronizado");
        } catch {
          if (!active || loadedIdentity.current !== identity) return;
          const next = applyOperationsLocally(normalizeData(cached || seed), queued);
          replaceData(next);
          setSync(cached ? (queued.length ? `Sin conexión · ${queued.length} pendiente${queued.length === 1 ? "" : "s"}` : "Sin conexión · caché") : "Sin conexión");
        }
        setStorageReady(true);
        return;
      }

      if (active) {
        replaceData(seed);
        setSync("Sin sesión");
        setStorageReady(true);
      }
    })();

    return () => { active = false; };
  }, [isCloud, isLocal, user?.id, permissions?.isStaff]);

  useEffect(() => {
    if (!storageReady || !user?.id || !permissions?.isStaff || (!isCloud && !isLocal)) return undefined;
    const timer = setTimeout(() => {
      setCloudState(user.id, data).catch(() => undefined);
    }, 80);
    return () => clearTimeout(timer);
  }, [data, storageReady, isCloud, isLocal, user?.id, permissions?.isStaff]);

  useEffect(() => {
    if (!storageReady || !user?.id || !permissions?.isStaff) return undefined;
    const interval = isLocal ? setInterval(() => { syncPendingNow(); }, 10000) : null;
    const initial = isOnline ? setTimeout(() => { syncPendingNow(); }, isLocal ? 200 : 500) : null;
    return () => {
      if (interval) clearInterval(interval);
      if (initial) clearTimeout(initial);
    };
  }, [storageReady, isCloud, isLocal, isOnline, user?.id, permissions?.isStaff]);

  const reminderSignature = data.people
    .filter((person) => person.role === "Cliente")
    .map((person) => `${person.id}|${person.name}|${person.expiry || ""}|${person.branch || ""}`)
    .sort()
    .join(";");

  useEffect(() => {
    if (!isCloud || !storageReady || !permissions?.canManageNotifications) return undefined;
    const timer = setTimeout(() => {
      data.people.filter((person) => person.role === "Cliente" && person.expiry).forEach((person) => {
        scheduleMembershipNotifications(person).catch(() => undefined);
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [reminderSignature, isCloud, storageReady, permissions?.canManageNotifications]);

  const update = (fn) => {
    const before = dataRef.current;
    const after = fn(structuredClone(before));
    let operations = [];

    if (storageReady && user?.id && (isCloud || isLocal)) {
      operations = buildStateOperations(before, after, deviceIdRef.current || getDeviceId());
      if (operations.length) {
        try {
          // WAL sincrónico: el movimiento queda persistido antes de reflejarlo en pantalla.
          stagePendingOperations(user.id, operations);
        } catch {
          setSync("Almacenamiento local lleno · operación cancelada");
          return before;
        }
      }
    }

    dataRef.current = after;
    setData(after);

    if (operations.length) {
      volatileOpsRef.current = [...volatileOpsRef.current, ...operations];
      setPendingCount((count) => count + operations.length);
      queueStateOperations(user.id, operations).then(async () => {
        unstagePendingOperations(user.id, operations.map((operation) => operation.id));
        const ids = new Set(operations.map((operation) => operation.id));
        volatileOpsRef.current = volatileOpsRef.current.filter((operation) => !ids.has(operation.id));
        const count = await refreshPendingCount(user.id);
        setSync(isLocal
          ? `Modo local · ${count} pendiente${count === 1 ? "" : "s"}`
          : "Guardando…");
        if (isCloud && isOnline) {
          clearTimeout(flushTimerRef.current);
          flushTimerRef.current = setTimeout(() => { syncPendingNow(); }, 300);
        }
      }).catch(() => setSync("Guardado de emergencia pendiente"));
    }
    return after;
  };

  const sendNotification = (type, title, body, branch = data.activeBranch, url = "/") => {
    update((d) => {
      d.notificationLog = [{ id: crypto.randomUUID(), type, title, body, branch, date: new Date().toISOString() }, ...(d.notificationLog || [])].slice(0, 100);
      return d;
    });
    if (isCloud) sendRemoteEvent({ type, title, body, branch, url }).catch(() => showDeviceNotification(title, body));
    else showDeviceNotification(title, body);
  };

  const publishAccess = (result) => {
    const displayEvent = { ...result, person: result.person ? { id: result.person.id, name: result.person.name, dni: result.person.dni, role: result.person.role, plan: result.person.plan, expiry: result.person.expiry } : null };
    localStorage.setItem("gymflow-access-display", JSON.stringify(displayEvent));
    try {
      const channel = new BroadcastChannel("gymflow-access");
      channel.postMessage({ type: "access-result", payload: displayEvent });
      channel.close();
    } catch { /* localStorage mantiene la compatibilidad */ }
  };

  const forbidden = (message = "Tu rol no tiene permiso para realizar esta acción.") => ({ ok: false, error: message });
  const actions = {
    setBranch: (activeBranch) => {
      if (!permissions?.isStaff) return dataRef.current;
      try { localStorage.setItem(BRANCH_KEY, activeBranch); } catch { /* no-op */ }
      const next = { ...dataRef.current, activeBranch };
      dataRef.current = next;
      setData(next);
      return next;
    },
    setNotificationPreference: (type, enabled) => permissions?.canManageNotifications ? update((d) => ({ ...d, notificationPreferences: { ...d.notificationPreferences, [type]: enabled } })) : dataRef.current,
    addPerson: (person) => {
      if (!permissions?.canOperate) return forbidden();
      const duplicate = dataRef.current.people.find((item) => item.dni === person.dni);
      if (duplicate) return { ok: false, error: `El DNI ${person.dni} ya pertenece a ${duplicate.name}.` };
      const normalizedEmail = String(person.email || "").trim().toLowerCase();
      const duplicateEmail = normalizedEmail && dataRef.current.people.find((item) => String(item.email || "").trim().toLowerCase() === normalizedEmail);
      if (duplicateEmail) return { ok: false, error: `El email ${normalizedEmail} ya está vinculado a ${duplicateEmail.name}.` };
      person = { ...person, email: normalizedEmail };
      const current = dataRef.current;
      const branch = person.branch || current.activeBranch;
      const id = crypto.randomUUID();
      const { initialPayment, discount = 0, method = "Efectivo", ...personData } = person;
      update((d) => {
        d.people.unshift({ ...personData, id, branch, start: person.start || iso(), expiry: person.role === "Profesor" ? "" : person.expiry });
        if (person.role === "Cliente" && initialPayment) {
          const amount = Math.round(Number(person.price) * (1 - Number(discount || 0) / 100));
          d.transactions.unshift({ id: crypto.randomUUID(), personId: id, branch, type: "income", category: "Membresía", detail: `Alta · ${person.name} (${discount || 0}% desc.)`, amount, method, date: person.start || iso() });
        }
        return d;
      });
      if (person.role === "Cliente") {
        sendNotification("newClient", "Nuevo cliente", `${person.name} fue registrado en ${current.branches.find((item) => item.id === branch)?.name}.`, branch, "/clientes");
        if (isCloud) scheduleMembershipNotifications({ ...personData, id, branch, expiry: person.expiry }).catch(() => undefined);
      }
      if (person.role === "Cliente" && initialPayment) {
        const amount = Math.round(Number(person.price) * (1 - Number(discount || 0) / 100));
        sendNotification("income", "Ingreso registrado", `Alta de ${person.name}: $${amount.toLocaleString("es-AR")}.`, branch, "/caja");
      }
      return { ok: true, id };
    },
    editPerson: (id, changes) => {
      if (!permissions?.canOperate) return forbidden();
      const currentData = dataRef.current;
      const duplicate = currentData.people.find((item) => item.dni === changes.dni && item.id !== id);
      if (duplicate) return { ok: false, error: `El DNI ${changes.dni} ya pertenece a ${duplicate.name}.` };
      const normalizedEmail = String(changes.email || "").trim().toLowerCase();
      const duplicateEmail = normalizedEmail && currentData.people.find((item) => item.id !== id && String(item.email || "").trim().toLowerCase() === normalizedEmail);
      if (duplicateEmail) return { ok: false, error: `El email ${normalizedEmail} ya está vinculado a ${duplicateEmail.name}.` };
      changes = { ...changes, email: normalizedEmail };
      update((d) => {
        const person = d.people.find((item) => item.id === id);
        if (person) Object.assign(person, changes);
        return d;
      });
      const current = currentData.people.find((item) => item.id === id);
      const nextPerson = current ? { ...current, ...changes } : null;
      if (isCloud && nextPerson?.role === "Cliente") scheduleMembershipNotifications(nextPerson).catch(() => undefined);
      return { ok: true };
    },
    deletePerson: (id) => {
      if (!permissions?.canDelete) return forbidden("Sólo el Admin master puede eliminar personas.");
      if (isCloud) cancelMembershipNotifications(id).catch(() => undefined);
      return update((d) => ({ ...d, people: d.people.filter((person) => person.id !== id) }));
    },
    renew: (id, { months, discount, method }) => {
      if (!permissions?.canOperate) return forbidden();
      const currentPerson = dataRef.current.people.find((person) => person.id === id); if (!currentPerson) return;
      const amount = Math.round(currentPerson.price * Number(months) * (1 - Number(discount || 0) / 100));
      const base = new Date(Math.max(Date.now(), new Date(`${currentPerson.expiry || iso()}T12:00:00`).getTime()));
      base.setMonth(base.getMonth() + Number(months));
      const nextExpiry = base.toISOString().slice(0, 10);
      update((d) => {
        const person = d.people.find((item) => item.id === id); if (!person) return d;
        person.expiry = nextExpiry;
        d.transactions.unshift({ id: crypto.randomUUID(), personId: person.id, branch: person.branch, type: "income", category: "Membresía", detail: `Renovación · ${person.name} (${discount || 0}% desc.)`, amount, method, date: iso() });
        return d;
      });
      sendNotification("income", "Ingreso registrado", `Renovación de ${currentPerson.name}: $${amount.toLocaleString("es-AR")}.`, currentPerson.branch, "/caja");
      if (isCloud) scheduleMembershipNotifications({ ...currentPerson, expiry: nextExpiry }).catch(() => undefined);
    },
    addTransaction: (transaction) => {
      if (!permissions?.canOperate) return forbidden();
      const current = dataRef.current;
      const branch = transaction.branch || current.activeBranch; const amount = Number(transaction.amount);
      update((d) => ({ ...d, transactions: [{ ...transaction, id: crypto.randomUUID(), branch, amount, date: transaction.date || iso() }, ...d.transactions] }));
      const isWithdrawal = transaction.type === "expense" && transaction.category === "Retiro de caja";
      const type = transaction.type === "income" ? "income" : isWithdrawal ? "withdrawal" : "expense";
      const title = transaction.type === "income" ? "Ingreso registrado" : isWithdrawal ? "Retiro de caja" : "Gasto registrado";
      sendNotification(type, title, `${transaction.detail}: $${amount.toLocaleString("es-AR")}.`, branch, "/caja");
    },
    deleteTransaction: (id) => permissions?.canDelete ? update((d) => ({ ...d, transactions: d.transactions.filter((transaction) => transaction.id !== id) })) : forbidden("Sólo el Admin master puede eliminar movimientos de caja."),
    closeCash: (actual) => {
      if (!permissions?.canOperate) return forbidden();
      return update((d) => {
      const day = d.transactions.filter((t) => t.branch === d.activeBranch && t.date === iso());
      const expected = day.reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0);
      d.closures.unshift({ id: crypto.randomUUID(), branch: d.activeBranch, date: new Date().toISOString(), expected, actual: Number(actual), difference: Number(actual) - expected }); return d;
      });
    },
    clearAccesses: () => permissions?.canDelete ? update((d) => ({ ...d, accesses: d.accesses.filter((access) => access.branch !== d.activeBranch) })) : forbidden("Sólo el Admin master puede borrar accesos."),
    clearNotificationLog: () => permissions?.canDelete ? update((d) => ({ ...d, notificationLog: [] })) : forbidden("Sólo el Admin master puede borrar el historial de notificaciones."),
    checkAccess: (query) => {
      if (!permissions?.canAccessControl) return forbidden();
      const now = new Date();
      const current = dataRef.current;
      const person = current.people.find((p) => p.dni === query || p.id === query);
      const membershipStatus = person ? statusOf(person, now) : "No encontrado";
      const usage = planUsage(person, current.accesses, now);
      const allowed = !!person && membershipStatus !== "Vencida" && !usage.limitReached;
      const denialReason = !person ? "DNI no registrado" : membershipStatus === "Vencida" ? "Membresía vencida" : usage.limitReached ? "Límite semanal de 3 días alcanzado" : null;
      const lastPayment = person?.role === "Profesor" ? null : current.transactions.find((t) =>
        t.type === "income" && t.category === "Membresía" &&
        (t.personId === person?.id || (!t.personId && t.detail?.includes(person?.name)))
      );
      const daysToExpiry = daysUntilExpiry(person?.expiry, now);
      const result = {
        person,
        allowed,
        membershipStatus,
        lastPaymentDate: lastPayment?.date || person?.start || null,
        daysToExpiry,
        planUsage: usage,
        denialReason,
        branchName: current.branches.find((b) => b.id === (person?.branch || current.activeBranch))?.name,
        checkedAt: now.toISOString(),
      };
      publishAccess(result);
      update((d) => { d.accesses.unshift({ id: crypto.randomUUID(), personId: person?.id || null, branch: d.activeBranch, allowed, date: now.toISOString() }); return d; });
      if (!allowed) sendNotification("deniedAccess", "Ingreso rechazado", person ? `${person.name}: ${denialReason}.` : `DNI ${query} no registrado.`, current.activeBranch, "/accesos");
      else if (person.role === "Profesor") sendNotification("staffAccess", "Ingreso de profesor", `${person.name} ingresó al gimnasio.`, person.branch, "/accesos");
      else sendNotification("clientAccess", "Ingreso de cliente", `${person.name} ingresó al gimnasio.`, person.branch, "/accesos");
      return result;
    },
    allowGuest: () => {
      if (!permissions?.canAccessControl) return forbidden();
      const current = dataRef.current;
      const branchName = current.branches.find((branch) => branch.id === current.activeBranch)?.name;
      const result = {
        person: { id: "manual", name: "Acceso autorizado", dni: "—", role: "Invitado", plan: "Permiso manual", expiry: "" },
        allowed: true,
        manual: true,
        membershipStatus: "Autorizado por recepción",
        lastPaymentDate: null,
        daysToExpiry: null,
        branchName,
        checkedAt: new Date().toISOString(),
      };
      publishAccess(result);
      update((d) => { d.accesses.unshift({ id: crypto.randomUUID(), personId: null, branch: d.activeBranch, allowed: true, manual: true, date: new Date().toISOString() }); return d; });
      sendNotification("manualAccess", "Acceso manual autorizado", `Recepción permitió un ingreso sin registro en ${branchName}.`, current.activeBranch, "/accesos");
      return result;
    },
  };

  return <GymContext.Provider value={{ data, sync, pendingCount, syncPendingNow, ...actions }}>{children}</GymContext.Provider>;
}

export const useGym = () => useContext(GymContext);
