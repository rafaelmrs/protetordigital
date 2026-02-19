import { useState, useCallback } from 'react';

const WORKER_URL = '/api';

function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function formatCount(n) {
  if (n>=1e9) return `${(n/1e9).toFixed(1).replace('.',',')} bi`;
  if (n>=1e6) return `${(n/1e6).toFixed(1).replace('.',',')} mi`;
  if (n>=1e3) return `${(n/1e3).toFixed(0)} mil`;
  return n.toLocaleString('pt-BR');
}

const S = {
  card: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:24, marginBottom:16 },
  label: { fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 },
};

const severityColor = (s) => s==='high'?'var(--red)':s==='medium'?'var(--orange)':'var(--yellow)';
const severityBg = (s) => s==='high'?'rgba(255,23,68,0.06)':s==='medium'?'rgba(255,109,0,0.06)':'rgba(255,214,0,0.06)';
const severityBorder = (s) => s==='high'?'rgba(255,23,68,0.2)':s==='medium'?'rgba(255,109,0,0.2)':'rgba(255,214,0,0.2)';


const TRADUCAO_DADOS = {
  'email addresses': 'Endereços de e-mail',
  'passwords': 'Senhas',
  'ip addresses': 'Endereços IP',
  'names': 'Nomes',
  'usernames': 'Nomes de usuário',
  'phone numbers': 'Números de telefone',
  'physical addresses': 'Endereços físicos',
  'geographic locations': 'Localização geográfica',
  'dates of birth': 'Datas de nascimento',
  'genders': 'Gênero',
  'social media profiles': 'Perfis de redes sociais',
  'website activity': 'Atividade no site',
  'account balances': 'Saldo em conta',
  'credit cards': 'Cartões de crédito',
  'bank account numbers': 'Números de conta bancária',
  'credit card cvv': 'CVV de cartão',
  'personal health data': 'Dados de saúde',
  'historical passwords': 'Senhas históricas',
  'security questions and answers': 'Perguntas de segurança',
  'auth tokens': 'Tokens de autenticação',
  'device information': 'Informações de dispositivo',
  'browsing histories': 'Histórico de navegação',
  'purchases': 'Compras',
  'partial credit card data': 'Dados parciais de cartão',
  'social security numbers': 'CPF/Número de seguridade social',
  'education levels': 'Nível de educação',
  'sexual orientations': 'Orientação sexual',
  'employment statuses': 'Status de emprego',
  'ethnicities': 'Etnia',
  'religions': 'Religião',
  'political views': 'Visões políticas',
  'income levels': 'Nível de renda',
  'ages': 'Idades',
  'avatar': 'Fotos de perfil',
};

function traduzirDado(d) {
  return TRADUCAO_DADOS[d.toLowerCase()] || d;
}



