import { Coverage } from "@/components/coverage";
import { exercisesOf, UNITS } from "@/content";
import { SCENARIOS } from "@/lib/canvas/scenarios";

export default function Page() {
  // Only what the view needs: which exam domains each written exercise counts towards.
  const exercises = UNITS.flatMap((unit) =>
    unit.lessons.flatMap((lesson) => exercisesOf(lesson).map((e) => ({ id: e.id, domains: e.domains }))),
  );
  // A scenario built on the canvas counts towards its domains in the same way an exercise does.
  const scenarios = SCENARIOS.map((s) => ({ id: `capstone:${s.id}`, domains: s.domains }));
  return <Coverage exercises={[...exercises, ...scenarios]} />;
}
