// Cancellation and refunds.
//
// One of the five pages Razorpay checks before activating a merchant account,
// and the only one that commits the business to something. The window is 30
// days, chosen rather than defaulted: it is long enough to cover a creator who
// subscribes in a quiet month and does not touch it until the next campaign,
// which is the honest failure case for a product bought in advance.

import { COMPANY, PRICING, SITE } from '../site.mjs'
import { closingCta, legalPage } from '../ui.mjs'

const body = legalPage({
  title: 'Cancellation and refunds',
  updated: 'Last updated 19 August 2026',
  body: `<h2>The trial comes first</h2>
    <p>
      Every account starts with ${PRICING.trialDays} days free and no card. The trial exists so
      that nobody has to pay to find out whether Blubanana suits them. You can create
      ${PRICING.trialDeals} deals in that time; everything else is unlimited.
    </p>

    <h2>Cancelling</h2>
    <p>
      Cancel at any time from Settings → Plan and billing, or by writing to
      <a href="mailto:${COMPANY.email}">${COMPANY.email}</a>. There is no retention call and no
      form to argue with.
    </p>
    <p>
      Cancelling stops the next renewal. You keep full access until the end of the term you have
      already paid for.
    </p>

    <h2>Refunds. 30 days, money back</h2>
    <p>
      <strong>If you cancel within 30 days of a payment, we refund that payment in full.</strong>
      We will not ask how much you used it, and there is no condition about “meaningful use”.
    </p>
    <p>
      After 30 days, payments for the current term are not refunded, because the term has been
      provided. We do not pro-rate a part-used term.
    </p>
    <p>
      Two things sit outside that window entirely. If we charged you in error, or the service was
      unavailable for a prolonged period through our fault, write to us and we will put it right,
      whenever it happened.
    </p>

    <h2>How a refund reaches you</h2>
    <p>
      Approved refunds go back to the original payment method within 5 to 7 working days of
      approval. How long it then takes to appear depends on your bank or card issuer, which is
      outside our control.
    </p>
    <p>
      GST charged on a refunded payment is refunded with it.
    </p>

    <h2>After your plan ends</h2>
    <p>
      Your workspace becomes read only. Everything you entered stays visible and exportable for as
      long as your account exists. We do not delete your records or lock you out of them because a
      plan lapsed. Deadline and payment reminders continue for a further 30 days before they stop.
    </p>
    <p>
      Subscribing again restores everything exactly as it was.
    </p>

    <h2>Questions</h2>
    <p>
      <a href="mailto:${COMPANY.email}">${COMPANY.email}</a> · ${COMPANY.phone} · ${COMPANY.hours}
    </p>`,
})

export default {
  path: '/refunds',
  title: 'Cancellation and refunds | Blubanana',
  description:
    'Cancel any time, and get a full refund within 30 days of a payment. How cancellation works, what happens to your data afterwards, and how long a refund takes to reach you.',
  body: [body, closingCta({ title: 'Fourteen days free, first.', sub: 'No card, so there is nothing to refund.', href: SITE.signup })].join('\n'),
}
