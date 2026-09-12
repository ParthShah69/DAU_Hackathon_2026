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
  getListing,
  createListing,
  patchListing,
  publishListing,
  createSupplyRequest,
  getMatchReceipt,
  createMatchScenario,
  getCurrentIdentity,
} from './api.js'

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
  view: viewFromPath(),
  assistantOpen: true,
  selectedListing: (globalThis.location?.pathname.match(/^\/listings\/([^/]+)/) || [])[1] || 'stream-a',
  selectedListings: ['stream-a'],
  marketQuery: '',
  processText: 'We ferment molasses to produce ethanol. The gas separation stage creates a CO₂-rich stream, then we purify and compress it. We currently do not measure the exact monthly quantity.',
  analysisRun: true,
  busy: false,
  notice: '',
  conversationId: null,
  pendingActionId: null,
  activeProcessId: null,
  activeRequirementId: null,
  matchRun: null,
  listingDetail: null,
  listingEditor: null,
  receipt: null,
  matchScenario: null,
  marketPage: 1,
  marketFilters: { evidence: 'all', material: 'all' },
  data: { listings: [], requirements: [], requests: [], capabilities: null, identity: null },
  live: { status: isDemoMode ? 'demo' : 'connecting', error: null },
  messages: [
    { role: 'assistant', text: 'Hi Ananya. Tell me what your process makes, and I’ll map the useful outputs, evidence gaps and next actions for you.', time: '09:41' },
    { role: 'user', text: 'What can I sell from our ethanol process?', time: '09:42' },
    { role: 'assistant', text: 'I found three possible resource opportunities. The CO₂ stream is the strongest lead, but I’m keeping the quantity and price blank until we have evidence.', time: '09:42', card: 'discovery' },
  ],
}

const nav = [
  ['overview', 'Overview', '⌂'], ['process', 'My processes', '◫', 'Discover'], ['marketplace', 'Marketplace', '⌁', 'Trade'], ['requirements', 'Buyer needs', '◎'], ['requests', 'Requests', '↗'], ['evidence', 'Evidence vault', '▣', 'Trust'], ['reports', 'Reports', '▥'],
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
}

function viewFromPath(pathname = globalThis.location?.pathname || '/') {
  if (pathname === '/assistant') return 'assistant'
  if (pathname.startsWith('/processes')) return 'process'
  if (pathname.startsWith('/marketplace') || pathname.startsWith('/listings')) return 'marketplace'
  if (pathname.startsWith('/requirements')) return 'requirements'
  if (pathname.startsWith('/requests')) return 'requests'
  if (pathname.startsWith('/evidence')) return 'evidence'
  if (pathname.startsWith('/reports')) return 'reports'
  return 'overview'
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]))
const timeNow = () => new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date())
const statusPill = (status) => `<span class="status-pill ${status === 'Evidence needed' || status === 'Needs evidence' || status === 'Review needed' ? 'warning' : status === 'Accepted' ? 'success' : 'neutral'}">${escapeHtml(status)}</span>`
const readableStatus = (status) => String(status || 'unknown').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const button = (label, className = 'button button-dark', action = '') => `<button class="${className}" ${action ? `data-action="${action}"` : ''}>${label}</button>`

const supplierNames = {
  'org-carbonstone': 'CarbonStone Materials',
  'org-greenbuild': 'GreenBuild Concrete',
  'org-climateworks': 'ClimateWorks Collective',
}

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

function mapListing(record) {
  const supply = record.supply || {}
  const quality = record.quality || {}
  const purity = quality.purityMolPct === null || quality.purityMolPct === undefined ? 'Purity unavailable' : `${quality.purityMolPct}% CO₂`
  const evidence = quality.evidenceStatus && quality.evidenceStatus !== 'missing' ? 'Verified' : 'Partial'
  const score = state.matchRun?.results?.find((result) => result.streamId === record.id)?.score
  const materialTitle = record.name || 'Captured CO₂ listing'
  return {
    id: record.id,
    title: materialTitle.replace(/\bCO2\b/g, 'CO₂'),
    supplier: supplierNames[record.supplierOrganizationId] || record.supplierOrganizationId || 'Supplier organization',
    location: record.location?.city || 'Location unavailable',
    quantity: supply.totalTonnes ? `${supply.remainingTonnes || supply.totalTonnes} t available` : 'Quantity unavailable',
    purity,
    price: moneyPerTonne(supply.listedPricePaisePerTonne, supply.currency),
    availability: dateWindow(supply.start, supply.end),
    evidence,
    score: score === null || score === undefined ? null : Math.round(score),
    color: record.sourceIndustry === 'fertilizer' ? 'orange' : record.id.endsWith('d') ? 'blue' : 'green',
    synthetic: Boolean(record.synthetic),
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
    raw: record,
  }
}

function liveListings() {
  return state.data.listings.length ? state.data.listings : listings
}

function visibleListings() {
  const query = state.marketQuery.trim().toLowerCase()
  if (!query) return liveListings()
  return liveListings().filter((item) => `${item.title} ${item.supplier} ${item.location} ${item.purity}`.toLowerCase().includes(query))
}

function liveRequirements() {
  return state.data.requirements.length ? state.data.requirements : requirements
}

function liveRequests() {
  return state.data.requests.length ? state.data.requests : []
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
  const latestProcess = state.data.processes.slice().sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')))[0]
  if (latestProcess?.rawDescription) state.processText = latestProcess.rawDescription
  if (!state.selectedListing && state.data.listings[0]) state.selectedListing = state.data.listings[0].id
}

