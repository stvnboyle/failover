import {
  azOf,
  AZS,
  COMPUTE,
  linked,
  neighbours,
  no,
  ofKind,
  ok,
  serves,
  tierOf,
  zonesOf,
  type Kind,
  type Node,
  type Rule,
  type Scenario,
} from "./model";

export const KIND_LABEL: Record<Kind, string> = {
  users: "Users",
  alb: "Load balancer",
  asg: "Auto Scaling group",
  ec2: "Single server",
  rds: "Database",
  nat: "NAT gateway",
};

/** What each service is, without saying where it belongs. */
export const KIND_INFO: Record<Kind, string> = {
  users: "People reaching the app from the internet.",
  alb: "Takes incoming web requests and shares them out between servers, skipping any that fail a health check.",
  asg: "Keeps a set number of identical servers running, replacing any that fail and adding more under load.",
  ec2: "One virtual server, launched by hand. If it fails, it stays failed until someone replaces it.",
  rds: "A managed relational database. It can keep a standby copy for you in a second zone.",
  nat: "Lets servers with no public address make outbound calls to the internet. It never accepts incoming connections.",
};

const isPrivate = (n: Node) => tierOf(n) === "app" || tierOf(n) === "data";
const isPublic = (n: Node) => tierOf(n) === "public";

const RULES: Rule[] = [
  {
    id: "entry",
    text: "Users reach the app only through the load balancer",
    check: (d) => {
      const [users] = ofKind(d, "users");
      const reached = neighbours(d, users);
      if (!reached.some((n) => n.kind === "alb")) return no();
      const direct = reached.find((n) => n.kind !== "alb");
      return direct ? no(`Users are wired straight to the ${KIND_LABEL[direct.kind].toLowerCase()}.`) : ok;
    },
  },
  {
    id: "lb-zones",
    text: "The load balancer is public and switched on in both zones",
    check: (d) => {
      const lbs = ofKind(d, "alb");
      if (lbs.length === 0) return no();
      if (lbs.some((n) => !isPublic(n))) return no("A load balancer in a private subnet can't be reached from the internet.");
      return lbs.every((n) => n.both)
        ? ok
        : no("It is only switched on in one zone. If that zone fails, the front door goes with it.");
    },
  },
  {
    id: "app-private",
    text: "App servers run in private subnets",
    check: (d) => {
      const apps = ofKind(d, ...COMPUTE);
      if (apps.length === 0) return no();
      return apps.every(isPrivate) ? ok : no("App servers in a public subnet are exposed to the internet.");
    },
  },
  {
    id: "app-zones",
    text: "The load balancer sends traffic to app servers in both zones",
    check: (d) => {
      const zones = new Set(
        ofKind(d, "alb").flatMap((lb) =>
          neighbours(d, lb)
            .filter((n) => COMPUTE.includes(n.kind))
            .flatMap(zonesOf),
        ),
      );
      if (zones.size === 2) return ok;
      return zones.size === 1 ? no("Every app server it reaches is in the same zone.") : no();
    },
  },
  {
    id: "self-healing",
    text: "A failed app server is replaced automatically",
    check: (d) => {
      const apps = ofKind(d, ...COMPUTE);
      if (apps.length === 0) return no();
      return apps.every((n) => n.kind === "asg")
        ? ok
        : no("A server launched by hand stays down when it fails. Something has to be watching and replacing it.");
    },
  },
  {
    id: "db-private",
    text: "The database is in a private subnet",
    check: (d) => {
      const dbs = ofKind(d, "rds");
      if (dbs.length === 0) return no();
      return dbs.every(isPrivate) ? ok : no("A database in a public subnet can be reached from the internet.");
    },
  },
  {
    id: "db-standby",
    text: "The database has a standby in the other zone",
    check: (d) => {
      const dbs = ofKind(d, "rds");
      if (dbs.length === 0) return no();
      return dbs.every((n) => n.both) ? ok : no("It runs in one zone only. Losing that zone loses the database.");
    },
  },
  {
    id: "app-db",
    text: "Every app server can reach the database",
    check: (d) => {
      const apps = ofKind(d, ...COMPUTE);
      const dbs = ofKind(d, "rds");
      if (apps.length === 0 || dbs.length === 0) return no();
      return apps.every((a) => dbs.some((db) => linked(d, a, db))) ? ok : no("Some app servers have no connection to it.");
    },
  },
  {
    id: "db-isolated",
    text: "Only app servers talk to the database",
    check: (d) => {
      const dbs = ofKind(d, "rds");
      if (dbs.length === 0) return no();
      const intruder = dbs.flatMap((db) => neighbours(d, db)).find((n) => !COMPUTE.includes(n.kind));
      if (!intruder) return ok;
      const who = intruder.kind === "users" ? "users" : `the ${KIND_LABEL[intruder.kind].toLowerCase()}`;
      return no(`There is a direct connection between ${who} and the database.`);
    },
  },
  {
    id: "survive",
    text: "The app keeps serving if either zone fails",
    check: (d) => {
      if (!serves(d, null)) return no();
      const fatal = AZS.filter((az) => !serves(d, az));
      if (fatal.length === 0) return ok;
      return no(
        fatal.length === 2
          ? "Losing either zone takes the app down."
          : `Losing eu-west-2${fatal[0]} takes the app down. Fail it and see why.`,
      );
    },
  },
  {
    id: "outbound",
    text: "App servers can download updates, even if a zone fails",
    stretch: true,
    check: (d) => {
      const apps = ofKind(d, ...COMPUTE);
      const nats = ofKind(d, "nat");
      if (apps.length === 0 || nats.length === 0) return no();
      if (nats.some((n) => !isPublic(n)))
        return no("A NAT gateway in a private subnet has no way out to the internet itself.");
      const routes = (a: Node) => neighbours(d, a).filter((n) => n.kind === "nat");
      if (apps.some((a) => routes(a).length === 0)) return no("Some app servers have no route out through a NAT gateway.");
      const covered = apps.every((a) => zonesOf(a).every((z) => routes(a).some((n) => azOf(n) === z)));
      return covered
        ? ok
        : no("App servers in one zone rely on a NAT gateway in the other. If that zone fails, they lose their way out.");
    },
  },
];

