/*=============== SHOW MENU ===============*/
const navMenu = document.getElementById('nav-menu'),
      navToggle = document.getElementById('nav-toggle'),
      navClose = document.getElementById('nav-close')

/*===== MENU SHOW =====*/
/* Validate if constant exists */
if(navToggle){
    navToggle.addEventListener('click', () =>{
        navMenu.classList.add('show-menu')
    })
}

/*===== MENU HIDDEN =====*/
/* Validate if constant exists */
if(navClose){
    navClose.addEventListener('click', () =>{
        navMenu.classList.remove('show-menu')
    })
}

/*=============== REMOVE MENU MOBILE ===============*/
const navLink = document.querySelectorAll('.nav__link')

function linkAction(){
    const navMenu = document.getElementById('nav-menu')
    // When we click on each nav__link, we remove the show-menu class
    navMenu.classList.remove('show-menu')
}
navLink.forEach(n => n.addEventListener('click', linkAction))

/*=============== CHANGE BACKGROUND HEADER ===============*/
function scrollHeader(){
    const header = document.getElementById('header')
    // When the scroll is greater than 80 viewport height, add the scroll-header class to the header tag
    if(this.scrollY >= 80) header.classList.add('scroll-header'); else header.classList.remove('scroll-header')
}
window.addEventListener('scroll', scrollHeader)

/*=============== QUESTIONS ACCORDION ===============*/
const accordionItems = document.querySelectorAll('.questions__item')

accordionItems.forEach((item) =>{
    const accordionHeader = item.querySelector('.questions__header')

    accordionHeader.addEventListener('click', () =>{
        const openItem = document.querySelector('.accordion-open')

        toggleItem(item)

        if(openItem && openItem!== item){
            toggleItem(openItem)
        }
    })
})

const toggleItem = (item) =>{
    const accordionContent = item.querySelector('.questions__content')

    if(item.classList.contains('accordion-open')){
        accordionContent.removeAttribute('style')
        item.classList.remove('accordion-open')
    }else{
        accordionContent.style.height = accordionContent.scrollHeight + 'px'
        item.classList.add('accordion-open')
    }

}

/*=============== SCROLL SECTIONS ACTIVE LINK ===============*/
const sections = document.querySelectorAll('section[id]')

function scrollActive(){
    const scrollY = window.pageYOffset

    sections.forEach(current =>{
        const sectionHeight = current.offsetHeight,
              sectionTop = current.offsetTop - 58,
              sectionId = current.getAttribute('id')

        if(scrollY > sectionTop && scrollY <= sectionTop + sectionHeight){
            document.querySelector('.nav__menu a[href*=' + sectionId + ']').classList.add('active-link')
        }else{
            document.querySelector('.nav__menu a[href*=' + sectionId + ']').classList.remove('active-link')
        }
    })
}
window.addEventListener('scroll', scrollActive)

/*=============== SHOW SCROLL UP ===============*/ 
function scrollUp(){
    const scrollUp = document.getElementById('scroll-up');
    // When the scroll is higher than 400 viewport height, add the show-scroll class to the a tag with the scroll-top class
    if(this.scrollY >= 400) scrollUp.classList.add('show-scroll'); else scrollUp.classList.remove('show-scroll')
}
window.addEventListener('scroll', scrollUp)

/*=============== DARK LIGHT THEME ===============*/ 
const themeButton = document.getElementById('theme-button')
const darkTheme = 'dark-theme'
const iconTheme = 'ri-sun-line'

// Previously selected topic (if user selected)
const selectedTheme = localStorage.getItem('selected-theme')
const selectedIcon = localStorage.getItem('selected-icon')

// We obtain the current theme that the interface has by validating the dark-theme class
const getCurrentTheme = () => document.body.classList.contains(darkTheme) ? 'dark' : 'light'
const getCurrentIcon = () => themeButton.classList.contains(iconTheme) ? 'ri-moon-line' : 'ri-sun-line'