async function hydrate() {
  if (isDemoMode) {
    state.live.status = 'demo'
    return
  }
  state.live.status = 'connecting'
  try {
    const [workspace, identity] = await Promise.all([loadWorkspace(), getCurrentIdentity()])
    applyWorkspace(workspace)
    state.data.identity = identity
    state.live.status = 'connected'
    if (!state.conversationId) {
      const conversation = await createConversation('CarbonBridge workspace assistant')
      state.conversationId = conversation?.id || null
    }
    if (globalThis.location?.pathname.startsWith('/listings/') && state.selectedListing) await openListing(state.selectedListing)
  } catch (error) {
    state.live.status = 'fallback'
    state.live.error = error.message
    setNotice(`Live API unavailable. Showing safe demo data. ${error.message}`)
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
    setNotice(`Match complete: ${result.groups?.compatible?.length || 0} compatible options, ${result.groups?.needsEvidence?.length || 0} needing evidence.`)
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
    if (!isDemoMode && state.live.status !== 'fallback') {
      await createRequirement(payload)
      const workspace = await loadWorkspace()
      applyWorkspace(workspace)
      setNotice('Buyer requirement saved to the workspace.')
    } else {
      const item = mapRequirement({ ...payload, id: `local-requirement-${Date.now()}`, organizationId: 'demo-buyer', state: 'published' })
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
    const workspace = await loadWorkspace()
    applyWorkspace(workspace)
    setNotice(`Request ${action} action completed.`)
  } catch (error) {
    setNotice(error.message)
  } finally {
    state.busy = false
    render()
  }
}

async function openListing(id) {
  state.selectedListing = id
  const listing = liveListings().find((item) => item.id === id)
  state.listingDetail = listing || null
  if (!isDemoMode && state.live.status === 'connected') {
    try { state.listingDetail = mapListing(await getListing(id)) } catch (error) { setNotice(error.message) }
  }
  render()
}

async function saveListing(form) {
  const value = new FormData(form)
  const name = String(value.get('name') || '').trim()
  const totalTonnes = Number(value.get('totalTonnes'))
  const price = Number(value.get('price'))
  const purity = Number(value.get('purity'))
  const start = String(value.get('start') || '')
  const end = String(value.get('end') || '')
  if (!name || !totalTonnes || !price || !purity || !start || !end) return setNotice('Complete name, quantity, price, purity and availability before saving.')
  const payload = { name, siteId: 'site-a', sourceIndustry: String(value.get('industry') || 'cement'), physicalForm: 'gas', co2Origin: 'point_source', supplyPeriods: [{ start, end, totalTonnes, minimumOrderTonnes: Number(value.get('minimumOrderTonnes') || 0), listedPricePaisePerTonne: Math.round(price * 100), currency: 'INR' }], quality: { purityMolPct: purity, basis: 'dry', evidenceStatus: 'self_reported' } }
  state.busy = true; render()
  try {
    if (isDemoMode || state.live.status === 'fallback') {
      const item = mapListing({ id: `local-listing-${Date.now()}`, name, supplierOrganizationId: 'org-carbonstone', sourceIndustry: payload.sourceIndustry, state: 'draft', supply: { ...payload.supplyPeriods[0], remainingTonnes: String(totalTonnes) }, quality: { purityMolPct: purity, evidenceStatus: 'self_reported' }, location: { city: 'Ahmedabad' } })
      state.data.listings.unshift(item); state.listingEditor = null; setNotice('Demo draft saved locally. Connect the API to persist it.')
    } else {
      const saved = await createListing(payload)
      state.data.listings.unshift(mapListing(saved)); state.listingEditor = null; setNotice('Private listing draft saved. Publish only after reviewing the evidence.')
    }
  } catch (error) { setNotice(error.message) } finally { state.busy = false; render() }
}

async function publishSelectedListing() {
  const item = state.listingDetail || liveListings().find((listing) => listing.id === state.selectedListing)
  if (!item) return
  if (isDemoMode || state.live.status === 'fallback') return setNotice('Demo mode cannot publish. The preview remains private and clearly labelled.')
  state.busy = true; render()
  try { await publishListing(item.id, item.raw?.version || 1); await hydrate(); state.listingDetail = null; setNotice('Listing published after server evidence checks.') } catch (error) { setNotice(error.message) } finally { state.busy = false; render() }
}

async function editSelectedListing(form) {
  const item = state.listingDetail
  const name = String(new FormData(form).get('name') || '').trim()
  if (!item || !name) return setNotice('Enter a listing name.')
  if (isDemoMode || state.live.status === 'fallback') { item.title = name; setNotice('Demo listing edited locally. Connect the API to persist it.'); render(); return }
  state.busy = true; render()
  try {
    const saved = await patchListing(item.id, { name, version: item.raw?.version || 1 })
    state.listingDetail = mapListing(saved)
    state.data.listings = state.data.listings.map((listing) => listing.id === item.id ? state.listingDetail : listing)
    setNotice('Listing name updated. Supply and quality terms remain separately evidence-controlled.')
  } catch (error) { setNotice(error.message) } finally { state.busy = false; render() }
}

async function submitSelectedRequest(resultId) {
  const requirement = liveRequirements().find((item) => item.id === state.activeRequirementId) || liveRequirements()[0]
  const result = (state.matchRun?.results || []).find((item) => item.id === resultId)
  if (!requirement || !result) return setNotice('Run a match and select a compatible option first.')
  if (isDemoMode || state.live.status === 'fallback') return setNotice('Demo mode shows the request path but does not submit external requests.')
  state.busy = true; render()
  try {
    await createSupplyRequest({ matchResultId: result.id, expectedRequirementVersion: requirement.raw?.version || 1, expectedSupplyVersion: result.supplyPeriodVersion || result.expectedSupplyVersion || 1, expectedDeliveredPaisePerTonne: result.economics?.deliveredPaisePerTonne })
    await hydrate(); setNotice('Supply request submitted with the evaluated terms snapshot.'); navigate('requests')
  } catch (error) { setNotice(error.message) } finally { state.busy = false; render() }
}

async function loadReceipt() {
  const id = state.matchRun?.run?.id || state.matchRun?.id
  if (!id || isDemoMode || state.live.status !== 'connected') return setNotice('A persisted live match run is required for a decision receipt.')
  try { state.receipt = await getMatchReceipt(id); render() } catch (error) { setNotice(error.message) }
}

async function runScenario() {
  const id = state.matchRun?.run?.id || state.matchRun?.id
  if (!id || isDemoMode || state.live.status !== 'connected') return setNotice('Connect the API and run a match to test a scenario.')
  try { state.matchScenario = await createMatchScenario(id, { minimumPurityMolPct: 99 }); setNotice('Scenario complete: minimum purity set to 99%.'); render() } catch (error) { setNotice(error.message) }
}

function shell() {
  const pageTitle = nav.find(([id]) => id === state.view)?.[1] || 'Assistant'
  const identity = state.data.identity
  const workspaceName = identity?.currentOrganization?.name || 'Demo workspace'
  const memberName = identity?.user?.displayName || 'Demo user'
  const runtimeLabel = state.live.status === 'connected' ? 'Connected workspace' : isDemoMode || state.live.status === 'demo' || state.live.status === 'fallback' ? 'Demo workspace' : 'Connecting workspace'
  const runtimeDetail = state.live.status === 'connected' ? 'Live API · session protected' : isDemoMode || state.live.status === 'demo' || state.live.status === 'fallback' ? 'Seed data · safe to explore' : 'Checking API connection…'
  return `<div class="app-shell">
    <aside class="sidebar">
      <div class="brand-lockup" aria-label="CarbonBridge home"><div class="brand-mark"><span>↗</span></div><div><strong>carbon<span>bridge</span></strong><small>circular carbon exchange</small></div></div>
      <div class="workspace-switcher"><div class="avatar avatar-teal">${escapeHtml(workspaceName.slice(0, 2).toUpperCase())}</div><div class="workspace-copy"><strong>${escapeHtml(workspaceName)}</strong><span>${identity ? `${escapeHtml((identity.capabilities || []).join(' · ') || 'Member')} workspace` : 'Demo workspace · no live writes'}</span></div><button class="icon-button subtle" title="Workspace switching is not configured">⌄</button></div>
      <nav class="main-nav" aria-label="Main navigation">${nav.map((item, index) => `${item[3] && (index === 1 || item[3] !== nav[index - 1]?.[3]) ? `<div class="nav-section">${item[3]}</div>` : ''}<button class="nav-item ${state.view === item[0] ? 'active' : ''}" data-view="${item[0]}"><span class="nav-icon">${item[2]}</span><span>${item[1]}</span>${item[0] === 'evidence' ? '<span class="nav-count">3</span>' : ''}${item[0] === 'requests' ? '<span class="nav-dot"></span>' : ''}</button>`).join('')}</nav>
      <div class="sidebar-bottom"><div class="trust-card"><span class="status-pulse"></span><div><strong>${runtimeLabel}</strong><small>${runtimeDetail}</small></div></div><button class="nav-item" data-action="open-assistant"><span class="nav-icon">✦</span><span>Ask CarbonBridge</span><span class="shortcut">⌘K</span></button><button class="nav-item" title="Settings are not configured in this prototype" disabled><span class="nav-icon">⚙</span><span>Settings unavailable</span></button><div class="user-row"><div class="avatar avatar-coral">${escapeHtml(memberName.slice(0, 2).toUpperCase())}</div><div><strong>${escapeHtml(memberName)}</strong><span>${identity ? 'Authenticated member' : 'Demo identity'}</span></div></div></div>
    </aside>
    <main class="main-content"><header class="topbar"><div class="breadcrumbs"><span>Workspace</span><b>/</b><strong>${pageTitle}</strong></div><div class="topbar-actions"><span class="sync-status"><i></i> ${state.busy ? 'Working…' : state.live.status === 'connected' ? 'Live data synced' : 'All changes saved'}</span><button class="icon-button" aria-label="Notifications">♢<span class="notification-dot"></span></button>${button('<span>✦</span> Ask assistant', 'button button-dark button-small', 'open-assistant')}</div></header><div class="page-scroll">${state.notice ? `<div class="runtime-notice" role="status">${escapeHtml(state.notice)}</div>` : ''}${renderView()}</div></main>
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
  const currentListings = liveListings()
  const currentRequirements = liveRequirements()
  const currentRequests = liveRequests()
  const totalTonnes = currentListings.reduce((sum, item) => sum + (numberValue(item.raw?.supply?.remainingTonnes || item.quantity?.match(/^[\d.]+/)?.[0], 0)), 0)
  const demandTonnes = currentRequirements.reduce((sum, item) => sum + numberValue(item.raw?.quantityTonnes || item.need?.match(/^[\d.]+/)?.[0], 0), 0)
  return `${intro('Tuesday · 12 September 2026', 'Make the invisible, useful.', 'Your process creates more value than the final product. CarbonBridge helps you find it, prove it and connect it to the right next user.')}
    <section class="hero-grid"><div class="hero-card"><div class="hero-orbit orbit-one"></div><div class="hero-orbit orbit-two"></div><div class="hero-content"><span class="hero-kicker"><i></i> Process intelligence</span><h2>What does your process leave behind?</h2><p>Describe it in your own words. We’ll turn the steps into a map of potential resources, evidence gaps and marketplace actions.</p>${button('Describe my process <span>→</span>', 'button button-light', 'analyze-process')}<button class="text-button" data-view="assistant">Or start with a question <span>↗</span></button></div><div class="hero-footer"><span><b>✦</b> AI-assisted</span><span><b>◈</b> Evidence-aware</span><span><b>↺</b> You stay in control</span></div></div><div class="insight-card"><div class="card-heading"><div><span class="eyebrow">Your latest discovery</span><h3>${opportunities.length} potential opportunities</h3></div><span class="spark-icon">✦</span></div><div class="mini-opportunity-list">${opportunities.map((item) => `<div class="mini-opportunity"><span class="mini-icon ${item.tone}">${item.icon}</span><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.status)}</span></div><span class="confidence">${item.confidence}%</span></div>`).join('')}</div><button class="card-link" data-view="process">Review discovery <span>→</span></button></div></section>
    <section class="metric-grid">${metric('Published supply', `${totalTonnes || 360} t`, `${currentListings.length || 3} active listings`, '⌁', 'green')}${metric('Buyer demand', `${demandTonnes || 85} t`, `Across ${currentRequirements.length || 2} active needs`, '◎', 'blue')}${metric('Evidence to review', String(opportunities.filter((item) => item.status === 'Evidence needed').length || 2), 'Before anything is published', '▣', 'gold')}${metric('Open workflows', String(currentRequests.length || 3), 'Requests and approvals', '↗', 'purple')}</section>
    <section class="split-section"><div class="panel timeline-panel"><div class="panel-title"><div><span class="eyebrow">Your workspace</span><h3>Turn an idea into a trusted exchange</h3></div><button class="icon-button subtle">•••</button></div><div class="journey">${[['1', 'Describe', 'Tell us how your process works', 'current', 'process'], ['2', 'Discover', 'See potential outputs and gaps', 'next', 'process'], ['3', 'Prove', 'Add quality and quantity evidence', 'next', 'evidence'], ['4', 'Connect', 'Find buyers and make a match', 'next', 'marketplace']].map(([number, title, detail, journeyState, view]) => `<button class="journey-step ${journeyState}" data-view="${view}"><span class="journey-number">${journeyState === 'current' ? '●' : number}</span><span><strong>${title}</strong><small>${detail}</small></span><span class="journey-arrow">→</span></button>`).join('')}</div></div><div class="panel activity-panel"><div class="panel-title"><div><span class="eyebrow">Recent activity</span><h3>What’s moving</h3></div><button class="card-link" data-view="requests">View all →</button></div><div class="activity-list"><div class="activity-row"><span class="activity-icon blue">↗</span><div><strong>New buyer request</strong><span>${currentRequests.length ? escapeHtml(currentRequests[0].detail) : 'TerraForm Materials · 60 t / month'}</span></div><time>12 min</time></div><div class="activity-row"><span class="activity-icon gold">▣</span><div><strong>Evidence needed</strong><span>CO₂ composition report</span></div><time>1 hr</time></div><div class="activity-row"><span class="activity-icon green">✓</span><div><strong>Listing viewed</strong><span>Captured CO₂ · industrial grade</span></div><time>3 hr</time></div></div></div></section>`
}

function processView() {
  const stepSource = state.data.processSteps?.length ? state.data.processSteps : processSteps
  return `${intro('Process intelligence · Draft', 'Describe your process.', 'Start with what you know. CarbonBridge will identify potential outputs without treating an estimate as verified inventory.')}
    <div class="process-layout"><section class="panel process-editor"><div class="panel-title"><div><span class="eyebrow">Step 1 of 3</span><h3>Tell us what happens</h3></div><span class="draft-badge">${state.live.status === 'connected' ? 'Live draft' : 'Demo draft'}</span></div><label class="field-label" for="process-description">Your process in your own words</label><textarea id="process-description" rows="8">${escapeHtml(state.processText)}</textarea><div class="field-hint"><span>✦</span> You don’t need technical terms. Include inputs, steps, outputs and anything you already measure.</div><div class="quick-fields"><div><label>Facility</label><button class="select-field">Aster Fermentation Works <span>⌄</span></button></div><div><label>Operating scale</label><button class="select-field">Approx. 120 t / month <span>⌄</span></button></div></div><div class="editor-footer"><button class="text-button">Save and exit</button>${button(state.busy ? 'Analyzing…' : 'Analyze my process <span>→</span>', 'button button-dark', 'analyze-process')}</div></section><section class="panel process-map"><div class="panel-title"><div><span class="eyebrow">Step 2 of 3</span><h3>Process map</h3></div><span class="live-badge"><i></i> ${state.live.status === 'connected' ? 'API-backed' : 'Live preview'}</span></div><div class="map-helper">We found these steps from your description. Edit anything that looks wrong.</div><div class="step-list">${stepSource.map((step, index) => `<div class="process-step"><span class="step-node ${step[3]}">${step[3] === 'input' ? '↓' : step[3] === 'output' ? '↑' : '•'}</span><div><span class="step-number">${step[0]}</span><strong>${escapeHtml(step[1])}</strong><small>${escapeHtml(step[2])}</small></div>${index < stepSource.length - 1 ? '<span class="step-connector"></span>' : ''}</div>`).join('')}</div><button class="outlined-button">＋ Add a step</button></section></div>
    ${state.analysisRun ? `<section class="discovery-section"><div class="section-heading"><div><span class="eyebrow">Step 3 of 3 · AI-assisted discovery</span><h2>Potential opportunities</h2><p>These are hypotheses from your process. Review the reason and add evidence before creating a marketplace listing.</p></div><button class="text-button" data-view="evidence">View evidence vault →</button></div><div class="opportunity-grid">${opportunities.map((item) => `<article class="opportunity-card"><div class="opportunity-top"><span class="opportunity-icon ${item.tone}">${item.icon}</span>${statusPill(item.status)}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.reason)}</p><div class="confidence-row"><span>Confidence in signal</span><strong>${item.confidence}%</strong></div><div class="confidence-bar"><span style="width: ${item.confidence}%"></span></div><div class="opportunity-meta"><span>${escapeHtml(item.quantity)}</span><button data-view="evidence">Review next step <span>→</span></button></div></article>`).join('')}</div></section>` : ''}`
}

function marketplace() {
  const all = visibleListings().filter((item) => state.marketFilters.evidence === 'all' || item.evidence.toLowerCase() === state.marketFilters.evidence)
  const pageSize = 6, pages = Math.max(1, Math.ceil(all.length / pageSize)); state.marketPage = Math.min(state.marketPage, pages)
  const currentListings = all.slice((state.marketPage - 1) * pageSize, state.marketPage * pageSize)
  const results = state.matchRun?.results || []
  const groups = state.matchRun?.groups || {}
  const detail = state.listingDetail
  const matchRows = results.slice(0, 4).map((result) => `<div class="compare-chat-row"><div><strong>${escapeHtml(result.streamName || result.streamId || 'Supply option')}</strong><span>${escapeHtml(readableStatus(result.status))}${result.economics?.distanceKm !== undefined ? ` · ${result.economics.distanceKm} km` : ''}</span></div><strong>${moneyPerTonne(result.economics?.deliveredPaisePerTonne)}</strong>${result.status === 'compatible' ? `<button class="small-action" data-submit-request="${escapeHtml(result.id)}">Request</button>` : '<span class="fit-badge secondary">Review</span>'}</div>`).join('')
  const editor = state.listingEditor ? `<section class="panel manual-form-panel"><div class="panel-title"><div><span class="eyebrow">Supplier workspace</span><h3>Create a private listing draft</h3></div><button class="text-button" data-action="close-listing-editor">Close</button></div><form class="listing-form"><div><label class="field-label">Listing name</label><input name="name" required placeholder="Captured CO₂ stream" /></div><div><label class="field-label">Industry</label><input name="industry" value="cement" /></div><div><label class="field-label">Quantity (tonnes)</label><input name="totalTonnes" type="number" min="0.001" step="0.001" required /></div><div><label class="field-label">Minimum order (tonnes)</label><input name="minimumOrderTonnes" type="number" min="0" step="0.001" value="0" /></div><div><label class="field-label">Price (₹ / tonne)</label><input name="price" type="number" min="0" required /></div><div><label class="field-label">Purity (%)</label><input name="purity" type="number" min="0" max="100" step="0.01" required /></div><div><label class="field-label">Start</label><input name="start" type="date" required /></div><div><label class="field-label">End</label><input name="end" type="date" required /></div><button class="button button-dark" type="submit">Save private draft</button></form><p class="field-hint">Publishing is server-validated: a bounded supply period and current quality evidence are required.</p></section>` : ''
  const detailPanel = detail ? `<section class="panel manual-form-panel"><div class="panel-title"><div><span class="eyebrow">Listing detail · ${escapeHtml(detail.id)}</span><h3>${escapeHtml(detail.title)}</h3></div><button class="text-button" data-action="close-listing-detail">Close</button></div><p>${escapeHtml(detail.supplier)} · ${escapeHtml(detail.location)} · ${escapeHtml(detail.quantity)}</p><div class="listing-facts"><span><b>Purity</b>${escapeHtml(detail.purity)}</span><span><b>Price</b>${escapeHtml(detail.price)}</span><span><b>Availability</b>${escapeHtml(detail.availability)}</span></div><form class="listing-edit-form"><label class="field-label">Listing name</label><input name="name" value="${escapeHtml(detail.title)}" required /><button class="outlined-button" type="submit">Save listing name</button></form><p class="field-hint">${detail.synthetic ? 'Fictional demonstration record.' : 'Organization-provided record.'} ${detail.evidence === 'Verified' ? 'Evidence status is available for review.' : 'Evidence is incomplete; do not treat quality as verified.'}</p>${button('Publish after server validation', 'button button-dark', 'publish-listing')}</section>` : ''
  return `${intro('Trade · Captured CO₂', 'Find the right next user.', 'Live records are marked as connected; demo fallback never commits a trade.', button('＋ Create a listing', 'button button-dark', 'open-listing-editor'))}${editor}${detailPanel}<div class="market-toolbar"><div class="search-box"><span>⌕</span><input aria-label="Search marketplace" placeholder="Search by material, supplier or location" data-market-search /></div><button class="filter-button" data-filter-evidence="all">All evidence</button><button class="filter-button" data-filter-evidence="verified">Verified</button><button class="filter-button" data-filter-evidence="partial">Partial</button><span class="result-count">${all.length} results · page ${state.marketPage}/${pages}</span></div><div class="market-layout"><div class="listing-list">${currentListings.map((item) => `<article class="listing-card ${state.selectedListing === item.id ? 'selected' : ''}" data-listing="${item.id}"><div class="listing-art ${item.color}"><span>◌</span><small>CO₂</small></div><div class="listing-main"><div class="listing-heading"><div><span class="match-score">${item.score === null ? 'Unranked' : `${item.score}% fit`}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.supplier)} · ${escapeHtml(item.location)}</p></div></div><div class="listing-facts"><span><b>Quantity</b>${escapeHtml(item.quantity)}</span><span><b>Purity</b>${escapeHtml(item.purity)}</span><span><b>Price</b>${escapeHtml(item.price)}</span><span><b>Available</b>${escapeHtml(item.availability)}</span></div><div class="listing-footer"><span class="evidence-state ${item.evidence === 'Verified' ? 'verified' : 'partial'}"><i></i> ${escapeHtml(item.evidence)} evidence</span><button class="text-button" data-open-listing="${escapeHtml(item.id)}">View details →</button></div></div></article>`).join('') || '<div class="empty-state">No listings match these filters.</div>'}<div class="pagination"><button class="filter-button" data-page="${state.marketPage - 1}" ${state.marketPage === 1 ? 'disabled' : ''}>Previous</button><button class="filter-button" data-page="${state.marketPage + 1}" ${state.marketPage === pages ? 'disabled' : ''}>Next</button></div></div><div class="panel compare-panel"><div class="panel-title"><div><span class="eyebrow">Decision helper</span><h3>Match results</h3></div><span class="compare-count">${results.length} evaluated</span></div><p>${results.length ? `${groups.compatible?.length || 0} compatible · ${groups.needsEvidence?.length || 0} need evidence · ${groups.incompatible?.length || 0} incompatible` : 'Run the deterministic matcher for quality, availability, distance and delivered-cost checks.'}</p>${matchRows || '<div class="empty-state">No current match run.</div>'}${button('Choose buyer requirement', 'button button-dark full-width', 'go-requirements')}<button class="text-button centered" data-action="run-matches">Run deterministic match</button><button class="text-button centered" data-action="load-receipt">View decision receipt</button><button class="text-button centered" data-action="run-scenario">Test 99% purity scenario</button>${state.receipt ? `<p class="field-hint">Receipt: ${escapeHtml(state.receipt.id || state.receipt.runId || 'saved')} · immutable terms snapshot loaded.</p>` : ''}${state.matchScenario ? `<p class="field-hint">Scenario generated from the saved run; it does not change the requirement.</p>` : ''}</div></div>`
}

function requirementsView() {
  const currentRequirements = liveRequirements()
  const quantity = currentRequirements.reduce((sum, item) => sum + numberValue(item.raw?.quantityTonnes || item.need?.match(/^[\d.]+/)?.[0], 0), 0)
  return `${intro('Trade · Buyer side', 'Demand you can trust.', 'See what buyers need, understand the fit and prepare a request from the same decision workspace.', button('＋ Ask assistant to find a buyer', 'button button-dark', 'open-assistant'))}<div class="buyer-summary"><div class="buyer-summary-copy"><span class="eyebrow">Market signal</span><h2>${quantity || 85} tonnes of demand in your category</h2><p>${currentRequirements.length || 2} active buyer needs are visible in the current organization. Run the deterministic matcher to calculate compatibility and delivered economics.</p>${button('Explore matches <span>→</span>', 'button button-light', 'go-marketplace')}</div><div class="signal-chart"><div class="chart-label"><span>Demand by month</span><span>Oct – Dec 2026</span></div><div class="bars"><i style="height:43%"></i><i style="height:67%"></i><i style="height:81%"></i><i style="height:58%"></i><i style="height:88%"></i><i style="height:72%"></i><i style="height:94%"></i></div><div class="chart-axis"><span>Oct</span><span>Nov</span><span>Dec</span></div></div></div><section class="panel manual-form-panel"><div class="panel-title"><div><span class="eyebrow">Manual entry</span><h3>Create a buyer requirement</h3></div><span class="draft-badge">Approval-safe</span></div><form class="manual-requirement-form"><div><label class="field-label" for="requirement-quantity">Quantity (tonnes)</label><input id="requirement-quantity" name="quantityTonnes" type="number" min="0.001" step="0.001" required placeholder="e.g. 50" /></div><div><label class="field-label" for="requirement-month">Delivery month</label><input id="requirement-month" name="deliveryMonth" type="month" required value="2026-11" /></div><div><label class="field-label" for="requirement-purity">Minimum purity (%)</label><input id="requirement-purity" name="minimumPurityMolPct" type="number" min="0" max="100" step="0.1" value="95" required /></div><button class="button button-dark" type="submit">Save requirement</button></form></section><section class="panel requirements-panel"><div class="panel-title"><div><span class="eyebrow">Active buyer needs</span><h3>Where your output could fit</h3></div><button class="filter-button">Sort: best fit <span>⌄</span></button></div><div class="requirements-table"><div class="table-row table-header"><span>Buyer / use</span><span>Need</span><span>Window</span><span>Match</span><span></span></div>${currentRequirements.length ? currentRequirements.map((item) => `<div class="table-row"><div class="buyer-cell"><div class="avatar avatar-blue">${escapeHtml(item.buyer.slice(0, 2))}</div><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.buyer)}</small></div></div><span>${escapeHtml(item.need)}</span><span>${escapeHtml(item.window)}</span><span><b class="fit-badge">${item.matches === null ? 'Run match' : `${item.matches} matches`}</b><small class="table-status">${escapeHtml(item.status)}</small></span><button class="icon-button subtle" data-requirement="${escapeHtml(item.id)}">→</button></div>`).join('') : `<div class="empty-state">No requirements are available for this organization yet. Ask the assistant to create one from a quantity and delivery period.</div>`}</div></section>`
}

function requestsView() {
  const requestRow = (initials, color, title, detail, status, tone, time, id, version) => `<div class="request-row" data-request="${escapeHtml(id || '')}"><div class="avatar avatar-${color}">${initials}</div><div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div><div class="request-row-end">${statusPill(readableStatus(status))}<time>${escapeHtml(time)}</time></div>${id && status === 'pending_supplier' ? `<button class="small-action" data-request-action="accept" data-request-id="${escapeHtml(id)}">Accept</button><button class="text-button" data-request-action="decline" data-request-id="${escapeHtml(id)}">Decline</button>` : '<span>→</span>'}</div>`
  const currentRequests = liveRequests()
  const first = currentRequests[0]
  const summary = first ? `${first.quantityTonnes || '?'} t · ${first.status}` : '60 t / month · Mineralization feedstock'
  return `${intro('Trade · Workflow', 'Requests, without the back-and-forth.', 'Each request keeps its terms, evidence and status together. The assistant can prepare the next step, while you approve every external action.') }<div class="request-highlight"><div><span class="eyebrow">Needs your attention</span><h2>${first ? 'A request needs your attention' : 'TerraForm Materials wants 60 t / month'}</h2><p>${escapeHtml(summary)}. Review the exact terms before an external action is sent or accepted.</p><div class="request-tags"><span>${first ? escapeHtml(first.id) : '3-month window'}</span><span>Evidence-aware workflow</span><span class="warning-tag">Approval required</span></div></div><div class="request-actions">${button('Review request <span>→</span>', 'button button-dark')}${button('Ask assistant', 'outlined-button', 'open-assistant')}</div></div><div class="request-layout"><section class="panel request-panel"><div class="panel-title"><div><span class="eyebrow">Open requests</span><h3>Keep the exchange moving</h3></div><button class="filter-button">All statuses <span>⌄</span></button></div><div class="request-list">${currentRequests.length ? currentRequests.map((item, index) => requestRow((item.title || item.id).slice(0, 2).toUpperCase(), index % 2 ? 'green' : 'blue', item.title, item.detail, item.status, item.status === 'accepted' ? 'success' : 'warning', 'Live data', item.id, item.raw?.version)).join('') : requestRow('TF', 'blue', 'TerraForm Materials', '60 t / month · Mineralization feedstock', 'Review needed', 'warning', 'Seed data')}</div></section><section class="panel request-timeline"><div class="panel-title"><div><span class="eyebrow">Selected workflow</span><h3>${first ? escapeHtml(first.id) : 'TerraForm · 60 t / month'}</h3></div>${statusPill(readableStatus(first?.status || 'Review needed'))}</div><div class="timeline">${[['done', 'Request record loaded', 'Current organization scope'], ['done', 'Compatibility checked', 'Deterministic match receipt'], ['current', 'Next party review', 'Approval is required for external actions'], ['', 'Reservation', 'After acceptance'], ['', 'Fulfillment', 'Later workflow step']].map(([status, title, detail]) => `<div class="timeline-item ${status}"><span class="timeline-dot">${status === 'done' ? '✓' : status === 'current' ? '•' : ''}</span><div><strong>${title}</strong><small>${detail}</small></div></div>`).join('')}</div></section></div>`
}

function evidenceView() {
  const evidenceRow = (title, detail, stateName) => `<div class="evidence-row"><span class="evidence-check ${stateName}">${stateName === 'done' ? '✓' : stateName === 'locked' ? '▣' : '!'}</span><div><strong>${title}</strong><small>${detail}</small></div><button class="${stateName === 'needed' ? 'small-action' : 'icon-button subtle'}">${stateName === 'needed' ? 'Add' : stateName === 'next' ? '＋' : '•••'}</button></div>`
  return `${intro('Trust · Evidence vault', 'Make every claim traceable.', 'A potential output becomes a tradable listing only when the right quantity, quality and ownership evidence is reviewed.') }<div class="evidence-banner"><div class="evidence-banner-icon">▣</div><div><strong>3 items need your attention</strong><p>Adding these details will unlock the CO₂ listing draft. Your other marketplace listings stay unchanged.</p></div>${button('Upload evidence <span>↑</span>', 'button button-dark')}</div><div class="evidence-layout"><section class="panel checklist-panel"><div class="panel-title"><div><span class="eyebrow">CO₂ opportunity · opp-001</span><h3>Listing readiness</h3></div><span class="readiness">42% ready</span></div><div class="readiness-bar"><span style="width:42%"></span></div>${evidenceRow('Process description', 'Captured from your process draft', 'done')}${evidenceRow('Capture quantity', 'Monthly amount and measurement basis', 'needed')}${evidenceRow('Composition / purity', 'Latest analysis or lab document', 'needed')}${evidenceRow('Collection and storage', 'How the stream is captured and held', 'next')}${evidenceRow('Reviewer approval', 'Required before public publishing', 'locked')}</section><section class="panel source-panel"><div class="panel-title"><div><span class="eyebrow">Source trail</span><h3>What the assistant used</h3></div><button class="icon-button subtle">•••</button></div>${sourceRow('Your process', 'Ethanol process description', 'Aster Fermentation · edited 12 Sep', false)}${sourceRow('Reviewed source', 'CO₂ capture pathway overview', 'CarbonBridge knowledge · v1.2', false)}${sourceRow('Needs source', 'Monthly capture quantity', 'No source attached', true)}<div class="source-note"><span>✦</span><p>AI suggestions include their source and confidence. You can correct or reject each one.</p></div></section></div><section class="opportunity-evidence"><span class="eyebrow">All opportunities</span><div class="opportunity-evidence-row">${opportunities.map((item) => `<div><span class="mini-icon ${item.tone}">${item.icon}</span><strong>${escapeHtml(item.title)}</strong>${statusPill(item.status)}<button class="text-button">Open →</button></div>`).join('')}</div></section>`
}

function sourceRow(type, title, detail, muted) {
  return `<div class="source-row ${muted ? 'muted' : ''}"><span class="source-icon">${muted ? '?' : type === 'Reviewed source' ? '◈' : '✎'}</span><div><span>${type}</span><strong>${title}</strong><small>${detail}</small></div><button class="icon-button subtle">↗</button></div>`
}

function reportsView() {
  return `${intro('Impact · Reports', 'See what is moving.', 'Reports are generated from saved records and snapshots, so a number has a source, a date and a clear boundary.', button('＋ New report', 'button button-dark'))}<div class="report-filter"><span class="eyebrow">Reporting period</span><button class="select-field">01 Jul – 30 Sep 2026 <span>⌄</span></button><button class="filter-button">All activity <span>⌄</span></button><span class="report-updated">Updated today at 09:40</span></div><div class="report-metrics">${metric('Captured CO₂ listed', '360 t', '3 supply streams', '◌', 'green')}${metric('Matched demand', '85 t', '2 buyer requirements', '◎', 'blue')}${metric('Material moved', '42 t', 'Accepted and recorded', '↗', 'gold')}${metric('Evidence coverage', '78%', 'Across active records', '▣', 'purple')}</div><div class="report-grid"><section class="panel impact-chart-panel"><div class="panel-title"><div><span class="eyebrow">Activity trend</span><h3>Supply and demand over time</h3></div><div class="chart-legend"><span><i class="green-dot"></i> Supply</span><span><i class="blue-dot"></i> Demand</span></div></div><div class="large-chart"><div class="y-labels"><span>160 t</span><span>120 t</span><span>80 t</span><span>40 t</span><span>0 t</span></div><div class="chart-lines"><div class="gridline"></div><div class="gridline"></div><div class="gridline"></div><div class="gridline"></div><div class="gridline"></div><svg viewBox="0 0 620 220" role="img" aria-label="Supply and demand trend chart"><path d="M0,174 C80,160 110,150 165,132 S260,154 312,116 S414,108 464,74 S550,104 620,44" class="supply-line"></path><path d="M0,196 C74,188 122,181 165,174 S254,181 312,158 S416,170 464,140 S550,142 620,118" class="demand-line"></path><circle cx="620" cy="44" r="5" class="supply-point"></circle><circle cx="620" cy="118" r="5" class="demand-point"></circle></svg><div class="x-labels"><span>Jul</span><span>Aug</span><span>Sep</span></div></div></div></section><section class="panel report-insight-panel"><div class="panel-title"><div><span class="eyebrow">Assistant insight</span><h3>One thing to act on</h3></div><span class="spark-icon">✦</span></div><div class="insight-quote">“Demand is growing faster than verified supply for high-purity CO₂. Adding the missing composition report could unlock the TerraForm request.”</div><span class="insight-source">Based on 2 requirements · 3 listings · 12 Sep</span>${button('Open action plan <span>→</span>', 'button button-dark full-width')}</section></div>`
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
  if (kind === 'checklist') return `<div class="chat-card checklist-chat-card"><div class="chat-card-header"><span class="mini-icon gold">▣</span><div><span class="eyebrow">Evidence checklist</span><strong>${payload.fields?.length || 2} items unlock the next step</strong></div></div><div class="chat-checklist">${(payload.fields || ['Monthly quantity and basis', 'Latest composition report']).map((field) => `<span><i class="empty-check"></i> ${escapeHtml(field)}</span>`).join('')}<span class="complete"><i>✓</i> Process description</span></div><div class="chat-card-footer"><span>Nothing is published automatically</span><button class="small-action" data-view="evidence">Open vault →</button></div></div>`
  return `<div class="chat-card report-chat-card"><div class="chat-card-header"><span class="mini-icon purple">▥</span><div><span class="eyebrow">Report ready to configure</span><strong>Activity + evidence coverage</strong></div></div><div class="report-chat-grid"><div><strong>360 t</strong><span>Listed supply</span></div><div><strong>85 t</strong><span>Matched demand</span></div><div><strong>78%</strong><span>Evidence coverage</span></div></div><div class="chat-card-footer"><span>Period: 01 Jul – 30 Sep 2026</span><button class="small-action" data-view="reports">Open report →</button></div></div>`
}

function messagesHtml(messages) {
  return `<div class="chat-messages">${messages.map((message) => `<div class="message-row ${message.role}"><div class="chat-avatar ${message.role}">${message.role === 'assistant' ? '✦' : 'AS'}</div><div class="message-body"><div class="message-bubble">${escapeHtml(message.text)}</div>${message.card ? assistantCard(message.card, message.payload || {}) : ''}<time>${message.time}</time></div></div>`).join('')}</div>`
}

function composer() {
  return `<div class="suggestion-row"><button data-prompt="What outputs could I sell from this process?">What can I sell?</button><button data-prompt="Find the best buyer for my captured CO₂">Find a buyer</button><button data-prompt="What evidence is missing?">What is missing?</button></div><form class="composer"><button type="button" class="composer-icon" aria-label="Attach a file">＋</button><input name="message" placeholder="Ask CarbonBridge anything…" aria-label="Message CarbonBridge" autocomplete="off" /><button type="button" class="composer-icon" aria-label="Voice input">◉</button><button type="submit" class="send-button" aria-label="Send message">↑</button></form><div class="composer-foot"><span><i></i> Assistant uses ${isDemoMode ? 'seeded demo' : 'live'} workspace context</span><span>Enter to send · Shift + Enter for new line</span></div>`
}

function assistantPanel() {
  return `<aside class="assistant-panel"><div class="assistant-panel-header"><div class="assistant-title"><span class="assistant-spark">✦</span><div><strong>CarbonBridge assistant</strong><span><i></i> ${state.live.status === 'connected' ? 'Live API' : 'Demo'} · Aster workspace</span></div></div><div><button class="icon-button subtle" data-view="assistant" aria-label="Open full assistant">↗</button><button class="icon-button subtle" data-action="close-assistant" aria-label="Close assistant">×</button></div></div><div class="assistant-context"><span>Context</span><button>My ethanol process <b>×</b></button><button>Seller workspace <b>×</b></button></div>${messagesHtml(state.messages.slice(-5))}<div class="assistant-composer">${composer()}</div></aside>`
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
  document.querySelector('#root').innerHTML = shell()
  const processDescription = document.querySelector('#process-description')
  if (processDescription) processDescription.addEventListener('input', (event) => { state.processText = event.target.value })
  const marketSearch = document.querySelector('[data-market-search]')
  if (marketSearch) {
    marketSearch.value = state.marketQuery
    marketSearch.addEventListener('input', (event) => { state.marketQuery = event.target.value; render() })
  }
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-view], [data-action], [data-prompt], [data-listing], [data-open-listing], [data-approve-action], [data-cancel-action], [data-requirement], [data-request-action], [data-submit-request], [data-filter-evidence], [data-page]')
  if (!target) return
  if (target.dataset.view) {
    navigate(target.dataset.view)
  }
  if (target.dataset.action === 'open-assistant') { state.assistantOpen = true; render() }
  if (target.dataset.action === 'close-assistant') { state.assistantOpen = false; render() }
  if (target.dataset.action === 'analyze-process') { analyzeProcess(); return }
  if (target.dataset.action === 'go-process') { navigate('process'); return }
  if (target.dataset.action === 'go-marketplace') { navigate('marketplace'); return }
  if (target.dataset.action === 'go-requirements') { navigate('requirements'); return }
  if (target.dataset.action === 'open-listing-editor') { state.listingEditor = {}; state.listingDetail = null; render(); return }
  if (target.dataset.action === 'close-listing-editor') { state.listingEditor = null; render(); return }
  if (target.dataset.action === 'close-listing-detail') { state.listingDetail = null; render(); return }
  if (target.dataset.action === 'publish-listing') { publishSelectedListing(); return }
  if (target.dataset.action === 'load-receipt') { loadReceipt(); return }
  if (target.dataset.action === 'run-scenario') { runScenario(); return }
  if (target.dataset.action === 'run-matches') {
    const requirement = liveRequirements()[0]
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
  if (target.dataset.openListing) { openListing(target.dataset.openListing); return }
  if (target.dataset.submitRequest) { submitSelectedRequest(target.dataset.submitRequest); return }
  if (target.dataset.filterEvidence) { state.marketFilters.evidence = target.dataset.filterEvidence; state.marketPage = 1; render(); return }
  if (target.dataset.page) { state.marketPage = Math.max(1, Number(target.dataset.page)); render(); return }
  if (target.dataset.listing) {
    state.selectedListing = target.dataset.listing
    if (!state.selectedListings.includes(target.dataset.listing)) {
      state.selectedListings = [...state.selectedListings, target.dataset.listing].slice(-3)
    }
    render()
  }
})

document.addEventListener('submit', (event) => {
  if (event.target.matches('.listing-edit-form')) {
    event.preventDefault()
    editSelectedListing(event.target)
    return
  }
  if (event.target.matches('.listing-form')) {
    event.preventDefault()
    saveListing(event.target)
    return
  }
  if (event.target.matches('.manual-requirement-form')) {
    event.preventDefault()
    saveManualRequirement(event.target)
    return
  }
  if (!event.target.matches('.composer')) return
  event.preventDefault()
  const input = event.target.elements.message
  const value = input.value
  input.value = ''
  sendMessage(value)
})

render()
hydrate()
