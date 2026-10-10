"use client";

import Link from "next/link";
import { EXAM_DOMAINS } from "@/content/schema";
import { mastered, useProgress } from "@/lib/progress";

type DomainId = keyof typeof EXAM_DOMAINS;

const EXAMS = [
  { code: "CLF-C02", name: "Cloud Practitioner" },
  { code: "SAA-C03", name: "Solutions Architect Associate" },
] as const;

export function Coverage({ exercises }: { exercises: { id: string; domains: DomainId[] }[] }) {
  const known = mastered(useProgress());

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6">
      <header className="flex items-center justify-between py-5 text-xs">
        <Link href="/" className="text-zinc-200 transition-colors hover:text-zinc-50">
          failover
        </Link>
        <Link href="/" className="text-zinc-500 transition-colors hover:text-zinc-100">
          ./path
        </Link>
      </header>

      <main className="flex flex-1 flex-col gap-12 py-10">
        <section>
          <h1 className="text-[32px] leading-tight text-zinc-100">Exam coverage</h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-400">
            Every exercise counts towards one or more exam domains. This shows how much of what is written you have got
            right at least once.
          </p>
          <p className="mt-4 max-w-xl rounded-xl border border-amber-400/30 bg-amber-400/[0.05] px-4 py-3 text-xs leading-relaxed text-amber-200">
            What is written so far is a small part of either exam. A full bar here means you have finished the lessons
            that exist, not that you are ready to sit the exam.
          </p>
        </section>

        {EXAMS.map((exam) => {
          const domains = (Object.keys(EXAM_DOMAINS) as DomainId[]).filter((d) => EXAM_DOMAINS[d].exam === exam.code);
          return (
            <section key={exam.code}>
              <p className="text-[11px] text-zinc-500">
                {"// "}
                {exam.code}
              </p>
              <h2 className="mt-2 text-lg text-zinc-100">{exam.name}</h2>
              <ul className="mt-5 flex flex-col gap-5">
                {domains.map((d) => {
                  const written = exercises.filter((e) => e.domains.includes(d));
                  const got = written.filter((e) => known.has(e.id)).length;
                  return (
                    <li key={d}>
                      <div className="flex items-baseline justify-between gap-4 text-sm">
                        <span className="text-zinc-200">{EXAM_DOMAINS[d].name}</span>
                        <span className="shrink-0 text-[11px] text-zinc-500">{EXAM_DOMAINS[d].weight}% of the exam</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-emerald-400 transition-[width] duration-700 ease-out"
                          style={{ width: written.length ? `${(got / written.length) * 100}%` : 0 }}
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] text-zinc-500">
                        {written.length === 0 ? (
                          "Nothing written for this domain yet."
                        ) : (
                          <>
                            <span className={got > 0 ? "text-emerald-300" : ""}>{got}</span> of {written.length} written
                            exercises right at least once
                          </>
                        )}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </main>

      <footer className="border-t border-zinc-800 py-6 text-[11px] leading-relaxed text-zinc-500">
        Domain names and weightings are taken from the official AWS exam guides. failover is an independent project,
        not affiliated with or endorsed by Amazon Web Services.
      </footer>
    </div>
  );
}
