/**
 * PROTETOR DIGITAL — scanner.js
 * Verificação de URLs via Google Safe Browsing
 * A chamada vai para /api/scan (Cloudflare Pages Function)
 */

(function () {
  'use strict';

  const API_PATH = '/api/scan';

  const TIPOS_AMEACA = {
    'MALWARE': { label: 'Malware', desc: 'Este site tenta instalar programas maliciosos no seu dispositivo.', icone: '🦠' },
    'SOCIAL_ENGINEERING': { label: 'Phishing / Golpe', desc: 'Este site finge ser outro para roubar seus dados ou senhas.', icone: '🎣' },
    'UNWANTED_SOFTWARE': { label: 'Software Indesejado', desc: 'Este site oferece downloads de programas prejudiciais.', icone: '⚠️' },
    'POTENTIALLY_HARMFUL_APPLICATION': { label: 'App Prejudicial', desc: 'Este site distribui aplicativos que podem causar danos.', icone: '🚫' },
  };

  function normalizarUrl(url) {
    const u = url.trim();
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
      return `https://${u}`;
    }
    return u;
  }

  function isUrlValida(url) {
    try {
      const u = new URL(normalizarUrl(url));
      return u.hostname.includes('.');
    } catch {
      return false;
    }
  }

  // Histórico local da sessão
  const historico = [];

  // ============================================================
  // RENDERIZAÇÃO
  // ============================================================

  function mostrarCarregando(container) {
    container.innerHTML = `
      <div class="card" style="display:flex;align-items:center;gap:1rem">
        <div style="width:40px;height:40px;border:3px solid var(--cinza-borda2);border-top-color:var(--azul-claro);border-radius:50%;animation:girar 0.7s linear infinite;flex-shrink:0"></div>
        <div>
          <p style="font-family:var(--font-display);font-weight:600;color:var(--preto-titulo);margin-bottom:0.25rem">Verificando o link...</p>
          <p style="font-size:0.82rem;color:var(--cinza-medio)">Consultando Google Safe Browsing</p>
        </div>
      </div>
    `;
  }

  function mostrarResultadoSeguro(container, url, latency, checkedAt) {
    container.innerHTML = `
      <div class="card animar-slide" style="border-color:var(--verde-borda);background:var(--verde-fundo)">
        <div style="display:flex;align-items:flex-start;gap:1rem">
          <div style="width:56px;height:56px;border-radius:var(--radius-md);background:rgba(26,122,74,0.15);display:flex;align-items:center;justify-content:center;font-size:2rem;flex-shrink:0">✅</div>
          <div style="flex:1">
            <p style="font-family:var(--font-display);font-size:1.15rem;font-weight:800;color:var(--verde-seguro);margin-bottom:0.375rem">Link seguro</p>
            <p style="font-family:var(--font-mono);font-size:0.8rem;color:var(--cinza-medio);word-break:break-all;margin-bottom:0.5rem">${url}</p>
            <p style="font-size:0.875rem;color:#14532D;line-height:1.5">
              Nenhuma ameaça conhecida foi detectada neste endereço pelo Google Safe Browsing.
            </p>
            <p style="font-family:var(--font-mono);font-size:0.7rem;color:var(--cinza-medio);margin-top:0.625rem">
              Verificado em ${checkedAt} · Latência: ${latency || '<100ms'}
            </p>
          </div>
        </div>
      </div>
      <div class="alerta alerta-info">
        <span class="alerta-icone">💡</span>
        <div>
          <p class="alerta-titulo">Fique atento mesmo assim</p>
          <p>Uma URL "segura" nesta verificação significa que ela não está na lista do Google.
             Sempre confira o domínio manualmente antes de inserir senhas ou dados pessoais.</p>
        </div>
      </div>
    `;
  }

  function mostrarResultadoPerigoso(container, url, threats, latency, checkedAt) {
    const ameacasHtml = threats.map(t => {
      const info = TIPOS_AMEACA[t] || { label: t, desc: 'Ameaça detectada pelo Google Safe Browsing.', icone: '⚠️' };
      return `
        <div class="alerta alerta-perigo" style="margin-bottom:0.5rem">
          <span class="alerta-icone">${info.icone}</span>
          <div>
            <p class="alerta-titulo">${info.label}</p>
            <p>${info.desc}</p>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="card animar-slide" style="border-color:var(--vermelho-borda);background:var(--vermelho-fundo)">
        <div style="display:flex;align-items:flex-start;gap:1rem">
          <div style="width:56px;height:56px;border-radius:var(--radius-md);background:rgba(185,28,28,0.15);display:flex;align-items:center;justify-content:center;font-size:2rem;flex-shrink:0">🚨</div>
          <div style="flex:1">
            <p style="font-family:var(--font-display);font-size:1.15rem;font-weight:800;color:var(--vermelho-perigo);margin-bottom:0.375rem">
              Link perigoso — não acesse!
            </p>
            <p style="font-family:var(--font-mono);font-size:0.8rem;color:var(--cinza-medio);word-break:break-all;margin-bottom:0.75rem">${url}</p>
            ${ameacasHtml}
            <p style="font-family:var(--font-mono);font-size:0.7rem;color:var(--cinza-medio);margin-top:0.625rem">
              Verificado em ${checkedAt} · Latência: ${latency || '<100ms'} · Fonte: Google Safe Browsing
            </p>
          </div>
        </div>
      </div>
      <div class="card">
        <p style="font-family:var(--font-display);font-size:0.875rem;font-weight:700;color:var(--preto-titulo);margin-bottom:0.75rem">O que fazer</p>
        <div style="display:flex;flex-direction:column;gap:0.375rem">
          ${[
            'Não clique, não acesse e não compartilhe este link',
            'Se você já acessou: escaneie seu dispositivo com um antivírus',
            'Se inseriu senha: troque a senha daquele serviço imediatamente',
            'Se recebeu por WhatsApp ou e-mail, avise quem te enviou',
          ].map(a => `
            <p style="font-size:0.85rem;color:var(--cinza-escuro);display:flex;align-items:flex-start;gap:0.5rem;line-height:1.45">
              <span style="color:var(--vermelho-perigo);flex-shrink:0">✗</span>${a}
            </p>
          `).join('')}
        </div>
      </div>
    `;
  }

  function mostrarErro(container, mensagem) {
    container.innerHTML = `
      <div class="alerta alerta-atencao">
        <span class="alerta-icone">⚠️</span>
        <div>
          <p class="alerta-titulo">Não foi possível verificar</p>
          <p>${mensagem}</p>
        </div>
      </div>
    `;
  }

  function atualizarHistorico() {
    const container = document.getElementById('container-historico');
    if (!container || historico.length === 0) return;

    container.innerHTML = `
      <div class="card">
        <p class="campo-label" style="margin-bottom:0.75rem">Histórico desta sessão</p>
        <div style="display:flex;flex-direction:column;gap:0">
          ${historico.map(h => `
            <div style="display:flex;align-items:center;gap:0.75rem;padding:0.625rem 0;border-bottom:1px solid var(--cinza-borda)">
              <span style="font-size:1rem">${h.seguro ? '✅' : '🚨'}</span>
              <span style="font-family:var(--font-mono);font-size:0.75rem;color:var(--cinza-medio);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${h.url}">${h.url}</span>
              <span style="font-family:var(--font-mono);font-size:0.7rem;color:var(--cinza-leve);flex-shrink:0">${h.hora}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    container.classList.remove('hidden');
  }

  // ============================================================
  // LÓGICA PRINCIPAL
  // ============================================================
  async function verificarLink(url) {
    const container = document.getElementById('container-resultado-scanner');
    if (!container) return;

    const urlNormalizada = normalizarUrl(url);
    mostrarCarregando(container);

    try {
      const res = await fetch(API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlNormalizada }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        mostrarErro(container, data.error || `Erro ${res.status} ao consultar o servidor.`);
        return;
      }

      const resultado = await res.json();
      const checkedAt = new Date().toLocaleString('pt-BR');

      // Adicionar ao histórico
      historico.unshift({
        url: urlNormalizada,
        seguro: resultado.safe,
        hora: new Date().toLocaleTimeString('pt-BR'),
      });
      if (historico.length > 5) historico.pop();
      atualizarHistorico();

      if (resultado.safe) {
        mostrarResultadoSeguro(container, urlNormalizada, resultado.latency, checkedAt);
      } else {
        mostrarResultadoPerigoso(container, urlNormalizada, resultado.threats || [], resultado.latency, checkedAt);
      }

    } catch (err) {
      mostrarErro(container, 'Erro de conexão. Verifique sua internet e tente novamente.');
    }
  }

  // ============================================================
  // INICIALIZAÇÃO DA PÁGINA
  // ============================================================
  function inicializarPaginaScanner() {
    const inputUrl = document.getElementById('input-url');
    const btnVerificar = document.getElementById('btn-verificar-link');
    const msgErro = document.getElementById('erro-url');

    if (!inputUrl || !btnVerificar) return;

    function mostrarErroUrl(msg) {
      if (msgErro) {
        msgErro.textContent = msg;
        msgErro.classList.remove('hidden');
      }
    }

    function limparErroUrl() {
      if (msgErro) msgErro.classList.add('hidden');
    }

    async function executarVerificacao() {
      const url = inputUrl.value.trim();

      if (!url) {
        mostrarErroUrl('Cole ou digite o link que quer verificar.');
        return;
      }

      if (!isUrlValida(url)) {
        mostrarErroUrl('Link inválido. Use o formato: site.com ou https://site.com');
        return;
      }

      limparErroUrl();
      btnVerificar.disabled = true;
      btnVerificar.innerHTML = `<span class="btn-spinner"></span> Verificando...`;

      await verificarLink(url);

      btnVerificar.disabled = false;
      btnVerificar.innerHTML = `🔍 Verificar link`;

      document.getElementById('container-resultado-scanner')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    btnVerificar.addEventListener('click', executarVerificacao);
    inputUrl.addEventListener('keydown', e => {
      if (e.key === 'Enter') executarVerificacao();
    });
    inputUrl.addEventListener('input', limparErroUrl);
  }

  document.addEventListener('layoutPronto', inicializarPaginaScanner);
  if (document.readyState !== 'loading') inicializarPaginaScanner();
  else document.addEventListener('DOMContentLoaded', inicializarPaginaScanner);

})();
