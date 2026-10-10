"use client";

import { useSyncExternalStore } from "react";

// All reading and writing of progress goes through this module. Today it is backed by this
// browser's storage; a server can back it later without touching lesson or canvas code.

const KEY = "failover.progress";
const VERSION = 1;

/** One answered exercise. Progress is this log; everything else is calculated from it. */
export type Answer = { id: string; ok: boolean; at: number };
export type Save = { version: typeof VERSION; answers: Answer[] };

const EMPTY: Save = { version: VERSION, answers: [] };

/** Reads a save of any known version and brings it up to the current shape. */
function migrate(raw: unknown): Save {
  if (typeof raw !== "object" || raw === null) throw new Error("not a progress file");
  const { version, answers } = raw as { version?: unknown; answers?: unknown };
  if (version !== VERSION || !Array.isArray(answers)) throw new Error("unrecognised progress file");
  return {
    version: VERSION,
    answers: answers.filter(
      (a): a is Answer => typeof a?.id === "string" && typeof a?.ok === "boolean" && typeof a?.at === "number",
    ),
  };
}

let cache: Save | null = null;
const listeners = new Set<() => void>();

function read(): Save {
  if (cache) return cache;
  try {
    const stored = localStorage.getItem(KEY);
    cache = stored ? migrate(JSON.parse(stored)) : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: Save) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage can be full or blocked (private windows). Progress then lasts for this visit only.
  }
  listeners.forEach((notify) => notify());
}

export const record = (id: string, ok: boolean) =>
  write({ ...read(), answers: [...read().answers, { id, ok, at: Date.now() }] });

export const reset = () => write(EMPTY);

export const exportSave = () => JSON.stringify(read(), null, 2);

/** Replaces progress with the contents of an exported file. Throws if the file isn't one. */
export const importSave = (text: string) => write(migrate(JSON.parse(text)));

export function useProgress(): Save {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    read,
    () => EMPTY,
  );
}

/** Ids of exercises answered correctly at least once. */
export const mastered = (save: Save) => new Set(save.answers.filter((a) => a.ok).map((a) => a.id));
