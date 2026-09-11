import { isDemoMode } from './api.js'

const opportunities = [
  { id: 'opp-001', title: 'Captured CO₂ stream', status: 'Evidence needed', confidence: 86, reason: 'Your separation step suggests a recoverable CO₂ stream. Actual capture quantity and quality are still unknown.', quantity: 'Potential · quantity unknown', icon: '◌', tone: 'mint' },
  { id: 'opp-002', title: 'Low-grade process heat', status: 'Potential', confidence: 64, reason: 'The heat recovery stage may support a nearby user, subject to temperature, timing and distance checks.', quantity: 'Potential · no trade category yet', icon: '≈', tone: 'gold' },
  { id: 'opp-003', title: 'Mineral-rich residue', status: 'Potential', confidence: 51, reason: 'A solid residue appears in the process description, but composition and safe handling evidence are missing.', quantity: 'Potential · unsupported for listing', icon: '◇', tone: 'purple' },
]

const listings = [
  { id: 'cb-1042', title: 'Captured CO₂ · food-grade candidate', supplier: 'Aster Fermentation Works', location: 'Anand, Gujarat', quantity: '120 t / month', purity: '99.5% CO₂', price: '₹4,850 / t', availability: '01 Oct – 31 Dec 2026', evidence: 'Verified', score: 96, color: 'green' },
  { id: 'cb-1077', title: 'Captured CO₂ · industrial grade', supplier: 'Prithvi Bioethanol', location: 'Pune, Maharashtra', quantity: '80 t / month', purity: '98.8% CO₂', price: '₹3,900 / t', availability: '15 Sep – 30 Nov 2026', evidence: 'Partial', score: 88, color: 'blue' },
  { id: 'cb-0991', title: 'Captured CO₂ · mineralization input', supplier: 'Kaveri Renewables', location: 'Raipur, Chhattisgarh', quantity: '160 t / month', purity: '97.2% CO₂', price: '₹3,250 / t', availability: '01 Oct – 31 Dec 2026', evidence: 'Verified', score: 82, color: 'orange' },
]

const requirements = [
  { title: 'Mineralization feedstock', buyer: 'TerraForm Materials', need: '60 t / month · ≥97% CO₂', window: 'Oct – Dec 2026', matches: 3, status: 'Active' },
  { title: 'Greenhouse enrichment', buyer: 'Narmada Growers Co-op', need: '25 t / month · ≥99% CO₂', window: 'Nov 2026 – Feb 2027', matches: 1, status: 'Needs evidence' },
]

const processSteps = [
  ['01', 'Fermentation', 'Sugar feedstock converted to ethanol', 'input'],
  ['02', 'Gas separation', 'CO₂-rich gas stream separated', 'signal'],
  ['03', 'Purification', 'Moisture and trace compounds removed', 'quality'],
  ['04', 'Compression', 'Gas stored for dispatch or use', 'output'],
]

const state = {
  view: 'overview',
  assistantOpen: true,
  selectedListing: 'cb-1042',
  processText: 'We ferment molasses to produce ethanol. The gas separation stage creates a CO₂-rich stream, then we purify and compress it. We currently do not measure the exact monthly quantity.',
  analysisRun: true,
  messages: [
    { role: 'assistant', text: 'Hi Ananya. Tell me what your process makes, and I’ll map the useful outputs, evidence gaps and next actions for you.', time: '09:41' },
    { role: 'user', text: 'What can I sell from our ethanol process?', time: '09:42' },
    { role: 'assistant', text: 'I found three possible resource opportunities. The CO₂ stream is the strongest lead, but I’m keeping the quantity and price blank until we have evidence.', time: '09:42', card: 'discovery' },
  ],
}

const nav = [
  ['overview', 'Overview', '⌂'], ['process', 'My processes', '◫', 'Discover'], ['marketplace', 'Marketplace', '⌁', 'Trade'], ['requirements', 'Buyer needs', '◎'], ['requests', 'Requests', '↗'], ['evidence', 'Evidence vault', '▣', 'Trust'], ['reports', 'Reports', '▥'],
]

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]))
const timeNow = () => new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date())
const statusPill = (status) => `<span class="status-pill ${status === 'Evidence needed' || status === 'Needs evidence' || status === 'Review needed' ? 'warning' : status === 'Accepted' ? 'success' : 'neutral'}">${escapeHtml(status)}</span>`
const button = (label, className = 'button button-dark', action = '') => `<button class="${className}" ${action ? `data-action="${action}"` : ''}>${label}</button>`

