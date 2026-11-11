import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { gerarToken, verificarToken, requerAdmin } from '../auth.js';
import { validarString, validarEmail, validarEnum } from '../validators.js';

const router = Router();
const PERFIS = ['admin', 'gestor', 'stakeholder'];

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
 *       400: { description: Dados inválidos }
 *       401: { description: Credenciais inválidas }
 */
router.post('/login', (req, res) => {
  const { email, senha } = req.body;

  if (!validarEmail(email)) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'E-mail inválido', status: 400 });
  }
  if (!validarString(senha, { min: 1, max: 100 })) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'Senha obrigatória', status: 400 });
  }

  const u = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  if (!u || !bcrypt.compareSync(senha, u.senha)) {
    return res.status(401).json({ erro: 'Não autorizado', mensagem: 'E-mail ou senha inválidos', status: 401 });
  }
  res.json({
    token: gerarToken(u),
    usuario: { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil }
  });
});

/**
 * @swagger
 * /api/auth/registro:
 *   post:
 *     summary: Registra novo usuário (somente admin)
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
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
 *       400: { description: Dados inválidos }
 *       401: { description: Não autorizado }
 *       403: { description: Requer perfil admin }
 *       409: { description: E-mail já cadastrado }
 */
router.post('/registro', verificarToken, requerAdmin, (req, res) => {
  const { nome, email, senha, perfil } = req.body;

  if (!validarString(nome, { min: 1, max: 100 })) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'nome é obrigatório e deve ter até 100 caracteres', status: 400 });
  }
  if (!validarEmail(email)) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'E-mail inválido', status: 400 });
  }
  if (!validarString(senha, { min: 6, max: 100 })) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: 'senha deve ter entre 6 e 100 caracteres', status: 400 });
  }
  const p = perfil || 'stakeholder';
  if (!validarEnum(p, PERFIS)) {
    return res.status(400).json({ erro: 'Dados inválidos', mensagem: `perfil deve ser um de: ${PERFIS.join(', ')}`, status: 400 });
  }

  if (db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email)) {
    return res.status(409).json({ erro: 'Conflito', mensagem: 'E-mail já cadastrado', status: 409 });
  }

  const r = db.prepare('INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)')
    .run(nome.trim(), email, bcrypt.hashSync(senha, 10), p);
  res.status(201).json({ id: Number(r.lastInsertRowid), nome: nome.trim(), email, perfil: p });
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
 *       404: { description: Usuário não encontrado }
 */
router.get('/me', verificarToken, (req, res) => {
  const u = db.prepare('SELECT id, nome, email, perfil FROM usuarios WHERE id = ?').get(req.usuario.id);
  if (!u) {
    return res.status(404).json({ erro: 'Não encontrado', mensagem: 'Usuário não existe', status: 404 });
  }
  res.json(u);
});

export default router;