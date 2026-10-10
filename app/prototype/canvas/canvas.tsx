"use client";

// PROTOTYPE — throwaway. The capstone canvas: services snap into zones and arrange themselves.
// Connect by clicking one service, then another.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent } from "react";
import "./canvas.css";
import { judge, KIND_LABEL, unneeded, USERS_NODE, type Az, type Diagram, type DNode, type Kind, type ZoneId } from "./model";
import {
  AZ_NAME,
  CARD_H,
  CARD_W,
  DOT_GRID,
  DRAG_KIND,
  KIND_META,
  OFFLINE_HATCH,
  Packets,
  RANK,
  REGION_LABEL,
  ServiceCard,
  Shell,
  wireFor,
  wireStroke,
  ZONE_META,
  ZONE_TONE,
  ZoneLabel,
} from "./shared";

const DRAG_NODE = "application/x-failover-node";
const EMPTY: Diagram = { nodes: [USERS_NODE], edges: [] };

// Seconds between the heartbeat reaching one tier and the next.
const BEAT_STEP = 0.9;

type Zone = Exclude<ZoneId, "internet" | "none">;
type Point = { x: number; y: number };

const ZONE_GLOW = { public: "border-emerald-400", private: "border-sky-400", span: "border-violet-400" };

// A gentle S-curve that leaves and arrives vertically.
const curve = (p: Point, q: Point) => {
  const mid = (p.y + q.y) / 2;
  return `M${p.x},${p.y} C${p.x},${mid} ${q.x},${mid} ${q.x},${q.y}`;
};

