import { Router } from 'express';
import db from '../db.js';
import { verificarToken } from '../auth.js';

const router = Router();
router.use(verificarToken);

router.get('/', (req, res) => res.json(db.prepare('SELECT * FROM energia ORDER BY data DESC').all()));

router.get('/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM energia WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ erro: 'Não encontrado', mensagem: 'Registro não existe', status: 404 });
  res.json(r);
});

router.post('/', (req, res) => {
  const { data, setor, kwh } = req.body;
  if (!data || !setor || kwh == null) return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'data, setor e kwh obrigatórios', status: 400 });
  if (typeof kwh !== 'number' || kwh < 0) return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'kwh deve ser número ≥ 0', status: 400 });
  const r = db.prepare('INSERT INTO energia (data, setor, kwh) VALUES (?, ?, ?)').run(data, setor, kwh);
  res.status(201).json(db.prepare('SELECT * FROM energia WHERE id = ?').get(Number(r.lastInsertRowid)));
});

router.put('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM energia WHERE id = ?').get(req.params.id)) return res.status(404).json({ erro: 'Não encontrado', mensagem: 'Registro não existe', status: 404 });
  const { data, setor, kwh } = req.body;
  db.prepare('UPDATE energia SET data = COALESCE(?, data), setor = COALESCE(?, setor), kwh = COALESCE(?, kwh) WHERE id = ?')
    .run(data ?? null, setor ?? null, kwh ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM energia WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM energia WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ erro: 'Não encontrado', mensagem: 'Registro não existe', status: 404 });
  res.status(204).send();
});

export default router;