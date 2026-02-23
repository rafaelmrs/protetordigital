// functions/api/pegada.js
// Cloudflare Pages Function — GET /api/pegada

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

  // Pega o IP real do visitante via Cloudflare
  const ip = request.headers.get('CF-Connecting-IP') || '';

  try {
    // IMPORTANTE: passamos o IP explicitamente para garantir que a API
    // analisa o IP do visitante, não o do nosso servidor Worker
    const url = `https://api.ipwho.org/ip/${encodeURIComponent(ip)}?apiKey=${env.IPWHO_API_KEY}`;

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      // NÃO repassar o User-Agent do visitante — evita confusão entre
      // o IP (do visitante) e o UA (que seria do worker)
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

    // Detecção de VPN — todos os sinais disponíveis na API
    const connType = (con.connection_type || '').toLowerCase();
    const isVpn = sec.isVpn === true
      || sec.isTor === true
      || connType === 'vpn'
      || connType === 'hosting';   // IPs de datacenter/hosting frequentemente são VPN

    // IPv4 vs IPv6
    const ipStr  = d.ip || ip;
    const isIPv6 = ipStr.includes(':');

    return json({
      ip:     ipStr,
      ipv4:   isIPv6 ? null : ipStr,
      ipv6:   isIPv6 ? ipStr : null,
      // Localização
      pais:        geo.country   || null,
      regiao:      geo.region    || null,
      cidade:      geo.city      || null,
      latitude:    geo.latitude  ?? null,
      longitude:   geo.longitude ?? null,
      eu:          geo.is_in_eu  || false,
      // Rede
      isp:             con.isp             || null,
      asn:             con.asn_number      || null,
      connection_type: con.connection_type || null,
      // Segurança
      vpn:    isVpn,
      isVpn:  sec.isVpn  === true,
      isTor:  sec.isTor  === true,
      threat: sec.isThreat || 'low',
      // Fuso
      fuso_horario: tz.time_zone    || null,
      hora_atual:   tz.current_time || null,
      // Dispositivo
      dispositivo:       ua.device?.type    || null,
      dispositivo_marca: ua.device?.vendor  || null,
      dispositivo_modelo:ua.device?.model   || null,
      so:               ua.os?.name         || null,
      so_versao:        ua.os?.version      || null,
      navegador:        ua.browser?.name    || null,
      navegador_versao: ua.browser?.version || null,
      cpu:              ua.cpu?.architecture || null,
    }, 200, origin);

  } catch (e) {
    return json({ error: 'Erro interno' }, 500, origin);
  }
}
