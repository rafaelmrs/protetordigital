// functions/api/health.js
// Cloudflare Pages Function — GET /api/health

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || 'https://protetordigital.com',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function onRequestGet({ request, env }) {
  const origin = request.headers.get('Origin') || '';
  return new Response(JSON.stringify({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.1.0',
    safeBrowsingConfigured: !!env.SAFE_BROWSING_API_KEY,
    hibpConfigured: !!env.HIBP_API_KEY,
    kvBound: !!env.URL_SAFETY_KV,
    endpoints: ['/api/scan', '/api/breach', '/api/pwned-password', '/api/health'],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...cors(origin) },
  });
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: cors(request.headers.get('Origin') || '') });
}
