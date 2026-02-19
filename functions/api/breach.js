// functions/api/breach.js
// Cloudflare Pages Function — POST /api/breach
// Verifica emails vazados via Have I Been Pwned v3

const HIBP_URL = 'https://haveibeenpwned.com/api/v3/breachedaccount/';

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || 'https://protetordigital.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(origin) },
  });
}

function determineSeverity(dataClasses) {
  const arr = (Array.isArray(dataClasses) ? dataClasses : [dataClasses]).map(d => d.toLowerCase());
  if (['passwords','credit cards','bank account','social security','cpf'].some(h => arr.some(d => d.includes(h)))) return 'high';
  if (['email addresses','phone numbers','physical addresses','usernames','dates of birth'].some(m => arr.some(d => d.includes(m)))) return 'medium';
  return 'low';
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: cors(request.headers.get('Origin') || '') });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin') || '';

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400, origin); }

  const { email } = body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Email inválido' }, 400, origin);
  }

  if (!env.HIBP_API_KEY) {
    return json({ error: 'HIBP_API_KEY não configurada.' }, 500, origin);
  }

  const emailLower = email.toLowerCase();

  // Cache KV 24h (opcional — só se URL_SAFETY_KV estiver vinculado)
  const cacheKey = `hibp:${emailLower}`;
  if (env.URL_SAFETY_KV) {
    try {
      const cached = await env.URL_SAFETY_KV.get(cacheKey, 'json');
      if (cached) return json({ ...cached, cached: true }, 200, origin);
    } catch {}
  }

  let res;
  try {
    res = await fetch(
      `${HIBP_URL}${encodeURIComponent(emailLower)}?truncateResponse=false`,
      { headers: { 'hibp-api-key': env.HIBP_API_KEY, 'User-Agent': 'ProtetorDigital/2.0' } }
    );
  } catch { return json({ error: 'Erro ao consultar HIBP.' }, 502, origin); }

  if (res.status === 401) return json({ error: 'HIBP_API_KEY inválida.' }, 500, origin);
  if (res.status === 429) return json({ error: 'Muitas consultas. Tente em alguns segundos.' }, 429, origin);

  let breaches = [];
  if (res.status === 404) {
    breaches = [];
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
    return json({ error: `Erro HIBP: ${res.status}` }, 502, origin);
  }

  const result = {
    breaches,
    totalBreaches: breaches.length,
    checkedAt: new Date().toISOString(),
    source: 'hibp-v3',
  };

  // Gravar cache KV 24h se disponível
  if (env.URL_SAFETY_KV) {
    try { await env.URL_SAFETY_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 86400 }); } catch {}
  }

  return json(result, 200, origin);
}
