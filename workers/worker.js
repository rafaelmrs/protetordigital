/**
 * SegurançaOnline — Cloudflare Worker
 *
 * Endpoints:
 *   POST /scan             — URL maliciosa (Safe Browsing via KV)
 *   POST /breach           — Vazamentos de email (HIBP breached-account API + cache KV 24h)
 *   POST /pwned-password   — Senha vazada (HIBP Pwned Passwords k-anonymity, sem limites)
 *   GET  /health           — Health check
 *
 * Variáveis de ambiente (Workers → Settings → Variables):
 *   SAFE_BROWSING_API_KEY  — Google Safe Browsing API v4
 *   HIBP_API_KEY           — Have I Been Pwned API Key
 *   ALLOWED_ORIGIN         — Seu domínio (ex: https://protetordigital.pages.dev)
 *
 * KV Namespace:
 *   URL_SAFETY_KV — vincular no dashboard
 */

const SAFE_BROWSING_UPDATE_URL = 'https://safebrowsing.googleapis.com/v4/threatListUpdates:fetch';
const SAFE_BROWSING_LOOKUP_URL = 'https://safebrowsing.googleapis.com/v4/fullHashes:find';
const HIBP_BREACH_URL = 'https://haveibeenpwned.com/api/v3/breachedaccount/';
const HIBP_PWNED_URL  = 'https://api.pwnedpasswords.com/range/';

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

