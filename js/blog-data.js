/**
 * Protetor Digital — blog-data.js
 * Fonte única de verdade para todos os posts do blog.
 * Altere BLOG_CONFIG.autor para mudar o autor em todos os posts de uma vez.
 */

window.BLOG_CONFIG = {
  // ── Altere aqui para mudar o autor em todos os posts ──
  autor: 'Rafael',

  // ── Lista de todos os posts ──
    posts: [
    {
      slug: 'melhor-antivirus',
      url: '/blog/posts/melhor-antivirus',
      titulo: 'Melhor Antivírus em 2026: qual protege de verdade?',
      descricao: 'Comparamos os principais antivírus do mercado para você escolher a proteção certa sem pagar por recursos que não precisa.',
      data: '2026-02-19',
      dataFormatada: '19 de fevereiro de 2026',
      leitura: '8 min',
      imagem: '/images/blog/antivirus-windows.webp',
      imagemAlt: 'Alerta de ameaças do Windows Security em notebook',
      categoria: 'Proteção',
      corCategoria: 'verde',
      icone: 'shield',
    },
    {
      slug: 'melhores-gerenciadores-senha',
      url: '/blog/posts/melhores-gerenciadores-senha',
      titulo: 'Os Melhores Gerenciadores de Senha em 2026',
      descricao: 'Chega de anotar senha em papel ou reutilizar a mesma em todo lugar. Conheça os melhores gerenciadores de senha e escolha o ideal para você.',
      data: '2026-02-16',
      dataFormatada: '16 de fevereiro de 2026',
      leitura: '7 min',
      imagem: '/images/blog/gerenciador-senhas.webp',
      imagemAlt: 'Tela de login do Instagram ilustrando a importância de senhas seguras',
      categoria: 'Senhas',
      corCategoria: 'azul',
      icone: 'lock',
    },
    {
      slug: 'maiores-vazamentos-2025',
      url: '/blog/posts/maiores-vazamentos-2025',
      titulo: 'Os Maiores Vazamentos de Dados de 2025 e Como se Proteger',
      descricao: '2025 ficou marcado como o ano em que o Brasil enfrentou uma sequência sem precedentes de vazamentos de dados.',
      data: '2026-02-12',
      dataFormatada: '12 de fevereiro de 2026',
      leitura: '6 min',
      imagem: '/images/blog/cadeado-vazamento-dados.webp',
      imagemAlt: 'Cadeado digital representando vazamento de dados',
      categoria: 'Vazamentos',
      corCategoria: 'vermelho',
      icone: 'alert',
    },
    {
      slug: 'como-usar-2fa',
      url: '/blog/posts/como-usar-2fa',
      titulo: 'Verificação em Duas Etapas: O Que É e Como Ativar em 5 Minutos',
      descricao: 'Mesmo que alguém descubra sua senha, a verificação em duas etapas impede o acesso à sua conta.',
      data: '2026-02-09',
      dataFormatada: '9 de fevereiro de 2026',
      leitura: '5 min',
      imagem: '/images/blog/autenticacao-dois-fatores.webp',
      imagemAlt: 'Autenticação de dois fatores em smartphone',
      categoria: 'Segurança',
      corCategoria: 'azul',
      icone: 'shield',
    },
  ],
};

// ── SVGs dos ícones dos cards ──
window.BLOG_ICONS = {
  shield: '<svg class="card-icone-svg {cor}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  lock:   '<svg class="card-icone-svg {cor}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  alert:  '<svg class="card-icone-svg {cor}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>',
  phone:  '<svg class="card-icone-svg {cor}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
};

/**
 * Retorna N posts aleatórios excluindo o slug atual.
 */
window.getPostsRelacionados = function(slugAtual, quantidade = 2) {
  const outros = window.BLOG_CONFIG.posts.filter(p => p.slug !== slugAtual);
  // Embaralha (Fisher-Yates)
  for (let i = outros.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [outros[i], outros[j]] = [outros[j], outros[i]];
  }
  return outros.slice(0, quantidade);
};

/**
 * Injeta autor e data na página do post.
 * Procura por elementos com data-blog="autor" e data-blog="data".
 */
window.injetarMetaPost = function() {
  const autorEl = document.querySelector('[data-blog="autor"]');
  if (autorEl) autorEl.textContent = window.BLOG_CONFIG.autor;
};

/**
 * Injeta seção "Leia também" dinamicamente no final do post.
 * slugAtual deve ser passado pela página.
 */
window.injetarLeiaTambem = function(slugAtual) {
  const container = document.getElementById('leia-tambem-auto');
  if (!container) return;

  const posts = window.getPostsRelacionados(slugAtual, 2);

  const html = `
    <div class="leia-tambem">
      <h2 class="leia-tambem-titulo">Leia também:</h2>
      <div class="leia-tambem-grid">
        ${posts.map(p => {
          const imgHtml = p.imagem
            ? `<img src="${p.imagem}" alt="${p.imagemAlt}" loading="lazy" style="width:100%;height:130px;object-fit:cover;border-radius:8px;margin-bottom:0.75rem;">`
            : '';
          return `
            <a href="${p.url}" class="ferramenta-card" style="display:block;">
              ${imgHtml}
              <div class="card-titulo" style="font-size:0.9rem;line-height:1.4;">${p.titulo}</div>
              <span class="badge badge-neutro" style="margin-top:0.5rem;">${p.leitura}</span>
            </a>`;
        }).join('')}
      </div>
    </div>`;

  container.innerHTML = html;
};

/**
 * Injeta cards de posts na página de listagem do blog.
 * Usa o elemento com id="blog-grid-auto".
 */
window.injetarBlogGrid = function() {
  const container = document.getElementById('blog-grid-auto');
  if (!container) return;

  const posts = [...window.BLOG_CONFIG.posts].sort((a, b) => b.data.localeCompare(a.data));

  container.innerHTML = posts.map(p => {
    const icone = (window.BLOG_ICONS[p.icone] || window.BLOG_ICONS.shield).replace(/{cor}/g, p.corCategoria);
    const imgHtml = p.imagem
      ? `<div class="post-card-imagem"><img src="${p.imagem}" alt="${p.imagemAlt}" loading="lazy" style="width:100%;height:160px;object-fit:cover;border-radius:8px;margin-bottom:0.75rem;"></div>`
      : `<div class="card-icone-wrapper ${p.corCategoria}" style="margin-bottom:0.75rem;">${icone}</div>`;

    return `
      <a href="${p.url}" class="ferramenta-card">
        ${imgHtml}
        <h2 class="card-titulo">${p.titulo}</h2>
        <p class="card-descricao">${p.descricao}</p>
        <div style="margin-top:0.5rem;display:flex;gap:0.5rem;align-items:center;justify-content:space-between;">
          <span class="badge badge-neutro">${p.leitura} de leitura</span>
          <span class="card-link">Ler artigo <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>
        </div>
      </a>`;
  }).join('');
};
