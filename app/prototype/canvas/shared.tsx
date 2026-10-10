"use client";

// PROTOTYPE — throwaway. Chrome and visual language shared by both variants:
// service cards, zone styling, wires with traffic, palette, checklist, AZ failure, telemetry.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  judge,
  KIND_LABEL,
  PALETTE,
  traffic,
  unneeded,
  type Az,
  type DEdge,
  type Diagram,
  type Kind,
  type Traffic,
  type Verdict,
  type Rule,
  type ZoneId,
} from "./model";

export const DRAG_KIND = "application/x-failover-kind";

export const CARD_W = 204;
export const CARD_H = 44;

export const AZ_NAME: Record<Az, string> = { a: "eu-west-2a", b: "eu-west-2b" };
export const REGION_LABEL = "region eu-west-2 · vpc 10.0.0.0/16";

const icon = (children: ReactNode) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export const KIND_META: Record<Kind, { tag: string; color: string; icon: ReactNode }> = {
  users: {
    tag: "internet",
    color: "#e4e4e7",
    icon: icon(<><circle cx="7" cy="4.5" r="2.2" /><path d="M2.5 12c.6-2.4 2.3-3.6 4.5-3.6s3.9 1.2 4.5 3.6" /></>),
  },
  alb: {
    tag: "ELB · application",
    color: "#a78bfa",
    icon: icon(<><path d="M1.5 7h4M5.5 7l4-4M5.5 7h4M5.5 7l4 4" /><circle cx="11" cy="3" r="1" /><circle cx="11" cy="7" r="1" /><circle cx="11" cy="11" r="1" /></>),
  },
  ec2: {
    tag: "EC2 · instance",
    color: "#fb923c",
    icon: icon(<><rect x="3" y="3" width="8" height="8" rx="1" /><path d="M5.5 1v2M8.5 1v2M5.5 11v2M8.5 11v2M1 5.5h2M1 8.5h2M11 5.5h2M11 8.5h2" /></>),
  },
  "rds-primary": {
    tag: "RDS · primary",
    color: "#38bdf8",
    icon: icon(<><ellipse cx="7" cy="3.5" rx="4.5" ry="1.8" /><path d="M2.5 3.5v7c0 1 2 1.8 4.5 1.8s4.5-.8 4.5-1.8v-7M2.5 7c0 1 2 1.8 4.5 1.8S11.500 8 11.500 7" /></>),
  },
  "rds-standby": {
    tag: "RDS · standby",
    color: "#38bdf8",
    icon: icon(<><ellipse cx="7" cy="3.5" rx="4.5" ry="1.8" strokeDasharray="2 1.6" /><path d="M2.5 3.5v7c0 1 2 1.8 4.5 1.8s4.5-.8 4.5-1.8v-7" strokeDasharray="2 1.6" /></>),
  },
  nat: {
    tag: "VPC · NAT gateway",
    color: "#a1a1aa",
    icon: icon(<><rect x="4" y="2" width="6" height="10" rx="1" /><path d="M1 5.500h5M4.500 4l1.500 1.500L4.500 7M13 8.500H8M9.500 7L8 8.500 9.500 10" /></>),
  },
};

// What each service is, without saying where it belongs in the diagram.
export const KIND_INFO: Record<Kind, string> = {
  users: "People reaching the app from the internet.",
  alb: "Takes incoming web requests and spreads them across a group of servers, skipping any that fail a health check.",
  ec2: "A virtual server. This is where the application code runs.",
  "rds-primary": "A managed relational database. The primary handles every read and write.",
  "rds-standby": "A copy of the primary, kept in sync. It serves nothing until the primary fails, then takes over.",
  nat: "Lets servers with no public address make outbound calls to the internet, such as downloading updates. It never accepts incoming connections.",
};

