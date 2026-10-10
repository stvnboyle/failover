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
  WEB,
  zonesOf,
  type Diagram,
  type Kind,
  type Node,
  type Rule,
  type Scenario,
  type Shape,
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

const PALETTE: Kind[] = ["alb", "asg", "ec2", "rds", "nat"];

const isPrivate = (n: Node) => tierOf(n) === "app" || tierOf(n) === "data";
const isPublic = (n: Node) => tierOf(n) === "public";
const apps = (d: Diagram) => ofKind(d, ...COMPUTE);
const natRoutes = (d: Diagram, a: Node) => neighbours(d, a).filter((n) => n.kind === "nat");

// ---- the rule library ---------------------------------------------------------
// Every scenario is a selection from these. Each rule stays unlit until the diagram has
// something for it to judge, so an empty canvas never starts with ticks.

const entry: Rule = {
  id: "entry",
  text: "Users reach the app only through the load balancer",
  check: (d) => {
    const [users] = ofKind(d, "users");
    const reached = neighbours(d, users);
    if (!reached.some((n) => n.kind === "alb")) return no();
    const direct = reached.find((n) => n.kind !== "alb");
    return direct ? no(`Users are wired straight to the ${KIND_LABEL[direct.kind].toLowerCase()}.`) : ok;
  },
};

const lbZones: Rule = {
  id: "lb-zones",
  text: "The load balancer is public and switched on in both zones",
  check: (d) => {
    const lbs = ofKind(d, "alb");
    if (lbs.length === 0) return no();
    if (lbs.some((n) => !isPublic(n))) return no("A load balancer in a private subnet can't be reached from the internet.");
    return lbs.every((n) => n.both) ? ok : no("An Application Load Balancer has to be switched on in at least two zones.");
  },
};

const appPrivate: Rule = {
  id: "app-private",
  text: "App servers run in private subnets",
  check: (d) => {
    if (apps(d).length === 0) return no();
    return apps(d).every(isPrivate) ? ok : no("App servers in a public subnet are exposed to the internet.");
  },
};

const appZones: Rule = {
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
};

const selfHealing: Rule = {
  id: "self-healing",
  text: "A failed app server is replaced automatically",
  check: (d) => {
    if (apps(d).length === 0) return no();
    return apps(d).every((n) => n.kind === "asg")
      ? ok
      : no("A server launched by hand stays down when it fails. Something has to be watching and replacing it.");
  },
};

const dbPrivate: Rule = {
  id: "db-private",
  text: "The database is in a private subnet",
  check: (d) => {
    const dbs = ofKind(d, "rds");
    if (dbs.length === 0) return no();
    return dbs.every(isPrivate) ? ok : no("A database in a public subnet can be reached from the internet.");
  },
};

const dbStandby: Rule = {
  id: "db-standby",
  text: "The database has a standby in the other zone",
  check: (d) => {
    const dbs = ofKind(d, "rds");
    if (dbs.length === 0) return no();
    return dbs.every((n) => n.both) ? ok : no("It runs in one zone only. Losing that zone loses the database.");
  },
};

const appDb: Rule = {
  id: "app-db",
  text: "Every app server can reach the database",
  check: (d) => {
    const dbs = ofKind(d, "rds");
    if (apps(d).length === 0 || dbs.length === 0) return no();
    return apps(d).every((a) => dbs.some((db) => linked(d, a, db))) ? ok : no("Some app servers have no connection to it.");
  },
};

const dbIsolated: Rule = {
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
};

const noDatabase: Rule = {
  id: "no-database",
  text: "Nothing is stored, so there is no database to pay for",
  check: (d) => {
    if (apps(d).length === 0) return no();
    return ofKind(d, "rds").length === 0 ? ok : no("The brief says this service stores nothing. A database here is cost with no purpose.");
  },
};

const reachable: Rule = {
  id: "reachable",
  text: "Users can reach the app",
  check: (d) => (serves(d, null) ? ok : no()),
};

const reachableApi: Rule = {
  id: "reachable",
  text: "Users can reach the API",
  check: (d) => (serves(d, null, { inbound: true, database: false }) ? ok : no()),
};

const oneAppZone: Rule = {
  id: "one-app-zone",
  text: "Only one app server is paid for",
  check: (d) => {
    if (apps(d).length === 0) return no();
    const count = apps(d).reduce((n, a) => n + zonesOf(a).length, 0);
    return count === 1 ? ok : no("Servers in a second zone double the bill, for an app that is allowed to go down.");
  },
};

const oneDbZone: Rule = {
  id: "one-db-zone",
  text: "Only one database is paid for",
  check: (d) => {
    const dbs = ofKind(d, "rds");
    if (dbs.length === 0) return no();
    return dbs.length === 1 && !dbs[0].both ? ok : no("A standby is a second database to pay for, and this brief doesn't ask to survive a failure.");
  },
};

