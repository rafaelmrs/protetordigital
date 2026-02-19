// functions/api/pwned-password.js
// Cloudflare Pages Function — POST /api/pwned-password
// k-anonymity: recebe prefixo SHA1 de 5 chars, retorna hashes do HIBP
// A senha NUNCA sai do navegador do usuário

const HIBP_PWNED_URL = 'https://api.pwnedpasswords.com/range/';

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

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: cors(request.headers.get('Origin') || '') });
}

export async function onRequestPost({ request }) {
  const origin = request.headers.get('Origin') || '';

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400, origin); }

  const { prefix } = body;
  if (!prefix || !/^[A-F0-9]{5}$/i.test(prefix)) {
    return json({ error: 'Prefixo inválido.' }, 400, origin);
  }

  let res;
  try {
    res = await fetch(`${HIBP_PWNED_URL}${prefix.toUpperCase()}`, {
      headers: { 'User-Agent': 'ProtetorDigital/2.0', 'Add-Padding': 'true' },
    });
  } catch { return json({ error: 'Erro ao consultar HIBP.' }, 502, origin); }

  if (!res.ok) return json({ error: `HIBP error: ${res.status}` }, 502, origin);

  const text = await res.text();

  return new Response(text, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=3600',
      ...cors(origin),
    },
  });
}
