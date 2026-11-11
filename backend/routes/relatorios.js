import { Router } from 'express';
import db from '../db.js';
import { verificarToken } from '../auth.js';

const router = Router();
router.use(verificarToken);

/**
 * @swagger
 * /api/relatorios/ambiental-mensal:
 *   get:
 *     summary: Relatório consolidado de indicadores ambientais do mês
 *     tags: [Relatórios]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: mes
 *         schema: { type: string, example: "2025-11" }
 *     responses:
 *       200: { description: Indicadores consolidados }
 */
router.get('/ambiental-mensal', (req, res) => {
  const mes = req.query.mes || new Date().toISOString().slice(0, 7);
  const agua = db.prepare('SELECT COALESCE(SUM(m3),0) t, COUNT(*) q FROM agua WHERE data LIKE ?').get(`${mes}%`);
  const energia = db.prepare('SELECT COALESCE(SUM(kwh),0) t, COUNT(*) q FROM energia WHERE data LIKE ?').get(`${mes}%`);
  const residuosTot = db.prepare('SELECT COALESCE(SUM(kg),0) t, COUNT(*) q FROM residuos WHERE data LIKE ?').get(`${mes}%`);
  const reciclado = db.prepare("SELECT COALESCE(SUM(kg),0) t FROM residuos WHERE data LIKE ? AND destinacao = 'Reciclagem'").get(`${mes}%`);
  const isoOk = db.prepare("SELECT COUNT(*) c FROM iso_checklist WHERE status = 'conforme'").get().c;
  const isoAll = db.prepare('SELECT COUNT(*) c FROM iso_checklist').get().c;

  const percRec = residuosTot.t > 0 ? Number(((reciclado.t / residuosTot.t) * 100).toFixed(2)) : 0;
  const percIso = isoAll > 0 ? Number(((isoOk / isoAll) * 100).toFixed(2)) : 0;
  const pegada = Number(((energia.t * 0.0842) + (agua.t * 0.0003)).toFixed(2));

  res.json({
    mes,
    agua: { totalM3: agua.t, registros: agua.q },
    energia: { totalKwh: energia.t, registros: energia.q },
    residuos: {
      totalKg: residuosTot.t,
      recicladoKg: reciclado.t,
      percentualReciclado: percRec,
      registros: residuosTot.q
    },
    iso14000: { conformes: isoOk, total: isoAll, percentualConformidade: percIso },
    pegadaCarbono: { totalKgCO2e: pegada }
  });
});

/**
 * @swagger
 * /api/relatorios/ambiental-mensal/historico:
 *   get:
 *     summary: Histórico mensal para gráficos
 *     tags: [Relatórios]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Dados agrupados por mês }
 */
router.get('/ambiental-mensal/historico', (req, res) => {
  res.json({
    agua: db.prepare('SELECT substr(data,1,7) mes, COALESCE(SUM(m3),0) total FROM agua GROUP BY mes ORDER BY mes DESC LIMIT 6').all(),
    energia: db.prepare('SELECT substr(data,1,7) mes, COALESCE(SUM(kwh),0) total FROM energia GROUP BY mes ORDER BY mes DESC LIMIT 6').all(),
    residuos: db.prepare('SELECT substr(data,1,7) mes, COALESCE(SUM(kg),0) total FROM residuos GROUP BY mes ORDER BY mes DESC LIMIT 6').all()
  });
});

/**
 * @swagger
 * /api/relatorios/ambiental-mensal/variacao:
 *   get:
 *     summary: Variação mensal e alertas automáticos
 *     tags: [Relatórios]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: mes
 *         schema: { type: string, example: "2026-11" }
 *     responses:
 *       200: { description: Variações e lista de alertas }
 */
