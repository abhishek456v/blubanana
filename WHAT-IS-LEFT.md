# What is left

Two lists. The first is things only you can do, because they need a login, a
bank account, a legal identity or a decision. The second is building work.

Updated 19 August 2026.

---

## Your list

### 1. Four contact details  ·  blocks everything to do with money

The website will not finish building until these are real, on purpose, because a
fake phone number is exactly what fails a Razorpay check.

| What | Why it is needed |
|---|---|
| The registered legal entity name | Goes on the invoices, the terms and the footer |
| The registered address | Razorpay checks it, and the law requires it on a tax invoice |
| A phone number that is answered | **Razorpay's reviewers ring it** |
| The WhatsApp number | The contact page's main button |

Send me those four and the site builds clean the same day.

### 2. An email address that exists

The site publishes `hello@blubanana.in` on the contact page, in the terms, and in
the privacy policy as the address for data protection complaints. **There is no
mailbox behind it yet.** A complaint that bounces is a legal problem rather than
an inconvenience.

You need email hosting for `blubanana.in` (Google Workspace and Zoho Mail are the
usual choices) and then that address created.

### 3. Put the two sites online

They are two separate things and go to two separate addresses.

- **The website** goes to `blubanana.in`
- **The app** goes to `platform.blubanana.in`

The steps are in `README.md` under "Putting the platform on
platform.blubanana.in". The part nobody can do for you is the last one: adding a
DNS record needs the login for wherever you bought the domain.

### 4. Razorpay

Apply for a merchant account once the website is live with the real contact
details. When it is approved you get two keys and a webhook secret. The payment
code is already written and waiting for them.

### 5. Meta, for Instagram figures

A Meta developer account and an app, which gives an App ID and secret. The
Instagram integration is already built and switched off; those credentials are
the switch. Follower counts and cost per view start filling in on the first
night after that.

### 6. Apple, for the iPhone app

An Apple Developer account, which costs about ₹8,900 a year. Needed before the
iPhone app can be tested on a real device or submitted. Android does not need
anything equivalent to start.

### 7. Two decisions

- **Are you a creator yourself?** If so the site can say "built by a creator",
  which is worth a great deal and which I will not write unless it is true.
- **Do you want analytics?** Plausible is about ₹800 a month and needs no cookie
  banner. Google Analytics is free and does. Or nothing for now.

---

## My list

### Website, still to build

- **Eight product pages.** One per feature: logging deals, deadlines, payments,
  invoices, tax, the rate card, the team, and working offline. Right now those
  are sections of the homepage. Separate pages are how someone searching for one
  specific thing finds you.
- **Three audience pages.** For Instagram creators, for YouTube creators, and
  for managers. The same argument in each audience's own words.
- **About and Security.** Who built it and why; how the data is kept apart. The
  security page matters more than it sounds, because it is what a manager or a
  brand reads before trusting the product with a creator's money.
- **A blog.** Structure first, then articles.

### Product, still to build

- **YouTube figures.** Instagram is done and waiting for credentials. YouTube is
  a separate integration with Google rather than an afterthought to Meta's.
- **The platform interface.** You have not signed off the app's design. That is
  the largest piece of work still ahead, and until it is settled the website
  draws its own version of the interface rather than photographing yours.

### Before launch, not code

- **A lawyer should read the terms, the privacy policy and the refund terms.**
  They are written from what the software actually does, which makes them
  accurate. Accurate is not the same as sufficient.
- **App store listings.** Icons, screenshots, descriptions and a privacy
  declaration for both stores.

---

## What is already done

The app, the platform and the website are built. Deals, deadlines, reminders,
payments, GST invoices, tax, the rate card, expenses, team permissions, export,
account deletion, offline capture, and the subscription and billing plumbing.
Thirteen pages of website including five working calculators. All of it is
waiting on the list above rather than on more building.
