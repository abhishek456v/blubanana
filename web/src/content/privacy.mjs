// The privacy policy.
//
// Written from what the code actually does, not from a template. Every
// processor named below appears in this repository; the retention and deletion
// claims match the `delete-account` edge function and migration 028, including
// the six-year invoice exception migration 036's billing tables rely on.
//
// That matters beyond tidiness: CreatorDesk stores brand contacts' names and
// phone numbers, which is third-party personal data, which makes the business a
// Data Fiduciary under the DPDP Act 2023. A policy that describes a different
// product is not a smaller problem than no policy.

import { COMPANY, PRICING, SITE } from '../site.mjs'
import { closingCta } from '../ui.mjs'

const body = `<section class="legal">
  <div class="container prose">
    <h1 style="font-size:clamp(32px,5vw,48px)">Privacy policy</h1>
    <p class="updated" style="margin-top:14px">Last updated 19 August 2026</p>

    <p style="margin-top:26px">
      CreatorDesk provides software that helps content creators manage brand collaborations. This
      policy explains what we collect, why, who it goes to, and what you can require of us. It is
      written to India’s Digital Personal Data Protection Act, 2023.
    </p>

    <h2>Who is responsible</h2>
    <p>
      ${COMPANY.legalName} is the Data Fiduciary for the personal data described here. Questions,
      requests and complaints: <a href="mailto:${COMPANY.email}">${COMPANY.email}</a>.
    </p>

    <h2>What we collect, and why</h2>
    <ul>
      <li><strong>Your account</strong> — name, email address, phone number. To create your workspace, sign you in, and contact you about your account.</li>
      <li><strong>Your business details</strong> — niche, follower count, GSTIN, address, UPI ID and bank account details. Used to produce your invoices and your tax figures. We never initiate a payment to or from these.</li>
      <li><strong>Your work</strong> — brand deals, rates, deadlines, payments, invoices, expenses and the notes you write.</li>
      <li><strong>Contacts at brands you work with</strong> — names, phone numbers and email addresses you record. This is personal data about other people, and we process it only to provide the service to you.</li>
      <li><strong>Files you upload</strong> — contracts, briefs, screenshots and profile photographs.</li>
      <li><strong>Device tokens</strong> — so reminders can reach your phone.</li>
      <li><strong>Social account data</strong> — only if you connect Instagram: your handle, your follower and engagement figures, and view counts on posts you have linked to a deal.</li>
    </ul>

    <h2>What we do not do</h2>
    <ul>
      <li>We do not sell your data, and we do not share it for anyone else’s advertising.</li>
      <li>We do not use your deals, rates or contacts to train AI models.</li>
      <li>We never touch money moving between you and a brand. An invoice and its UPI QR are documents; the payment goes directly into your account.</li>
      <li>We cannot see your card or UPI credentials when you pay us. Those go to our payment gateway and never reach our servers.</li>
    </ul>

    <h2>Who processes it for us</h2>
    <ul>
      <li><strong>Supabase</strong> — database, authentication and file storage.</li>
      <li><strong>OpenAI</strong> — reading a screenshot or voice note you choose to submit, and suggesting a rate for a format you have never sold. Only the content of that specific request is sent.</li>
      <li><strong>Razorpay</strong> — collecting your subscription payment.</li>
      <li><strong>Expo</strong> — delivering push notifications to your device.</li>
      <li><strong>Meta</strong> — only if you connect Instagram, and only to read your own figures.</li>
    </ul>

    <h2>How long we keep it</h2>
    <p>
      For as long as your account exists. When you delete your account, your workspace and
      everything in it is permanently deleted, including uploaded files. This is a real deletion
      path rather than a deactivation flag.
    </p>
    <p>
      One exception: the tax invoices we issue <em>to you</em> for your subscription are retained
      for six years, as Indian GST law requires. Those carry your name and GSTIN and nothing else
      about your work.
    </p>

    <h2>Your rights</h2>
    <ul>
      <li><strong>Access and portability</strong> — Settings → Export my data gives you everything as CSV and JSON, at any time. This works even after a plan has ended.</li>
      <li><strong>Correction</strong> — every field is editable in the app.</li>
      <li><strong>Erasure</strong> — Settings → Delete my account. Or write to us and we will do it.</li>
      <li><strong>Grievance</strong> — write to <a href="mailto:${COMPANY.email}">${COMPANY.email}</a> with “Grievance” in the subject.</li>
    </ul>

    <h2>Children</h2>
    <p>
      CreatorDesk is not intended for anyone under 18, and we do not knowingly create accounts for
      children.
    </p>

    <h2>Security</h2>
    <p>
      Every workspace is isolated at the database level, not by application code: one creator’s
      deals, rates and contacts are unreachable from another account even through a direct API
      call. Where you invite a manager, the limits you set on what they can see are enforced the
      same way — a withheld rate is not hidden on screen, it is never sent.
    </p>

    <h2>Changes</h2>
    <p>
      If this policy changes in a way that affects you, we will tell you by email before it takes
      effect. The date at the top always reflects the current version.
    </p>

    <h2>Contact</h2>
    <p>
      ${COMPANY.legalName} · ${COMPANY.address}<br>
      <a href="mailto:${COMPANY.email}">${COMPANY.email}</a> · ${COMPANY.phone}
    </p>
  </div>
</section>`

export default {
  path: '/privacy',
  title: 'Privacy policy — CreatorDesk',
  description:
    'What CreatorDesk collects, why, who processes it, how long it is kept, and how to export or delete everything. Written to India’s DPDP Act, 2023.',
  body: [
    body,
    closingCta({ title: 'Your data stays yours.', sub: `Export all of it whenever you like, on every plan and after one ends.`, href: SITE.signup }),
  ].join('\n'),
}
