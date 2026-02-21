# Protetor Digital

Plataforma brasileira de educação e ferramentas de segurança digital. Gratuita, sem cadastro, em linguagem simples.

🌐 **[protetordigital.com](https://protetordigital.com)**

---

## O que é

O Protetor Digital oferece ferramentas práticas para o usuário comum verificar e melhorar sua segurança digital, sem precisar de conhecimento técnico.

**Ferramentas disponíveis:**
- **Verificador de Senhas** — analisa a força da senha localmente no navegador (nenhum dado enviado ao servidor)
- **Verificador de Vazamentos** — consulta se seu e-mail apareceu em bases de dados vazadas (via HIBP)
- **Gerador de Senhas** — cria senhas fortes com `crypto.getRandomValues`
- **Verificador de Links** — identifica URLs maliciosas via Google Safe Browsing
- **Termômetro Digital** — avaliação geral do nível de segurança digital do usuário

**Blog:**
Artigos práticos sobre senhas, autenticação em dois fatores, golpes, vazamentos e proteção online.

---

## Privacidade por design

- Senhas são analisadas **100% no navegador** — nunca saem do seu dispositivo
- E-mails são verificados via k-Anonymity — apenas um prefixo parcial é enviado à API
- Nenhum dado pessoal é armazenado em nossos servidores
- Sem cookies de rastreamento próprios

---

## Tecnologia

Site estático hospedado no **Cloudflare Pages**, com funções serverless para intermediar chamadas às APIs externas.

```
/
├── index.html                        ← Página inicial
├── blog/
│   ├── index.html                    ← Listagem de artigos
│   └── posts/                        ← Posts individuais (pasta/index.html)
├── ferramentas/                      ← Ferramentas (pasta/index.html)
├── sobre/
├── contato/
├── politica-privacidade/
│
├── components/                       ← Carregados em todas as páginas via app.js
│   ├── header.html
│   ├── sidebar.html
│   └── footer.html
│
├── js/
│   ├── app.js                        ← Core: componentes, navegação, sidebar
│   ├── blog-data.js                  ← Fonte única de dados do blog
│   ├── password.js                   ← Análise e geração de senhas
│   ├── breach.js                     ← Verificação de vazamentos
│   └── scanner.js                    ← Verificador de links
│
├── css/
│   └── design-system.css             ← Design system completo
│
├── functions/api/                    ← Cloudflare Pages Functions (serverless)
│   ├── breach.js                     ← Proxy HIBP (e-mail) + DeepL
│   └── scan.js                       ← Proxy Google Safe Browsing
│
├── images/blog/                      ← Imagens dos posts (WebP otimizado)
├── data/breaches-pt.json             ← Traduções PT-BR de vazamentos
│
├── sitemap.xml
├── rss.xml
├── robots.txt
├── _redirects                        ← Redirects Cloudflare Pages
└── _headers                          ← Headers HTTP (segurança + cache)
```

---

## APIs externas utilizadas

| API | Uso | Autenticação |
|-----|-----|-------------|
| [Have I Been Pwned](https://haveibeenpwned.com) | Verificação de e-mails em vazamentos | Chave de API (paga) |
| [HIBP Passwords](https://haveibeenpwned.com/API/v3#SearchingPwnedPasswordsByRange) | Verificação de senhas (k-Anonymity) | Sem chave — client-side |
| [Google Safe Browsing](https://developers.google.com/safe-browsing) | Verificação de links maliciosos | Chave de API (gratuita) |
| [DeepL](https://www.deepl.com/docs-api) | Tradução de descrições de vazamentos | Chave de API (free tier) |

---

## Deploy (Cloudflare Pages)

1. Conecte o repositório no [Cloudflare Pages](https://pages.cloudflare.com)
2. Build command: *(deixe vazio — site estático)*
3. Output directory: `/`
4. Configure as variáveis de ambiente abaixo em **Settings → Environment Variables**

### Variáveis de ambiente necessárias

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `HIBP_API_KEY` | Chave da API Have I Been Pwned | Sim |
| `SAFE_BROWSING_API_KEY` | Chave Google Safe Browsing | Sim |
| `DEEPL_API_KEY` | Chave DeepL (free tier suficiente) | Não |

> ⚠️ **Nunca versione as chaves de API.** Configure exclusivamente pelas variáveis de ambiente do Cloudflare Pages. O arquivo `.gitignore` já protege arquivos `.env` locais.

---

## Como adicionar um novo post

1. Crie a pasta `/blog/posts/meu-artigo/` com um `index.html` baseado em um post existente
2. Adicione a entrada no array `BLOG_CONFIG.posts` em `/js/blog-data.js`
3. O post aparece automaticamente na listagem, no "Leia também" e no RSS

---

## Licença

Conteúdo e código disponibilizados para fins educacionais.
