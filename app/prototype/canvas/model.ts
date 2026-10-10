// PROTOTYPE — throwaway. See README.md in this folder.
//
// The diagram model and the rules that judge it. Pure: no React, no DOM.
// This is the part meant to be lifted into the real capstone if it holds up.

export type Az = "a" | "b";
export type Tier = "public" | "app" | "data";
export type ZoneId = `${Tier}-${Az}` | "public-both" | "internet" | "none";
export type Kind = "users" | "alb" | "ec2" | "rds-primary" | "rds-standby" | "nat";

export type DNode = { id: string; kind: Kind; zone: ZoneId };
export type DEdge = { id: string; a: string; b: string };
export type Diagram = { nodes: DNode[]; edges: DEdge[] };

export const KIND_LABEL: Record<Kind, string> = {
  users: "Users",
  alb: "Load balancer",
  ec2: "App server",
  "rds-primary": "Database (primary)",
  "rds-standby": "Database (standby)",
  nat: "NAT gateway",
};

export const PALETTE: Kind[] = ["alb", "ec2", "rds-primary", "rds-standby", "nat"];

export const ZONE_LABEL: Record<Exclude<ZoneId, "internet" | "none">, string> = {
  "public-a": "Public subnet",
  "public-b": "Public subnet",
  "public-both": "Spans both public subnets",
  "app-a": "Private subnet · app",
  "app-b": "Private subnet · app",
  "data-a": "Private subnet · data",
  "data-b": "Private subnet · data",
};

export const USERS_NODE: DNode = { id: "users", kind: "users", zone: "internet" };

export const azOf = (zone: ZoneId): Az | null =>
  zone.endsWith("-a") ? "a" : zone.endsWith("-b") ? "b" : null;

const isPrivate = (zone: ZoneId) => zone.startsWith("app-") || zone.startsWith("data-");
const isDb = (n: DNode) => n.kind === "rds-primary" || n.kind === "rds-standby";
const ofKind = (d: Diagram, kind: Kind) => d.nodes.filter((n) => n.kind === kind);

// Connections are judged without direction: drawing the wire "backwards" is not a mistake.
const linked = (d: Diagram, x: DNode, y: DNode) =>
  d.edges.some((e) => (e.a === x.id && e.b === y.id) || (e.a === y.id && e.b === x.id));

const neighbours = (d: Diagram, n: DNode) => d.nodes.filter((m) => m.id !== n.id && linked(d, n, m));

/** Is there a working path users → load balancer → app server → primary database? */
export function serves(d: Diagram): boolean {
  const users = ofKind(d, "users");
  const albs = ofKind(d, "alb");
  const apps = ofKind(d, "ec2");
  const primaries = ofKind(d, "rds-primary");
  return users.some((u) =>
    albs.some(
      (l) =>
        linked(d, u, l) &&
        apps.some((e) => linked(d, l, e) && primaries.some((p) => linked(d, e, p))),
    ),
  );
}

/**
 * The diagram after an AZ goes dark. Everything placed in that AZ is gone.
 * If the primary database was lost and a standby survives, the standby is
 * promoted and inherits the primary's connections (apps talk to an endpoint,
 * not to a specific instance).
 */
export function failAz(d: Diagram, az: Az): Diagram {
  const lost = new Set(d.nodes.filter((n) => azOf(n.zone) === az).map((n) => n.id));
  let nodes = d.nodes.filter((n) => !lost.has(n.id));
  let edges = d.edges;

  const lostPrimary = d.nodes.find((n) => n.kind === "rds-primary" && lost.has(n.id));
  const standby = nodes.find((n) => n.kind === "rds-standby");
  if (lostPrimary && standby && !nodes.some((n) => n.kind === "rds-primary")) {
    nodes = nodes.map((n) => (n.id === standby.id ? { ...n, kind: "rds-primary" as const } : n));
    edges = edges.map((e) => ({
      ...e,
      a: e.a === lostPrimary.id ? standby.id : e.a,
      b: e.b === lostPrimary.id ? standby.id : e.b,
    }));
  }

  return { nodes, edges: edges.filter((e) => !lost.has(e.a) && !lost.has(e.b)) };
}

export type Verdict = { pass: boolean; hint?: string };
/** A stretch rule is optional: the capstone is complete without it. */
export type Rule = { id: string; text: string; stretch?: true; check: (d: Diagram) => Verdict };

const ok: Verdict = { pass: true };
const no = (hint?: string): Verdict => ({ pass: false, hint });

