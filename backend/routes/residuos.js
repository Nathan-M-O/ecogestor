import { Router } from 'express';
import db from '../db.js';
import { verificarToken, requerAdmin, requerGestorOuAdmin } from '../auth.js';
import { validarData, validarString, validarNumero, validarEnum } from '../validators.js';

const router = Router();
router.use(verificarToken);

const DESTINACOES = ['Reciclagem', 'Compostagem', 'Aterro', 'Incineração'];

/**
 * @swagger
 * /api/residuos:
 *   get:
 *     summary: Lista registros de resíduos
 *     tags: [Resíduos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tipo
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
  let sql = 'SELECT * FROM residuos WHERE 1=1';
  const p = [];
  if (req.query.tipo) { sql += ' AND tipo = ?'; p.push(req.query.tipo); }
  if (req.query.dataInicio) { sql += ' AND data >= ?'; p.push(req.query.dataInicio); }
  if (req.query.dataFim) { sql += ' AND data <= ?'; p.push(req.query.dataFim); }
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
 * /api/residuos/{id}:
 *   get:
 *     summary: Busca registro por ID
 *     tags: [Resíduos]
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
  const r = db.prepare('SELECT * FROM residuos WHERE id = ?').get(req.params.id);
  if (!r) {
    return res.status(404).json({ erro: 'Não encontrado', mensagem: 'Registro não existe', status: 404 });
  }
  res.json(r);
});

/**
 * @swagger
 * /api/residuos:
 *   post:
 *     summary: Registra novo resíduo (gestor ou admin)
 *     tags: [Resíduos]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [data, tipo, kg, destinacao]
 *             properties:
 *               data: { type: string, example: "2026-11-10" }
 *               tipo: { type: string, example: "Reciclável" }
 *               kg: { type: number, example: 250 }
 *               destinacao:
 *                 type: string
 *                 enum: [Reciclagem, Compostagem, Aterro, Incineração]
 *     responses:
 *       201: { description: Criado }
 *       400: { description: Dados inválidos }
 *       401: { description: Não autorizado }
 *       403: { description: Requer perfil gestor ou admin }
 */
router.post('/', requerGestorOuAdmin, (req, res) => {
  const { data, tipo, kg, destinacao } = req.body;

  if (!validarData(data)) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'data deve estar no formato YYYY-MM-DD e ser válida', status: 400 });
  }
  if (!validarString(tipo, { min: 1, max: 50 })) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'tipo é obrigatório e deve ter até 50 caracteres', status: 400 });
  }
  if (!validarNumero(kg, { min: 0, max: 50000 })) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'kg deve ser número entre 0 e 50000', status: 400 });
  }
  if (!validarEnum(destinacao, DESTINACOES)) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: `destinacao deve ser uma de: ${DESTINACOES.join(', ')}`, status: 400 });
  }

  const r = db.prepare('INSERT INTO residuos (data, tipo, kg, destinacao) VALUES (?, ?, ?, ?)')
    .run(data, tipo.trim(), kg, destinacao);
  res.status(201).json(db.prepare('SELECT * FROM residuos WHERE id = ?').get(Number(r.lastInsertRowid)));
});

/**
 * @swagger
 * /api/residuos/{id}:
 *   put:
 *     summary: Atualiza registro (gestor ou admin)
 *     tags: [Resíduos]
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
 *               tipo: { type: string }
 *               kg: { type: number }
 *               destinacao:
 *                 type: string
 *                 enum: [Reciclagem, Compostagem, Aterro, Incineração]
 *     responses:
 *       200: { description: Atualizado }
 *       400: { description: Dados inválidos }
 *       401: { description: Não autorizado }
 *       403: { description: Requer perfil gestor ou admin }
 *       404: { description: Não encontrado }
 */
router.put('/:id', requerGestorOuAdmin, (req, res) => {
  if (!db.prepare('SELECT id FROM residuos WHERE id = ?').get(req.params.id)) {
    return res.status(404).json({ erro: 'Não encontrado', mensagem: 'Registro não existe', status: 404 });
  }
  const { data, tipo, kg, destinacao } = req.body;

  if (data !== undefined && !validarData(data)) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'data inválida', status: 400 });
  }
  if (tipo !== undefined && !validarString(tipo, { min: 1, max: 50 })) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'tipo deve ter entre 1 e 50 caracteres', status: 400 });
  }
  if (kg !== undefined && !validarNumero(kg, { min: 0, max: 50000 })) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'kg deve ser número entre 0 e 50000', status: 400 });
  }
  if (destinacao !== undefined && !validarEnum(destinacao, DESTINACOES)) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: `destinacao deve ser uma de: ${DESTINACOES.join(', ')}`, status: 400 });
  }

  db.prepare(`UPDATE residuos SET data = COALESCE(?, data),
              tipo = COALESCE(?, tipo), kg = COALESCE(?, kg),
              destinacao = COALESCE(?, destinacao) WHERE id = ?`)
    .run(data ?? null, tipo ? tipo.trim() : null, kg ?? null, destinacao ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM residuos WHERE id = ?').get(req.params.id));
});

/**
 * @swagger
 * /api/residuos/{id}:
 *   delete:
 *     summary: Remove registro (somente admin)
 *     tags: [Resíduos]
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
  const r = db.prepare('DELETE FROM residuos WHERE id = ?').run(req.params.id);
  if (r.changes === 0) {
    return res.status(404).json({ erro: 'Não encontrado', mensagem: 'Registro não existe', status: 404 });
  }
  res.status(204).send();
});

export default router;