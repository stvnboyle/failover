import { notFound } from "next/navigation";
import { Player } from "@/components/lesson/player";
import { findLesson, isWritten, WRITTEN } from "@/content";

export function generateStaticParams() {
  return WRITTEN.map(({ unit, lesson }) => ({ unit: unit.id, lesson: lesson.id }));
}

export default async function Page({ params }: PageProps<"/learn/[unit]/[lesson]">) {
  const { unit: unitId, lesson: lessonId } = await params;
  const found = findLesson(unitId, lessonId);
  if (!found || !isWritten(found.lesson)) notFound();

  const following = WRITTEN[WRITTEN.findIndex((w) => w.lesson === found.lesson) + 1];
  const next = following
    ? { href: `/learn/${following.unit.id}/${following.lesson.id}`, title: following.lesson.title }
    : null;

  return <Player unitTitle={found.unit.title} lesson={found.lesson} next={next} />;
}
