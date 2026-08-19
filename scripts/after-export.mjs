// Finishes the web export so it can be dropped onto a static host.
//
//   npm run build:web
//
// `expo export --platform web` with `output: "single"` produces one index.html
// and a bundle. Every route in the app is resolved by JavaScript, so a host
// asked for /deal/123 directly will look for a file that does not exist and
// return 404. The rewrite below sends every unknown path to index.html and lets
// the router work it out, which is what makes a refresh on any screen behave.
//
// Both files are written because they cost nothing and cover the three hosts
// worth using: Netlify and Cloudflare Pages read _redirects, Vercel reads
// vercel.json.

import { writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DIST = join(process.cwd(), 'dist')
if (!existsSync(DIST)) {
  console.error('No dist/. Run: npx expo export --platform web')
  process.exit(1)
}

writeFileSync(join(DIST, '_redirects'), '/*  /index.html  200\n')
writeFileSync(
  join(DIST, 'vercel.json'),
  JSON.stringify({ rewrites: [{ source: '/(.*)', destination: '/index.html' }] }, null, 2) + '\n'
)

console.log('dist/ is ready to deploy. Rewrites written for Netlify, Cloudflare Pages and Vercel.')
