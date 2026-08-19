# The marketing website

Static HTML. No framework, no runtime dependencies, nothing to install on the
host. `web/dist` is committed, so deploying is copying a folder.

## Building

```
node web/build.mjs
```

Writes `web/dist`. The build **fails** if it finds a dead internal link, a
missing image, a page without a description, an em or en dash in the copy, or a
`TODO` placeholder — the last
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

**The site ships no screenshots.** Everything that looks like the product is
drawn in HTML and CSS by `src/ui.mjs`. Two reasons, and both matter: the app's
interface is not final, so a screenshot would date the site every time a screen
moves, and a real workspace carries a creator's brands, rates and bank details,
which do not belong on a public page. The drawings carry no names, no brands, no
account numbers and no rupee figures.

The only image the site ships is `assets/og.png`, the social preview:

```
node web/tools/og.mjs
```

`web/tools/images.mjs` and `scripts/seed-demo.mjs` remain for QA work on the app
itself, not for this site.

## Free tools

```
node web/build.mjs      # bundles web/browser/tools.ts into dist/tools.js with esbuild
```

The five calculators import `lib/tax.ts` and `constants/gst.ts` directly. Both
are pure arithmetic with no imports, so they cross into a browser bundle
untouched, and the advance tax split on the website is the same function as the
one inside the app rather than a second copy waiting to disagree.

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
