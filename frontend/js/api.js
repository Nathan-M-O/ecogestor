const API_URL = 'http://localhost:3000';

function getToken() { return localStorage.getItem('token'); }
function setToken(t) { localStorage.setItem('token', t); }
function limparToken() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
}

async function apiFetch(caminho, opcoes = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opcoes.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const resp = await fetch(`${API_URL}${caminho}`, { ...opcoes, headers });

  if (resp.status === 401 && token && !caminho.includes('/auth/login')) {
    limparToken();
    sessionStorage.setItem('sessaoExpirada', '1');
    location.reload();
    throw new Error('Sessão expirada.');
  }

  if (resp.status === 204) return null;
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.mensagem || `Erro ${resp.status}`);
  return data;
}