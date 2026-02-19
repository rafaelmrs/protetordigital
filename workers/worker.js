/**
 * ProtetorDigital — Cloudflare Worker
 *
 * Endpoints:
 *   POST /api/scan            — URL maliciosa via Google Safe Browsing (sem KV, sem cron)
 *   POST /api/breach          — Vazamentos de email (HIBP v3 + cache KV 24h opcional)
 *   POST /api/pwned-password  — Senha vazada (HIBP k-anonymity, sem KV)
 *   GET  /api/health          — Health check
 *
 * Variáveis de ambiente obrigatórias (wrangler secret put / Dashboard):
 *   SAFE_BROWSING_API_KEY  — https://developers.google.com/safe-browsing/v4/get-started
 *   HIBP_API_KEY           — https://haveibeenpwned.com/API/Key (~$3.95/mês)
 *
 * KV Namespace (opcional, só para cache do breach):
 *   URL_SAFETY_KV — se vinculado, cacheia resultados do HIBP por 24h
 *
 * Rotas configuradas no wrangler.toml:
 *   protetordigital.com/api/* → este worker
 *
 * IMPORTANTE: O endpoint /scan não usa mais KV nem cron.
 * Cada verificação de link chama a Safe Browsing API diretamente.
 * Isso elimina completamente os writes de prefixes que esgotaram o KV.
 */

// ──────────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────────
const SAFE_BROWSING_LOOKUP = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';
const HIBP_BREACH_URL = 'https://haveibeenpwned.com/api/v3/breachedaccount/';
const HIBP_PWNED_URL  = 'https://api.pwnedpasswords.com/range/';

