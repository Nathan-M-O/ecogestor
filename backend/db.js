import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';

const db = new DatabaseSync('ecogestor.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    perfil TEXT NOT NULL DEFAULT 'stakeholder'
  );
  CREATE TABLE IF NOT EXISTS agua (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    setor TEXT NOT NULL,
    m3 REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS energia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    setor TEXT NOT NULL,
    kwh REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS residuos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    tipo TEXT NOT NULL,
    kg REAL NOT NULL,
    destinacao TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS iso_checklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requisito TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente'
  );
`);

// ===== SEED =====
if (db.prepare('SELECT COUNT(*) as c FROM usuarios').get().c === 0) {
  const seedUsuarios = [
    { nome: 'Administrador',     email: 'admin@eco.com',   senha: 'admin123', perfil: 'admin' },
    { nome: 'Gestor Teste',      email: 'gestor@eco.com',  senha: 'gstr123',  perfil: 'gestor' },
    { nome: 'Stakeholder Teste', email: 'stake@eco.com',   senha: 'stk123',   perfil: 'stakeholder' }
  ];
  const ins = db.prepare('INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)');
  for (const u of seedUsuarios) {
    ins.run(u.nome, u.email, bcrypt.hashSync(u.senha, 10), u.perfil);
  }
}

const mes = new Date().toISOString().slice(0, 7);
if (db.prepare('SELECT COUNT(*) as c FROM agua').get().c === 0) {
  const s = db.prepare('INSERT INTO agua (data, setor, m3) VALUES (?, ?, ?)');
  s.run(`${mes}-01`, 'Produção', 120.5);
  s.run(`${mes}-05`, 'Administrativo', 45.2);
  s.run(`${mes}-10`, 'Produção', 98.7);
  s.run(`${mes}-15`, 'Refeitório', 30.1);
}
if (db.prepare('SELECT COUNT(*) as c FROM energia').get().c === 0) {
  const s = db.prepare('INSERT INTO energia (data, setor, kwh) VALUES (?, ?, ?)');
  s.run(`${mes}-01`, 'Produção', 1500.0);
  s.run(`${mes}-05`, 'Administrativo', 800.5);
  s.run(`${mes}-10`, 'Produção', 1450.3);
}
if (db.prepare('SELECT COUNT(*) as c FROM residuos').get().c === 0) {
  const s = db.prepare('INSERT INTO residuos (data, tipo, kg, destinacao) VALUES (?, ?, ?, ?)');
  s.run(`${mes}-02`, 'Reciclável', 250.0, 'Reciclagem');
  s.run(`${mes}-07`, 'Orgânico', 180.5, 'Compostagem');
  s.run(`${mes}-12`, 'Perigoso', 15.0, 'Incineração');
  s.run(`${mes}-18`, 'Reciclável', 300.0, 'Reciclagem');
}
if (db.prepare('SELECT COUNT(*) as c FROM iso_checklist').get().c === 0) {
  const s = db.prepare('INSERT INTO iso_checklist (requisito, status) VALUES (?, ?)');
  s.run('Política ambiental documentada', 'conforme');
  s.run('Identificação de aspectos ambientais', 'conforme');
  s.run('Objetivos e metas ambientais definidos', 'pendente');
  s.run('Programa de treinamento ambiental', 'nao_conforme');
  s.run('Monitoramento de indicadores', 'conforme');
  s.run('Auditoria interna realizada', 'pendente');
}

export default db;