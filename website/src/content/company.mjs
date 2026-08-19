// Security.
//
// It matters more than it sounds. It is what a manager reads before accepting
// an invitation, and what a brand's finance team reads after receiving an
// invoice with our name on it.
//
// The list of processors that used to sit here has been removed at the client's
// request. It still appears in the privacy policy, which is where the law
// requires it and where someone looking for it will go.

import { COMPANY } from '../site.mjs'
import { icon } from '../ui.mjs'

const security = {
  path: '/security',
  title: 'Security and privacy | Blubanana',
  description:
    'How Blubanana keeps a creator’s work private: workspace isolation enforced in the database, permissions that hold against the API, real deletion, and no amounts in notifications.',
  body: `
<section class="hero" style="padding-bottom:20px">
  <div class="container">
    <div class="eyebrow reveal">Security</div>
    <h1 class="reveal" style="max-width:16ch">Enforced, not promised</h1>
    <p class="lede reveal" style="max-width:54ch;margin-top:18px">
      Every limit described here is a rule in the database rather than a screen that declines to draw something.
    </p>
  </div>
</section>

<section class="band">
  <div class="container">
    <div class="grid g-2 reveal">
      <div class="card">
        <div class="icon-badge">${icon('shield')}</div>
        <h4>One workspace cannot see another</h4>
        <p>No creator can reach another creator's deals, brands, rates, contacts or earnings, and that holds against a direct request as well as against the interface.</p>
      </div>
      <div class="card">
        <div class="icon-badge">${icon('users')}</div>
        <h4>A withheld rate is never sent</h4>
        <p>When a creator hides rates from a manager, the figures are removed before the response leaves the server. There is nothing on the device to uncover.</p>
      </div>
      <div class="card">
        <div class="icon-badge">${icon('bell')}</div>
        <h4>No notification carries an amount</h4>
        <p>Lock screens are read by whoever is nearby. There is a switch to turn amounts on, and it is off until someone chooses otherwise.</p>
      </div>
      <div class="card">
        <div class="icon-badge">${icon('wallet')}</div>
        <h4>We never hold your money</h4>
        <p>Brands pay creators directly, bank to bank. Card details for a subscription go to the payment gateway and never reach our servers.</p>
      </div>
      <div class="card">
        <div class="icon-badge">${icon('doc')}</div>
        <h4>Deleting means deleting</h4>
        <p>Delete an account and the workspace and its files are removed, not flagged. The only exception is the tax invoices we are required to keep for six years.</p>
      </div>
      <div class="card">
        <div class="icon-badge">${icon('chart')}</div>
        <h4>Your data leaves whenever you want</h4>
        <p>Export everything as CSV and JSON at any time, including while an account is read only after a plan ends.</p>
      </div>
    </div>
  </div>
</section>

<section class="band">
  <div class="container prose">
    <h2>Reporting something</h2>
    <p class="lede" style="margin-top:16px">
      If you find a way to reach data that is not yours, write to
      <a href="mailto:${COMPANY.email}" style="color:var(--accent-text)">${COMPANY.email}</a>
      with "Security" in the subject. We will confirm within one working day, and we will not threaten anyone who reports something in good faith.
    </p>
  </div>
</section>`,
}

export default [security]