const ALLOWED_ORIGINS = [
  'https://protetordigital.com',
  'https://www.protetordigital.com',
  'http://localhost:4321',
  'http://localhost:3000',
];

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
function corsHeaders(origin = '') {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : 'https://protetordigital.com';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

// Rate limiting in-memory simples (reseta por isolate do Worker)
const _rl = new Map();
function checkRateLimit(key, max, windowMs) {
  const now = Date.now();
  const rec = _rl.get(key) || { count: 0, start: now };
  if (now - rec.start > windowMs) {
    _rl.set(key, { count: 1, start: now });
    return true;
  }
  if (rec.count >= max) return false;
  rec.count++;
  _rl.set(key, rec);
  return true;
}

// Rate limiting via KV (persistente entre isolates, usado só no breach)
async function checkRateLimitKV(kv, key, limit, windowSeconds) {
  if (!kv) return true; // sem KV → sem rate limiting persistente
  const now = Math.floor(Date.now() / 1000);
  const windowKey = `rl:${key}:${Math.floor(now / windowSeconds)}`;
  const current = parseInt(await kv.get(windowKey) || '0');
  if (current >= limit) return false;
  await kv.put(windowKey, String(current + 1), { expirationTtl: windowSeconds * 2 });
  return true;
}

function getIP(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

// ──────────────────────────────────────────────────────────────
// POST /api/scan — Safe Browsing direta, sem KV, sem cron
// ──────────────────────────────────────────────────────────────
async function handleScan(request, env, origin) {
  const ip = getIP(request);

  // Rate limit: 30 req/min por IP (in-memory)
  if (!checkRateLimit(`scan:${ip}`, 30, 60_000)) {
    return jsonResponse({ error: 'Muitas requisições. Aguarde 1 minuto.' }, 429, origin);
  }

  let body;
  try { body = await request.json(); } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400, origin);
  }

  const { url } = body;
  if (!url || typeof url !== 'string') {
    return jsonResponse({ error: 'URL inválida' }, 400, origin);
  }

  // Validação de URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error();
  } catch {
    return jsonResponse({ error: 'URL inválida. Use http:// ou https://' }, 400, origin);
  }

  if (!env.SAFE_BROWSING_API_KEY) {
    return jsonResponse({ error: 'Serviço temporariamente indisponível' }, 503, origin);
  }

  const t0 = Date.now();

  // Chamada direta à Safe Browsing threatMatches:find
  // Sem prefix lookup local, sem writes em KV — cada request é uma consulta ao vivo
  let sbRes;
  try {
    sbRes = await fetch(`${SAFE_BROWSING_LOOKUP}?key=${env.SAFE_BROWSING_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: { clientId: 'protetordigital', clientVersion: '2.0.0' },
        threatInfo: {
          threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url: parsedUrl.href }],
        },
      }),
    });
  } catch {
    return jsonResponse({ error: 'Erro ao consultar Safe Browsing. Tente novamente.' }, 502, origin);
  }

  if (!sbRes.ok) {
    console.error('Safe Browsing API error:', sbRes.status);
    return jsonResponse({ error: 'Erro na API de verificação' }, 502, origin);
  }

  const sbData = await sbRes.json();
  const matches = sbData.matches || [];
  const threats = matches.map(m => m.threatType);

  return jsonResponse({
    safe: threats.length === 0,
    threats,
    method: 'direct_lookup',
    latency: `${Date.now() - t0}ms`,
    checkedAt: new Date().toISOString(),
  }, 200, origin);
}

// ──────────────────────────────────────────────────────────────
// POST /api/breach — HIBP v3 com cache KV opcional 24h
// ──────────────────────────────────────────────────────────────
function determineSeverity(dataClasses) {
  const arr = Array.isArray(dataClasses)
    ? dataClasses.map(d => d.toLowerCase())
    : [String(dataClasses).toLowerCase()];
  const high = ['passwords', 'credit cards', 'bank account', 'social security', 'cpf', 'financial'];
  const medium = ['email addresses', 'phone numbers', 'physical addresses', 'usernames', 'dates of birth'];
  if (high.some(h => arr.some(d => d.includes(h)))) return 'high';
  if (medium.some(m => arr.some(d => d.includes(m)))) return 'medium';
  return 'low';
}

async function handleBreachCheck(request, env, origin) {
  let body;
  try { body = await request.json(); } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400, origin);
  }

  const { email } = body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Email inválido' }, 400, origin);
  }

  if (!env.HIBP_API_KEY) {
    return jsonResponse({ error: 'HIBP_API_KEY não configurada no Worker.' }, 500, origin);
  }

  const ip = getIP(request);

  // Rate limit via KV (persistente): 10 req/hora por IP para breach
  // Fallback in-memory se não houver KV
  if (env.URL_SAFETY_KV) {
    const allowed = await checkRateLimitKV(env.URL_SAFETY_KV, `breach:${ip}`, 10, 3600);
    if (!allowed) return jsonResponse({ error: 'Limite de consultas atingido. Tente novamente em 1 hora.' }, 429, origin);
  } else {
    if (!checkRateLimit(`breach:${ip}`, 10, 3_600_000)) {
      return jsonResponse({ error: 'Limite de consultas atingido. Tente novamente mais tarde.' }, 429, origin);
    }
  }

  // Cache KV 24h (se disponível) — leitura é barata e não consome quota significativa
  const emailLower = email.toLowerCase();
  const cacheKey = `hibp:${emailLower}`;
  if (env.URL_SAFETY_KV) {
    const cached = await env.URL_SAFETY_KV.get(cacheKey, 'json');
    if (cached) return jsonResponse({ ...cached, cached: true }, 200, origin);
  }

  try {
    const res = await fetch(
      `${HIBP_BREACH_URL}${encodeURIComponent(emailLower)}?truncateResponse=false`,
      {
        headers: {
          'hibp-api-key': env.HIBP_API_KEY,
          'User-Agent': 'ProtetorDigital/2.0',
        },
      }
    );

    let breaches = [];
    if (res.status === 404) {
      breaches = [];
    } else if (res.status === 401) {
      return jsonResponse({ error: 'HIBP_API_KEY inválida.' }, 500, origin);
    } else if (res.status === 429) {
      return jsonResponse({ error: 'Muitas consultas simultâneas. Tente em alguns segundos.' }, 429, origin);
    } else if (res.ok) {
      const data = await res.json();
      breaches = data.map(b => ({
        name: b.Name,
        title: b.Title,
        domain: b.Domain,
        date: b.BreachDate,
        addedDate: b.AddedDate,
        exposedData: b.DataClasses || [],
        pwnCount: b.PwnCount,
        description: b.Description ? b.Description.replace(/<[^>]+>/g, '') : '',
        severity: determineSeverity(b.DataClasses || []),
        isVerified: b.IsVerified,
        isFabricated: b.IsFabricated,
        isSensitive: b.IsSensitive,
      }));
    } else {
      throw new Error(`HIBP API error: ${res.status}`);
    }

    const result = {
      breaches,
      totalBreaches: breaches.length,
      checkedAt: new Date().toISOString(),
      source: 'hibp-v3',
    };

    // Gravar cache 24h (só leitura e 1 write por email/dia — não esgota KV)
    if (env.URL_SAFETY_KV) {
      await env.URL_SAFETY_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 86400 });
    }

    return jsonResponse(result, 200, origin);
  } catch (err) {
    console.error('HIBP breach check error:', err);
    return jsonResponse({ error: 'Erro ao verificar. Tente novamente.', details: err.message }, 500, origin);
  }
}

// ──────────────────────────────────────────────────────────────
// POST /api/pwned-password — HIBP k-anonymity, sem KV
// ──────────────────────────────────────────────────────────────
async function handlePwnedPassword(request, env, origin) {
  const ip = getIP(request);

  // Rate limit in-memory: 60 req/min (k-anon não expõe a senha, pode ser generoso)
  if (!checkRateLimit(`pwned:${ip}`, 60, 60_000)) {
    return jsonResponse({ error: 'Muitas requisições. Aguarde 1 minuto.' }, 429, origin);
  }

  let body;
  try { body = await request.json(); } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400, origin);
  }

  const { prefix } = body;
  if (!prefix || !/^[A-F0-9]{5}$/i.test(prefix)) {
    return jsonResponse({ error: 'Prefixo inválido.' }, 400, origin);
  }

  try {
    const res = await fetch(`${HIBP_PWNED_URL}${prefix.toUpperCase()}`, {
      headers: {
        'User-Agent': 'ProtetorDigital/2.0',
        'Add-Padding': 'true',
      },
    });

    if (!res.ok) throw new Error(`HIBP error: ${res.status}`);

    const text = await res.text();

    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=3600',
        ...corsHeaders(origin),
      },
    });
  } catch (err) {
    console.error('HIBP pwned password error:', err);
    return jsonResponse({ error: 'Erro ao verificar senha. Tente novamente.' }, 500, origin);
  }
}

// ──────────────────────────────────────────────────────────────
// GET /api/health
// ──────────────────────────────────────────────────────────────
async function handleHealth(env, origin) {
  let kvStatus = 'not_bound';
  let sbLastUpdate = null;

  if (env.URL_SAFETY_KV) {
    try {
      sbLastUpdate = await env.URL_SAFETY_KV.get('sb_last_update');
      kvStatus = 'ok';
    } catch (e) {
      kvStatus = `error: ${e.message}`;
    }
  }

  return jsonResponse({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.1.0',
    kvStatus,
    safeBrowsingConfigured: !!env.SAFE_BROWSING_API_KEY,
    hibpConfigured: !!env.HIBP_API_KEY,
    scanMethod: 'direct_lookup (no KV writes)',
    endpoints: ['/api/scan', '/api/breach', '/api/pwned-password', '/api/health'],
  }, 200, origin);
}

// ──────────────────────────────────────────────────────────────
// Main fetch handler
// ──────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Suporte a rotas com e sem prefixo /api/ para flexibilidade de deploy
    const route = path.replace(/^\/api/, '');

    if (route === '/health' && request.method === 'GET') {
      return handleHealth(env, origin);
    }
    if (route === '/scan' && request.method === 'POST') {
      return handleScan(request, env, origin);
    }
    if (route === '/breach' && request.method === 'POST') {
      return handleBreachCheck(request, env, origin);
    }
    if (route === '/pwned-password' && request.method === 'POST') {
      return handlePwnedPassword(request, env, origin);
    }

    return jsonResponse({ error: 'Not found' }, 404, origin);
  },

  // Cron removido — /scan não usa mais KV prefix updates
  // Se quiser manter o cron para outros fins futuros, descomente:
  // async scheduled(event, env, ctx) { ... }
};
