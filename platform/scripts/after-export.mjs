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
// Three files, because they cost nothing and cover every host worth using:
// Hostinger and anything else on Apache or LiteSpeed read .htaccess, Netlify
// and Cloudflare Pages read _redirects, Vercel reads vercel.json. Whichever one
// the site ends up on, the rewrite is already there.

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

// Apache and LiteSpeed, which is what Hostinger runs.
writeFileSync(
  join(DIST, '.htaccess'),
  `# Every route in this app is resolved by JavaScript, so a request for
# /deal/123 must be answered with index.html rather than a 404.
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

# The bundle's filename contains a hash of its contents, so it can be cached
# forever. index.html must never be, or a deploy would not reach anyone.
<IfModule mod_headers.c>
  <FilesMatch "\\.(js|css|woff2|png|jpg|svg|webp)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  <FilesMatch "index\\.html$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
`
)

console.log('dist/ is ready to upload. Rewrites written for Hostinger, Netlify, Cloudflare Pages and Vercel.')
