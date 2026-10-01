import { createContext, useEffect, useRef } from "react";
import { registerBackLayer } from "../services/appBack";
export const BackDepth = createContext(0);
export default function useAppBack(enabled, close, priority = 0) {
  const callback = useRef(close);
  callback.current = close;
  useEffect(() => enabled ? registerBackLayer(() => callback.current(), priority) : undefined, [enabled, priority]);
}
