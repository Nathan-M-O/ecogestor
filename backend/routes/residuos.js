import { Router } from 'express';
import db from '../db.js';
import { verificarToken } from '../auth.js';

const router = Router();
router.use(verificarToken);

router.get('/', (req, res) => res.json(db.prepare('SELECT * FROM residuos ORDER BY data DESC').all()));

router.get('/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM residuos WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ erro: 'Não encontrado', mensagem: 'Registro não existe', status: 404 });
  res.json(r);
});

router.post('/', (req, res) => {
  const { data, tipo, kg, destinacao } = req.body;
  if (!data || !tipo || kg == null || !destinacao) return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'data, tipo, kg e destinacao obrigatórios', status: 400 });
  if (typeof kg !== 'number' || kg < 0) return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'kg deve ser número ≥ 0', status: 400 });
  const r = db.prepare('INSERT INTO residuos (data, tipo, kg, destinacao) VALUES (?, ?, ?, ?)').run(data, tipo, kg, destinacao);
  res.status(201).json(db.prepare('SELECT * FROM residuos WHERE id = ?').get(Number(r.lastInsertRowid)));
});

router.put('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM residuos WHERE id = ?').get(req.params.id)) return res.status(404).json({ erro: 'Não encontrado', mensagem: 'Registro não existe', status: 404 });
  const { data, tipo, kg, destinacao } = req.body;
  db.prepare('UPDATE residuos SET data = COALESCE(?, data), tipo = COALESCE(?, tipo), kg = COALESCE(?, kg), destinacao = COALESCE(?, destinacao) WHERE id = ?')
    .run(data ?? null, tipo ?? null, kg ?? null, destinacao ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM residuos WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM residuos WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ erro: 'Não encontrado', mensagem: 'Registro não existe', status: 404 });
  res.status(204).send();
});

export default router;