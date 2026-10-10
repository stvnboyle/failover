import { curriculum, type Exercise, type Lesson, type Unit } from "./schema";
import { staticSite } from "./units/static-site";
import { webApp } from "./units/web-app";

// Parsed on import, so a malformed exercise or a missing source link fails the build.
export const UNITS: Unit[] = curriculum.parse([staticSite, webApp]);

export const exercisesOf = (lesson: Lesson) => lesson.steps.filter((s): s is Exercise => s.type !== "card");

export const isWritten = (lesson: Lesson) => lesson.steps.length > 0;

export function findLesson(unitId: string, lessonId: string) {
  const unit = UNITS.find((u) => u.id === unitId);
  const lesson = unit?.lessons.find((l) => l.id === lessonId);
  return unit && lesson ? { unit, lesson } : null;
}

/** Every written lesson in path order, for working out what comes next. */
export const WRITTEN = UNITS.flatMap((unit) => unit.lessons.filter(isWritten).map((lesson) => ({ unit, lesson })));
