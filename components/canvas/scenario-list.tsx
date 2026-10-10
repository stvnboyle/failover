"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { mastered, useProgress } from "@/lib/progress";

type Item = { id: string; title: string; summary: string; checks: number; domains: string[] };

export function ScenarioList({ scenarios }: { scenarios: Item[] }) {
  const router = useRouter();
  const known = mastered(useProgress());
  const built = (id: string) => known.has(`capstone:${id}`);
  const remaining = scenarios.filter((s) => !built(s.id));

  // Deals one you haven't built yet if there is one, and any of them once you have built them all.
  const deal = () => {
    const pool = remaining.length > 0 ? remaining : scenarios;
    router.push(`/build/${pool[Math.floor(Math.random() * pool.length)].id}`);
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6">
      <header className="flex items-center justify-between py-5 text-xs">
        <Link href="/" className="text-base font-semibold text-zinc-100">
          failover
        </Link>
        <Link href="/" className="text-zinc-400 transition-colors hover:text-zinc-100">
          ← Back to the path
        </Link>
      </header>

      <main className="flex flex-1 flex-col gap-10 py-10">
        <section>
          <h1 className="text-[34px] font-semibold leading-tight text-zinc-100">Scenario mode</h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-400">
            Each scenario is a brief and an empty canvas. The same services are on offer every time, and what counts as
            the right design changes with the brief: the best answer to one is the wrong answer to another.
          </p>
          <div className="mt-6 flex items-center gap-4">
            <button
              onClick={deal}
              className="keycap rounded-xl border border-emerald-600 bg-emerald-400 px-6 py-2.5 text-sm text-emerald-950 hover:bg-emerald-300"
            >
              Deal me a scenario
            </button>
            <span className="text-xs text-zinc-500">
              {scenarios.length - remaining.length} of {scenarios.length} built
            </span>
          </div>
        </section>

        <ul className="flex flex-col gap-2">
          {scenarios.map((s) => (
            <li key={s.id}>
              <Link
                href={`/build/${s.id}`}
                className="group flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3.5 transition-colors hover:border-zinc-600"
              >
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-lg border border-b-[3px] text-xs font-semibold ${
                    built(s.id) ? "border-emerald-600 bg-emerald-400 text-emerald-950" : "border-zinc-600 bg-zinc-900 text-zinc-400"
                  }`}
                >
                  {built(s.id) ? "✓" : "◆"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-zinc-100">{s.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">{s.summary}</span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {s.domains.map((d) => (
                      <span key={d} className="rounded-md border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400">
                        {d}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs">
                  <span className={built(s.id) ? "text-emerald-300" : "text-zinc-400"}>{built(s.id) ? "built · again →" : "open →"}</span>
                  <span className="mt-0.5 block text-zinc-600">{s.checks} checks</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <footer className="border-t border-zinc-800 py-6 text-xs leading-relaxed text-zinc-500">
        The tags are the Solutions Architect Associate exam domains each scenario exercises. failover is an independent
        project, not affiliated with or endorsed by Amazon Web Services.
      </footer>
    </div>
  );
}
