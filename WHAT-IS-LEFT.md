# What is left

Two lists. The first is things only you can do, because they need a login, a
bank account, a legal identity or a decision. The second is building work.

Updated 20 August 2026.

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

### 2. Put the two sites online

They are two separate things and go to two separate addresses.

- **The website** goes to `blubanana.in`
- **The app** goes to `platform.blubanana.in`

The steps are in `README.md` under "Putting the platform on
platform.blubanana.in". The part nobody can do for you is the last one: adding a
DNS record needs the login for wherever you bought the domain.

### 3. Razorpay

Apply for a merchant account once the website is live with the real contact
details. When it is approved you get two keys and a webhook secret. The payment
code is already written and waiting for them.

### 4. Meta, for Instagram figures

A Meta developer account and an app, which gives an App ID and secret. The
Instagram integration is already built and switched off; those credentials are
the switch. Follower counts and cost per view start filling in on the first
night after that.

### 5. Apple, for the iPhone app

An Apple Developer account, which costs about ₹8,900 a year. Needed before the
iPhone app can be tested on a real device or submitted. Android does not need
anything equivalent to start.

### 6. One decision left

**Do you want analytics?** Plausible is about ₹800 a month and needs no cookie
banner. Google Analytics is free and does need one. Or nothing for now.

### 7. Settled

- **Who built it.** You are not a creator; a creator is helping you find the
  real problems. The About page says exactly that, because it is true and it
  reads better than the version everyone else writes. No names are on the site.
- **The repository** is renamed to `blubanana` and this copy points at it.
- **The brand colours** are `#0A3557` in light and `#86C2F0` in dark. What sits
  on them flips with them: white on the dark navy, near black on the light blue,
  because white on `#86C2F0` measures 1.91:1 and cannot be read.
- **`hello@blubanana.in` is live.**
- **About is removed** until you have the words you want for it.

---

## My list

### Website, still to build

- **A blog.** Structure first, then articles. Held back on purpose: a blog with
  three posts and no fourth reads worse than no blog, so this is worth starting
  when there is someone to keep it going.

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
Twenty seven pages of website: eight feature pages, three audience pages,
About, Security, five working calculators, the comparison, pricing and the
legal set. All of it is
waiting on the list above rather than on more building.