// We validate if the user previously chose a topic
if (selectedTheme) {
  // If the validation is fulfilled, we ask what the issue was to know if we activated or deactivated the dark
  document.body.classList[selectedTheme === 'dark' ? 'add' : 'remove'](darkTheme)
  themeButton.classList[selectedIcon === 'ri-moon-line' ? 'add' : 'remove'](iconTheme)
}

// Activate / deactivate the theme manually with the button
themeButton.addEventListener('click', () => {
    // Add or remove the dark / icon theme
    document.body.classList.toggle(darkTheme)
    themeButton.classList.toggle(iconTheme)
    // We save the theme and the current icon that the user chose
    localStorage.setItem('selected-theme', getCurrentTheme())
    localStorage.setItem('selected-icon', getCurrentIcon())
})

/*=============== SCROLL REVEAL ANIMATION ===============*/
try{
    const sr = ScrollReveal({
        origin: 'top',
        distance: '60px',
        duration: 2500,
        delay: 400,
    })

    sr.reveal(`.home__data`)
    sr.reveal(`.home__img`, {delay: 500})
    sr.reveal(`.home__social`, {delay: 600})
    sr.reveal(`.about__img, .contact__box`,{origin: 'left'})
    sr.reveal(`.about__data, .contact__form`,{origin: 'right'})
    sr.reveal(`.steps__card, .product__card, .questions__group, .footer`,{interval: 100})
}catch(e){ console.warn('ScrollReveal init failed:', e) }

/*=============== SPLASK DASHBOARD ===============*/
const DASHBOARD_API_BASE = window.SPLASK_API_BASE_URL || 'http://localhost:3000'
let complianceChartInstance = null
let dashboardRefreshTimer = null
let lastScanSummary = null

const dashboardElements = {
    totalScore: document.getElementById('total-score'),
    overallStatus: document.getElementById('overall-status'),
    totalWebsites: document.getElementById('total-websites'),
    latestScanDate: document.getElementById('latest-scan-date'),
    categoryList: document.getElementById('category-list'),
    chartCanvas: document.getElementById('compliance-chart'),
    scanInput: document.getElementById('scan-url-input'),
    scanButton: document.getElementById('scan-now-button'),
    scanStatus: document.getElementById('scan-status-message'),
    exportPdfButton: document.getElementById('export-pdf-button'),
    clearDashboardButton: document.getElementById('clear-dashboard-button')
}

function apiUrl(path){
    const base = DASHBOARD_API_BASE.replace(/\/$/, '')
    const route = path.startsWith('/') ? path : `/${path}`
    return `${base}${route}`
}

