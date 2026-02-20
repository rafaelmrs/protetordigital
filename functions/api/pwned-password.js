// functions/api/pwned-password.js
// DEPRECADO — o PasswordAnalyzer.jsx agora chama a API do HIBP diretamente do navegador.
// Este arquivo é mantido apenas por compatibilidade. Pode ser removido com segurança.
export async function onRequestPost() {
  return new Response(JSON.stringify({ error: 'Endpoint removido. Use a API HIBP diretamente.' }), {
    status: 410,
    headers: { 'Content-Type': 'application/json' },
  });
}