// Traduções manuais dos principais breaches (sem depender de API)
const TRADUCAO_BREACHES = {
  '000webhost': 'Em março de 2015, o provedor de hospedagem gratuita 000webhost sofreu um grande vazamento que expôs cerca de 15 milhões de registros de clientes. Os dados incluíam nomes, endereços de e-mail e senhas armazenadas em texto puro, sem nenhuma proteção criptográfica.',
  'adobe': 'Em outubro de 2013, a Adobe sofreu um vazamento massivo que afetou 153 milhões de registros de usuários. Foram expostos IDs internos, nomes de usuário, e-mails, senhas criptografadas e dicas de senha em texto puro. A fraca criptografia usada permitiu que muitas senhas fossem recuperadas.',
  'canva': 'Em maio de 2019, a plataforma australiana de design gráfico Canva sofreu um ataque que expôs dados de 137 milhões de usuários. Foram comprometidos nomes, endereços de e-mail, cidades de origem, senhas com hash e nomes de usuário do Google.',
  'collection #1': 'Em janeiro de 2019, uma enorme coleção de 773 milhões de e-mails e 21 milhões de senhas únicas foi encontrada em um serviço de armazenamento na nuvem. Apelidada de "Collection #1", trata-se de uma compilação de múltiplos vazamentos anteriores.',
  'dropbox': 'Em meados de 2012, o Dropbox sofreu um vazamento que expôs 68 milhões de registros de clientes. Os dados incluíam endereços de e-mail e senhas protegidas com hash. O incidente só veio a público em 2016.',
  'dubsmash': 'Em dezembro de 2018, o aplicativo de vídeo Dubsmash teve 162 milhões de registros de usuários roubados. Foram expostos endereços de e-mail, nomes de usuário e senhas com hash SHA-256.',
  'facebook': 'Em abril de 2021, dados de 533 milhões de usuários do Facebook foram publicados gratuitamente em fóruns de hackers. As informações incluíam números de telefone, nomes completos, localizações, datas de nascimento e endereços de e-mail.',
  'linkedin': 'Em junho de 2021, um conjunto de dados com informações de 700 milhões de usuários do LinkedIn foi colocado à venda na dark web. Os dados incluíam e-mails, números de telefone, endereços, dados de geolocalização e histórico profissional.',
  'myspace': 'Em 2008, o MySpace sofreu um vazamento que só veio a público em 2016. Foram expostos 360 milhões de contas com combinações de e-mail, nome de usuário e senhas com hash SHA1.',
  'neopets': 'Em julho de 2022, um hacker alegou ter roubado o banco de dados do Neopets contendo 69 milhões de registros de membros. Os dados incluíam nomes, e-mails, datas de nascimento, gênero, país, data de cadastro, senhas com hash MD5 e muito mais.',
  'twitter': 'Em 2022, uma vulnerabilidade no Twitter foi explorada para coletar dados de 5,4 milhões de contas. Foram expostos números de telefone, endereços de e-mail e informações de perfil. Os dados foram publicados gratuitamente em 2023.',
  'yahoo': 'Em 2013 e 2014, o Yahoo sofreu os dois maiores vazamentos da história até então, comprometendo 3 bilhões de contas no total. Foram expostos nomes, endereços de e-mail, datas de nascimento, números de telefone e perguntas de segurança.',
  'zynga': 'Em setembro de 2019, a empresa de jogos Zynga (criadora do FarmVille) sofreu um vazamento que expôs 173 milhões de registros. Foram comprometidos nomes, endereços de e-mail, IDs de login, hashes de senha e números de telefone de alguns usuários.',
  'haveibeenpwned': 'Dados desta conta foram encontrados em um ou mais vazamentos catalogados pelo Have I Been Pwned, banco de dados global de segurança digital.',
};

function traduzirBreachManual(nome, descricaoOriginal) {
  const key = nome?.toLowerCase();
  // Procurar por correspondência parcial
  for (const [k, v] of Object.entries(TRADUCAO_BREACHES)) {
    if (key?.includes(k)) return v;
  }
  return null; // Sem tradução manual → usar API
}

