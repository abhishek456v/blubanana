# The marketing site

Static HTML and one stylesheet. No framework and no build step at deploy time —
§4 says the site is "separate and simple", and a landing page that ships a
megabyte of JavaScript to render five paragraphs is neither.

## Editing

`build-site.mjs` generates the pages so the header, footer and nav cannot drift
apart across six files. Edit it, then:

```bash
node build-site.mjs .
```

The generated `.html` files are committed, so deploying needs no toolchain at
all — point any static host at this directory.

## Before it goes live

Every placeholder lives in the `TODO` object at the top of `build-site.mjs`:

| Field | Why it matters |
|---|---|
| `email` | Support, billing and DPDP grievance address |
| `phone` | **Razorpay rejects an activation without a working number** |
| `address` | Registered address, required on the site and by Razorpay |
| `entity` | The legal entity name, as registered |
| `gstin` | Once GST registration is through |

Set them and re-run the generator.

## Razorpay activation

Razorpay will not activate a merchant account until the website carries a
Contact page with a real phone number, Pricing, Terms, Privacy, and a
Cancellation & Refunds policy. All five exist here and are linked from every
page's footer, which is where their reviewers look.

So this site is a **blocker for taking payments**, not only for marketing.

## The refund terms are a business decision

`refunds.html` currently promises a full refund within **7 days** of a payment,
and no pro-rating after that. That is a defensible default, not a researched
one — read it and change the number if you disagree. It is the one page here
that commits you to something you may not have decided.

## Legal review

These pages were written against what the application actually does: every
processor named in the privacy policy appears in this repository, and the
retention and deletion claims match `delete-account` and migration 028. That
makes them accurate. It does not make them lawyer-reviewed, and the DPDP Act and
the GST rules both carry consequences for getting the wording wrong. Have a
professional read them before launch.