function shell() {
  const pageTitle = nav.find(([id]) => id === state.view)?.[1] || 'Assistant'
  return `<div class="app-shell">
    <aside class="sidebar">
      <div class="brand-lockup" aria-label="CarbonBridge home"><div class="brand-mark"><span>↗</span></div><div><strong>carbon<span>bridge</span></strong><small>circular carbon exchange</small></div></div>
      <div class="workspace-switcher"><div class="avatar avatar-teal">AF</div><div class="workspace-copy"><strong>Aster Fermentation</strong><span>Seller workspace</span></div><button class="icon-button subtle">⌄</button></div>
      <nav class="main-nav" aria-label="Main navigation">${nav.map((item, index) => `${item[3] && (index === 1 || item[3] !== nav[index - 1]?.[3]) ? `<div class="nav-section">${item[3]}</div>` : ''}<button class="nav-item ${state.view === item[0] ? 'active' : ''}" data-view="${item[0]}"><span class="nav-icon">${item[2]}</span><span>${item[1]}</span>${item[0] === 'evidence' ? '<span class="nav-count">3</span>' : ''}${item[0] === 'requests' ? '<span class="nav-dot" />' : ''}</button>`).join('')}</nav>
      <div class="sidebar-bottom"><div class="trust-card"><span class="status-pulse" /><div><strong>${isDemoMode ? 'Demo workspace' : 'Connected workspace'}</strong><small>${isDemoMode ? 'Seed data · safe to explore' : 'Live API · session protected'}</small></div></div><button class="nav-item" data-action="open-assistant"><span class="nav-icon">✦</span><span>Ask CarbonBridge</span><span class="shortcut">⌘K</span></button><button class="nav-item"><span class="nav-icon">⚙</span><span>Settings</span></button><div class="user-row"><div class="avatar avatar-coral">AS</div><div><strong>Ananya Shah</strong><span>Org admin</span></div><button class="icon-button subtle">•••</button></div></div>
    </aside>
    <main class="main-content"><header class="topbar"><div class="breadcrumbs"><span>Workspace</span><b>/</b><strong>${pageTitle}</strong></div><div class="topbar-actions"><span class="sync-status"><i /> All changes saved</span><button class="icon-button" aria-label="Notifications">♢<span class="notification-dot" /></button>${button('<span>✦</span> Ask assistant', 'button button-dark button-small', 'open-assistant')}</div></header><div class="page-scroll">${renderView()}</div></main>
    ${state.assistantOpen && state.view !== 'assistant' ? assistantPanel() : ''}
  </div>`
}

function intro(eyebrow, title, copy, action = '') {
  return `<div class="page-intro"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${copy}</p></div>${action ? `<div class="intro-action">${action}</div>` : ''}</div>`
}

function metric(label, value, detail, icon, tone) {
  return `<div class="metric-card"><div class="metric-icon ${tone}">${icon}</div><div><span>${label}</span><strong>${value}</strong><small>${detail}</small></div><span class="metric-trend">↗</span></div>`
}

function overview() {
  return `${intro('Tuesday · 12 September 2026', 'Make the invisible, useful.', 'Your process creates more value than the final product. CarbonBridge helps you find it, prove it and connect it to the right next user.')}
    <section class="hero-grid"><div class="hero-card"><div class="hero-orbit orbit-one" /><div class="hero-orbit orbit-two" /><div class="hero-content"><span class="hero-kicker"><i /> Process intelligence</span><h2>What does your process leave behind?</h2><p>Describe it in your own words. We’ll turn the steps into a map of potential resources, evidence gaps and marketplace actions.</p>${button('Describe my process <span>→</span>', 'button button-light', 'analyze-process')}<button class="text-button" data-view="assistant">Or start with a question <span>↗</span></button></div><div class="hero-footer"><span><b>✦</b> AI-assisted</span><span><b>◈</b> Evidence-aware</span><span><b>↺</b> You stay in control</span></div></div><div class="insight-card"><div class="card-heading"><div><span class="eyebrow">Your latest discovery</span><h3>3 potential opportunities</h3></div><span class="spark-icon">✦</span></div><div class="mini-opportunity-list">${opportunities.map((item) => `<div class="mini-opportunity"><span class="mini-icon ${item.tone}">${item.icon}</span><div><strong>${item.title}</strong><span>${item.status}</span></div><span class="confidence">${item.confidence}%</span></div>`).join('')}</div><button class="card-link" data-view="process">Review discovery <span>→</span></button></div></section>
    <section class="metric-grid">${metric('Published supply', '360 t', '3 active listings', '⌁', 'green')}${metric('Buyer demand', '85 t', 'Across 2 active needs', '◎', 'blue')}${metric('Evidence to review', '2', 'Before anything is published', '▣', 'gold')}${metric('Potential avoided', '1,240 t', 'Based on recorded activity', '◌', 'purple')}</section>
    <section class="split-section"><div class="panel timeline-panel"><div class="panel-title"><div><span class="eyebrow">Your workspace</span><h3>Turn an idea into a trusted exchange</h3></div><button class="icon-button subtle">•••</button></div><div class="journey">${[['1', 'Describe', 'Tell us how your process works', 'current', 'process'], ['2', 'Discover', 'See potential outputs and gaps', 'next', 'process'], ['3', 'Prove', 'Add quality and quantity evidence', 'next', 'evidence'], ['4', 'Connect', 'Find buyers and make a match', 'next', 'marketplace']].map(([number, title, detail, status, view]) => `<button class="journey-step ${status}" data-view="${view}"><span class="journey-number">${status === 'current' ? '●' : number}</span><span><strong>${title}</strong><small>${detail}</small></span><span class="journey-arrow">→</span></button>`).join('')}</div></div><div class="panel activity-panel"><div class="panel-title"><div><span class="eyebrow">Recent activity</span><h3>What’s moving</h3></div><button class="card-link" data-view="requests">View all →</button></div><div class="activity-list"><div class="activity-row"><span class="activity-icon blue">↗</span><div><strong>New buyer request</strong><span>TerraForm Materials · 60 t / month</span></div><time>12 min</time></div><div class="activity-row"><span class="activity-icon gold">▣</span><div><strong>Evidence needed</strong><span>CO₂ composition report</span></div><time>1 hr</time></div><div class="activity-row"><span class="activity-icon green">✓</span><div><strong>Listing viewed</strong><span>Captured CO₂ · industrial grade</span></div><time>3 hr</time></div></div></div></section>`
}

