"use client";

import Link from "next/link";
import { useState } from "react";
import { Chain, PartCard } from "@/components/diagram";
import type { Lesson, Step } from "@/content/schema";
import { record } from "@/lib/progress";
import { useKeydown } from "@/lib/use-keydown";
import { ExerciseView, type Answer } from "./exercises";

// Each kind of step has its own colour, so a lesson reads as a sequence of different moves.
const KIND = {
  card: { label: "new idea", tone: "border-emerald-400/40 text-emerald-300" },
  choice: { label: "choose one", tone: "border-violet-400/40 text-violet-300" },
  match: { label: "match the pairs", tone: "border-sky-400/40 text-sky-300" },
  slot: { label: "fill the gap", tone: "border-orange-400/40 text-orange-300" },
  fix: { label: "fix the design", tone: "border-amber-400/40 text-amber-300" },
};

const PRAISE = ["Correct.", "Exactly.", "That's it.", "Spot on."];
const CONSOLATION = ["Not quite.", "Close, but no.", "Not this one."];

const KEY_PRIMARY = "border-emerald-600 bg-emerald-400 text-emerald-950 hover:bg-emerald-300";
const KEY_RETRY = "border-amber-600 bg-amber-400 text-amber-950 hover:bg-amber-300";
const KEY_OFF = "border-zinc-800 bg-zinc-900 text-zinc-600";

export function Player({
  lesson,
  next,
}: {
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
    if (!given.correct) setMissed((ids) => (ids.includes(step.id) ? ids : [...ids, step.id]));
  };

  const advance = () => {
    if (!step) return;
    const wrong = step.type !== "card" && !answer?.correct;
    if (wrong) setQueue((q) => [...q, step]);
    else setCleared((n) => n + 1);
    setAt((n) => n + 1);
    setAnswer(null);
    setChecked(false);
  };

  const ready = step?.type === "card" || checked || answer !== null;
  const proceed = () => {
    if (!step) return;
    if (step.type === "card" || checked) advance();
    else if (answer) check(answer);
  };

  useKeydown((e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    proceed();
  });

  const good = checked && answer?.correct;
  const bad = checked && !answer?.correct;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-zinc-800 px-5 py-3">
        <Link
          href="/"
          aria-label="Leave this lesson"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
        >
          ✕
        </Link>
        <div
          className="mx-auto h-2.5 w-full max-w-3xl overflow-hidden rounded-full bg-zinc-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={lesson.steps.length}
          aria-valuenow={cleared}
        >
          <div
            className="h-full rounded-full bg-emerald-400 transition-[width] duration-700 ease-out"
            style={{ width: `${(cleared / lesson.steps.length) * 100}%` }}
          />
        </div>
        <span className="w-12 shrink-0 text-right font-mono text-xs text-zinc-400">
          {cleared}/{lesson.steps.length}
        </span>
      </header>

      {step ? (
        <>
          <main key={`${step.id}-${at}`} className="rise-in mx-auto flex w-full max-w-3xl flex-1 flex-col gap-7 px-6 py-12">
            <p className="flex items-center gap-3 text-xs">
              <span className={`rounded-md border px-2 py-1 ${KIND[step.type].tone}`}>{KIND[step.type].label}</span>
              <span className="text-zinc-500">
                {lesson.title}
                {at >= lesson.steps.length && " · second attempt"}
              </span>
            </p>
            {step.type === "card" ? (
              <>
                <h1 className="text-[26px] font-semibold leading-snug text-zinc-100">{step.title}</h1>
                <Chain>{step.diagram.map((p) => <PartCard key={p.id} part={p} />)}</Chain>
                <p className="text-base leading-relaxed text-zinc-300">{step.body}</p>
              </>
            ) : (
              <>
                <h1 className="text-xl font-medium leading-snug text-zinc-100">{step.prompt}</h1>
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
              good ? "border-emerald-400/40 bg-[#16211e]" : bad ? "border-amber-400/40 bg-[#221f18]" : "border-zinc-800 bg-page"
            }`}
          >
            <div className="mx-auto flex max-w-3xl items-end gap-6 px-6 py-5">
              <div className="min-h-12 flex-1 text-sm leading-relaxed">
                {checked && step.type !== "card" && (
                  <div className="rise-in flex gap-3.5">
                    <span
                      className={`pop-in mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-sm ${
                        good ? "bg-emerald-400 text-emerald-950" : "bg-amber-400 text-amber-950"
                      }`}
                    >
                      {good ? "✓" : "✗"}
                    </span>
                    <div>
                      <p className={good ? "text-emerald-300" : "text-amber-300"}>
                        {good ? PRAISE[at % PRAISE.length] : CONSOLATION[at % CONSOLATION.length]}
                        {bad && <span className="text-zinc-500"> This one comes back at the end.</span>}
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
                  </div>
                )}
              </div>
              <button
                onClick={proceed}
                disabled={!ready}
                className={`keycap shrink-0 rounded-xl border px-6 py-2.5 text-sm ${!ready ? KEY_OFF : bad ? KEY_RETRY : KEY_PRIMARY}`}
              >
                {step.type === "card" ? "Got it" : checked ? "Continue" : "Check"} <span className="opacity-60">↵</span>
              </button>
            </div>
          </footer>
        </>
      ) : (
        <main className="rise-in mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-12">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">Lesson complete · {lesson.title}</p>
          <div>
            <p className="text-6xl font-semibold text-zinc-100">
              {exercises.length - missed.length}
              <span className="text-zinc-600">/{exercises.length}</span>
            </p>
            <h1 className="mt-3 text-xl text-emerald-300">
              {missed.length === 0
                ? "Clean run. Right first time, every time."
                : missed.length <= 2
                  ? "Done, with a detour or two."
                  : "Done. The tricky ones came back around."}
            </h1>
          </div>

          {/* One square per exercise, in order: green for right first time, amber for one that came back. */}
          <div className="flex gap-1.5" aria-hidden>
            {exercises.map((e, i) => (
              <span
                key={e.id}
                style={{ animationDelay: `${i * 70}ms` }}
                className={`pop-in size-6 rounded-md ${missed.includes(e.id) ? "bg-amber-400" : "bg-emerald-400"}`}
              />
            ))}
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-zinc-500">right first time</dt>
            <dd className="text-zinc-200">
              {exercises.length - missed.length} of {exercises.length}
            </dd>
            <dt className="text-zinc-500">came back around</dt>
            <dd className="text-zinc-200">{missed.length}</dd>
            <dt className="text-zinc-500">ideas covered</dt>
            <dd className="text-zinc-200">
              {lesson.steps.flatMap((s) => (s.type === "card" ? [s.title] : [])).join(" · ")}
            </dd>
          </dl>

          <div className="flex gap-3 text-sm">
            {next && (
              <Link href={next.href} className={`keycap rounded-xl border px-6 py-2.5 ${KEY_PRIMARY}`}>
                Next: {next.title} →
              </Link>
            )}
            <Link
              href="/"
              className="keycap rounded-xl border border-zinc-700 bg-zinc-900 px-6 py-2.5 text-zinc-300 hover:text-zinc-100"
            >
              Back to the path
            </Link>
          </div>
        </main>
      )}
    </div>
  );
}
