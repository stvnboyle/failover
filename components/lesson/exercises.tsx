"use client";

import { useEffect, useState } from "react";
import { Chain, Gap, PartCard } from "@/components/diagram";
import type { Choice, Exercise, Fix, Match, Slot } from "@/content/schema";

/** What an exercise reports once the learner has committed to something. */
export type Answer = {
  correct: boolean;
  /** Why this particular answer is right or wrong. */
  why: string;
  /** True when there is nothing left to choose, so the lesson can mark it without a Check press. */
  final?: boolean;
};

type Props<E> = { exercise: E; locked: boolean; onAnswer: (answer: Answer | null) => void };

// A stable shuffle keyed by the exercise, so the server and the browser agree on the order.
function shuffled<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h ^= h >>> 13;
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Number keys pick an option while the exercise is open. */
function useNumberKeys(count: number, enabled: boolean, pick: (index: number) => void) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= count) pick(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
}

const optionClass = (state: "plain" | "selected" | "right" | "wrong" | "dim") =>
  `flex w-full items-start gap-3 rounded-md border px-3.5 py-3 text-left text-sm leading-snug transition-colors duration-300 ${
    {
      plain: "border-zinc-700/80 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100",
      selected: "border-zinc-200 text-zinc-50",
      right: "border-emerald-400/70 bg-emerald-400/[0.06] text-zinc-50",
      wrong: "border-red-400/70 bg-red-400/[0.06] text-zinc-50",
      dim: "border-zinc-800 text-zinc-500",
    }[state]
  }`;

