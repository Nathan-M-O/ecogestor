// ============ VERIFICAÇÃO DE SESSÃO ============
function tokenExpirado() {
  const token = getToken();
  if (!token) return true;
  try {
    const partes = token.split('.');
    if (partes.length !== 3) return true;
    const payload = JSON.parse(atob(partes[1]));
    if (!payload.exp) return true;
    return (payload.exp * 1000) <= Date.now();
  } catch {
    return true;
  }
}

// ============ PAGINAÇÃO E BUSCA ============
const pag = {
  agua:     { pagina: 1, limite: 10, totalPaginas: 1 },
  energia:  { pagina: 1, limite: 10, totalPaginas: 1 },
  residuos: { pagina: 1, limite: 10, totalPaginas: 1 },
  iso:      { pagina: 1, limite: 10, totalPaginas: 1 }
};

const buscaState = { agua: '', energia: '', residuos: '', iso: '' };
const buscaTimers = { agua: null, energia: null, residuos: null, iso: null };

function renderPaginacao(aba, resposta) {
  pag[aba].totalPaginas = resposta.totalPaginas || 1;
  const info = document.getElementById(`pag-info-${aba}`);
  if (info) {
    info.textContent = `Página ${resposta.pagina} de ${resposta.totalPaginas || 1} — ${resposta.total} registros`;
  }
  const btnAnt = document.querySelector(`#pag-${aba} .btn-anterior`);
  const btnProx = document.querySelector(`#pag-${aba} .btn-proxima`);
  if (btnAnt) btnAnt.disabled = resposta.pagina <= 1;
  if (btnProx) btnProx.disabled = resposta.pagina >= (resposta.totalPaginas || 1);
}

function mudarPagina(aba, delta) {
  const nova = pag[aba].pagina + delta;
  if (nova < 1 || nova > pag[aba].totalPaginas) return;
  pag[aba].pagina = nova;
  if (aba === 'agua') carregarAgua();
  if (aba === 'energia') carregarEnergia();
  if (aba === 'residuos') carregarResiduos();
  if (aba === 'iso') carregarIso();
}

function mudarLimite(aba, valor) {
  pag[aba].limite = parseInt(valor) || 10;
  pag[aba].pagina = 1;
  if (aba === 'agua') carregarAgua();
  if (aba === 'energia') carregarEnergia();
  if (aba === 'residuos') carregarResiduos();
  if (aba === 'iso') carregarIso();
}

function aoBuscar(aba, valor) {
  buscaState[aba] = valor;
  clearTimeout(buscaTimers[aba]);
  buscaTimers[aba] = setTimeout(() => {
    if (aba === 'agua') carregarAgua();
    if (aba === 'energia') carregarEnergia();
    if (aba === 'residuos') carregarResiduos();
    if (aba === 'iso') carregarIso();
  }, 250);
}

function atualizarBuscaInfo(aba, qtdResultados, termo) {
  const infoEl = document.getElementById(`busca-info-${aba}`);
  const pagEl = document.getElementById(`pag-${aba}`);
  if (!infoEl || !pagEl) return;

  if (termo) {
    pagEl.style.display = 'none';
    infoEl.textContent = `🔍 ${qtdResultados} resultado(s) para "${termo}"`;
    infoEl.style.display = 'inline';
  } else {
    pagEl.style.display = '';
    infoEl.textContent = '';
    infoEl.style.display = 'none';
  }
}

function filtrarLocal(dados, termo) {
  const t = termo.toLowerCase();
  return dados.filter(d =>
    Object.values(d).some(v => String(v ?? '').toLowerCase().includes(t))
  );
}

