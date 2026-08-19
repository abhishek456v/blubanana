// About and Security.
//
// The About page is deliberately careful about one thing: it does not claim the
// product was built by a creator, because it was not. A business person built
// it with a creator's help, and saying that plainly is both true and more
// credible than the version everyone writes.
//
// The Security page matters more than it sounds. It is what a manager reads
// before accepting an invitation, and what a brand's finance team reads after
// receiving an invoice with our name on it.

import { COMPANY, PRICING, SITE } from '../site.mjs'
import { closingCta, head, icon, section } from '../ui.mjs'

const about = {
  path: '/about',
  title: 'About Blubanana',
  description:
    'Why Blubanana exists: built in India for Indian creators, by someone who runs businesses, with a creator working out where the money actually goes missing.',
  body: `
<section class="hero" style="padding-bottom:20px">
  <div class="container">
    <div class="eyebrow reveal">About</div>
    <h1 class="reveal" style="max-width:16ch">Built with a creator, not guessed at</h1>
    <p class="lede reveal" style="max-width:54ch;margin-top:18px">
      This was not built by a creator. It was built by someone who runs businesses, with a creator working out where the money actually goes missing.
    </p>
  </div>
</section>

<section class="band">
  <div class="container">
    <div class="split">
      <div class="reveal">
        <h2 style="max-width:12ch">Why it exists</h2>
      </div>
      <div class="reveal">
        <p class="lede">A creator running eight collaborations is running a business, with invoices, deadlines, receivables and a tax year, and almost none of them are given the tools a business gets.</p>
        <p class="lede" style="margin-top:18px">The work goes into a notes app, a chat thread and memory. Then a payment is forgotten, a deadline arrives from the brand instead of the calendar, and March turns up with no idea what is owed.</p>
      </div>
    </div>
  </div>
</section>

<section class="band band-alt">
  <div class="container">
    ${head({ title: 'What we decided early', align: 'center' })}
    <div class="grid g-3 reveal" style="margin-top:40px">
      <div class="card">
        <div class="icon-badge">${icon('wallet')}</div>
        <h4>Never touch the money</h4>
        <p>Brands pay creators directly. Standing in the middle would mean a payments licence, a cut of every deal, and a different company.</p>
      </div>
      <div class="card">
        <div class="icon-badge">${icon('shield')}</div>
        <h4>Rates are private by default</h4>
        <p>What a creator charges is the most sensitive thing here. No notification shows an amount, and a hidden rate is never sent.</p>
      </div>
      <div class="card">
        <div class="icon-badge">${icon('globe')}</div>
        <h4>Built for one country properly</h4>
        <p>GST, TDS, UPI, April to March. Doing that well for India was worth more than doing it vaguely for everywhere.</p>
      </div>
    </div>
  </div>
</section>

<section class="band">
  <div class="container">
    <div class="split">
      <div class="reveal"><h2 style="max-width:12ch">Where it is</h2></div>
      <div class="reveal">
        <p class="lede">Early, and honest about it. The product is built and being used by its first creators. There is no customer count on this site because there is not yet a number worth printing, and inventing one would be the first thing we did wrong.</p>
        <p class="lede" style="margin-top:18px">The launch price is half, capped at the first ${PRICING.introSeats} creators, which is what makes the crossed out figure a fact rather than a decoration.</p>
      </div>
    </div>
  </div>
</section>

${closingCta({
  title: 'Come in early',
  sub: `${PRICING.trialDays} days free, no card, and a price that holds for the term you buy.`,
  href: SITE.subscribe,
  primary: 'Subscribe',
  secondary: [`${PRICING.trialDays} day trial`, SITE.signup],
})}`,
}

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

<section class="band band-alt">
  <div class="container">
    <div class="split">
      <div class="reveal"><h2 style="max-width:14ch">Who else touches it</h2></div>
      <div class="reveal">
        <p class="lede">Named in full, because a list of processors is the part of a privacy policy that actually tells you something.</p>
        <ul class="includes" style="margin-top:22px">
          <li><span class="tick">${icon('check', { size: 15, stroke: 2.4 })}</span> <b>Supabase</b> for the database, sign in and files</li>
          <li><span class="tick">${icon('check', { size: 15, stroke: 2.4 })}</span> <b>OpenAI</b> only for a screenshot or voice note you choose to submit</li>
          <li><span class="tick">${icon('check', { size: 15, stroke: 2.4 })}</span> <b>Razorpay</b> only for your subscription payment</li>
          <li><span class="tick">${icon('check', { size: 15, stroke: 2.4 })}</span> <b>Expo</b> to deliver notifications to your device</li>
          <li><span class="tick">${icon('check', { size: 15, stroke: 2.4 })}</span> <b>Meta</b> only if you connect Instagram, and only to read your own figures</li>
        </ul>
        <p class="lede" style="margin-top:22px">Your deals, rates and contacts are never used to train models, and never sold.</p>
        <a class="link-arrow" href="/privacy" style="margin-top:18px">Read the privacy policy</a>
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

export default [about, security]
