// The data every interface on this site is drawn with.
//
// One file, because the rule about it is absolute and has to be checkable in
// one place: **no real person appears anywhere on this site.**
//
// The creator is Preeti Nainwal, who does not exist. Her phone number is
// 9876543210, the digits in descending order, which is unmistakably invented to
// anyone who looks twice. Her PAN, GSTIN, bank account and UPI handle follow the
// same pattern: the shape is right so the interface reads as real, and the
// content is obviously not anyone's.
//
// Brand names are real, at the client's decision. Worth knowing what that
// means: a brand's mark on a marketing page can be read as an endorsement, and
// none of these companies have agreed to anything. Keeping each one to a single
// appearance, in an obviously illustrative interface, is what keeps it a
// depiction of the product rather than a claim about a customer.

/** One fixed date everywhere, so nothing on the site looks stale or invented
 *  at a glance. */
export const TODAY = '1st January, 2026'

export const CREATOR = {
  name: 'Preeti Nainwal',
  initials: 'PN',
  handle: '@preetinainwal',
  niche: 'Lifestyle and travel',
  followers: '1.8L',
  phone: '+91 98765 43210',
  email: 'preeti@blubanana.in',
  city: 'Indiranagar, Bengaluru 560038',
  pan: 'ABCDE1234F',
  gstin: '29ABCDE1234F1Z5',
  account: '9876 5432 1098',
  ifsc: 'HDFC0001234',
  upi: 'preeti.nainwal@upi',
}

/** Colour by position, not by name, so no brand gets a "brand colour" implied. */
export const TINTS = ['#3B6EF6', '#7C5CF0', '#0F9D63', '#E08A17', '#E2557A', '#2AA9C9']

export const brand = (name, i) => ({
  name,
  initials: name.replace(/[^A-Za-z ]/g, '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
  tint: TINTS[i % TINTS.length],
})

/** Each brand appears once across the whole site. */
export const DEALS = [
  { ...brand('Nykaa', 0), work: 'Reel and 3 Stories', amount: '₹45,000', state: 'Publish due in 2 days', chip: ['Live', 'blue'] },
  { ...brand('boAt', 1), work: '1 Reel', amount: '₹35,500', state: 'Payment 6 days late', chip: ['Overdue', 'rose'] },
  { ...brand('Mamaearth', 2), work: 'Feed post and 2 Stories', amount: '₹28,000', state: 'Edit due tomorrow', chip: ['Active', 'amber'] },
  { ...brand('Zomato', 3), work: 'YouTube integration', amount: '₹1,20,000', state: 'Paid in full', chip: ['Paid', 'green'] },
]

export const MONEY = {
  owed: '₹3,75,000',
  owedNote: 'Across 11 unpaid deals',
  received: '₹65,500',
  receivedNote: '3 payments this month',
  live: '11',
  liveNote: 'Deals in progress',
  collection: '92%',
}

export const INVOICE = {
  number: 'INV-014',
  date: '1 January 2026',
  billedTo: 'Lenskart',
  contact: 'Accounts payable',
  gstin: '06AABCL4567T1Z6',
  line: 'Reel and 3 Stories, as agreed',
  hsn: '998397',
  amount: '₹60,000',
  gst: '₹10,800',
  total: '₹70,800',
  tds: '₹6,000',
  due: '₹64,800',
}

export const RATES = [
  ['Reel', '₹45,000', 84],
  ['Story set', '₹14,000', 32],
  ['Carousel', '₹29,000', 56],
  ['YouTube Short', '₹36,500', 66],
  ['YouTube integration', '₹78,000', 96],
]

export const REMINDERS = [
  ['bell', 'accent', 'Shoot is due tomorrow', 'Sugar Cosmetics'],
  ['wallet', 'rose', 'A payment is overdue', 'Tap to send a follow up'],
  ['calendar', 'green', 'Advance tax due 15 September', 'Set aside before the date'],
  ['refresh', 'accent', 'Saved without signal', 'It will sync on its own'],
]
