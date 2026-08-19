// Contact.
//
// This page exists twice over: once for a creator who needs help, and once for
// Razorpay's activation reviewers, who check that a working phone number, a
// registered address and a support email are published. Every detail here comes
// from COMPANY in site.mjs, and the build refuses to finish while any of them is
// still a placeholder.

import { COMPANY, SITE } from '../site.mjs'
import { closingCta, head, section } from '../ui.mjs'

const hero = `<section class="hero" style="padding-bottom:24px">
  <div class="container">
    <h1 class="reveal" style="max-width:12ch">Talk to a person.</h1>
    <p class="lede reveal" style="max-width:56ch;margin-top:22px">
      Every message here is answered by someone who works on the product. Not a bot, and not
      a ticket queue that closes itself after three days.
    </p>
  </div>
</section>`

const details = section({
  className: 'band-line',
  inner: `
    <div class="grid g-3 reveal">
      <div class="card">
        <h4>Email</h4>
        <p><a href="mailto:${COMPANY.email}" style="color:var(--accent-text)">${COMPANY.email}</a></p>
        <p class="dim">Support, billing and privacy requests. We reply within one working day.</p>
      </div>
      <div class="card">
        <h4>Phone</h4>
        <p><a href="tel:${COMPANY.phone.replace(/\s/g, '')}" style="color:var(--accent-text)">${COMPANY.phone}</a></p>
        <p class="dim">${COMPANY.hours}</p>
      </div>
      <div class="card">
        <h4>WhatsApp</h4>
        <p><a href="https://wa.me/${COMPANY.whatsapp}" style="color:var(--accent-text)">Message us</a></p>
        <p class="dim">Usually the fastest way to reach us, and the one most creators use.</p>
      </div>
    </div>

    <div class="grid g-2 reveal" style="margin-top:20px">
      <div class="card">
        <h4>Registered address</h4>
        <p class="dim">${COMPANY.legalName}<br>${COMPANY.address}${COMPANY.gstin ? `<br>GSTIN ${COMPANY.gstin}` : ''}</p>
      </div>
      <div class="card">
        <h4>Grievance officer</h4>
        <p class="dim">
          For complaints under the Digital Personal Data Protection Act, 2023, write to
          <a href="mailto:${COMPANY.email}" style="color:var(--accent-text)">${COMPANY.email}</a>
          with “Grievance” in the subject. We respond within the period the Act requires.
        </p>
      </div>
    </div>`,
})

const self = section({
  className: 'band-line',
  inner: `
    ${head({ eyebrow: 'You may not need us', title: 'Three things you can do yourself, right now' })}
    <div class="grid g-3 reveal" style="margin-top:36px">
      <div class="card">
        <h4>Export everything</h4>
        <p class="dim">Settings → Export my data. CSV and JSON, all of it, at any time, including while your account is read only.</p>
      </div>
      <div class="card">
        <h4>Delete your account</h4>
        <p class="dim">Settings → Delete my account. It genuinely deletes the workspace and every file in it. You do not have to ask us.</p>
      </div>
      <div class="card">
        <h4>Cancel a subscription</h4>
        <p class="dim">Settings → Plan and billing. Cancelling stops the next renewal; you keep access to the end of the term you paid for.</p>
      </div>
    </div>`,
})

export default {
  path: '/contact',
  title: 'Contact CreatorDesk',
  description: `Reach CreatorDesk by email, phone or WhatsApp. Support hours, registered address, and the grievance officer for data protection requests under the DPDP Act, 2023.`,
  schema: [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: COMPANY.legalName,
      url: SITE.origin,
      email: COMPANY.email,
      telephone: COMPANY.phone,
      address: { '@type': 'PostalAddress', streetAddress: COMPANY.address, addressCountry: 'IN' },
    },
  ],
  body: [
    hero,
    details,
    self,
    closingCta({
      title: 'Or just try it.',
      sub: 'Fourteen days, no card, and nothing to uninstall if it is not for you.',
      href: SITE.signup,
    }),
  ].join('\n'),
}
