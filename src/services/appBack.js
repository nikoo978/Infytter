const layers = [];
let serial = 0;
export function registerBackLayer(close, priority = 0) {
  const layer = { close, priority, serial: ++serial };
  layers.push(layer);
  return () => { const index = layers.indexOf(layer); if (index >= 0) layers.splice(index, 1); };
}
export function closeBackLayer() {
  const layer = [...layers].sort((a, b) => b.priority - a.priority || b.serial - a.serial)[0];
  if (!layer) return false;
  layer.close();
  return true;
}

// The duplicate entry keeps Back inside the app until an explicit exit gesture.
// Preserve React Router's state (especially idx/key/usr) when restoring the URL.
export function installBackGuard(win, { getCurrent, goHome, notify, now = Date.now }) {
  let lastRootBack = null;
  let released = false;
  if (!win.history.state?.infytterBackGuard) win.history.pushState({ ...win.history.state, infytterBackGuard: true }, "", win.location.href);
  const back = (event) => {
    event.stopImmediatePropagation();
    const current = getCurrent();
    if (lastRootBack !== null && now() - lastRootBack < 1600 && current.path === "/" && !layers.length) {
      released = true;
      win.removeEventListener("popstate", back, true);
      win.history.go(-((current.state?.idx || 0) + 1));
      return;
    }
    win.history.pushState({ ...current.state, infytterBackGuard: true }, "", current.url);
    if (closeBackLayer()) { lastRootBack = null; notify(""); return; }
    if (current.path !== "/") { lastRootBack = null; notify(""); goHome(); return; }
    lastRootBack = now();
    notify("Presioná Atrás otra vez para salir");
  };
  win.addEventListener("popstate", back, true);
  return () => { if (!released) win.removeEventListener("popstate", back, true); };
}

let bindings;
let bootstrapped = false;
// Register before BrowserRouter constructs its history listener. popstate cannot
// be cancelled, so the app listener must run before the router receives it.
export function bootstrapAppBack(win) {
  if (bootstrapped) return;
  bootstrapped = true;
  const initial = { path: win.location.pathname, url: win.location.href, state: win.history.state };
  installBackGuard(win, {
    getCurrent: () => bindings?.getCurrent() || initial,
    goHome: () => bindings?.goHome(),
    notify: (message) => bindings?.notify(message),
  });
}
export function bindAppBack(next) {
  bindings = next;
  return () => { if (bindings === next) bindings = undefined; };
}
