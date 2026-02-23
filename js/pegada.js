/**
 * Protetor Digital — pegada.js
 * Apenas dados da API — sem coleta client-side
 */
(function () {
  'use strict';

  /* ── Ícones ──────────────────────────────────────────────────────── */
  const SVG_SHIELD = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  const SVG_WARN   = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  const SVG_INFO   = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

  /* ── Helpers de HTML ─────────────────────────────────────────────── */
  function alerta(tipo, icone, titulo, texto) {
    return `<div class="alerta alerta-${tipo}" style="margin-bottom:1.25rem;">
      <div class="alerta-icone">${icone}</div>
      <div class="alerta-conteudo">
        <div class="alerta-titulo">${titulo}</div>
        <div class="alerta-texto">${texto}</div>
      </div>
    </div>`;
  }

  function card(titulo, itens) {
    // itens = array de strings HTML — filtra os vazios
    const corpo = itens.filter(Boolean).join('');
    if (!corpo) return '';
    return `<div style="background:var(--branco);border:1px solid var(--cinza-borda);border-radius:var(--radius-lg);margin-bottom:1rem;overflow:hidden;">
      <div style="font-family:var(--font-display);font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--cinza-medio);padding:0.75rem 1.25rem;border-bottom:1px solid var(--cinza-borda);background:var(--cinza-papel);">${titulo}</div>
      ${corpo}
    </div>`;
  }

  function linha(label, valor) {
    if (valor === null || valor === undefined || valor === '') return '';
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:1.5rem;padding:0.6rem 1.25rem;border-bottom:1px solid var(--cinza-borda);">
      <span style="font-family:var(--font-display);font-size:0.82rem;color:var(--cinza-medio);white-space:nowrap;flex-shrink:0;">${label}</span>
      <span style="font-family:var(--font-display);font-size:0.88rem;font-weight:600;color:var(--preto-titulo);text-align:right;word-break:break-all;">${valor}</span>
    </div>`;
  }

  /* ── Formatações ─────────────────────────────────────────────────── */
  function formatarHora(iso) {
    if (!iso) return null;
    try {
      // "2026-02-22T17:37:05-03:00" → "22/02/2026 às 17:37"
      const [data, resto] = iso.split('T');
      const [ano, mes, dia] = data.split('-');
      const hora = (resto || '').substring(0, 5);
      return `${dia}/${mes}/${ano} às ${hora}`;
    } catch(e) { return iso; }
  }

  function formatarCoordenadas(lat, lng) {
    if (lat == null || lng == null) return null;
    const la = parseFloat(lat).toFixed(4);
    const lo = parseFloat(lng).toFixed(4);
    return `<a href="https://www.google.com/maps?q=${la},${lo}" target="_blank" rel="noopener noreferrer" style="color:var(--azul-claro);text-decoration:none;">${la}, ${lo} ↗</a>`;
  }

  const DISPOSITIVO_PT = { desktop:'Computador', mobile:'Celular', tablet:'Tablet', tv:'Smart TV', wearable:'Wearable' };

  function traduzirDispositivo(tipo, marca, modelo) {
    const t = DISPOSITIVO_PT[(tipo || '').toLowerCase()] || tipo;
    const m = (marca && marca !== 'Unknown') ? marca : null;
    const mo = (modelo && modelo !== 'Unknown' && modelo !== marca) ? modelo : null;
    return [t, m, mo].filter(Boolean).join(' — ') || null;
  }

  const CPU_PT = {
    'amd64':'x86-64 (AMD/Intel)', 'x64':'x86-64 (AMD/Intel)',
    'x86':'32 bits (x86)', 'arm':'ARM', 'arm64':'ARM 64 bits',
    'ia32':'Intel 32 bits', 'unknown':null,
  };
  function traduzirCPU(arch) {
    if (!arch) return null;
    const k = arch.toLowerCase();
    return CPU_PT[k] !== undefined ? CPU_PT[k] : arch;
  }

  /* ── Render principal ────────────────────────────────────────────── */
  function renderPegada(d, container) {

    // ── Banner VPN ──────────────────────────────────────────────────
    const banner = d.vpn
      ? alerta('seguro', SVG_SHIELD,
          'VPN detectada',
          'Seu endereço real está mascarado. Os dados abaixo pertencem ao servidor da VPN, não à sua localização real.')
      : alerta('atencao', SVG_WARN,
          'Seu endereço real está visível',
          'Qualquer site que você acessar consegue ver seu endereço, localização e operadora de internet.');

    // ── Card 1: Localização ─────────────────────────────────────────
    const regiao = [d.cidade, d.regiao].filter(Boolean).join(', ') || null;

    const card1 = card('Localização', [
      linha('IPv4', d.ipv4),
      d.ipv6 ? linha('IPv6', `<span style="font-size:0.78rem;">${d.ipv6}</span>`) : '',
      linha('País', d.pais),
      linha('Região', regiao),
      linha('Coordenadas', formatarCoordenadas(d.latitude, d.longitude)),
      linha('ISP / Operadora', d.isp),
      linha('Fuso horário', d.fuso_horario),
      linha('Hora local', formatarHora(d.hora_atual)),
    ]);

    // ── Card 2: Dispositivo ─────────────────────────────────────────
    const so  = [d.so, d.so_versao].filter(Boolean).join(' ') || null;
    const nav = [d.navegador, d.navegador_versao].filter(Boolean).join(' ') || null;

    const card2 = card('Seu dispositivo', [
      linha('Tipo de aparelho', traduzirDispositivo(d.dispositivo, d.dispositivo_marca, d.dispositivo_modelo)),
      linha('Sistema operacional', so),
      linha('Navegador', nav),
      linha('CPU', traduzirCPU(d.cpu)),
    ]);

    container.innerHTML = banner + card1 + card2;
  }

  /* ── Inicialização ───────────────────────────────────────────────── */
  async function carregar() {
    const loading   = document.getElementById('pegada-loading');
    const container = document.getElementById('pegada-resultado');
    if (!container) return;

    try {
      const res  = await fetch('/api/pegada');
      const data = await res.json();
      if (loading) loading.style.display = 'none';
      if (data.error) {
        container.innerHTML = alerta('perigo', SVG_INFO, 'Erro ao carregar dados', data.error);
        return;
      }
      renderPegada(data, container);
    } catch (e) {
      if (loading) loading.style.display = 'none';
      container.innerHTML = alerta('perigo', SVG_INFO, 'Serviço temporariamente indisponível', 'Tente novamente em alguns instantes.');
    }
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', carregar)
    : carregar();

})();
