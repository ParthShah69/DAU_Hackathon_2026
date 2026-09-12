import {
  isDemoMode,
  loadWorkspace,
  createConversation,
  sendConversationMessage,
  discoverProcess,
  approveAction,
  runMatches,
  createRequirement,
  requestAction,
  listDemoActors,
  registerAccount,
  loginAccount,
  logoutAccount,
  persistSession,
  persistDemoActor,
  clearSession,
  clearDemoActor,
  hasChosenDemoActor,
  hasActiveSession,
  getSessionToken,
  getDemoUser,
  listMarketplaceListings,
  getListing,
  createListing,
  publishListing,
  requestListing,
  createProject,
  publishProject,
  createBalanceRequest,
  offerBalanceRequest,
  acceptBalanceRequest,
  declineBalanceRequest,
  createAppreciation,
  asItems,
} from './api.js'

const opportunities = [
  { id: 'opp-001', title: 'Captured CO₂ stream', status: 'Evidence needed', confidence: 86, reason: 'Your separation step suggests a recoverable CO₂ stream. Actual capture quantity and quality are still unknown.', quantity: 'Potential · quantity unknown', icon: '◌', tone: 'mint' },
  { id: 'opp-002', title: 'Low-grade process heat', status: 'Potential', confidence: 64, reason: 'The heat recovery stage may support a nearby user, subject to temperature, timing and distance checks.', quantity: 'Potential · no trade category yet', icon: '≈', tone: 'gold' },
  { id: 'opp-003', title: 'Mineral-rich residue', status: 'Potential', confidence: 51, reason: 'A solid residue appears in the process description, but composition and safe handling evidence are missing.', quantity: 'Potential · unsupported for listing', icon: '◇', tone: 'purple' },
]

const fallbackListingRecords = [
  { id: 'stream-a', name: 'Captured CO2 A', supplierOrganizationId: 'org-carbonstone', sourceIndustry: 'cement', physicalForm: 'gas', location: { city: 'Ahmedabad' }, supply: { totalTonnes: '160', remainingTonnes: '160', start: '2026-10-01', end: '2026-10-31', listedPricePaisePerTonne: 190000, currency: 'INR' }, quality: { purityMolPct: '98.2', evidenceStatus: 'self_reported' }, synthetic: true, source: { kind: 'synthetic_demo', label: 'Degraded demo data' } },
  { id: 'stream-d', name: 'Captured CO2 D', supplierOrganizationId: 'org-carbonstone', sourceIndustry: 'cement', physicalForm: 'gas', location: { city: 'Vadodara' }, supply: { totalTonnes: '120', remainingTonnes: '120', start: '2026-10-01', end: '2026-10-31', listedPricePaisePerTonne: 210000, currency: 'INR' }, quality: { purityMolPct: '96.5', evidenceStatus: 'self_reported' }, synthetic: true, source: { kind: 'synthetic_demo', label: 'Degraded demo data' } },
  { id: 'stream-f', name: 'Captured CO2 F', supplierOrganizationId: 'org-carbonstone', sourceIndustry: 'fertilizer', physicalForm: 'gas', location: { city: 'Surat' }, supply: { totalTonnes: '300', remainingTonnes: '300', start: '2026-10-01', end: '2026-10-31', listedPricePaisePerTonne: 170000, currency: 'INR' }, quality: { purityMolPct: '94.1', evidenceStatus: 'self_reported' }, synthetic: true, source: { kind: 'synthetic_demo', label: 'Degraded demo data' } },
  { id: 'stream-unknown', name: 'New process opportunity', supplierOrganizationId: 'org-carbonstone', sourceIndustry: 'cement', physicalForm: 'gas', location: { city: 'Ahmedabad' }, supply: { totalTonnes: '120', remainingTonnes: '120', start: '2026-10-01', end: '2026-10-31', listedPricePaisePerTonne: 180000, currency: 'INR' }, quality: { purityMolPct: null, evidenceStatus: 'missing' }, synthetic: true, source: { kind: 'synthetic_demo', label: 'Degraded demo data' } },
]

const fallbackDemoActors = [
  { id: 'user-seller', displayName: 'Seller demo', organizationId: 'org-carbonstone', organizationName: 'CarbonStone Materials', organizationKind: 'supplier', roleLabel: 'Production house' },
  { id: 'user-buyer', displayName: 'Buyer demo', organizationId: 'org-greenbuild', organizationName: 'GreenBuild Concrete', organizationKind: 'buyer', roleLabel: 'Buyer' },
  { id: 'user-reviewer', displayName: 'Reviewer demo', organizationId: 'org-climateworks', organizationName: 'ClimateWorks Collective', organizationKind: 'ngo', roleLabel: 'NGO' },
]

const processSteps = [
  ['01', 'Capture', 'Process gas collected at the stack or separator', 'input'],
  ['02', 'Gas separation', 'CO₂-rich gas stream separated', 'signal'],
  ['03', 'Purification', 'Moisture and trace compounds removed', 'quality'],
  ['04', 'Compression', 'Gas stored for dispatch or use', 'output'],
]

const pathForView = {
  overview: '/',
  process: '/processes',
  marketplace: '/marketplace',
  requirements: '/requirements/new',
  requests: '/requests',
  evidence: '/evidence',
  reports: '/reports',
  assistant: '/assistant',
  projects: '/projects',
  balance: '/balance',
  appreciation: '/appreciation',
}

const supplierNames = {
  'org-carbonstone': 'CarbonStone Materials',
  'org-greenbuild': 'GreenBuild Concrete',
  'org-climateworks': 'ClimateWorks Collective',
}

const state = {
  view: viewFromPath(),
  assistantOpen: true,
  selectedListing: null,
  selectedListings: [],
  listingDetail: null,
  listingDetailOpen: false,
  createListingOpen: false,
  marketQuery: '',
  marketFilters: { sourceIndustry: '', minPurityMolPct: '', availableFrom: '', availableTo: '' },
  filterMenu: '',
  processText: 'We ferment molasses to produce ethanol. The gas separation stage creates a CO₂-rich stream, then we purify and compress it. We currently do not measure the exact monthly quantity.',
  analysisRun: true,
  busy: false,
  notice: '',
  conversationId: null,
  pendingActionId: null,
  activeProcessId: null,
  activeRequirementId: null,
  selectedRequestId: null,
  matchRun: null,
  reportGenerated: false,
  data: { listings: [], requirements: [], requests: [], capabilities: null, processes: [], dashboard: null, activity: [], projects: [], balanceRequests: [], participations: [], appreciations: [], me: null },
  live: { status: isDemoMode ? 'demo' : 'connecting', error: null },
  auth: { unlocked: hasActiveSession() || hasChosenDemoActor(), tab: 'login', error: '', form: { displayName: '', email: '', password: '', organizationName: '', organizationKind: 'supplier', city: '' } },
  demoActors: fallbackDemoActors.slice(),
  panels: { settings: false, notifications: false, workspace: false, evidenceNote: false, unavailable: '' },
  evidenceNotes: [],
  messages: [{ role: 'assistant', text: 'Tell me what your process makes, and I’ll map the useful outputs, evidence gaps and next actions for you.', time: '09:41' }],
}

function viewFromPath(pathname = globalThis.location?.pathname || '/') {
  if (pathname === '/assistant') return 'assistant'
  if (pathname.startsWith('/processes')) return 'process'
  if (pathname.startsWith('/marketplace') || pathname.startsWith('/listings')) return 'marketplace'
  if (pathname.startsWith('/requirements')) return 'requirements'
  if (pathname.startsWith('/requests')) return 'requests'
  if (pathname.startsWith('/evidence')) return 'evidence'
  if (pathname.startsWith('/reports')) return 'reports'
  if (pathname.startsWith('/projects')) return 'projects'
  if (pathname.startsWith('/balance')) return 'balance'
  if (pathname.startsWith('/appreciation')) return 'appreciation'
  return 'overview'
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]))
const timeNow = () => new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date())
const statusPill = (status) => `<span class="status-pill ${status === 'Evidence needed' || status === 'Needs evidence' || status === 'Review needed' || status === 'Unavailable' ? 'warning' : status === 'Accepted' || status === 'Published' ? 'success' : 'neutral'}">${escapeHtml(status)}</span>`
const readableStatus = (status) => String(status || 'unknown').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const button = (label, className = 'button button-dark', action = '', extra = '') => `<button class="${className}" ${action ? `data-action="${action}"` : ''} ${extra}>${label}</button>`
const stamp = (label = 'Unavailable') => `<span class="unavailable-stamp">${escapeHtml(label)}</span>`

function numberValue(value, fallback = null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function moneyPerTonne(paise, currency = 'INR') {
  const amount = numberValue(paise)
  if (amount === null) return 'Price unavailable'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount / 100) + ' / t'
}

function dateWindow(start, end) {
  if (!start || !end) return 'Availability unavailable'
  const date = new Date(`${start}T00:00:00Z`)
  const endDate = new Date(`${end}T00:00:00Z`)
  const startLabel = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(date)
  const endLabel = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(endDate)
  return `${startLabel} – ${endLabel}`
}

function initials(value) {
  const parts = String(value || 'CB').trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase() || 'C').join('') || 'CB'
}

function evidenceLabel(status) {
  const value = String(status || 'missing')
  if (value === 'self_reported') return 'Self-reported'
  if (value === 'reviewed') return 'Reviewed'
  if (value === 'verified') return 'Verified'
  if (!status || value === 'missing') return 'Missing'
  return readableStatus(value)
}

function evidenceClass(status) {
  const value = String(status || 'missing')
  if (value === 'verified' || value === 'reviewed') return 'verified'
  if (value === 'self_reported') return 'partial'
  return 'missing'
}

function inferKind(me = state.data.me, actor = currentDemoActor()) {
  const org = me?.currentOrganization
  if (org?.kind) return org.kind
  const orgCaps = org?.capabilities || []
  if (orgCaps.includes('supplier')) return 'supplier'
  if (orgCaps.includes('ngo')) return 'ngo'
  if (orgCaps.includes('buyer')) return 'buyer'
  const roles = me?.capabilities || me?.session?.capabilities || []
  if (roles.includes('supplier_editor') || roles.includes('supplier')) return 'supplier'
  if (roles.includes('reviewer') || roles.includes('ngo')) return 'ngo'
  if (roles.includes('buyer_editor') || roles.includes('buyer')) return 'buyer'
  if (actor?.kind || actor?.organizationKind) return actor.kind || actor.organizationKind
  return 'buyer'
}

function kindLabel(kind) {
  if (kind === 'supplier' || kind === 'production_house') return 'Production house'
  if (kind === 'ngo' || kind === 'reviewer') return 'NGO'
  if (kind === 'buyer') return 'Buyer'
  return 'Workspace'
}

function currentDemoActor() {
  const id = getDemoUser()
  return state.demoActors.find((actor) => actor.id === id || actor.userId === id) || null
}

function identity() {
  const me = state.data.me
  const actor = currentDemoActor()
  const displayName = me?.user?.displayName || me?.displayName || actor?.displayName || 'Signed-in user'
  const organizationName = me?.currentOrganization?.name || actor?.organizationName || 'CarbonBridge workspace'
  const kind = inferKind(me, actor)
  return {
    displayName,
    organizationName,
    kind,
    kindLabel: kindLabel(kind),
    memberships: me?.memberships || [],
    userId: me?.user?.id || actor?.id || '',
    organizationId: me?.currentOrganization?.id || actor?.organizationId || '',
    email: me?.user?.email || '',
    capabilities: me?.capabilities || [],
    sites: me?.sites || [],
  }
}

function canUseLive() {
  return !isDemoMode && state.live.status !== 'fallback'
}

function navItems() {
  const kind = identity().kind
  const items = [['overview', 'Overview', '⌂']]
  if (kind === 'supplier') items.push(['process', 'My processes', '◫', 'Discover'])
  items.push(['marketplace', 'Marketplace', '⌁', 'Trade'])
  if (kind === 'buyer') items.push(['requirements', 'Buyer needs', '◎'])
  items.push(['requests', 'Requests', '↗'])
  items.push(['assistant', 'Assistant', '✦'])
  if (kind === 'supplier') {
    items.push(['evidence', 'Evidence', '▣', 'Trust'])
    items.push(['balance', 'Balance & NGO help', '◌'])
  }
  if (kind === 'ngo') {
    items.push(['projects', 'Projects', '▣', 'NGO'])
    items.push(['balance', 'Balance requests', '◌'])
    items.push(['appreciation', 'Appreciation', '♡'])
  }
  items.push(['reports', 'Reports', '▥'])
  return items
}

