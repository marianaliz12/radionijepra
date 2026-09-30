// Base de datos SQLite integrada en Node (node:sqlite), sin dependencias nativas.
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const roadmap = require('./roadmap');
const { hashPassword } = require('./auth-utils');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'radio-nijepra.db');

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    role TEXT NOT NULL CHECK (role IN ('admin','coordinador','estudiante')),
    password_hash TEXT NOT NULL,
    must_change INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS phases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    when_text TEXT NOT NULL,
    color TEXT NOT NULL,
    position INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    phase_id INTEGER NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    when_text TEXT NOT NULL,
    deliverable TEXT NOT NULL,
    guide TEXT NOT NULL,
    position INTEGER NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    done_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    done_at TEXT,
    verified INTEGER NOT NULL DEFAULT 0,
    verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    verified_at TEXT,
    note TEXT NOT NULL DEFAULT '',
    evidence_url TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    step_id INTEGER REFERENCES steps(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user','assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Sembrar o actualizar la hoja de ruta sin perder el avance registrado.
function seedRoadmap() {
  const upsertPhase = db.prepare(`
    INSERT INTO phases (key, title, subtitle, when_text, color, position)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET title=excluded.title, subtitle=excluded.subtitle,
      when_text=excluded.when_text, color=excluded.color, position=excluded.position`);
  const getPhase = db.prepare('SELECT id FROM phases WHERE key = ?');
  const upsertStep = db.prepare(`
    INSERT INTO steps (key, phase_id, title, when_text, deliverable, guide, position)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET phase_id=excluded.phase_id, title=excluded.title,
      when_text=excluded.when_text, deliverable=excluded.deliverable, guide=excluded.guide,
      position=excluded.position`);

  roadmap.forEach((phase, i) => {
    upsertPhase.run(phase.key, phase.title, phase.subtitle, phase.when, phase.color, i + 1);
    const { id } = getPhase.get(phase.key);
    phase.steps.forEach((s, j) => {
      upsertStep.run(s.key, id, s.title, s.when, s.deliverable, s.guide, j + 1);
    });
  });
}

// Crear el administrador inicial si no existe ningún usuario.
function seedAdmin() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (n > 0) return null;
  const email = process.env.ADMIN_EMAIL || 'admin@nijepra.edu.co';
  const password = process.env.ADMIN_PASSWORD || 'Nijepra2026!';
  const name = process.env.ADMIN_NAME || 'Administrador NIJEPRA';
  db.prepare(`INSERT INTO users (name, email, role, password_hash, must_change)
              VALUES (?, ?, 'admin', ?, 1)`).run(name, email, hashPassword(password));
  return { email, password };
}

seedRoadmap();
const createdAdmin = seedAdmin();

module.exports = { db, createdAdmin, DB_FILE };