// ============ CSV ============
function baixarCSV(conteudo, nomeArquivo) {
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportarCSV(recurso) {
  try {
    const resposta = await apiFetch(`/api/${recurso}?pagina=1&limite=100`);
    const dados = resposta.dados;
    if (!dados || dados.length === 0) {
      alert('Nenhum dado para exportar.');
      return;
    }
    const config = {
      agua:     { colunas: ['id','data','setor','m3'],              header: ['ID','Data','Setor','m3'] },
      energia:  { colunas: ['id','data','setor','kwh'],             header: ['ID','Data','Setor','kWh'] },
      residuos: { colunas: ['id','data','tipo','kg','destinacao'],  header: ['ID','Data','Tipo','kg','Destinacao'] },
      iso:      { colunas: ['id','requisito','status'],             header: ['ID','Requisito','Status'] }
    };
    const cfg = config[recurso];
    const linhas = [cfg.header.join(';')];
    dados.forEach(d => {
      linhas.push(cfg.colunas.map(c => {
        const s = String(d[c] ?? '');
        return s.includes(';') || s.includes(',') || s.includes('"')
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      }).join(';'));
    });
    const dataArq = new Date().toISOString().slice(0, 10);
    baixarCSV('\uFEFF' + linhas.join('\r\n'), `ecogestor_${recurso}_${dataArq}.csv`);
  } catch (e) {
    alert('Erro ao exportar: ' + e.message);
  }
}

async function exportarRelatorioConsolidado() {
  try {
    const r = await apiFetch('/api/relatorios/ambiental-mensal');
    const linhas = [
      ['Indicador', 'Valor', 'Unidade'],
      ['Mes de referencia', r.mes, ''],
      ['Total de agua', r.agua.totalM3.toFixed(2), 'm3'],
      ['Registros de agua', r.agua.registros, 'registros'],
      ['Total de energia', r.energia.totalKwh.toFixed(2), 'kWh'],
      ['Registros de energia', r.energia.registros, 'registros'],
      ['Total de residuos', r.residuos.totalKg.toFixed(2), 'kg'],
      ['Residuos reciclados', r.residuos.recicladoKg.toFixed(2), 'kg'],
      ['Percentual reciclado', r.residuos.percentualReciclado.toFixed(2), '%'],
      ['Conformidade ISO 14000', r.iso14000.percentualConformidade.toFixed(2), '%'],
      ['Requisitos conformes', `${r.iso14000.conformes}/${r.iso14000.total}`, ''],
      ['Pegada de carbono', r.pegadaCarbono.totalKgCO2e.toFixed(2), 'kg CO2e']
    ];
    baixarCSV('\uFEFF' + linhas.map(l => l.join(';')).join('\r\n'), `ecogestor_relatorio_${r.mes}.csv`);
  } catch (e) {
    alert('Erro ao exportar relatorio: ' + e.message);
  }
}

// ============ LOGIN ============
async function fazerLogin() {
  const email = document.getElementById('login-email').value;
  const senha = document.getElementById('login-senha').value;
  const erroEl = document.getElementById('login-erro');
  erroEl.textContent = '';
  try {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha })
    });
    setToken(data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    iniciarApp();
  } catch (e) {
    erroEl.textContent = e.message;
  }
}

function logout() {
  limparToken();
  location.reload();
}