async function loadDashboardData(){
    if(!dashboardElements.totalScore || !dashboardElements.chartCanvas){
        return
    }

    try{
        const response = await fetch(apiUrl('/api/public/summary'))
        if(!response.ok){
            throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        const summary = payload.data || {}

        lastScanSummary = summary
        renderSummary(summary)
        renderCategoryBreakdown(summary)
        renderComplianceChart(summary)
        setExportPdfEnabled(!!summary.latestScore)
    }catch(error){
        renderDashboardError(error.message)
    }
}

function renderSummary(summary){
    const score = Number(summary.latestScore || 0)
    const status = score >= 80 ? 'PASS' : 'FAIL'

    dashboardElements.totalScore.textContent = `${score.toFixed(2)}%`
    dashboardElements.totalWebsites.textContent = String(summary.totalScans || 0)
    dashboardElements.latestScanDate.textContent = summary.latestDate ? formatDate(summary.latestDate) : '-'

    dashboardElements.overallStatus.textContent = status
    dashboardElements.overallStatus.className = `dashboard__status ${status === 'PASS' ? 'dashboard__status--pass' : 'dashboard__status--fail'}`
}

function renderCategoryBreakdown(summary){
    const categories = Array.isArray(summary.latestCategories) ? summary.latestCategories : []

    if(!categories.length){
        dashboardElements.categoryList.innerHTML = '<p class="dashboard__empty">No category data yet.</p>'
        return
    }

    dashboardElements.categoryList.innerHTML = categories.map((category) => {
        const categoryStatusClass = category.status === 'PASS' ? 'dashboard__status--pass' : 'dashboard__status--fail'
        const subCategories = Array.isArray(category.subCategories) ? category.subCategories : []

        const subCategoryHtml = subCategories.map((subCategory) => {
            const subStatusClass = subCategory.status === 'PASS' ? 'dashboard__status--pass' : 'dashboard__status--fail'
            return `
                <div class="dashboard__subcategory">
                    <div>
                        <p class="dashboard__subcategory-name">${escapeHtml(subCategory.name || '')}</p>
                        <p class="dashboard__subcategory-explain">${escapeHtml(subCategory.explanation || 'No explanation available.')}</p>
                    </div>
                    <span class="dashboard__status ${subStatusClass}">${escapeHtml(subCategory.status || 'FAIL')}</span>
                </div>
            `
        }).join('')

        return `
            <article class="dashboard__category">
                <div class="dashboard__category-head">
                    <h4 class="dashboard__category-title">${escapeHtml(category.name || '')}</h4>
                    <span class="dashboard__status ${categoryStatusClass}">${escapeHtml(category.status || 'FAIL')}</span>
                </div>
                <p class="dashboard__category-score">Score: ${Number(category.score || 0).toFixed(2)}%</p>
                <p class="dashboard__category-explanation">${escapeHtml(category.explanation || 'No category explanation available.')}</p>
                <div class="dashboard__subcategory-list">
                    ${subCategoryHtml || '<p class="dashboard__empty">No sub category details.</p>'}
                </div>
            </article>
        `
    }).join('')
}

function getBarColor(score){
    if(score > 80) return 'rgba(46, 125, 96, 0.85)'
    if(score >= 50) return 'rgba(218, 165, 32, 0.85)'
    return 'rgba(179, 38, 30, 0.85)'
}

function renderComplianceChart(summary){
    const categories = Array.isArray(summary.latestCategories) ? summary.latestCategories : []
    const labels = categories.map(c => c.name || '')
    const scores = categories.map(c => Number(c.score || 0))
    const colors = scores.map(s => getBarColor(s))

    if(complianceChartInstance){
        complianceChartInstance.destroy()
    }

    if(!labels.length){
        return
    }

    complianceChartInstance = new Chart(dashboardElements.chartCanvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Category Score (%)',
                data: scores,
                borderWidth: 1,
                borderRadius: 6,
                backgroundColor: colors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: { size: 10 },
                        maxRotation: 45,
                        minRotation: 25
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        stepSize: 20,
                        font: { size: 10 },
                        callback: (value) => `${value}%`
                    },
                    grid: {
                        drawBorder: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${ctx.parsed.y.toFixed(2)}%`
                    }
                }
            }
        }
    })
}

function renderDashboardError(message){
    dashboardElements.categoryList.innerHTML = `<p class="dashboard__empty">Failed to load categories: ${escapeHtml(message)}</p>`
    dashboardElements.latestScanDate.textContent = 'Unavailable'
    dashboardElements.totalWebsites.textContent = '0'
    dashboardElements.totalScore.textContent = '0%'
    dashboardElements.overallStatus.textContent = 'FAIL'
    dashboardElements.overallStatus.className = 'dashboard__status dashboard__status--fail'
}

function formatDate(value){
    if(!value){
        return '-'
    }

    const date = new Date(value)
    if(Number.isNaN(date.getTime())){
        return '-'
    }

    return date.toLocaleString('en-MY', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    })
}

function escapeHtml(value){
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

function setScanStatus(message, isError = false){
    if(!dashboardElements.scanStatus){
        return
    }

    dashboardElements.scanStatus.textContent = message
    dashboardElements.scanStatus.style.color = isError ? '#b3261e' : ''
}

function setScanButtonLoading(isLoading){
    if(!dashboardElements.scanButton){
        return
    }

    dashboardElements.scanButton.disabled = isLoading
    dashboardElements.scanButton.style.opacity = isLoading ? '0.75' : '1'
    dashboardElements.scanButton.innerHTML = isLoading
        ? 'Scanning... <i class="ri-loader-4-line button__icon"></i>'
        : 'Scan Now <i class="ri-arrow-right-up-line button__icon"></i>'
}

async function startScanFromInput(){
    if(!dashboardElements.scanInput || !dashboardElements.scanButton){
        return
    }

    const rawUrl = dashboardElements.scanInput.value.trim()
    if(!rawUrl){
        setScanStatus('Please enter a website URL before scanning.', true)
        return
    }

    let normalizedUrl = rawUrl
    if(!/^https?:\/\//i.test(normalizedUrl)){
        normalizedUrl = `https://${normalizedUrl}`
    }

    try{
        // Validate URL format on client side first.
        new URL(normalizedUrl)
    }catch(error){
        setScanStatus('URL format is invalid. Example: https://example.com', true)
        return
    }

    try{
        setScanButtonLoading(true)
        setScanStatus('Submitting scan request...')

        const response = await fetch(apiUrl('/api/scan'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: normalizedUrl })
        })

        const payload = await response.json()
        if(!response.ok || !payload.success){
            throw new Error(payload.error || `Scan request failed with status ${response.status}`)
        }

        const scanId = payload?.data?.scan_id
        setScanStatus('Scan started. Processing pages and rules...')

        await pollScanCompletion(scanId)
        await loadDashboardData()

        setScanStatus('Scan completed successfully. Dashboard updated.')
        dashboardElements.scanInput.value = normalizedUrl
    }catch(error){
        setScanStatus(`Scan failed: ${error.message}`, true)
    }finally{
        setScanButtonLoading(false)
    }
}

