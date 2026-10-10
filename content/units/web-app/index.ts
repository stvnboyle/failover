import type { Unit } from "@/content/schema";
import { regions } from "./lesson-1-regions";
import { vpc } from "./lesson-2-vpc";

const planned = (id: string, title: string, summary: string) => ({ id, title, summary, steps: [] });

export const webApp: Unit = {
  id: "web-app",
  title: "Run a web app that survives a data-centre failure",
  scenario: "The site now has a server and a database. Keep it serving when a whole data centre goes dark.",
  lessons: [
    regions,
    vpc,
    planned("servers", "Servers and security groups", "Virtual machines and who is allowed to talk to them."),
    planned("load-balancing", "Load balancing", "One front door, many servers behind it."),
    planned("auto-scaling", "Auto scaling", "Replacing servers that fail and adding more under load."),
    planned("database", "A database that fails over", "A primary, a standby, and what happens when one is lost."),
  ],
  capstone: { title: "Build it yourself", href: "/prototype/canvas" },
};
