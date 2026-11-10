// ============ LOGIN ============
async function fazerLogin() {
  const email = document.getElementById('login-email').value;
  const senha = document.getElementById('login-senha').value;
  const erroEl = document.getElementById('login-erro');
  erroEl.textContent = '';
  try {
    const data = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) });
    setToken(data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    iniciarApp();
  } catch (e) {
    erroEl.textContent = e.message;
  }
}

function logout() { limparToken(); location.reload(); }

function iniciarApp() {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('tela-app').style.display = 'block';
  document.getElementById('usuario-nome').textContent = usuario.nome || '';

  document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('ativo'));
      document.querySelectorAll('.conteudo').forEach(c => c.classList.remove('ativo'));
      tab.classList.add('ativo');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('ativo');
      carregarAba(tab.dataset.tab);
    };
  });

  carregarAba('dashboard');
}

function carregarAba(aba) {
  if (aba === 'dashboard') carregarDashboard();
  if (aba === 'agua') carregarAgua();
  if (aba === 'energia') carregarEnergia();
  if (aba === 'residuos') carregarResiduos();
  if (aba === 'iso') carregarIso();
  if (aba === 'relatorios') carregarRelatorios();
}

// ============ DASHBOARD ============
let chartDash = null;
async function carregarDashboard() {
  try {
    const r = await apiFetch('/api/relatorios/ambiental-mensal');
    document.getElementById('kpi-agua').textContent = r.agua.totalM3.toFixed(1);
    document.getElementById('kpi-energia').textContent = r.energia.totalKwh.toFixed(1);
    document.getElementById('kpi-reciclado').textContent = r.residuos.percentualReciclado.toFixed(1) + '%';
    document.getElementById('kpi-iso').textContent = r.iso14000.percentualConformidade.toFixed(1) + '%';

    const hist = await apiFetch('/api/relatorios/ambiental-mensal/historico');
    const meses = [...hist.agua].reverse().map(a => a.mes);
    const aguaData = [...hist.agua].reverse().map(a => a.total);

    if (chartDash) chartDash.destroy();
    chartDash = new Chart(document.getElementById('grafico-dashboard'), {
      type: 'line',
      data: {
        labels: meses,
        datasets: [{
          label: 'Consumo de Água (m³)',
          data: aguaData,
          borderColor: '#2e7d32',
          backgroundColor: 'rgba(46,125,50,.1)',
          tension: 0.3,
          fill: true
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  } catch (e) { alert('Erro ao carregar dashboard: ' + e.message); }
}

// ============ ÁGUA ============
async function carregarAgua() {
  try {
    const lista = await apiFetch('/api/agua');
    const tbody = document.querySelector('#tabela-agua tbody');
    tbody.innerHTML = lista.map(r => `
      <tr>
        <td>${r.data}</td><td>${r.setor}</td><td>${r.m3}</td>
        <td>
          <button class="btn-acao btn-editar" onclick="editarAgua(${r.id},'${r.data}','${r.setor}',${r.m3})">Editar</button>
          <button class="btn-acao btn-deletar" onclick="deletarAgua(${r.id})">Excluir</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="4">Nenhum registro</td></tr>';
  } catch (e) { alert(e.message); }
}

async function salvarAgua(ev) {
  ev.preventDefault();
  const id = document.getElementById('agua-id').value;
  const body = {
    data: document.getElementById('agua-data').value,
    setor: document.getElementById('agua-setor').value,
    m3: parseFloat(document.getElementById('agua-m3').value)
  };
  try {
    if (id) await apiFetch(`/api/agua/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    else await apiFetch('/api/agua', { method: 'POST', body: JSON.stringify(body) });
    limparFormAgua(); carregarAgua();
  } catch (e) { alert(e.message); }
}

function editarAgua(id, data, setor, m3) {
  document.getElementById('agua-id').value = id;
  document.getElementById('agua-data').value = data;
  document.getElementById('agua-setor').value = setor;
  document.getElementById('agua-m3').value = m3;
}

async function deletarAgua(id) {
  if (!confirm('Excluir este registro?')) return;
  try { await apiFetch(`/api/agua/${id}`, { method: 'DELETE' }); carregarAgua(); }
  catch (e) { alert(e.message); }
}

function limparFormAgua() {
  document.getElementById('agua-id').value = '';
  document.getElementById('agua-data').value = '';
  document.getElementById('agua-setor').value = '';
  document.getElementById('agua-m3').value = '';
}

// ============ ENERGIA ============
async function carregarEnergia() {
  try {
    const lista = await apiFetch('/api/energia');
    const tbody = document.querySelector('#tabela-energia tbody');
    tbody.innerHTML = lista.map(r => `
      <tr><td>${r.data}</td><td>${r.setor}</td><td>${r.kwh}</td>
      <td>
        <button class="btn-acao btn-editar" onclick="editarEnergia(${r.id},'${r.data}','${r.setor}',${r.kwh})">Editar</button>
        <button class="btn-acao btn-deletar" onclick="deletarEnergia(${r.id})">Excluir</button>
      </td></tr>`).join('') || '<tr><td colspan="4">Nenhum registro</td></tr>';
  } catch (e) { alert(e.message); }
}
async function salvarEnergia(ev) {
  ev.preventDefault();
  const id = document.getElementById('energia-id').value;
  const body = {
    data: document.getElementById('energia-data').value,
    setor: document.getElementById('energia-setor').value,
    kwh: parseFloat(document.getElementById('energia-kwh').value)
  };
  try {
    if (id) await apiFetch(`/api/energia/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    else await apiFetch('/api/energia', { method: 'POST', body: JSON.stringify(body) });
    limparFormEnergia(); carregarEnergia();
  } catch (e) { alert(e.message); }
}
function editarEnergia(id, data, setor, kwh) {
  document.getElementById('energia-id').value = id;
  document.getElementById('energia-data').value = data;
  document.getElementById('energia-setor').value = setor;
  document.getElementById('energia-kwh').value = kwh;
}
async function deletarEnergia(id) {
  if (!confirm('Excluir?')) return;
  try { await apiFetch(`/api/energia/${id}`, { method: 'DELETE' }); carregarEnergia(); } catch (e) { alert(e.message); }
}
function limparFormEnergia() {
  ['energia-id', 'energia-data', 'energia-setor', 'energia-kwh'].forEach(id => document.getElementById(id).value = '');
}

// ============ RESÍDUOS ============
async function carregarResiduos() {
  try {
    const lista = await apiFetch('/api/residuos');
    const tbody = document.querySelector('#tabela-residuos tbody');
    tbody.innerHTML = lista.map(r => `
      <tr><td>${r.data}</td><td>${r.tipo}</td><td>${r.kg}</td><td>${r.destinacao}</td>
      <td>
        <button class="btn-acao btn-editar" onclick="editarResiduo(${r.id},'${r.data}','${r.tipo}',${r.kg},'${r.destinacao}')">Editar</button>
        <button class="btn-acao btn-deletar" onclick="deletarResiduo(${r.id})">Excluir</button>
      </td></tr>`).join('') || '<tr><td colspan="5">Nenhum registro</td></tr>';
  } catch (e) { alert(e.message); }
}
async function salvarResiduo(ev) {
  ev.preventDefault();
  const id = document.getElementById('residuo-id').value;
  const body = {
    data: document.getElementById('residuo-data').value,
    tipo: document.getElementById('residuo-tipo').value,
    kg: parseFloat(document.getElementById('residuo-kg').value),
    destinacao: document.getElementById('residuo-destinacao').value
  };
  try {
    if (id) await apiFetch(`/api/residuos/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    else await apiFetch('/api/residuos', { method: 'POST', body: JSON.stringify(body) });
    limparFormResiduo(); carregarResiduos();
  } catch (e) { alert(e.message); }
}
function editarResiduo(id, data, tipo, kg, destinacao) {
  document.getElementById('residuo-id').value = id;
  document.getElementById('residuo-data').value = data;
  document.getElementById('residuo-tipo').value = tipo;
  document.getElementById('residuo-kg').value = kg;
  document.getElementById('residuo-destinacao').value = destinacao;
}
async function deletarResiduo(id) {
  if (!confirm('Excluir?')) return;
  try { await apiFetch(`/api/residuos/${id}`, { method: 'DELETE' }); carregarResiduos(); } catch (e) { alert(e.message); }
}
function limparFormResiduo() {
  ['residuo-id', 'residuo-data', 'residuo-tipo', 'residuo-kg', 'residuo-destinacao'].forEach(id => document.getElementById(id).value = '');
}

// ============ ISO ============
async function carregarIso() {
  try {
    const lista = await apiFetch('/api/iso');
    const tbody = document.querySelector('#tabela-iso tbody');
    tbody.innerHTML = lista.map(r => `
      <tr>
        <td>${r.requisito}</td>
        <td class="status-${r.status}">${r.status.replace('_', ' ')}</td>
        <td>
          <button class="btn-acao btn-editar" onclick="editarIso(${r.id},'${r.requisito}','${r.status}')">Editar</button>
          <button class="btn-acao btn-deletar" onclick="deletarIso(${r.id})">Excluir</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="3">Nenhum requisito</td></tr>';
  } catch (e) { alert(e.message); }
}
async function salvarIso(ev) {
  ev.preventDefault();
  const id = document.getElementById('iso-id').value;
  const body = {
    requisito: document.getElementById('iso-requisito').value,
    status: document.getElementById('iso-status').value
  };
  try {
    if (id) await apiFetch(`/api/iso/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    else await apiFetch('/api/iso', { method: 'POST', body: JSON.stringify(body) });
    limparFormIso(); carregarIso();
  } catch (e) { alert(e.message); }
}
function editarIso(id, req, status) {
  document.getElementById('iso-id').value = id;
  document.getElementById('iso-requisito').value = req;
  document.getElementById('iso-status').value = status;
}
async function deletarIso(id) {
  if (!confirm('Excluir?')) return;
  try { await apiFetch(`/api/iso/${id}`, { method: 'DELETE' }); carregarIso(); } catch (e) { alert(e.message); }
}
function limparFormIso() {
  ['iso-id', 'iso-requisito'].forEach(id => document.getElementById(id).value = '');
}

// ============ RELATÓRIOS ============
let chartRes = null, chartHist = null;
async function carregarRelatorios() {
  try {
    const r = await apiFetch('/api/relatorios/ambiental-mensal');
    document.getElementById('relatorio-json').textContent = JSON.stringify(r, null, 2);

    if (chartRes) chartRes.destroy();
    const reciclado = r.residuos.recicladoKg;
    const outro = r.residuos.totalKg - reciclado;
    chartRes = new Chart(document.getElementById('grafico-residuos'), {
      type: 'doughnut',
      data: {
        labels: ['Reciclado', 'Outras destinações'],
        datasets: [{ data: [reciclado, outro], backgroundColor: ['#2e7d32', '#e0e0e0'] }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Destinação de Resíduos' } } }
    });

    const hist = await apiFetch('/api/relatorios/ambiental-mensal/historico');
    const meses = [...hist.agua].reverse().map(a => a.mes);
    if (chartHist) chartHist.destroy();
    chartHist = new Chart(document.getElementById('grafico-historico'), {
      type: 'line',
      data: {
        labels: meses,
        datasets: [
          { label: 'Água (m³)', data: [...hist.agua].reverse().map(a => a.total), borderColor: '#1976d2', tension: .3 },
          { label: 'Energia (kWh)', data: [...hist.energia].reverse().map(a => a.total), borderColor: '#f57c00', tension: .3 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Histórico Mensal' } } }
    });
  } catch (e) { alert(e.message); }
}

// ============ INICIALIZAÇÃO ============
document.getElementById('login-senha').addEventListener('keydown', e => { if (e.key === 'Enter') fazerLogin(); });

if (getToken()) iniciarApp();