function Options<T extends { id: string; text: string; correct?: true; why: string }>({
  options,
  locked,
  onAnswer,
}: {
  options: T[];
  locked: boolean;
  onAnswer: (answer: Answer) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const pick = (o: T) => {
    setPicked(o.id);
    onAnswer({ correct: Boolean(o.correct), why: o.why });
  };
  useNumberKeys(options.length, !locked, (i) => pick(options[i]));

  return (
    <div className="flex flex-col gap-2">
      {options.map((o, i) => {
        const state = !locked
          ? picked === o.id
            ? "selected"
            : "plain"
          : o.correct
            ? "right"
            : picked === o.id
              ? "wrong"
              : "dim";
        return (
          <button key={o.id} disabled={locked} onClick={() => pick(o)} className={optionClass(state)}>
            <span className="mt-px grid size-5 shrink-0 place-items-center rounded-sm border border-current text-[10px] opacity-60">
              {i + 1}
            </span>
            {o.text}
          </button>
        );
      })}
    </div>
  );
}

function ChoiceExercise({ exercise, locked, onAnswer }: Props<Choice>) {
  return <Options options={shuffled(exercise.options, exercise.id)} locked={locked} onAnswer={onAnswer} />;
}

function SlotExercise({ exercise, locked, onAnswer }: Props<Slot>) {
  const options = shuffled(exercise.options, exercise.id);
  const [picked, setPicked] = useState<number | null>(null);
  const pick = (i: number) => {
    setPicked(i);
    onAnswer({ correct: Boolean(options[i].correct), why: options[i].why });
  };
  useNumberKeys(options.length, !locked, pick);

  const chosen = picked === null ? null : options[picked];
  const filled = chosen ? (
    <PartCard key="gap" part={chosen.part} state={!locked ? "selected" : chosen.correct ? "right" : "wrong"} />
  ) : (
    <Gap key="gap" />
  );
  const parts = exercise.diagram.map((p) => <PartCard key={p.id} part={p} />);
  parts.splice(exercise.gap, 0, filled);

  return (
    <div className="flex flex-col gap-6">
      <Chain>{parts}</Chain>
      <div className="grid grid-cols-2 justify-items-center gap-3">
        {options.map((o, i) => (
          <button key={o.part.id} disabled={locked} onClick={() => pick(i)} className="rounded-md transition-transform duration-200 enabled:hover:-translate-y-0.5">
            <PartCard
              part={o.part}
              state={!locked ? (picked === i ? "selected" : "plain") : o.correct ? "right" : picked === i ? "wrong" : "dim"}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function FixExercise({ exercise, locked, onAnswer }: Props<Fix>) {
  const [suspect, setSuspect] = useState<string | null>(null);
  const found = suspect === exercise.faulty;
  const faulty = exercise.diagram.find((p) => p.id === exercise.faulty)!;

  const accuse = (id: string) => {
    setSuspect(id);
    if (id !== exercise.faulty)
      onAnswer({
        correct: false,
        why: `${exercise.innocent[id]} The part that can't work is ${faulty.label}.`,
        final: true,
      });
  };

  return (
    <div className="flex flex-col gap-6">
      <Chain>
        {exercise.diagram.map((p) => (
          <button key={p.id} disabled={locked || found} onClick={() => accuse(p.id)} className="rounded-md transition-transform duration-200 enabled:hover:-translate-y-0.5">
            <PartCard
              part={p}
              state={
                p.id === exercise.faulty && (found || locked) ? "wrong" : suspect === p.id ? "selected" : "plain"
              }
            />
          </button>
        ))}
      </Chain>
      {found ? (
        <div className="rise-in flex flex-col gap-3">
          <p className="text-xs text-zinc-400">
            That&apos;s the one. Replace <span className="text-zinc-100">{faulty.label}</span> with:
          </p>
          <Options options={shuffled(exercise.replacements, exercise.id)} locked={locked} onAnswer={onAnswer} />
        </div>
      ) : (
        !locked && <p className="text-center text-xs text-zinc-500">Click the part that can&apos;t work.</p>
      )}
    </div>
  );
}

function MatchExercise({ exercise, locked, onAnswer }: Props<Match>) {
  const { pairs } = exercise;
  const rights = (() => {
    const order = shuffled(pairs.map((_, i) => i), exercise.id);
    // A shuffle can land back in the original order, which would give the answers away.
    return order.every((v, i) => v === i) ? [...order.slice(1), order[0]] : order;
  })();
  const [left, setLeft] = useState<number | null>(null);
  const [done, setDone] = useState<number[]>([]);
  const [misses, setMisses] = useState(0);
  const [slip, setSlip] = useState<{ right: number; why: string } | null>(null);

  const tryPair = (right: number) => {
    if (left === null) return;
    if (right !== left) {
      setMisses(misses + 1);
      setSlip({ right, why: pairs[left].why });
      setLeft(null);
      return;
    }
    const next = [...done, left];
    setDone(next);
    setLeft(null);
    setSlip(null);
    if (next.length === pairs.length)
      onAnswer({
        correct: misses === 0,
        why: misses === 0 ? "" : `All matched, with ${misses} wrong ${misses === 1 ? "turn" : "turns"} on the way.`,
        final: true,
      });
  };

  const cell = (state: "plain" | "selected" | "right" | "wrong") =>
    `w-full rounded-md border px-3.5 py-3 text-left text-sm leading-snug transition-colors duration-300 ${
      {
        plain: "border-zinc-700/80 text-zinc-300 enabled:hover:border-zinc-500 enabled:hover:text-zinc-100",
        selected: "border-zinc-200 text-zinc-50",
        right: "border-emerald-400/40 bg-emerald-400/[0.05] text-zinc-400",
        wrong: "nudge border-red-400/70 text-zinc-50",
      }[state]
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[2fr_3fr] gap-x-6 gap-y-2">
        {pairs.map((pair, row) => {
          const r = rights[row];
          return [
            <button
              key={`l${row}`}
              disabled={locked || done.includes(row)}
              onClick={() => {
                setLeft(row);
                setSlip(null);
              }}
              className={cell(done.includes(row) ? "right" : left === row ? "selected" : "plain")}
            >
              {pair.left}
            </button>,
            <button
              key={`r${row}-${slip?.right === r ? misses : 0}`}
              disabled={locked || done.includes(r) || left === null}
              onClick={() => tryPair(r)}
              className={cell(done.includes(r) ? "right" : slip?.right === r ? "wrong" : "plain")}
            >
              {pairs[r].right}
            </button>,
          ];
        })}
      </div>
      <p className="min-h-10 text-xs leading-relaxed text-amber-400/90">
        {slip ? `↳ Not that one. ${slip.why}` : left === null && done.length < pairs.length && !locked ? (
          <span className="text-zinc-500">Pick a term on the left, then its meaning on the right.</span>
        ) : null}
      </p>
    </div>
  );
}

export function ExerciseView({ exercise, locked, onAnswer }: Props<Exercise>) {
  switch (exercise.type) {
    case "choice":
      return <ChoiceExercise exercise={exercise} locked={locked} onAnswer={onAnswer} />;
    case "slot":
      return <SlotExercise exercise={exercise} locked={locked} onAnswer={onAnswer} />;
    case "fix":
      return <FixExercise exercise={exercise} locked={locked} onAnswer={onAnswer} />;
    case "match":
      return <MatchExercise exercise={exercise} locked={locked} onAnswer={onAnswer} />;
  }
}
