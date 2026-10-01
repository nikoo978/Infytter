import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { installBackGuard } from "../../services/appBack";
export default function AppBackController() {
  const location = useLocation();
  const navigate = useNavigate();
  const current = useRef(null);
  current.current = { path: location.pathname, url: location.pathname + location.search + location.hash, state: window.history.state };
  const navigation = useRef(navigate);
  navigation.current = navigate;
  const [message, setMessage] = useState("");
  useEffect(() => installBackGuard(window, { getCurrent: () => current.current, goHome: () => navigation.current("/", { replace: true }), notify: setMessage }), []);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(""), 1600); return () => clearTimeout(timer); }, [message]);
  return message && <div role="status" className="pointer-events-none fixed inset-x-4 bottom-28 z-[250] mx-auto max-w-sm rounded-2xl bg-black px-4 py-3 text-center text-sm font-bold text-white shadow-xl">{message}</div>;
}
