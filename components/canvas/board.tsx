"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { colorOf, Glyph } from "@/components/diagram";
import type { Part } from "@/content/schema";
import {
  azOf,
  AZS,
  EMPTY,
  judge,
  nodeById,
  otherAz,
  SPANS,
  tierOf,
  TIERS,
  traffic,
  USERS,
  zonesOf,
  type Az,
  type Diagram,
  type Edge,
  type Kind,
  type Node,
  type Scenario,
  type Subnet,
  type Tier,
  type Traffic,
} from "@/lib/canvas/model";
import { findScenario, KIND_INFO, KIND_LABEL } from "@/lib/canvas/scenarios";
import { record } from "@/lib/progress";
import { useKeydown } from "@/lib/use-keydown";
import "./canvas.css";

const DRAG_KIND = "application/x-failover-kind";
const DRAG_NODE = "application/x-failover-node";

const CARD_W = 204;
// Seconds between the heartbeat reaching one tier and the next.
const BEAT_STEP = 0.9;

const ZONE_NAME: Record<Az, string> = { a: "eu-west-2a", b: "eu-west-2b" };

const ICON: Record<Kind, Part["icon"]> = {
  users: "visitor",
  alb: "balancer",
  asg: "group",
  ec2: "server",
  rds: "database",
  nat: "gateway",
};

const TAG: Record<Kind, string> = {
  users: "internet",
  alb: "Application Load Balancer",
  asg: "launches app servers",
  ec2: "EC2 instance",
  rds: "RDS",
  nat: "outbound only",
};

// How far along the route each kind sits, which sets the direction and timing of traffic.
const RANK: Record<Kind, number> = { users: 0, alb: 1, nat: 1, asg: 2, ec2: 2, rds: 3 };

const TIER: Record<Tier, { label: string; box: string; text: string; glow: string; cidr: Record<Az, string> }> = {
  public: {
    label: "Public subnet",
    box: "border-emerald-500/25 bg-emerald-500/[0.035]",
    text: "text-emerald-400/80",
    glow: "border-emerald-400",
    cidr: { a: "10.0.0.0/24", b: "10.0.1.0/24" },
  },
  app: {
    label: "Private subnet · app",
    box: "border-sky-500/25 bg-sky-500/[0.035]",
    text: "text-sky-400/80",
    glow: "border-sky-400",
    cidr: { a: "10.0.10.0/24", b: "10.0.11.0/24" },
  },
  data: {
    label: "Private subnet · data",
    box: "border-sky-500/25 bg-sky-500/[0.035]",
    text: "text-sky-400/80",
    glow: "border-sky-400",
    cidr: { a: "10.0.20.0/24", b: "10.0.21.0/24" },
  },
};

const HATCH: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(135deg, rgba(239,68,68,0.07) 0 6px, transparent 6px 12px)",
};

const DOT_GRID: CSSProperties = {
  backgroundColor: "var(--color-board)",
  backgroundImage: "radial-gradient(var(--color-grid) 1px, transparent 1px)",
  backgroundSize: "24px 24px",
};

type Point = { x: number; y: number };

// A gentle S-curve that leaves and arrives vertically.
const curve = (p: Point, q: Point) => {
  const mid = (p.y + q.y) / 2;
  return `M${p.x},${p.y} C${p.x},${mid} ${q.x},${mid} ${q.x},${q.y}`;
};

type WireState = "idle" | "live" | "dead" | "unneeded";
type Wire = { state: WireState; color: string; reverse: boolean };

function wireStroke({ state, color }: Wire): CSSProperties {
  if (state === "dead") return { stroke: "#ef4444", strokeOpacity: 0.45, strokeWidth: 1.5, strokeDasharray: "3 5" };
  if (state === "unneeded")
    return { stroke: color, strokeOpacity: 0.55, strokeWidth: 1.5, strokeDasharray: "1 6", strokeLinecap: "round" };
  if (state === "live") return { stroke: color, strokeOpacity: 0.45, strokeWidth: 1.5 };
  return { stroke: "var(--color-zinc-600)", strokeWidth: 1.5 };
}