function processView() {
  return `${intro('Process intelligence · Draft', 'Describe your process.', 'Start with what you know. CarbonBridge will identify potential outputs without treating an estimate as verified inventory.')}
    <div class="process-layout"><section class="panel process-editor"><div class="panel-title"><div><span class="eyebrow">Step 1 of 3</span><h3>Tell us what happens</h3></div><span class="draft-badge">Draft saved</span></div><label class="field-label" for="process-description">Your process in your own words</label><textarea id="process-description" rows="8">${escapeHtml(state.processText)}</textarea><div class="field-hint"><span>✦</span> You don’t need technical terms. Include inputs, steps, outputs and anything you already measure.</div><div class="quick-fields"><div><label>Facility</label><button class="select-field">Aster Fermentation Works <span>⌄</span></button></div><div><label>Operating scale</label><button class="select-field">Approx. 120 t / month <span>⌄</span></button></div></div><div class="editor-footer"><button class="text-button">Save and exit</button>${button('Analyze my process <span>→</span>', 'button button-dark', 'analyze-process')}</div></section><section class="panel process-map"><div class="panel-title"><div><span class="eyebrow">Step 2 of 3</span><h3>Process map</h3></div><span class="live-badge"><i /> Live preview</span></div><div class="map-helper">We found these steps from your description. Edit anything that looks wrong.</div><div class="step-list">${processSteps.map((step, index) => `<div class="process-step"><span class="step-node ${step[3]}">${step[3] === 'input' ? '↓' : step[3] === 'output' ? '↑' : '•'}</span><div><span class="step-number">${step[0]}</span><strong>${step[1]}</strong><small>${step[2]}</small></div>${index < processSteps.length - 1 ? '<span class="step-connector" />' : ''}</div>`).join('')}</div><button class="outlined-button">＋ Add a step</button></section></div>
    ${state.analysisRun ? `<section class="discovery-section"><div class="section-heading"><div><span class="eyebrow">Step 3 of 3 · AI-assisted discovery</span><h2>Potential opportunities</h2><p>These are hypotheses from your process. Review the reason and add evidence before creating a marketplace listing.</p></div><button class="text-button" data-view="evidence">View evidence vault →</button></div><div class="opportunity-grid">${opportunities.map((item) => `<article class="opportunity-card"><div class="opportunity-top"><span class="opportunity-icon ${item.tone}">${item.icon}</span>${statusPill(item.status)}</div><h3>${item.title}</h3><p>${item.reason}</p><div class="confidence-row"><span>Confidence in signal</span><strong>${item.confidence}%</strong></div><div class="confidence-bar"><span style="width: ${item.confidence}%" /></div><div class="opportunity-meta"><span>${item.quantity}</span><button data-view="evidence">Review next step <span>→</span></button></div></article>`).join('')}</div></section>` : ''}`
}

