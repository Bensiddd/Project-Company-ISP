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

export const DEFAULT_SYSTEM_PROMPT = 'Anda adalah customer service MAZNET, ISP RT RW NET di Bekasi. Jawab dengan ramah, profesional, dan ringkas dalam Bahasa Indonesia. Jangan mengulangi jawaban yang sudah pernah Anda berikan sebelumnya dalam percakapan ini.';

function resolvePrompt(systemPrompt) {
  return (systemPrompt && String(systemPrompt).trim()) ? String(systemPrompt) : DEFAULT_SYSTEM_PROMPT;
}

// Clean and normalize API URL to prevent path duplication or trailing slashes
function normalizeUrl(baseUrl, defaultUrl, pathSuffix) {
  let url = (baseUrl || defaultUrl).trim();
  
  // Strip trailing slashes
  url = url.replace(/\/+$/, '');

  // If already ends with the full path, return it as is
  if (url.endsWith(pathSuffix)) {
    return url;
  }

  // If ends with just "/v1", append the remaining suffix
  if (url.endsWith('/v1') && pathSuffix.startsWith('/v1/')) {
    return url + pathSuffix.substring(3);
  }

  // Default append
  return url + pathSuffix;
}

export async function callAI(provider, model, apiKey, userMessage, aiUrl, history = [], systemPrompt = null) {
  const prompt = resolvePrompt(systemPrompt);
  switch (provider) {
    case 'openai':
      return callOpenAI(model || 'gpt-4o-mini', apiKey, userMessage, aiUrl, false, history, prompt);
    case 'openrouter':
      return callOpenAI(model || 'openrouter/auto', apiKey, userMessage, aiUrl || 'https://openrouter.ai/api/v1', true, history, prompt);
    case 'gemini':
      return callGemini(model || 'gemini-2.0-flash', apiKey, userMessage, aiUrl, history, prompt);
    case 'claude':
      return callClaude(model || 'claude-3-haiku-20240307', apiKey, userMessage, aiUrl, history, prompt);
    case 'custom':
      return callCustom(aiUrl || '', apiKey, userMessage, model || '', history, prompt);
    default:
      return { ok: false, error: 'Unknown AI provider: ' + provider };
  }
}

async function callOpenAI(model, apiKey, userMessage, baseUrl, skipV1 = false, history = [], systemPrompt = DEFAULT_SYSTEM_PROMPT) {
  const defaultUrl = 'https://api.openai.com';
  const pathSuffix = '/v1/chat/completions';
  const url = skipV1 
    ? normalizeUrl(baseUrl, defaultUrl, '').replace(/\/+$/, '') + '/chat/completions'
    : normalizeUrl(baseUrl, defaultUrl, pathSuffix);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: buildMessages(systemPrompt, history, userMessage),
        max_tokens: 200
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

async function callGemini(model, apiKey, userMessage, baseUrl, history = [], systemPrompt = DEFAULT_SYSTEM_PROMPT) {
  const url = (baseUrl || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '') + `/v1beta/models/${model}:generateContent?key=${apiKey}`;
  // Build Gemini-style contents from history
  const contents = [];
  const prior = history.slice(0, -1);
  for (const h of prior) {
    const geminiRole = (h.role === 'user') ? 'user' : 'model';
    contents.push({ role: geminiRole, parts: [{ text: h.message }] });
  }
  contents.push({ role: 'user', parts: [{ text: systemPrompt + '\n\nPertanyaan: ' + userMessage }] });
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 200 } })
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

async function callClaude(model, apiKey, userMessage, baseUrl, history = [], systemPrompt = DEFAULT_SYSTEM_PROMPT) {
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
        model, max_tokens: 200,
        system: systemPrompt,
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

async function callCustom(rawUrl, apiKey, userMessage, model, history = [], systemPrompt = DEFAULT_SYSTEM_PROMPT) {
  if (!rawUrl) return { ok: false, error: 'Custom API URL is required' };
  
  // Normalize and trim Custom URL to ensure proper endpoint format
  let url = rawUrl.trim();
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // If user provided just domain or base path, helpfully append typical chat completion endpoint
    if (!url.includes('/chat/completions') && !url.includes('/api/v1/chat/completions') && !url.includes('/api/chat')) {
      const cleanUrl = url.replace(/\/+$/, '');
      if (cleanUrl.endsWith('/v1')) {
        url = cleanUrl + '/chat/completions';
      } else {
        url = cleanUrl + '/v1/chat/completions';
      }
    }
  } else {
    return { ok: false, error: 'URL must start with http:// or https://' };
  }

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
        messages: buildMessages(systemPrompt, history, userMessage),
        max_tokens: 200
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
