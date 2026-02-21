// functions/api/scan.js
// Cloudflare Pages Function — POST /api/scan
// Verifica URLs via Google Safe Browsing API (chamada direta, sem KV)

const SAFE_BROWSING_LOOKUP = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

function cors(origin) {
  const allowed = ['https://protetordigital.com', 'https://www.protetordigital.com'];
  const safeOrigin = allowed.includes(origin) ? origin : 'https://protetordigital.com';
  return {
    'Access-Control-Allow-Origin': safeOrigin,
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

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: cors(request.headers.get('Origin') || '') });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin') || '';

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400, origin); }

  const { url } = body;
  if (!url || typeof url !== 'string') return json({ error: 'URL obrigatória' }, 400, origin);

  let parsed;
  try {
    parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
  } catch { return json({ error: 'URL inválida. Use http:// ou https://' }, 400, origin); }

  if (!env.SAFE_BROWSING_API_KEY) return json({ error: 'Serviço indisponível' }, 503, origin);

  const t0 = Date.now();
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
          threatEntries: [{ url: parsed.href }],
        },
      }),
    });
  } catch { return json({ error: 'Erro ao consultar Safe Browsing.' }, 502, origin); }

  if (!sbRes.ok) return json({ error: 'Erro na API de verificação' }, 502, origin);

  const data = await sbRes.json();
  const threats = (data.matches || []).map(m => m.threatType);

  return json({
    safe: threats.length === 0,
    threats,
    latency: `${Date.now() - t0}ms`,
    checkedAt: new Date().toISOString(),
  }, 200, origin);
}