async function pollScanCompletion(scanId){
    const maxAttempts = 72
    const delayMs = 5000

    for(let attempt = 1; attempt <= maxAttempts; attempt++){
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        const response = await fetch(apiUrl(`/api/scan/${scanId}/status`))
        if(!response.ok){
            continue
        }

        const payload = await response.json()
        const status = payload?.data?.status

        if(status === 'COMPLETED'){
            return
        }

        if(status === 'FAILED'){
            throw new Error('Scan completed with FAILED status.')
        }

        setScanStatus(`Scan in progress... (${attempt}/${maxAttempts})`)
    }

    throw new Error('Scan timed out while waiting for completion.')
}

function setExportPdfEnabled(enabled){
    if(!dashboardElements.exportPdfButton) return
    dashboardElements.exportPdfButton.disabled = !enabled
    dashboardElements.exportPdfButton.style.opacity = enabled ? '1' : '0.5'
}

function clearDashboard(){
    dashboardElements.totalScore.textContent = '0%'
    dashboardElements.totalWebsites.textContent = '0'
    dashboardElements.latestScanDate.textContent = '-'
    dashboardElements.overallStatus.textContent = 'N/A'
    dashboardElements.overallStatus.className = 'dashboard__status'
    dashboardElements.categoryList.innerHTML = '<p class="dashboard__empty">No category data yet.</p>'

    if(complianceChartInstance){
        complianceChartInstance.destroy()
        complianceChartInstance = null
    }

    lastScanSummary = null
    setExportPdfEnabled(false)

    if(dashboardElements.scanInput) dashboardElements.scanInput.value = ''
    setScanStatus('')
}

