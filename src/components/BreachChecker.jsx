import { useState, useCallback } from 'react';

const WORKER_URL = import.meta.env.PUBLIC_WORKER_URL || 'https://your-worker.workers.dev';

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Formata número grande de forma legível
function formatPwnCount(n) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString('pt-BR');
}

export default function BreachChecker() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const check = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    if (!isValidEmail(trimmed)) {
      setError('Email inválido. Digite um email completo.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch(`${WORKER_URL}/breach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });

      if (response.status === 429) {
        throw new Error('Muitas consultas. Aguarde alguns minutos e tente novamente.');
      }

      if (!response.ok) {
        throw new Error(`Erro ${response.status}`);
      }

      const data = await response.json();
      setResult({ ...data, email: trimmed, checkedAt: new Date() });
    } catch (err) {
      setError(err.message || 'Erro ao verificar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [email]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') check();
  };

  const getSeverityColor = (severity) => {
    if (severity === 'high') return 'bg-red-100 dark:bg-red-950 border-red-300 dark:border-red-700';
    if (severity === 'medium') return 'bg-orange-100 dark:bg-orange-950 border-orange-300 dark:border-orange-700';
    return 'bg-yellow-100 dark:bg-yellow-950 border-yellow-300 dark:border-yellow-700';
  };

  return (
    <div className="space-y-6">
      {/* Input */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <span>📧</span> Verificador de Vazamentos
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Verifique se seu email apareceu em algum vazamento de dados público.
        </p>
        <div className="flex gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="seuemail@exemplo.com"
            className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            aria-label="Email para verificar"
          />
          <button
            onClick={check}
            disabled={loading || !email.trim()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Verificando...
              </>
            ) : '🔍 Verificar'}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">⚠️ {error}</p>
        )}
        <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
          🔒 Powered by Have I Been Pwned (HIBP) — maior base de breaches do mundo (15B+ registros)
        </p>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
        </div>
      )}

      {/* Result - No breaches */}
      {result && !loading && result.breaches?.length === 0 && (
        <div className="bg-green-50 dark:bg-green-950 rounded-2xl p-6 border border-green-200 dark:border-green-800 animate-slide-in">
          <div className="flex items-center gap-4">
            <span className="text-5xl">🎉</span>
            <div>
              <h3 className="text-xl font-bold text-green-800 dark:text-green-200">Boa notícia!</h3>
              <p className="text-green-700 dark:text-green-300 mt-1">
                Seu email <strong>{result.email}</strong> não foi encontrado em nenhum vazamento público conhecido.
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                Verificado em {result.checkedAt?.toLocaleString('pt-BR')} • Fonte: Have I Been Pwned
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Result - Breaches found */}
      {result && !loading && result.breaches?.length > 0 && (
        <div className="space-y-4 animate-slide-in">
          <div className="bg-red-50 dark:bg-red-950 rounded-2xl p-6 border border-red-200 dark:border-red-800">
            <div className="flex items-start gap-4">
              <span className="text-4xl">🚨</span>
              <div>
                <h3 className="text-xl font-bold text-red-800 dark:text-red-200">
                  {result.breaches.length} vazamento{result.breaches.length > 1 ? 's' : ''} encontrado{result.breaches.length > 1 ? 's' : ''}
                </h3>
                <p className="text-red-700 dark:text-red-300 mt-1 text-sm">
                  Seu email <strong>{result.email}</strong> apareceu nos seguintes incidentes de segurança:
                </p>
              </div>
            </div>
          </div>

          {/* Breach list */}
          <div className="space-y-3">
            {result.breaches.map((breach, i) => (
              <div key={i} className={`rounded-xl p-4 border ${getSeverityColor(breach.severity)}`}>
                <div className="flex-1">
                  {/* Header: nome + badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h4 className="font-bold text-gray-800 dark:text-gray-200">
                      {breach.title || breach.name}
                    </h4>
                    {breach.date && (
                      <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-400">
                        {new Date(breach.date).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' })}
                      </span>
                    )}
                    {breach.pwnCount && (
                      <span className="text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full font-medium">
                        {formatPwnCount(breach.pwnCount)} registros
                      </span>
                    )}
                    {breach.isVerified && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                        ✓ Verificado
                      </span>
                    )}
                    {breach.isSensitive && (
                      <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                        ⚠ Sensível
                      </span>
                    )}
                  </div>

                  {/* Dados expostos */}
                  {breach.exposedData && breach.exposedData.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {breach.exposedData.map((d, j) => (
                        <span key={j} className="text-xs bg-white/60 dark:bg-black/30 border border-gray-300 dark:border-gray-600 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-400">
                          {d}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Descrição resumida */}
                  {breach.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                      {breach.description}
                    </p>
                  )}

                  {/* O que fazer */}
                  <div className="bg-white/60 dark:bg-black/30 rounded-lg p-2 mt-1">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">💡 O que fazer:</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {breach.severity === 'high'
                        ? 'Troque a senha IMEDIATAMENTE e monitore dados bancários — dados críticos expostos.'
                        : breach.severity === 'medium'
                        ? 'Troque a senha deste serviço e de qualquer conta onde usou a mesma senha.'
                        : 'Troque a senha por precaução e ative 2FA neste serviço.'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* LGPD Info */}
          <div className="bg-blue-50 dark:bg-blue-950 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
            <h4 className="font-bold text-blue-800 dark:text-blue-200 mb-2">⚖️ Seus Direitos pela LGPD</h4>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <li>→ Solicite a <strong>exclusão dos seus dados</strong> nas empresas afetadas</li>
              <li>→ Registre ocorrência na <strong>ANPD</strong>: gov.br/anpd/reclamacoes</li>
              <li>→ Caso haja dano comprovado, você pode entrar com <strong>ação indenizatória</strong></li>
              <li>→ Ative o <strong>2FA</strong> imediatamente em todas as contas afetadas</li>
            </ul>
          </div>

          {/* Action checklist */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
            <h4 className="font-bold mb-3">✅ Checklist de Ações Imediatas</h4>
            <div className="space-y-2">
              {[
                'Trocar senha do(s) serviço(s) afetado(s)',
                'Trocar senha de qualquer conta onde usou a mesma senha',
                'Ativar autenticação de dois fatores (2FA)',
                'Verificar se há atividade suspeita nas contas',
                'Monitorar o CPF no Registrato (Banco Central)',
                'Registrar alerta de crédito no Serasa/SPC',
              ].map((action, i) => (
                <label key={i} className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-has-[:checked]:line-through group-has-[:checked]:text-gray-400">
                    {action}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
