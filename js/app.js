/**
 * Protetor Digital — app.js
 * Core: carrega componentes HTML, gerencia navegação e sidebar
 */

(function () {
  'use strict';

  /* --------------------------------------------------------
     MAPA DE TÍTULOS POR PATHNAME
  -------------------------------------------------------- */
  const TITULOS = {
    '/': 'Página Inicial',
    '/index.html': 'Página Inicial',
    '/ferramentas/termometro.html': 'Termômetro de Senha',
    '/ferramentas/termometro': 'Termômetro de Senha',
    '/ferramentas/gerador.html': 'Gerar Senha Forte',
    '/ferramentas/gerador': 'Gerar Senha Forte',
    '/ferramentas/verificador.html': 'Verificador de Links',
    '/ferramentas/verificador': 'Verificador de Links',
    '/ferramentas/vazamentos.html': 'Consulta de Vazamentos',
    '/ferramentas/vazamentos': 'Consulta de Vazamentos',
    '/ferramentas/senhas.html': 'Senhas Expostas',
    '/ferramentas/senhas': 'Senhas Expostas',
    '/blog/index.html': 'Educação Digital',
    '/blog/': 'Educação Digital',
    '/sobre.html': 'Sobre o Projeto',
    '/sobre': 'Sobre o Projeto',
    '/contato.html': 'Contato',
    '/contato': 'Contato',
    '/politica-privacidade.html': 'Política de Privacidade',
    '/politica-privacidade': 'Política de Privacidade',
  };

  function resolverTitulo(pathname) {
    // Exact match
    if (TITULOS[pathname]) return TITULOS[pathname];
    // Strip trailing slash and retry
    const sem = pathname.replace(/\/$/, '');
    if (TITULOS[sem]) return TITULOS[sem];
    // Strip .html and retry
    const semHtml = sem.replace(/\.html$/, '');
    if (TITULOS[semHtml]) return TITULOS[semHtml];
    // Try just the filename segment (fallback for blog posts, etc.)
    const slug = '/' + pathname.split('/').filter(Boolean).pop();
    if (TITULOS[slug]) return TITULOS[slug];
    return 'Protetor Digital';
  }

  /* --------------------------------------------------------
     UTILITÁRIO: FETCH DE FRAGMENTO HTML
  -------------------------------------------------------- */
  async function fetchFragment(path) {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      console.warn(`[app.js] Não foi possível carregar ${path}:`, err);
      return '';
    }
  }

  /* --------------------------------------------------------
     INJEÇÃO DE COMPONENTE NUM SLOT
  -------------------------------------------------------- */
  async function loadComponent(slotId, componentPath) {
    const slot = document.getElementById(slotId);
    if (!slot) return;
    const html = await fetchFragment(componentPath);
    slot.innerHTML = html;
  }

  /* --------------------------------------------------------
     DETECÇÃO DO CAMINHO BASE PARA OS COMPONENTES
  -------------------------------------------------------- */
  function getBasePath() {
    const depth = (window.location.pathname.match(/\//g) || []).length - 1;
    if (depth <= 0) return '.';
    return Array(depth).fill('..').join('/');
  }

  /* --------------------------------------------------------
     ATIVAR ITEM DA SIDEBAR CORRESPONDENTE À PÁGINA ATUAL
  -------------------------------------------------------- */
  function ativarNavItem() {
    const pathname = window.location.pathname;
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.classList.remove('ativo');
      const href = item.getAttribute('href');
      if (!href) return;
      // Normaliza: compara o final do pathname
      const hrefNorm = href.replace(/^\.\.?\/?/, '/').replace(/\/index\.html$/, '/');
      const pathNorm = pathname.replace(/\/index\.html$/, '/');
      if (pathNorm === hrefNorm || pathname.endsWith(href.replace(/^\.\.?\/?/, '/'))) {
        item.classList.add('ativo');
        item.setAttribute('aria-current', 'page');
      }
    });

    // Topbar título
    const tituloEl = document.getElementById('topbar-titulo');
    if (tituloEl) {
      tituloEl.textContent = resolverTitulo(pathname);
    }
  }

  /* --------------------------------------------------------
     SIDEBAR MOBILE
  -------------------------------------------------------- */
  function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const toggle = document.getElementById('sidebar-toggle');
    if (!sidebar || !overlay || !toggle) return;

    toggle.addEventListener('click', () => {
      const isOpen = sidebar.classList.toggle('aberta');
      overlay.classList.toggle('ativo', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    overlay.addEventListener('click', fecharSidebar);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') fecharSidebar();
    });

    // Fecha ao clicar em link da sidebar em mobile
    sidebar.querySelectorAll('a.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth < 768) fecharSidebar();
      });
    });
  }

  function fecharSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const toggle = document.getElementById('sidebar-toggle');
    if (sidebar) sidebar.classList.remove('aberta');
    if (overlay) overlay.classList.remove('ativo');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  /* --------------------------------------------------------
     BOTÕES DE COMPARTILHAR (usado nas páginas de blog)
  -------------------------------------------------------- */
  window.compartilhar = function (rede) {
    const url = encodeURIComponent(window.location.href);
    const titulo = encodeURIComponent(document.title);
    let link = '';
    if (rede === 'whatsapp') link = `https://wa.me/?text=${titulo}%20${url}`;
    if (rede === 'twitter') link = `https://twitter.com/intent/tweet?text=${titulo}&url=${url}`;
    if (rede === 'copiar') {
      navigator.clipboard.writeText(window.location.href).then(() => {
        const btn = document.querySelector('.compartilhar-btn.copiar');
        if (btn) {
          const original = btn.innerHTML;
          btn.innerHTML = '✓ Copiado!';
          setTimeout(() => { btn.innerHTML = original; }, 2000);
        }
      });
      return;
    }
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  /* --------------------------------------------------------
     INICIALIZAÇÃO PRINCIPAL
  -------------------------------------------------------- */
  async function init() {
    const base = getBasePath();

    // Carrega componentes em paralelo
    await Promise.all([
      loadComponent('slot-header', `${base}/components/header.html`),
      loadComponent('slot-sidebar', `${base}/components/sidebar.html`),
      loadComponent('slot-footer', `${base}/components/footer.html`),
    ]);

    // Após injeção, ativa estados e eventos
    ativarNavItem();
    initSidebar();

    // Corrige hrefs na sidebar para caminhos absolutos/relativos corretos
    // (os componentes usam caminhos absolutos; isso funciona em servidor)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