function marketplace() {
  return `${intro('Trade · Captured CO₂', 'Find the right next user.', 'Every result is ranked from quality fit, availability, distance and evidence. Prices are shown with their basis and date.', button('＋ Create a listing', 'button button-dark', 'go-process'))}<div class="market-toolbar"><div class="search-box"><span>⌕</span><input aria-label="Search marketplace" placeholder="Search by material, use or location" /></div><button class="filter-button">Material <span>⌄</span></button><button class="filter-button">Quality <span>⌄</span></button><button class="filter-button">Availability <span>⌄</span></button><span class="result-count">12 results <button class="icon-button subtle">≡</button></span></div><div class="market-layout"><div class="listing-list">${listings.map((item) => `<article class="listing-card ${state.selectedListing === item.id ? 'selected' : ''}" data-listing="${item.id}"><div class="listing-art ${item.color}"><span>◌</span><small>CO₂</small></div><div class="listing-main"><div class="listing-heading"><div><span class="match-score">${item.score}% fit</span><h3>${item.title}</h3><p>${item.supplier} · ${item.location}</p></div><button class="select-circle ${state.selectedListing === item.id ? 'checked' : ''}" aria-label="Select ${item.title}">${state.selectedListing === item.id ? '✓' : ''}</button></div><div class="listing-facts"><span><b>Quantity</b>${item.quantity}</span><span><b>Purity</b>${item.purity}</span><span><b>Price</b>${item.price}</span><span><b>Available</b>${item.availability}</span></div><div class="listing-footer"><span class="evidence-state ${item.evidence === 'Verified' ? 'verified' : 'partial'}"><i /> ${item.evidence} evidence</span><button class="text-button">View details →</button></div></div></article>`).join('')}</div><div class="panel compare-panel"><div class="panel-title"><div><span class="eyebrow">Decision helper</span><h3>Compare options</h3></div><span class="compare-count">1 / 3</span></div><p>Select up to three supply options. We’ll show the quality gaps, delivered estimate and evidence state side by side.</p><div class="compare-preview"><div class="compare-graphic"><span class="graphic-line line-a" /><span class="graphic-line line-b" /><span class="graphic-node node-a" /><span class="graphic-node node-b" /><span class="graphic-node node-c" /></div><div class="compare-labels"><span>Purity</span><span>Cost</span><span>Evidence</span></div></div>${button('See buyer fit <span>→</span>', 'button button-dark full-width', 'go-requirements')}<button class="text-button centered">How is this ranked? <span>↗</span></button></div></div>`
}

function requirementsView() {
  return `${intro('Trade · Buyer side', 'Demand you can trust.', 'See what buyers need, understand the fit and prepare a request from the same decision workspace.', button('＋ Ask assistant to find a buyer', 'button button-dark', 'open-assistant'))}<div class="buyer-summary"><div class="buyer-summary-copy"><span class="eyebrow">Market signal</span><h2>85 tonnes of demand match your category</h2><p>Two active buyer needs are compatible with captured CO₂ from your facility. One still needs a composition check.</p>${button('Explore matches <span>→</span>', 'button button-light', 'go-marketplace')}</div><div class="signal-chart"><div class="chart-label"><span>Demand by month</span><span>Oct – Dec 2026</span></div><div class="bars"><i style="height:43%" /><i style="height:67%" /><i style="height:81%" /><i style="height:58%" /><i style="height:88%" /><i style="height:72%" /><i style="height:94%" /></div><div class="chart-axis"><span>Oct</span><span>Nov</span><span>Dec</span></div></div></div><section class="panel requirements-panel"><div class="panel-title"><div><span class="eyebrow">Active buyer needs</span><h3>Where your output could fit</h3></div><button class="filter-button">Sort: best fit <span>⌄</span></button></div><div class="requirements-table"><div class="table-row table-header"><span>Buyer / use</span><span>Need</span><span>Window</span><span>Match</span><span /></div>${requirements.map((item) => `<div class="table-row"><div class="buyer-cell"><div class="avatar avatar-blue">${item.buyer.slice(0, 2)}</div><div><strong>${item.title}</strong><small>${item.buyer}</small></div></div><span>${item.need}</span><span>${item.window}</span><span><b class="fit-badge">${item.matches} matches</b><small class="table-status">${item.status}</small></span><button class="icon-button subtle">→</button></div>`).join('')}</div></section>`
}

