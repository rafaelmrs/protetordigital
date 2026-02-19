import { useState, useCallback, useEffect } from 'react';

const WORKER_URL = 'https://protetordigital-worker.dev-fretereal.workers.dev';

// ── HIBP k-anonymity ────────────────────────────────────────────
// Verifica se a senha apareceu em vazamentos reais.
// PRIVACIDADE: a senha NUNCA sai do navegador.
// Apenas os 5 primeiros chars do hash SHA-1 são enviados ao Worker.
// A verificação final do sufixo completo acontece aqui no browser.
async function checkPwnedPassword(password) {
  if (!password || password.length < 4) return null;

  // 1. Calcula SHA-1 localmente no browser
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

  // 2. Separa prefix (5 chars) e suffix (restante)
  const prefix = hashHex.slice(0, 5);
  const suffix = hashHex.slice(5);

  // 3. Envia só o prefix ao Worker → Worker repassa ao HIBP
  try {
    const res = await fetch(`${WORKER_URL}/pwned-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix }),
    });

    if (!res.ok) return null;

    // 4. HIBP retorna lista de sufixos: "SUFIXO:CONTAGEM"
    const text = await res.text();

    // 5. Verifica localmente se nosso suffix está na lista
    // A senha real NUNCA saiu do navegador
    for (const line of text.split('\n')) {
      const [returnedSuffix, count] = line.trim().split(':');
      if (returnedSuffix === suffix) {
        return parseInt(count, 10); // vezes que foi vazada
      }
    }

    return 0; // não encontrada
  } catch {
    return null; // erro de rede — não bloqueia a UI
  }
}
// ────────────────────────────────────────────────────────────────


// Inline zxcvbn-like scorer (lightweight, no external deps issues with SSR)
function analyzePassword(password) {
  if (!password) return null;

  const len = password.length;
  let score = 0;
  const feedback = [];
  const suggestions = [];

  // Length scoring
  if (len >= 8) score += 1;
  if (len >= 12) score += 1;
  if (len >= 16) score += 1;
  if (len >= 20) score += 1;

  // Complexity
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  if (hasLower) score += 0.5;
  if (hasUpper) score += 0.5;
  if (hasDigit) score += 0.5;
  if (hasSpecial) score += 1;

  // Penalties
  const commonPatterns = ['123456', 'password', 'senha', '111111', 'qwerty', 'abc123', '123456789', 'letmein'];
  if (commonPatterns.some(p => password.toLowerCase().includes(p))) {
    score = Math.max(0, score - 3);
    feedback.push({ type: 'error', text: 'Contém padrão comum e previsível' });
  }

  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(0, score - 1);
    feedback.push({ type: 'warning', text: 'Evite caracteres repetidos consecutivos' });
  }

  // Suggestions
  if (!hasUpper) suggestions.push('Adicione letras maiúsculas (A-Z)');
  if (!hasLower) suggestions.push('Adicione letras minúsculas (a-z)');
  if (!hasDigit) suggestions.push('Adicione números (0-9)');
  if (!hasSpecial) suggestions.push('Adicione símbolos (!@#$%...)');
  if (len < 12) suggestions.push(`Aumente para pelo menos 12 caracteres (atual: ${len})`);

  // OWASP check
  const owaspPass = len >= 8 && hasLower && hasUpper && hasDigit && hasSpecial;
  if (owaspPass) {
    feedback.push({ type: 'success', text: 'Atende aos requisitos mínimos OWASP' });
  }

  // Normalize score
  const finalScore = Math.min(4, Math.floor(score));

  // Estimate crack time
  const charset = (hasLower ? 26 : 0) + (hasUpper ? 26 : 0) + (hasDigit ? 10 : 0) + (hasSpecial ? 32 : 0);
  const combinations = Math.pow(Math.max(charset, 26), len);
  const hashesPerSecond = 1e10; // 10 billion (modern GPU)
  const seconds = combinations / hashesPerSecond;

  let crackTime = '';
  if (seconds < 1) crackTime = 'Instantâneo';
  else if (seconds < 60) crackTime = `${Math.round(seconds)} segundos`;
  else if (seconds < 3600) crackTime = `${Math.round(seconds / 60)} minutos`;
  else if (seconds < 86400) crackTime = `${Math.round(seconds / 3600)} horas`;
  else if (seconds < 2592000) crackTime = `${Math.round(seconds / 86400)} dias`;
  else if (seconds < 31536000) crackTime = `${Math.round(seconds / 2592000)} meses`;
  else if (seconds < 3153600000) crackTime = `${Math.round(seconds / 31536000)} anos`;
  else crackTime = 'Mais de 100 anos';

  const labels = ['Muito Fraca', 'Fraca', 'Razoável', 'Forte', 'Muito Forte'];
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
  const textColors = ['text-red-600', 'text-orange-600', 'text-yellow-600', 'text-blue-600', 'text-green-600'];

  return {
    score: finalScore,
    label: labels[finalScore],
    color: colors[finalScore],
    textColor: textColors[finalScore],
    crackTime,
    feedback,
    suggestions,
    owaspPass,
    entropy: Math.log2(combinations),
  };
}

function generatePassword(length = 16, options = {}) {
  const { upper = true, lower = true, digits = true, special = true } = options;
  let chars = '';
  if (lower) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (upper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (digits) chars += '0123456789';
  if (special) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (x) => chars[x % chars.length]).join('');
}

export default function PasswordAnalyzer() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [generated, setGenerated] = useState('');
  const [copied, setCopied] = useState(false);
  const [genLen, setGenLen] = useState(16);
  const [genOptions, setGenOptions] = useState({ upper: true, lower: true, digits: true, special: true });
  // HIBP pwned password state
  const [pwnedCount, setPwnedCount] = useState(null);   // null=não verificado, 0=segura, N=vazada N vezes
  const [pwnedLoading, setPwnedLoading] = useState(false);

  useEffect(() => {
    if (password) {
      setAnalysis(analyzePassword(password));
      // Debounce HIBP check — aguarda 800ms após parar de digitar
      setPwnedCount(null);
      const timer = setTimeout(async () => {
        setPwnedLoading(true);
        try {
          const count = await checkPwnedPassword(password);
          setPwnedCount(count);
        } finally {
          setPwnedLoading(false);
        }
      }, 800);
      return () => clearTimeout(timer);
    } else {
      setAnalysis(null);
      setPwnedCount(null);
    }
  }, [password]);

  const handleGenerate = useCallback(() => {
    const pwd = generatePassword(genLen, genOptions);
    setGenerated(pwd);
  }, [genLen, genOptions]);

  const handleCopy = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Password Input */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span>🔐</span> Analisar Senha
        </h2>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Digite sua senha para análise..."
            className="w-full px-4 py-3 pr-24 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 font-mono text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            aria-label="Campo de senha para análise"
          />
          <button
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            {showPassword ? '🙈 Ocultar' : '👁️ Ver'}
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
          <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
          </svg>
          100% local — sua senha nunca sai do seu dispositivo
        </p>
      </div>

      {/* Analysis Result */}
      {analysis && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 animate-fade-in">
          <h3 className="font-bold text-lg mb-4">Resultado da Análise</h3>

          {/* Score bar */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Força da Senha</span>
              <span className={`font-bold text-sm ${analysis.textColor}`}>{analysis.label}</span>
            </div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${analysis.color}`}
                style={{ width: `${(analysis.score + 1) * 20}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              {[0,1,2,3,4].map(i => (
                <div key={i} className={`h-1 w-1 rounded-full ${i <= analysis.score ? analysis.color : 'bg-gray-300'}`} />
              ))}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Tempo para Quebrar</p>
              <p className="font-bold text-sm text-gray-800 dark:text-white">{analysis.crackTime}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Entropia</p>
              <p className="font-bold text-sm text-gray-800 dark:text-white">{Math.round(analysis.entropy)} bits</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Padrão OWASP</p>
              <p className={`font-bold text-sm ${analysis.owaspPass ? 'text-green-600' : 'text-red-500'}`}>
                {analysis.owaspPass ? '✅ Aprovado' : '❌ Reprovado'}
              </p>
            </div>
          </div>

          {/* HIBP Pwned Password Badge */}
          <div className={`flex items-center gap-3 p-3 rounded-xl mb-4 border ${
            pwnedLoading
              ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'
              : pwnedCount === null
              ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'
              : pwnedCount === 0
              ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
          }`}>
            <div className="shrink-0 text-2xl">
              {pwnedLoading ? '🔍' : pwnedCount === null ? '🔒' : pwnedCount === 0 ? '✅' : '🚨'}
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">
                HIBP — Senha em Vazamentos Reais
              </p>
              {pwnedLoading && (
                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
                  Verificando contra 15 bilhões de senhas vazadas...
                </p>
              )}
              {!pwnedLoading && pwnedCount === null && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Aguardando verificação...
                </p>
              )}
              {!pwnedLoading && pwnedCount === 0 && (
                <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                  Não encontrada em nenhum vazamento conhecido 🎉
                </p>
              )}
              {!pwnedLoading && pwnedCount > 0 && (
                <div>
                  <p className="text-sm text-red-700 dark:text-red-300 font-bold">
                    Apareceu {pwnedCount.toLocaleString('pt-BR')} vez{pwnedCount > 1 ? 'es' : ''} em vazamentos!
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                    Esta senha está em bancos de dados de hackers. Não a use.
                  </p>
                </div>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs text-gray-400">via HIBP</p>
              <p className="text-xs text-gray-400">k-anonymity</p>
            </div>
          </div>

          {/* Feedback */}
          {analysis.feedback.length > 0 && (
            <div className="space-y-2 mb-3">
              {analysis.feedback.map((f, i) => (
                <div key={i} className={`flex items-center gap-2 text-sm p-2 rounded-lg ${
                  f.type === 'error' ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300' :
                  f.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300' :
                  'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
                }`}>
                  {f.type === 'error' ? '❌' : f.type === 'warning' ? '⚠️' : '✅'}
                  {f.text}
                </div>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {analysis.suggestions.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">💡 Sugestões de melhoria:</p>
              <ul className="space-y-1">
                {analysis.suggestions.map((s, i) => (
                  <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">→</span> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Password Generator */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <span>⚡</span> Gerador de Senhas Fortes
        </h3>

        {/* Options */}
        <div className="mb-4">
          <label className="flex justify-between text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            <span>Comprimento: {genLen} caracteres</span>
          </label>
          <input
            type="range"
            min="8" max="64"
            value={genLen}
            onChange={(e) => setGenLen(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>8 (mínimo)</span>
            <span>32 (recomendado)</span>
            <span>64</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { key: 'upper', label: 'Maiúsculas (A-Z)' },
            { key: 'lower', label: 'Minúsculas (a-z)' },
            { key: 'digits', label: 'Números (0-9)' },
            { key: 'special', label: 'Símbolos (!@#$)' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={genOptions[key]}
                onChange={(e) => setGenOptions(prev => ({ ...prev, [key]: e.target.checked }))}
                className="w-4 h-4 accent-blue-600 rounded"
              />
              <span className="text-gray-700 dark:text-gray-300">{label}</span>
            </label>
          ))}
        </div>

        <button
          onClick={handleGenerate}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          ⚡ Gerar Senha Aleatória
        </button>

        {generated && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between gap-3">
              <code className="font-mono text-sm break-all text-gray-800 dark:text-gray-200 flex-1">
                {generated}
              </code>
              <button
                onClick={() => handleCopy(generated)}
                className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  copied
                    ? 'bg-green-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {copied ? '✅ Copiado!' : '📋 Copiar'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Strength: {(() => { const a = analyzePassword(generated); return a ? `${a.label} — Quebrar em: ${a.crackTime}` : ''; })()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
