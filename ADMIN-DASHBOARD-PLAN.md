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

## Security, given it is one person

1. An `is_admin` boolean on `profiles`, set by hand for one row, plus a
   restrictive policy so no client can ever set it on itself.
2. Admin reads that cross workspaces go through an edge function on the
   service role, never through the app's own client. The moment the browser
   holds a key that can read every workspace, the tenancy work is undone.
3. Every admin action writes to `audit_logs`, including the reads. A dashboard
   that can see everyone's money should be able to say what it looked at.

---

## Suggested order

1. **Tier 1 read-only screens.** Immediate value, no new schema, no risk.
2. **Support tickets and feature switches.** Small tables, high daily use.
3. **Blog in the database, with a deploy hook.** The big one. Do it when the
   first three have proven the shape.
4. **Media library and broadcast.** Both want SMTP and a public bucket first.
