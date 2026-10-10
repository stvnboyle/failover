import type { Unit } from "@/content/schema";
import { regions } from "./lesson-1-regions";
import { vpc } from "./lesson-2-vpc";
import { servers } from "./lesson-3-servers";
import { loadBalancing } from "./lesson-4-load-balancing";
import { autoScaling } from "./lesson-5-auto-scaling";
import { database } from "./lesson-6-database";

export const webApp: Unit = {
  id: "web-app",
  title: "Run a web app that survives a data-centre failure",
  scenario: "The site now has a server and a database. Keep it serving when a whole data centre goes dark.",
  lessons: [regions, vpc, servers, loadBalancing, autoScaling, database],
  capstone: { title: "Build it yourself", href: "/prototype/canvas" },
};