function mapListing(record) {
  const supply = record.supply || record.supplyPeriods?.[0] || {}
  const quality = record.quality || {}
  const purity = quality.purityMolPct === null || quality.purityMolPct === undefined ? 'Purity unavailable' : `${quality.purityMolPct}% CO₂`
  const evidenceStatus = quality.evidenceStatus
  const score = state.matchRun?.results?.find((result) => result.streamId === record.id || result.listingId === record.id)?.score
  const materialTitle = record.name || 'Captured CO₂ listing'
  const sourceLabel = record.source?.label || (record.synthetic ? 'synthetic_demo' : 'Organization-provided')
  return {
    id: record.id,
    title: materialTitle.replace(/\bCO2\b/g, 'CO₂'),
    supplier: supplierNames[record.supplierOrganizationId] || record.supplierName || record.supplierOrganizationId || 'Supplier organization',
    location: record.location?.city || record.city || 'Location unavailable',
    quantity: supply.totalTonnes ? `${supply.remainingTonnes || supply.totalTonnes} t available` : 'Quantity unavailable',
    purity,
    price: moneyPerTonne(supply.listedPricePaisePerTonne, supply.currency),
    availability: dateWindow(supply.start, supply.end),
    evidence: evidenceLabel(evidenceStatus),
    evidenceStatus,
    score: score === null || score === undefined ? null : Math.round(score),
    color: record.sourceIndustry === 'fertilizer' ? 'orange' : record.id?.endsWith('d') ? 'blue' : 'green',
    synthetic: Boolean(record.synthetic),
    sourceLabel,
    sourceIndustry: record.sourceIndustry || '',
    physicalForm: record.physicalForm || 'gas',
    degraded: Boolean(record.source?.label === 'Degraded demo data' || state.live.status === 'fallback'),
    raw: record,
  }
}

function mapRequirement(record) {
  const quantity = record.quantityTonnes ? `${record.quantityTonnes} t` : 'Quantity unavailable'
  const period = dateWindow(record.periodStart, record.periodEnd)
  return {
    id: record.id,
    title: record.name || 'Untitled requirement',
    buyer: supplierNames[record.organizationId] || record.organizationId || 'Buyer organization',
    need: `${quantity} · ≥${record.minimumPurityMolPct || 0}% CO₂`,
    window: period,
    matches: null,
    status: record.state === 'published' ? 'Active' : 'Draft',
    raw: record,
  }
}

function mapRequest(record) {
  return {
    id: record.id,
    title: record.id,
    detail: `${record.quantityTonnes || '?'} t · ${record.status || 'unknown'}`,
    status: record.status || 'Unknown',
    color: 'blue',
    quantityTonnes: record.quantityTonnes,
    raw: record,
  }
}

function listingPassesFilters(item) {
  const filters = state.marketFilters
  if (filters.sourceIndustry && item.sourceIndustry !== filters.sourceIndustry && item.raw?.sourceIndustry !== filters.sourceIndustry) return false
  if (filters.minPurityMolPct) {
    const purity = numberValue(item.raw?.quality?.purityMolPct)
    if (purity === null || purity < Number(filters.minPurityMolPct)) return false
  }
  if (filters.availableFrom) {
    const end = item.raw?.supply?.end
    if (end && end < filters.availableFrom) return false
  }
  if (filters.availableTo) {
    const start = item.raw?.supply?.start
    if (start && start > filters.availableTo) return false
  }
  const query = state.marketQuery.trim().toLowerCase()
  if (query && !`${item.title} ${item.supplier} ${item.location} ${item.purity} ${item.sourceIndustry}`.toLowerCase().includes(query)) return false
  return true
}

function liveListings() {
  if (state.live.status === 'connected') return state.data.listings
  if (state.data.listings.length) return state.data.listings
  return fallbackListingRecords.map((record) => mapListing(record))
}

function visibleListings() {
  return liveListings().filter(listingPassesFilters)
}

function liveRequirements() {
  return state.data.requirements
}

function liveRequests() {
  return state.data.requests
}

function replaceOpportunities(candidates = []) {
  opportunities.splice(0, opportunities.length, ...candidates.map((candidate, index) => ({
    id: candidate.id || `candidate-${index}`,
    title: String(candidate.label || candidate.material || 'Potential resource').replace(/\bCO2\b/g, 'CO₂'),
    status: candidate.status === 'needs_confirmation' ? 'Evidence needed' : candidate.canPublish ? 'Ready to draft' : 'Potential',
    confidence: Math.round(numberValue(candidate.confidence, 0) * (numberValue(candidate.confidence, 0) <= 1 ? 100 : 1)),
    reason: candidate.rationale || candidate.caution || 'This resource needs review before it can be published.',
    nextStep: Array.isArray(candidate.evidenceRequired) && candidate.evidenceRequired.length ? candidate.evidenceRequired[0] : 'Review the evidence checklist',
    quantity: candidate.quantity ? `${candidate.quantity} t` : 'Potential · quantity unknown',
    icon: candidate.material === 'captured_co2' || candidate.material === 'co2_stream' ? '◌' : candidate.material === 'waste_heat' ? '≈' : '◇',
    tone: candidate.material === 'captured_co2' || candidate.material === 'co2_stream' ? 'mint' : candidate.material === 'waste_heat' ? 'gold' : 'purple',
    raw: candidate,
  })))
}

function setNotice(message) {
  state.notice = message
  window.clearTimeout(setNotice.timeout)
  setNotice.timeout = window.setTimeout(() => { state.notice = ''; render() }, 4500)
}

function greetingName() {
  const name = identity().displayName
  if (!name || name === 'Signed-in user' || name === 'Seller demo' || name === 'Buyer demo' || name === 'Reviewer demo') return name === 'Signed-in user' ? 'there' : name
  return name
}

function seedAssistantGreeting() {
  const name = greetingName()
  if (state.messages.length === 1 && state.messages[0].role === 'assistant') {
    state.messages[0] = { role: 'assistant', text: `Hi ${name}. Tell me what your process makes, and I’ll map the useful outputs, evidence gaps and next actions for you.`, time: state.messages[0].time || timeNow() }
  }
}

function navigate(view, { replace = false } = {}) {
  state.view = view
  if (view === 'assistant') state.assistantOpen = false
  const path = pathForView[view] || '/'
  if (globalThis.history && globalThis.location && globalThis.location.pathname !== path) {
    globalThis.history[replace ? 'replaceState' : 'pushState']({}, '', path)
  }
  render()
}

function applyWorkspace(workspace) {
  state.data.listings = (workspace?.listings || []).map(mapListing)
  state.data.requirements = (workspace?.requirements || []).map(mapRequirement)
  state.data.requests = (workspace?.requests || []).map(mapRequest)
  state.data.processes = workspace?.processes || []
  state.data.capabilities = workspace?.capabilities || null
  state.data.me = workspace?.me || state.data.me
  state.data.dashboard = workspace?.dashboard || null
  state.data.activity = workspace?.activity || []
  state.data.projects = workspace?.projects || []
  state.data.balanceRequests = workspace?.balanceRequests || []
  state.data.participations = workspace?.participations || []
  state.data.appreciations = workspace?.appreciations || []
  const latestProcess = state.data.processes.slice().sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')))[0]
  if (latestProcess?.rawDescription) state.processText = latestProcess.rawDescription
  if (state.data.listings[0] && !state.data.listings.some((item) => item.id === state.selectedListing)) state.selectedListing = state.data.listings[0].id
  seedAssistantGreeting()
}

function listingFilterPayload() {
  return {
    q: state.marketQuery.trim(),
    sourceIndustry: state.marketFilters.sourceIndustry,
    minPurityMolPct: state.marketFilters.minPurityMolPct,
    availableFrom: state.marketFilters.availableFrom,
    availableTo: state.marketFilters.availableTo,
    state: 'published',
  }
}

async function refreshListings() {
  if (!canUseLive()) {
    render()
    return
  }
  try {
    const listings = await listMarketplaceListings(listingFilterPayload())
    state.data.listings = asItems(listings).map(mapListing)
  } catch (error) {
    setNotice(error.message)
  }
  render()
}

async function hydrate() {
  if (!hasActiveSession() && !hasChosenDemoActor()) {
    state.auth.unlocked = false
    try {
      if (!isDemoMode) {
        const actors = await listDemoActors()
        const items = asItems(actors)
        if (items.length) state.demoActors = items
      }
    } catch {
      state.demoActors = fallbackDemoActors.slice()
    }
    state.live.status = isDemoMode ? 'demo' : 'connecting'
    render()
    return
  }
  state.auth.unlocked = true
  if (isDemoMode) {
    state.live.status = 'demo'
    seedAssistantGreeting()
    render()
    return
  }
  state.live.status = 'connecting'
  try {
    const workspace = await loadWorkspace(listingFilterPayload())
    applyWorkspace(workspace)
    state.live.status = 'connected'
    if (!state.conversationId) {
      const conversation = await createConversation('CarbonBridge workspace assistant')
      state.conversationId = conversation?.id || null
    }
  } catch (error) {
    state.live.status = 'fallback'
    state.live.error = error.message
    state.data.listings = fallbackListingRecords.map((record) => mapListing(record))
    setNotice(`Live API unavailable. Showing degraded demo data. ${error.message}`)
  }
  render()
}

function messageFromCard(card) {
  if (!card) return {}
  if (card.type === 'process_discovery') {
    replaceOpportunities(card.candidates || [])
    state.activeProcessId = card.process?.id || state.activeProcessId
    state.analysisRun = true
    return { card: 'discovery', payload: card }
  }
  if (card.type === 'match_results') {
    state.matchRun = card
    return { card: 'comparison', payload: { options: card.groups?.compatible || [], ...card } }
  }
  if (card.type === 'comparison') {
    state.matchRun = { ...(state.matchRun || {}), results: card.options || [] }
    return { card: 'comparison', payload: card }
  }
  if (card.type === 'action_preview') {
    state.pendingActionId = card.actionId || null
    return { card: 'action', payload: card }
  }
  if (card.type === 'action_receipt') {
    state.pendingActionId = null
    return { card: 'action', payload: { ...card, status: card.status || 'succeeded' } }
  }
  if (card.type === 'missing_fields') return { card: 'checklist', payload: { fields: card.fields || [] } }
  return {}
}

async function sendLiveMessage(trimmed) {
  if (!state.conversationId) {
    const conversation = await createConversation('CarbonBridge workspace assistant')
    state.conversationId = conversation?.id || null
  }
  if (!state.conversationId) throw new Error('Unable to create an assistant conversation')
  const result = await sendConversationMessage(state.conversationId, trimmed)
  const response = result?.response || {}
  const firstCard = response.cards?.[0]
  const visual = messageFromCard(firstCard)
  if (result?.context) {
    state.activeProcessId = result.context.activeProcessId || state.activeProcessId
    state.activeRequirementId = result.context.activeRequirementId || state.activeRequirementId
  }
  if (firstCard?.type === 'process_discovery') state.view = 'process'
  else if (firstCard?.type === 'match_results' || firstCard?.type === 'comparison') state.view = 'marketplace'
  else if (firstCard?.type === 'action_preview' && /requirement/i.test(firstCard.operation || '')) state.view = 'requirements'
  else if (firstCard?.type === 'action_receipt' && firstCard.operation === 'create_requirement') state.view = 'requirements'
  state.messages.push({ role: 'assistant', text: response.text || 'The workflow completed.', time: timeNow(), ...visual })
}

async function analyzeProcess() {
  const description = state.processText.trim()
  if (!description) {
    setNotice('Describe at least one process step before analyzing.')
    return
  }
  state.analysisRun = false
  state.busy = true
  render()
  try {
    if (!isDemoMode) {
      const result = await discoverProcess(description)
      state.activeProcessId = result.process?.id || null
      replaceOpportunities(result.candidates || [])
      const steps = result.process?.steps || []
      state.data.processSteps = steps.map((step, index) => [String(index + 1).padStart(2, '0'), step.name || step.label || `Step ${index + 1}`, step.description || 'Process step captured from your description', index === 0 ? 'input' : index === steps.length - 1 ? 'output' : 'signal'])
    } else {
      const lower = description.toLowerCase()
      const output = lower.includes('cement') || lower.includes('kiln')
        ? [{ label: 'Captured CO₂ stream', material: 'captured_co2', confidence: 0.82, rationale: 'Capture language suggests a recoverable gas stream; quantity and purity remain unknown.' }, { label: 'Low-grade process heat', material: 'waste_heat', confidence: 0.58, rationale: 'Kiln heat may be useful nearby after temperature and timing checks.' }]
        : lower.includes('textile') || lower.includes('fabric') || lower.includes('sew')
          ? [{ label: 'Textile offcuts', material: 'textile_offcuts', confidence: 0.88, rationale: 'Cutting and sewing commonly create reusable offcuts; composition and volume need evidence.' }, { label: 'Wastewater heat', material: 'waste_heat', confidence: 0.42, rationale: 'Warm process water may carry recoverable heat if a nearby user exists.' }]
          : opportunities.map((item) => ({ label: item.title, material: item.raw?.material || 'captured_co2', confidence: item.confidence / 100, rationale: item.reason }))
      replaceOpportunities(output)
    }
    state.analysisRun = true
    setNotice(`Analysis complete: ${opportunities.length} candidate output${opportunities.length === 1 ? '' : 's'} ready for review.`)
  } catch (error) {
    state.live.error = error.message
    setNotice(error.message)
  } finally {
    state.busy = false
    render()
  }
}

async function runLiveMatch(requirementId) {
  try {
    const result = await runMatches(requirementId)
    state.matchRun = result
    state.data.listings = state.data.listings.map((item) => mapListing(item.raw || item))
    setNotice(`Match complete: ${result.groups?.compatible?.length || result.groups?.needs_evidence?.length || 0} ranked options.`)
    navigate('marketplace')
  } catch (error) {
    setNotice(error.message)
  } finally {
    state.busy = false
    render()
  }
}

