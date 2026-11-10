import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { gerarToken, verificarToken } from '../auth.js';

const router = Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Autentica usuário e retorna token JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, example: admin@eco.com }
 *               senha: { type: string, example: admin123 }
 *     responses:
 *       200: { description: Login realizado }
 *       401: { description: Credenciais inválidas }
 */
router.post('/login', (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'E-mail e senha obrigatórios', status: 400 });
  const u = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  if (!u || !bcrypt.compareSync(senha, u.senha)) return res.status(401).json({ erro: 'Não autorizado', mensagem: 'E-mail ou senha inválidos', status: 401 });
  res.json({ token: gerarToken(u), usuario: { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil } });
});

/**
 * @swagger
 * /api/auth/registro:
 *   post:
 *     summary: Registra novo usuário
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome: { type: string }
 *               email: { type: string }
 *               senha: { type: string }
 *               perfil: { type: string, enum: [admin, gestor, stakeholder] }
 *     responses:
 *       201: { description: Usuário criado }
 */
router.post('/registro', (req, res) => {
  const { nome, email, senha, perfil } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'Nome, e-mail e senha obrigatórios', status: 400 });
  if (db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email)) {
    return res.status(409).json({ erro: 'Conflito', mensagem: 'E-mail já cadastrado', status: 409 });
  }
  const r = db.prepare('INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)')
    .run(nome, email, bcrypt.hashSync(senha, 10), perfil || 'stakeholder');
  res.status(201).json({ id: Number(r.lastInsertRowid), nome, email, perfil: perfil || 'stakeholder' });
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Dados do usuário autenticado
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Dados do usuário }
 */
router.get('/me', verificarToken, (req, res) => {
  const u = db.prepare('SELECT id, nome, email, perfil FROM usuarios WHERE id = ?').get(req.usuario.id);
  if (!u) return res.status(404).json({ erro: 'Não encontrado', mensagem: 'Usuário não existe', status: 404 });
  res.json(u);
});

export default router;