export function ServiceCard({
  kind,
  active = false,
  down = false,
  promoted = false,
  selected = false,
  beat,
  note,
}: {
  kind: Kind;
  active?: boolean;
  down?: boolean;
  promoted?: boolean;
  selected?: boolean;
  /** Seconds into the shared heartbeat at which this card's status dot pulses. */
  beat?: number;
  /** Replaces the tag line, e.g. the users' view of the app. */
  note?: ReactNode;
}) {
  const { tag, color, icon } = KIND_META[kind];
  const lit = (active || promoted) && !down;
  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        borderColor: selected ? "#e4e4e7" : lit ? `color-mix(in oklab, ${color} 55%, transparent)` : undefined,
      }}
      className={`flex items-center gap-2.5 rounded-md border border-zinc-700/80 bg-zinc-900 px-2.5 transition-[border-color,opacity] duration-700 ${
        down ? "opacity-40" : ""
      }`}
    >
      <span
        className="grid size-6 shrink-0 place-items-center rounded"
        style={{ color, background: `color-mix(in oklab, ${color} 14%, transparent)` }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className={`block truncate text-xs text-zinc-100 ${down ? "line-through" : ""}`}>
          {KIND_LABEL[kind]}
        </span>
        <span className={`block truncate text-[10px] ${promoted ? "text-amber-400" : "text-zinc-500"}`}>
          {down ? "unreachable" : promoted ? "promoted → primary" : (note ?? tag)}
        </span>
      </span>
      <span
        className={`size-1.5 shrink-0 rounded-full transition-colors duration-700 ${
          beat !== undefined && lit ? "dot-beat" : ""
        }`}
        style={{ background: down ? "#ef4444" : lit ? color : "#3f3f46", animationDelay: `${beat ?? 0}s` }}
      />
    </div>
  );
}

// ---- zones -----------------------------------------------------------------

type Zone = Exclude<ZoneId, "internet" | "none">;

export const ZONE_META: Record<Zone, { label: string; cidr: string; tone: "public" | "private" | "span" }> = {
  "public-a": { label: "public subnet", cidr: "10.0.0.0/24", tone: "public" },
  "public-b": { label: "public subnet", cidr: "10.0.1.0/24", tone: "public" },
  "public-both": { label: "spans both public subnets", cidr: "", tone: "span" },
  "app-a": { label: "private subnet · app", cidr: "10.0.10.0/24", tone: "private" },
  "app-b": { label: "private subnet · app", cidr: "10.0.11.0/24", tone: "private" },
  "data-a": { label: "private subnet · data", cidr: "10.0.20.0/24", tone: "private" },
  "data-b": { label: "private subnet · data", cidr: "10.0.21.0/24", tone: "private" },
};

export const ZONE_TONE = {
  public: { box: "border-emerald-500/25 bg-emerald-500/[0.035]", text: "text-emerald-400/80" },
  private: { box: "border-sky-500/25 bg-sky-500/[0.035]", text: "text-sky-400/80" },
  span: { box: "border-dashed border-violet-400/50 bg-[var(--color-board)]", text: "text-violet-300/80" },
};

export function ZoneLabel({ id }: { id: Zone }) {
  const { label, cidr, tone } = ZONE_META[id];
  return (
    <span className="flex justify-between gap-2 text-[10px] leading-none">
      <span className={ZONE_TONE[tone].text}>{"// " + label}</span>
      <span className="text-zinc-600">{cidr}</span>
    </span>
  );
}

export const OFFLINE_HATCH: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(135deg, rgba(239,68,68,0.07) 0 6px, transparent 6px 12px)",
};

export const DOT_GRID: CSSProperties = {
  backgroundColor: "var(--color-board)",
  backgroundImage: "radial-gradient(var(--color-grid) 1px, transparent 1px)",
  backgroundSize: "24px 24px",
};

// ---- wires -----------------------------------------------------------------

export type WireState = "idle" | "live" | "dead" | "rerouted" | "unneeded";
export type Wire = { state: WireState; color: string; reverse: boolean };

export const RANK: Record<Kind, number> = { users: 0, alb: 1, nat: 1, ec2: 2, "rds-primary": 3, "rds-standby": 3 };

