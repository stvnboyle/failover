"use client";

import { useEffect, useEffectEvent } from "react";

/**
 * Listens for key presses anywhere on the page. The listener is attached once and always calls
 * the latest handler, so a handler that reads current state doesn't cause a re-subscribe on every render.
 */
export function useKeydown(handler: (e: KeyboardEvent) => void, enabled = true) {
  const onKey = useEffectEvent(handler);
  useEffect(() => {
    if (!enabled) return;
    const listener = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [enabled]);
}
