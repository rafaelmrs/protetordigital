// functions/api/pegada.js
// Cloudflare Pages Function — GET /api/pegada
// Retorna dados de geolocalização, segurança e user agent via ipwho.is

function cors(origin) {
  const allowed = ['https://protetordigital.com', 'https://www.protetordigital.com'];
  const safeOrigin = allowed.includes(origin) ? origin : 'https://protetordigital.com';
  return {
    'Access-Control-Allow-Origin': safeOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

export async function onRequestGet({ request, env }) {
  const origin = request.headers.get('Origin') || '';

  if (!env.IPWHO_API_KEY) return json({ error: 'Serviço indisponível' }, 503, origin);

  // Pega o IP real do visitante via cabeçalho Cloudflare
  const ip = request.headers.get('CF-Connecting-IP') || '';

  try {
    const url = ip
      ? `https://api.ipwho.is/${ip}?api_key=${env.IPWHO_API_KEY}`
      : `https://api.ipwho.is/?api_key=${env.IPWHO_API_KEY}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': request.headers.get('User-Agent') || '',
        'Accept': 'application/json',
      },
    });

    if (!res.ok) return json({ error: 'Erro ao consultar serviço' }, 502, origin);

    const data = await res.json();

    if (!data.success) return json({ error: 'IP não reconhecido' }, 422, origin);

    // Retorna apenas os campos necessários para a ferramenta
    return json({
      ip: data.ip,
      // Localização
      pais: data.country || null,
      pais_codigo: data.country_code || null,
      regiao: data.region || null,
      cidade: data.city || null,
      cep: data.postal || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      continente: data.continent || null,
      // Rede
      isp: data.connection?.isp || null,
      org: data.connection?.org || null,
      asn: data.connection?.asn || null,
      // Segurança
      vpn: data.security?.vpn || false,
      tor: data.security?.tor || false,
      proxy: data.security?.proxy || false,
      hosting: data.security?.hosting || false,
      // Fuso e moeda
      fuso_horario: data.timezone?.id || null,
      fuso_offset: data.timezone?.offset || null,
      hora_atual: data.timezone?.current_time || null,
      // User Agent
      navegador: data.user_agent?.browser?.name || null,
      navegador_versao: data.user_agent?.browser?.version || null,
      so: data.user_agent?.os?.name || null,
      so_versao: data.user_agent?.os?.version || null,
      dispositivo: data.user_agent?.device?.type || null,
      dispositivo_marca: data.user_agent?.device?.brand || null,
      motor: data.user_agent?.engine?.name || null,
      is_bot: data.user_agent?.bot || false,
      // EU
      eu: data.is_eu || false,
    }, 200, origin);

  } catch (e) {
    return json({ error: 'Erro interno' }, 500, origin);
  }
}
