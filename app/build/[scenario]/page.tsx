import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Board } from "@/components/canvas/board";
import { findScenario, SCENARIOS } from "@/lib/canvas/scenarios";

export function generateStaticParams() {
  return SCENARIOS.map((s) => ({ scenario: s.id }));
}

async function Scenario({ params }: Pick<PageProps<"/build/[scenario]">, "params">) {
  const { scenario } = await params;
  if (!findScenario(scenario)) notFound();
  // A scenario carries its rules as functions, so the board looks it up again by id on the client.
  return <Board scenarioId={scenario} />;
}

// The route's params are read behind Suspense, so a link to this page can show its shell straight away.
export default function Page({ params }: PageProps<"/build/[scenario]">) {
  return (
    <Suspense>
      <Scenario params={params} />
    </Suspense>
  );
}
