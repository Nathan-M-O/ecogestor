import { Router } from 'express';
import db from '../db.js';
import { verificarToken, requerAdmin, requerGestorOuAdmin } from '../auth.js';
import { validarString, validarEnum } from '../validators.js';

const router = Router();
router.use(verificarToken);

const STATUS_VALIDOS = ['conforme', 'nao_conforme', 'pendente'];

/**
 * @swagger
 * /api/iso:
 *   get:
 *     summary: Lista itens do checklist ISO 14.000
 *     tags: [ISO]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [conforme, nao_conforme, pendente]
 *       - in: query
 *         name: pagina
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limite
 *         schema: { type: integer, default: 100 }
 *     responses:
 *       200: { description: Lista paginada }
 *       401: { description: Não autorizado }
 */
router.get('/', (req, res) => {
  let sql = 'SELECT * FROM iso_checklist WHERE 1=1';
  const p = [];
  if (req.query.status) { sql += ' AND status = ?'; p.push(req.query.status); }
  sql += ' ORDER BY id';

  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const limite = Math.min(100, Math.max(1, parseInt(req.query.limite) || 100));
  const offset = (pagina - 1) * limite;

  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as c');
  const total = db.prepare(countSql).get(...p).c;
  const dados = db.prepare(sql + ' LIMIT ? OFFSET ?').all(...p, limite, offset);

  res.json({ dados, total, pagina, limite, totalPaginas: Math.ceil(total / limite) });
});

/**
 * @swagger
 * /api/iso/{id}:
 *   get:
 *     summary: Busca item do checklist por ID
 *     tags: [ISO]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Encontrado }
 *       401: { description: Não autorizado }
 *       404: { description: Não encontrado }
 */
router.get('/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM iso_checklist WHERE id = ?').get(req.params.id);
  if (!r) {
    return res.status(404).json({ erro: 'Não encontrado', mensagem: 'Item não existe', status: 404 });
  }
  res.json(r);
});

/**
 * @swagger
 * /api/iso:
 *   post:
 *     summary: Cria novo item do checklist (gestor ou admin)
 *     tags: [ISO]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requisito]
 *             properties:
 *               requisito: { type: string, example: "Política ambiental documentada" }
 *               status:
 *                 type: string
 *                 enum: [conforme, nao_conforme, pendente]
 *                 default: pendente
 *     responses:
 *       201: { description: Criado }
 *       400: { description: Dados inválidos }
 *       401: { description: Não autorizado }
 *       403: { description: Requer perfil gestor ou admin }
 */
router.post('/', requerGestorOuAdmin, (req, res) => {
  const { requisito, status } = req.body;

  if (!validarString(requisito, { min: 1, max: 200 })) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'requisito é obrigatório e deve ter até 200 caracteres', status: 400 });
  }
  const s = status === undefined ? 'pendente' : status;
  if (!validarEnum(s, STATUS_VALIDOS)) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: `status deve ser um de: ${STATUS_VALIDOS.join(', ')}`, status: 400 });
  }

  const r = db.prepare('INSERT INTO iso_checklist (requisito, status) VALUES (?, ?)')
    .run(requisito.trim(), s);
  res.status(201).json(db.prepare('SELECT * FROM iso_checklist WHERE id = ?').get(Number(r.lastInsertRowid)));
});

/**
 * @swagger
 * /api/iso/{id}:
 *   put:
 *     summary: Atualiza item do checklist (gestor ou admin)
 *     tags: [ISO]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               requisito: { type: string }
 *               status:
 *                 type: string
 *                 enum: [conforme, nao_conforme, pendente]
 *     responses:
 *       200: { description: Atualizado }
 *       400: { description: Dados inválidos }
 *       401: { description: Não autorizado }
 *       403: { description: Requer perfil gestor ou admin }
 *       404: { description: Não encontrado }
 */
router.put('/:id', requerGestorOuAdmin, (req, res) => {
  if (!db.prepare('SELECT id FROM iso_checklist WHERE id = ?').get(req.params.id)) {
    return res.status(404).json({ erro: 'Não encontrado', mensagem: 'Item não existe', status: 404 });
  }
  const { requisito, status } = req.body;

  if (requisito !== undefined && !validarString(requisito, { min: 1, max: 200 })) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'requisito deve ter entre 1 e 200 caracteres', status: 400 });
  }
  if (status !== undefined && !validarEnum(status, STATUS_VALIDOS)) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: `status deve ser um de: ${STATUS_VALIDOS.join(', ')}`, status: 400 });
  }

  db.prepare(`UPDATE iso_checklist SET requisito = COALESCE(?, requisito),
              status = COALESCE(?, status) WHERE id = ?`)
    .run(requisito ? requisito.trim() : null, status ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM iso_checklist WHERE id = ?').get(req.params.id));
});

/**
 * @swagger
 * /api/iso/{id}:
 *   delete:
 *     summary: Remove item do checklist (somente admin)
 *     tags: [ISO]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Removido }
 *       401: { description: Não autorizado }
 *       403: { description: Requer perfil admin }
 *       404: { description: Não encontrado }
 */
router.delete('/:id', requerAdmin, (req, res) => {
  const r = db.prepare('DELETE FROM iso_checklist WHERE id = ?').run(req.params.id);
  if (r.changes === 0) {
    return res.status(404).json({ erro: 'Não encontrado', mensagem: 'Item não existe', status: 404 });
  }
  res.status(204).send();
});

export default router;