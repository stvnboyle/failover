# PROTOTYPE — capstone canvas (throwaway)

Not production code. No tests, no persistence. Rewrite it properly when building the real capstone.

## The questions, and what was learned

1. **Does placing and connecting services on a pre-drawn canvas feel like building?**
   Two interaction models were compared: a free canvas (drop anywhere, drag wires between dots, built on React Flow) and snap to zones (drop into a zone, click two services to connect, plain HTML and SVG). **Snap to zones won.** The free-canvas variant and React Flow were removed.
2. **Can plain rule functions judge the result fairly, so that more than one layout passes?**
   Yes. Nine core rules (plus one optional stretch rule for the NAT gateway) over nodes and edges passed two different correct layouts and failed six deliberately broken ones on the right rule.

## Run it

```bash
pnpm dev
```

Then open `/prototype/canvas`.

## Files

| File | What it is |
|---|---|
| `model.ts` | Pure. The diagram type, the nine rules, the AZ failure simulation, and traffic tracing. The part meant to survive. |
| `canvas.tsx` | The snap-to-zones board. |
| `shared.tsx` | Service cards, zone styling, wires, palette with info buttons, checklist, telemetry. |
| `canvas.css` | Motion: a service landing, a wire drawing in, and the heartbeat once every rule passes. |

## Still open

- Resources that span AZs are handled with a "spans both public subnets" strip, which is a workaround.
- Auto scaling is not in the palette.