async function approveLiveAction(actionId) {
  state.busy = true
  render()
  try {
    if (isDemoMode || state.live.status === 'fallback') {
      setNotice('Demo mode keeps actions as reviewable previews. Start the API and use ?api=/api/v1 to commit this action.')
      return
    }
    const result = await approveAction(actionId)
    state.pendingActionId = null
    state.messages.push({ role: 'assistant', text: result?.status === 'succeeded' ? 'Confirmed. The server recorded the action and returned a receipt.' : 'The server did not commit this action.', time: timeNow(), card: 'action', payload: { ...result, status: result?.status || 'succeeded', actionId } })
    await hydrate()
  } catch (error) {
    setNotice(error.message)
  } finally {
    state.busy = false
    render()
  }
}

async function saveManualRequirement(form) {
  const values = new FormData(form)
  const quantity = Number(values.get('quantityTonnes'))
  const month = String(values.get('deliveryMonth') || '')
  const purity = Number(values.get('minimumPurityMolPct'))
  if (!quantity || !/^\d{4}-\d{2}$/.test(month) || !Number.isFinite(purity)) {
    setNotice('Enter a quantity, delivery month and minimum purity.')
    return
  }
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const payload = { name: 'Manual buyer requirement', siteId: 'site-buyer', periodStart: `${month}-01`, periodEnd: `${month}-${String(lastDay).padStart(2, '0')}`, quantityTonnes: quantity, minimumPurityMolPct: purity, acceptableForms: ['gas'], limits: [] }
  state.busy = true
  render()
  try {
    if (canUseLive()) {
      await createRequirement(payload)
      const workspace = await loadWorkspace(listingFilterPayload())
      applyWorkspace(workspace)
      setNotice('Buyer requirement saved to the workspace.')
    } else {
      const item = mapRequirement({ ...payload, id: `local-requirement-${Date.now()}`, organizationId: identity().organizationId || 'demo-buyer', state: 'published' })
      state.data.requirements = [item, ...state.data.requirements]
      setNotice('Demo requirement added locally. Start the API to persist it.')
    }
  } catch (error) {
    setNotice(error.message)
  } finally {
    state.busy = false
    render()
  }
}

async function manageRequest(requestId, action) {
  const current = state.data.requests.find((item) => item.id === requestId)
  if (!current) return
  state.busy = true
  render()
  try {
    if (isDemoMode || state.live.status === 'fallback') {
      setNotice('Demo mode does not commit request changes. Start the API to use the workflow controls.')
      return
    }
    await requestAction(requestId, action, current.raw?.version || 1)
    const workspace = await loadWorkspace(listingFilterPayload())
    applyWorkspace(workspace)
    setNotice(`Request ${action} action completed.`)
  } catch (error) {
    setNotice(error.message)
  } finally {
    state.busy = false
    render()
  }
}

function monthToPeriod(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return { periodStart: `${month}-01`, periodEnd: `${month}-${String(lastDay).padStart(2, '0')}` }
}

async function submitListingRequest(form) {
  const listingId = state.listingDetail?.id || state.selectedListing
  const values = new FormData(form)
  const quantityTonnes = Number(values.get('quantityTonnes'))
  const month = String(values.get('deliveryMonth') || '')
  const minimumPurityMolPct = Number(values.get('minimumPurityMolPct'))
  const period = monthToPeriod(month)
  if (!listingId || !quantityTonnes || !period || !Number.isFinite(minimumPurityMolPct)) {
    setNotice('Enter quantity, month and minimum purity to request this supply.')
    return
  }
  state.busy = true
  render()
  try {
    if (!canUseLive()) {
      setNotice('Request this supply needs the live API. Demo mode does not send a buyer request.')
      return
    }
    await requestListing(listingId, { quantityTonnes, periodStart: period.periodStart, periodEnd: period.periodEnd, minimumPurityMolPct, requirementId: state.activeRequirementId || undefined })
    const workspace = await loadWorkspace(listingFilterPayload())
    applyWorkspace(workspace)
    setNotice('Buyer request sent to the production house.')
    navigate('requests')
  } catch (error) {
    setNotice(error.message)
  } finally {
    state.busy = false
    render()
  }
}

async function submitCreateListing(form) {
  const values = new FormData(form)
  const name = String(values.get('name') || '').trim()
  const siteId = String(values.get('siteId') || '').trim()
  const city = String(values.get('city') || '').trim()
  const sourceIndustry = String(values.get('sourceIndustry') || 'unspecified')
  const physicalForm = String(values.get('physicalForm') || 'gas')
  const purityMolPct = Number(values.get('purityMolPct'))
  const totalTonnes = Number(values.get('totalTonnes'))
  const start = String(values.get('start') || '')
  const end = String(values.get('end') || '')
  const listedPricePaisePerTonne = Number(values.get('listedPricePaisePerTonne'))
  const shouldPublish = values.get('publish') === 'on'
  if (!name || !totalTonnes || !start || !end || !Number.isFinite(listedPricePaisePerTonne)) {
    setNotice('Name, tonnes, dates and price in paise are required.')
    return
  }
  const payload = {
    name,
    siteId: siteId || undefined,
    city: siteId ? undefined : city,
    sourceIndustry,
    physicalForm,
    quality: Number.isFinite(purityMolPct) ? { purityMolPct, evidenceStatus: 'self_reported' } : undefined,
    supplyPeriods: [{ start, end, totalTonnes, listedPricePaisePerTonne, currency: 'INR' }],
  }
  state.busy = true
  render()
  try {
    if (!canUseLive()) {
      const local = mapListing({ id: `local-listing-${Date.now()}`, ...payload, supplierOrganizationId: identity().organizationId, location: { city: city || 'Unknown city' }, supply: payload.supplyPeriods[0], synthetic: true, source: { label: 'Local draft' } })
      state.data.listings = [local, ...state.data.listings]
      state.createListingOpen = false
      setNotice('Listing drafted locally. Publish requires the live API.')
      return
    }
    const created = await createListing(payload)
    if (shouldPublish && created?.id) await publishListing(created.id, created.version || 1)
    const workspace = await loadWorkspace(listingFilterPayload())
    applyWorkspace(workspace)
    state.createListingOpen = false
    setNotice(shouldPublish ? 'Listing created and publish requested.' : 'Listing draft saved.')
  } catch (error) {
    setNotice(error.message)
  } finally {
    state.busy = false
    render()
  }
}

async function submitBalanceRequest(form) {
  const values = new FormData(form)
  const payload = {
    estimatedTonnesCo2e: Number(values.get('estimatedTonnesCo2e')),
    city: String(values.get('city') || '').trim(),
    preferredSupport: [String(values.get('preferredSupport') || 'labor')],
    message: String(values.get('message') || '').trim(),
  }
  if (!payload.estimatedTonnesCo2e || !payload.city || !payload.message) {
    setNotice('Add estimated tonnes, city and a short message.')
    return
  }
  state.busy = true
  render()
  try {
    if (!canUseLive()) {
      state.data.balanceRequests = [{ id: `local-balance-${Date.now()}`, status: 'open', ...payload, organizationName: identity().organizationName }, ...state.data.balanceRequests]
      setNotice('Help request stored in this session. Live routing needs the API.')
      return
    }
    await createBalanceRequest(payload)
    const workspace = await loadWorkspace(listingFilterPayload())
    applyWorkspace(workspace)
    setNotice('Balance help request submitted. This is not an offset.')
  } catch (error) {
    setNotice(error.message)
  } finally {
    state.busy = false
    render()
  }
}

async function submitProject(form) {
  const values = new FormData(form)
  const payload = {
    title: String(values.get('name') || values.get('title') || '').trim(),
    name: String(values.get('name') || values.get('title') || '').trim(),
    kind: String(values.get('kind') || 'labor'),
    city: String(values.get('city') || '').trim(),
    description: String(values.get('description') || '').trim(),
  }
  if (!payload.title || !payload.description) {
    setNotice('Project name and description are required.')
    return
  }
  state.busy = true
  render()
  try {
    if (!canUseLive()) {
      state.data.projects = [{ id: `local-project-${Date.now()}`, state: 'draft', ...payload, organizationName: identity().organizationName }, ...state.data.projects]
      setNotice('Project stored in this session.')
      return
    }
    const created = await createProject(payload)
    if (values.get('publish') === 'on' && created?.id) await publishProject(created.id)
    const workspace = await loadWorkspace(listingFilterPayload())
    applyWorkspace(workspace)
    setNotice('Project saved.')
  } catch (error) {
    setNotice(error.message)
  } finally {
    state.busy = false
    render()
  }
}

async function submitAppreciation(form) {
  const values = new FormData(form)
  const payload = {
    organizationId: String(values.get('organizationId') || 'org-carbonstone'),
    subjectOrganizationId: String(values.get('organizationId') || 'org-carbonstone'),
    message: String(values.get('message') || '').trim(),
  }
  if (!payload.message) {
    setNotice('Write a short appreciation note.')
    return
  }
  state.busy = true
  render()
  try {
    if (!canUseLive()) {
      state.data.appreciations = [{ id: `local-thanks-${Date.now()}`, ...payload, from: identity().organizationName }, ...state.data.appreciations]
      setNotice('Appreciation recorded in this session.')
      return
    }
    await createAppreciation(payload)
    const workspace = await loadWorkspace(listingFilterPayload())
    applyWorkspace(workspace)
    setNotice('Appreciation posted.')
  } catch (error) {
    setNotice(error.message)
  } finally {
    state.busy = false
    render()
  }
}

async function offerOnRequest(form) {
  const values = new FormData(form)
  const requestId = String(values.get('requestId') || '')
  const projectId = String(values.get('projectId') || '')
  const note = String(values.get('note') || '')
  if (!requestId || !projectId) {
    setNotice('Choose a balance request and a project to offer.')
    return
  }
  state.busy = true
  render()
  try {
    if (!canUseLive()) {
      setNotice('Offering a project needs the live API.')
      return
    }
    await offerBalanceRequest(requestId, { projectId, note })
    const workspace = await loadWorkspace(listingFilterPayload())
    applyWorkspace(workspace)
    setNotice('Project offered. Support is not an offset.')
  } catch (error) {
    setNotice(error.message)
  } finally {
    state.busy = false
    render()
  }
}

async function decideBalanceOffer(requestId, action) {
  state.busy = true
  render()
  try {
    if (!canUseLive()) {
      setNotice('Accepting or declining an offer needs the live API.')
      return
    }
    if (action === 'accept') await acceptBalanceRequest(requestId)
    else await declineBalanceRequest(requestId)
    const workspace = await loadWorkspace(listingFilterPayload())
    applyWorkspace(workspace)
    setNotice(`Offer ${action}ed.`)
  } catch (error) {
    setNotice(error.message)
  } finally {
    state.busy = false
    render()
  }
}

async function openListingDetail(listingId) {
  state.selectedListing = listingId
  if (!state.selectedListings.includes(listingId)) state.selectedListings = [...state.selectedListings, listingId].slice(-3)
  const local = liveListings().find((item) => item.id === listingId) || null
  state.listingDetail = local
  state.listingDetailOpen = true
  if (canUseLive()) {
    try {
      const record = await getListing(listingId)
      if (record) state.listingDetail = mapListing(record)
    } catch (error) {
      setNotice(error.message)
    }
  }
  render()
}

async function submitAuth(kind, form) {
  const values = new FormData(form)
  const email = String(values.get('email') || '').trim()
  const password = String(values.get('password') || '')
  state.auth.error = ''
  state.busy = true
  render()
  try {
    if (kind === 'register') {
      const payload = {
        displayName: String(values.get('displayName') || '').trim(),
        email,
        password,
        organizationName: String(values.get('organizationName') || '').trim(),
        organizationKind: String(values.get('organizationKind') || 'supplier'),
        city: String(values.get('city') || '').trim(),
      }
      if (!payload.displayName || !payload.email || !payload.password || !payload.organizationName || !payload.city) {
        state.auth.error = 'Fill every registration field.'
        return
      }
      if (isDemoMode) {
        persistSession({ token: `local-${Date.now()}`, user: { displayName: payload.displayName, email: payload.email } })
        state.data.me = { user: { displayName: payload.displayName, email: payload.email }, currentOrganization: { name: payload.organizationName, kind: payload.organizationKind, capabilities: [payload.organizationKind] }, memberships: [], capabilities: [payload.organizationKind === 'ngo' ? 'reviewer' : payload.organizationKind === 'buyer' ? 'buyer_editor' : 'supplier_editor'], session: { local: true } }
        state.auth.unlocked = true
        seedAssistantGreeting()
        setNotice('Local workspace created. Connect the API to persist this registration.')
        return
      }
      const result = await registerAccount(payload)
      persistSession(result)
      clearDemoActor()
      state.data.me = result?.user ? { user: result.user, currentOrganization: result.currentOrganization || result.organization, memberships: result.memberships || [], capabilities: result.capabilities || [], session: result.session } : state.data.me
      state.auth.unlocked = true
      await hydrate()
      return
    }
    if (!email || !password) {
      state.auth.error = 'Email and password are required.'
      return
    }
    if (isDemoMode) {
      persistSession({ token: `local-${Date.now()}`, user: { displayName: email.split('@')[0], email } })
      state.data.me = { user: { displayName: email.split('@')[0], email }, currentOrganization: { name: 'Local workspace', kind: 'buyer', capabilities: ['buyer'] }, memberships: [], capabilities: ['buyer_editor'], session: { local: true } }
      state.auth.unlocked = true
      seedAssistantGreeting()
      setNotice('Signed in locally. Demo mode has no password server.')
      return
    }
    const result = await loginAccount({ email, password })
    persistSession(result)
    clearDemoActor()
    state.data.me = result?.user ? { user: result.user, currentOrganization: result.currentOrganization || result.organization, memberships: result.memberships || [], capabilities: result.capabilities || [], session: result.session } : state.data.me
    state.auth.unlocked = true
    await hydrate()
  } catch (error) {
    state.auth.error = error.message
  } finally {
    state.busy = false
    render()
  }
}

