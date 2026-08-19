// Contact.
//
// This page exists twice over: once for a creator who needs help, and once for
// Razorpay's activation reviewers, who check that a working phone number, a
// registered address and a support email are published. Every detail here comes
// from COMPANY in site.mjs, and the build refuses to finish while any of them is
// still a placeholder.

import { COMPANY, SITE } from '../site.mjs'
import { closingCta, head, icon, section } from '../ui.mjs'

const hero = `<section class="hero" style="padding-bottom:20px">
  <div class="container">
    <h1 class="reveal" style="max-width:11ch">Talk to a person</h1>
    <p class="lede reveal" style="max-width:50ch;margin-top:18px">
      Every message here is answered by someone who works on the product. Not a bot, and not a queue that closes itself after three days.
    </p>
  </div>
</section>`

const ways = section({
  className: 'band-sm',
  inner: `
    <div class="reach reveal">
      <a class="reach-row" href="https://wa.me/${COMPANY.whatsapp}">
        <div class="icon-badge">${icon('phone')}</div>
        <div>
          <h3>WhatsApp</h3>
          <p class="dim">The fastest way to reach us, and the one most creators use.</p>
        </div>
        <span class="reach-value">Message us <span aria-hidden="true">→</span></span>
      </a>
      <a class="reach-row" href="mailto:${COMPANY.email}">
        <div class="icon-badge">${icon('doc')}</div>
        <div>
          <h3>Email</h3>
          <p class="dim">Support, billing and privacy requests. We reply within one working day.</p>
        </div>
        <span class="reach-value">${COMPANY.email}</span>
      </a>
      <a class="reach-row" href="tel:${COMPANY.phone.replace(/\s/g, '')}">
        <div class="icon-badge">${icon('bell')}</div>
        <div>
          <h3>Phone</h3>
          <p class="dim">${COMPANY.hours}</p>
        </div>
        <span class="reach-value">${COMPANY.phone}</span>
      </a>
    </div>`,
})

const details = section({
  className: 'band-alt',
  inner: `
    <div class="split">
      <div class="reveal">
        <h2>Where we are</h2>
        <p class="lede" style="margin-top:16px">${COMPANY.legalName}</p>
        <p class="dim" style="margin-top:8px;font-size:17px;line-height:1.7">${COMPANY.address}${COMPANY.gstin ? `<br>GSTIN ${COMPANY.gstin}` : ''}</p>
      </div>
      <div class="reveal">
        <h2>Data protection</h2>
        <p class="lede" style="margin-top:16px">For anything under the Digital Personal Data Protection Act, 2023.</p>
        <p class="dim" style="margin-top:8px;font-size:17px;line-height:1.7">
          Write to <a href="mailto:${COMPANY.email}" style="color:var(--accent-text)">${COMPANY.email}</a> with
          “Grievance” in the subject and it reaches the grievance officer directly. We respond inside the period the Act sets.
        </p>
      </div>
    </div>`,
})

const self = section({
  inner: `
    ${head({ eyebrow: 'You may not need us', title: 'Three things you can do yourself', align: 'center' })}
    <div class="grid g-3 reveal" style="margin-top:40px">
      <div class="card">
        <div class="icon-badge">${icon('chart')}</div>
        <h4>Export everything</h4>
        <p>Settings, then Export my data. CSV and JSON, all of it, at any time, including while your account is read only.</p>
      </div>
      <div class="card">
        <div class="icon-badge">${icon('shield')}</div>
        <h4>Delete your account</h4>
        <p>Settings, then Delete my account. It genuinely deletes the workspace and every file in it. You do not have to ask us.</p>
      </div>
      <div class="card">
        <div class="icon-badge">${icon('wallet')}</div>
        <h4>Cancel a subscription</h4>
        <p>Settings, then Plan and billing. Cancelling stops the next renewal and you keep access to the end of the term.</p>
      </div>
    </div>`,
})

export default {
  path: '/contact',
  title: 'Contact Blubanana',
  description: `Reach Blubanana by email, phone or WhatsApp. Support hours, registered address, and the grievance officer for data protection requests under the DPDP Act, 2023.`,
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
    ways,
    details,
    self,
    closingCta({
      title: 'Or just try it.',
      sub: 'Fourteen days, no card, and nothing to uninstall if it is not for you.',
      href: SITE.signup,
    }),
  ].join('\n'),
}
