# failover

Learn how AWS fits together, by building it. Short interactive scenarios in place of long documentation, aimed at understanding first and the Cloud Practitioner and Solutions Architect Associate exams second.

Working title. An independent project, not affiliated with or endorsed by Amazon Web Services.

## Status

Early. Desktop only, runs entirely in the browser, no accounts.

- **Lesson engine**: concept cards and four exercise types (choose one, match pairs, fill the gap, fix the design). Missed exercises come back at the end of the lesson.
- **Unit 1** ("Put a static site on the internet") is drafted in full: three lessons on S3, CloudFront and Route 53, 30 exercises, awaiting review. **Unit 2** ("Run a web app that survives a data-centre failure") is drafted in full too: six lessons, 60 exercises, awaiting review.
- **Scenario mode** at `/scenarios`: five briefs to architect on the same canvas, dealt at random. Some must survive a failure, some must be cheap, and one must be unreachable from the internet.
- **Capstone canvas** for unit 2 at `/build/web-app`: drag services into subnets, connect them, switch them on across zones, then fail a zone and watch what happens.

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
| `lib/canvas/` | The canvas model, the zone-failure simulation, and scenarios with their rules. |
| `components/canvas/` | The drag-and-drop board. |

## Content rules

Every exercise is written from AWS's own documentation and carries a link to the page it rests on, an explanation for every wrong option, and tags for exam domain and Well-Architected pillar. Nothing is copied from real exam questions or paid question banks.
