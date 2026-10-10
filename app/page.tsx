import { Path, type PathUnit } from "@/components/path";
import { exercisesOf, UNITS } from "@/content";

// The path only needs an outline, so the lessons' full content stays on the server.
const outline: PathUnit[] = UNITS.map((unit) => ({
  id: unit.id,
  title: unit.title,
  scenario: unit.scenario,
  capstone: unit.capstone,
  lessons: unit.lessons.map((lesson) => {
    const exercises = exercisesOf(lesson).map((e) => e.id);
    return {
      id: lesson.id,
      title: lesson.title,
      summary: lesson.summary,
      exercises,
      ideas: lesson.steps.length - exercises.length,
    };
  }),
}));

export default function Home() {
  return <Path units={outline} />;
}