async function chooseDemoActor(actorId) {
  const actor = state.demoActors.find((item) => item.id === actorId || item.userId === actorId)
  persistDemoActor(actor?.id || actorId, actor?.organizationId || '')
  clearSession()
  state.auth.unlocked = true
  if (!state.data.me) {
    state.data.me = {
      user: { displayName: actor?.displayName || 'Demo actor', id: actor?.id },
      currentOrganization: { id: actor?.organizationId, name: actor?.organizationName, kind: actor?.organizationKind, capabilities: [actor?.organizationKind].filter(Boolean) },
      memberships: actor ? [{ organizationId: actor.organizationId, roles: [actor.organizationKind] }] : [],
      capabilities: [actor?.organizationKind].filter(Boolean),
      session: { demoActor: true },
    }
  }
  await hydrate()
}

async function logoutWorkspace() {
  try {
    if (!isDemoMode) await logoutAccount()
  } catch {
    clearSession()
  }
  clearDemoActor()
  clearSession()
  state.auth.unlocked = false
  state.data.me = null
  state.conversationId = null
  state.panels = { settings: false, notifications: false, workspace: false, evidenceNote: false, unavailable: '' }
  setNotice('Signed out.')
  await hydrate()
}

function intro(eyebrow, title, copy, action = '') {
  return `<div class="page-intro"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${copy}</p></div>${action ? `<div class="intro-action">${action}</div>` : ''}</div>`
}

function metric(label, value, detail, icon, tone) {
  const unavailable = value === 'Unavailable' || value === null || value === undefined
  return `<div class="metric-card">${unavailable ? stamp() : ''}<div class="metric-icon ${tone}">${icon}</div><div><span>${label}</span><strong>${escapeHtml(String(unavailable ? '—' : value))}</strong><small>${escapeHtml(detail)}</small></div><span class="metric-trend">↗</span></div>`
}

function overlayPanel(kind, title, body) {
  return `<div class="slide-overlay" data-action="close-${kind}"><aside class="slide-panel" data-stop="true"><div class="panel-title"><div><span class="eyebrow">Workspace</span><h3>${title}</h3></div><button class="icon-button subtle" data-action="close-${kind}" aria-label="Close">×</button></div>${body}</aside></div>`
}

function settingsPanel() {
  const who = identity()
  return overlayPanel('settings', 'Settings', `<div class="settings-body"><p><strong>${escapeHtml(who.displayName)}</strong></p><p>${escapeHtml(who.organizationName)} · ${escapeHtml(who.kindLabel)}</p><p class="muted">API: ${isDemoMode ? 'not configured' : apiStatusLabel()}</p><p class="muted">Session: ${getSessionToken() ? 'Bearer token stored in carbonbridge.session' : hasChosenDemoActor() ? 'Demo actor header' : 'None'}</p>${button('Log out', 'button button-dark', 'logout')}</div>`)
}

function apiStatusLabel() {
  if (state.live.status === 'connected') return 'Connected'
  if (state.live.status === 'fallback') return 'Unavailable — using degraded demo data'
  if (state.live.status === 'demo') return 'Demo mode'
  return 'Checking…'
}

function notificationsPanel() {
  return overlayPanel('notifications', 'Notifications', `<div class="empty-state">${stamp('Unavailable')}<p>No inbox in this prototype. Alerts are not stored or delivered yet.</p></div>`)
}

function unavailablePanel() {
  const message = state.panels.unavailable || 'This control is not wired in the prototype.'
  return overlayPanel('unavailable', 'Unavailable', `<div class="empty-state">${stamp()}<p>${escapeHtml(message)}</p></div>`)
}

function evidenceNotePanel() {
  return overlayPanel('evidence-note', 'Record evidence note', `<form class="evidence-note-form stacked-form"><label class="field-label" for="evidence-title">What did you observe?</label><input id="evidence-title" name="title" required placeholder="e.g. September stack reading" /><label class="field-label" for="evidence-detail">Note</label><textarea id="evidence-detail" name="detail" rows="4" required placeholder="Quantity, method, date, and who measured it"></textarea><p class="field-hint">Recorded locally — upload service is not in this prototype</p><button class="button button-dark" type="submit">Save note</button></form>`)
}

function authScreen() {
  const form = state.auth.form
  const actors = state.demoActors.length ? state.demoActors : fallbackDemoActors
  return `<div class="auth-screen"><div class="auth-card"><div class="brand-lockup"><div class="brand-mark"><span>↗</span></div><div><strong>carbon<span>bridge</span></strong><small>circular carbon exchange</small></div></div><h1>Enter a workspace</h1><p>Production houses, buyers and NGOs register to use the product. NGO help is labor, funding or greening — never an offset or credit retirement.</p>
    <div class="auth-tabs"><button class="${state.auth.tab === 'login' ? 'active' : ''}" data-action="auth-tab" data-tab="login">Log in</button><button class="${state.auth.tab === 'register' ? 'active' : ''}" data-action="auth-tab" data-tab="register">Register</button></div>
    ${state.auth.error ? `<div class="runtime-notice" role="alert">${escapeHtml(state.auth.error)}</div>` : ''}
    ${state.auth.tab === 'register' ? `<form class="auth-register-form stacked-form"><label class="field-label" for="reg-name">Your name</label><input id="reg-name" name="displayName" required value="${escapeHtml(form.displayName)}" /><label class="field-label" for="reg-email">Email</label><input id="reg-email" name="email" type="email" required value="${escapeHtml(form.email)}" /><label class="field-label" for="reg-password">Password</label><input id="reg-password" name="password" type="password" required /><label class="field-label" for="reg-org">Organization</label><input id="reg-org" name="organizationName" required value="${escapeHtml(form.organizationName)}" /><label class="field-label" for="reg-kind">Workspace type</label><select id="reg-kind" name="organizationKind"><option value="supplier"${form.organizationKind === 'supplier' ? ' selected' : ''}>Production house</option><option value="buyer"${form.organizationKind === 'buyer' ? ' selected' : ''}>Buyer</option><option value="ngo"${form.organizationKind === 'ngo' ? ' selected' : ''}>NGO</option></select><label class="field-label" for="reg-city">City</label><input id="reg-city" name="city" required value="${escapeHtml(form.city)}" /><button class="button button-dark full-width" type="submit">${state.busy ? 'Working…' : 'Create workspace'}</button></form>` : `<form class="auth-login-form stacked-form"><label class="field-label" for="login-email">Email</label><input id="login-email" name="email" type="email" required /><label class="field-label" for="login-password">Password</label><input id="login-password" name="password" type="password" required /><button class="button button-dark full-width" type="submit">${state.busy ? 'Working…' : 'Log in'}</button></form>`}
    <div class="demo-picker"><span class="eyebrow">Use demo workspace</span><p>Pick an actor without pretending you registered. This only sets demo headers.</p><div class="demo-actor-grid">${actors.map((actor) => {
      const kind = actor.organizationKind || actor.kind || 'buyer'
      return `<button type="button" class="demo-actor-card" data-action="choose-demo" data-actor="${escapeHtml(actor.id || actor.userId)}"><strong>${escapeHtml(kindLabel(kind))}</strong><span>${escapeHtml(actor.organizationName || actor.organization?.name || 'Demo organization')}</span><small>${escapeHtml(actor.displayName || actor.roleLabel || '')}</small></button>`
    }).join('')}</div></div></div></div>`
}

function workspaceMenu() {
  const who = identity()
  const memberships = who.memberships.length ? who.memberships : state.demoActors.map((actor) => ({ organizationId: actor.organizationId, organizationName: actor.organizationName, roles: [actor.organizationKind], actorId: actor.id }))
  return `<div class="workspace-menu">${memberships.map((membership) => {
    const actor = state.demoActors.find((item) => item.organizationId === membership.organizationId) || {}
    const name = actor.organizationName || membership.organizationName || membership.organizationId
    const kind = actor.organizationKind || membership.roles?.[0] || who.kind
    return `<button type="button" data-action="switch-workspace" data-actor="${escapeHtml(membership.actorId || actor.id || '')}" data-organization="${escapeHtml(membership.organizationId || '')}"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(kindLabel(kind))}</span></button>`
  }).join('')}${state.demoActors.map((actor) => `<button type="button" data-action="choose-demo" data-actor="${escapeHtml(actor.id)}"><strong>${escapeHtml(actor.organizationName)}</strong><span>Demo · ${escapeHtml(kindLabel(actor.organizationKind))}</span></button>`).join('')}</div>`
}

function shell() {
  const items = navItems()
  const pageTitle = items.find(([id]) => id === state.view)?.[1] || 'Assistant'
  const who = identity()
  const runtimeLabel = state.live.status === 'connected' ? 'Connected workspace' : isDemoMode || state.live.status === 'demo' || state.live.status === 'fallback' ? 'Demo workspace' : 'Connecting workspace'
  const runtimeDetail = state.live.status === 'connected' ? 'Live API · session protected' : isDemoMode || state.live.status === 'demo' || state.live.status === 'fallback' ? 'Seed data · safe to explore' : 'Checking API connection…'
  const evidenceCount = opportunities.filter((item) => item.status === 'Evidence needed').length + state.evidenceNotes.length
  return `<div class="app-shell">
    <aside class="sidebar">
      <div class="brand-lockup" aria-label="CarbonBridge home"><div class="brand-mark"><span>↗</span></div><div><strong>carbon<span>bridge</span></strong><small>circular carbon exchange</small></div></div>
      <div class="workspace-switcher"><div class="avatar avatar-teal">${escapeHtml(initials(who.organizationName))}</div><div class="workspace-copy"><strong>${escapeHtml(who.organizationName)}</strong><span>${escapeHtml(who.kindLabel)}</span></div><button class="icon-button subtle" data-action="toggle-workspace" aria-label="Switch workspace">⌄</button>${state.panels.workspace ? workspaceMenu() : ''}</div>
      <nav class="main-nav" aria-label="Main navigation">${items.map((item, index) => `${item[3] && (index === 1 || item[3] !== items[index - 1]?.[3]) ? `<div class="nav-section">${item[3]}</div>` : ''}<button class="nav-item ${state.view === item[0] ? 'active' : ''}" data-view="${item[0]}"><span class="nav-icon">${item[2]}</span><span>${item[1]}</span>${item[0] === 'evidence' && evidenceCount ? `<span class="nav-count">${evidenceCount}</span>` : ''}${item[0] === 'requests' && liveRequests().some((request) => request.status === 'pending_supplier') ? '<span class="nav-dot"></span>' : ''}</button>`).join('')}</nav>
      <div class="sidebar-bottom"><div class="trust-card"><span class="status-pulse"></span><div><strong>${runtimeLabel}</strong><small>${runtimeDetail}</small></div></div><button class="nav-item" data-action="open-assistant"><span class="nav-icon">✦</span><span>Ask CarbonBridge</span><span class="shortcut">⌘K</span></button><button class="nav-item" data-action="open-settings"><span class="nav-icon">⚙</span><span>Settings</span></button><div class="user-row"><div class="avatar avatar-coral">${escapeHtml(initials(who.displayName))}</div><div><strong>${escapeHtml(who.displayName)}</strong><span>${escapeHtml(who.kindLabel)}</span></div><button class="icon-button subtle" data-action="open-settings">•••</button></div></div>
    </aside>
    <main class="main-content"><header class="topbar"><div class="breadcrumbs"><span>Workspace</span><b>/</b><strong>${pageTitle}</strong></div><div class="topbar-actions"><span class="sync-status"><i></i> ${state.busy ? 'Working…' : state.live.status === 'connected' ? 'Live data synced' : 'All changes saved'}</span><button class="icon-button" data-action="open-notifications" aria-label="Notifications">♢</button>${button('<span>✦</span> Ask assistant', 'button button-dark button-small', 'open-assistant')}</div></header><div class="page-scroll">${state.notice ? `<div class="runtime-notice" role="status">${escapeHtml(state.notice)}</div>` : ''}${renderView()}</div></main>
    ${state.assistantOpen && state.view !== 'assistant' ? assistantPanel() : ''}
    ${state.panels.settings ? settingsPanel() : ''}
    ${state.panels.notifications ? notificationsPanel() : ''}
    ${state.panels.evidenceNote ? evidenceNotePanel() : ''}
    ${state.panels.unavailable ? unavailablePanel() : ''}
    ${state.listingDetailOpen ? listingDetailPanel() : ''}
    ${state.createListingOpen ? createListingPanel() : ''}
  </div>`
}