async function traduzirTexto(texto) {
  if (!texto || texto.length < 10) return texto;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto.slice(0,500))}&langpair=en|pt-BR&de=dev.protetordigital@outlook.com`;
    const res = await fetch(url);
    const data = await res.json();
    if (data?.responseStatus === 200 && data?.responseData?.translatedText) {
      return data.responseData.translatedText;
    }
  } catch {}
  return texto;
}

export default function BreachChecker() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const check = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    if (!isValidEmail(trimmed)) { setError('Email inválido. Digite um email completo.'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch(`${WORKER_URL}/breach`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:trimmed}) });
      if (res.status===429) throw new Error('Muitas consultas. Aguarde alguns minutos.');
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      // Traduzir descrições dos breaches para PT-BR
      if (data.breaches && data.breaches.length > 0) {
        const translated = await Promise.all(
          data.breaches.map(async (b) => {
            const manual = traduzirBreachManual(b.name, b.description);
            const desc = manual || (b.description ? await traduzirTexto(b.description) : '');
            return { ...b, description: desc };
          })
        );
        data.breaches = translated;
      }
      setResult({...data, email:trimmed, checkedAt:new Date()});
    } catch(err) { setError(err.message||'Erro ao verificar. Tente novamente.'); }
    finally { setLoading(false); }
  }, [email]);

  const totalPwned = result?.breaches?.reduce((acc,b)=>acc+(b.pwnCount||0),0)||0;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* Input */}
      <div style={S.card}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
          <p style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:16,color:'var(--text)'}}>Verificador de Vazamentos</p>
          <span style={{fontFamily:'var(--font-mono)',fontSize:11,padding:'2px 8px',borderRadius:4,background:'rgba(255,109,0,0.1)',color:'var(--orange)',border:'1px solid rgba(255,109,0,0.2)'}}>HIBP v3</span>
        </div>
        <p style={{fontSize:14,color:'var(--text-dim)',marginBottom:16,lineHeight:1.6}}>Verifique se seu email apareceu em algum dos 700+ vazamentos catalogados pelo Have I Been Pwned.</p>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <input
            type="email"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&check()}
            placeholder="seuemail@exemplo.com"
            className="input"
            style={{flex:'1 1 200px',minWidth:0}}
            aria-label="Email para verificar"
          />
          <button onClick={check} disabled={loading||!email.trim()} className="btn-primary" style={{padding:'12px 20px',fontSize:14,flexShrink:0}}>
            {loading ? <span style={{width:16,height:16,border:'2px solid rgba(0,0,0,0.2)',borderTopColor:'#060a0e',borderRadius:'50%',animation:'spin 0.7s linear infinite',display:'inline-block'}}/> : '🔍 Verificar'}
          </button>
        </div>
        {error && <p style={{marginTop:10,fontSize:13,color:'var(--red)'}}> ⚠️ {error}</p>}
        <p style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-muted)',marginTop:10}}>
          Powered by Have I Been Pwned (HIBP) — 15 bi+ registros em mais de 700 vazamentos
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{...S.card,display:'flex',alignItems:'center',gap:16}}>
          <div style={{width:40,height:40,border:'3px solid var(--border2)',borderTopColor:'var(--orange)',borderRadius:'50%',animation:'spin 0.7s linear infinite',flexShrink:0}}/>
          <div>
            <p style={{fontFamily:'var(--font-display)',fontWeight:600,color:'var(--text)',marginBottom:4}}>Verificando...</p>
            <p style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--text-muted)'}}>Consultando Have I Been Pwned</p>
          </div>
        </div>
      )}

      {/* Clean result */}
      {result && !loading && result.breaches?.length===0 && (
        <div style={{...S.card,borderColor:'rgba(0,230,118,0.25)',background:'rgba(0,230,118,0.04)',animation:'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)'}}>
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            <div style={{width:52,height:52,borderRadius:12,background:'rgba(0,230,118,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,flexShrink:0}}>🎉</div>
            <div>
              <p style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:18,color:'var(--green)',marginBottom:4}}>Boa notícia!</p>
              <p style={{fontSize:14,color:'var(--text-dim)',lineHeight:1.5}}>
                <strong style={{color:'var(--text)'}}>{result.email}</strong> não foi encontrado em nenhum vazamento público conhecido.
              </p>
              <p style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-muted)',marginTop:8}}>Verificado em {result.checkedAt?.toLocaleString('pt-BR')} · Fonte: HIBP</p>
            </div>
          </div>
        </div>
      )}

      {/* Breaches found */}
      {result && !loading && result.breaches?.length>0 && (
        <div style={{display:'flex',flexDirection:'column',gap:14,animation:'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)'}}>
          {/* Summary */}
          <div style={{...S.card,borderColor:'rgba(255,23,68,0.25)',background:'rgba(255,23,68,0.04)'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:16}}>
              <div style={{width:52,height:52,borderRadius:12,background:'rgba(255,23,68,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0}}>🚨</div>
              <div>
                <p style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:18,color:'var(--red)',marginBottom:4}}>{result.breaches.length} vazamento{result.breaches.length>1?'s':''} encontrado{result.breaches.length>1?'s':''}</p>
                <p style={{fontSize:14,color:'var(--text-dim)'}}>Seu email <strong style={{color:'var(--text)'}}>{result.email}</strong> foi exposto em incidentes de segurança.</p>
                {totalPwned>0 && <p style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--red)',marginTop:6}}>Total estimado: {formatCount(totalPwned)} registros comprometidos</p>}
              </div>
            </div>
          </div>

          {/* Breach list */}
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {result.breaches.map((b,i) => (
              <div key={i} style={{...S.card,padding:18,borderColor:severityBorder(b.severity),background:severityBg(b.severity),marginBottom:0}}>
                <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:8,marginBottom:10}}>
                  <p style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:15,color:'var(--text)'}}>{b.title||b.name}</p>
                  {b.date && <span style={{fontFamily:'var(--font-mono)',fontSize:11,padding:'2px 7px',borderRadius:4,background:'var(--surface2)',color:'var(--text-muted)',border:'1px solid var(--border)'}}>{new Date(b.date).toLocaleDateString('pt-BR',{year:'numeric',month:'short'})}</span>}
                  {b.pwnCount && <span style={{fontFamily:'var(--font-mono)',fontSize:11,padding:'2px 7px',borderRadius:4,background:severityBg(b.severity),color:severityColor(b.severity),border:`1px solid ${severityBorder(b.severity)}`}}>{formatCount(b.pwnCount)} registros</span>}
                  {b.isVerified && <span style={{fontFamily:'var(--font-mono)',fontSize:11,padding:'2px 7px',borderRadius:4,background:'rgba(0,229,255,0.08)',color:'var(--cyan)',border:'1px solid rgba(0,229,255,0.2)'}}>✓ Verificado</span>}
                </div>
                {b.exposedData?.length>0 && (
                  <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
                    {b.exposedData.map((d,j) => <span key={j} style={{fontFamily:'var(--font-mono)',fontSize:11,padding:'2px 7px',borderRadius:4,background:'var(--surface)',color:'var(--text-dim)',border:'1px solid var(--border)'}}>{traduzirDado(d)}</span>)}
                  </div>
                )}
                {b.description && <p style={{fontSize:13,color:'var(--text-dim)',lineHeight:1.6,marginBottom:10,display:'block'}}>{b.description}</p>}
                <div style={{padding:'10px 12px',borderRadius:8,background:'var(--surface)',border:'1px solid var(--border)'}}>
                  <p style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-muted)',marginBottom:4}}>{'>'} ação recomendada</p>
                  <p style={{fontSize:13,color:'var(--text-dim)'}}>
                    {b.severity==='high'?'Troque a senha IMEDIATAMENTE e monitore dados bancários.':b.severity==='medium'?'Troque a senha e de qualquer conta onde usou a mesma.':'Troque a senha por precaução e ative 2FA neste serviço.'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* LGPD */}
          <div style={{...S.card,borderColor:'rgba(0,229,255,0.2)',background:'rgba(0,229,255,0.03)'}}>
            <p style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:14,color:'var(--cyan)',marginBottom:12}}>⚖️ Seus Direitos pela LGPD</p>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {['Solicite exclusão dos dados nas empresas afetadas','Registre ocorrência na ANPD: gov.br/anpd/reclamacoes','Com dano comprovado, você pode entrar com ação indenizatória','Ative o 2FA imediatamente em todas as contas'].map((r,i) => (
                <p key={i} style={{fontSize:13,color:'var(--text-dim)',display:'flex',gap:8,alignItems:'flex-start'}}>
                  <span style={{color:'var(--cyan)',flexShrink:0}}>→</span>{r}
                </p>
              ))}
            </div>
          </div>

          {/* Checklist */}
          <div style={S.card}>
            <p style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:14,color:'var(--text)',marginBottom:14}}>✅ Checklist de Ações Imediatas</p>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {['Trocar senha do(s) serviço(s) afetado(s)','Trocar senha de qualquer conta onde usou a mesma senha','Ativar autenticação de dois fatores (2FA)','Verificar se há atividade suspeita nas contas','Monitorar CPF no Registrato (Banco Central)','Registrar alerta de crédito no Serasa/SPC'].map((a,i) => (
                <label key={i} style={{display:'flex',alignItems:'flex-start',gap:10,cursor:'pointer',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                  <input type="checkbox" style={{accentColor:'var(--green)',marginTop:2,width:14,height:14,flexShrink:0}} />
                  <span style={{fontSize:13,color:'var(--text-dim)'}}>{a}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
