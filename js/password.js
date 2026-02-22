/**
 * Protetor Digital — password.js
 * Lógica de verificação de força de senha e geração de senhas
 * A análise de força é feita 100% no navegador (sem APIs externas)
 */

(function () {
  'use strict';

  const SENHAS_COMUNS = [
    '123456','password','senha123','123456789','qwerty','abc123','iloveyou',
    'admin','letmein','monkey','master','sunshine','123123','12345','1234567',
    'password1','welcome','dragon','pass','senhasegura','senha','admin123',
    '1234','teste','qwerty123','1q2w3e4r','brasil','1234567890','abc1234',
    '111111','123321','654321','112233','aaaaaa','mudar123','@senha123'
  ];

  /* --------------------------------------------------------
     CÁLCULO DE FORÇA (OWASP-inspired)
  -------------------------------------------------------- */
  window.calcularForca = function (senha) {
    if (!senha) return { score: -1 };
    const temMaiuscula = /[A-Z]/.test(senha);
    const temMinuscula = /[a-z]/.test(senha);
    const temNumero    = /[0-9]/.test(senha);
    const temEspecial  = /[^A-Za-z0-9]/.test(senha);
    const tamanhoMin   = senha.length >= 8;
    const tamanhoOk    = senha.length >= 12;  // 12+ = critério OWASP para nível máximo
    const eComum       = SENHAS_COMUNS.includes(senha.toLowerCase());

    if (eComum) {
      return { score: 0, label: 'Senha muito conhecida', dica: 'Essa senha está em listas de hackers',
               temMaiuscula, temMinuscula, temNumero, temEspecial, tamanhoOk, eComum: true };
    }

    // Pontuação: máximo 4 pontos
    // Regra: 12+ caracteres é OBRIGATÓRIO para chegar ao nível 4.
    // Com menos de 12 chars, o teto é 3 — independentemente da variedade de caracteres.
    let score = 0;
    if (tamanhoMin)  score++;                           // >= 8 chars
    if (tamanhoOk)   score++;                           // >= 12 chars (substitui o +1 de tamanhoMin)
    if (temMaiuscula && temMinuscula) score++;
    if (temNumero)   score++;
    if (temEspecial) score++;

    // Teto: sem 12+ chars, máximo é 3/4
    const teto = tamanhoOk ? 4 : 3;
    const idx  = Math.min(score, teto);

    const labels = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Excelente'];
    const dicas  = [
      'Adicione letras, números e símbolos',
      'Tente aumentar o comprimento para pelo menos 12 caracteres',
      'Adicione símbolos ou mais caracteres',
      'Quase lá — adicione um símbolo especial ou aumente para 12+ caracteres',
      'Parabéns! Essa senha é muito difícil de quebrar'
    ];
    return { score: idx, label: labels[idx], dica: dicas[idx],
             temMaiuscula, temMinuscula, temNumero, temEspecial, tamanhoOk, eComum: false };
  };


  /* --------------------------------------------------------
     CALCULAR TEMPO PARA QUEBRAR SENHA (linguagem simples)
  -------------------------------------------------------- */
  window.calcularTempo = function(senha) {
    if (!senha) return null;

    const len = senha.length;
    const temMaiuscula = /[A-Z]/.test(senha);
    const temMinuscula = /[a-z]/.test(senha);
    const temNumero    = /[0-9]/.test(senha);
    const temEspecial  = /[^A-Za-z0-9]/.test(senha);

    // Tamanho do alfabeto usado
    let alfabeto = 0;
    if (temMinuscula) alfabeto += 26;
    if (temMaiuscula) alfabeto += 26;
    if (temNumero)    alfabeto += 10;
    if (temEspecial)  alfabeto += 32;
    if (alfabeto === 0) alfabeto = 10;

    // Entropia em bits: log2(alfabeto^comprimento)
    const bits = len * Math.log2(alfabeto);

    // Velocidade de ataque: usamos bcrypt cost=10 como referência
    // pois é o algoritmo mais comum em serviços bem configurados.
    // MD5 (pior caso real): ~164 bilhões/s — bcrypt cost=10: ~10.000/s
    // Usamos 1 bilhão/s: conservador mas representativo de hashes rápidos (SHA-256)
    // e mostramos o contexto ao usuário.
    const tentativas = Math.pow(alfabeto, len);
    const porSegundo = 1e9; // 1 bilhão/s — SHA-256 típico
    const segundos   = tentativas / porSegundo;

    function formatar(s) {
      if (s < 1)          return { texto: 'menos de 1 segundo',  nivel: 'critico' };
      if (s < 60)         return { texto: Math.round(s) + ' segundos', nivel: 'critico' };
      if (s < 3600)       return { texto: Math.round(s/60) + ' minutos', nivel: 'ruim' };
      if (s < 86400)      return { texto: Math.round(s/3600) + ' horas', nivel: 'ruim' };
      if (s < 2592000)    return { texto: Math.round(s/86400) + ' dias', nivel: 'medio' };
      if (s < 31536000)   return { texto: Math.round(s/2592000) + ' meses', nivel: 'medio' };
      if (s < 3.15e9)     return { texto: Math.round(s/31536000).toLocaleString('pt-BR') + ' anos', nivel: 'bom' };
      return { texto: 'mais de ' + Math.round(s/31536000).toLocaleString('pt-BR') + ' anos', nivel: 'otimo' };
    }

    const r = formatar(segundos);
    r.bits = Math.round(bits);
    return r;
  };

  /* --------------------------------------------------------
     ATUALIZA ÍCONE DE DICA
  -------------------------------------------------------- */
  function atualizarDicaItem(id, ok) {
    const el = document.getElementById(id);
    if (!el) return;
    const icone = el.querySelector('.dica-item-icone');
    if (!icone) return;
    if (ok) {
      icone.classList.remove('dica-nao'); icone.classList.add('dica-ok');
      icone.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
    } else {
      icone.classList.remove('dica-ok'); icone.classList.add('dica-nao');
      icone.innerHTML = '<circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>';
    }
  }

  /* --------------------------------------------------------
     ANALISAR SENHA (bind ao input em verificador.html)
  -------------------------------------------------------- */
  window.analisarSenha = function (senha) {
    const container = document.getElementById('forca-container');
    const barra = document.getElementById('forca-barra');
    const labelEl = document.getElementById('forca-label');
    const dicaEl = document.getElementById('forca-dica');
    const resultado = document.getElementById('resultado-senha');
    if (!container) return;

    if (!senha) {
      container.style.display = 'none';
      if (resultado) resultado.innerHTML = '';
      const tempoVazio = document.getElementById('tempo-quebrar');
      if (tempoVazio) tempoVazio.style.display = 'none';
      ['dica-tamanho','dica-maiuscula','dica-minuscula','dica-numero','dica-especial','dica-comum'].forEach(id => atualizarDicaItem(id, false));
      return;
    }

    const r = calcularForca(senha);
    container.style.display = 'block';
    barra.className = 'forca-barra-wrapper forca-' + r.score;
    labelEl.textContent = r.label;
    dicaEl.textContent = r.dica;
    container.className = 'forca-container forca-' + r.score;

    atualizarDicaItem('dica-tamanho', r.tamanhoOk);
    atualizarDicaItem('dica-maiuscula', r.temMaiuscula);
    atualizarDicaItem('dica-minuscula', r.temMinuscula);
    atualizarDicaItem('dica-numero', r.temNumero);
    atualizarDicaItem('dica-especial', r.temEspecial);
    atualizarDicaItem('dica-comum', !r.eComum);

    // Calculadora de tempo
    const tempoEl = document.getElementById('tempo-quebrar');
    if (tempoEl) {
      const t = calcularTempo(senha);
      if (t) {
        const cores = {
          critico: 'var(--vermelho-perigo)',
          ruim:    'var(--ambar-atencao)',
          medio:   '#2E9E65',
          bom:     'var(--verde-seguro)',
          otimo:   'var(--verde-seguro)'
        };
        const emojis = { critico: '⚡', ruim: '⏱', medio: '🕐', bom: '🛡️', otimo: '🔒' };
        const nivelTexto = {
          critico: 'Vulnerável',
          ruim:    'Fraca',
          medio:   'Razoável',
          bom:     'Resistente',
          otimo:   'Muito segura'
        };
        tempoEl.style.display = 'block';
        tempoEl.innerHTML = `
          <div style="background:var(--superficie);border:1px solid var(--borda);border-radius:var(--radius-lg);padding:1rem 1.25rem;">
            <div style="display:flex;align-items:center;gap:0.75rem;">
              <span style="font-size:1.5rem;" aria-hidden="true">${emojis[t.nivel]}</span>
              <div style="flex:1;">
                <div style="font-family:var(--font-display);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--cinza-medio);margin-bottom:0.2rem;">Resistência a ataque de força bruta</div>
                <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;color:${cores[t.nivel]};">${t.texto}</div>
              </div>
              ${t.bits ? `<div style="text-align:right;"><div style="font-family:var(--font-display);font-size:0.65rem;color:var(--cinza-medio);text-transform:uppercase;letter-spacing:0.04em;">Entropia</div><div style="font-family:var(--font-display);font-size:1rem;font-weight:700;color:var(--cinza-escuro);">${t.bits} bits</div></div>` : ''}
            </div>
          </div>`;
      } else {
        tempoEl.style.display = 'none';
      }
    }

    if (!resultado) return;

    const nivel = r.score;
    const nivelClass = 'nivel-' + nivel;

    if (r.eComum) {
      resultado.innerHTML = `
        <div class="senha-score-painel">
          <div class="senha-score-topo nivel-0">
            <div class="senha-score-circulo nivel-0">
              <span class="senha-score-numero">0</span><span class="senha-score-max">/4</span>
            </div>
            <div class="senha-score-info">
              <div class="senha-score-titulo" style="color:var(--vermelho-perigo)">Senha extremamente conhecida</div>
              <div class="senha-score-subtitulo">Está nos primeiros lugares das listas de senhas mais usadas</div>
            </div>
          </div>
          <div class="senha-score-corpo">
            <div class="senha-score-dica-box">
              ⚠️ Criminosos testam essas senhas <strong>primeiro</strong> em qualquer ataque. Se você a usa em algum serviço, troque agora mesmo.
            </div>
            <div class="alerta-acoes" style="margin-top:1rem;">
              <a class="btn btn-primario" href="/ferramentas/gerador.html" style="font-size:0.85rem;">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
                Criar senha forte agora
              </a>
            </div>
          </div>
        </div>`;
      return;
    }

    const dicas_por_nivel = [
      'Adicione letras maiúsculas, minúsculas, números e símbolos. Evite sequências óbvias como "12345" ou "abcd".',
      'Aumente o comprimento para pelo menos 12 caracteres e adicione uma mistura de tipos de caracteres.',
      'Adicione símbolos como !, @, # ou % para fortalecer ainda mais. Tente chegar a 14 caracteres ou mais.',
      'Quase lá! Aumente para 12 ou mais caracteres para atingir o nível máximo (recomendação OWASP).',
      'Comprimento e variedade ideais. Lembre-se: use senhas diferentes para cada serviço.'
    ];
    const cores = ['var(--vermelho-perigo)','var(--vermelho-perigo)','var(--ambar-atencao)','#2E9E65','var(--verde-seguro)'];
    const titulos_nivel = ['Senha muito fraca','Senha fraca','Senha razoável','Boa senha','Senha excelente!'];
    const subs_nivel = [
      'Pode ser descoberta em menos de um segundo',
      'Pode ser quebrada rapidamente com ferramentas simples',
      'Tem alguma proteção, mas dá para melhorar',
      'Boa senha — aumente para 12+ caracteres para chegar ao nível máximo',
      'Comprimento e variedade ideais — difícil de quebrar'
    ];

    const acaoBotao = nivel <= 2 ? `
      <div class="alerta-acoes" style="margin-top:1rem;">
        <a class="btn btn-primario" href="/ferramentas/gerador.html" style="font-size:0.85rem;">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
          Criar senha forte
        </a>
      </div>` : '';

    resultado.innerHTML = `
      <div class="senha-score-painel">
        <div class="senha-score-topo ${nivelClass}">
          <div class="senha-score-circulo ${nivelClass}">
            <span class="senha-score-numero">${nivel}</span><span class="senha-score-max">/4</span>
          </div>
          <div class="senha-score-info">
            <div class="senha-score-titulo" style="color:${cores[nivel]}">${titulos_nivel[nivel]}</div>
            <div class="senha-score-subtitulo">${subs_nivel[nivel]}</div>
          </div>
        </div>
        <div class="senha-score-corpo">
          <div class="senha-score-dica-box">${dicas_por_nivel[nivel]}</div>
          ${acaoBotao}
        </div>
      </div>`;
  };

  /* --------------------------------------------------------
     TOGGLE VISIBILIDADE SENHA
  -------------------------------------------------------- */
  window.toggleSenha = function (inputId, iconeId) {
    const input = document.getElementById(inputId || 'input-senha');
    const icone = document.getElementById(iconeId || 'icone-olho');
    if (!input || !icone) return;
    if (input.type === 'password') {
      input.type = 'text';
      icone.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
    } else {
      input.type = 'password';
      icone.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    }
  };

  /* --------------------------------------------------------
     GERADOR DE SENHA
  -------------------------------------------------------- */
  window.gerarSenha = function () {
    const comprimento = parseInt(document.getElementById('slider-comprimento')?.value || 16);
    const usaMaiusculas = document.getElementById('opt-maiusculas')?.checked !== false;
    const usaMinusculas = document.getElementById('opt-minusculas')?.checked !== false;
    const usaNumeros = document.getElementById('opt-numeros')?.checked !== false;
    const usaSimbolos = document.getElementById('opt-simbolos')?.checked !== false;

    let chars = '';
    if (usaMaiusculas) chars += 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    if (usaMinusculas) chars += 'abcdefghjkmnpqrstuvwxyz';
    if (usaNumeros) chars += '23456789';
    if (usaSimbolos) chars += '!@#$%^&*-_=+?';

    const textoEl = document.getElementById('senha-texto');
    const btnCopiar = document.getElementById('btn-copiar');

    if (!chars) {
      if (textoEl) textoEl.textContent = 'Selecione pelo menos uma opção';
      return;
    }

    let senha = '';
    const arr = new Uint32Array(comprimento);
    crypto.getRandomValues(arr);
    arr.forEach(v => senha += chars[v % chars.length]);

    if (textoEl) textoEl.textContent = senha;
    if (btnCopiar) btnCopiar.style.display = 'flex';

    const resultado = document.getElementById('resultado-gerador');
    if (resultado) {
      resultado.innerHTML = `
        <div class="alerta alerta-seguro">
          <svg class="alerta-icone" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <div class="alerta-conteudo">
            <div class="alerta-titulo">Senha criada com sucesso!</div>
            <div class="alerta-texto">Clique em \"Copiar\" e cole diretamente no campo de criação de conta. Guarde-a em um gerenciador de senhas — nunca a anote em papel ou e-mail. Recomendamos o <strong><a href=\"/blog/posts/melhores-gerenciadores-senha\" style=\"color:var(--azul-claro)\">1Password</a></strong>.</div>
          </div>
        </div>`;
    }
  };

  window.copiarSenha = function () {
    const texto = document.getElementById('senha-texto')?.textContent || '';
    navigator.clipboard.writeText(texto).then(() => {
      const btn = document.getElementById('btn-copiar');
      if (!btn) return;
      const original = btn.innerHTML;
      btn.innerHTML = '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Copiada!';
      btn.style.background = 'var(--verde-fundo)';
      btn.style.color = 'var(--verde-seguro)';
      btn.style.borderColor = 'rgba(26,122,74,0.2)';
      setTimeout(() => {
        btn.innerHTML = original;
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
      }, 2500);
    });
  };

})();
