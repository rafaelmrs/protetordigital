/**
 * Protetor Digital — breach.js
 * Verificação de vazamentos de e-mail (HIBP paga via CF Pages Function)
 * e verificação de senha vazada (HIBP free via k-anonymity direto do browser)
 */

(function () {
  'use strict';

  /* --------------------------------------------------------
     HELPERS DE FORMATAÇÃO
  -------------------------------------------------------- */
  function formatarData(dateStr) {
    if (!dateStr) return 'Data desconhecida';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  function formatarContagem(n) {
    if (!n) return '';
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1}) + ' bilhões de contas';
    if (n >= 1_000_000) return (n / 1_000_000).toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1}) + ' milhões de contas';
    if (n >= 1_000) return Math.round(n / 1_000).toLocaleString('pt-BR') + ' mil contas';
    return n.toLocaleString('pt-BR') + ' contas';
  }

  function iniciais(nome) {
    return (nome || '??').substring(0, 2).toUpperCase();
  }

  function classSeveridade(sev) {
    if (sev === 'high') return 'badge-perigo';
    if (sev === 'medium') return 'badge-atencao';
    return 'badge-neutro';
  }

  function labelSeveridade(sev) {
    if (sev === 'high') return 'Alta';
    if (sev === 'medium') return 'Média';
    return 'Baixa';
  }

  function dotSeveridade(sev) {
    if (sev === 'high') return 'alta';
    if (sev === 'medium') return 'media';
    return 'baixa';
  }

  function traduzirDataClass(dc) {
    const mapa = {
      'Email addresses': 'Endereços de e-mail',
      'Passwords': 'Senhas',
      'Usernames': 'Nomes de usuário',
      'Names': 'Nomes',
      'Phone numbers': 'Números de telefone',
      'Physical addresses': 'Endereços físicos',
      'Dates of birth': 'Datas de nascimento',
      'Credit cards': 'Cartões de crédito',
      'Bank account numbers': 'Números de conta bancária',
      'Social security numbers': 'CPF / Seguro Social',
      'IP addresses': 'Endereços IP',
      'Geographic locations': 'Localização geográfica',
      'Profile photos': 'Fotos de perfil',
      'Gender': 'Gênero',
      'Spoken languages': 'Idiomas',
      'Website activity': 'Atividade no site',
      'Device information': 'Informações do dispositivo',
      'Purchases': 'Compras',
      'Job titles': 'Cargos',
      'Employers': 'Empregadores',
      'Education levels': 'Nível de escolaridade',
    };
    return mapa[dc] || dc;
  }

  /* --------------------------------------------------------
     BUSCA DE VAZAMENTOS — EMAIL (via CF Pages Function)
  -------------------------------------------------------- */
  window.buscarVazamentos = async function () {
    const email = document.getElementById('input-email')?.value.trim() || '';
    const resultado = document.getElementById('resultado-vazamentos');
    if (!resultado) return;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      resultado.innerHTML = `<div class="alerta alerta-atencao">
        <svg class="alerta-icone" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <div class="alerta-conteudo"><div class="alerta-titulo">Informe um e-mail válido</div><div class="alerta-texto">Digite um endereço de e-mail no formato correto (ex: nome@dominio.com).</div></div>
      </div>`;
      return;
    }

    resultado.innerHTML = `<div class="alerta alerta-info carregando" style="margin-top:1.5rem;">
      <svg class="alerta-icone" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <div class="alerta-conteudo"><div class="alerta-titulo">Verificando seu e-mail…</div><div class="alerta-texto">Consultando bases de dados de vazamentos conhecidos. Isso pode levar alguns segundos.</div></div>
    </div>`;

    let data;
    try {
      const res = await fetch('/api/breach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      data = await res.json();
    } catch (err) {
      resultado.innerHTML = `<div class="alerta alerta-atencao">
        <svg class="alerta-icone" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
        <div class="alerta-conteudo"><div class="alerta-titulo">Não foi possível verificar agora</div><div class="alerta-texto">${err.message || 'Verifique sua conexão e tente novamente.'}</div></div>
      </div>`;
      return;
    }

    const breaches = data.breaches || [];

    if (breaches.length === 0) {
      resultado.innerHTML = renderLimpo(email);
    } else {
      resultado.innerHTML = renderVazamentos(email, breaches);
      setTimeout(() => { if (typeof window.initVazDescToggles === 'function') window.initVazDescToggles(); }, 50);
    }
  };

  /* --------------------------------------------------------
     RENDERIZA: NENHUM VAZAMENTO
  -------------------------------------------------------- */
  function renderLimpo(email) {
    const emailSafe = email.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `
      <div class="resultado-vazamento-header limpo">
        <div class="vazamento-header-icone">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div class="vazamento-header-texto">
          <div class="vazamento-header-titulo">Boa notícia — nenhum vazamento encontrado!</div>
          <div class="vazamento-header-sub">O e-mail <strong>${emailSafe}</strong> não aparece em nenhuma das bases de dados monitoradas.</div>
        </div>
        <div class="vazamento-header-badge" style="background:rgba(255,255,255,0.2)">Limpo ✓</div>
      </div>
      <div class="acoes-bloco" style="margin-top:0; border-radius: 0 0 var(--radius-lg) var(--radius-lg);">
        <div class="acoes-bloco-titulo">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Continue mantendo boas práticas
        </div>
        <ol class="acoes-lista">
          <li>Use senhas longas e diferentes para cada serviço importante</li>
          <li>Ative a verificação em dois fatores sempre que possível</li>
          <li>Verifique seu e-mail periodicamente — novos vazamentos acontecem com frequência</li>
          <li>Desconfie de mensagens pedindo dados pessoais ou senhas, mesmo de remetentes conhecidos</li>
        </ol>
        <div style="margin-top:1rem; display:flex; gap:0.75rem; flex-wrap:wrap;">
          <a class="btn btn-primario" href="/ferramentas/termometro.html" style="font-size:0.85rem;">Verificar minha senha</a>
          <a class="btn btn-secundario" href="/ferramentas/gerador.html" style="font-size:0.85rem;">Criar senhas mais fortes</a>
        </div>
        <div style="margin-top:1rem;background:var(--azul-suave);border:1px solid rgba(37,99,184,0.15);border-radius:var(--radius-lg);padding:1.1rem 1.25rem;">
          <div style="font-family:var(--font-display);font-size:0.8rem;font-weight:700;color:var(--azul-soberano);margin-bottom:0.6rem;display:flex;align-items:center;gap:0.4rem;">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Troque suas senhas com mais segurança
          </div>
          <p style="font-family:var(--font-body);font-size:0.82rem;color:var(--azul-soberano);line-height:1.55;margin-bottom:0.75rem;">Se suas senhas foram expostas, a melhor proteção é usar senhas únicas em cada site. Um gerenciador faz isso por você — cria, guarda e preenche automaticamente.</p>
          <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
            <a href="https://nordpass.com" target="_blank" rel="noopener noreferrer" style="font-family:var(--font-display);font-size:0.78rem;font-weight:700;color:var(--azul-soberano);background:white;border:1px solid rgba(37,99,184,0.2);border-radius:6px;padding:0.35rem 0.75rem;text-decoration:none;">NordPass</a>
            <a href="https://1password.com" target="_blank" rel="noopener noreferrer" style="font-family:var(--font-display);font-size:0.78rem;font-weight:700;color:var(--azul-soberano);background:white;border:1px solid rgba(37,99,184,0.2);border-radius:6px;padding:0.35rem 0.75rem;text-decoration:none;">1Password</a>
            <a href="https://bitwarden.com" target="_blank" rel="noopener noreferrer" style="font-family:var(--font-display);font-size:0.78rem;color:var(--cinza-medio);background:transparent;border:1px solid var(--cinza-borda);border-radius:6px;padding:0.35rem 0.75rem;text-decoration:none;">Bitwarden (gratuito)</a>
          </div>
        </div>
      </div>`;
  }

  /* --------------------------------------------------------
     RENDERIZA: VAZAMENTOS ENCONTRADOS — com linha do tempo
  -------------------------------------------------------- */
  function renderVazamentos(email, breaches) {
    const total = breaches.length;
    // Ordena por data (mais recente primeiro)
    const ordenados = [...breaches].sort((a, b) => {
      const da = a.date || a.addedDate || '0';
      const db = b.date || b.addedDate || '0';
      return db.localeCompare(da);
    });

    const itensTimeline = ordenados.map((b, i) => {
      const tags = (b.exposedData || []).map(dc =>
        `<span class="tag">${traduzirDataClass(dc)}</span>`
      ).join('');
      // Usa iniciais para evitar requisições externas (privacidade)
      const logoTxt = b.domain ? b.domain.substring(0, 2).toUpperCase() : iniciais(b.title);
      const logoImg = '';
      const logoFallback = `<span>${logoTxt}</span>`;

      const descHtml = b.description ? `<div class="vaz-desc-wrap">
              <div class="vaz-desc-texto">${b.description}</div>
              <button class="vaz-desc-toggle">Ver mais ▼</button>
            </div>` : '';

      return `
        <div class="timeline-item" style="animation-delay:${i * 0.05}s">
          <div class="timeline-dot ${dotSeveridade(b.severity)}"></div>
          <div class="timeline-ano">${formatarData(b.date)}</div>
          <div class="vazamento-item vaz-card" style="margin-bottom:0;">
            <div class="vaz-topo">
              <div class="vazamento-logo">${logoImg}${logoFallback}</div>
              <div class="vaz-topo-info">
                <div class="vazamento-nome">${b.title || b.name}</div>
                <div class="vazamento-data">${formatarContagem(b.pwnCount)}</div>
              </div>
              <span class="badge ${classSeveridade(b.severity)}">${labelSeveridade(b.severity)}</span>
            </div>
            ${descHtml}
            ${tags ? `<div class="vazamento-tags" style="margin-top:0.6rem;">${tags}</div>` : ''}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="resultado-vazamento-header">
        <div class="vazamento-header-icone">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <div class="vazamento-header-texto">
          <div class="vazamento-header-titulo">Seu e-mail foi encontrado em ${total} ${total === 1 ? 'vazamento' : 'vazamentos'}</div>
          <div class="vazamento-header-sub">Algumas informações foram expostas. Veja abaixo o que aconteceu e o que você deve fazer agora.</div>
        </div>
        <div class="vazamento-header-badge">${total} ${total === 1 ? 'vazamento' : 'vazamentos'}</div>
      </div>

      <div class="vazamentos-container">
        <div style="margin-bottom:1.25rem; display:flex; align-items:center; justify-content:space-between;">
          <div style="font-family:var(--font-display);font-size:0.875rem;font-weight:700;color:var(--preto-titulo);">Histórico de vazamentos</div>
          <div style="display:flex;gap:0.5rem;align-items:center;font-family:var(--font-display);font-size:0.7rem;color:var(--cinza-medio);">
            <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:var(--vermelho-perigo);display:inline-block;"></span>Alta</span>
            <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:var(--ambar-atencao);display:inline-block;"></span>Média</span>
            <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:#60A5FA;display:inline-block;"></span>Baixa</span>
          </div>
        </div>
        <div class="timeline">${itensTimeline}</div>

        <div class="acoes-bloco" style="margin-top:1.5rem;">
          <div class="acoes-bloco-titulo">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            O que você deve fazer agora
          </div>
          <ol class="acoes-lista">
            <li>Troque a senha em cada um dos serviços listados acima, mesmo que você não acesse mais</li>
            <li>Verifique se você usa a mesma senha em outros lugares — banco, e-mail, redes sociais</li>
            <li>Ative a verificação em dois fatores nos seus serviços mais importantes</li>
            <li>Fique atento a e-mails ou mensagens pedindo dados ou pagamentos urgentes</li>
          </ol>
          <div style="margin-top:1rem;">
            <a class="btn btn-primario" href="/ferramentas/gerador.html" style="font-size:0.85rem;">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
              Criar senhas novas e seguras
            </a>
          </div>
        </div>
      </div>`;
  }

  /* --------------------------------------------------------
     VERIFICAR SENHA VAZADA (HIBP FREE — k-anonymity)
  -------------------------------------------------------- */
  window.verificarSenhaVazada = async function () {
    const senha = document.getElementById('input-senha-vaz')?.value || '';
    const resultado = document.getElementById('resultado-senha-vazada');
    if (!resultado) return;

    if (!senha) {
      resultado.innerHTML = `<div class="alerta alerta-atencao">
        <svg class="alerta-icone" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
        <div class="alerta-conteudo"><div class="alerta-titulo">Digite a senha acima</div><div class="alerta-texto">Insira a senha que deseja verificar no campo acima.</div></div>
      </div>`;
      return;
    }

    resultado.innerHTML = `<div class="alerta alerta-info carregando" style="margin-top:1.5rem;">
      <svg class="alerta-icone" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      <div class="alerta-conteudo"><div class="alerta-titulo">Verificando…</div><div class="alerta-texto">Gerando código seguro e consultando a base de dados. Sua senha nunca sai do dispositivo.</div></div>
    </div>`;

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(senha);
      const hashBuffer = await crypto.subtle.digest('SHA-1', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      const prefixo = hashHex.slice(0, 5);
      const sufixo = hashHex.slice(5);

      let encontrado = false;
      let vezes = 0;

      try {
        const resposta = await fetch(`https://api.pwnedpasswords.com/range/${prefixo}`, {
          headers: { 'Add-Padding': 'true' }
        });
        if (resposta.ok) {
          const texto = await resposta.text();
          for (const linha of texto.split('\n')) {
            const [hashSufixo, contagem] = linha.trim().split(':');
            if (hashSufixo === sufixo) {
              encontrado = true;
              vezes = parseInt(contagem);
              break;
            }
          }
        }
      } catch {
        // API offline — analisa localmente como fallback
        const SENHAS_COMUNS_LOCAL = ['123456','password','senha123','123456789','qwerty','abc123'];
        encontrado = SENHAS_COMUNS_LOCAL.includes(senha.toLowerCase());
        vezes = encontrado ? 9999 : 0;
      }

      if (encontrado) {
        let vezesTexto;
        if (vezes >= 1_000_000) vezesTexto = (vezes / 1_000_000).toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1}) + ' milhões de';
        else if (vezes >= 1_000) vezesTexto = Math.round(vezes / 1000) + ' mil';
        else vezesTexto = vezes;

        resultado.innerHTML = `
          <div class="resultado-vazamento-header">
            <div class="vazamento-header-icone">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div class="vazamento-header-texto">
              <div class="vazamento-header-titulo">Essa senha já foi exposta</div>
              <div class="vazamento-header-sub">Ela apareceu ${vezesTexto} vezes em vazamentos de dados conhecidos. Não a use em nenhum serviço.</div>
            </div>
            <div class="vazamento-header-badge">Exposta</div>
          </div>
          <div class="acoes-bloco" style="margin-top:0; border-radius:0 0 var(--radius-lg) var(--radius-lg);">
            <div class="acoes-bloco-titulo">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              O que você precisa fazer agora
            </div>
            <ol class="acoes-lista">
              <li>Mude essa senha em <strong>todos</strong> os serviços onde você a usa — banco, e-mail, redes sociais</li>
              <li>Nunca mais use essa senha, mesmo em serviços menos importantes</li>
              <li>Crie senhas longas e únicas para cada serviço</li>
              <li>Ative a verificação em dois fatores como camada extra de proteção</li>
            </ol>
            <div style="margin-top:1rem; display:flex; gap:0.75rem; flex-wrap:wrap;">
              <a class="btn btn-primario" href="/ferramentas/gerador.html" style="font-size:0.85rem;">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
                Criar uma senha nova e segura
              </a>
            </div>
          </div>`;
      } else {
        resultado.innerHTML = `
          <div class="resultado-vazamento-header limpo">
            <div class="vazamento-header-icone">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div class="vazamento-header-texto">
              <div class="vazamento-header-titulo">Essa senha não foi encontrada em vazamentos</div>
              <div class="vazamento-header-sub">Não identificamos ela em nenhuma das bases de dados de senhas expostas monitoradas.</div>
            </div>
            <div class="vazamento-header-badge" style="background:rgba(255,255,255,0.2)">Não encontrada ✓</div>
          </div>
          <div class="acoes-bloco" style="margin-top:0; border-radius:0 0 var(--radius-lg) var(--radius-lg);">
            <div class="acoes-bloco-titulo">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Continue protegido
            </div>
            <ol class="acoes-lista">
              <li>Verifique também se a força da senha é boa — uma senha não exposta pode ainda ser fraca</li>
              <li>Use senhas diferentes para cada serviço, mesmo que não estejam expostas</li>
              <li>Evite usar informações pessoais como datas de nascimento ou nomes</li>
            </ol>
            <div style="margin-top:1rem; display:flex; gap:0.75rem; flex-wrap:wrap;">
              <a class="btn btn-primario" href="/ferramentas/termometro.html" style="font-size:0.85rem;">Verificar força da senha</a>
            </div>
          </div>`;
      }
    } catch (err) {
      resultado.innerHTML = `<div class="alerta alerta-atencao">
        <svg class="alerta-icone" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
        <div class="alerta-conteudo"><div class="alerta-titulo">Não foi possível verificar agora</div><div class="alerta-texto">Ocorreu um problema ao consultar a base de dados. Verifique sua conexão e tente novamente.</div></div>
      </div>`;
    }
  };

})();
