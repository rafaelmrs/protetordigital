/**
 * Protetor Digital — pegada.js
 * Ferramenta Pegada Digital: mostra o que os sites sabem sobre o visitante
 */

(function () {
  'use strict';

  async function carregarPegada() {
    const loading   = document.getElementById('pegada-loading');
    const container = document.getElementById('pegada-resultado');
    if (!container) return;

    try {
      const res  = await fetch('/api/pegada');
      const data = await res.json();

      if (loading) loading.style.display = 'none';

      if (data.error) {
        container.innerHTML = alerta('perigo', iconInfo(), 'Erro ao carregar dados', data.error);
        return;
      }

      renderPegada(data, container);

    } catch (e) {
      if (loading) loading.style.display = 'none';
      container.innerHTML = alerta('perigo', iconInfo(), 'Serviço temporariamente indisponível', 'Tente novamente em alguns instantes.');
    }
  }

  /* ── Helpers HTML ─────────────────────────────────────────────────── */

  function alerta(tipo, icone, titulo, texto) {
    return `<div class="alerta alerta-${tipo}" style="margin-bottom:1rem;">
      <div class="alerta-icone">${icone}</div>
      <div class="alerta-conteudo">
        <div class="alerta-titulo">${titulo}</div>
        <div class="alerta-texto">${texto}</div>
      </div>
    </div>`;
  }

  function iconShield() { return `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`; }
  function iconWarn()   { return `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`; }
  function iconInfo()   { return `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`; }
  function iconCheck()  { return `<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`; }
  function iconX()      { return `<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`; }

  function secaoTitulo(txt) {
    return `<div style="font-family:var(--font-display);font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--cinza-medio);margin:1.25rem 0 0.6rem;padding-bottom:0.5rem;border-bottom:1px solid var(--cinza-borda);">${txt}</div>`;
  }

  function linhaItem(label, valor) {
    if (!valor) return '';
    return `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;padding:0.55rem 0;border-bottom:1px solid var(--cinza-borda);">
      <span style="font-family:var(--font-display);font-size:0.82rem;color:var(--cinza-medio);white-space:nowrap;">${label}</span>
      <span style="font-family:var(--font-display);font-size:0.88rem;font-weight:600;color:var(--cinza-escuro);text-align:right;word-break:break-all;">${valor}</span>
    </div>`;
  }

  function badgeStatus(ok, labelOk, labelNao) {
    const cor  = ok ? 'var(--verde-seguro)' : 'var(--cinza-medio)';
    const bg   = ok ? 'var(--verde-fundo)'  : 'var(--cinza-papel)';
    const icone = ok ? iconCheck() : iconX();
    const txt  = ok ? labelOk : labelNao;
    return `<span style="display:inline-flex;align-items:center;gap:0.35rem;font-family:var(--font-display);font-size:0.78rem;font-weight:600;color:${cor};background:${bg};padding:0.3rem 0.65rem;border-radius:6px;">${icone}${txt}</span>`;
  }

  /* ── Render principal ─────────────────────────────────────────────── */

  function renderPegada(d, container) {
    const vpnAtiva = d.vpn || d.tor;

    // Banner VPN
    const banner = vpnAtiva
      ? alerta('seguro', iconShield(),
          d.tor ? 'Rede Tor detectada' : 'VPN ativa e funcionando',
          `Seu IP real está ${d.tor ? 'roteado pela rede Tor' : 'mascarado pela VPN'}. Os dados de localização abaixo pertencem ao servidor ${d.tor ? 'Tor' : 'VPN'}, não à sua localização real.`)
      : alerta('atencao', iconWarn(),
          'Você não está usando VPN',
          'Seu IP real e localização estão visíveis para qualquer site que você acessa. Veja abaixo o que está exposto.');

    // Localização
    const localizacao = [d.cidade, d.regiao, d.pais].filter(Boolean).join(', ');
    const coordenadas = (d.latitude && d.longitude)
      ? `<a href="https://www.google.com/maps?q=${d.latitude},${d.longitude}" target="_blank" rel="noopener noreferrer" style="color:var(--azul-claro)">${d.latitude.toFixed(4)}, ${d.longitude.toFixed(4)}</a>`
      : null;

    // Dispositivo
    const dispTrad = { desktop: 'Computador', mobile: 'Celular', tablet: 'Tablet', tv: 'Smart TV', bot: 'Bot/Rastreador' };
    const dispLabel = dispTrad[d.dispositivo?.toLowerCase()] || d.dispositivo;
    const dispMarca = d.dispositivo_marca && d.dispositivo_marca !== 'Unknown' ? d.dispositivo_marca : null;
    const soStr     = [d.so, d.so_versao].filter(Boolean).join(' ') || null;
    const navStr    = [d.navegador, d.navegador_versao].filter(Boolean).join(' ') || null;

    // Hora
    const horaFormatada = d.hora_atual
      ? d.hora_atual.replace('T', ' ').split('.')[0].substring(0, 16)
      : null;

    container.innerHTML = `
      ${banner}

      <div class="ferramenta-barra-superior" style="padding:1.25rem 1.5rem;">

        ${secaoTitulo('Endereço IP e localização')}
        ${linhaItem('Endereço IP', `<strong style="font-size:1rem;color:var(--preto-titulo);">${d.ip}</strong>`)}
        ${linhaItem('País', d.pais || null)}
        ${linhaItem('Cidade / Região', localizacao || null)}
        ${linhaItem('Coordenadas', coordenadas)}
        ${linhaItem('Continente', d.continente)}

        ${secaoTitulo('Rede e operadora')}
        ${linhaItem('Provedor (ISP)', d.isp)}
        ${linhaItem('Organização', d.org && d.org !== d.isp ? d.org : null)}
        ${linhaItem('ASN', d.asn ? `AS${d.asn}` : null)}

        ${secaoTitulo('Fuso horário')}
        ${linhaItem('Fuso horário', d.fuso_horario)}
        ${linhaItem('Hora atual', horaFormatada)}
        ${d.eu ? linhaItem('União Europeia', 'Sim — sujeito ao GDPR') : ''}

        ${secaoTitulo('Proteção de IP')}
        <div style="display:flex;flex-wrap:wrap;gap:0.5rem;padding:0.75rem 0;border-bottom:1px solid var(--cinza-borda);">
          ${badgeStatus(d.vpn, 'VPN ativa', 'Sem VPN')}
          ${badgeStatus(d.tor, 'Tor ativo', 'Sem Tor')}
          ${badgeStatus(d.threat === 'low', 'Ameaça baixa', 'Ameaça ' + (d.threat || 'baixa'))}
        </div>

        ${secaoTitulo('Seu dispositivo')}
        <div class="alerta alerta-atencao" style="margin-bottom:0.75rem;padding:0.55rem 0.85rem;font-size:0.78rem;">
          <div class="alerta-icone" style="width:16px;height:16px;">${iconInfo()}</div>
          <div class="alerta-texto">VPN <strong>não oculta</strong> as informações abaixo — elas vêm do seu navegador.</div>
        </div>
        ${linhaItem('Tipo de dispositivo', dispLabel)}
        ${dispMarca ? linhaItem('Marca', dispMarca) : ''}
        ${linhaItem('Sistema operacional', soStr)}
        ${linhaItem('Navegador', navStr)}
        ${linhaItem('Motor de renderização', d.motor)}
        ${d.cpu ? linhaItem('Arquitetura CPU', d.cpu) : ''}

      </div>`;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', carregarPegada);
  } else {
    carregarPegada();
  }

})();
