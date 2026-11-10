import { Router } from 'express';
import db from '../db.js';
import { verificarToken } from '../auth.js';

const router = Router();
router.use(verificarToken);

router.get('/', (req, res) => res.json(db.prepare('SELECT * FROM iso_checklist ORDER BY id').all()));

router.post('/', (req, res) => {
  const { requisito, status } = req.body;
  if (!requisito) return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'requisito obrigatório', status: 400 });
  const s = ['conforme', 'nao_conforme', 'pendente'].includes(status) ? status : 'pendente';
  const r = db.prepare('INSERT INTO iso_checklist (requisito, status) VALUES (?, ?)').run(requisito, s);
  res.status(201).json(db.prepare('SELECT * FROM iso_checklist WHERE id = ?').get(Number(r.lastInsertRowid)));
});

router.put('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM iso_checklist WHERE id = ?').get(req.params.id)) return res.status(404).json({ erro: 'Não encontrado', mensagem: 'Item não existe', status: 404 });
  const { requisito, status } = req.body;
  db.prepare('UPDATE iso_checklist SET requisito = COALESCE(?, requisito), status = COALESCE(?, status) WHERE id = ?')
    .run(requisito ?? null, status ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM iso_checklist WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM iso_checklist WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ erro: 'Não encontrado', mensagem: 'Item não existe', status: 404 });
  res.status(204).send();
});

export default router;