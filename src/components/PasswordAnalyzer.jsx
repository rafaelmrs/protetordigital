import { useState, useCallback, useEffect } from 'react';

const WORKER_URL = '/api';

async function checkPwnedPassword(password) {
  if (!password || password.length < 4) return null;
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,'0')).join('').toUpperCase();
  const prefix = hashHex.slice(0, 5);
  const suffix = hashHex.slice(5);
  try {
    const res = await fetch(`${WORKER_URL}/pwned-password`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({prefix}) });
    if (!res.ok) return null;
    const text = await res.text();
    for (const line of text.split('\n')) {
      const [s, count] = line.trim().split(':');
      if (s === suffix) return parseInt(count, 10);
    }
    return 0;
  } catch { return null; }
}

function analyzePassword(password) {
  if (!password) return null;
  const len = password.length;
  let score = 0;
  const feedback = [];
  const suggestions = [];
  if (len >= 8) score += 1;
  if (len >= 12) score += 1;
  if (len >= 16) score += 1;
  if (len >= 20) score += 1;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  if (hasLower) score += 0.5;
  if (hasUpper) score += 0.5;
  if (hasDigit) score += 0.5;
  if (hasSpecial) score += 1;
  const commonPatterns = ['123456','password','senha','111111','qwerty','abc123','123456789','letmein'];
  if (commonPatterns.some(p => password.toLowerCase().includes(p))) {
    score = Math.max(0, score - 3);
    feedback.push({ type:'error', text:'Contém padrão comum e previsível' });
  }
  if (/(.)\\1{2,}/.test(password)) {
    score = Math.max(0, score - 1);
    feedback.push({ type:'warning', text:'Evite caracteres repetidos consecutivos' });
  }
  if (!hasUpper) suggestions.push('Adicione letras maiúsculas (A-Z)');
  if (!hasLower) suggestions.push('Adicione letras minúsculas (a-z)');
  if (!hasDigit) suggestions.push('Adicione números (0-9)');
  if (!hasSpecial) suggestions.push('Adicione símbolos (!@#$%...)');
  if (len < 12) suggestions.push(`Aumente para pelo menos 12 caracteres (atual: ${len})`);
  const owaspPass = len >= 8 && hasLower && hasUpper && hasDigit && hasSpecial;
  if (owaspPass) feedback.push({ type:'success', text:'Atende aos requisitos mínimos OWASP' });
  const finalScore = Math.min(4, Math.floor(score));
  const charset = (hasLower?26:0)+(hasUpper?26:0)+(hasDigit?10:0)+(hasSpecial?32:0);
  const combinations = Math.pow(Math.max(charset,26), len);
  const seconds = combinations / 1e10;
  let crackTime = '';
  if (seconds < 1) crackTime = 'Instantâneo';
  else if (seconds < 60) crackTime = `${Math.round(seconds)}s`;
  else if (seconds < 3600) crackTime = `${Math.round(seconds/60)} min`;
  else if (seconds < 86400) crackTime = `${Math.round(seconds/3600)} horas`;
  else if (seconds < 2592000) crackTime = `${Math.round(seconds/86400)} dias`;
  else if (seconds < 31536000) crackTime = `${Math.round(seconds/2592000)} meses`;
  else if (seconds < 3153600000) crackTime = `${Math.round(seconds/31536000)} anos`;
  else crackTime = '100+ anos';
  const scoreColors = ['#ff1744','#ff6d00','#ffd600','#00b0ff','#00e676'];
  const scoreLabels = ['Muito Fraca','Fraca','Razoável','Forte','Muito Forte'];
  return { score:finalScore, label:scoreLabels[finalScore], color:scoreColors[finalScore], crackTime, feedback, suggestions, owaspPass, entropy:Math.log2(combinations) };
}

function generatePassword(length=16, opts={}) {
  const {upper=true,lower=true,digits=true,special=true} = opts;
  let chars = '';
  if (lower) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (upper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (digits) chars += '0123456789';
  if (special) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, x => chars[x % chars.length]).join('');
}

const S = {
  card: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:24, marginBottom:16 },
  label: { fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 },
  tag: (color) => ({ fontFamily:'var(--font-mono)', fontSize:11, padding:'3px 8px', borderRadius:5, background:`${color}12`, color, border:`1px solid ${color}28` }),
};