function overview() {
  const dashboard = state.data.dashboard
  const currentListings = liveListings()
  const currentRequirements = liveRequirements()
  const currentRequests = liveRequests()
  const listed = dashboard?.availability?.totalTonnes ?? currentListings.reduce((sum, item) => sum + (numberValue(item.raw?.supply?.remainingTonnes || item.raw?.supply?.totalTonnes, 0)), 0)
  const demand = currentRequirements.reduce((sum, item) => sum + numberValue(item.raw?.quantityTonnes, 0), 0)
  const listingCount = dashboard?.counts?.publishedListings ?? currentListings.length
  const requestCount = dashboard?.counts?.requests ?? currentRequests.length
  const evidenceCount = opportunities.filter((item) => item.status === 'Evidence needed').length
  const sourceKind = dashboard?.source?.kind || dashboard?.source?.label || (state.live.status === 'connected' ? 'live' : 'synthetic_demo')
  const listedValue = state.live.status === 'fallback' || listingCount || dashboard ? `${listed || 0} t` : 'Unavailable'
  const activity = state.data.activity.length ? state.data.activity.slice(0, 3) : []
  return `${intro('Workspace overview', 'Make the invisible, useful.', 'Your process creates more value than the final product. CarbonBridge helps you find it, prove it and connect it to the right next user.')}
    <section class="hero-grid"><div class="hero-card"><div class="hero-orbit orbit-one"></div><div class="hero-orbit orbit-two"></div><div class="hero-content"><span class="hero-kicker"><i></i> Process intelligence</span><h2>What does your process leave behind?</h2><p>Describe it in your own words. We’ll turn the steps into a map of potential resources, evidence gaps and marketplace actions.</p>${button('Describe my process <span>→</span>', 'button button-light', identity().kind === 'supplier' ? 'analyze-process' : 'go-marketplace')}<button class="text-button" data-view="assistant">Or start with a question <span>↗</span></button></div><div class="hero-footer"><span><b>✦</b> AI-assisted</span><span><b>◈</b> Evidence-aware</span><span><b>↺</b> You stay in control</span></div></div><div class="insight-card"><div class="card-heading"><div><span class="eyebrow">Your latest discovery</span><h3>${opportunities.length} potential opportunities</h3></div><span class="spark-icon">✦</span></div><div class="mini-opportunity-list">${opportunities.map((item) => `<div class="mini-opportunity"><span class="mini-icon ${item.tone}">${item.icon}</span><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.status)}</span></div><span class="confidence">${item.confidence}%</span></div>`).join('')}</div><button class="card-link" data-view="${identity().kind === 'supplier' ? 'process' : 'marketplace'}">Review discovery <span>→</span></button></div></section>
    <section class="metric-grid">${metric('Published supply', listedValue, `${listingCount} listings · ${sourceKind}`, '⌁', 'green')}${metric('Buyer demand', demand ? `${demand} t` : (dashboard ? '0 t' : 'Unavailable'), `Across ${currentRequirements.length} active needs`, '◎', 'blue')}${metric('Evidence to review', String(evidenceCount), 'Before anything is published', '▣', 'gold')}${metric('Open workflows', String(requestCount || 0), 'Requests and approvals', '↗', 'purple')}</section>
    <section class="split-section"><div class="panel timeline-panel"><div class="panel-title"><div><span class="eyebrow">Your workspace</span><h3>Turn an idea into a trusted exchange</h3></div></div><div class="journey">${[['1', 'Describe', 'Tell us how your process works', 'current', 'process'], ['2', 'Discover', 'See potential outputs and gaps', 'next', 'process'], ['3', 'Prove', 'Add quality and quantity evidence', 'next', 'evidence'], ['4', 'Connect', 'Find buyers and make a match', 'next', 'marketplace']].map(([number, title, detail, journeyState, view]) => `<button class="journey-step ${journeyState}" data-view="${view}"><span class="journey-number">${journeyState === 'current' ? '●' : number}</span><span><strong>${title}</strong><small>${detail}</small></span><span class="journey-arrow">→</span></button>`).join('')}</div></div><div class="panel activity-panel"><div class="panel-title"><div><span class="eyebrow">Recent activity</span><h3>What’s moving</h3></div><button class="card-link" data-view="requests">View all →</button></div><div class="activity-list">${activity.length ? activity.map((item) => `<div class="activity-row"><span class="activity-icon blue">↗</span><div><strong>${escapeHtml(item.title || item.type || 'Activity')}</strong><span>${escapeHtml(item.detail || item.summary || '')}</span></div><time>${escapeHtml(item.at || item.time || '')}</time></div>`).join('') : `<div class="empty-state">No activity payload yet.</div>`}</div></div></section>`
}

function processView() {
  const who = identity()
  const stepSource = state.data.processSteps?.length ? state.data.processSteps : processSteps
  return `${intro('Process intelligence · Draft', 'Describe your process.', 'Start with what you know. CarbonBridge will identify potential outputs without treating an estimate as verified inventory.')}
    <div class="process-layout"><section class="panel process-editor"><div class="panel-title"><div><span class="eyebrow">Step 1 of 3</span><h3>Tell us what happens</h3></div><span class="draft-badge">${state.live.status === 'connected' ? 'Live draft' : 'Demo draft'}</span></div><label class="field-label" for="process-description">Your process in your own words</label><textarea id="process-description" rows="8">${escapeHtml(state.processText)}</textarea><div class="field-hint"><span>✦</span> You don’t need technical terms. Include inputs, steps, outputs and anything you already measure.</div><div class="quick-fields"><div><label>Facility</label><button class="select-field" type="button">${escapeHtml(who.organizationName)} <span>⌄</span></button></div><div><label>Operating scale</label><button class="select-field" type="button">${state.data.dashboard?.availability?.totalTonnes ? `${state.data.dashboard.availability.totalTonnes} t listed` : 'Unknown until measured'} <span>⌄</span></button></div></div><div class="editor-footer"><button class="text-button" data-action="save-process-exit">Save and exit</button>${button(state.busy ? 'Analyzing…' : 'Analyze my process <span>→</span>', 'button button-dark', 'analyze-process')}</div></section><section class="panel process-map"><div class="panel-title"><div><span class="eyebrow">Step 2 of 3</span><h3>Process map</h3></div><span class="live-badge"><i></i> ${state.live.status === 'connected' ? 'API-backed' : 'Live preview'}</span></div><div class="map-helper">We found these steps from your description. Edit anything that looks wrong.</div><div class="step-list">${stepSource.map((step, index) => `<div class="process-step"><span class="step-node ${step[3]}">${step[3] === 'input' ? '↓' : step[3] === 'output' ? '↑' : '•'}</span><div><span class="step-number">${step[0]}</span><strong>${escapeHtml(step[1])}</strong><small>${escapeHtml(step[2])}</small></div>${index < stepSource.length - 1 ? '<span class="step-connector"></span>' : ''}</div>`).join('')}</div><button class="outlined-button" data-action="unavailable" data-unavailable="Step editing is not in this prototype">${stamp()} ＋ Add a step</button></section></div>
    ${state.analysisRun ? `<section class="discovery-section"><div class="section-heading"><div><span class="eyebrow">Step 3 of 3 · AI-assisted discovery</span><h2>Potential opportunities</h2><p>These are hypotheses from your process. Review the reason and add evidence before creating a marketplace listing.</p></div><button class="text-button" data-view="evidence">View evidence →</button></div><div class="opportunity-grid">${opportunities.map((item) => `<article class="opportunity-card"><div class="opportunity-top"><span class="opportunity-icon ${item.tone}">${item.icon}</span>${statusPill(item.status)}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.reason)}</p><div class="confidence-row"><span>Confidence in signal</span><strong>${item.confidence}%</strong></div><div class="confidence-bar"><span style="width: ${item.confidence}%"></span></div><div class="opportunity-meta"><span>${escapeHtml(item.quantity)}</span><button data-view="evidence">Review next step <span>→</span></button></div></article>`).join('')}</div></section>` : ''}`
}

function filterChip(key, value, label) {
  const active = String(state.marketFilters[key] || '') === String(value)
  return `<button type="button" class="filter-option ${active ? 'active' : ''}" data-action="set-filter" data-filter-key="${key}" data-filter-value="${escapeHtml(value)}">${escapeHtml(label)}</button>`
}

function marketplace() {
  const currentListings = visibleListings()
  const degraded = state.live.status === 'fallback' || (state.live.status !== 'connected' && !state.data.listings.length)
  const who = identity()
  const createAction = who.kind === 'supplier' ? button('＋ Create a listing', 'button button-dark', 'open-create-listing') : ''
  const groups = state.matchRun?.groups
  return `${intro('Trade · Captured CO₂', 'Find the right next user.', 'Every result is ranked from quality fit, availability, distance and evidence. Prices are shown with their basis and date.', createAction)}
    ${degraded ? `<div class="runtime-notice">Degraded demo data · CarbonStone seed copies (stream-a/d/f/unknown)</div>` : ''}
    <div class="market-toolbar"><div class="search-box"><span>⌕</span><input aria-label="Search marketplace" placeholder="Search by material, use or location" data-market-search /></div>
      <div class="filter-group"><button class="filter-button ${state.filterMenu === 'material' ? 'open' : ''}" data-action="toggle-filter" data-filter="material">Material <span>⌄</span></button>${state.filterMenu === 'material' ? `<div class="filter-menu">${filterChip('sourceIndustry', '', 'All')}${filterChip('sourceIndustry', 'cement', 'Cement')}${filterChip('sourceIndustry', 'fertilizer', 'Fertilizer')}</div>` : ''}</div>
      <div class="filter-group"><button class="filter-button ${state.filterMenu === 'quality' ? 'open' : ''}" data-action="toggle-filter" data-filter="quality">Quality <span>⌄</span></button>${state.filterMenu === 'quality' ? `<div class="filter-menu">${filterChip('minPurityMolPct', '', 'Any purity')}${filterChip('minPurityMolPct', '95', '≥ 95%')}${filterChip('minPurityMolPct', '97', '≥ 97%')}${filterChip('minPurityMolPct', '98', '≥ 98%')}</div>` : ''}</div>
      <div class="filter-group"><button class="filter-button ${state.filterMenu === 'availability' ? 'open' : ''}" data-action="toggle-filter" data-filter="availability">Availability <span>⌄</span></button>${state.filterMenu === 'availability' ? `<div class="filter-menu">${filterChip('availableFrom', '', 'Any window')}<button type="button" class="filter-option" data-action="set-availability" data-from="2026-10-01" data-to="2026-10-31">October 2026</button><button type="button" class="filter-option" data-action="set-availability" data-from="2026-11-01" data-to="2026-11-30">November 2026</button></div>` : ''}</div>
      <span class="result-count">${currentListings.length} results</span></div>
    <div class="market-layout"><div class="listing-list">${currentListings.length ? currentListings.map((item) => `<article class="listing-card ${state.selectedListing === item.id ? 'selected' : ''}" data-listing="${item.id}"><div class="listing-art ${item.color}"><span>◌</span><small>CO₂</small></div><div class="listing-main"><div class="listing-heading"><div><span class="match-score">${item.score === null ? 'Unranked' : `${item.score}% fit`}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.supplier)} · ${escapeHtml(item.location)}</p></div><button class="select-circle ${state.selectedListing === item.id ? 'checked' : ''}" aria-label="Select ${escapeHtml(item.title)}">${state.selectedListing === item.id ? '✓' : ''}</button></div><div class="listing-facts"><span><b>Quantity</b>${escapeHtml(item.quantity)}</span><span><b>Purity</b>${escapeHtml(item.purity)}</span><span><b>Price</b>${escapeHtml(item.price)}</span><span><b>Available</b>${escapeHtml(item.availability)}</span></div><div class="listing-footer"><span class="evidence-state ${evidenceClass(item.evidenceStatus)}"><i></i> ${escapeHtml(item.evidence)}</span><button class="text-button" data-action="view-listing" data-listing="${item.id}">View details →</button></div></div></article>`).join('') : `<div class="empty-state">No listings match these filters.</div>`}</div>${matchGroupsPanel(groups)}</div>`
}

function matchGroupsPanel(groups) {
  if (!groups) {
    return `<div class="panel compare-panel"><div class="panel-title"><div><span class="eyebrow">Decision helper</span><h3>Compare options</h3></div><span class="compare-count">${state.matchRun?.results?.length || 0} ranked</span></div><p>Run a deterministic match against a buyer requirement to group listings as compatible, needs evidence, or incompatible.</p>${button('See buyer fit <span>→</span>', 'button button-dark full-width', 'go-requirements')}<button class="text-button centered" data-action="run-matches">Run deterministic match ↗</button></div>`
  }
  const pack = (title, rows) => `<div class="match-group"><span class="eyebrow">${title}</span>${(rows || []).length ? rows.map((row) => `<div class="match-row"><strong>${escapeHtml(row.streamName || row.name || row.streamId || row.listingId || 'Listing')}</strong><span>Listed ${moneyPerTonne(row.economics?.listedPaisePerTonne || row.listedPricePaisePerTonne)} · Delivered ${moneyPerTonne(row.economics?.deliveredPaisePerTonne)}</span></div>`).join('') : '<div class="empty-state">None</div>'}</div>`
  return `<div class="panel compare-panel"><div class="panel-title"><div><span class="eyebrow">Match groups</span><h3>Listed vs delivered</h3></div></div>${pack('Compatible', groups.compatible)}${pack('Needs evidence', groups.needsEvidence || groups.needs_evidence)}${pack('Incompatible', groups.incompatible)}<button class="text-button centered" data-action="run-matches">Run again ↗</button></div>`
}

