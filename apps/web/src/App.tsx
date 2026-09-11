import { useMemo, useState, type FormEvent, type ReactNode } from 'react'

type View = 'overview' | 'process' | 'marketplace' | 'requirements' | 'requests' | 'evidence' | 'reports' | 'assistant'
type MessageRole = 'assistant' | 'user'
type CardKind = 'discovery' | 'opportunity' | 'comparison' | 'action' | 'checklist' | 'report'

type Opportunity = {
  id: string
  title: string
  category: string
  status: 'Potential' | 'Evidence needed' | 'Ready to draft'
  confidence: number
  reason: string
  nextStep: string
  quantity: string
  icon: string
  tone: 'mint' | 'gold' | 'blue' | 'purple'
}

type Listing = {
  id: string
  title: string
  supplier: string
  location: string
  quantity: string
  purity: string
  price: string
  availability: string
  evidence: 'Verified' | 'Partial'
  score: number
  color: string
}

type Message = {
  id: number
  role: MessageRole
  text: string
  time: string
  card?: CardKind
}

const seededOpportunities: Opportunity[] = [
  {
    id: 'opp-001',
    title: 'Captured CO₂ stream',
    category: 'Captured carbon dioxide',
    status: 'Evidence needed',
    confidence: 86,
    reason: 'Your separation step suggests a recoverable CO₂ stream. Actual capture quantity and quality are still unknown.',
    nextStep: 'Add monthly quantity and composition evidence',
    quantity: 'Potential · quantity unknown',
    icon: '◌',
    tone: 'mint',
  },
  {
    id: 'opp-002',
    title: 'Low-grade process heat',
    category: 'Thermal energy opportunity',
    status: 'Potential',
    confidence: 64,
    reason: 'The heat recovery stage may support a nearby user, subject to temperature, timing and distance checks.',
    nextStep: 'Capture outlet temperature and operating hours',
    quantity: 'Potential · no trade category yet',
    icon: '≈',
    tone: 'gold',
  },
  {
    id: 'opp-003',
    title: 'Mineral-rich residue',
    category: 'Material opportunity',
    status: 'Potential',
    confidence: 51,
    reason: 'A solid residue appears in the process description, but composition and safe handling evidence are missing.',
    nextStep: 'Upload composition report or mark as research only',
    quantity: 'Potential · unsupported for listing',
    icon: '◇',
    tone: 'purple',
  },
]

const listings: Listing[] = [
  {
    id: 'cb-1042',
    title: 'Captured CO₂ · food-grade candidate',
    supplier: 'Aster Fermentation Works',
    location: 'Anand, Gujarat',
    quantity: '120 t / month',
    purity: '99.5% CO₂',
    price: '₹4,850 / t',
    availability: '01 Oct – 31 Dec 2026',
    evidence: 'Verified',
    score: 96,
    color: 'green',
  },
  {
    id: 'cb-1077',
    title: 'Captured CO₂ · industrial grade',
    supplier: 'Prithvi Bioethanol',
    location: 'Pune, Maharashtra',
    quantity: '80 t / month',
    purity: '98.8% CO₂',
    price: '₹3,900 / t',
    availability: '15 Sep – 30 Nov 2026',
    evidence: 'Partial',
    score: 88,
    color: 'blue',
  },
  {
    id: 'cb-0991',
    title: 'Captured CO₂ · mineralization input',
    supplier: 'Kaveri Renewables',
    location: 'Raipur, Chhattisgarh',
    quantity: '160 t / month',
    purity: '97.2% CO₂',
    price: '₹3,250 / t',
    availability: '01 Oct – 31 Dec 2026',
    evidence: 'Verified',
    score: 82,
    color: 'orange',
  },
]

const requirements = [
  { title: 'Mineralization feedstock', buyer: 'TerraForm Materials', need: '60 t / month · ≥97% CO₂', window: 'Oct – Dec 2026', matches: 3, status: 'Active' },
  { title: 'Greenhouse enrichment', buyer: 'Narmada Growers Co-op', need: '25 t / month · ≥99% CO₂', window: 'Nov 2026 – Feb 2027', matches: 1, status: 'Needs evidence' },
]

const processSteps = [
  { number: '01', label: 'Fermentation', detail: 'Sugar feedstock converted to ethanol', type: 'input' },
  { number: '02', label: 'Gas separation', detail: 'CO₂-rich gas stream separated', type: 'signal' },
  { number: '03', label: 'Purification', detail: 'Moisture and trace compounds removed', type: 'quality' },
  { number: '04', label: 'Compression', detail: 'Gas stored for dispatch or use', type: 'output' },
]

const navItems: { id: View; label: string; icon: string; section?: string }[] = [
  { id: 'overview', label: 'Overview', icon: '⌂' },
  { id: 'process', label: 'My processes', icon: '◫', section: 'Discover' },
  { id: 'marketplace', label: 'Marketplace', icon: '⌁', section: 'Trade' },
  { id: 'requirements', label: 'Buyer needs', icon: '◎' },
  { id: 'requests', label: 'Requests', icon: '↗' },
  { id: 'evidence', label: 'Evidence vault', icon: '▣', section: 'Trust' },
  { id: 'reports', label: 'Reports', icon: '▥' },
]

function nowLabel() {
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date())
}

