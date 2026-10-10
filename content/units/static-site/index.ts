import type { Unit } from "@/content/schema";
import { bucket } from "./lesson-1-bucket";
import { cdn } from "./lesson-2-cdn";
import { dns } from "./lesson-3-dns";

export const staticSite: Unit = {
  id: "static-site",
  title: "Put a static site on the internet",
  scenario: "You have a folder of HTML, CSS and images. Get it in front of the world, quickly and safely.",
  lessons: [bucket, cdn, dns],
};
