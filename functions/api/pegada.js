// functions/api/pegada.js
// Cloudflare Pages Function — GET /api/pegada
// Retorna dados de geolocalização, segurança e user agent via api.ipwho.org

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

  const ip = request.headers.get('CF-Connecting-IP') || '';

  try {
    const url = `https://api.ipwho.org/ip/${ip}?apiKey=${env.IPWHO_API_KEY}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': request.headers.get('User-Agent') || '',
        'Accept': 'application/json',
      },
    });

    if (!res.ok) return json({ error: 'Erro ao consultar serviço' }, 502, origin);

    const raw = await res.json();

    if (!raw.success) return json({ error: 'IP não reconhecido' }, 422, origin);

    const d   = raw.data;
    const geo = d.geoLocation || {};
    const tz  = d.timezone    || {};
    const con = d.connection  || {};
    const ua  = d.userAgent   || {};
    const sec = d.security    || {};

    return json({
      ip:           d.ip,
      pais:         geo.country      || null,
      pais_codigo:  geo.countryCode  || null,
      regiao:       geo.region       || null,
      cidade:       geo.city         || null,
      cep:          geo.postal_Code  || null,
      latitude:     geo.latitude     || null,
      longitude:    geo.longitude    || null,
      continente:   geo.continent    || null,
      eu:           geo.is_in_eu     || false,
      isp:          con.isp          || null,
      org:          con.org          || null,
      asn:          con.asn_number   || null,
      vpn:          sec.isVpn        || false,
      tor:          sec.isTor        || false,
      threat:       sec.isThreat     || 'low',
      fuso_horario: tz.time_zone     || null,
      fuso_offset:  tz.offset        || null,
      hora_atual:   tz.current_time  || null,
      navegador:         ua.browser?.name    || null,
      navegador_versao:  ua.browser?.version || null,
      so:                ua.os?.name         || null,
      so_versao:         ua.os?.version      || null,
      dispositivo:       ua.device?.type     || null,
      dispositivo_marca: ua.device?.vendor   || null,
      motor:             ua.engine?.name     || null,
      cpu:               ua.cpu?.architecture || null,
    }, 200, origin);

  } catch (e) {
    return json({ error: 'Erro interno' }, 500, origin);
  }
}