function App() {
  const [view, setView] = useState<View>('overview')
  const [assistantOpen, setAssistantOpen] = useState(true)
  const [processText, setProcessText] = useState('We ferment molasses to produce ethanol. The gas separation stage creates a CO₂-rich stream, then we purify and compress it. We currently do not measure the exact monthly quantity.')
  const [analysisRun, setAnalysisRun] = useState(true)
  const [opportunities, setOpportunities] = useState(seededOpportunities)
  const [selectedListing, setSelectedListing] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'assistant', text: 'Hi Ananya. Tell me what your process makes, and I’ll map the useful outputs, evidence gaps and next actions for you.', time: '09:41' },
    { id: 2, role: 'user', text: 'What can I sell from our ethanol process?', time: '09:42' },
    { id: 3, role: 'assistant', text: 'I found three possible resource opportunities. The CO₂ stream is the strongest lead, but I’m keeping the quantity and price blank until we have evidence.', time: '09:42', card: 'discovery' },
  ])

  const pendingEvidence = opportunities.filter((item) => item.status !== 'Ready to draft').length
  const publishedListings = listings.length

  function navigate(next: View) {
    setView(next)
    if (next !== 'assistant') setAssistantOpen(true)
  }

  function analyzeProcess() {
    setAnalysisRun(true)
    setOpportunities(seededOpportunities)
    setView('process')
    const id = Date.now()
    setMessages((current) => [
      ...current,
      { id, role: 'user', text: 'Analyze this process and show me what could become a useful resource.', time: nowLabel() },
      { id: id + 1, role: 'assistant', text: 'Analysis complete. I separated likely outputs from verified inventory and created an evidence checklist for each opportunity.', time: nowLabel(), card: 'discovery' },
    ])
  }

  function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    const lower = trimmed.toLowerCase()
    const id = Date.now()
    let reply = 'I can help with that. I’ll keep the result grounded in your saved records and show the exact next action.'
    let card: CardKind | undefined
    let nextView: View | undefined

    if (lower.includes('process') || lower.includes('output') || lower.includes('sell') || lower.includes('generate')) {
      reply = 'I mapped the process into potential outputs. Select an opportunity to see its assumptions and the evidence needed before it can become a listing.'
      card = 'discovery'
      nextView = 'process'
      setAnalysisRun(true)
    } else if (lower.includes('match') || lower.includes('buyer') || lower.includes('compare') || lower.includes('deal')) {
      reply = 'I found compatible buyer needs and compared the current options using purity, availability, distance and delivered cost. The numbers below come from the saved match run.'
      card = 'comparison'
      nextView = lower.includes('buyer') ? 'requirements' : 'marketplace'
    } else if (lower.includes('list') || lower.includes('publish') || lower.includes('draft')) {
      reply = 'I prepared a draft for the captured CO₂ opportunity. Publication is paused because monthly quantity and composition evidence are still missing.'
      card = 'action'
      nextView = 'process'
    } else if (lower.includes('evidence') || lower.includes('document') || lower.includes('quality')) {
      reply = 'Your next high-value step is to add the latest composition report and monthly capture estimate. I’ll keep the opportunity private until a reviewer validates it.'
      card = 'checklist'
      nextView = 'evidence'
    } else if (lower.includes('report') || lower.includes('analytics') || lower.includes('impact')) {
      reply = 'I can generate a reproducible report from your current records. Choose a period and I’ll include quantities, evidence state, matches and environmental activity separately.'
      card = 'report'
      nextView = 'reports'
    }

    setMessages((current) => [
      ...current,
      { id, role: 'user', text: trimmed, time: nowLabel() },
      { id: id + 1, role: 'assistant', text: reply, time: nowLabel(), card },
    ])
    if (nextView) setView(nextView)
  }

  function handleComposer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const input = form.elements.namedItem('message') as HTMLInputElement
    sendMessage(input.value)
    form.reset()
  }

  const title = useMemo(() => {
    const current = navItems.find((item) => item.id === view)
    return current?.label ?? 'Assistant'
  }, [view])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup" aria-label="CarbonBridge home">
          <div className="brand-mark"><span>↗</span></div>
          <div>
            <strong>carbon<span>bridge</span></strong>
            <small>circular carbon exchange</small>
          </div>
        </div>
        <div className="workspace-switcher">
          <div className="avatar avatar-teal">AF</div>
          <div className="workspace-copy"><strong>Aster Fermentation</strong><span>Seller workspace</span></div>
          <button className="icon-button subtle" aria-label="Switch workspace">⌄</button>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item, index) => (
            <div key={item.id}>
              {item.section && (index === 1 || item.section !== navItems[index - 1]?.section) && <div className="nav-section">{item.section}</div>}
              <button className={`nav-item ${view === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}>
                <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
                {item.id === 'evidence' && <span className="nav-count">3</span>}
                {item.id === 'requests' && <span className="nav-dot" />}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="trust-card"><span className="status-pulse" /> <div><strong>Demo workspace</strong><small>Seed data · safe to explore</small></div></div>
          <button className="nav-item" onClick={() => setAssistantOpen(true)}><span className="nav-icon">✦</span><span>Ask CarbonBridge</span><span className="shortcut">⌘K</span></button>
          <button className="nav-item"><span className="nav-icon">⚙</span><span>Settings</span></button>
          <div className="user-row"><div className="avatar avatar-coral">AS</div><div><strong>Ananya Shah</strong><span>Org admin</span></div><button className="icon-button subtle" aria-label="User menu">•••</button></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{title}</strong></div>
          <div className="topbar-actions">
            <span className="sync-status"><i /> All changes saved</span>
            <button className="icon-button" aria-label="Notifications">♢<span className="notification-dot" /></button>
            <button className="button button-dark button-small" onClick={() => setAssistantOpen(true)}><span>✦</span> Ask assistant</button>
          </div>
        </header>
        <div className="page-scroll">
          {view === 'overview' && <OverviewView navigate={navigate} analyzeProcess={analyzeProcess} opportunities={opportunities} pendingEvidence={pendingEvidence} publishedListings={publishedListings} />}
          {view === 'process' && <ProcessView processText={processText} setProcessText={setProcessText} analysisRun={analysisRun} analyzeProcess={analyzeProcess} opportunities={opportunities} navigate={navigate} />}
          {view === 'marketplace' && <MarketplaceView selectedListing={selectedListing} setSelectedListing={setSelectedListing} navigate={navigate} />}
          {view === 'requirements' && <RequirementsView navigate={navigate} />}
          {view === 'requests' && <RequestsView />}
          {view === 'evidence' && <EvidenceView opportunities={opportunities} />}
          {view === 'reports' && <ReportsView />}
          {view === 'assistant' && <AssistantView messages={messages} handleComposer={handleComposer} sendMessage={sendMessage} />}
        </div>
      </main>

      {assistantOpen && view !== 'assistant' && <AssistantPanel messages={messages} handleComposer={handleComposer} sendMessage={sendMessage} onOpen={() => setView('assistant')} onClose={() => setAssistantOpen(false)} />}
    </div>
  )
}

function PageIntro({ eyebrow, title, children, action }: { eyebrow: string; title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="page-intro"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{children}</p></div>{action && <div className="intro-action">{action}</div>}</div>
}

function OverviewView({ navigate, analyzeProcess, opportunities, pendingEvidence, publishedListings }: { navigate: (view: View) => void; analyzeProcess: () => void; opportunities: Opportunity[]; pendingEvidence: number; publishedListings: number }) {
  return <>
    <PageIntro eyebrow="Tuesday · 12 September 2026" title="Make the invisible, useful."><>Your process creates more value than the final product. CarbonBridge helps you find it, prove it and connect it to the right next user.</></PageIntro>
    <section className="hero-grid">
      <div className="hero-card">
        <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
        <div className="hero-content"><span className="hero-kicker"><i /> Process intelligence</span><h2>What does your process leave behind?</h2><p>Describe it in your own words. We’ll turn the steps into a map of potential resources, evidence gaps and marketplace actions.</p><button className="button button-light" onClick={analyzeProcess}>Describe my process <span>→</span></button><button className="text-button" onClick={() => navigate('assistant')}>Or start with a question <span>↗</span></button></div>
        <div className="hero-footer"><span><b>✦</b> AI-assisted</span><span><b>◈</b> Evidence-aware</span><span><b>↺</b> You stay in control</span></div>
      </div>
      <div className="insight-card"><div className="card-heading"><div><span className="eyebrow">Your latest discovery</span><h3>3 potential opportunities</h3></div><span className="spark-icon">✦</span></div><div className="mini-opportunity-list">{opportunities.map((item) => <div className="mini-opportunity" key={item.id}><span className={`mini-icon ${item.tone}`}>{item.icon}</span><div><strong>{item.title}</strong><span>{item.status}</span></div><span className="confidence">{item.confidence}%</span></div>)}</div><button className="card-link" onClick={() => navigate('process')}>Review discovery <span>→</span></button></div>
    </section>
    <section className="metric-grid">
      <MetricCard label="Published supply" value="360 t" detail={`${publishedListings} active listings`} icon="⌁" tone="green" />
      <MetricCard label="Buyer demand" value="85 t" detail="Across 2 active needs" icon="◎" tone="blue" />
      <MetricCard label="Evidence to review" value={String(pendingEvidence)} detail="Before anything is published" icon="▣" tone="gold" />
      <MetricCard label="Potential avoided" value="1,240 t" detail="Based on recorded activity" icon="◌" tone="purple" />
    </section>
    <section className="split-section">
      <div className="panel timeline-panel"><div className="panel-title"><div><span className="eyebrow">Your workspace</span><h3>Turn an idea into a trusted exchange</h3></div><button className="icon-button subtle">•••</button></div><div className="journey"><JourneyStep number="1" title="Describe" detail="Tell us how your process works" state="current" onClick={() => navigate('process')} /><JourneyStep number="2" title="Discover" detail="See potential outputs and gaps" state="next" onClick={() => navigate('process')} /><JourneyStep number="3" title="Prove" detail="Add quality and quantity evidence" state="next" onClick={() => navigate('evidence')} /><JourneyStep number="4" title="Connect" detail="Find buyers and make a match" state="next" onClick={() => navigate('marketplace')} /></div></div>
      <div className="panel activity-panel"><div className="panel-title"><div><span className="eyebrow">Recent activity</span><h3>What’s moving</h3></div><button className="card-link" onClick={() => navigate('requests')}>View all →</button></div><div className="activity-list"><Activity icon="↗" tone="blue" title="New buyer request" detail="TerraForm Materials · 60 t / month" time="12 min" /><Activity icon="▣" tone="gold" title="Evidence needed" detail="CO₂ composition report" time="1 hr" /><Activity icon="✓" tone="green" title="Listing viewed" detail="Captured CO₂ · industrial grade" time="3 hr" /></div></div>
    </section>
  </>
}

function MetricCard({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: string; tone: string }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div><span className="metric-trend">↗</span></div>
}

function JourneyStep({ number, title, detail, state, onClick }: { number: string; title: string; detail: string; state: string; onClick: () => void }) {
  return <button className={`journey-step ${state}`} onClick={onClick}><span className="journey-number">{state === 'current' ? '●' : number}</span><span><strong>{title}</strong><small>{detail}</small></span><span className="journey-arrow">→</span></button>
}

function Activity({ icon, tone, title, detail, time }: { icon: string; tone: string; title: string; detail: string; time: string }) {
  return <div className="activity-row"><span className={`activity-icon ${tone}`}>{icon}</span><div><strong>{title}</strong><span>{detail}</span></div><time>{time}</time></div>
}

function ProcessView({ processText, setProcessText, analysisRun, analyzeProcess, opportunities, navigate }: { processText: string; setProcessText: (value: string) => void; analysisRun: boolean; analyzeProcess: () => void; opportunities: Opportunity[]; navigate: (view: View) => void }) {
  return <>
    <PageIntro eyebrow="Process intelligence · Draft" title="Describe your process."><>Start with what you know. CarbonBridge will identify potential outputs without treating an estimate as verified inventory.</></PageIntro>
    <div className="process-layout">
      <section className="panel process-editor"><div className="panel-title"><div><span className="eyebrow">Step 1 of 3</span><h3>Tell us what happens</h3></div><span className="draft-badge">Draft saved</span></div><label className="field-label" htmlFor="process-description">Your process in your own words</label><textarea id="process-description" value={processText} onChange={(event) => setProcessText(event.target.value)} rows={8} /><div className="field-hint"><span>✦</span> You don’t need technical terms. Include inputs, steps, outputs and anything you already measure.</div><div className="quick-fields"><div><label>Facility</label><button className="select-field">Aster Fermentation Works <span>⌄</span></button></div><div><label>Operating scale</label><button className="select-field">Approx. 120 t / month <span>⌄</span></button></div></div><div className="editor-footer"><button className="text-button">Save and exit</button><button className="button button-dark" onClick={analyzeProcess}>Analyze my process <span>→</span></button></div></section>
      <section className="panel process-map"><div className="panel-title"><div><span className="eyebrow">Step 2 of 3</span><h3>Process map</h3></div><span className="live-badge"><i /> Live preview</span></div><div className="map-helper">We found these steps from your description. Edit anything that looks wrong.</div><div className="step-list">{processSteps.map((step, index) => <div className="process-step" key={step.number}><span className={`step-node ${step.type}`}>{step.type === 'input' ? '↓' : step.type === 'output' ? '↑' : '•'}</span><div><span className="step-number">{step.number}</span><strong>{step.label}</strong><small>{step.detail}</small></div>{index < processSteps.length - 1 && <span className="step-connector" />}</div>)}</div><button className="outlined-button">＋ Add a step</button></section>
    </div>
    {analysisRun && <section className="discovery-section"><div className="section-heading"><div><span className="eyebrow">Step 3 of 3 · AI-assisted discovery</span><h2>Potential opportunities</h2><p>These are hypotheses from your process. Review the reason and add evidence before creating a marketplace listing.</p></div><button className="text-button" onClick={() => navigate('evidence')}>View evidence vault →</button></div><div className="opportunity-grid">{opportunities.map((item) => <OpportunityCard key={item.id} item={item} onReview={() => navigate('evidence')} />)}</div></section>}
  </>
}

function OpportunityCard({ item, onReview }: { item: Opportunity; onReview: () => void }) {
  return <article className="opportunity-card"><div className="opportunity-top"><span className={`opportunity-icon ${item.tone}`}>{item.icon}</span><span className={`status-pill ${item.status === 'Evidence needed' ? 'warning' : 'neutral'}`}>{item.status}</span></div><h3>{item.title}</h3><p>{item.reason}</p><div className="confidence-row"><span>Confidence in signal</span><strong>{item.confidence}%</strong></div><div className="confidence-bar"><span style={{ width: `${item.confidence}%` }} /></div><div className="opportunity-meta"><span>{item.quantity}</span><button onClick={onReview}>Review next step <span>→</span></button></div></article>
}

function MarketplaceView({ selectedListing, setSelectedListing, navigate }: { selectedListing: string | null; setSelectedListing: (id: string | null) => void; navigate: (view: View) => void }) {
  return <>
    <PageIntro eyebrow="Trade · Captured CO₂" title="Find the right next user."><>Every result is ranked from quality fit, availability, distance and evidence. Prices are shown with their basis and date.</><button className="button button-dark" onClick={() => navigate('process')}>＋ Create a listing</button></PageIntro>
    <div className="market-toolbar"><div className="search-box"><span>⌕</span><input aria-label="Search marketplace" placeholder="Search by material, use or location" /></div><button className="filter-button">Material <span>⌄</span></button><button className="filter-button">Quality <span>⌄</span></button><button className="filter-button">Availability <span>⌄</span></button><span className="result-count">12 results <button className="icon-button subtle">≡</button></span></div>
    <div className="market-layout"><div className="listing-list">{listings.map((listing, index) => <ListingCard listing={listing} key={listing.id} selected={selectedListing === listing.id || (selectedListing === null && index === 0)} onSelect={() => setSelectedListing(listing.id)} />)}</div><div className="panel compare-panel"><div className="panel-title"><div><span className="eyebrow">Decision helper</span><h3>Compare options</h3></div><span className="compare-count">{selectedListing ? '1' : '1'} / 3</span></div><p>Select up to three supply options. We’ll show the quality gaps, delivered estimate and evidence state side by side.</p><div className="compare-preview"><div className="compare-graphic"><span className="graphic-line line-a" /><span className="graphic-line line-b" /><span className="graphic-node node-a" /><span className="graphic-node node-b" /><span className="graphic-node node-c" /></div><div className="compare-labels"><span>Purity</span><span>Cost</span><span>Evidence</span></div></div><button className="button button-dark full-width" onClick={() => navigate('requirements')}>See buyer fit <span>→</span></button><button className="text-button centered">How is this ranked? <span>↗</span></button></div></div>
  </>
}

function ListingCard({ listing, selected, onSelect }: { listing: Listing; selected: boolean; onSelect: () => void }) {
  return <article className={`listing-card ${selected ? 'selected' : ''}`} onClick={onSelect}><div className={`listing-art ${listing.color}`}><span>◌</span><small>CO₂</small></div><div className="listing-main"><div className="listing-heading"><div><span className="match-score">{listing.score}% fit</span><h3>{listing.title}</h3><p>{listing.supplier} · {listing.location}</p></div><button className={`select-circle ${selected ? 'checked' : ''}`} aria-label={`Select ${listing.title}`}>{selected ? '✓' : ''}</button></div><div className="listing-facts"><span><b>Quantity</b>{listing.quantity}</span><span><b>Purity</b>{listing.purity}</span><span><b>Price</b>{listing.price}</span><span><b>Available</b>{listing.availability}</span></div><div className="listing-footer"><span className={`evidence-state ${listing.evidence === 'Verified' ? 'verified' : 'partial'}`}><i /> {listing.evidence} evidence</span><button className="text-button">View details →</button></div></div></article>
}

function RequirementsView({ navigate }: { navigate: (view: View) => void }) {
  return <><PageIntro eyebrow="Trade · Buyer side" title="Demand you can trust."><>See what buyers need, understand the fit and prepare a request from the same decision workspace.</><button className="button button-dark" onClick={() => navigate('assistant')}>＋ Ask assistant to find a buyer</button></PageIntro><div className="buyer-summary"><div className="buyer-summary-copy"><span className="eyebrow">Market signal</span><h2>85 tonnes of demand match your category</h2><p>Two active buyer needs are compatible with captured CO₂ from your facility. One still needs a composition check.</p><button className="button button-light">Explore matches <span>→</span></button></div><div className="signal-chart"><div className="chart-label"><span>Demand by month</span><span>Oct – Dec 2026</span></div><div className="bars"><i style={{ height: '43%' }} /><i style={{ height: '67%' }} /><i style={{ height: '81%' }} /><i style={{ height: '58%' }} /><i style={{ height: '88%' }} /><i style={{ height: '72%' }} /><i style={{ height: '94%' }} /></div><div className="chart-axis"><span>Oct</span><span>Nov</span><span>Dec</span></div></div></div><section className="panel requirements-panel"><div className="panel-title"><div><span className="eyebrow">Active buyer needs</span><h3>Where your output could fit</h3></div><button className="filter-button">Sort: best fit <span>⌄</span></button></div><div className="requirements-table"><div className="table-row table-header"><span>Buyer / use</span><span>Need</span><span>Window</span><span>Match</span><span /></div>{requirements.map((requirement) => <div className="table-row" key={requirement.title}><div className="buyer-cell"><div className="avatar avatar-blue">{requirement.buyer.slice(0, 2)}</div><div><strong>{requirement.title}</strong><small>{requirement.buyer}</small></div></div><span>{requirement.need}</span><span>{requirement.window}</span><span><b className="fit-badge">{requirement.matches} matches</b><small className="table-status">{requirement.status}</small></span><button className="icon-button subtle" aria-label={`View ${requirement.title}`}>→</button></div>)}</div></section></>
}

function RequestsView() {
  return <><PageIntro eyebrow="Trade · Workflow" title="Requests, without the back-and-forth."><>Each request keeps its terms, evidence and status together. The assistant can prepare the next step, while you approve every external action.</></PageIntro><div className="request-highlight"><div><span className="eyebrow">Needs your attention</span><h2>TerraForm Materials wants 60 t / month</h2><p>They need captured CO₂ at ≥97% purity for mineralization, October through December 2026.</p><div className="request-tags"><span>3-month window</span><span>₹4,850 / t estimate</span><span className="warning-tag">Purity evidence pending</span></div></div><div className="request-actions"><button className="button button-dark">Review request <span>→</span></button><button className="outlined-button">Ask assistant</button></div></div><div className="request-layout"><section className="panel request-panel"><div className="panel-title"><div><span className="eyebrow">Open requests</span><h3>Keep the exchange moving</h3></div><button className="filter-button">All statuses <span>⌄</span></button></div><div className="request-list"><RequestRow initials="TF" color="blue" title="TerraForm Materials" detail="60 t / month · Mineralization feedstock" status="Review needed" statusTone="warning" time="12 min ago" /><RequestRow initials="NG" color="green" title="Narmada Growers Co-op" detail="25 t / month · Greenhouse enrichment" status="Awaiting buyer" statusTone="neutral" time="Yesterday" /><RequestRow initials="PR" color="purple" title="Prithvi Bioethanol" detail="Supplier request · 80 t / month" status="Accepted" statusTone="success" time="2 days ago" /></div></section><section className="panel request-timeline"><div className="panel-title"><div><span className="eyebrow">Selected workflow</span><h3>TerraForm · 60 t / month</h3></div><span className="status-pill warning">Review needed</span></div><div className="timeline"><TimelineItem done title="Buyer requirement received" detail="12 Sep · 09:29" /><TimelineItem done title="Compatibility checked" detail="96% fit · quality evidence pending" /><TimelineItem current title="Seller review" detail="Your approval is needed" /><TimelineItem title="Request sent" detail="Next step" /><TimelineItem title="Reservation" detail="After acceptance" /></div></section></div></>
}

function RequestRow({ initials, color, title, detail, status, statusTone, time }: { initials: string; color: string; title: string; detail: string; status: string; statusTone: string; time: string }) {
  return <button className="request-row"><div className={`avatar avatar-${color}`}>{initials}</div><div><strong>{title}</strong><span>{detail}</span></div><div className="request-row-end"><span className={`status-pill ${statusTone}`}>{status}</span><time>{time}</time></div><span>→</span></button>
}

function TimelineItem({ done, current, title, detail }: { done?: boolean; current?: boolean; title: string; detail: string }) {
  return <div className={`timeline-item ${done ? 'done' : ''} ${current ? 'current' : ''}`}><span className="timeline-dot">{done ? '✓' : current ? '•' : ''}</span><div><strong>{title}</strong><small>{detail}</small></div></div>
}

function EvidenceView({ opportunities }: { opportunities: Opportunity[] }) {
  return <><PageIntro eyebrow="Trust · Evidence vault" title="Make every claim traceable."><>A potential output becomes a tradable listing only when the right quantity, quality and ownership evidence is reviewed.</></PageIntro><div className="evidence-banner"><div className="evidence-banner-icon">▣</div><div><strong>3 items need your attention</strong><p>Adding these details will unlock the CO₂ listing draft. Your other marketplace listings stay unchanged.</p></div><button className="button button-dark">Upload evidence <span>↑</span></button></div><div className="evidence-layout"><section className="panel checklist-panel"><div className="panel-title"><div><span className="eyebrow">CO₂ opportunity · opp-001</span><h3>Listing readiness</h3></div><span className="readiness">42% ready</span></div><div className="readiness-bar"><span style={{ width: '42%' }} /></div><EvidenceRow title="Process description" detail="Captured from your process draft" state="done" /><EvidenceRow title="Capture quantity" detail="Monthly amount and measurement basis" state="needed" /><EvidenceRow title="Composition / purity" detail="Latest analysis or lab document" state="needed" /><EvidenceRow title="Collection and storage" detail="How the stream is captured and held" state="next" /><EvidenceRow title="Reviewer approval" detail="Required before public publishing" state="locked" /></section><section className="panel source-panel"><div className="panel-title"><div><span className="eyebrow">Source trail</span><h3>What the assistant used</h3></div><button className="icon-button subtle">•••</button></div><SourceRow type="Your process" title="Ethanol process description" detail="Aster Fermentation · edited 12 Sep" /><SourceRow type="Reviewed source" title="CO₂ capture pathway overview" detail="CarbonBridge knowledge · v1.2" /><SourceRow type="Needs source" title="Monthly capture quantity" detail="No source attached" muted /><div className="source-note"><span>✦</span><p>AI suggestions include their source and confidence. You can correct or reject each one.</p></div></section></div><section className="opportunity-evidence"><span className="eyebrow">All opportunities</span><div className="opportunity-evidence-row">{opportunities.map((item) => <div key={item.id}><span className={`mini-icon ${item.tone}`}>{item.icon}</span><strong>{item.title}</strong><span className={`status-pill ${item.status === 'Evidence needed' ? 'warning' : 'neutral'}`}>{item.status}</span><button className="text-button">Open →</button></div>)}</div></section></>
}

function EvidenceRow({ title, detail, state }: { title: string; detail: string; state: string }) {
  return <div className="evidence-row"><span className={`evidence-check ${state}`}>{state === 'done' ? '✓' : state === 'locked' ? '▣' : '!'}</span><div><strong>{title}</strong><small>{detail}</small></div><button className={state === 'needed' ? 'small-action' : 'icon-button subtle'}>{state === 'needed' ? 'Add' : state === 'next' ? '＋' : '•••'}</button></div>
}

function SourceRow({ type, title, detail, muted }: { type: string; title: string; detail: string; muted?: boolean }) {
  return <div className={`source-row ${muted ? 'muted' : ''}`}><span className="source-icon">{muted ? '?' : type === 'Reviewed source' ? '◈' : '✎'}</span><div><span>{type}</span><strong>{title}</strong><small>{detail}</small></div><button className="icon-button subtle">↗</button></div>
}

function ReportsView() {
  return <><PageIntro eyebrow="Impact · Reports" title="See what is moving."><>Reports are generated from saved records and snapshots, so a number has a source, a date and a clear boundary.</><button className="button button-dark">＋ New report</button></PageIntro><div className="report-filter"><span className="eyebrow">Reporting period</span><button className="select-field">01 Jul – 30 Sep 2026 <span>⌄</span></button><button className="filter-button">All activity <span>⌄</span></button><span className="report-updated">Updated today at 09:40</span></div><div className="report-metrics"><MetricCard label="Captured CO₂ listed" value="360 t" detail="3 supply streams" icon="◌" tone="green" /><MetricCard label="Matched demand" value="85 t" detail="2 buyer requirements" icon="◎" tone="blue" /><MetricCard label="Material moved" value="42 t" detail="Accepted and recorded" icon="↗" tone="gold" /><MetricCard label="Evidence coverage" value="78%" detail="Across active records" icon="▣" tone="purple" /></div><div className="report-grid"><section className="panel impact-chart-panel"><div className="panel-title"><div><span className="eyebrow">Activity trend</span><h3>Supply and demand over time</h3></div><div className="chart-legend"><span><i className="green-dot" /> Supply</span><span><i className="blue-dot" /> Demand</span></div></div><div className="large-chart"><div className="y-labels"><span>160 t</span><span>120 t</span><span>80 t</span><span>40 t</span><span>0 t</span></div><div className="chart-lines"><div className="gridline" /><div className="gridline" /><div className="gridline" /><div className="gridline" /><div className="gridline" /><svg viewBox="0 0 620 220" role="img" aria-label="Supply and demand trend chart"><path d="M0,174 C80,160 110,150 165,132 S260,154 312,116 S414,108 464,74 S550,104 620,44" className="supply-line" /><path d="M0,196 C74,188 122,181 165,174 S254,181 312,158 S416,170 464,140 S550,142 620,118" className="demand-line" /><circle cx="620" cy="44" r="5" className="supply-point" /><circle cx="620" cy="118" r="5" className="demand-point" /></svg><div className="x-labels"><span>Jul</span><span>Aug</span><span>Sep</span></div></div></div></section><section className="panel report-insight-panel"><div className="panel-title"><div><span className="eyebrow">Assistant insight</span><h3>One thing to act on</h3></div><span className="spark-icon">✦</span></div><div className="insight-quote">“Demand is growing faster than verified supply for high-purity CO₂. Adding the missing composition report could unlock the TerraForm request.”</div><span className="insight-source">Based on 2 requirements · 3 listings · 12 Sep</span><button className="button button-dark full-width">Open action plan <span>→</span></button></section></div></>
}

function DiscoveryCard({ compact = false }: { compact?: boolean }) {
  return <div className={`chat-card discovery-chat-card ${compact ? 'compact' : ''}`}><div className="chat-card-header"><span className="mini-icon mint">◌</span><div><span className="eyebrow">Process discovery</span><strong>3 potential outputs found</strong></div><span className="status-pill neutral">Hypothesis</span></div><div className="chat-output-list"><div><strong>Captured CO₂ stream</strong><span className="chat-confidence">86% signal</span><small>Potentially useful for mineralization or greenhouse enrichment.</small></div><div><strong>Low-grade process heat</strong><span className="chat-confidence">64% signal</span><small>Needs temperature, timing and distance details.</small></div><div><strong>Mineral-rich residue</strong><span className="chat-confidence">51% signal</span><small>Research opportunity until composition is known.</small></div></div><div className="chat-card-footer"><span>✦ 2 source references</span><button className="small-action">Open discovery →</button></div></div>
}

function ComparisonCard() {
  return <div className="chat-card"><div className="chat-card-header"><span className="mini-icon blue">◎</span><div><span className="eyebrow">Match run · saved</span><strong>Best fit for TerraForm Materials</strong></div><span className="match-score">96% fit</span></div><div className="compare-chat-row"><div><strong>Aster Fermentation Works</strong><span>120 t / month · 99.5% CO₂</span></div><strong>₹4,850/t</strong><span className="fit-badge">Best quality</span></div><div className="compare-chat-row"><div><strong>Prithvi Bioethanol</strong><span>80 t / month · 98.8% CO₂</span></div><strong>₹3,900/t</strong><span className="fit-badge secondary">Lower price</span></div><div className="chat-card-footer"><span>Cost includes saved route estimate</span><button className="small-action">Compare all →</button></div></div>
}

function ActionCard() {
  return <div className="chat-card action-chat-card"><div className="chat-card-header"><span className="mini-icon gold">✎</span><div><span className="eyebrow">Action preview</span><strong>Prepare CO₂ listing draft</strong></div><span className="status-pill warning">Needs evidence</span></div><div className="action-diff"><div><span>Will create</span><strong>Private listing draft</strong><small>Captured CO₂ · Aster Fermentation</small></div><div><span>Will stay blank</span><strong>Quantity · purity evidence</strong><small>These fields are required to publish.</small></div></div><div className="chat-card-footer"><button className="small-action">Review draft</button><button className="text-button">Why is this blocked? ↗</button></div></div>
}

function ChecklistCard() {
  return <div className="chat-card checklist-chat-card"><div className="chat-card-header"><span className="mini-icon gold">▣</span><div><span className="eyebrow">Evidence checklist</span><strong>2 items unlock the next step</strong></div></div><div className="chat-checklist"><span><i className="empty-check" /> Monthly quantity and basis</span><span><i className="empty-check" /> Latest composition report</span><span className="complete"><i>✓</i> Process description</span></div><div className="chat-card-footer"><span>Nothing is published automatically</span><button className="small-action">Open vault →</button></div></div>
}

function ReportChatCard() {
  return <div className="chat-card report-chat-card"><div className="chat-card-header"><span className="mini-icon purple">▥</span><div><span className="eyebrow">Report ready to configure</span><strong>Activity + evidence coverage</strong></div></div><div className="report-chat-grid"><div><strong>360 t</strong><span>Listed supply</span></div><div><strong>85 t</strong><span>Matched demand</span></div><div><strong>78%</strong><span>Evidence coverage</span></div></div><div className="chat-card-footer"><span>Period: 01 Jul – 30 Sep 2026</span><button className="small-action">Open report →</button></div></div>
}

function ChatCard({ kind }: { kind: CardKind }) {
  if (kind === 'discovery') return <DiscoveryCard />
  if (kind === 'comparison') return <ComparisonCard />
  if (kind === 'action') return <ActionCard />
  if (kind === 'checklist') return <ChecklistCard />
  if (kind === 'report') return <ReportChatCard />
  return <DiscoveryCard compact />
}

function ChatMessages({ messages }: { messages: Message[] }) {
  return <div className="chat-messages">{messages.map((message) => <div className={`message-row ${message.role}`} key={message.id}><div className={`chat-avatar ${message.role}`}>{message.role === 'assistant' ? '✦' : 'AS'}</div><div className="message-body"><div className="message-bubble">{message.text}</div>{message.card && <ChatCard kind={message.card} />}<time>{message.time}</time></div></div>)}</div>
}

function Composer({ handleComposer, sendMessage }: { handleComposer: (event: FormEvent<HTMLFormElement>) => void; sendMessage: (text: string) => void }) {
  return <><div className="suggestion-row"><button onClick={() => sendMessage('What outputs could I sell from this process?')}>What can I sell?</button><button onClick={() => sendMessage('Find the best buyer for my captured CO₂')}>Find a buyer</button><button onClick={() => sendMessage('What evidence is missing?')}>What is missing?</button></div><form className="composer" onSubmit={handleComposer}><button type="button" className="composer-icon" aria-label="Attach a file">＋</button><input name="message" placeholder="Ask CarbonBridge anything…" aria-label="Message CarbonBridge" autoComplete="off" /><button type="button" className="composer-icon" aria-label="Voice input">◉</button><button type="submit" className="send-button" aria-label="Send message">↑</button></form><div className="composer-foot"><span><i /> Assistant uses your workspace context</span><span>Enter to send · Shift + Enter for new line</span></div></>
}

function AssistantPanel({ messages, handleComposer, sendMessage, onOpen, onClose }: { messages: Message[]; handleComposer: (event: FormEvent<HTMLFormElement>) => void; sendMessage: (text: string) => void; onOpen: () => void; onClose: () => void }) {
  return <aside className="assistant-panel"><div className="assistant-panel-header"><div className="assistant-title"><span className="assistant-spark">✦</span><div><strong>CarbonBridge assistant</strong><span><i /> Ready · Aster workspace</span></div></div><div><button className="icon-button subtle" onClick={onOpen} aria-label="Open full assistant">↗</button><button className="icon-button subtle" onClick={onClose} aria-label="Close assistant">×</button></div></div><div className="assistant-context"><span>Context</span><button>My ethanol process <b>×</b></button><button>Seller workspace <b>×</b></button></div><ChatMessages messages={messages.slice(-5)} /><div className="assistant-composer"><Composer handleComposer={handleComposer} sendMessage={sendMessage} /></div></aside>
}

function AssistantView({ messages, handleComposer, sendMessage }: { messages: Message[]; handleComposer: (event: FormEvent<HTMLFormElement>) => void; sendMessage: (text: string) => void }) {
  return <div className="assistant-page"><PageIntro eyebrow="Your co-pilot · Context-aware" title="Ask, review, act."><>CarbonBridge coordinates process discovery, marketplace work and evidence checks. You can always open the same records manually.</></PageIntro><div className="assistant-workspace"><section className="panel full-chat"><div className="full-chat-header"><div><span className="eyebrow">Conversation · 12 September 2026</span><h3>Make the invisible, useful</h3></div><button className="filter-button">Context: process + workspace <span>⌄</span></button></div><ChatMessages messages={messages} /><Composer handleComposer={handleComposer} sendMessage={sendMessage} /></section><aside className="panel assistant-guardrails"><div className="panel-title"><div><span className="eyebrow">How this works</span><h3>Always reviewable</h3></div><span className="spark-icon">✦</span></div><Guardrail icon="◌" title="Hypotheses stay hypotheses" detail="The assistant can find a signal, but it cannot turn an estimate into verified inventory." /><Guardrail icon="▣" title="Evidence travels with the claim" detail="Every source, date and reviewer state is visible beside the result." /><Guardrail icon="✓" title="You approve external actions" detail="Publishing, sending requests and commercial changes show a preview first." /><div className="guardrail-foot"><span>⌘</span><div><strong>Try a natural-language task</strong><small>“Compare the best options for my next buyer.”</small></div></div></aside></div></div>
}

function Guardrail({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return <div className="guardrail"><span className="guardrail-icon">{icon}</span><div><strong>{title}</strong><p>{detail}</p></div></div>
}

export default App
