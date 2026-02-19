/**
 * SegurançaOnline — Cloudflare Worker
 *
 * Endpoints:
 *   POST /scan             — URL maliciosa (Safe Browsing via KV)
 *   POST /breach           — Vazamentos de email (HIBP breached-account API + cache KV 24h)
 *   POST /pwned-password   — Senha vazada (HIBP Pwned Passwords k-anonymity, sem limites)
 *   GET  /health           — Health check
 *
 * Cron (30min): Atualiza prefixes do Google Safe Browsing no KV
 *
 * Variáveis de ambiente (Workers → Settings → Variables):
 *   SAFE_BROWSING_API_KEY  — Google Safe Browsing API v4
 *   HIBP_API_KEY           — Have I Been Pwned API Key (haveibeenpwned.com/API/Key)
 *   ALLOWED_ORIGIN         — Seu domínio (ex: https://protetordigital.com)
 *
 * KV Namespace:
 *   URL_SAFETY_KV — vincular no dashboard (Workers → seu worker → Settings → Bindings)
 *
 * Modelo de privacidade:
 *   Emails  → HIBP breached-account (chave de API, sem limite por IP, cache KV 24h)
 *   Senhas  → HIBP Pwned Passwords k-anonymity (só 5 chars do hash SHA-1 saem do browser)
 */

const SAFE_BROWSING_UPDATE_URL = 'https://safebrowsing.googleapis.com/v4/threatListUpdates:fetch';
const SAFE_BROWSING_LOOKUP_URL = 'https://safebrowsing.googleapis.com/v4/fullHashes:find';
const HIBP_BREACH_URL = 'https://haveibeenpwned.com/api/v3/breachedaccount/';
const HIBP_PWNED_URL  = 'https://api.pwnedpasswords.com/range/';

// CORS helper
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

// SHA-256 hash of string → Uint8Array
async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

// Convert Uint8Array to hex string
function toHex(buffer) {
  return Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Convert hex string to base64
function hexToBase64(hex) {
  const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}

// Normalize URL for safe browsing lookup
function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}${u.pathname}${u.search}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

// Compute hash prefix (4 bytes = 8 hex chars) for URL
async function getHashPrefix(url) {
  const normalized = normalizeUrl(url);
  const hash = await sha256(normalized);
  const hex = toHex(hash);
  return hex.slice(0, 8); // 4-byte prefix
}

// Rate limiter using KV
async function checkRateLimit(kv, key, limit = 10, windowSeconds = 60) {
  const now = Math.floor(Date.now() / 1000);
  const windowKey = `ratelimit:${key}:${Math.floor(now / windowSeconds)}`;
  
  const current = parseInt(await kv.get(windowKey) || '0');
  if (current >= limit) return false;
  
  await kv.put(windowKey, String(current + 1), { expirationTtl: windowSeconds * 2 });
  return true;
}