function listingDetailPanel() {
  const item = state.listingDetail || liveListings().find((listing) => listing.id === state.selectedListing)
  if (!item) return ''
  const who = identity()
  const source = item.sourceLabel || item.raw?.source?.label || (item.synthetic ? 'synthetic_demo' : 'Organization-provided')
  return `<div class="slide-overlay" data-action="close-listing"><aside class="slide-panel listing-detail" data-stop="true"><div class="panel-title"><div><span class="eyebrow">Listing</span><h3>${escapeHtml(item.title)}</h3></div><button class="icon-button subtle" data-action="close-listing">×</button></div>
    <div class="listing-facts"><span><b>Quantity</b>${escapeHtml(item.quantity)}</span><span><b>Purity</b>${escapeHtml(item.purity)}</span><span><b>Price</b>${escapeHtml(item.price)}</span><span><b>Window</b>${escapeHtml(item.availability)}</span></div>
    <p class="muted">${escapeHtml(item.supplier)} · ${escapeHtml(item.location)}</p>
    <p><span class="evidence-state ${evidenceClass(item.evidenceStatus)}"><i></i> ${escapeHtml(item.evidence)}</span></p>
    <p class="muted">Source: ${escapeHtml(source)}${item.synthetic ? ' · synthetic flag on' : ''}</p>
    ${who.kind === 'buyer' ? `<form class="listing-request-form stacked-form"><span class="eyebrow">Request this supply</span><label class="field-label" for="req-qty">Quantity (tonnes)</label><input id="req-qty" name="quantityTonnes" type="number" min="0.001" step="0.001" required /><label class="field-label" for="req-month">Month</label><input id="req-month" name="deliveryMonth" type="month" required value="2026-10" /><label class="field-label" for="req-purity">Min purity (%)</label><input id="req-purity" name="minimumPurityMolPct" type="number" min="0" max="100" step="0.1" value="95" required /><button class="button button-dark" type="submit">Request this supply</button></form>` : '<p class="muted">Buyer workspaces can send a supply request from this panel.</p>'}
  </aside></div>`
}

function createListingPanel() {
  const knownSite = identity().sites[0]?.id || (identity().organizationId === 'org-carbonstone' ? 'site-a' : '')
  return `<div class="slide-overlay" data-action="close-create-listing"><aside class="slide-panel listing-detail" data-stop="true"><div class="panel-title"><div><span class="eyebrow">Supplier</span><h3>Create a listing</h3></div><button class="icon-button subtle" data-action="close-create-listing">×</button></div>
    <form class="listing-create-form stacked-form"><label class="field-label" for="list-name">Name</label><input id="list-name" name="name" required placeholder="Captured CO₂ stream" />
      <label class="field-label" for="list-site">Site id (if known)</label><input id="list-site" name="siteId" value="${escapeHtml(knownSite)}" placeholder="site-a" />
      <label class="field-label" for="list-city">City (if no site id)</label><input id="list-city" name="city" placeholder="Ahmedabad" />
      <label class="field-label" for="list-industry">Industry</label><select id="list-industry" name="sourceIndustry"><option value="cement">Cement</option><option value="fertilizer">Fertilizer</option><option value="unspecified">Other</option></select>
      <label class="field-label" for="list-form">Form</label><select id="list-form" name="physicalForm"><option value="gas">Gas</option><option value="liquid">Liquid</option><option value="solid">Solid</option></select>
      <label class="field-label" for="list-purity">Purity (mol %)</label><input id="list-purity" name="purityMolPct" type="number" min="0" max="100" step="0.1" />
      <label class="field-label" for="list-tonnes">Tonnes</label><input id="list-tonnes" name="totalTonnes" type="number" min="0.001" step="0.001" required />
      <label class="field-label" for="list-start">Start</label><input id="list-start" name="start" type="date" required value="2026-10-01" />
      <label class="field-label" for="list-end">End</label><input id="list-end" name="end" type="date" required value="2026-10-31" />
      <label class="field-label" for="list-price">Price (paise / t)</label><input id="list-price" name="listedPricePaisePerTonne" type="number" min="0" step="1" required placeholder="190000" />
      <label class="check-row"><input type="checkbox" name="publish" /> Publish after create</label>
      <button class="button button-dark" type="submit">Save listing</button></form></aside></div>`
}

function requirementsView() {
  const currentRequirements = liveRequirements()
  const quantity = currentRequirements.reduce((sum, item) => sum + numberValue(item.raw?.quantityTonnes, 0), 0)
  return `${intro('Trade · Buyer side', 'Demand you can trust.', 'See what buyers need, understand the fit and prepare a request from the same decision workspace.', button('＋ Ask assistant to find a buyer', 'button button-dark', 'open-assistant'))}<div class="buyer-summary"><div class="buyer-summary-copy"><span class="eyebrow">Market signal</span><h2>${quantity ? `${quantity} tonnes of demand in your category` : 'No quantified demand loaded yet'}</h2><p>${currentRequirements.length} buyer needs are visible in the current organization. Run the deterministic matcher to calculate compatibility and delivered economics.</p>${button('Explore matches <span>→</span>', 'button button-light', 'go-marketplace')}</div><div class="signal-chart"><div class="chart-label"><span>Demand by month</span><span>From saved requirements</span></div><div class="bars"><i style="height:43%"></i><i style="height:67%"></i><i style="height:81%"></i><i style="height:58%"></i><i style="height:88%"></i><i style="height:72%"></i><i style="height:94%"></i></div><div class="chart-axis"><span>Oct</span><span>Nov</span><span>Dec</span></div></div></div><section class="panel manual-form-panel"><div class="panel-title"><div><span class="eyebrow">Manual entry</span><h3>Create a buyer requirement</h3></div><span class="draft-badge">Approval-safe</span></div><form class="manual-requirement-form"><div><label class="field-label" for="requirement-quantity">Quantity (tonnes)</label><input id="requirement-quantity" name="quantityTonnes" type="number" min="0.001" step="0.001" required placeholder="e.g. 50" /></div><div><label class="field-label" for="requirement-month">Delivery month</label><input id="requirement-month" name="deliveryMonth" type="month" required value="2026-11" /></div><div><label class="field-label" for="requirement-purity">Minimum purity (%)</label><input id="requirement-purity" name="minimumPurityMolPct" type="number" min="0" max="100" step="0.1" value="95" required /></div><button class="button button-dark" type="submit">Save requirement</button></form></section><section class="panel requirements-panel"><div class="panel-title"><div><span class="eyebrow">Active buyer needs</span><h3>Where your output could fit</h3></div></div><div class="requirements-table"><div class="table-row table-header"><span>Buyer / use</span><span>Need</span><span>Window</span><span>Match</span><span></span></div>${currentRequirements.length ? currentRequirements.map((item) => `<div class="table-row"><div class="buyer-cell"><div class="avatar avatar-blue">${escapeHtml(item.buyer.slice(0, 2))}</div><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.buyer)}</small></div></div><span>${escapeHtml(item.need)}</span><span>${escapeHtml(item.window)}</span><span><b class="fit-badge">${item.matches === null ? 'Run match' : `${item.matches} matches`}</b><small class="table-status">${escapeHtml(item.status)}</small></span><button class="icon-button subtle" data-requirement="${escapeHtml(item.id)}">→</button></div>`).join('') : `<div class="empty-state">No requirements are available for this organization yet. Ask the assistant to create one from a quantity and delivery period.</div>`}</div></section>`
}

function requestsView() {
  const currentRequests = liveRequests()
  const selected = currentRequests.find((item) => item.id === state.selectedRequestId) || currentRequests[0]
  const requestRow = (item, index) => `<button type="button" class="request-row ${selected?.id === item.id ? 'selected' : ''}" data-action="select-request" data-request-id="${escapeHtml(item.id)}"><div class="avatar avatar-${index % 2 ? 'green' : 'blue'}">${escapeHtml((item.title || item.id).slice(0, 2).toUpperCase())}</div><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></div><div class="request-row-end">${statusPill(readableStatus(item.status))}</div></button>`
  return `${intro('Trade · Workflow', 'Requests, without the back-and-forth.', 'Each request keeps its terms, evidence and status together. The assistant can prepare the next step, while you approve every external action.')}<div class="request-highlight"><div><span class="eyebrow">Needs your attention</span><h2>${selected ? 'A request needs your attention' : 'No open requests in this workspace'}</h2><p>${selected ? escapeHtml(selected.detail) : 'Buyer requests will appear here after a listing request is sent.'}</p></div><div class="request-actions">${button('Review request <span>→</span>', 'button button-dark', 'review-request')}${button('Ask assistant', 'outlined-button', 'open-assistant')}</div></div><div class="request-layout"><section class="panel request-panel"><div class="panel-title"><div><span class="eyebrow">Open requests</span><h3>Keep the exchange moving</h3></div></div><div class="request-list">${currentRequests.length ? currentRequests.map(requestRow).join('') : '<div class="empty-state">No requests yet.</div>'}</div></section><section class="panel request-timeline"><div class="panel-title"><div><span class="eyebrow">Selected workflow</span><h3>${selected ? escapeHtml(selected.id) : 'Select a request'}</h3></div>${statusPill(readableStatus(selected?.status || 'None'))}</div><div class="timeline">${[['done', 'Request record loaded', 'Current organization scope'], ['done', 'Compatibility checked', 'Deterministic match receipt'], ['current', 'Next party review', 'Approval is required for external actions'], ['', 'Reservation', 'After acceptance'], ['', 'Fulfillment', 'Later workflow step']].map(([statusName, title, detail]) => `<div class="timeline-item ${statusName}"><span class="timeline-dot">${statusName === 'done' ? '✓' : statusName === 'current' ? '•' : ''}</span><div><strong>${title}</strong><small>${detail}</small></div></div>`).join('')}</div>${selected?.id && selected.status === 'pending_supplier' ? `<div class="editor-footer">${button('Accept', 'button button-dark', 'accept-request', `data-request-id="${escapeHtml(selected.id)}"`)}${button('Decline', 'outlined-button', 'decline-request', `data-request-id="${escapeHtml(selected.id)}"`)}</div>` : ''}</section></div>`
}

function evidenceView() {
  const evidenceRow = (title, detail, stateName) => `<div class="evidence-row"><span class="evidence-check ${stateName}">${stateName === 'done' ? '✓' : stateName === 'locked' ? '▣' : '!'}</span><div><strong>${title}</strong><small>${detail}</small></div></div>`
  const needed = opportunities.filter((item) => item.status === 'Evidence needed')
  const localReady = Math.min(100, Math.round(((1 + state.evidenceNotes.length) / 5) * 100))
  return `${intro('Trust · Evidence', 'Make every claim traceable.', 'A potential output becomes a tradable listing only when the right quantity, quality and ownership evidence is reviewed.')}<div class="evidence-banner"><div class="evidence-banner-icon">▣</div><div><strong>${needed.length} items still need evidence</strong><p>Notes stay in this browser session. File upload is not a vault in this prototype.</p></div>${button('Upload evidence <span>↑</span>', 'button button-dark', 'open-evidence-note')}</div><div class="evidence-layout"><section class="panel checklist-panel"><div class="panel-title"><div><span class="eyebrow">Listing readiness</span><h3>Honest checklist</h3></div><span class="readiness">${localReady}% notes in session</span></div><div class="readiness-bar"><span style="width:${localReady}%"></span></div>${evidenceRow('Process description', 'Captured from your process draft', 'done')}${evidenceRow('Capture quantity', 'Monthly amount and measurement basis', needed.length ? 'needed' : 'next')}${evidenceRow('Composition / purity', 'Latest analysis or lab document', 'needed')}${state.evidenceNotes.map((note) => evidenceRow(note.title, note.detail, 'done')).join('')}</section><section class="panel source-panel"><div class="panel-title"><div><span class="eyebrow">Local notes</span><h3>What you recorded</h3></div></div>${state.evidenceNotes.length ? state.evidenceNotes.map((note) => `<div class="source-row"><span class="source-icon">✎</span><div><span>Local</span><strong>${escapeHtml(note.title)}</strong><small>${escapeHtml(note.detail)}</small></div></div>`).join('') : '<div class="empty-state">No local evidence notes yet.</div>'}<div class="source-note"><span>✦</span><p>Recorded locally — upload service is not in this prototype. Nothing here is a certified credit.</p></div></section></div>`
}

function reportsView() {
  const dashboard = state.data.dashboard
  const sourceKind = dashboard?.source?.kind || (dashboard ? 'synthetic_demo' : '')
  const listed = dashboard?.availability?.totalTonnes
  const reserved = dashboard?.availability?.reservedTonnes
  const published = dashboard?.counts?.publishedListings
  const requirements = dashboard?.counts?.requirements
  const requests = dashboard?.counts?.requests
  const ready = Boolean(dashboard) && state.reportGenerated
  return `${intro('Impact · Reports', 'See what is moving.', 'Reports are generated from saved dashboard records, so a number has a source, a date and a clear boundary.', button('＋ New report', 'button button-dark', 'new-report'))}
    ${!dashboard ? `<div class="runtime-notice">${stamp('Unavailable')} No dashboard payload. Reports will not invent 360 t / 85 t.</div>` : `<div class="report-filter"><span class="eyebrow">Source</span><span class="draft-badge">${escapeHtml(sourceKind || 'synthetic_demo')}</span><span class="report-updated">${ready ? 'Generated from /dashboard' : 'Click New report to stamp this snapshot'}</span></div>`}
    <div class="report-metrics">${metric('Captured CO₂ listed', listed === undefined ? 'Unavailable' : `${listed} t`, `${published ?? '—'} supply streams`, '◌', 'green')}${metric('Matched demand', requirements === undefined ? 'Unavailable' : `${requirements} needs`, 'From dashboard counts', '◎', 'blue')}${metric('Reserved', reserved === undefined ? 'Unavailable' : `${reserved} t`, 'Not the same as delivered', '↗', 'gold')}${metric('Open requests', requests === undefined ? 'Unavailable' : String(requests), 'Workflows in this organization', '▣', 'purple')}</div>
    ${ready && dashboard ? `<section class="panel"><div class="panel-title"><div><span class="eyebrow">Generated report</span><h3>Workspace snapshot</h3></div></div><pre class="report-json">${escapeHtml(JSON.stringify(dashboard, null, 2))}</pre></section>` : ''}`
}

