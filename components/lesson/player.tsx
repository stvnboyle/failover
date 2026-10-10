"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Chain, PartCard } from "@/components/diagram";
import type { Lesson, Step } from "@/content/schema";
import { record } from "@/lib/progress";
import { ExerciseView, type Answer } from "./exercises";

const KIND_LABEL = { card: "new idea", choice: "choose one", match: "match the pairs", slot: "fill the gap", fix: "fix the design" };

export function Player({
  unitTitle,
  lesson,
  next,
}: {
  unitTitle: string;
  lesson: Lesson;
  next: { href: string; title: string } | null;
}) {
  // Missed exercises are appended to the queue, so the lesson ends with everything answered correctly once.
  const [queue, setQueue] = useState<Step[]>(lesson.steps);
  const [at, setAt] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [checked, setChecked] = useState(false);
  const [cleared, setCleared] = useState(0);
  const [missed, setMissed] = useState<string[]>([]);

  const step: Step | undefined = queue[at];
  const exercises = lesson.steps.filter((s) => s.type !== "card");

  const check = (given: Answer) => {
    if (!step || step.type === "card") return;
    setChecked(true);
    record(step.id, given.correct);
    if (!given.correct && !missed.includes(step.id)) setMissed([...missed, step.id]);
  };

  const advance = () => {
    if (!step) return;
    const wrong = step.type !== "card" && !answer?.correct;
    if (wrong) setQueue([...queue, step]);
    else setCleared(cleared + 1);
    setAt(at + 1);
    setAnswer(null);
    setChecked(false);
  };

  const ready = step?.type === "card" || checked || answer !== null;
  const proceed = () => {
    if (!step) return;
    if (step.type === "card" || checked) advance();
    else if (answer) check(answer);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      proceed();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const good = checked && answer?.correct;
  const bad = checked && !answer?.correct;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-zinc-800/80 px-5 py-3 text-xs">
        <span className="truncate text-zinc-500">
          <Link href="/" className="transition-colors hover:text-zinc-200">
            failover
          </Link>{" "}
          <span className="text-zinc-700">/</span> {unitTitle} <span className="text-zinc-700">/</span>{" "}
          <span className="text-zinc-200">{lesson.title}</span>
        </span>
        <div className="ml-auto flex w-72 shrink-0 gap-1" aria-label={`${cleared} of ${lesson.steps.length} steps done`}>
          {lesson.steps.map((s, i) => (
            <span
              key={s.id}
              className={`h-1 flex-1 rounded-full transition-colors duration-700 ${i < cleared ? "bg-emerald-400" : "bg-zinc-800"}`}
            />
          ))}
        </div>
        <Link href="/" className="shrink-0 text-zinc-500 transition-colors hover:text-zinc-100">
          ./exit
        </Link>
      </header>

      {step ? (
        <>
          <main key={`${step.id}-${at}`} className="rise-in mx-auto flex w-full max-w-3xl flex-1 flex-col gap-7 px-6 py-12">
            <p className="text-[11px] text-zinc-500">
              {"// "}
              {KIND_LABEL[step.type]}
              {at >= lesson.steps.length && " · second attempt"}
            </p>
            {step.type === "card" ? (
              <>
                <h1 className="text-[26px] leading-snug text-zinc-50">{step.title}</h1>
                <Chain>{step.diagram.map((p) => <PartCard key={p.id} part={p} />)}</Chain>
                <p className="text-base leading-relaxed text-zinc-300">{step.body}</p>
              </>
            ) : (
              <>
                <h1 className="text-xl leading-snug text-zinc-50">{step.prompt}</h1>
                <ExerciseView
                  exercise={step}
                  locked={checked}
                  onAnswer={(a) => {
                    setAnswer(a);
                    if (a?.final) check(a);
                  }}
                />
              </>
            )}
          </main>

          <footer
            className={`sticky bottom-0 border-t transition-colors duration-500 ${
              good ? "border-emerald-400/40 bg-[#0a1410]" : bad ? "border-amber-400/40 bg-[#14110a]" : "border-zinc-800/80 bg-[#09090b]"
            }`}
          >
            <div className="mx-auto flex max-w-3xl items-end gap-6 px-6 py-5">
              <div className="min-h-12 flex-1 text-sm leading-relaxed">
                {checked && step.type !== "card" && (
                  <div className="rise-in">
                    <p className={good ? "text-emerald-400" : "text-amber-400"}>
                      {good ? "✓ Correct" : "✗ Not quite"}
                      {bad && <span className="text-zinc-500"> · this one comes back at the end</span>}
                    </p>
                    {answer?.why && <p className="mt-1 text-zinc-200">{answer.why}</p>}
                    <p className="mt-1 text-zinc-400">{step.explanation}</p>
                    <a
                      href={step.source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs text-zinc-500 transition-colors hover:text-zinc-200"
                    >
                      read more: {step.source.title} ↗
                    </a>
                  </div>
                )}
              </div>
              <button
                onClick={proceed}
                disabled={!ready}
                className={`shrink-0 rounded-md border px-5 py-2.5 text-sm transition-colors ${
                  ready
                    ? "border-zinc-200 bg-zinc-100 text-zinc-950 hover:bg-white"
                    : "border-zinc-800 text-zinc-600"
                }`}
              >
                {step.type === "card" ? "Got it" : checked ? "Continue" : "Check"} <span className="opacity-50">↵</span>
              </button>
            </div>
          </footer>
        </>
      ) : (
        <main className="rise-in mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-7 px-6 py-12">
          <p className="text-[11px] text-zinc-500">{"// lesson complete"}</p>
          <h1 className="text-[26px] leading-snug text-zinc-50">{lesson.title}</h1>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-zinc-500">right first time</dt>
            <dd className="text-zinc-100">
              {exercises.length - missed.length} of {exercises.length}
            </dd>
            <dt className="text-zinc-500">came back around</dt>
            <dd className="text-zinc-100">{missed.length}</dd>
            <dt className="text-zinc-500">ideas covered</dt>
            <dd className="text-zinc-100">
              {lesson.steps.flatMap((s) => (s.type === "card" ? [s.title] : [])).join(" · ")}
            </dd>
          </dl>
          <div className="flex gap-3 text-sm">
            {next && (
              <Link href={next.href} className="rounded-md border border-zinc-200 bg-zinc-100 px-5 py-2.5 text-zinc-950 transition-colors hover:bg-white">
                Next: {next.title} →
              </Link>
            )}
            <Link href="/" className="rounded-md border border-zinc-700 px-5 py-2.5 text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100">
              Back to the path
            </Link>
          </div>
        </main>
      )}
    </div>
  );
}
