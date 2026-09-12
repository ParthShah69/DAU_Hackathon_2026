const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'qwen3:4b';

function enabled(environment = process.env) {
  return String(environment.ASSISTANT_PROVIDER || '').toLowerCase() === 'ollama';
}

function configuration(environment = process.env) {
  return {
    enabled: enabled(environment),
    provider: enabled(environment) ? 'ollama' : 'heuristic-demo',
    model: environment.OLLAMA_MODEL || DEFAULT_MODEL,
    baseUrl: (environment.OLLAMA_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  };
}

const PLAN_SYSTEM_PROMPT = `You are CarbonBridge's AI Marketplace Assistant planner.
Your job is to analyze the user's message, classify intent, extract structured arguments, and select the appropriate tool.

Available Tools:
1. "discover_process_outputs": User describes an industrial process or facility (e.g. cement, brewery, refinery, textile) and asks what byproducts/CO2 they can capture or sell.
   Args: { "description": string }
2. "create_requirement": User wants to procure or buy CO2 or industrial byproduct materials.
   Args: {
     "quantityTonnes": number,
     "periodStart": "YYYY-MM-DD",
     "periodEnd": "YYYY-MM-DD",
     "minimumPurityMolPct": number (0 to 100),
     "acceptableForms": ["gas" | "liquid" | "solid"],
     "maxDistanceKm": number,
     "maxDeliveredPaisePerTonne": number (in paise, 1 INR = 100 paise)
   }
   NOTE: If quantity in tonnes OR delivery period (month/year) is missing or incomplete, choose tool "clarify" and list the missing fields in "missingFields".
3. "find_matches": User wants to search for, match, or find available supplier listings for their requirement.
   Args: { "requirementId": string or null }
4. "compare_options": User wants to compare matching supplier options side-by-side or asks which option is best.
   Args: {}
5. "prepare_listing": User wants to create or draft a listing from a previously discovered process byproduct opportunity.
   Args: {}
6. "prepare_request": User wants to prepare or send a supply request / buy from a specific matching option (e.g. "prepare request for first option").
   Args: { "target": "first" | "second" | "third" | string }
7. "manage_request": User wants to accept, decline, or inspect an existing supply request (e.g. "accept request <id>").
   Args: { "action": "accept" | "decline" | "view", "requestId": string or null }
8. "confirm_action": User explicitly confirms, approves, or says yes to a pending action proposal (e.g. "yes", "confirm", "approve", "go ahead", "do it", "proceed", "okay").
   Args: {}
9. "cancel_action": User cancels, stops, or discards a pending action proposal (e.g. "cancel", "stop", "never mind", "discard").
   Args: {}
10. "explain_context": User asks what the current status is, what the assistant can do, or why something happened.
   Args: {}
11. "clarify": The request is ambiguous, general, or missing required fields.
   Args: { "missingFields": string[], "question": string }

Respond ONLY with a valid JSON object matching this schema:
{
  "intent": "<one of: discover_process_outputs | create_requirement | find_matches | compare_options | prepare_listing | prepare_request | manage_request | confirm_action | cancel_action | explain_context | clarify>",
  "tool": "<name of the tool matching the intent>",
  "arguments": { ... },
  "missingFields": [ ... ],
  "rationale": "<brief explanation of reasoning>"
}`;

async function planTurn({ message, history = [], context = {}, actor = {}, environment = process.env }) {
  const config = configuration(environment);
  if (!config.enabled) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(environment.OLLAMA_TIMEOUT_MS || 45_000));

  const messages = [
    { role: 'system', content: PLAN_SYSTEM_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        message,
        actorContext: {
          organizationId: actor.organizationId || null,
          roles: actor.roles || []
        },
        conversationContext: context,
        recentHistory: history.slice(-4).map((m) => ({ role: m.role, content: m.content }))
      })
    }
  ];

  try {
    const result = await fetch(`${config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        stream: false,
        think: false,
        format: 'json',
        options: { temperature: 0, num_predict: 250 },
        messages
      })
    });
    if (!result.ok) throw new Error(`Ollama planning returned status ${result.status}`);
    const payload = await result.json();
    const content = String(payload?.message?.content || '').trim();
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || !parsed.intent) throw new Error('Invalid plan format from Ollama');
    return {
      intent: String(parsed.intent).trim(),
      tool: String(parsed.tool || parsed.intent).trim(),
      arguments: parsed.arguments && typeof parsed.arguments === 'object' ? parsed.arguments : {},
      missingFields: Array.isArray(parsed.missingFields) ? parsed.missingFields : [],
      rationale: parsed.rationale ? String(parsed.rationale) : 'LLM planned turn'
    };
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const SYNTHESIS_SYSTEM_PROMPT = `You are CarbonBridge’s evidence-bound assistant.
Synthesize the executed marketplace results into a clear, concise, and helpful response for the user.
STRICT RULES:
1. Use ONLY the supplied evidence, action details, and tool results.
2. Do not invent numbers, dates, IDs, prices, legal claims, or certifications that are not in the evidence.
3. If an action preview is waiting for approval, clearly inform the user of the terms and ask them to confirm or cancel.
4. If an action succeeded, confirm it was executed and summarize the receipt.
5. If information is missing, ask for the missing fields directly.
Return JSON ONLY: {"answer": "..."}`;

async function synthesizeTurnResponse(output, { plan = null, environment = process.env } = {}) {
  const config = configuration(environment);
  if (!config.enabled) return { output, applied: false, config };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(environment.OLLAMA_TIMEOUT_MS || 45_000));

  const evidence = {
    answerDraft: output.response.text,
    cards: output.response.cards,
    context: output.context,
    state: output.state,
    plan: plan || output.intent?.plan || null
  };

  try {
    const result = await fetch(`${config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        stream: false,
        think: false,
        format: { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] },
        options: { temperature: 0, num_predict: 200 },
        messages: [
          { role: 'system', content: SYNTHESIS_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(evidence) }
        ]
      })
    });
    if (!result.ok) throw new Error(`Ollama synthesis returned status ${result.status}`);
    const payload = await result.json();
    const parsed = JSON.parse(String(payload?.message?.content || '').trim());
    const answer = typeof parsed.answer === 'string' ? parsed.answer.trim() : '';
    if (!answer || answer.length > 1400) throw new Error('Ollama returned invalid synthesis');
    return {
      output: {
        ...output,
        response: {
          ...output.response,
          text: answer,
          provenance: {
            kind: plan ? 'end_to_end_llm_agent' : 'local_model_rewrite',
            provider: 'ollama',
            model: config.model,
            evidenceCardTypes: output.response.cards.map((card) => card.type),
            plan
          }
        },
        intent: {
          ...output.intent,
          provider: plan ? 'ollama-agent' : output.intent?.provider || 'heuristic-orchestrator+ollama'
        }
      },
      applied: true,
      config
    };
  } catch (error) {
    return {
      output: {
        ...output,
        response: {
          ...output.response,
          provenance: {
            kind: 'deterministic_fallback',
            provider: 'heuristic-demo',
            reason: error.name === 'AbortError' ? 'timeout' : 'unavailable'
          }
        }
      },
      applied: false,
      config,
      error: error.message
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function narrateEvidenceBoundOutput(output, environment = process.env) {
  return synthesizeTurnResponse(output, { plan: null, environment });
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
  } catch (error) {
    return { ...config, ready: false, reason: `Ollama is unavailable: ${error.message}` };
  }
}

module.exports = {
  configuration,
  planTurn,
  synthesizeTurnResponse,
  narrateEvidenceBoundOutput,
  providerStatus
};