function toHex(buffer) {
  return Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBase64(hex) {
  const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}${u.pathname}${u.search}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

async function getHashPrefix(url) {
  const normalized = normalizeUrl(url);
  const hash = await sha256(normalized);
  const hex = toHex(hash);
  return hex.slice(0, 8);
}

async function checkRateLimit(kv, key, limit = 10, windowSeconds = 60) {
  const now = Math.floor(Date.now() / 1000);
  const windowKey = `ratelimit:${key}:${Math.floor(now / windowSeconds)}`;
  const current = parseInt(await kv.get(windowKey) || '0');
  if (current >= limit) return false;
  await kv.put(windowKey, String(current + 1), { expirationTtl: windowSeconds * 2 });
  return true;
}

async function updateSafeBrowsingPrefixes(env) {
  if (!env.URL_SAFETY_KV) {
    console.error('URL_SAFETY_KV não vinculado');
    return;
  }
  const apiKey = env.SAFE_BROWSING_API_KEY;
  if (!apiKey) {
    console.error('SAFE_BROWSING_API_KEY não configurada');
    return;
  }

  const body = {
    client: { clientId: 'segurancaonline', clientVersion: '1.0.0' },
    listUpdateRequests: [
      {
        threatType: 'MALWARE',
        platformType: 'ANY_PLATFORM',
        threatEntryType: 'URL',
        state: await env.URL_SAFETY_KV.get('sb_state_MALWARE') || '',
        constraints: { maxUpdateEntries: 2048, maxDatabaseEntries: 4096, region: 'BR', supportedCompressions: ['RAW'] },
      },
      {
        threatType: 'SOCIAL_ENGINEERING',
        platformType: 'ANY_PLATFORM',
        threatEntryType: 'URL',
        state: await env.URL_SAFETY_KV.get('sb_state_SOCIAL_ENGINEERING') || '',
        constraints: { maxUpdateEntries: 2048, maxDatabaseEntries: 4096, region: 'BR', supportedCompressions: ['RAW'] },
      },
    ],
  };

  try {
    const res = await fetch(`${SAFE_BROWSING_UPDATE_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) { console.error('Safe Browsing update failed:', res.status); return; }

    const data = await res.json();

    for (const update of data.listUpdateResponses || []) {
      const threatType = update.threatType;
      if (update.newClientState) {
        await env.URL_SAFETY_KV.put(`sb_state_${threatType}`, update.newClientState, { expirationTtl: 3600 });
      }
      if (update.additions) {
        for (const addition of update.additions) {
          if (addition.rawHashes) {
            const prefixSize = addition.rawHashes.prefixSize || 4;
            const rawHashes = atob(addition.rawHashes.rawHashes);
            const numHashes = rawHashes.length / prefixSize;
            for (let i = 0; i < numHashes; i++) {
              const prefix = Array.from(rawHashes.slice(i * prefixSize, (i + 1) * prefixSize))
                .map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
              await env.URL_SAFETY_KV.put(`sb_prefix:${prefix}`, threatType, { expirationTtl: 7200 });
            }
          }
        }
      }
    }

    await env.URL_SAFETY_KV.put('sb_last_update', new Date().toISOString(), { expirationTtl: 7200 });
    console.log('Safe Browsing atualizado com sucesso');
  } catch (err) {
    console.error('Safe Browsing update error:', err);
  }
}

async function handleURLScan(request, env) {
  if (!env.URL_SAFETY_KV) return jsonResponse({ error: 'KV não configurado' }, 500);
  const start = Date.now();
  const { url } = await request.json();
  if (!url || typeof url !== 'string') return jsonResponse({ error: 'URL inválida' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const allowed = await checkRateLimit(env.URL_SAFETY_KV, `scan:${ip}`, 30, 60);
  if (!allowed) return jsonResponse({ error: 'Muitas requisições. Aguarde 1 minuto.' }, 429);

  const cacheKey = `scan_cache:${url}`;
  const cached = await env.URL_SAFETY_KV.get(cacheKey, 'json');
  if (cached) return jsonResponse({ ...cached, cached: true, latency: `${Date.now() - start}ms` });

  const hashPrefix = await getHashPrefix(url);
  const threatType = await env.URL_SAFETY_KV.get(`sb_prefix:${hashPrefix}`);

  let result;
  if (!threatType) {
    result = { safe: true, threats: [], method: 'kv_miss' };
  } else {
    const apiKey = env.SAFE_BROWSING_API_KEY;
    if (!apiKey) {
      result = { safe: false, threats: [threatType], method: 'prefix_match_no_verify' };
    } else {
      const normalizedUrl = normalizeUrl(url);
      const fullHash = await sha256(normalizedUrl);
      const prefixBase64 = hexToBase64(hashPrefix);
      try {
        const res = await fetch(`${SAFE_BROWSING_LOOKUP_URL}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client: { clientId: 'segurancaonline', clientVersion: '1.0.0' },
            threatInfo: {
              threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
              platformTypes: ['ANY_PLATFORM'],
              threatEntryTypes: ['URL'],
              threatEntries: [{ hash: prefixBase64 }],
            },
          }),
        });
        const data = await res.json();
        const threats = (data.matches || []).map(m => m.threatType);
        result = { safe: threats.length === 0, threats, method: 'full_hash_verify' };
      } catch {
        result = { safe: false, threats: [threatType], method: 'prefix_match_fallback' };
      }
    }
  }

  await env.URL_SAFETY_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 21600 });
  return jsonResponse({ ...result, latency: `${Date.now() - start}ms` });
}

async function handleBreachCheck(request, env) {
  if (!env.URL_SAFETY_KV) return jsonResponse({ error: 'KV não configurado' }, 500);
  const { email } = await request.json();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ error: 'Email inválido' }, 400);
  if (!env.HIBP_API_KEY) return jsonResponse({ error: 'HIBP_API_KEY não configurada no Worker.' }, 500);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const allowed = await checkRateLimit(env.URL_SAFETY_KV, `breach:${ip}`, 10, 3600);
  if (!allowed) return jsonResponse({ error: 'Limite de consultas atingido. Tente novamente em 1 hora.' }, 429);

  const cacheKey = `hibp:${email.toLowerCase()}`;
  const cached = await env.URL_SAFETY_KV.get(cacheKey, 'json');
  if (cached) return jsonResponse({ ...cached, cached: true });

  try {
    const res = await fetch(
      `${HIBP_BREACH_URL}${encodeURIComponent(email)}?truncateResponse=false`,
      { headers: { 'hibp-api-key': env.HIBP_API_KEY, 'User-Agent': 'ProtetorDigital/1.0' } }
    );

    let breaches = [];
    if (res.status === 404) {
      breaches = [];
    } else if (res.status === 401) {
      return jsonResponse({ error: 'HIBP_API_KEY inválida.' }, 500);
    } else if (res.status === 429) {
      return jsonResponse({ error: 'Muitas consultas simultâneas. Tente em alguns segundos.' }, 429);
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

    const result = { breaches, totalBreaches: breaches.length, checkedAt: new Date().toISOString(), source: 'hibp-v3' };
    await env.URL_SAFETY_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 86400 });
    return jsonResponse(result);
  } catch (err) {
    console.error('HIBP breach check error:', err);
    return jsonResponse({ error: 'Erro ao verificar. Tente novamente.', details: err.message }, 500);
  }
}