router.get('/ambiental-mensal/variacao', (req, res) => {
  const mesAtual = req.query.mes || new Date().toISOString().slice(0, 7);
  const [ano, mes] = mesAtual.split('-').map(Number);
  const mesAnterior = mes === 1
    ? `${ano - 1}-12`
    : `${ano}-${String(mes - 1).padStart(2, '0')}`;

  const somaAgua = (m) => db.prepare(
    'SELECT COALESCE(SUM(m3),0) t FROM agua WHERE data LIKE ?'
  ).get(`${m}%`).t;
  const somaEnergia = (m) => db.prepare(
    'SELECT COALESCE(SUM(kwh),0) t FROM energia WHERE data LIKE ?'
  ).get(`${m}%`).t;
  const somaResiduos = (m) => db.prepare(
    'SELECT COALESCE(SUM(kg),0) t FROM residuos WHERE data LIKE ?'
  ).get(`${m}%`).t;

  const aguaAtual = somaAgua(mesAtual);
  const aguaAnterior = somaAgua(mesAnterior);
  const energiaAtual = somaEnergia(mesAtual);
  const energiaAnterior = somaEnergia(mesAnterior);
  const residuosAtual = somaResiduos(mesAtual);
  const residuosAnterior = somaResiduos(mesAnterior);

  const calcVar = (atual, anterior) =>
    anterior === 0 ? null : Number((((atual - anterior) / anterior) * 100).toFixed(2));

  const aguaVar = calcVar(aguaAtual, aguaAnterior);
  const energiaVar = calcVar(energiaAtual, energiaAnterior);
  const residuosVar = calcVar(residuosAtual, residuosAnterior);

  const alertas = [];

  const geraAlertaConsumo = (recurso, varPerc) => {
    if (varPerc === null) return;
    if (varPerc > 15) {
      alertas.push({
        recurso,
        severidade: 'alta',
        mensagem: `Consumo de ${recurso} ${varPerc.toFixed(1)}% acima do mês anterior`,
        variacao: varPerc
      });
    } else if (varPerc > 5) {
      alertas.push({
        recurso,
        severidade: 'media',
        mensagem: `Consumo de ${recurso} ${varPerc.toFixed(1)}% acima do mês anterior`,
        variacao: varPerc
      });
    }
  };

  geraAlertaConsumo('agua', aguaVar);
  geraAlertaConsumo('energia', energiaVar);
  geraAlertaConsumo('residuos', residuosVar);

  const isoOk = db.prepare("SELECT COUNT(*) c FROM iso_checklist WHERE status='conforme'").get().c;
  const isoAll = db.prepare('SELECT COUNT(*) c FROM iso_checklist').get().c;
  const percIso = isoAll > 0 ? (isoOk / isoAll) * 100 : 100;
  if (percIso < 70) {
    alertas.push({
      recurso: 'iso',
      severidade: 'alta',
      mensagem: `Conformidade ISO em ${percIso.toFixed(1)}% (abaixo de 70%)`,
      variacao: Number(percIso.toFixed(2))
    });
  }

  const recicladoAtual = db.prepare(
    "SELECT COALESCE(SUM(kg),0) t FROM residuos WHERE data LIKE ? AND destinacao='Reciclagem'"
  ).get(`${mesAtual}%`).t;
  const percRec = residuosAtual > 0 ? (recicladoAtual / residuosAtual) * 100 : 100;
  if (percRec < 50) {
    alertas.push({
      recurso: 'residuos',
      severidade: 'media',
      mensagem: `Apenas ${percRec.toFixed(1)}% dos resíduos foram reciclados (abaixo de 50%)`,
      variacao: Number(percRec.toFixed(2))
    });
  }

  res.json({
    periodo: { atual: mesAtual, anterior: mesAnterior },
    agua: { mesAtual: aguaAtual, mesAnterior: aguaAnterior, variacaoPercentual: aguaVar },
    energia: { mesAtual: energiaAtual, mesAnterior: energiaAnterior, variacaoPercentual: energiaVar },
    residuos: { mesAtual: residuosAtual, mesAnterior: residuosAnterior, variacaoPercentual: residuosVar },
    alertas
  });
});

export default router;