import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'ecogestor-secret-2025';

export function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, email: usuario.email, perfil: usuario.perfil },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

export function verificarToken(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Não autorizado', mensagem: 'Token não fornecido', status: 401 });
  }
  try {
    req.usuario = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ erro: 'Não autorizado', mensagem: 'Token inválido ou expirado', status: 401 });
  }
}