import { Router } from 'express';
import db from '../db.js';
import { verificarToken, requerAdmin, requerGestorOuAdmin } from '../auth.js';
import { validarData, validarString, validarNumero } from '../validators.js';

const router = Router();
router.use(verificarToken);

/**
 * @swagger
 * /api/agua:
 *   get:
 *     summary: Lista registros de consumo de água
 *     tags: [Água]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: setor
 *         schema: { type: string }
 *       - in: query
 *         name: dataInicio
 *         schema: { type: string }
 *       - in: query
 *         name: dataFim
 *         schema: { type: string }
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
  const { setor, dataInicio, dataFim } = req.query;
  let sql = 'SELECT * FROM agua WHERE 1=1';
  const p = [];
  if (setor) { sql += ' AND setor = ?'; p.push(setor); }
  if (dataInicio) { sql += ' AND data >= ?'; p.push(dataInicio); }
  if (dataFim) { sql += ' AND data <= ?'; p.push(dataFim); }
  sql += ' ORDER BY data DESC';

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
 * /api/agua/{id}:
 *   get:
 *     summary: Busca registro por ID
 *     tags: [Água]
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
  const r = db.prepare('SELECT * FROM agua WHERE id = ?').get(req.params.id);
  if (!r) {
    return res.status(404).json({ erro: 'Não encontrado', mensagem: 'Registro não existe', status: 404 });
  }
  res.json(r);
});

/**
 * @swagger
 * /api/agua:
 *   post:
 *     summary: Registra novo consumo (gestor ou admin)
 *     tags: [Água]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [data, setor, m3]
 *             properties:
 *               data: { type: string, example: "2026-11-10" }
 *               setor: { type: string, example: "Produção" }
 *               m3: { type: number, example: 120.5 }
 *     responses:
 *       201: { description: Criado }
 *       400: { description: Dados inválidos }
 *       401: { description: Não autorizado }
 *       403: { description: Requer perfil gestor ou admin }
 */
router.post('/', requerGestorOuAdmin, (req, res) => {
  const { data, setor, m3 } = req.body;

  if (!validarData(data)) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'data deve estar no formato YYYY-MM-DD e ser válida', status: 400 });
  }
  if (!validarString(setor, { min: 1, max: 100 })) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'setor é obrigatório e deve ter até 100 caracteres', status: 400 });
  }
  if (!validarNumero(m3, { min: 0, max: 100000 })) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'm3 deve ser número entre 0 e 100000', status: 400 });
  }

  const r = db.prepare('INSERT INTO agua (data, setor, m3) VALUES (?, ?, ?)')
    .run(data, setor.trim(), m3);
  res.status(201).json(db.prepare('SELECT * FROM agua WHERE id = ?').get(Number(r.lastInsertRowid)));
});

/**
 * @swagger
 * /api/agua/{id}:
 *   put:
 *     summary: Atualiza registro (gestor ou admin)
 *     tags: [Água]
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
 *               data: { type: string }
 *               setor: { type: string }
 *               m3: { type: number }
 *     responses:
 *       200: { description: Atualizado }
 *       400: { description: Dados inválidos }
 *       401: { description: Não autorizado }
 *       403: { description: Requer perfil gestor ou admin }
 *       404: { description: Não encontrado }
 */
router.put('/:id', requerGestorOuAdmin, (req, res) => {
  if (!db.prepare('SELECT id FROM agua WHERE id = ?').get(req.params.id)) {
    return res.status(404).json({ erro: 'Não encontrado', mensagem: 'Registro não existe', status: 404 });
  }
  const { data, setor, m3 } = req.body;

  if (data !== undefined && !validarData(data)) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'data deve estar no formato YYYY-MM-DD e ser válida', status: 400 });
  }
  if (setor !== undefined && !validarString(setor, { min: 1, max: 100 })) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'setor deve ter entre 1 e 100 caracteres', status: 400 });
  }
  if (m3 !== undefined && !validarNumero(m3, { min: 0, max: 100000 })) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'm3 deve ser número entre 0 e 100000', status: 400 });
  }

  db.prepare(`UPDATE agua SET data = COALESCE(?, data),
              setor = COALESCE(?, setor), m3 = COALESCE(?, m3)
              WHERE id = ?`)
    .run(data ?? null, setor ? setor.trim() : null, m3 ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM agua WHERE id = ?').get(req.params.id));
});

/**
 * @swagger
 * /api/agua/{id}:
 *   delete:
 *     summary: Remove registro (somente admin)
 *     tags: [Água]
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
  const r = db.prepare('DELETE FROM agua WHERE id = ?').run(req.params.id);
  if (r.changes === 0) {
    return res.status(404).json({ erro: 'Não encontrado', mensagem: 'Registro não existe', status: 404 });
  }
  res.status(204).send();
});

export default router;