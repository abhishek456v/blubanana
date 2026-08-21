# The admin dashboard

For you alone, to begin with. That simplifies the security model enormously:
one allowlisted user id, not roles and permissions. If staff arrive later,
`memberships` already carries a role column and the pattern extends.

What follows is grounded in what your database and website actually contain
today, checked rather than assumed.

---

## What you already have, and did not know you had

**`audit_logs` has 575 rows in it right now.** Something has been recording
activity all along. An admin activity feed is a screen over data that already
exists, not a feature to build.

**Pricing is already live-editable.** `pricing` and `billing_terms` are
database tables, and `website/app.js` already fetches them at runtime with the
anonymous key so the public pricing page shows whatever the database says.
Change a row, the website changes. No deploy.

That last point matters more than it looks: it is the proven pattern in this
codebase for admin-editable website content, and the answer to the blog
problem below.

**Storage exists** with `attachments` and `profile-photos` buckets, both
private. A media library needs one more, public, for website images.

---

## The three tiers

### Tier 1: screens over data that already exists

Days, not weeks. Nothing new in the database.

| Area | Reads | Why it matters |
|---|---|---|
| Subscriptions and revenue | `subscriptions`, `subscription_payments`, `subscription_invoices` | Who is paying, who lapsed, what came in |
| Users and workspaces | `workspaces`, `profiles`, `memberships` | Who signed up, when, how much they use it |
| Activity log | `audit_logs` | 575 rows already. Who changed what, when |
| Pricing control | `pricing`, `billing_terms` | Already drives the public site live |
| Message log | `outbound_messages` | Did the reminder actually go |
| Reminder health | `reminders` | What is queued, what failed |
| Trial watch | `subscriptions` | Who is about to lapse, so you can reach them first |

### Tier 2: needs new tables, but no architectural change

| Area | New table | Notes |
|---|---|---|
| Support issues | `support_tickets` | Nothing like this exists yet. Status, assignee, the user it came from |
| Broadcast | `announcements` | In-app banner is easy. Email to all needs SMTP first |
| Media library | `media` + a public bucket | For website images and video |
| Contact details | `settings` | Currently hardcoded in `website/src/site.mjs` at build time |
| Feature switches | `feature_flags` | Turn Instagram off when Meta breaks, without a deploy |

### Tier 3: the one that is genuinely architectural

**The blog is code.** Posts live in `website/src/content/blog.mjs` and are
baked into HTML at build time. Editing them from a dashboard means moving them
into the database, and then choosing how the website reads them:

- **Runtime fetch**, the way pricing already works. Simple, proven here,
  but the post body arrives after the page does, which is bad for search
  engines on a page whose whole purpose is search.
- **Rebuild on save**, via a Vercel deploy hook. The site stays fully static
  and search engines see everything. A post takes a minute or two to appear.

For a blog, **rebuild on save is the right answer**, and it costs one webhook.
Search visibility is the entire point of those five posts.

---

## Things you did not list, which you will want

**Data requests, under the DPDP Act.** As a data fiduciary you are obliged to
service access and erasure requests. `delete-account` already exists as an edge
function; there is no way to see or record a request. This is a legal
requirement, not a nicety.

**View as a user.** When somebody writes in saying their deals vanished, the
alternative to seeing what they see is a conversation conducted blind. Needs
care and an audit entry every time it is used.

**Failed payment watch.** Empty today because Razorpay is not on. The day it
is, a card declining silently is churn you never saw coming.

**Launch seat control.** `intro_seats_taken()` already drives the "500 places"
counter on the public site. Being able to move that number is a pricing lever.

**Deliverability.** Once SMTP is configured, bounces and complaints are the
early warning that your reminder emails have stopped arriving.

---

## Security: what was decided, in plain terms

Settled in conversation on 21 August. These are requirements, not options.

**One front door.** Everyone signs in at the same page: you, staff, creators.
Not two sites. Two front doors means two locks to maintain and the second one
is the one that stops getting patched.

**The admin area needs a keycard.** A creator can sign in perfectly well and
reach the admin URL, and get nothing at all. Hiding the URL is not part of
this: every route in the app is already readable in the JavaScript the site
ships to every visitor, so a secret address protects nothing and pretending
otherwise is how people end up relying on it.

**No sign-up, ever.** The admin area has no registration of any kind. The only
way in is an invitation issued by an existing admin. There is no request form
and no self-service path.

**Nobody can grant themselves a keycard.** The role lives in a column that the
`authenticated` role has no permission to write, by column-level revoke. The
codebase already does exactly this for the social tokens in migration 013. A
crafted "make me an admin" request is refused by Postgres, one level below the
application, so an application bug cannot undo it.

**The founder cannot be removed or demoted.** One row is marked as founder and
a restrictive policy refuses any delete or role change against it, including
from another admin. Inviting somebody who later turns hostile costs nothing.

**Invites can be revoked** by the founder at any time, immediately.

**Admin reads that cross workspaces run server side only**, in an edge function
on the service role. If a browser ever holds a key that can read every
workspace, all of the tenancy work is undone.

**Every admin action is written to `audit_logs`, including reads.** A dashboard
that can see everyone's money should be able to say what it looked at.

### Two rules that live in the app, not in Supabase

Supabase has one password policy and one session length for the entire
project, so neither of these can be a setting:

- **Admin passwords must be at least 10 characters.** The project minimum
  stays at 6 for creators, deliberately, and the admin area refuses to let an
  admin hold a shorter one.
- **Admin sessions re-authenticate sooner.** After a period on the admin
  screens it asks for the password again, while the ordinary app session
  continues untouched.

### Owner's own hardening

- **2FA on the admin account.** TOTP is already enabled at project level and
  needs enrolling. This matters more than everything above: the realistic
  attack is a stolen or reused password, not a broken database, and 2FA is
  what makes a stolen password useless on its own.
- **Leaked-password checking is a Pro plan feature** and was refused on the
  free tier. Worth revisiting, well below 2FA in priority.

---

## Suggested order

1. **Tier 1 read-only screens.** Immediate value, no new schema, no risk.
2. **Support tickets and feature switches.** Small tables, high daily use.
3. **Blog in the database, with a deploy hook.** The big one. Do it when the
   first three have proven the shape.
4. **Media library and broadcast.** Both want SMTP and a public bucket first.
