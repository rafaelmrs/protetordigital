import { useState, useCallback } from 'react';

const WORKER_URL = 'https://protetordigital-worker.dev-fretereal.workers.dev';

function isValidURL(str) {
  try {
    const url = new URL(str.startsWith('http') ? str : `https://${str}`);
    return url.hostname.includes('.');
  } catch {
    return false;
  }
}

function normalizeURL(str) {
  return str.startsWith('http') ? str : `https://${str}`;
}

export default function URLScanner() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);

  const scan = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    if (!isValidURL(trimmed)) {
      setError('URL inválida. Tente: google.com ou https://exemplo.com');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const normalized = normalizeURL(trimmed);
      const response = await fetch(`${WORKER_URL}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalized }),
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setResult({ ...data, url: normalized, checkedAt: new Date() });
      setHistory(prev => [{ url: normalized, safe: data.safe, checkedAt: new Date() }, ...prev.slice(0, 4)]);
    } catch (err) {
      setError(`Erro ao verificar URL: ${err.message}. Verifique se o Worker está configurado.`);
    } finally {
      setLoading(false);
    }
  }, [url]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') scan();
  };

  return (
    <div className="space-y-6">
      {/* Input */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span>🔗</span> Scanner de URLs Maliciosas
        </h2>
        <div className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://exemplo.com ou exemplo.com"
            className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            aria-label="URL para verificar"
          />
          <button
            onClick={scan}
            disabled={loading || !url.trim()}
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
          <p className="mt-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
            ⚠️ {error}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-2">
          Powered by Google Safe Browsing API via Cloudflare Worker
        </p>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className={`rounded-2xl p-6 shadow-lg border animate-slide-in ${
          result.safe
            ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-start gap-4">
            <div className={`text-5xl`}>{result.safe ? '✅' : '🚨'}</div>
            <div className="flex-1">
              <h3 className={`text-xl font-bold mb-1 ${result.safe ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                {result.safe ? 'URL Segura' : 'URL SUSPEITA/MALICIOSA'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 break-all mb-3 font-mono">
                {result.url}
              </p>

              {!result.safe && result.threats && result.threats.length > 0 && (
                <div className="space-y-2">
                  <p className="font-semibold text-red-700 dark:text-red-300 text-sm">Ameaças detectadas:</p>
                  {result.threats.map((t, i) => (
                    <div key={i} className="bg-red-100 dark:bg-red-900 rounded-lg px-3 py-2 text-sm text-red-800 dark:text-red-200">
                      {t === 'MALWARE' && '🦠 Malware — software malicioso detectado'}
                      {t === 'SOCIAL_ENGINEERING' && '🎣 Phishing — site de engenharia social'}
                      {t === 'UNWANTED_SOFTWARE' && '⚠️ Software Indesejado'}
                      {t === 'POTENTIALLY_HARMFUL_APPLICATION' && '📱 Aplicativo Potencialmente Perigoso'}
                      {!['MALWARE','SOCIAL_ENGINEERING','UNWANTED_SOFTWARE','POTENTIALLY_HARMFUL_APPLICATION'].includes(t) && `⚠️ ${t}`}
                    </div>
                  ))}
                </div>
              )}

              {result.safe && (
                <p className="text-sm text-green-700 dark:text-green-300">
                  Nenhuma ameaça conhecida foi detectada nesta URL no momento da verificação.
                </p>
              )}

              <p className="text-xs text-gray-500 mt-3">
                Verificado em: {result.checkedAt?.toLocaleString('pt-BR')} •
                Latência: {result.latency || '&lt;50ms'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-blue-50 dark:bg-blue-950 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <strong>ℹ️ Aviso:</strong> Esta verificação usa a base de dados do Google Safe Browsing. Uma URL marcada como "segura" não garante 100% de segurança — sempre verifique o domínio manualmente antes de inserir dados pessoais.
        </p>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <h3 className="font-bold mb-3 text-gray-700 dark:text-gray-300">Histórico desta sessão</h3>
          <ul className="space-y-2">
            {history.map((h, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span>{h.safe ? '✅' : '🚨'}</span>
                <span className="font-mono text-gray-600 dark:text-gray-400 truncate flex-1">{h.url}</span>
                <span className="text-xs text-gray-400 shrink-0">{h.checkedAt.toLocaleTimeString('pt-BR')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