function ngoDisclaimer() {
  return `<div class="ngo-disclaimer"><strong>Not an offset.</strong> NGO support is labor (planting / greening), funding, or appreciation. It does not retire carbon credits and must not be treated as an offset.</div>`
}

function projectCard(project) {
  return `<article class="ngo-card"><span class="eyebrow">${escapeHtml(project.kind || project.type || 'project')}</span><h3>${escapeHtml(project.name || project.title || project.id)}</h3><p>${escapeHtml(project.description || project.city || '')}</p><div class="listing-footer"><span>${escapeHtml(readableStatus(project.state || project.status || 'draft'))}</span>${identity().kind === 'ngo' && project.id && canUseLive() ? `<button class="text-button" data-action="publish-project" data-project-id="${escapeHtml(project.id)}">Publish</button>` : ''}</div></article>`
}

function projectsView() {
  const who = identity()
  const projects = state.data.projects
  const create = who.kind === 'ngo' ? `<section class="panel"><div class="panel-title"><div><span class="eyebrow">NGO</span><h3>Create a project</h3></div></div><form class="project-create-form stacked-form"><label class="field-label" for="proj-name">Name</label><input id="proj-name" name="name" required /><label class="field-label" for="proj-kind">Kind</label><select id="proj-kind" name="kind"><option value="labor">Labor / planting</option><option value="funding">Funding</option><option value="greening">Greening</option><option value="appreciation">Appreciation</option></select><label class="field-label" for="proj-city">City</label><input id="proj-city" name="city" /><label class="field-label" for="proj-desc">Description</label><textarea id="proj-desc" name="description" rows="3" required></textarea><label class="check-row"><input type="checkbox" name="publish" /> Publish now</label><button class="button button-dark" type="submit">Save project</button></form></section>` : ''
  return `${intro('NGO · Projects', 'Help without inventing credits.', 'Projects are labor, funding or greening. Buyers may view published work; they cannot treat it as a retired tonne.')}${ngoDisclaimer()}<div class="ngo-layout">${create}<div class="ngo-grid">${projects.length ? projects.map(projectCard).join('') : '<div class="empty-state">No projects loaded.</div>'}</div></div>`
}

function balanceView() {
  const who = identity()
  const requests = state.data.balanceRequests
  const projects = state.data.projects
  if (who.kind === 'supplier') {
    return `${intro('Balance & NGO help', 'Ask for help with surplus carbon.', 'If your process has more CO₂ than you can place, an NGO can offer labor, funding or greening. This is not a marketplace sale and not an offset.')}${ngoDisclaimer()}
      <section class="panel"><form class="balance-request-form stacked-form"><div class="panel-title"><div><span class="eyebrow">Production house</span><h3>Request NGO help</h3></div></div><label class="field-label" for="bal-t">Estimated tonnes CO₂e</label><input id="bal-t" name="estimatedTonnesCo2e" type="number" min="0.001" step="0.001" required /><label class="field-label" for="bal-city">City</label><input id="bal-city" name="city" required /><label class="field-label" for="bal-support">Preferred support</label><select id="bal-support" name="preferredSupport"><option value="labor">Labor / planting</option><option value="funding">Funding</option><option value="greening">Greening</option></select><label class="field-label" for="bal-msg">Message</label><textarea id="bal-msg" name="message" rows="3" required></textarea><button class="button button-dark" type="submit">Send help request</button></form></section>
      <div class="ngo-grid">${requests.length ? requests.map((item) => `<article class="ngo-card"><span class="eyebrow">${escapeHtml(item.preferredSupport || item.status || 'open')}</span><h3>${escapeHtml(item.city || item.id)}</h3><p>${escapeHtml(item.message || '')}</p><p>${item.estimatedTonnesCo2e || item.estimatedTonnes || '?'} t CO₂e</p>${item.offeredProjectId || item.offer ? `<div class="editor-footer">${button('Accept offer', 'button button-dark', 'accept-balance', `data-request-id="${escapeHtml(item.id)}"`)}${button('Decline', 'outlined-button', 'decline-balance', `data-request-id="${escapeHtml(item.id)}"`)}</div>` : '<p class="muted">Waiting for an NGO offer.</p>'}</article>`).join('') : '<div class="empty-state">No help requests yet.</div>'}</div>`
  }
  if (who.kind === 'ngo') {
    return `${intro('Balance requests', 'Offer real help.', 'Open production-house requests can receive a project offer. Appreciation is separate from tonnes.')}${ngoDisclaimer()}
      <div class="ngo-grid">${requests.length ? requests.map((item) => `<article class="ngo-card"><span class="eyebrow">${escapeHtml(item.preferredSupport || 'open')}</span><h3>${escapeHtml(item.organizationName || item.city || item.id)}</h3><p>${escapeHtml(item.message || '')}</p></article>`).join('') : '<div class="empty-state">No open balance requests.</div>'}</div>
      <section class="panel"><form class="offer-form stacked-form"><div class="panel-title"><div><span class="eyebrow">Offer</span><h3>Attach a project</h3></div></div><label class="field-label" for="offer-req">Balance request</label><select id="offer-req" name="requestId">${requests.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.city || item.id)}</option>`).join('')}</select><label class="field-label" for="offer-proj">Project</label><select id="offer-proj" name="projectId">${projects.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title || item.name || item.id)}</option>`).join('')}</select><label class="field-label" for="offer-note">Note</label><textarea id="offer-note" name="note" rows="3"></textarea><button class="button button-dark" type="submit">Offer project</button></form></section>`
  }
  return `${intro('Published NGO work', 'Read-only for buyers.', 'You can view greening projects and send appreciation. This is not procurement of credits.')}${ngoDisclaimer()}<div class="ngo-grid">${projects.length ? projects.map(projectCard).join('') : '<div class="empty-state">No published projects.</div>'}</div>${appreciationForm()}`
}

function appreciationForm() {
  return `<section class="panel"><form class="appreciation-form stacked-form"><div class="panel-title"><div><span class="eyebrow">Appreciation</span><h3>Thank a production house</h3></div></div><label class="field-label" for="appr-org">Organization id</label><input id="appr-org" name="organizationId" value="org-carbonstone" /><label class="field-label" for="appr-msg">Message</label><textarea id="appr-msg" name="message" rows="3" required></textarea><button class="button button-dark" type="submit">Send appreciation</button></form>
    <div class="ngo-grid">${state.data.appreciations.length ? state.data.appreciations.map((item) => `<article class="ngo-card"><h3>${escapeHtml(item.from || identity().organizationName)}</h3><p>${escapeHtml(item.message || '')}</p></article>`).join('') : '<div class="empty-state">No appreciations yet.</div>'}</div></section>`
}

function appreciationView() {
  return `${intro('Appreciation', 'Recognition without tonnes.', 'NGOs and buyers can thank a production house. This is not a certificate and not an offset.')}${ngoDisclaimer()}${appreciationForm()}`
}

function assistantCard(kind, payload = {}) {
  if (kind === 'discovery') {
    const candidates = Array.isArray(payload.candidates) && payload.candidates.length ? payload.candidates : opportunities.map((item) => ({ label: item.title, confidence: item.confidence / 100, rationale: item.reason }))
    return `<div class="chat-card discovery-chat-card"><div class="chat-card-header"><span class="mini-icon mint">◌</span><div><span class="eyebrow">Process discovery</span><strong>${candidates.length} potential outputs found</strong></div>${statusPill('Hypothesis')}</div><div class="chat-output-list">${candidates.slice(0, 4).map((candidate) => `<div><strong>${escapeHtml(candidate.label || candidate.material || 'Potential resource')}</strong><span class="chat-confidence">${Math.round(numberValue(candidate.confidence, 0) * (numberValue(candidate.confidence, 0) <= 1 ? 100 : 1))}% signal</span><small>${escapeHtml(candidate.rationale || candidate.caution || 'Evidence is required before this can become a listing.')}</small></div>`).join('')}</div><div class="chat-card-footer"><span>✦ ${payload.analysis?.catalogVersion ? 'Catalog-backed' : 'Demo'} result</span><button class="small-action" data-view="process">Open discovery →</button></div></div>`
  }
  if (kind === 'comparison') {
    const options = Array.isArray(payload.options) && payload.options.length ? payload.options : state.matchRun?.groups?.compatible || []
    const rows = options.slice(0, 3).map((option, index) => `<div class="compare-chat-row"><div><strong>${escapeHtml(option.streamName || option.name || `Option ${index + 1}`)}</strong><span>${option.score ? `${Math.round(option.score)}% fit` : 'Compatibility result'}${option.economics?.distanceKm !== undefined ? ` · ${option.economics.distanceKm} km` : ''}</span></div><strong>${moneyPerTonne(option.economics?.deliveredPaisePerTonne)}</strong><span class="fit-badge ${index ? 'secondary' : ''}">${index ? 'Alternative' : 'Best fit'}</span></div>`).join('')
    return `<div class="chat-card"><div class="chat-card-header"><span class="mini-icon blue">◎</span><div><span class="eyebrow">Match run · saved</span><strong>${options.length} compatible option${options.length === 1 ? '' : 's'}</strong></div><span class="match-score">Deterministic</span></div>${rows || '<div class="empty-state">No compatible options in the current match run.</div>'}<div class="chat-card-footer"><span>Values come from the stored match receipt</span><button class="small-action" data-view="marketplace">Compare all →</button></div></div>`
  }
  if (kind === 'action') {
    const actionId = payload.actionId || payload.id || state.pendingActionId || ''
    const isReceipt = payload.status === 'succeeded' || payload.status === 'rejected'
    return `<div class="chat-card action-chat-card"><div class="chat-card-header"><span class="mini-icon gold">✎</span><div><span class="eyebrow">${isReceipt ? 'Action receipt' : 'Action preview'}</span><strong>${escapeHtml(payload.summary || payload.operation || 'Requested action')}</strong></div>${statusPill(isReceipt ? payload.status : 'Needs approval')}</div><div class="action-diff"><div><span>Operation</span><strong>${escapeHtml(payload.operation || 'Marketplace update')}</strong><small>${escapeHtml(payload.instruction || 'The server will validate the exact payload before execution.')}</small></div><div><span>Safety boundary</span><strong>${isReceipt ? 'Server receipt recorded' : 'External changes pause here'}</strong><small>${escapeHtml(payload.expiresAt ? `Preview expires ${payload.expiresAt}` : 'Nothing is committed until an exact confirmation.')}</small></div></div><div class="chat-card-footer">${isReceipt ? `<span>${escapeHtml(payload.status)}</span>` : `<button class="small-action" data-approve-action="${escapeHtml(actionId)}">Confirm exact action</button><button class="text-button" data-cancel-action="${escapeHtml(actionId)}">Cancel</button>`}</div></div>`
  }
  if (kind === 'checklist') return `<div class="chat-card checklist-chat-card"><div class="chat-card-header"><span class="mini-icon gold">▣</span><div><span class="eyebrow">Evidence checklist</span><strong>${payload.fields?.length || 2} items unlock the next step</strong></div></div><div class="chat-checklist">${(payload.fields || ['Monthly quantity and basis', 'Latest composition report']).map((field) => `<span><i class="empty-check"></i> ${escapeHtml(field)}</span>`).join('')}<span class="complete"><i>✓</i> Process description</span></div><div class="chat-card-footer"><span>Nothing is published automatically</span><button class="small-action" data-view="evidence">Open evidence →</button></div></div>`
  const dashboard = state.data.dashboard
  return `<div class="chat-card report-chat-card"><div class="chat-card-header"><span class="mini-icon purple">▥</span><div><span class="eyebrow">Report</span><strong>${dashboard ? 'Dashboard snapshot' : 'Unavailable until /dashboard loads'}</strong></div></div><div class="report-chat-grid"><div><strong>${escapeHtml(String(dashboard?.availability?.totalTonnes ?? '—'))}</strong><span>Listed supply</span></div><div><strong>${escapeHtml(String(dashboard?.counts?.requirements ?? '—'))}</strong><span>Needs</span></div><div><strong>${escapeHtml(String(dashboard?.source?.kind || 'synthetic_demo'))}</strong><span>Source</span></div></div><div class="chat-card-footer"><span>${dashboard ? 'From dashboard payload' : stamp()}</span><button class="small-action" data-view="reports">Open report →</button></div></div>`
}

function messagesHtml(messages) {
  const who = identity()
  return `<div class="chat-messages">${messages.map((message) => `<div class="message-row ${message.role}"><div class="chat-avatar ${message.role}">${message.role === 'assistant' ? '✦' : escapeHtml(initials(who.displayName))}</div><div class="message-body"><div class="message-bubble">${escapeHtml(message.text)}</div>${message.card ? assistantCard(message.card, message.payload || {}) : ''}<time>${message.time}</time></div></div>`).join('')}</div>`
}

