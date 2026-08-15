# CreatorDesk — Design System

Single source of truth for how CreatorDesk looks and feels. Tokens live in
`constants/design.ts` and `constants/motion.ts` — reference them by name, never
hardcode a value in a screen.

**This document was rewritten in August 2026.** The previous version described a
flat, monochrome-leaning system: one surface colour, no depth, no charts, "flat
rows not boxed cards". It was followed faithfully, and the result was a wall of
uniform beige with no hierarchy — every element equally important, so nothing
was. The rules below replace it.

What changed, and why: this is a **dashboard**, not a reading surface. A creator
opens it to find one number (what am I owed?) and one list (what needs me
today?). A design language with no contrast cannot answer "look here first",
which is the only job the first screenful has.

---

## 1. Two themes, both first class

Day and night are equals, switchable by a toggle (`ThemeToggle`), persisted
across launches, defaulting to the OS. Neither is an afterthought — screenshot
both before calling a screen done.

Themes are read through `useTheme()`. Never call `useColorScheme()` in a screen:
it ignores the user's explicit choice.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bgPage` | `#FDFBF9` | `#141210` | App background |
| `bgSurface` | `#F6F2EC` | `#221F1B` | Cards, rows |
| `bgSurfaceRaised` | `#FFFFFF` | `#2C2822` | Sheets, floating cards |
| `bgContrast` | `#1C1815` | `#F5F0E8` | **The one card that inverts** |
| `onContrast` | `#F5F0E8` | `#1C1815` | Text on that card |
| `border` | 8% ink | 7% white | Hairlines |
| `borderStrong` | 16% ink | 16% white | Input borders |
| `textPrimary` | `#1C1815` | `#F5F0E8` | Headlines, figures |
| `textSecondary` | `#6B6259` | `#A89F94` | Supporting copy |
| `textMuted` | `#9A9186` | `#6B6259` | Meta, placeholders |
| `accent` | `#F5A623` | `#F5A623` | The one brand colour |

Status colours (`success` / `warning` / `danger` / `info`) each have a text and
a `*Light` tint, tuned per theme: deep and saturated on light, bright pastel on
dark.

---

## 2. Contrast is the hierarchy

**Exactly one `bgContrast` card per screen.** It carries the single most
important figure — money owed on Home, locked-this-month on Money. On the light
theme it is near-black; on the dark theme it is cream. Same role, inverted
value.

Two contrast cards competing means neither wins. If a screen seems to need two,
the screen has no primary answer and the content needs rethinking, not another
card.

Everything else sits on `bgSurface`, separated by gaps rather than borders.

---

## 3. Typography

**Instrument Sans**, one family, four cuts. Hierarchy comes from weight and
size, not from a second face.

| Style | Size | Cut |
|---|---|---|
| Hero figure | 34–40 | 700 Bold |
| Display | 28 | 600 SemiBold |
| Title | 20 | 600 SemiBold |
| Heading | 16 | 600 SemiBold |
| Body | 15 | 400 Regular |
| Caption | 13 | 400 Regular |
| Label | 12 | 500 Medium |

`FontFamily.display` and `displayBold` still exist as names, so screens ask for
a role rather than a font. They now resolve into the same family as the rest.

**Never set `fontWeight` in a style.** Every cut is a separate file with the
weight baked into its name, so a `fontWeight` alongside it makes native look
for a variant that does not exist and fall back to the system face — silently,
and only on device. `Typography` therefore carries sizes and nothing else; the
weight you want is the `FontFamily` you pick.

Money still wants to feel like the thing the creator came for: give it the
display cut and a larger size rather than a different typeface.

Sentence case throughout. No all-caps except the small uppercase eyebrow labels
on stat tiles, where letterspacing carries the hierarchy instead of size.

---

## 4. Density

The old system used phone-scale padding at every width, which on desktop
produced 120px-tall rows carrying two lines of text.

| | Mobile | Desktop |
|---|---|---|
| List row height | 64–72 | 56–64 |
| Card padding | 16 | 20 |
| Gap between cards | 10 | 12 |
| Metric tiles per row | 2 | 4 |

A desktop screenful should show roughly twice what a phone does. If it doesn't,
the layout is a stretched phone.

---

## 5. Elevation and shape

| Token | Use |
|---|---|
| `Radius.sm` 8 | Inputs, small controls |
| `Radius.md` 12 | Rows, standard cards |
| `Radius.lg` 16 | Sheets, hero cards |
| `Radius.xl` 20 | Auth panels |
| `Radius.full` | Pills, avatars, buttons |

`Elevation.sm` for cards that lift off the page, `md` for sheets, `lg` for the
one floating thing (toast, FAB). Warm-tinted, never pure black — black shadow
over a warm palette reads grey.

`accentGlow()` on the primary button only.

---

## 6. Charts belong in cards

A dashboard without charts is a table. Every screen showing a trend over time
should show it as a shape, not only as a number:

- `Sparkline` — inline trend inside a stat tile or row
- `BarChart` — monthly comparison
- `ProgressRing` — a proportion against a benchmark

Charts use the accent at full strength for the active/current value and
`accentLight` for the rest. Never more than one hue in a single chart — this
product has one brand colour and status colours; a rainbow palette belongs to a
different product.

---

## 7. Motion

Tokens in `constants/motion.ts`. Timings for things appearing, springs for
things a finger is manipulating.

- 200ms ease-out for sheets and entrances
- 150ms for tap feedback, scale to 0.97
- Staggered list entrance, capped at 8 items
- Exactly one looping animation in the app: the current node on `StageTimeline`.
  Anything else that loops competes with the thing actually asking for action.

---

## 8. What not to do

- **No second accent hue.** Amber is it. Status colours are not accents.
- **No more than one contrast card per screen.**
- **No more than one filled primary button visible at once.**
- **Never `useColorScheme()` in a screen** — it ignores the theme toggle.
- **No flat wall of one surface colour.** If a screen is entirely `bgSurface`,
  it has no hierarchy.
- **No dense tables on mobile.** Tables are a desktop affordance; phones get
  rows.
- **Status colour is never the only signal** — always paired with a label, so
  the product stays usable for colourblind users.
