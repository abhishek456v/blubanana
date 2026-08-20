# What is left

Two lists. The first is things only you can do, because they need a login, a
bank account, a legal identity or a decision. The second is building work.

Updated 20 August 2026, evening.

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

### 5. Two clicks: make blubanana.in the main address

Right now `blubanana.in` sends visitors to `www.blubanana.in`, while every
page tells search engines the real address is `blubanana.in`. Those two
disagree, which splits your search ranking between the two names.

In Vercel, open the **website** project, then **Settings**, then **Domains**.
You will see both names listed. Set `www.blubanana.in` to redirect to
`blubanana.in`, so it points the other way round. Tell me when it is done and
I will confirm it from the outside.

### 6. Two dates I am holding for you

- **After 27 August:** I will ask you to confirm the address, phone, WhatsApp
  and legal name once more, as you asked.
- **Before launch:** a hosting decision. Vercel's free plan does not allow
  commercial use, so before real users pay, the sites move to a paid plan or
  another host. This is a ten minute change when the time comes.

---

## My list

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
- **Retest the drawn interface** on the website against the real redesigned
  platform; the drawn version stays unless the real one photographs better.
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