function composer() {
  return `<div class="suggestion-row"><button data-prompt="What outputs could I sell from this process?">What can I sell?</button><button data-prompt="Find the best buyer for my captured CO₂">Find a buyer</button><button data-prompt="What evidence is missing?">What is missing?</button></div><form class="composer"><button type="button" class="composer-icon" data-action="unavailable" data-unavailable="Attach file is unavailable in this prototype" aria-label="Attach a file">＋</button><input name="message" placeholder="Ask CarbonBridge anything…" aria-label="Message CarbonBridge" autocomplete="off" /><button type="button" class="composer-icon" data-action="unavailable" data-unavailable="Voice input is unavailable in this prototype" aria-label="Voice input">◉</button><button type="submit" class="send-button" aria-label="Send message">↑</button></form><div class="composer-foot"><span><i></i> Assistant uses ${isDemoMode ? 'seeded demo' : 'live'} workspace context</span><span>Enter to send · Shift + Enter for new line</span></div>`
}

function assistantPanel() {
  const who = identity()
  return `<aside class="assistant-panel"><div class="assistant-panel-header"><div class="assistant-title"><span class="assistant-spark">✦</span><div><strong>CarbonBridge assistant</strong><span><i></i> ${state.live.status === 'connected' ? 'Live API' : 'Demo'} · ${escapeHtml(who.organizationName)}</span></div></div><div><button class="icon-button subtle" data-view="assistant" aria-label="Open full assistant">↗</button><button class="icon-button subtle" data-action="close-assistant" aria-label="Close assistant">×</button></div></div><div class="assistant-context"><span>Context</span><button type="button">${escapeHtml(who.kindLabel)} <b>×</b></button><button type="button">${escapeHtml(who.organizationName)} <b>×</b></button></div>${messagesHtml(state.messages.slice(-5))}<div class="assistant-composer">${composer()}</div></aside>`
}

function assistantView() {
  return `<div class="assistant-page">${intro('Your co-pilot · Context-aware', 'Ask, review, act.', 'CarbonBridge coordinates process discovery, marketplace work and evidence checks. Replies arrive as complete messages — this preview does not stream tokens.')}<div class="assistant-workspace"><section class="panel full-chat"><div class="full-chat-header"><div><span class="eyebrow">Conversation</span><h3>Make the invisible, useful</h3></div></div>${messagesHtml(state.messages)}${composer()}</section><aside class="panel assistant-guardrails"><div class="panel-title"><div><span class="eyebrow">How this works</span><h3>Always reviewable</h3></div><span class="spark-icon">✦</span></div><div class="guardrail"><span class="guardrail-icon">◌</span><div><strong>Hypotheses stay hypotheses</strong><p>The assistant can find a signal, but it cannot turn an estimate into verified inventory.</p></div></div><div class="guardrail"><span class="guardrail-icon">▣</span><div><strong>Evidence travels with the claim</strong><p>Every source, date and reviewer state is visible beside the result.</p></div></div><div class="guardrail"><span class="guardrail-icon">✓</span><div><strong>You approve external actions</strong><p>Publishing, sending requests and commercial changes show a preview first.</p></div></div></aside></div></div>`
}

function renderView() {
  if (state.view === 'process') return processView()
  if (state.view === 'marketplace') return marketplace()
  if (state.view === 'requirements') return requirementsView()
  if (state.view === 'requests') return requestsView()
  if (state.view === 'evidence') return evidenceView()
  if (state.view === 'reports') return reportsView()
  if (state.view === 'assistant') return assistantView()
  if (state.view === 'projects') return projectsView()
  if (state.view === 'balance') return balanceView()
  if (state.view === 'appreciation') return appreciationView()
  return overview()
}

function assistantResponse(text) {
  const lower = text.toLowerCase()
  if (lower.includes('process') || lower.includes('output') || lower.includes('sell') || lower.includes('generate')) return { text: 'I mapped the process into potential outputs. Select an opportunity to see its assumptions and the evidence needed before it can become a listing.', card: 'discovery', view: 'process' }
  if (lower.includes('match') || lower.includes('buyer') || lower.includes('compare') || lower.includes('deal')) return { text: 'I found compatible buyer needs and compared the current options using purity, availability, distance and delivered cost. The numbers below come from the saved match run.', card: 'comparison', view: lower.includes('buyer') ? 'requirements' : 'marketplace' }
  if (lower.includes('list') || lower.includes('publish') || lower.includes('draft')) return { text: 'I prepared a draft for the captured CO₂ opportunity. Publication is paused because monthly quantity and composition evidence are still missing.', card: 'action', view: 'process' }
  if (lower.includes('evidence') || lower.includes('document') || lower.includes('quality')) return { text: 'Your next high-value step is to add the latest composition report and monthly capture estimate. I’ll keep the opportunity private until a reviewer validates it.', card: 'checklist', view: 'evidence' }
  if (lower.includes('report') || lower.includes('analytics') || lower.includes('impact')) return { text: 'I can generate a reproducible report from your current dashboard payload. Choose New report to stamp the snapshot.', card: 'report', view: 'reports' }
  return { text: 'I can help with that. I’ll keep the result grounded in your saved records and show the exact next action.' }
}

async function sendMessage(text) {
  const trimmed = text.trim()
  if (!trimmed) return
  state.messages.push({ role: 'user', text: trimmed, time: timeNow() })
  state.busy = true
  render()
  try {
    if (!isDemoMode && state.live.status !== 'fallback') {
      await sendLiveMessage(trimmed)
    } else {
      const response = assistantResponse(trimmed)
      state.messages.push({ role: 'assistant', text: response.text, time: timeNow(), card: response.card })
      if (response.view) navigate(response.view)
    }
  } catch (error) {
    state.live.status = 'fallback'
    state.live.error = error.message
    state.messages.push({ role: 'assistant', text: `I could not complete that workflow: ${error.message}`, time: timeNow(), card: 'checklist', payload: { fields: ['Retry the action', 'Check the API connection'] } })
    setNotice(error.message)
  } finally {
    state.busy = false
    state.assistantOpen = state.view !== 'assistant'
    render()
  }
}

function render() {
  const root = document.querySelector('#root')
  if (!root) return
  root.innerHTML = state.auth.unlocked ? shell() : authScreen()
  const processDescription = document.querySelector('#process-description')
  if (processDescription) processDescription.addEventListener('input', (event) => { state.processText = event.target.value })
  const marketSearch = document.querySelector('[data-market-search]')
  if (marketSearch) {
    marketSearch.value = state.marketQuery
    marketSearch.addEventListener('input', (event) => {
      state.marketQuery = event.target.value
      window.clearTimeout(render.searchTimeout)
      render.searchTimeout = window.setTimeout(() => { refreshListings() }, 200)
    })
  }
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-view], [data-action], [data-prompt], [data-listing], [data-approve-action], [data-cancel-action], [data-requirement], [data-request-action]')
  if (!target) return
  if (target.classList.contains('slide-overlay') && event.target !== target) return
  if (target.dataset.action?.startsWith('close-') && event.target.closest('.slide-panel') && !event.target.closest('.icon-button') && !event.target.classList.contains('slide-overlay')) return
  if (target.dataset.view) navigate(target.dataset.view)
  const action = target.dataset.action
  if (action === 'open-assistant') { state.assistantOpen = true; render() }
  if (action === 'close-assistant') { state.assistantOpen = false; render() }
  if (action === 'analyze-process') { if (identity().kind === 'supplier') analyzeProcess(); else navigate('process'); return }
  if (action === 'go-process') { navigate('process'); return }
  if (action === 'go-marketplace') { navigate('marketplace'); return }
  if (action === 'go-requirements') { navigate('requirements'); return }
  if (action === 'save-process-exit') { navigate('overview'); setNotice('Draft kept in this session'); return }
  if (action === 'open-settings') { state.panels.settings = true; render(); return }
  if (action === 'close-settings') { state.panels.settings = false; render(); return }
  if (action === 'open-notifications') { state.panels.notifications = true; render(); return }
  if (action === 'close-notifications') { state.panels.notifications = false; render(); return }
  if (action === 'open-evidence-note') { state.panels.evidenceNote = true; render(); return }
  if (action === 'close-evidence-note') { state.panels.evidenceNote = false; render(); return }
  if (action === 'close-unavailable') { state.panels.unavailable = ''; render(); return }
  if (action === 'unavailable') { state.panels.unavailable = target.dataset.unavailable || 'Unavailable in this prototype'; render(); return }
  if (action === 'logout') { logoutWorkspace(); return }
  if (action === 'toggle-workspace') { state.panels.workspace = !state.panels.workspace; render(); return }
  if (action === 'auth-tab') { state.auth.tab = target.dataset.tab || 'login'; render(); return }
  if (action === 'choose-demo') { chooseDemoActor(target.dataset.actor); return }
  if (action === 'switch-workspace') {
    persistDemoActor(target.dataset.actor || getDemoUser(), target.dataset.organization || '')
    hydrate()
    return
  }
  if (action === 'toggle-filter') {
    state.filterMenu = state.filterMenu === target.dataset.filter ? '' : target.dataset.filter
    render()
    return
  }
  if (action === 'set-filter') {
    state.marketFilters[target.dataset.filterKey] = target.dataset.filterValue
    state.filterMenu = ''
    refreshListings()
    return
  }
  if (action === 'set-availability') {
    state.marketFilters.availableFrom = target.dataset.from || ''
    state.marketFilters.availableTo = target.dataset.to || ''
    state.filterMenu = ''
    refreshListings()
    return
  }
  if (action === 'view-listing') { openListingDetail(target.dataset.listing); return }
  if (action === 'close-listing') { state.listingDetailOpen = false; render(); return }
  if (action === 'open-create-listing') { state.createListingOpen = true; render(); return }
  if (action === 'close-create-listing') { state.createListingOpen = false; render(); return }
  if (action === 'review-request') {
    const first = liveRequests()[0]
    if (first) state.selectedRequestId = first.id
    render()
    return
  }
  if (action === 'select-request') { state.selectedRequestId = target.dataset.requestId; render(); return }
  if (action === 'accept-request') { manageRequest(target.dataset.requestId, 'accept'); return }
  if (action === 'decline-request') { manageRequest(target.dataset.requestId, 'decline'); return }
  if (action === 'accept-balance') { decideBalanceOffer(target.dataset.requestId, 'accept'); return }
  if (action === 'decline-balance') { decideBalanceOffer(target.dataset.requestId, 'decline'); return }
  if (action === 'publish-project') {
    if (!canUseLive()) { setNotice('Publish needs the live API.'); return }
    publishProject(target.dataset.projectId).then(() => loadWorkspace(listingFilterPayload()).then((workspace) => { applyWorkspace(workspace); setNotice('Project published.'); render() })).catch((error) => setNotice(error.message))
    return
  }
  if (action === 'new-report') {
    state.reportGenerated = true
    navigate('reports')
    setNotice(state.data.dashboard ? 'Report generated from dashboard payload.' : 'Dashboard unavailable — report stamped Unavailable.')
    return
  }
  if (action === 'run-matches') {
    const requirement = liveRequirements().find((item) => item.id === state.activeRequirementId) || liveRequirements()[0]
    if (!requirement?.raw?.id || isDemoMode) { setNotice('Ask the assistant to find supply options; the seeded comparison is available in demo mode.'); return }
    state.busy = true
    runLiveMatch(requirement.raw.id)
    return
  }
  if (target.dataset.approveAction) { approveLiveAction(target.dataset.approveAction); return }
  if (target.dataset.cancelAction) { sendMessage('cancel'); return }
  if (target.dataset.requestAction) { manageRequest(target.dataset.requestId, target.dataset.requestAction); return }
  if (target.dataset.prompt) { sendMessage(target.dataset.prompt); return }
  if (target.dataset.requirement) { state.activeRequirementId = target.dataset.requirement; navigate('marketplace'); return }
  if (target.dataset.listing && action !== 'view-listing') openListingDetail(target.dataset.listing)
})

document.addEventListener('submit', (event) => {
  if (event.target.matches('.auth-login-form')) { event.preventDefault(); submitAuth('login', event.target); return }
  if (event.target.matches('.auth-register-form')) { event.preventDefault(); submitAuth('register', event.target); return }
  if (event.target.matches('.manual-requirement-form')) { event.preventDefault(); saveManualRequirement(event.target); return }
  if (event.target.matches('.listing-request-form')) { event.preventDefault(); submitListingRequest(event.target); return }
  if (event.target.matches('.listing-create-form')) { event.preventDefault(); submitCreateListing(event.target); return }
  if (event.target.matches('.balance-request-form')) { event.preventDefault(); submitBalanceRequest(event.target); return }
  if (event.target.matches('.project-create-form')) { event.preventDefault(); submitProject(event.target); return }
  if (event.target.matches('.appreciation-form')) { event.preventDefault(); submitAppreciation(event.target); return }
  if (event.target.matches('.offer-form')) { event.preventDefault(); offerOnRequest(event.target); return }
  if (event.target.matches('.evidence-note-form')) {
    event.preventDefault()
    const values = new FormData(event.target)
    state.evidenceNotes.unshift({ title: String(values.get('title') || 'Evidence note'), detail: String(values.get('detail') || ''), at: timeNow() })
    state.panels.evidenceNote = false
    if (!canUseLive()) setNotice('Recorded locally — upload service is not in this prototype')
    else setNotice('Recorded locally — upload service is not in this prototype')
    render()
    return
  }
  if (!event.target.matches('.composer')) return
  event.preventDefault()
  const input = event.target.elements.message
  const value = input.value
  input.value = ''
  sendMessage(value)
})

window.addEventListener('popstate', () => {
  state.view = viewFromPath()
  render()
})

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    if (state.auth.unlocked) { state.assistantOpen = true; render() }
  }
})

render()
hydrate()
