// Terms of service. Deliberately short, and deliberately clear about the three
// things this product is not — because each of those is a real expectation a
// creator could otherwise arrive with, and every one of them is a dispute
// waiting to happen if it is only implied.

import { COMPANY, PRICING, SITE } from '../site.mjs'
import { closingCta, legalPage } from '../ui.mjs'

const body = legalPage({
  title: 'Terms and conditions',
  updated: 'Last updated 19 August 2026',
  body: `<p style="margin-top:26px">
      These terms govern your use of Blubanana, provided by ${COMPANY.legalName}. By creating an
      account you agree to them.
    </p>

    <h2>What we provide</h2>
    <p>
      Software for managing brand collaborations: recording deals, tracking deadlines, generating
      invoices, chasing payments and calculating tax figures from what you enter.
    </p>

    <h2>What we are not</h2>
    <ul>
      <li><strong>We are not your accountant.</strong> Tax figures are calculated from what you enter. They are a starting point for you and your CA, not filed advice.</li>
      <li><strong>We are not a payment processor for your deals.</strong> Money moves directly between you and the brand. We never hold it, and we never take a share of it.</li>
      <li><strong>We are not a party to your brand agreements.</strong> Invoices and messages the app helps you produce are yours, sent under your name.</li>
    </ul>

    <h2>Your account</h2>
    <p>
      You are responsible for keeping your login secure and for what is done through it. You may
      invite up to ${PRICING.seats} people into your workspace; what they do there is your
      responsibility.
    </p>

    <h2>Your data is yours</h2>
    <p>
      You keep every right to what you enter. We claim no ownership over your deals, rates,
      contacts or files, and you can export all of it at any time.
    </p>

    <h2>Acceptable use</h2>
    <p>
      Do not use Blubanana to break the law, to message people who have not agreed to hear from
      you, or to store data about others that you have no right to hold. Do not attempt to reach
      another workspace.
    </p>

    <h2>Payment</h2>
    <p>
      Subscriptions are billed in advance for the term you choose, plus GST. The price you pay is
      fixed for that term; renewal takes the price current at that time, and a change in the amount
      requires you to approve a new mandate. See <a href="/pricing">Pricing</a> and
      <a href="/refunds">Cancellation &amp; refunds</a>.
    </p>

    <h2>Availability</h2>
    <p>
      We work to keep the service running and will give notice of planned downtime where we can,
      but we do not guarantee uninterrupted availability. Reminders depend on your device, your
      operating system and your network, and we cannot guarantee the delivery of any individual
      notification.
    </p>

    <h2>Ending it</h2>
    <p>
      You may cancel at any time. We may suspend or end an account that breaches these terms; where
      we do, you will still be able to export your data.
    </p>

    <h2>Liability</h2>
    <p>
      To the extent the law allows, our total liability is limited to what you paid us in the
      twelve months before the claim. We are not liable for missed deadlines, unpaid invoices or
      tax positions taken on the basis of figures in the app. Those remain your decisions.
    </p>

    <h2>Governing law</h2>
    <p>
      These terms are governed by the laws of India, and the courts at our registered location have
      exclusive jurisdiction.
    </p>

    <h2>Contact</h2>
    <p><a href="mailto:${COMPANY.email}">${COMPANY.email}</a> · ${COMPANY.phone}</p>`,
})

export default {
  path: '/terms',
  title: 'Terms and conditions | Blubanana',
  description:
    'The terms of using Blubanana: what the service provides, what it deliberately is not, how billing works, and where liability sits.',
  body: [body, closingCta({ title: 'Start when you are ready.', sub: 'Fourteen days free, and no card to cancel.', href: SITE.signup })].join('\n'),
}