export function Canvas() {
  const [diagram, setDiagram] = useState<Diagram>(EMPTY);
  const [selected, setSelected] = useState<string | null>(null);
  const [points, setPoints] = useState<Record<string, Point>>({});
  const [over, setOver] = useState<Zone | null>(null);
  const [landed, setLanded] = useState<{ zone: Zone; n: number } | null>(null);
  // The connection made most recently: if it isn't needed, its explanation opens straight away.
  const [latest, setLatest] = useState<string | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement>());

  const measure = useCallback(() => {
    if (!board.current) return;
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

  useLayoutEffect(measure, [diagram, measure]);
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Backspace" || e.key === "Delete") && selected && selected !== "users") remove(selected);
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, remove]);

  const dropTarget = (zone: Zone) => ({
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setOver(zone);
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((z) => (z === zone ? null : z));
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const kind = e.dataTransfer.getData(DRAG_KIND) as Kind;
      const moving = e.dataTransfer.getData(DRAG_NODE);
      setOver(null);
      setLanded((l) => ({ zone, n: (l?.n ?? 0) + 1 }));
      setDiagram((d) =>
        kind
          ? { ...d, nodes: d.nodes.concat({ id: `${kind}-${crypto.randomUUID().slice(0, 4)}`, kind, zone }) }
          : { ...d, nodes: d.nodes.map((n) => (n.id === moving ? { ...n, zone } : n)) },
      );
    },
  });

  const click = (id: string) => {
    if (selected === null) return setSelected(id);
    if (selected !== id) {
      setLatest(`${selected}:${id}`);
      setDiagram((d) => {
        const existing = d.edges.find(
          (e) => (e.a === selected && e.b === id) || (e.a === id && e.b === selected),
        );
        return {
          ...d,
          edges: existing
            ? d.edges.filter((e) => e !== existing)
            : d.edges.concat({ id: `${selected}:${id}`, a: selected, b: id }),
        };
      });
    }
    setSelected(null);
  };

  const complete = judge(diagram).every((v) => v.pass || v.rule.stretch);

  return (
    <Shell
      diagram={diagram}
      onReset={() => {
        setDiagram(EMPTY);
        setSelected(null);
        setLanded(null);
        setLatest(null);
      }}
      how="Drag a service into a zone. Click one service, then another, to connect them (repeat to disconnect). Select and press Backspace to remove."
    >
      {(failedAz, t) => {
        // What the people on the internet get back right now.
        const usersSee = t.serving ? (
          <span className="text-emerald-400">200 OK</span>
        ) : failedAz ? (
          <span className="text-red-400">503 unavailable</span>
        ) : (
          "no route yet"
        );

        const node = (n: DNode) => (
          <div
            // Keyed by zone as well, so a service moved to another zone lands there afresh.
            key={`${n.id}@${n.zone}`}
            ref={(el) => {
              if (el) els.current.set(n.id, el);
              else els.current.delete(n.id);
            }}
            draggable={n.id !== "users"}
            onDragStart={(e) => e.dataTransfer.setData(DRAG_NODE, n.id)}
            onClick={(e) => {
              e.stopPropagation();
              click(n.id);
            }}
            className={`relative z-10 cursor-pointer ${n.id === "users" ? "" : "card-in"}`}
          >
            <ServiceCard
              kind={n.kind}
              selected={selected === n.id}
              active={t.active.has(n.id)}
              down={t.down.has(n.id)}
              promoted={t.promoted === n.id}
              beat={complete ? RANK[n.kind] * BEAT_STEP : undefined}
              note={n.id === "users" ? usersSee : undefined}
            />
            {n.id !== "users" && (
              <svg className="trace pointer-events-none absolute inset-0" width={CARD_W} height={CARD_H}>
                <rect
                  x="0.75"
                  y="0.75"
                  width={CARD_W - 1.5}
                  height={CARD_H - 1.5}
                  rx="5.5"
                  pathLength={1}
                  stroke={KIND_META[n.kind].color}
                />
              </svg>
            )}
          </div>
        );

        const zone = (id: Zone, className = "") => {
          const tone = ZONE_META[id].tone;
          return (
            <div
              {...dropTarget(id)}
              className={`relative flex flex-col gap-3 rounded-md border p-2.5 transition-colors duration-300 ${ZONE_TONE[tone].box} ${
                over === id ? ZONE_GLOW[tone] : ""
              } ${className}`}
            >
              {landed?.zone === id && (
                <span
                  key={landed.n}
                  className={`zone-ack pointer-events-none absolute -inset-px rounded-md border ${ZONE_GLOW[tone]}`}
                />
              )}
              <ZoneLabel id={id} />
              <div className="flex flex-wrap gap-2">{diagram.nodes.filter((n) => n.zone === id).map(node)}</div>
            </div>
          );
        };

        const az = (name: Az) => {
          const offline = failedAz === name;
          return (
            <div
              style={offline ? OFFLINE_HATCH : undefined}
              className={`flex flex-col gap-4 rounded-lg border border-dashed p-3 transition-colors duration-700 ${
                offline ? "border-red-500/60" : "border-zinc-700"
              }`}
            >
              <span className={`text-[10px] leading-none ${offline ? "text-red-400" : "text-zinc-500"}`}>
                {AZ_NAME[name]}
                {offline && " — offline"}
              </span>
              {zone(`public-${name}`, name === "a" ? "min-h-36 pr-24" : "min-h-36 pl-24")}
              {zone(`app-${name}`, "min-h-32")}
              {zone(`data-${name}`, "min-h-32")}
            </div>
          );
        };

        const wires = [
          ...diagram.edges.map((e) => ({ e, wire: wireFor(diagram, t, e) })),
          ...t.rerouted.map((e) => ({ e: { ...e, id: `${e.id}:rerouted` }, wire: wireFor(diagram, t, e, true) })),
        ];
        const kindOf = (id: string) => diagram.nodes.find((n) => n.id === id)!.kind;

        return (
          <div className="h-full overflow-auto px-10 py-6" style={DOT_GRID}
            onClick={() => {
              setSelected(null);
              setLatest(null);
            }}
          >
            <div ref={board} className="relative mx-auto flex max-w-[1000px] flex-col items-center gap-9">
              <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full">
                {wires.map(({ e, wire }) => {
                  const p = points[e.a];
                  const q = points[e.b];
                  if (!p || !q) return null;
                  const path = curve(p, q);
                  // The same curve, drawn in the direction traffic flows.
                  const flow = wire.reverse ? curve(q, p) : path;
                  const carrying = wire.state === "live" || wire.state === "rerouted";
                  // Outbound wires beat after the wave has reached the app servers.
                  const depth = t.outbound.has(e.id) ? RANK.ec2 : Math.min(RANK[kindOf(e.a)], RANK[kindOf(e.b)]);
                  return (
                    <g key={e.id}>
                      <path
                        d={path}
                        fill="none"
                        style={wireStroke(wire)}
                        className={complete && carrying ? "wire-breathe" : ""}
                      />
                      <path d={flow} pathLength={1} stroke={wire.color} className="wire-in" />
                      <Packets path={path} wire={wire} />
                      {complete && carrying && (
                        <path
                          d={flow}
                          pathLength={1}
                          className="wire-beat"
                          style={{ animationDelay: `${depth * BEAT_STEP}s` }}
                        />
                      )}
                    </g>
                  );
                })}
              </svg>

              {diagram.edges.map((e) => {
                const p = points[e.a];
                const q = points[e.b];
                const why = unneeded(kindOf(e.a), kindOf(e.b));
                if (!p || !q || !why || t.down.has(e.a) || t.down.has(e.b)) return null;
                return (
                  <div
                    key={e.id}
                    style={{ left: (p.x + q.x) / 2, top: (p.y + q.y) / 2 }}
                    className="group absolute z-20 -translate-x-1/2 -translate-y-1/2"
                  >
                    <span className="grid size-4 cursor-help place-items-center rounded-full border border-amber-400/70 bg-zinc-950 text-[10px] leading-none text-amber-400">
                      ?
                    </span>
                    <p
                      className={`status-in absolute left-1/2 top-6 w-64 -translate-x-1/2 rounded-md border border-amber-400/30 bg-zinc-950 px-3 py-2 text-[11px] leading-relaxed text-zinc-300 group-hover:block ${
                        latest === e.id ? "block" : "hidden"
                      }`}
                    >
                      <span className="mb-1 block text-amber-400">
                        {KIND_LABEL[kindOf(e.a)]} ↔ {KIND_LABEL[kindOf(e.b)]}: not needed
                      </span>
                      {why}
                    </p>
                  </div>
                );
              })}

              {node(USERS_NODE)}

              <div
                className={`relative w-full rounded-lg border bg-zinc-950/60 p-3 transition-colors duration-1000 ${
                  complete ? "border-emerald-400/40" : "border-zinc-800"
                }`}
              >
                <span className="flex justify-between text-[10px] leading-none text-zinc-500">
                  {REGION_LABEL}
                  <span className={`transition-opacity duration-1000 ${complete ? "text-emerald-400" : "opacity-0"}`}>
                    ● all checks passing
                  </span>
                </span>
                <div className="mt-3 grid grid-cols-2 gap-16">
                  {az("a")}
                  {az("b")}
                </div>
                {zone("public-both", "!absolute left-[calc(50%-116px)] top-[122px] min-h-[92px] w-[232px]")}
              </div>
            </div>
          </div>
        );
      }}
    </Shell>
  );
}
