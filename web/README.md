# The marketing website

Static HTML. No framework, no runtime dependencies, nothing to install on the
host. `web/dist` is committed, so deploying is copying a folder.

## Building

```
node web/build.mjs
```

Writes `web/dist`. The build **fails** if it finds a dead internal link, a
missing image, a page without a description, or a `TODO` placeholder — the last
of these because a marketing site with a fake phone number is the specific thing
that fails a Razorpay merchant activation. Pass `--draft` to build anyway while
those details are still outstanding.

## Looking at it

```
node web/build.mjs --draft
cd web/dist && python3 -m http.server 4173
node web/tools/preview.mjs        # screenshots every page, both widths
```

`preview.mjs` also reports console errors, failed requests and any page that
scrolls sideways.

## Images

```
node web/tools/images.mjs
```

Reads the app screenshots in `/screenshots`, crops and resizes them, and writes
WebP at two widths into `web/assets` along with `manifest.json`, which is where
the `<img>` width and height come from. Chromium does the encoding — it is
already here for Playwright, and there is no other WebP encoder on this machine.

The screenshots themselves come from a **demo workspace**, never a real one:

```
node scripts/seed-demo.mjs                          # invented brands, deterministic figures
npx expo start --web --port 8081                    # in another terminal
node scripts/drive.mjs --email demo@creatordesk.in --password '…' --all --dark --width 1440 --prefix demo-wide-
```

## What lives where

| File | What it holds |
|---|---|
| `src/site.mjs` | Company details, prices, the navigation. One fact, one place. |
| `src/layout.mjs` | `<head>`, header, footer. Every page passes through it. |
| `src/ui.mjs` | Section builders — hero, split, tabs, FAQ, screenshots. |
| `src/content/*.mjs` | One file per page: title, description, structured data, body. |
| `styles.css` | The design system, with the tokens taken from `constants/design.ts`. |
| `app.js` | Menus, tabs, reveal, and the live price read. Everything else is HTML. |

## The live price

The prices on the site are read from the `pricing` table at page load with the
anon key, and the count of remaining launch places from `intro_seats_taken()`.
Migration 035 grants both to `anon`; **037** adds the row-level policy without
which the grant returns an empty list.

If either call fails, the figures compiled into the markup stand — those are
correct, just potentially a day behind. Nobody ever sees a blank price.

## Deploying

Any static host. Cloudflare Pages, Netlify, S3, nginx — point it at `web/dist`.
Clean URLs work everywhere because each page is `<path>/index.html`.
