# What is left

Two lists. The first is things only you can do, because they need a login, a
bank account, a legal identity or a decision. The second is building work.

Updated 22 August 2026, evening.

---

## Your list

### 1. Razorpay  ·  can start now

Both sites are live with the real contact details, which is what the
application needed. Apply for a merchant account at razorpay.com with the
Blubanana Marketing details. When it is approved you get two keys and a
webhook secret; the payment code is already written and waiting for them.
Their reviewers may ring the phone number on the site.

### 2. Meta, for Instagram figures

A Meta developer account and an app, which gives an App ID and secret. The
Instagram integration is already built and switched off; those credentials are
the switch. Follower counts and cost per view start filling in on the first
night after that.

### 3. Apple, for the iPhone app

An Apple Developer account, about ₹8,900 a year. Needed before the iPhone app
can be tested on a real device or submitted. Android needs nothing equivalent
to start.

### 4. Google verification, and why it matters more than it looks

**Done, 21 August:** Google Analytics is live on `G-ZN5MHYGQ8S` behind the
consent bar, and YouTube is genuinely connected, refresh token and all.

What is left is Google's **app verification**, and it is the one item here
with a waiting period, so it wants starting early rather than the week of
launch.

Until it is granted, anyone connecting YouTube meets a full-page warning
saying Google has not verified the app and "you shouldn't use it", with the
continue button labelled **unsafe**. That wording is Google's and cannot be
softened, reworded or skipped from our side.

The reassuring part: while the app is in Testing, only the accounts listed
under Audience -> Test users can reach that screen at all. No real creator can
see it, because no real creator can get that far. It becomes a problem only if
the app is published to Production while still unverified, which is the thing
not to do.

Everything Google asks for is already live and checked: `blubanana.in`
answers, `www` now redirects to it rather than the other way round, and
`/privacy` and `/terms` are up on the same domain. What is left is
paperwork:

1. Verify ownership of `blubanana.in` in Google Search Console, with the
   same Google account.
2. In the Google Auth Platform, under Branding, set the app home page to
   `https://blubanana.in` and the privacy policy to
   `https://blubanana.in/privacy`.
3. Submit for verification, explaining why the app reads YouTube figures.
   The honest answer is the right one: it compares a creator's reach against
   what she charges, and never posts anything.
4. Record a short screen video showing someone connecting the account and
   where the numbers then appear. Google asks for this and will not proceed
   without it.

`youtube.readonly` is classed **sensitive**, not restricted, so this is a
review by Google rather than a paid third-party security audit. Expect days
to a few weeks.

### 5. Make blubanana.in the main address  ·  done, 21 August

You set `www.blubanana.in` to redirect to `blubanana.in`, which is what every
page's canonical tag already claimed. Nothing further here.

### 6. One setting, so publishing a blog post actually publishes it

Ten minutes, in Vercel. The blog and the website's editable copy are both
waiting on it.

Posts now live in the database and you can write them, or bring a Word
document across, from the dashboard. What is missing is the last step:
telling the website to rebuild itself when you publish one. Without it a post
saves perfectly and never appears, and the dashboard says so in an orange
box rather than pretending otherwise.

1. In Vercel, open the **website** project, then **Settings**, then **Git**.
2. Scroll to **Deploy Hooks**. Give it the name `Blog` and the branch `main`,
   and press Create.
3. It gives you a web address starting `https://api.vercel.com/v1/integrations/`.
   Copy it.
4. Send it to me and I will put it where only the server can read it. It is a
   password in effect: anybody holding it can make your site rebuild over and
   over, which costs build minutes.

Until then, publishing still works and the website simply keeps showing what
it already has. App copy is unaffected: that is read at runtime and changes the
next time somebody opens the app.

### 7. Two dates I am holding for you

- **After 27 August:** I will ask you to confirm the address, phone, WhatsApp
  and legal name once more, as you asked.
- **Before launch:** a hosting decision. Vercel's free plan does not allow
  commercial use, so before real users pay, the sites move to a paid plan or
  another host. This is a ten minute change when the time comes.

