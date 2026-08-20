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

  /* ── theme ─────────────────────────────────────────────────────────────── */
  // Three states, not two. No stored preference means "follow the operating
  // system", and the toggle has to be able to return to whichever of light or
  // dark the system is not currently showing.
  const root = document.documentElement
  document.querySelectorAll('.theme-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const current = root.getAttribute('data-theme') || (systemDark ? 'dark' : 'light')
      const next = current === 'dark' ? 'light' : 'dark'
      root.setAttribute('data-theme', next)
      try {
        localStorage.setItem('cd-theme', next)
      } catch (e) {}
    })
  })

  /* ── menus ─────────────────────────────────────────────────────────────── */
  // Hover opens them on a mouse (CSS). A touch device has no hover, so the
  // trigger is also a real button that toggles a class.
  // Hover opens the menus on a pointer device, which CSS handles alone. On a
  // touch screen there is no hover, so the first tap opens the menu and the
  // second follows the link.
  const coarse = window.matchMedia('(hover: none)').matches
  if (coarse) {
    document.querySelectorAll('.nav-item > .nav-link').forEach((link) => {
      const item = link.parentElement
      link.addEventListener('click', (event) => {
        if (item.classList.contains('open')) return
        event.preventDefault()
        document.querySelectorAll('.nav-item.open').forEach((other) => other.classList.remove('open'))
        item.classList.add('open')
      })
    })
    document.addEventListener('click', (event) => {
      if (event.target.closest('.nav-item')) return
      document.querySelectorAll('.nav-item.open').forEach((item) => item.classList.remove('open'))
    })
  }

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
  document.querySelectorAll('.tabs').forEach((list) => {
    const tabs = [...list.querySelectorAll('.tab')]
    const panels = tabs.map((tab) => document.getElementById(tab.getAttribute('aria-controls')))

    const frame = list.dataset.frame ? document.querySelector(`[data-demo="${list.dataset.frame}"]`) : null

    const show = (index) => {
      tabs.forEach((tab, i) => tab.setAttribute('aria-selected', String(i === index)))
      panels.forEach((panel, i) => panel.toggleAttribute('data-active', i === index))
      const screen = tabs[index]?.dataset.screenGo
      if (frame && screen && frame.goTo) frame.goTo(screen)
    }

    tabs.forEach((tab, index) => tab.addEventListener('click', () => show(index)))

    // A menu item points at a panel, not at a heading, so arriving with a hash
    // has to open that tab as well as scroll to it. Otherwise every Product
    // menu item lands on the same visible panel and the menu looks broken.
    const openFromHash = () => {
      const id = location.hash.slice(1)
      const index = panels.findIndex((panel) => panel && panel.id === id)
      if (index < 0) return
      show(index)
      list.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    window.addEventListener('hashchange', openFromHash)
    openFromHash()
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

  /* ── the walkable demo ─────────────────────────────────────────────────── */
  /*
   * Every screen is already in the page; this only decides which one is shown.
   * No routing, no history, no network. A visitor can open a deal, raise an
   * invoice and come back, and nothing they do here can fail or be submitted.
   */
  document.querySelectorAll('[data-demo]').forEach((frame) => {
    const screens = [...frame.querySelectorAll('[data-screen]')]
    const rail = [...frame.querySelectorAll(".side-btn")]

    const go = (name) => {
      const target = screens.find((s) => s.dataset.screen === name)
      if (!target) return
      screens.forEach((s) => (s.hidden = s !== target))
      // The rail follows where you are, and a screen it does not list leaves
      // the last one lit rather than lighting nothing.
      const railed = rail.find((b) => b.dataset.go === name)
      if (railed) rail.forEach((b) => b.classList.toggle('on', b === railed))
      frame.dispatchEvent(new CustomEvent('demo:go', { detail: name }))
    }

    // The four ways of starting a deal. They were decoration; a visitor clicked
    // Voice and nothing happened, which says the opposite of what the section
    // is claiming. Each one now switches the screen to that mode.
    const SOURCES = {
      screenshot: ['Read from the screenshot', 'Found'],
      voice: ['Heard in your voice note', 'Transcribed'],
      type: ['Typed in by you', 'Yours'],
      repeat: ['Copied from your last deal with them', 'Reused'],
    }

    frame.addEventListener('click', (event) => {
      const mode = event.target.closest('[data-mode]')
      if (mode && frame.contains(mode)) {
        const group = mode.parentElement
        group.querySelectorAll('[data-mode]').forEach((chip) => chip.classList.toggle('chip-blue', chip === mode))
        const [line, found] = SOURCES[mode.dataset.mode] ?? []
        const screen = mode.closest('[data-screen]')
        if (line) screen.querySelector('[data-source]').textContent = line
        if (found) screen.querySelector('[data-found]').textContent = found
        return
      }

      const hit = event.target.closest('[data-go]')
      if (!hit || !frame.contains(hit)) return
      event.preventDefault()

      // Opening a specific deal carries that row's brand into the detail screen,
      // so tapping the third row does not show the first one's name.
      if (hit.dataset.deal) {
        const source = hit
        const detail = frame.querySelector('[data-screen="deal"]')
        const name = source.querySelector('.t')?.textContent
        const work = source.querySelector('.m')?.textContent
        const amount = source.querySelector('.amt')?.textContent
        const avatar = source.querySelector('.bavatar')
        if (detail && name) {
          detail.querySelector('[data-deal-name]').textContent = name
          detail.querySelector('[data-deal-work]').textContent = (work || '').split(' · ')[0]
          detail.querySelector('[data-deal-amount]').textContent = amount
          const target = detail.querySelector('[data-deal-avatar]')
          target.textContent = avatar.textContent
          target.style.background = avatar.style.background
        }
      }

      go(hit.dataset.go)
    })

    frame.dataset.go = ''
    frame.goTo = go
  })

  /* ── the plan selector ─────────────────────────────────────────────────── */
  document.querySelectorAll('[data-plan]').forEach((card) => {
    let terms
    try {
      terms = JSON.parse(card.getAttribute('data-plan'))
    } catch (e) {
      return
    }
    const pills = [...card.querySelectorAll('.term-pill')]
    const set = (el, value) => card.querySelectorAll(el).forEach((n) => (n.textContent = value))

    const show = (index) => {
      const term = terms[index]
      pills.forEach((pill, i) => pill.setAttribute('aria-pressed', String(i === index)))
      set('[data-plan-total]', term.total)
      set('[data-plan-list]', term.list)
      set('[data-plan-permonth]', term.perMonth)
      set('[data-plan-gst]', term.withGst)
      set('[data-plan-save]', term.save > 0 ? 'Save ' + term.save + '%' : '')
      // Said here rather than in a footnote. The price someone starts on holds
      // for the term they bought, and the renewal is the thing they will
      // otherwise discover on the day it is charged.
      set(
        '[data-plan-renew]',
        'Locked for ' + (term.months === 1 ? 'the month' : term.months + ' months') + '. Renews at the price current then, and your bank asks you to approve any change.'
      )
      card.querySelectorAll('[data-plan-save]').forEach((n) => (n.hidden = term.save <= 0))
    }

    pills.forEach((pill, i) => pill.addEventListener('click', () => show(i)))
    show(pills.findIndex((p) => p.getAttribute('aria-pressed') === 'true') || 0)
  })

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

    // Say how many places are left only once that number persuades rather than
    // deters. "500 of 500 left" is a true sentence that tells a visitor nobody
    // has signed up; below a fifth remaining it is the scarcity it was meant to
    // be. The offer itself is stated either way, so nothing is hidden, and the
    // cap in the database is what keeps the struck through price honest.
    const revealAt = Math.round(limit * 0.2)
    if (left !== null && left <= revealAt) {
      document.querySelectorAll('[data-seats-left]').forEach((el) => (el.textContent = String(left)))
      document.querySelectorAll('[data-seats-line]').forEach((el) => (el.hidden = false))
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
