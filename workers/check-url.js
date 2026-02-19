/**
 * Cloudflare Worker — Verificador de Links via Google Safe Browsing v4
 * 
 * Endpoint: POST /api/check-url
 * Body: { url: "https://..." }
 * 
 * Variável de ambiente obrigatória:
 *   SAFE_BROWSING_API_KEY  — chave da Google Safe Browsing API
 *   (Obtenha em: https://developers.google.com/safe-browsing/v4/get-started)
 * 
 * Sem KV. Sem cron. Consulta real a cada request (com rate limiting simples por IP).
 * 
 * Deploy:
 *   1. Crie o worker em https://dash.cloudflare.com
 *   2. Cole este código
 *   3. Adicione a variável SAFE_BROWSING_API_KEY
 *   4. Configure a rota: protetordigital.com/api/check-url -> este worker
 */

const SAFE_BROWSING_URL = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

// Tipos de ameaças que verificamos
const THREAT_TYPES = [
  'MALWARE',
  'SOCIAL_ENGINEERING',
  'UNWANTED_SOFTWARE',
  'POTENTIALLY_HARMFUL_APPLICATION',
];

// Rate limit simples: máx 20 req/min por IP (usando in-memory, reseta por instância)
const rateLimitMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const window = 60_000; // 1 minuto
  const max = 20;

  const record = rateLimitMap.get(ip) || { count: 0, start: now };

  if (now - record.start > window) {
    // Janela expirada, reseta
    rateLimitMap.set(ip, { count: 1, start: now });
    return true;
  }

  if (record.count >= max) return false;

  record.count++;
  rateLimitMap.set(ip, record);
  return true;
}

function corsHeaders(origin) {
  const allowed = ['https://protetordigital.com', 'http://localhost:4321'];
  const o = allowed.includes(origin) ? origin : 'https://protetordigital.com';
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Método não permitido' }, 405, origin);
    }

    // Rate limiting por IP
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(ip)) {
      return jsonResponse({ error: 'Muitas requisições. Aguarde um momento.' }, 429, origin);
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'JSON inválido' }, 400, origin);
    }

    const { url } = body;
    if (!url || typeof url !== 'string') {
      return jsonResponse({ error: 'Campo "url" é obrigatório' }, 400, origin);
    }

    // Validação básica de URL
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Protocolo inválido');
      }
    } catch {
      return jsonResponse({ error: 'URL inválida. Use http:// ou https://' }, 400, origin);
    }

    // Verificar API key
    if (!env.SAFE_BROWSING_API_KEY) {
      console.error('SAFE_BROWSING_API_KEY não configurada');
      return jsonResponse({ error: 'Serviço temporariamente indisponível' }, 503, origin);
    }

    // Chamar Safe Browsing API
    const sbPayload = {
      client: {
        clientId: 'protetordigital',
        clientVersion: '2.0.0',
      },
      threatInfo: {
        threatTypes: THREAT_TYPES,
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: [{ url: parsedUrl.href }],
      },
    };

    let sbResponse;
    try {
      sbResponse = await fetch(
        `${SAFE_BROWSING_URL}?key=${env.SAFE_BROWSING_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sbPayload),
        }
      );
    } catch (err) {
      console.error('Erro ao chamar Safe Browsing:', err);
      return jsonResponse({ error: 'Erro ao consultar Safe Browsing. Tente novamente.' }, 502, origin);
    }

    if (!sbResponse.ok) {
      const errText = await sbResponse.text();
      console.error('Safe Browsing API error:', sbResponse.status, errText);
      return jsonResponse({ error: 'Erro na API de verificação' }, 502, origin);
    }

    const sbData = await sbResponse.json();

    // Resposta: se "matches" existe e tem itens, há ameaças
    const threats = sbData.matches || [];

    return jsonResponse({
      safe: threats.length === 0,
      threats: threats.map(m => ({
        threatType: m.threatType,
        platformType: m.platformType,
        url: m.threat?.url,
      })),
      checkedAt: new Date().toISOString(),
    }, 200, origin);
  },
};
