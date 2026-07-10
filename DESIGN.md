# CreatorDesk — Design System

This file is the single source of truth for how CreatorDesk looks and feels.
Every screen, component, and future feature should pull from these tokens
instead of improvising new colors, spacing, or type choices.

Inspiration: Apple's native app language — quiet, confident, monochrome,
generous whitespace, content does the talking, not decoration.

---

## 1. Color

No accent color. Black, white, and a gray scale only. Status is communicated
through weight, icon, and label — never color alone (this also means the
product is colorblind-safe by default).

| Token | Value (light mode) | Value (dark mode) | Use |
|---|---|---|---|
| `--bg-page` | `#FFFFFF` | `#000000` | App background |
| `--bg-surface` | `#F7F7F7` | `#121212` | Cards, rows, sidebar |
| `--bg-surface-raised` | `#FFFFFF` | `#1C1C1C` | Modals, sheets |
| `--border` | `#E5E5E5` | `#2A2A2A` | Hairline dividers |
| `--border-strong` | `#D0D0D0` | `#3A3A3A` | Input borders, emphasis |
| `--text-primary` | `#0A0A0A` | `#FAFAFA` | Headlines, primary content |
| `--text-secondary` | `#6B6B6B` | `#A0A0A0` | Supporting text, labels |
| `--text-muted` | `#9E9E9E` | `#6E6E6E` | Placeholders, timestamps |
| `--fill-primary` | `#0A0A0A` | `#FAFAFA` | Primary button fill |
| `--on-fill-primary` | `#FFFFFF` | `#0A0A0A` | Text/icon on primary fill |

**Status without color:**
- Urgent / overdue → bold weight (500) + filled dark pill, e.g. "Payment overdue"
- Normal / on track → regular weight + outline pill
- Complete → strikethrough or muted gray text + checkmark icon

---

## 2. Typography

**Font: Inter** (variable font). Closest free match to SF Pro's proportions,
with far better React Native / Expo support than alternatives.

Fallback stack: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

| Style | Size | Weight | Use |
|---|---|---|---|
| Display | 28px | 600 | Dashboard greeting, empty states |
| Title | 20px | 600 | Screen titles |
| Heading | 16px | 600 | Card titles, section headers |
| Body | 15px | 400 | Default content |
| Body strong | 15px | 500 | Emphasized inline content |
| Caption | 13px | 400 | Secondary/meta text |
| Label | 12px | 500 | Pills, tags, uppercase-free labels |

Rules: sentence case everywhere, no all-caps, no italics for emphasis — use weight instead.

---

## 3. Spacing & radius

8px base grid.

| Token | Value |
|---|---|
| `--space-xs` | 4px |
| `--space-sm` | 8px |
| `--space-md` | 16px |
| `--space-lg` | 24px |
| `--space-xl` | 32px |
| `--radius-sm` | 8px (inputs, small controls) |
| `--radius-md` | 12px (cards) |
| `--radius-full` | 999px (pills, primary buttons, avatars) |

---

## 4. Components

**Primary button** — pill shape, `--fill-primary` background, white/black text
depending on mode, 44px height (touch target), icon + label when the action
benefits from it (e.g. mic icon on "Add deal").

**Secondary button** — pill shape, transparent fill, `--border-strong` outline,
`--text-primary` text.

**Deal row (flat, not boxed cards)** — `--bg-surface` background, `--radius-md`
corners, no border, 14–16px vertical padding. Left: small rounded-square avatar
with brand initials. Center: brand name + deliverable, deadline as secondary
line. Right: status pill. Rows sit directly on the page background with 10px
gaps — no heavy card borders stacking on top of each other.

**Metric card** — `--bg-surface` background, `--radius-md`, label in Caption
style above a Display-weight number. Used in 2-3 column grids for the
dashboard summary row (earned this month, pending payment, active deals).

**Sidebar / bottom nav** — on mobile this becomes a bottom tab bar, not a
sidebar. Icons only + label, 5 items max: Dashboard, Deals, Brands, Revenue,
Settings. Active state = filled icon + `--text-primary`; inactive = outline
icon + `--text-muted`.

---

## 5. Motion

Keep it minimal and functional — Apple's restraint, not Material's bounce.
Standard transitions: 200ms ease-out for sheets/modals, 150ms for taps/presses
(scale to 0.97 on press, no shadow pulses).

---

## 6. What NOT to do

- No gradients, no drop shadows beyond a 1px hairline border
- No accent colors — resist the urge to add "just one" brand color later
  without a deliberate decision
- No more than one primary (filled) button visible on screen at a time
- No dense data tables on mobile — use rows/cards, push tables to a future
  desktop/web view only if one gets built
