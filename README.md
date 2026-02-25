# Protetor Digital

🌐 [protetordigital.com](https://protetordigital.com)

Ferramentas gratuitas de segurança digital para o usuário comum. Sem cadastro, sem rastreamento próprio, em linguagem simples.

---

## Ferramentas

**Termômetro de Senhas** — analisa força da senha inteiramente no navegador, nada é enviado ao servidor.

**Gerador de Senhas** — usa `crypto.getRandomValues`, sem chamadas externas.

**Senhas Vazadas** — verifica se uma senha aparece em bases de dados comprometidas via k-Anonymity: só um prefixo parcial do hash chega à API, a senha em si nunca sai do dispositivo.

**Radar de Vazamentos** — consulta e-mails na base do Have I Been Pwned.

**Verificador de Links** — identifica URLs maliciosas via Google Safe Browsing.

**Pegada Digital** — mostra o que qualquer site consegue ver sobre a conexão do visitante: IP, localização aproximada, ISP, dispositivo, detecção de VPN.

---

## Estrutura

Site estático no Cloudflare Pages. As chamadas às APIs externas passam por funções serverless para não expor chaves no client.

```
/
├── components/          header, sidebar e footer compartilhados
├── css/                 design system único
├── js/
│   ├── app.js           carrega componentes, navegação, sidebar
│   ├── blog-data.js     fonte de dados do blog (listagem, leia também, RSS)
│   ├── breach.js        radar de vazamentos e verificação de senhas
│   ├── scanner.js       verificador de links
│   ├── password.js      termômetro e gerador de senhas
│   ├── pegada.js        exibe os dados da API de geolocalização
│   └── lastbreach.js    widget do último vazamento na home
├── ferramentas/         uma pasta por ferramenta
├── blog/posts/          uma pasta por post
├── functions/api/       Cloudflare Pages Functions
│   ├── breach.js        proxy HIBP
│   ├── scan.js          proxy Google Safe Browsing
│   └── pegada.js        geolocalização via ipwho.org
└── data/
    ├── breaches-pt.json      traduções PT-BR dos vazamentos
    └── lastbreach-pt.json    dados do último vazamento para a home
```

Novos posts de blog: criar pasta em `/blog/posts/` e adicionar entrada em `js/blog-data.js`. A listagem, o "leia também" e o RSS atualizam automaticamente.

---

## APIs

| | |
|---|---|
| [Have I Been Pwned](https://haveibeenpwned.com) | vazamentos de e-mail (chave paga) |
| [HIBP Passwords](https://haveibeenpwned.com/API/v3#SearchingPwnedPasswordsByRange) | senhas via k-Anonymity, direto do browser |
| [Google Safe Browsing](https://developers.google.com/safe-browsing) | links maliciosos (chave gratuita) |
| [ipwho.org](https://ipwho.org) | geolocalização e análise de conexão |
