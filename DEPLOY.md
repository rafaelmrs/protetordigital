# ProtetorDigital v2.1 — Guia de Deploy

## Domínio
`protetordigital.com`

---

## Cloudflare Pages (site Astro)

1. Conecte o repositório em [pages.cloudflare.com](https://pages.cloudflare.com)
2. **Build command:** `npm run build`
3. **Output directory:** `dist`
4. Variáveis de ambiente (Settings → Environment variables):

| Variável | Obrigatório | Descrição |
|---|---|---|
| `PUBLIC_GA_ID` | Não | Google Analytics (ex: `G-XXXXXXXXXX`) |
| `PUBLIC_ADSENSE_ID` | Não | AdSense (ex: `ca-pub-XXXXXXXX`) |
| `PUBLIC_FORMSPREE_ENDPOINT` | Sim (contato) | URL do Formspree (ex: `https://formspree.io/f/xpwzqkrv`) |

---

## Cloudflare Worker (API — `workers/worker.js`)

O Worker serve **3 endpoints** para as ferramentas do site.

### Endpoints

| Endpoint | Usado por | Descrição |
|---|---|---|
| `POST /api/scan` | Verificador de Links | Safe Browsing **ao vivo** — sem KV, sem cron |
| `POST /api/breach` | Verificador de Vazamentos | HIBP v3 + cache KV 24h (opcional) |
| `POST /api/pwned-password` | Analisador de Senhas | HIBP k-anonymity — sem KV |
| `GET /api/health` | Monitoramento | Status do Worker |

### Por que /scan não usa mais KV?

A versão anterior fazia updates periódicos de prefixes no KV (via cron),
esgotando a quota no primeiro dia. Agora cada verificação chama
`threatMatches:find` diretamente — resultado equivalente, zero writes no KV.

### 1. Credenciais necessárias

**Safe Browsing API** (grátis, 10k req/dia):
- Acesse https://console.cloud.google.com
- Ative a Safe Browsing API
- Crie uma chave em "APIs & Serviços → Credenciais"

**HIBP API Key** (pago, ~$3.95/mês):
- Compre em https://haveibeenpwned.com/API/Key
- Necessário para /api/breach (Verificador de Vazamentos)
- O /api/pwned-password usa a API pública de senhas (gratuita, sem key)

### 2. Deploy

```bash
npm install -g wrangler
wrangler login

wrangler secret put SAFE_BROWSING_API_KEY
wrangler secret put HIBP_API_KEY

wrangler deploy
```

### 3. KV Namespace (opcional)

Usado apenas para cache do /api/breach (1 write por email/dia).
Se não configurar, o breach consulta o HIBP a cada request.

Para configurar:
1. Dashboard → Workers & Pages → KV → Create namespace: protetordigital-cache
2. Descomente e preencha em wrangler.toml:
   [[kv_namespaces]]
   binding = "URL_SAFETY_KV"
   id = "SEU_KV_NAMESPACE_ID"
3. wrangler deploy

---

## Sitemap manual

public/sitemap.xml é servido estaticamente.
Ao adicionar novos posts, adicione a URL correspondente no arquivo.

---

## Página de Contato (Formspree)

1. Crie conta gratuita em https://formspree.io
2. Crie um formulário e copie o ID
3. Configure no Cloudflare Pages:
   PUBLIC_FORMSPREE_ENDPOINT = https://formspree.io/f/SEU_ID

---

## Mudanças v2.0 → v2.1

- Domínio: .com.br → .com
- Tema padrão: dark mode fixo
- Sitemap: automático (bugado no CF) → manual em public/sitemap.xml
- RSS Feed: removido
- /scan: cron + KV writes → consulta direta por request (zero writes)
- /breach: KV obrigatório → KV opcional (cache 24h)
- /pwned-password: rate limit KV → rate limit in-memory
- Componentes: PasswordAnalyzer, URLScanner, BreachChecker incluídos
- WORKER_URL: URL externa hardcoded → /api (relativo, mesmo domínio)
- WhatsApp Share: só sidebar → sidebar + bloco inline pós-conteúdo
- Páginas novas: /sobre e /contato
- Navegação: + Sobre + Contato
