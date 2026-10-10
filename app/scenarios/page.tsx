import { ScenarioList } from "@/components/canvas/scenario-list";
import { EXAM_DOMAINS } from "@/content/taxonomy";
import { SCENARIOS } from "@/lib/canvas/scenarios";

export default function Page() {
  // Only what the list shows. The rules stay with the canvas.
  const scenarios = SCENARIOS.map((s) => ({
    id: s.id,
    title: s.title,
    summary: s.summary,
    checks: s.rules.filter((r) => !r.stretch).length,
    domains: s.domains.map((d) => EXAM_DOMAINS[d].name),
  }));
  return <ScenarioList scenarios={scenarios} />;
}
