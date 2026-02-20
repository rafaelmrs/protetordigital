/**
 * PROTETOR DIGITAL — password.js
 * Análise de força de senhas (OWASP) + HIBP Pwned Passwords (k-anonymity)
 * Gerador de senhas criptograficamente seguro
 *
 * A senha NUNCA sai do dispositivo do usuário.
 * Apenas os 5 primeiros caracteres do hash SHA-1 vão à API HIBP.
 */

(function () {
  'use strict';

  // ============================================================
  // ANÁLISE DE FORÇA (baseada em OWASP)
  // ============================================================
  const PADROES_COMUNS = [
    '123456', 'password', 'senha', '111111', 'qwerty', 'abc123',
    '123456789', 'letmein', 'monkey', '123123', 'admin', 'iloveyou',
    'welcome', 'senha123', '12345678', 'senha1234'
  ];

  function analisarSenha(senha) {
    if (!senha) return null;

    const len = senha.length;
    let pontos = 0;

    // Comprimento
    if (len >= 8) pontos += 1;
    if (len >= 12) pontos += 1;
    if (len >= 16) pontos += 1;
    if (len >= 20) pontos += 1;

    // Variedade de caracteres
    const temMinuscula = /[a-z]/.test(senha);
    const temMaiuscula = /[A-Z]/.test(senha);
    const temNumero = /\d/.test(senha);
    const temEspecial = /[^a-zA-Z0-9]/.test(senha);

    if (temMinuscula) pontos += 0.5;
    if (temMaiuscula) pontos += 0.5;
    if (temNumero) pontos += 0.5;
    if (temEspecial) pontos += 1;

    const feedback = [];
    const sugestoes = [];

    // Padrões comuns
    if (PADROES_COMUNS.some(p => senha.toLowerCase().includes(p))) {
      pontos = Math.max(0, pontos - 3);
      feedback.push({ tipo: 'erro', texto: 'Contém uma sequência muito comum e fácil de adivinhar' });
    }

    // Repetição
    if (/(.)\1{2,}/.test(senha)) {
      pontos = Math.max(0, pontos - 1);
      feedback.push({ tipo: 'aviso', texto: 'Evite repetir o mesmo caractere várias vezes seguidas' });
    }

    // OWASP mínimo
    const passaOwasp = len >= 8 && temMinuscula && temMaiuscula && temNumero && temEspecial;
    if (passaOwasp) {
      feedback.push({ tipo: 'ok', texto: 'Atende aos requisitos mínimos de segurança (OWASP)' });
    }

    // Sugestões de melhoria
    if (!temMaiuscula) sugestoes.push('Adicione letras maiúsculas (A-Z)');
    if (!temMinuscula) sugestoes.push('Adicione letras minúsculas (a-z)');
    if (!temNumero) sugestoes.push('Adicione números (0-9)');
    if (!temEspecial) sugestoes.push('Adicione símbolos como !@#$%');
    if (len < 12) sugestoes.push(`Use pelo menos 12 caracteres — sua senha tem apenas ${len}`);

    // Cálculo de entropia
    const charset = (temMinuscula ? 26 : 0) + (temMaiuscula ? 26 : 0) +
                    (temNumero ? 10 : 0) + (temEspecial ? 32 : 0);
    const combinacoes = Math.pow(Math.max(charset, 26), len);
    const entropia = Math.log2(combinacoes);

    // Tempo estimado de quebra (10 bilhões de tentativas/segundo)
    const segundos = combinacoes / 1e10;
    const tempoQuebra = formatarTempo(segundos);

    const score = Math.min(4, Math.floor(pontos));
    const cores = ['#B91C1C', '#C97B00', '#A16207', '#15803D', '#1A7A4A'];
    const rotulos = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Excelente'];
    const iconesStatus = ['🔴', '🟠', '🟡', '🟢', '🟢'];

    return {
      score,
      rotulo: rotulos[score],
      cor: cores[score],
      ícone: iconesStatus[score],
      tempoQuebra,
      entropia: Math.round(entropia),
      passaOwasp,
      feedback,
      sugestoes,
    };
  }

  function formatarTempo(segundos) {
    if (segundos < 1) return 'Instantâneo';
    if (segundos < 60) return `${Math.round(segundos)} segundo${Math.round(segundos) !== 1 ? 's' : ''}`;
    if (segundos < 3600) return `${Math.round(segundos / 60)} minuto${Math.round(segundos / 60) !== 1 ? 's' : ''}`;
    if (segundos < 86400) return `${Math.round(segundos / 3600)} hora${Math.round(segundos / 3600) !== 1 ? 's' : ''}`;
    if (segundos < 2592000) return `${Math.round(segundos / 86400)} dia${Math.round(segundos / 86400) !== 1 ? 's' : ''}`;
    if (segundos < 31536000) return `${Math.round(segundos / 2592000)} mê${Math.round(segundos / 2592000) !== 1 ? 'ses' : 's'}`;
    if (segundos < 3153600000) return `${Math.round(segundos / 31536000)} ano${Math.round(segundos / 31536000) !== 1 ? 's' : ''}`;
    return 'Mais de 100 anos';
  }

  // ============================================================
  // HIBP PWNED PASSWORDS (k-anonymity)
  // Só os 5 primeiros chars do hash SHA-1 saem do dispositivo
  // ============================================================
  async function verificarSenhaVazada(senha) {
    if (!senha || senha.length < 4) return null;

    try {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-1', encoder.encode(senha));
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

      const prefixo = hashHex.slice(0, 5);
      const sufixo = hashHex.slice(5);

      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefixo}`, {
        headers: { 'Add-Padding': 'true' },
      });

      if (!res.ok) return null;

      const texto = await res.text();
      for (const linha of texto.split('\n')) {
        const [s, count] = linha.trim().split(':');
        if (s === sufixo) return parseInt(count, 10);
      }
      return 0;
    } catch {
      return null; // Falha silenciosa — a análise local continua
    }
  }

  // ============================================================
  // GERADOR DE SENHAS SEGURO
  // ============================================================
  function gerarSenha(comprimento = 16, opcoes = {}) {
    const {
      maiusculas = true,
      minusculas = true,
      numeros = true,
      simbolos = true,
    } = opcoes;

    let chars = '';
    const sets = [];

    if (minusculas) { chars += 'abcdefghijklmnopqrstuvwxyz'; sets.push('abcdefghijklmnopqrstuvwxyz'); }
    if (maiusculas) { chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; sets.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ'); }
    if (numeros) { chars += '0123456789'; sets.push('0123456789'); }
    if (simbolos) { chars += '!@#$%^&*()_+-=[]{}|;:,.<>?'; sets.push('!@#$%^&*()_+-=[]{}'); }

    if (!chars) return '';

    // Garantir pelo menos um caractere de cada set selecionado
    const arr = new Uint32Array(comprimento + sets.length);
    crypto.getRandomValues(arr);

    const base = Array.from(arr.slice(0, comprimento), x => chars[x % chars.length]);

    // Forçar inclusão de cada tipo
    sets.forEach((set, i) => {
      const pos = arr[comprimento + i] % comprimento;
      base[pos] = set[arr[i] % set.length];
    });

    // Embaralhar
    for (let i = base.length - 1; i > 0; i--) {
      const j = arr[i] % (i + 1);
      [base[i], base[j]] = [base[j], base[i]];
    }

    return base.join('');
  }

  // ============================================================
  // INTERFACE — VERIFICADOR DE SENHA
  // ============================================================
  let timerHIBP = null;

  function renderizarAnalise(resultado, containerId) {
    const container = document.getElementById(containerId);
    if (!container || !resultado) return;

    const larguraBarra = `${(resultado.score + 1) * 20}%`;
    const coresBarraSemana = {
      0: 'var(--vermelho-perigo)',
      1: '#C97B00',
      2: '#A16207',
      3: 'var(--verde-seguro)',
      4: 'var(--verde-seguro)',
    };

    container.innerHTML = `
      <div class="animar-slide">
        <!-- Barra de força -->
        <div style="margin-bottom:1.25rem">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
            <label class="campo-label" style="margin:0">Força da senha</label>
            <span style="font-family:var(--font-display);font-size:0.875rem;font-weight:700;color:${resultado.cor}">
              ${resultado.ícone} ${resultado.rotulo}
            </span>
          </div>
          <div class="barra-wrapper">
            <div class="barra-progresso" style="width:${larguraBarra};background:${resultado.cor}"></div>
          </div>
        </div>

        <!-- Stats -->
        <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:1rem">
          <div class="stat-card" style="text-align:center">
            <div class="stat-label">Tempo para quebrar</div>
            <div class="stat-valor" style="font-size:0.9rem">${resultado.tempoQuebra}</div>
          </div>
          <div class="stat-card" style="text-align:center">
            <div class="stat-label">Entropia</div>
            <div class="stat-valor" style="font-size:0.9rem">${resultado.entropia} bits</div>
          </div>
          <div class="stat-card" style="text-align:center">
            <div class="stat-label">OWASP</div>
            <div class="stat-valor" style="font-size:0.9rem">${resultado.passaOwasp ? '✓ OK' : '✗ Não'}</div>
          </div>
        </div>

        <!-- HIBP Status -->
        <div id="hibp-status" style="display:flex;align-items:center;gap:0.875rem;padding:0.875rem 1rem;border-radius:var(--radius-md);background:var(--cinza-papel);border:1px solid var(--cinza-borda);margin-bottom:1rem">
          <span style="font-size:1.25rem">🔍</span>
          <div style="flex:1">
            <div style="font-family:var(--font-display);font-size:0.7rem;font-weight:600;color:var(--cinza-medio);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.2rem">Verificando em banco de dados de senhas vazadas...</div>
            <div style="font-size:0.82rem;color:var(--cinza-medio)">Consultando Have I Been Pwned via anonimato k-anon</div>
          </div>
          <div class="btn-spinner" style="border-color:rgba(0,0,0,0.15);border-top-color:var(--azul-claro)"></div>
        </div>

        <!-- Feedback -->
        ${resultado.feedback.length > 0 ? `
        <div style="display:flex;flex-direction:column;gap:0.375rem;margin-bottom:1rem">
          ${resultado.feedback.map(f => `
            <div class="alerta ${f.tipo === 'erro' ? 'alerta-perigo' : f.tipo === 'aviso' ? 'alerta-atencao' : 'alerta-seguro'}" style="padding:0.625rem 0.875rem">
              <span class="alerta-icone">${f.tipo === 'erro' ? '✗' : f.tipo === 'aviso' ? '⚠' : '✓'}</span>
              <span>${f.texto}</span>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <!-- Sugestões -->
        ${resultado.sugestoes.length > 0 ? `
        <div>
          <p class="campo-label">Como melhorar</p>
          <div style="display:flex;flex-direction:column;gap:0.3rem;margin-top:0.5rem">
            ${resultado.sugestoes.map(s => `
              <p style="font-size:0.85rem;color:var(--cinza-medio);display:flex;align-items:flex-start;gap:0.5rem;line-height:1.4">
                <span style="color:var(--azul-claro);flex-shrink:0;margin-top:1px">→</span>${s}
              </p>
            `).join('')}
          </div>
        </div>
        ` : ''}
      </div>
    `;
  }

  function atualizarHIBP(contagem) {
    const container = document.getElementById('hibp-status');
    if (!container) return;

    if (contagem === null) {
      // Falha na verificação
      container.innerHTML = `
        <span style="font-size:1.25rem">⚠️</span>
        <div>
          <div style="font-family:var(--font-display);font-size:0.7rem;font-weight:600;color:var(--cinza-medio);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.2rem">Verificação de vazamentos</div>
          <div style="font-size:0.82rem;color:var(--cinza-medio)">Não foi possível verificar agora. Tente novamente em instantes.</div>
        </div>
      `;
      container.style.background = 'var(--cinza-papel)';
      return;
    }

    const seguro = contagem === 0;

    container.style.background = seguro ? 'var(--verde-fundo)' : 'var(--vermelho-fundo)';
    container.style.borderColor = seguro ? 'var(--verde-borda)' : 'var(--vermelho-borda)';

    container.innerHTML = `
      <span style="font-size:1.5rem">${seguro ? '🎉' : '🚨'}</span>
      <div style="flex:1">
        <div style="font-family:var(--font-display);font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.2rem;color:${seguro ? 'var(--verde-seguro)' : 'var(--vermelho-perigo)'}">
          Verificação em banco de vazamentos — HIBP
        </div>
        ${seguro
          ? `<div style="font-size:0.875rem;color:var(--verde-seguro);font-weight:600">Esta senha não foi encontrada em nenhum vazamento conhecido.</div>`
          : `<div style="font-size:0.875rem;color:var(--vermelho-perigo);font-weight:700">Esta senha apareceu ${contagem.toLocaleString('pt-BR')} vezes em vazamentos!</div>
             <div style="font-size:0.8rem;color:var(--cinza-medio);margin-top:0.2rem">Não use esta senha. Escolha outra imediatamente.</div>`
        }
      </div>
      <span style="font-family:var(--font-mono);font-size:0.6rem;color:var(--cinza-medio);text-align:right;line-height:1.4">via HIBP<br>k-anon</span>
    `;
  }

  // ============================================================
  // INICIALIZAÇÃO DA PÁGINA DE SENHA
  // ============================================================
  function inicializarPaginaSenha() {
    const inputSenha = document.getElementById('input-senha');
    const containerAnalise = document.getElementById('container-analise');
    const btnMostrar = document.getElementById('btn-mostrar-senha');
    const btnGerar = document.getElementById('btn-gerar');
    const resultadoGerador = document.getElementById('resultado-gerador');
    const btnCopiar = document.getElementById('btn-copiar');
    const sliderComprimento = document.getElementById('slider-comprimento');
    const labelComprimento = document.getElementById('label-comprimento');

    if (!inputSenha) return; // Não está na página de senha

    // Toggle mostrar/ocultar
    if (btnMostrar) {
      btnMostrar.addEventListener('click', () => {
        const mostrar = inputSenha.type === 'password';
        inputSenha.type = mostrar ? 'text' : 'password';
        btnMostrar.textContent = mostrar ? 'ocultar' : 'mostrar';
      });
    }

    // Análise em tempo real com debounce
    inputSenha.addEventListener('input', () => {
      const senha = inputSenha.value;

      if (!senha) {
        if (containerAnalise) containerAnalise.innerHTML = '';
        return;
      }

      const resultado = analisarSenha(senha);
      renderizarAnalise(resultado, 'container-analise');

      // HIBP com debounce de 800ms
      clearTimeout(timerHIBP);
      timerHIBP = setTimeout(async () => {
        const contagem = await verificarSenhaVazada(senha);
        atualizarHIBP(contagem);
      }, 800);
    });

    // Slider de comprimento
    if (sliderComprimento && labelComprimento) {
      sliderComprimento.addEventListener('input', () => {
        labelComprimento.textContent = `${sliderComprimento.value} caracteres`;
      });
    }

    // Gerador
    if (btnGerar) {
      btnGerar.addEventListener('click', () => {
        const comprimento = parseInt(sliderComprimento?.value || '16');
        const opcoes = {
          maiusculas: document.getElementById('opt-maiusculas')?.checked ?? true,
          minusculas: document.getElementById('opt-minusculas')?.checked ?? true,
          numeros: document.getElementById('opt-numeros')?.checked ?? true,
          simbolos: document.getElementById('opt-simbolos')?.checked ?? true,
        };

        const senha = gerarSenha(comprimento, opcoes);
        const textoEl = document.getElementById('senha-gerada-texto');

        if (textoEl) {
          textoEl.textContent = senha;
          if (resultadoGerador) resultadoGerador.classList.remove('hidden');
        }
      });
    }

    // Copiar senha gerada
    if (btnCopiar) {
      btnCopiar.addEventListener('click', async () => {
        const texto = document.getElementById('senha-gerada-texto')?.textContent;
        if (!texto) return;

        try {
          await navigator.clipboard.writeText(texto);
          btnCopiar.textContent = '✓ Copiado!';
          btnCopiar.style.color = 'var(--verde-seguro)';
          btnCopiar.style.borderColor = 'var(--verde-borda)';
          setTimeout(() => {
            btnCopiar.textContent = 'Copiar';
            btnCopiar.style.color = '';
            btnCopiar.style.borderColor = '';
          }, 2500);
        } catch {
          // Fallback para browsers sem clipboard API
          const tmp = document.createElement('textarea');
          tmp.value = texto;
          document.body.appendChild(tmp);
          tmp.select();
          document.execCommand('copy');
          document.body.removeChild(tmp);
          btnCopiar.textContent = '✓ Copiado!';
          setTimeout(() => { btnCopiar.textContent = 'Copiar'; }, 2500);
        }
      });
    }
  }

  // Aguarda o layout estar pronto antes de inicializar
  document.addEventListener('layoutPronto', inicializarPaginaSenha);
  // Fallback se app.js não estiver presente
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarPaginaSenha);
  } else {
    inicializarPaginaSenha();
  }

})();