const NEEDED = new Set(["alb|users", "alb|asg", "alb|ec2", "asg|rds", "ec2|rds", "asg|nat", "ec2|nat"]);

const UNNEEDED: Record<string, string> = {
  "asg|users": "Users shouldn't reach app servers directly. That skips the load balancer, and servers in a private subnet can't be reached from the internet anyway.",
  "ec2|users": "Users shouldn't reach an app server directly. That skips the load balancer, and a server in a private subnet can't be reached from the internet anyway.",
  "rds|users": "Nothing on the internet should talk to the database. Only the app servers do.",
  "nat|users": "A NAT gateway only carries traffic out from private servers. It doesn't accept connections coming in.",
  "alb|rds": "The load balancer hands web requests to app servers. It never talks to the database itself.",
  "alb|nat": "Incoming requests go from the load balancer to app servers. A NAT gateway is only for traffic heading out.",
  "alb|alb": "One load balancer doesn't feed another here. It sends requests straight to app servers.",
  "asg|asg": "These groups don't need each other. Each server handles its own requests.",
  "asg|ec2": "App servers don't need each other. Each one handles its own requests, which is what lets any of them fail safely.",
  "ec2|ec2": "App servers don't need each other. Each one handles its own requests, which is what lets any of them fail safely.",
  "nat|rds": "The database has no reason to reach the internet, so it doesn't need a NAT gateway.",
  "nat|nat": "NAT gateways work independently, one per zone. They don't connect to each other.",
  "rds|rds": "These two databases don't exchange traffic in this design.",
};

export const webApp: Scenario = {
  id: "web-app",
  title: "Build it yourself",
  brief: "Host this web app so it keeps serving when a data centre fails.",
  stress: "when a data centre fails",
  palette: ["alb", "asg", "ec2", "rds", "nat"],
  rules: RULES,
  unneeded: (a, b) => {
    const pair = [a, b].sort().join("|");
    return NEEDED.has(pair) ? null : (UNNEEDED[pair] ?? "These two don't exchange traffic in this design.");
  },
};

export const SCENARIOS: Scenario[] = [webApp];
export const findScenario = (id: string) => SCENARIOS.find((s) => s.id === id);
