"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Lesson, Unit } from "@/content/schema";
import { exportSave, importSave, mastered, useProgress } from "@/lib/progress";

const exercisesIn = (lesson: Lesson) => lesson.steps.filter((s) => s.type !== "card");
const ideasIn = (lesson: Lesson) => lesson.steps.filter((s) => s.type === "card").length;

export function Path({ units }: { units: Unit[] }) {
  const known = mastered(useProgress());
  const [notice, setNotice] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const doneCount = (lesson: Lesson) => exercisesIn(lesson).filter((e) => known.has(e.id)).length;
  const isDone = (lesson: Lesson) => lesson.steps.length > 0 && doneCount(lesson) === exercisesIn(lesson).length;
  // Nothing is locked. This is only the suggestion for where to go next.
  const nextUp = units.flatMap((u) => u.lessons).find((l) => l.steps.length > 0 && !isDone(l));

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportSave()], { type: "application/json" }));
    Object.assign(document.createElement("a"), { href: url, download: "failover-progress.json" }).click();
    URL.revokeObjectURL(url);
  };

  const restore = async (picked: File | undefined) => {
    if (!picked) return;
    try {
      importSave(await picked.text());
      setNotice("Progress restored from file.");
    } catch {
      setNotice("That file isn't a failover progress export.");
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6">
      <header className="flex items-center justify-between py-5 text-xs">
        <span className="text-zinc-200">failover</span>
        <span className="text-zinc-500">desktop preview</span>
      </header>

      <main className="flex flex-1 flex-col gap-14 py-10">
        <section>
          <h1 className="text-[32px] leading-tight text-zinc-50">
            Learn how AWS fits together, <span className="text-emerald-400">by building it.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-400">
            Short scenarios in place of long documentation. Each one starts with a problem and adds a service only when
            the problem needs it.
          </p>
        </section>

        {units.map((unit, u) => (
          <section key={unit.id}>
            <p className="text-[11px] text-zinc-500">
              {"// unit "}
              {String(u + 1).padStart(2, "0")}
            </p>
            <h2 className="mt-2 text-lg text-zinc-100">{unit.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500">{unit.scenario}</p>

            <ol className="mt-6">
              {[...unit.lessons, ...(unit.capstone ? [null] : [])].map((lesson, i, all) => {
                const last = i === all.length - 1;
                const written = lesson ? lesson.steps.length > 0 : Boolean(unit.capstone?.href);
                const done = lesson ? isDone(lesson) : false;
                const current = lesson !== null && lesson === nextUp;
                const href = lesson ? `/learn/${unit.id}/${lesson.id}` : unit.capstone?.href;
                const title = lesson ? lesson.title : unit.capstone!.title;

                const body = (
                  <div
                    className={`flex items-center gap-4 rounded-md border px-4 py-3 transition-colors ${
                      current
                        ? "border-emerald-400/50 bg-emerald-400/[0.04]"
                        : written
                          ? "border-zinc-800 group-hover:border-zinc-600"
                          : "border-transparent"
                    }`}
                  >
                    <span className="w-6 text-xs text-zinc-600">{lesson ? String(i + 1).padStart(2, "0") : "◆"}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${written ? "text-zinc-100" : "text-zinc-500"}`}>{title}</span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500">
                        {lesson ? lesson.summary : "Place and connect the services yourself, then try to break it."}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-[11px]">
                      {!written ? (
                        <span className="text-zinc-600">not written yet</span>
                      ) : !lesson ? (
                        <span className="text-amber-400">prototype →</span>
                      ) : done ? (
                        <span className="text-emerald-400">✓ done</span>
                      ) : current ? (
                        <span className="text-emerald-300">{doneCount(lesson) > 0 ? "continue" : "start here"} →</span>
                      ) : (
                        <span className="text-zinc-400">open →</span>
                      )}
                      {lesson && written && (
                        <span className="mt-0.5 block text-zinc-600">
                          {doneCount(lesson)}/{exercisesIn(lesson).length} · {ideasIn(lesson)} ideas
                        </span>
                      )}
                    </span>
                  </div>
                );

                return (
                  <li key={lesson?.id ?? "capstone"} className="flex gap-4">
                    {/* The rail: a dot per stop, joined by a line, like a commit graph. */}
                    <div className="flex w-3 flex-col items-center">
                      <span className={`h-5 w-px ${i === 0 ? "bg-transparent" : "bg-zinc-800"}`} />
                      <span
                        className={`size-2.5 shrink-0 rounded-full border ${
                          done
                            ? "border-emerald-400 bg-emerald-400"
                            : current
                              ? "border-emerald-400"
                              : written
                                ? "border-zinc-500"
                                : "border-zinc-800"
                        }`}
                      />
                      <span className={`w-px flex-1 ${last ? "bg-transparent" : "bg-zinc-800"}`} />
                    </div>
                    <div className="flex-1 py-1">
                      {written && href ? (
                        <Link href={href} className="group block">
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </main>

      <footer className="flex flex-col gap-3 border-t border-zinc-800/80 py-6 text-[11px] leading-relaxed text-zinc-500">
        <p>
          Progress is saved in this browser only, with no account. Clearing your browser&apos;s site data removes it, so
          keep a copy if it matters:{" "}
          <button onClick={download} className="text-zinc-300 transition-colors hover:text-white">
            ./export
          </button>{" "}
          <button onClick={() => file.current?.click()} className="text-zinc-300 transition-colors hover:text-white">
            ./import
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              restore(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {notice && <span className="ml-2 text-zinc-300">{notice}</span>}
        </p>
        <p>failover is an independent project. It is not affiliated with or endorsed by Amazon Web Services.</p>
      </footer>
    </div>
  );
}