function iniciarApp() {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const perfil = usuario.perfil || 'stakeholder';

  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('tela-app').style.display = 'block';
  document.getElementById('usuario-nome').textContent = usuario.nome || '';

  document.body.className = 'perfil-' + perfil;

  const badge = document.getElementById('usuario-perfil');
  badge.textContent = perfil.toUpperCase();
  badge.className = 'perfil-badge perfil-badge-' + perfil;

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
let chartDash = null, chartEnergia = null;
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
    const energiaData = [...hist.energia].reverse().map(a => a.total);

    if (chartDash) chartDash.destroy();
    chartDash = new Chart(document.getElementById('grafico-dashboard'), {
      type: 'line',
      data: {
        labels: meses,
        datasets: [{
          label: 'Consumo de Água (m³)',
          data: aguaData,
          borderColor: '#2e7d32',
          backgroundColor: 'rgba(46,125,50,.15)',
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { title: { display: true, text: 'Consumo de Água (m³) — Últimos 6 meses' } }
      }
    });

    if (chartEnergia) chartEnergia.destroy();
    chartEnergia = new Chart(document.getElementById('grafico-energia'), {
      type: 'bar',
      data: {
        labels: meses,
        datasets: [{
          label: 'Consumo de Energia (kWh)',
          data: energiaData,
          backgroundColor: 'rgba(245,124,0,.75)',
          borderColor: '#f57c00',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { title: { display: true, text: 'Consumo de Energia (kWh) — Últimos 6 meses' } },
        scales: { y: { beginAtZero: true } }
      }
    });

    carregarAlertasDashboard();
  } catch (e) {
    alert('Erro ao carregar dashboard: ' + e.message);
  }
}

async function carregarAlertasDashboard() {
  try {
    const dados = await apiFetch('/api/relatorios/ambiental-mensal/variacao');
    const container = document.getElementById('alertas-dashboard');
    if (!container) return;

    if (!dados.alertas || dados.alertas.length === 0) {
      container.innerHTML = `
        <h3>✓ Alertas Ambientais</h3>
        <p class="sem-alertas">Nenhum alerta no período. Sistema em conformidade.</p>
      `;
      return;
    }

    container.innerHTML = `
      <h3>⚠ Alertas Ambientais (${dados.alertas.length})</h3>
      <ul class="lista-alertas">
        ${dados.alertas.map(a => `
          <li class="alerta alerta-${a.severidade}">
            <span class="alerta-badge">${a.severidade === 'alta' ? 'ALTA' : 'MÉDIA'}</span>
            <span>${a.mensagem}</span>
          </li>
        `).join('')}
      </ul>
    `;
  } catch (e) {
    const container = document.getElementById('alertas-dashboard');
    if (container) {
      container.innerHTML = `
        <h3>⚠ Alertas Ambientais</h3>
        <p class="sem-alertas">Não foi possível carregar os alertas: ${e.message}</p>
      `;
    }
    console.error('Erro ao carregar alertas:', e);
  }
}

// ============ ÁGUA ============
async function carregarAgua() {
  try {
    const termo = buscaState.agua.trim();
    const usandoBusca = termo !== '';
    const url = usandoBusca
      ? `/api/agua?pagina=1&limite=100`
      : `/api/agua?pagina=${pag.agua.pagina}&limite=${pag.agua.limite}`;

    let resposta = await apiFetch(url);
    let dados = resposta.dados;

    if (!usandoBusca && dados.length === 0 && pag.agua.pagina > 1) {
      pag.agua.pagina--;
      resposta = await apiFetch(`/api/agua?pagina=${pag.agua.pagina}&limite=${pag.agua.limite}`);
      dados = resposta.dados;
    }

    if (usandoBusca) {
      dados = filtrarLocal(dados, termo);
      atualizarBuscaInfo('agua', dados.length, termo);
    } else {
      atualizarBuscaInfo('agua', 0, '');
      renderPaginacao('agua', resposta);
    }

    const tbody = document.querySelector('#tabela-agua tbody');
    tbody.innerHTML = dados.map(r => `
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
    if (id) {
      await apiFetch(`/api/agua/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      await apiFetch('/api/agua', { method: 'POST', body: JSON.stringify(body) });
      pag.agua.pagina = 1;
    }
    limparFormAgua();
    carregarAgua();
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
  try {
    await apiFetch(`/api/agua/${id}`, { method: 'DELETE' });
    carregarAgua();
  } catch (e) { alert(e.message); }
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
    const termo = buscaState.energia.trim();
    const usandoBusca = termo !== '';
    const url = usandoBusca
      ? `/api/energia?pagina=1&limite=100`
      : `/api/energia?pagina=${pag.energia.pagina}&limite=${pag.energia.limite}`;

    let resposta = await apiFetch(url);
    let dados = resposta.dados;

    if (!usandoBusca && dados.length === 0 && pag.energia.pagina > 1) {
      pag.energia.pagina--;
      resposta = await apiFetch(`/api/energia?pagina=${pag.energia.pagina}&limite=${pag.energia.limite}`);
      dados = resposta.dados;
    }

    if (usandoBusca) {
      dados = filtrarLocal(dados, termo);
      atualizarBuscaInfo('energia', dados.length, termo);
    } else {
      atualizarBuscaInfo('energia', 0, '');
      renderPaginacao('energia', resposta);
    }

    const tbody = document.querySelector('#tabela-energia tbody');
    tbody.innerHTML = dados.map(r => `
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
    if (id) {
      await apiFetch(`/api/energia/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      await apiFetch('/api/energia', { method: 'POST', body: JSON.stringify(body) });
      pag.energia.pagina = 1;
    }
    limparFormEnergia();
    carregarEnergia();
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
  try {
    await apiFetch(`/api/energia/${id}`, { method: 'DELETE' });
    carregarEnergia();
  } catch (e) { alert(e.message); }
}

function limparFormEnergia() {
  ['energia-id', 'energia-data', 'energia-setor', 'energia-kwh']
    .forEach(id => document.getElementById(id).value = '');
}

// ============ RESÍDUOS ============
async function carregarResiduos() {
  try {
    const termo = buscaState.residuos.trim();
    const usandoBusca = termo !== '';
    const url = usandoBusca
      ? `/api/residuos?pagina=1&limite=100`
      : `/api/residuos?pagina=${pag.residuos.pagina}&limite=${pag.residuos.limite}`;

    let resposta = await apiFetch(url);
    let dados = resposta.dados;

    if (!usandoBusca && dados.length === 0 && pag.residuos.pagina > 1) {
      pag.residuos.pagina--;
      resposta = await apiFetch(`/api/residuos?pagina=${pag.residuos.pagina}&limite=${pag.residuos.limite}`);
      dados = resposta.dados;
    }

    if (usandoBusca) {
      dados = filtrarLocal(dados, termo);
      atualizarBuscaInfo('residuos', dados.length, termo);
    } else {
      atualizarBuscaInfo('residuos', 0, '');
      renderPaginacao('residuos', resposta);
    }

    const tbody = document.querySelector('#tabela-residuos tbody');
    tbody.innerHTML = dados.map(r => `
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
    if (id) {
      await apiFetch(`/api/residuos/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      await apiFetch('/api/residuos', { method: 'POST', body: JSON.stringify(body) });
      pag.residuos.pagina = 1;
    }
    limparFormResiduo();
    carregarResiduos();
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
  try {
    await apiFetch(`/api/residuos/${id}`, { method: 'DELETE' });
    carregarResiduos();
  } catch (e) { alert(e.message); }
}

function limparFormResiduo() {
  ['residuo-id', 'residuo-data', 'residuo-tipo', 'residuo-kg', 'residuo-destinacao']
    .forEach(id => document.getElementById(id).value = '');
}

// ============ ISO ============
async function carregarIso() {
  try {
    const termo = buscaState.iso.trim();
    const usandoBusca = termo !== '';
    const url = usandoBusca
      ? `/api/iso?pagina=1&limite=100`
      : `/api/iso?pagina=${pag.iso.pagina}&limite=${pag.iso.limite}`;

    let resposta = await apiFetch(url);
    let dados = resposta.dados;

    if (!usandoBusca && dados.length === 0 && pag.iso.pagina > 1) {
      pag.iso.pagina--;
      resposta = await apiFetch(`/api/iso?pagina=${pag.iso.pagina}&limite=${pag.iso.limite}`);
      dados = resposta.dados;
    }

    if (usandoBusca) {
      dados = filtrarLocal(dados, termo);
      atualizarBuscaInfo('iso', dados.length, termo);
    } else {
      atualizarBuscaInfo('iso', 0, '');
      renderPaginacao('iso', resposta);
    }

    const tbody = document.querySelector('#tabela-iso tbody');
    tbody.innerHTML = dados.map(r => `
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
    if (id) {
      await apiFetch(`/api/iso/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      await apiFetch('/api/iso', { method: 'POST', body: JSON.stringify(body) });
      pag.iso.pagina = 1;
    }
    limparFormIso();
    carregarIso();
  } catch (e) { alert(e.message); }
}

function editarIso(id, req, status) {
  document.getElementById('iso-id').value = id;
  document.getElementById('iso-requisito').value = req;
  document.getElementById('iso-status').value = status;
}

async function deletarIso(id) {
  if (!confirm('Excluir?')) return;
  try {
    await apiFetch(`/api/iso/${id}`, { method: 'DELETE' });
    carregarIso();
  } catch (e) { alert(e.message); }
}

function limparFormIso() {
  ['iso-id', 'iso-requisito'].forEach(id => document.getElementById(id).value = '');
}

// ============ RELATÓRIOS ============
let chartRes = null, chartHist = null;
async function carregarRelatorios() {
  try {
    const r = await apiFetch('/api/relatorios/ambiental-mensal');

    const nomesMeses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const [ano, mesNum] = r.mes.split('-');
    const mesNome = nomesMeses[parseInt(mesNum) - 1];

    document.getElementById('relatorio-formatado').innerHTML = `
      <div class="relatorio-header">
        <h3>Indicadores Consolidados</h3>
        <span class="relatorio-periodo">${mesNome} de ${ano}</span>
      </div>
      <div class="relatorio-grid">
        <div class="relatorio-item">
          <span class="relatorio-icone">💧</span>
          <div>
            <span class="relatorio-label">Consumo de Água</span>
            <span class="relatorio-valor">${r.agua.totalM3.toFixed(2)} m³</span>
            <span class="relatorio-detalhe">${r.agua.registros} registro(s) no mês</span>
          </div>
        </div>
        <div class="relatorio-item">
          <span class="relatorio-icone">⚡</span>
          <div>
            <span class="relatorio-label">Consumo de Energia</span>
            <span class="relatorio-valor">${r.energia.totalKwh.toFixed(2)} kWh</span>
            <span class="relatorio-detalhe">${r.energia.registros} registro(s) no mês</span>
          </div>
        </div>
        <div class="relatorio-item">
          <span class="relatorio-icone">♻️</span>
          <div>
            <span class="relatorio-label">Resíduos Gerados</span>
            <span class="relatorio-valor">${r.residuos.totalKg.toFixed(2)} kg</span>
            <span class="relatorio-detalhe">${r.residuos.recicladoKg.toFixed(2)} kg reciclados (${r.residuos.percentualReciclado.toFixed(1)}%)</span>
          </div>
        </div>
        <div class="relatorio-item">
          <span class="relatorio-icone">✅</span>
          <div>
            <span class="relatorio-label">Conformidade ISO 14.000</span>
            <span class="relatorio-valor">${r.iso14000.percentualConformidade.toFixed(1)}%</span>
            <span class="relatorio-detalhe">${r.iso14000.conformes} de ${r.iso14000.total} requisitos conformes</span>
          </div>
        </div>
        <div class="relatorio-item relatorio-item-full">
          <span class="relatorio-icone">🌍</span>
          <div>
            <span class="relatorio-label">Pegada de Carbono Simplificada</span>
            <span class="relatorio-valor">${r.pegadaCarbono.totalKgCO2e.toFixed(2)} kg CO₂e</span>
            <span class="relatorio-detalhe">Cálculo: (kWh × 0,0842) + (m³ × 0,0003)</span>
          </div>
        </div>
      </div>
    `;

    if (chartRes) chartRes.destroy();
    const reciclado = r.residuos.recicladoKg;
    const outro = r.residuos.totalKg - reciclado;
    chartRes = new Chart(document.getElementById('grafico-residuos'), {
      type: 'doughnut',
      data: {
        labels: ['Reciclado', 'Outras destinações'],
        datasets: [{ data: [reciclado, outro], backgroundColor: ['#2e7d32', '#e0e0e0'] }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { title: { display: true, text: 'Destinação de Resíduos' } }
      }
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
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { title: { display: true, text: 'Histórico Mensal' } }
      }
    });
  } catch (e) { alert(e.message); }
}

// ============ INICIALIZAÇÃO ============
document.getElementById('login-senha')
  .addEventListener('keydown', e => { if (e.key === 'Enter') fazerLogin(); });

if (sessionStorage.getItem('sessaoExpirada') === '1') {
  document.getElementById('login-erro').textContent = 'Sessão expirada. Faça login novamente.';
  sessionStorage.removeItem('sessaoExpirada');
}

if (getToken() && !tokenExpirado()) {
  iniciarApp();
} else {
  limparToken();
}