export const RULES: Rule[] = [
  {
    id: "entry",
    text: "Users reach the app only through the load balancer",
    check: (d) => {
      const [users] = ofKind(d, "users");
      const reached = neighbours(d, users);
      if (!reached.some((n) => n.kind === "alb")) return no();
      const direct = reached.find((n) => n.kind !== "alb");
      return direct
        ? no(`Users are wired straight to a ${KIND_LABEL[direct.kind].toLowerCase()}.`)
        : ok;
    },
  },
  {
    id: "alb-span",
    text: "The load balancer spans both AZs",
    check: (d) => {
      const albs = ofKind(d, "alb");
      if (albs.length === 0) return no();
      if (albs.some((n) => n.zone === "public-both")) return ok;
      if (albs.some((n) => isPrivate(n.zone)))
        return no("A load balancer in a private subnet can't be reached from the internet.");
      return no("This load balancer lives in one AZ. If that AZ fails, so does the front door.");
    },
  },
  {
    id: "alb-targets",
    text: "The load balancer sends traffic to app servers in two AZs",
    check: (d) => {
      const azs = new Set(
        ofKind(d, "alb").flatMap((l) =>
          neighbours(d, l)
            .filter((n) => n.kind === "ec2")
            .map((n) => azOf(n.zone)),
        ),
      );
      azs.delete(null);
      if (azs.size >= 2) return ok;
      return azs.size === 1 ? no("Every target is in the same AZ.") : no();
    },
  },
  {
    id: "app-private",
    text: "App servers sit in private subnets",
    check: (d) => {
      const apps = ofKind(d, "ec2");
      if (apps.length === 0) return no();
      if (apps.some((n) => n.zone.startsWith("public")))
        return no("An app server in a public subnet is exposed to the internet.");
      return apps.every((n) => isPrivate(n.zone)) ? ok : no("An app server isn't inside a subnet.");
    },
  },
  {
    id: "db-private",
    text: "The database is in a private subnet",
    check: (d) => {
      const dbs = d.nodes.filter(isDb);
      if (ofKind(d, "rds-primary").length === 0) return no();
      if (dbs.some((n) => n.zone.startsWith("public")))
        return no("A database in a public subnet can be reached from the internet.");
      return dbs.every((n) => isPrivate(n.zone)) ? ok : no("A database isn't inside a subnet.");
    },
  },
  {
    id: "db-standby",
    text: "The database has a standby in the other AZ",
    check: (d) => {
      const primaries = ofKind(d, "rds-primary");
      const standbys = ofKind(d, "rds-standby");
      if (primaries.length === 0 || standbys.length === 0) return no();
      const split = primaries.some((p) =>
        standbys.some((s) => azOf(p.zone) && azOf(s.zone) && azOf(p.zone) !== azOf(s.zone)),
      );
      return split ? ok : no("Primary and standby share an AZ, so one failure takes out both.");
    },
  },
  {
    id: "app-db",
    text: "Every app server can reach the primary database",
    check: (d) => {
      const apps = ofKind(d, "ec2");
      const primaries = ofKind(d, "rds-primary");
      if (apps.length === 0 || primaries.length === 0) return no();
      const stranded = apps.filter((e) => !primaries.some((p) => linked(d, e, p))).length;
      return stranded === 0 ? ok : no(`${stranded} app server(s) have no connection to the primary.`);
    },
  },
  {
    id: "db-isolated",
    text: "Only app servers talk to the database",
    check: (d) => {
      const dbs = d.nodes.filter(isDb);
      if (dbs.length === 0) return no();
      const intruder = dbs.flatMap((db) => neighbours(d, db)).find((n) => n.kind !== "ec2" && !isDb(n));
      return intruder
        ? no(`There's a direct connection between ${KIND_LABEL[intruder.kind].toLowerCase()} and the database.`)
        : ok;
    },
  },
  {
    id: "survive",
    text: "The app keeps serving if either AZ fails",
    check: (d) => {
      if (!serves(d)) return no();
      const dead = (["a", "b"] as const).filter((az) => !serves(failAz(d, az)));
      if (dead.length === 0) return ok;
      return no(
        dead.length === 2
          ? "Losing either AZ takes the app down."
          : `Losing AZ ${dead[0]} takes the app down. Try failing it to see why.`,
      );
    },
  },
  {
    id: "outbound",
    text: "App servers can download updates, even if a zone fails",
    stretch: true,
    check: (d) => {
      const apps = ofKind(d, "ec2");
      const nats = ofKind(d, "nat");
      if (apps.length === 0 || nats.length === 0) return no();
      if (nats.some((n) => n.zone === "public-both"))
        return no("A NAT gateway lives in one subnet, in one zone. It can't span two.");
      if (nats.some((n) => isPrivate(n.zone)))
        return no("A NAT gateway in a private subnet has no way out to the internet itself.");
      const usable = (n: DNode) => n.zone === "public-a" || n.zone === "public-b";
      const routes = (e: DNode) => neighbours(d, e).filter((n) => n.kind === "nat" && usable(n));
      const stranded = apps.filter((e) => routes(e).length === 0).length;
      if (stranded > 0) return no(`${stranded} app server(s) have no route out through a NAT gateway.`);
      const fragile = apps.some((e) => !routes(e).some((n) => azOf(n.zone) === azOf(e.zone)));
      return fragile
        ? no("An app server relies on a NAT gateway in the other zone. If that zone fails, it loses its way out.")
        : ok;
    },
  },
];