/** Two slow packets travelling a wire in the direction traffic flows. */
function Packets({ path, wire }: { path: string; wire: Wire }) {
  if (wire.state !== "live") return null;
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

const Heading = ({ children, aside }: { children: ReactNode; aside?: ReactNode }) => (
  <div className="mb-3 flex items-baseline justify-between">
    <h2 className="text-xs font-medium uppercase tracking-widest text-zinc-500">{children}</h2>
    {aside}
  </div>
);

/** One service on the canvas or in the palette. */
function ServiceCard({
  kind,
  selected = false,
  lit = false,
  down = false,
  note,
  beat,
  footer,
}: {
  kind: Kind;
  selected?: boolean;
  lit?: boolean;
  down?: boolean;
  /** Replaces the tag line, to report what the service is doing right now. */
  note?: ReactNode;
  /** Seconds into the shared heartbeat at which the status dot pulses. */
  beat?: number;
  /** A control shown under the card, such as the switch for a second zone. */
  footer?: ReactNode;
}) {
  const color = colorOf(ICON[kind]);
  const on = lit && !down;
  return (
    <div
      style={{
        width: CARD_W,
        borderColor: selected ? "var(--color-zinc-50)" : on ? `color-mix(in oklab, ${color} 55%, transparent)` : undefined,
      }}
      className={`rounded-lg border border-zinc-700 bg-zinc-900 text-left transition-[border-color,opacity] duration-700 ${
        down ? "opacity-40" : ""
      }`}
    >
      <div className="flex h-11 items-center gap-2.5 px-2.5">
        <Glyph icon={ICON[kind]} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className={`block truncate text-xs font-medium text-zinc-100 ${down ? "line-through" : ""}`}>
            {KIND_LABEL[kind]}
          </span>
          <span className="block truncate font-mono text-[10px] text-zinc-500">{down ? "unreachable" : (note ?? TAG[kind])}</span>
        </span>
        <span
          className={`size-1.5 shrink-0 rounded-full transition-colors duration-700 ${beat !== undefined && on ? "dot-beat" : ""}`}
          style={{ background: down ? "#ef4444" : on ? color : "var(--color-zinc-700)", animationDelay: `${beat ?? 0}s` }}
        />
      </div>
      {footer}
    </div>
  );
}

/** A server or standby that a service runs on your behalf. It can't be picked up or wired: its owner is. */
function Launched({ icon, label, tone }: { icon: Part["icon"]; label: string; tone: "plain" | "down" | "new" }) {
  return (
    <div
      style={{ width: CARD_W }}
      className={`flex h-8 items-center gap-2 rounded-lg border border-dashed px-2.5 text-[11px] transition-[border-color,opacity] duration-700 ${
        { plain: "border-zinc-700 text-zinc-400", down: "border-red-500/50 text-zinc-500 line-through opacity-50", new: "card-in border-emerald-400/60 text-emerald-200" }[tone]
      }`}
    >
      <span className="scale-90 opacity-80">
        <Glyph icon={icon} />
      </span>
      {label}
    </div>
  );
}

export function Board({ scenarioId }: { scenarioId: string }) {
  const scenario = findScenario(scenarioId);
  return scenario ? <Canvas scenario={scenario} /> : null;
}

function Canvas({ scenario }: { scenario: Scenario }) {
  const [diagram, setDiagram] = useState<Diagram>(EMPTY);
  const [selected, setSelected] = useState<string | null>(null);
  // The connection made most recently: if it isn't needed, its explanation opens straight away.
  const [latest, setLatest] = useState<string | null>(null);
  const [over, setOver] = useState<Subnet | null>(null);
  const [landed, setLanded] = useState<{ subnet: Subnet; n: number } | null>(null);
  const [failed, setFailed] = useState<Az | null>(null);
  const [info, setInfo] = useState<Kind | null>(null);
  const [points, setPoints] = useState<Record<string, Point>>({});
  const board = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement>());

  const measure = useCallback(() => {
    const next: Record<string, Point> = {};
    // Offsets, not bounding rects: a card mid-animation is transformed, and its wire should aim at where it will rest.
    els.current.forEach((el, id) => {
      let x = el.offsetWidth / 2;
      let y = el.offsetHeight / 2;
      for (let at: HTMLElement | null = el; at && at !== board.current; at = at.offsetParent as HTMLElement | null) {
        x += at.offsetLeft;
        y += at.offsetTop;
      }
      next[id] = { x, y };
    });
    setPoints(next);
  }, []);

  useLayoutEffect(measure, [diagram, failed, measure]);
  useEffect(() => {
    const observer = new ResizeObserver(measure);
    observer.observe(board.current!);
    return () => observer.disconnect();
  }, [measure]);

  const remove = useCallback((id: string) => {
    setDiagram((d) => ({
      nodes: d.nodes.filter((n) => n.id !== id),
      edges: d.edges.filter((e) => e.a !== id && e.b !== id),
    }));
    setSelected(null);
  }, []);

  useKeydown((e) => {
    if ((e.key === "Backspace" || e.key === "Delete") && selected && selected !== USERS.id) remove(selected);
    if (e.key === "Escape") setSelected(null);
  });

  const verdicts = judge(scenario.rules, diagram);
  const core = verdicts.filter((v) => !v.rule.stretch);
  const stretch = verdicts.filter((v) => v.rule.stretch);
  const passed = core.filter((v) => v.pass).length;
  const complete = passed === core.length;
  const extra = stretch.length > 0 && stretch.every((v) => v.pass);
  // Whether this scenario takes requests from users, or is jobs that only ever call out.
  const { inbound } = scenario.shape;

  // Finishing the core requirements counts as completing the capstone.
  const recorded = useRef(false);
  useEffect(() => {
    if (complete && !recorded.current) {
      recorded.current = true;
      record(`capstone:${scenario.id}`, true);
    }
  }, [complete, scenario.id]);

  const t: Traffic = traffic(diagram, failed, scenario.shape);
  const healthy = traffic(diagram, null, scenario.shape);
  const services = diagram.nodes.length - 1;
  const flagged = verdicts.filter((v) => v.hint).length;
  const kindOf = (id: string) => nodeById(diagram, id)!.kind;

  // One dry line about where things stand. It never says what to do next.
  const [status, statusTone] = failed
    ? t.serving
      ? [`${ZONE_NAME[failed]} just went dark. ${inbound ? "Users didn't notice." : "The jobs kept running."}`, "text-emerald-400"]
      : healthy.serving
        ? [`${ZONE_NAME[failed]} went dark and took ${inbound ? "the app" : "the jobs"} with it.`, "text-red-400"]
        : [`${ZONE_NAME[failed]} is dark. There wasn't much to lose yet.`, "text-red-400"]
    : complete
      ? [extra ? "Every check passes, stretch included. Now try to break it." : "Every check passes. Now try to break it.", "text-emerald-400"]
      : services === 0
        ? [`An empty VPC and ${inbound ? "some impatient users" : "a queue of jobs waiting"}. Drag something in.`, "text-zinc-400"]
        : [`${passed} of ${core.length} checks green.${flagged ? ` ${flagged} want${flagged === 1 ? "s" : ""} another look.` : ""}`, "text-zinc-300"];

  const dropTarget = (subnet: Subnet) => ({
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setOver(subnet);
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as globalThis.Node | null)) setOver((s) => (s === subnet ? null : s));
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData(DRAG_KIND) as Kind;
      const moving = e.dataTransfer.getData(DRAG_NODE);
      setOver(null);
      setLanded((l) => ({ subnet, n: (l?.n ?? 0) + 1 }));
      setDiagram((d) =>
        kind
          ? { ...d, nodes: d.nodes.concat({ id: `${kind}-${crypto.randomUUID().slice(0, 4)}`, kind, subnet, both: false }) }
          : { ...d, nodes: d.nodes.map((n) => (n.id === moving ? { ...n, subnet } : n)) },
      );
    },
  });

  const click = (id: string) => {
    if (selected === null) return setSelected(id);
    if (selected !== id) {
      setLatest(`${selected}:${id}`);
      setDiagram((d) => {
        const existing = d.edges.find((e) => (e.a === selected && e.b === id) || (e.a === id && e.b === selected));
        return {
          ...d,
          edges: existing ? d.edges.filter((e) => e !== existing) : d.edges.concat({ id: `${selected}:${id}`, a: selected, b: id }),
        };
      });
    }
    setSelected(null);
  };

  const toggleBoth = (id: string) =>
    setDiagram((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, both: !n.both } : n)) }));

  const wireFor = (e: Edge): Wire => {
    const a = nodeById(diagram, e.a)!;
    const b = nodeById(diagram, e.b)!;
    if (t.down.has(a.id) || t.down.has(b.id)) return { state: "dead", color: "#ef4444", reverse: false };
    // Outbound traffic runs from the app servers to the NAT gateway, against the usual top-down flow.
    if (t.outbound.has(e.id)) return { state: "live", reverse: a.kind === "nat", color: colorOf(ICON.nat) };
    if (scenario.unneeded(a.kind, b.kind)) return { state: "unneeded", color: "#fbbf24", reverse: false };
    const reverse = RANK[a.kind] > RANK[b.kind];
    return { state: t.live.has(e.id) ? "live" : "idle", reverse, color: colorOf(ICON[(reverse ? a : b).kind]) };
  };

  /** What a card says under its name, given what has failed. */
  const noteFor = (n: Node): ReactNode => {
    if (n.kind === "users" && !inbound)
      return diagram.edges.some((e) => e.a === n.id || e.b === n.id) ? (
        <span className="text-red-400">has a way in</span>
      ) : (
        "no way in"
      );
    if (n.kind === "users")
      return t.serving ? (
        <span className="text-emerald-400">200 OK</span>
      ) : failed ? (
        <span className="text-red-400">503 unavailable</span>
      ) : (
        "no route yet"
      );
    if (t.promoted === n.id) return <span className="text-amber-300">standby promoted</span>;
    if (failed && n.both && SPANS.includes(n.kind)) return <span className="text-amber-300">{ZONE_NAME[otherAz(failed)]} only</span>;
    return undefined;
  };

  const card = (n: Node) => {
    const home = azOf(n);
    const spans = SPANS.includes(n.kind) && home;
    return (
      <div
        // Keyed by subnet as well, so a service moved to another subnet lands there afresh.
        key={`${n.id}@${n.subnet}`}
        ref={(el) => {
          if (el) els.current.set(n.id, el);
          else els.current.delete(n.id);
        }}
        draggable={n.id !== USERS.id}
        onDragStart={(e) => e.dataTransfer.setData(DRAG_NODE, n.id)}
        onClick={(e) => {
          e.stopPropagation();
          click(n.id);
        }}
        className={`relative z-10 cursor-pointer ${n.id === USERS.id ? "" : "card-in"}`}
      >
        <ServiceCard
          kind={n.kind}
          selected={selected === n.id}
          lit={t.active.has(n.id)}
          down={t.down.has(n.id)}
          note={noteFor(n)}
          beat={complete ? RANK[n.kind] * BEAT_STEP : undefined}
          footer={
            spans && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleBoth(n.id);
                }}
                aria-pressed={n.both}
                className={`flex w-full items-center justify-between gap-2 rounded-b-lg border-t px-2.5 py-1.5 text-left text-[11px] transition-colors ${
                  n.both
                    ? "border-emerald-400/30 bg-emerald-400/[0.07] text-emerald-200"
                    : "border-zinc-800 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
                }`}
              >
                {n.kind === "rds"
                  ? n.both
                    ? `Standby in ${ZONE_NAME[otherAz(home)]}`
                    : "Add a standby in the other zone"
                  : n.both
                    ? "On in both zones"
                    : `Also switch on in ${ZONE_NAME[otherAz(home)]}`}
                <span className="font-mono">{n.both ? "✓" : "+"}</span>
              </button>
            )
          }
        />
        {n.id !== USERS.id && (
          <svg className="trace pointer-events-none absolute inset-0 h-full w-full">
            <rect
              x="0.75"
              y="0.75"
              rx="7.5"
              pathLength={1}
              stroke={colorOf(ICON[n.kind])}
              style={{ width: "calc(100% - 1.5px)", height: "calc(100% - 1.5px)" }}
            />
          </svg>
        )}
      </div>
    );
  };

  // A load balancer or group that is on in both zones sits across the middle of its row.
  const straddles = (n: Node) => n.both && (n.kind === "alb" || n.kind === "asg");

  const subnet = (tier: Tier, az: Az) => {
    const id = `${tier}-${az}` as Subnet;
    const style = TIER[tier];
    const here = diagram.nodes.filter((n) => n.subnet === id && !straddles(n));
    // Servers a group runs in this zone, and a database's standby, are shown but belong to their owner.
    const groups = diagram.nodes.filter((n) => n.kind === "asg" && tierOf(n) === tier && zonesOf(n).includes(az));
    const standbys = diagram.nodes.filter((n) => n.kind === "rds" && n.both && tierOf(n) === tier && azOf(n) === otherAz(az));
    const dark = failed === az;
    return (
      <div
        {...dropTarget(id)}
        className={`relative flex min-h-36 flex-col gap-3 rounded-lg border p-2.5 transition-colors duration-300 ${style.box} ${
          over === id ? style.glow : ""
        } ${az === "a" ? "items-start pr-[124px]" : "items-end pl-[124px]"}`}
      >
        {landed?.subnet === id && (
          <span key={landed.n} className={`zone-ack pointer-events-none absolute -inset-px rounded-lg border ${style.glow}`} />
        )}
        <span className="flex w-full justify-between gap-2 text-[11px] leading-none">
          <span className={style.text}>{style.label}</span>
          <span className="font-mono text-[10px] text-zinc-600">{style.cidr[az]}</span>
        </span>
        <div className={`flex flex-col gap-2 ${az === "a" ? "items-start" : "items-end"}`}>
          {here.map(card)}
          {groups.map((g) => (
            <Launched key={`${g.id}-server`} icon="server" label="App server · from the group" tone={dark ? "down" : "plain"} />
          ))}
          {groups
            .filter((g) => g.both && failed === otherAz(az))
            .map((g) => (
              <Launched key={`${g.id}-replacement`} icon="server" label="App server · replacement" tone="new" />
            ))}
          {standbys.map((db) => (
            <Launched
              key={`${db.id}-standby`}
              icon="database"
              label={t.promoted === db.id ? "Standby · now the primary" : "Standby · no traffic"}
              tone={dark ? "down" : t.promoted === db.id ? "new" : "plain"}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-zinc-800 px-5 py-3">
        <Link
          href="/"
          aria-label="Leave the canvas"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
        >
          ✕
        </Link>
        <span className="text-sm font-medium text-zinc-200">{scenario.title}</span>
        <button
          onClick={() => {
            setDiagram(EMPTY);
            setSelected(null);
            setLanded(null);
            setLatest(null);
            setFailed(null);
          }}
          className="ml-auto text-xs text-zinc-400 underline underline-offset-2 transition-colors hover:text-zinc-100"
        >
          Start again
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[288px_1fr_348px]">
        <aside className="flex flex-col overflow-y-auto border-r border-zinc-800 p-5">
          <Heading>Services</Heading>
          <div className="flex flex-col gap-2">
            {scenario.palette.map((kind) => (
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
                    className={`grid size-6 shrink-0 place-items-center rounded-full border text-[11px] transition-colors ${
                      info === kind
                        ? "border-zinc-300 text-zinc-100"
                        : "border-zinc-700 text-zinc-500 hover:border-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    i
                  </button>
                </div>
                {info === kind && (
                  <p className="rise-in mb-1 mt-2 border-l border-zinc-700 pl-3 text-xs leading-relaxed text-zinc-400">{KIND_INFO[kind]}</p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs leading-relaxed text-zinc-500">
            Drag a service into a subnet. Click one service, then another, to connect them, and again to disconnect. Select
            one and press Backspace to remove it.
          </p>
        </aside>

        <main className="flex min-h-0 flex-col">
          <div className="border-b border-zinc-800 px-10 py-6">
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">The brief</p>
            <h1 className="mt-2 text-2xl font-semibold leading-snug text-zinc-100">
              {scenario.brief.split(scenario.stress)[0]}
              <span className="text-amber-300">{scenario.stress}</span>
              {scenario.brief.split(scenario.stress)[1]}
            </h1>
            <p key={status} className={`rise-in mt-3 text-sm ${statusTone}`}>
              {status}
              {complete && (
                <Link href="/scenarios" className="ml-3 text-zinc-300 underline underline-offset-2 transition-colors hover:text-zinc-50">
                  Try another scenario →
                </Link>
              )}
            </p>
          </div>

          <div
            className="min-h-0 flex-1 overflow-auto px-10 py-6"
            style={DOT_GRID}
            onClick={() => {
              setSelected(null);
              setLatest(null);
            }}
          >
            <div ref={board} className="relative mx-auto flex max-w-[1040px] flex-col items-center gap-9">
              <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full">
                {diagram.edges.map((e) => {
                  const p = points[e.a];
                  const q = points[e.b];
                  if (!p || !q) return null;
                  const wire = wireFor(e);
                  const path = curve(p, q);
                  // The same curve, drawn in the direction traffic flows.
                  const flow = wire.reverse ? curve(q, p) : path;
                  const depth = t.outbound.has(e.id) ? RANK.asg : Math.min(RANK[kindOf(e.a)], RANK[kindOf(e.b)]);
                  return (
                    <g key={e.id}>
                      <path d={path} fill="none" style={wireStroke(wire)} className={complete && wire.state === "live" ? "wire-breathe" : ""} />
                      <path d={flow} pathLength={1} stroke={wire.color} className="wire-in" />
                      <Packets path={path} wire={wire} />
                      {complete && wire.state === "live" && (
                        <path d={flow} pathLength={1} className="wire-beat" style={{ animationDelay: `${depth * BEAT_STEP}s` }} />
                      )}
                    </g>
                  );
                })}
              </svg>

              {diagram.edges.map((e) => {
                const p = points[e.a];
                const q = points[e.b];
                const why = scenario.unneeded(kindOf(e.a), kindOf(e.b));
                if (!p || !q || !why || t.down.has(e.a) || t.down.has(e.b)) return null;
                return (
                  <div key={e.id} style={{ left: (p.x + q.x) / 2 - 8, top: (p.y + q.y) / 2 - 8 }} className="group absolute z-20">
                    <span className="grid size-4 cursor-help place-items-center rounded-full border border-amber-400/70 bg-zinc-950 text-[10px] leading-none text-amber-300">
                      ?
                    </span>
                    <p
                      className={`rise-in absolute left-[-120px] top-6 w-64 rounded-lg border border-amber-400/30 bg-zinc-950 px-3 py-2 text-xs leading-relaxed text-zinc-300 group-hover:block ${
                        latest === e.id ? "block" : "hidden"
                      }`}
                    >
                      <span className="mb-1 block font-medium text-amber-300">
                        {KIND_LABEL[kindOf(e.a)]} and {KIND_LABEL[kindOf(e.b)].toLowerCase()}: not needed
                      </span>
                      {why}
                    </p>
                  </div>
                );
              })}

              {card(USERS)}

              <div
                className={`relative w-full rounded-xl border bg-zinc-950/60 p-3 transition-colors duration-1000 ${
                  complete ? "border-emerald-400/40" : "border-zinc-800"
                }`}
              >
                <p className="flex justify-between text-[11px] leading-none text-zinc-500">
                  <span>
                    Region <span className="font-mono">eu-west-2</span> · VPC <span className="font-mono">10.0.0.0/16</span>
                  </span>
                  <span className={`transition-opacity duration-1000 ${complete ? "text-emerald-400" : "opacity-0"}`}>● All checks passing</span>
                </p>

                {/* The two zones are drawn behind the rows, one each side. */}
                {AZS.map((az) => (
                  <div
                    key={az}
                    style={failed === az ? HATCH : undefined}
                    className={`pointer-events-none absolute bottom-3 top-9 rounded-lg border border-dashed px-3 pt-2 font-mono text-[10px] leading-none transition-colors duration-700 ${
                      az === "a" ? "left-3 right-[calc(50%+6px)]" : "left-[calc(50%+6px)] right-3 text-right"
                    } ${failed === az ? "border-red-500/60 text-red-400" : "border-zinc-700 text-zinc-500"}`}
                  >
                    {ZONE_NAME[az]}
                    {failed === az && " · offline"}
                  </div>
                ))}

                <div className="relative mt-11 flex flex-col gap-4 px-3 pb-3">
                  {TIERS.map((tier) => (
                    <div key={tier} className="relative grid grid-cols-2 gap-9">
                      {subnet(tier, "a")}
                      {subnet(tier, "b")}
                      <div className="absolute left-[calc(50%-102px)] top-9 z-10 flex flex-col gap-2">
                        {diagram.nodes.filter((n) => tierOf(n) === tier && straddles(n)).map(card)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>

        <aside className="flex min-h-0 flex-col gap-8 overflow-y-auto border-l border-zinc-800 p-5">
          <section>
            <Heading
              aside={
                <span className={`font-mono text-xs ${complete ? "text-emerald-400" : "text-zinc-300"}`}>
                  {passed}/{core.length}
                </span>
              }
            >
              Requirements
            </Heading>
            <div className="mb-4 flex gap-1">
              {core.map(({ rule, pass }) => (
                <span key={rule.id} className={`h-1.5 flex-1 rounded-full transition-colors duration-700 ${pass ? "bg-emerald-400" : "bg-zinc-800"}`} />
              ))}
              {stretch.map(({ rule, pass }) => (
                <span key={rule.id} className={`ml-1 h-1.5 flex-1 rounded-full transition-colors duration-700 ${pass ? "bg-violet-400" : "bg-violet-400/20"}`} />
              ))}
            </div>
            <ul className="flex flex-col gap-3">
              {core.map((v) => (
                <Check key={v.rule.id} text={v.rule.text} pass={v.pass} hint={v.hint} tone="emerald" />
              ))}
            </ul>
          </section>

          {stretch.length > 0 && (
            <section>
              <Heading aside={<span className={`text-xs ${extra ? "text-violet-300" : "text-zinc-500"}`}>{extra ? "Cleared" : "Optional"}</span>}>
                Stretch
              </Heading>
              <ul className="flex flex-col gap-3">
                {stretch.map((v) => (
                  <Check key={v.rule.id} text={v.rule.text} pass={v.pass} hint={v.hint} tone="violet" />
                ))}
              </ul>
            </section>
          )}

          <section>
            <Heading>Break something</Heading>
            <div className="flex gap-2 text-xs">
              {AZS.map((az) => (
                <button
                  key={az}
                  onClick={() => setFailed(failed === az ? null : az)}
                  className={`keycap flex-1 rounded-lg border px-2.5 py-2 ${
                    failed === az
                      ? "border-red-500/70 bg-red-500/10 text-red-300"
                      : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-zinc-100"
                  }`}
                >
                  {failed === az ? "Restore" : "Fail"} <span className="font-mono">{ZONE_NAME[az]}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <Heading>Right now</Heading>
            <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-xs">
              <dt className="text-zinc-500">Services</dt>
              <dd className="text-zinc-200">{services}</dd>
              <dt className="text-zinc-500">Connections</dt>
              <dd className="text-zinc-200">{diagram.edges.length}</dd>
              <dt className="text-zinc-500">{inbound ? "Users see" : "The jobs"}</dt>
              <dd className={t.serving ? "text-emerald-400" : failed ? "text-red-400" : "text-zinc-500"}>
                {inbound
                  ? t.serving
                    ? t.promoted
                      ? "It works, served from the standby database"
                      : "It works"
                    : failed
                      ? "An error"
                      : "Nothing yet"
                  : t.serving
                    ? "Running"
                    : failed
                      ? "Stopped"
                      : "Not running yet"}
              </dd>
              <dt className="text-zinc-500">Calls out</dt>
              <dd className={t.outbound.size ? "text-zinc-200" : "text-zinc-500"}>
                {t.outbound.size ? "Reaching the internet through NAT" : "No route out"}
              </dd>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Check({ text, pass, hint, tone }: { text: string; pass: boolean; hint?: string; tone: "emerald" | "violet" }) {
  const lit =
    tone === "emerald"
      ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-400"
      : "border-violet-400/50 bg-violet-400/10 text-violet-300";
  return (
    <li className="flex gap-2.5 text-[13px] leading-snug">
      <span
        className={`mt-px grid size-4 shrink-0 place-items-center rounded border text-[10px] transition-colors duration-700 ${
          pass ? `pop-in ${lit}` : hint ? "border-amber-400/50 text-amber-300" : "border-zinc-700 text-transparent"
        }`}
      >
        {pass ? "✓" : "!"}
      </span>
      <span>
        <span className={`transition-colors duration-700 ${pass ? "text-zinc-100" : "text-zinc-400"}`}>{text}</span>
        {hint && <span className="mt-1 block text-xs text-amber-300/90">{hint}</span>}
      </span>
    </li>
  );
}
