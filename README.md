# Protetor Digital v2.0
**Plataforma institucional de segurança digital para brasileiros**

---

## 🗂️ Estrutura do Projeto

```
protetor-digital/
│
├── index.html                    ← Página inicial
├── sobre.html                    ← Sobre o projeto
├── contato.html                  ← Formulário de contato
├── politica-privacidade.html     ← Política de privacidade
│
├── ferramentas/
│   ├── senha.html                ← Verificador + Gerador de senhas
│   ├── vazamento.html            ← Verificador de e-mails (HIBP)
│   └── link.html                 ← Scanner de URLs (Google Safe Browsing)
│
├── blog/
│   ├── index.html                ← Listagem de posts
│   └── posts/
│       └── [slug].html           ← Posts individuais
│
├── components/                   ← ⚡ EDITADOS UMA VEZ, carregados em TODAS as páginas
│   ├── sidebar.html              ← Navegação lateral
│   ├── topbar.html               ← Barra superior + hamburguer
│   └── footer.html               ← Rodapé
│
├── css/
│   └── design-system.css         ← Sistema de design completo
│
├── js/
│   ├── app.js                    ← Core: carrega componentes, meta tags, navegação
│   ├── password.js               ← Análise de senhas + HIBP free
│   ├── breach.js                 ← Verificação de vazamentos (HIBP pago)
│   └── scanner.js                ← Scanner de links (Google Safe Browsing)
│
├── functions/
│   └── api/
│       ├── breach.js             ← Cloudflare Function: HIBP pago + DeepL
│       ├── scan.js               ← Cloudflare Function: Google Safe Browsing
│       └── health.js             ← Cloudflare Function: health check
│
├── data/
│   └── breaches-pt.json          ← Traduções offline de descrições de vazamentos
│
└── public/
    └── favicon.svg
```

---

## ⚡ Como funciona o sistema de componentes

A ideia central: **edite uma vez, atualiza tudo.**

Cada página HTML tem um `data-*` no `<html>` que configura:
- `data-pagina` — qual item da navegação fica ativo
- `data-titulo` — título da página e da aba
- `data-descricao` — meta description (SEO)
- `data-breadcrumb` — caminho de navegação (JSON)

O `app.js` lê esses atributos, carrega os 3 componentes compartilhados e configura tudo automaticamente.

### Para editar a navegação:
Abra `/components/sidebar.html` e edite. **Todas as páginas atualizam automaticamente.**

### Para editar o rodapé:
Abra `/components/footer.html`. Idem.

### Para criar uma nova página:
```html
<!DOCTYPE html>
<html lang="pt-BR"
  data-pagina="nome-da-pagina"
  data-titulo="Título da Página"
  data-descricao="Descrição para o Google."
  data-breadcrumb='[{"label":"Início","href":"/index.html"},{"label":"Minha Página"}]'>
<head>
  <!-- Copie o <head> de qualquer página existente -->
</head>
<body>
<div class="app-layout">
  <div id="container-sidebar"></div>
  <main class="main-area">
    <div id="container-topbar"></div>
    <div class="page-content">
      <!-- SEU CONTEÚDO AQUI -->
    </div>
    <div id="container-footer"></div>
  </main>
</div>
<script src="/js/app.js" defer></script>
</body>
</html>
```

### Para criar um novo post do blog:
1. Copie `/blog/posts/autenticacao-dois-fatores.html`
2. Renomeie para o slug do post
3. Altere os `data-*` no `<html>`
4. Edite o conteúdo dentro de `.artigo-body`
5. Adicione o link no `/blog/index.html`

---

## 🚀 Deploy na Cloudflare Pages

### 1. Variáveis de ambiente necessárias
Configure em **Settings → Environment Variables** no Cloudflare Pages:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `HIBP_API_KEY` | Sim | Chave da API paga do Have I Been Pwned |
| `SAFE_BROWSING_API_KEY` | Sim | Chave da Google Safe Browsing API |
| `DEEPL_API_KEY` | Opcional | Fallback para traduções não cobertas pelo JSON |

### 2. Build settings
- **Framework preset:** None
- **Build command:** *(em branco — é HTML puro)*
- **Build output directory:** `/` (raiz)
- **Root directory:** *(em branco)*

### 3. Roteamento
A Cloudflare Pages serve arquivos estáticos automaticamente. As Functions em `/functions/api/` ficam disponíveis em `/api/`.

