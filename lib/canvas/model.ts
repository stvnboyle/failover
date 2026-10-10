// The diagram a learner builds on the canvas, and what happens to it when a zone fails.
// Pure: no React, no DOM. Scenarios and their rules are built on top of this.

export type Az = "a" | "b";
export type Tier = "public" | "app" | "data";
export type Subnet = `${Tier}-${Az}`;
export type Kind = "users" | "alb" | "asg" | "ec2" | "rds" | "nat";

export type Node = {
  id: string;
  kind: Kind;
  /** The subnet it was placed in. For the users, who are outside AWS, "internet". */
  subnet: Subnet | "internet";
  /**
   * Whether it also reaches into the other zone. For a load balancer or an Auto Scaling group this
   * means switched on in both zones; for a database it means Multi-AZ, with a standby in the other.
   */
  both: boolean;
};

export type Edge = { id: string; a: string; b: string };
export type Diagram = { nodes: Node[]; edges: Edge[] };

export const USERS: Node = { id: "users", kind: "users", subnet: "internet", both: false };
export const EMPTY: Diagram = { nodes: [USERS], edges: [] };

export const AZS: Az[] = ["a", "b"];
export const TIERS: Tier[] = ["public", "app", "data"];

/** Kinds that can reach into the second zone, and so carry a switch for it. */
export const SPANS: Kind[] = ["alb", "asg", "rds"];
/** Kinds that run the application. */
export const COMPUTE: Kind[] = ["asg", "ec2"];

export const azOf = (n: Node): Az | null => (n.subnet === "internet" ? null : (n.subnet.slice(-1) as Az));
export const tierOf = (n: Node): Tier | null => (n.subnet === "internet" ? null : (n.subnet.split("-")[0] as Tier));
export const otherAz = (az: Az): Az => (az === "a" ? "b" : "a");

/** The zones a node is present in. */
export function zonesOf(n: Node): Az[] {
  const home = azOf(n);
  if (!home) return [];
  return n.both && SPANS.includes(n.kind) ? [home, otherAz(home)] : [home];
}

/** The zones a node is still present in once `failed` has gone dark. */
export const survivingZones = (n: Node, failed: Az | null) => zonesOf(n).filter((z) => z !== failed);
export const isUp = (n: Node, failed: Az | null) => n.kind === "users" || survivingZones(n, failed).length > 0;

export const ofKind = (d: Diagram, ...kinds: Kind[]) => d.nodes.filter((n) => kinds.includes(n.kind));
export const nodeById = (d: Diagram, id: string) => d.nodes.find((n) => n.id === id);

// Connections are judged without direction: drawing a wire "backwards" is not a mistake.
export const linked = (d: Diagram, x: Node, y: Node) =>
  d.edges.some((e) => (e.a === x.id && e.b === y.id) || (e.a === y.id && e.b === x.id));
export const neighbours = (d: Diagram, n: Node) => d.nodes.filter((m) => m.id !== n.id && linked(d, n, m));
const edgeBetween = (d: Diagram, x: Node, y: Node) =>
  d.edges.find((e) => (e.a === x.id && e.b === y.id) || (e.a === y.id && e.b === x.id));

/** A load balancer only sends traffic to servers in zones it is switched on in. */
const canRoute = (lb: Node, compute: Node, failed: Az | null) =>
  survivingZones(lb, failed).some((z) => survivingZones(compute, failed).includes(z));

export type Traffic = {
  serving: boolean;
  /** Nodes with nothing left running. */
  down: Set<string>;
  /** A database whose standby has taken over. */
  promoted: string | null;
  /** Nodes and connections on a complete users → load balancer → app → database route. */
  active: Set<string>;
  live: Set<string>;
  /** Connections carrying outbound traffic from app servers to a NAT gateway. */
  outbound: Set<string>;
};

/** What is carrying traffic, optionally with one zone dark. */
export function traffic(d: Diagram, failed: Az | null): Traffic {
  const down = new Set(d.nodes.filter((n) => !isUp(n, failed)).map((n) => n.id));
  const promoted =
    ofKind(d, "rds").find((n) => n.both && failed !== null && azOf(n) === failed)?.id ?? null;

  const active = new Set<string>();
  const live = new Set<string>();
  const up = (n: Node) => !down.has(n.id);

  for (const u of ofKind(d, "users"))
    for (const lb of ofKind(d, "alb").filter(up))
      for (const c of ofKind(d, ...COMPUTE).filter(up))
        for (const db of ofKind(d, "rds").filter(up)) {
          const hops = [edgeBetween(d, u, lb), edgeBetween(d, lb, c), edgeBetween(d, c, db)];
          if (hops.every(Boolean) && canRoute(lb, c, failed)) {
            [u, lb, c, db].forEach((n) => active.add(n.id));
            hops.forEach((e) => live.add(e!.id));
          }
        }

  const outbound = new Set<string>();
  for (const c of ofKind(d, ...COMPUTE).filter(up))
    for (const nat of ofKind(d, "nat").filter(up)) {
      const hop = edgeBetween(d, c, nat);
      if (hop && tierOf(nat) === "public") {
        outbound.add(hop.id);
        active.add(nat.id);
      }
    }

  return { serving: live.size > 0, down, promoted, active, live, outbound };
}

export const serves = (d: Diagram, failed: Az | null) => traffic(d, failed).serving;

// ---- judging -----------------------------------------------------------------

export type Verdict = { pass: boolean; hint?: string };
export type Rule = {
  id: string;
  text: string;
  /** A stretch rule is optional: the scenario is complete without it. */
  stretch?: true;
  check: (d: Diagram) => Verdict;
};

export const ok: Verdict = { pass: true };
export const no = (hint?: string): Verdict => ({ pass: false, hint });

export const judge = (rules: Rule[], d: Diagram) => rules.map((rule) => ({ rule, ...rule.check(d) }));

/** A scenario is data: a brief, the services on offer, and the rules that judge the result. */
export type Scenario = {
  id: string;
  title: string;
  brief: string;
  /** The part of the brief to pick out, which must appear in it word for word. */
  stress: string;
  palette: Kind[];
  rules: Rule[];
  /** Why a connection between two kinds isn't needed here, keyed "kind|kind" in alphabetical order. */
  unneeded: (a: Kind, b: Kind) => string | null;
};