function handleExportPdf(){
    if(!lastScanSummary || !lastScanSummary.latestCategories){
        setScanStatus('No scan data available to export.', true)
        return
    }

    const scannedUrl = dashboardElements.scanInput
        ? dashboardElements.scanInput.value.trim()
        : ''

    const pdfData = {
        url: scannedUrl || 'Unknown Website',
        totalScore: lastScanSummary.latestScore || 0,
        scanDate: lastScanSummary.latestDate || new Date().toISOString(),
        categories: (lastScanSummary.latestCategories || []).map((cat) => ({
            name: cat.name,
            score: Number(cat.score || 0),
            status: cat.status || (Number(cat.score || 0) >= 80 ? 'PASS' : 'FAIL'),
            explanation: cat.explanation || '',
            subCategories: (cat.subCategories || []).map((sub) => ({
                name: sub.name,
                status: sub.status || 'FAIL',
                explanation: sub.explanation || ''
            }))
        }))
    }

    try{
        SPLaSKPDF.generateReport(pdfData)
    }catch(error){
        console.error('PDF export error:', error)
        setScanStatus('PDF export failed: ' + error.message, true)
    }
}

function attachScanHandlers(){
    if(!dashboardElements.scanButton || !dashboardElements.scanInput){
        return
    }

    dashboardElements.scanButton.addEventListener('click', startScanFromInput)
    dashboardElements.scanInput.addEventListener('keydown', (event) => {
        if(event.key === 'Enter'){
            event.preventDefault()
            startScanFromInput()
        }
    })

    if(dashboardElements.exportPdfButton){
        dashboardElements.exportPdfButton.addEventListener('click', handleExportPdf)
    }

    if(dashboardElements.clearDashboardButton){
        dashboardElements.clearDashboardButton.addEventListener('click', clearDashboard)
    }
}

function initializeDashboard(){
    attachScanHandlers()
    initContactForm()

    if(dashboardRefreshTimer){
        clearInterval(dashboardRefreshTimer)
    }
}

/*=============== CONTACT FORM ===============*/
function initContactForm(){
    const form = document.getElementById('contact-form')
    if(!form) return

    form.addEventListener('submit', async (e) => {
        e.preventDefault()

        const emailInput = document.getElementById('contact-email')
        const subjectInput = document.getElementById('contact-subject')
        const messageInput = document.getElementById('contact-message')
        const sendBtn = document.getElementById('contact-send-btn')
        const statusEl = document.getElementById('contact-status')

        const email = emailInput.value.trim()
        const subject = subjectInput.value.trim()
        const message = messageInput.value.trim()

        if(!email || !subject || !message){
            statusEl.textContent = 'Please fill in all fields.'
            statusEl.style.color = '#b3261e'
            return
        }

        sendBtn.disabled = true
        sendBtn.innerHTML = 'Sending... <i class="ri-loader-4-line button__icon"></i>'
        statusEl.textContent = ''

        try{
            const response = await fetch(apiUrl('/api/contact'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, subject, message })
            })

            const data = await response.json()

            if(response.ok && data.success){
                // Show popup
                alert('Message already sent!')
                // Clear form
                form.reset()
                statusEl.textContent = 'Message sent successfully!'
                statusEl.style.color = 'var(--first-color)'
            }else{
                statusEl.textContent = data.error || 'Failed to send message.'
                statusEl.style.color = '#b3261e'
            }
        }catch(error){
            statusEl.textContent = 'Cannot connect to server. Please try again later.'
            statusEl.style.color = '#b3261e'
        }finally{
            sendBtn.disabled = false
            sendBtn.innerHTML = 'Send Message <i class="ri-arrow-right-up-line button__icon"></i>'
        }
    })

    form.dataset.handlerAttached = 'true'
}

try{
    initializeDashboard()
}catch(e){
    console.error('Dashboard init failed:', e)
}

// Safety net: ensure contact form handler is attached even if earlier code fails
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contact-form')
    if(form && !form.dataset.handlerAttached){
        initContactForm()
    }
})