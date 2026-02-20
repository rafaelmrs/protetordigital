/**
 * PROTETOR DIGITAL — app.js
 * Core do sistema: carrega componentes HTML compartilhados,
 * gerencia navegação e meta tags de forma centralizada.
 *
 * Como funciona:
 * 1. Cada página HTML declara meta dados via data-attributes no <html>
 * 2. app.js carrega sidebar, topbar e footer de /components/
 * 3. Marca o item de navegação ativo automaticamente
 * 4. Preenche breadcrumb e meta tags
 */

(function () {
  'use strict';

  // ============================================================
  // CONFIGURAÇÃO GLOBAL (edite aqui para alterar o site todo)
  // ============================================================
  const CONFIG = {
    siteName: 'Protetor Digital',
    siteUrl: 'https://protetordigital.com',
    defaultDescription: 'Ferramentas gratuitas de segurança digital para brasileiros. Verifique senhas, detecte vazamentos e analise links suspeitos.',
    componentsPath: '/components/',
    apiPath: '/api',
  };

  // ============================================================
  // UTILITÁRIOS
  // ============================================================

  /** Faz fetch de um componente HTML e retorna o texto */
  async function carregarComponente(nome) {
    try {
      const res = await fetch(`${CONFIG.componentsPath}${nome}.html?v=2.0`);
      if (!res.ok) throw new Error(`Componente ${nome} não encontrado`);
      return await res.text();
    } catch (err) {
      console.warn(`[ProtetorDigital] Erro ao carregar componente "${nome}":`, err);
      return '';
    }
  }

  /** Insere HTML num elemento */
  function injetar(seletor, html) {
    const el = document.querySelector(seletor);
    if (el) el.innerHTML = html;
  }

  /** Lê atributo data-* do elemento <html> */
  function metaDado(nome, padrao = '') {
    return document.documentElement.dataset[nome] || padrao;
  }

  // ============================================================
  // META TAGS DINÂMICAS
  // Defina no <html data-titulo="..." data-descricao="..." data-pagina="...">
  // ============================================================
  function configurarMetaTags() {
    const pagina = metaDado('pagina', 'inicio');
    const titulo = metaDado('titulo', CONFIG.siteName);
    const desc = metaDado('descricao', CONFIG.defaultDescription);

    // Título da aba
    document.title = titulo === CONFIG.siteName
      ? `${CONFIG.siteName} — Sua segurança online começa aqui`
      : `${titulo} — ${CONFIG.siteName}`;

    // Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = desc;

    // Open Graph
    const ogTags = {
      'og:title': document.title,
      'og:description': desc,
      'og:type': 'website',
      'og:url': `${CONFIG.siteUrl}/${pagina === 'inicio' ? '' : pagina}`,
      'og:site_name': CONFIG.siteName,
    };

    Object.entries(ogTags).forEach(([prop, content]) => {
      let tag = document.querySelector(`meta[property="${prop}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', prop);
        document.head.appendChild(tag);
      }
      tag.content = content;
    });

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = ogTags['og:url'];
  }

  // ============================================================
  // BREADCRUMB
  // Defina no <html data-breadcrumb='[{"label":"Ferramentas"},{"label":"Senha"}]'>
  // ============================================================
  function configurarBreadcrumb() {
    const container = document.getElementById('topbar-breadcrumb');
    if (!container) return;

    const rawBreadcrumb = metaDado('breadcrumb', '');

    let itens = [];
    if (rawBreadcrumb) {
      try { itens = JSON.parse(rawBreadcrumb); } catch {}
    }

    if (itens.length === 0) {
      container.innerHTML = `
        <span style="font-family:var(--font-display);font-size:0.85rem;font-weight:600;color:var(--preto-titulo)">
          ${metaDado('titulo', CONFIG.siteName)}
        </span>`;
      return;
    }

    const partes = itens.map((item, i) => {
      const isUltimo = i === itens.length - 1;
      if (isUltimo) {
        return `<span style="font-family:var(--font-display);font-size:0.82rem;font-weight:600;color:var(--preto-titulo)">${item.label}</span>`;
      }
      const link = item.href ? `<a href="${item.href}">${item.label}</a>` : item.label;
      return `<span>${link}</span><span class="topbar-sep">›</span>`;
    });

    container.innerHTML = partes.join('');
  }

  // ============================================================
  // NAVEGAÇÃO ATIVA
  // ============================================================
  function marcarNavAtiva() {
    const paginaAtual = metaDado('pagina', 'inicio');
    document.querySelectorAll('.nav-item[data-pagina]').forEach(item => {
      item.classList.toggle('ativo', item.dataset.pagina === paginaAtual);
    });
  }

  // ============================================================
  // SIDEBAR MOBILE
  // ============================================================
  function configurarSidebarMobile() {
    const toggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (!toggle || !sidebar || !overlay) return;

    function abrir() {
      sidebar.classList.add('aberta');
      overlay.classList.add('visivel');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function fechar() {
      sidebar.classList.remove('aberta');
      overlay.classList.remove('visivel');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    toggle.addEventListener('click', () => {
      sidebar.classList.contains('aberta') ? fechar() : abrir();
    });

    overlay.addEventListener('click', fechar);

    // Fechar ao navegar (mobile)
    sidebar.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 768) fechar();
      });
    });

    // Fechar com ESC
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && sidebar.classList.contains('aberta')) fechar();
    });
  }

  // ============================================================
  // INICIALIZAÇÃO PRINCIPAL
  // ============================================================
  async function inicializar() {
    // 1. Configurar meta tags (não precisa esperar DOM components)
    configurarMetaTags();

    // 2. Carregar todos os componentes em paralelo
    const [htmlSidebar, htmlTopbar, htmlFooter] = await Promise.all([
      carregarComponente('sidebar'),
      carregarComponente('topbar'),
      carregarComponente('footer'),
    ]);

    // 3. Injetar componentes nos containers
    injetar('#container-sidebar', htmlSidebar);
    injetar('#container-topbar', htmlTopbar);
    injetar('#container-footer', htmlFooter);

    // 4. Configurar funcionalidades após injeção
    marcarNavAtiva();
    configurarBreadcrumb();
    configurarSidebarMobile();

    // 5. Disparar evento para módulos de página saberem que o layout está pronto
    document.dispatchEvent(new CustomEvent('layoutPronto'));
  }

  // Inicia quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }

  // ============================================================
  // API PÚBLICA (acessível via window.ProtetorDigital)
  // ============================================================
  window.ProtetorDigital = {
    config: CONFIG,
    /** Recarrega breadcrumb (útil após mudanças dinâmicas) */
    atualizarBreadcrumb: configurarBreadcrumb,
  };

})();
