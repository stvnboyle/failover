"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Chain, Gap, PartCard } from "@/components/diagram";
import type { Choice, Exercise, Fix, Match, Slot } from "@/content/schema";
import { useKeydown } from "@/lib/use-keydown";

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
  useKeydown((e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= count) pick(n - 1);
  }, enabled);
}

const optionClass = (state: "plain" | "selected" | "right" | "wrong" | "dim") =>
  `keycap flex w-full items-start gap-3 rounded-xl border bg-zinc-900 px-4 py-3 text-left text-sm leading-snug ${
    {
      plain: "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100",
      selected: "border-violet-400 bg-violet-400/10 text-zinc-100",
      right: "border-emerald-500 bg-emerald-400/10 text-zinc-100",
      wrong: "border-red-400 bg-red-400/10 text-zinc-100",
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
            <span className="mt-px grid size-5 shrink-0 place-items-center rounded-md border border-current text-[10px] opacity-60">
              {state === "right" ? "✓" : state === "wrong" ? "✗" : i + 1}
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

  // A line is drawn from each matched term to its meaning, measured from where the two cells sit.
  const grid = useRef<HTMLDivElement>(null);
  const lefts = useRef<(HTMLElement | null)[]>([]);
  const rightEls = useRef<(HTMLElement | null)[]>([]);
  const [lines, setLines] = useState<{ pair: number; d: string }[]>([]);

  useLayoutEffect(() => {
    const measure = () =>
      setLines(
        done.flatMap((pair) => {
          const from = lefts.current[pair];
          const to = rightEls.current[pair];
          if (!from || !to) return [];
          const x1 = from.offsetLeft + from.offsetWidth;
          const y1 = from.offsetTop + from.offsetHeight / 2;
          const x2 = to.offsetLeft;
          const y2 = to.offsetTop + to.offsetHeight / 2;
          const bend = (x2 - x1) / 2;
          return [{ pair, d: `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}` }];
        }),
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid.current!);
    return () => observer.disconnect();
  }, [done]);

  const tryPair = (right: number) => {
    if (left === null) return;
    if (right !== left) {
      setMisses((n) => n + 1);
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
    `keycap w-full rounded-xl border bg-zinc-900 px-4 py-3 text-left text-sm leading-snug ${
      {
        plain: "border-zinc-700 text-zinc-300 enabled:hover:border-zinc-500 enabled:hover:text-zinc-100",
        selected: "border-sky-400 bg-sky-400/10 text-zinc-100",
        right: "border-emerald-500/60 bg-emerald-400/[0.07] text-zinc-400",
        wrong: "nudge border-red-400 bg-red-400/10 text-zinc-100",
      }[state]
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div ref={grid} className="relative grid grid-cols-[2fr_3fr] gap-x-16 gap-y-2">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          {lines.map(({ pair, d }) => (
            <path key={pair} d={d} pathLength={1} className="draw-in" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />
          ))}
        </svg>
        {pairs.map((pair, row) => {
          const r = rights[row];
          return [
            <button
              key={`l${row}`}
              ref={(el) => {
                lefts.current[row] = el;
              }}
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
              ref={(el) => {
                rightEls.current[r] = el;
              }}
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
