/**
 * Protetor Digital — lastbreach.js
 * Carrega e renderiza o último vazamento na home a partir de /data/lastbreach-pt.json
 */

(function () {
  'use strict';

  function formatarData(dateStr) {
    if (!dateStr) return 'Data desconhecida';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  function formatarDataExata(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00'); // evita problema de fuso
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatarContagem(n) {
    if (!n) return '';
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + ' bilhões de contas';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' milhões de contas';
    if (n >= 1_000) return (n / 1_000).toFixed(0) + ' mil contas';
    return n.toLocaleString('pt-BR') + ' contas';
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

  async function carregarUltimoVazamento() {
    const secao = document.getElementById('ultimo-vazamento');
    const card = document.getElementById('ultimo-vazamento-card');
    if (!secao || !card) return;

    try {
      const res = await fetch('/data/lastbreach-pt.json');
      if (!res.ok) return;
      const b = await res.json();

      const logoTxt = b.domain
        ? b.domain.substring(0, 2).toUpperCase()
        : (b.title || b.name || '??').substring(0, 2).toUpperCase();

      const tags = (b.data_classes_pt || [])
        .map(dc => `<span class="tag">${dc}</span>`)
        .join('');

      card.innerHTML = `
        <div class="vazamento-item" style="background:var(--branco);border:1px solid var(--cinza-borda);border-radius:var(--radius-lg);padding:1.25rem 1.5rem;display:flex;align-items:flex-start;gap:1rem;">
          <div class="vazamento-logo" style="flex-shrink:0;">
            <span>${logoTxt}</span>
          </div>
          <div class="vazamento-info" style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.35rem;">
              <div class="vazamento-nome">${b.title || b.name}</div>
              <span class="badge ${classSeveridade(b.severity)}">${labelSeveridade(b.severity)}</span>
            </div>
            <div class="vazamento-data" style="margin-bottom:0.5rem;">
              ${formatarContagem(b.pwn_count)}
              ${b.added_date ? ' · Adicionado em ' + formatarDataExata(b.added_date) : ''}
            </div>
            <div class="vazamento-descricao" style="margin-bottom:0.75rem;">${b.descricao || ''}</div>
            ${tags ? `<div class="vazamento-tags">${tags}</div>` : ''}
            <div style="margin-top:1rem;">
              <a class="btn btn-primario" href="/ferramentas/vazamentos" style="font-size:0.85rem;">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                Verificar se meu e-mail foi afetado
              </a>
            </div>
            <div class="fonte-consulta" style="margin-top:0.75rem;">Fonte: <a href="https://haveibeenpwned.com" target="_blank" rel="noopener noreferrer">Have I Been Pwned</a> — serviço de referência mundial em detecção de vazamentos.</div>
          </div>
        </div>`;

      secao.style.display = 'block';
    } catch (e) {
      // Falha silenciosa — a seção simplesmente não aparece
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', carregarUltimoVazamento);
  } else {
    carregarUltimoVazamento();
  }

})();
