// functions/api/breach.js
// Cloudflare Pages Function — POST /api/breach
// Verifica emails vazados via Have I Been Pwned v3
// Traduções: JSON estático /breaches-pt.json (principal) + DeepL API (fallback)

const HIBP_URL = 'https://haveibeenpwned.com/api/v3/breachedaccount/';
const DEEPL_URL = 'https://api-free.deepl.com/v2/translate';

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

// Busca tradução no JSON estático (carregado via fetch interno do CF Pages)
async function getTranslationFromJson(name, env) {
  try {
    // Em Pages Functions, podemos usar fetch para o próprio domínio
    const url = `https://protetordigital.com/breaches-pt.json`;
    const res = await fetch(url, { cf: { cacheEverything: true, cacheTtl: 86400 } });
    if (!res.ok) return null;
    const pt = await res.json();
    const key = name?.toLowerCase();
    if (!key) return null;
    if (pt[key]) return pt[key];
    for (const [k, v] of Object.entries(pt)) {
      if (k.startsWith('_')) continue;
      if (key.includes(k) || k.includes(key)) return v;
    }
  } catch {}
  return null;
}

// Fallback: traduz via DeepL API Free
async function translateWithDeepl(text, apiKey) {
  if (!text || !apiKey) return null;
  try {
    const res = await fetch(DEEPL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        auth_key: apiKey,
        text: text.slice(0, 500),
        source_lang: 'EN',
        target_lang: 'PT-BR',
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.translations?.[0]?.text || null;
  } catch { return null; }
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

  // Traduzir descrições: JSON estático primeiro, DeepL como fallback
  breaches = await Promise.all(breaches.map(async (b) => {
    const fromJson = await getTranslationFromJson(b.name, env);
    if (fromJson) return { ...b, description: fromJson };

    // Fallback DeepL — só acionado se não está no JSON
    if (b.description && env.DEEPL_API_KEY) {
      const translated = await translateWithDeepl(b.description, env.DEEPL_API_KEY);
      if (translated) return { ...b, description: translated };
    }

    return b; // Mantém em inglês se nenhuma tradução disponível
  }));

  return json({
    breaches,
    totalBreaches: breaches.length,
    checkedAt: new Date().toISOString(),
    source: 'hibp-v3',
  }, 200, origin);
}