export const judge = (d: Diagram) => RULES.map((rule) => ({ rule, ...rule.check(d) }));

export type Traffic = {
  serving: boolean;
  /** Nodes lost to the failed AZ. */
  down: Set<string>;
  /** The standby that took over as primary, if any. */
  promoted: string | null;
  /** Nodes and original edges on a complete users → load balancer → app → primary path. */
  active: Set<string>;
  live: Set<string>;
  /** Live connections that now point at the promoted standby instead of where they were drawn. */
  rerouted: DEdge[];
  /** Connections carrying outbound traffic from an app server to a NAT gateway in a public subnet. */
  outbound: Set<string>;
};

/** What is carrying traffic right now, optionally with one AZ dark. Drives the visuals only. */
export function traffic(d: Diagram, failed: Az | null): Traffic {
  const after = failed ? failAz(d, failed) : d;
  const down = new Set(d.nodes.filter((n) => failed && azOf(n.zone) === failed).map((n) => n.id));
  const promoted =
    after.nodes.find(
      (n) => n.kind === "rds-primary" && d.nodes.find((m) => m.id === n.id)?.kind === "rds-standby",
    )?.id ?? null;

  const active = new Set<string>();
  const used = new Set<string>();
  const edge = (x: DNode, y: DNode) =>
    after.edges.find((e) => (e.a === x.id && e.b === y.id) || (e.a === y.id && e.b === x.id));

  for (const u of ofKind(after, "users"))
    for (const l of ofKind(after, "alb"))
      for (const a of ofKind(after, "ec2"))
        for (const p of ofKind(after, "rds-primary")) {
          const hops = [edge(u, l), edge(l, a), edge(a, p)];
          if (hops.every(Boolean)) {
            [u, l, a, p].forEach((n) => active.add(n.id));
            hops.forEach((e) => used.add(e!.id));
          }
        }

  const moved = (e: DEdge) => {
    const before = d.edges.find((o) => o.id === e.id)!;
    return before.a !== e.a || before.b !== e.b;
  };
  const rerouted = after.edges.filter((e) => used.has(e.id) && moved(e));
  const live = new Set([...used].filter((id) => !rerouted.some((e) => e.id === id)));

  const serving = active.size > 0;
  const outbound = new Set<string>();
  for (const a of ofKind(after, "ec2"))
    for (const n of ofKind(after, "nat")) {
      const hop = edge(a, n);
      if (hop && (n.zone === "public-a" || n.zone === "public-b")) {
        outbound.add(hop.id);
        active.add(n.id);
      }
    }

  return { serving, down, promoted, active, live, rerouted, outbound };
}

// Connections the design uses. Anything else is drawn as unneeded, with a reason.
const NEEDED = new Set(["alb|users", "alb|ec2", "ec2|rds-primary", "ec2|nat"]);

const UNNEEDED: Record<string, string> = {
  "ec2|users":
    "Users shouldn't reach an app server directly. That skips the load balancer, and a server in a private subnet can't be reached from the internet anyway.",
  "rds-primary|users": "Nothing on the internet should talk to the database. Only the app servers do.",
  "rds-standby|users": "Nothing on the internet should talk to the database. Only the app servers do.",
  "nat|users":
    "A NAT gateway only carries traffic out from private servers. It doesn't accept connections coming in from the internet.",
  "alb|rds-primary": "The load balancer hands web requests to app servers. It never talks to the database itself.",
  "alb|rds-standby": "The load balancer hands web requests to app servers. It never talks to the database itself.",
  "alb|nat": "Incoming requests go from the load balancer to app servers. A NAT gateway is only for traffic heading out.",
  "alb|alb": "One load balancer doesn't feed another here. Each one sends requests straight to app servers.",
  "ec2|ec2": "These app servers don't need each other. Each one handles its own requests, which is what lets either survive alone.",
  "ec2|rds-standby":
    "App servers never connect to the standby. It takes no traffic until the primary fails and it is promoted.",
  "rds-primary|rds-standby":
    "This link is real, but the database service runs the replication for you. There's nothing to wire up.",
  "nat|rds-primary": "The database has no reason to reach the internet, so it doesn't need a NAT gateway.",
  "nat|rds-standby": "The database has no reason to reach the internet, so it doesn't need a NAT gateway.",
  "nat|nat": "NAT gateways work independently, one per zone. They don't connect to each other.",
  "rds-primary|rds-primary": "These two don't exchange traffic in this design.",
  "rds-standby|rds-standby": "These two don't exchange traffic in this design.",
  "users|users": "These two don't exchange traffic in this design.",
};

/** Why a connection between two kinds of service isn't needed, or null if the design uses it. */
export function unneeded(a: Kind, b: Kind): string | null {
  const pair = [a, b].sort().join("|");
  return NEEDED.has(pair) ? null : (UNNEEDED[pair] ?? "These two don't exchange traffic in this design.");
}
