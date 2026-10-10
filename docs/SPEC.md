# failover — v1 spec

Working title. "Duolingo for AWS" is how it's described in conversation, not what's printed on the site.

## What it is

A browser-based way to learn how AWS services fit together, in short interactive sessions.

- Understanding comes first. Readiness for Cloud Practitioner (CLF-C02) and Solutions Architect Associate (SAA-C03) is a by-product.
- It is also a resource for someone with no interest in the exams who wants to see how the pieces relate.
- v1 is a public-quality slice with the author as first learner.

**v1 is done when** someone with no AWS background can finish a unit in the browser and do noticeably better on practice questions for that topic than before.

## Curriculum

The path is made of scenarios. Services are introduced when a scenario needs them, and Well-Architected pillars appear as the trade-offs made along the way.

| Unit | Scenario | Lessons | Capstone |
|---|---|---|---|
| 1 (on-ramp) | Put a static site on the internet (S3, CloudFront, Route 53) | 3 | No |
| 2 (main) | Run a web app that survives a data-centre failure | 6 | Yes |

Unit 2 lessons:

1. Regions and Availability Zones
2. VPCs and public versus private subnets
3. Servers and security groups
4. Load balancing
5. Auto scaling
6. A database that fails over
7. Capstone: build it yourself

Roughly 10 exercises per lesson, about 90 in total.

## How learning works

### Exercise types

1. **Multiple choice** on a short scenario.
2. **Match pairs**, service to what it does.
3. **Fill the slot** in a partly built diagram.
4. **Fix the architecture**: spot and replace the wrong component.

### Concept cards

A new idea arrives on a concept card, and the next exercise uses it.

- One idea per card, never two cards in a row.
- One diagram and two sentences at most.
- Diagrams use the same visual language as the capstone canvas.

### Feedback

- Every answer gets a one or two sentence explanation.
- Every wrong option has its own explanation of why it doesn't fit.
- A missed exercise returns at the end of the lesson, then enters spaced review.

### Capstone: guided build

- A brief, for example "host this app so it survives an AZ failure".
- A canvas with the structural containers pre-drawn (region, AZs, public and private subnets).
- A limited palette of services relevant to the unit.
- The learner drags services into zones, where they snap into place and arrange themselves, then connects two services by clicking one and then the other. (Chosen over a free-position canvas with dragged wires after prototyping both.)
- Services carrying traffic show it: packets move along live connections, and failing an AZ shows what goes dark and where traffic moves.
- The brief is the most prominent thing on the screen, above the canvas.
- The palette includes services the brief doesn't need. A distractor is paired with an optional stretch requirement, so using it teaches something: the NAT gateway is unnecessary for the core brief, and the stretch check ("app servers can download updates, even if a zone fails") needs one per zone.
- Each palette service has an info button describing what it does, without saying where it belongs.
- The app checks a list of requirements with plain rule functions over the diagram's nodes and edges. It does not compare against a reference diagram, so several layouts can pass.

A fully free-form sandbox is out of scope for v1.

### Decisions made when building the real canvas

- **Resources that span zones carry a switch.** A load balancer or Auto Scaling group is dropped into one subnet and starts out in that zone only. Its card has a control to switch it on in the other zone, and once on in both it sits across the middle of the row. A database has the same control for a Multi-AZ standby. This mirrors what the lessons teach and makes "switch it on in the second zone" something the learner does, not something the layout does for them.
- **What a service runs for you is shown, but isn't yours to move.** The servers an Auto Scaling group launches, and a database's standby, appear as dashed chips in the right subnets. When a zone fails, the group's replacement server appears in the surviving zone.
- **A hand-launched server is in the palette on purpose.** It works, but fails the "a failed app server is replaced automatically" requirement, which is the reason Auto Scaling groups exist.
- **The NAT gateway stretch goal teaches the zonal kind**, one per zone, because that is what the exams ask about. Regional NAT gateways exist and are worth a mention in a later lesson.
- **Icons are our own drawn set**, shared with the lesson diagrams. No AWS artwork is used, so there are no usage terms to check.

### Scenario mode

A separate mode at `/scenarios`, suggested once unit 2 is finished: the learner is dealt a scenario at random and architects it on the same drag-and-drop canvas. A first version is built with five scenarios.

| Scenario | What it asks for | What it punishes |
|---|---|---|
| Launch day | A web app with a database that survives a zone failing (the unit 2 capstone) | Anything in a single zone |
| Demo on a budget | The same app, as cheaply as possible, allowed to go down | Standbys, second zones, a NAT gateway |
| The image resizer | A resilient API that stores nothing and fetches from other sites | Adding a database, one NAT gateway for two zones |
| Friday's prototype | A cheap API that stores nothing | A second zone, a second NAT gateway |
| The night shift | Resilient overnight jobs nothing on the internet can reach | A load balancer, any connection from the internet |

The point of the set is that the right answer to one is the wrong answer to another, so a learner has to read the brief and can't replay the capstone.

How it is built:

- Each scenario declares a **shape** (takes requests from users or not, keeps data or not), which decides what "working" means when a zone is failed.
- Rules come from one shared library in `lib/canvas/scenarios.ts`. A scenario is a selection from it.
- "Deal me a scenario" picks one not yet built, and any of them once all are built.
- Building a scenario is saved to progress and counts towards its exam domains on the coverage page.

