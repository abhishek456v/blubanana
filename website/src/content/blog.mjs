// The blog.
//
// Held back until there was something to say that a creator could not get
// elsewhere. Five posts, and each one is tied to a calculator: someone
// searching "advance tax for content creators" in the week before 15 September
// has a real problem, and a page that answers it and then does the arithmetic
// is worth more than any number of posts about productivity.
//
// Posts live in the database now, and are read at build time. What is left in
// this file is two things: the page shapes, and the five original posts as a
// fallback.
//
// The fallback is not belt and braces. A static site that fetches its own
// content at build time has a new way to fail that it did not have before: a
// network blip during a deploy would publish a site with no blog on it, and
// nobody would notice until search traffic fell. If the database cannot be
// reached, the build uses these and says so, loudly, in its output.
//
// House rules the build enforces and these have to respect: no em or en
// dashes, balanced tags, one h1 per page, a description of at least 60
// characters, and a title under 65.

import { COMPANY, SITE } from '../site.mjs'
import { closingCta } from '../ui.mjs'

/**
 * Every post, newest first.
 *
 * `updated` is deliberately absent unless a post has actually been revised.
 * A "last updated" line that moves every time the site is rebuilt is the
 * oldest trick in content marketing and readers can tell.
 */
export const FALLBACK_POSTS = [
  {
    slug: 'advance-tax-for-content-creators',
    title: 'Advance tax for content creators',
    date: '2026-08-20',
    dateLabel: '20 August 2026',
    read: '6 min',
    tool: ['/tools/advance-tax-calculator', 'Work out your four dates'],
    description:
      'If you earn from brand deals, the tax office wants the money in four instalments across the year, not one payment in July. Here are the dates, the percentages and what happens if you miss them.',
    lede:
      'Salaried people never think about advance tax because their employer handles it every month. Nobody does that for you.',
    body: `
      <h2>The rule in one paragraph</h2>
      <p>
        If your total tax for the year will be more than ₹10,000 after TDS, you have to pay it in
        four instalments during the year rather than in one go when you file. This is section 211
        of the Income Tax Act, and it applies to freelance and business income, which is what
        brand deals are.
      </p>

      <h2>The four dates</h2>
      <p>
        Each is a cumulative percentage of your total expected tax for the year, not a quarter of
        it. By 15 September you should have paid 45% in total, not 45% of what is left.
      </p>
      <ul>
        <li><b>15 June:</b> 15% of the year's tax</li>
        <li><b>15 September:</b> 45% cumulative</li>
        <li><b>15 December:</b> 75% cumulative</li>
        <li><b>15 March:</b> 100%</li>
      </ul>
      <p>
        The financial year runs April to March, so 15 March is the last date for the year that
        began the previous April.
      </p>

      <h2>What counts as your income</h2>
      <p>
        What actually reached your account, minus what the work cost you. Camera gear, editing,
        props you bought for a shoot, the fee you pay an editor, software subscriptions, travel
        for a brand shoot: all of it comes off before tax is calculated. Most creators pay more
        tax than they need to because they never wrote these down.
      </p>
      <p>
        Money a brand still owes you is not income yet. Advance tax is on what has arrived.
      </p>

      <h2>TDS is already part of this</h2>
      <p>
        Most brands deduct 10% TDS under section 194J before paying you. That is not a separate
        tax, it is an advance payment of the same tax, made on your behalf. Subtract it from what
        you owe. If your brands deduct enough, you may owe no advance tax at all.
      </p>

      <h2>If you miss a date</h2>
      <p>
        Interest under sections 234B and 234C, at 1% a month on the shortfall. It is not a
        penalty and nobody comes after you, which is precisely why it is easy to ignore until it
        has been running for eight months.
      </p>

      <h2>The honest advice</h2>
      <p>
        Set aside roughly a third of every payment as it arrives, in a separate account you do
        not touch. Then the four dates are a transfer rather than a scramble. The exact rate
        depends on your slab and your deductions, and a chartered accountant is worth the fee the
        first year.
      </p>`,
  },
  {
    slug: 'when-a-brand-does-not-pay',
    title: 'When a brand does not pay',
    date: '2026-08-14',
    dateLabel: '14 August 2026',
    read: '5 min',
    tool: ['/features/payments', 'How Blubanana chases payments'],
    description:
      'A practical order of escalation for late brand payments, from the first polite nudge to a legal notice, and the paperwork worth keeping from the start so you never need the last step.',
    lede:
      'Most late payments are not refusals. They are an invoice sitting in a queue behind somebody who is on leave.',
    body: `
      <h2>Start before it is late</h2>
      <p>
        The single thing that decides how a late payment goes is whether you agreed a date in
        writing. "30 days from publish" in a DM is enough. Without a date there is nothing to be
        late against, and every conversation becomes a negotiation instead of a reminder.
      </p>

      <h2>The order that works</h2>
      <ul>
        <li>
          <b>Day 1 after the due date.</b> A short message to your usual contact. Assume nothing
          is wrong, because usually nothing is. "Hi, the invoice for the September reel was due
          yesterday. Could you check where it is?"
        </li>
        <li>
          <b>Day 7.</b> Same person, now on email rather than WhatsApp, with the invoice attached
          again. Email is what gets forwarded to accounts. A chat message cannot be.
        </li>
        <li>
          <b>Day 15.</b> Ask to be put in touch with accounts payable directly, and copy your
          contact. This is the step that resolves most of them, because you stop relaying through
          somebody whose job is not payments.
        </li>
        <li>
          <b>Day 30.</b> A formal payment reminder naming the amount, the invoice number, the due
          date and the number of days overdue. Keep it factual. This is the message a lawyer would
          quote later.
        </li>
        <li>
          <b>Day 45 and beyond.</b> A legal notice from an advocate costs a few thousand rupees
          and resolves a surprising number of cases on its own. For amounts under ₹20 lakh, small
          causes courts and consumer forums are realistic; for a single reel fee they are usually
          not worth the months.
        </li>
      </ul>

      <h2>What to keep from day one</h2>
      <p>
        The brief, the agreed fee, the agreed payment date, the deliverables as published with
        their live links, and the invoice. That is the whole file. If you have it, escalation is
        mechanical. If you do not, you spend the first week reconstructing what was agreed.
      </p>

      <h2>The one that will not pay</h2>
      <p>
        Some brands are simply bad payers, and the useful thing is knowing which before you say
        yes. Keep a private note of how long each brand took. After a year that record is worth
        more than any rate card, because it tells you which work is actually worth taking.
      </p>`,
  },
  {
    slug: 'gst-for-creators-when-to-register',
    title: 'GST for creators: when to register',
    date: '2026-08-06',
    dateLabel: '6 August 2026',
    read: '5 min',
    tool: ['/tools/gst-calculator', 'Add GST to an invoice'],
    description:
      'The turnover thresholds that force GST registration, why an agency in another state changes your invoice, and what actually goes on a compliant tax invoice as a content creator.',
    lede:
      'GST is where most creators get advice that is confidently wrong, usually from another creator.',
    body: `
      <h2>When you must register</h2>
      <p>
        For services, the threshold is ₹20 lakh of turnover in a financial year, and ₹10 lakh in
        the special category states. Turnover means everything you invoiced, not your profit.
        Cross it and registration is compulsory within 30 days.
      </p>
      <p>
        Below the threshold you may still register voluntarily. Some creators do, because larger
        brands and agencies are more comfortable with a GSTIN on the invoice.
      </p>

      <h2>The rate</h2>
      <p>
        18% on advertising and content services. It is added on top of your fee, not taken out of
        it. A ₹50,000 reel becomes ₹59,000 on the invoice, and the ₹9,000 is collected on the
        government's behalf, not earned.
      </p>

      <h2>The part that catches people out</h2>
      <p>
        Whether you charge CGST and SGST or IGST depends on where the brand is registered, not
        where you are. Same state as you: split it into CGST 9% and SGST 9%. Different state:
        one line of IGST at 18%. Get this wrong and the brand cannot claim the credit, which is
        the thing that gets an invoice sent back.
      </p>

      <h2>What has to be on the invoice</h2>
      <p>
        Rule 46 lists it: your name, address and GSTIN, a sequential invoice number, the date,
        the brand's name, address and GSTIN, the place of supply, a description of the service,
        the SAC code, the taxable value, the rate and amount of each tax, and your signature. An
        invoice missing any of these is not a tax invoice, whatever it says at the top.
      </p>

      <h2>After you register</h2>
      <p>
        Returns are monthly or quarterly depending on turnover, and they are due whether or not
        you invoiced anything that period. A nil return still has to be filed. This is the real
        cost of registering, and it is worth being sure you have crossed the threshold before you
        take it on.
      </p>`,
  },
  {
    slug: 'tds-194j-why-brands-deduct-ten-percent',
    title: 'TDS: why brands deduct 10%',
    date: '2026-07-29',
    dateLabel: '29 July 2026',
    read: '4 min',
    tool: ['/tools/tds-calculator', 'Work out what will land'],
    description:
      'Brands deduct 10% before paying you under section 194J. What that money is, how to get credit for it when you file, and how to read Form 26AS to check it actually reached the tax office.',
    lede:
      'A ₹50,000 deal pays out ₹45,000, and the missing ₹5,000 is not lost. It is already yours.',
    body: `
      <h2>What it is</h2>
      <p>
        Section 194J requires a business paying for professional or technical services to deduct
        10% and pay it to the tax office against your PAN. Content creation counts. It is not a
        fee and it is not the brand keeping anything, it is your tax paid early.
      </p>

      <h2>The threshold</h2>
      <p>
        No deduction until you cross ₹30,000 from that payer in the financial year. Cross it and
        the deduction applies to the whole amount, not just the part above the threshold.
      </p>

      <h2>Without a PAN it is 20%</h2>
      <p>
        Section 206AA. If the brand does not have your PAN on file, the rate doubles and you
        cannot claim the credit easily, because there is nothing tying the payment to you. Send
        your PAN with the first invoice, every time.
      </p>

      <h2>Getting it back</h2>
      <p>
        It is a credit against your total tax when you file. If your final liability is less than
        what was deducted across the year, the difference is refunded. Many creators in the lower
        slabs get most of it back.
      </p>

      <h2>Check it actually arrived</h2>
      <p>
        Form 26AS on the income tax portal lists every deduction made against your PAN. A brand
        can deduct and then fail to deposit, and you find out when your credit does not match your
        invoices. Check 26AS once a quarter against your own records. The Annual Information
        Statement shows the same thing in more detail.
      </p>

      <h2>Keep the certificate</h2>
      <p>
        Form 16A is the brand's proof of what they deducted, issued quarterly. Ask for it if it
        does not arrive. It is the document that settles any argument about whether a deduction
        happened.
      </p>`,
  },
  {
    slug: 'how-to-price-a-reel',
    title: 'How to price a reel',
    date: '2026-07-21',
    dateLabel: '21 July 2026',
    read: '6 min',
    tool: ['/tools/rate-calculator', 'Get a rate from your own numbers'],
    description:
      'Follower count is the worst basis for a rate and the most commonly used. A method built on views, usage rights and exclusivity instead, plus what to do when a brand says the budget is fixed.',
    lede:
      'The question is not what you are worth. It is what this particular piece of work costs to produce and what the brand is buying beyond the post itself.',
    body: `
      <h2>Start from views, not followers</h2>
      <p>
        Followers are a vanity number that a brand cannot spend. Views on your recent comparable
        posts are the thing they are buying. Take the median of your last ten posts of that
        format, not the average, because one outlier reel will flatter you into a rate you cannot
        repeat.
      </p>

      <h2>A workable starting point</h2>
      <p>
        Across Indian creator deals, rates tend to land somewhere between ₹0.50 and ₹2.00 per
        expected view, depending on the category. Finance, technology and beauty sit at the top
        because a converted viewer is worth more. Take your median view count, multiply, and you
        have a floor to negotiate from rather than a number you guessed.
      </p>

      <h2>Then charge for the things nobody counts</h2>
      <ul>
        <li>
          <b>Usage rights.</b> If the brand wants to run your content as a paid advertisement,
          that is a separate licence, priced by duration. Three months of paid usage commonly adds
          30% to 50%. Perpetual rights should cost considerably more, because you can never resell
          that work.
        </li>
        <li>
          <b>Exclusivity.</b> Agreeing not to work with competing brands for six months has a real
          cost. Price it or refuse it.
        </li>
        <li>
          <b>Revisions.</b> Two included, then charged. Without this line, a two day edit becomes
          a two week one.
        </li>
        <li>
          <b>Production.</b> A studio, a model, props, travel. These are costs, not creative fee,
          and should be listed separately so a discount conversation does not eat them.
        </li>
      </ul>

      <h2>When the budget is fixed</h2>
      <p>
        Reduce the scope, never the rate. Fewer deliverables, shorter usage, no exclusivity. A
        rate you drop once becomes your rate with that brand forever, and agencies talk to each
        other.
      </p>

      <h2>Put the number in writing first</h2>
      <p>
        Fee, deliverables, usage rights, revision count, payment date. Five lines in an email
        before you shoot anything. Almost every payment problem starts with something that was
        never agreed in writing.
      </p>`,
  },
]

