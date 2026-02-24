(function () {
  'use strict';

  // GA4
  (function () {
    var s = document.createElement('script');
    s.src = 'https://www.googletagmanager.com/gtag/js?id=G-R2B395NE0Z';
    s.async = true;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', 'G-R2B395NE0Z');
  })();

  const TITULOS = {
    '/': 'Página Inicial',
    '/index.html': 'Página Inicial',
    '/ferramentas/termometro.html': 'Termômetro de Senhas',
    '/ferramentas/termometro': 'Termômetro de Senhas',
    '/ferramentas/gerador.html': 'Gerador de Senhas',
    '/ferramentas/gerador': 'Gerar Senha Forte',
    '/ferramentas/verificador.html': 'Verificador de Links',
    '/ferramentas/verificador': 'Verificador de Links',
    '/ferramentas/vazamentos.html': 'Radar de Vazamentos',
    '/ferramentas/vazamentos': 'Radar de Vazamentos',
    '/ferramentas/senhas.html': 'Senhas Vazadas',
    '/ferramentas/senhas': 'Senhas Vazadas',
    '/blog/index.html': 'Educação Digital',
    '/blog/posts/golpes-whatsapp': 'Golpes pelo WhatsApp',
    '/blog/posts/senhas-seguras': 'Guia de Senhas Seguras',
    '/blog/posts/dados-vazaram': 'O Que Fazer Se Seus Dados Vazaram',
    '/blog/posts/dois-fatores': 'Autenticação em Dois Fatores',
    '/blog/posts/como-usar-2fa': 'Verificação em Duas Etapas',
    '/blog/posts/maiores-vazamentos-2025': 'Maiores Vazamentos de 2025',
    '/blog/': 'Educação Digital',
    '/sobre.html': 'Sobre o Projeto',
    '/sobre': 'Sobre o Projeto',
    '/contato.html': 'Contato',
    '/contato': 'Contato',
    '/politica-privacidade.html': 'Política de Privacidade',
    '/politica-privacidade': 'Política de Privacidade',
  };

  function resolverTitulo(pathname) {
    if (TITULOS[pathname]) return TITULOS[pathname];
    const sem = pathname.replace(/\/$/, '');
    if (TITULOS[sem]) return TITULOS[sem];
    const semHtml = sem.replace(/\.html$/, '');
    if (TITULOS[semHtml]) return TITULOS[semHtml];
    const slug = '/' + pathname.split('/').filter(Boolean).pop();
    if (TITULOS[slug]) return TITULOS[slug];
    return 'Protetor Digital';
  }

  window.initVazDescToggles = function() {
    document.querySelectorAll('.vaz-desc-wrap').forEach(wrap => {
      const texto = wrap.querySelector('.vaz-desc-texto');
      const btn   = wrap.querySelector('.vaz-desc-toggle');
      if (!texto || !btn) return;
      if (texto.scrollHeight <= texto.clientHeight + 2) {
        btn.style.display = 'none';
      }
      btn.addEventListener('click', () => {
        const expandido = texto.classList.toggle('expandido');
        btn.textContent = expandido ? 'Ver menos ▲' : 'Ver mais ▼';
      });
    });
  };

  async function fetchFragment(path) {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      console.warn(`[app.js] falha ao carregar ${path}:`, err);
      return '';
    }
  }

  async function loadComponent(slotId, componentPath) {
    const slot = document.getElementById(slotId);
    if (!slot) return;
    slot.innerHTML = await fetchFragment(componentPath);
  }

  function ativarNavItem() {
    const pathname = window.location.pathname;
    const pathNorm = pathname.replace(/\/index\.html$/, '').replace(/\/$/, '') || '/';

    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('ativo');
      item.removeAttribute('aria-current');
      const href = item.getAttribute('href');
      if (!href) return;
      const hrefNorm = href.replace(/\/index\.html$/, '').replace(/\/$/, '') || '/';
      if (pathNorm === hrefNorm) {
        item.classList.add('ativo');
        item.setAttribute('aria-current', 'page');
      }
    });

    const tituloEl = document.getElementById('topbar-titulo');
    if (tituloEl) tituloEl.textContent = resolverTitulo(pathname);
  }

  function fecharSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const toggle  = document.getElementById('sidebar-toggle');
    if (sidebar) sidebar.classList.remove('aberta');
    if (overlay) overlay.classList.remove('ativo');
    if (toggle)  toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('sidebar-aberta');
  }

  function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const toggle  = document.getElementById('sidebar-toggle');
    if (!sidebar || !overlay || !toggle) return;

    toggle.addEventListener('click', () => {
      const isOpen = sidebar.classList.toggle('aberta');
      overlay.classList.toggle('ativo', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
      document.body.classList.toggle('sidebar-aberta', isOpen);
    });

    overlay.addEventListener('click', fecharSidebar);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharSidebar(); });

    sidebar.querySelectorAll('a.nav-item').forEach(item => {
      item.addEventListener('click', () => { if (window.innerWidth < 768) fecharSidebar(); });
    });
  }

  window.compartilhar = function (rede) {
    const url    = encodeURIComponent(window.location.href);
    const titulo = encodeURIComponent(document.title);
    let link = '';
    if (rede === 'whatsapp') link = `https://wa.me/?text=${titulo}%20${url}`;
    if (rede === 'twitter')  link = `https://twitter.com/intent/tweet?text=${titulo}&url=${url}`;
    if (rede === 'facebook') link = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
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

  async function init() {
    await Promise.all([
      loadComponent('slot-header',  '/components/header.html'),
      loadComponent('slot-sidebar', '/components/sidebar.html'),
      loadComponent('slot-footer',  '/components/footer.html'),
    ]);
    ativarNavItem();
    initSidebar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