function requestsView() {
  const requestRow = (initials, color, title, detail, status, tone, time) => `<button class="request-row"><div class="avatar avatar-${color}">${initials}</div><div><strong>${title}</strong><span>${detail}</span></div><div class="request-row-end">${statusPill(status)}<time>${time}</time></div><span>→</span></button>`
  return `${intro('Trade · Workflow', 'Requests, without the back-and-forth.', 'Each request keeps its terms, evidence and status together. The assistant can prepare the next step, while you approve every external action.') }<div class="request-highlight"><div><span class="eyebrow">Needs your attention</span><h2>TerraForm Materials wants 60 t / month</h2><p>They need captured CO₂ at ≥97% purity for mineralization, October through December 2026.</p><div class="request-tags"><span>3-month window</span><span>₹4,850 / t estimate</span><span class="warning-tag">Purity evidence pending</span></div></div><div class="request-actions">${button('Review request <span>→</span>', 'button button-dark')}${button('Ask assistant', 'outlined-button', 'open-assistant')}</div></div><div class="request-layout"><section class="panel request-panel"><div class="panel-title"><div><span class="eyebrow">Open requests</span><h3>Keep the exchange moving</h3></div><button class="filter-button">All statuses <span>⌄</span></button></div><div class="request-list">${requestRow('TF', 'blue', 'TerraForm Materials', '60 t / month · Mineralization feedstock', 'Review needed', 'warning', '12 min ago')}${requestRow('NG', 'green', 'Narmada Growers Co-op', '25 t / month · Greenhouse enrichment', 'Awaiting buyer', 'neutral', 'Yesterday')}${requestRow('PR', 'purple', 'Prithvi Bioethanol', 'Supplier request · 80 t / month', 'Accepted', 'success', '2 days ago')}</div></section><section class="panel request-timeline"><div class="panel-title"><div><span class="eyebrow">Selected workflow</span><h3>TerraForm · 60 t / month</h3></div>${statusPill('Review needed')}</div><div class="timeline">${[['done', 'Buyer requirement received', '12 Sep · 09:29'], ['done', 'Compatibility checked', '96% fit · quality evidence pending'], ['current', 'Seller review', 'Your approval is needed'], ['', 'Request sent', 'Next step'], ['', 'Reservation', 'After acceptance']].map(([status, title, detail]) => `<div class="timeline-item ${status}"><span class="timeline-dot">${status === 'done' ? '✓' : status === 'current' ? '•' : ''}</span><div><strong>${title}</strong><small>${detail}</small></div></div>`).join('')}</div></section></div>`
}

function evidenceView() {
  const evidenceRow = (title, detail, stateName) => `<div class="evidence-row"><span class="evidence-check ${stateName}">${stateName === 'done' ? '✓' : stateName === 'locked' ? '▣' : '!'}</span><div><strong>${title}</strong><small>${detail}</small></div><button class="${stateName === 'needed' ? 'small-action' : 'icon-button subtle'}">${stateName === 'needed' ? 'Add' : stateName === 'next' ? '＋' : '•••'}</button></div>`
  return `${intro('Trust · Evidence vault', 'Make every claim traceable.', 'A potential output becomes a tradable listing only when the right quantity, quality and ownership evidence is reviewed.') }<div class="evidence-banner"><div class="evidence-banner-icon">▣</div><div><strong>3 items need your attention</strong><p>Adding these details will unlock the CO₂ listing draft. Your other marketplace listings stay unchanged.</p></div>${button('Upload evidence <span>↑</span>', 'button button-dark')}</div><div class="evidence-layout"><section class="panel checklist-panel"><div class="panel-title"><div><span class="eyebrow">CO₂ opportunity · opp-001</span><h3>Listing readiness</h3></div><span class="readiness">42% ready</span></div><div class="readiness-bar"><span style="width:42%" /></div>${evidenceRow('Process description', 'Captured from your process draft', 'done')}${evidenceRow('Capture quantity', 'Monthly amount and measurement basis', 'needed')}${evidenceRow('Composition / purity', 'Latest analysis or lab document', 'needed')}${evidenceRow('Collection and storage', 'How the stream is captured and held', 'next')}${evidenceRow('Reviewer approval', 'Required before public publishing', 'locked')}</section><section class="panel source-panel"><div class="panel-title"><div><span class="eyebrow">Source trail</span><h3>What the assistant used</h3></div><button class="icon-button subtle">•••</button></div>${sourceRow('Your process', 'Ethanol process description', 'Aster Fermentation · edited 12 Sep', false)}${sourceRow('Reviewed source', 'CO₂ capture pathway overview', 'CarbonBridge knowledge · v1.2', false)}${sourceRow('Needs source', 'Monthly capture quantity', 'No source attached', true)}<div class="source-note"><span>✦</span><p>AI suggestions include their source and confidence. You can correct or reject each one.</p></div></section></div><section class="opportunity-evidence"><span class="eyebrow">All opportunities</span><div class="opportunity-evidence-row">${opportunities.map((item) => `<div><span class="mini-icon ${item.tone}">${item.icon}</span><strong>${item.title}</strong>${statusPill(item.status)}<button class="text-button">Open →</button></div>`).join('')}</div></section>`
}

