import { z } from "zod";

// Exam blueprints, from the official exam guides. Checked 2026-10-10: CLF-C02 and SAA-C03 are the live versions.
export const EXAM_DOMAINS = {
  "clf-1": { exam: "CLF-C02", name: "Cloud Concepts", weight: 24 },
  "clf-2": { exam: "CLF-C02", name: "Security and Compliance", weight: 30 },
  "clf-3": { exam: "CLF-C02", name: "Cloud Technology and Services", weight: 34 },
  "clf-4": { exam: "CLF-C02", name: "Billing, Pricing, and Support", weight: 12 },
  "saa-1": { exam: "SAA-C03", name: "Design Secure Architectures", weight: 30 },
  "saa-2": { exam: "SAA-C03", name: "Design Resilient Architectures", weight: 26 },
  "saa-3": { exam: "SAA-C03", name: "Design High-Performing Architectures", weight: 24 },
  "saa-4": { exam: "SAA-C03", name: "Design Cost-Optimized Architectures", weight: 20 },
} as const;

export const PILLARS = {
  "operational-excellence": "Operational Excellence",
  security: "Security",
  reliability: "Reliability",
  "performance-efficiency": "Performance Efficiency",
  "cost-optimization": "Cost Optimization",
  sustainability: "Sustainability",
} as const;

const keys = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

const text = z.string().trim().min(1);

// ---- diagrams ----------------------------------------------------------------

export const ICONS = ["visitor", "bucket", "file", "server", "database", "cdn", "dns", "policy", "script"] as const;

/** One box in a diagram. Diagrams are a chain read left to right. */
const part = z.object({
  id: text,
  icon: z.enum(ICONS),
  label: text,
  tag: text.optional(),
  /** Things shown inside the part, such as the object keys in a bucket. */
  holds: z.array(text).optional(),
});

const diagram = z.array(part).min(1).max(5);

// ---- steps -------------------------------------------------------------------

const source = z.object({
  title: text,
  url: z.url().refine((u) => new URL(u).hostname.endsWith("aws.amazon.com"), "sources must be AWS pages"),
});

/** A new idea: one diagram, two sentences at most, used by the exercise that follows. */
const card = z.object({
  type: z.literal("card"),
  id: text,
  concept: text,
  title: text,
  body: text.refine((b) => (b.match(/[.!?](\s|$)/g) ?? []).length <= 2, "a card is two sentences at most"),
  diagram,
});

const exerciseBase = {
  id: text,
  concept: text,
  prompt: text,
  /** Shown after the answer, right or wrong. */
  explanation: text,
  source,
  domains: z.array(z.enum(keys(EXAM_DOMAINS))).min(1),
  pillars: z.array(z.enum(keys(PILLARS))),
};

// Every option says why it is right or wrong: the wrong ones are where most of the teaching happens.
const option = z.object({ id: text, text: text, correct: z.literal(true).optional(), why: text });
const exactlyOneCorrect = (options: { correct?: true }[]) => options.filter((o) => o.correct).length === 1;

const choice = z.object({
  ...exerciseBase,
  type: z.literal("choice"),
  options: z.array(option).min(3).max(4).refine(exactlyOneCorrect, "exactly one option must be correct"),
});

const match = z.object({
  ...exerciseBase,
  type: z.literal("match"),
  pairs: z.array(z.object({ left: text, right: text, why: text })).min(3).max(5),
});

const slot = z.object({
  ...exerciseBase,
  type: z.literal("slot"),
  /** The diagram with one part missing; `gap` is the index where the chosen option goes. */
  diagram: z.array(part).min(1).max(4),
  gap: z.number().int().min(0),
  options: z
    .array(z.object({ part, correct: z.literal(true).optional(), why: text }))
    .min(3)
    .max(4)
    .refine(exactlyOneCorrect, "exactly one option must be correct"),
});

const fix = z
  .object({
    ...exerciseBase,
    type: z.literal("fix"),
    diagram,
    faulty: text,
    /** Why each of the other parts is fine, keyed by part id. */
    innocent: z.record(text, text),
    replacements: z.array(option).min(3).max(4).refine(exactlyOneCorrect, "exactly one replacement must be correct"),
  })
  .superRefine((e, ctx) => {
    const ids = e.diagram.map((p) => p.id);
    if (!ids.includes(e.faulty)) ctx.addIssue({ code: "custom", message: `faulty part "${e.faulty}" is not in the diagram` });
    for (const id of ids)
      if (id !== e.faulty && !e.innocent[id])
        ctx.addIssue({ code: "custom", message: `part "${id}" needs an explanation of why it is fine` });
  });

const step = z.discriminatedUnion("type", [card, choice, match, slot, fix]);

// ---- lessons and units -------------------------------------------------------

const lesson = z
  .object({
    id: text,
    title: text,
    summary: text,
    /** Empty while the lesson is planned but not yet written. */
    steps: z.array(step),
  })
  .superRefine((l, ctx) => {
    const seen = new Set<string>();
    const taught = new Set<string>();
    l.steps.forEach((s, i) => {
      if (seen.has(s.id)) ctx.addIssue({ code: "custom", message: `duplicate step id "${s.id}"` });
      seen.add(s.id);
      if (s.type === "card") {
        if (l.steps[i - 1]?.type === "card") ctx.addIssue({ code: "custom", message: `"${s.id}": never two cards in a row` });
        if (l.steps[i + 1]?.concept !== s.concept)
          ctx.addIssue({ code: "custom", message: `"${s.id}": the step after a card must use its concept` });
        taught.add(s.concept);
      } else if (!taught.has(s.concept)) {
        ctx.addIssue({ code: "custom", message: `"${s.id}" uses concept "${s.concept}" before a card introduces it` });
      }
    });
  });

const unit = z.object({
  id: text,
  title: text,
  scenario: text,
  lessons: z.array(lesson).min(1),
  /** A capstone that is planned or prototyped, shown at the end of the unit's path. */
  capstone: z.object({ title: text, href: text.optional() }).optional(),
});

export const curriculum = z.array(unit);

export type Part = z.infer<typeof part>;
export type Card = z.infer<typeof card>;
export type Choice = z.infer<typeof choice>;
export type Match = z.infer<typeof match>;
export type Slot = z.infer<typeof slot>;
export type Fix = z.infer<typeof fix>;
export type Exercise = Choice | Match | Slot | Fix;
export type Step = z.infer<typeof step>;
export type Lesson = z.infer<typeof lesson>;
export type Unit = z.infer<typeof unit>;
