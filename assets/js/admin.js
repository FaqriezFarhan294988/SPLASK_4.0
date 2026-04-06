/*=============== SPLASK ADMIN DASHBOARD ===============*/
;(function () {
  'use strict'

  const API_BASE = window.SPLASK_API_BASE_URL || 'http://localhost:3000'
  const TOKEN_KEY = 'splask_admin_token'
  const THEME_KEY = 'splask_admin_theme'
  const PAGE_SIZE = 10

  /* ---------- helpers ---------- */
  function apiUrl(path) {
    return API_BASE.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path)
  }

  function authHeaders() {
    const token = sessionStorage.getItem(TOKEN_KEY) || ''
    return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;')
  }

  function formatDate(val) {
    if (!val) return '-'
    const d = new Date(val)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleString('en-MY', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  function scoreClass(score) {
    const n = Number(score || 0)
    if (n >= 80) return 'high'
    if (n >= 50) return 'mid'
    return 'low'
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

  /* ---------- theme ---------- */
  function applyTheme(isDark) {
    document.documentElement.classList.toggle('admin-dark', isDark)
    const btn = document.getElementById('theme-toggle')
    if (btn) btn.innerHTML = isDark ? '<i class="ri-sun-line"></i>' : '<i class="ri-moon-line"></i>'
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY)
    applyTheme(saved === 'dark')
  }

  /* ---------- auth ---------- */
  function getToken() { return sessionStorage.getItem(TOKEN_KEY) }
  function setToken(t) { sessionStorage.setItem(TOKEN_KEY, t) }
  function clearToken() { sessionStorage.removeItem(TOKEN_KEY) }

  async function verifyToken(token) {
    const res = await fetch(apiUrl('/api/admin/stats'), {
      headers: { Authorization: 'Bearer ' + token }
    })
    return res.ok
  }

  /* ---------- UI switching ---------- */
  function showLoginScreen() {
    document.getElementById('admin-login').classList.remove('hidden')
    document.getElementById('admin-app').classList.add('hidden')
  }

  function showAdminApp() {
    document.getElementById('admin-login').classList.add('hidden')
    document.getElementById('admin-app').classList.remove('hidden')
  }

  /* ======================================================
     LOGIN
  ====================================================== */
  function initLogin() {
    const form = document.getElementById('login-form')
    const input = document.getElementById('login-token-input')
    const btn = document.getElementById('login-btn')
    const errEl = document.getElementById('login-error')

    if (!form) return

    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const token = input.value.trim()
      if (!token) { showLoginError(errEl, 'Please enter the admin token.'); return }

      btn.disabled = true
      btn.innerHTML = '<span class="admin-spinner"></span> Verifying...'
      errEl.innerHTML = ''

      try {
        const valid = await verifyToken(token)
        if (valid) {
          setToken(token)
          showAdminApp()
          loadDashboard()
        } else {
          showLoginError(errEl, 'Invalid admin token. Please try again.')
          input.value = ''
          input.focus()
        }
      } catch {
        showLoginError(errEl, 'Cannot connect to server. Make sure the backend is running.')
      } finally {
        btn.disabled = false
        btn.innerHTML = '<i class="ri-login-box-line"></i> Login'
      }
    })
  }

  function showLoginError(el, msg) {
    el.innerHTML = `<i class="ri-error-warning-line"></i> ${esc(msg)}`
  }

  /* ======================================================
     DASHBOARD STATE
  ====================================================== */
  let currentPage = 1
  let totalPages = 1
  let totalItems = 0
  let searchDebounce = null

  /* ======================================================
     STATS CARDS
  ====================================================== */
  async function loadStats() {
    try {
      const res = await fetch(apiUrl('/api/admin/stats'), { headers: authHeaders() })
      if (!res.ok) throw new Error('Failed to load stats')
      const { data } = await res.json()
      renderStats(data)
    } catch (err) {
      console.error('Stats error:', err)
    }
  }

  function renderStats(d) {
    setText('stat-total-websites', d.totalWebsites)
    setText('stat-total-scans', d.totalScans)
    setText('stat-avg-score', d.avgScore ? d.avgScore.toFixed(1) + '%' : '—')
    setText('stat-compliance', d.overallCompliance + '%')
    setText('stat-passed', d.passedCount)
    setText('stat-failed', d.failedScans)

    const subCompliance = document.getElementById('stat-compliance-sub')
    if (subCompliance) {
      subCompliance.innerHTML = `<span class="${d.overallCompliance >= 70 ? 'highlight' : 'highlight-warn'}">${d.passedCount} passed</span> of ${d.completedScans} completed`
    }
  }

  function setText(id, value) {
    const el = document.getElementById(id)
    if (el) el.textContent = value
  }

  /* ======================================================
     SCANS TABLE
  ====================================================== */
  async function loadScans(page = 1) {
    currentPage = page
    const search = (document.getElementById('scan-search')?.value || '').trim()
    const status = document.getElementById('scan-status-filter')?.value || ''

    showTableState('loading')

    try {
      const params = new URLSearchParams({ page, limit: PAGE_SIZE })
      if (search) params.set('search', search)
      if (status) params.set('status', status)

      const res = await fetch(apiUrl('/api/admin/scans?' + params.toString()), { headers: authHeaders() })
      if (!res.ok) {
        if (res.status === 401) { handleUnauthorized(); return }
        throw new Error('Failed to load scans')
      }

      const { data, pagination } = await res.json()
      totalPages = pagination.pages || 1
      totalItems = pagination.total || 0
      renderTable(data)
      renderPagination(pagination)
    } catch (err) {
      showTableState('error', err.message)
    }
  }

  function showTableState(state, msg = '') {
    const tbody = document.getElementById('admin-table-body')
    if (!tbody) return

    if (state === 'loading') {
      tbody.innerHTML = `<tr><td colspan="6" class="admin-state">
        <span class="admin-spinner admin-spinner--dark"></span>
        <p style="margin-top:0.75rem">Loading scans…</p></td></tr>`
    } else if (state === 'empty') {
      tbody.innerHTML = `<tr><td colspan="6" class="admin-state">
        <i class="ri-inbox-line"></i><p>No scans found.</p></td></tr>`
    } else if (state === 'error') {
      tbody.innerHTML = `<tr><td colspan="6" class="admin-state">
        <i class="ri-error-warning-line"></i><p>Error: ${esc(msg)}</p></td></tr>`
    }
  }

  function renderTable(rows) {
    const tbody = document.getElementById('admin-table-body')
    if (!tbody) return

    if (!rows || rows.length === 0) { showTableState('empty'); return }

    tbody.innerHTML = rows.map((row) => {
      const sc = Number(row.score || 0)
      const cls = scoreClass(sc)
      const statusBadgeCls = row.status === 'COMPLETED' ? 'badge--completed' : row.status === 'FAILED' ? 'badge--failed' : 'badge--processing'
      const statusIcon = row.status === 'COMPLETED' ? 'ri-checkbox-circle-fill' : row.status === 'FAILED' ? 'ri-close-circle-fill' : 'ri-loader-4-line'

      let hostname = row.url
      try { hostname = new URL(row.url).hostname.replace(/^www\./, '') } catch {}

      const canView = row.status === 'COMPLETED'

      return `<tr>
        <td style="color:var(--text-muted);font-size:0.8rem">${row.index}</td>
        <td>
          <div class="url-text">${esc(hostname)}</div>
          <div class="url-sub">${esc(row.url)}</div>
        </td>
        <td>
          <div class="score-bar-row">
            <div class="score-bar-row__bar">
              <div class="score-bar-row__fill fill-${cls}" style="width:${sc}%"></div>
            </div>
            <span class="score-pill score-pill--${cls}">${sc.toFixed(1)}%</span>
          </div>
        </td>
        <td><span class="badge ${statusBadgeCls}"><i class="${statusIcon}"></i> ${esc(row.status)}</span></td>
        <td style="font-size:0.825rem;white-space:nowrap">${formatDate(row.date)}</td>
        <td>
          <button class="admin-btn admin-btn--view admin-btn--sm" ${canView ? '' : 'disabled'}
            onclick="window.adminViewResult(${row.scanId})" title="${canView ? 'View full result' : 'Scan not completed'}">
            <i class="ri-eye-line"></i> View
          </button>
        </td>
      </tr>`
    }).join('')
  }

  function renderPagination({ total, page, pages, limit }) {
    const wrap = document.getElementById('admin-pagination')
    if (!wrap) return

    const start = total === 0 ? 0 : (page - 1) * limit + 1
    const end = Math.min(page * limit, total)

    const pageButtons = buildPageButtons(page, pages)

    wrap.innerHTML = `
      <span class="admin-pagination__info">Showing ${start}–${end} of ${total} results</span>
      <div class="admin-pagination__pages">
        <button class="admin-pagination__btn" ${page <= 1 ? 'disabled' : ''} onclick="window.adminPage(${page - 1})">
          <i class="ri-arrow-left-s-line"></i>
        </button>
        ${pageButtons}
        <button class="admin-pagination__btn" ${page >= pages ? 'disabled' : ''} onclick="window.adminPage(${page + 1})">
          <i class="ri-arrow-right-s-line"></i>
        </button>
      </div>`
  }

  function buildPageButtons(current, total) {
    if (total <= 1) return ''
    const buttons = []
    const range = []

    range.push(1)
    if (current > 3) range.push('...')
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) range.push(i)
    if (current < total - 2) range.push('...')
    if (total > 1) range.push(total)

    const seen = new Set()
    for (const p of range) {
      if (p === '...') { buttons.push('<span style="padding:0 0.25rem;color:var(--text-muted)">…</span>'); continue }
      if (seen.has(p)) continue
      seen.add(p)
      buttons.push(`<button class="admin-pagination__btn ${p === current ? 'active' : ''}" onclick="window.adminPage(${p})">${p}</button>`)
    }
    return buttons.join('')
  }

  /* ======================================================
     VIEW RESULT MODAL
  ====================================================== */
  async function openResultModal(scanId) {
    const modal = document.getElementById('result-modal')
    if (!modal) return
    modal.classList.remove('hidden')
    document.body.style.overflow = 'hidden'

    const bodyEl = document.getElementById('modal-categories')
    const urlEl = document.getElementById('modal-url')
    const metaEl = document.getElementById('modal-meta')
    const scoreEl = document.getElementById('modal-score')
    const statusEl = document.getElementById('modal-status')
    const overallScoreEl = document.getElementById('modal-overall-score')

    urlEl.textContent = 'Loading…'
    metaEl.innerHTML = ''
    bodyEl.innerHTML = `<div class="admin-state"><span class="admin-spinner admin-spinner--dark"></span><p style="margin-top:0.75rem">Fetching results…</p></div>`

    try {
      const res = await fetch(apiUrl('/api/admin/scans/' + scanId), { headers: authHeaders() })
      if (!res.ok) throw new Error('Failed to load scan detail')
      const { data } = await res.json()

      const sc = Number(data.score || 0)
      const cls = scoreClass(sc)
      let hostname = data.url
      try { hostname = new URL(data.url).hostname } catch {}

      urlEl.textContent = hostname
      metaEl.innerHTML = `
        <span><i class="ri-links-line"></i> <a href="${esc(data.url)}" target="_blank" rel="noopener noreferrer">${esc(data.url)}</a></span>
        <span><i class="ri-calendar-line"></i> ${formatDate(data.date)}</span>
        <span><i class="ri-file-list-2-line"></i> Scan #${data.scanId}</span>`

      scoreEl.textContent = sc.toFixed(1) + '%'
      scoreEl.className = 'modal-summary-cell__value score-' + cls

      statusEl.innerHTML = `<span class="badge badge--${data.status.toLowerCase()}">${esc(data.status)}</span>`

      if (overallScoreEl) {
        overallScoreEl.textContent = sc.toFixed(1) + '%'
        overallScoreEl.className = 'modal-summary-cell__value score-' + cls
      }

      renderModalCategories(data.categories || [])
    } catch (err) {
      bodyEl.innerHTML = `<div class="admin-state"><i class="ri-error-warning-line"></i><p>Error: ${esc(err.message)}</p></div>`
    }
  }

  function renderModalCategories(categories) {
    const bodyEl = document.getElementById('modal-categories')
    if (!bodyEl) return

    if (!categories.length) {
      bodyEl.innerHTML = '<div class="admin-state"><i class="ri-inbox-line"></i><p>No category data available.</p></div>'
      return
    }

    bodyEl.innerHTML = categories.map((cat, idx) => {
      const sc = Number(cat.score || 0)
      const cls = scoreClass(sc)
      const rules = Array.isArray(cat.rules) ? cat.rules : []

      const rulesHtml = rules.map((rule) => {
        const rCls = rule.status === 'PASS' ? 'badge--pass' : 'badge--fail'
        return `<div class="modal-rule">
          <div class="modal-rule__left">
            <p class="modal-rule__name">${esc(rule.name || '')}</p>
            ${rule.explanation ? `<p class="modal-rule__explanation">${esc(rule.explanation)}</p>` : ''}
          </div>
          <span class="badge ${rCls}">${esc(rule.status || 'FAIL')}</span>
        </div>`
      }).join('')

      return `<div class="modal-category" id="modal-cat-${idx}">
        <div class="modal-category__head" onclick="window.adminToggleCategory(${idx})">
          <div class="modal-category__left">
            <span class="modal-category__name">${esc(cat.name)}</span>
            <div class="modal-category__score-bar-wrap">
              <div class="modal-category__score-bar bar-${cls}" style="width:${Math.min(sc, 100)}%"></div>
            </div>
            <span class="modal-category__score-txt">${sc.toFixed(1)}%</span>
          </div>
          <div style="display:flex;align-items:center;gap:0.6rem">
            <span class="badge badge--${cat.status === 'PASS' ? 'pass' : 'fail'}">${esc(cat.status)}</span>
            <i class="ri-arrow-down-s-line modal-category__chevron"></i>
          </div>
        </div>
        <div class="modal-category__rules">
          ${rulesHtml || '<p class="admin-state" style="padding:0.75rem 1rem;font-size:0.825rem">No rule details.</p>'}
        </div>
      </div>`
    }).join('')

    // Auto-open first category
    const first = document.getElementById('modal-cat-0')
    if (first) first.classList.add('open')
  }

  function closeResultModal() {
    const modal = document.getElementById('result-modal')
    if (modal) modal.classList.add('hidden')
    document.body.style.overflow = ''
  }

  /* ======================================================
     CATEGORY ACCORDION
  ====================================================== */
  window.adminToggleCategory = function (idx) {
    const el = document.getElementById('modal-cat-' + idx)
    if (el) el.classList.toggle('open')
  }

  /* ======================================================
     PAGINATION CALLBACK
  ====================================================== */
  window.adminPage = function (page) {
    if (page < 1 || page > totalPages) return
    loadScans(page)
  }

  /* ======================================================
     VIEW RESULT CALLBACK
  ====================================================== */
  window.adminViewResult = function (scanId) {
    openResultModal(scanId)
  }

  /* ======================================================
     UNAUTHORIZED HANDLER
  ====================================================== */
  function handleUnauthorized() {
    clearToken()
    showLoginScreen()
  }

  /* ======================================================
     SIDEBAR TOGGLE (mobile)
  ====================================================== */
  function initSidebar() {
    const toggle = document.getElementById('sidebar-toggle')
    const sidebar = document.getElementById('admin-sidebar')
    const overlay = document.getElementById('sidebar-overlay')

    if (toggle) toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open')
      overlay.classList.toggle('show')
    })

    if (overlay) overlay.addEventListener('click', () => {
      sidebar.classList.remove('open')
      overlay.classList.remove('show')
    })
  }

  /* ======================================================
     THEME TOGGLE
  ====================================================== */
  function initAdminTheme() {
    const btn = document.getElementById('theme-toggle')
    if (!btn) return
    btn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('admin-dark')
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light')
      btn.innerHTML = isDark ? '<i class="ri-sun-line"></i>' : '<i class="ri-moon-line"></i>'
    })
  }

  /* ======================================================
     SEARCH & FILTER
  ====================================================== */
  function initSearchAndFilter() {
    const searchInput = document.getElementById('scan-search')
    const statusFilter = document.getElementById('scan-status-filter')
    const refreshBtn = document.getElementById('refresh-btn')

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounce)
        searchDebounce = setTimeout(() => loadScans(1), 380)
      })
    }

    if (statusFilter) {
      statusFilter.addEventListener('change', () => loadScans(1))
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadStats()
        loadScans(currentPage)
      })
    }
  }

  /* ======================================================
     MODAL EVENTS
  ====================================================== */
  function initModal() {
    const closeBtn = document.getElementById('modal-close')
    const backdrop = document.getElementById('modal-backdrop')

    if (closeBtn) closeBtn.addEventListener('click', closeResultModal)
    if (backdrop) backdrop.addEventListener('click', closeResultModal)

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeResultModal()
    })
  }

  /* ======================================================
     LOGOUT
  ====================================================== */
  function initLogout() {
    document.querySelectorAll('.js-logout-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        clearToken()
        showLoginScreen()
      })
    })
  }

  /* ======================================================
     LOAD FULL DASHBOARD
  ====================================================== */
  async function loadDashboard() {
    await Promise.all([loadStats(), loadScans(1)])
  }

  /* ======================================================
     PAGE NAVIGATION
  ====================================================== */
  function initPageNav() {
    const navLinks = document.querySelectorAll('.admin-nav__link[data-page]')
    navLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault()
        const page = link.dataset.page
        switchPage(page)
      })
    })
  }

  function switchPage(page) {
    // Update nav active state
    document.querySelectorAll('.admin-nav__link[data-page]').forEach((l) => l.classList.remove('active'))
    const activeLink = document.querySelector(`.admin-nav__link[data-page="${page}"]`)
    if (activeLink) activeLink.classList.add('active')

    // Update topbar title
    const topTitle = document.querySelector('.admin-topbar__title')
    if (topTitle) topTitle.textContent = page === 'messages' ? 'Contact Messages' : 'Compliance Dashboard'

    // Show/hide pages
    document.querySelectorAll('.admin-page-section').forEach((sec) => sec.classList.add('hidden'))
    const target = document.getElementById('page-' + page)
    if (target) target.classList.remove('hidden')

    // Load data for the page
    if (page === 'messages') loadMessages(1)
    if (page === 'dashboard') loadDashboard()
  }

  /* ======================================================
     MESSAGES
  ====================================================== */
  let messagesPage = 1
  let messagesTotalPages = 1

  async function loadMessages(page) {
    messagesPage = page || 1
    const tbody = document.getElementById('messages-table-body')
    if (!tbody) return

    tbody.innerHTML = '<tr><td colspan="5" class="admin-state"><span class="admin-spinner admin-spinner--dark"></span><p style="margin-top:0.75rem">Loading…</p></td></tr>'

    try {
      const res = await fetch(apiUrl(`/api/admin/messages?page=${messagesPage}&limit=10`), { headers: authHeaders() })
      if (!res.ok) throw new Error('Failed to load messages')
      const { data } = await res.json()

      messagesTotalPages = data.totalPages || 1
      renderMessages(data.messages || [], data.total || 0, data.page || 1)
      renderMessagesPagination()
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="admin-state"><p style="color:var(--danger)">Failed to load messages.</p></td></tr>`
    }
  }

  function renderMessages(messages, total, page) {
    const tbody = document.getElementById('messages-table-body')
    if (!messages.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="admin-state"><p>No messages yet.</p></td></tr>'
      return
    }

    const offset = (page - 1) * 10
    tbody.innerHTML = messages.map((msg, i) => `
      <tr>
        <td>${offset + i + 1}</td>
        <td>${esc(msg.email)}</td>
        <td>${esc(msg.subject)}</td>
        <td style="max-width:300px;white-space:pre-wrap;word-break:break-word">${esc(msg.message)}</td>
        <td>${formatDate(msg.created_at)}</td>
      </tr>
    `).join('')
  }

  function renderMessagesPagination() {
    const container = document.getElementById('messages-pagination')
    if (!container) return

    if (messagesTotalPages <= 1) { container.innerHTML = ''; return }

    let html = ''
    html += `<button class="admin-btn admin-btn--outline admin-btn--sm" ${messagesPage <= 1 ? 'disabled' : ''} data-msg-page="${messagesPage - 1}">← Prev</button>`
    html += `<span style="padding:0 0.75rem;font-size:0.85rem">Page ${messagesPage} of ${messagesTotalPages}</span>`
    html += `<button class="admin-btn admin-btn--outline admin-btn--sm" ${messagesPage >= messagesTotalPages ? 'disabled' : ''} data-msg-page="${messagesPage + 1}">Next →</button>`

    container.innerHTML = html

    container.querySelectorAll('[data-msg-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.msgPage)
        if (p >= 1 && p <= messagesTotalPages) loadMessages(p)
      })
    })
  }

  function initMessages() {
    const refreshBtn = document.getElementById('messages-refresh-btn')
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => loadMessages(messagesPage))
    }
  }

  /* ======================================================
     INIT
  ====================================================== */
  async function init() {
    initTheme()
    initLogin()
    initModal()
    initLogout()
    initSidebar()
    initAdminTheme()
    initSearchAndFilter()
    initPageNav()
    initMessages()

    const token = getToken()
    if (token) {
      try {
        const valid = await verifyToken(token)
        if (valid) {
          showAdminApp()
          loadDashboard()
        } else {
          clearToken()
          showLoginScreen()
        }
      } catch {
        showLoginScreen()
      }
    } else {
      showLoginScreen()
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
