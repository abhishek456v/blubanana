/*
 * The site's only JavaScript. It is allowed to do four things:
 *
 *   1. open menus            2. switch tabs
 *   3. reveal sections       4. read the live price out of the database
 *
 * Everything else on this site is HTML and CSS, and every one of these is an
 * enhancement — with JavaScript disabled the menus are gone but every link
 * still works, the first tab is simply the one shown, and the prices are the
 * build-time figures, which are correct.
 */
;(() => {
  'use strict'

  /* ── menus ─────────────────────────────────────────────────────────────── */
  // Hover opens them on a mouse (CSS). A touch device has no hover, so the
  // trigger is also a real button that toggles a class.
  document.querySelectorAll('.nav-item > button').forEach((button) => {
    const item = button.parentElement
    button.addEventListener('click', (event) => {
      event.preventDefault()
      const open = item.classList.toggle('open')
      button.setAttribute('aria-expanded', String(open))
      document.querySelectorAll('.nav-item.open').forEach((other) => {
        if (other !== item) {
          other.classList.remove('open')
          other.querySelector('button')?.setAttribute('aria-expanded', 'false')
        }
      })
    })
  })

  document.addEventListener('click', (event) => {
    if (event.target.closest('.nav-item')) return
    document.querySelectorAll('.nav-item.open').forEach((item) => {
      item.classList.remove('open')
      item.querySelector('button')?.setAttribute('aria-expanded', 'false')
    })
  })

  const sheet = document.getElementById('sheet')
  document.querySelectorAll('.burger').forEach((burger) => {
    burger.addEventListener('click', () => {
      const open = sheet.classList.toggle('open')
      document.body.style.overflow = open ? 'hidden' : ''
    })
  })
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    sheet?.classList.remove('open')
    document.body.style.overflow = ''
  })

  /* ── tabs ──────────────────────────────────────────────────────────────── */
  document.querySelectorAll('[data-tabs]').forEach((list) => {
    const tabs = [...list.querySelectorAll('.tab')]
    const panels = tabs.map((tab) => document.getElementById(tab.getAttribute('aria-controls')))

    const show = (index) => {
      tabs.forEach((tab, i) => tab.setAttribute('aria-selected', String(i === index)))
      panels.forEach((panel, i) => panel.toggleAttribute('data-active', i === index))
    }

    tabs.forEach((tab, index) => tab.addEventListener('click', () => show(index)))
    // Arrow keys, because a tablist that only takes clicks is not a tablist.
    list.addEventListener('keydown', (event) => {
      const current = tabs.indexOf(document.activeElement)
      if (current < 0) return
      const next = event.key === 'ArrowRight' ? current + 1 : event.key === 'ArrowLeft' ? current - 1 : null
      if (next === null) return
      event.preventDefault()
      const target = tabs[(next + tabs.length) % tabs.length]
      target.focus()
      show(tabs.indexOf(target))
    })
  })

  /* ── reveal ────────────────────────────────────────────────────────────── */
  const reveals = document.querySelectorAll('.reveal')
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('in')
          observer.unobserve(entry.target)
        })
      },
      { rootMargin: '0px 0px -8% 0px' }
    )
    reveals.forEach((element) => observer.observe(element))
  } else {
    reveals.forEach((element) => element.classList.add('in'))
  }

  /* ── live pricing ──────────────────────────────────────────────────────── */
  /*
   * Migration 035 grants `select` on `pricing` and `execute` on
   * `intro_seats_taken()` to the anonymous role, precisely so a public page can
   * ask. So the price here is not a number typed into a marketing site — it is
   * the row the app charges from, and the count of remaining launch places is
   * the count of subscriptions actually paid for.
   *
   * Everything below degrades to the figures already in the markup. A visitor
   * on a bad connection sees the build-time price, which is right; nobody ever
   * sees a blank where a price should be.
   */
  const root = document.documentElement
  const SUPABASE_URL = root.dataset.supabaseUrl
  const SUPABASE_KEY = root.dataset.supabaseKey
  const announce = document.getElementById('announce')

  const inr = (paise) => '\u20b9' + Math.round(paise / 100).toLocaleString('en-IN')

  async function ask(path, init) {
    if (!SUPABASE_URL || !SUPABASE_KEY) return null
    try {
      const response = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
        ...init,
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, ...(init?.headers ?? {}) },
      })
      return response.ok ? await response.json() : null
    } catch {
      return null
    }
  }

  ;(async () => {
    // Two independent questions, because they fail independently. The seat
    // count comes from a SECURITY DEFINER function and works whatever the
    // table policies say; the price list is an ordinary table read. Losing one
    // must not cost the other — the launch banner is the more time-sensitive of
    // the two, and it is the one that always works.
    const [rows, taken] = await Promise.all([
      ask('pricing?select=*&limit=1'),
      ask('rpc/intro_seats_taken', { method: 'POST', headers: { 'Content-Type': 'application/json' } }),
    ])

    const pricing = Array.isArray(rows) ? rows[0] : null
    const limit = pricing?.intro_customer_limit ?? Number(root.dataset.introSeats || 0)
    const sold = typeof taken === 'number' ? taken : null

    // Anything at all can be said only if the count is real. A "places left"
    // figure derived from a fallback would be a made-up scarcity claim, which
    // is precisely what the 500-seat cap exists to avoid.
    const left = sold === null ? null : Math.max(0, limit - sold)
    const introLive = left === null ? null : left > 0

    if (left !== null) {
      document.querySelectorAll('[data-seats-left]').forEach((el) => (el.textContent = String(left)))
    }

    if (pricing) {
      document.querySelectorAll('[data-price-list]').forEach((el) => (el.textContent = inr(pricing.list_monthly_paise)))
      const monthly =
        introLive === false
          ? pricing.list_monthly_paise
          : Math.floor((pricing.list_monthly_paise * (1 - pricing.intro_discount_percent / 100)) / 100) * 100
      document.querySelectorAll('[data-price-monthly]').forEach((el) => (el.textContent = inr(monthly)))
    }

    // When the offer closes, every struck-through figure and every mention of
    // the launch price removes itself. A reference price nobody is charged is a
    // fabricated anchor; this is what stops it becoming one the day it expires.
    if (introLive === false) {
      document.querySelectorAll('[data-intro-only]').forEach((el) => el.remove())
      document.querySelectorAll('[data-price-list]').forEach((el) => (el.hidden = true))
      document.querySelectorAll('[data-intro-chip]').forEach((el) => (el.hidden = true))
      return
    }

    if (introLive === true) {
      document.querySelectorAll('[data-intro-chip]').forEach((el) => (el.hidden = false))
      if (announce && sessionStorage.getItem('cd-announce') !== 'closed') announce.hidden = false
    }
  })()

  announce?.querySelector('.announce-close')?.addEventListener('click', () => {
    announce.hidden = true
    sessionStorage.setItem('cd-announce', 'closed')
  })
})()