function sourceRow(type, title, detail, muted) {
  return `<div class="source-row ${muted ? 'muted' : ''}"><span class="source-icon">${muted ? '?' : type === 'Reviewed source' ? '◈' : '✎'}</span><div><span>${type}</span><strong>${title}</strong><small>${detail}</small></div><button class="icon-button subtle">↗</button></div>`
}

function reportsView() {
  return `${intro('Impact · Reports', 'See what is moving.', 'Reports are generated from saved records and snapshots, so a number has a source, a date and a clear boundary.', button('＋ New report', 'button button-dark'))}<div class="report-filter"><span class="eyebrow">Reporting period</span><button class="select-field">01 Jul – 30 Sep 2026 <span>⌄</span></button><button class="filter-button">All activity <span>⌄</span></button><span class="report-updated">Updated today at 09:40</span></div><div class="report-metrics">${metric('Captured CO₂ listed', '360 t', '3 supply streams', '◌', 'green')}${metric('Matched demand', '85 t', '2 buyer requirements', '◎', 'blue')}${metric('Material moved', '42 t', 'Accepted and recorded', '↗', 'gold')}${metric('Evidence coverage', '78%', 'Across active records', '▣', 'purple')}</div><div class="report-grid"><section class="panel impact-chart-panel"><div class="panel-title"><div><span class="eyebrow">Activity trend</span><h3>Supply and demand over time</h3></div><div class="chart-legend"><span><i class="green-dot" /> Supply</span><span><i class="blue-dot" /> Demand</span></div></div><div class="large-chart"><div class="y-labels"><span>160 t</span><span>120 t</span><span>80 t</span><span>40 t</span><span>0 t</span></div><div class="chart-lines"><div class="gridline" /><div class="gridline" /><div class="gridline" /><div class="gridline" /><div class="gridline" /><svg viewBox="0 0 620 220" role="img" aria-label="Supply and demand trend chart"><path d="M0,174 C80,160 110,150 165,132 S260,154 312,116 S414,108 464,74 S550,104 620,44" class="supply-line" /><path d="M0,196 C74,188 122,181 165,174 S254,181 312,158 S416,170 464,140 S550,142 620,118" class="demand-line" /><circle cx="620" cy="44" r="5" class="supply-point" /><circle cx="620" cy="118" r="5" class="demand-point" /></svg><div class="x-labels"><span>Jul</span><span>Aug</span><span>Sep</span></div></div></div></section><section class="panel report-insight-panel"><div class="panel-title"><div><span class="eyebrow">Assistant insight</span><h3>One thing to act on</h3></div><span class="spark-icon">✦</span></div><div class="insight-quote">“Demand is growing faster than verified supply for high-purity CO₂. Adding the missing composition report could unlock the TerraForm request.”</div><span class="insight-source">Based on 2 requirements · 3 listings · 12 Sep</span>${button('Open action plan <span>→</span>', 'button button-dark full-width')}</section></div>`
}

