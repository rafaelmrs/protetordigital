import { useState, useCallback } from 'react';

const WORKER_URL = 'https://protetordigital-worker.dev-fretereal.workers.dev';

function isValidURL(str) {
  try { const u = new URL(str.startsWith('http')?str:`https://${str}`); return u.hostname.includes('.'); } catch { return false; }
}

const S = {
  card: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:24, marginBottom:16 },
  label: { fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 },
};

export default function URLScanner() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);

  const scan = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed || !isValidURL(trimmed)) { setError('URL inválida. Tente: google.com ou https://exemplo.com'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
      const res = await fetch(`${WORKER_URL}/scan`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url:normalized}) });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      setResult({...data, url:normalized, checkedAt:new Date()});
      setHistory(p => [{url:normalized, safe:data.safe, checkedAt:new Date()}, ...p.slice(0,4)]);
    } catch(err) {
      setError(`${err.message}. Verifique se o Worker está configurado.`);
    } finally { setLoading(false); }
  }, [url]);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* Input */}
      <div style={S.card}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
          <p style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:16,color:'var(--text)'}}>Scanner de URLs</p>
          <span style={{fontFamily:'var(--font-mono)',fontSize:11,padding:'2px 8px',borderRadius:4,background:'rgba(0,229,255,0.1)',color:'var(--cyan)',border:'1px solid rgba(0,229,255,0.2)'}}>Google Safe Browsing</span>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <input
            type="text"
            value={url}
            onChange={e=>setUrl(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&scan()}
            placeholder="https://exemplo.com ou exemplo.com"
            className="input"
            style={{flex:'1 1 200px',minWidth:0}}
            aria-label="URL para verificar"
          />
          <button onClick={scan} disabled={loading||!url.trim()} className="btn-primary" style={{padding:'12px 20px',fontSize:14,flexShrink:0}}>
            {loading ? <span style={{width:16,height:16,border:'2px solid rgba(0,0,0,0.2)',borderTopColor:'#060a0e',borderRadius:'50%',animation:'spin 0.7s linear infinite',display:'inline-block'}}/> : '🔍 Verificar'}
          </button>
        </div>
        {error && <p style={{marginTop:10,fontSize:13,color:'var(--red)',display:'flex',alignItems:'flex-start',gap:6}}>⚠️ {error}</p>}
        <p style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-muted)',marginTop:10}}>
          Powered by Google Safe Browsing API via Cloudflare Worker
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{...S.card,display:'flex',alignItems:'center',gap:16}}>
          <div style={{width:40,height:40,border:'3px solid var(--border2)',borderTopColor:'var(--cyan)',borderRadius:'50%',animation:'spin 0.7s linear infinite',flexShrink:0}}/>
          <div>
            <p style={{fontFamily:'var(--font-display)',fontWeight:600,color:'var(--text)',marginBottom:4}}>Verificando...</p>
            <p style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--text-muted)'}}>Consultando Google Safe Browsing</p>
          </div>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div style={{...S.card,borderColor:result.safe?'rgba(0,230,118,0.25)':'rgba(255,23,68,0.25)',background:result.safe?'rgba(0,230,118,0.04)':'rgba(255,23,68,0.04)',animation:'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)'}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:16}}>
            <div style={{width:52,height:52,borderRadius:12,background:result.safe?'rgba(0,230,118,0.12)':'rgba(255,23,68,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0}}>
              {result.safe?'✅':'🚨'}
            </div>
            <div style={{flex:1}}>
              <p style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:18,color:result.safe?'var(--green)':'var(--red)',marginBottom:4,letterSpacing:'-0.01em'}}>
                {result.safe ? 'URL Segura' : 'URL Suspeita / Maliciosa'}
              </p>
              <p style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--text-dim)',wordBreak:'break-all',marginBottom:12}}>{result.url}</p>

              {!result.safe && result.threats?.length > 0 && (
                <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:12}}>
                  {result.threats.map((t,i) => (
                    <div key={i} style={{padding:'8px 12px',borderRadius:8,fontSize:13,background:'rgba(255,23,68,0.08)',color:'var(--red)',border:'1px solid rgba(255,23,68,0.15)'}}>
                      {t==='MALWARE'?'🦠 Malware detectado':t==='SOCIAL_ENGINEERING'?'🎣 Phishing / Engenharia Social':t==='UNWANTED_SOFTWARE'?'⚠️ Software Indesejado':`⚠️ ${t}`}
                    </div>
                  ))}
                </div>
              )}

              {result.safe && <p style={{fontSize:13,color:'var(--green)'}}>Nenhuma ameaça conhecida detectada nesta URL.</p>}

              <p style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-muted)',marginTop:10}}>
                Verificado em {result.checkedAt?.toLocaleString('pt-BR')} · latência: {result.latency||'<50ms'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div style={{...S.card,background:'rgba(0,229,255,0.03)',borderColor:'rgba(0,229,255,0.15)'}}>
        <p style={{fontSize:13,color:'var(--text-dim)',lineHeight:1.6}}>
          <strong style={{color:'var(--cyan)'}}>ℹ️</strong> Esta verificação usa o Google Safe Browsing. Uma URL "segura" não é garantia absoluta — sempre verifique o domínio manualmente antes de inserir dados pessoais.
        </p>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div style={S.card}>
          <p style={{...S.label,marginBottom:12}}>Histórico desta sessão</p>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {history.map((h,i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                <span>{h.safe?'✅':'🚨'}</span>
                <span style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--text-dim)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{h.url}</span>
                <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-muted)',flexShrink:0}}>{h.checkedAt.toLocaleTimeString('pt-BR')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
