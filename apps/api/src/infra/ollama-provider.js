const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'qwen3:4b';

function enabled(environment = process.env) {
  return String(environment.ASSISTANT_PROVIDER || '').toLowerCase() === 'ollama';
}

function configuration(environment = process.env) {
  return { enabled: enabled(environment), provider: enabled(environment) ? 'ollama' : 'heuristic-demo', model: environment.OLLAMA_MODEL || DEFAULT_MODEL, baseUrl: (environment.OLLAMA_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '') };
}

function evidenceSummary(output) {
  return JSON.stringify({ answer: output.response.text, cards: output.response.cards, context: output.context });
}

async function narrateEvidenceBoundOutput(output, environment = process.env) {
  const config = configuration(environment);
  if (!config.enabled) return { output, applied: false, config };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(environment.OLLAMA_TIMEOUT_MS || 45_000));
  try {
    const result = await fetch(`${config.baseUrl}/api/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ model: config.model, stream: false, think: false, format: { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] }, options: { temperature: 0, num_predict: 160 }, messages: [
        { role: 'system', content: 'You are CarbonBridge’s evidence-bound response editor. Rewrite the supplied deterministic answer in clear, concise language. Use ONLY the supplied evidence. Do not add facts, numbers, dates, IDs, policy claims, recommendations, or citations that are absent. Do not claim an action happened unless the supplied answer says so. Do not tell the user to bypass approval. Return JSON only: {"answer":"..."}.' },
        { role: 'user', content: evidenceSummary(output) }
      ] })
    });
    if (!result.ok) throw new Error(`Ollama returned ${result.status}`);
    const payload = await result.json();
    const parsed = JSON.parse(String(payload?.message?.content || '').trim());
    const answer = typeof parsed.answer === 'string' ? parsed.answer.trim() : '';
    if (!answer || answer.length > 1400) throw new Error('Ollama returned an invalid bounded response');
    return { output: { ...output, response: { ...output.response, text: answer, provenance: { kind: 'local_model_rewrite', provider: 'ollama', model: config.model, evidenceCardTypes: output.response.cards.map((card) => card.type) } }, intent: { ...output.intent, provider: 'heuristic-orchestrator+ollama' } }, applied: true, config };
  } catch (error) {
    return { output: { ...output, response: { ...output.response, provenance: { kind: 'deterministic_fallback', provider: 'heuristic-demo', reason: error.name === 'AbortError' ? 'timeout' : 'unavailable' } } }, applied: false, config, error: error.message };
  } finally { clearTimeout(timeout); }
}

async function providerStatus(environment = process.env) {
  const config = configuration(environment);
  if (!config.enabled) return { ...config, ready: false, reason: 'Set ASSISTANT_PROVIDER=ollama to enable the local model.' };
  try {
    const response = await fetch(`${config.baseUrl}/api/tags`, { signal: AbortSignal.timeout(2_000) });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    const data = await response.json();
    const installed = (data.models || []).some((model) => model.name === config.model || model.name.startsWith(`${config.model}:`));
    return { ...config, ready: installed, reason: installed ? null : `Model ${config.model} is not installed.` };
  } catch (error) { return { ...config, ready: false, reason: `Ollama is unavailable: ${error.message}` }; }
}

module.exports = { configuration, narrateEvidenceBoundOutput, providerStatus };
