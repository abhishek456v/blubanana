---
name: run-creatordesk
description: Launch and drive CreatorDesk (Expo + React Native Web) — start the dev server, sign in, navigate to any screen, and screenshot it in both themes and at both widths. Use whenever you need to see what a change actually looks like, or reproduce a UI/network bug.
---

# Running CreatorDesk

This app ships to iOS, Android **and web**, and web is where you can actually
look at it. Everything below drives the web build.

`tsc` and the bundler only prove the code compiles. They cannot tell you a
screen rendered blank, a card is missing, a contrast is unreadable, or a query
is 500ing. **Do not report UI work as done without looking at a screenshot.**

## 1. Start the dev server

```bash
npx expo start --web --port 8081
```

Run it in the background and leave it running; the driver expects
`http://localhost:8081`. Check it's up before driving:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8081   # expect 200
```

Metro takes a few seconds to resolve modules on first load. The driver already
waits; don't shorten those timeouts.

## 2. Drive it

```bash
node scripts/drive.mjs --email <email> --password '<password>' --all
```

Credentials belong to the human. Ask for them; never invent an account, and
never write them into a file.

| Flag | Effect |
|---|---|
| `--all` | Visits every tab (Work, Money, Brands, You) |
| `--width` / `--height` | Viewport. **Defaults to a phone**; pass `--width 1440` for desktop |
| `--dark` | Renders the dark theme |
| `--goto /reminders` | Opens an in-app route after sign-in. Repeatable |
| `--deal` | Opens the first deal (detail screen) |
| `--search nyka` | Opens the search overlay and runs a query |
| `--tap 'Next'` | Clicks a control, then screenshots. Repeatable |
| `--prefix v2-` | Prefixes filenames so runs don't overwrite each other |

Screenshots land in `screenshots/` (gitignored). **Then read them with the Read
tool.** Saving a screenshot and not looking at it is the same as not taking it.

Order of operations inside a run: sign in → skip onboarding → `--all` tabs →
`--search` → `--deal` → `--tap`s → `--goto`s. Taps run *before* gotos so a flow
can finish before the survey navigates away.

## 3. Read the output, not just the exit code

The driver collects console errors, failed requests, and **every HTTP >= 400
with its response body**.

That last one is load-bearing. Playwright does not treat a 4xx/5xx as a failed
request — the response arrived — so without it a broken query surfaces only as
a bare `Failed to load resource: 400` in the console with no URL. Two
production bugs (migration 010's recursive RLS policy, which broke every insert
in the app while reads kept working) were found this way and nowhere else.

`no console errors, no failed requests` is the pass condition.

## What to check, and at which width

The desktop and phone layouts are genuinely different code paths, not a reflow.
Several screens branch on `isDesktop`:

- **Invoices** — `DataTable` on desktop, `ListRow`s on phone
- **Reminders / Work archive / Brands** — grid on desktop, single column on phone
- **Deal detail** — two columns on desktop, one stack on phone
- **Sheets** (search, date picker) — centred card on desktop, bottom sheet on phone

So a change to any of those needs **four** shots: `--width 1440` and
`--width 390`, each with and without `--dark`. DESIGN.md's rule is "screenshot
both before calling a screen done."

Common real defects this catches that typecheck never will:
- content overflowing the right edge at 390px (tiles have a `minWidth`)
- a card stretched to a taller neighbour and left with dead space
- a modal deep-linked directly, with nothing rendered behind it
- chart bars so faint they read as loading skeletons

## Gotchas worth knowing before you debug them

- **Onboarding fires on every fresh run.** A new browser context has no
  dismissed-flag, so an account with an unfilled profile redirects to
  `/onboarding`. The driver auto-skips it.
- **`--url` cannot reach a route behind auth.** It lands before the session
  exists, the guard bounces to sign-in, and the post-login redirect goes to the
  app root. Use `--goto` instead, which navigates *after* signing in.
- **Tab labels are not unique.** react-navigation keeps every tab's scene
  mounted, so `getByText('Money')` can match the Money screen's own hidden
  heading. `tap()` tries role before text, and prefers the *last* DOM match
  because modals are portaled to the end.
- **Migrations are applied by hand.** `supabase db push` is blocked on this
  project; SQL files must be pasted into the dashboard SQL editor by the human.
  A pasted script runs as one transaction, so a raising verification block
  rolls the whole migration back — which is the desired behaviour.

## Native

`npx expo start` then `i` / `a` for a simulator, or scan the QR with Expo Go.
There is no automated driver for native; web is the fast loop, and the layouts
below `wide` (768px) are the same code the phone runs.