/** How a connection should be drawn: its state, and which way traffic runs along it. */
export function wireFor(d: Diagram, t: Traffic, e: DEdge, rerouted = false): Wire {
  const a = d.nodes.find((n) => n.id === e.a);
  const b = d.nodes.find((n) => n.id === e.b);
  if (!a || !b) return { state: "idle", color: "#52525b", reverse: false };
  const dead = t.down.has(a.id) || t.down.has(b.id);
  // Outbound traffic runs from the app server to the NAT gateway, against the usual top-down flow.
  if (!dead && t.outbound.has(e.id))
    return { state: "live", reverse: a.kind === "nat", color: KIND_META.nat.color };
  const reverse = RANK[a.kind] > RANK[b.kind];
  if (!dead && !rerouted && unneeded(a.kind, b.kind)) return { state: "unneeded", reverse: false, color: "#fbbf24" };
  const state: WireState = rerouted
    ? "rerouted"
    : dead
      ? "dead"
      : t.live.has(e.id)
        ? "live"
        : "idle";
  return { state, reverse, color: state === "rerouted" ? "#fbbf24" : KIND_META[(reverse ? a : b).kind].color };
}

export function wireStroke({ state, color }: Wire, selected = false): CSSProperties {
  if (selected) return { stroke: "#e4e4e7", strokeWidth: 1.5 };
  if (state === "dead") return { stroke: "#ef4444", strokeOpacity: 0.45, strokeWidth: 1.5, strokeDasharray: "3 5" };
  if (state === "rerouted") return { stroke: color, strokeOpacity: 0.6, strokeWidth: 1.5, strokeDasharray: "5 5" };
  if (state === "unneeded")
    return { stroke: color, strokeOpacity: 0.55, strokeWidth: 1.5, strokeDasharray: "1 6", strokeLinecap: "round" };
  if (state === "live") return { stroke: color, strokeOpacity: 0.45, strokeWidth: 1.5 };
  return { stroke: "#52525b", strokeWidth: 1.5 };
}

/** Two slow packets travelling the wire in the direction traffic flows. */
export function Packets({ path, wire }: { path: string; wire: Wire }) {
  if (wire.state !== "live" && wire.state !== "rerouted") return null;
  return (
    <>
      {["0s", "-1.6s"].map((begin) => (
        <circle key={begin} r="2.5" fill={wire.color}>
          <animateMotion
            dur="3.2s"
            begin={begin}
            repeatCount="indefinite"
            path={path}
            keyPoints={wire.reverse ? "1;0" : "0;1"}
            keyTimes="0;1"
            calcMode="linear"
          />
        </circle>
      ))}
    </>
  );
}

// ---- shell -----------------------------------------------------------------

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <h2 className="mb-3 text-[11px] text-zinc-500">{"// "}{children}</h2>
);

const BRIEF = "Host this web app so it keeps serving when a data centre fails.";
const BRIEF_STRESS = BRIEF.indexOf("when a data centre fails");

/** The question, typed out once. */
function Brief() {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setInterval(() => setShown((n) => (still ? BRIEF.length : Math.min(n + 1, BRIEF.length))), 32);
    return () => clearInterval(timer);
  }, []);
  return (
    <h1 aria-label={BRIEF} className="relative mt-2 text-[22px] leading-snug text-zinc-50">
      {/* The full sentence holds the space, so nothing shifts as it types. */}
      <span aria-hidden className="invisible">{BRIEF}</span>
      <span aria-hidden className="absolute inset-0">
        {BRIEF.slice(0, Math.min(shown, BRIEF_STRESS))}
        <span className="text-amber-300">{BRIEF.slice(BRIEF_STRESS, Math.max(shown, BRIEF_STRESS))}</span>
      </span>
    </h1>
  );
}