export default function PasswordAnalyzer() {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [generated, setGenerated] = useState('');
  const [copied, setCopied] = useState(false);
  const [genLen, setGenLen] = useState(20);
  const [genOpts, setGenOpts] = useState({upper:true,lower:true,digits:true,special:true});
  const [pwnedCount, setPwnedCount] = useState(null);
  const [pwnedLoading, setPwnedLoading] = useState(false);

  useEffect(() => {
    if (password) {
      setAnalysis(analyzePassword(password));
      setPwnedCount(null);
      const timer = setTimeout(async () => {
        setPwnedLoading(true);
        try { setPwnedCount(await checkPwnedPassword(password)); }
        finally { setPwnedLoading(false); }
      }, 800);
      return () => clearTimeout(timer);
    } else { setAnalysis(null); setPwnedCount(null); }
  }, [password]);

  const handleCopy = async (text) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(()=>setCopied(false),2000); } catch {}
  };

  const scoreWidth = analysis ? `${(analysis.score+1)*20}%` : '0%';

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* Input card */}
      <div style={S.card}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
          <p style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:16,color:'var(--text)'}}>Analisar Senha</p>
          <span style={{fontFamily:'var(--font-mono)',fontSize:11,padding:'2px 8px',borderRadius:4,background:'rgba(0,230,118,0.1)',color:'var(--green)',border:'1px solid rgba(0,230,118,0.2)'}}>100% local</span>
        </div>
        <div style={{position:'relative'}}>
          <input
            type={show?'text':'password'}
            value={password}
            onChange={e=>setPassword(e.target.value)}
            placeholder="Digite sua senha para análise..."
            className="input"
            style={{paddingRight:90,fontSize:16,letterSpacing:show?'normal':'0.1em'}}
            aria-label="Campo de senha"
          />
          <button onClick={()=>setShow(!show)} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'var(--surface2)',border:'1px solid var(--border2)',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:12,color:'var(--text-dim)',fontFamily:'var(--font-mono)'}}>
            {show?'ocultar':'ver'}
          </button>
        </div>
        <p style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-muted)',marginTop:10,display:'flex',alignItems:'center',gap:6}}>
          <span style={{color:'var(--green)'}}>🔒</span> Sua senha nunca sai do seu dispositivo — análise 100% local
        </p>
      </div>

      {/* Analysis */}
      {analysis && (
        <div style={{...S.card,animation:'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)'}}>
          {/* Score */}
          <div style={{marginBottom:20}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <p style={S.label}>Força da Senha</p>
              <span style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:14,color:analysis.color}}>{analysis.label}</span>
            </div>
            <div style={{height:6,background:'var(--border2)',borderRadius:3,overflow:'hidden'}}>
              <div style={{height:'100%',width:scoreWidth,background:analysis.color,borderRadius:3,transition:'width 0.5s cubic-bezier(0.16,1,0.3,1)',boxShadow:`0 0 12px ${analysis.color}60`}}/>
            </div>
          </div>

          {/* Stats grid */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
            {[
              {l:'Tempo de quebra',v:analysis.crackTime},
              {l:'Entropia',v:`${Math.round(analysis.entropy)} bits`},
              {l:'OWASP',v:analysis.owaspPass?'✓ OK':'✗ Falhou'},
            ].map(({l,v}) => (
              <div key={l} style={{background:'var(--bg2)',borderRadius:10,padding:'12px 10px',textAlign:'center',border:'1px solid var(--border)'}}>
                <p style={S.label}>{l}</p>
                <p style={{fontFamily:'var(--font-mono)',fontSize:13,fontWeight:700,color:'var(--text)'}}>{v}</p>
              </div>
            ))}
          </div>

          {/* HIBP badge */}
          <div style={{
            display:'flex',alignItems:'center',gap:12,padding:14,borderRadius:10,marginBottom:14,
            background: pwnedLoading||pwnedCount===null ? 'var(--bg2)' : pwnedCount===0 ? 'rgba(0,230,118,0.06)' : 'rgba(255,23,68,0.06)',
            border: `1px solid ${pwnedLoading||pwnedCount===null ? 'var(--border)' : pwnedCount===0 ? 'rgba(0,230,118,0.2)' : 'rgba(255,23,68,0.2)'}`,
          }}>
            <span style={{fontSize:22}}>{pwnedLoading?'🔍':pwnedCount===null?'⏳':pwnedCount===0?'✅':'🚨'}</span>
            <div style={{flex:1}}>
              <p style={S.label}>HIBP — Senhas Vazadas</p>
              {pwnedLoading && <p style={{fontSize:13,color:'var(--text-dim)',display:'flex',alignItems:'center',gap:6}}><span style={{display:'inline-block',width:12,height:12,border:'2px solid rgba(0,230,118,0.2)',borderTopColor:'var(--green)',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>Verificando 15B senhas...</p>}
              {!pwnedLoading && pwnedCount===null && <p style={{fontSize:13,color:'var(--text-muted)'}}>Aguardando digitação...</p>}
              {!pwnedLoading && pwnedCount===0 && <p style={{fontSize:13,color:'var(--green)',fontWeight:600}}>Não encontrada em nenhum vazamento 🎉</p>}
              {!pwnedLoading && pwnedCount>0 && <div><p style={{fontSize:13,color:'var(--red)',fontWeight:700}}>Apareceu {pwnedCount.toLocaleString('pt-BR')} vezes em vazamentos!</p><p style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>Não use esta senha em nenhum serviço.</p></div>}
            </div>
            <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-muted)',textAlign:'right',lineHeight:1.4}}>via HIBP<br/>k-anon</span>
          </div>

          {/* Feedback */}
          {analysis.feedback.length > 0 && (
            <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:12}}>
              {analysis.feedback.map((f,i) => (
                <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:8,fontSize:13,
                  background:f.type==='error'?'rgba(255,23,68,0.06)':f.type==='warning'?'rgba(255,214,0,0.06)':'rgba(0,230,118,0.06)',
                  color:f.type==='error'?'var(--red)':f.type==='warning'?'var(--yellow)':'var(--green)',
                }}>
                  {f.type==='error'?'✗':f.type==='warning'?'⚠':' ✓'} {f.text}
                </div>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {analysis.suggestions.length > 0 && (
            <div>
              <p style={{...S.label,marginBottom:8}}>Sugestões de melhoria</p>
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {analysis.suggestions.map((s,i) => (
                  <p key={i} style={{fontSize:13,color:'var(--text-dim)',display:'flex',alignItems:'flex-start',gap:6}}>
                    <span style={{color:'var(--green)',marginTop:1}}>→</span>{s}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Generator */}
      <div style={S.card}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
          <p style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:16,color:'var(--text)'}}>Gerador de Senhas</p>
          <span style={{fontFamily:'var(--font-mono)',fontSize:11,padding:'2px 8px',borderRadius:4,background:'rgba(0,229,255,0.1)',color:'var(--cyan)',border:'1px solid rgba(0,229,255,0.2)'}}>criptograficamente seguro</span>
        </div>

        <div style={{marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            <p style={S.label}>Comprimento</p>
            <span style={{fontFamily:'var(--font-mono)',fontSize:13,color:'var(--green)',fontWeight:700}}>{genLen} chars</span>
          </div>
          <input type="range" min={8} max={64} value={genLen} onChange={e=>setGenLen(Number(e.target.value))} style={{width:'100%',accentColor:'var(--green)'}} />
          <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
            {['8 (mín)','32 (rec)','64'].map(l => <span key={l} style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-muted)'}}>{l}</span>)}
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
          {[{k:'upper',l:'Maiúsculas (A-Z)'},{k:'lower',l:'Minúsculas (a-z)'},{k:'digits',l:'Números (0-9)'},{k:'special',l:'Símbolos (!@#$)'}].map(({k,l}) => (
            <label key={k} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg2)'}}>
              <input type="checkbox" checked={genOpts[k]} onChange={e=>setGenOpts(p=>({...p,[k]:e.target.checked}))} style={{accentColor:'var(--green)',width:14,height:14}} />
              <span style={{fontSize:13,color:'var(--text-dim)'}}>{l}</span>
            </label>
          ))}
        </div>

        <button onClick={()=>setGenerated(generatePassword(genLen,genOpts))} className="btn-primary" style={{width:'100%',padding:'13px',fontSize:14}}>
          ⚡ Gerar Senha
        </button>

        {generated && (
          <div style={{marginTop:14,padding:16,background:'var(--bg2)',borderRadius:10,border:'1px solid var(--border)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <code style={{fontFamily:'var(--font-mono)',fontSize:13,wordBreak:'break-all',color:'var(--text)',flex:1}}>{generated}</code>
              <button onClick={()=>handleCopy(generated)} style={{flexShrink:0,padding:'8px 14px',borderRadius:8,fontSize:12,fontFamily:'var(--font-mono)',cursor:'pointer',border:`1px solid ${copied?'rgba(0,230,118,0.3)':'var(--border2)'}`,background:copied?'rgba(0,230,118,0.1)':'var(--surface)',color:copied?'var(--green)':'var(--text-dim)',transition:'all 0.2s'}}>
                {copied?'✓ copiado':'copiar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
