# Protetor Digital — Documentação de Deploy

## Arquitetura

```
/
├── index.html                    ← Página inicial
├── ferramentas/
│   ├── verificador.html          ← Verificar Senha (análise local, OWASP)
│   ├── gerador.html              ← Criar Senha Segura (crypto.getRandomValues)
│   ├── email.html                ← Buscar Vazamentos por E-mail (HIBP paga)
│   ├── senha.html                ← Verificar Senha Vazada (HIBP free, k-anonymity)
│   └── url.html                  ← Checar Link (Google Safe Browsing)
├── blog/
│   ├── index.html                ← Listagem de artigos
│   └── posts/
│       ├── senhas-seguras.html
│       ├── dois-fatores.html
│       ├── golpes-whatsapp.html
│       └── dados-vazaram.html
├── sobre.html
├── contato.html
├── politica-privacidade.html
│
├── components/                   ← Editados uma vez, carregados em todas as páginas
│   ├── header.html               ← Topbar + botão mobile + overlay
│   ├── sidebar.html              ← Navegação lateral completa
│   └── footer.html               ← Rodapé com links e ano dinâmico
│
├── js/
│   ├── app.js                    ← Core: carrega componentes, sidebar, navegação
│   ├── password.js               ← Análise de força e geração de senhas
│   ├── breach.js                 ← Vazamentos de e-mail e senha
│   └── scanner.js                ← Verificador de links
│
├── css/
│   └── design-system.css         ← Sistema de design completo (variáveis + componentes)
│
├── functions/                    ← Cloudflare Pages Functions (serverless)
│   └── api/
│       ├── breach.js             ← POST /api/breach → HIBP v3 paga + DeepL fallback
│       ├── scan.js               ← POST /api/scan → Google Safe Browsing
│       └── pwned-password.js     ← Deprecado (k-anonymity agora é client-side)
│
├── data/
│   └── breaches-pt.json          ← Traduções PT-BR de descrições de vazamentos
│
└── favicon.svg
```

## Variáveis de Ambiente (Cloudflare Pages)

Configure em: Settings → Environment Variables

| Variável            | Descrição                                    | Obrigatório |
|---------------------|----------------------------------------------|-------------|
| `HIBP_API_KEY`      | Chave da API Have I Been Pwned (paga)        | Sim         |
| `SAFE_BROWSING_API_KEY` | Chave da Google Safe Browsing API        | Sim         |
| `DEEPL_API_KEY`     | Chave DeepL (Free tier ok) para fallback     | Não         |

## Como os componentes são carregados

O `app.js` usa `fetch()` para carregar os fragmentos HTML em cada slot:
- `#slot-sidebar` → `components/sidebar.html`
- `#slot-header` → `components/header.html`
- `#slot-footer` → `components/footer.html`

O caminho base é calculado automaticamente pela profundidade do arquivo na hierarquia.

## APIs utilizadas

### HIBP Free (Senhas) — Client-side
- **URL:** `https://api.pwnedpasswords.com/range/{prefix}`
- **Método:** k-anonimidade SHA-1 (sem chave de API)
- **Onde:** `js/breach.js` → `verificarSenhaVazada()`
- **Não precisa de Pages Function**

### HIBP Pago (E-mails) — Via CF Function
- **URL:** `/api/breach` → `functions/api/breach.js`
- **Método:** POST com `{ email }`
- **Requer:** `HIBP_API_KEY`

### Google Safe Browsing — Via CF Function
- **URL:** `/api/scan` → `functions/api/scan.js`
- **Método:** POST com `{ url }`
- **Requer:** `SAFE_BROWSING_API_KEY`

## Deploy no Cloudflare Pages

1. Conecte este repositório no Cloudflare Pages
2. Build command: *(deixe vazio — site estático)*
3. Output directory: `/` (raiz)
4. Configure as variáveis de ambiente acima
5. Deploy!

## Adicionar novo post no Blog

1. Crie `/blog/posts/meu-artigo.html` baseado em um post existente
2. Adicione o card em `/blog/index.html`
3. Adicione links "Leia também" nos artigos relacionados

## Adicionar novo item na sidebar

Edite apenas `components/sidebar.html` — o item aparecerá em todas as páginas automaticamente.