function assistantCard(kind) {
  if (kind === 'discovery') return `<div class="chat-card discovery-chat-card"><div class="chat-card-header"><span class="mini-icon mint">◌</span><div><span class="eyebrow">Process discovery</span><strong>3 potential outputs found</strong></div>${statusPill('Hypothesis')}</div><div class="chat-output-list"><div><strong>Captured CO₂ stream</strong><span class="chat-confidence">86% signal</span><small>Potentially useful for mineralization or greenhouse enrichment.</small></div><div><strong>Low-grade process heat</strong><span class="chat-confidence">64% signal</span><small>Needs temperature, timing and distance details.</small></div><div><strong>Mineral-rich residue</strong><span class="chat-confidence">51% signal</span><small>Research opportunity until composition is known.</small></div></div><div class="chat-card-footer"><span>✦ 2 source references</span><button class="small-action" data-view="process">Open discovery →</button></div></div>`
  if (kind === 'comparison') return `<div class="chat-card"><div class="chat-card-header"><span class="mini-icon blue">◎</span><div><span class="eyebrow">Match run · saved</span><strong>Best fit for TerraForm Materials</strong></div><span class="match-score">96% fit</span></div><div class="compare-chat-row"><div><strong>Aster Fermentation Works</strong><span>120 t / month · 99.5% CO₂</span></div><strong>₹4,850/t</strong><span class="fit-badge">Best quality</span></div><div class="compare-chat-row"><div><strong>Prithvi Bioethanol</strong><span>80 t / month · 98.8% CO₂</span></div><strong>₹3,900/t</strong><span class="fit-badge secondary">Lower price</span></div><div class="chat-card-footer"><span>Cost includes saved route estimate</span><button class="small-action" data-view="marketplace">Compare all →</button></div></div>`
  if (kind === 'action') return `<div class="chat-card action-chat-card"><div class="chat-card-header"><span class="mini-icon gold">✎</span><div><span class="eyebrow">Action preview</span><strong>Prepare CO₂ listing draft</strong></div>${statusPill('Needs evidence')}</div><div class="action-diff"><div><span>Will create</span><strong>Private listing draft</strong><small>Captured CO₂ · Aster Fermentation</small></div><div><span>Will stay blank</span><strong>Quantity · purity evidence</strong><small>These fields are required to publish.</small></div></div><div class="chat-card-footer"><button class="small-action" data-view="process">Review draft</button><button class="text-button">Why is this blocked? ↗</button></div></div>`
  if (kind === 'checklist') return `<div class="chat-card checklist-chat-card"><div class="chat-card-header"><span class="mini-icon gold">▣</span><div><span class="eyebrow">Evidence checklist</span><strong>2 items unlock the next step</strong></div></div><div class="chat-checklist"><span><i class="empty-check" /> Monthly quantity and basis</span><span><i class="empty-check" /> Latest composition report</span><span class="complete"><i>✓</i> Process description</span></div><div class="chat-card-footer"><span>Nothing is published automatically</span><button class="small-action" data-view="evidence">Open vault →</button></div></div>`
  return `<div class="chat-card report-chat-card"><div class="chat-card-header"><span class="mini-icon purple">▥</span><div><span class="eyebrow">Report ready to configure</span><strong>Activity + evidence coverage</strong></div></div><div class="report-chat-grid"><div><strong>360 t</strong><span>Listed supply</span></div><div><strong>85 t</strong><span>Matched demand</span></div><div><strong>78%</strong><span>Evidence coverage</span></div></div><div class="chat-card-footer"><span>Period: 01 Jul – 30 Sep 2026</span><button class="small-action" data-view="reports">Open report →</button></div></div>`
}

function messagesHtml(messages) {
  return `<div class="chat-messages">${messages.map((message) => `<div class="message-row ${message.role}"><div class="chat-avatar ${message.role}">${message.role === 'assistant' ? '✦' : 'AS'}</div><div class="message-body"><div class="message-bubble">${escapeHtml(message.text)}</div>${message.card ? assistantCard(message.card) : ''}<time>${message.time}</time></div></div>`).join('')}</div>`
}

function composer() {
  return `<div class="suggestion-row"><button data-prompt="What outputs could I sell from this process?">What can I sell?</button><button data-prompt="Find the best buyer for my captured CO₂">Find a buyer</button><button data-prompt="What evidence is missing?">What is missing?</button></div><form class="composer"><button type="button" class="composer-icon" aria-label="Attach a file">＋</button><input name="message" placeholder="Ask CarbonBridge anything…" aria-label="Message CarbonBridge" autocomplete="off" /><button type="button" class="composer-icon" aria-label="Voice input">◉</button><button type="submit" class="send-button" aria-label="Send message">↑</button></form><div class="composer-foot"><span><i /> Assistant uses your workspace context</span><span>Enter to send · Shift + Enter for new line</span></div>`
}

function assistantPanel() {
  return `<aside class="assistant-panel"><div class="assistant-panel-header"><div class="assistant-title"><span class="assistant-spark">✦</span><div><strong>CarbonBridge assistant</strong><span><i /> Ready · Aster workspace</span></div></div><div><button class="icon-button subtle" data-view="assistant" aria-label="Open full assistant">↗</button><button class="icon-button subtle" data-action="close-assistant" aria-label="Close assistant">×</button></div></div><div class="assistant-context"><span>Context</span><button>My ethanol process <b>×</b></button><button>Seller workspace <b>×</b></button></div>${messagesHtml(state.messages.slice(-5))}<div class="assistant-composer">${composer()}</div></aside>`
}

