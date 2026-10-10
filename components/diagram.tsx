import type { ReactNode } from "react";
import type { Part } from "@/content/schema";

// The diagram language shared by concept cards and exercises. It deliberately matches the
// capstone canvas, so the pieces are familiar by the time a learner has to place them.

const icon = (children: ReactNode) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const ICON: Record<Part["icon"], { color: string; glyph: ReactNode }> = {
  visitor: { color: "#e4e4e7", glyph: icon(<><circle cx="7" cy="4.5" r="2.2" /><path d="M2.5 12c.6-2.4 2.3-3.6 4.5-3.6s3.9 1.2 4.5 3.6" /></>) },
  bucket: { color: "#34d399", glyph: icon(<><path d="M2 3.5h10l-1.2 8.2a1 1 0 0 1-1 .8H4.200a1 1 0 0 1-1-.8L2 3.5z" /><ellipse cx="7" cy="3.5" rx="5" ry="1.5" /></>) },
  file: { color: "#a1a1aa", glyph: icon(<><path d="M3.500 1.500h4.500l2.500 2.500v8.500h-7z" /><path d="M8 1.500v2.500h2.500" /></>) },
  server: { color: "#fb923c", glyph: icon(<><rect x="3" y="3" width="8" height="8" rx="1" /><path d="M5.500 1v2M8.500 1v2M5.500 11v2M8.500 11v2M1 5.500h2M1 8.500h2M11 5.500h2M11 8.500h2" /></>) },
  database: { color: "#38bdf8", glyph: icon(<><ellipse cx="7" cy="3.500" rx="4.500" ry="1.800" /><path d="M2.500 3.500v7c0 1 2 1.800 4.500 1.800s4.500-.8 4.500-1.800v-7" /></>) },
  cdn: { color: "#a78bfa", glyph: icon(<><circle cx="7" cy="7" r="5.500" /><path d="M1.500 7h11M7 1.500c1.800 1.600 1.800 9.400 0 11M7 1.500c-1.800 1.600-1.800 9.400 0 11" /></>) },
  dns: { color: "#f472b6", glyph: icon(<><path d="M2 4h10M2 7h10M2 10h6" /><circle cx="11" cy="10" r="1" /></>) },
  policy: { color: "#fbbf24", glyph: icon(<><path d="M7 1.500l4.500 1.800v3.400c0 2.700-1.900 4.600-4.500 5.800-2.600-1.200-4.500-3.100-4.500-5.800V3.300z" /><path d="M5 7l1.500 1.500L9.200 5.800" /></>) },
  region: { color: "#a78bfa", glyph: icon(<><path d="M7 12.500S2.800 8.600 2.800 5.600a4.200 4.200 0 0 1 8.400 0C11.200 8.600 7 12.500 7 12.500z" /><circle cx="7" cy="5.600" r="1.500" /></>) },
  network: { color: "#94a3b8", glyph: icon(<><rect x="1.500" y="1.500" width="11" height="11" rx="1.500" strokeDasharray="2.500 1.800" /><circle cx="5" cy="7" r="1" /><circle cx="9" cy="7" r="1" /></>) },
  subnet: { color: "#38bdf8", glyph: icon(<><rect x="2" y="3.500" width="10" height="7" rx="1" /><path d="M5 3.500v7M9 3.500v7" /></>) },
  gateway: { color: "#34d399", glyph: icon(<><path d="M3 12V5.500a4 4 0 0 1 8 0V12" /><path d="M1.500 12h11M7 5v4M5.500 7.500L7 9l1.500-1.500" /></>) },
  firewall: { color: "#fbbf24", glyph: icon(<><rect x="1.500" y="2.500" width="11" height="9" rx="1" /><path d="M1.500 5.500h11M1.500 8.500h11M5 2.500v3M9 5.500v3M5 8.500v3" /></>) },
  balancer: { color: "#a78bfa", glyph: icon(<><path d="M1.500 7h4M5.500 7l4-4M5.500 7h4M5.500 7l4 4" /><circle cx="11" cy="3" r="1" /><circle cx="11" cy="7" r="1" /><circle cx="11" cy="11" r="1" /></>) },
  group: { color: "#fb923c", glyph: icon(<><rect x="1.500" y="1.500" width="11" height="11" rx="1.500" strokeDasharray="2.500 1.800" /><rect x="3.800" y="5" width="2.600" height="4" rx="0.500" /><rect x="7.600" y="5" width="2.600" height="4" rx="0.500" /></>) },
  script: { color: "#f87171", glyph: icon(<><path d="M4.500 4L1.500 7l3 3M9.500 4l3 3-3 3M8 2.500l-2 9" /></>) },
};

export type PartState = "plain" | "selected" | "right" | "wrong" | "dim";

const BORDER: Record<PartState, string> = {
  plain: "border-zinc-700",
  selected: "border-orange-400",
  right: "border-emerald-500",
  wrong: "border-red-400",
  dim: "border-zinc-800 opacity-50",
};

export function PartCard({ part, state = "plain" }: { part: Part; state?: PartState }) {
  const { color, glyph } = ICON[part.icon];
  return (
    <div className={`w-52 rounded-lg border bg-zinc-900 text-left transition-colors duration-300 ${BORDER[state]}`}>
      <div className="flex h-11 items-center gap-2.5 px-2.5">
        <span
          className="grid size-6 shrink-0 place-items-center rounded"
          style={{ color, background: `color-mix(in oklab, ${color} 14%, transparent)` }}
        >
          {glyph}
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-xs text-zinc-100">{part.label}</span>
          {part.tag && <span className="block truncate text-[10px] text-zinc-500">{part.tag}</span>}
        </span>
      </div>
      {part.holds && (
        <ul className="flex flex-col gap-1 border-t border-zinc-800 px-2.5 py-2">
          {part.holds.map((key) => (
            <li key={key} className="flex items-center gap-2 text-[11px] text-zinc-400">
              <span className="text-zinc-600">{ICON.file.glyph}</span>
              {key}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const Wire = () => (
  <svg width="44" height="12" viewBox="0 0 44 12" className="shrink-0 text-zinc-600" fill="none" stroke="currentColor" strokeWidth="1.500" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 6h40M36 2l5 4-5 4" />
  </svg>
);

/** A diagram: parts in a row, joined by arrows. A `null` entry is an empty slot. */
export function Chain({ children }: { children: ReactNode[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-zinc-800 bg-[var(--color-board)] bg-[radial-gradient(var(--color-grid)_1px,transparent_1px)] [background-size:24px_24px] px-6 py-8">
      {children.flatMap((child, i) => (i === 0 ? [child] : [<Wire key={`wire-${i}`} />, child]))}
    </div>
  );
}

export const Gap = () => (
  <div className="grid h-11 w-52 place-items-center rounded-lg border border-dashed border-orange-400/60 text-xs text-orange-300">?</div>
);