const nothingExtra: Rule = {
  id: "nothing-extra",
  text: "Nothing is running that the brief doesn't ask for",
  check: (d) => {
    if (apps(d).length === 0) return no();
    return ofKind(d, "nat").length === 0 ? ok : no("Nothing in the brief needs to call out to the internet, so the NAT gateway is money spent for nothing.");
  },
};

const noInbound: Rule = {
  id: "no-inbound",
  text: "Nothing accepts connections from the internet",
  check: (d) => {
    if (apps(d).length === 0) return no();
    if (ofKind(d, "alb").length > 0) return no("A load balancer exists to accept connections, which this brief rules out.");
    const [users] = ofKind(d, "users");
    return neighbours(d, users).length === 0 ? ok : no("Something is wired to the internet side. These jobs only ever call out.");
  },
};

const jobZones: Rule = {
  id: "job-zones",
  text: "The jobs run in both zones",
  check: (d) => {
    if (apps(d).length === 0) return no();
    return new Set(apps(d).flatMap(zonesOf)).size === 2 ? ok : no("Everything that runs the jobs is in one zone.");
  },
};

/** Servers can call out through a NAT gateway, with no zone depending on the other. */
const outbound = (text: string, stretch?: true): Rule => ({
  id: "outbound",
  text,
  stretch,
  check: (d) => {
    const nats = ofKind(d, "nat");
    if (apps(d).length === 0 || nats.length === 0) return no();
    if (nats.some((n) => !isPublic(n))) return no("A NAT gateway in a private subnet has no way out to the internet itself.");
    if (apps(d).some((a) => natRoutes(d, a).length === 0)) return no("Some servers have no route out through a NAT gateway.");
    const covered = apps(d).every((a) => zonesOf(a).every((z) => natRoutes(d, a).some((n) => azOf(n) === z)));
    return covered ? ok : no("Servers in one zone rely on a NAT gateway in the other. If that zone fails, they lose their way out.");
  },
});

/** Servers can call out through a NAT gateway. One is enough: nothing here has to survive a zone failing. */
const outboundBasic = (text: string): Rule => ({
  id: "outbound",
  text,
  check: (d) => {
    const nats = ofKind(d, "nat");
    if (apps(d).length === 0 || nats.length === 0) return no();
    if (nats.some((n) => !isPublic(n))) return no("A NAT gateway in a private subnet has no way out to the internet itself.");
    if (apps(d).some((a) => natRoutes(d, a).length === 0)) return no("Some servers have no route out through a NAT gateway.");
    return nats.length === 1 ? ok : no("One NAT gateway is enough here. A second is paying for resilience the brief doesn't ask for.");
  },
});

const survive = (shape: Shape, text: string): Rule => ({
  id: "survive",
  text,
  check: (d) => {
    if (!serves(d, null, shape)) return no();
    const fatal = AZS.filter((az) => !serves(d, az, shape));
    if (fatal.length === 0) return ok;
    return no(fatal.length === 2 ? "Losing either zone stops it." : `Losing eu-west-2${fatal[0]} stops it. Fail that zone and see why.`);
  },
});

// ---- connections that aren't needed --------------------------------------------

const WHY_NOT: Record<string, string> = {
  "asg|users": "Users shouldn't reach app servers directly. That skips the load balancer, and servers in a private subnet can't be reached from the internet anyway.",
  "ec2|users": "Users shouldn't reach an app server directly. That skips the load balancer, and a server in a private subnet can't be reached from the internet anyway.",
  "rds|users": "Nothing on the internet should talk to the database. Only the app servers do.",
  "nat|users": "A NAT gateway only carries traffic out from private servers. It doesn't accept connections coming in.",
  "alb|rds": "The load balancer hands web requests to app servers. It never talks to the database itself.",
  "alb|nat": "Incoming requests go from the load balancer to app servers. A NAT gateway is only for traffic heading out.",
  "alb|alb": "One load balancer doesn't feed another here. It sends requests straight to app servers.",
  "asg|asg": "These groups don't need each other. Each server handles its own work.",
  "asg|ec2": "App servers don't need each other. Each one handles its own work, which is what lets any of them fail safely.",
  "ec2|ec2": "App servers don't need each other. Each one handles its own work, which is what lets any of them fail safely.",
  "nat|rds": "The database has no reason to reach the internet, so it doesn't need a NAT gateway.",
  "nat|nat": "NAT gateways work independently, one per zone. They don't connect to each other.",
  "rds|rds": "These two databases don't exchange traffic in this design.",
};

/** Builds a scenario's "not needed" explanations from the connections its design does use. */
const unneededExcept =
  (needed: string[], overrides: Record<string, string> = {}) =>
  (a: Kind, b: Kind) => {
    const pair = [a, b].sort().join("|");
    if (needed.includes(pair)) return null;
    return overrides[pair] ?? WHY_NOT[pair] ?? "These two don't exchange traffic in this design.";
  };

