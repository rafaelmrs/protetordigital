/**
 * Protetor Digital — pegada.js
 * Ferramenta Pegada Digital: linguagem simples para o usuário leigo
 */

(function () {
  'use strict';

  /* ── Dados client-side (sem API) ──────────────────────────────────── */
  function coletarNavegador() {
    const nav = navigator;
    const con = nav.connection || nav.mozConnection || nav.webkitConnection;

    // Detecção de ad blocker: tenta criar elemento com classe conhecida
    let adBlocker = false;
    try {
      const bait = document.createElement('div');
      bait.className = 'adsbox ad-block pub_300x250';
      bait.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;';
      document.body.appendChild(bait);
      adBlocker = bait.offsetHeight === 0 || bait.offsetWidth === 0 || window.getComputedStyle(bait).display === 'none';
      document.body.removeChild(bait);
    } catch(e) {}

    // Tipo de conexão em português
    const tipoConexao = {
      'slow-2g': '2G lento', '2g': '2G', '3g': '3G',
      '4g': 'Wi-Fi ou 4G', 'wifi': 'Wi-Fi'
    };

    return {
      idioma:       nav.language || null,
      resolucao:    `${screen.width} × ${screen.height} pixels`,
      profCor:      screen.colorDepth ? `${screen.colorDepth} bits` : null,
      nucleos:      nav.hardwareConcurrency || null,
      memoria:      nav.deviceMemory ? `${nav.deviceMemory} GB` : null,
      conexao:      con ? (tipoConexao[con.effectiveType] || con.effectiveType) : null,
      cookies:      nav.cookieEnabled,
      adBlocker:    adBlocker,
      dnt:          nav.doNotTrack === '1',
      online:       nav.onLine,
    };
  }

  /* ── Ícones ────────────────────────────────────────────────────────── */
  function iconShield() { return `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`; }
  function iconWarn()   { return `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`; }
  function iconInfo()   { return `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`; }
  function iconCheck()  { return `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`; }
  function iconX()      { return `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`; }

  /* ── Helpers ───────────────────────────────────────────────────────── */
  function alerta(tipo, icone, titulo, texto) {
    return `<div class="alerta alerta-${tipo}" style="margin-bottom:1rem;">
      <div class="alerta-icone">${icone}</div>
      <div class="alerta-conteudo">
        <div class="alerta-titulo">${titulo}</div>
        <div class="alerta-texto">${texto}</div>
      </div>
    </div>`;
  }

  function bloco(titulo, conteudo) {
    return `<div style="background:var(--branco);border:1px solid var(--cinza-borda);border-radius:var(--radius-lg);padding:1.25rem 1.5rem;margin-bottom:1rem;">
      <div style="font-family:var(--font-display);font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--cinza-medio);margin-bottom:0.85rem;padding-bottom:0.6rem;border-bottom:1px solid var(--cinza-borda);">${titulo}</div>
      ${conteudo}
    </div>`;
  }

  function linha(label, valor, dica) {
    if (!valor) return '';
    return `<div class="dica-item" style="flex-direction:column;align-items:flex-start;gap:0.15rem;padding:0.65rem 0;">
      <span style="font-family:var(--font-display);font-size:0.72rem;color:var(--cinza-medio);text-transform:uppercase;letter-spacing:0.05em;">${label}</span>
      <span style="font-family:var(--font-display);font-size:0.95rem;font-weight:600;color:var(--preto-titulo);">${valor}</span>
      ${dica ? `<span style="font-family:var(--font-body);font-size:0.78rem;color:var(--cinza-medio);line-height:1.4;">${dica}</span>` : ''}
    </div>`;
  }

  function badge(ok, labelOk, labelNao) {
    const cor = ok ? 'var(--verde-seguro)' : 'var(--cinza-medio)';
    const bg  = ok ? 'var(--verde-fundo)'  : 'var(--cinza-papel)';
    return `<span style="display:inline-flex;align-items:center;gap:0.35rem;font-family:var(--font-display);font-size:0.78rem;font-weight:600;color:${cor};background:${bg};padding:0.3rem 0.7rem;border-radius:6px;">${ok ? iconCheck() : iconX()}${ok ? labelOk : labelNao}</span>`;
  }

  /* ── Render ────────────────────────────────────────────────────────── */
  function renderPegada(api, nav, container) {
    const vpnAtiva = api.vpn;

    // Banner principal
    const banner = vpnAtiva
      ? alerta('seguro', iconShield(),
          'Sua VPN está funcionando',
          'Seu endereço real está escondido. Os dados de localização abaixo pertencem ao servidor da VPN, não ao seu endereço real.')
      : alerta('atencao', iconWarn(),
          'Seu endereço real está visível',
          'Qualquer site que você acessar consegue ver exatamente onde você está e qual é a sua operadora de internet.');

    // Localização
    const localizacao = [api.cidade, api.regiao, api.pais].filter(Boolean).join(', ');
    const linkMaps = (api.latitude && api.longitude)
      ? `<a href="https://www.google.com/maps?q=${api.latitude},${api.longitude}" target="_blank" rel="noopener noreferrer" style="color:var(--azul-claro);font-size:0.78rem;">Ver no mapa →</a>`
      : '';

    // Dispositivo
    const dispTrad = { desktop:'Computador', mobile:'Celular', tablet:'Tablet', tv:'Smart TV' };
    const dispLabel = dispTrad[api.dispositivo?.toLowerCase()] || api.dispositivo;
    const soStr     = [api.so, api.so_versao].filter(Boolean).join(' ') || null;
    const navStr    = [api.navegador, api.navegador_versao].filter(Boolean).join(' ') || null;

    // Hora local
    const horaStr = api.hora_atual
      ? api.hora_atual.replace('T',' ').split('.')[0].substring(0,16)
      : null;

    // Idioma legível
    const idiomaLabel = api.fuso_horario
      ? `${nav.idioma || ''} — ${api.fuso_horario}`.trim().replace(/^—\s/, '')
      : nav.idioma || null;

    container.innerHTML = `
      ${banner}

      ${bloco('Onde você está', `
        ${linha('Seu endereço na internet (IP)',
          `<span style="font-size:1.05rem;letter-spacing:0.03em;">${api.ip}</span>`,
          'É como o endereço da sua casa, mas na internet. Qualquer site que você visita recebe essa informação automaticamente.'
        )}
        ${localizacao ? linha('Sua localização aproximada',
          localizacao + (linkMaps ? '&nbsp; ' + linkMaps : ''),
          'Sites conseguem saber em qual cidade você está, mesmo sem você informar.'
        ) : ''}
        ${linha('Sua operadora de internet', api.isp,
          'A empresa que fornece sua internet — como Claro, Vivo, TIM ou NET.'
        )}
        ${linha('Seu fuso horário', api.fuso_horario,
          'Revela em qual país ou região você está, mesmo com VPN ativa.'
        )}
        ${horaStr ? linha('Hora local detectada', horaStr, null) : ''}
      `)}

      ${bloco('Seu dispositivo', `
        ${dispLabel ? linha('Tipo de aparelho', dispLabel, null) : ''}
        ${soStr ? linha('Sistema operacional',
          soStr,
          'Mostra se você usa Windows, Android, iOS, macOS etc. A VPN não esconde isso.'
        ) : ''}
        ${navStr ? linha('Navegador',
          navStr,
          'Chrome, Safari, Firefox — qualquer site consegue identificar qual você usa.'
        ) : ''}
        ${nav.resolucao ? linha('Tamanho da tela', nav.resolucao,
          'Junto com outros dados, ajuda a criar um "retrato" único do seu dispositivo.'
        ) : ''}
        ${nav.nucleos ? linha('Processador', `${nav.nucleos} núcleos`,
          'Quanto mais núcleos, mais rápido é seu dispositivo para rodar programas ao mesmo tempo.'
        ) : ''}
        ${nav.memoria ? linha('Memória RAM', nav.memoria,
          'Quantidade de memória disponível no seu dispositivo.'
        ) : ''}
        ${nav.conexao ? linha('Tipo de conexão', nav.conexao, null) : ''}
      `)}

      ${bloco('Sua privacidade agora', `
        <div style="display:flex;flex-wrap:wrap;gap:0.5rem;padding-top:0.25rem;">
          ${badge(vpnAtiva,       'IP protegido pela VPN',    'IP exposto — sem VPN')}
          ${badge(nav.adBlocker,  'Bloqueador de anúncios ativo', 'Sem bloqueador de anúncios')}
          ${badge(nav.dnt,        '"Não me rastreie" ativado', '"Não me rastreie" desativado')}
          ${badge(!nav.cookies,   'Cookies bloqueados',       'Cookies habilitados')}
        </div>
        <p style="font-family:var(--font-body);font-size:0.78rem;color:var(--cinza-medio);margin-top:0.85rem;line-height:1.5;">
          Estas informações foram coletadas diretamente do seu navegador, sem nenhuma API externa.
        </p>
      `)}
    `;
  }

  /* ── Inicialização ─────────────────────────────────────────────────── */
  async function carregarPegada() {
    const loading   = document.getElementById('pegada-loading');
    const container = document.getElementById('pegada-resultado');
    if (!container) return;

    // Coleta dados do navegador imediatamente (sem esperar API)
    const dadosNav = coletarNavegador();

    try {
      const res  = await fetch('/api/pegada');
      const data = await res.json();

      if (loading) loading.style.display = 'none';

      if (data.error) {
        container.innerHTML = alerta('perigo', iconInfo(), 'Erro ao carregar dados', data.error);
        return;
      }

      renderPegada(data, dadosNav, container);

    } catch (e) {
      if (loading) loading.style.display = 'none';
      container.innerHTML = alerta('perigo', iconInfo(), 'Serviço temporariamente indisponível', 'Tente novamente em alguns instantes.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', carregarPegada);
  } else {
    carregarPegada();
  }

})();