/** Newest first, and the file is already in that order, but do not rely on it. */


function card(post) {
  return `<a class="post-card reveal" href="/blog/${post.slug}">
  <span class="post-meta">${post.dateLabel} · ${post.read}</span>
  <span class="post-title">${post.title}</span>
  <span class="post-line">${post.lede}</span>
  <span class="post-more">Read this</span>
</a>`
}

/**
 * Every blog page, from whatever posts it is handed.
 *
 * Takes the posts rather than reaching for them, so that the same shapes serve
 * the database and the fallback above and neither knows which it is.
 */
export function renderBlog(posts = FALLBACK_POSTS) {
  const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date))

  const index = {
  path: '/blog',
  title: 'Writing | Blubanana',
  description:
    'Practical writing on the business side of being a content creator in India: advance tax, GST, TDS, chasing late brand payments, and how to price your work.',
  body: `
<section class="hero" style="padding-bottom:0">
  <div class="container">
    <div class="eyebrow reveal">Writing</div>
    <h1 class="reveal" style="max-width:20ch">The business side, explained</h1>
    <p class="lede reveal" style="max-width:56ch;margin-top:18px">
      Tax, invoices, rates and getting paid. Written for creators in India, where most of the
      advice online is either American or wrong.
    </p>
  </div>
</section>

<section class="band" style="padding-top:48px">
  <div class="container">
    <div class="post-grid">${sorted.map(card).join('\n')}</div>
  </div>
</section>

${closingCta({
  title: 'Or let the app keep track of it.',
  sub: 'Deals, deadlines, invoices and every tax date in one place.',
  href: SITE.signup,
})}`,
}

  /** One page per post. Same bones, so a fix to the shape fixes all of them. */
  const pages = sorted.map((post, position) => {
  const next = sorted[position + 1] ?? sorted[0]
  const [toolHref, toolLabel] = post.tool

  return {
    path: `/blog/${post.slug}`,
    title: `${post.title} | Blubanana`,
    description: post.description,
    // A dated article with an author is what search engines expect of a blog,
    // and what makes it eligible to be shown as one.
    schema: [{
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      datePublished: post.date,
      description: post.description,
      author: { '@type': 'Organization', name: SITE.name },
      publisher: { '@type': 'Organization', name: COMPANY.legalName },
      mainEntityOfPage: `${SITE.origin}/blog/${post.slug}`,
    }],
    body: `
<section class="hero" style="padding-bottom:0">
  <div class="container">
    <a class="post-back reveal" href="/blog">All writing</a>
    <h1 class="reveal" style="max-width:22ch">${post.title}</h1>
    <p class="post-meta reveal" style="margin-top:14px">${post.dateLabel} · ${post.read} read</p>
    <p class="lede reveal" style="max-width:54ch;margin-top:18px">${post.lede}</p>
  </div>
</section>

<section class="band" style="padding-top:44px">
  <div class="container">
    <article class="prose reveal">${post.body}</article>

    <a class="post-tool reveal" href="${toolHref}">
      <span class="post-tool-label">Do the arithmetic</span>
      <span class="post-tool-title">${toolLabel}</span>
    </a>

    <div class="post-next reveal">
      <span class="post-meta">Read next</span>
      <a class="post-next-link" href="/blog/${next.slug}">${next.title}</a>
    </div>

    <p class="post-note reveal">
      General information, not tax or legal advice. Rules change and your situation is your own;
      a chartered accountant is worth the fee. Questions about this page can go to
      <a href="mailto:${COMPANY.email}">${COMPANY.email}</a>.
    </p>
  </div>
</section>

${closingCta({
  title: 'Stop tracking this in your head.',
  sub: 'Every deal, deadline and tax date in one place.',
  href: SITE.signup,
})}`,
  }
})

  return [index, ...pages]
}

export default renderBlog()
