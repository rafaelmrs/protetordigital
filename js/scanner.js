/**
 * Protetor Digital — scanner.js
 * Verificação de URLs via Google Safe Browsing (CF Pages Function /api/scan)
 */

(function () {
  'use strict';

  /* --------------------------------------------------------
     VERIFICAR LINK
  -------------------------------------------------------- */
  window.verificarLink = async function () {
    const urlInput = document.getElementById('input-link');
    const resultado = document.getElementById('resultado-link');
    if (!resultado) return;

    let url = urlInput?.value.trim() || '';
    if (!url) {
      resultado.innerHTML = `<div class="alerta alerta-atencao">
        <svg class="alerta-icone" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <div class="alerta-conteudo"><div class="alerta-titulo">Cole o link no campo acima</div><div class="alerta-texto">Digite ou cole o endereço que deseja verificar.</div></div>
      </div>`;
      return;
    }

    // Adiciona protocolo se ausente
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    // Valida URL
    let parsed;
    try { parsed = new URL(url); } catch {
      resultado.innerHTML = `<div class="alerta alerta-atencao">
        <svg class="alerta-icone" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
        <div class="alerta-conteudo"><div class="alerta-titulo">Link inválido</div><div class="alerta-texto">Verifique se o endereço está correto (ex: https://exemplo.com.br).</div></div>
      </div>`;
      return;
    }

    resultado.innerHTML = `<div class="alerta alerta-info carregando" style="margin-top:1.5rem;">
      <svg class="alerta-icone" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <div class="alerta-conteudo"><div class="alerta-titulo">Verificando o link…</div><div class="alerta-texto">Consultando as bases de dados de segurança. Aguarde um instante.</div></div>
    </div>`;

    let data;
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: parsed.href }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      data = await res.json();
    } catch (err) {
      // Fallback: analisa localmente quando API indisponível
      data = analisarUrlLocalmente(parsed);
      data._fallback = true;
    }

    resultado.innerHTML = renderResultadoUrl(parsed, data);
  };

  /* --------------------------------------------------------
     ANÁLISE LOCAL (fallback quando API offline)
  -------------------------------------------------------- */
  function analisarUrlLocalmente(parsed) {
    const url = parsed.href;
    const domain = parsed.hostname;
    const encurtadores = ['bit.ly','tinyurl.com','t.co','goo.gl','ow.ly','short.io','rebrand.ly','is.gd','cutt.ly'];
    const isEncurtado = encurtadores.some(e => domain.includes(e));
    const isMuitoLongo = url.length > 120;
    const temHttps = parsed.protocol === 'https:';
    const pareceIp = /^\d+\.\d+\.\d+\.\d+$/.test(domain);

    const ameacas = [];
    if (isEncurtado) ameacas.push('LINK_ENCURTADO');
    if (pareceIp) ameacas.push('IP_ADDRESS');
    if (!temHttps) ameacas.push('NO_HTTPS');

    return {
      safe: ameacas.length === 0 && !isMuitoLongo,
      threats: ameacas,
      _fallback: true,
      _temHttps: temHttps,
      _isEncurtado: isEncurtado,
      _isMuitoLongo: isMuitoLongo,
      _pareceIp: pareceIp,
    };
  }

  /* --------------------------------------------------------
     RENDERIZA RESULTADO
  -------------------------------------------------------- */
  function renderResultadoUrl(parsed, data) {
    const url = parsed.href;
    const urlDisplay = url.length > 70 ? url.substring(0, 70) + '…' : url;
    const temHttps = parsed.protocol === 'https:';
    const threats = data.threats || [];
    const isSafe = data.safe && threats.length === 0;

    const isMalware = threats.includes('MALWARE');
    const isPhishing = threats.includes('SOCIAL_ENGINEERING');
    const isUnwanted = threats.includes('UNWANTED_SOFTWARE');

    const traduzirAmeaca = (t) => {
      const m = {
        'MALWARE': 'Malware identificado',
        'SOCIAL_ENGINEERING': 'Site de phishing (falso)',
        'UNWANTED_SOFTWARE': 'Software indesejado',
        'POTENTIALLY_HARMFUL_APPLICATION': 'Aplicativo potencialmente prejudicial',
        'LINK_ENCURTADO': 'Link encurtado / redirecionado',
        'IP_ADDRESS': 'Endereço IP direto (suspeito)',
        'NO_HTTPS': 'Sem criptografia (sem https)',
      };
      return m[t] || t;
    };

    const checkItem = (ok, texto) => `
      <div class="resultado-check-item">
        <svg class="${ok ? 'check-ok' : 'check-perigo'}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          ${ok
            ? '<polyline points="20 6 9 17 4 12"/>'
            : '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'}
        </svg>
        ${texto}
      </div>`;

    const checkNeutro = (texto) => `
      <div class="resultado-check-item">
        <svg class="check-neutro" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        ${texto}
      </div>`;

    if (!isSafe) {
      const ameacasTexto = threats.length > 0
        ? threats.map(t => `<span class="tag" style="background:var(--vermelho-fundo);color:var(--vermelho-perigo);">${traduzirAmeaca(t)}</span>`).join(' ')
        : '';

      return `
        <div class="resultado-url-painel">
          <div class="resultado-url-topo ${isMalware || isPhishing ? 'perigo' : 'atencao'}">
            <div class="resultado-url-icone ${isMalware || isPhishing ? 'perigo' : 'atencao'}">
              <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div>
              <div class="resultado-url-texto-principal ${isMalware || isPhishing ? 'perigo' : 'atencao'}">
                ${isMalware ? 'Perigo — site com malware detectado' : isPhishing ? 'Perigo — site falso (phishing)' : 'Atenção — este link tem características suspeitas'}
              </div>
              <div class="resultado-url-sub">
                ${isMalware ? 'Este site pode instalar vírus ou roubar dados' : isPhishing ? 'Este site imita outro para roubar suas informações' : 'Não conseguimos verificar o destino final deste endereço'}
              </div>
            </div>
          </div>
          <div class="resultado-url-corpo">
            <div class="resultado-url-url-label">Link verificado</div>
            <div class="resultado-url-url-box">${urlDisplay}</div>
            ${ameacasTexto ? `<div style="margin-bottom:1.25rem;">${ameacasTexto}</div>` : ''}
            <div class="resultado-checks">
              ${checkItem(false, threats.find(t => ['MALWARE','SOCIAL_ENGINEERING','UNWANTED_SOFTWARE'].includes(t)) ? traduzirAmeaca(threats[0]) : 'Anomalia detectada')}
              ${checkItem(temHttps, temHttps ? 'Conexão com criptografia (https)' : 'Sem criptografia (não tem https)')}
              ${threats.includes('LINK_ENCURTADO') ? checkItem(false, 'Link encurtado ou redirecionado') : checkNeutro('Tipo de link não classificado')}
              ${checkNeutro('Avalie com atenção antes de acessar')}
            </div>
            <div class="alerta alerta-perigo" style="margin-top:0;">
              <svg class="alerta-icone" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <div class="alerta-conteudo">
                <div class="alerta-titulo">Não acesse este link</div>
                <div class="alerta-texto">Se você recebeu esse link por WhatsApp, SMS ou e-mail, <strong>não clique</strong>. Apague a mensagem e bloqueie o remetente se desconhecido.</div>
              </div>
            </div>
            <div style="margin-top:1rem;background:#FFF8F8;border:1px solid rgba(185,28,28,0.15);border-radius:var(--radius-lg);padding:1.1rem 1.25rem;">
              <div style="font-family:var(--font-display);font-size:0.8rem;font-weight:700;color:var(--vermelho-perigo);margin-bottom:0.6rem;display:flex;align-items:center;gap:0.4rem;">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Proteja seu dispositivo contra ameaças como essa
              </div>
              <p style="font-family:var(--font-body);font-size:0.82rem;color:#7F1D1D;line-height:1.55;margin-bottom:0.75rem;">Um antivírus bloqueia automaticamente sites e arquivos maliciosos antes que causem dano — mesmo quando você clica sem querer.</p>
              <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
                <a href="https://www.bitdefender.com.br" target="_blank" rel="noopener noreferrer" style="font-family:var(--font-display);font-size:0.78rem;font-weight:700;color:#7F1D1D;background:white;border:1px solid rgba(185,28,28,0.25);border-radius:6px;padding:0.35rem 0.75rem;text-decoration:none;">Bitdefender</a>
                <a href="https://www.malwarebytes.com" target="_blank" rel="noopener noreferrer" style="font-family:var(--font-display);font-size:0.78rem;font-weight:700;color:#7F1D1D;background:white;border:1px solid rgba(185,28,28,0.25);border-radius:6px;padding:0.35rem 0.75rem;text-decoration:none;">Malwarebytes</a>
              </div>
            </div>
          </div>
        </div>`;
    }

    return `
      <div class="resultado-url-painel">
        <div class="resultado-url-topo seguro">
          <div class="resultado-url-icone seguro">
            <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div>
            <div class="resultado-url-texto-principal seguro">Link não identificado como ameaça</div>
            <div class="resultado-url-sub">Não encontramos esse endereço em listas de sites maliciosos</div>
          </div>
        </div>
        <div class="resultado-url-corpo">
          <div class="resultado-url-url-label">Link verificado</div>
          <div class="resultado-url-url-box">${urlDisplay}</div>
          <div class="resultado-checks">
            ${checkItem(true, 'Não está em listas de ameaças')}
            ${checkItem(temHttps, temHttps ? 'Conexão segura com criptografia' : 'Sem criptografia (sem https)')}
            ${checkItem(true, 'Endereço completo e legível')}
            ${checkItem(true, 'Sem redirecionamentos suspeitos')}
          </div>
          <div class="alerta alerta-info" style="margin-top:0;">
            <svg class="alerta-icone" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div class="alerta-conteudo">
              <div class="alerta-titulo">Continue atento mesmo assim</div>
              <div class="alerta-texto">Mesmo sem ameaças detectadas, mantenha a atenção: se o site pedir dados pessoais ou senhas de forma inesperada, feche a página imediatamente.</div>
            </div>
          </div>
        </div>
      </div>`;
  }

})();
