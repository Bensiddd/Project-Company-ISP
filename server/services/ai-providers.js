// Map DB role names to API role names
function mapRole(role) {
  if (role === 'bot') return 'assistant';
  if (role === 'agent') return 'assistant';
  return 'user';
}

// Build OpenAI-style messages array from history rows
function buildMessages(systemPrompt, history, userMessage) {
  const msgs = [{ role: 'system', content: systemPrompt }];
  // Add prior turns (skip the last entry since it's the current user message we'll add below)
  const prior = history.slice(0, -1);
  for (const h of prior) {
    msgs.push({ role: mapRole(h.role), content: h.message });
  }
  msgs.push({ role: 'user', content: userMessage });
  return msgs;
}

export async function callAI(provider, model, apiKey, userMessage, aiUrl, history = []) {
  switch (provider) {
    case 'openai':
      return callOpenAI(model || 'gpt-4o-mini', apiKey, userMessage, aiUrl, false, history);
    case 'openrouter':
      return callOpenAI(model || 'openrouter/auto', apiKey, userMessage, aiUrl || 'https://openrouter.ai/api/v1', true, history);
    case 'gemini':
      return callGemini(model || 'gemini-2.0-flash', apiKey, userMessage, aiUrl, history);
    case 'claude':
      return callClaude(model || 'claude-3-haiku-20240307', apiKey, userMessage, aiUrl, history);
    case 'custom':
      return callCustom(aiUrl || '', apiKey, userMessage, model || '', history);
    default:
      return { ok: false, error: 'Unknown AI provider: ' + provider };
  }
}

const SYSTEM_PROMPT = 'Anda adalah customer service MAZNET, ISP RT RW NET di Bekasi. Jawab dengan ramah, profesional, dan ringkas dalam Bahasa Indonesia. Jangan mengulangi jawaban yang sudah pernah Anda berikan sebelumnya dalam percakapan ini.';

async function callOpenAI(model, apiKey, userMessage, baseUrl, skipV1 = false, history = []) {
  const cleanBase = (baseUrl || 'https://api.openai.com').replace(/\/+$/, '');
  const url = (skipV1 || cleanBase.endsWith('/v1') || cleanBase.endsWith('/v1/'))
    ? cleanBase.replace(/\/+$/, '') + '/chat/completions'
    : cleanBase + '/v1/chat/completions';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: buildMessages(SYSTEM_PROMPT, history, userMessage),
        max_tokens: 500
      })
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      let errBody = '';
      try { errBody = JSON.stringify(await resp.json()).substring(0, 200); } catch {}
      return { ok: false, error: `HTTP ${resp.status}: ${errBody || resp.statusText}` };
    }
    const json = await resp.json();
    if (json.error) return { ok: false, error: `API error: ${JSON.stringify(json.error).substring(0, 200)}` };
    return { ok: true, text: json.choices?.[0]?.message?.content || '' };
  } catch (e) { return { ok: false, error: e.name === 'AbortError' ? 'Request timed out (20s)' : e.message }; }
}

async function callGemini(model, apiKey, userMessage, baseUrl, history = []) {
  const url = (baseUrl || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '') + `/v1beta/models/${model}:generateContent?key=${apiKey}`;
  // Build Gemini-style contents from history
  const contents = [];
  const prior = history.slice(0, -1);
  for (const h of prior) {
    const geminiRole = (h.role === 'user') ? 'user' : 'model';
    contents.push({ role: geminiRole, parts: [{ text: h.message }] });
  }
  contents.push({ role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\nPertanyaan: ' + userMessage }] });
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 500 } })
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      let errBody = '';
      try { errBody = JSON.stringify(await resp.json()).substring(0, 200); } catch {}
      return { ok: false, error: `HTTP ${resp.status}: ${errBody || resp.statusText}` };
    }
    const json = await resp.json();
    if (json.error) return { ok: false, error: `API error: ${JSON.stringify(json.error).substring(0, 200)}` };
    return { ok: true, text: json.candidates?.[0]?.content?.parts?.[0]?.text || '' };
  } catch (e) { return { ok: false, error: e.name === 'AbortError' ? 'Request timed out (20s)' : e.message }; }
}

async function callClaude(model, apiKey, userMessage, baseUrl, history = []) {
  const url = (baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '') + '/v1/messages';
  // Build Claude messages from history
  const prior = history.slice(0, -1);
  const claudeMsgs = prior.map(h => ({ role: mapRole(h.role), content: h.message }));
  claudeMsgs.push({ role: 'user', content: userMessage });
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      signal: controller.signal,
      body: JSON.stringify({
        model, max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: claudeMsgs
      })
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      let errBody = '';
      try { errBody = JSON.stringify(await resp.json()).substring(0, 200); } catch {}
      return { ok: false, error: `HTTP ${resp.status}: ${errBody || resp.statusText}` };
    }
    const json = await resp.json();
    if (json.error) return { ok: false, error: `API error: ${JSON.stringify(json.error).substring(0, 200)}` };
    return { ok: true, text: json.content?.[0]?.text || '' };
  } catch (e) { return { ok: false, error: e.name === 'AbortError' ? 'Request timed out (20s)' : e.message }; }
}

async function callCustom(url, apiKey, userMessage, model, history = []) {
  if (!url) return { ok: false, error: 'Custom API URL is required' };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = 'Bearer ' + apiKey;
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: buildMessages(SYSTEM_PROMPT, history, userMessage),
        max_tokens: 500
      })
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      let errBody = '';
      try { errBody = JSON.stringify(await resp.json()).substring(0, 200); } catch {}
      return { ok: false, error: `HTTP ${resp.status}: ${errBody || resp.statusText}` };
    }
    const json = await resp.json();
    return { ok: true, text: json.choices?.[0]?.message?.content || json.response || json.reply || json.text || json.message || JSON.stringify(json) };
  } catch (e) { return { ok: false, error: e.message }; }
}
