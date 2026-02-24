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

  const ip        = request.headers.get('CF-Connecting-IP') || '';
  const userAgent = request.headers.get('User-Agent') || '';

  try {
    const url = `https://api.ipwho.org/ip/${encodeURIComponent(ip)}?apiKey=${env.IPWHO_API_KEY}`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': userAgent },
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

    const connType = (con.connection_type || '').toLowerCase();
    const ispLower = (con.isp || '').toLowerCase();
    const asnOrg   = (con.asn_org || '').toLowerCase();

    const vpnIsps = [
      'proton', 'nordvpn', 'expressvpn', 'mullvad', 'surfshark',
      'privateinternetaccess', 'pia', 'cyberghost', 'ipvanish',
      'datacamp', 'm247', 'hetzner', 'ovh', 'digitalocean',
      'linode', 'vultr', 'choopa', 'quadranet',
    ];
    const isKnownVpnIsp = vpnIsps.some(v => ispLower.includes(v) || asnOrg.includes(v));

    const isVpn = sec.isVpn === true
      || sec.isTor === true
      || connType === 'vpn'
      || connType === 'hosting'
      || (connType === 'corporate' && isKnownVpnIsp);

    const ipStr  = d.ip || ip;
    const isIPv6 = ipStr.includes(':');

    return json({
      ip:    ipStr,
      ipv4:  isIPv6 ? null : ipStr,
      ipv6:  isIPv6 ? ipStr : null,
      pais:        geo.country   || null,
      regiao:      geo.region    || null,
      cidade:      geo.city      || null,
      latitude:    geo.latitude  ?? null,
      longitude:   geo.longitude ?? null,
      eu:          geo.is_in_eu  || false,
      isp:             con.isp        || null,
      asn:             con.asn_number || null,
      connection_type: con.connection_type || null,
      vpn:   isVpn,
      isVpn: sec.isVpn === true,
      isTor: sec.isTor === true,
      threat: sec.isThreat || 'low',
      fuso_horario: tz.time_zone    || null,
      hora_atual:   tz.current_time || null,
      dispositivo:        ua.device?.type   || null,
      dispositivo_marca:  ua.device?.vendor || null,
      dispositivo_modelo: ua.device?.model  || null,
      so:               ua.os?.name          || null,
      so_versao:        ua.os?.version       || null,
      navegador:        ua.browser?.name     || null,
      navegador_versao: ua.browser?.version  || null,
      cpu:              ua.cpu?.architecture || null,
    }, 200, origin);

  } catch (e) {
    return json({ error: 'Erro interno' }, 500, origin);
  }
}