---

## My list

### Everything was tested, 22 August

Two independent QA sweeps plus my own, then a second pass over everything the
sweeps could not reach. What came out of it, worst first:

- **Two-step verification did nothing at all.** Two separate faults, one on
  top of the other. The app redirected into the product the moment a password
  was accepted, so the code was never asked for; and the admin endpoint never
  checked the assurance level, so a stolen password used directly against the
  API reached every screen in the dashboard. Both fixed and proved with a real
  authenticator code: the password alone now stops at "one more step", and the
  endpoint refuses a session that has not answered it.

- **"Delete my account" did not work for anybody who had ever added a
  deal.** Deleting a workspace cascades to its deals and payments, whose
  audit trigger then wrote a record pointing at the workspace that had just
  been removed, and the database refused it. So the button failed with an
  error at the one moment a person has decided to leave, and the erasure
  obligation could not be met. Fixed and tested end to end: a throwaway
  account with a brand, a deal and a payment pressed the real button and
  came back clean.
- **Publishing a blog post could take the whole website off the air.** The
  build refuses all or nothing, so a stray heading, an unclosed tag or a link
  to a renamed page would have stopped every page deploying. Every rule the
  build enforces is now checked when you press Save, as a sentence.
- **A client could truncate any table.** The stock Supabase grant, under
  every table since the first migration. TRUNCATE ignores row level
  security, which is the whole of the tenancy model. Revoked.
- **Two switches switched nothing**, one escape hatch would have capped a
  paying creator at ten deals, and the media library would have let you
  delete a picture that a live post was using.
- Plus the smaller things a phone showed and a desktop did not.

Nothing was left behind: every test account and every row either sweep
created has been removed and the database checked.

### The admin dashboard  ·  built, 21 August

Everything agreed on 21 August is in, except the two things below it that were
deliberately deferred.

- **The morning screen:** what is broken, who is getting started, and the
  figures. The health card opens a page listing every expired connection,
  missed reminder and stuck message, with the workspace each belongs to.
- **People:** everyone using it, how far they got, and WhatsApp or email from
  the row. Opening one shows a read only look at their workspace: what they
  have, what they are owed, what is connected. Not a way to sign in as them,
  on purpose, and every time you open one it is recorded.
- **Subscriptions:** who is paying, who is ending this week, and four levers.
  Add trial days, give a month on the house, undo a cancellation, or correct
  the status. Extending an expired trial counts from today rather than
  backdating, which is the sort of thing that is wrong until somebody checks.
- **Help:** people can now write in from the app, and you answer from the
  dashboard. Replies they see and private notes they never do, in one thread.
- **Broadcast, media, switches, activity and data requests**, as agreed.
- **Words:** the headlines on the website and the onboarding lines in the app
  can be reworded from the dashboard. Not every string: the app carries about
  380 pieces of text, and putting all of them in a database would make the
  interface arrive after the screens do. What is editable is what actually gets
  reworded. Every line has the shipped words behind it, so a missing row or a
  phone with no signal reads exactly as it does now.
- **Writing:** the blog moved out of the website's code and into the database.
  Write a post, or bring a Word document across and it arrives converted, with
  any pictures in it uploaded to the media library and the links rewritten.
  PDF is deliberately not supported: a PDF is a picture of a document, not a
  document, and every post imported from one would arrive needing repair.

Two things needed saying about how this behaves:

- **Nothing about a creator is readable by a browser.** Every figure comes
  through one server function that re-checks who is asking. There is no key in
  the app that can read another creator's business.
- **The media library grants no standing permission to upload.** Uploading
  asks the server for permission to put one file at one path it does not get
  to choose, and that permission expires. Tested: a signed-in session holding
  the admin role still cannot write to the bucket directly.

### The platform and app redesign  ·  in progress, this is the big one

You approved the design on 20 August: labelled sidebar, royal blue on true
black and crystal white, one gradient hero per screen, glass controls with no
borders, short lists with View all, simple words. The mockups live in
`deploy/platform-redesign-mockups.html`.

