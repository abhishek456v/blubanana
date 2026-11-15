// Gives the demo account a new password nobody has seen.
//
//   node scripts/rotate-demo-password.mjs
//
// Why this exists: seed-demo.mjs used to carry the demo account's password as
// a default, in a public repository. Deleting that line does not help on its
// own. The old password is still in the git history, and it kept working
// until somebody changed it. This changes it.
//
// What it does, in order:
//
//   1. makes a random password on this machine;
//   2. sets it on the demo account with the admin API;
//   3. signs every existing session for that account out, because a new
//      password does not end a session that was opened with the old one;
//   4. saves the new password in the macOS Keychain, so it is never printed
//      and never typed into a file.
//
// To read it back when you need to sign in to the demo account:
//
//   security find-generic-password -s "Blubanana demo password" -w

import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=')
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
    })
)

const URL_ = env.EXPO_PUBLIC_SUPABASE_URL
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !ANON || !SERVICE) throw new Error('Missing Supabase URL or keys in .env')

const EMAIL = process.env.DEMO_EMAIL ?? 'demo@blubanana.in'
const KEYCHAIN_SERVICE = 'Blubanana demo password'

const adminHeaders = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
}

async function call(path, init) {
  const r = await fetch(`${URL_}/auth/v1/${path}`, init)
  const text = await r.text()
  if (!r.ok) throw new Error(`${path}: ${r.status} ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

const list = await call('admin/users?per_page=200', { headers: adminHeaders })
const user = (list.users ?? []).find((u) => u.email === EMAIL)
if (!user) throw new Error(`${EMAIL} does not exist, so there is nothing to change`)

// 24 random bytes as base64url: 32 characters, no symbols a shell would trip on.
const password = randomBytes(24).toString('base64url')

await call(`admin/users/${user.id}`, {
  method: 'PUT',
  headers: adminHeaders,
  body: JSON.stringify({ password }),
})
console.log(`password  changed for ${EMAIL}`)

// Signing in with the new password yields a token for this account, and a
// global sign-out with that token revokes every session it has, including any
// opened with the old password.
const session = await call('token?grant_type=password', {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password }),
})
await call('logout?scope=global', {
  method: 'POST',
  headers: { apikey: ANON, Authorization: `Bearer ${session.access_token}` },
})
console.log('sessions  all signed out')

// -U replaces an entry that is already there, so running this twice is safe.
execFileSync('security', [
  'add-generic-password',
  '-U',
  '-s',
  KEYCHAIN_SERVICE,
  '-a',
  EMAIL,
  '-w',
  password,
])
console.log(`keychain  saved as "${KEYCHAIN_SERVICE}"`)
console.log(`\nTo read it:  security find-generic-password -s "${KEYCHAIN_SERVICE}" -w`)
