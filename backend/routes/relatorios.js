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

export default router;