// ============================================================
// CRON: Update Safe Browsing prefixes (runs every 30 min)
// ============================================================
async function updateSafeBrowsingPrefixes(env) {
  const apiKey = env.SAFE_BROWSING_API_KEY;
  if (!apiKey) {
    console.error('SAFE_BROWSING_API_KEY not set');
    return;
  }

  const body = {
    client: {
      clientId: 'segurancaonline',
      clientVersion: '1.0.0',
    },
    listUpdateRequests: [
      {
        threatType: 'MALWARE',
        platformType: 'ANY_PLATFORM',
        threatEntryType: 'URL',
        state: await env.URL_SAFETY_KV.get('sb_state_MALWARE') || '',
        constraints: {
          maxUpdateEntries: 2048,
          maxDatabaseEntries: 4096,
          region: 'BR',
          supportedCompressions: ['RAW'],
        },
      },
      {
        threatType: 'SOCIAL_ENGINEERING',
        platformType: 'ANY_PLATFORM',
        threatEntryType: 'URL',
        state: await env.URL_SAFETY_KV.get('sb_state_SOCIAL_ENGINEERING') || '',
        constraints: {
          maxUpdateEntries: 2048,
          maxDatabaseEntries: 4096,
          region: 'BR',
          supportedCompressions: ['RAW'],
        },
      },
    ],
  };

  try {
    const res = await fetch(`${SAFE_BROWSING_UPDATE_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error('Safe Browsing update failed:', res.status);
      return;
    }

    const data = await res.json();
    
    for (const update of data.listUpdateResponses || []) {
      const threatType = update.threatType;
      
      // Save new state token
      if (update.newClientState) {
        await env.URL_SAFETY_KV.put(`sb_state_${threatType}`, update.newClientState, {
          expirationTtl: 3600, // 1 hour
        });
      }

      // Save hash prefixes
      if (update.additions) {
        for (const addition of update.additions) {
          if (addition.rawHashes) {
            const prefixSize = addition.rawHashes.prefixSize || 4;
            const rawHashes = atob(addition.rawHashes.rawHashes);
            const numHashes = rawHashes.length / prefixSize;

            for (let i = 0; i < numHashes; i++) {
              const prefix = Array.from(rawHashes.slice(i * prefixSize, (i + 1) * prefixSize))
                .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('');

              await env.URL_SAFETY_KV.put(
                `sb_prefix:${prefix}`,
                threatType,
                { expirationTtl: 7200 } // 2 hours TTL
              );
            }
          }
        }
      }

      // Remove hash prefixes
      if (update.removals) {
        for (const removal of update.removals) {
          if (removal.rawIndices) {
            // Handle removals (simplified — in production track indices)
            console.log(`Would remove ${removal.rawIndices.indices.length} entries for ${threatType}`);
          }
        }
      }
    }

    await env.URL_SAFETY_KV.put('sb_last_update', new Date().toISOString(), { expirationTtl: 7200 });
    console.log('Safe Browsing prefixes updated successfully');
  } catch (err) {
    console.error('Safe Browsing update error:', err);
  }
}

// ============================================================
// URL SCAN endpoint
// ============================================================
async function handleURLScan(request, env) {
  const start = Date.now();
  const { url } = await request.json();
  
  if (!url || typeof url !== 'string') {
    return jsonResponse({ error: 'URL inválida' }, 400);
  }

  // Rate limiting by IP
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const allowed = await checkRateLimit(env.URL_SAFETY_KV, `scan:${ip}`, 30, 60);
  if (!allowed) {
    return jsonResponse({ error: 'Muitas requisições. Aguarde 1 minuto.' }, 429);
  }

  // Check cache first
  const cacheKey = `scan_cache:${url}`;
  const cached = await env.URL_SAFETY_KV.get(cacheKey, 'json');
  if (cached) {
    return jsonResponse({ ...cached, cached: true, latency: `${Date.now() - start}ms` });
  }

  // Compute hash prefix
  const hashPrefix = await getHashPrefix(url);
  
  // KV lookup — instantaneous (<5ms)
  const threatType = await env.URL_SAFETY_KV.get(`sb_prefix:${hashPrefix}`);
  
  let result;
  
  if (!threatType) {
    // No match in local KV — URL likely safe
    result = { safe: true, threats: [], method: 'kv_miss' };
  } else {
    // Prefix match found — do full hash verification (happens <1% of time)
    const apiKey = env.SAFE_BROWSING_API_KEY;
    
    if (!apiKey) {
      // Fallback if no API key — report as suspicious
      result = { safe: false, threats: [threatType], method: 'prefix_match_no_verify' };
    } else {
      // Full hash lookup
      const normalizedUrl = normalizeUrl(url);
      const fullHash = await sha256(normalizedUrl);
      const fullHashBase64 = hexToBase64(toHex(fullHash));
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

  // Cache result for 6 hours
  await env.URL_SAFETY_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 21600 });

  return jsonResponse({ ...result, latency: `${Date.now() - start}ms` });
}

// ============================================================
// BREACH CHECK endpoint — HIBP breached-account API
// Sem limite por IP — limite é pela chave de API (10 RPM no Pwned 1)
// Cache KV 24h por email para preservar cota de RPM
// ============================================================
async function handleBreachCheck(request, env) {
  const { email } = await request.json();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Email inválido' }, 400);
  }

  if (!env.HIBP_API_KEY) {
    return jsonResponse({ error: 'HIBP_API_KEY não configurada no Worker.' }, 500);
  }

  // Rate limiting por IP do visitante — proteção contra abuso
  // (não protege a cota da API, mas evita spam do mesmo usuário)
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const allowed = await checkRateLimit(env.URL_SAFETY_KV, `breach:${ip}`, 10, 3600);
  if (!allowed) {
    return jsonResponse({ error: 'Limite de consultas atingido. Tente novamente em 1 hora.' }, 429);
  }

  // Cache KV 24h — preserva RPM da chave HIBP
  const cacheKey = `hibp:${email.toLowerCase()}`;
  const cached = await env.URL_SAFETY_KV.get(cacheKey, 'json');
  if (cached) {
    return jsonResponse({ ...cached, cached: true });
  }

  try {
    // HIBP v3 breachedaccount — retorna array de breaches ou 404 se limpo
    const res = await fetch(
      `${HIBP_BREACH_URL}${encodeURIComponent(email)}?truncateResponse=false`,
      {
        headers: {
          'hibp-api-key': env.HIBP_API_KEY,
          'User-Agent': 'ProtetorDigital/1.0',
        },
      }
    );

    let breaches = [];

    if (res.status === 404) {
      // Email limpo — nenhum breach encontrado
      breaches = [];
    } else if (res.status === 401) {
      return jsonResponse({ error: 'HIBP_API_KEY inválida. Verifique nas configurações do Worker.' }, 500);
    } else if (res.status === 429) {
      // Rate limit da chave HIBP atingido — responde sem cache para tentar novamente
      return jsonResponse({ error: 'Muitas consultas simultâneas. Tente em alguns segundos.' }, 429);
    } else if (res.ok) {
      const data = await res.json();

      // HIBP v3 retorna array de objetos com detalhes completos do breach
      breaches = data.map(b => ({
        name: b.Name,
        title: b.Title,
        domain: b.Domain,
        date: b.BreachDate,
        addedDate: b.AddedDate,
        exposedData: b.DataClasses || [],
        pwnCount: b.PwnCount,
        description: b.Description
          ? b.Description.replace(/<[^>]+>/g, '') // remove HTML tags
          : '',
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

    // Cache 24h por email
    await env.URL_SAFETY_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 86400 });

    return jsonResponse(result);
  } catch (err) {
    console.error('HIBP breach check error:', err);
    return jsonResponse({ error: 'Erro ao verificar. Tente novamente.', details: err.message }, 500);
  }
}

function determineSeverity(dataClasses) {
  // dataClasses é array de strings no HIBP v3: ["Passwords", "Email addresses", ...]
  const arr = Array.isArray(dataClasses)
    ? dataClasses.map(d => d.toLowerCase())
    : [String(dataClasses).toLowerCase()];

  const high = ['passwords', 'credit cards', 'bank account numbers', 'social security numbers', 'cpf'];
  const medium = ['email addresses', 'phone numbers', 'physical addresses', 'usernames'];

  if (high.some(h => arr.some(d => d.includes(h)))) return 'high';
  if (medium.some(m => arr.some(d => d.includes(m)))) return 'medium';
  return 'low';
}

// ============================================================
// HIBP PWNED PASSWORD endpoint
// Modelo k-anonymity — a senha NUNCA sai do browser.
// O browser calcula SHA-1 localmente e envia só os 5 primeiros
// chars do hash. O Worker repassa ao HIBP e devolve os sufixos.
// A verificação final acontece no browser do usuário.
// Sem limites de requisição, sem autenticação, sem cache necessário.
// ============================================================
async function handlePwnedPassword(request, env) {
  const { prefix } = await request.json();

  // Valida: deve ser exatamente 5 chars hex uppercase
  if (!prefix || !/^[A-F0-9]{5}$/.test(prefix)) {
    return jsonResponse({ error: 'Prefixo inválido. Deve ser 5 caracteres hex maiúsculos.' }, 400);
  }

  // Rate limiting leve — proteção contra abuso (HIBP já tem rate limit próprio)
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const allowed = await checkRateLimit(env.URL_SAFETY_KV, `pwned:${ip}`, 60, 60);
  if (!allowed) {
    return jsonResponse({ error: 'Muitas requisições. Aguarde 1 minuto.' }, 429);
  }

  try {
    const res = await fetch(`${HIBP_PWNED_URL}${prefix}`, {
      headers: {
        'User-Agent': 'SegurancaOnline/1.0',
        // Add-Padding: true faz o HIBP retornar entradas extras para
        // dificultar análise de tráfego (privacidade adicional)
        'Add-Padding': 'true',
      },
    });

    if (!res.ok) {
      throw new Error(`HIBP error: ${res.status}`);
    }

    // HIBP retorna texto puro: "SUFIXO:CONTAGEM" por linha
    // Ex: "1E4C9B93F3F0682250B6CF8331B7EE68FD8:3"
    const text = await res.text();

    // Repassa os sufixos diretamente ao browser — ele faz a verificação local
    // Nunca sabemos qual era a senha original
    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'max-age=3600', // cache 1h no browser (HIBP atualiza raramente)
        ...corsHeaders(request.headers.get('Origin') || '*'),
      },
    });
  } catch (err) {
    console.error('HIBP pwned password error:', err);
    return jsonResponse({ error: 'Erro ao verificar senha. Tente novamente.' }, 500);
  }
}

// ============================================================
// Main Worker handler
// ============================================================
export default {
  // HTTP fetch handler
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    // Health check
    if (url.pathname === '/health') {
      const lastUpdate = await env.URL_SAFETY_KV.get('sb_last_update');
      return jsonResponse({
        status: 'ok',
        timestamp: new Date().toISOString(),
        safeBrowsingLastUpdate: lastUpdate,
        endpoints: ['/scan', '/breach', '/pwned-password', '/health'],
      }, 200, origin);
    }

    // URL Scanner
    if (url.pathname === '/scan' && request.method === 'POST') {
      return handleURLScan(request, env);
    }

    // Breach Checker (XposedOrNot — email)
    if (url.pathname === '/breach' && request.method === 'POST') {
      return handleBreachCheck(request, env);
    }

    // Pwned Password (HIBP k-anonymity — senha)
    if (url.pathname === '/pwned-password' && request.method === 'POST') {
      return handlePwnedPassword(request, env);
    }

    return jsonResponse({ error: 'Not found' }, 404, origin);
  },

  // Cron handler (every 30 minutes)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(updateSafeBrowsingPrefixes(env));
  },
};