- **Phase 1, the shell: done and live.** The labelled sidebar with the
  wordmark, groups, Reminders badge, Light and Dark switch and your profile
  card; it collapses to the icon rail and remembers your choice. New colours
  everywhere. The old blue and pink background wash is gone from dark mode.
- **Phase 2, Home: done and live.** Four metric tiles, one blue card, a real
  six month chart, Reminders, and a proper deals table. Six rows, then View
  all. The phone got the same treatment early, so the first deal is visible
  without scrolling.
- **Phase 3, the other screens: done and live.** Money has the metric strip,
  one magenta card, the dotted payment calendar and a To be paid table.
  Brands ranks who actually paid you and lists everyone in a table. Work caps
  each year at six pieces. And there is a new **Deals** page, reached from the
  sidebar or any View all, with search and filters over all 34 deals.
- **Phase 4, the phone: done and live.** The bottom bar now matches the
  screenshot you sent: five labelled icons, the active one in bold, sitting
  flush against the bottom of the screen. Money on a phone got the same
  rebuild as desktop, calendar included. Brands shows four figures in a
  square instead of three with an odd one out.

The redesign is finished. Every screen, both themes, phone and desktop.

### Website

- **The blog is live**, at `blubanana.in/blog`, with five articles: advance
  tax, chasing a late brand, GST registration, TDS, and how to price a reel.
  Each one ends at the matching calculator. New posts get added to
  `website/src/content/blog.mjs`.
- ~~Retest the drawn interface against the real platform~~ **Done, 22 August.
  The drawing stays.** Compared side by side at phone width. The real screen is
  denser: at the size the marketing page shows it, the reminders list and the
  deals table read as texture rather than as information, where the drawing
  reads instantly. The drawing also costs nothing to maintain, and a real
  screenshot would need retaking after every change to the app, which is the
  sort of upkeep that quietly stops happening and leaves a marketing page
  showing a version of the product that no longer exists.
- ~~The www redirect is the wrong way round~~ **Fixed, 21 August.**
  `www.blubanana.in` now redirects to `blubanana.in`, which is what every
  page's canonical tag already claimed.

### Product

- **YouTube is live, 21 August.** Connected end to end against the real API,
  with the refresh token stored, which is the piece that keeps the nightly
  sync alive beyond the first hour. Only the Google verification in section 4
  is outstanding.
- **Instagram is still sample data**, deliberately, and the app says so by
  name. It needs the same two secrets YouTube now has, whenever you want it;
  the server functions it depends on are already deployed.

### Deleting things  ·  done, 21 August

Deals, invoices and brands can all be deleted now, each from the three dot
menu rather than a button sitting next to Save. A deal takes its payments,
deliverables and stages with it and says so first; a brand with deals still
pointing at it is refused rather than silently orphaning them.

This section used to say none of that existed. It does.

### Admin hardening, deliberately deferred

Set aside on 21 August while planning the admin dashboard. Neither blocks
anything; both are worth revisiting once there are real customers.

- **A sooner re-authentication on admin screens.** Supabase has one session
  length for the whole project, so making admin shorter would log creators out
  too. It has to be built into the admin area instead.
- **Leaked-password checking.** Refused on the free tier: "available on Pro
  Plans and up". It rejects passwords that have appeared in known breaches.

What is carrying the weight in the meantime is **2FA on the admin account**,
which is already available and needs enrolling.

### Before launch, not code

- **A lawyer should read the terms, the privacy policy and the refund terms.**
  They are written from what the software actually does. Accurate is not the
  same as sufficient.
- **App store listings.** Icons, screenshots, descriptions and a privacy
  declaration for both stores.

---

## What is already done

Both sites are live: `blubanana.in` and `platform.blubanana.in`, with the real
contact details, live pricing from the database, and the mail address working.
The app itself is built: deals, deadlines, reminders, payments, GST invoices,
tax, the rate card, expenses, team permissions, export, account deletion,
offline capture, and the subscription plumbing. The redesign now underway is
about how it looks and fits, not what it does.