### 4. Domínio customizado
Configure em **Settings → Custom domains**.

> **Importante:** Atualize a URL `https://protetordigital.com` no arquivo `functions/api/breach.js` para o seu domínio real.

---

## 🔧 APIs utilizadas

### HIBP Pwned Passwords (GRATUITA, sem chave)
- **Onde:** `js/password.js`
- **Como:** Diretamente do navegador via k-anonymity (SHA-1)
- **Cloudflare Function:** Não necessário

### HIBP v3 — Breach API (PAGA)
- **Onde:** `functions/api/breach.js`
- **Como:** Via Cloudflare Function (chave protegida no servidor)
- **Endpoint:** `POST /api/breach`
- **Body:** `{ "email": "usuario@exemplo.com" }`

### Google Safe Browsing (gratuita com chave)
- **Onde:** `functions/api/scan.js`
- **Como:** Via Cloudflare Function (chave protegida no servidor)
- **Endpoint:** `POST /api/scan`
- **Body:** `{ "url": "https://site.com" }`

### DeepL (gratuito até 500k chars/mês)
- **Onde:** `functions/api/breach.js` (fallback)
- **Como:** Acionado só quando a tradução não está no `data/breaches-pt.json`

---

## 🎨 Design System

### Classes principais
```html
<!-- Layout -->
<div class="app-layout">         <!-- Wrapper flex principal -->
<div class="main-area">          <!-- Área de conteúdo (com margin-left da sidebar) -->
<div class="page-content">       <!-- Container de conteúdo (max-width + padding) -->

<!-- Cards -->
<div class="card">               <!-- Card branco padrão -->
<div class="card-titulo">        <!-- Título do card -->
<p class="card-descricao">       <!-- Descrição do card -->

<!-- Botões -->
<button class="btn btn-primario">        <!-- Azul principal -->
<button class="btn btn-secundario">      <!-- Outline azul -->
<button class="btn btn-ghost">           <!-- Transparente -->
<button class="btn btn-primario btn-lg"> <!-- Grande -->
<button class="btn btn-primario btn-bloco"> <!-- Largura total -->

<!-- Inputs -->
<input class="campo">            <!-- Input padrão -->
<input class="campo campo-grande"> <!-- Input maior -->
<input class="campo campo-mono"> <!-- Input fonte mono -->
<label class="campo-label">      <!-- Label do input -->
<p class="campo-ajuda">          <!-- Texto de ajuda abaixo -->

<!-- Alertas -->
<div class="alerta alerta-seguro">  <!-- Verde -->
<div class="alerta alerta-atencao"> <!-- Âmbar -->
<div class="alerta alerta-perigo">  <!-- Vermelho -->
<div class="alerta alerta-info">    <!-- Azul -->

<!-- Badges -->
<span class="badge badge-azul">
<span class="badge badge-verde">
<span class="badge badge-ambar">
<span class="badge badge-vermelho">
<span class="badge badge-cinza">

<!-- Stats -->
<div class="stat-grid">          <!-- Grid de métricas -->
<div class="stat-card">          <!-- Card de métrica -->
<div class="stat-label">         <!-- Label da métrica -->
<div class="stat-valor">         <!-- Valor da métrica -->
```

### Paleta de cores
```css
--azul-soberano:   #0B2D5E  /* Título, sidebar bg */
--azul-confianca:  #1A4B8C  /* Hover, estados ativos */
--azul-claro:      #2563B8  /* Links, botões, ações */
--verde-seguro:    #1A7A4A  /* Status seguro */
--ambar-atencao:   #B45309  /* Alertas moderados */
--vermelho-perigo: #B91C1C  /* Perigo, erros graves */
```

---

## 📝 Para adicionar um post no blog

1. Crie `/blog/posts/nome-do-post.html` baseado no template existente
2. Defina `data-titulo` e `data-descricao` no `<html>`
3. Escreva o conteúdo dentro de `<div class="artigo-body">`
4. Adicione a classe `card` nos blocos de destaque dentro do artigo
5. Adicione o link no `/blog/index.html`

Não precisa de build, não precisa de framework. Salve e está no ar.

---

## 📊 Monitoramento

Acesse `/api/health` para verificar se as Functions estão online.

---

*Protetor Digital v2.0 — HTML + JavaScript Vanilla + Cloudflare Pages Functions*