function Check({ rule, pass, hint, tone }: Verdict & { rule: Rule; tone: "emerald" | "violet" }) {
  const lit =
    tone === "emerald"
      ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-400"
      : "border-violet-400/50 bg-violet-400/10 text-violet-300";
  return (
    <li className="flex gap-2.5 text-xs leading-snug">
      <span
        className={`mt-px grid size-4 shrink-0 place-items-center rounded-sm border text-[10px] transition-colors duration-700 ${
          pass ? `check-pop ${lit}` : hint ? "border-amber-400/50 text-amber-400" : "border-zinc-700 text-transparent"
        }`}
      >
        {pass ? "✓" : "!"}
      </span>
      <span>
        <span className={`transition-colors duration-700 ${pass ? "text-zinc-100" : "text-zinc-400"}`}>{rule.text}</span>
        {hint && <span className="mt-1 block text-[11px] text-amber-400/90">↳ {hint}</span>}
      </span>
    </li>
  );
}

export function Shell({
  diagram,
  onReset,
  how,
  children,
}: {
  diagram: Diagram;
  onReset: () => void;
  how: string;
  children: (failedAz: Az | null, t: Traffic) => ReactNode;
}) {
  const [failedAz, setFailedAz] = useState<Az | null>(null);
  const [info, setInfo] = useState<Kind | null>(null);
  const verdicts = judge(diagram);
  const core = verdicts.filter((v) => !v.rule.stretch);
  const stretch = verdicts.filter((v) => v.rule.stretch);
  const passed = core.filter((v) => v.pass).length;
  const done = passed === core.length;
  const extra = stretch.every((v) => v.pass);
  const flagged = verdicts.filter((v) => v.hint).length;
  const t = traffic(diagram, failedAz);
  const now = traffic(diagram, null);
  const services = diagram.nodes.length - 1;

  // One dry line about where things stand. It never says what to do next.
  const [status, statusTone] = failedAz
    ? t.serving
      ? [`${AZ_NAME[failedAz]} just went dark. Users didn't notice.`, "text-emerald-400"]
      : now.serving
        ? [`${AZ_NAME[failedAz]} went dark and took the app with it.`, "text-red-400"]
        : [`${AZ_NAME[failedAz]} is dark. There wasn't much to lose yet.`, "text-red-400"]
    : done
      ? [extra ? "Ten for ten, stretch included. Now try to break it." : "Nine for nine. Now try to break it.", "text-emerald-400"]
      : services === 0
        ? ["An empty VPC and some impatient users. Drag something in.", "text-zinc-400"]
        : [
            `${passed} of ${core.length} checks green.${flagged ? ` ${flagged} want${flagged === 1 ? "s" : ""} another look.` : ""}`,
            "text-zinc-300",
          ];

  const stats: [string, ReactNode][] = [
    ["services", services],
    ["connections", diagram.edges.length],
    ["route", now.serving ? "users → elb → ec2 → rds" : "incomplete"],
    [
      "traffic",
      <span key="t" className={t.serving ? "text-emerald-400" : failedAz ? "text-red-400" : "text-zinc-500"}>
        {t.serving ? (t.promoted ? "serving · standby promoted" : "serving") : failedAz ? "offline" : "none"}
      </span>,
    ],
    ["outbound", t.outbound.size ? "ec2 → nat → internet" : <span key="o" className="text-zinc-500">none</span>],
  ];

  return (
    <div className="flex h-screen flex-col bg-[var(--color-page)] font-mono text-zinc-300">
      <header className="flex items-center gap-4 border-b border-zinc-800/80 px-5 py-3 text-xs">
        <span className="text-zinc-500">
          failover <span className="text-zinc-700">/</span> web-app <span className="text-zinc-700">/</span>{" "}
          <span className="text-zinc-200">capstone</span>
        </span>
        <span className="rounded border border-amber-400/40 px-1.5 py-0.5 text-[10px] text-amber-400">prototype</span>
        <button onClick={onReset} className="ml-auto text-zinc-500 transition-colors hover:text-zinc-100">
          ./reset
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr_348px]">
        <aside className="flex flex-col border-r border-zinc-800/80 p-5">
          <Eyebrow>services</Eyebrow>
          <div className="flex flex-col gap-2">
            {PALETTE.map((kind) => (
              <div key={kind}>
                <div className="flex items-center gap-2">
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_KIND, kind);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    className="cursor-grab transition-transform duration-200 hover:-translate-y-0.5 active:cursor-grabbing"
                  >
                    <ServiceCard kind={kind} />
                  </div>
                  <button
                    onClick={() => setInfo(info === kind ? null : kind)}
                    aria-label={`What is a ${KIND_LABEL[kind].toLowerCase()}?`}
                    aria-expanded={info === kind}
                    className={`grid size-5 shrink-0 place-items-center rounded-full border text-[10px] transition-colors ${
                      info === kind
                        ? "border-zinc-300 text-zinc-100"
                        : "border-zinc-700 text-zinc-500 hover:border-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    i
                  </button>
                </div>
                {info === kind && (
                  <p className="mt-2 mb-1 border-l border-zinc-700 pl-3 text-[11px] leading-relaxed text-zinc-400">
                    {KIND_INFO[kind]}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-6 text-[11px] leading-relaxed text-zinc-500">{how}</p>
        </aside>

        <main className="flex min-h-0 flex-col">
          <div className="border-b border-zinc-800/80 px-10 py-6">
            <p className="text-[11px] text-zinc-500">{"// the brief"}</p>
            <Brief />
            <p key={status} className={`status-in mt-3 text-xs ${statusTone}`}>
              <span className="text-zinc-600">{"> "}</span>
              {status}
            </p>
          </div>
          <div className="min-h-0 flex-1">{children(failedAz, t)}</div>
        </main>

        <aside className="flex min-h-0 flex-col gap-8 overflow-y-auto border-l border-zinc-800/80 p-5">
          <section>
            <div className="mb-3 flex items-baseline justify-between text-[11px]">
              <h2 className="text-zinc-500">{"// requirements"}</h2>
              <span className={done ? "text-emerald-400" : "text-zinc-300"}>
                {passed}/{core.length} passing
              </span>
            </div>
            <div className="mb-4 flex gap-1">
              {core.map(({ rule, pass }) => (
                <span
                  key={rule.id}
                  className={`h-1 flex-1 rounded-full transition-colors duration-700 ${
                    pass ? "bg-emerald-400" : "bg-zinc-800"
                  }`}
                />
              ))}
              {stretch.map(({ rule, pass }) => (
                <span
                  key={rule.id}
                  className={`ml-1 h-1 flex-1 rounded-full transition-colors duration-700 ${
                    pass ? "bg-violet-400" : "bg-violet-400/20"
                  }`}
                />
              ))}
            </div>
            <ul className="flex flex-col gap-3">
              {core.map((v) => (
                <Check key={v.rule.id} {...v} tone="emerald" />
              ))}
            </ul>
            {done && (
              <p className="mt-4 rounded-md border border-emerald-400/30 bg-emerald-400/[0.06] px-3 py-2 text-[11px] text-emerald-300">
                All checks pass. Now fail a zone and watch the traffic move.
              </p>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-baseline justify-between text-[11px]">
              <h2 className="text-zinc-500">{"// stretch"}</h2>
              <span className={extra ? "text-violet-300" : "text-zinc-500"}>{extra ? "cleared" : "optional"}</span>
            </div>
            <ul className="flex flex-col gap-3">
              {stretch.map((v) => (
                <Check key={v.rule.id} {...v} tone="violet" />
              ))}
            </ul>
          </section>

          <section>
            <Eyebrow>break something</Eyebrow>
            <div className="flex gap-2 text-[11px]">
              {(["a", "b"] as const).map((az) => (
                <button
                  key={az}
                  onClick={() => setFailedAz(failedAz === az ? null : az)}
                  className={`flex-1 rounded-md border px-2.5 py-2 transition-colors ${
                    failedAz === az
                      ? "border-red-500/70 bg-red-500/10 text-red-300"
                      : "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                  }`}
                >
                  {failedAz === az ? "restore" : "fail"} {AZ_NAME[az]}
                </button>
              ))}
            </div>
          </section>

          <section>
            <Eyebrow>telemetry</Eyebrow>
            <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-xs">
              {stats.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-zinc-500">{k}</dt>
                  <dd className="text-zinc-100">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
