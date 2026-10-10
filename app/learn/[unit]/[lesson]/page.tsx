import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Player } from "@/components/lesson/player";
import { findLesson, isWritten, WRITTEN } from "@/content";

export function generateStaticParams() {
  return WRITTEN.map(({ unit, lesson }) => ({ unit: unit.id, lesson: lesson.id }));
}

async function LessonRoute({ params }: Pick<PageProps<"/learn/[unit]/[lesson]">, "params">) {
  const { unit: unitId, lesson: lessonId } = await params;
  const found = findLesson(unitId, lessonId);
  if (!found || !isWritten(found.lesson)) notFound();

  const following = WRITTEN[WRITTEN.findIndex((w) => w.lesson === found.lesson) + 1];
  const next = following
    ? { href: `/learn/${following.unit.id}/${following.lesson.id}`, title: following.lesson.title }
    : null;

  return <Player lesson={found.lesson} next={next} />;
}

// The route's params are read behind Suspense, so a link to this page can show its shell straight away.
export default function Page({ params }: PageProps<"/learn/[unit]/[lesson]">) {
  return (
    <Suspense>
      <LessonRoute params={params} />
    </Suspense>
  );
}