function assistantView() {
  return `<div class="assistant-page">${intro('Your co-pilot · Context-aware', 'Ask, review, act.', 'CarbonBridge coordinates process discovery, marketplace work and evidence checks. You can always open the same records manually.')}<div class="assistant-workspace"><section class="panel full-chat"><div class="full-chat-header"><div><span class="eyebrow">Conversation · 12 September 2026</span><h3>Make the invisible, useful</h3></div><button class="filter-button">Context: process + workspace <span>⌄</span></button></div>${messagesHtml(state.messages)}${composer()}</section><aside class="panel assistant-guardrails"><div class="panel-title"><div><span class="eyebrow">How this works</span><h3>Always reviewable</h3></div><span class="spark-icon">✦</span></div><div class="guardrail"><span class="guardrail-icon">◌</span><div><strong>Hypotheses stay hypotheses</strong><p>The assistant can find a signal, but it cannot turn an estimate into verified inventory.</p></div></div><div class="guardrail"><span class="guardrail-icon">▣</span><div><strong>Evidence travels with the claim</strong><p>Every source, date and reviewer state is visible beside the result.</p></div></div><div class="guardrail"><span class="guardrail-icon">✓</span><div><strong>You approve external actions</strong><p>Publishing, sending requests and commercial changes show a preview first.</p></div></div><div class="guardrail-foot"><span>⌘</span><div><strong>Try a natural-language task</strong><small>“Compare the best options for my next buyer.”</small></div></div></aside></div></div>`
}

function renderView() {
  if (state.view === 'process') return processView()
  if (state.view === 'marketplace') return marketplace()
  if (state.view === 'requirements') return requirementsView()
  if (state.view === 'requests') return requestsView()
  if (state.view === 'evidence') return evidenceView()
  if (state.view === 'reports') return reportsView()
  if (state.view === 'assistant') return assistantView()
  return overview()
}

function assistantResponse(text) {
  const lower = text.toLowerCase()
  if (lower.includes('process') || lower.includes('output') || lower.includes('sell') || lower.includes('generate')) return { text: 'I mapped the process into potential outputs. Select an opportunity to see its assumptions and the evidence needed before it can become a listing.', card: 'discovery', view: 'process' }
  if (lower.includes('match') || lower.includes('buyer') || lower.includes('compare') || lower.includes('deal')) return { text: 'I found compatible buyer needs and compared the current options using purity, availability, distance and delivered cost. The numbers below come from the saved match run.', card: 'comparison', view: lower.includes('buyer') ? 'requirements' : 'marketplace' }
  if (lower.includes('list') || lower.includes('publish') || lower.includes('draft')) return { text: 'I prepared a draft for the captured CO₂ opportunity. Publication is paused because monthly quantity and composition evidence are still missing.', card: 'action', view: 'process' }
  if (lower.includes('evidence') || lower.includes('document') || lower.includes('quality')) return { text: 'Your next high-value step is to add the latest composition report and monthly capture estimate. I’ll keep the opportunity private until a reviewer validates it.', card: 'checklist', view: 'evidence' }
  if (lower.includes('report') || lower.includes('analytics') || lower.includes('impact')) return { text: 'I can generate a reproducible report from your current records. Choose a period and I’ll include quantities, evidence state, matches and environmental activity separately.', card: 'report', view: 'reports' }
  return { text: 'I can help with that. I’ll keep the result grounded in your saved records and show the exact next action.' }
}

function sendMessage(text) {
  const trimmed = text.trim()
  if (!trimmed) return
  const response = assistantResponse(trimmed)
  state.messages.push({ role: 'user', text: trimmed, time: timeNow() }, { role: 'assistant', text: response.text, time: timeNow(), card: response.card })
  if (response.view) state.view = response.view
  state.assistantOpen = state.view !== 'assistant'
  render()
}

function render() {
  document.querySelector('#root').innerHTML = shell()
  const processDescription = document.querySelector('#process-description')
  if (processDescription) processDescription.addEventListener('input', (event) => { state.processText = event.target.value })
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-view], [data-action], [data-prompt], [data-listing]')
  if (!target) return
  if (target.dataset.view) {
    state.view = target.dataset.view
    if (state.view === 'assistant') state.assistantOpen = false
    render()
  }
  if (target.dataset.action === 'open-assistant') { state.assistantOpen = true; render() }
  if (target.dataset.action === 'close-assistant') { state.assistantOpen = false; render() }
  if (target.dataset.action === 'analyze-process') { state.analysisRun = true; state.view = 'process'; render() }
  if (target.dataset.action === 'go-process') { state.view = 'process'; render() }
  if (target.dataset.action === 'go-marketplace') { state.view = 'marketplace'; render() }
  if (target.dataset.action === 'go-requirements') { state.view = 'requirements'; render() }
  if (target.dataset.prompt) sendMessage(target.dataset.prompt)
  if (target.dataset.listing) { state.selectedListing = target.dataset.listing; render() }
})

document.addEventListener('submit', (event) => {
  if (!event.target.matches('.composer')) return
  event.preventDefault()
  const input = event.target.elements.message
  sendMessage(input.value)
})

render()
