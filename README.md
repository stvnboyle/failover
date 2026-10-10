# failover

Learn how AWS fits together, by building it. Short interactive scenarios in place of long documentation, aimed at understanding first and the Cloud Practitioner and Solutions Architect Associate exams second.

Working title. An independent project, not affiliated with or endorsed by Amazon Web Services.

## Status

Early. Desktop only, runs entirely in the browser, no accounts.

- **Lesson engine**: concept cards and four exercise types (choose one, match pairs, fill the gap, fix the design). Missed exercises come back at the end of the lesson.
- **Unit 1, lesson 1** ("A bucket for the site") is drafted and awaiting review. The other lessons are outlined but not written.
- **Capstone canvas** for unit 2 exists as a throwaway prototype at `/prototype/canvas`.

The full plan and the decisions behind it are in [docs/SPEC.md](docs/SPEC.md).

## Run it

```bash
pnpm install
pnpm dev
```

## Layout

| Path | What it holds |
|---|---|
| `content/` | The curriculum as typed data. `schema.ts` validates it on import, so a malformed exercise or a missing source link fails the build. |
| `components/lesson/` | The lesson player and the exercise types. |
| `components/diagram.tsx` | The diagram language shared by cards and exercises. |
| `lib/progress.ts` | The only module that reads or writes progress. Backed by browser storage today. |
| `app/prototype/canvas/` | The capstone prototype. Throwaway, except `model.ts`. |

## Content rules

Every exercise is written from AWS's own documentation and carries a link to the page it rests on, an explanation for every wrong option, and tags for exam domain and Well-Architected pillar. Nothing is copied from real exam questions or paid question banks.