const WEB_LINKS = ["alb|users", "alb|asg", "alb|ec2", "asg|rds", "ec2|rds", "asg|nat", "ec2|nat"];
const API_LINKS = ["alb|users", "alb|asg", "alb|ec2", "asg|nat", "ec2|nat"];
const NO_STORE = "This service stores nothing, so there is no database for anything to talk to.";
const NO_WAY_IN = "Nothing on the internet should be able to reach these jobs. They only ever call out.";

// ---- the scenarios ------------------------------------------------------------

const API: Shape = { inbound: true, database: false };
const JOBS: Shape = { inbound: false, database: true };

/** The capstone of unit 2, and the first scenario in the pool. */
export const webApp: Scenario = {
  id: "web-app",
  title: "Launch day",
  summary: "A web app with a database that has to stay up through a data centre failure.",
  brief: "Host this web app so it keeps serving when a data centre fails.",
  stress: "when a data centre fails",
  shape: WEB,
  palette: PALETTE,
  rules: [
    entry,
    lbZones,
    appPrivate,
    appZones,
    selfHealing,
    dbPrivate,
    dbStandby,
    appDb,
    dbIsolated,
    survive(WEB, "The app keeps serving if either zone fails"),
    outbound("App servers can download updates, even if a zone fails", true),
  ],
  unneeded: unneededExcept(WEB_LINKS),
  domains: ["saa-1", "saa-2"],
};

const demo: Scenario = {
  id: "demo-on-a-budget",
  title: "Demo on a budget",
  summary: "The same web app, shown to investors next week. It needs to be cheap, not bulletproof.",
  brief: "Host this demo as cheaply as you can. If a data centre fails it may go down, and that is fine.",
  stress: "as cheaply as you can",
  shape: WEB,
  palette: PALETTE,
  rules: [entry, lbZones, appPrivate, dbPrivate, appDb, dbIsolated, reachable, oneAppZone, oneDbZone, nothingExtra],
  unneeded: unneededExcept(WEB_LINKS),
  domains: ["saa-1", "saa-4"],
};

const api: Scenario = {
  id: "stateless-api",
  title: "The image resizer",
  summary: "An API that keeps no data, fetches images from other sites, and must not go down.",
  brief: "Run this image-resizing API so it survives a data centre failing. It stores nothing, and it fetches images from other sites.",
  stress: "It stores nothing",
  shape: API,
  palette: PALETTE,
  rules: [
    entry,
    lbZones,
    appPrivate,
    appZones,
    selfHealing,
    noDatabase,
    outbound("The servers can fetch images, even if a zone fails"),
    survive(API, "The API keeps serving if either zone fails"),
  ],
  unneeded: unneededExcept(API_LINKS, { "asg|rds": NO_STORE, "ec2|rds": NO_STORE }),
  domains: ["saa-2", "saa-4"],
};

const prototypeApi: Scenario = {
  id: "api-prototype",
  title: "Friday's prototype",
  summary: "A throwaway API for one afternoon's testing. It fetches from other sites and keeps nothing.",
  brief: "Stand up this prototype API as cheaply as you can. It stores nothing, and it calls other sites for its data.",
  stress: "as cheaply as you can",
  shape: API,
  palette: PALETTE,
  rules: [
    entry,
    lbZones,
    appPrivate,
    reachableApi,
    noDatabase,
    oneAppZone,
    outboundBasic("The server can call other sites, through a single NAT gateway"),
  ],
  unneeded: unneededExcept(API_LINKS, { "asg|rds": NO_STORE, "ec2|rds": NO_STORE }),
  domains: ["saa-1", "saa-4"],
};

const jobs: Scenario = {
  id: "night-jobs",
  title: "The night shift",
  summary: "Overnight jobs that pull data in from partners. Nothing on the internet may reach them.",
  brief: "Run these overnight jobs so they survive a data centre failing. They fetch data from partner sites and save it, and nothing on the internet should be able to reach them.",
  stress: "nothing on the internet should be able to reach them",
  shape: JOBS,
  palette: PALETTE,
  rules: [
    noInbound,
    appPrivate,
    selfHealing,
    jobZones,
    dbPrivate,
    dbStandby,
    appDb,
    dbIsolated,
    outbound("The jobs can reach partner sites, even if a zone fails"),
    survive(JOBS, "The jobs keep running if either zone fails"),
  ],
  unneeded: unneededExcept(["asg|rds", "ec2|rds", "asg|nat", "ec2|nat"], {
    "alb|users": NO_WAY_IN,
    "asg|users": NO_WAY_IN,
    "ec2|users": NO_WAY_IN,
    "alb|asg": "There are no incoming requests to share out, so these jobs don't need a load balancer.",
    "alb|ec2": "There are no incoming requests to share out, so these jobs don't need a load balancer.",
  }),
  domains: ["saa-1", "saa-2"],
};

export const SCENARIOS: Scenario[] = [webApp, demo, api, prototypeApi, jobs];
export const findScenario = (id: string) => SCENARIOS.find((s) => s.id === id);
