# CreatorDesk — Design System

This file is the single source of truth for how CreatorDesk looks and feels.
Every screen, component, and future feature should pull from these tokens
instead of improvising new colors, spacing, or type choices.

Inspiration: Apple's native app confidence — generous whitespace, content
does the talking, restraint everywhere except one deliberate accent — paired
with a warm, editorial creator-economy voice (a single amber accent, a
display serif-adjacent headline font) instead of Apple's cool blue-on-white.
Status is still communicated primarily through label and weight; color is
layered on top as a second signal, not the only one.

---

## 1. Color

One accent (amber), a warm neutral scale, and four status colors used
consistently everywhere a state needs to read at a glance. Tokens live in
`constants/design.ts` — always reference them by name, never hardcode a hex
value in a screen.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bgPage` | `#FDFBF9` | `#141210` | App background |
| `bgSurface` | `#F6F2EC` | `#221F1B` | Cards, rows, sidebar |
| `bgSurfaceRaised` | `#FFFFFF` | `#2C2822` | Modals, sheets |
| `border` | `rgba(20,18,16,.08)` | `rgba(255,255,255,.07)` | Hairline dividers |
| `borderStrong` | `rgba(20,18,16,.16)` | `rgba(255,255,255,.16)` | Input borders, emphasis |
| `textPrimary` | `#1C1815` | `#F5F0E8` | Headlines, primary content |
| `textSecondary` | `#6B6259` | `#A89F94` | Supporting text, labels |
| `textMuted` | `#9A9186` | `#6B6259` | Placeholders, timestamps |
| `accent` / `fillPrimary` | `#F5A623` | `#F5A623` | Primary button fill, active states, the one brand color |
| `onFillPrimary` | `#FFFFFF` | `#FFFFFF` | Text/icon on accent fill |
| `accentLight` | 12% accent | 14% accent | Tinted backgrounds behind accent content |
| `accentHover` | `#E0951A` | `#FFC55A` | Pressed/hover state (darker on light, lighter on dark) |

**Status colors** — one hue per state, same hue in both modes, tuned per
mode for contrast (dark mode uses bright pastel text on a translucent tint;
light mode uses a deep, saturated text on a pale tint):

| State | Token | Light text | Dark text | Meaning |
|---|---|---|---|---|
| Success | `success` / `successLight` | `#1A7A35` | `#4ADE80` | Paid, completed, on track |
| Warning | `warning` / `warningLight` | `#8B5000` | `#FBBF24` | Due soon, in progress, needs attention |
| Danger | `danger` / `dangerLight` | `#C0392B` | `#F87171` | Overdue, urgent |
| Info | `info` / `infoLight` | `#0051A8` | `#60A5FA` | Awaiting an external party (payment awaited, sent) |

A status pill is never color alone — it always carries a label too, so the
product stays usable for colorblind users even though color is now a first-
class signal (not just weight, as in the original monochrome-only version of
this system).

**Avatars** (brand initials, creator avatar) cycle through a fixed 8-color
flat palette (`AvatarPalette` in `constants/design.ts`), hashed from the
name so the same brand always gets the same color. Flat fills only — no
gradients (keeps rendering identical across iOS/Android/web without an extra
dependency).

---

## 2. Typography

**Body: Inter** (variable font, already integrated via `@expo-google-fonts`).
**Display: Syne** — screen titles, the dashboard greeting, large currency
figures. Used sparingly: one or two elements per screen, never body copy.

Fallback stacks: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` / `Syne, Georgia, serif`

| Style | Size | Weight | Family | Use |
|---|---|---|---|---|
| Display | 28px | 600 | Syne | Dashboard greeting, empty states, hero numbers |
| Title | 20px | 600 | Syne | Screen titles |
| Heading | 16px | 600 | Inter | Card titles, section headers, row primary text |
| Body | 15px | 400 | Inter | Default content |
| Body strong | 15px | 500 | Inter | Emphasized inline content |
| Caption | 13px | 400 | Inter | Secondary/meta text |
| Label | 12px | 500 | Inter | Pills, tags |

Rules: sentence case everywhere, no all-caps, no italics for emphasis — use
weight or the display family instead.

---

## 3. Spacing & radius

8px base grid.

| Token | Value |
|---|---|
| `space-xs` | 4px |
| `space-sm` | 8px |
| `space-md` | 16px |
| `space-lg` | 24px |
| `space-xl` | 32px |
| `radius-sm` | 8px (inputs, small controls) |
| `radius-md` | 12px (cards, deal rows) |
| `radius-lg` | 16px (modals, larger panels) |
| `radius-xl` | 20px (auth panels, hero surfaces) |
| `radius-full` | 999px (pills, primary buttons, avatars) |

---

## 4. Components

**Primary button** — pill shape, `accent` background, white text, 44px
height (touch target), icon + label when the action benefits from it (e.g.
mic icon on "Add deal"). Never more than one visible on screen at a time.

**Secondary button** — pill shape, transparent fill, `borderStrong` outline,
`textPrimary` text.

**Deal row (flat, not boxed cards)** — `bgSurface` background, `radius-md`
corners, no border, 14–16px vertical padding. Left: small rounded-square
avatar with brand initials (flat color from `AvatarPalette`). Center: brand
name + deliverable, deadline as secondary line. Right: status pill (colored
per the state table above). Rows sit directly on the page background with
8–10px gaps — no heavy card borders stacking on top of each other.

**Metric card** — `bgSurface` background, `radius-md`, label in Caption
style above a Display-weight number. Used in 2-3 column grids for dashboard
summary rows.

**Sidebar / bottom nav** — on mobile this becomes a bottom tab bar, not a
sidebar. Icons only + label, 5 items max: Dashboard, Deals, Brands, Revenue,
Settings. Active state = filled icon + `accent`; inactive = outline icon +
`textMuted`.

**Auth screens (wide viewport)** — split panel: a branded left panel
(`bgSurfaceRaised`-on-dark editorial headline in Syne, accent-tinted glow)
next to the form on the right, matching the confidence of a native app's
onboarding rather than a bare centered form. Below the `wide` breakpoint,
the branding panel collapses and only the form shows.

---

## 5. Motion

Keep it minimal and functional. Standard transitions: 200ms ease-out for
sheets/modals, 150ms for taps/presses (scale to 0.97 on press, no shadow
pulses beyond a soft accent glow on primary buttons/hero elements).

---

## 6. What NOT to do

- No more than one accent hue as a "brand" color — amber is it; don't add a
  second one later without a deliberate decision
- No gradients on avatars or fills — flat color only
- No more than one primary (filled) button visible on screen at a time
- No dense data tables on mobile — use rows/cards; tables are fine on wide/
  web layouts where there's room
- Status color is always paired with a label — never color as the only signal
