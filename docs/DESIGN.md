# Design — bioluminescent laboratory at midnight

Built to a supplied style reference (Integrated Biosciences). The whole
interface is a darkroom laboratory: instruments on a bench, one signal lamp.

## The system

| Token | Value | Role |
|---|---|---|
| `--lime` | `#cef79e` | THE signal — rationed to micro-surfaces: tag dots, active nav pill, the score ring, tiny record ids |
| `--ink` | `#222f30` | the canvas — near-black with a cool green undertone, never pure black |
| `--bone` | `#f7f7f5` | light-band canvas (the editorial flip) |
| `--paper` | `#ffffff` | cards on light, primary text on dark |
| `--tissue` | `#e7e8e1` | body text on dark, warm alternate card on light |
| `--lichen` | `#c9cbbe` | labels, metadata, light-surface hairlines |
| `--graphite` | `#4d5757` | dark-surface hairlines and true disablement only |
| `--void` | `#000000` | the footer, and nothing else |

## Type

**One weight.** Inter Tight 400 (the reference names Aspekta; Inter Tight
is its stated substitute) for every size from caption to display —
hierarchy is size and negative tracking, never boldness, never italics.
Roboto Mono 400 is the lab notebook: nav, section counters, tags, buttons,
metadata, every identifier.

A global rule pins `font-weight: 400` on headings, buttons and strongs so
the discipline cannot erode by accident.

## Surfaces

Flat everywhere. No shadows, no gradients; 1px hairlines do all
delineation (`--graphite` on dark, `--lichen` on light). Radii: 8px
buttons, 12px nav pill and recessed panels, 16px cards, 40px the light
band. Depth is surface contrast: ink → hairline panel → bone band → white
card → void footer.

## The accent discipline

Lime appears on: 6px tag dots (the status system's entire colour
vocabulary), the active nav pill, the seal's progress ring, evidence ids,
and focus states. It never fills a large surface, never sits behind body
text, never appears twice in one component. Adverse states are carried by a
filled graphite dot and words — the system refuses traffic-light red.

## Readability rule (user-mandated)

Muted ≠ illegible. Everything a person must READ sits at `--lichen` or
above on dark; `--graphite` is reserved for hairlines and genuinely
disabled controls. Raw values (attos, epochs, enum codes) never render:
amounts are GEN, times are formatted stamps, statuses are labelled tags;
full hashes and addresses live in the technical record with copy buttons,
truncated everywhere else.

## The mark

The F-seal: a serrated stamp square — the factoring act as a mark pressed
into the record — lime field, ink glyph, legible at 16px, served as
`web/app/icon.svg` and inline in the masthead.