function determineSeverity(dataClasses) {
  const arr = Array.isArray(dataClasses)
    ? dataClasses.map(d => d.toLowerCase())
    : [String(dataClasses).toLowerCase()];
  const high = ['passwords', 'credit cards', 'bank account numbers', 'social security numbers', 'cpf'];
  const medium = ['email addresses', 'phone numbers', 'physical addresses', 'usernames'];
  if (high.some(h => arr.some(d => d.includes(h)))) return 'high';
  if (medium.some(m => arr.some(d => d.includes(m)))) return 'medium';
  return 'low';
}

async function handlePwnedPassword(request, env) {
  if (!env.URL_SAFETY_KV) return jsonResponse({ error: 'KV não configurado' }, 500);
  const { prefix } = await request.json();
  if (!prefix || !/^[A-F0-9]{5}$/.test(prefix)) return jsonResponse({ error: 'Prefixo inválido.' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const allowed = await checkRateLimit(env.URL_SAFETY_KV, `pwned:${ip}`, 60, 60);
  if (!allowed) return jsonResponse({ error: 'Muitas requisições. Aguarde 1 minuto.' }, 429);

  try {
    const res = await fetch(`${HIBP_PWNED_URL}${prefix}`, {
      headers: { 'User-Agent': 'SegurancaOnline/1.0', 'Add-Padding': 'true' },
    });
    if (!res.ok) throw new Error(`HIBP error: ${res.status}`);
    const text = await res.text();
    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'max-age=3600',
        ...corsHeaders(request.headers.get('Origin') || '*'),
      },
    });
  } catch (err) {
    console.error('HIBP pwned password error:', err);
    return jsonResponse({ error: 'Erro ao verificar senha. Tente novamente.' }, 500);
  }
}

export default {
  async fetch(request, env, ctx) {
    console.log('ENV KEYS:', JSON.stringify(Object.keys(env)));

    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (url.pathname === '/health') {
      let lastUpdate = null;
      let kvStatus = 'ok';
      try {
        if (env.URL_SAFETY_KV) {
          lastUpdate = await env.URL_SAFETY_KV.get('sb_last_update');
        } else {
          kvStatus = 'not_bound';
        }
      } catch (e) {
        kvStatus = 'error: ' + e.message;
      }
      return jsonResponse({
        status: 'ok',
        timestamp: new Date().toISOString(),
        kvStatus,
        safeBrowsingLastUpdate: lastUpdate,
        hibpConfigured: !!env.HIBP_API_KEY,
        safeBrowsingConfigured: !!env.SAFE_BROWSING_API_KEY,
        endpoints: ['/scan', '/breach', '/pwned-password', '/health'],
      }, 200, origin);
    }

    if (url.pathname === '/scan' && request.method === 'POST') return handleURLScan(request, env);
    if (url.pathname === '/breach' && request.method === 'POST') return handleBreachCheck(request, env);
    if (url.pathname === '/pwned-password' && request.method === 'POST') return handlePwnedPassword(request, env);

    return jsonResponse({ error: 'Not found' }, 404, origin);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(updateSafeBrowsingPrefixes(env));
  },
};
