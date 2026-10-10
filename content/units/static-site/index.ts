import type { Unit } from "@/content/schema";
import { bucket } from "./lesson-1-bucket";

export const staticSite: Unit = {
  id: "static-site",
  title: "Put a static site on the internet",
  scenario: "You have a folder of HTML, CSS and images. Get it in front of the world, quickly and safely.",
  lessons: [
    bucket,
    {
      id: "cdn",
      title: "A front door near every visitor",
      summary: "CloudFront: caching the site close to people, and speaking HTTPS for the bucket.",
      steps: [],
    },
    {
      id: "dns",
      title: "A name people can type",
      summary: "Route 53: pointing your own domain at the site.",
      steps: [],
    },
  ],
};
