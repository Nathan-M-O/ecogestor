import { Router } from 'express';
import db from '../db.js';
import { verificarToken } from '../auth.js';

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
 *     responses:
 *       200: { description: Lista }
 */
router.get('/', (req, res) => {
  const { setor, dataInicio, dataFim } = req.query;
  let sql = 'SELECT * FROM agua WHERE 1=1';
  const p = [];
  if (setor) { sql += ' AND setor = ?'; p.push(setor); }
  if (dataInicio) { sql += ' AND data >= ?'; p.push(dataInicio); }
  if (dataFim) { sql += ' AND data <= ?'; p.push(dataFim); }
  sql += ' ORDER BY data DESC';
  res.json(db.prepare(sql).all(...p));
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
 *       404: { description: Não encontrado }
 */
router.get('/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM agua WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ erro: 'Não encontrado', mensagem: 'Registro não existe', status: 404 });
  res.json(r);
});

/**
 * @swagger
 * /api/agua:
 *   post:
 *     summary: Registra novo consumo
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
 *               data: { type: string, example: "2025-11-10" }
 *               setor: { type: string, example: "Produção" }
 *               m3: { type: number, example: 120.5 }
 *     responses:
 *       201: { description: Criado }
 */
router.post('/', (req, res) => {
  const { data, setor, m3 } = req.body;
  if (!data || !setor || m3 == null) return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'data, setor e m3 obrigatórios', status: 400 });
  if (typeof m3 !== 'number' || m3 < 0) return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'm3 deve ser número ≥ 0', status: 400 });
  const r = db.prepare('INSERT INTO agua (data, setor, m3) VALUES (?, ?, ?)').run(data, setor, m3);
  res.status(201).json(db.prepare('SELECT * FROM agua WHERE id = ?').get(Number(r.lastInsertRowid)));
});

/**
 * @swagger
 * /api/agua/{id}:
 *   put:
 *     summary: Atualiza registro
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
 *       404: { description: Não encontrado }
 */
router.put('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM agua WHERE id = ?').get(req.params.id)) {
    return res.status(404).json({ erro: 'Não encontrado', mensagem: 'Registro não existe', status: 404 });
  }
  const { data, setor, m3 } = req.body;
  db.prepare('UPDATE agua SET data = COALESCE(?, data), setor = COALESCE(?, setor), m3 = COALESCE(?, m3) WHERE id = ?')
    .run(data ?? null, setor ?? null, m3 ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM agua WHERE id = ?').get(req.params.id));
});

/**
 * @swagger
 * /api/agua/{id}:
 *   delete:
 *     summary: Remove registro
 *     tags: [Água]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Removido }
 *       404: { description: Não encontrado }
 */
router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM agua WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ erro: 'Não encontrado', mensagem: 'Registro não existe', status: 404 });
  res.status(204).send();
});

export default router;