import { Coverage } from "@/components/coverage";
import { exercisesOf, UNITS } from "@/content";

export default function Page() {
  // Only what the view needs: which exam domains each written exercise counts towards.
  const exercises = UNITS.flatMap((unit) =>
    unit.lessons.flatMap((lesson) => exercisesOf(lesson).map((e) => ({ id: e.id, domains: e.domains }))),
  );
  return <Coverage exercises={exercises} />;
}
