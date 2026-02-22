/**
 * Protetor Digital — pegada.js
 * Ferramenta Pegada Digital: mostra o que os sites sabem sobre o visitante
 */

(function () {
  'use strict';

  async function carregarPegada() {
    const container = document.getElementById('pegada-resultado');
    const loading   = document.getElementById('pegada-loading');
    if (!container) return;

    try {
      const res  = await fetch('/api/pegada');
      const data = await res.json();

      if (loading) loading.style.display = 'none';

      if (data.error) {
        container.innerHTML = `<div class="alerta alerta-perigo">
          <svg class="alerta-icone" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div class="alerta-conteudo"><div class="alerta-titulo">Erro ao carregar dados</div><div class="alerta-texto">${data.error}</div></div>
        </div>`;
        return;
      }

      renderPegada(data, container);

    } catch (e) {
      if (loading) loading.style.display = 'none';
      container.innerHTML = `<div class="alerta alerta-perigo">
        <svg class="alerta-icone" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div class="alerta-conteudo"><div class="alerta-titulo">Serviço temporariamente indisponível</div><div class="alerta-texto">Tente novamente em alguns instantes.</div></div>
      </div>`;
    }
  }

  function renderPegada(d, container) {
    const vpnAtiva  = d.vpn || d.tor || d.proxy;
    const torAtivo  = d.tor;

    // ── Banner VPN ──────────────────────────────────────────────────────────
    const bannerVpn = vpnAtiva
      ? `<div class="alerta alerta-seguro" style="margin-bottom:1.5rem;">
          <svg class="alerta-icone" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <div class="alerta-conteudo">
            <div class="alerta-titulo">${torAtivo ? 'Rede Tor detectada' : 'VPN ativa e funcionando'}</div>
            <div class="alerta-texto">Seu IP real está ${torAtivo ? 'roteado pela rede Tor' : 'mascarado pela VPN'}. Os dados de localização abaixo pertencem ao servidor ${torAtivo ? 'Tor' : 'VPN'}, não à sua localização real.</div>
          </div>
        </div>`
      : `<div class="alerta alerta-atencao" style="margin-bottom:1.5rem;">
          <svg class="alerta-icone" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div class="alerta-conteudo">
            <div class="alerta-titulo">Você não está usando VPN</div>
            <div class="alerta-texto">Seu IP real e localização estão visíveis para qualquer site que você acessa. Veja abaixo o que está exposto.</div>
          </div>
        </div>`;

    // ── Helpers ──────────────────────────────────────────────────────────────
    function linha(icone, label, valor, destaque) {
      if (!valor) return '';
      return `
        <div class="pegada-linha">
          <div class="pegada-linha-icone">${icone}</div>
          <div class="pegada-linha-conteudo">
            <div class="pegada-linha-label">${label}</div>
            <div class="pegada-linha-valor${destaque ? ' pegada-valor-destaque' : ''}">${valor}</div>
          </div>
        </div>`;
    }

    function linhaStatus(label, valor, ok, tooltip) {
      const cls  = ok  ? 'pegada-status-ok'  : 'pegada-status-nao';
      const icon = ok
        ? `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`
        : `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;
      return `
        <div class="pegada-status-item">
          <span class="pegada-status-badge ${cls}">${icon} ${valor}</span>
          <span class="pegada-linha-label" style="margin-top:0.2rem;">${label}</span>
          ${tooltip ? `<span class="pegada-tooltip">${tooltip}</span>` : ''}
        </div>`;
    }

    const svgPin    = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
    const svgGlobe  = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
    const svgClock  = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    const svgWifi   = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`;
    const svgMonitor= `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
    const svgShield = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;

    // Localização
    const localizacao = [d.cidade, d.regiao, d.pais].filter(Boolean).join(', ');
    const coordenadas = (d.latitude && d.longitude)
      ? `${d.latitude.toFixed(4)}, ${d.longitude.toFixed(4)}`
      : null;
    const mapsUrl = coordenadas
      ? `https://www.google.com/maps?q=${d.latitude},${d.longitude}`
      : null;
    const coordHtml = coordenadas
      ? `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--azul-claro)">${coordenadas}</a>`
      : null;

    // Dispositivo
    const soCompleto = [d.so, d.so_versao].filter(Boolean).join(' ');
    const navCompleto = [d.navegador, d.navegador_versao].filter(Boolean).join(' ');
    const dispCompleto = [d.dispositivo_marca, d.dispositivo].filter(Boolean).join(' — ') || d.dispositivo;

    // Traduzir tipo de dispositivo
    const dispTrad = {'desktop':'Computador','mobile':'Celular','tablet':'Tablet','tv':'Smart TV','bot':'Bot/Rastreador'};
    const dispLabel = dispTrad[d.dispositivo?.toLowerCase()] || d.dispositivo;

    container.innerHTML = `
      ${bannerVpn}

      <div class="pegada-secoes">

        <!-- COLUNA ESQUERDA -->
        <div class="pegada-col">

          <!-- BLOCO: IP e Localização -->
          <div class="pegada-bloco">
            <div class="pegada-bloco-titulo">${svgPin} Localização</div>
            ${linha(svgGlobe, 'Endereço IP', `<strong>${d.ip}</strong>`, true)}
            ${linha(svgPin, 'Local', localizacao || null)}
            ${linha(svgPin, 'Coordenadas', coordHtml)}
            ${linha(svgGlobe, 'Continente', d.continente)}
          </div>

          <!-- BLOCO: Rede -->
          <div class="pegada-bloco">
            <div class="pegada-bloco-titulo">${svgWifi} Rede / Operadora</div>
            ${linha(svgWifi, 'Provedor (ISP)', d.isp)}
            ${linha(svgWifi, 'Organização', d.org !== d.isp ? d.org : null)}
            ${linha(svgWifi, 'ASN', d.asn ? `AS${d.asn}` : null)}
          </div>

          <!-- BLOCO: Fuso -->
          <div class="pegada-bloco">
            <div class="pegada-bloco-titulo">${svgClock} Fuso horário</div>
            ${linha(svgClock, 'Fuso horário', d.fuso_horario)}
            ${linha(svgClock, 'Hora atual (servidor)', d.hora_atual ? d.hora_atual.split('.')[0].replace('T',' ') : null)}
            ${d.eu ? linha(svgGlobe, 'União Europeia', 'Sim — sujeito ao GDPR') : ''}
          </div>

        </div>

        <!-- COLUNA DIREITA -->
        <div class="pegada-col">

          <!-- BLOCO: Segurança -->
          <div class="pegada-bloco">
            <div class="pegada-bloco-titulo">${svgShield} Proteção de IP</div>
            <div class="pegada-status-grid">
              ${linhaStatus('VPN', d.vpn ? 'VPN ativa' : 'Sem VPN', d.vpn, 'Oculta seu IP e localização real')}
              ${linhaStatus('Tor', d.tor ? 'Tor ativo' : 'Sem Tor', d.tor, 'Anonimato avançado via rede Tor')}
              ${linhaStatus('Ameaça', d.threat === 'low' ? 'Baixa' : d.threat === 'medium' ? 'Média' : 'Alta', d.threat === 'low', 'Nível de ameaça associado a este IP')}
              ${linhaStatus('Proteção', vpnAtiva ? 'IP protegido' : 'IP exposto', vpnAtiva, 'Seu IP real está visível para os sites que acessa')}
            </div>
          </div>

          <!-- BLOCO: Dispositivo -->
          <div class="pegada-bloco">
            <div class="pegada-bloco-titulo">${svgMonitor} Seu dispositivo</div>
            <div class="pegada-aviso-ua">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              VPN <strong>não oculta</strong> estas informações
            </div>
            ${linha(svgMonitor, 'Dispositivo', dispLabel)}
            ${d.dispositivo_marca ? linha(svgMonitor, 'Marca', d.dispositivo_marca) : ''}
            ${linha(svgMonitor, 'Sistema operacional', soCompleto || null)}
            ${linha(svgMonitor, 'Navegador', navCompleto || null)}
            ${linha(svgMonitor, 'Motor de renderização', d.motor)}
            ${d.is_bot ? `<div class="alerta alerta-perigo" style="margin-top:0.75rem;padding:0.6rem 0.75rem;font-size:0.8rem;">⚠️ Tráfego identificado como bot ou rastreador</div>` : ''}
          </div>

        </div>
      </div>

      <p class="fonte-consulta" style="margin-top:1.5rem;">🔍 Dados obtidos via <a href="https://ipwho.is" target="_blank" rel="noopener noreferrer"><strong>IPWho.is</strong></a> — serviço de geolocalização e análise de segurança de IP.</p>
    `;
  }

  // Inicia quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', carregarPegada);
  } else {
    carregarPegada();
  }

})();
