/**
 * PROTETOR DIGITAL — breach.js
 * Verificador de vazamentos de e-mail via HIBP v3 (API paga)
 * A chamada real vai para /api/breach (Cloudflare Pages Function)
 * que mantém a chave de API segura no servidor.
 */

(function () {
  'use strict';

  const API_PATH = '/api/breach';

  // Traduções de tipos de dados expostos
  const TRADUCAO_DADOS = {
    'email addresses': 'Endereços de e-mail',
    'passwords': 'Senhas',
    'ip addresses': 'Endereços IP',
    'names': 'Nomes completos',
    'usernames': 'Nomes de usuário',
    'phone numbers': 'Números de telefone',
    'physical addresses': 'Endereços físicos',
    'geographic locations': 'Localização geográfica',
    'dates of birth': 'Datas de nascimento',
    'genders': 'Gênero',
    'social media profiles': 'Perfis de redes sociais',
    'website activity': 'Atividade em sites',
    'account balances': 'Saldo em conta',
    'credit cards': 'Cartões de crédito',
    'bank account numbers': 'Números de conta bancária',
    'credit card cvv': 'CVV de cartão',
    'personal health data': 'Dados de saúde',
    'historical passwords': 'Senhas antigas',
    'security questions and answers': 'Perguntas de segurança',
    'auth tokens': 'Tokens de autenticação',
    'device information': 'Informações de dispositivo',
    'browsing histories': 'Histórico de navegação',
    'purchases': 'Histórico de compras',
    'partial credit card data': 'Dados parciais de cartão',
    'social security numbers': 'CPF / Número previdenciário',
    'education levels': 'Nível de escolaridade',
    'sexual orientations': 'Orientação sexual',
    'employment statuses': 'Situação de emprego',
    'ethnicities': 'Etnia',
    'religions': 'Religião',
    'political views': 'Posições políticas',
    'income levels': 'Nível de renda',
    'ages': 'Faixas etárias',
    'avatar': 'Fotos de perfil',
  };

  function traduzirDado(dado) {
    return TRADUCAO_DADOS[dado.toLowerCase()] || dado;
  }

  function formatarContagem(n) {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace('.', ',')} bilhões`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace('.', ',')} milhões`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(0)} mil`;
    return n.toLocaleString('pt-BR');
  }

  function corSeveridade(s) {
    return s === 'high' ? 'var(--vermelho-perigo)' : s === 'medium' ? '#C97B00' : '#A16207';
  }

  function alertaSeveridade(s) {
    return s === 'high' ? 'alerta-perigo' : s === 'medium' ? 'alerta-atencao' : 'alerta-atencao';
  }

  function acaoRecomendada(severidade) {
    if (severidade === 'high')
      return 'Troque a senha <strong>imediatamente</strong> e monitore seu CPF no Serasa e Banco Central (Registrato).';
    if (severidade === 'medium')
      return 'Troque a senha deste serviço e de qualquer conta onde usou a mesma senha. Ative a verificação em duas etapas.';
    return 'Troque a senha por precaução e ative a verificação em duas etapas neste serviço.';
  }

  // ============================================================
  // RENDERIZAÇÃO
  // ============================================================

  function mostrarCarregando(container) {
    container.innerHTML = `
      <div class="card" style="display:flex;align-items:center;gap:1rem">
        <div style="width:40px;height:40px;border:3px solid var(--cinza-borda2);border-top-color:var(--azul-claro);border-radius:50%;animation:girar 0.7s linear infinite;flex-shrink:0"></div>
        <div>
          <p style="font-family:var(--font-display);font-weight:600;color:var(--preto-titulo);margin-bottom:0.25rem">Verificando...</p>
          <p style="font-size:0.82rem;color:var(--cinza-medio)">Consultando Have I Been Pwned — pode levar alguns segundos</p>
        </div>
      </div>
    `;
  }

  function mostrarResultadoLimpo(container, email, checkedAt) {
    container.innerHTML = `
      <div class="card animar-slide" style="border-color:var(--verde-borda);background:var(--verde-fundo)">
        <div style="display:flex;align-items:flex-start;gap:1rem">
          <div style="width:52px;height:52px;border-radius:var(--radius-md);background:rgba(26,122,74,0.15);display:flex;align-items:center;justify-content:center;font-size:1.75rem;flex-shrink:0">🎉</div>
          <div>
            <p style="font-family:var(--font-display);font-size:1.15rem;font-weight:800;color:var(--verde-seguro);margin-bottom:0.375rem">Boas notícias!</p>
            <p style="font-size:0.9rem;color:#14532D;line-height:1.55">
              O e-mail <strong>${email}</strong> não apareceu em nenhum vazamento de dados conhecido.
              Isso significa que suas informações não foram expostas nos incidentes catalogados pelo Have I Been Pwned.
            </p>
            <p style="font-family:var(--font-mono);font-size:0.7rem;color:var(--cinza-medio);margin-top:0.625rem">
              Verificado em ${checkedAt} · Fonte: Have I Been Pwned (HIBP)
            </p>
          </div>
        </div>
      </div>
      <div class="alerta alerta-info" style="margin-top:0">
        <span class="alerta-icone">💡</span>
        <div>
          <p class="alerta-titulo">Mantenha-se protegido</p>
          <p>Mesmo sem vazamentos registrados, use senhas fortes e únicas em cada site.
             Ative a verificação em duas etapas sempre que possível.</p>
        </div>
      </div>
    `;
  }

  function mostrarResultadoComVazamentos(container, resultado, email) {
    const breaches = resultado.breaches;
    const total = breaches.reduce((acc, b) => acc + (b.pwnCount || 0), 0);

    const listaVazamentos = breaches.map(b => `
      <div class="card" style="border-color:${corSeveridade(b.severity)}33;background:${b.severity === 'high' ? 'var(--vermelho-fundo)' : 'var(--ambar-fundo)'};margin-bottom:0.875rem;padding:1.25rem">
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;margin-bottom:0.875rem">
          <span style="font-family:var(--font-display);font-size:0.95rem;font-weight:700;color:var(--preto-titulo)">${b.title || b.name}</span>
          ${b.date ? `<span class="badge badge-cinza">${new Date(b.date).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' })}</span>` : ''}
          ${b.pwnCount ? `<span class="badge" style="background:${corSeveridade(b.severity)}15;color:${corSeveridade(b.severity)};border-color:${corSeveridade(b.severity)}33">${formatarContagem(b.pwnCount)} registros</span>` : ''}
          ${b.isVerified ? `<span class="badge badge-azul">✓ Verificado</span>` : ''}
        </div>

        ${b.exposedData?.length > 0 ? `
        <div style="margin-bottom:0.875rem">
          <p class="campo-label" style="margin-bottom:0.375rem">Dados expostos neste vazamento</p>
          <div style="display:flex;flex-wrap:wrap;gap:0.375rem">
            ${b.exposedData.map(d => `<span class="badge badge-cinza">${traduzirDado(d)}</span>`).join('')}
          </div>
        </div>
        ` : ''}

        ${b.description ? `
        <p style="font-size:0.85rem;color:var(--cinza-escuro);line-height:1.6;margin-bottom:0.875rem">${b.description}</p>
        ` : ''}

        <div style="padding:0.75rem 1rem;border-radius:var(--radius-sm);background:white;border:1px solid var(--cinza-borda)">
          <p class="campo-label" style="margin-bottom:0.25rem">O que fazer agora</p>
          <p style="font-size:0.85rem;color:var(--cinza-escuro)">${acaoRecomendada(b.severity)}</p>
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <!-- Resumo -->
      <div class="card animar-slide" style="border-color:var(--vermelho-borda);background:var(--vermelho-fundo);margin-bottom:0.875rem">
        <div style="display:flex;align-items:flex-start;gap:1rem">
          <div style="width:52px;height:52px;border-radius:var(--radius-md);background:rgba(185,28,28,0.15);display:flex;align-items:center;justify-content:center;font-size:1.75rem;flex-shrink:0">🚨</div>
          <div>
            <p style="font-family:var(--font-display);font-size:1.125rem;font-weight:800;color:var(--vermelho-perigo);margin-bottom:0.375rem">
              ${breaches.length} vazamento${breaches.length > 1 ? 's' : ''} encontrado${breaches.length > 1 ? 's' : ''}
            </p>
            <p style="font-size:0.9rem;color:#7F1D1D;line-height:1.55">
              Seu e-mail <strong>${email}</strong> foi exposto em incidentes de segurança.
              ${total > 0 ? `Total estimado: <strong>${formatarContagem(total)} registros</strong> comprometidos.` : ''}
            </p>
          </div>
        </div>
      </div>

      <!-- Lista de vazamentos -->
      ${listaVazamentos}

      <!-- Direitos LGPD -->
      <div class="card" style="border-color:#BFDBFE;background:var(--azul-suave)">
        <p style="font-family:var(--font-display);font-size:0.875rem;font-weight:700;color:var(--azul-soberano);margin-bottom:0.875rem">⚖️ Seus direitos pela LGPD</p>
        <div style="display:flex;flex-direction:column;gap:0.375rem">
          ${[
            'Solicite a exclusão dos seus dados junto às empresas afetadas',
            'Registre uma reclamação na ANPD: gov.br/anpd/reclamacoes',
            'Se houver dano comprovado, você pode buscar indenização na Justiça',
            'Ative a verificação em duas etapas em todas as contas agora',
          ].map(r => `
            <p style="font-size:0.85rem;color:var(--azul-soberano);display:flex;align-items:flex-start;gap:0.5rem;line-height:1.45">
              <span style="color:var(--azul-claro);flex-shrink:0">→</span>${r}
            </p>
          `).join('')}
        </div>
      </div>

      <!-- Checklist -->
      <div class="card">
        <p style="font-family:var(--font-display);font-size:0.875rem;font-weight:700;color:var(--preto-titulo);margin-bottom:1rem">✅ Checklist de ações imediatas</p>
        <ul class="checklist">
          ${[
            'Trocar a senha do serviço afetado',
            'Trocar a senha em qualquer outro site onde usou a mesma',
            'Ativar verificação em duas etapas (2FA)',
            'Verificar atividade suspeita nas contas afetadas',
            'Monitorar seu CPF no Registrato (Banco Central)',
            'Registrar um alerta de crédito no Serasa ou SPC',
          ].map(a => `
            <li class="checklist-item">
              <input type="checkbox" id="chk-${Math.random().toString(36).slice(2,7)}">
              <span>${a}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  function mostrarErro(container, mensagem) {
    container.innerHTML = `
      <div class="alerta alerta-atencao">
        <span class="alerta-icone">⚠️</span>
        <div>
          <p class="alerta-titulo">Não foi possível verificar</p>
          <p>${mensagem || 'Ocorreu um erro inesperado. Tente novamente em instantes.'}</p>
        </div>
      </div>
    `;
  }

  // ============================================================
  // LÓGICA PRINCIPAL
  // ============================================================
  async function verificarVazamento(email) {
    const container = document.getElementById('container-resultado-vazamento');
    if (!container) return;

    mostrarCarregando(container);

    try {
      const res = await fetch(API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (res.status === 429) {
        mostrarErro(container, 'Muitas consultas seguidas. Aguarde alguns minutos e tente novamente.');
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        mostrarErro(container, data.error || `Erro ${res.status} ao consultar o servidor.`);
        return;
      }

      const resultado = await res.json();
      const checkedAt = new Date().toLocaleString('pt-BR');

      if (!resultado.breaches || resultado.breaches.length === 0) {
        mostrarResultadoLimpo(container, email, checkedAt);
      } else {
        mostrarResultadoComVazamentos(container, resultado, email);
      }

    } catch (err) {
      mostrarErro(container, 'Erro de conexão. Verifique sua internet e tente novamente.');
    }
  }

  // ============================================================
  // INICIALIZAÇÃO DA PÁGINA
  // ============================================================
  function inicializarPaginaVazamento() {
    const inputEmail = document.getElementById('input-email');
    const btnVerificar = document.getElementById('btn-verificar-vazamento');
    const msgErro = document.getElementById('erro-email');

    if (!inputEmail || !btnVerificar) return;

    function isEmailValido(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function mostrarErroEmail(msg) {
      if (msgErro) {
        msgErro.textContent = msg;
        msgErro.classList.remove('hidden');
      }
    }

    function limparErroEmail() {
      if (msgErro) msgErro.classList.add('hidden');
    }

    async function executarVerificacao() {
      const email = inputEmail.value.trim();

      if (!email) {
        mostrarErroEmail('Digite seu e-mail para verificar.');
        return;
      }

      if (!isEmailValido(email)) {
        mostrarErroEmail('E-mail inválido. Digite um endereço completo como: nome@exemplo.com');
        return;
      }

      limparErroEmail();
      btnVerificar.disabled = true;
      btnVerificar.innerHTML = `<span class="btn-spinner"></span> Verificando...`;

      await verificarVazamento(email);

      btnVerificar.disabled = false;
      btnVerificar.innerHTML = `🔍 Verificar`;

      // Scroll para resultado
      document.getElementById('container-resultado-vazamento')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    btnVerificar.addEventListener('click', executarVerificacao);

    inputEmail.addEventListener('keydown', e => {
      if (e.key === 'Enter') executarVerificacao();
    });

    inputEmail.addEventListener('input', limparErroEmail);
  }

  document.addEventListener('layoutPronto', inicializarPaginaVazamento);
  if (document.readyState !== 'loading') inicializarPaginaVazamento();
  else document.addEventListener('DOMContentLoaded', inicializarPaginaVazamento);

})();