Original intent, still the guide for adding more:

- A scenario is data, exactly like a capstone: a brief, a palette, a set of zones and a list of rules. Nothing about the canvas itself changes, so each new scenario is content, not engineering.
- "Random" means drawn from a pool of written scenarios, with requirements that can be switched on or off to vary them (for example "must survive a zone failing", "must stay private", "keep the monthly cost down"). It does not mean generated on the fly, because a generated brief has no rules to judge it by.
- Scenarios only use services the learner has met in a lesson, so the pool grows as units are written.
- This is the closest thing in the product to how Solutions Architect questions are asked, so each scenario is tagged against that exam's domains.

## Progress and reward

Learning-first. Progress is expressed as mastery and coverage, not points.

**In v1**

- A path of units and lessons.
- Mastery level per concept.
- Spaced review: missed exercises come back after a day, then a few days, then a week.
- A quiet daily streak, counted in the learner's local time zone, with one missed day of grace.
- A coverage overlay per exam, driven by exercise tags. It must separate "you haven't learned this" from "we haven't written this".

**Not in v1**

- XP, hearts or lives, leagues and leaderboards.
- A timed mock exam (needs a full cert's worth of content first).
- A "test out of this unit" feature.

### Exam readiness

The product must not claim to make anyone exam-ready until the written content covers a full blueprint. Until then it is positioned as a way to understand how AWS fits together and as a companion to exam study, and the coverage view says so in plain words.

### Navigation

Nothing is locked. The path highlights one recommended next step. Opening the capstone early shows which concepts it relies on and which the learner hasn't covered, then lets them proceed.

## Content

- Drafted from AWS's own documentation, the Well-Architected Framework, and the exam guides. Reviewed by the author one lesson at a time before it ships.
- Original exercises only. Nothing copied or closely paraphrased from real exam questions or paid question banks.
- CLF-C02 and SAA-C03 were confirmed as the live exam versions on 2026-10-10. Recheck before each new unit.

Every exercise carries:

1. A source link to the AWS page it is based on, shown to the learner as "read more".
2. An explanation for every wrong option.
3. Tags for exam domain and Well-Architected pillar.

Content lives as typed data files in the repository, validated against a schema at build time. A malformed exercise or a missing source link fails the build.

## Technical

- Next.js on Vercel. Client-side only, no accounts, no server-side user data.
- Desktop only for now. Keyboard access to the quick exercise types is kept.
- No analytics in v1.

### Progress storage

- Browser storage, behind a single storage module so a server can back it later without touching lesson or canvas code.
- Stored as a versioned log of answered exercises. Mastery and coverage are calculated from the log, so fixing or retagging an exercise corrects everyone's numbers.
- Old saves are migrated when the shape changes.
- An honest notice that progress is saved on this device, with export to a file and import from one.

### Naming and AWS

- An independent product name. AWS appears in the description only.
- A footer stating the site is not affiliated with or endorsed by Amazon.
- AWS's official architecture icons are the first choice for diagrams. Check their current usage terms before shipping, and fall back to simple labelled shapes if they don't fit.

### Visual direction

A dark, crisp look that is this product's own, made more playful after the first build. It deliberately avoids the motifs of the author's portfolio: no command-line styling for controls (`./exit`, `// headings`, prompt characters) and no all-monospace type.

- **Type.** A sans typeface for everything people read. Monospace is kept for things that really are code: zone names, address ranges, service tags, counts.
- **Controls say what they do.** A close button, "Start again", "Export progress", "Back to the path".

- **Soft contrast.** Nothing is pure black or pure white. The neutral scale is remapped in `app/globals.css` to a blue-tinted charcoal page with soft grey text, because bright white on black was tiring to read.
- **Keycaps.** Anything pressable has a thick bottom edge and sinks when pushed, like a mechanical keyboard key.
- **Colour per move.** Each kind of step has its own accent colour, and the primary action is green.
- Still no mascots, confetti, glows or other over-the-top effects.

## Build order

Reordered on 2026-10-11 to bring Solutions Architect material and the coverage view forward.

1. **Throwaway canvas prototype.** Done, in `app/prototype/canvas`. Snap to zones won, and plain rules judged it fairly.
2. **Lesson engine and the on-ramp unit.** Done: the engine and all three on-ramp lessons are built and awaiting content review. Not yet deployed.
3. **Coverage view.** A first version is built at `/coverage`: per exam domain, how many written exercises have been answered correctly. It still needs mastery levels and a way to show how much of each domain is unwritten.
4. **Main unit lessons**, drafted and reviewed one at a time. This unit carries most of the Solutions Architect weight. *All six lessons are drafted and awaiting content review.*
5. **The real capstone canvas.** A first version is built at `/build/web-app`, replacing the prototype (which was removed; it is in the git history). It is driven by a scenario definition in `lib/canvas/scenarios.ts`, so scenario mode can add more without touching the canvas.
6. **Scenario mode.** A first version is built at `/scenarios` with five scenarios. Next: more scenarios as new units add services to the palette.
7. **The rest of the progress view**: mastery, streak, review queue.
8. **Deploy to Vercel**, when asked.

## Open questions


- Final product name.
